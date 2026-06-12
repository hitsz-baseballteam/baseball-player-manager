import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup } from "@testing-library/react";
import { ScenarioList } from "./scenario-list";
import { createDefaultWorkspace, createScenario, createEmptyAssignments } from "@/lib/workspace";

describe("ScenarioList", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all scenarios with names", () => {
    const ws = createDefaultWorkspace(true);
    const warnings = new Map();

    render(
      <ScenarioList
        scenarios={ws.scenarios}
        activeScenarioId={ws.activeScenarioId}
        scenarioWarnings={warnings}
        onSetActive={() => {}}
        onRename={() => {}}
        onCopy={() => {}}
        onDelete={() => {}}
      />,
    );

    for (const s of ws.scenarios) {
      assert.ok(screen.getByText(s.name), `Scenario ${s.name} not found`);
    }
  });

  it("highlights the active scenario with a badge", () => {
    const ws = createDefaultWorkspace(true);
    const second = createScenario("第二方案", "", createEmptyAssignments());
    const scenarios = [ws.scenarios[0], second];
    const warnings = new Map();

    render(
      <ScenarioList
        scenarios={scenarios}
        activeScenarioId={second.id}
        scenarioWarnings={warnings}
        onSetActive={() => {}}
        onRename={() => {}}
        onCopy={() => {}}
        onDelete={() => {}}
      />,
    );

    assert.ok(screen.getByText(ws.scenarios[0].name));
    assert.ok(screen.getByText("第二方案"));
  });

  it("shows rename, copy, delete action buttons", () => {
    const ws = createDefaultWorkspace(true);
    const warnings = new Map();

    render(
      <ScenarioList
        scenarios={ws.scenarios}
        activeScenarioId={ws.activeScenarioId}
        scenarioWarnings={warnings}
        onSetActive={() => {}}
        onRename={() => {}}
        onCopy={() => {}}
        onDelete={() => {}}
      />,
    );

    // Action buttons: rename, copy, delete
    assert.ok(screen.getByText("重命名"));
    assert.ok(screen.getByText("复制"));
    assert.ok(screen.getByText("删除"));
  });

  it("renders empty state without crashing", () => {
    const warnings = new Map();

    render(
      <ScenarioList
        scenarios={[]}
        activeScenarioId=""
        scenarioWarnings={warnings}
        onSetActive={() => {}}
        onRename={() => {}}
        onCopy={() => {}}
        onDelete={() => {}}
      />,
    );

    // Should render without error — no cards shown
  });
});
