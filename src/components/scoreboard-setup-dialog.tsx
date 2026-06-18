"use client";

import { useMemo, useState } from "react";

import { initializeFromScenario, type GameSetup, type TeamSetup } from "@/lib/scoreboard-actions";
import { getActiveScenario } from "@/lib/workspace";
import type { Player, Scenario, Workspace } from "@/lib/workspace";
import styles from "./scoreboard-setup-dialog.module.css";

type ScoreboardSetupDialogProps = {
  workspace: Workspace;
  mode: "standard" | "dual";
  batFirst?: boolean;  // only for standard mode: true=先攻, false=先防
  onStart: (
    setup: GameSetup,
    teamA: TeamSetup,
    teamB?: TeamSetup,
  ) => void;
  onCancel: () => void;
};

export function ScoreboardSetupDialog({
  workspace,
  mode,
  batFirst,
  onStart,
  onCancel,
}: ScoreboardSetupDialogProps) {
  const activeScenario = getActiveScenario(workspace);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [opponent, setOpponent] = useState(mode === "dual" ? "队内红白战" : "");
  const [gameType, setGameType] = useState<"official" | "training">(
    mode === "dual" ? "training" : "official",
  );
  const [totalInnings, setTotalInnings] = useState(9);
  const [useTimeLimit, setUseTimeLimit] = useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(120);
  const [scenarioId, setScenarioId] = useState(activeScenario?.id ?? workspace.scenarios[0]?.id ?? "");
  const [error, setError] = useState("");

  // Derive team setups from scenario
  const teamA = useMemo(() => {
    const scenario = workspace.scenarios.find((s) => s.id === scenarioId) ?? workspace.scenarios[0];
    if (!scenario) return null;
    return initializeFromScenario(workspace, scenario);
  }, [workspace, scenarioId]);

  // For dual mode, create Team B from remaining players
  const teamB = useMemo(() => {
    if (mode !== "dual" || !teamA) return null;
    return buildTeamB(workspace, teamA);
  }, [workspace, teamA, mode]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) { setError("请选择日期"); return; }
    if (!opponent.trim()) { setError("请输入对手名称"); return; }
    if (!teamA) { setError("请选择有效的阵容方案"); return; }
    if (mode === "dual" && !teamB) { setError("无法为B队分配球员"); return; }

    setError("");
    const setup: GameSetup = {
      date, opponent: opponent.trim(), gameType, totalInnings,
      timeLimitMinutes: useTimeLimit ? timeLimitMinutes : undefined,
    };
    onStart(setup, teamA!, mode === "dual" ? (teamB ?? undefined) : undefined);
  }

  const selectedScenario = workspace.scenarios.find((s) => s.id === scenarioId);

  return (
    <>
      <div className={styles.backdrop} onClick={onCancel} />
      <div className={styles.dialog} role="dialog" aria-label="比赛设置">
        <header className={styles.dialogHeader}>
          <h3>
            {mode === "dual"
              ? "训练赛设置"
              : batFirst
                ? "正式比赛设置 · 先攻"
                : "正式比赛设置 · 先防"}
          </h3>
          <button className={styles.dialogClose} onClick={onCancel} type="button">×</button>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Basic info */}
          <div className={styles.row}>
            <label className={styles.field}>
              <span>日期</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label className={styles.field}>
              <span>对手</span>
              <input
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                maxLength={40}
                placeholder={mode === "dual" ? "队内红白战" : "对手名称"}
                required
              />
            </label>
            <label className={styles.field}>
              <span>类型</span>
              <select value={gameType} onChange={(e) => setGameType(e.target.value as "official" | "training")}>
                <option value="official">正式比赛</option>
                <option value="training">训练比赛</option>
              </select>
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.field}>
              <span>总局数</span>
              <input
                type="number"
                min={1}
                max={20}
                value={totalInnings}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 1 && n <= 20) setTotalInnings(n);
                }}
              />
            </label>
            <label className={styles.field}>
              <span>时间限制</span>
              <select value={useTimeLimit ? "yes" : "no"} onChange={(e) => setUseTimeLimit(e.target.value === "yes")}>
                <option value="no">无</option>
                <option value="yes">有</option>
              </select>
            </label>
          </div>
          {useTimeLimit && (
            <div className={styles.row}>
              <label className={styles.field}>
                <span>比赛时长（分钟）</span>
                <input
                  type="number"
                  min={30}
                  max={240}
                  step={10}
                  value={timeLimitMinutes}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (n >= 30 && n <= 240) setTimeLimitMinutes(n);
                  }}
                />
              </label>
              <span style={{ fontSize: 11, color: "var(--theme-muted)", alignSelf: "end", paddingBottom: 8 }}>
                常用: 90 / 120 / 150
              </span>
            </div>
          )}

          {/* Scenario picker */}
          <div className={styles.field}>
            <span>阵容方案</span>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
              {workspace.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.id === activeScenario?.id ? "(当前)" : ""}
                </option>
              ))}
            </select>
            {selectedScenario && (
              <p className={styles.hint}>
                方案备注: {selectedScenario.note || "无"}
              </p>
            )}
          </div>

          {/* Team preview */}
          {teamA && (
            <TeamPreview
              label={mode === "dual" ? "A队" : "我方阵容"}
              team={teamA}
              players={workspace.players}
            />
          )}
          {teamB && (
            <TeamPreview
              label="B队"
              team={teamB}
              players={workspace.players}
            />
          )}

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button className={styles.btnSecondary} onClick={onCancel} type="button">取消</button>
            <button className={styles.btnPrimary} type="submit">
              {mode === "dual" ? "开始双队记录" : "开始记录"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function TeamPreview({
  label,
  team,
  players,
}: {
  label: string;
  team: TeamSetup;
  players: Player[];
}) {
  function getPlayer(id: string | null): Player | undefined {
    if (!id) return undefined;
    return players.find((p) => p.id === id);
  }

  const defenseFilled = Object.entries(team.defense).filter(([, id]) => id !== null);
  const lineupFilled = team.lineup.filter((id) => id !== null);

  return (
    <div className={styles.teamPreview}>
      <h4 className={styles.teamLabel}>{label}</h4>
      <div className={styles.previewGrid}>
        <div>
          <span className={styles.previewTitle}>先发防守</span>
          {defenseFilled.length === 0 ? (
            <span className={styles.previewEmpty}>未设置</span>
          ) : (
            <div className={styles.tagList}>
              {defenseFilled.map(([pos, id]) => {
                const p = getPlayer(id);
                return (
                  <span key={pos} className={styles.tag}>
                    {posLabel(pos)}: {p?.name ?? id} #{p?.number}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <span className={styles.previewTitle}>打击棒次</span>
          {lineupFilled.length === 0 ? (
            <span className={styles.previewEmpty}>未设置</span>
          ) : (
            <ol className={styles.lineupList}>
              {team.lineup.map((id, i) => {
                const p = getPlayer(id);
                if (!p) return null;
                return (
                  <li key={i}>
                    {i + 1}. {p.name} #{p.number}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <div>
          <span className={styles.previewTitle}>替补</span>
          {team.bench.length === 0 ? (
            <span className={styles.previewEmpty}>无</span>
          ) : (
            <span className={styles.previewValue}>
              {team.bench.map((id) => {
                const p = getPlayer(id);
                return p ? `${p.name} #${p.number}` : id;
              }).join("、")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function buildTeamB(workspace: Workspace, teamA: TeamSetup): TeamSetup | null {
  const usedA = new Set([
    ...Object.values(teamA.defense).filter((id): id is string => id !== null),
    ...teamA.lineup.filter((id): id is string => id !== null),
  ]);

  const availableB = workspace.players.filter(
    (p) => !usedA.has(p.id) && p.status === "available",
  );

  if (availableB.length < 9) return null;

  const defense: Record<string, string | null> = {};
  const lineup: Array<string | null> = Array(9).fill(null);

  // Simple auto-assign: first 9 available players
  const posOrder = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
  for (let i = 0; i < 9; i++) {
    if (i < availableB.length) {
      const player = availableB[i];
      defense[posOrder[i]] = player.id;
      lineup[i] = player.id;
    } else {
      defense[posOrder[i]] = null;
    }
  }

  const bench = availableB.slice(9).map((p) => p.id);

  return { defense: defense as Record<string, string | null>, lineup, bench };
}

function posLabel(pos: string): string {
  const map: Record<string, string> = {
    P: "投", C: "捕", "1B": "一", "2B": "二", "3B": "三",
    SS: "游", LF: "左", CF: "中", RF: "右",
  };
  return map[pos] ?? pos;
}
