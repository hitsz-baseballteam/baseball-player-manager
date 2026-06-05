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
  const originalConfirm = window.confirm;

  beforeEach(async () => {
    pushes.length = 0;
    savedWorkspaces.length = 0;
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
        async saveWithRetry(
          initialWorkspace: Workspace,
          version: number,
        ) {
          savedWorkspaces.push(cloneWorkspace(initialWorkspace));
          return {
            workspace: cloneWorkspace(initialWorkspace),
            version: version + 1,
            updatedAt: new Date("2026-06-05T10:00:00.000Z").toISOString(),
          };
        },
        async loadWorkspaceSnapshot() {
          return {
            workspace: cloneWorkspace(baseWorkspace),
            version: 99,
            updatedAt: new Date("2026-06-05T10:00:00.000Z").toISOString(),
          };
        },
        isVersionConflict() {
          return false;
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

    await screen.findByRole("heading", { name: "比赛日总控台" });

    assert.equal(screen.queryByText("深入编辑工作台"), null);
    assert.ok(screen.getByRole("button", { name: /^自动排阵/ }));
    assert.ok(screen.getByRole("button", { name: /^新增球员/ }));
    assert.ok(screen.getByRole("button", { name: /^导入数据/ }));
    assert.ok(screen.getByRole("button", { name: /^新建方案/ }));

    await user.click(screen.getByRole("button", { name: /^新增球员/ }));
    await user.click(screen.getByRole("button", { name: /^导入数据/ }));
    await user.click(screen.getByRole("button", { name: "去场景页完整管理" }));

    assert.deepEqual(pushes, ["/roster", "/import-export", "/scenarios"]);

    await user.click(screen.getByRole("button", { name: /^自动排阵/ }));
    assert.equal(savedWorkspaces.length, 1);

    await user.click(screen.getByRole("button", { name: /^新建方案/ }));
    assert.equal(savedWorkspaces.length, 2);
    assert.equal(savedWorkspaces[1]?.scenarios.length, baseWorkspace.scenarios.length + 1);

    await user.click(screen.getAllByRole("button", { name: "复制方案" })[0]);
    assert.equal(savedWorkspaces.length, 3);
    assert.ok((savedWorkspaces[2]?.scenarios.length ?? 0) > (savedWorkspaces[1]?.scenarios.length ?? 0));

    await user.click(screen.getByRole("button", { name: /^清空当前阵容/ }));
    assert.equal(savedWorkspaces.length, 4);

    const lastScenario = savedWorkspaces[3]?.scenarios.find(
      (scenario) => scenario.id === savedWorkspaces[3]?.activeScenarioId,
    );
    assert.ok(lastScenario);
    assert.ok(lastScenario?.assignments.lineup.every((slot) => slot === null));
    assert.ok(Object.values(lastScenario?.assignments.defense ?? {}).every((slot) => slot === null));

    const themeButton = screen.getByRole("button", { name: /切换主题/ });
    await user.click(themeButton);
    assert.equal(document.documentElement.dataset.theme, "night");
  });
});
