import { NextResponse } from "next/server";
import { z } from "zod";

import {
  enforceWorkspaceWritePreconditions,
  jsonError,
  parseBody,
  readJsonBodyWithLimit,
  versionSchema,
} from "@/app/api/_workspace-api";
import { mutateWorkspaceSnapshot } from "@/lib/workspace-store";
import {
  sanitizeAssignments,
  type Workspace,
} from "@/lib/workspace";

const assignmentsSchema = z.object({
  version: versionSchema,
  assignments: z.object({
    defense: z.record(z.string(), z.string().nullable()),
    lineup: z.array(z.string().nullable()),
  }),
  updatedAt: z.string().optional(),
});

export async function PUT(
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

  const parsed = parseBody(body.raw, assignmentsSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { scenarioId } = await context.params;
  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      const validIds = new Set(next.players.map((player) => player.id));
      const scenario = next.scenarios.find((candidate) => candidate.id === scenarioId);
      if (scenario) {
        scenario.assignments = sanitizeAssignments(parsed.data.assignments, validIds);
        scenario.updatedAt = parsed.data.updatedAt ?? new Date().toISOString();
      }
      return next as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}
