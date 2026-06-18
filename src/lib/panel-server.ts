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
async function checkPanelAuth(pathname: string) {
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;

  if (!readUnlockSession(unlockCookie)) {
    redirect(
      `${PANEL_ROUTES.login}?next=${encodeURIComponent(pathname)}`,
    );
  }
}

async function loadPanelWorkspaceSnapshot(pathname: string) {
  await checkPanelAuth(pathname);
  return getOrCreateWorkspaceSnapshot();
}

async function loadPanelStatsSnapshot(pathname: string) {
  await checkPanelAuth(pathname);
  const startedAt = Date.now();

  try {
    const snapshot = await getOrCreateWorkspaceSnapshot();
    console.log(JSON.stringify({
      level: "info",
      event: "data_center_server_read",
      status: "success",
      durationMs: Date.now() - startedAt,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    }));
    return snapshot;
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "data_center_server_read",
      status: "failure",
      durationMs: Date.now() - startedAt,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      error: error instanceof Error ? error.message : "unknown",
    }));
    throw error;
  }
}

export const getPanelWorkspaceSnapshot = cache(loadPanelWorkspaceSnapshot);
export const getPanelStatsSnapshot = cache(loadPanelStatsSnapshot);
