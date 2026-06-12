import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup } from "@testing-library/react";
import { BenchPanel } from "./bench-panel";
import { createDefaultWorkspace, type Player } from "@/lib/workspace";

describe("BenchPanel", () => {
  afterEach(() => {
    cleanup();
  });

  function getPlayers(ws = createDefaultWorkspace(true)): Player[] {
    return ws.players;
  }

  function emptyDefense() {
    return Object.fromEntries(
      ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].map((code) => [code, null]),
    ) as Record<string, string | null>;
  }

  it("renders all players from the roster", () => {
    const players = getPlayers();
    render(
      <BenchPanel
        players={players}
        defense={emptyDefense()}
        lineup={Array(9).fill(null)}
      />,
    );

    assert.ok(screen.getByText("全队球员"));
    for (const p of players) {
      assert.ok(screen.getByText(p.name), `Player ${p.name} not found`);
    }
  });

  it("shows 投手 (pitcher) tag when player is assigned to defense", () => {
    const players = getPlayers();
    const defense = emptyDefense();
    defense["P"] = players[0].id;

    render(
      <BenchPanel
        players={players}
        defense={defense}
        lineup={Array(9).fill(null)}
      />,
    );

    // The pitcher gets a "投手" meta tag
    assert.ok(screen.getByText("投手"));
  });

  it("shows 待分配 for unassigned players", () => {
    const players = getPlayers();
    render(
      <BenchPanel
        players={players}
        defense={emptyDefense()}
        lineup={Array(9).fill(null)}
      />,
    );

    assert.ok(screen.getAllByText("待分配").length > 0);
  });

  it("renders empty state without crashing", () => {
    render(
      <BenchPanel
        players={[]}
        defense={emptyDefense()}
        lineup={Array(9).fill(null)}
      />,
    );

    assert.ok(screen.getByText("全队球员"));
  });
});
