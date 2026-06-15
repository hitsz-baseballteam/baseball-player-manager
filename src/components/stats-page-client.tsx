"use client";

import { Fragment, useCallback, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import styles from "@/components/stats-page-client.module.css";
import {
  computeBattingLine,
  computeFieldingLine,
  computePitchingLine,
  type BattingLine,
  type FieldingLine,
  type PitchingLine,
} from "@/lib/stats";
import {
  cloneWorkspace,
  createId,
  sanitizeWorkspace,
  type Game,
  type InningRecord,
  type Player,
  type PlayerGameStatLine,
  type Workspace,
} from "@/lib/workspace";
import {
  isVersionConflict,
  loadWorkspaceSnapshot,
  saveWithRetry,
} from "@/lib/workspace-client";

const NAV_ITEMS = [
  { label: "总览", href: "/" },
  { label: "名册", href: "/roster" },
  { label: "战术场景", href: "/scenarios" },
  { label: "数据中心", href: "/stats", active: true },
  { label: "设置", href: "/settings" },
] as const;

type TabType = "players" | "games";
type PlayerSortKey = "G" | "AVG" | "HR" | "RBI" | "OPS" | "E" | "FPCT" | "ERA" | "WHIP" | "SO";
type SortDir = "asc" | "desc";

type GameDialogState =
  | { type: "closed" }
  | { type: "add" }
  | { type: "edit"; game: Game };

type StatsPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

function emptyPlayerGameStatLine(playerId: string): PlayerGameStatLine {
  return {
    playerId,
    pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, r: 0, sb: 0, bb: 0, so: 0,
    ip: null, er: null, soPitching: null, bbPitching: null, hPitching: null,
    po: 0, a: 0, e: 0,
  };
}

function emptyInning(inning: number): InningRecord {
  return { inning, hits: 0, runs: 0, batters: [] };
}

function emptyGame(playerIds: string[]): Game {
  return {
    id: createId(),
    date: "",
    opponent: "",
    gameType: "official",
    totalInnings: 9,
    innings: Array.from({ length: 9 }, (_, i) => emptyInning(i + 1)),
    statLines: playerIds.map(emptyPlayerGameStatLine),
  };
}

function sortNumeric(a: number, b: number, dir: SortDir): number {
  return dir === "desc" ? b - a : a - b;
}

function sortStringAsNum(a: string, b: string, dir: SortDir): number {
  return sortNumeric(Number.parseFloat(a) || 0, Number.parseFloat(b) || 0, dir);
}

export function StatsPageClient({
  initialWorkspace,
  initialVersion,
}: StatsPageClientProps) {
  const toastRef = useRef<ToastHandle | null>(null);

  const [workspace, setWorkspace] = useState(() => sanitizeWorkspace(initialWorkspace));
  const [version, setVersion] = useState(initialVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs to avoid stale closures in async save handler and prevent concurrent saves
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const versionRef = useRef(version);
  versionRef.current = version;
  const savingRef = useRef(false);

  const [tab, setTab] = useState<TabType>("players");
  const [playerSortKey, setPlayerSortKey] = useState<PlayerSortKey>("AVG");
  const [playerSortDir, setPlayerSortDir] = useState<SortDir>("desc");
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<GameDialogState>({ type: "closed" });

  // ── Save ──
  // applyMutation is the pure function to apply to the latest workspace.
  // It is used both for optimistic local update and conflict retry.
  const handleSave = useCallback(
    async (applyMutation: (current: Workspace) => Workspace) => {
      // Prevent concurrent saves within the same session
      if (savingRef.current) {
        toastRef.current?.showToast("操作已在保存中，请稍后再试。");
        return;
      }
      savingRef.current = true;

      const optimistic = applyMutation(workspaceRef.current);
      setWorkspace(optimistic);
      setIsSaving(true);
      setSaveError(null);

      try {
        const result = await saveWithRetry(optimistic, versionRef.current, applyMutation);
        setVersion(result.version);
        setWorkspace(sanitizeWorkspace(result.workspace));
      } catch (error) {
        // On any failure, reload server snapshot to roll back optimistic update
        let reloaded = false;
        try {
          const snapshot = await loadWorkspaceSnapshot();
          setVersion(snapshot.version);
          setWorkspace(sanitizeWorkspace(snapshot.workspace));
          reloaded = true;
        } catch {
          // If reload also fails, leave current state as-is (best effort)
        }

        if (reloaded) {
          if (isVersionConflict(error)) {
            toastRef.current?.showToast("数据已被其他会话更新，已恢复到最新状态，请重新操作。");
          } else {
            console.error("Save failed:", error);
            setSaveError("保存失败，已恢复到最新数据，请重试。");
          }
        } else {
          console.error("Save failed and reload failed:", error);
          toastRef.current?.showToast("保存失败且无法连接服务器，当前显示内容可能未同步。");
          setSaveError("保存失败，请检查网络后刷新页面。");
        }
      } finally {
        setIsSaving(false);
        savingRef.current = false;
      }
    },
    [],
  );

  // ── Player leaderboard ──
  const playerRows = useMemo(() => {
    return workspace.players
      .map((player) => {
        const batting = computeBattingLine(workspace.games, player.id);
        const fielding = computeFieldingLine(workspace.games, player.id);
        const pitching = player.profile.profileType === "pitcher"
          ? computePitchingLine(workspace.games, player.id)
          : null;
        return { player, batting, pitching, fielding };
      })
      .filter((r) => r.batting.G > 0 || (r.pitching && r.pitching.G > 0) || r.fielding.G > 0)
      .sort((a, b) => {
        switch (playerSortKey) {
          case "AVG": return sortStringAsNum(a.batting.AVG, b.batting.AVG, playerSortDir);
          case "HR": return sortNumeric(a.batting.HR, b.batting.HR, playerSortDir);
          case "RBI": return sortNumeric(a.batting.RBI, b.batting.RBI, playerSortDir);
          case "OPS": return sortStringAsNum(a.batting.OPS, b.batting.OPS, playerSortDir);
          case "E": return sortNumeric(a.fielding.E, b.fielding.E, playerSortDir === "desc" ? "asc" : "desc");
          case "FPCT": return sortStringAsNum(a.fielding.FPCT, b.fielding.FPCT, playerSortDir);
          case "ERA": return sortStringAsNum(
            a.pitching?.ERA ?? "999.99",
            b.pitching?.ERA ?? "999.99",
            playerSortDir === "desc" ? "asc" : "desc",
          );
          case "WHIP": return sortStringAsNum(
            a.pitching?.WHIP ?? "999.99",
            b.pitching?.WHIP ?? "999.99",
            playerSortDir === "desc" ? "asc" : "desc",
          );
          case "SO": return sortNumeric(
            (a.pitching?.SO ?? 0) + a.batting.SO,
            (b.pitching?.SO ?? 0) + b.batting.SO,
            playerSortDir,
          );
          case "G":
          default: return sortNumeric(a.batting.G, b.batting.G, playerSortDir);
        }
      });
  }, [workspace.players, workspace.games, playerSortKey, playerSortDir]);

  function handlePlayerSort(key: PlayerSortKey) {
    if (playerSortKey === key) {
      setPlayerSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setPlayerSortKey(key);
      setPlayerSortDir(key === "ERA" || key === "WHIP" || key === "E" ? "asc" : "desc");
    }
  }

  function sortIndicator(dir: SortDir | null) {
    if (!dir) return null;
    return <span className={styles.sortDir}>{dir === "desc" ? "▾" : "▴"}</span>;
  }

  const activePlayerSort = (key: PlayerSortKey): SortDir | null =>
    playerSortKey === key ? playerSortDir : null;

  // ── Games list ──
  const sortedGames = useMemo(
    () => [...workspace.games].sort((a, b) => b.date.localeCompare(a.date)),
    [workspace.games],
  );

  // ── Game operations ──
  function handleAddGame(game: Game) {
    handleSave((current) => {
      const next = cloneWorkspace(current);
      next.games = [...current.games, game];
      return next;
    });
    setDialog({ type: "closed" });
  }

  function handleEditGame(game: Game) {
    handleSave((current) => {
      const next = cloneWorkspace(current);
      next.games = current.games.map((g) => (g.id === game.id ? game : g));
      return next;
    });
    setDialog({ type: "closed" });
  }

  function handleDeleteGame(gameId: string) {
    if (!window.confirm("确认删除该场比赛？")) return;
    handleSave((current) => {
      const next = cloneWorkspace(current);
      next.games = current.games.filter((g) => g.id !== gameId);
      return next;
    });
  }

  return (
    <ToastProvider toastRef={toastRef}>
      <AppShell
        eyebrow="Data Center"
        title="数据中心"
        description="球员统计与比赛记录管理。"
        statusLabel="工作区"
        statusValue={`v${version}`}
        statusMeta={isSaving ? "保存中…" : ""}
        navItems={[...NAV_ITEMS]}
        actions={<ThemeToggle />}
      >
        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={tab === "players" ? styles.tabActive : styles.tab}
            onClick={() => setTab("players")}
          >
            球员数据
          </button>
          <button
            className={tab === "games" ? styles.tabActive : styles.tab}
            onClick={() => setTab("games")}
          >
            比赛数据
          </button>
        </div>

        <div className={styles.saveBar}>
          {saveError && <span className={styles.saveError}>{saveError}</span>}
          {isSaving && <span className={styles.saveStatus}>保存中…</span>}
        </div>

        {/* TAB: Players */}
        {tab === "players" && (
          <div className={styles.tableWrap}>
            {playerRows.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>暂无球员统计数据</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>球员</th>
                    <th className={styles.sortable} onClick={() => handlePlayerSort("G")}>G{sortIndicator(activePlayerSort("G"))}</th>
                    <th className={styles.sortable} onClick={() => handlePlayerSort("AVG")}>AVG{sortIndicator(activePlayerSort("AVG"))}</th>
                    <th className={styles.sortable} onClick={() => handlePlayerSort("HR")}>HR{sortIndicator(activePlayerSort("HR"))}</th>
                    <th className={styles.sortable} onClick={() => handlePlayerSort("RBI")}>RBI{sortIndicator(activePlayerSort("RBI"))}</th>
                    <th className={styles.sortable} onClick={() => handlePlayerSort("OPS")}>OPS{sortIndicator(activePlayerSort("OPS"))}</th>
                    <th className={styles.sortable} onClick={() => handlePlayerSort("E")}>E{sortIndicator(activePlayerSort("E"))}</th>
                    <th className={styles.sortable} onClick={() => handlePlayerSort("FPCT")}>FPCT{sortIndicator(activePlayerSort("FPCT"))}</th>
                    <th className={styles.sortable} onClick={() => handlePlayerSort("ERA")}>ERA{sortIndicator(activePlayerSort("ERA"))}</th>
                    <th className={styles.sortable} onClick={() => handlePlayerSort("WHIP")}>WHIP{sortIndicator(activePlayerSort("WHIP"))}</th>
                  </tr>
                </thead>
                <tbody>
                  {playerRows.map(({ player, batting, pitching, fielding }) => (
                    <tr key={player.id}>
                      <td>
                        <span className={styles.playerName}>{player.name}</span>
                        <span className={styles.playerMeta}>#{player.number}</span>
                      </td>
                      <td>{batting.G}</td>
                      <td>{batting.AVG}</td>
                      <td>{batting.HR}</td>
                      <td>{batting.RBI}</td>
                      <td>{batting.OPS}</td>
                      <td>{fielding.E || "-"}</td>
                      <td>{fielding.G > 0 ? fielding.FPCT : "-"}</td>
                      <td>{pitching?.ERA ?? "-"}</td>
                      <td>{pitching?.WHIP ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB: Games */}
        {tab === "games" && (
          <div className={styles.tableWrap}>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 0" }}>
              <button
                className={styles.btnSmall}
                onClick={() => setDialog({ type: "add" })}
                disabled={isSaving}
              >
                ＋ 添加比赛
              </button>
            </div>

            {sortedGames.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>暂无比赛记录</p>
                <p className={styles.emptySub}>点击上方「添加比赛」录入第一场比赛</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>对手</th>
                    <th>类型</th>
                    <th>局数</th>
                    <th>每局概况</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedGames.map((game) => {
                    const isExpanded = expandedGameId === game.id;
                    const inningSummary = game.innings
                      .map((inn) => `${inn.inning}回:${inn.hits}安${inn.runs}得`)
                      .join(" · ");
                    return (
                      <Fragment key={game.id}>
                        <tr
                          key={game.id}
                          className={isExpanded ? styles.expanded : undefined}
                          onClick={() => setExpandedGameId(isExpanded ? null : game.id)}
                        >
                          <td>{game.date}</td>
                          <td>{game.opponent}</td>
                          <td>
                            <span className={game.gameType === "official" ? styles.gameTypeOfficial : styles.gameTypeTraining}>
                              {game.gameType === "official" ? "正式" : "训练"}
                            </span>
                          </td>
                          <td>{game.totalInnings}</td>
                          <td style={{ fontSize: "11px", color: "var(--theme-muted)" }}>{inningSummary}</td>
                          <td>
                            <div className={styles.gameLogActions} onClick={(e) => e.stopPropagation()}>
                              <button className={styles.btnSmall} onClick={() => setDialog({ type: "edit", game })} disabled={isSaving}>编辑</button>
                              <button className={styles.btnSmallDanger} onClick={() => handleDeleteGame(game.id)} disabled={isSaving}>删除</button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className={styles.expandedRow}>
                            <td colSpan={6} className={styles.expandedCell}>
                              <div className={styles.expandedPanel}>
                                <div className={styles.expandedHeader}>
                                  <span className={styles.expandedTitle}>每局详情</span>
                                </div>
                                <table className={styles.gameLog}>
                                  <thead>
                                    <tr>
                                      <th>局次</th>
                                      <th>安打</th>
                                      <th>得分</th>
                                      <th>上场打者</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {game.innings.map((inn) => {
                                      const batterNames = inn.batters
                                        .map((id) => workspace.players.find((p) => p.id === id)?.name ?? id)
                                        .join("、");
                                      return (
                                        <tr key={inn.inning}>
                                          <td>{inn.inning}回</td>
                                          <td>{inn.hits}</td>
                                          <td>{inn.runs}</td>
                                          <td style={{ fontSize: "12px" }}>{batterNames || "-"}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>

                                {game.statLines.length > 0 && (
                                  <>
                                    <div className={styles.expandedHeader}>
                                      <span className={styles.expandedTitle}>球员本场数据</span>
                                    </div>
                                    <table className={styles.gameLog}>
                                      <thead>
                                        <tr>
                                          <th>球员</th>
                                          <th>AB</th>
                                          <th>H</th>
                                          <th>HR</th>
                                          <th>RBI</th>
                                          <th>BB</th>
                                          <th>SO</th>
                                          <th>IP</th>
                                          <th>ER</th>
                                          <th>PO</th>
                                          <th>A</th>
                                          <th>E</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {game.statLines.map((sl) => {
                                          const p = workspace.players.find((x) => x.id === sl.playerId);
                                          return (
                                            <tr key={sl.playerId}>
                                              <td>{p?.name ?? sl.playerId}</td>
                                              <td>{sl.ab}</td>
                                              <td>{sl.h}</td>
                                              <td>{sl.hr || "-"}</td>
                                              <td>{sl.rbi || "-"}</td>
                                              <td>{sl.bb || "-"}</td>
                                              <td>{sl.so || "-"}</td>
                                              <td>{sl.ip ?? "-"}</td>
                                              <td>{sl.er ?? "-"}</td>
                                              <td>{sl.po || "-"}</td>
                                              <td>{sl.a || "-"}</td>
                                              <td>{sl.e || "-"}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </AppShell>

      {/* Game Dialog */}
      {dialog.type !== "closed" && (
        <GameDialog
          mode={dialog.type === "add" ? "add" : "edit"}
          initial={dialog.type === "edit" ? structuredClone(dialog.game) : emptyGame(workspace.players.map((p) => p.id))}
          players={workspace.players}
          onSubmit={dialog.type === "add" ? handleAddGame : handleEditGame}
          onClose={() => setDialog({ type: "closed" })}
          disabled={isSaving}
        />
      )}
    </ToastProvider>
  );
}

// ── Game Dialog ──

type GameDialogProps = {
  mode: "add" | "edit";
  initial: Game;
  players: Player[];
  onSubmit: (game: Game) => void;
  onClose: () => void;
  disabled?: boolean;
};

function GameDialog({
  mode,
  initial,
  players,
  onSubmit,
  onClose,
  disabled = false,
}: GameDialogProps) {
  const [game, setGame] = useState<Game>(initial);
  const [step, setStep] = useState<"info" | "innings" | "stats">("info");
  const [error, setError] = useState("");
  const title = mode === "add" ? "新增比赛" : "编辑比赛";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!game.date || !game.opponent) {
      setError("日期和对手不能为空");
      return;
    }
    setError("");
    onSubmit(game);
  }

  function updateInning(inning: number, field: Partial<InningRecord>) {
    setGame((prev) => ({
      ...prev,
      innings: prev.innings.map((inn) =>
        inn.inning === inning ? { ...inn, ...field } : inn,
      ),
    }));
  }

  function toggleBatter(inning: number, playerId: string) {
    setGame((prev) => ({
      ...prev,
      innings: prev.innings.map((inn) => {
        if (inn.inning !== inning) return inn;
        const has = inn.batters.includes(playerId);
        return {
          ...inn,
          batters: has
            ? inn.batters.filter((id) => id !== playerId)
            : [...inn.batters, playerId],
        };
      }),
    }));
  }

  function updateStatLine(playerId: string, field: Partial<PlayerGameStatLine>) {
    setGame((prev) => ({
      ...prev,
      statLines: prev.statLines.map((sl) =>
        sl.playerId === playerId ? { ...sl, ...field } : sl,
      ),
    }));
  }

  function updateStatNum(playerId: string, key: keyof PlayerGameStatLine, value: string) {
    const n = value === "" ? 0 : Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    updateStatLine(playerId, { [key]: n } as Partial<PlayerGameStatLine>);
  }

  function updateStatNullable(playerId: string, key: keyof PlayerGameStatLine, value: string) {
    if (value === "") {
      updateStatLine(playerId, { [key]: null } as Partial<PlayerGameStatLine>);
      return;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    updateStatLine(playerId, { [key]: n } as Partial<PlayerGameStatLine>);
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.dialog} role="dialog" aria-label={title}>
        <header className={styles.dialogHeader}>
          <h3>{title}</h3>
          <div style={{ display: "flex", gap: 4 }}>
            <button className={step === "info" ? styles.btnPrimary : styles.btnSecondary} type="button" onClick={() => setStep("info")} style={{ padding: "4px 12px", fontSize: 11 }}>比赛信息</button>
            <button className={step === "innings" ? styles.btnPrimary : styles.btnSecondary} type="button" onClick={() => setStep("innings")} style={{ padding: "4px 12px", fontSize: 11 }}>每局数据</button>
            <button className={step === "stats" ? styles.btnPrimary : styles.btnSecondary} type="button" onClick={() => setStep("stats")} style={{ padding: "4px 12px", fontSize: 11 }}>球员统计</button>
          </div>
          <button className={styles.dialogClose} onClick={onClose} type="button" aria-label="关闭">×</button>
        </header>
        <form onSubmit={handleSubmit} className={styles.dialogForm}>
          {step === "info" && (
            <>
              <div className={styles.dialogRow}>
                <label className={styles.dialogField}>
                  <span>日期</span>
                  <input type="date" value={game.date} onChange={(e) => setGame((g) => ({ ...g, date: e.target.value }))} />
                </label>
                <label className={styles.dialogField}>
                  <span>对手</span>
                  <input value={game.opponent} onChange={(e) => setGame((g) => ({ ...g, opponent: e.target.value }))} maxLength={40} placeholder="队伍名" />
                </label>
                <label className={styles.dialogField}>
                  <span>类型</span>
                  <select value={game.gameType} onChange={(e) => setGame((g) => ({ ...g, gameType: e.target.value as "official" | "training" }))}>
                    <option value="official">正式比赛</option>
                    <option value="training">训练比赛</option>
                  </select>
                </label>
              </div>
              <label className={styles.dialogField}>
                <span>总局数</span>
                <input type="number" min="1" max="20" value={game.totalInnings} onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n > 0 && n <= 20) {
                    setGame((g) => ({
                      ...g,
                      totalInnings: n,
                      innings: Array.from({ length: n }, (_, i) => g.innings[i] ?? emptyInning(i + 1)),
                    }));
                  }
                }} />
              </label>
              <p style={{ fontSize: 11, color: "var(--theme-muted)" }}>
                备注 (可选)
              </p>
              <input
                value={game.note ?? ""}
                onChange={(e) => setGame((g) => ({ ...g, note: e.target.value }))}
                maxLength={200}
                placeholder="比赛备注…"
                style={{ padding: "8px 10px", border: "1px solid var(--theme-border)", borderRadius: 6, background: "var(--theme-surface-alt)", color: "var(--theme-fg)", font: "inherit", fontSize: 13 }}
              />
            </>
          )}

          {step === "innings" && (
            <div style={{ display: "grid", gap: 12, maxHeight: "50vh", overflowY: "auto" }}>
              {game.innings.map((inn) => (
                <div key={inn.inning} style={{ display: "grid", gap: 6, padding: "10px 12px", background: "var(--theme-surface-alt)", borderRadius: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--theme-muted)" }}>{inn.inning} 回</span>
                  <div className={styles.dialogRow}>
                    <label className={styles.dialogField}>
                      <span>安打</span>
                      <input type="number" min="0" value={inn.hits} onChange={(e) => updateInning(inn.inning, { hits: Number(e.target.value) || 0 })} />
                    </label>
                    <label className={styles.dialogField}>
                      <span>得分</span>
                      <input type="number" min="0" value={inn.runs} onChange={(e) => updateInning(inn.inning, { runs: Number(e.target.value) || 0 })} />
                    </label>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {players.map((p) => {
                      const selected = inn.batters.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleBatter(inn.inning, p.id)}
                          style={{
                            padding: "3px 10px",
                            borderRadius: 4,
                            border: `1px solid ${selected ? "var(--theme-accent)" : "var(--theme-border)"}`,
                            background: selected ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)" : "var(--theme-surface)",
                            color: selected ? "var(--theme-accent)" : "var(--theme-muted)",
                            fontSize: 11,
                            fontWeight: selected ? 700 : 500,
                            cursor: "pointer",
                          }}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "stats" && (
            <div style={{ display: "grid", gap: 12, maxHeight: "50vh", overflowY: "auto" }}>
              {players.filter((p) => game.statLines.some((sl) => sl.playerId === p.id) || game.innings.some((inn) => inn.batters.includes(p.id))).map((p) => {
                const sl = game.statLines.find((s) => s.playerId === p.id) ?? emptyPlayerGameStatLine(p.id);
                return (
                  <div key={p.id} style={{ display: "grid", gap: 8, padding: "10px 12px", background: "var(--theme-surface-alt)", borderRadius: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--theme-fg)" }}>{p.name} #{p.number}</span>
                    <div className={styles.dialogSectionHeader}>打击</div>
                    <div className={styles.dialogRowSmall}>
                      {(["pa", "ab", "h", "hr", "rbi", "r", "sb", "bb", "so"] as const).map((k) => (
                        <label key={k} className={styles.dialogField}>
                          <span>{k.toUpperCase()}</span>
                          <input type="number" min="0" value={sl[k]} onChange={(e) => updateStatNum(p.id, k, e.target.value)} />
                        </label>
                      ))}
                    </div>
                    <div className={styles.dialogSectionHeader}>守备</div>
                    <div className={styles.dialogRow}>
                      {(["po", "a", "e"] as const).map((k) => (
                        <label key={k} className={styles.dialogField}>
                          <span>{k.toUpperCase()}</span>
                          <input type="number" min="0" value={sl[k]} onChange={(e) => updateStatNum(p.id, k, e.target.value)} />
                        </label>
                      ))}
                    </div>
                    <div className={styles.dialogSectionHeader}>投球 (可选)</div>
                    <div className={styles.dialogRowSmall}>
                      {(["ip", "er", "soPitching", "bbPitching", "hPitching"] as const).map((k) => (
                        <label key={k} className={styles.dialogField}>
                          <span>{k === "ip" ? "IP" : k === "er" ? "ER" : k === "soPitching" ? "SO" : k === "bbPitching" ? "BB" : "H"}</span>
                          <input
                            type="number"
                            min="0"
                            step={k === "ip" ? "0.1" : "1"}
                            value={sl[k] ?? ""}
                            onChange={(e) => updateStatNullable(p.id, k, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && <div className={styles.dialogError}>{error}</div>}

          <div className={styles.dialogActions}>
            <button className={styles.btnSecondary} onClick={onClose} type="button">取消</button>
            <button className={styles.btnPrimary} type="submit" disabled={disabled}>{mode === "add" ? "添加" : "保存"}</button>
          </div>
        </form>
      </div>
    </>
  );
}
