import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDefaultWorkspace } from "@/lib/workspace";
import {
  buildWorkspaceWriteRows,
  getOrCreateWorkspaceSnapshot,
} from "@/lib/workspace-store";

// ---------------------------------------------------------------------------
// P1-1 — unnest batch INSERT helper
// ---------------------------------------------------------------------------
describe("prepareUnnestArgs", () => {
  it("converts player objects to unnest-ready column arrays", async () => {
    const { prepareUnnestArgs } = await import("@/lib/workspace-store");

    const players = createDefaultWorkspace(false).players;
    const result = prepareUnnestArgs(players, "players");

    assert.ok(Array.isArray(result));
    // Each element is an array representing one column
    assert.ok(result.length > 0);
    assert.equal(result[0]?.length, players.length);
  });

  it("handles empty arrays gracefully", async () => {
    const { prepareUnnestArgs } = await import("@/lib/workspace-store");

    const result = prepareUnnestArgs([], "players");

    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  it("handles single-row arrays", async () => {
    const { prepareUnnestArgs } = await import("@/lib/workspace-store");

    const workspace = createDefaultWorkspace(false);
    const singlePlayer = workspace.players.slice(0, 1);
    const result = prepareUnnestArgs(singlePlayer, "players");

    assert.ok(result.length > 0);
    assert.equal(result[0]?.length, 1);
  });

  it("handles position rows with player_id and position_code columns", async () => {
    const { prepareUnnestArgs } = await import("@/lib/workspace-store");

    const workspace = createDefaultWorkspace(false);
    const positions = workspace.players.flatMap((p) =>
      p.positions.map((pos) => ({ playerId: p.id, positionCode: pos })),
    );
    const result = prepareUnnestArgs(positions, "positions");

    assert.ok(Array.isArray(result));
    if (positions.length > 0) {
      assert.equal(result[0]?.length, positions.length);
    }
  });

  it("handles milestone rows with date, title, description fields", async () => {
    const { prepareUnnestArgs } = await import("@/lib/workspace-store");

    const workspace = createDefaultWorkspace(false);
    const result = prepareUnnestArgs(workspace.milestones, "milestones");

    assert.ok(Array.isArray(result));
    if (workspace.milestones.length > 0) {
      assert.ok(result.length > 0);
    }
  });
});

describe("buildWorkspaceWriteRows", () => {
  it("flattens a workspace into per-table batch rows", () => {
    const workspace = createDefaultWorkspace(false);
    const firstPlayerId = workspace.players[0]?.id ?? "player-1";

    workspace.games = [
      {
        id: "game-1",
        date: "2026-06-17",
        opponent: "Sharks",
        gameType: "official",
        totalInnings: 7,
        note: "Batch insert smoke test",
        innings: [{ inning: 1, hits: 1, runs: 0, batters: [firstPlayerId] }],
        statLines: [
          {
            playerId: firstPlayerId,
            pa: 1,
            ab: 1,
            h: 1,
            doubles: 0,
            triples: 0,
            hr: 0,
            rbi: 0,
            r: 1,
            sb: 0,
            bb: 0,
            hbp: 0,
            sf: 0,
            so: 0,
            ip: null,
            er: null,
            soPitching: null,
            bbPitching: null,
            hPitching: null,
            po: 0,
            a: 0,
            e: 0,
            w: 0,
            l: 0,
            sv: 0,
            np: 0,
          },
        ],
      },
    ];
    workspace.milestones = [
      {
        id: "ms-1",
        date: "2026-06-18",
        title: "First win",
        description: "Captured after the opener",
        mediaUrl: "https://example.com/photo.jpg",
      },
    ];

    const rows = buildWorkspaceWriteRows("ws-1", workspace);

    assert.equal(rows.players.length, workspace.players.length);
    assert.equal(
      rows.positions.length,
      workspace.players.reduce((count, player) => count + player.positions.length, 0),
    );
    assert.equal(rows.scenarios.length, workspace.scenarios.length);
    assert.equal(
      rows.defenseAssignments.length,
      workspace.scenarios.reduce(
        (count, scenario) => count + Object.keys(scenario.assignments.defense).length,
        0,
      ),
    );
    assert.equal(
      rows.lineupSlots.length,
      workspace.scenarios.reduce((count, scenario) => count + scenario.assignments.lineup.length, 0),
    );
    assert.equal(rows.games.length, 1);
    assert.equal(rows.innings.length, 1);
    assert.equal(rows.statLines.length, 1);
    assert.equal(rows.milestones.length, 1);
    assert.deepEqual(rows.innings[0]?.batters, [firstPlayerId]);
    assert.equal(rows.players[0]?.workspaceId, "ws-1");
    assert.equal(rows.games[0]?.note, "Batch insert smoke test");
  });

  it("keeps scenario batch columns aligned with the actual table shape", async () => {
    const { prepareUnnestArgs } = await import("@/lib/workspace-store");
    const workspace = createDefaultWorkspace(false);
    const rows = buildWorkspaceWriteRows("ws-1", workspace);

    assert.equal(prepareUnnestArgs(rows.scenarios, "scenarios").length, 7);
  });
});

// ---------------------------------------------------------------------------
// P1-2 — unstable_cache wrapping for getOrCreateWorkspaceSnapshot
// ---------------------------------------------------------------------------
describe("getOrCreateWorkspaceSnapshot caching", () => {
  it("is a function", () => {
    assert.equal(typeof getOrCreateWorkspaceSnapshot, "function");
  });

  it("returns a promise-like value when called", async () => {
    // Without DATABASE_URL configured, the call will reject, but the
    // function itself must return a Promise (the contract of the cache wrapper).
    const result = getOrCreateWorkspaceSnapshot();
    assert.ok(result instanceof Promise);
    try {
      await result;
    } catch {
      // Expected: DATABASE_URL not configured — ignore for API contract test
    }
  });

  it("returns a stable export (consistent reference across re-loads)", async () => {
    const mod1 = await import("@/lib/workspace-store");
    const mod2 = await import("@/lib/workspace-store");

    // Both imports should refer to the same module instance.
    // After unstable_cache wrapping, the cached function reference
    // is the same across calls within the same process.
    assert.equal(mod1.getOrCreateWorkspaceSnapshot, mod2.getOrCreateWorkspaceSnapshot);
  });
});

// ---------------------------------------------------------------------------
// P1-3 — REPEATABLE READ isolation for write transactions
// ---------------------------------------------------------------------------
describe("write transaction isolation", () => {
  it("wrapWriteTransaction sets REPEATABLE READ for write transactions", async () => {
    const { wrapWriteTransaction } = await import("@/lib/workspace-store");

    // Simulate a mock client that records SQL statements
    const recordedStatements: string[] = [];
    const mockClient = {
      query: async (sql: string) => {
        recordedStatements.push(sql);
        return { rows: [] };
      },
    };

    const work = async () => {
      // Simulate actual DB work
      return { success: true };
    };

    const result = await wrapWriteTransaction(mockClient as never, work);

    assert.ok(result.success);
    assert.ok(
      recordedStatements.some((sql) =>
        sql.toUpperCase().includes("REPEATABLE READ"),
      ),
    );
  });

  it("read transactions do NOT set REPEATABLE READ", async () => {
    const { wrapReadTransaction } = await import("@/lib/workspace-store");

    const recordedStatements: string[] = [];
    const mockClient = {
      query: async (sql: string) => {
        recordedStatements.push(sql);
        return { rows: [] };
      },
    };

    const work = async () => ({ success: true });

    await wrapReadTransaction(mockClient as never, work);

    assert.equal(
      recordedStatements.some((sql) =>
        sql.toUpperCase().includes("REPEATABLE READ"),
      ),
      false,
    );
  });
});
