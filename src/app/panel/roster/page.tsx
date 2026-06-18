import { RosterPageClient } from "@/components/roster-page-client";
import { getPanelBootstrap } from "@/lib/panel-server";
import { PANEL_ROUTES } from "@/lib/routes";

export default async function PanelRosterPage() {
  const snapshot = await getPanelBootstrap(PANEL_ROUTES.roster);

  return (
    <RosterPageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
    />
  );
}
