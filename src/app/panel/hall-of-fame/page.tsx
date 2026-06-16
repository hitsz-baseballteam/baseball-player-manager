import { HallOfFamePageClient } from "@/components/hall-of-fame-page-client";
import { getPanelWorkspaceSnapshot } from "@/lib/panel-server";
import { PANEL_ROUTES } from "@/lib/routes";

export default async function PanelHallOfFamePage() {
  const snapshot = await getPanelWorkspaceSnapshot(PANEL_ROUTES.hallOfFame);

  return (
    <HallOfFamePageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
    />
  );
}
