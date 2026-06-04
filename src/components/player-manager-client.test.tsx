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

  it("renders phase 2 overview, bridges quick actions, and keeps shell actions interactive", async () => {
    const user = userEvent.setup();
    const autoAssignClicks: string[] = [];
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
            <select id="scenarioSelect">
              <option value="${baseWorkspace.scenarios[0].id}">${baseWorkspace.scenarios[0].name}</option>
              <option value="scenario-b">决胜方案</option>
            </select>
            <section id="scenarioPanel">legacy scenario panel</section>
            <div id="saveStatus">本地工作区已准备</div>
          </main>
        `}
        styles=""
      />,
    );

    const autoAssignBtn = document.querySelector<HTMLButtonElement>("#autoAssignBtn");
    const legacyScenarioSelect = document.querySelector<HTMLSelectElement>("#scenarioSelect");
    assert.ok(autoAssignBtn);
    assert.ok(legacyScenarioSelect);
    autoAssignBtn.addEventListener("click", () => autoAssignClicks.push("clicked"));
    legacyScenarioSelect.addEventListener("change", () => scenarioChanges.push(legacyScenarioSelect.value));

    await screen.findByRole("heading", { name: "比赛日总控台" });
    assert.ok(screen.getAllByText("决胜方案").length >= 2);

    assert.ok(mountedRoot);
    assert.match(mountedRoot.textContent ?? "", /legacy scenario panel/);
    assert.doesNotMatch(mountedRoot.textContent ?? "", /比赛日总控台/);

    assert.ok(screen.getByText(/先处理强提醒/));
    assert.ok(screen.getAllByRole("button", { name: /自动排阵/ }).length >= 2);
    assert.ok(screen.getByLabelText("切换当前方案"));

    await user.click(screen.getAllByRole("button", { name: /自动排阵/ })[0]);
    assert.equal(autoAssignClicks.length, 1);

    await user.selectOptions(screen.getByLabelText("切换当前方案"), baseWorkspace.scenarios[0].id);
    assert.equal(legacyScenarioSelect.value, baseWorkspace.scenarios[0].id);
    assert.deepEqual(scenarioChanges, [baseWorkspace.scenarios[0].id]);

    assert.equal(document.querySelectorAll(".help-drawer").length, 1);

    const themeButton = screen.getByRole("button", { name: /切换主题/ });
    await user.click(themeButton);
    assert.equal(document.documentElement.dataset.theme, "night");
  });
});
