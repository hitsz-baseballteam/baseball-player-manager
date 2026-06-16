import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

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
