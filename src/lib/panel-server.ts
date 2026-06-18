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
  return getGamesWorkspace();
}

async function loadPanelMilestones(pathname: string) {
  await checkPanelAuth(pathname);
  return getMilestonesWorkspace();
}

export const getPanelWorkspaceSnapshot = cache(loadPanelWorkspaceSnapshot);
export const getPanelBootstrap = cache(loadPanelBootstrap);
export const getPanelGames = cache(loadPanelGames);
export const getPanelMilestones = cache(loadPanelMilestones);
