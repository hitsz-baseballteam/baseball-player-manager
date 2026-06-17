import { NextResponse } from "next/server";

import {
  enforceWorkspaceReadRateLimit,
  enforceWorkspaceWritePreconditions,
} from "@/app/api/_workspace-api";
import { getOrCreateWorkspaceSnapshot } from "@/lib/workspace-store";

export async function GET(request: Request) {
  const rateLimited = enforceWorkspaceReadRateLimit(request);
  if (rateLimited) {
    return rateLimited;
  }

  const snapshot = await getOrCreateWorkspaceSnapshot();
  // Short browser cache: 10s fresh + 30s SWR. Combined with
  // `unstable_cache` server-side (10s revalidate, tag "workspace"),
  // repeated reads within the window skip both the DB and the network.
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
    },
  });
}

export async function PUT(request: Request) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
