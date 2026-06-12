import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { createDefaultWorkspace } from "@/lib/workspace";
import {
  VersionConflictError,
  saveWithRetry,
} from "@/lib/workspace-client";

describe("workspace client", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("saveWithRetry sends the initial workspace on the first attempt", async () => {
    const initialWorkspace = createDefaultWorkspace(false);
    let requestBody: { workspace: unknown; version: number } | null = null;

    mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body ?? "")) as {
        workspace: unknown;
        version: number;
      };
      return new Response(
        JSON.stringify({
          workspace: initialWorkspace,
          version: 2,
          updatedAt: "2026-06-03T09:00:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const result = await saveWithRetry(initialWorkspace, 1, (latest) => latest);

    assert.ok(requestBody, "requestBody should be set by mock fetch");
    const body = requestBody as { workspace: unknown; version: number };
    assert.equal(body.version, 1);
    assert.deepEqual(body.workspace, initialWorkspace);
    assert.equal(result.version, 2);
  });

  it("saveWithRetry reloads latest workspace and retries after version conflict", async () => {
    const initialWorkspace = createDefaultWorkspace(false);
    const latestWorkspace = createDefaultWorkspace(false);
    latestWorkspace.players[0].name = "最新球员";

    const putBodies: Array<{ workspace: unknown; version: number }> = [];
    let callCount = 0;

    mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      callCount += 1;
      const url = String(input);

      if (callCount === 1) {
        putBodies.push(JSON.parse(String(init?.body ?? "")) as { workspace: unknown; version: number });
        return new Response(JSON.stringify({ error: "version_conflict" }), { status: 409 });
      }

      if (callCount === 2) {
        assert.equal(url, "/api/workspace");
        return new Response(
          JSON.stringify({
            workspace: latestWorkspace,
            version: 7,
            updatedAt: "2026-06-03T09:10:00.000Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      putBodies.push(JSON.parse(String(init?.body ?? "")) as { workspace: unknown; version: number });
      return new Response(
        JSON.stringify({
          workspace: latestWorkspace,
          version: 8,
          updatedAt: "2026-06-03T09:11:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const result = await saveWithRetry(initialWorkspace, 1, (latest) => {
      const next = structuredClone(latest);
      next.preferences.helpDismissed = true;
      return next;
    });

    assert.equal(putBodies.length, 2);
    assert.deepEqual(putBodies[0].workspace, initialWorkspace);
    assert.equal(putBodies[0].version, 1);
    assert.equal(putBodies[1].version, 7);
    assert.equal(result.version, 8);
  });

  it("treats 409 responses as VersionConflictError", async () => {
    const initialWorkspace = createDefaultWorkspace(false);

    mock.method(globalThis, "fetch", async () => {
      return new Response(JSON.stringify({ error: "version_conflict" }), { status: 409 });
    });

    await assert.rejects(
      () => saveWithRetry(initialWorkspace, 1, (latest) => latest, 0),
      VersionConflictError,
    );
  });
});
