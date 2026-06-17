import { PlayerProfilePageClient } from "@/components/player-profile-page-client";
import { getPanelBootstrap } from "@/lib/panel-server";
import { PANEL_ROUTES } from "@/lib/routes";

export default async function PanelPlayerProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const snapshot = await getPanelBootstrap(PANEL_ROUTES.player(playerId));

  return (
    <PlayerProfilePageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
      playerId={playerId}
    />
  );
}
