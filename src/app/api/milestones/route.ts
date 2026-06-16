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
import { createMilestone, sanitizeMilestone, type Workspace } from "@/lib/workspace";
import { mutateWorkspaceSnapshot } from "@/lib/workspace-store";

const createMilestoneSchema = z.object({
  version: versionSchema,
  milestone: workspaceObjectSchema.optional(),
  date: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  mediaUrl: z.string().optional(),
});

export async function POST(request: Request) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, createMilestoneSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const milestone =
    (parsed.data.milestone ? sanitizeMilestone(parsed.data.milestone) : null) ??
    (parsed.data.date && parsed.data.title
      ? createMilestone(
          parsed.data.date,
          parsed.data.title,
          parsed.data.description ?? "",
          parsed.data.mediaUrl,
        )
      : null);
  if (!milestone) {
    return jsonError(400, "invalid_payload");
  }

  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      next.milestones.push(milestone);
      return next as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}
