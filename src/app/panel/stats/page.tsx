import { StatsPageClient } from "@/components/stats-page-client";
import { getPanelWorkspaceSnapshot } from "@/lib/panel-server";
import { PANEL_ROUTES } from "@/lib/routes";

export default async function PanelStatsPage() {
  const snapshot = await getPanelWorkspaceSnapshot(PANEL_ROUTES.stats);

  return (
    <StatsPageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
    />
  );
}
