import { permanentRedirect } from "next/navigation";

import { PANEL_ROUTES } from "@/lib/routes";

export default function SettingsPage() {
  permanentRedirect(PANEL_ROUTES.settings);
}
