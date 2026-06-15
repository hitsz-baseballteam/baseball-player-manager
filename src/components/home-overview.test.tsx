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

  it("renders active scenario in the select", () => {
    const ws = createDefaultWorkspace(true);
    render(<HomeOverview {...makeProps(ws)} />);

    const scenario = getActiveScenario(ws);
    // Scenario name should appear in the select
    const select = screen.getByRole("combobox", { name: "切换方案" });
    assert.ok(select.textContent?.includes(scenario.name));
  });

  it("shows player count metrics inline", () => {
    const ws = createDefaultWorkspace(true);
    render(<HomeOverview {...makeProps(ws)} />);

    assert.ok(screen.getByText("可上场"));
    assert.ok(screen.getByText("轮休/伤停"));
    assert.ok(screen.getAllByText("守位").length >= 1);
    assert.ok(screen.getAllByText("棒次").length >= 1);
  });

  it("shows quick action buttons", () => {
    const ws = createDefaultWorkspace(true);
    render(<HomeOverview {...makeProps(ws)} />);

    assert.ok(screen.getByText("自动排阵"));
    assert.ok(screen.getByText("新增球员"));
    assert.ok(screen.getByText("导入数据"));
    assert.ok(screen.getByText("新建方案"));
  });

  it("renders warning chip with critical warnings for empty lineup", () => {
    const ws = createDefaultWorkspace(true);
    render(<HomeOverview {...makeProps(ws)} />);

    // With empty lineup, the warning panel should expose the incomplete defense.
    assert.ok(screen.getByRole("heading", { name: "阵容警报" }));
    assert.ok(screen.getByText(/守位未满/));
  });

  it("shows scenario switch control", () => {
    const ws = createDefaultWorkspace(true);
    render(<HomeOverview {...makeProps(ws)} />);

    // The scenario switch is a compact select + manage button
    const select = screen.getByRole("combobox", { name: "切换方案" });
    assert.ok(select);
    assert.ok(screen.getByText("管理方案"));
  });
});
