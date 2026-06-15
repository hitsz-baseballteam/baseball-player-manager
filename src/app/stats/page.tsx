import { permanentRedirect } from "next/navigation";

import { PANEL_ROUTES } from "@/lib/routes";

export default function StatsPage() {
  permanentRedirect(PANEL_ROUTES.stats);
}
