import { permanentRedirect } from "next/navigation";

import { PANEL_ROUTES } from "@/lib/routes";

export default function RosterPage() {
  permanentRedirect(PANEL_ROUTES.roster);
}
