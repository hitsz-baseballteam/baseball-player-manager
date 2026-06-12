import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup } from "@testing-library/react";
import { HomeOverview } from "./home-overview";
import { createDefaultWorkspace, getActiveScenario } from "@/lib/workspace";

function noop() {}

function makeProps(ws = createDefaultWorkspace(true)) {
  return {
    workspace: ws,
    remoteVersion: 1,
    saveStatus: "saved",
    onAutoAssign: noop,
    onAddPlayer: noop,
    onImport: noop,
    onCreateScenario: noop,
    onExportWorkspace: noop,
    onExportScenario: noop,
    onRenameScenario: noop,
    onDuplicateScenario: noop,
    onClearAssignments: noop,
    onScenarioChange: noop,
    onOpenWorkspace: noop,
    onOpenScenarioPanel: noop,
    onOpenRosterPanel: noop,
    onOpenFieldPanel: noop,
    onOpenLineupPanel: noop,
    onOpenWarningsPanel: noop,
  };
}

describe("HomeOverview", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders active scenario name in the panel and select", () => {
    const ws = createDefaultWorkspace(true);
    render(<HomeOverview {...makeProps(ws)} />);

    const scenario = getActiveScenario(ws);
    // Scenario name appears in both select option and panel header
    const matches = screen.getAllByText(scenario.name);
    assert.ok(matches.length >= 2);
  });

  it("shows player count metric", () => {
    const ws = createDefaultWorkspace(true);
    render(<HomeOverview {...makeProps(ws)} />);

    // Metrics show "共 N 人" pattern
    const totalPlayers = ws.players.length;
    assert.ok(screen.getByText(new RegExp(`共\\s*${totalPlayers}\\s*人`)));
  });

  it("shows quick action buttons", () => {
    const ws = createDefaultWorkspace(true);
    render(<HomeOverview {...makeProps(ws)} />);

    assert.ok(screen.getByText("自动排阵"));
    assert.ok(screen.getByText("新增球员"));
    assert.ok(screen.getByText("导入数据"));
    assert.ok(screen.getByText("新建方案"));
  });

  it("renders alert deck with critical warnings for empty lineup", () => {
    const ws = createDefaultWorkspace(true);
    render(<HomeOverview {...makeProps(ws)} />);

    // With empty lineup, "守位未满" appears in both alert summary and list item
    assert.ok(screen.getAllByText(/守位未满/).length >= 1);
    assert.ok(screen.getByText(/棒次未满/));
  });

  it("shows scenario snapshot panel", () => {
    const ws = createDefaultWorkspace(true);
    render(<HomeOverview {...makeProps(ws)} />);

    assert.ok(screen.getByText("切换当前方案"));
  });
});
