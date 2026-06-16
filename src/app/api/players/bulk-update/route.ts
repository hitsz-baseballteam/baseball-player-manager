import { NextResponse } from "next/server";
import { z } from "zod";

import {
  enforceWorkspaceWritePreconditions,
  jsonError,
  parseBody,
  readJsonBodyWithLimit,
  versionSchema,
} from "@/app/api/_workspace-api";
import { applyBulkEdit } from "@/lib/roster-actions";
import { mutateWorkspaceSnapshot } from "@/lib/workspace-store";
import type { BulkEditInput } from "@/lib/roster-actions";
import type { Workspace } from "@/lib/workspace";

const bulkUpdateSchema = z.object({
  version: versionSchema,
  ids: z.array(z.string()).min(1),
  input: z.object({
    status: z.enum(["keep", "available", "rest", "injured", "graduated"]),
    bats: z.enum(["keep", "R", "L", "S"]),
    throws: z.enum(["keep", "R", "L", "S"]),
    positionMode: z.enum(["keep", "append", "replace", "remove"]),
    positions: z.array(z.enum(["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"])),
  }),
});

export async function POST(request: Request) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, bulkUpdateSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      applyBulkEdit(next, parsed.data.ids, parsed.data.input as BulkEditInput);
      return next as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}
