import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

let POST: (request: Request) => Promise<Response>;

describe("logout route", () => {
  beforeEach(async () => {
    const mod = await import("./logout/route");
    POST = mod.POST;
    const { clearRateLimits } = await import("@/lib/rate-limiter");
    clearRateLimits();
  });

  afterEach(async () => {
    const { clearRateLimits } = await import("@/lib/rate-limiter");
    clearRateLimits();
  });

  it("returns 204 and clears the unlock cookie", async () => {
    const response = await POST(new Request("http://localhost/api/logout", { method: "POST" }));
    assert.equal(response.status, 204);
    assert.match(response.headers.getSetCookie()[0] ?? "", /Max-Age=0/i);
  });

  it("returns 429 after exceeding the logout limit", async () => {
    for (let i = 0; i < 20; i++) {
      const response = await POST(
        new Request("http://localhost/api/logout", {
          method: "POST",
          headers: { "x-forwarded-for": "10.0.0.9" },
        }),
      );
      assert.equal(response.status, 204);
    }

    const response = await POST(
      new Request("http://localhost/api/logout", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.9" },
      }),
    );
    assert.equal(response.status, 429);
  });
});
