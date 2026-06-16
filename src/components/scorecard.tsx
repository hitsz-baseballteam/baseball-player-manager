"use client";

import { useCallback, useEffect, useState } from "react";

import { FieldBoard } from "@/components/field-board";
import { LineupStrip } from "@/components/lineup-strip";
import { PAResultGrid } from "@/components/pa-result-grid";
import { PitchCounter } from "@/components/pitch-counter";
import { RunnerDiamond } from "@/components/runner-diamond";
import {
  changePitcher,
  endHalfInning,
  recordPlateAppearance,
  reviewGame,
  shouldEndHalfInning,
  type PAResult,
  type ScoreboardGame,
} from "@/lib/scoreboard-actions";
import type { Player, PositionCode, Workspace } from "@/lib/workspace";
import styles from "./scorecard.module.css";

type ScorecardProps = {
  game: ScoreboardGame;
  workspace: Workspace;
  teamLabel: string;
  isActive: boolean;
  onUpdate: (updated: ScoreboardGame) => void;
};

export function Scorecard({
  game,
  workspace,
  teamLabel,
  isActive,
  onUpdate,
}: ScorecardProps) {
  const [showPitcherPicker, setShowPitcherPicker] = useState(false);
  const [showRunSelector, setShowRunSelector] = useState(false);
  const [pendingResult, setPendingResult] = useState<PAResult | null>(null);
  const [runsOnPlay, setRunsOnPlay] = useState(0);

  // Pitch counter state (resets per plate appearance)
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);

  // Inning transition state
  const [showTransition, setShowTransition] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState("");
  const prevOutsRef = { current: game.outs };
  const prevHalfRef = { current: game.halfInning };
  const prevInningRef = { current: game.currentInning };

  const currentInningPA = game.innings.find((inn) => inn.inning === game.currentInning);
  const inningRuns = currentInningPA?.plateAppearances.reduce((sum, pa) => sum + pa.runsScored, 0) ?? 0;

  // Auto-trigger PA result when count is full
  useEffect(() => {
    if (!isActive) return;
    if (balls >= 4) {
      handleResult("BB");
      setBalls(0); setStrikes(0);
    } else if (strikes >= 3) {
      handleResult("SO");
      setBalls(0); setStrikes(0);
    }
  }, [balls, strikes, isActive]);

  function handleResult(result: PAResult) {
    if (!isActive) return;

    // Check if we need to ask about runs
    const needsRunInput = game.runners.length > 0 &&
      ["1B", "2B", "3B", "HR", "BB", "HBP", "GO", "SF", "SAC", "DP"].includes(result);

    if (needsRunInput) {
      setPendingResult(result);
      setShowRunSelector(true);
      setRunsOnPlay(0);
    } else {
      applyResult(result, 0);
    }
    // Reset pitch count after each PA
    setBalls(0);
    setStrikes(0);
  }

  function applyResult(result: PAResult, runs: number) {
    const updated = recordPlateAppearance(game, result);
    onUpdate(updated);
    setShowRunSelector(false);
    setPendingResult(null);

    // Check for half-inning end
    if (shouldEndHalfInning(updated)) {
      triggerTransition(updated);
      const ended = endHalfInning(updated);
      onUpdate(ended);
    }
  }

  function triggerTransition(gameAfterPA: ScoreboardGame) {
    const label = gameAfterPA.halfInning === "top"
      ? `▼ 下半局 · 第${gameAfterPA.currentInning}局`
      : `▲ 上半局 · 第${gameAfterPA.currentInning + 1}局`;
    setTransitionLabel(label);
    setShowTransition(true);
    setTimeout(() => setShowTransition(false), 2000);
  }

  function confirmRuns() {
    if (pendingResult) {
      applyResult(pendingResult, runsOnPlay);
    }
  }

  function handleEndHalfInning() {
    const updated = endHalfInning(game);
    onUpdate(updated);
  }

  function handleChangePitcher(playerId: string) {
    onUpdate(changePitcher(game, playerId));
    setShowPitcherPicker(false);
  }

  function handleEndGame() {
    onUpdate(reviewGame(game));
  }

  function handleResetCount() {
    setBalls(0);
    setStrikes(0);
  }

  function handleBall() {
    if (balls < 4) setBalls((b) => b + 1);
  }

  function handleStrike() {
    if (strikes < 3) setStrikes((s) => s + 1);
  }

  const currentPitcher = game.currentPitcherId
    ? workspace.players.find((p) => p.id === game.currentPitcherId)
    : null;

  const eligiblePitchers = workspace.players.filter(
    (p) => p.status === "available" && p.id !== game.currentPitcherId,
  );

  return (
    <div className={`${styles.card} ${!isActive ? styles.cardInactive : ""}`}>
      {/* Inning header */}
      <div className={styles.inningHeader}>
        <div className={styles.inningInfo}>
          <span className={styles.inningBadge}>
            第{game.currentInning}局
          </span>
          <span className={styles.halfLabel}>
            {game.halfInning === "top" ? "▲ 上半" : "▼ 下半"}
          </span>
          <span className={styles.outsDots}>
            {renderOuts(game.outs)}
          </span>
        </div>
        <div className={styles.teamLabelBadge}>{teamLabel}</div>
      </div>

      {/* Main board: Field diagram + Pitch counter + Runner diamond */}
      <div className={styles.boardGrid}>
        {/* Defense field (read-only) */}
        <div className={styles.fieldPanel}>
          <FieldBoard
            players={workspace.players}
            defense={game.defense}
            onAssign={noopAssign}
            onClear={noopClear}
            onSwap={noopSwap}
          />
        </div>

        {/* Pitch counter + Runner diamond */}
        <div className={styles.sidePanel}>
          <PitchCounter
            balls={balls}
            strikes={strikes}
            outs={game.outs}
            onBall={handleBall}
            onStrike={handleStrike}
            onResetCount={handleResetCount}
            pitcherName={currentPitcher?.name ?? null}
            pitcherNumber={currentPitcher?.number ?? null}
            disabled={!isActive}
          />

          <RunnerDiamond
            runners={game.runners}
            players={workspace.players}
            runsScoredInning={inningRuns}
          />
        </div>
      </div>

      {/* PA Result Grid */}
      <PAResultGrid
        onResult={handleResult}
        disabled={!isActive}
      />

      {/* Lineup strip */}
      <LineupStrip
        lineup={game.lineup}
        currentBatterIndex={game.currentBatterIndex}
        players={workspace.players}
      />

      {/* Controls bar */}
      <div className={styles.controlBar}>
        <div className={styles.controlActions}>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => setShowPitcherPicker(!showPitcherPicker)}
            disabled={!isActive}
          >
            🔄 换投
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleEndHalfInning}
            disabled={!isActive}
          >
            结束半局
          </button>
        </div>

        <div className={styles.scoreDisplay}>
          得分: <strong>{game.scoreTop > 0 || game.scoreBottom > 0 ? (game.halfInning === "top" ? game.scoreTop : game.scoreBottom) : (game.scoreTop + game.scoreBottom)}</strong>
        </div>

        <button
          type="button"
          className={styles.btnEndGame}
          onClick={handleEndGame}
          disabled={!isActive}
        >
          结束比赛
        </button>
      </div>

      {/* Pitcher picker popup */}
      {showPitcherPicker && (
        <div className={styles.pickerOverlay}>
          <div className={styles.picker}>
            <h4>选择投手</h4>
            <div className={styles.pickerList}>
              {eligiblePitchers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.pickerBtn}
                  onClick={() => handleChangePitcher(p.id)}
                >
                  {p.name} <span className={styles.pickerNum}>#{p.number}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setShowPitcherPicker(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Run selector overlay */}
      {showRunSelector && (
        <div className={styles.runOverlay}>
          <div className={styles.runDialog}>
            <p className={styles.runQuestion}>几分下分？</p>
            <div className={styles.runButtons}>
              {[0, 1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.runBtn} ${runsOnPlay === n ? styles.runBtnActive : ""}`}
                  onClick={() => setRunsOnPlay(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <button type="button" className={styles.btnPrimary} onClick={confirmRuns}>
              确认
            </button>
          </div>
        </div>
      )}

      {/* Half-inning transition overlay */}
      {showTransition && (
        <div className={styles.transitionOverlay}>
          <div className={styles.transitionCard}>
            <span className={styles.transitionIcon}>
              {game.halfInning === "top" ? "🔽" : "🔼"}
            </span>
            <span className={styles.transitionLabel}>{transitionLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// No-op handlers for read-only FieldBoard
function noopAssign(_pos: PositionCode, _playerId: string) {}
function noopClear(_pos: PositionCode) {}
function noopSwap(_from: PositionCode, _to: PositionCode) {}

function renderOuts(outs: number) {
  return (
    <span className={styles.outsText}>
      {outs >= 1 ? "●" : "○"}
      {outs >= 2 ? "●" : "○"}
      {outs >= 3 ? "●" : "○"}
      {" "}{outs}出局
    </span>
  );
}
