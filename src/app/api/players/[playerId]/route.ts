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
import { deletePlayers } from "@/lib/roster-actions";

const updatePlayerSchema = z.object({
  version: versionSchema,
  player: workspaceObjectSchema,
});

const deletePlayerSchema = z.object({
  version: versionSchema,
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ playerId: string }> },
) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, updatePlayerSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { playerId } = await context.params;
  const player = sanitizePlayers([parsed.data.player])[0];
  if (!player || player.id !== playerId) {
    return jsonError(400, "invalid_payload");
  }

  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      const index = next.players.findIndex((candidate) => candidate.id === playerId);
      if (index >= 0) {
        next.players[index] = player;
      }
      return next as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ playerId: string }> },
) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, deletePlayerSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { playerId } = await context.params;
  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      deletePlayers(next, [playerId]);
      return next as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}
