import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readUnlockSession, UNLOCK_COOKIE_NAME } from "@/lib/auth";
import { PANEL_ROUTES } from "@/lib/routes";
import { getOrCreateWorkspaceSnapshot } from "@/lib/workspace-store";

export async function getPanelWorkspaceSnapshot(pathname: string) {
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;

  if (!readUnlockSession(unlockCookie)) {
    redirect(
      `${PANEL_ROUTES.login}?next=${encodeURIComponent(pathname)}`,
    );
  }

  return getOrCreateWorkspaceSnapshot();
}
