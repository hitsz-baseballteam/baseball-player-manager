import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, render, screen } from "@testing-library/react";

import { PlayerProfilePageClient } from "@/components/player-profile-page-client";
import { createDefaultWorkspace } from "@/lib/workspace";

describe("PlayerProfilePageClient", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("renders the unified shell around the player profile page", () => {
    const workspace = createDefaultWorkspace(true);
    const player = workspace.players[0];

    render(
      <PlayerProfilePageClient
        initialWorkspace={workspace}
        initialVersion={5}
        playerId={player.id}
      />,
    );

    assert.ok(screen.getByRole("link", { name: "名册" }));
    assert.ok(screen.getAllByText(player.name).length >= 1);
    const backLinks = screen.getAllByText("返回工作区");
    assert.ok(backLinks.length > 0);
    assert.ok(screen.getAllByText(/球员档案已连接共享工作区/).length >= 1);
  });
});
