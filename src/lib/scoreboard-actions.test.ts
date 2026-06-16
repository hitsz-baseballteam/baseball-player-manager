/**
 * Scoreboard actions unit tests.
 *
 * Covers: runner advancement for all 14 PA results, stat derivation,
 * fielding distribution, inning management, and finalize.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeRunnerAdvancement,
  deriveStatsFromPA,
  distributeFieldingStats,
  createScoreboardGame,
  recordPlateAppearance,
  endHalfInning,
  shouldEndHalfInning,
  changePitcher,
  finalizeGame,
  initializeFromScenario,
  type PlateAppearance,
  type RunnerState,
  type ScoreboardGame,
  type LiveStatLine,
} from "./scoreboard-actions";
import { createDefaultWorkspace } from "./workspace";

// ── Helpers ──

function r(playerId: string, base: 1 | 2 | 3): RunnerState {
  return { playerId, base };
}

function makePA(overrides: Partial<PlateAppearance> = {}): PlateAppearance {
  return {
    id: "pa-test",
    batterId: "p-test",
    result: "1B",
    runsScored: 0,
    rbi: 0,
    runnersBefore: [],
    runnersAfter: [],
    outsBefore: 0,
    outsAfter: 0,
    inning: 1,
    ...overrides,
  };
}

function emptySL(playerId: string): LiveStatLine {
  return {
    playerId,
    pa: 0, ab: 0, h: 0,
    doubles: 0, triples: 0, hr: 0,
    rbi: 0, r: 0, sb: 0, cs: 0,
    bb: 0, hbp: 0, sf: 0, so: 0,
    ipOuts: 0, er: 0,
    soPitching: 0, bbPitching: 0, hPitching: 0,
    po: 0, a: 0, e: 0,
    w: 0, l: 0, sv: 0, np: 0,
  };
}

function makeSimpleGame(): ScoreboardGame {
  const lineup = ["p-01", "p-02", "p-03", "p-04", "p-05", "p-06", "p-07", "p-08", "p-09"];
  const defense: Record<string, string | null> = {
    P: "p-01", C: "p-02", "1B": "p-04", "2B": "p-09", "3B": "p-06",
    SS: "p-03", LF: "p-07", CF: "p-05", RF: "p-08",
  };
  return createScoreboardGame(
    { date: "2026-06-16", opponent: "Test", gameType: "official", totalInnings: 9 },
    "scenario-test",
    { defense: defense as Record<string, string | null>, lineup, bench: [] },
  );
}

// ═══════════════════════════════════════════════════════════════
// computeRunnerAdvancement
// ═══════════════════════════════════════════════════════════════

describe("computeRunnerAdvancement", () => {
  it("1B: empty bases → batter on 1st, no runs", () => {
    const result = computeRunnerAdvancement("1B", []);
    assert.equal(result.runsScored, 0);
    assert.equal(result.batterEndBase, 1);
    assert.equal(result.runnersAfter.length, 1);
    assert.equal(result.runnersAfter[0].playerId, "__BATTER__");
    assert.equal(result.runnersAfter[0].base, 1);
  });

  it("1B: runner on 1st → runner to 2nd, batter to 1st", () => {
    const result = computeRunnerAdvancement("1B", [r("p-03", 1)]);
    assert.equal(result.runsScored, 0);
    assert.equal(result.runnersAfter.length, 2);
    const runner1 = result.runnersAfter.find((x) => x.playerId === "p-03");
    assert.ok(runner1, "p-03 should still be on base");
    assert.equal(runner1!.base, 2);
    const batter = result.runnersAfter.find((x) => x.playerId === "__BATTER__");
    assert.equal(batter!.base, 1);
  });

  it("1B: runner on 3rd → scores, batter to 1st, 1 RBI", () => {
    const result = computeRunnerAdvancement("1B", [r("p-03", 3)]);
    assert.equal(result.runsScored, 1);
    assert.equal(result.batterRbi, 1);
    assert.equal(result.runnersAfter.length, 1);
    assert.equal(result.runnersAfter[0].playerId, "__BATTER__");
  });

  it("1B: bases loaded → 3B scores, others advance, batter to 1st", () => {
    const result = computeRunnerAdvancement("1B", [r("p-03", 3), r("p-05", 2), r("p-07", 1)]);
    assert.equal(result.runsScored, 1);
    assert.equal(result.batterRbi, 1);
    assert.equal(result.runnersAfter.length, 3); // batter + 2B→3B + 1B→2B
  });

  it("2B: runner on 1st → runner to 3rd, batter to 2nd", () => {
    const result = computeRunnerAdvancement("2B", [r("p-03", 1)]);
    assert.equal(result.runsScored, 0);
    const runner = result.runnersAfter.find((x) => x.playerId === "p-03");
    assert.equal(runner!.base, 3);
  });

  it("2B: runner on 2nd and 3rd → both score, 2 RBI", () => {
    const result = computeRunnerAdvancement("2B", [r("p-03", 3), r("p-05", 2)]);
    assert.equal(result.runsScored, 2);
    assert.equal(result.batterRbi, 2);
    assert.equal(result.runnersAfter.length, 1); // only batter on 2B
  });

  it("3B: clears all runners, batter to 3rd", () => {
    const result = computeRunnerAdvancement("3B", [r("p-03", 3), r("p-05", 1)]);
    assert.equal(result.runsScored, 2);
    assert.equal(result.runnersAfter.length, 1);
    assert.equal(result.runnersAfter[0].base, 3);
  });

  it("HR: grand slam — 4 runs, bases cleared", () => {
    const result = computeRunnerAdvancement("HR", [r("p-03", 3), r("p-05", 2), r("p-07", 1)]);
    assert.equal(result.runsScored, 4); // 3 runners + batter
    assert.equal(result.batterRbi, 4);
    assert.equal(result.batterEndBase, 4);
    assert.equal(result.runnersAfter.length, 0);
  });

  it("HR: solo shot", () => {
    const result = computeRunnerAdvancement("HR", []);
    assert.equal(result.runsScored, 1);
    assert.equal(result.batterRbi, 1);
    assert.equal(result.batterEndBase, 4);
  });

  it("BB: empty bases → batter to 1st", () => {
    const result = computeRunnerAdvancement("BB", []);
    assert.equal(result.runsScored, 0);
    assert.equal(result.runnersAfter.length, 1);
    assert.equal(result.runnersAfter[0].base, 1);
  });

  it("BB: bases loaded → runner on 3rd scores, all advance", () => {
    const result = computeRunnerAdvancement("BB", [r("p-03", 3), r("p-05", 2), r("p-07", 1)]);
    assert.equal(result.runsScored, 1);
    assert.equal(result.runnersAfter.length, 3); // batter + 2B→3B + 1B→2B
  });

  it("BB: runner on 2nd only → no force, no advancement", () => {
    const result = computeRunnerAdvancement("BB", [r("p-05", 2)]);
    assert.equal(result.runsScored, 0);
    // Runner stays on 2nd, batter to 1st
    const runner = result.runnersAfter.find((x) => x.playerId === "p-05");
    assert.equal(runner!.base, 2);
  });

  it("HBP: same as BB for advancement", () => {
    const result = computeRunnerAdvancement("HBP", [r("p-03", 3)]);
    assert.equal(result.runsScored, 0); // no force, runner on 3rd stays
  });

  it("SO: no advancement, batter out", () => {
    const result = computeRunnerAdvancement("SO", [r("p-03", 3), r("p-05", 1)]);
    assert.equal(result.runsScored, 0);
    assert.equal(result.runnersAfter.length, 2); // both runners stay
    assert.equal(result.batterEndBase, 0);
  });

  it("GO: runner on 3rd scores, batter out", () => {
    const result = computeRunnerAdvancement("GO", [r("p-03", 3)]);
    assert.equal(result.runsScored, 1);
    assert.equal(result.batterRbi, 1);
    assert.equal(result.batterEndBase, 0);
    assert.equal(result.runnersAfter.length, 0); // 3B runner scored, batter out
  });

  it("FO: runners hold, batter out", () => {
    const result = computeRunnerAdvancement("FO", [r("p-03", 3)]);
    assert.equal(result.runsScored, 0);
    assert.equal(result.batterEndBase, 0);
    assert.equal(result.runnersAfter.length, 1);
  });

  it("LO: runners hold, batter out", () => {
    const result = computeRunnerAdvancement("LO", [r("p-05", 2)]);
    assert.equal(result.runsScored, 0);
    assert.equal(result.batterEndBase, 0);
    assert.equal(result.runnersAfter.length, 1);
  });

  it("DP: runners on 1st and 2nd → lead runner out + batter out, 1B advances to 2nd", () => {
    const result = computeRunnerAdvancement("DP", [r("p-05", 2), r("p-07", 1)]);
    assert.equal(result.runsScored, 0);
    assert.equal(result.batterEndBase, 0);
    // p-05 (on 2B) is eliminated; p-07 advances from 1B to 2B
    const runner = result.runnersAfter.find((x) => x.playerId === "p-07");
    assert.ok(runner);
    if (runner) assert.equal(runner.base, 2);
  });

  it("DP: runner on 3rd with < 2 outs → runner scores, RBI", () => {
    const result = computeRunnerAdvancement("DP", [r("p-03", 3), r("p-05", 1)]);
    assert.equal(result.runsScored, 1);
    assert.equal(result.batterRbi, 1);
    assert.equal(result.batterEndBase, 0);
  });

  it("SF: runner on 3rd scores, other runners hold, batter out", () => {
    const result = computeRunnerAdvancement("SF", [r("p-03", 3), r("p-05", 1)]);
    assert.equal(result.runsScored, 1);
    assert.equal(result.batterRbi, 1);
    assert.equal(result.batterEndBase, 0);
    // Runner on 1st stays
    const runner = result.runnersAfter.find((x) => x.playerId === "p-05");
    assert.equal(runner!.base, 1);
  });

  it("SF: no runner on 3rd → no run, batter out", () => {
    const result = computeRunnerAdvancement("SF", [r("p-05", 1)]);
    assert.equal(result.runsScored, 0);
    assert.equal(result.batterEndBase, 0);
  });

  it("SAC: all runners advance 1 base, batter out", () => {
    const result = computeRunnerAdvancement("SAC", [r("p-05", 2), r("p-07", 1)]);
    assert.equal(result.runsScored, 0);
    assert.equal(result.batterEndBase, 0);
    // Runner from 2B → 3B
    const r2 = result.runnersAfter.find((x) => x.playerId === "p-05");
    assert.equal(r2!.base, 3);
  });

  it("SAC: runner on 3rd scores", () => {
    const result = computeRunnerAdvancement("SAC", [r("p-03", 3)]);
    assert.equal(result.runsScored, 1);
    assert.equal(result.batterRbi, 1);
  });

  it("ROE: runners advance 1, batter safe at 1st, no RBI", () => {
    const result = computeRunnerAdvancement("ROE", [r("p-03", 3)]);
    // Runner on 3rd scores but NO RBI (reached on error)
    assert.equal(result.runsScored, 1);
    assert.equal(result.batterRbi, 0);
    assert.equal(result.batterEndBase, 1);
  });

  it("FC: lead force runner out, batter safe at 1st", () => {
    const result = computeRunnerAdvancement("FC", [r("p-05", 1)]);
    // Runner on 1B is the force runner → out. Batter safe at 1B
    assert.equal(result.runsScored, 0);
    assert.equal(result.batterRbi, 0);
    assert.equal(result.batterEndBase, 1);
    const runner = result.runnersAfter.find((x) => x.playerId === "p-05");
    assert.equal(runner, undefined); // p-05 was eliminated
  });
});

// ═══════════════════════════════════════════════════════════════
// deriveStatsFromPA
// ═══════════════════════════════════════════════════════════════

describe("deriveStatsFromPA", () => {
  it("1B: increments PA, AB, H for the batter", () => {
    const sl = { "p-01": emptySL("p-01") };
    const pa = makePA({ batterId: "p-01", result: "1B" });
    const updated = deriveStatsFromPA(pa, sl);
    assert.equal(updated["p-01"].pa, 1);
    assert.equal(updated["p-01"].ab, 1);
    assert.equal(updated["p-01"].h, 1);
  });

  it("2B: increments doubles", () => {
    const sl = { "p-01": emptySL("p-01") };
    const pa = makePA({ batterId: "p-01", result: "2B" });
    const updated = deriveStatsFromPA(pa, sl);
    assert.equal(updated["p-01"].pa, 1);
    assert.equal(updated["p-01"].h, 1);
    assert.equal(updated["p-01"].doubles, 1);
  });

  it("3B: increments triples", () => {
    const sl = { "p-01": emptySL("p-01") };
    const pa = makePA({ batterId: "p-01", result: "3B" });
    const updated = deriveStatsFromPA(pa, sl);
    assert.equal(updated["p-01"].triples, 1);
  });

  it("HR: increments HR and R and RBI", () => {
    const sl = { "p-01": emptySL("p-01") };
    const pa = makePA({ batterId: "p-01", result: "HR", rbi: 1, runsScored: 1 });
    const updated = deriveStatsFromPA(pa, sl);
    assert.equal(updated["p-01"].hr, 1);
    assert.equal(updated["p-01"].r, 1);
    assert.equal(updated["p-01"].rbi, 1);
  });

  it("BB: increments PA and BB, NOT AB", () => {
    const sl = { "p-01": emptySL("p-01") };
    const pa = makePA({ batterId: "p-01", result: "BB" });
    const updated = deriveStatsFromPA(pa, sl);
    assert.equal(updated["p-01"].pa, 1);
    assert.equal(updated["p-01"].ab, 0);
    assert.equal(updated["p-01"].bb, 1);
  });

  it("HBP: increments PA and HBP, NOT AB", () => {
    const sl = { "p-01": emptySL("p-01") };
    const pa = makePA({ batterId: "p-01", result: "HBP" });
    const updated = deriveStatsFromPA(pa, sl);
    assert.equal(updated["p-01"].pa, 1);
    assert.equal(updated["p-01"].ab, 0);
    assert.equal(updated["p-01"].hbp, 1);
  });

  it("SO: increments PA, AB, SO", () => {
    const sl = { "p-01": emptySL("p-01") };
    const pa = makePA({ batterId: "p-01", result: "SO" });
    const updated = deriveStatsFromPA(pa, sl);
    assert.equal(updated["p-01"].pa, 1);
    assert.equal(updated["p-01"].ab, 1);
    assert.equal(updated["p-01"].so, 1);
    assert.equal(updated["p-01"].h, 0);
  });

  it("GO/FO/LO: increment PA and AB, not H", () => {
    for (const result of ["GO", "FO", "LO"] as const) {
      const sl = { "p-01": emptySL("p-01") };
      const pa = makePA({ batterId: "p-01", result });
      const updated = deriveStatsFromPA(pa, sl);
      assert.equal(updated["p-01"].pa, 1, `${result}: PA`);
      assert.equal(updated["p-01"].ab, 1, `${result}: AB`);
      assert.equal(updated["p-01"].h, 0, `${result}: H`);
    }
  });

  it("SF: increments PA and SF, NOT AB", () => {
    const sl = { "p-01": emptySL("p-01") };
    const pa = makePA({ batterId: "p-01", result: "SF", rbi: 1 });
    const updated = deriveStatsFromPA(pa, sl);
    assert.equal(updated["p-01"].pa, 1);
    assert.equal(updated["p-01"].ab, 0);
    assert.equal(updated["p-01"].sf, 1);
    assert.equal(updated["p-01"].rbi, 1);
  });

  it("SAC: increments PA, NOT AB", () => {
    const sl = { "p-01": emptySL("p-01") };
    const pa = makePA({ batterId: "p-01", result: "SAC" });
    const updated = deriveStatsFromPA(pa, sl);
    assert.equal(updated["p-01"].pa, 1);
    assert.equal(updated["p-01"].ab, 0);
  });

  it("credits R to runners who scored", () => {
    const sl = { "p-01": emptySL("p-01"), "p-02": emptySL("p-02") };
    const pa = makePA({
      batterId: "p-01",
      result: "1B",
      runnersBefore: [r("p-02", 3)],
      runnersAfter: [], // p-02 scored
      runsScored: 1,
      rbi: 1,
    });
    const updated = deriveStatsFromPA(pa, sl);
    assert.equal(updated["p-02"].r, 1, "p-02 should be credited with a run scored");
    assert.equal(updated["p-01"].rbi, 1, "p-01 should get the RBI");
  });

  it("DP: increments AB and PA", () => {
    const sl = { "p-01": emptySL("p-01") };
    const pa = makePA({ batterId: "p-01", result: "DP" });
    const updated = deriveStatsFromPA(pa, sl);
    assert.equal(updated["p-01"].pa, 1);
    assert.equal(updated["p-01"].ab, 1);
  });

  it("ROE/FC: increment AB and PA", () => {
    for (const result of ["ROE", "FC"] as const) {
      const sl = { "p-01": emptySL("p-01") };
      const pa = makePA({ batterId: "p-01", result });
      const updated = deriveStatsFromPA(pa, sl);
      assert.equal(updated["p-01"].pa, 1);
      assert.equal(updated["p-01"].ab, 1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// distributeFieldingStats
// ═══════════════════════════════════════════════════════════════

describe("distributeFieldingStats", () => {
  const defense = {
    P: "p-01", C: "p-02", "1B": "p-04", "2B": "p-09",
    "3B": "p-06", SS: "p-03", LF: "p-07", CF: "p-05", RF: "p-08",
  } as Record<string, string | null>;

  const clean = () => {
    const sl: Record<string, LiveStatLine> = {};
    for (const id of Object.values(defense)) {
      if (id) sl[id] = emptySL(id);
    }
    return sl;
  };

  it("SO: P and C each get +1 PO", () => {
    const pa = makePA({ result: "SO" });
    const updated = distributeFieldingStats(pa, defense, clean());
    assert.equal(updated["p-01"].po, 1, "P should get PO");
    assert.equal(updated["p-02"].po, 1, "C should get PO");
  });

  it("GO: 1B gets +1 PO, one IF gets +1 A", () => {
    const pa = makePA({ result: "GO" });
    const updated = distributeFieldingStats(pa, defense, clean());
    assert.equal(updated["p-04"].po, 1, "1B should get PO");
    // One of 2B/SS/3B should get an assist
    const assists = [updated["p-09"].a, updated["p-03"].a, updated["p-06"].a];
    assert.equal(assists.reduce((a, b) => a + b, 0), 1, "One IF should get A");
  });

  it("FO: one OF gets +1 PO", () => {
    const pa = makePA({ result: "FO" });
    const updated = distributeFieldingStats(pa, defense, clean());
    const ofPOs = [updated["p-07"].po, updated["p-05"].po, updated["p-08"].po];
    assert.equal(ofPOs.reduce((a, b) => a + b, 0), 1, "One OF should get PO");
  });

  it("DP: 1B gets PO, two IFs get A", () => {
    const pa = makePA({ result: "DP" });
    const updated = distributeFieldingStats(pa, defense, clean());
    assert.equal(updated["p-04"].po, 1);
    const assists = [updated["p-09"].a, updated["p-03"].a, updated["p-06"].a];
    assert.equal(assists.reduce((a, b) => a + b, 0), 2, "Two IFs should get A");
  });

  it("SF: one OF gets PO", () => {
    const pa = makePA({ result: "SF" });
    const updated = distributeFieldingStats(pa, defense, clean());
    const ofPOs = [updated["p-07"].po, updated["p-05"].po, updated["p-08"].po];
    assert.equal(ofPOs.reduce((a, b) => a + b, 0), 1);
  });

  it("SAC: 1B gets PO, one IF gets A", () => {
    const pa = makePA({ result: "SAC" });
    const updated = distributeFieldingStats(pa, defense, clean());
    assert.equal(updated["p-04"].po, 1);
    const assists = [updated["p-09"].a, updated["p-03"].a, updated["p-06"].a];
    assert.equal(assists.reduce((a, b) => a + b, 0), 1);
  });

  it("ROE: one fielder gets E", () => {
    const pa = makePA({ result: "ROE" });
    const updated = distributeFieldingStats(pa, defense, clean());
    const totalE = Object.values(updated).reduce((sum, sl) => sum + sl.e, 0);
    assert.equal(totalE, 1);
  });

  it("FC: 1B gets PO, one IF gets A", () => {
    const pa = makePA({ result: "FC" });
    const updated = distributeFieldingStats(pa, defense, clean());
    assert.equal(updated["p-04"].po, 1);
    const assists = [updated["p-09"].a, updated["p-03"].a, updated["p-06"].a];
    assert.equal(assists.reduce((a, b) => a + b, 0), 1);
  });

  it("no fielding stats for hits/walks", () => {
    for (const result of ["1B", "2B", "3B", "HR", "BB", "HBP"] as const) {
      const pa = makePA({ result });
      const updated = distributeFieldingStats(pa, defense, clean());
      const totalFielding = Object.values(updated).reduce((sum, sl) => sum + sl.po + sl.a + sl.e, 0);
      assert.equal(totalFielding, 0, `${result} should not produce fielding stats`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Full game flow
// ═══════════════════════════════════════════════════════════════

describe("full game flow", () => {
  it("record a PA advances batter index and accumulates stats", () => {
    const game = makeSimpleGame();
    // First batter: p-01
    assert.equal(game.currentBatterIndex, 0);

    const afterPA = recordPlateAppearance(game, "1B");
    assert.equal(afterPA.currentBatterIndex, 1); // moved to p-02
    assert.equal(afterPA.outs, 0);
    assert.equal(afterPA.statLines["p-01"].pa, 1);
    assert.equal(afterPA.statLines["p-01"].h, 1);
  });

  it("3 outs → half-inning ends, switches to bottom", () => {
    let game = makeSimpleGame();
    game = recordPlateAppearance(game, "SO"); // 1 out
    game = recordPlateAppearance(game, "SO"); // 2 outs
    game = recordPlateAppearance(game, "SO"); // 3 outs

    assert.ok(shouldEndHalfInning(game));

    game = endHalfInning(game);
    assert.equal(game.halfInning, "bottom");
    assert.equal(game.outs, 0);
    assert.equal(game.runners.length, 0);
  });

  it("bottom half ends → inning advances", () => {
    let game = makeSimpleGame();
    // End top half
    game = recordPlateAppearance(game, "SO");
    game = recordPlateAppearance(game, "SO");
    game = recordPlateAppearance(game, "SO");
    game = endHalfInning(game);
    assert.equal(game.halfInning, "bottom");
    assert.equal(game.currentInning, 1);

    // End bottom half
    game = recordPlateAppearance(game, "SO");
    game = recordPlateAppearance(game, "SO");
    game = recordPlateAppearance(game, "SO");
    game = endHalfInning(game);

    assert.equal(game.halfInning, "top");
    assert.equal(game.currentInning, 2);
  });

  it("score tracks correctly", () => {
    let game = makeSimpleGame();
    // Solo HR
    game = recordPlateAppearance(game, "HR");
    assert.equal(game.scoreTop, 1);

    // Single with runner on 3rd — set up via prior PAs
    // Let's just record a few hits to test
    game = recordPlateAppearance(game, "1B"); // batter to 1st
    assert.equal(game.runners.length, 1);
  });

  it("finalize produces a valid Game object", () => {
    let game = makeSimpleGame();
    // Record a simple inning: 1B, SO, GO, SO = 3 outs
    game = recordPlateAppearance(game, "1B"); // runner on 1st
    game = recordPlateAppearance(game, "SO"); // 1 out
    game = recordPlateAppearance(game, "SO"); // 2 outs
    game = recordPlateAppearance(game, "SO"); // 3 outs
    game = endHalfInning(game); // bottom
    // Bottom: 3 quick outs
    game = recordPlateAppearance(game, "SO");
    game = recordPlateAppearance(game, "SO");
    game = recordPlateAppearance(game, "SO");
    game = endHalfInning(game); // inning 2

    const finalGame = finalizeGame(game, {});
    assert.equal(finalGame.date, "2026-06-16");
    assert.equal(finalGame.opponent, "Test");
    assert.equal(finalGame.gameType, "official");
    assert.ok(finalGame.id);
    assert.ok(finalGame.statLines.length > 0, "Should have at least some stat lines");
    // After finishing top+bottom of inning 1, inning 2 is created (empty)
    assert.ok(finalGame.innings.length >= 1, "Should have at least 1 inning");
    assert.equal(finalGame.innings[0].inning, 1);
  });

  it("pitcher change records correctly", () => {
    let game = makeSimpleGame();
    assert.equal(game.currentPitcherId, "p-01"); // P position

    game = recordPlateAppearance(game, "SO");
    game = changePitcher(game, "p-11");
    assert.equal(game.currentPitcherId, "p-11");
    assert.equal(game.pitcherChanges.length, 1);
    assert.equal(game.pitcherChanges[0].newPitcherId, "p-11");
  });

  it("finalize with pitcher overrides applies ER, NP, W/L/SV", () => {
    let game = makeSimpleGame();
    game = recordPlateAppearance(game, "SO");
    game = recordPlateAppearance(game, "SO");
    game = recordPlateAppearance(game, "SO");
    game = endHalfInning(game);
    game = recordPlateAppearance(game, "SO");
    game = recordPlateAppearance(game, "SO");
    game = recordPlateAppearance(game, "SO");
    game = endHalfInning(game);

    const finalGame = finalizeGame(game, {
      "p-01": { er: 0, np: 45, w: 1, l: 0, sv: 0 },
    });
    const p1Stats = finalGame.statLines.find((sl) => sl.playerId === "p-01");
    assert.ok(p1Stats, "p-01 should have a stat line");
    assert.equal(p1Stats!.er, 0);
    assert.equal(p1Stats!.np, 45);
    assert.equal(p1Stats!.w, 1);
    assert.equal(p1Stats!.l, 0);
    assert.equal(p1Stats!.sv, 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// initializeFromScenario
// ═══════════════════════════════════════════════════════════════

describe("initializeFromScenario", () => {
  it("populates defense, lineup, and bench from workspace scenario", () => {
    const ws = createDefaultWorkspace(true);
    const scenario = ws.scenarios[0];

    // Set up some assignments
    scenario.assignments.defense = {
      P: ws.players[0].id,   // p-01
      C: ws.players[1].id,   // p-02
      "1B": null, "2B": null, "3B": null, SS: null, LF: null, CF: null, RF: null,
    };
    scenario.assignments.lineup = [
      ws.players[2].id, ws.players[3].id, ws.players[4].id, // p-03, p-04, p-05
      null, null, null, null, null,
    ];

    const team = initializeFromScenario(ws, scenario);
    assert.equal(team.defense["P"], ws.players[0].id);
    assert.equal(team.defense["C"], ws.players[1].id);
    assert.equal(team.lineup[0], ws.players[2].id);
    assert.ok(team.bench.length > 0, "Should have bench players");
  });
});
