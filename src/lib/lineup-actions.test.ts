import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assignDefensePosition,
  assignLineupSlot,
  autoAssignActive,
  clearAllAssignments,
  clearDefensePosition,
  clearLineupSlot,
  copyScenarioAction,
  createScenarioAction,
  deleteScenarioAction,
  moveLineupSlot,
  renameScenarioAction,
  setActiveScenarioAction,
  swapDefensePositions,
  validateScenarioName,
} from "@/lib/lineup-actions";
import {
  cloneWorkspace,
  createDefaultWorkspace,
  getActiveScenario,
} from "@/lib/workspace";

describe("lineup-actions", () => {
  function fresh() {
    return cloneWorkspace(createDefaultWorkspace(true));
  }

  // ── Defense ──

  describe("assignDefensePosition", () => {
    it("places a player at a defense position", () => {
      const ws = fresh();
      const playerId = ws.players[0].id;
      const result = assignDefensePosition(ws, "P", playerId);
      assert.equal(getActiveScenario(result).assignments.defense["P"], playerId);
    });

    it("clears the same player from any other defense position", () => {
      const ws = fresh();
      const playerId = ws.players[0].id;
      // Assign to P first
      const ws2 = assignDefensePosition(ws, "P", playerId);
      // Now assign same player to C
      const ws3 = assignDefensePosition(ws2, "C", playerId);
      const defense = getActiveScenario(ws3).assignments.defense;
      assert.equal(defense["C"], playerId);
      assert.equal(defense["P"], null, "old position should be cleared");
    });

    it("does not mutate the original workspace", () => {
      const ws = fresh();
      const original = JSON.stringify(ws);
      assignDefensePosition(ws, "P", ws.players[0].id);
      assert.equal(JSON.stringify(ws), original);
    });

    it("does not clear lineup when assigning defense", () => {
      const ws = fresh();
      const playerId = ws.players[0].id;
      // Put player in lineup first
      const ws2 = assignLineupSlot(ws, 0, playerId);
      // Assign to defense
      const ws3 = assignDefensePosition(ws2, "1B", playerId);
      assert.equal(getActiveScenario(ws3).assignments.lineup[0], playerId,
        "lineup slot should be preserved when assigning defense");
    });

    it("auto-adds player to lineup when assigned to empty defense position", () => {
      const ws = fresh();
      const playerId = ws.players[0].id;
      // Clear lineup
      const scenario = getActiveScenario(ws);
      scenario.assignments.lineup = Array(9).fill(null);
      // Assign to defense — empty position, should go to first empty lineup slot
      const ws2 = assignDefensePosition(ws, "P", playerId);
      const lineup2 = getActiveScenario(ws2).assignments.lineup;
      assert.equal(lineup2[0], playerId,
        "player should be auto-added to first empty lineup slot");
    });

    it("replaces old defender in lineup when position is taken", () => {
      const ws = fresh();
      const oldPlayer = ws.players[0].id;   // 陈浩宇
      const newPlayer = ws.players[1].id;   // 林子昂
      const scenario = getActiveScenario(ws);
      // Old player at 3B and batting 5th
      scenario.assignments.defense["3B"] = oldPlayer;
      scenario.assignments.lineup =          [null, null, null, null, oldPlayer, null, null, null, null];
      // Assign new player to 3B — should replace old at both 3B AND 5th in lineup
      const ws2 = assignDefensePosition(ws, "3B", newPlayer);
      const s2 = getActiveScenario(ws2);
      assert.equal(s2.assignments.defense["3B"], newPlayer, "new player at 3B");
      assert.equal(s2.assignments.lineup[4], newPlayer, "new player at old slot (5th)");
      assert.equal(s2.assignments.lineup.indexOf(oldPlayer), -1, "old player removed from lineup");
    });

    it("does not duplicate player in lineup if already batting elsewhere", () => {
      const ws = fresh();
      const playerId = ws.players[0].id;
      const scenario = getActiveScenario(ws);
      scenario.assignments.lineup = [playerId, null, null, null, null, null, null, null, null];
      const ws2 = assignDefensePosition(ws, "P", playerId);
      const lineup2 = getActiveScenario(ws2).assignments.lineup;
      // Player should still be in slot 0, not duplicated in slot 1
      assert.equal(lineup2[0], playerId);
      assert.equal(lineup2[1], null, "should not duplicate to slot 1");
    });
  });

  describe("clearDefensePosition", () => {
    it("sets the position to null", () => {
      const ws = fresh();
      const playerId = ws.players[0].id;
      const ws2 = assignDefensePosition(ws, "SS", playerId);
      const ws3 = clearDefensePosition(ws2, "SS");
      assert.equal(getActiveScenario(ws3).assignments.defense["SS"], null);
    });

    it("clearing an already-empty position is a no-op", () => {
      const ws = fresh();
      const ws2 = clearDefensePosition(ws, "CF");
      assert.equal(getActiveScenario(ws2).assignments.defense["CF"], null);
    });
  });

  describe("swapDefensePositions", () => {
    it("swaps two assigned players", () => {
      const ws = fresh();
      const p1 = ws.players[0].id;
      const p2 = ws.players[1].id;
      const ws2 = assignDefensePosition(ws, "P", p1);
      const ws3 = assignDefensePosition(ws2, "C", p2);
      const ws4 = swapDefensePositions(ws3, "P", "C");
      const defense = getActiveScenario(ws4).assignments.defense;
      assert.equal(defense["P"], p2);
      assert.equal(defense["C"], p1);
    });

    it("swap with empty position acts as a move", () => {
      const ws = fresh();
      const p1 = ws.players[0].id;
      const ws2 = assignDefensePosition(ws, "P", p1);
      const ws3 = swapDefensePositions(ws2, "P", "C");
      const defense = getActiveScenario(ws3).assignments.defense;
      assert.equal(defense["P"], null);
      assert.equal(defense["C"], p1);
    });

    it("swapping same position is a no-op", () => {
      const ws = fresh();
      const p1 = ws.players[0].id;
      const ws2 = assignDefensePosition(ws, "P", p1);
      const ws3 = swapDefensePositions(ws2, "P", "P");
      assert.equal(getActiveScenario(ws3).assignments.defense["P"], p1);
    });
  });

  // ── Lineup ──

  describe("assignLineupSlot", () => {
    it("places a player in a lineup slot", () => {
      const ws = fresh();
      const playerId = ws.players[0].id;
      const result = assignLineupSlot(ws, 3, playerId);
      assert.equal(getActiveScenario(result).assignments.lineup[3], playerId);
    });

    it("clears old slot when same player is moved to a new slot", () => {
      const ws = fresh();
      const playerId = ws.players[0].id;
      const ws2 = assignLineupSlot(ws, 0, playerId);
      const ws3 = assignLineupSlot(ws2, 4, playerId);
      const lineup = getActiveScenario(ws3).assignments.lineup;
      assert.equal(lineup[4], playerId);
      assert.equal(lineup[0], null, "old slot should be cleared");
    });

    it("does not mutate original workspace", () => {
      const ws = fresh();
      const original = JSON.stringify(ws);
      assignLineupSlot(ws, 0, ws.players[0].id);
      assert.equal(JSON.stringify(ws), original);
    });
  });

  describe("clearLineupSlot", () => {
    it("clears the specified lineup slot", () => {
      const ws = fresh();
      const playerId = ws.players[0].id;
      const ws2 = assignLineupSlot(ws, 2, playerId);
      const ws3 = clearLineupSlot(ws2, 2);
      assert.equal(getActiveScenario(ws3).assignments.lineup[2], null);
    });
  });

  describe("moveLineupSlot", () => {
    it("moves a player forward in the batting order", () => {
      const ws = fresh();
      const p0 = ws.players[0].id;
      const p1 = ws.players[1].id;
      const p2 = ws.players[2].id;
      let ws2 = assignLineupSlot(ws, 0, p0);
      ws2 = assignLineupSlot(ws2, 1, p1);
      ws2 = assignLineupSlot(ws2, 2, p2);
      const ws3 = moveLineupSlot(ws2, 2, 0);
      const lineup = getActiveScenario(ws3).assignments.lineup;
      assert.equal(lineup[0], p2);
      assert.equal(lineup[1], p0);
      assert.equal(lineup[2], p1);
    });

    it("moves a player backward in the batting order", () => {
      const ws = fresh();
      const p0 = ws.players[0].id;
      const p1 = ws.players[1].id;
      let ws2 = assignLineupSlot(ws, 0, p0);
      ws2 = assignLineupSlot(ws2, 1, p1);
      const ws3 = moveLineupSlot(ws2, 0, 1);
      const lineup = getActiveScenario(ws3).assignments.lineup;
      assert.equal(lineup[0], p1);
      assert.equal(lineup[1], p0);
    });

    it("same-index move is a no-op (no mutation)", () => {
      const ws = fresh();
      const p0 = ws.players[0].id;
      const ws2 = assignLineupSlot(ws, 0, p0);
      const original = JSON.stringify(ws2);
      const ws3 = moveLineupSlot(ws2, 0, 0);
      assert.equal(JSON.stringify(ws3), original);
    });
  });

  // ── Bulk ──

  describe("clearAllAssignments", () => {
    it("clears all defense and lineup slots for active scenario", () => {
      const ws = fresh();
      const p0 = ws.players[0].id;
      const p1 = ws.players[1].id;
      let ws2 = assignDefensePosition(ws, "P", p0);
      ws2 = assignLineupSlot(ws2, 0, p1);
      const ws3 = clearAllAssignments(ws2);
      const scenario = getActiveScenario(ws3);
      const allDefense = Object.values(scenario.assignments.defense);
      assert.ok(allDefense.every((v) => v === null), "all defense positions should be null");
      assert.ok(scenario.assignments.lineup.every((v) => v === null), "all lineup slots should be null");
    });
  });

  describe("autoAssignActive", () => {
    it("populates defense and lineup from available players", () => {
      const ws = fresh();
      const result = autoAssignActive(ws);
      const scenario = getActiveScenario(result);
      const filledDefense = Object.values(scenario.assignments.defense).filter(Boolean);
      const filledLineup = scenario.assignments.lineup.filter(Boolean);
      assert.ok(filledDefense.length > 0, "should fill some defense positions");
      assert.ok(filledLineup.length > 0, "should fill some lineup slots");
    });

    it("does not mutate the original workspace", () => {
      const ws = fresh();
      const original = JSON.stringify(ws);
      autoAssignActive(ws);
      assert.equal(JSON.stringify(ws), original);
    });
  });

  // ── Scenario CRUD ──

  describe("createScenarioAction", () => {
    it("adds a new scenario to the workspace", () => {
      const ws = fresh();
      const before = ws.scenarios.length;
      const result = createScenarioAction(ws, "新方案", "备注");
      assert.equal(result.scenarios.length, before + 1);
    });

    it("new scenario has the provided name", () => {
      const ws = fresh();
      const result = createScenarioAction(ws, "测试方案", "");
      assert.equal(result.scenarios.at(-1)!.name, "测试方案");
    });

    it("does not change the active scenario", () => {
      const ws = fresh();
      const activeId = ws.activeScenarioId;
      const result = createScenarioAction(ws, "新方案", "");
      assert.equal(result.activeScenarioId, activeId);
    });
  });

  describe("copyScenarioAction", () => {
    it("creates a copy with a unique name", () => {
      const ws = fresh();
      const sourceId = ws.scenarios[0].id;
      const sourceName = ws.scenarios[0].name;
      const result = copyScenarioAction(ws, sourceId);
      assert.equal(result.scenarios.length, ws.scenarios.length + 1);
      const copy = result.scenarios.at(-1)!;
      assert.ok(copy.name !== sourceName, "copy should have a different name");
      assert.ok(copy.name.includes(sourceName.slice(0, 10)) || copy.name.includes("副本"),
        "copy name should reference source or include suffix");
    });

    it("copy has independent assignments (deep clone)", () => {
      const ws = fresh();
      const p0 = ws.players[0].id;
      const ws2 = assignDefensePosition(ws, "P", p0);
      const sourceId = ws2.scenarios[0].id;
      const ws3 = copyScenarioAction(ws2, sourceId);
      // Mutate the original scenario's defense through a new action
      const ws4 = clearDefensePosition(ws3, "P");
      // The copy (last scenario) should still have p0 at P
      const copy = ws4.scenarios.at(-1)!;
      assert.equal(copy.assignments.defense["P"], p0,
        "copy assignments should be independent");
    });

    it("does not change the active scenario", () => {
      const ws = fresh();
      const activeId = ws.activeScenarioId;
      const result = copyScenarioAction(ws, ws.scenarios[0].id);
      assert.equal(result.activeScenarioId, activeId);
    });
  });

  describe("deleteScenarioAction", () => {
    it("removes the specified scenario", () => {
      const ws = fresh();
      // Add a second scenario so we can delete one
      const ws2 = createScenarioAction(ws, "副方案", "");
      const toDeleteId = ws2.scenarios[0].id;
      const result = deleteScenarioAction(ws2, toDeleteId);
      assert.ok(!result.scenarios.some((s) => s.id === toDeleteId));
    });

    it("throws when attempting to delete the last scenario", () => {
      const ws = fresh();
      assert.equal(ws.scenarios.length, 1);
      assert.throws(
        () => deleteScenarioAction(ws, ws.scenarios[0].id),
        /最后/,
      );
    });

    it("switches active to first remaining when active is deleted", () => {
      const ws = fresh();
      const ws2 = createScenarioAction(ws, "副方案", "");
      // Set active to the new (second) scenario
      const ws3 = setActiveScenarioAction(ws2, ws2.scenarios[1].id);
      const activeId = ws3.activeScenarioId;
      const result = deleteScenarioAction(ws3, activeId);
      assert.notEqual(result.activeScenarioId, activeId);
      assert.ok(result.scenarios.some((s) => s.id === result.activeScenarioId));
    });
  });

  describe("renameScenarioAction", () => {
    it("updates name and note", () => {
      const ws = fresh();
      const id = ws.scenarios[0].id;
      const result = renameScenarioAction(ws, id, "新名称", "新备注");
      const scenario = result.scenarios.find((s) => s.id === id)!;
      assert.equal(scenario.name, "新名称");
      assert.equal(scenario.note, "新备注");
    });

    it("updates updatedAt to a more recent time", () => {
      const ws = fresh();
      const id = ws.scenarios[0].id;
      // Force the existing updatedAt to a known-old value so the comparison is reliable
      ws.scenarios[0].updatedAt = "2020-01-01T00:00:00.000Z";
      const result = renameScenarioAction(ws, id, "新名称", "");
      const after = result.scenarios.find((s) => s.id === id)!.updatedAt;
      assert.ok(
        new Date(after).getTime() > new Date("2020-01-01T00:00:00.000Z").getTime(),
        "updatedAt should be updated to a more recent timestamp",
      );
    });
  });

  describe("setActiveScenarioAction", () => {
    it("changes the activeScenarioId", () => {
      const ws = fresh();
      const ws2 = createScenarioAction(ws, "第二方案", "");
      const secondId = ws2.scenarios[1].id;
      const result = setActiveScenarioAction(ws2, secondId);
      assert.equal(result.activeScenarioId, secondId);
    });

    it("is a no-op for unknown id", () => {
      const ws = fresh();
      const result = setActiveScenarioAction(ws, "nonexistent-id");
      assert.equal(result.activeScenarioId, ws.activeScenarioId);
    });
  });

  // ── Validation ──

  describe("validateScenarioName", () => {
    it("returns error for empty name", () => {
      const ws = fresh();
      const err = validateScenarioName("", ws);
      assert.ok(err !== null);
      assert.match(err!, /不能为空/);
    });

    it("returns error for whitespace-only name", () => {
      const ws = fresh();
      const err = validateScenarioName("   ", ws);
      assert.ok(err !== null);
    });

    it("returns error when name exceeds 24 characters", () => {
      const ws = fresh();
      const longName = "A".repeat(25);
      const err = validateScenarioName(longName, ws);
      assert.ok(err !== null);
      assert.match(err!, /24/);
    });

    it("returns error when name duplicates an existing scenario", () => {
      const ws = fresh();
      const existingName = ws.scenarios[0].name;
      const err = validateScenarioName(existingName, ws);
      assert.ok(err !== null);
    });

    it("allows same name when excludeId matches the scenario", () => {
      const ws = fresh();
      const scenario = ws.scenarios[0];
      const err = validateScenarioName(scenario.name, ws, scenario.id);
      assert.equal(err, null);
    });

    it("returns null for a valid unique name", () => {
      const ws = fresh();
      const err = validateScenarioName("全新方案名称", ws);
      assert.equal(err, null);
    });

    it("exactly 24-char name is valid", () => {
      const ws = fresh();
      const name = "A".repeat(24);
      const err = validateScenarioName(name, ws);
      assert.equal(err, null);
    });
  });
});
