"use client";

import { useState } from "react";

import { LineupStrip } from "@/components/lineup-strip";
import { OpponentBaseDiamond } from "@/components/opponent-base-diamond";
import { PAResultGrid } from "@/components/pa-result-grid";
import { PitchCounter } from "@/components/pitch-counter";
import { RunnerDiamond } from "@/components/runner-diamond";
import { SceneFieldBoard } from "@/components/scene-field-board";
import {
  changePitcher,
  endHalfInning,
  recordPlateAppearance,
  reviewGame,
  shouldEndHalfInning,
  type PAResult,
  type ScoreboardGame,
} from "@/lib/scoreboard-actions";
import type { PositionCode, Workspace } from "@/lib/workspace";
import styles from "./scorecard.module.css";

// ── Types ──

type ScorecardProps = {
  /** The team currently batting (null = opponent in official mode, not tracked) */
  battingGame: ScoreboardGame | null;
  /** The team currently fielding (null = opponent defense, not tracked) */
  fieldingGame: ScoreboardGame | null;
  workspace: Workspace;
  teamLabel: string;
  isActive: boolean;
  /** Whether the batting team is the opponent (simplified UI) */
  isOpponentBatting: boolean;
  onUpdateBatting: (updated: ScoreboardGame) => void;
  onUpdateFielding: (updated: ScoreboardGame) => void;
};

// ── Component ──

export function Scorecard({
  battingGame,
  fieldingGame,
  workspace,
  teamLabel,
  isActive,
  isOpponentBatting,
  onUpdateBatting,
  onUpdateFielding,
}: ScorecardProps) {
  // Unified game state (the "active" game for inning/outs tracking)
  const live = (battingGame ?? fieldingGame)!;
  if (!battingGame && !fieldingGame) return null;

  // ── Batting UI state ──
  const [showRunSelector, setShowRunSelector] = useState(false);
  const [pendingResult, setPendingResult] = useState<PAResult | null>(null);
  const [runsOnPlay, setRunsOnPlay] = useState(0);

  // ── Two-step defensive event state ──
  const [pendingFieldResult, setPendingFieldResult] = useState<PAResult | null>(null);
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  // ── Pitch counter (only for fielding team's pitcher) ──
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [fouls, setFouls] = useState(0);
  const [totalPitches, setTotalPitches] = useState(0);

  // ── Opponent runner tracking (when opponent is batting) ──
  const [opponentRunners, setOpponentRunners] = useState<{ playerId: string; base: 1 | 2 | 3 }[]>([]);

  // ── Popups ──
  const [showPitcherPicker, setShowPitcherPicker] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState("");

  const currentInningPA = live.innings.find((inn) => inn.inning === live.currentInning);
  const inningRuns = currentInningPA?.plateAppearances.reduce((sum, pa) => sum + pa.runsScored, 0) ?? 0;

  // Auto-trigger on full count
  if (fieldingGame && balls >= 4 && isActive) {
    handleResult("BB");
    resetCount();
  }
  if (fieldingGame && strikes >= 3 && isActive) {
    handleResult("SO");
    resetCount();
  }

  // ── PA result handling ──

  // ── Steal runner picker ──
  const [showStealPicker, setShowStealPicker] = useState(false);
  const [stealType, setStealType] = useState<"SB" | "CS">("SB");

  function handleResult(result: PAResult) {
    if (!isActive) return;
    if (showFieldPicker) return;

    // SB/CS need runner selection
    if (result === "SB" || result === "CS") {
      setStealType(result);
      setShowStealPicker(true);
      return;
    }

    // Defensive events that need fielder position selection
    const needsFielder = ["GO", "FO", "LO", "DP", "SF", "ROE", "FC"].includes(result);
    if (needsFielder && fieldingGame && !isOpponentBatting) {
      setPendingFieldResult(result);
      setShowFieldPicker(true);
      return;
    }

    processResult(result, null);
  }

  function handleStealRunner(playerId: string) {
    setShowStealPicker(false);
    const g = battingGame ?? fieldingGame!;
    // Reorder runners: stealing runner to front so computeRunnerAdvancement picks them
    const runners = [...g.runners];
    const idx = runners.findIndex((r) => r.playerId === playerId);
    if (idx > 0) {
      const [stealer] = runners.splice(idx, 1);
      runners.unshift(stealer);
    }
    // Process steal on a temp copy with reordered runners
    const tempGame = { ...g, runners };
    // We need to temporarily override the game reference for processResult
    // Instead, just apply the steal directly using the engine
    const updated = recordPlateAppearance(tempGame, stealType);
    // Restore runner order from the result (the engine processed it correctly)
    if (battingGame) onUpdateBatting(updated);
    else onUpdateFielding(updated);
  }

  function handleFielderClick(position: PositionCode) {
    if (!pendingFieldResult) return;
    const result = pendingFieldResult;
    setPendingFieldResult(null);
    setShowFieldPicker(false);
    processResult(result, position);
  }

  function processResult(result: PAResult, fielder: PositionCode | null) {
    const g = battingGame ?? fieldingGame!;
    const hasRunnerOn3 = g.runners.some((r) => r.base === 3);
    const hasRunnerOn2 = g.runners.some((r) => r.base === 2);
    const basesLoaded = g.runners.length >= 3;

    // Only ask for runs when scoring is realistically possible
    // HR always clears the bases — no need to ask
    const needsRunInput = result !== "HR" && (
      (hasRunnerOn3 && ["1B","2B","3B","GO","SF","SAC","DP","BB","HBP","FC"].includes(result)) ||
      (hasRunnerOn2 && ["1B","2B","3B"].includes(result)) ||
      (g.runners.length > 0 && ["2B","3B"].includes(result)) ||
      (basesLoaded && ["BB","HBP"].includes(result))
    );

    if (needsRunInput && battingGame) {
      (window as any).__pendingFielder = fielder;
      setPendingResult(result);
      setShowRunSelector(true);
      setRunsOnPlay(0);
    } else {
      applyResult(result, fielder);
    }
  }

  function applyResult(result: PAResult, fielder?: PositionCode | null) {
    const fld = fielder ?? (window as any).__pendingFielder as PositionCode | undefined;
    delete (window as any).__pendingFielder;

    const g = battingGame ?? fieldingGame!;
    const updated = recordPlateAppearance(g, result, fld);

    if (battingGame) {
      onUpdateBatting(updated);
    } else {
      onUpdateFielding(updated);
    }

    // SB/CS are base running events — don't reset pitch count
    if (result !== "SB" && result !== "CS") resetCount();

    if (shouldEndHalfInning(updated)) {
      const half = updated.halfInning;
      const inn = updated.currentInning;
      const label = half === "top"
        ? `▼ 下半局 · 第${inn}局`
        : `▲ 上半局 · 第${inn + 1}局`;
      setTransitionLabel(label);
      setShowTransition(true);
      setTimeout(() => setShowTransition(false), 2000);
      const ended = endHalfInning(updated);
      if (battingGame) onUpdateBatting(ended);
      else onUpdateFielding(ended);
    }
  }

  function confirmRuns() {
    if (pendingResult) {
      const fld = (window as any).__pendingFielder as PositionCode | undefined;
      delete (window as any).__pendingFielder;
      applyResult(pendingResult, fld);
      setPendingResult(null);
      setShowRunSelector(false);
    }
  }

  // ── Controls ──

  function resetCount() {
    setBalls(0); setStrikes(0); setFouls(0);
  }

  function handleBall() { if (balls < 4) { setBalls(b => b + 1); setTotalPitches(t => t + 1); } }
  function handleStrike() { if (strikes < 3) { setStrikes(s => s + 1); setTotalPitches(t => t + 1); } }
  function handleFoul() {
    setFouls(f => f + 1);
    setTotalPitches(t => t + 1);
  }
  function handleEndHalf() {
    const updated = endHalfInning(live);
    if (battingGame) onUpdateBatting(updated);
    else onUpdateFielding(updated);
  }
  function handleEndGame() {
    const updated = reviewGame(live);
    if (battingGame) onUpdateBatting(updated);
    else onUpdateFielding(updated);
  }
  function handleChangePitcher(playerId: string) {
    if (fieldingGame) onUpdateFielding(changePitcher(fieldingGame, playerId));
    setShowPitcherPicker(false);
  }

  // ── Defense mutations ──
  function handleFieldAssign(pos: PositionCode, playerId: string) {
    if (showFieldPicker) { handleFielderClick(pos); return; }
    if (!fieldingGame) return;
    onUpdateFielding({ ...fieldingGame, defense: { ...fieldingGame.defense, [pos]: playerId || null } });
  }
  function handleFieldClear(pos: PositionCode) {
    if (!fieldingGame) return;
    onUpdateFielding({ ...fieldingGame, defense: { ...fieldingGame.defense, [pos]: null } });
  }
  function handleFieldSwap(fromPos: PositionCode, toPos: PositionCode) {
    if (!fieldingGame) return;
    const from = fieldingGame.defense[fromPos];
    const to = fieldingGame.defense[toPos];
    onUpdateFielding({ ...fieldingGame, defense: { ...fieldingGame.defense, [fromPos]: to, [toPos]: from } });
  }

  // ── Derived data ──

  // Current batter (from batting game)
  const batterId = battingGame?.lineup[battingGame.currentBatterIndex] ?? null;
  const batterPlayer = batterId ? workspace.players.find(p => p.id === batterId) : null;
  const batterStats = batterId ? battingGame?.statLines[batterId] : null;

  // Current pitcher (from fielding game)
  const fieldingPitcher = fieldingGame?.currentPitcherId
    ? workspace.players.find(p => p.id === fieldingGame.currentPitcherId)
    : null;
  const eligiblePitchers = workspace.players.filter(
    p => p.status === "available" && p.id !== fieldingGame?.currentPitcherId,
  );

  // ── Render ──

  return (
    <div className={`${styles.card} ${!isActive ? styles.cardInactive : ""}`}>
      {/* ═══ Inning header ═══ */}
      <div className={styles.inningHeader}>
        <div className={styles.inningInfo}>
          <span className={styles.inningBadge}>第{live.currentInning}局</span>
          <span className={styles.halfLabel}>
            {live.halfInning === "top" ? "▲ 上半" : "▼ 下半"}
          </span>
          <span className={styles.statusTag}>
            {isOpponentBatting ? "对手进攻" : battingGame ? "我方进攻" : "我方防守"}
          </span>
          {renderOuts(live.outs)}
        </div>
        <div className={styles.headerRight}>
          <span className={styles.scoreBadge}>
            {live.halfInning === "top" ? live.scoreTop : live.scoreBottom} 分
          </span>
          <span className={styles.teamLabelBadge}>{teamLabel}</span>
        </div>
      </div>

      {/* ═══ Two-step field picker banner ═══ */}
      {showFieldPicker && (
        <div className={styles.fieldPickBanner}>
          👆 点击防守位置完成「{resultLabel(pendingFieldResult ?? "")}」记录
          <button type="button" className={styles.fieldPickCancel}
            onClick={() => { setPendingFieldResult(null); setShowFieldPicker(false); }}>取消</button>
        </div>
      )}

      {/* ═══ Split layout: Batting (left) / Fielding (right) ═══ */}
      <div className={styles.dualCol}>
        {/* ═══ LEFT: Batting ═══ */}
        <div className={styles.battingCol}>
          <div className={styles.colLabel}>
            ⚾ {isOpponentBatting ? "对手打席" : "打击区"}
          </div>

          {isOpponentBatting ? (
            /* Opponent batting — simplified controls + runner tracking */
            <div className={styles.opponentSection}>
              <div className={styles.opponentTopRow}>
                <OpponentBaseDiamond runners={opponentRunners} />
                <div className={styles.opponentRunInfo}>
                  <span className={styles.opponentRunLabel}>对手得分</span>
                  <span className={styles.opponentRunValue}>
                    {live.halfInning === "top" ? live.scoreTop : live.scoreBottom}
                  </span>
                </div>
              </div>
              <p className={styles.opponentHint}>
                记录对手打席结果（仅用于我方投手/守备统计）
              </p>
              <PAResultGrid onResult={handleResult} disabled={!isActive} />
            </div>
          ) : battingGame ? (
            /* Our team batting — full view */
            <>
              {/* Current batter card with live stats */}
              {batterPlayer && (
                <div className={styles.batterCard}>
                  <div className={styles.batterHeader}>
                    <span className={styles.batterSlot}>
                      {battingGame.currentBatterIndex + 1}番
                    </span>
                    <span className={styles.batterName}>
                      {batterPlayer.name}
                    </span>
                    <span className={styles.batterNum}>
                      #{batterPlayer.number}
                    </span>
                  </div>
                  {batterStats && (
                    <div className={styles.batterStats}>
                      <StatItem label="打席" value={batterStats.pa} />
                      <StatItem label="打数" value={batterStats.ab} />
                      <StatItem label="安打" value={batterStats.h} accent />
                      <StatItem label="本垒打" value={batterStats.hr} accent />
                      <StatItem label="打点" value={batterStats.rbi} />
                      <StatItem label="得分" value={batterStats.r} />
                      <StatItem label="四坏" value={batterStats.bb} />
                      <StatItem label="三振" value={batterStats.so} />
                    </div>
                  )}
                </div>
              )}

              <RunnerDiamond runners={battingGame.runners} players={workspace.players}
                runsScoredInning={inningRuns} />

              <PAResultGrid onResult={handleResult} disabled={!isActive || showFieldPicker} />

              {/* Steal buttons */}
              {battingGame.runners.length > 0 && (
                <div className={styles.stealRow}>
                  <button type="button" className={styles.btnSteal}
                    disabled={!isActive} onClick={() => handleResult("SB" as PAResult)}>
                    🏃 盗垒
                  </button>
                  <button type="button" className={styles.btnStealFail}
                    disabled={!isActive} onClick={() => handleResult("CS" as PAResult)}>
                    ❌ 盗垒失败
                  </button>
                </div>
              )}

              {/* Batting stats table */}
              <BattingStatsTable
                lineup={battingGame.lineup}
                currentBatterIndex={battingGame.currentBatterIndex}
                statLines={battingGame.statLines}
                defense={fieldingGame?.defense ?? {}}
                players={workspace.players}
              />
            </>
          ) : (
            /* No batting game — opponent is batting but we have no battingGame */
            <div className={styles.opponentSection}>
              <p className={styles.opponentHint}>对手进攻中</p>
              <PAResultGrid onResult={handleResult} disabled={!isActive} />
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Fielding ═══ */}
        <div className={`${styles.fieldingCol} ${showFieldPicker ? styles.fieldingPicking : ""}`}>
          <div className={styles.colLabel}>🛡️ 防守区</div>

          {fieldingGame ? (
            <>
              {/* Interactive defense field (same UI as scenarios page) */}
              <SceneFieldBoard
                players={workspace.players}
                defense={fieldingGame.defense}
                onAssign={handleFieldAssign}
                onClear={handleFieldClear}
                onSwap={handleFieldSwap}
                pickingMode={showFieldPicker}
                pickingLabel={showFieldPicker ? `👆 点击位置完成「${resultLabel(pendingFieldResult ?? "")}」记录` : undefined}
                onPickingSelect={(pos) => handleFielderClick(pos)}
                onPickingCancel={() => { setPendingFieldResult(null); setShowFieldPicker(false); }}
              />

              {/* Pitch counter — ONLY for our pitcher when we're fielding */}
              <PitchCounter
                balls={balls} strikes={strikes} fouls={fouls} outs={live.outs}
                totalPitches={totalPitches}
                onBall={handleBall} onStrike={handleStrike} onFoul={handleFoul}
                onResetCount={resetCount}
                pitcherName={fieldingPitcher?.name ?? null}
                pitcherNumber={fieldingPitcher?.number ?? null}
                disabled={!isActive}
              />

              <div className={styles.fieldActions}>
                <button type="button" className={styles.controlBtn}
                  onClick={() => setShowPitcherPicker(!showPitcherPicker)} disabled={!isActive}>
                  🔄 换投
                </button>
              </div>
            </>
          ) : isOpponentBatting ? (
            /* Opponent batting but we have no fieldingGame (official mode top with batFirst=false, or bottom with batFirst=true) */
            /* Actually this shouldn't happen — opponent batting should always have our fieldingGame */
            <div className={styles.genericDefense}>
              <p className={styles.opponentHint}>对手防守</p>
            </div>
          ) : (
            <div className={styles.genericDefense}>
              <p className={styles.opponentHint}>对手防守</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Bench / Substitutes ═══ */}
      <BenchStrip
        workspace={workspace}
        battingGame={battingGame}
        fieldingGame={fieldingGame}
        isOpponentBatting={isOpponentBatting}
      />

      {/* ═══ Bottom controls ═══ */}
      <div className={styles.controlBar}>
        <button type="button" className={styles.btnSecondary}
          onClick={handleEndHalf} disabled={!isActive}>结束半局</button>
        <button type="button" className={styles.btnEndGame}
          onClick={handleEndGame} disabled={!isActive}>结束比赛</button>
      </div>

      {/* ── Pitcher picker popup ── */}
      {showPitcherPicker && (
        <div className={styles.pickerOverlay}>
          <div className={styles.picker}>
            <h4>选择投手</h4>
            <div className={styles.pickerList}>
              {eligiblePitchers.map(p => (
                <button key={p.id} type="button" className={styles.pickerBtn}
                  onClick={() => handleChangePitcher(p.id)}>
                  {p.name} <span className={styles.pickerNum}>#{p.number}</span>
                </button>
              ))}
            </div>
            <button type="button" className={styles.btnSecondary}
              onClick={() => setShowPitcherPicker(false)}>取消</button>
          </div>
        </div>
      )}

      {/* ── Run selector ── */}
      {showRunSelector && (
        <div className={styles.runOverlay}>
          <div className={styles.runDialog}>
            <p className={styles.runQuestion}>几分下分？</p>
            <div className={styles.runButtons}>
              {[0, 1, 2, 3, 4].map(n => (
                <button key={n} type="button"
                  className={`${styles.runBtn} ${runsOnPlay === n ? styles.runBtnActive : ""}`}
                  onClick={() => setRunsOnPlay(n)}>{n}</button>
              ))}
            </div>
            <button type="button" className={styles.btnPrimary} onClick={confirmRuns}>确认</button>
          </div>
        </div>
      )}

      {/* ── Steal runner picker ── */}
      {showStealPicker && (
        <div className={styles.runOverlay}>
          <div className={styles.runDialog}>
            <p className={styles.runQuestion}>
              {stealType === "SB" ? "🏃 谁盗垒？" : "❌ 谁盗垒失败？"}
            </p>
            <div className={styles.stealRunnerList}>
              {(battingGame ?? fieldingGame)!.runners.map((r) => {
                const p = workspace.players.find((pl) => pl.id === r.playerId);
                const baseLabel = { 1: "一垒", 2: "二垒", 3: "三垒" }[r.base];
                return (
                  <button
                    key={r.playerId}
                    type="button"
                    className={styles.stealRunnerBtn}
                    onClick={() => handleStealRunner(r.playerId)}
                  >
                    <span className={styles.stealRunnerBase}>{baseLabel}</span>
                    {p ? <><strong>#{p.number}</strong> {p.name}</> : r.playerId}
                  </button>
                );
              })}
            </div>
            <button type="button" className={styles.btnSecondary}
              onClick={() => setShowStealPicker(false)}>取消</button>
          </div>
        </div>
      )}

      {/* ── Transition overlay ── */}
      {showTransition && (
        <div className={styles.transitionOverlay}>
          <div className={styles.transitionCard}>
            <span className={styles.transitionIcon}>
              {live.halfInning === "top" ? "🔽" : "🔼"}
            </span>
            <span className={styles.transitionLabel}>{transitionLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mini components ──

function StatItem({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <span className={accent ? styles.statItemAccent : styles.statItem}>
      <em>{label}</em> {value}
    </span>
  );
}

function resultLabel(r: string): string {
  const m: Record<string, string> = {
    "1B": "一安", "2B": "二安", "3B": "三安", "HR": "本打",
    "BB": "四坏", "HBP": "触身", "SO": "三振",
    "GO": "滚地", "FO": "飞球", "LO": "平飞",
    "DP": "双杀", "SF": "牺飞", "SAC": "牺触",
    "ROE": "失误", "FC": "野选",
  };
  return m[r] ?? r;
}

// ── Batting stats table component ──

const POS_LABEL: Record<string, string> = {
  P: "P", C: "C", "1B": "1B", "2B": "2B", "3B": "3B", SS: "SS", LF: "LF", CF: "CF", RF: "RF",
};

function BattingStatsTable({
  lineup,
  currentBatterIndex,
  statLines,
  defense,
  players,
}: {
  lineup: Array<string | null>;
  currentBatterIndex: number;
  statLines: Record<string, import("@/lib/scoreboard-actions").LiveStatLine>;
  defense: Record<string, string | null>;
  players: import("@/lib/workspace").Player[];
}) {
  function getPlayer(id: string | null) { return id ? players.find((p) => p.id === id) : null; }
  function getPos(id: string): string {
    const entry = Object.entries(defense).find(([, pid]) => pid === id);
    return entry ? (POS_LABEL[entry[0]] ?? entry[0]) : "";
  }

  return (
    <div className={styles.battingTable}>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>球员</th>
            <th>Pos</th>
            <th>PA</th>
            <th>AB</th>
            <th>H</th>
            <th>HR</th>
            <th>RBI</th>
            <th>R</th>
            <th>BB</th>
            <th>SO</th>
            <th>SB</th>
          </tr>
        </thead>
        <tbody>
          {lineup.map((id, i) => {
            const player = getPlayer(id);
            const stats = id ? statLines[id] : null;
            const isCurrent = i === currentBatterIndex;
            return (
              <tr key={i} className={isCurrent ? styles.battingCurrent : ""}>
                <td className={styles.battingSlot}>{i + 1}</td>
                <td>
                  {player ? (
                    <span className={styles.battingName}>
                      {player.name} <span className={styles.battingNum}>#{player.number}</span>
                    </span>
                  ) : (
                    <span className={styles.battingEmpty}>—</span>
                  )}
                </td>
                <td className={styles.battingPos}>{id ? getPos(id) : ""}</td>
                <td>{stats?.pa ?? 0}</td>
                <td>{stats?.ab ?? 0}</td>
                <td className={stats && stats.h > 0 ? styles.battingHit : ""}>{stats?.h ?? 0}</td>
                <td className={stats && stats.hr > 0 ? styles.battingHit : ""}>{stats?.hr || "-"}</td>
                <td>{stats?.rbi || "-"}</td>
                <td>{stats?.r || "-"}</td>
                <td>{stats?.bb || "-"}</td>
                <td>{stats?.so || "-"}</td>
                <td>{stats?.sb || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Bench strip (substitutes) ──

function BenchStrip({
  workspace,
  battingGame,
  fieldingGame,
  isOpponentBatting,
}: {
  workspace: Workspace;
  battingGame: ScoreboardGame | null;
  fieldingGame: ScoreboardGame | null;
  isOpponentBatting: boolean;
}) {
  if (isOpponentBatting && !fieldingGame) return null; // No bench in pure opponent view

  // Collect players already on the field or in lineup
  const usedIds = new Set<string>();
  if (fieldingGame) {
    for (const id of Object.values(fieldingGame.defense)) {
      if (id) usedIds.add(id);
    }
  }
  if (battingGame) {
    for (const id of battingGame.lineup) {
      if (id) usedIds.add(id);
    }
  }

  const bench = workspace.players.filter(
    (p) => p.status === "available" && !usedIds.has(p.id)
  );

  if (bench.length === 0) return null;

  return (
    <div className={styles.benchStrip}>
      <span className={styles.benchLabel}>替补</span>
      <div className={styles.benchCards}>
        {bench.map((p) => (
          <div
            key={p.id}
            className={styles.benchCard}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", `player:${p.id}`);
            }}
          >
            <span className={styles.benchCardNum}>#{p.number}</span>
            <span className={styles.benchCardName}>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderOuts(outs: number) {
  return (
    <span className={styles.outsText}>
      {outs >= 1 ? "●" : "○"}{outs >= 2 ? "●" : "○"}{outs >= 3 ? "●" : "○"}
      {" "}{outs}出局
    </span>
  );
}
