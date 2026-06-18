import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readUnlockSession, UNLOCK_COOKIE_NAME } from "@/lib/auth";
import { PANEL_ROUTES } from "@/lib/routes";
import {
  getBootstrapWorkspace,
  getGamesWorkspace,
  getMilestonesWorkspace,
  getOrCreateWorkspaceSnapshot,
} from "@/lib/workspace-store";

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

async function loadPanelBootstrap(pathname: string) {
  await checkPanelAuth(pathname);
  return getBootstrapWorkspace();
}

async function loadPanelGames(pathname: string) {
  await checkPanelAuth(pathname);
  const startedAt = Date.now();

  try {
    const snapshot = await getGamesWorkspace();
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

async function loadPanelMilestones(pathname: string) {
  await checkPanelAuth(pathname);
  return getMilestonesWorkspace();
}

export const getPanelWorkspaceSnapshot = cache(loadPanelWorkspaceSnapshot);
export const getPanelBootstrap = cache(loadPanelBootstrap);
export const getPanelGames = cache(loadPanelGames);
export const getPanelMilestones = cache(loadPanelMilestones);
