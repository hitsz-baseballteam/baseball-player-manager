import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizePanelNextPath, panelNavItems, PANEL_ROUTES } from "@/lib/routes";

describe("panel routes", () => {
  it("keeps valid panel destinations", () => {
    assert.equal(
      normalizePanelNextPath("/panel/players/p-1?tab=games"),
      "/panel/players/p-1?tab=games",
    );
  });

  it("falls back for external and malformed destinations", () => {
    assert.equal(normalizePanelNextPath("https://example.com"), PANEL_ROUTES.home);
    assert.equal(normalizePanelNextPath("//example.com"), PANEL_ROUTES.home);
    assert.equal(normalizePanelNextPath("/roster"), PANEL_ROUTES.home);
    assert.equal(normalizePanelNextPath("/panel/login"), PANEL_ROUTES.home);
    assert.equal(normalizePanelNextPath("%E0%A4%A"), PANEL_ROUTES.home);
  });

  it("only opts the data center into eager route prefetching", () => {
    const navItems = panelNavItems("总览");
    const prefetchedItems = navItems.filter(
      (item) => "prefetch" in item && item.prefetch,
    );

    assert.deepEqual(prefetchedItems.map((item) => item.href), [PANEL_ROUTES.stats]);
  });
});
