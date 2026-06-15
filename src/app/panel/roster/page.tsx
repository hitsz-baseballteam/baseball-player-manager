import { RosterPageClient } from "@/components/roster-page-client";
import { getPanelWorkspaceSnapshot } from "@/lib/panel-server";
import { PANEL_ROUTES } from "@/lib/routes";

export default async function PanelRosterPage() {
  const snapshot = await getPanelWorkspaceSnapshot(PANEL_ROUTES.roster);

  return (
    <RosterPageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
    />
  );
}
