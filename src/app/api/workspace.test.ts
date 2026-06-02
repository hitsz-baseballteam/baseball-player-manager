import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { createDefaultWorkspace } from "@/lib/workspace";

const fakeWorkspace = createDefaultWorkspace(false);

let GET: () => Promise<Response>;
let PUT: (request: Request) => Promise<Response>;

describe("workspace route", () => {
  beforeEach(async () => {
    // Set env so Pool constructor doesn't throw
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";

    // Mock Pool.prototype.connect BEFORE db.ts creates its pool.
    // db.ts is imported lazily inside the route module import chain,
    // so this mock is in place when the pool is first created.
    const fakeClient = {
      query: mock.fn(async (_sql: string, params?: unknown[]) => {
        // workspace-store passes version as last param for UPDATE.
        // If version != 5, return 0 rows (simulate conflict).
        if (params && params.length >= 2) {
          const lastVal = params[params.length - 1];
          if (typeof lastVal === "number" && lastVal !== 5) {
            return { rows: [] };
          }
        }
        return {
          rows: [{
            id: "ws-1", slug: "default", version: 5,
            data: fakeWorkspace,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-06-02T00:00:00.000Z",
          }],
        };
      }),
      release: mock.fn(() => {}),
    };

    mock.method(pg.Pool.prototype, "connect", () => Promise.resolve(fakeClient as never));

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

  it("PUT returns 409 on version conflict", async () => {
    const request = new Request("http://localhost/api/workspace", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: fakeWorkspace, version: 3 }),
    });

    const response = await PUT(request);
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.error, "version_conflict");
  });

  it("PUT returns 400 on invalid payload", async () => {
    const request = new Request("http://localhost/api/workspace", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: "bad" }),
    });

    const response = await PUT(request);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "invalid_payload");
  });
});
