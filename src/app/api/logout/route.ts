import { NextResponse } from "next/server";

import { UNLOCK_COOKIE_NAME } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(`logout:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({
    name: UNLOCK_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
