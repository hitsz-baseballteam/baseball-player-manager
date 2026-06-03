import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createDefaultWorkspace } from "@/lib/workspace";

const fakeWorkspace = createDefaultWorkspace(false);

let GET: () => Promise<Response>;
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

describe("workspace route", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/baseball_manager";

    mock.module("@/lib/db", {
      namedExports: { getPool: fakePool },
    });

    const route = await import("./workspace/route");
    GET = route.GET;
    PUT = route.PUT;
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    mock.reset();
  });

  it("GET returns workspace snapshot", async () => {
    const response = await GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.version, 5);
    assert.ok(Array.isArray(body.workspace.players));
  });

  it("PUT saves and returns updated snapshot", async () => {
    const request = new Request("http://localhost/api/workspace", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: fakeWorkspace, version: 5 }),
    });
    const response = await PUT(request);
    assert.equal(response.status, 200);
  });

  it.todo("PUT returns 409 on version conflict");

  it("PUT returns 400 on invalid payload", async () => {
    const request = new Request("http://localhost/api/workspace", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: "bad" }),
    });
    const response = await PUT(request);
    assert.equal(response.status, 400);
  });
});
