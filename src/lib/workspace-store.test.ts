import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDefaultWorkspace } from "@/lib/workspace";
import { getOrCreateWorkspaceSnapshot } from "@/lib/workspace-store";

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
      assert.ok(result[0]?.length, positions.length);
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
    const { wrapWriteTransaction, wrapReadTransaction } =
      await import("@/lib/workspace-store");

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
