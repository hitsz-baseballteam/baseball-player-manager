import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePerformanceMetric } from "@/lib/performance-telemetry";

describe("performance telemetry", () => {
  it("accepts and normalizes an allow-listed metric", () => {
    assert.deepEqual(
      parsePerformanceMetric({
        name: "DATA_CENTER_READY",
        value: 1234.567,
        route: "/panel/stats",
        rating: "good",
      }),
      {
        name: "DATA_CENTER_READY",
        value: 1234.57,
        route: "/panel/stats",
        rating: "good",
      },
    );
  });

  it("rejects unknown metrics, invalid durations, and non-panel routes", () => {
    assert.equal(parsePerformanceMetric({ name: "SECRET", value: 1, route: "/panel" }), null);
    assert.equal(parsePerformanceMetric({ name: "LCP", value: -1, route: "/panel" }), null);
    assert.equal(parsePerformanceMetric({ name: "LCP", value: 1, route: "/" }), null);
  });
});
