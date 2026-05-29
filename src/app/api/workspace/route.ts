import { NextResponse } from "next/server";

import { getOrCreateWorkspaceSnapshot, updateWorkspaceSnapshot } from "@/lib/workspace-store";
import { sanitizeWorkspace } from "@/lib/workspace";

export async function GET() {
  const snapshot = await getOrCreateWorkspaceSnapshot();
  return NextResponse.json(snapshot);
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { workspace?: unknown; version?: unknown }
    | null;

  if (
    !body ||
    typeof body.version !== "number" ||
    !body.workspace ||
    typeof body.workspace !== "object"
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const result = await updateWorkspaceSnapshot({
    workspace: sanitizeWorkspace(body.workspace),
    version: body.version,
  });

  if (!result) {
    return NextResponse.json({ error: "version_conflict" }, { status: 409 });
  }

  return NextResponse.json(result);
}
