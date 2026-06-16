import { NextResponse } from "next/server";
import { z } from "zod";

import {
  enforceWorkspaceWritePreconditions,
  jsonError,
  parseBody,
  readJsonBodyWithLimit,
  versionSchema,
} from "@/app/api/_workspace-api";
import { deletePlayers } from "@/lib/roster-actions";
import { mutateWorkspaceSnapshot } from "@/lib/workspace-store";
import type { Workspace } from "@/lib/workspace";

const bulkDeleteSchema = z.object({
  version: versionSchema,
  ids: z.array(z.string()).min(1),
});

export async function POST(request: Request) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, bulkDeleteSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      deletePlayers(next, parsed.data.ids);
      return next as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}
