import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup } from "@testing-library/react";
import { LineupOrder } from "./lineup-order";
import { createDefaultWorkspace, type Player } from "@/lib/workspace";

describe("LineupOrder", () => {
  afterEach(() => {
    cleanup();
  });

  function getPlayers(ws = createDefaultWorkspace(true)): Player[] {
    return ws.players.filter((p) => p.status === "available");
  }

  it("renders table with 9 lineup slots", () => {
    const players = getPlayers();
    render(
      <LineupOrder
        players={players}
        lineup={Array(9).fill(null)}
        onAssign={() => {}}
        onClear={() => {}}
        onMove={() => {}}
      />,
    );

    // Each slot row has a numeric index cell
    for (let i = 1; i <= 9; i++) {
      assert.ok(screen.getByText(String(i)), `Slot ${i} not found`);
    }
  });

  it("shows player name in assigned lineup slots", () => {
    const players = getPlayers();
    const lineup = Array(9).fill(null);
    lineup[0] = players[0].id;

    render(
      <LineupOrder
        players={players}
        lineup={lineup}
        onAssign={() => {}}
        onClear={() => {}}
        onMove={() => {}}
      />,
    );

    assert.ok(screen.getByText(players[0].name));
  });

  it("renders empty lineup without crashing", () => {
    render(
      <LineupOrder
        players={[]}
        lineup={Array(9).fill(null)}
        onAssign={() => {}}
        onClear={() => {}}
        onMove={() => {}}
      />,
    );

    assert.ok(screen.getByText("1"));
  });
});
