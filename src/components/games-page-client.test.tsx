import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDefaultWorkspace } from "@/lib/workspace";

let GamesPageClient: typeof import("./games-page-client").GamesPageClient;
const baseWorkspace = createDefaultWorkspace(true);

function cloneWorkspace<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function workspaceWithPlayer(playerId: string) {
  const ws = cloneWorkspace(baseWorkspace);
  const player = ws.players[0];
  if (!player) throw new Error("no default player");
  player.id = playerId;
  player.profile.games = [
    {
      id: "g-1",
      date: "2026-05-20",
      opponent: "南山高中",
      gameType: "official" as const,
      pa: 4, ab: 4, h: 2, hr: 1, rbi: 2, r: 2, sb: 0, bb: 0, so: 1,
      ip: 2, er: 0, soPitching: 3, bbPitching: 1, hPitching: 1,
    },
    {
      id: "g-2",
      date: "2026-05-15",
      opponent: "北一中学",
      gameType: "official" as const,
      pa: 3, ab: 2, h: 0, hr: 0, rbi: 0, r: 0, sb: 0, bb: 1, so: 1,
      ip: null, er: null, soPitching: null, bbPitching: null, hPitching: null,
    },
    {
      id: "g-3",
      date: "2026-05-10",
      opponent: "队内红白",
      gameType: "training" as const,
      pa: 4, ab: 3, h: 1, hr: 0, rbi: 1, r: 1, sb: 1, bb: 1, so: 0,
      ip: null, er: null, soPitching: null, bbPitching: null, hPitching: null,
    },
  ];
  return ws;
}

describe("GamesPageClient", () => {
  const playerId = "test-p-001";

  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    ({ GamesPageClient } = await import("./games-page-client"));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.body.innerHTML = "";
  });

  it("renders the games page with tab switch, summary, and game list", async () => {
    const user = userEvent.setup();
    const workspace = workspaceWithPlayer(playerId);

    render(
      <GamesPageClient
        initialWorkspace={workspace}
        initialVersion={5}
        playerId={playerId}
      />,
    );

    await screen.findByRole("heading", { name: /陈浩宇/ });

    // Tab buttons visible
    assert.ok(screen.getByRole("button", { name: "正式比赛" }));
    assert.ok(screen.getByRole("button", { name: "训练比赛" }));

    // Summary cards present - use the summary card specific value text
    const countElements = screen.getAllByText("2");
    assert.ok(countElements.length >= 1);
    assert.ok(screen.getByText("2 / 1"));
    assert.ok(screen.getByText(/ERA/));

    // Game rows in table
    assert.ok(screen.getByText("南山高中"));
    assert.ok(screen.getByText("北一中学"));
    assert.equal(screen.queryByText("队内红白"), null); // filtered out (official tab)

    // Switch to training tab
    await user.click(screen.getByRole("button", { name: "训练比赛" }));
    assert.ok(screen.getByText("队内红白"));

    // Open add dialog - the dialog h3 has "新增比赛 —" prefix
    await user.click(screen.getByRole("button", { name: "+ 新增比赛" }));
    assert.ok(screen.getByRole("dialog", { name: /新增比赛/ }));

    // Close dialog
    await user.click(screen.getByRole("button", { name: "取消" }));
    assert.equal(screen.queryByRole("dialog", { name: /新增比赛/ }), null);
  });

  it("renders empty state when player is not found", async () => {
    render(
      <GamesPageClient
        initialWorkspace={baseWorkspace}
        initialVersion={5}
        playerId="non-existent"
      />,
    );

    await screen.findByRole("heading", { name: "未找到球员" });
  });
});
