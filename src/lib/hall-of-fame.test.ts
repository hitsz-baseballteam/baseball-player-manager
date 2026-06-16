import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { isInducted, getInductees, computeSeasonBadges } from "@/lib/hall-of-fame";
import type { Game, Player, PlayerGameStatLine, Workspace } from "@/lib/workspace";

// ── Helpers ──

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "测试球员",
    number: "99",
    throws: "R",
    bats: "R",
    positions: ["CF"],
    status: "available",
    profile: {
      profileType: "fielder",
      age: null,
      heightCm: null,
      weightKg: null,
      fastballTopKmh: null,
      fastballAvgKmh: null,
      armStrengthM: null,
      thirtyMeterSec: null,
      pitchTypes: [],
      scoutingSummary: "",
      radar: {
        pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: { contact: null, power: null, speed: null, arm: null, defense: null, instinct: null },
      },
    },
    ...overrides,
  };
}

function statLine(playerId: string, overrides: Partial<PlayerGameStatLine> = {}): PlayerGameStatLine {
  return {
    playerId,
    pa: 4, ab: 4, h: 2, doubles: 0, triples: 0, hr: 1, rbi: 2, r: 1, sb: 0, bb: 0, hbp: 0, sf: 0, so: 1,
    ip: null, er: null, soPitching: null, bbPitching: null, hPitching: null,
    po: 3, a: 1, e: 0,
    w: 0, l: 0, sv: 0, np: 0,
    ...overrides,
  };
}

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: "g1",
    date: "2026-06-01",
    opponent: "Reds",
    gameType: "official",
    totalInnings: 9,
    innings: [],
    statLines: [],
    ...overrides,
  };
}

function workspace(players: Player[], games: Game[]): Workspace {
  return {
    version: 3,
    players,
    scenarios: [],
    activeScenarioId: "",
    games,
    milestones: [],
    preferences: { helpDismissed: false },
  };
}

// ── isInducted ──

describe("isInducted", () => {
  it("returns false for players without joinedAt", () => {
    const p = player();
    const g = game({ statLines: [statLine("p1")] });
    assert.strictEqual(isInducted(p, [g]), false);
  });

  it("returns false for players with invalid joinedAt", () => {
    const p = player({ joinedAt: "not-a-date" });
    assert.strictEqual(isInducted(p, []), false);
  });

  it("returns false for recently joined players (< 90 days)", () => {
    const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const p = player({ joinedAt: recentDate });
    const g = game({ statLines: [statLine("p1")] });
    assert.strictEqual(isInducted(p, [g]), false);
  });

  it("returns false for veteran players with 0 official games", () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const p = player({ joinedAt: oldDate });
    // Only training games, no official games
    const g = game({ gameType: "training", statLines: [statLine("p1")] });
    assert.strictEqual(isInducted(p, [g]), false);
  });

  it("returns true for qualifying player (joined 90+ days ago + 1 official game)", () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const p = player({ joinedAt: oldDate });
    const g = game({ gameType: "official", statLines: [statLine("p1")] });
    assert.strictEqual(isInducted(p, [g]), true);
  });

  it("accepts custom now date for testing", () => {
    const joinedDate = "2025-01-01T00:00:00.000Z";
    const p = player({ joinedAt: joinedDate });
    const g = game({ gameType: "official", statLines: [statLine("p1")] });
    // 95 days after join
    const now = new Date("2025-04-06T00:00:00.000Z");
    assert.strictEqual(isInducted(p, [g], now), true);
    // 30 days after join — not enough
    const earlyNow = new Date("2025-01-31T00:00:00.000Z");
    assert.strictEqual(isInducted(p, [g], earlyNow), false);
  });
});

// ── getInductees ──

describe("getInductees", () => {
  it("returns empty array when no players qualify", () => {
    const ws = workspace([player()], []);
    assert.deepStrictEqual(getInductees(ws), []);
  });

  it("returns inductees sorted by games played desc", () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const p1 = player({ id: "p1", name: "Player1", joinedAt: oldDate });
    const p2 = player({ id: "p2", name: "Player2", joinedAt: oldDate });
    const games = [
      game({ id: "g1", statLines: [statLine("p1", { h: 2, ab: 4 })] }),
      game({ id: "g2", statLines: [statLine("p1", { h: 1, ab: 3 })] }),
      game({ id: "g3", statLines: [statLine("p2", { h: 0, ab: 3 })] }),
    ];
    const ws = workspace([p1, p2], games);
    const inductees = getInductees(ws);
    assert.strictEqual(inductees.length, 2);
    // p1 has 2 games, should be first
    assert.strictEqual(inductees[0].player.id, "p1");
    assert.strictEqual(inductees[1].player.id, "p2");
  });

  it("includes pitching stats when player has pitched", () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const p = player({ id: "p1", joinedAt: oldDate, profile: { ...player().profile, profileType: "pitcher" } });
    const g = game({ statLines: [statLine("p1", { ip: 6, er: 2, soPitching: 5, w: 1 })] });
    const ws = workspace([p], [g]);
    const inductees = getInductees(ws);
    assert.strictEqual(inductees.length, 1);
    assert.notStrictEqual(inductees[0].pitching, null);
    assert.strictEqual(inductees[0].pitching!.W, 1);
  });
});

// ── computeSeasonBadges ──

describe("computeSeasonBadges", () => {
  it("returns empty array when player has no stat lines", () => {
    const p = player();
    const badges = computeSeasonBadges(p, []);
    assert.deepStrictEqual(badges, []);
  });

  it("awards hit king badge when player leads in hits", () => {
    const p1 = player({ id: "p1", name: "Leader" });
    const games = [
      game({ id: "g1", date: "2026-06-01", statLines: [
        statLine("p1", { h: 3, ab: 4 }),
        statLine("p2", { h: 1, ab: 4 }),
      ]}),
    ];
    const badges = computeSeasonBadges(p1, games);
    const hitBadge = badges.find((b) => b.award === "hitKing");
    assert.notStrictEqual(hitBadge, undefined);
    assert.strictEqual(hitBadge!.season, "2026");
    assert.strictEqual(hitBadge!.statValue, "3");
  });

  it("awards hr king badge when player leads in HR", () => {
    const p1 = player({ id: "p1" });
    const games = [
      game({ id: "g1", date: "2026-06-01", statLines: [
        statLine("p1", { h: 2, hr: 3, ab: 4 }),
        statLine("p2", { h: 1, hr: 0, ab: 4 }),
      ]}),
    ];
    const badges = computeSeasonBadges(p1, games);
    const hrBadge = badges.find((b) => b.award === "hrKing");
    assert.notStrictEqual(hrBadge, undefined);
    assert.strictEqual(hrBadge!.statValue, "3");
  });

  it("does not award badge when leader has zero in that category", () => {
    const p1 = player({ id: "p1" });
    const games = [
      game({ id: "g1", date: "2026-06-01", statLines: [
        statLine("p1", { h: 0, hr: 0, rbi: 0, ab: 4 }),
      ]}),
    ];
    const badges = computeSeasonBadges(p1, games);
    // hitKing, hrKing, rbiKing all have value 0 → no badges
    assert.strictEqual(badges.filter((b) => b.award === "hrKing").length, 0);
  });
});
