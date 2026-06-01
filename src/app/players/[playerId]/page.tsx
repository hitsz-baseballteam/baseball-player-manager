import { cookies } from "next/headers";

import { PlayerProfilePageClient } from "@/components/player-profile-page-client";
import { UnlockForm } from "@/components/unlock-form";
import { isUnlockCookieValid, UNLOCK_COOKIE_NAME } from "@/lib/auth";
import { getOrCreateWorkspaceSnapshot } from "@/lib/workspace-store";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;

  if (!isUnlockCookieValid(unlockCookie)) {
    return <UnlockForm />;
  }

  const [{ playerId }, snapshot] = await Promise.all([
    params,
    getOrCreateWorkspaceSnapshot(),
  ]);

  return (
    <PlayerProfilePageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
      playerId={playerId}
    />
  );
}
