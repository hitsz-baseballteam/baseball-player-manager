import { cookies } from "next/headers";

import { ScenariosPageClient } from "@/components/scenarios-page-client";
import { UnlockForm } from "@/components/unlock-form";
import { isUnlockCookieValid, UNLOCK_COOKIE_NAME } from "@/lib/auth";
import { getOrCreateWorkspaceSnapshot } from "@/lib/workspace-store";

export default async function ScenariosPage() {
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;

  if (!isUnlockCookieValid(unlockCookie)) {
    return <UnlockForm />;
  }

  const snapshot = await getOrCreateWorkspaceSnapshot();

  return (
    <ScenariosPageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
    />
  );
}
