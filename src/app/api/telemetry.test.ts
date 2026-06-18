import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { POST } from "@/app/api/telemetry/performance/route";
import { clearRateLimits } from "@/lib/rate-limiter";

describe("performance telemetry route", () => {
  afterEach(() => {
    clearRateLimits();
    mock.restoreAll();
  });

  it("accepts a valid metric without returning a body", async () => {
    const log = mock.method(console, "log", () => undefined);
    const response = await POST(new Request("http://localhost/api/telemetry/performance", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({ name: "LCP", value: 800, route: "/panel/stats", rating: "good" }),
    }));

    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    assert.equal(log.mock.callCount(), 1);
  });

  it("rejects invalid metrics", async () => {
    const response = await POST(new Request("http://localhost/api/telemetry/performance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "PASSWORD", value: 1, route: "/panel" }),
    }));

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_metric" });
  });
});
