import { NextResponse } from "next/server";

import { enforceWorkspaceReadRateLimit } from "@/app/api/_workspace-api";
import { getGamesWorkspace } from "@/lib/workspace-store";

export async function GET(request: Request) {
  const rateLimited = enforceWorkspaceReadRateLimit(request);
  if (rateLimited) return rateLimited;

  const snapshot = await getGamesWorkspace();
  return NextResponse.json(snapshot);
}
