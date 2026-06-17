/**
 * Scoreboard actions: PA result → stat derivation engine,
 * runner advancement logic, and ScoreboardGame → Game finalization.
 *
 * All functions are pure — they take state and return new state.
 */

import type { Game, InningRecord, PlayerGameStatLine, PositionCode, Scenario, Workspace } from "./workspace";
import { createId } from "./workspace";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Result of a single plate appearance — the 14 primary outcomes. */
export type PAResult =
  | "1B" | "2B" | "3B" | "HR"     // hits
  | "BB" | "HBP"                    // walks / hit by pitch
  | "SO"                            // strikeout
  | "GO" | "FO" | "LO"             // ground out / fly out / line out
  | "DP"                            // double play
  | "SF" | "SAC"                    // sacrifice fly / sacrifice bunt
  | "ROE"                           // reached on error
  | "FC"                            // fielder's choice
  | "SB" | "CS"                    // stolen base / caught stealing
  | "WP"                            // wild pitch (pitcher's fault, all runners advance 1)
  | "PB";                           // passed ball (catcher's fault, all runners advance 1)

/** Phase of the scoreboard workflow. */
export type ScoreboardPhase = "setup" | "recording" | "review";

/** Game metadata set during setup. */
export type GameSetup = {
  date: string;
  opponent: string;
  gameType: "official" | "training";
  totalInnings: number;
  /** Optional time limit in minutes. When set, a countdown timer runs and expires at 0. */
  timeLimitMinutes?: number;
};

/** Runner position on a base. */
export type RunnerState = {
  playerId: string;
  base: 1 | 2 | 3;
};

/** A single recorded plate appearance. */
export type PlateAppearance = {
  id: string;
  batterId: string;
  result: PAResult;
  runsScored: number;         // total team runs scored on this play
  rbi: number;                // RBI credited to the batter
  runnersBefore: RunnerState[];
  runnersAfter: RunnerState[];
  outsBefore: number;
  outsAfter: number;
  inning: number;
  /** Which defensive position fielded the ball (for GO/FO/LO/DP/SF/ROE/FC). */
  fielderPosition?: PositionCode | null;
  /** For ROE: type of error committed. */
  errorType?: "fielding" | "throwing";
  /** Whether the batter reached on an error (marks run as unearned for pitcher ERA). */
  isUnearned?: boolean;
};

/** Pitcher change record. */
export type PitcherChange = {
  inning: number;
  outsRecorded: number;   // total team outs recorded at time of change
  newPitcherId: string;
};

/** Per-inning live data. */
export type LiveInning = {
  inning: number;
  plateAppearances: PlateAppearance[];
};

/** Live stat line accumulated during recording. */
export type LiveStatLine = {
  playerId: string;
  pa: number; ab: number; h: number;
  doubles: number; triples: number; hr: number;
  rbi: number; r: number; sb: number; cs: number;
  bb: number; hbp: number; sf: number; so: number;
  // Pitching — tracked as raw outs for precision
  ipOuts: number;           // outs recorded by this pitcher
  er: number;
  soPitching: number;
  bbPitching: number;
  hPitching: number;
  // Fielding
  po: number; a: number; e: number;
  pb: number;  // passed balls
  // Decisions
  w: number; l: number; sv: number;
  np: number;
};

/** Full live scoreboard state (not persisted to workspace). */
export type ScoreboardGame = {
  setup: GameSetup;
  scenarioId: string;
  // Team composition
  defense: Record<PositionCode, string | null>;
  lineup: Array<string | null>;
  bench: string[];
  // Live recording state
  innings: LiveInning[];
  currentInning: number;
  currentBatterIndex: number;
  halfInning: "top" | "bottom";
  outs: number;
  runners: RunnerState[];
  currentPitcherId: string | null;
  pitcherChanges: PitcherChange[];
  statLines: Record<string, LiveStatLine>;
  phase: ScoreboardPhase;
  // Scores
  scoreTop: number;    // Team A runs (top half)
  scoreBottom: number; // Team B runs (bottom half)
};

export type TeamSetup = {
  defense: Record<PositionCode, string | null>;
  lineup: Array<string | null>;
  bench: string[];
};

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

const ALL_POSITIONS: PositionCode[] = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

function emptyLiveStatLine(playerId: string): LiveStatLine {
  return {
    playerId,
    pa: 0, ab: 0, h: 0,
    doubles: 0, triples: 0, hr: 0,
    rbi: 0, r: 0, sb: 0, cs: 0,
    bb: 0, hbp: 0, sf: 0, so: 0,
    ipOuts: 0, er: 0,
    soPitching: 0, bbPitching: 0, hPitching: 0,
    po: 0, a: 0, e: 0, pb: 0,
    w: 0, l: 0, sv: 0,
    np: 0,
  };
}

function ensureStatLine(
  statLines: Record<string, LiveStatLine>,
  playerId: string,
): Record<string, LiveStatLine> {
  if (statLines[playerId]) return statLines;
  return { ...statLines, [playerId]: emptyLiveStatLine(playerId) };
}

function outsToIpDisplay(outs: number): number {
  if (outs <= 0) return 0;
  const full = Math.floor(outs / 3);
  const rem = outs % 3;
  return full + rem * 0.1;
}

// ═══════════════════════════════════════════════════════════════
// 1. Initialize from scenario
// ═══════════════════════════════════════════════════════════════

/**
 * Derive defense, lineup, and bench from a workspace scenario.
 * Adds bench players from the roster who aren't already assigned.
 */
export function initializeFromScenario(
  workspace: Workspace,
  scenario: Scenario,
): TeamSetup {
  const defense: Record<PositionCode, string | null> = {} as Record<PositionCode, string | null>;
  for (const pos of ALL_POSITIONS) {
    defense[pos] = scenario.assignments.defense[pos] ?? null;
  }

  const lineup = [...scenario.assignments.lineup];

  const assignedIds = new Set([
    ...Object.values(defense).filter((id): id is string => id !== null),
    ...lineup.filter((id): id is string => id !== null),
  ]);

  const bench = workspace.players
    .filter((p) => !assignedIds.has(p.id) && p.status === "available")
    .map((p) => p.id);

  return { defense, lineup, bench };
}

// ═══════════════════════════════════════════════════════════════
// 2. Create a new ScoreboardGame
// ═══════════════════════════════════════════════════════════════

/**
 * Create a fresh ScoreboardGame. For dual mode, call this twice
 * with different team setups.
 */
export function createScoreboardGame(
  setup: GameSetup,
  scenarioId: string,
  team: TeamSetup,
  halfInning: "top" | "bottom" = "top",
): ScoreboardGame {
  const statLines: Record<string, LiveStatLine> = {};
  const allPlayerIds = new Set([
    ...Object.values(team.defense).filter((id): id is string => id !== null),
    ...team.lineup.filter((id): id is string => id !== null),
    ...team.bench,
  ]);
  for (const id of allPlayerIds) {
    statLines[id] = emptyLiveStatLine(id);
  }

  const startingPitcher = team.defense["P"];

  return {
    setup,
    scenarioId,
    defense: { ...team.defense },
    lineup: [...team.lineup],
    bench: [...team.bench],
    innings: [{ inning: 1, plateAppearances: [] }],
    currentInning: 1,
    currentBatterIndex: 0,
    halfInning,
    outs: 0,
    runners: [],
    currentPitcherId: startingPitcher,
    pitcherChanges: [],
    statLines,
    phase: "recording",
    scoreTop: 0,
    scoreBottom: 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// 3. Runner advancement engine
// ═══════════════════════════════════════════════════════════════

export function computeRunnerAdvancement(
  result: PAResult,
  runners: RunnerState[],
): {
  runnersAfter: RunnerState[];
  runsScored: number;
  batterRbi: number;
  batterEndBase: 0 | 1 | 2 | 3 | 4; // 0=out, 1-3=base, 4=home
} {
  // Sort runners by base: 3B, 2B, 1B
  const sorted = [...runners].sort((a, b) => b.base - a.base);
  const hasRunnerOn: Record<number, string | null> = { 1: null, 2: null, 3: null };
  for (const r of sorted) {
    hasRunnerOn[r.base] = r.playerId;
  }

  switch (result) {
    case "1B": {
      // All runners advance 1 base; batter to 1B
      let runs = 0;
      const after: RunnerState[] = [];
      for (const r of sorted) {
        if (r.base === 3) {
          runs++; // scores
        } else {
          after.push({ playerId: r.playerId, base: (r.base + 1) as 1 | 2 | 3 });
        }
      }
      after.push({ playerId: "__BATTER__", base: 1 });
      return { runnersAfter: after, runsScored: runs, batterRbi: runs, batterEndBase: 1 };
    }

    case "2B": {
      // All runners advance 2 bases; batter to 2B
      let runs = 0;
      const after: RunnerState[] = [];
      for (const r of sorted) {
        if (r.base >= 2) {
          runs++; // scores from 2B or 3B
        } else {
          after.push({ playerId: r.playerId, base: (r.base + 2) as 1 | 2 | 3 });
        }
      }
      after.push({ playerId: "__BATTER__", base: 2 });
      return { runnersAfter: after, runsScored: runs, batterRbi: runs, batterEndBase: 2 };
    }

    case "3B": {
      // All runners score; batter to 3B
      const runs = sorted.length;
      return {
        runnersAfter: [{ playerId: "__BATTER__", base: 3 }],
        runsScored: runs,
        batterRbi: runs,
        batterEndBase: 3,
      };
    }

    case "HR": {
      // All runners + batter score
      const runs = sorted.length + 1;
      return {
        runnersAfter: [],
        runsScored: runs,
        batterRbi: sorted.length + 1, // batter gets RBI for self + all runners
        batterEndBase: 4,
      };
    }

    case "BB":
    case "HBP": {
      // Runners advance only if forced
      let runs = 0;
      const after: RunnerState[] = [];
      // Force: runner on 1B → 2B, 2B → 3B if 1B occupied, 3B → home if bases loaded
      if (hasRunnerOn[1] && hasRunnerOn[2] && hasRunnerOn[3]) {
        // Bases loaded: all advance, 3B scores
        runs = 1;
        after.push({ playerId: hasRunnerOn[1]!, base: 2 });
        after.push({ playerId: hasRunnerOn[2]!, base: 3 });
      } else if (hasRunnerOn[1] && hasRunnerOn[2]) {
        after.push({ playerId: hasRunnerOn[1]!, base: 2 });
        after.push({ playerId: hasRunnerOn[2]!, base: 3 });
        if (hasRunnerOn[3]) after.push({ playerId: hasRunnerOn[3]!, base: 3 });
      } else if (hasRunnerOn[1]) {
        after.push({ playerId: hasRunnerOn[1]!, base: 2 });
        if (hasRunnerOn[2]) after.push({ playerId: hasRunnerOn[2]!, base: 2 });
        if (hasRunnerOn[3]) after.push({ playerId: hasRunnerOn[3]!, base: 3 });
      } else {
        // No runner on 1B, nobody forced
        for (const r of sorted) after.push(r);
      }
      after.push({ playerId: "__BATTER__", base: 1 });
      return { runnersAfter: after, runsScored: runs, batterRbi: runs, batterEndBase: 1 };
    }

    case "SO": {
      // No advancement
      return { runnersAfter: [...sorted], runsScored: 0, batterRbi: 0, batterEndBase: 0 };
    }

    case "GO": {
      // All runners advance 1 base; batter out at 1B
      let runs = 0;
      const after: RunnerState[] = [];
      for (const r of sorted) {
        if (r.base === 3) {
          runs++;
        } else {
          after.push({ playerId: r.playerId, base: (r.base + 1) as 1 | 2 | 3 });
        }
      }
      return { runnersAfter: after, runsScored: runs, batterRbi: runs, batterEndBase: 0 };
    }

    case "FO":
    case "LO": {
      // Runners hold; batter out
      return { runnersAfter: [...sorted], runsScored: 0, batterRbi: 0, batterEndBase: 0 };
    }

    case "DP": {
      // Double play: batter out + one force-eligible runner out.
      // Force-eligible = runner on a base where all bases behind are occupied.
      // Non-force runners stay put or may score (RBI credited if runner on 3B scores).
      const eliminated = new Set<string>();
      eliminated.add("__BATTER__");

      // Find the lead force-eligible runner to eliminate
      // A runner is force-eligible if all bases behind them are occupied
      let forceOutTarget: string | null = null;
      for (const r of sorted) {
        // Runner on 1B is always forced (batter is running to 1B)
        if (r.base === 1) { forceOutTarget = r.playerId; break; }
        // Runner on 2B is forced if 1B is occupied
        if (r.base === 2 && hasRunnerOn[1]) { forceOutTarget = r.playerId; break; }
        // Runner on 3B is forced if both 1B and 2B are occupied
        if (r.base === 3 && hasRunnerOn[1] && hasRunnerOn[2]) { forceOutTarget = r.playerId; break; }
      }
      if (forceOutTarget) eliminated.add(forceOutTarget);

      let runs = 0;
      const after: RunnerState[] = [];
      for (const r of sorted) {
        if (eliminated.has(r.playerId)) continue;
        // Non-eliminated runners: if they were on a force-eligible base, they advance 1.
        // Non-force runners stay put.
        const isForced =
          r.base === 1 ||
          (r.base === 2 && hasRunnerOn[1]) ||
          (r.base === 3 && hasRunnerOn[1] && hasRunnerOn[2]);
        if (isForced && r.base < 3) {
          after.push({ playerId: r.playerId, base: (r.base + 1) as 1 | 2 | 3 });
        } else if (r.base === 3 && isForced) {
          // Runner on 3B forced → scores
          runs++;
        } else {
          // Non-force runner stays
          after.push(r);
        }
      }

      // Runner on 3B that stays put can score on a DP if they run on contact
      // (scoring before the DP is completed)
      const runnerOn3Stayed = sorted.find((r) => r.base === 3 && !eliminated.has(r.playerId));
      if (runnerOn3Stayed && runs === 0) {
        // Runner on 3rd scores on the DP (run on contact), batter gets RBI
        runs = 1;
        // Don't add runner to after (they scored)
        const idx = after.findIndex((r) => r.playerId === runnerOn3Stayed.playerId);
        if (idx >= 0) after.splice(idx, 1);
      }

      return {
        runnersAfter: after,
        runsScored: runs,
        batterRbi: runs,
        batterEndBase: 0,
      };
    }

    case "SF": {
      // Runner on 3B scores; other runners hold; batter out
      let runs = 0;
      const after: RunnerState[] = [];
      for (const r of sorted) {
        if (r.base === 3) {
          runs++;
          // 3B runner scores
        } else {
          after.push(r);
        }
      }
      return { runnersAfter: after, runsScored: runs, batterRbi: runs, batterEndBase: 0 };
    }

    case "SAC": {
      // All runners advance 1; batter out
      let runs = 0;
      const after: RunnerState[] = [];
      for (const r of sorted) {
        if (r.base === 3) {
          runs++;
        } else {
          after.push({ playerId: r.playerId, base: (r.base + 1) as 1 | 2 | 3 });
        }
      }
      return { runnersAfter: after, runsScored: runs, batterRbi: runs > 0 ? runs : 0, batterEndBase: 0 };
    }

    case "ROE": {
      // All runners advance 1; batter safe at 1B; no RBI (simplified)
      const after: RunnerState[] = [];
      for (const r of sorted) {
        if (r.base === 3) {
          // Scores on error — no RBI
        } else {
          after.push({ playerId: r.playerId, base: (r.base + 1) as 1 | 2 | 3 });
        }
      }
      after.push({ playerId: "__BATTER__", base: 1 });
      const runs = sorted.filter((r) => r.base === 3).length;
      return { runnersAfter: after, runsScored: runs, batterRbi: 0, batterEndBase: 1 };
    }

    case "FC": {
      // Simplified: eliminate the lead force runner, batter safe at 1B
      const eliminated = new Set<string>();
      const after: RunnerState[] = [];
      let eliminatedOne = false;
      for (const r of sorted) {
        const isForced = r.base === 1 || (r.base === 2 && hasRunnerOn[1]) || (r.base === 3 && hasRunnerOn[1] && hasRunnerOn[2]);
        if (isForced && !eliminatedOne) {
          eliminated.add(r.playerId);
          eliminatedOne = true;
          continue;
        }
        if (isForced && eliminatedOne) {
          after.push({ playerId: r.playerId, base: Math.min(r.base + 1, 3) as 1 | 2 | 3 });
        } else {
          after.push(r);
        }
      }
      after.push({ playerId: "__BATTER__", base: 1 });
      return { runnersAfter: after, runsScored: 0, batterRbi: 0, batterEndBase: 1 };
    }

    case "SB": {
      // Stolen base: lead runner advances 1 base
      if (sorted.length === 0) return { runnersAfter: [], runsScored: 0, batterRbi: 0, batterEndBase: 0 };
      const stealer = sorted[0]; // lead runner
      const after: RunnerState[] = [];
      let runs = 0;
      for (const r of sorted) {
        if (r.playerId === stealer.playerId) {
          if (r.base === 3) runs++; // steal home
          else after.push({ playerId: r.playerId, base: (r.base + 1) as 1 | 2 | 3 });
        } else {
          after.push(r);
        }
      }
      return { runnersAfter: after, runsScored: runs, batterRbi: 0, batterEndBase: 0 };
    }

    case "CS": {
      // Caught stealing: lead runner is out, +1 out
      if (sorted.length === 0) return { runnersAfter: [], runsScored: 0, batterRbi: 0, batterEndBase: 0 };
      const after = sorted.slice(1); // remove lead runner
      return { runnersAfter: after, runsScored: 0, batterRbi: 0, batterEndBase: 0 };
    }

    case "PB":  // falls through — same advancement as WP
    case "WP": {
      // Wild pitch / passed ball: ALL runners advance 1 base, runner on 3rd scores
      let runs = 0;
      const after: RunnerState[] = [];
      for (const r of sorted) {
        if (r.base === 3) {
          runs++;
        } else {
          after.push({ playerId: r.playerId, base: (r.base + 1) as 1 | 2 | 3 });
        }
      }
      return { runnersAfter: after, runsScored: runs, batterRbi: 0, batterEndBase: 0 };
    }

    case "FC": {
      // Fielder's choice: lead runner is out, other runners advance, batter to 1B
      if (sorted.length === 0) return { runnersAfter: [{ playerId: "__BATTER__", base: 1 }], runsScored: 0, batterRbi: 0, batterEndBase: 1 };
      let runs = 0;
      const after: RunnerState[] = [];
      const [, ...rest] = sorted; // lead runner removed (forced out)
      for (const r of rest) {
        if (r.base === 3) {
          runs++;
        } else {
          after.push({ playerId: r.playerId, base: (r.base + 1) as 1 | 2 | 3 });
        }
      }
      after.push({ playerId: "__BATTER__", base: 1 });
      return { runnersAfter: after, runsScored: runs, batterRbi: 0, batterEndBase: 1 };
    }
}
}

// ═══════════════════════════════════════════════════════════════
// 4. Stat derivation from a single PA
// ═══════════════════════════════════════════════════════════════

/**
 * Given a PA and existing stat lines for all players, return updated stat lines.
 * The "__BATTER__" placeholder in runnersAfter is resolved to the actual batterId.
 */
export function deriveStatsFromPA(
  pa: PlateAppearance,
  existingStatLines: Record<string, LiveStatLine>,
): Record<string, LiveStatLine> {
  let sl = { ...existingStatLines };
  sl = ensureStatLine(sl, pa.batterId);

  const batter = { ...sl[pa.batterId] };
  const result = pa.result;

  // Apply batter stats based on result
  batter.pa++;

  switch (result) {
    case "1B": batter.ab++; batter.h++; break;
    case "2B": batter.ab++; batter.h++; batter.doubles++; break;
    case "3B": batter.ab++; batter.h++; batter.triples++; break;
    case "HR": batter.ab++; batter.h++; batter.hr++; break;
    case "BB": batter.bb++; break;
    case "HBP": batter.hbp++; break;
    case "SO": batter.ab++; batter.so++; break;
    case "GO": batter.ab++; break;
    case "FO": batter.ab++; break;
    case "LO": batter.ab++; break;
    case "DP": batter.ab++; break;
    case "SF": batter.sf++; break;
    case "SAC": break; // SAC does not count as AB
    case "ROE": batter.ab++; break;
    case "FC":
      // FC: batter reaches on fielder's choice — counts as AB, no hit, RBI from runs scored
      batter.ab++;
      break;
    case "SB":
      // SB does NOT count as a PA/AB for the batter — it's a base running event
      // The runner's SB stat is handled separately
      break;
    case "CS":
      // CS does NOT count as a PA/AB for the batter
      break;
    case "WP":
    case "PB":
      // WP/PB are defensive miscues, not batter events — handled below
      break;
  }

  // WP/PB/SB/CS: non-batter events, return early without batter stat changes
  if (result === "WP" || result === "PB") {
    return sl; // Wild pitch / passed ball don't affect batter stats
  }

  // SB/CS: credit the runner who stole/was caught
  if (result === "SB" || result === "CS") {
    // Find the lead runner (the one attempting to steal)
    const leadRunner = pa.runnersBefore[0];
    if (leadRunner) {
      sl = ensureStatLine(sl, leadRunner.playerId);
      const runnerStats = { ...sl[leadRunner.playerId] };
      if (result === "SB") runnerStats.sb++;
      else runnerStats.cs++;
      sl = { ...sl, [leadRunner.playerId]: runnerStats };
    }
    return sl; // No further batter stat changes
  }

  batter.rbi += pa.rbi;

  // Batter scores (HR or advanced home)
  if (result === "HR") {
    batter.r++;
  }

  // Credit R to runners who scored
  const scoredIds = new Set<string>();
  for (const rBefore of pa.runnersBefore) {
    const stillOnBase = pa.runnersAfter.some(
      (rAfter) => rAfter.playerId === rBefore.playerId,
    );
    if (!stillOnBase) {
      scoredIds.add(rBefore.playerId);
    }
  }
  // For HR the batter also scores (already tracked)

  for (const id of scoredIds) {
    sl = ensureStatLine(sl, id);
    sl = { ...sl, [id]: { ...sl[id], r: sl[id].r + 1 } };
  }

  sl = { ...sl, [pa.batterId]: batter };

  return sl;
}

// ═══════════════════════════════════════════════════════════════
// 5. Fielding distribution per PA
// ═══════════════════════════════════════════════════════════════

/** Cycle counter for distributing assists among infielders. */
const infieldPositions: PositionCode[] = ["2B", "SS", "3B"];
let infieldCycle = 0;
const outfieldPositions: PositionCode[] = ["LF", "CF", "RF"];
let outfieldCycle = 0;

function resetFieldingCycles() {
  infieldCycle = 0;
  outfieldCycle = 0;
}

/**
 * Distribute putouts and assists to fielders based on the PA result.
 * When `pa.fielderPosition` is set (from two-step user input), it takes priority.
 */
export function distributeFieldingStats(
  pa: PlateAppearance,
  defense: Record<PositionCode, string | null>,
  existingStatLines: Record<string, LiveStatLine>,
  fielderPosition?: PositionCode | null,
): Record<string, LiveStatLine> {
  // Use PA's fielder position if available
  const fielder = pa.fielderPosition ?? fielderPosition;
  let sl = { ...existingStatLines };
  const result = pa.result;

  function incPO(playerId: string | null) {
    if (!playerId) return;
    sl = ensureStatLine(sl, playerId);
    sl = { ...sl, [playerId]: { ...sl[playerId], po: sl[playerId].po + 1 } };
  }

  function incA(playerId: string | null) {
    if (!playerId) return;
    sl = ensureStatLine(sl, playerId);
    sl = { ...sl, [playerId]: { ...sl[playerId], a: sl[playerId].a + 1 } };
  }

  function incE(playerId: string | null) {
    if (!playerId) return;
    sl = ensureStatLine(sl, playerId);
    sl = { ...sl, [playerId]: { ...sl[playerId], e: sl[playerId].e + 1 } };
  }

  switch (result) {
    case "SO":
      incPO(defense["P"]);
      incPO(defense["C"]);
      break;

    case "GO": {
      incPO(defense["1B"]);
      if (fielder) {
        incA(defense[fielder]);
      } else {
        const ifIdx = infieldCycle % infieldPositions.length;
        incA(defense[infieldPositions[ifIdx]]);
        infieldCycle++;
      }
      break;
    }

    case "FO": {
      if (fielder) {
        incPO(defense[fielder]);
      } else {
        const ofIdx = outfieldCycle % outfieldPositions.length;
        incPO(defense[outfieldPositions[ofIdx]]);
        outfieldCycle++;
      }
      break;
    }

    case "LO": {
      if (fielder) {
        incPO(defense[fielder]);
      } else {
        const positions: PositionCode[] = ["P", "1B", "2B", "SS", "3B"];
        const idx = infieldCycle % positions.length;
        incPO(defense[positions[idx]]);
        infieldCycle++;
      }
      break;
    }

    case "DP": {
      incPO(defense["1B"]);
      if (fielder) {
        incA(defense[fielder]);
        // Second assist to pivot man (cycling)
        const allIF = (["2B", "SS", "3B"] as PositionCode[]).filter(p => p !== fielder);
        if (allIF.length > 0) incA(defense[allIF[infieldCycle % allIF.length]]);
      } else {
        const allIF: PositionCode[] = ["2B", "SS", "3B"];
        incA(defense[allIF[infieldCycle % allIF.length]]);
        incA(defense[allIF[(infieldCycle + 1) % allIF.length]]);
      }
      infieldCycle += 2;
      break;
    }

    case "SF": {
      if (fielder) {
        incPO(defense[fielder]);
      } else {
        const ofIdx = outfieldCycle % outfieldPositions.length;
        incPO(defense[outfieldPositions[ofIdx]]);
        outfieldCycle++;
      }
      break;
    }

    case "SAC": {
      incPO(defense["1B"]);
      if (fielder) {
        incA(defense[fielder]);
      } else {
        const ifIdx = infieldCycle % infieldPositions.length;
        incA(defense[infieldPositions[ifIdx]]);
        infieldCycle++;
      }
      break;
    }

    case "ROE": {
      if (fielder) {
        incE(defense[fielder]);
      } else {
        const allFld: PositionCode[] = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
        incE(defense[allFld[infieldCycle % allFld.length]]);
        infieldCycle++;
      }
      break;
    }

    case "FC": {
      incPO(defense["1B"]);
      if (fielder) {
        incA(defense[fielder]);
      } else {
        const ifIdx = infieldCycle % infieldPositions.length;
        incA(defense[infieldPositions[ifIdx]]);
        infieldCycle++;
      }
      break;
    }

    // No fielding stats for hits/walks
    default:
      break;
  }

  return sl;
}

// ═══════════════════════════════════════════════════════════════
// 6. Record a plate appearance
// ═══════════════════════════════════════════════════════════════

/**
 * Record a PA against the current game state.
 * Returns the updated ScoreboardGame.
 */
export function recordPlateAppearance(
  game: ScoreboardGame,
  result: PAResult,
  fielderPosition?: PositionCode | null,
  isOpponentBatting: boolean = false,
): ScoreboardGame {
  if (game.phase !== "recording") return game;

  resetFieldingCycles();
  // Re-run fielding cycles deterministically based on existing PAs
  const totalPAs = game.innings.reduce((sum, inn) => sum + inn.plateAppearances.length, 0);
  infieldCycle = totalPAs * 2; // approximate
  outfieldCycle = totalPAs;

  const lineup = game.lineup;
  // For opponent batting, use a placeholder batter — we don't track their lineup
  let batterId: string | null;
  let batterIndex: number;
  if (isOpponentBatting) {
    batterId = "__OPPONENT__";
    batterIndex = game.currentBatterIndex; // don't advance opponent batter index
  } else {
    batterId = null;
    batterIndex = game.currentBatterIndex;
    for (let i = 0; i < 9; i++) {
      const idx = (game.currentBatterIndex + i) % 9;
      if (lineup[idx]) {
        batterId = lineup[idx];
        batterIndex = idx;
        break;
      }
    }
    if (!batterId) return game; // No batters in lineup — shouldn't happen
  }

  // Compute runner advancement
  const adv = computeRunnerAdvancement(result, game.runners);

  // Create PA record
  const pa: PlateAppearance = {
    id: createId(),
    batterId,
    result,
    runsScored: adv.runsScored,
    rbi: adv.batterRbi,
    runnersBefore: [...game.runners],
    runnersAfter: adv.runnersAfter.map((r) =>
      r.playerId === "__BATTER__"
        ? { playerId: batterId!, base: r.base as 1 | 2 | 3 }
        : r as RunnerState,
    ),
    outsBefore: game.outs,
    outsAfter: Math.min(game.outs + (
      result === "CS" ? 1 :
      result === "SB" ? 0 :
      result !== "ROE" && result !== "BB" && result !== "HBP" && result !== "WP" && result !== "PB" && result !== "1B" && result !== "2B" && result !== "3B" && result !== "HR" && result !== "FC"
        ? (result === "DP" ? 2 : 1) : 0
    ), 3),
    inning: game.currentInning,
    fielderPosition: fielderPosition ?? null,
  };

  // Update stat lines
  let statLines = deriveStatsFromPA(pa, game.statLines);
  statLines = distributeFieldingStats(pa, game.defense, statLines, fielderPosition);

  // Update pitching stats for current pitcher
  if (game.currentPitcherId) {
    statLines = ensureStatLine(statLines, game.currentPitcherId);
    const pitchStats = { ...statLines[game.currentPitcherId] };
    if (result === "SO") pitchStats.soPitching++;
    if (result === "BB") pitchStats.bbPitching++;
    if (result === "1B" || result === "2B" || result === "3B" || result === "HR") pitchStats.hPitching++;
    if (result === "HBP") pitchStats.bbPitching++; // HBP counts as BB for pitcher stats
    // Track earned runs (PB runs not charged to pitcher — catcher's fault)
    if (adv.runsScored > 0 && result !== "PB") pitchStats.er += adv.runsScored;
    // Track outs recorded by this pitcher
    const outsThisPA = pa.outsAfter - pa.outsBefore;
    if (outsThisPA > 0) pitchStats.ipOuts += outsThisPA;
    statLines = { ...statLines, [game.currentPitcherId]: pitchStats };
  }

  // Compute outs after
  const outsAfter = pa.outsAfter;

  // Update inning PA list
  const updatedInnings = game.innings.map((inn) => {
    if (inn.inning !== game.currentInning) return inn;
    return { ...inn, plateAppearances: [...inn.plateAppearances, pa] };
  });

  // Advance batter index (skip for SB/CS/WP, and for opponent batting)
  let nextBatterIndex = batterIndex;
  if (result !== "SB" && result !== "CS" && result !== "WP" && result !== "PB" && !isOpponentBatting) {
    nextBatterIndex = (batterIndex + 1) % 9;
    let attempts = 0;
    while (!lineup[nextBatterIndex] && attempts < 9) {
      nextBatterIndex = (nextBatterIndex + 1) % 9;
      attempts++;
    }
  }

  // Update score
  let scoreTop = game.scoreTop;
  let scoreBottom = game.scoreBottom;
  if (game.halfInning === "top") {
    scoreTop += adv.runsScored;
  } else {
    scoreBottom += adv.runsScored;
  }

  // Remove runners that scored (not in runnersAfter)
  const newRunners = adv.runnersAfter
    .filter((r) => r.playerId !== "__BATTER__" || adv.batterEndBase > 0)
    .map((r) => {
      if (r.playerId === "__BATTER__") {
        return { playerId: batterId!, base: (adv.batterEndBase === 4 ? undefined : adv.batterEndBase) as 1 | 2 | 3 | undefined };
      }
      return r as RunnerState;
    })
    .filter((r): r is RunnerState => r.base !== undefined && r.base >= 1 && r.base <= 3);

  return {
    ...game,
    innings: updatedInnings,
    outs: outsAfter,
    runners: newRunners,
    currentBatterIndex: nextBatterIndex,
    statLines,
    scoreTop,
    scoreBottom,
  };
}

// ═══════════════════════════════════════════════════════════════
// 7. Half-inning / inning management
// ═══════════════════════════════════════════════════════════════

/**
 * End the current half-inning. Returns updated game.
 * If this was the bottom half, inning advances.
 */
export function endHalfInning(game: ScoreboardGame): ScoreboardGame {
  if (game.phase !== "recording") return game;

  if (game.halfInning === "top") {
    return {
      ...game,
      halfInning: "bottom",
      outs: 0,
      runners: [],
    };
  }

  // Bottom half ending → advance inning
  const nextInning = game.currentInning + 1;
  const existingInning = game.innings.find((inn) => inn.inning === nextInning);
  const innings = existingInning
    ? game.innings
    : [...game.innings, { inning: nextInning, plateAppearances: [] }];

  // After final inning + bottom half ends → game over
  const isGameOver = game.currentInning >= game.setup.totalInnings;

  return {
    ...game,
    innings,
    currentInning: nextInning,
    halfInning: "top",
    outs: 0,
    runners: [],
    phase: isGameOver ? "review" : "recording",
  };
}

/**
 * Check if the current half-inning should end (3 outs).
 */
export function shouldEndHalfInning(game: ScoreboardGame): boolean {
  return game.outs >= 3;
}

// ═══════════════════════════════════════════════════════════════
// 8. Pitcher changes
// ═══════════════════════════════════════════════════════════════

export function changePitcher(
  game: ScoreboardGame,
  newPitcherId: string,
  pitchesThrown: number = 0,
): ScoreboardGame {
  if (game.phase !== "recording") return game;

  // Save NP for old pitcher
  let statLines = { ...game.statLines };
  if (game.currentPitcherId && pitchesThrown > 0) {
    statLines = ensureStatLine(statLines, game.currentPitcherId);
    statLines = {
      ...statLines,
      [game.currentPitcherId]: {
        ...statLines[game.currentPitcherId],
        np: (statLines[game.currentPitcherId]?.np ?? 0) + pitchesThrown,
      },
    };
  }

  // Record outs for current pitcher before change
  const change: PitcherChange = {
    inning: game.currentInning,
    outsRecorded: game.innings.reduce((sum, inn) => {
      if (inn.inning < game.currentInning) return sum + inn.plateAppearances.length * 1;
      return sum;
    }, 0),
    newPitcherId,
  };

  return {
    ...game,
    statLines,
    currentPitcherId: newPitcherId,
    pitcherChanges: [...game.pitcherChanges, change],
  };
}

// ═══════════════════════════════════════════════════════════════
// 9. Transition to review
// ═══════════════════════════════════════════════════════════════

export function reviewGame(game: ScoreboardGame): ScoreboardGame {
  return { ...game, phase: "review" };
}

export function reopenGame(game: ScoreboardGame): ScoreboardGame {
  return { ...game, phase: "recording" };
}

// ═══════════════════════════════════════════════════════════════
// 10. Finalize: ScoreboardGame → Game
// ═══════════════════════════════════════════════════════════════

/**
 * Convert a ScoreboardGame into a persistable Game object.
 * Pitcher overrides (ER, NP, W, L, SV) are provided from the review UI.
 */
export function finalizeGame(
  scoreboardGame: ScoreboardGame,
  pitcherOverrides: Record<string, { er?: number; np?: number; w?: number; l?: number; sv?: number }>,
): Game {
  const allPAs = scoreboardGame.innings.flatMap((inn) => inn.plateAppearances);

  // Build per-inning summary
  const innings: InningRecord[] = scoreboardGame.innings.map((inn) => ({
    inning: inn.inning,
    hits: inn.plateAppearances.filter(
      (pa) => pa.result === "1B" || pa.result === "2B" || pa.result === "3B" || pa.result === "HR",
    ).length,
    runs: inn.plateAppearances.reduce((sum, pa) => sum + pa.runsScored, 0),
    batters: inn.plateAppearances.map((pa) => pa.batterId),
  }));

  // Compute pitcher IP from changes
  const pitcherOuts: Record<string, number> = {};

  // Compute total outs per pitcher based on pitcher changes
  if (scoreboardGame.pitcherChanges.length === 0 && scoreboardGame.currentPitcherId) {
    // No changes — starting pitcher pitched the whole game
    const totalOuts = allPAs.reduce((sum, pa) => sum + (pa.outsAfter - pa.outsBefore), 0);
    pitcherOuts[scoreboardGame.currentPitcherId] = totalOuts;
  } else {
    const changes = [...scoreboardGame.pitcherChanges].sort((a, b) => a.outsRecorded - b.outsRecorded);

    // First pitcher: from game start to first change
    if (scoreboardGame.currentPitcherId) {
      // Walk through PAs and assign outs to pitchers
      let runningOuts = 0;
      const currentPitcherIdx = 0;
      const activePitcher = scoreboardGame.defense["P"]; // starting pitcher

      // Find starting pitcher
      const allPitchers: string[] = [activePitcher ?? ""];
      for (const ch of changes) {
        if (ch.newPitcherId && !allPitchers.includes(ch.newPitcherId)) {
          allPitchers.push(ch.newPitcherId);
        }
      }

      // Simple approach: assign outs linearly
      // Better approach: track per PA which pitcher was active
      // For MVP, assume starting pitcher until first change, then each change
      for (const pa of allPAs) {
        const outsThisPA = pa.outsAfter - pa.outsBefore;
        // Determine active pitcher for this PA
        let currentPitcher = allPitchers[0] ?? scoreboardGame.currentPitcherId ?? "";
        for (const ch of changes) {
          if (runningOuts >= ch.outsRecorded) {
            currentPitcher = ch.newPitcherId;
          }
        }
        pitcherOuts[currentPitcher] = (pitcherOuts[currentPitcher] ?? 0) + outsThisPA;
        runningOuts += outsThisPA;
      }
    }
  }

  // Build stat lines
  const statLines: PlayerGameStatLine[] = Object.values(scoreboardGame.statLines)
    .filter((sl) => sl.pa > 0 || sl.ipOuts > 0 || sl.po > 0 || sl.a > 0 || sl.e > 0)
    .map((sl) => {
      const override = pitcherOverrides[sl.playerId] ?? {};
      const ip = pitcherOuts[sl.playerId] !== undefined
        ? outsToIpDisplay(pitcherOuts[sl.playerId])
        : (sl.ipOuts > 0 ? outsToIpDisplay(sl.ipOuts) : null);

      return {
        playerId: sl.playerId,
        pa: sl.pa,
        ab: sl.ab,
        h: sl.h,
        doubles: sl.doubles,
        triples: sl.triples,
        hr: sl.hr,
        rbi: sl.rbi,
        r: sl.r,
        sb: sl.sb,
        bb: sl.bb,
        hbp: sl.hbp,
        sf: sl.sf,
        so: sl.so,
        ip,
        er: override.er ?? sl.er,
        soPitching: sl.soPitching > 0 ? sl.soPitching : null,
        bbPitching: sl.bbPitching > 0 ? sl.bbPitching : null,
        hPitching: sl.hPitching > 0 ? sl.hPitching : null,
        po: sl.po,
        a: sl.a,
        e: sl.e,
        w: override.w ?? sl.w,
        l: override.l ?? sl.l,
        sv: override.sv ?? sl.sv,
        np: override.np ?? sl.np,
      };
    });

  return {
    id: createId(),
    date: scoreboardGame.setup.date,
    opponent: scoreboardGame.setup.opponent,
    gameType: scoreboardGame.setup.gameType,
    totalInnings: scoreboardGame.setup.totalInnings,
    innings,
    statLines,
  };
}

/**
 * For dual mode: merge two Game objects? No — in dual mode, each team
 * produces its own Game. They are saved independently.
 */

// ═══════════════════════════════════════════════════════════════
// 11. localStorage persistence for crash recovery
// ═══════════════════════════════════════════════════════════════

const LS_KEY_PREFIX = "scoreboard_draft_";

export function saveDraftToLocalStorage(key: string, game: ScoreboardGame): void {
  try {
    localStorage.setItem(LS_KEY_PREFIX + key, JSON.stringify(game));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function loadDraftFromLocalStorage(key: string): ScoreboardGame | null {
  try {
    const raw = localStorage.getItem(LS_KEY_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as ScoreboardGame;
  } catch {
    return null;
  }
}

export function clearDraftFromLocalStorage(key: string): void {
  try {
    localStorage.removeItem(LS_KEY_PREFIX + key);
  } catch {
    // ignore
  }
}
