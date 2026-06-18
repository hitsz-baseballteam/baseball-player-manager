"use client";

import { useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import styles from "@/components/games-page-client.module.css";
import {
  cloneWorkspace,
  createId,
  type Game,
  type Player,
  type PlayerGameStatLine,
  type Workspace,
} from "@/lib/workspace";
import {
  createGame as createGameRequest,
  deleteGame as deleteGameRequest,
  isVersionConflict,
  type WorkspaceSnapshot,
  updateGame as updateGameRequest,
} from "@/lib/workspace-client";
import { useWorkspaceSnapshot } from "@/lib/use-workspace-snapshot";
import { panelNavItems } from "@/lib/routes";

const NAV_ITEMS = panelNavItems("");

type TabType = "official" | "training";

type GamesPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
  playerId: string;
};

type GameDialogState =
  | { type: "closed" }
  | { type: "add" }
  | { type: "edit"; gameId: string };

// ── Helpers ──

function inningsToOuts(ip: number | null): number {
  if (ip === null || !Number.isFinite(ip) || ip < 0) return 0;

  const whole = Math.trunc(ip);
  const tenth = Math.round((ip - whole) * 10);

  if (tenth >= 0 && tenth <= 2) {
    return whole * 3 + tenth;
  }

  return Math.round(ip * 3);
}

function formatOutsAsInnings(outs: number): string {
  const whole = Math.floor(outs / 3);
  const remainder = outs % 3;
  return remainder === 0 ? String(whole) : `${whole}.${remainder}`;
}

function hasValidInningNotation(ip: number | null): boolean {
  if (ip === null) return true;
  const whole = Math.trunc(ip);
  const tenth = Math.round((ip - whole) * 10);
  return whole >= 0 && tenth >= 0 && tenth <= 2 && Math.abs(ip - (whole + tenth / 10)) < 1e-9;
}

function emptyStatLine(playerId: string): PlayerGameStatLine {
  return {
    playerId,
    pa: 0,
    ab: 0,
    h: 0,
    doubles: 0,
    triples: 0,
    hr: 0,
    rbi: 0,
    r: 0,
    sb: 0,
    bb: 0,
    hbp: 0,
    sf: 0,
    so: 0,
    ip: null,
    er: null,
    soPitching: null,
    bbPitching: null,
    hPitching: null,
    po: 0,
    a: 0,
    e: 0,
    w: 0,
    l: 0,
    sv: 0,
    np: 0,
  };
}

function emptyGame(gameType: TabType, playerId: string): Game {
  return {
    id: createId(),
    date: "",
    opponent: "",
    gameType,
    totalInnings: 0,
    innings: [],
    statLines: [emptyStatLine(playerId)],
  };
}

// ── Main component ──

export function GamesPageClient({
  initialWorkspace,
  initialVersion,
  playerId,
}: GamesPageClientProps) {
  const { workspace, version, applySnapshot, refreshWorkspace } =
    useWorkspaceSnapshot(initialWorkspace, initialVersion);
  const [statusMessage, setStatusMessage] = useState("比赛数据已连接共享工作区");
  const [tab, setTab] = useState<TabType>("official");
  const [dialog, setDialog] = useState<GameDialogState>({ type: "closed" });
  const [saving, setSaving] = useState(false);
  const toastRef = useRef<ToastHandle | null>(null);

  const player = workspace.players.find((p) => p.id === playerId) ?? null;

  const playerGames = useMemo(() => {
    return (workspace.games ?? []).filter((g) => {
      if (g.gameType !== tab) return false;
      if (g.statLines.some((sl) => sl.playerId === playerId)) return true;
      if (g.innings.some((inn) => inn.batters.includes(playerId))) return true;
      return false;
    });
  }, [workspace.games, playerId, tab]);

  const sortedGames = useMemo(
    () => [...playerGames].sort((a, b) => b.date.localeCompare(a.date)),
    [playerGames],
  );

  async function commitGames(
    updater: (games: Game[]) => Game[],
    submit: (version: number) => Promise<WorkspaceSnapshot>,
    successMessage: string,
  ): Promise<boolean> {
    const draft = cloneWorkspace(workspace);
    draft.games = updater(draft.games);

    setSaving(true);
    setStatusMessage("正在同步到云端...");
    try {
      const result = await submit(version);
      applySnapshot(result);
      setStatusMessage(successMessage);
      toastRef.current?.showToast(successMessage);
      return true;
    } catch (error) {
      if (isVersionConflict(error)) {
        await refreshWorkspace();
        setStatusMessage("工作区已被其他会话更新，已刷新最新数据");
        toastRef.current?.showToast("工作区已被其他会话更新，已刷新最新数据");
      } else {
        console.error(error);
        setStatusMessage("保存失败，请稍后重试");
        toastRef.current?.showToast("保存失败，请稍后重试");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(game: Game) {
    const ok = await commitGames(
      (games) => [...games, game],
      (currentVersion) => createGameRequest(game, currentVersion),
      "比赛数据已更新",
    );
    if (ok) setDialog({ type: "closed" });
  }

  async function handleEdit(updated: Game) {
    const ok = await commitGames(
      (games) => games.map((g) => (g.id === updated.id ? updated : g)),
      (currentVersion) => updateGameRequest(updated, currentVersion),
      "比赛数据已更新",
    );
    if (ok) setDialog({ type: "closed" });
  }

  async function handleDelete(gameId: string) {
    if (!window.confirm("确认删除此场比赛记录？")) return;
    await commitGames(
      (games) => games.filter((g) => g.id !== gameId),
      (currentVersion) => deleteGameRequest(gameId, currentVersion),
      "比赛数据已更新",
    );
  }

  const summary = useMemo(() => {
    const statLines = playerGames
      .map((g) => g.statLines.find((sl) => sl.playerId === playerId))
      .filter(Boolean) as PlayerGameStatLine[];

    const pitchingLines = statLines.filter((sl) => sl.ip !== null && sl.ip > 0);
    const totalOuts = pitchingLines.reduce((sum, sl) => sum + inningsToOuts(sl.ip), 0);
    const totalIp = totalOuts / 3;
    const totalEr = pitchingLines.reduce((sum, sl) => sum + (sl.er ?? 0), 0);
    const era = totalOuts > 0 ? ((totalEr * 27) / totalOuts).toFixed(2) : null;
    const totalHitsPitching = pitchingLines.reduce((sum, sl) => sum + (sl.hPitching ?? 0), 0);
    const totalBbPitching = pitchingLines.reduce((sum, sl) => sum + (sl.bbPitching ?? 0), 0);
    const whip = totalOuts > 0
      ? (((totalHitsPitching + totalBbPitching) * 3) / totalOuts).toFixed(2)
      : null;

    return {
      count: statLines.length,
      pa: statLines.reduce((sum, sl) => sum + sl.pa, 0),
      ab: statLines.reduce((sum, sl) => sum + sl.ab, 0),
      h: statLines.reduce((sum, sl) => sum + sl.h, 0),
      hr: statLines.reduce((sum, sl) => sum + sl.hr, 0),
      rbi: statLines.reduce((sum, sl) => sum + sl.rbi, 0),
      r: statLines.reduce((sum, sl) => sum + sl.r, 0),
      sb: statLines.reduce((sum, sl) => sum + sl.sb, 0),
      bb: statLines.reduce((sum, sl) => sum + sl.bb, 0),
      so: statLines.reduce((sum, sl) => sum + sl.so, 0),
      avg: statLines.reduce((sum, sl) => sum + sl.ab, 0) > 0
        ? (statLines.reduce((sum, sl) => sum + sl.h, 0) / statLines.reduce((sum, sl) => sum + sl.ab, 0))
            .toFixed(3)
            .replace(/^0/, "")
        : null,
      era,
      whip,
      ipGames: pitchingLines.length,
      totalIp,
      totalIpDisplay: formatOutsAsInnings(totalOuts),
      soPitching: pitchingLines.reduce((sum, sl) => sum + (sl.soPitching ?? 0), 0),
    };
  }, [playerGames, playerId]);

  const playerLabel = player
    ? `${player.name} · #${player.number} · ${player.positions.join(" / ") || "待定守位"}`
    : "未找到球员";

  if (!player) {
    return (
      <ToastProvider toastRef={toastRef}>
        <AppShell
          eyebrow="比赛数据"
          title="未找到球员"
          description="当前链接没有对应球员，或该球员已从共享工作区移除。"
          navItems={[...NAV_ITEMS]}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider toastRef={toastRef}>
      <AppShell
        eyebrow="比赛数据"
        title={playerLabel}
        description={tab === "official" ? "正式比赛记录，逐场录入后自动合计。" : "训练 / 队内赛记录，与正式数据分开展示。"}
        statusLabel="工作区"
        statusValue={`v${version}`}
        statusMeta={saving ? "保存中…" : statusMessage}
        navItems={[...NAV_ITEMS]}
      >
        <div className={styles.layout}>
          {/* Action bar */}
          <div className={styles.actionBar}>
            <div className={styles.tabGroup}>
              <button
                className={`${styles.tabBtn} ${tab === "official" ? styles.tabBtnActive : ""}`}
                onClick={() => setTab("official")}
                type="button"
              >
                正式比赛
              </button>
              <button
                className={`${styles.tabBtn} ${tab === "training" ? styles.tabBtnActive : ""}`}
                onClick={() => setTab("training")}
                type="button"
              >
                训练比赛
              </button>
            </div>

            <div className={styles.actionSpacer} />

            <button
              className={styles.btnPrimary}
              onClick={() => setDialog({ type: "add" })}
              disabled={saving}
              type="button"
            >
              + 新增比赛
            </button>
          </div>

          {/* Summary cards */}
          <section className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <div className={styles.summaryLabel}>比赛场次</div>
              <div className={styles.summaryValue}>{summary.count}</div>
              <div className={styles.summaryDetail}>{summary.pa} 打席</div>
            </article>

            <article className={styles.summaryCard}>
              <div className={styles.summaryLabel}>安打 / 本垒打</div>
              <div className={styles.summaryValue}>{summary.h} / {summary.hr}</div>
              <div className={styles.summaryDetail}>
                打率 {summary.avg ?? "--"} · 打点 {summary.rbi} · 得分 {summary.r}
              </div>
            </article>

            <article className={styles.summaryCard}>
              <div className={styles.summaryLabel}>四坏 / 三振 / 盗垒</div>
              <div className={styles.summaryValue}>{summary.bb} / {summary.so} / {summary.sb}</div>
              <div className={styles.summaryDetail}>
                {summary.ab > 0 ? `打数 ${summary.ab}` : "暂无打数记录"}
              </div>
            </article>

            <article className={`${styles.summaryCard} ${summary.ipGames > 0 ? styles.summaryCardAccent : ""}`}>
              <div className={styles.summaryLabel}>投球</div>
              <div className={styles.summaryValue}>
                {summary.ipGames > 0 ? `ERA ${summary.era}` : "--"}
              </div>
              <div className={styles.summaryDetail}>
                {summary.ipGames > 0
                  ? `WHIP ${summary.whip} · ${summary.totalIpDisplay} 局 · ${summary.soPitching} K`
                  : "暂无投球记录"}
              </div>
            </article>
          </section>

          {/* Game list */}
          <section className={styles.listSection} aria-label="比赛记录列表">
            {sortedGames.length === 0 ? (
              <div className={styles.emptyState}>
                暂无{tab === "official" ? "正式" : "训练"}比赛记录，点击「+ 新增比赛」录入第一场。
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>对手</th>
                      <th>PA</th>
                      <th>AB</th>
                      <th>H</th>
                      <th>HR</th>
                      <th>RBI</th>
                      <th>R</th>
                      <th>SB</th>
                      <th>BB</th>
                      <th>SO</th>
                      <th>IP</th>
                      <th>ER</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGames.map((game) => {
                      const sl = game.statLines.find((s) => s.playerId === playerId);
                      return (
                        <tr key={game.id}>
                          <td>{game.date || "--"}</td>
                          <td>{game.opponent || "--"}</td>
                          <td>{sl?.pa ?? 0}</td>
                          <td>{sl?.ab ?? 0}</td>
                          <td>{sl?.h ?? 0}</td>
                          <td>{sl?.hr ?? 0}</td>
                          <td>{sl?.rbi ?? 0}</td>
                          <td>{sl?.r ?? 0}</td>
                          <td>{sl?.sb ?? 0}</td>
                          <td>{sl?.bb ?? 0}</td>
                          <td>{sl?.so ?? 0}</td>
                          <td>{sl?.ip ?? "--"}</td>
                          <td>{sl?.er ?? "--"}</td>
                          <td>
                            <div className={styles.rowActions}>
                              <button
                                className={styles.inlineBtn}
                                onClick={() => setDialog({ type: "edit", gameId: game.id })}
                                type="button"
                              >
                                编辑
                              </button>
                              <button
                                className={`${styles.inlineBtn} ${styles.inlineBtnDanger}`}
                                onClick={() => handleDelete(game.id)}
                                type="button"
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {dialog.type !== "closed" && (
          <GameDialog
            mode={dialog.type}
            game={
              dialog.type === "edit"
                ? workspace.games.find((g) => g.id === dialog.gameId) ?? null
                : null
            }
            player={player}
            tab={tab}
            playerId={playerId}
            onSubmit={dialog.type === "add" ? handleAdd : handleEdit}
            onClose={() => setDialog({ type: "closed" })}
          />
        )}
      </AppShell>
    </ToastProvider>
  );
}

// ── Game dialog ──

type GameDialogProps = {
  mode: "add" | "edit";
  game: Game | null;
  player: Player;
  tab: TabType;
  playerId: string;
  onSubmit: (game: Game) => void;
  onClose: () => void;
};

function GameDialog({ mode, game: initial, player, tab, playerId, onSubmit, onClose }: GameDialogProps) {
  const starter = mode === "add" || !initial
    ? emptyGame(tab, playerId)
    : initial;

  const [game, setGame] = useState<Game>(starter);
  const [error, setError] = useState("");
  const title = mode === "add" ? "新增比赛" : "编辑比赛";

  const statLine = game.statLines.find((sl) => sl.playerId === playerId) ?? emptyStatLine(playerId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!game.date || !game.opponent) {
      setError("日期和对手不能为空");
      return;
    }
    if (!hasValidInningNotation(statLine.ip)) {
      setError("投球局数只能以 .0 / .1 / .2 结尾");
      return;
    }
    setError("");
    onSubmit(game);
  }

  function updateGame(field: Partial<Game>) {
    setGame((prev) => ({ ...prev, ...field }));
    setError("");
  }

  function updateStatLine(field: Partial<PlayerGameStatLine>) {
    setGame((prev) => ({
      ...prev,
      statLines: prev.statLines.map((sl) =>
        sl.playerId === playerId ? { ...sl, ...field } : sl,
      ),
    }));
    setError("");
  }

  function updateStatNum(field: keyof PlayerGameStatLine, value: string) {
    const n = value === "" ? 0 : Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    updateStatLine({ [field]: n } as Partial<PlayerGameStatLine>);
  }

  function updateStatNullable(field: keyof PlayerGameStatLine, value: string) {
    if (value === "") {
      updateStatLine({ [field]: null } as Partial<PlayerGameStatLine>);
      return;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    updateStatLine({ [field]: n } as Partial<PlayerGameStatLine>);
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.dialog} role="dialog" aria-label={title}>
        <header className={styles.dialogHeader}>
          <h3>{title} — {player.name}</h3>
          <button className={styles.dialogClose} onClick={onClose} type="button" aria-label="关闭">×</button>
        </header>
        <form onSubmit={handleSubmit} className={styles.dialogForm}>
          <div className={styles.dialogRow}>
            <label className={styles.dialogField}>
              <span>日期</span>
              <input
                type="date"
                value={game.date}
                onChange={(e) => updateGame({ date: e.target.value })}
              />
            </label>
            <label className={styles.dialogField}>
              <span>对手</span>
              <input
                value={game.opponent}
                onChange={(e) => updateGame({ opponent: e.target.value })}
                maxLength={40}
                placeholder="队伍名"
              />
            </label>
            <label className={styles.dialogField}>
              <span>类型</span>
              <select
                value={game.gameType}
                onChange={(e) => updateGame({ gameType: e.target.value as Game["gameType"] })}
              >
                <option value="official">正式比赛</option>
                <option value="training">训练比赛</option>
              </select>
            </label>
          </div>

          <div className={styles.dialogSectionHeader}>攻击数据</div>
          <div className={styles.dialogRow}>
            {(["pa", "ab", "h", "hr", "rbi", "r", "sb", "bb", "so"] as const).map((key) => (
              <label key={key} className={styles.dialogFieldSmall}>
                <span>{key.toUpperCase()}</span>
                <input
                  type="number"
                  min="0"
                  value={statLine[key]}
                  onChange={(e) => updateStatNum(key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <div className={styles.dialogSectionHeader}>投球数据（可选）</div>
          <div className={styles.dialogRow}>
            {(["ip", "er", "soPitching", "bbPitching", "hPitching"] as const).map((key) => (
              <label key={key} className={styles.dialogFieldSmall}>
                <span>{key === "ip" ? "IP" : key === "er" ? "ER" : key === "soPitching" ? "SO" : key === "bbPitching" ? "BB" : "H"}</span>
                <input
                  type="number"
                  min="0"
                  step={key === "ip" ? "0.1" : "1"}
                  value={statLine[key] ?? ""}
                  onChange={(e) => updateStatNullable(key, e.target.value)}
                />
              </label>
            ))}
          </div>

          {error && <div className={styles.dialogError}>{error}</div>}

          <div className={styles.dialogActions}>
            <button className={styles.btnSecondary} onClick={onClose} type="button">取消</button>
            <button className={styles.btnPrimary} type="submit">{mode === "add" ? "添加" : "保存"}</button>
          </div>
        </form>
      </div>
    </>
  );
}
