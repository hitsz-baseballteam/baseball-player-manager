import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { computeBattingLine, computePitchingLine, computeFieldingLine } from "@/lib/stats";
import type { Game, PlayerGameStatLine } from "@/lib/workspace";

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: "game-1",
    date: "2026-06-01",
    opponent: "Reds",
    gameType: "official",
    totalInnings: 9,
    innings: [],
    statLines: [],
    ...overrides,
  };
}

function battingSl(playerId: string, overrides: Partial<PlayerGameStatLine> = {}): PlayerGameStatLine {
  return {
    playerId,
    pa: 4, ab: 4, h: 2, hr: 1, rbi: 2, r: 1, sb: 0, bb: 0, so: 1,
    ip: null, er: null, soPitching: null, bbPitching: null, hPitching: null,
    po: 3, a: 1, e: 0,
    ...overrides,
  };
}

function pitchingSl(playerId: string, overrides: Partial<PlayerGameStatLine> = {}): PlayerGameStatLine {
  return {
    playerId,
    pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, r: 0, sb: 0, bb: 0, so: 0,
    ip: 6, er: 2, soPitching: 5, bbPitching: 1, hPitching: 4,
    po: 0, a: 2, e: 0,
    ...overrides,
  };
}

describe("computeBattingLine", () => {
  it("returns zeros for empty game list", () => {
    const line = computeBattingLine([], "p1");
    assert.strictEqual(line.G, 0);
    assert.strictEqual(line.AVG, ".000");
  });

  it("filters games by playerId", () => {
    const g = game({ statLines: [battingSl("p1", { h: 3, ab: 10 })] });
    const line = computeBattingLine([g], "p1");
    assert.strictEqual(line.AVG, ".300");
  });

  it("ignores games where player didn't appear", () => {
    const g = game({ statLines: [battingSl("p2", { h: 3, ab: 10 })] });
    const line = computeBattingLine([g], "p1");
    assert.strictEqual(line.G, 0);
  });

  it("accumulates across multiple games", () => {
    const games = [
      game({ statLines: [battingSl("p1", { h: 1, ab: 4, hr: 0, rbi: 1, bb: 1, pa: 5 })] }),
      game({ statLines: [battingSl("p1", { h: 2, ab: 3, hr: 1, rbi: 3, bb: 0, pa: 4 })] }),
    ];
    const line = computeBattingLine(games, "p1");
    assert.strictEqual(line.G, 2);
    assert.strictEqual(line.AB, 7);
    assert.strictEqual(line.H, 3);
    assert.strictEqual(line.HR, 1);
    assert.strictEqual(line.RBI, 4);
    assert.strictEqual(line.BB, 1);
    assert.strictEqual(line.PA, 9);
    assert.strictEqual(line.AVG, ".429");
    assert.strictEqual(line.OBP, ".444");
  });
});

describe("computePitchingLine", () => {
  it("returns zeros for empty game list", () => {
    const line = computePitchingLine([], "p1");
    assert.strictEqual(line.G, 0);
    assert.strictEqual(line.ERA, "0.00");
  });

  it("computes ERA from game statlines filtered by playerId", () => {
    const g = game({ statLines: [pitchingSl("p1", { ip: 6, er: 2 })] });
    const line = computePitchingLine([g], "p1");
    assert.strictEqual(line.ERA, "3.00");
  });

  it("handles IP notation 5.2 = 5⅔", () => {
    const g = game({ statLines: [pitchingSl("p1", { ip: 5.2, er: 3 })] });
    const line = computePitchingLine([g], "p1");
    assert.strictEqual(line.IP, "5.2");
    assert.strictEqual(line.ERA, "4.76");
  });

  it("computes WHIP = (BB+H) / IP", () => {
    const g = game({ statLines: [pitchingSl("p1", { ip: 6, bbPitching: 1, hPitching: 4 })] });
    const line = computePitchingLine([g], "p1");
    assert.strictEqual(line.WHIP, "0.83");
  });
});

describe("computeFieldingLine", () => {
  it("returns zeros for empty game list", () => {
    const line = computeFieldingLine([], "p1");
    assert.strictEqual(line.G, 0);
    assert.strictEqual(line.FPCT, ".000");
  });

  it("computes FPCT = (PO + A) / TC", () => {
    const g = game({ statLines: [battingSl("p1", { po: 12, a: 4, e: 1 })] });
    const line = computeFieldingLine([g], "p1");
    assert.strictEqual(line.PO, 12);
    assert.strictEqual(line.A, 4);
    assert.strictEqual(line.E, 1);
    assert.strictEqual(line.TC, 17);
    // FPCT = (12+4)/17 = 16/17 = .941
    assert.strictEqual(line.FPCT, ".941");
  });

  it("handles perfect fielding", () => {
    const g = game({ statLines: [battingSl("p1", { po: 5, a: 2, e: 0 })] });
    const line = computeFieldingLine([g], "p1");
    assert.strictEqual(line.FPCT, "1.000");
  });

  it("accumulates across games", () => {
    const games = [
      game({ statLines: [battingSl("p1", { po: 3, a: 1, e: 0 })] }),
      game({ statLines: [battingSl("p1", { po: 2, a: 0, e: 1 })] }),
    ];
    const line = computeFieldingLine(games, "p1");
    assert.strictEqual(line.PO, 5);
    assert.strictEqual(line.A, 1);
    assert.strictEqual(line.E, 1);
    assert.strictEqual(line.TC, 7);
    assert.strictEqual(line.FPCT, ".857");
  });
});
