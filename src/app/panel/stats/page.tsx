import { StatsPageClient } from "@/components/stats-page-client";
import { getPanelStatsSnapshot } from "@/lib/panel-server";
import { PANEL_ROUTES } from "@/lib/routes";

export default async function PanelStatsPage() {
  const snapshot = await getPanelStatsSnapshot(PANEL_ROUTES.stats);

  return (
    <StatsPageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
    />
  );
}
