import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createDefaultWorkspace } from "@/lib/workspace";

const fakeWorkspace = createDefaultWorkspace(false);

let GET: () => Promise<Response>;
let PUT: (request: Request) => Promise<Response>;
const row = {
  id: "ws-1",
  slug: "default",
  version: 5,
  data: fakeWorkspace,
  created_at: "",
  updated_at: "",
};

function fakeSupabaseAdmin() {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve({ data: row, error: null });
                },
              };
            },
          };
        },
        upsert() {
          return {
            select() {
              return {
                returns() {
                  return Promise.resolve({ data: [row], error: null });
                },
              };
            },
          };
        },
        update() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    select() {
                      return {
                        returns() {
                          return Promise.resolve({ data: [row], error: null });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("workspace route", () => {
  beforeEach(async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

    mock.module("@/lib/supabase", {
      namedExports: { getSupabaseAdmin: fakeSupabaseAdmin },
    });

    const route = await import("./workspace/route");
    GET = route.GET;
    PUT = route.PUT;
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
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
