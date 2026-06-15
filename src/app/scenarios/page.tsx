import { permanentRedirect } from "next/navigation";

import { PANEL_ROUTES } from "@/lib/routes";

export default function ScenariosPage() {
  permanentRedirect(PANEL_ROUTES.scenarios);
}
