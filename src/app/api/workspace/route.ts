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
  // Keep browser and CDN caches disabled for this authenticated endpoint.
  // We still get the performance benefit from the server-side Next cache in
  // `getOrCreateWorkspaceSnapshot`, but avoid serving stale private data
  // after logout or session expiry.
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Cloudflare-CDN-Cache-Control": "no-store",
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
