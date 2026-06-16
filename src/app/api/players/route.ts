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
import { mutateWorkspaceSnapshot } from "@/lib/workspace-store";
import { sanitizePlayers, type Workspace } from "@/lib/workspace";

const createPlayerSchema = z.object({
  version: versionSchema,
  player: workspaceObjectSchema,
});

export async function POST(request: Request) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, createPlayerSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const player = sanitizePlayers([parsed.data.player])[0];
  if (!player) {
    return jsonError(400, "invalid_payload");
  }

  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      next.players.push(player);
      return next as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}
