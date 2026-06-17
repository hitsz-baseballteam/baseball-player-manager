import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDefaultWorkspace, type Workspace } from "@/lib/workspace";

let PlayerManagerClient: typeof import("./player-manager-client").PlayerManagerClient;
const baseWorkspace = createDefaultWorkspace(true);

function cloneWorkspace<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("PlayerManagerClient", () => {
  const pushes: string[] = [];
  const savedWorkspaces: Workspace[] = [];
  let latestWorkspace = cloneWorkspace(baseWorkspace);
  const originalConfirm = window.confirm;

  beforeEach(async () => {
    pushes.length = 0;
    savedWorkspaces.length = 0;
    latestWorkspace = cloneWorkspace(baseWorkspace);
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");

    window.confirm = (() => true) as typeof window.confirm;

    mock.module("next/navigation", {
      namedExports: {
        useRouter() {
          return {
            push(href: string) {
              pushes.push(href);
            },
          };
        },
      },
    });

    mock.module("@/lib/workspace-client", {
      namedExports: {
        async submitMutationWithRetry(
          currentWorkspace: Workspace,
          version: number,
          applyMutation: (latest: Workspace) => Workspace,
        ) {
          latestWorkspace = applyMutation(cloneWorkspace(currentWorkspace));
          savedWorkspaces.push(cloneWorkspace(latestWorkspace));
          return {
            workspace: cloneWorkspace(latestWorkspace),
            version: version + 1,
            updatedAt: new Date("2026-06-05T10:00:00.000Z").toISOString(),
          };
        },
        async createScenario(
          scenario: Workspace["scenarios"][number],
          version: number,
          activate = false,
        ) {
          latestWorkspace = cloneWorkspace(latestWorkspace);
          latestWorkspace.scenarios.push(cloneWorkspace(scenario));
          if (activate) {
            latestWorkspace.activeScenarioId = scenario.id;
          }
          savedWorkspaces.push(cloneWorkspace(latestWorkspace));
          return {
            workspace: cloneWorkspace(latestWorkspace),
            version: version + 1,
            updatedAt: new Date("2026-06-05T10:00:00.000Z").toISOString(),
          };
        },
        async activateScenario(scenarioId: string, version: number) {
          latestWorkspace = cloneWorkspace(latestWorkspace);
          latestWorkspace.activeScenarioId = scenarioId;
          savedWorkspaces.push(cloneWorkspace(latestWorkspace));
          return {
            workspace: cloneWorkspace(latestWorkspace),
            version: version + 1,
            updatedAt: new Date("2026-06-05T10:00:00.000Z").toISOString(),
          };
        },
        async updateScenarioAssignments(
          scenarioId: string,
          assignments: Workspace["scenarios"][number]["assignments"],
          version: number,
        ) {
          latestWorkspace = cloneWorkspace(latestWorkspace);
          latestWorkspace.scenarios = latestWorkspace.scenarios.map((scenario) =>
            scenario.id === scenarioId ? { ...scenario, assignments: cloneWorkspace(assignments) } : scenario,
          );
          savedWorkspaces.push(cloneWorkspace(latestWorkspace));
          return {
            workspace: cloneWorkspace(latestWorkspace),
            version: version + 1,
            updatedAt: new Date("2026-06-05T10:00:00.000Z").toISOString(),
          };
        },
        async loadWorkspaceSnapshot() {
          return {
            workspace: cloneWorkspace(latestWorkspace),
            version: 99,
            updatedAt: new Date("2026-06-05T10:00:00.000Z").toISOString(),
          };
        },
        isVersionConflict() {
          return false;
        },
        useWorkspaceSnapshot(initial?: Workspace) {
          // The component uses this hook as a side cache; the real
          // source of truth is `useState` above. Returning the initial
          // workspace as `data` (with a no-op `mutate`) keeps the
          // existing test assertions valid.
          return {
            data: initial,
            version: 1,
            isLoading: false,
            isValidating: false,
            error: undefined,
            mutate: async () => undefined,
          };
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
    window.confirm = originalConfirm;
  });

  it("renders a pure React homepage and routes actions to pages or shared logic", async () => {
    const user = userEvent.setup();

    render(
      <PlayerManagerClient
        initialWorkspace={baseWorkspace}
        initialVersion={4}
      />,
    );

    await screen.findByRole("heading", { name: "比赛日指挥台" });

    assert.equal(screen.queryByText("深入编辑工作台"), null);
    assert.ok(screen.getByRole("button", { name: /^自动排阵/ }));
    assert.ok(screen.getByRole("button", { name: /^新增球员/ }));
    assert.ok(screen.getByRole("button", { name: /^导入/ }));
    assert.ok(screen.getByRole("button", { name: /^新建方案/ }));

    await user.click(screen.getByRole("button", { name: /^新增球员/ }));
    await user.click(screen.getByRole("button", { name: /^导入/ }));
    await user.click(screen.getByRole("button", { name: "管理方案" }));

    assert.deepEqual(pushes, ["/panel/roster", "/panel/settings", "/panel/scenarios"]);

    await user.click(screen.getByRole("button", { name: /^自动排阵/ }));
    assert.equal(savedWorkspaces.length, 1);

    await user.click(screen.getByRole("button", { name: /^新建方案/ }));
    assert.equal(savedWorkspaces.length, 2);
    assert.equal(savedWorkspaces[1]?.scenarios.length, baseWorkspace.scenarios.length + 1);
    assert.equal(savedWorkspaces[1]?.activeScenarioId, savedWorkspaces[1]?.scenarios.at(-1)?.id);

    await user.click(screen.getAllByRole("button", { name: "复制方案" })[0]);
    assert.equal(savedWorkspaces.length, 3);
    assert.ok((savedWorkspaces[2]?.scenarios.length ?? 0) > (savedWorkspaces[1]?.scenarios.length ?? 0));
    assert.equal(savedWorkspaces[2]?.activeScenarioId, savedWorkspaces[2]?.scenarios.at(-1)?.id);

    await user.click(screen.getByRole("button", { name: /^清空/ }));
    assert.equal(savedWorkspaces.length, 4);

    const lastScenario = savedWorkspaces[3]?.scenarios.find(
      (scenario) => scenario.id === savedWorkspaces[3]?.activeScenarioId,
    );
    assert.ok(lastScenario);
    assert.ok(lastScenario?.assignments.lineup.every((slot) => slot === null));
    assert.ok(Object.values(lastScenario?.assignments.defense ?? {}).every((slot) => slot === null));
  });
});
