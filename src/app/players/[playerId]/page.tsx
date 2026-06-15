import { permanentRedirect } from "next/navigation";

import { PANEL_ROUTES } from "@/lib/routes";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  permanentRedirect(PANEL_ROUTES.player(playerId));
}
