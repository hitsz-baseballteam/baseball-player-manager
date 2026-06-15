import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { checkRateLimit, clearRateLimits } from "./rate-limiter";

describe("rate limiter", () => {
  beforeEach(() => {
    clearRateLimits();
  });

  it("allows requests within limit", () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(checkRateLimit("test-1", 5, 60_000), true);
    }
  });

  it("blocks requests beyond limit", () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(checkRateLimit("test-2", 5, 60_000), true);
    }
    assert.equal(checkRateLimit("test-2", 5, 60_000), false);
  });

  it("uses separate counters per key", () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(checkRateLimit("test-a", 5, 60_000), true);
    }
    assert.equal(checkRateLimit("test-b", 5, 60_000), true);
    assert.equal(checkRateLimit("test-a", 5, 60_000), false);
  });

  it("clears counters when requested", () => {
    assert.equal(checkRateLimit("test-reset", 1, 60_000), true);
    assert.equal(checkRateLimit("test-reset", 1, 60_000), false);
    clearRateLimits();
    assert.equal(checkRateLimit("test-reset", 1, 60_000), true);
  });
});
