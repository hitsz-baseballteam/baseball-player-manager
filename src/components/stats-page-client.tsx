"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import styles from "@/components/stats-page-client.module.css";
import { computeBattingLine, computePitchingLine, type BattingLine, type PitchingLine } from "@/lib/stats";
import {
  cloneWorkspace,
  createId,
  sanitizeWorkspace,
  type GameRecord,
  type Player,
  type Workspace,
} from "@/lib/workspace";
import {
  isVersionConflict,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
} from "@/lib/workspace-client";

const NAV_ITEMS = [
  { label: "总览", href: "/" },
  { label: "名册", href: "/roster" },
  { label: "战术场景", href: "/scenarios" },
  { label: "数据中心", href: "/stats", active: true },
  { label: "设置", href: "/settings" },
] as const;

type TabType = "batting" | "pitching";

type SortKey =
  | "G"
  | "PA" | "AB" | "H" | "AVG" | "HR" | "RBI" | "R" | "SB" | "BB" | "SO" | "OBP" | "SLG" | "OPS"
  | "IP" | "ER" | "ERA" | "WHIP" | "K9" | "BB9";

type SortDir = "asc" | "desc";

type GameDialogState =
  | { type: "closed" }
  | { type: "add"; playerId: string }
  | { type: "edit"; playerId: string; record: GameRecord };

type StatsPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

function emptyGameRecord(): GameRecord {
  return {
    id: createId(),
    date: "",
    opponent: "",
    gameType: "official",
    pa: 0,
    ab: 0,
    h: 0,
    hr: 0,
    rbi: 0,
    r: 0,
    sb: 0,
    bb: 0,
    so: 0,
    ip: null,
    er: null,
    soPitching: null,
    bbPitching: null,
    hPitching: null,
  };
}

function sortValue(line: BattingLine | PitchingLine, key: SortKey): number {
  if (key === "AVG" || key === "OBP" || key === "SLG" || key === "OPS") {
    return Number.parseFloat((line as BattingLine)[key]) || 0;
  }
  if (key === "ERA" || key === "WHIP" || key === "K9" || key === "BB9") {
    return Number.parseFloat((line as PitchingLine)[key]) || 0;
  }
  if (key === "IP") {
    return 0; // IP is string-formatted, can't compare numerically
  }
  return (line as unknown as Record<string, number>)[key] ?? 0;
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

  const [tab, setTab] = useState<TabType>("batting");
  const [sortKey, setSortKey] = useState<SortKey>("AVG");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<GameDialogState>({ type: "closed" });

  // ── Players filtered by type ──
  const fieldPlayers = useMemo(
    () => workspace.players.filter((p) => p.profile.profileType === "fielder"),
    [workspace.players],
  );
  const pitchers = useMemo(
    () => workspace.players.filter((p) => p.profile.profileType === "pitcher"),
    [workspace.players],
  );

  // ── Batting leaderboard ──
  const battingLines = useMemo(() => {
    return fieldPlayers
      .map((player) => ({
        player,
        line: computeBattingLine(player.profile.games),
      }))
      .filter(({ line }) => line.G > 0)
      .sort((a, b) => {
        const va = sortValue(a.line, sortKey);
        const vb = sortValue(b.line, sortKey);
        return sortDir === "desc" ? vb - va : va - vb;
      });
  }, [fieldPlayers, sortKey, sortDir]);

  // ── Pitching leaderboard ──
  const pitchingLines = useMemo(() => {
    return pitchers
      .map((player) => ({
        player,
        line: computePitchingLine(player.profile.games),
      }))
      .filter(({ line }) => line.G > 0)
      .sort((a, b) => {
        const va = sortValue(a.line, sortKey);
        const vb = sortValue(b.line, sortKey);
        return sortDir === "desc" ? vb - va : va - vb;
      });
  }, [pitchers, sortKey, sortDir]);

  // ── Save ──
  const handleSave = useCallback(
    async (updatedWorkspace: Workspace) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const result = await saveWorkspaceSnapshot(updatedWorkspace, version);
        if ("version" in result) {
          setVersion(result.version);
          setWorkspace(sanitizeWorkspace(updatedWorkspace));
        } else if (isVersionConflict(result)) {
          const snapshot = await loadWorkspaceSnapshot();
          setVersion(snapshot.version);
          toastRef.current?.showToast("工作区已被他人更新，已自动刷新。请重试。");
        }
      } catch {
        setSaveError("保存失败，请重试。");
      } finally {
        setIsSaving(false);
      }
    },
    [version],
  );

  // ── Player operations ──
  function updatePlayer(playerId: string, fn: (player: Player) => Player) {
    const next = cloneWorkspace(workspace);
    const idx = next.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return;
    next.players[idx] = fn(structuredClone(next.players[idx]));
    handleSave(next);
  }

  function addGame(playerId: string, record: GameRecord) {
    updatePlayer(playerId, (player) => ({
      ...player,
      profile: {
        ...player.profile,
        games: [...player.profile.games, record],
      },
    }));
  }

  function editGame(playerId: string, record: GameRecord) {
    updatePlayer(playerId, (player) => ({
      ...player,
      profile: {
        ...player.profile,
        games: player.profile.games.map((g) => (g.id === record.id ? record : g)),
      },
    }));
  }

  function deleteGame(playerId: string, gameId: string) {
    updatePlayer(playerId, (player) => ({
      ...player,
      profile: {
        ...player.profile,
        games: player.profile.games.filter((g) => g.id !== gameId),
      },
    }));
  }

  // ── Table header click ──
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const activeSort = (key: SortKey): SortDir | null =>
    sortKey === key ? sortDir : null;

  function sortIndicator(dir: SortDir | null) {
    if (!dir) return null;
    return <span className={styles.sortDir}>{dir === "desc" ? "▾" : "▴"}</span>;
  }

  // ── Expanded player ──
  const expandedPlayer = workspace.players.find((p) => p.id === expandedId) ?? null;
  const expandedGames = useMemo(
    () =>
      expandedPlayer
        ? [...expandedPlayer.profile.games].sort((a, b) =>
            b.date.localeCompare(a.date),
          )
        : [],
    [expandedPlayer],
  );

  // ── Rows ──
  const currentData = tab === "batting" ? battingLines : pitchingLines;

  return (
    <ToastProvider toastRef={toastRef}>
      <AppShell
        eyebrow="Data Center"
        title="数据中心"
        description="查看全队比赛统计与每位球员的详细数据。点击球员行展开其比赛记录。"
        statusLabel="工作区"
        statusValue={`v${version}`}
        statusMeta={isSaving ? "保存中…" : ""}
        navItems={[...NAV_ITEMS]}
        actions={<ThemeToggle />}
      >
        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={tab === "batting" ? styles.tabActive : styles.tab}
            onClick={() => { setTab("batting"); setExpandedId(null); setSortKey("AVG"); setSortDir("desc"); }}
          >
            野手数据
          </button>
          <button
            className={tab === "pitching" ? styles.tabActive : styles.tab}
            onClick={() => { setTab("pitching"); setExpandedId(null); setSortKey("ERA"); setSortDir("asc"); }}
          >
            投手数据
          </button>
        </div>

        {/* Save status */}
        <div className={styles.saveBar}>
          {saveError && <span className={styles.saveError}>{saveError}</span>}
          {isSaving && <span className={styles.saveStatus}>保存中…</span>}
        </div>

        {/* Table */}
        <div className={styles.tableWrap}>
          {currentData.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📊</div>
              <p className={styles.emptyText}>
                {tab === "batting" ? "暂无野手比赛数据" : "暂无投手比赛数据"}
              </p>
              <p className={styles.emptySub}>
                点击球员行展开，然后添加比赛记录
              </p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>球员</th>
                  {tab === "batting" ? (
                    <>
                      {(["G", "PA", "AB", "H", "AVG", "HR", "RBI", "OBP", "SLG", "OPS"] as const).map((k) => (
                        <th key={k} className={styles.sortable} onClick={() => handleSort(k)}>
                          {k}{sortIndicator(activeSort(k))}
                        </th>
                      ))}
                    </>
                  ) : (
                    <>
                      {(["G", "IP", "ER", "ERA", "WHIP", "H", "BB", "SO", "K9", "BB9"] as const).map((k) => (
                        <th key={k} className={styles.sortable} onClick={() => handleSort(k)}>
                          {k}{sortIndicator(activeSort(k))}
                        </th>
                      ))}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentData.map(({ player, line }) => {
                  const isExpanded = expandedId === player.id;
                  return (
                    <>
                      <tr
                        key={player.id}
                        className={isExpanded ? styles.expanded : undefined}
                        onClick={() =>
                          setExpandedId(isExpanded ? null : player.id)
                        }
                      >
                        <td>
                          <span className={styles.playerName}>{player.name}</span>
                          <span className={styles.playerMeta}>
                            #{player.number}
                            {player.positions.length > 0
                              ? ` · ${player.positions.join(" · ")}`
                              : ""}
                          </span>
                        </td>
                        {tab === "batting" ? (
                          <>
                            <td>{(line as BattingLine).G}</td>
                            <td>{(line as BattingLine).PA}</td>
                            <td>{(line as BattingLine).AB}</td>
                            <td>{(line as BattingLine).H}</td>
                            <td>{(line as BattingLine).AVG}</td>
                            <td>{(line as BattingLine).HR}</td>
                            <td>{(line as BattingLine).RBI}</td>
                            <td>{(line as BattingLine).OBP}</td>
                            <td>{(line as BattingLine).SLG}</td>
                            <td>{(line as BattingLine).OPS}</td>
                          </>
                        ) : (
                          <>
                            <td>{(line as PitchingLine).G}</td>
                            <td>{(line as PitchingLine).IP}</td>
                            <td>{(line as PitchingLine).ER}</td>
                            <td>{(line as PitchingLine).ERA}</td>
                            <td>{(line as PitchingLine).WHIP}</td>
                            <td>{(line as PitchingLine).H}</td>
                            <td>{(line as PitchingLine).BB}</td>
                            <td>{(line as PitchingLine).SO}</td>
                            <td>{(line as PitchingLine).K9}</td>
                            <td>{(line as PitchingLine).BB9}</td>
                          </>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr className={styles.expandedRow}>
                          <td colSpan={11} className={styles.expandedCell}>
                            <div className={styles.expandedPanel}>
                              <div className={styles.expandedHeader}>
                                <span className={styles.expandedTitle}>
                                  {player.name} · 比赛记录
                                </span>
                                <button
                                  className={styles.btnSmall}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDialog({ type: "add", playerId: player.id });
                                  }}
                                >
                                  ＋ 添加比赛
                                </button>
                              </div>

                              {tab === "batting" && (
                                <div className={styles.expandedStatPills}>
                                  <span className={styles.statPill}>
                                    <span className={styles.statPillLabel}>G</span>
                                    <span className={styles.statPillValue}>{(line as BattingLine).G}</span>
                                  </span>
                                  <span className={styles.statPill}>
                                    <span className={styles.statPillLabel}>AVG</span>
                                    <span className={styles.statPillValueAccent}>{(line as BattingLine).AVG}</span>
                                  </span>
                                  <span className={styles.statPill}>
                                    <span className={styles.statPillLabel}>HR</span>
                                    <span className={styles.statPillValue}>{(line as BattingLine).HR}</span>
                                  </span>
                                  <span className={styles.statPill}>
                                    <span className={styles.statPillLabel}>RBI</span>
                                    <span className={styles.statPillValue}>{(line as BattingLine).RBI}</span>
                                  </span>
                                  <span className={styles.statPill}>
                                    <span className={styles.statPillLabel}>OPS</span>
                                    <span className={styles.statPillValueAccent}>{(line as BattingLine).OPS}</span>
                                  </span>
                                </div>
                              )}
                              {tab === "pitching" && (
                                <div className={styles.expandedStatPills}>
                                  <span className={styles.statPill}>
                                    <span className={styles.statPillLabel}>G</span>
                                    <span className={styles.statPillValue}>{(line as PitchingLine).G}</span>
                                  </span>
                                  <span className={styles.statPill}>
                                    <span className={styles.statPillLabel}>ERA</span>
                                    <span className={styles.statPillValueAccent}>{(line as PitchingLine).ERA}</span>
                                  </span>
                                  <span className={styles.statPill}>
                                    <span className={styles.statPillLabel}>WHIP</span>
                                    <span className={styles.statPillValueAccent}>{(line as PitchingLine).WHIP}</span>
                                  </span>
                                  <span className={styles.statPill}>
                                    <span className={styles.statPillLabel}>SO</span>
                                    <span className={styles.statPillValue}>{(line as PitchingLine).SO}</span>
                                  </span>
                                  <span className={styles.statPill}>
                                    <span className={styles.statPillLabel}>K/9</span>
                                    <span className={styles.statPillValue}>{(line as PitchingLine).K9}</span>
                                  </span>
                                </div>
                              )}

                              {expandedGames.length === 0 ? (
                                <div className={styles.emptyState}>
                                  <p className={styles.emptyText}>暂无比赛记录</p>
                                  <p className={styles.emptySub}>点击上方「添加比赛」录入第一条记录</p>
                                </div>
                              ) : (
                                <table className={styles.gameLog}>
                                  <thead>
                                    <tr>
                                      <th>日期</th>
                                      <th>对手</th>
                                      <th>类型</th>
                                      {tab === "batting" ? (
                                        <>
                                          <th>PA</th>
                                          <th>AB</th>
                                          <th>H</th>
                                          <th>HR</th>
                                          <th>RBI</th>
                                          <th>BB</th>
                                          <th>SO</th>
                                        </>
                                      ) : (
                                        <>
                                          <th>IP</th>
                                          <th>ER</th>
                                          <th>H</th>
                                          <th>BB</th>
                                          <th>SO</th>
                                        </>
                                      )}
                                      <th>操作</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedGames.map((game) => (
                                      <tr key={game.id}>
                                        <td>{game.date}</td>
                                        <td>{game.opponent}</td>
                                        <td>
                                          <span
                                            className={
                                              game.gameType === "official"
                                                ? styles.gameTypeOfficial
                                                : styles.gameTypeTraining
                                            }
                                          >
                                            {game.gameType === "official" ? "正式" : "训练"}
                                          </span>
                                        </td>
                                        {tab === "batting" ? (
                                          <>
                                            <td>{game.pa}</td>
                                            <td>{game.ab}</td>
                                            <td>{game.h}</td>
                                            <td>{game.hr}</td>
                                            <td>{game.rbi}</td>
                                            <td>{game.bb}</td>
                                            <td>{game.so}</td>
                                          </>
                                        ) : (
                                          <>
                                            <td>{game.ip ?? "-"}</td>
                                            <td>{game.er ?? "-"}</td>
                                            <td>{game.hPitching ?? "-"}</td>
                                            <td>{game.bbPitching ?? "-"}</td>
                                            <td>{game.soPitching ?? "-"}</td>
                                          </>
                                        )}
                                        <td>
                                          <div className={styles.gameLogActions}>
                                            <button
                                              className={styles.btnSmall}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDialog({
                                                  type: "edit",
                                                  playerId: player.id,
                                                  record: game,
                                                });
                                              }}
                                            >
                                              编辑
                                            </button>
                                            <button
                                              className={styles.btnSmallDanger}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteGame(player.id, game.id);
                                              }}
                                            >
                                              删除
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </AppShell>

      {/* Game Dialog */}
      {dialog.type !== "closed" && (
        <GameDialog
          mode={dialog.type === "add" ? "add" : "edit"}
          initial={dialog.type === "edit" ? dialog.record : emptyGameRecord()}
          playerName={
            workspace.players.find((p) => p.id === dialog.playerId)?.name ?? ""
          }
          onSubmit={(record) => {
            if (dialog.type === "add") {
              addGame(dialog.playerId, record);
            } else {
              editGame(dialog.playerId, record);
            }
            setDialog({ type: "closed" });
          }}
          onClose={() => setDialog({ type: "closed" })}
        />
      )}
    </ToastProvider>
  );
}

// ── Game Dialog ──

type GameDialogProps = {
  mode: "add" | "edit";
  initial: GameRecord;
  playerName: string;
  onSubmit: (record: GameRecord) => void;
  onClose: () => void;
};

function hasValidInningNotation(ip: number | null): boolean {
  if (ip === null) return true;
  if (!Number.isFinite(ip) || ip < 0) return false;
  const frac = ip - Math.trunc(ip);
  return frac === 0 || frac === 0.1 || frac === 0.2;
}

function GameDialog({
  mode,
  initial,
  playerName,
  onSubmit,
  onClose,
}: GameDialogProps) {
  const [record, setRecord] = useState<GameRecord>(initial);
  const [error, setError] = useState("");
  const title = mode === "add" ? "新增比赛" : "编辑比赛";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!record.date || !record.opponent) {
      setError("日期和对手不能为空");
      return;
    }
    if (!hasValidInningNotation(record.ip)) {
      setError("投球局数只能以 .0 / .1 / .2 结尾");
      return;
    }
    setError("");
    onSubmit(record);
  }

  function update(field: Partial<GameRecord>) {
    setRecord((prev) => ({ ...prev, ...field }));
    setError("");
  }

  function updateNum(field: keyof GameRecord, value: string) {
    const n = value === "" ? 0 : Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    update({ [field]: n } as Partial<GameRecord>);
  }

  function updateNullable(field: keyof GameRecord, value: string) {
    if (value === "") {
      update({ [field]: null } as Partial<GameRecord>);
      return;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    update({ [field]: n } as Partial<GameRecord>);
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.dialog} role="dialog" aria-label={title}>
        <header className={styles.dialogHeader}>
          <h3>{title} — {playerName}</h3>
          <button className={styles.dialogClose} onClick={onClose} type="button" aria-label="关闭">×</button>
        </header>
        <form onSubmit={handleSubmit} className={styles.dialogForm}>
          <div className={styles.dialogRow}>
            <label className={styles.dialogField}>
              <span>日期</span>
              <input
                type="date"
                value={record.date}
                onChange={(e) => update({ date: e.target.value })}
              />
            </label>
            <label className={styles.dialogField}>
              <span>对手</span>
              <input
                value={record.opponent}
                onChange={(e) => update({ opponent: e.target.value })}
                maxLength={40}
                placeholder="队伍名"
              />
            </label>
            <label className={styles.dialogField}>
              <span>类型</span>
              <select
                value={record.gameType}
                onChange={(e) =>
                  update({ gameType: e.target.value as GameRecord["gameType"] })
                }
              >
                <option value="official">正式比赛</option>
                <option value="training">训练比赛</option>
              </select>
            </label>
          </div>

          <div className={styles.dialogSectionHeader}>攻击数据</div>
          <div className={styles.dialogRowSmall}>
            {(["pa", "ab", "h", "hr", "rbi", "r", "sb", "bb", "so"] as const).map((key) => (
              <label key={key} className={styles.dialogField}>
                <span>{key.toUpperCase()}</span>
                <input
                  type="number"
                  min="0"
                  value={record[key]}
                  onChange={(e) => updateNum(key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <div className={styles.dialogSectionHeader}>投球数据（可选）</div>
          <div className={styles.dialogRowSmall}>
            {(["ip", "er", "soPitching", "bbPitching", "hPitching"] as const).map((key) => (
              <label key={key} className={styles.dialogField}>
                <span>
                  {key === "ip"
                    ? "IP"
                    : key === "er"
                      ? "ER"
                      : key === "soPitching"
                        ? "SO"
                        : key === "bbPitching"
                          ? "BB"
                          : "H"}
                </span>
                <input
                  type="number"
                  min="0"
                  step={key === "ip" ? "0.1" : "1"}
                  value={record[key] ?? ""}
                  onChange={(e) => updateNullable(key, e.target.value)}
                />
              </label>
            ))}
          </div>

          {error && <div className={styles.dialogError}>{error}</div>}

          <div className={styles.dialogActions}>
            <button className={styles.btnSecondary} onClick={onClose} type="button">
              取消
            </button>
            <button className={styles.btnPrimary} type="submit">
              {mode === "add" ? "添加" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
