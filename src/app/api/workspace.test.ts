import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import { createPasscodeHash, createUnlockCookieValue } from "@/lib/auth";
import { clearRateLimits } from "@/lib/rate-limiter";
import { WORKSPACE_REQUEST_MAX_BYTES } from "@/lib/schemas";
import { createDefaultWorkspace } from "@/lib/workspace";

const fakeWorkspace = createDefaultWorkspace(false);

let GET: (request: Request) => Promise<Response>;
let PUT: (request: Request) => Promise<Response>;
const row = {
  slug: "default",
  version: 5,
  data: fakeWorkspace,
  updated_at: new Date("2026-06-03T08:00:00.000Z"),
};

function fakePool() {
  return {
    query(queryText: string) {
      if (queryText.includes("update public.app_workspace")) {
        return Promise.resolve({ rows: [row] });
      }

      return Promise.resolve({ rows: [row] });
    },
  };
}

function buildCookieHeader() {
  return `${"baseball_manager_unlock"}=${createUnlockCookieValue()}`;
}

describe("workspace route", () => {
  beforeEach(async () => {
    process.env.AUTH_SECRET = "test-auth-secret";
    process.env.APP_ADMIN_PASSCODE_HASH = createPasscodeHash("test-passcode");
    process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/baseball_manager";
    clearRateLimits();

    mock.module("@/lib/db", {
      namedExports: { getPool: fakePool },
    });

    const route = await import("./workspace/route");
    GET = route.GET;
    PUT = route.PUT;
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.APP_ADMIN_PASSCODE_HASH;
    delete process.env.DATABASE_URL;
    clearRateLimits();
    mock.reset();
  });

  it("GET returns workspace snapshot", async () => {
    const response = await GET(
      new Request("http://localhost/api/workspace", {
        headers: { cookie: buildCookieHeader() },
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.version, 5);
    assert.ok(Array.isArray(body.workspace.players));
  });

  it("PUT saves and returns updated snapshot", async () => {
    const request = new Request("http://localhost/api/workspace", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: buildCookieHeader(),
      },
      body: JSON.stringify({ workspace: fakeWorkspace, version: 5 }),
    });
    const response = await PUT(request);
    assert.equal(response.status, 200);
  });

  it.todo("PUT returns 409 on version conflict");

  it("PUT returns 400 on invalid payload", async () => {
    const request = new Request("http://localhost/api/workspace", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: buildCookieHeader(),
      },
      body: JSON.stringify({ workspace: "bad" }),
    });
    const response = await PUT(request);
    assert.equal(response.status, 400);
  });

  it("PUT returns 413 when content-length exceeds the workspace limit", async () => {
    const response = await PUT(
      new Request("http://localhost/api/workspace", {
        method: "PUT",
        headers: {
          "content-length": String(WORKSPACE_REQUEST_MAX_BYTES + 1),
          "content-type": "application/json",
          cookie: buildCookieHeader(),
        },
        body: "{}",
      }),
    );
    assert.equal(response.status, 413);
  });

  it("GET returns 429 after exceeding the workspace read limit", async () => {
    const cookie = buildCookieHeader();
    for (let i = 0; i < 120; i++) {
      const response = await GET(
        new Request("http://localhost/api/workspace", {
          headers: {
            cookie,
            "x-forwarded-for": "10.0.0.7",
          },
        }),
      );
      assert.equal(response.status, 200);
    }

    const response = await GET(
      new Request("http://localhost/api/workspace", {
        headers: {
          cookie,
          "x-forwarded-for": "10.0.0.7",
        },
      }),
    );
    assert.equal(response.status, 429);
  });
});
