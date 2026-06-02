import { NextResponse } from "next/server";

import {
  createUnlockCookieValue,
  verifyPasscode,
  UNLOCK_COOKIE_NAME,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(`unlock:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as
    | { passcode?: string }
    | null;

  if (!body?.passcode || !verifyPasscode(body.passcode)) {
    return NextResponse.json({ error: "invalid_passcode" }, { status: 401 });
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({
    name: UNLOCK_COOKIE_NAME,
    value: createUnlockCookieValue(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
