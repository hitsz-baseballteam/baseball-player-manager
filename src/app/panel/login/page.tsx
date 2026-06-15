import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { UnlockForm } from "@/components/unlock-form";
import { isUnlockCookieValid, UNLOCK_COOKIE_NAME } from "@/lib/auth";
import { normalizePanelNextPath } from "@/lib/routes";

export default async function PanelLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const destination = normalizePanelNextPath(next);
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;

  if (isUnlockCookieValid(unlockCookie)) {
    redirect(destination);
  }

  return <UnlockForm nextPath={destination} />;
}
