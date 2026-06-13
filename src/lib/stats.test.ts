import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { computeBattingLine, computePitchingLine } from "@/lib/stats";
import type { GameRecord } from "@/lib/workspace";

const g = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: "game-1",
  date: "2026-06-01",
  opponent: "Reds",
  gameType: "official",
  pa: 4,
  ab: 4,
  h: 2,
  hr: 1,
  rbi: 2,
  r: 1,
  sb: 0,
  bb: 0,
  so: 1,
  ip: null,
  er: null,
  soPitching: null,
  bbPitching: null,
  hPitching: null,
  ...overrides,
});

describe("computeBattingLine", () => {
  it("returns zeros for empty game list", () => {
    const line = computeBattingLine([]);
    assert.strictEqual(line.G, 0);
    assert.strictEqual(line.AVG, ".000");
    assert.strictEqual(line.OBP, ".000");
    assert.strictEqual(line.SLG, ".000");
    assert.strictEqual(line.OPS, ".000");
  });

  it("handles 0 AB correctly", () => {
    const line = computeBattingLine([g({ ab: 0, h: 0, pa: 0 })]);
    assert.strictEqual(line.AVG, ".000");
    assert.strictEqual(line.OBP, ".000");
    assert.strictEqual(line.SLG, ".000");
    assert.strictEqual(line.OPS, ".000");
  });

  it("computes AVG = H / AB", () => {
    const line = computeBattingLine([g({ h: 3, ab: 10 })]);
    assert.strictEqual(line.AVG, ".300");
  });

  it("rounds AVG to 3 decimals without leading zero", () => {
    const line = computeBattingLine([g({ h: 1, ab: 3 })]);
    assert.strictEqual(line.AVG, ".333");
  });

  it("computes OBP = (H + BB) / PA", () => {
    const line = computeBattingLine([
      g({ h: 2, bb: 2, pa: 8, ab: 6 }),
    ]);
    // OBP = (2+2)/8 = 4/8 = .500
    assert.strictEqual(line.OBP, ".500");
  });

  it("computes SLG using singles-only estimate for non-HR hits", () => {
    // 1 game: 2 H, 1 HR → TB = 2 + 3*1 = 5, AB = 5 → SLG = 5/5 = 1.000
    const line = computeBattingLine([g({ h: 2, hr: 1, ab: 5 })]);
    assert.strictEqual(line.SLG, "1.000");
  });

  it("accumulates across multiple games", () => {
    const line = computeBattingLine([
      g({ h: 1, ab: 4, hr: 0, rbi: 1, bb: 1, pa: 5 }),
      g({ h: 2, ab: 3, hr: 1, rbi: 3, bb: 0, pa: 4 }),
    ]);
    assert.strictEqual(line.G, 2);
    assert.strictEqual(line.AB, 7);
    assert.strictEqual(line.H, 3);
    assert.strictEqual(line.HR, 1);
    assert.strictEqual(line.RBI, 4);
    assert.strictEqual(line.BB, 1);
    assert.strictEqual(line.PA, 9);
    // AVG = 3/7 = .429
    assert.strictEqual(line.AVG, ".429");
    // OBP = (3+1)/9 = .444
    assert.strictEqual(line.OBP, ".444");
    // SLG = (3+3)/7 = .857
    assert.strictEqual(line.SLG, ".857");
  });

  it("perfect game: 1.000 across the board", () => {
    const line = computeBattingLine([g({ h: 4, ab: 4, hr: 4, pa: 4 })]);
    assert.strictEqual(line.AVG, "1.000");
    assert.strictEqual(line.OBP, "1.000");
    // TB = 4 + 3*4 = 16, SLG = 16/4 = 4.000
    assert.strictEqual(line.SLG, "4.000");
  });
});

describe("computePitchingLine", () => {
  const pg = (overrides: Partial<GameRecord> = {}): GameRecord => ({
    id: "game-1",
    date: "2026-06-01",
    opponent: "Reds",
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
    ip: 6,
    er: 2,
    soPitching: 5,
    bbPitching: 1,
    hPitching: 4,
    ...overrides,
  });

  it("returns zeros for empty game list", () => {
    const line = computePitchingLine([]);
    assert.strictEqual(line.G, 0);
    assert.strictEqual(line.IP, "0.0");
    assert.strictEqual(line.ERA, "0.00");
    assert.strictEqual(line.WHIP, "0.00");
  });

  it("handles 0 IP correctly", () => {
    const line = computePitchingLine([pg({ ip: 0 })]);
    assert.strictEqual(line.ERA, "0.00");
    assert.strictEqual(line.WHIP, "0.00");
    assert.strictEqual(line.K9, "0.00");
  });

  it("handles null IP correctly", () => {
    const line = computePitchingLine([pg({ ip: null })]);
    assert.strictEqual(line.ERA, "0.00");
  });

  it("computes ERA = (ER * 9) / IP", () => {
    // 6 IP, 2 ER → ERA = (2*9)/6 = 18/6 = 3.00
    const line = computePitchingLine([pg({ ip: 6, er: 2 })]);
    assert.strictEqual(line.ERA, "3.00");
  });

  it("computes WHIP = (BB + H) / IP", () => {
    // 6 IP, 1 BB, 4 H → WHIP = 5/6 = 0.83
    const line = computePitchingLine([pg({ ip: 6, bbPitching: 1, hPitching: 4 })]);
    assert.strictEqual(line.WHIP, "0.83");
  });

  it("handles IP notation: 5.2 = 5⅔ IP", () => {
    // 5.2 IP = 5 + 2/3 = 5.667, 3 ER → ERA = (3*9)/5.667 = 4.76
    const line = computePitchingLine([pg({ ip: 5.2, er: 3 })]);
    assert.strictEqual(line.IP, "5.2");
    assert.strictEqual(line.ERA, "4.76");
  });

  it("handles IP notation: 7.1 = 7⅓ IP", () => {
    const line = computePitchingLine([pg({ ip: 7.1, er: 0, bbPitching: 0, hPitching: 0, soPitching: 0 })]);
    assert.strictEqual(line.IP, "7.1");
    assert.strictEqual(line.ERA, "0.00");
  });

  it("rounds IP outs correctly when total is exactly 3", () => {
    // 5.2 + 5.1 = 5⅔ + 5⅓ = 11.0 (exactly 11 IP, not 10.3)
    const line = computePitchingLine([
      pg({ ip: 5.2, er: 0, hPitching: 1, bbPitching: 0, soPitching: 0 }),
      pg({ ip: 5.1, er: 0, hPitching: 0, bbPitching: 0, soPitching: 0 }),
    ]);
    assert.strictEqual(line.IP, "11.0");
  });

  it("accumulates across multiple pitching appearances", () => {
    const line = computePitchingLine([
      pg({ ip: 5, er: 0, soPitching: 4, bbPitching: 2, hPitching: 3 }),
      pg({ ip: 4, er: 2, soPitching: 3, bbPitching: 1, hPitching: 5 }),
    ]);
    assert.strictEqual(line.G, 2);
    assert.strictEqual(line.IP, "9.0");
    assert.strictEqual(line.ER, 2);
    assert.strictEqual(line.SO, 7);
    assert.strictEqual(line.BB, 3);
    assert.strictEqual(line.H, 8);
    // ERA = (2*9)/9 = 2.00
    assert.strictEqual(line.ERA, "2.00");
    // WHIP = (3+8)/9 = 11/9 = 1.22
    assert.strictEqual(line.WHIP, "1.22");
  });
});
