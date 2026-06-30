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
import { createDefaultPublicHomeConfig } from "@/lib/workspace/base";
import { sanitizePublicHomeConfig } from "@/lib/workspace/sanitizers";
import type { Workspace } from "@/lib/workspace";

const contactTypeSchema = z.enum(["wechat-group", "email", "social"]);
const memberToneSchema = z.enum(["captain", "vice", "manager", "active", "open"]);

const trainingInfoSchema = z.object({
  schedule: z.string().max(200),
  location: z.string().max(200),
  whatToBring: z.array(z.string().max(60)).max(20),
  whatWeProvide: z.array(z.string().max(60)).max(20),
  note: z.string().max(500),
});

const contactSchema = z.object({
  type: contactTypeSchema,
  label: z.string().max(60),
  value: z.string().max(200),
  href: z.string().max(500).optional(),
  qrImage: z.string().max(500).optional(),
});

const faqSchema = z.object({
  question: z.string().max(200),
  answer: z.string().max(500),
});

const historySchema = z.object({
  foundedYear: z.number().int().min(1900).max(2100).nullable(),
  story: z.string().max(1000),
  awards: z.array(z.string().max(200)).max(50),
});

const memberSchema = z.object({
  number: z.string().max(4),
  name: z.string().max(48),
  nickname: z.string().max(32).optional(),
  role: z.string().max(24),
  note: z.string().max(120),
  tone: memberToneSchema,
});

const feedsSchema = z.object({
  milestones: z.object({
    enabled: z.boolean(),
    maxCount: z.number().int().min(0).max(20),
  }),
  games: z.object({
    enabled: z.boolean(),
    maxCount: z.number().int().min(0).max(20),
    gameTypes: z.array(z.enum(["official", "training"])).max(2),
  }),
});

const publicHomeConfigSchema = z.object({
  training: trainingInfoSchema,
  contacts: z.array(contactSchema).max(20),
  faq: z.array(faqSchema).max(30),
  history: historySchema,
  members: z.array(memberSchema).max(60),
  feeds: feedsSchema,
});

const updatePreferencesSchema = z.object({
  version: versionSchema,
  helpDismissed: z.boolean().optional(),
  publicHomeConfig: publicHomeConfigSchema.optional(),
});

export async function PATCH(request: Request) {
  const precondition = enforceWorkspaceWritePreconditions(request);
  if (precondition) {
    return precondition;
  }

  const body = await readJsonBodyWithLimit(request);
  if (body.error === "payload_too_large") return jsonError(413, "payload_too_large");
  if (body.error === "invalid_payload") return jsonError(400, "invalid_payload");

  const parsed = parseBody(body.raw, updatePreferencesSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const defaults = createDefaultPublicHomeConfig();

  const result = await mutateWorkspaceSnapshot({
    version: parsed.data.version,
    mutate(current) {
      const next = structuredClone(current);
      if (typeof parsed.data.helpDismissed === "boolean") {
        next.preferences.helpDismissed = parsed.data.helpDismissed;
      }
      if (parsed.data.publicHomeConfig) {
        next.preferences.publicHomeConfig = sanitizePublicHomeConfig(
          parsed.data.publicHomeConfig,
        );
      }
      // Touch preferences to ensure the field is always present even when no flags changed.
      if (!next.preferences.publicHomeConfig) {
        next.preferences.publicHomeConfig = defaults;
      }
      return next as Workspace;
    },
  });

  if (!result) {
    return jsonError(409, "version_conflict");
  }

  return NextResponse.json(result);
}