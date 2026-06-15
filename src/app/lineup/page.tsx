import { redirect } from "next/navigation";

import { PANEL_ROUTES } from "@/lib/routes";

export default function LineupPage() {
  redirect(PANEL_ROUTES.scenarios);
}
