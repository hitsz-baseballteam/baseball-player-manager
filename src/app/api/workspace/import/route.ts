import { NextResponse } from "next/server";
import { z } from "zod";

import {
  enforceWorkspaceWritePreconditions,
  jsonError,
  parseBody,
  readJsonBodyWithLimit,
  versionSchema,
  workspaceObjectSchema,
} from "@/app/api/_workspace-api";
import { replaceWorkspaceSnapshot } from "@/lib/workspace-store";
import type { Workspace } from "@/lib/workspace";
import { sanitizeWorkspace } from "@/lib/workspace";

const importWorkspaceSchema = z.object({
  version: versionSchema,
  workspace: workspaceObjectSchema,
});

export async function POST(request: Request) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, importWorkspaceSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const result = await replaceWorkspaceSnapshot({
    version: parsed.data.version,
    workspace: sanitizeWorkspace(parsed.data.workspace as Workspace),
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}
