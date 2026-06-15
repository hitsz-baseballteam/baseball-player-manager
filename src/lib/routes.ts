export const PANEL_ROUTES = {
  home: "/panel",
  login: "/panel/login",
  roster: "/panel/roster",
  scenarios: "/panel/scenarios",
  stats: "/panel/stats",
  settings: "/panel/settings",
  player: (playerId: string) =>
    `/panel/players/${encodeURIComponent(playerId)}`,
  playerGames: (playerId: string) =>
    `/panel/players/${encodeURIComponent(playerId)}/games`,
} as const;

const PANEL_NAV_BASE = [
  { label: "总览", href: PANEL_ROUTES.home },
  { label: "名册", href: PANEL_ROUTES.roster },
  { label: "战术场景", href: PANEL_ROUTES.scenarios },
  { label: "数据中心", href: PANEL_ROUTES.stats },
  { label: "设置", href: PANEL_ROUTES.settings },
] as const;

export function panelNavItems(activeLabel: string) {
  return PANEL_NAV_BASE.map((item) => ({
    ...item,
    active: item.label === activeLabel,
  }));
}

export function normalizePanelNextPath(value: string | null | undefined) {
  if (!value) return PANEL_ROUTES.home;

  try {
    const decoded = decodeURIComponent(value);
    if (
      (decoded === PANEL_ROUTES.home ||
      (decoded.startsWith(`${PANEL_ROUTES.home}/`) &&
        !decoded.startsWith("//") &&
        !decoded.includes("\\"))) &&
      decoded !== PANEL_ROUTES.login
    ) {
      return decoded;
    }
  } catch {
    return PANEL_ROUTES.home;
  }

  return PANEL_ROUTES.home;
}
