import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isUnlockCookieValid, UNLOCK_COOKIE_NAME } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const unlockCookie = request.cookies.get(UNLOCK_COOKIE_NAME)?.value;
  if (isUnlockCookieValid(unlockCookie)) {
    return NextResponse.next();
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export const config = {
  matcher: ["/api/workspace/:path*"],
};
