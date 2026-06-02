import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

let POST: (request: Request) => Promise<Response>;

describe("unlock route", () => {
  beforeEach(async () => {
    process.env.APP_ADMIN_PASSCODE = "test-passcode";
    // Re-import to pick up fresh env + rate limiter state
    const mod = await import("./unlock/route");
    POST = mod.POST;
  });

  afterEach(() => {
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
    // Fire 5 successful requests (different IPs wouldn't hit limit,
    // but repeated same-IP requests within the window will)
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
});
