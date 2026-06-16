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
  return NextResponse.json(snapshot);
}

export async function PUT(request: Request) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
