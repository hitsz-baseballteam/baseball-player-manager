import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

describe("getPanelWorkspaceSnapshot", () => {
  afterEach(() => {
    mock.reset();
  });

  // TODO: React's `cache()` is a no-op passthrough in the production React
  // build used by node:test (the dedup logic lives in the Next.js Server
  // Components runtime). This dedup contract is enforced at runtime by
  // Next.js but cannot be exercised in a unit test. Mark as todo; verify
  // via integration test in a real Server Component render.
  it.todo("deduplicates same-request calls via React cache()");

  it.skip("deduplicates same-request calls via React cache()", async () => {
    let callCount = 0;

    mock.module("@/lib/workspace-store", {
      namedExports: {
        getOrCreateWorkspaceSnapshot: async () => {
          callCount += 1;
          return {
            workspace: {
              version: 1,
              players: [],
              scenarios: [],
              games: [],
              milestones: [],
              activeScenarioId: "",
              preferences: { helpDismissed: false },
            },
            version: 1,
            updatedAt: "2026-06-17T00:00:00.000Z",
          };
        },
      },
    });

    mock.module("next/headers", {
      namedExports: {
        cookies: () => ({
          get: () => ({ value: "test-cookie" }),
        }),
      },
    });

    mock.module("@/lib/auth", {
      namedExports: {
        readUnlockSession: () => true,
        UNLOCK_COOKIE_NAME: "baseball_manager_unlock",
      },
    });

    mock.module("next/navigation", {
      namedExports: {
        redirect: (_url: string): never => {
          throw new Error("NEXT_REDIRECT");
        },
      },
    });

    const { getPanelWorkspaceSnapshot } = await import("@/lib/panel-server");

    // Call twice in the same "request" (same microtask context)
    await getPanelWorkspaceSnapshot("/panel");
    await getPanelWorkspaceSnapshot("/panel");

    // Without React cache(): callCount === 2 → assertion fails (RED)
    // With React cache(): callCount === 1 → assertion passes (GREEN)
    assert.equal(callCount, 1);
  });

  it("is an async function that returns a WorkspaceSnapshot-like object", async () => {
    mock.module("@/lib/workspace-store", {
      namedExports: {
        getOrCreateWorkspaceSnapshot: async () => ({
          workspace: {
            version: 1,
            players: [],
            scenarios: [],
            games: [],
            milestones: [],
            activeScenarioId: "",
            preferences: { helpDismissed: false },
          },
          version: 1,
          updatedAt: "2026-06-17T00:00:00.000Z",
        }),
      },
    });

    mock.module("next/headers", {
      namedExports: {
        cookies: () => ({
          get: () => ({ value: "test-cookie" }),
        }),
      },
    });

    mock.module("@/lib/auth", {
      namedExports: {
        readUnlockSession: () => true,
        UNLOCK_COOKIE_NAME: "baseball_manager_unlock",
      },
    });

    mock.module("next/navigation", {
      namedExports: {
        redirect: (_url: string): never => {
          throw new Error("NEXT_REDIRECT");
        },
      },
    });

    const { getPanelWorkspaceSnapshot } = await import("@/lib/panel-server");

    const result = await getPanelWorkspaceSnapshot("/panel");

    assert.ok(result);
    assert.equal(typeof result.version, "number");
    assert.equal(typeof result.updatedAt, "string");
    assert.ok(result.workspace);
  });
});
