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
import { sanitizePlayers, sanitizeScenario, type Workspace } from "@/lib/workspace";

const createScenarioSchema = z.object({
  version: versionSchema,
  scenario: workspaceObjectSchema,
  activate: z.boolean().optional(),
});

export async function POST(request: Request) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, createScenarioSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  let result;
  try {
    result = await mutateWorkspaceSnapshot({
      version: parsed.data.version,
      mutate(current) {
        const validPlayerIds = new Set(sanitizePlayers(current.players).map((player) => player.id));
        const scenario = sanitizeScenario(parsed.data.scenario, validPlayerIds);
        if (!scenario) {
          throw new Error("invalid_payload");
        }

        const next = structuredClone(current);
        next.scenarios.push(scenario);
        if (parsed.data.activate) {
          next.activeScenarioId = scenario.id;
        }
        return next as Workspace;
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_payload") {
      return jsonError(400, "invalid_payload");
    }
    throw error;
  }

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}
