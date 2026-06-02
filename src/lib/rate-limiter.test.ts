import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit } from "./rate-limiter";

describe("rate limiter", () => {
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
    // Different key should still be allowed
    assert.equal(checkRateLimit("test-b", 5, 60_000), true);
    // Original key should be blocked
    assert.equal(checkRateLimit("test-a", 5, 60_000), false);
  });
});
