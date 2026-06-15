import { GamesPageClient } from "@/components/games-page-client";
import { getPanelWorkspaceSnapshot } from "@/lib/panel-server";
import { PANEL_ROUTES } from "@/lib/routes";

export default async function PanelPlayerGamesPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const snapshot = await getPanelWorkspaceSnapshot(
    PANEL_ROUTES.playerGames(playerId),
  );

  return (
    <GamesPageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
      playerId={playerId}
    />
  );
}
