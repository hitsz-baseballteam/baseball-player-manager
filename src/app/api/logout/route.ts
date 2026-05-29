import { NextResponse } from "next/server";

import { UNLOCK_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
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
