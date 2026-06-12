import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup } from "@testing-library/react";
import { ScenarioCompare } from "./scenario-compare";
import { createDefaultWorkspace, createScenario, createEmptyAssignments } from "@/lib/workspace";

describe("ScenarioCompare", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders column headers with scenario names", () => {
    const ws = createDefaultWorkspace(true);
    const scenarioA = ws.scenarios[0];
    const scenarioB = createScenario("客场方案", "客场", createEmptyAssignments());

    render(
      <ScenarioCompare
        scenarios={[scenarioA, scenarioB]}
        players={ws.players}
        leftId={scenarioA.id}
        rightId={scenarioB.id}
        onSetLeft={() => {}}
        onSetRight={() => {}}
      />,
    );

    // Column headers are h3 elements — getAllByText since names also appear in selects
    const leftHeaders = screen.getAllByText(scenarioA.name);
    assert.ok(leftHeaders.length >= 2, "Should have at least column header + select option");

    const rightHeaders = screen.getAllByText(scenarioB.name);
    assert.ok(rightHeaders.length >= 2);
  });

  it("shows placeholder selectors when no scenario selected", () => {
    const ws = createDefaultWorkspace(true);

    render(
      <ScenarioCompare
        scenarios={ws.scenarios}
        players={ws.players}
        leftId={null}
        rightId={null}
        onSetLeft={() => {}}
        onSetRight={() => {}}
      />,
    );

    assert.ok(screen.getByText("— 选择场景 A —"));
    assert.ok(screen.getByText("— 选择场景 B —"));
  });

  it("displays player number and name in defense comparison table", () => {
    const ws = createDefaultWorkspace(true);
    const scenario = ws.scenarios[0];
    scenario.assignments.defense["P"] = ws.players[0].id;

    render(
      <ScenarioCompare
        scenarios={[scenario]}
        players={ws.players}
        leftId={scenario.id}
        rightId={null}
        onSetLeft={() => {}}
        onSetRight={() => {}}
      />,
    );

    // Player info appears as "18 陈浩宇" in the position value cell
    const fullText = `${ws.players[0].number} ${ws.players[0].name}`;
    assert.ok(screen.getByText(fullText));
  });
});
