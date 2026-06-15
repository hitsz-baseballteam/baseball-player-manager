"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createUnlockCookieValue,
  verifyPasscode,
  UNLOCK_COOKIE_NAME,
  UNLOCK_SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { normalizePanelNextPath, PANEL_ROUTES } from "@/lib/routes";

export async function unlockAction(formData: FormData): Promise<void> {
  const next = formData.get("next")?.toString() ?? PANEL_ROUTES.home;
  const destination = normalizePanelNextPath(next);
  const passcode = formData.get("passcode")?.toString() ?? "";

  // Rate limiting — read IP from forwarded headers
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(`unlock:${ip}`, 5, 60_000)) {
    redirect(
      `/panel/login?error=rate_limited&next=${encodeURIComponent(next)}`,
    );
  }

  if (!verifyPasscode(passcode)) {
    redirect(
      `/panel/login?error=invalid_passcode&next=${encodeURIComponent(next)}`,
    );
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: UNLOCK_COOKIE_NAME,
    value: createUnlockCookieValue(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UNLOCK_SESSION_MAX_AGE_SECONDS,
  });

  redirect(destination);
}
