export const PERFORMANCE_METRIC_NAMES = [
  "CLS",
  "FCP",
  "INP",
  "LCP",
  "TTFB",
  "DATA_CENTER_READY",
] as const;

export type PerformanceMetricName = (typeof PERFORMANCE_METRIC_NAMES)[number];

export type PerformanceMetricPayload = {
  name: PerformanceMetricName;
  value: number;
  route: string;
  rating?: "good" | "needs-improvement" | "poor";
  navigationType?: string;
};

const metricNames = new Set<string>(PERFORMANCE_METRIC_NAMES);
const ratings = new Set(["good", "needs-improvement", "poor"]);

export function parsePerformanceMetric(
  input: unknown,
): PerformanceMetricPayload | null {
  if (!input || typeof input !== "object") return null;

  const value = input as Record<string, unknown>;
  if (
    typeof value.name !== "string" ||
    !metricNames.has(value.name) ||
    typeof value.value !== "number" ||
    !Number.isFinite(value.value) ||
    value.value < 0 ||
    value.value > 300_000 ||
    typeof value.route !== "string" ||
    !value.route.startsWith("/panel") ||
    value.route.length > 120
  ) {
    return null;
  }

  const rating = typeof value.rating === "string" && ratings.has(value.rating)
    ? value.rating as PerformanceMetricPayload["rating"]
    : undefined;
  const navigationType = typeof value.navigationType === "string"
    ? value.navigationType.slice(0, 40)
    : undefined;

  return {
    name: value.name as PerformanceMetricName,
    value: Math.round(value.value * 100) / 100,
    route: value.route,
    ...(rating ? { rating } : {}),
    ...(navigationType ? { navigationType } : {}),
  };
}
