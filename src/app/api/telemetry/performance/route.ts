import { NextResponse } from "next/server";

import { parsePerformanceMetric } from "@/lib/performance-telemetry";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(request: Request) {
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";

  if (!checkRateLimit(`performance:${clientKey}`, 120, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const metric = parsePerformanceMetric(input);
  if (!metric) {
    return NextResponse.json({ error: "invalid_metric" }, { status: 400 });
  }

  console.log(JSON.stringify({
    level: "info",
    event: "panel_performance_metric",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    ...metric,
  }));

  return new NextResponse(null, { status: 204 });
}
