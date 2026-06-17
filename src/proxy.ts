import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { readUnlockSession, UNLOCK_COOKIE_NAME } from "@/lib/auth";
import { PANEL_ROUTES } from "@/lib/routes";

export const PROTECTED_API_MATCHERS = [
  "/api/workspace/:path*",
  "/api/players/:path*",
  "/api/scenarios/:path*",
  "/api/games/:path*",
  "/api/milestones/:path*",
] as const;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const unlockCookie = request.cookies.get(UNLOCK_COOKIE_NAME)?.value;
  const session = readUnlockSession(unlockCookie);

  if (session) {
    return NextResponse.next();
  }

  if (pathname === PANEL_ROUTES.login) {
    return NextResponse.next();
  }

  if (pathname.startsWith(PANEL_ROUTES.home) && pathname !== PANEL_ROUTES.login) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = PANEL_ROUTES.login;
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export const config = {
  matcher: [
    "/panel/:path*",
    "/api/workspace/:path*",
    "/api/players/:path*",
    "/api/scenarios/:path*",
    "/api/games/:path*",
    "/api/milestones/:path*",
  ],
};
