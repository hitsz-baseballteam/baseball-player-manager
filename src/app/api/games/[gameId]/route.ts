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
import { sanitizeGame, type Workspace } from "@/lib/workspace";

const updateGameSchema = z.object({
  version: versionSchema,
  game: workspaceObjectSchema,
});

const deleteGameSchema = z.object({
  version: versionSchema,
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, updateGameSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { gameId } = await context.params;
  const game = sanitizeGame(parsed.data.game);
  if (!game || game.id !== gameId) {
    return jsonError(400, "invalid_payload");
  }

  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      const index = next.games.findIndex((candidate) => candidate.id === gameId);
      if (index >= 0) {
        next.games[index] = game;
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
  context: { params: Promise<{ gameId: string }> },
) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, deleteGameSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { gameId } = await context.params;
  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      next.games = next.games.filter((game) => game.id !== gameId);
      return next as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}
