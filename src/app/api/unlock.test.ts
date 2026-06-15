import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

let POST: (request: Request) => Promise<Response>;
let createPasscodeHash: (passcode: string) => string;

describe("unlock route", () => {
  beforeEach(async () => {
    const auth = await import("@/lib/auth");
    createPasscodeHash = auth.createPasscodeHash;
    process.env.AUTH_SECRET = "test-auth-secret";
    process.env.APP_ADMIN_PASSCODE_HASH = createPasscodeHash("test-passcode");
    delete process.env.APP_ADMIN_PASSCODE;
    // Re-import to pick up fresh env + rate limiter state
    const mod = await import("./unlock/route");
    POST = mod.POST;
    const { clearRateLimits } = await import("@/lib/rate-limiter");
    clearRateLimits();
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.APP_ADMIN_PASSCODE_HASH;
    delete process.env.APP_ADMIN_PASSCODE;
  });

  it("returns 204 and sets cookie on correct passcode", async () => {
    const request = new Request("http://localhost/api/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode: "test-passcode" }),
    });

    const response = await POST(request);
    assert.equal(response.status, 204);

    const setCookie = response.headers.getSetCookie();
    assert.ok(setCookie.length > 0);
    assert.ok(setCookie[0].startsWith("baseball_manager_unlock="));
    assert.match(setCookie[0], /HttpOnly/i);
  });

  it("returns 401 on wrong passcode", async () => {
    const request = new Request("http://localhost/api/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode: "wrong" }),
    });

    const response = await POST(request);
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error, "invalid_passcode");
  });

  it("returns 401 on missing passcode", async () => {
    const request = new Request("http://localhost/api/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    assert.equal(response.status, 401);
  });

  it("returns 429 after exceeding rate limit", async () => {
    for (let i = 0; i < 5; i++) {
      const request = new Request("http://localhost/api/unlock", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "10.0.0.1",
        },
        body: JSON.stringify({ passcode: "test-passcode" }),
      });
      await POST(request);
    }

    const request = new Request("http://localhost/api/unlock", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.1",
      },
      body: JSON.stringify({ passcode: "test-passcode" }),
    });
    const response = await POST(request);
    assert.equal(response.status, 429);
    const body = await response.json();
    assert.equal(body.error, "rate_limited");
  });

  it("throws on legacy-only auth configuration", async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.APP_ADMIN_PASSCODE_HASH;
    process.env.APP_ADMIN_PASSCODE = "legacy-passcode";

    await assert.rejects(
      () =>
        POST(
          new Request("http://localhost/api/unlock", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ passcode: "legacy-passcode" }),
          }),
        ),
      /APP_ADMIN_PASSCODE is no longer supported/,
    );
  });
});
