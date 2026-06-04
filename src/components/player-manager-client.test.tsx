import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDefaultWorkspace, type Workspace } from "@/lib/workspace";

let PlayerManagerClient: typeof import("./player-manager-client").PlayerManagerClient;
let mountedRoot: HTMLElement | null;

const baseWorkspace = createDefaultWorkspace(true);

function cloneWorkspace<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildUpdatedWorkspace(): Workspace {
  const workspace = cloneWorkspace(baseWorkspace);
  const fallbackScenario = cloneWorkspace(workspace.scenarios[0]);
  fallbackScenario.id = "scenario-b";
  fallbackScenario.name = "决胜方案";
  fallbackScenario.note = "第七局后优先保证中线守备与代跑空间。";
  fallbackScenario.updatedAt = new Date("2026-06-04T09:30:00.000Z").toISOString();
  fallbackScenario.assignments.defense.SS = null;
  fallbackScenario.assignments.defense.RF = null;
  fallbackScenario.assignments.lineup = fallbackScenario.assignments.lineup.slice(0, 7).concat([null, null]);
  workspace.scenarios = [workspace.scenarios[0], fallbackScenario];
  workspace.activeScenarioId = fallbackScenario.id;
  return workspace;
}

describe("PlayerManagerClient", () => {
  beforeEach(async () => {
    mountedRoot = null;
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");

    mock.module("@/lib/player-manager-dom", {
      namedExports: {
        mountPlayerManager(root: HTMLElement, _snapshot: unknown, callbacks: { onStateChange?: (snapshot: { workspace: Workspace; version: number; saveStatus: string }) => void }) {
          mountedRoot = root;
          callbacks.onStateChange?.({
            workspace: buildUpdatedWorkspace(),
            version: 7,
            saveStatus: "已同步到云端",
          });
          return () => {};
        },
      },
    });

    ({ PlayerManagerClient } = await import("./player-manager-client"));
  });

  afterEach(() => {
    cleanup();
    mock.reset();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.body.innerHTML = "";
  });

  it("renders the overview and performs deep bridge interactions", async () => {
    const user = userEvent.setup();
    const autoAssignClicks: string[] = [];
    const exportWorkspaceClicks: string[] = [];
    const scenarioChanges: string[] = [];

    render(
      <PlayerManagerClient
        initialWorkspace={baseWorkspace}
        initialVersion={4}
        markup={`
          <main class="app-shell">
            <button id="autoAssignBtn" type="button">自动排阵</button>
            <button id="addPlayerBtn" type="button">新增球员</button>
            <button id="importBtn" type="button">导入数据</button>
            <button id="newScenarioBtn" type="button">新建方案</button>
            <button id="exportWorkspaceBtn" type="button">导出工作区</button>
            <button id="exportScenarioBtn" type="button">导出当前方案</button>
            <button id="renameScenarioBtn" type="button">重命名方案</button>
            <button id="duplicateScenarioBtn" type="button">复制方案</button>
            <button id="clearAssignmentsBtn" type="button">清空当前阵容</button>
            <select id="scenarioSelect">
              <option value="${baseWorkspace.scenarios[0].id}">${baseWorkspace.scenarios[0].name}</option>
              <option value="scenario-b">决胜方案</option>
            </select>
            <section id="scenarioPanel">legacy scenario panel</section>
            <section id="rosterPanel">legacy roster panel</section>
            <section id="fieldPanel">legacy field panel</section>
            <section id="lineupPanel">legacy lineup panel</section>
            <section id="warnings">legacy warnings panel</section>
            <div id="saveStatus">本地工作区已准备</div>
          </main>
        `}
        styles=""
      />,
    );

    const autoAssignBtn = document.querySelector<HTMLButtonElement>("#autoAssignBtn");
    const exportWorkspaceBtn = document.querySelector<HTMLButtonElement>("#exportWorkspaceBtn");
    const legacyScenarioSelect = document.querySelector<HTMLSelectElement>("#scenarioSelect");
    const fieldPanel = document.querySelector<HTMLElement>("#fieldPanel");
    assert.ok(autoAssignBtn);
    assert.ok(exportWorkspaceBtn);
    assert.ok(legacyScenarioSelect);
    assert.ok(fieldPanel);

    autoAssignBtn.addEventListener("click", () => autoAssignClicks.push("clicked"));
    exportWorkspaceBtn.addEventListener("click", () => exportWorkspaceClicks.push("clicked"));
    legacyScenarioSelect.addEventListener("change", () => scenarioChanges.push(legacyScenarioSelect.value));

    await screen.findByRole("heading", { name: "比赛日总控台" });
    assert.ok(screen.getAllByText("决胜方案").length >= 2);

    assert.ok(mountedRoot);
    assert.match(mountedRoot.textContent ?? "", /legacy scenario panel/);
    assert.doesNotMatch(mountedRoot.textContent ?? "", /比赛日总控台/);

    assert.ok(screen.getByText(/先处理强提醒/));
    assert.ok(screen.getByLabelText("切换当前方案"));
    assert.ok(screen.getByRole("button", { name: "导出工作区" }));
    assert.ok(screen.getAllByRole("button", { name: "去守位区" }).length >= 2);

    await user.click(screen.getAllByRole("button", { name: /自动排阵/ })[0]);
    assert.equal(autoAssignClicks.length, 1);
    assert.ok(fieldPanel.classList.contains("bridge-focus"));

    await user.click(screen.getByRole("button", { name: "导出工作区" }));
    assert.equal(exportWorkspaceClicks.length, 1);

    await user.selectOptions(screen.getByLabelText("切换当前方案"), baseWorkspace.scenarios[0].id);
    assert.equal(legacyScenarioSelect.value, baseWorkspace.scenarios[0].id);
    assert.deepEqual(scenarioChanges, [baseWorkspace.scenarios[0].id]);

    await user.click(screen.getAllByRole("button", { name: "去守位区" })[0]);
    assert.ok(fieldPanel.classList.contains("bridge-focus"));

    assert.equal(document.querySelectorAll(".help-drawer").length, 1);

    const themeButton = screen.getByRole("button", { name: /切换主题/ });
    await user.click(themeButton);
    assert.equal(document.documentElement.dataset.theme, "night");
  });
});
