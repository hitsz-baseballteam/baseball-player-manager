import { NextResponse } from "next/server";

import type { Workspace } from "@/lib/workspace";
import { getOrCreateWorkspaceSnapshot, updateWorkspaceSnapshot } from "@/lib/workspace-store";
import { workspacePutSchema } from "@/lib/schemas";
export async function GET() {
  const snapshot = await getOrCreateWorkspaceSnapshot();
  return NextResponse.json(snapshot);
}

export async function PUT(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = workspacePutSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { workspace, version } = parsed.data;

  // sanitizeWorkspace is called inside updateWorkspaceSnapshot; cast here for type alignment
  const result = await updateWorkspaceSnapshot({
    workspace: workspace as Workspace,
    version,
  });
  if (!result) {
    return NextResponse.json({ error: "version_conflict" }, { status: 409 });
  }

  return NextResponse.json(result);
}
