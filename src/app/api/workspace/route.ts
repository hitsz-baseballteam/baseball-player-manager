import { NextResponse } from "next/server";

import {
  readCookieValue,
  readUnlockSession,
  UNLOCK_COOKIE_NAME,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { WORKSPACE_REQUEST_MAX_BYTES, workspacePutSchema } from "@/lib/schemas";
import type { Workspace } from "@/lib/workspace";
import { getOrCreateWorkspaceSnapshot, updateWorkspaceSnapshot } from "@/lib/workspace-store";

const WORKSPACE_GET_LIMIT = { maxRequests: 120, windowMs: 60_000 };
const WORKSPACE_PUT_LIMIT = { maxRequests: 30, windowMs: 60_000 };

function getRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function getWorkspaceRateLimitKey(request: Request) {
  const cookieValue = readCookieValue(
    request.headers.get("cookie"),
    UNLOCK_COOKIE_NAME,
  );
  const session = readUnlockSession(cookieValue);
  const sessionId = session?.sid ?? "anonymous";
  return `${getRequestIp(request)}:${sessionId}`;
}

async function readJsonBodyWithLimit(request: Request) {
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

export async function GET(request: Request) {
  if (
    !checkRateLimit(
      `workspace:get:${getWorkspaceRateLimitKey(request)}`,
      WORKSPACE_GET_LIMIT.maxRequests,
      WORKSPACE_GET_LIMIT.windowMs,
    )
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const snapshot = await getOrCreateWorkspaceSnapshot();
  return NextResponse.json(snapshot);
}

export async function PUT(request: Request) {
  if (
    !checkRateLimit(
      `workspace:put:${getWorkspaceRateLimitKey(request)}`,
      WORKSPACE_PUT_LIMIT.maxRequests,
      WORKSPACE_PUT_LIMIT.windowMs,
    )
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsedBody = await readJsonBodyWithLimit(request);
  if (parsedBody.error === "payload_too_large") {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  if (parsedBody.error === "invalid_payload") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const raw = parsedBody.raw;
  const parsed = workspacePutSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { workspace, version } = parsed.data;

  // sanitizeWorkspace is called inside updateWorkspaceSnapshot; cast here for type alignment
  const result = await updateWorkspaceSnapshot({
    workspace: workspace as Workspace,
    version,
  });
  if (!result) {
    return NextResponse.json({ error: "version_conflict" }, { status: 409 });
  }

  return NextResponse.json(result);
}
