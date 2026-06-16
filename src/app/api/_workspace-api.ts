import { NextResponse } from "next/server";
import { z } from "zod";

import {
  readCookieValue,
  readUnlockSession,
  UNLOCK_COOKIE_NAME,
} from "@/lib/auth";
import { isMaintenanceReadOnly } from "@/lib/maintenance";
import { checkRateLimit } from "@/lib/rate-limiter";
import { WORKSPACE_REQUEST_MAX_BYTES } from "@/lib/schemas";

const WORKSPACE_READ_LIMIT = { maxRequests: 120, windowMs: 60_000 };
const WORKSPACE_WRITE_LIMIT = { maxRequests: 30, windowMs: 60_000 };

export const versionSchema = z.number().int().positive("version must be a positive integer");
export const workspaceObjectSchema = z.record(z.string(), z.unknown()).refine(
  (val) => typeof val === "object" && val !== null && !Array.isArray(val),
  { message: "workspace must be a non-null object" },
);

export function getRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function getWorkspaceRateLimitKey(request: Request) {
  const cookieValue = readCookieValue(
    request.headers.get("cookie"),
    UNLOCK_COOKIE_NAME,
  );
  const session = readUnlockSession(cookieValue);
  const sessionId = session?.sid ?? "anonymous";
  return `${getRequestIp(request)}:${sessionId}`;
}

export function enforceWorkspaceReadRateLimit(request: Request) {
  if (
    !checkRateLimit(
      `workspace:get:${getWorkspaceRateLimitKey(request)}`,
      WORKSPACE_READ_LIMIT.maxRequests,
      WORKSPACE_READ_LIMIT.windowMs,
    )
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  return null;
}

export function enforceWorkspaceWritePreconditions(request: Request) {
  if (isMaintenanceReadOnly()) {
    return NextResponse.json({ error: "maintenance_read_only" }, { status: 503 });
  }

  if (
    !checkRateLimit(
      `workspace:put:${getWorkspaceRateLimitKey(request)}`,
      WORKSPACE_WRITE_LIMIT.maxRequests,
      WORKSPACE_WRITE_LIMIT.windowMs,
    )
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  return null;
}

export async function readJsonBodyWithLimit(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > WORKSPACE_REQUEST_MAX_BYTES) {
    return { error: "payload_too_large" as const };
  }

  const text = await request.text().catch(() => null);
  if (text === null) {
    return { error: "invalid_payload" as const };
  }

  if (Buffer.byteLength(text, "utf8") > WORKSPACE_REQUEST_MAX_BYTES) {
    return { error: "payload_too_large" as const };
  }

  try {
    return { raw: JSON.parse(text) as unknown };
  } catch {
    return { error: "invalid_payload" as const };
  }
}

export function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json(details ? { error, details } : { error }, { status });
}

export function parseBody<T extends z.ZodTypeAny>(
  raw: unknown,
  schema: T,
): { success: true; data: z.infer<T> } | { success: false; response: NextResponse } {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      response: jsonError(400, "invalid_payload", parsed.error.flatten()),
    };
  }

  return { success: true, data: parsed.data };
}
