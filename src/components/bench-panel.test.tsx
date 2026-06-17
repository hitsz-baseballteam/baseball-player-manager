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

  it("renders bench players from the roster", () => {
    const players = getPlayers();
    render(
      <BenchPanel
        players={players}
        defense={emptyDefense()}
        lineup={Array(9).fill(null)}
      />,
    );

    assert.ok(screen.getByText("替补球员"));
    // All available players appear
    const availablePlayers = players.filter((p) => p.status === "available");
    for (const p of availablePlayers) {
      assert.ok(screen.getByText(p.name), `Player ${p.name} not found`);
    }
  });

  it("excludes players already assigned to defense from bench", () => {
    const players = getPlayers();
    const defense = emptyDefense();
    const firstPlayer = players.find((p) => p.status === "available")!;
    defense["P"] = firstPlayer.id;

    render(
      <BenchPanel
        players={players}
        defense={defense}
        lineup={Array(9).fill(null)}
      />,
    );

    assert.strictEqual(screen.queryByText(firstPlayer.name), null);
  });

  it("shows 替补 tag for bench players", () => {
    const players = getPlayers();
    render(
      <BenchPanel
        players={players}
        defense={emptyDefense()}
        lineup={Array(9).fill(null)}
      />,
    );

    const tags = screen.getAllByText("替补");
    assert.ok(tags.length > 0);
  });

  it("renders empty state without crashing", () => {
    render(
      <BenchPanel
        players={[]}
        defense={emptyDefense()}
        lineup={Array(9).fill(null)}
      />,
    );

    assert.ok(screen.getByText("无替补球员"));
  });
});
