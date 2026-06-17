import { ScoreboardPageClient } from "@/components/scoreboard-page-client";
import { getPanelWorkspaceSnapshot } from "@/lib/panel-server";
import { PANEL_ROUTES } from "@/lib/routes";

export default async function ScoreboardPage() {
  const snapshot = await getPanelWorkspaceSnapshot(PANEL_ROUTES.scoreboard);

  return (
    <ScoreboardPageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
    />
  );
}
