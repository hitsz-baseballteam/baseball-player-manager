"use client";

import { useRef, useState } from "react";

import { OpponentBaseDiamond } from "@/components/opponent-base-diamond";
import { PAResultGrid } from "@/components/pa-result-grid";
import { PitchCounter } from "@/components/pitch-counter";
import { RunnerDiamond } from "@/components/runner-diamond";
import { SceneFieldBoard } from "@/components/scene-field-board";
import {
  changePitcher,
  deriveStatsFromPA,
  distributeFieldingStats,
  endHalfInning,
  recordPlateAppearance,
  reviewGame,
  shouldEndHalfInning,
  type LiveStatLine,
  type PAResult,
  type PlateAppearance,
  type ScoreboardGame,
} from "@/lib/scoreboard-actions";
import { nextLocalId } from "@/lib/local-id";
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
  // ═══ All hooks must be called unconditionally ═══

  // ── Two-step defensive event state ──
  const [pendingFieldResult, setPendingFieldResult] = useState<PAResult | null>(null);
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  // ── Pitch counter (only for fielding team's pitcher) ──
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [fouls, setFouls] = useState(0);
  const [totalPitches, setTotalPitches] = useState(0);


  // ── Popups ──
  const [showPitcherPicker, setShowPitcherPicker] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState("");

  // ── Steal runner picker ──
  const [showStealPicker, setShowStealPicker] = useState(false);
  const [stealType, setStealType] = useState<"SB" | "CS">("SB");

  // ── Runner advancement picker (for 1B/2B with runners on base) ──
  const [showAdvancePicker, setShowAdvancePicker] = useState(false);
  const pendingAdvanceFielderRef = useRef<PositionCode | null>(null);
  // ── Live "selected fielder" for ROE picker (state, not ref) ──
  // Reading ref.current inside JSX violates react-hooks/refs, so this is
  // promoted to state. The popup re-renders as soon as the fielder is set.
  const [pendingROEFielder, setPendingROEFielder] = useState<PositionCode | null>(null);
  // ── Live "advance result type" (1B / 2B / ROE) for the picker title ──
  const [pendingAdvanceResult, setPendingAdvanceResult] = useState<PAResult | null>(null);
  const [runnerTargets, setRunnerTargets] = useState<Record<string, "score" | "stay" | 2 | 3>>({});

  // ── PB ball/strike chooser ──
  const [showPBChooser, setShowPBChooser] = useState(false);

  // ── Uncaught third strike dialog ──
  const [showUncaught3K, setShowUncaught3K] = useState(false);
  const pendingUncaughtResultRef = useRef<"WP" | "PB">("WP");

  // ── ROE error type picker ──
  const [showErrorTypePicker, setShowErrorTypePicker] = useState(false);
  const pendingROEResultRef = useRef<PAResult | null>(null);
  // `pendingROEFielderRef` was promoted to state above so JSX can read it
  // without violating react-hooks/refs.

  // ── FC runner picker (fielder's choice — select which runner is out) ──
  const [showFCRunnerPicker, setShowFCRunnerPicker] = useState(false);
  const pendingFCResultRef = useRef<PAResult | null>(null);
  const pendingFCFielderRef = useRef<PositionCode | null>(null);

  function resetCount() {
    setBalls(0); setStrikes(0); setFouls(0);
  }

  // BB / SO auto-trigger logic moved into `handleBall` / `handleStrike`
  // (see below) so it runs as part of the click event instead of from a
  // useEffect that would either call setState or access refs during render.

  // ═══ Early return after all hooks ═══
  if (!battingGame && !fieldingGame) return null;

  // Unified game state (the "active" game for inning/outs tracking)
  const live = (battingGame ?? fieldingGame)!;

  const currentInningPA = live.innings.find((inn) => inn.inning === live.currentInning);
  const inningRuns = currentInningPA?.plateAppearances.reduce((sum, pa) => sum + pa.runsScored, 0) ?? 0;

  // ── Core engine ──

  function applyResult(result: PAResult, fielder?: PositionCode | null) {
    const g = battingGame ?? fieldingGame!;
    const updated = recordPlateAppearance(g, result, fielder, isOpponentBatting);

    if (battingGame) {
      onUpdateBatting(updated);
    } else {
      onUpdateFielding(updated);
    }

    if (result !== "BB" && result !== "SB" && result !== "CS") {
      setTotalPitches((t) => t + 1);
    }
    if (result !== "SB" && result !== "CS" && result !== "WP") resetCount();

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

  function processResult(result: PAResult, fielder: PositionCode | null) {
    const g = battingGame ?? fieldingGame!;

    if (result === "ROE" && fielder) {
      pendingROEResultRef.current = result;
      setPendingROEFielder(fielder);
      setShowErrorTypePicker(true);
      return;
    }

    if (result === "FC" && g.runners.length > 1) {
      pendingFCResultRef.current = result;
      pendingFCFielderRef.current = fielder;
      setShowFCRunnerPicker(true);
      return;
    }

    if ((result === "1B" || result === "2B") && g.runners.length > 0) {
      const maxAdvance = result === "2B" ? 2 : 1;
      const targets: Record<string, "score" | "stay" | 2 | 3> = {};
      for (const r of g.runners) {
        const targetBase = r.base + maxAdvance;
        targets[r.playerId] = targetBase >= 4 ? "score" : targetBase as 2 | 3;
      }
      setRunnerTargets(targets);
      setPendingAdvanceResult(result);
      pendingAdvanceFielderRef.current = fielder;
      setShowAdvancePicker(true);
      return;
    }

    applyResult(result, fielder);
  }

  // ── PA result handling ──

  function handleResult(result: PAResult) {
    if (!isActive) return;
    if (showFieldPicker) return;

    // PB with <2 strikes: ask ball or strike first
    if (result === "PB" && strikes < 2 && fieldingGame) {
      setShowPBChooser(true);
      return;
    }

    // WP/PB with 2 strikes: uncaught third strike check
    if ((result === "WP" || result === "PB") && strikes === 2 && fieldingGame) {
      pendingUncaughtResultRef.current = result;
      setShowUncaught3K(true);
      return;
    }

    // SB/CS need runner selection
    if (result === "SB" || result === "CS") {
      setStealType(result);
      setShowStealPicker(true);
      return;
    }

    // Defensive events that need fielder position selection (both our batting and opponent batting)
    const needsFielder = ["GO", "FO", "LO", "DP", "SF", "ROE", "FC"].includes(result);
    if (needsFielder && fieldingGame) {
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

  function toggleRunnerTarget(playerId: string) {
    setRunnerTargets((prev) => {
      const current = prev[playerId];
      if (!current) return prev;
      // Cycle: score → stay → base+1 → base+2 → score...
      const g = battingGame ?? fieldingGame!;
      const runner = g.runners.find((r) => r.playerId === playerId);
      if (!runner) return prev;
      const maxAdv = pendingAdvanceResult === "2B" ? 2 : 1;
      const baseAfter1 = runner.base + 1 >= 4 ? "score" as const : (runner.base + 1) as 2 | 3;
      const baseAfter2 = runner.base + 2 >= 4 ? "score" as const : (runner.base + 2) as 2 | 3;
      if (current === "score") return { ...prev, [playerId]: "stay" as const };
      if (current === "stay") return { ...prev, [playerId]: maxAdv >= 2 ? baseAfter1 : "score" as const };
      if (current === runner.base + 1) return { ...prev, [playerId]: maxAdv >= 2 ? baseAfter2 : "score" as const };
      return { ...prev, [playerId]: "score" as const };
    });
  }

  function confirmAdvancement() {
    setShowAdvancePicker(false);
    const result = pendingAdvanceResult;
    const fielder = pendingAdvanceFielderRef.current;
    if (!result) return;
    setPendingAdvanceResult(null);
    pendingAdvanceFielderRef.current = null;

    // ROE with runners: use custom handler
    if (result === "ROE") {
      applyROEError("fielding", fielder);
      return;
    }
    // 1B/2B: standard hit advancement (below)
    if (result !== "1B" && result !== "2B") return;

    const g = (battingGame ?? fieldingGame)!;
    const { lineup, currentBatterIndex, currentInning, halfInning, outs, defense, currentPitcherId, statLines } = g;

    // Build custom runnersAfter from user choices
    const after: Array<{ playerId: string; base: 1 | 2 | 3 }> = [];
    let runs = 0;
    for (const r of g.runners) {
      const target = runnerTargets[r.playerId];
      if (target === "score") runs++;
      else if (target === "stay") after.push(r);
      else after.push({ playerId: r.playerId, base: target });
    }
    const batterBase = result === "2B" ? 2 : 1;
    const batterId = lineup[currentBatterIndex] ?? "__BATTER__";
    const resolvedAfter = after.map((r) =>
      r.playerId === "__BATTER__" ? { playerId: batterId, base: r.base } : r);
    after.push({ playerId: "__BATTER__", base: batterBase as 1 | 2 });

    // Build custom PA
    const pa: PlateAppearance = {
      id: nextLocalId("pa"),
      batterId,
      result,
      runsScored: runs,
      rbi: runs,
      runnersBefore: [...g.runners],
      runnersAfter: after.map((r) =>
        r.playerId === "__BATTER__" ? { playerId: batterId, base: r.base } : r as { playerId: string; base: 1 | 2 | 3 }),
      outsBefore: outs,
      outsAfter: outs,
      inning: currentInning,
      fielderPosition: fielder,
    };

    // Derive stats
    const sl = deriveStatsFromPA(pa, statLines);
    let updatedStatLines = distributeFieldingStats(pa, defense, sl, fielder ?? null);

    // Pitching stats
    if (currentPitcherId) {
      const ps = { ...(updatedStatLines[currentPitcherId] ?? { playerId: currentPitcherId, pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, r: 0, sb: 0, cs: 0, bb: 0, hbp: 0, sf: 0, so: 0, ipOuts: 0, er: 0, soPitching: 0, bbPitching: 0, hPitching: 0, po: 0, a: 0, e: 0, w: 0, l: 0, sv: 0, np: 0 }) };
      ps.hPitching++;
      ps.er += runs;
      updatedStatLines = { ...updatedStatLines, [currentPitcherId]: ps };
    }

    // Update inning
    const updatedInnings = g.innings.map((inn) =>
      inn.inning !== currentInning ? inn : { ...inn, plateAppearances: [...inn.plateAppearances, pa] });

    // Advance batter
    let nextBatterIndex = currentBatterIndex;
    if (result !== "2B" && result !== "1B") {} else {
      nextBatterIndex = (currentBatterIndex + 1) % 9;
      let attempts = 0;
      while (!lineup[nextBatterIndex] && attempts < 9) { nextBatterIndex = (nextBatterIndex + 1) % 9; attempts++; }
    }

    // Update score
    let scoreTop = g.scoreTop, scoreBottom = g.scoreBottom;
    if (halfInning === "top") scoreTop += runs; else scoreBottom += runs;

    const updated: ScoreboardGame = {
      ...g, statLines: updatedStatLines, innings: updatedInnings,
      currentBatterIndex: nextBatterIndex, runners: resolvedAfter,
      scoreTop, scoreBottom,
    };

    if (shouldEndHalfInning(updated)) {
      const ended = endHalfInning(updated);
      if (battingGame) onUpdateBatting(ended);
      else onUpdateFielding(ended);
    } else {
      if (battingGame) onUpdateBatting(updated);
      else onUpdateFielding(updated);
    }

    setTotalPitches((t) => t + 1);
    resetCount();
  }

  function handleErrorType(type: "fielding" | "throwing") {
    setShowErrorTypePicker(false);
    const g = battingGame ?? fieldingGame!;
    const fielder = pendingROEFielder;
    setPendingROEFielder(null);
    pendingROEResultRef.current = null;

    // If runners on base, show advancement picker
    if (g.runners.length > 0) {
      // Pre-set all runners to advance 1 base (error typically advances everyone)
      const targets: Record<string, "score" | "stay" | 2 | 3> = {};
      for (const r of g.runners) {
        const targetBase = r.base + 1;
        targets[r.playerId] = targetBase >= 4 ? "score" : targetBase as 2 | 3;
      }
      setRunnerTargets(targets);
      setPendingAdvanceResult("ROE");
      pendingAdvanceFielderRef.current = fielder;
      setShowAdvancePicker(true);
      return;
    }

    // No runners: apply directly
    applyROEError(type, fielder);
  }

  function applyROEError(type: "fielding" | "throwing", fielder: PositionCode | null) {
    const g = battingGame ?? fieldingGame!;
    const batterId = g.lineup[g.currentBatterIndex] ?? "__BATTER__";
    const pa: PlateAppearance = {
      id: nextLocalId("pa"),
      batterId,
      result: "ROE",
      runsScored: 0, rbi: 0,
      runnersBefore: [...g.runners],
      runnersAfter: [...g.runners.map((r) => ({ playerId: r.playerId, base: r.base as 1 | 2 | 3 })), { playerId: batterId, base: 1 }],
      outsBefore: g.outs, outsAfter: g.outs,
      inning: g.currentInning,
      fielderPosition: fielder,
      errorType: type,
      isUnearned: true,
    };
    const sl = deriveStatsFromPA(pa, g.statLines);
    const statLines2 = distributeFieldingStats(pa, g.defense, sl, fielder);
    const innings2 = g.innings.map((inn) =>
      inn.inning !== g.currentInning ? inn : { ...inn, plateAppearances: [...inn.plateAppearances, pa] });
    const nextIdx2 = (g.currentBatterIndex + 1) % 9;
    const upd: ScoreboardGame = { ...g, statLines: statLines2, innings: innings2, currentBatterIndex: nextIdx2 };
    if (battingGame) onUpdateBatting(upd);
    else onUpdateFielding(upd);
    setTotalPitches((t) => t + 1);
    resetCount();
  }

  function handleOpponentError() {
    const g = fieldingGame!;
    setTotalPitches((t) => t + 1);
    // Generic opponent ROE: batter reaches 1B, no specific fielder credited
    const batterId = g.lineup[g.currentBatterIndex] ?? "__BATTER__";
    const pa: PlateAppearance = {
      id: nextLocalId("pa"),
      batterId,
      result: "ROE",
      runsScored: 0, rbi: 0,
      runnersBefore: [...g.runners],
      runnersAfter: [...g.runners.map((r) => ({ playerId: r.playerId, base: r.base as 1 | 2 | 3 })), { playerId: batterId, base: 1 }],
      outsBefore: g.outs, outsAfter: g.outs,
      inning: g.currentInning,
      fielderPosition: null,
      isUnearned: true,
    };
    const sl = deriveStatsFromPA(pa, g.statLines);
    const innings2 = g.innings.map((inn) =>
      inn.inning !== g.currentInning ? inn : { ...inn, plateAppearances: [...inn.plateAppearances, pa] });
    const nextIdx2 = (g.currentBatterIndex + 1) % 9;
    const upd: ScoreboardGame = { ...g, statLines: sl, innings: innings2, currentBatterIndex: nextIdx2 };
    onUpdateFielding(upd);
    resetCount();
  }

  function handlePBChoice(isBall: boolean) {
    setShowPBChooser(false);
    if (isBall) {
      setBalls((b) => Math.min(b + 1, 4));
    } else {
      setStrikes((s) => Math.min(s + 1, 3));
    }
    setTotalPitches((t) => t + 1);
    // Credit PB to current catcher
    if (fieldingGame) {
      const catcherId = fieldingGame.defense["C"];
      if (catcherId) {
        const sl = fieldingGame.statLines[catcherId] ?? { playerId: catcherId, pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, r: 0, sb: 0, cs: 0, bb: 0, hbp: 0, sf: 0, so: 0, ipOuts: 0, er: 0, soPitching: 0, bbPitching: 0, hPitching: 0, po: 0, a: 0, e: 0, w: 0, l: 0, sv: 0, np: 0, pb: 0 };
        const g = { ...fieldingGame, statLines: { ...fieldingGame.statLines, [catcherId]: { ...sl, pb: (sl.pb ?? 0) + 1 } } };
        onUpdateFielding(g);
      }
    }
    processResult("PB", null);
  }

  function handleUncaught3K(action: "swing" | "noswing" | "caught" | "safe") {
    setShowUncaught3K(false);
    if (action === "noswing") {
      // Didn't swing — normal WP/PB, counts as a ball
      setBalls((b) => Math.min(b + 1, 4));
      setTotalPitches((t) => t + 1);
      // Credit PB to catcher
      if (pendingUncaughtResultRef.current === "PB" && fieldingGame) {
        const catcherId = fieldingGame?.defense["C"];
        if (catcherId) {
          const sl = fieldingGame.statLines[catcherId] ?? { playerId: catcherId, pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, r: 0, sb: 0, cs: 0, bb: 0, hbp: 0, sf: 0, so: 0, ipOuts: 0, er: 0, soPitching: 0, bbPitching: 0, hPitching: 0, po: 0, a: 0, e: 0, w: 0, l: 0, sv: 0, np: 0, pb: 0 };
          const g = { ...fieldingGame, statLines: { ...fieldingGame.statLines, [catcherId]: { ...sl, pb: (sl.pb ?? 0) + 1 } } };
          onUpdateFielding(g);
        }
      }
      processResult(pendingUncaughtResultRef.current, null);
      return;
    }
    if (action === "swing") return; // sub-dialog handles this

    // action is "caught" or "safe"
    const g = fieldingGame!;
    // Count as a strikeout
    setTotalPitches((t) => t + 1);
    if (action === "caught") {
      // K: batter out, +1 out
      const pa: PlateAppearance = {
        id: nextLocalId("pa"),
        batterId: g.lineup[g.currentBatterIndex] ?? "__BATTER__",
        result: "SO",
        runsScored: 0, rbi: 0,
        runnersBefore: [...g.runners],
        runnersAfter: g.runners.map((r) => ({ playerId: r.playerId, base: r.base as 1 | 2 | 3 })),
        outsBefore: g.outs,
        outsAfter: Math.min(g.outs + 1, 3),
        inning: g.currentInning,
        fielderPosition: null,
      };
      const sl2 = deriveStatsFromPA(pa, g.statLines);
      const statLines2 = distributeFieldingStats(pa, g.defense, sl2, null);
      const innings2 = g.innings.map((inn) =>
        inn.inning !== g.currentInning ? inn : { ...inn, plateAppearances: [...inn.plateAppearances, pa] });
      const nextIdx2 = (g.currentBatterIndex + 1) % 9;
      const upd2: ScoreboardGame = { ...g, outs: pa.outsAfter, statLines: statLines2, innings: innings2, currentBatterIndex: nextIdx2 };
      if (shouldEndHalfInning(upd2)) {
        const ended = endHalfInning(upd2);
        onUpdateFielding(ended);
      } else {
        onUpdateFielding(upd2);
      }
      resetCount();
      return;
    }
    // "safe": K + WP, batter to 1B
    const batterId = g.lineup[g.currentBatterIndex] ?? "__BATTER__";
    const pa: PlateAppearance = {
      id: nextLocalId("pa"),
      batterId,
      result: "SO", // counts as SO for stats
      runsScored: 0, rbi: 0,
      runnersBefore: [...g.runners],
      runnersAfter: [...g.runners.map((r) => ({ playerId: r.playerId, base: r.base as 1 | 2 | 3 })), { playerId: batterId, base: 1 }],
      outsBefore: g.outs,
      outsAfter: g.outs,
      inning: g.currentInning,
      fielderPosition: null,
    };
    const statLines2 = deriveStatsFromPA(pa, g.statLines);
    const innings2 = g.innings.map((inn) =>
      inn.inning !== g.currentInning ? inn : { ...inn, plateAppearances: [...inn.plateAppearances, pa] });
    const nextIdx2 = (g.currentBatterIndex + 1) % 9;
    const upd2: ScoreboardGame = { ...g, statLines: statLines2, innings: innings2, currentBatterIndex: nextIdx2, runners: [...g.runners, { playerId: batterId, base: 1 }] };
    // Also record WP for the pitcher
    if (g.currentPitcherId) {
      const ps = { ...upd2.statLines[g.currentPitcherId], np: (upd2.statLines[g.currentPitcherId]?.np ?? 0) + 1 };
      upd2.statLines = { ...upd2.statLines, [g.currentPitcherId]: ps };
    }
    onUpdateFielding(upd2);
    setTotalPitches((t) => t + 1);
    resetCount();
  }

  function handleFCRunnerPick(playerId: string) {
    setShowFCRunnerPicker(false);
    const result = pendingFCResultRef.current;
    const fielder = pendingFCFielderRef.current;
    if (!result) return;
    pendingFCResultRef.current = null;
    pendingFCFielderRef.current = null;

    const g = battingGame ?? fieldingGame!;
    // Move the selected runner to the front so FC engine removes them
    const runners = [...g.runners];
    const idx = runners.findIndex((r) => r.playerId === playerId);
    if (idx > 0) {
      const [target] = runners.splice(idx, 1);
      runners.unshift(target);
    }
    const tempGame = { ...g, runners };
    const updated = recordPlateAppearance(tempGame, result, fielder, isOpponentBatting);
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

  // ── Controls ──

  function handleBall() {
    if (balls >= 4) return;
    setBalls((b) => b + 1);
    setTotalPitches((t) => t + 1);
    // BB trigger when balls reaches 4 — moved out of useEffect to avoid
    // setState-in-effect and "handleResult accessed before declared".
    if (balls + 1 >= 4 && fieldingGame && isActive && !showFieldPicker) {
      handleResult("BB");
    }
  }
  function handleStrike() {
    if (strikes >= 3) return;
    setStrikes((s) => s + 1);
    setTotalPitches((t) => t + 1);
    // SO trigger when strikes reaches 3 — see handleBall for rationale.
    if (strikes + 1 >= 3 && fieldingGame && isActive && !showFieldPicker) {
      handleResult("SO");
    }
  }
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
    if (fieldingGame) {
      onUpdateFielding(changePitcher(fieldingGame, playerId, totalPitches));
      resetCount();
    }
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

  // ── Post-game stats summary (when game is over / in review) ──

  function renderGameStats() {
    if (isActive) return null;
    const g = battingGame ?? fieldingGame;
    if (!g || g.innings.length === 0) return null;
    const allStatLines = Object.values(g.statLines).filter(
      (sl) => sl.pa > 0 || sl.ipOuts > 0 || sl.po > 0 || sl.a > 0 || sl.e > 0,
    );
    if (allStatLines.length === 0) return null;

    const battingStats = allStatLines.filter((sl) => sl.pa > 0).sort((a, b) => b.pa - a.pa);
    const pitchingStats = allStatLines.filter((sl) => sl.ipOuts > 0 || sl.soPitching > 0 || sl.bbPitching > 0).sort((a, b) => b.ipOuts - a.ipOuts);
    const fieldingStats = allStatLines.filter((sl) => sl.po > 0 || sl.a > 0 || sl.e > 0).sort((a, b) => b.po - a.po);

    return (
      <div className={styles.statsSummary}>
        {battingStats.length > 0 && (
          <>
            <div className={styles.statsSectionTitle}>打击数据</div>
            <table className={styles.statsTable}>
              <thead><tr><th>球员</th><th>PA</th><th>AB</th><th>H</th><th>HR</th><th>RBI</th><th>R</th><th>BB</th><th>SO</th><th>SB</th></tr></thead>
              <tbody>
                {battingStats.map((sl) => {
                  const p = workspace.players.find((x) => x.id === sl.playerId);
                  return (
                    <tr key={sl.playerId}>
                      <td>{p ? `${p.name} #${p.number}` : sl.playerId}</td>
                      <td>{sl.pa}</td><td>{sl.ab}</td><td>{sl.h}</td><td>{sl.hr || "-"}</td>
                      <td>{sl.rbi || "-"}</td><td>{sl.r || "-"}</td><td>{sl.bb || "-"}</td><td>{sl.so || "-"}</td><td>{sl.sb || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        {pitchingStats.length > 0 && (
          <>
            <div className={styles.statsSectionTitle}>投球数据</div>
            <table className={styles.statsTable}>
              <thead><tr><th>球员</th><th>IP</th><th>ER</th><th>SO</th><th>BB</th><th>H</th><th>NP</th></tr></thead>
              <tbody>
                {pitchingStats.map((sl) => {
                  const p = workspace.players.find((x) => x.id === sl.playerId);
                  const ip = sl.ipOuts > 0 ? `${Math.floor(sl.ipOuts / 3)}.${sl.ipOuts % 3}` : "-";
                  return (
                    <tr key={sl.playerId}>
                      <td>{p ? `${p.name} #${p.number}` : sl.playerId}</td>
                      <td>{ip}</td><td>{sl.er || "-"}</td><td>{sl.soPitching || "-"}</td>
                      <td>{sl.bbPitching || "-"}</td><td>{sl.hPitching || "-"}</td><td>{sl.np || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        {fieldingStats.length > 0 && (
          <>
            <div className={styles.statsSectionTitle}>守备数据</div>
            <table className={styles.statsTable}>
              <thead><tr><th>球员</th><th>PO</th><th>A</th><th>E</th><th>PB</th></tr></thead>
              <tbody>
                {fieldingStats.map((sl) => {
                  const p = workspace.players.find((x) => x.id === sl.playerId);
                  return (
                    <tr key={sl.playerId}>
                      <td>{p ? `${p.name} #${p.number}` : sl.playerId}</td>
                      <td>{sl.po || "-"}</td><td>{sl.a || "-"}</td><td>{sl.e || "-"}</td><td>{sl.pb || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    );
  }

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
                <OpponentBaseDiamond runners={fieldingGame?.runners ?? []} />
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

              {/* Special defensive events: WP, SB, CS */}
              {(fieldingGame?.runners?.length ?? 0) > 0 && (
                <div className={styles.stealRow}>
                  <button type="button" className={styles.btnSteal}
                    disabled={!isActive} onClick={() => handleResult("SB")}>
                    🏃 对手盗垒
                  </button>
                  <button type="button" className={styles.btnStealFail}
                    disabled={!isActive} onClick={() => handleResult("CS")}>
                    ❌ 对手盗垒失败
                  </button>
                </div>
              )}
              <div className={styles.stealRow}>
                <button type="button" className={styles.btnWildPitch}
                  disabled={!isActive} onClick={() => handleResult("WP")}>
                  💥 暴投
                </button>
                <button type="button" className={styles.btnPassedBall}
                  disabled={!isActive} onClick={() => handleResult("PB")}>
                  🧤 捕逸
                </button>
                <button type="button" className={styles.btnStealFail}
                  disabled={!isActive} onClick={handleOpponentError}>
                  ❌ 对方失误
                </button>
              </div>
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

              {/* Current pitcher cumulative stats */}
              {fieldingGame?.currentPitcherId && fieldingGame.statLines[fieldingGame.currentPitcherId] && (
                <div className={styles.pitcherStats}>
                  <div className={styles.pitcherStat}>
                    <span className={styles.pitcherStatLabel}>夺三振</span>
                    <span className={styles.pitcherStatValue}>{fieldingGame.statLines[fieldingGame.currentPitcherId].soPitching}</span>
                  </div>
                  <div className={styles.pitcherStat}>
                    <span className={styles.pitcherStatLabel}>四坏</span>
                    <span className={styles.pitcherStatValue}>{fieldingGame.statLines[fieldingGame.currentPitcherId].bbPitching}</span>
                  </div>
                  <div className={styles.pitcherStat}>
                    <span className={styles.pitcherStatLabel}>被安打</span>
                    <span className={styles.pitcherStatValue}>{fieldingGame.statLines[fieldingGame.currentPitcherId].hPitching}</span>
                  </div>
                  <div className={styles.pitcherStat}>
                    <span className={styles.pitcherStatLabel}>自责分</span>
                    <span className={styles.pitcherStatValue}>{fieldingGame.statLines[fieldingGame.currentPitcherId].er}</span>
                  </div>
                </div>
              )}

              {/* Fielding stats panel */}
              {fieldingGame && (
                <div className={styles.fieldingPanel}>
                  <div className={styles.fieldingPanelTitle}>守备数据</div>
                  {(["P","C","1B","2B","3B","SS","LF","CF","RF"] as const).map((pos) => {
                    const pid = fieldingGame.defense[pos];
                    if (!pid) return null;
                    const sl = fieldingGame.statLines[pid];
                    const p = workspace.players.find((x) => x.id === pid);
                    const po = sl?.po ?? 0; const a = sl?.a ?? 0; const e = sl?.e ?? 0; const pb = sl?.pb ?? 0;
                    if (po === 0 && a === 0 && e === 0 && pb === 0) return null;
                    return (
                      <div key={pos} className={styles.fieldingLine}>
                        <span className={styles.fieldingLineName}>{pos} {p?.name ?? pid}</span>
                        <span className={styles.fieldingLineStats}>
                          <span className={styles.fieldingLineStat}>PO <span>{po}</span></span>
                          <span className={styles.fieldingLineStat}>A <span>{a}</span></span>
                          <span className={styles.fieldingLineStat}>E <span>{e}</span></span>
                          {pb > 0 && <span className={styles.fieldingLineStat}>PB <span>{pb}</span></span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

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

      {/* ═══ Post-game stats ═══ */}
      {renderGameStats()}

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


      {/* ── ROE error type picker ── */}
      {showErrorTypePicker && (
        <div className={styles.runOverlay}>
          <div className={styles.runDialog} style={{ minWidth: 260 }}>
            <p className={styles.runQuestion}>野手失误 — 失误类型</p>
            <p style={{ fontSize: 11, color: "var(--theme-muted)", marginTop: -4, marginBottom: 10 }}>
              已选位置：{pendingROEFielder ?? "—"}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className={styles.uncaughtBtn}
                onClick={() => handleErrorType("fielding")}>
                👐 接球失误
              </button>
              <button type="button" className={styles.btnWildPitch}
                onClick={() => handleErrorType("throwing")}>
                🎯 传球失误
              </button>
            </div>
            <p style={{ fontSize: 10, color: "var(--theme-muted)", marginTop: 6 }}>
              接球=漏接/掉球 · 传球=传偏/暴传
            </p>
            <button type="button" className={styles.btnSecondary}
              onClick={() => { setShowErrorTypePicker(false); pendingROEResultRef.current = null; }} style={{ marginTop: 6 }}>取消</button>
          </div>
        </div>
      )}

      {/* ── PB ball/strike chooser ── */}
      {showPBChooser && (
        <div className={styles.runOverlay}>
          <div className={styles.runDialog} style={{ minWidth: 240 }}>
            <p className={styles.runQuestion}>🧤 捕逸 — 好球还是坏球？</p>
            <p style={{ fontSize: 11, color: "var(--theme-muted)", marginTop: -4, marginBottom: 10 }}>
              当前 {balls}B-{strikes}S · 选择这次漏接的球种
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className={styles.uncaughtBtn}
                onClick={() => handlePBChoice(false)}>
                🟢 好球
              </button>
              <button type="button" className={styles.btnPassedBall}
                onClick={() => handlePBChoice(true)}>
                🔴 坏球
              </button>
            </div>
            <button type="button" className={styles.btnSecondary}
              onClick={() => setShowPBChooser(false)} style={{ marginTop: 8 }}>取消</button>
          </div>
        </div>
      )}

      {/* ── Uncaught third strike dialog ── */}
      {showUncaught3K && (
        <div className={styles.runOverlay}>
          <div className={styles.runDialog} style={{ minWidth: 280 }}>
            <p className={styles.runQuestion}>⚡ 2好球暴投/捕逸 — 不死三振判定</p>
            <p style={{ fontSize: 11, color: "var(--theme-muted)", marginTop: -4, marginBottom: 10 }}>
              打者是否挥棒？一垒{fieldingGame?.runners.some(r => r.base === 1) ? "有人" : "无人"} · 出局 {fieldingGame?.outs ?? 0}/2
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button type="button" className={styles.uncaughtBtn}
                onClick={() => handleUncaught3K("swing")}>
                🏏 挥棒了 → 不死三振
              </button>
              <button type="button" className={styles.btnSecondary}
                onClick={() => handleUncaught3K("noswing")}>
                ✋ 没挥棒 → 正常暴投（坏球）
              </button>
            </div>
            {/* Sub-options after swing */}
            <div style={{ marginTop: 10, borderTop: "1px solid var(--theme-border)", paddingTop: 10 }}>
              <p style={{ fontSize: 11, color: "var(--theme-muted)", marginBottom: 6 }}>挥棒后 — 选择结果：</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className={styles.btnSteal}
                  onClick={() => handleUncaught3K("caught")}>
                  🧤 捕手接稳 / 传一垒（出局）
                </button>
                <button type="button" className={styles.btnWildPitch}
                  onClick={() => handleUncaught3K("safe")}>
                  💥 暴投上垒（安全）
                </button>
              </div>
            </div>
            <button type="button" className={styles.btnSecondary}
              onClick={() => setShowUncaught3K(false)} style={{ marginTop: 8 }}>取消</button>
          </div>
        </div>
      )}

      {/* ── Runner advancement picker (1B/2B with runners on) ── */}
      {showAdvancePicker && (
        <div className={styles.runOverlay}>
          <div className={styles.runDialog} style={{ minWidth: 320 }}>
            <p className={styles.runQuestion}>
              {pendingAdvanceResult === "2B" ? "二垒安打" : "一垒安打"} — 跑者推进
            </p>
            <p style={{ fontSize: 11, color: "var(--theme-muted)", marginTop: -4, marginBottom: 8 }}>
              点击每个跑者切换：得分 → 停留 → 进一垒 → 进二垒
            </p>
            <div className={styles.stealRunnerList}>
              {(battingGame ?? fieldingGame)!.runners.map((r) => {
                const p = workspace.players.find((pl) => pl.id === r.playerId);
                const target = runnerTargets[r.playerId];
                const label = target === "score" ? "⚾ 得分" : target === "stay" ? "🛑 停留" : `▶ 进${target}垒`;
                const baseLabel = { 1: "一垒", 2: "二垒", 3: "三垒" }[r.base];
                return (
                  <button
                    key={r.playerId}
                    type="button"
                    className={`${styles.stealRunnerBtn} ${target === "score" ? styles.advanceScore : target === "stay" ? styles.advanceStay : ""}`}
                    onClick={() => toggleRunnerTarget(r.playerId)}
                  >
                    <span className={styles.stealRunnerBase}>{baseLabel}</span>
                    {p ? <><strong>#{p.number}</strong> {p.name}</> : r.playerId}
                    <span className={styles.advanceLabel}>{label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className={styles.btnPrimary} onClick={confirmAdvancement}>确认</button>
              <button type="button" className={styles.btnSecondary}
                onClick={() => { setShowAdvancePicker(false); setPendingAdvanceResult(null); }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FC runner picker ── */}
      {showFCRunnerPicker && (
        <div className={styles.runOverlay}>
          <div className={styles.runDialog}>
            <p className={styles.runQuestion}>野手选择杀了哪个跑者？</p>
            <div className={styles.stealRunnerList}>
              {(battingGame ?? fieldingGame)!.runners.map((r) => {
                const p = workspace.players.find((pl) => pl.id === r.playerId);
                const baseLabel = { 1: "一垒", 2: "二垒", 3: "三垒" }[r.base];
                return (
                  <button
                    key={r.playerId}
                    type="button"
                    className={styles.stealRunnerBtn}
                    onClick={() => handleFCRunnerPick(r.playerId)}
                  >
                    <span className={styles.stealRunnerBase}>{baseLabel}</span>
                    {p ? <><strong>#{p.number}</strong> {p.name}</> : r.playerId}
                  </button>
                );
              })}
            </div>
            <button type="button" className={styles.btnSecondary}
              onClick={() => { setShowFCRunnerPicker(false); pendingFCResultRef.current = null; }}>取消</button>
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
