import { ScenariosPageClient } from "@/components/scenarios-page-client";
import { getPanelBootstrap } from "@/lib/panel-server";
import { PANEL_ROUTES } from "@/lib/routes";

export default async function PanelScenariosPage() {
  const snapshot = await getPanelBootstrap(PANEL_ROUTES.scenarios);

  return (
    <ScenariosPageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
    />
  );
}
