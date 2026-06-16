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
import { sanitizeMilestone, type Workspace } from "@/lib/workspace";

const patchMilestoneSchema = z.object({
  version: versionSchema,
  milestone: workspaceObjectSchema,
});

const deleteMilestoneSchema = z.object({
  version: versionSchema,
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ milestoneId: string }> },
) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, patchMilestoneSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { milestoneId } = await context.params;
  const milestone = sanitizeMilestone(parsed.data.milestone);
  if (!milestone || milestone.id !== milestoneId) {
    return jsonError(400, "invalid_payload");
  }

  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      const index = next.milestones.findIndex((candidate) => candidate.id === milestoneId);
      if (index >= 0) {
        next.milestones[index] = milestone;
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
  context: { params: Promise<{ milestoneId: string }> },
) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, deleteMilestoneSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { milestoneId } = await context.params;
  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      next.milestones = next.milestones.filter((candidate) => candidate.id !== milestoneId);
      return next as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}
