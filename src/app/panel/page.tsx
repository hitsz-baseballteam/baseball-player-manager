import { PlayerManagerClient } from "@/components/player-manager-client";
import { getPanelWorkspaceSnapshot } from "@/lib/panel-server";
import { PANEL_ROUTES } from "@/lib/routes";

export default async function PanelHomePage() {
  const snapshot = await getPanelWorkspaceSnapshot(PANEL_ROUTES.home);

  return (
    <PlayerManagerClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
    />
  );
}
