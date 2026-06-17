import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { act, cleanup, renderHook } from "@testing-library/react";

import { WORKSPACE_SWR_KEY } from "@/lib/workspace-client";

import { createDefaultWorkspace } from "@/lib/workspace";
import {
  VersionConflictError,
  submitMutationWithRetry,
} from "@/lib/workspace-client";

describe("workspace client", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("submitMutationWithRetry submits the initial mutation on the first attempt", async () => {
    const initialWorkspace = createDefaultWorkspace(false);
    const submitted: Array<{ workspace: unknown; version: number }> = [];

    const result = await submitMutationWithRetry(
      initialWorkspace,
      1,
      (latest) => {
        const next = structuredClone(latest);
        next.preferences.helpDismissed = true;
        return next;
      },
      async (workspace, version) => {
        submitted.push({ workspace, version });
        return {
          workspace,
          version: version + 1,
          updatedAt: "2026-06-03T09:00:00.000Z",
        };
      },
    );

    assert.equal(submitted.length, 1);
    assert.equal(submitted[0]?.version, 1);
    assert.equal(
      (submitted[0]?.workspace as typeof initialWorkspace).preferences.helpDismissed,
      true,
    );
    assert.equal(result.version, 2);
  });

  it("submitMutationWithRetry reloads latest workspace and retries after version conflict", async () => {
    const initialWorkspace = createDefaultWorkspace(false);
    const latestWorkspace = createDefaultWorkspace(false);
    latestWorkspace.players[0].name = "最新球员";

    const submitted: Array<{ workspace: typeof initialWorkspace; version: number }> = [];
    let submitCount = 0;

    mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      assert.equal(String(input), "/api/workspace");
      return new Response(
        JSON.stringify({
          workspace: latestWorkspace,
          version: 7,
          updatedAt: "2026-06-03T09:10:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const result = await submitMutationWithRetry(
      initialWorkspace,
      1,
      (latest) => {
        const next = structuredClone(latest);
        next.preferences.helpDismissed = true;
        return next;
      },
      async (workspace, version) => {
        submitCount += 1;
        submitted.push({ workspace, version });
        if (submitCount === 1) {
          throw new VersionConflictError();
        }

        return {
          workspace,
          version: version + 1,
          updatedAt: "2026-06-03T09:11:00.000Z",
        };
      },
    );

    assert.equal(submitted.length, 2);
    assert.equal(submitted[0]?.version, 1);
    assert.equal(submitted[1]?.version, 7);
    assert.equal(submitted[1]?.workspace.players[0]?.name, "最新球员");
    assert.equal(result.version, 8);
  });

  it("throws VersionConflictError after exhausting retries", async () => {
    const initialWorkspace = createDefaultWorkspace(false);

    await assert.rejects(
      () =>
        submitMutationWithRetry(
          initialWorkspace,
          1,
          (latest) => latest,
          async () => {
            throw new VersionConflictError();
          },
          0,
        ),
      VersionConflictError,
    );
  });
});

describe("useWorkspaceSnapshot", () => {
  afterEach(async () => {
    mock.restoreAll();
    cleanup();
    // The custom hook is per-instance state, but the SWR key constant
    // is exported for tests that want to assert against it. Nothing to
    // reset at this level.
    void WORKSPACE_SWR_KEY;
  });

  it("returns the initial workspace synchronously on first render", async () => {
    // useWorkspaceSnapshot does not exist yet — this test will fail with
    // TypeError when trying to call the undefined import (TDD red phase).
    const { useWorkspaceSnapshot } = await import("@/lib/workspace-client");
    const initial = createDefaultWorkspace(false);

    const { result } = renderHook(() => useWorkspaceSnapshot(initial));

    assert.deepEqual(result.current.data, initial);
    assert.equal(result.current.isLoading, false);
  });

  it("re-fetches after a successful mutation via mutate()", async () => {
    const { useWorkspaceSnapshot } = await import("@/lib/workspace-client");
    const initial = createDefaultWorkspace(false);
    const updated = createDefaultWorkspace(false);
    updated.preferences.helpDismissed = true;

    mock.method(globalThis, "fetch", async () => {
      return new Response(
        JSON.stringify({
          workspace: updated,
          version: 2,
          updatedAt: "2026-06-17T00:00:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const { result } = renderHook(() => useWorkspaceSnapshot(initial));

    await act(async () => {
      await result.current.mutate();
    });

    assert.ok(result.current.data);
    assert.equal(result.current.data.preferences.helpDismissed, true);
  });

  it("exposes a stable mutate function in the return value", async () => {
    const { useWorkspaceSnapshot } = await import("@/lib/workspace-client");
    const initial = createDefaultWorkspace(false);

    const { result, rerender } = renderHook(() => useWorkspaceSnapshot(initial));

    const firstMutate = result.current.mutate;
    rerender();
    assert.equal(result.current.mutate, firstMutate);
  });

  it("accepts new data via optimistic mutation without re-fetch", async () => {
    const { useWorkspaceSnapshot } = await import("@/lib/workspace-client");
    const initial = createDefaultWorkspace(false);
    const optimistic = createDefaultWorkspace(false);
    optimistic.preferences.helpDismissed = true;

    const { result } = renderHook(() => useWorkspaceSnapshot(initial));

    await act(async () => {
      await result.current.mutate(optimistic, { revalidate: false });
    });

    assert.ok(result.current.data);
    assert.equal(result.current.data.preferences.helpDismissed, true);
  });

  it("returns isLoading=true during the initial fetch when fallbackData is not provided", async () => {
    const { useWorkspaceSnapshot } = await import("@/lib/workspace-client");

    const { result } = renderHook(() => useWorkspaceSnapshot());

    assert.equal(result.current.isLoading, true);
  });

  it("auto-loads the workspace when fallbackData is not provided", async () => {
    const { useWorkspaceSnapshot } = await import("@/lib/workspace-client");
    const loaded = createDefaultWorkspace(false);
    loaded.preferences.helpDismissed = true;

    mock.method(globalThis, "fetch", async () => {
      return new Response(
        JSON.stringify({
          workspace: loaded,
          version: 3,
          updatedAt: "2026-06-17T00:00:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const { result } = renderHook(() => useWorkspaceSnapshot());

    await act(async () => {
      await Promise.resolve();
    });

    assert.deepEqual(result.current.data, loaded);
    assert.equal(result.current.version, 3);
    assert.equal(result.current.isLoading, false);
    assert.equal(result.current.error, undefined);
  });
});
