import { NextResponse } from "next/server";
import { z } from "zod";

import {
  enforceWorkspaceWritePreconditions,
  jsonError,
  parseBody,
  readJsonBodyWithLimit,
  versionSchema,
} from "@/app/api/_workspace-api";
import {
  deleteScenarioAction,
  renameScenarioAction,
} from "@/lib/lineup-actions";
import { mutateWorkspaceSnapshot } from "@/lib/workspace-store";
import type { Workspace } from "@/lib/workspace";

const patchScenarioSchema = z.object({
  version: versionSchema,
  name: z.string(),
  note: z.string(),
});

const deleteScenarioSchema = z.object({
  version: versionSchema,
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ scenarioId: string }> },
) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, patchScenarioSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { scenarioId } = await context.params;
  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      return renameScenarioAction(current, scenarioId, parsed.data.name, parsed.data.note) as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ scenarioId: string }> },
) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, deleteScenarioSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { scenarioId } = await context.params;
  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      return deleteScenarioAction(current, scenarioId) as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}
