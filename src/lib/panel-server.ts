import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readUnlockSession, UNLOCK_COOKIE_NAME } from "@/lib/auth";
import { PANEL_ROUTES } from "@/lib/routes";
import { getOrCreateWorkspaceSnapshot } from "@/lib/workspace-store";

/**
 * Read the panel workspace snapshot for the current request.
 *
 * Wrapped in React's `cache()` so that within a single Server Component
 * render, multiple call sites share one DB round-trip. Without `cache()`,
 * every Server Component that reads the workspace would re-query the DB
 * (9 SELECTs per call). With `cache()`, the call is deduplicated by
 * pathname.
 */
export const getPanelWorkspaceSnapshot = cache(
  async (pathname: string) => {
    const cookieStore = await cookies();
    const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;

    if (!readUnlockSession(unlockCookie)) {
      redirect(
        `${PANEL_ROUTES.login}?next=${encodeURIComponent(pathname)}`,
      );
    }

    return getOrCreateWorkspaceSnapshot();
  },
);
