import { NextResponse } from "next/server";

import {
  createUnlockCookieValue,
  verifyPasscode,
  UNLOCK_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(request: Request) {
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
