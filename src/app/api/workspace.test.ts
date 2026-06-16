import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import { clearRateLimits } from "@/lib/rate-limiter";
import { WORKSPACE_REQUEST_MAX_BYTES } from "@/lib/schemas";
import { createDefaultWorkspace } from "@/lib/workspace";

const fakeWorkspace = createDefaultWorkspace(false);

let GET: (request: Request) => Promise<Response>;
let PUT: (request: Request) => Promise<Response>;

describe("workspace route", () => {
  beforeEach(async () => {
    clearRateLimits();

    mock.module("@/lib/workspace-store", {
      namedExports: {
        async getOrCreateWorkspaceSnapshot() {
          return {
            workspace: fakeWorkspace,
            version: 5,
            updatedAt: "2026-06-03T08:00:00.000Z",
          };
        },
      },
    });

    const route = await import("./workspace/route");
    GET = route.GET;
    PUT = route.PUT;
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_READ_ONLY;
    clearRateLimits();
    mock.reset();
  });

  it("GET returns workspace snapshot", async () => {
    const response = await GET(new Request("http://localhost/api/workspace"));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.version, 5);
    assert.ok(Array.isArray(body.workspace.players));
  });

  it("PUT returns 405 after cutover", async () => {
    const request = new Request("http://localhost/api/workspace", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ workspace: fakeWorkspace, version: 5 }),
    });
    const response = await PUT(request);
    assert.equal(response.status, 405);
  });

  it("PUT ignores payload shape and still returns 405", async () => {
    const request = new Request("http://localhost/api/workspace", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ workspace: "bad" }),
    });
    const response = await PUT(request);
    assert.equal(response.status, 405);
  });

  it("PUT returns 405 even when content-length exceeds the workspace limit", async () => {
    const response = await PUT(
      new Request("http://localhost/api/workspace", {
        method: "PUT",
        headers: {
          "content-length": String(WORKSPACE_REQUEST_MAX_BYTES + 1),
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    assert.equal(response.status, 405);
  });

  it("PUT returns 503 in maintenance read-only mode", async () => {
    process.env.MAINTENANCE_READ_ONLY = "1";
    const response = await PUT(
      new Request("http://localhost/api/workspace", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    assert.equal(response.status, 503);
  });

  it("GET returns 429 after exceeding the workspace read limit", async () => {
    for (let i = 0; i < 120; i += 1) {
      const response = await GET(
        new Request("http://localhost/api/workspace", {
          headers: {
            "x-forwarded-for": "10.0.0.7",
          },
        }),
      );
      assert.equal(response.status, 200);
    }

    const response = await GET(
      new Request("http://localhost/api/workspace", {
        headers: {
          "x-forwarded-for": "10.0.0.7",
        },
      }),
    );
    assert.equal(response.status, 429);
  });
});
