import { NextResponse } from "next/server";

import { enforceWorkspaceReadRateLimit } from "@/app/api/_workspace-api";
import { getMilestonesWorkspace } from "@/lib/workspace-store";

export async function GET(request: Request) {
  const rateLimited = enforceWorkspaceReadRateLimit(request);
  if (rateLimited) return rateLimited;

  const snapshot = await getMilestonesWorkspace();
  return NextResponse.json(snapshot);
}
