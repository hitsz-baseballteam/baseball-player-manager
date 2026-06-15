import { z } from "zod";

// ── API request schemas ──

export const WORKSPACE_REQUEST_MAX_BYTES = 512 * 1024;

export const workspacePutSchema = z.object({
  workspace: z.record(z.string(), z.unknown()).refine(
    (val) => typeof val === "object" && val !== null && !Array.isArray(val),
    { message: "workspace must be a non-null object" },
  ),
  version: z.number().int().positive("version must be a positive integer"),
});

export const unlockPostSchema = z.object({
  passcode: z.string().min(1, "passcode is required"),
});

export type WorkspacePutBody = z.infer<typeof workspacePutSchema>;
export type UnlockPostBody = z.infer<typeof unlockPostSchema>;
