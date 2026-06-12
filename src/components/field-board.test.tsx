import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup } from "@testing-library/react";
import { FieldBoard } from "./field-board";
import { createDefaultWorkspace, type Player } from "@/lib/workspace";

describe("FieldBoard", () => {
  afterEach(() => {
    cleanup();
  });

  function getPlayers(ws = createDefaultWorkspace(true)): Player[] {
    return ws.players.filter((p) => p.status === "available");
  }

  function emptyDefense() {
    return Object.fromEntries(
      ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].map((code) => [code, null]),
    ) as Record<string, string | null>;
  }

  it("renders all 9 position overlays with aria-labels", () => {
    const players = getPlayers();
    render(
      <FieldBoard
        players={players}
        defense={emptyDefense()}
        onAssign={() => {}}
        onClear={() => {}}
        onSwap={() => {}}
      />,
    );

    // Each position has an overlay button with an aria-label
    const labels = ["投手", "捕手", "一垒", "二垒", "三垒", "游击", "左外", "中外", "右外"];
    for (const label of labels) {
      assert.ok(
        screen.getByRole("button", { name: new RegExp(label) }),
        `Position ${label} not found`,
      );
    }
  });

  it("shows player name and number on assigned position", () => {
    const players = getPlayers();
    const defense = emptyDefense();
    defense["P"] = players[0].id;

    render(
      <FieldBoard
        players={players}
        defense={defense}
        onAssign={() => {}}
        onClear={() => {}}
        onSwap={() => {}}
      />,
    );

    assert.ok(screen.getByText(players[0].name));
    assert.ok(screen.getByText(players[0].number));
  });

  it("renders without crashing with empty players list", () => {
    render(
      <FieldBoard
        players={[]}
        defense={emptyDefense()}
        onAssign={() => {}}
        onClear={() => {}}
        onSwap={() => {}}
      />,
    );

    // Should still render the position overlays
    assert.ok(screen.getByRole("button", { name: /投手/ }));
  });
});
