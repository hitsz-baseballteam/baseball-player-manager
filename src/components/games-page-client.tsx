"use client";

import { useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import styles from "@/components/games-page-client.module.css";
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
  { label: "数据中心", href: "/stats" },
  { label: "设置", href: "/settings" },
] as const;

type TabType = "official" | "training";

type GamesPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
  playerId: string;
};

type GameDialogState =
  | { type: "closed" }
  | { type: "add" }
  | { type: "edit"; record: GameRecord };

function emptyGameRecord(gameType: TabType): GameRecord {
  return {
    id: createId(),
    date: "",
    opponent: "",
    gameType,
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

export function GamesPageClient({
  initialWorkspace,
  initialVersion,
  playerId,
}: GamesPageClientProps) {
  const [workspace, setWorkspace] = useState(() => sanitizeWorkspace(initialWorkspace));
  const [version, setVersion] = useState(initialVersion);
  const [statusMessage, setStatusMessage] = useState("比赛数据已连接共享工作区");
  const [tab, setTab] = useState<TabType>("official");
  const [dialog, setDialog] = useState<GameDialogState>({ type: "closed" });
  const [saving, setSaving] = useState(false);
  const toastRef = useRef<ToastHandle | null>(null);

  const player = workspace.players.find((p) => p.id === playerId) ?? null;
  const games = useMemo(() => (player?.profile.games ?? []).filter((g) => g.gameType === tab), [player, tab]);
  const sortedGames = useMemo(() => [...games].sort((a, b) => b.date.localeCompare(a.date)), [games]);

  async function commitPlayerGames(
    updater: (games: GameRecord[]) => GameRecord[],
    successMessage: string,
  ): Promise<boolean> {
    const draft = cloneWorkspace(workspace);
    const target = draft.players.find((p) => p.id === playerId);
    if (!target) {
      setDialog({ type: "closed" });
      toastRef.current?.showToast("找不到当前球员，请刷新后重试");
      return false;
    }
    target.profile.games = updater(target.profile.games);

    setSaving(true);
    setStatusMessage("正在同步到云端...");
    try {
      const result = await saveWorkspaceSnapshot(draft, version);
      setWorkspace(sanitizeWorkspace(result.workspace));
      setVersion(result.version);
      setStatusMessage(successMessage);
      toastRef.current?.showToast(successMessage);
      return true;
    } catch (error) {
      if (isVersionConflict(error)) {
        const latest = await loadWorkspaceSnapshot();
        setWorkspace(sanitizeWorkspace(latest.workspace));
        setVersion(latest.version);
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

  async function handleAdd(record: GameRecord) {
    const ok = await commitPlayerGames((games) => [...games, record], "比赛数据已更新");
    if (ok) setDialog({ type: "closed" });
  }

  async function handleEdit(updated: GameRecord) {
    const ok = await commitPlayerGames((games) => games.map((g) => (g.id === updated.id ? updated : g)), "比赛数据已更新");
    if (ok) setDialog({ type: "closed" });
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确认删除此场比赛记录？")) return;
    await commitPlayerGames((games) => games.filter((g) => g.id !== id), "比赛数据已更新");
  }

  const summary = useMemo(() => {
    const officialGames = (player?.profile.games ?? []).filter((g) => g.gameType === "official");
    const trainingGames = (player?.profile.games ?? []).filter((g) => g.gameType === "training");
    const records = tab === "official" ? officialGames : trainingGames;

    const pitchingGames = records.filter((g) => g.ip !== null && g.ip > 0);
    const totalOuts = pitchingGames.reduce((sum, g) => sum + inningsToOuts(g.ip), 0);
    const totalIp = totalOuts / 3;
    const totalEr = pitchingGames.reduce((sum, g) => sum + (g.er ?? 0), 0);
    const era = totalOuts > 0 ? ((totalEr * 27) / totalOuts).toFixed(2) : null;
    const totalHitsPitching = pitchingGames.reduce((sum, g) => sum + (g.hPitching ?? 0), 0);
    const totalBbPitching = pitchingGames.reduce((sum, g) => sum + (g.bbPitching ?? 0), 0);
    const whip = totalOuts > 0 ? (((totalHitsPitching + totalBbPitching) * 3) / totalOuts).toFixed(2) : null;

    return {
      count: records.length,
      pa: records.reduce((sum, g) => sum + g.pa, 0),
      ab: records.reduce((sum, g) => sum + g.ab, 0),
      h: records.reduce((sum, g) => sum + g.h, 0),
      hr: records.reduce((sum, g) => sum + g.hr, 0),
      rbi: records.reduce((sum, g) => sum + g.rbi, 0),
      r: records.reduce((sum, g) => sum + g.r, 0),
      sb: records.reduce((sum, g) => sum + g.sb, 0),
      bb: records.reduce((sum, g) => sum + g.bb, 0),
      so: records.reduce((sum, g) => sum + g.so, 0),
      avg: records.reduce((sum, g) => sum + g.ab, 0) > 0
        ? (records.reduce((sum, g) => sum + g.h, 0) / records.reduce((sum, g) => sum + g.ab, 0)).toFixed(3).replace(/^0/, "")
        : null,
      era,
      whip,
      ipGames: pitchingGames.length,
      totalIp,
      totalIpDisplay: formatOutsAsInnings(totalOuts),
      soPitching: pitchingGames.reduce((sum, g) => sum + (g.soPitching ?? 0), 0),
    };
  }, [player, tab]);

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
          actions={<ThemeToggle />}
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
        actions={<ThemeToggle />}
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
                    {sortedGames.map((record) => (
                      <tr key={record.id}>
                        <td>{record.date || "--"}</td>
                        <td>{record.opponent || "--"}</td>
                        <td>{record.pa}</td>
                        <td>{record.ab}</td>
                        <td>{record.h}</td>
                        <td>{record.hr}</td>
                        <td>{record.rbi}</td>
                        <td>{record.r}</td>
                        <td>{record.sb}</td>
                        <td>{record.bb}</td>
                        <td>{record.so}</td>
                        <td>{record.ip ?? "--"}</td>
                        <td>{record.er ?? "--"}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <button
                              className={styles.inlineBtn}
                              onClick={() => setDialog({ type: "edit", record })}
                              type="button"
                            >
                              编辑
                            </button>
                            <button
                              className={`${styles.inlineBtn} ${styles.inlineBtnDanger}`}
                              onClick={() => handleDelete(record.id)}
                              type="button"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {dialog.type !== "closed" && (
          <GameDialog
            mode={dialog.type}
            record={dialog.type === "edit" ? dialog.record : emptyGameRecord(tab)}
            player={player}
            onSubmit={dialog.type === "add" ? handleAdd : handleEdit}
            onClose={() => setDialog({ type: "closed" })}
          />
        )}
      </AppShell>
    </ToastProvider>
  );
}

type GameDialogProps = {
  mode: "add" | "edit";
  record: GameRecord;
  player: Player;
  onSubmit: (record: GameRecord) => void;
  onClose: () => void;
};

function GameDialog({ mode, record: initial, player, onSubmit, onClose }: GameDialogProps) {
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
          <h3>{title} — {player.name}</h3>
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
                onChange={(e) => update({ gameType: e.target.value as GameRecord["gameType"] })}
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
                  value={record[key]}
                  onChange={(e) => updateNum(key, e.target.value)}
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
                  value={record[key] ?? ""}
                  onChange={(e) => updateNullable(key, e.target.value)}
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
