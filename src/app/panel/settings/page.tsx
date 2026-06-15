import { SettingsPageClient } from "@/components/settings-page-client";
import { getPanelWorkspaceSnapshot } from "@/lib/panel-server";
import { PANEL_ROUTES } from "@/lib/routes";

export default async function PanelSettingsPage() {
  const snapshot = await getPanelWorkspaceSnapshot(PANEL_ROUTES.settings);

  return (
    <SettingsPageClient
      initialWorkspace={snapshot.workspace}
      initialVersion={snapshot.version}
    />
  );
}
