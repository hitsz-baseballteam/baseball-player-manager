import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDefaultWorkspace, type Game, type Workspace } from "@/lib/workspace";

let GamesPageClient: typeof import("./games-page-client").GamesPageClient;
const baseWorkspace = createDefaultWorkspace(true);

function cloneWorkspace<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function workspaceWithPlayer(playerId: string) {
  const ws = cloneWorkspace(baseWorkspace);
  const player = ws.players[0];
  if (!player) throw new Error("no default player");
  player.id = playerId;

  ws.games = [
    {
      id: "g-1",
      date: "2026-05-20",
      opponent: "南山高中",
      gameType: "official" as const,
      totalInnings: 9,
      innings: [],
      statLines: [
        {
          playerId,
          pa: 4,
          ab: 4,
          h: 2,
          hr: 1,
          rbi: 2,
          r: 2,
          sb: 0,
          bb: 0,
          so: 1,
          ip: 2.1,
          er: 0,
          soPitching: 3,
          bbPitching: 1,
          hPitching: 1,
          po: 0,
          a: 0,
          e: 0,
        },
      ],
    },
    {
      id: "g-2",
      date: "2026-05-15",
      opponent: "北一中学",
      gameType: "official" as const,
      totalInnings: 9,
      innings: [],
      statLines: [
        {
          playerId,
          pa: 3,
          ab: 2,
          h: 0,
          hr: 0,
          rbi: 0,
          r: 0,
          sb: 0,
          bb: 1,
          so: 1,
          ip: 1.2,
          er: 1,
          soPitching: 2,
          bbPitching: 0,
          hPitching: 2,
          po: 0,
          a: 0,
          e: 0,
        },
      ],
    },
    {
      id: "g-3",
      date: "2026-05-10",
      opponent: "队内红白",
      gameType: "training" as const,
      totalInnings: 7,
      innings: [],
      statLines: [
        {
          playerId,
          pa: 4,
          ab: 3,
          h: 1,
          hr: 0,
          rbi: 1,
          r: 1,
          sb: 1,
          bb: 1,
          so: 0,
          ip: null,
          er: null,
          soPitching: null,
          bbPitching: null,
          hPitching: null,
          po: 0,
          a: 0,
          e: 0,
        },
      ],
    },
  ] satisfies Game[];

  return ws;
}

describe("GamesPageClient", () => {
  const playerId = "test-p-001";
  const savedWorkspaces: Workspace[] = [];
  const originalConfirm = window.confirm;

  beforeEach(async () => {
    savedWorkspaces.length = 0;
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    window.confirm = (() => true) as typeof window.confirm;

    mock.module("@/lib/workspace-client", {
      namedExports: {
        async saveWorkspaceSnapshot(workspace: Workspace, version: number) {
          savedWorkspaces.push(cloneWorkspace(workspace));
          return {
            workspace: cloneWorkspace(workspace),
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

    ({ GamesPageClient } = await import("./games-page-client"));
  });

  afterEach(() => {
    cleanup();
    mock.reset();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.body.innerHTML = "";
    window.confirm = originalConfirm;
  });

  it("renders the games page with tab switch, summary, and game list", async () => {
    const user = userEvent.setup();
    const workspace = workspaceWithPlayer(playerId);

    render(
      <GamesPageClient
        initialWorkspace={workspace}
        initialVersion={5}
        playerId={playerId}
      />,
    );

    await screen.findByRole("heading", { name: /陈浩宇/ });

    assert.ok(screen.getByRole("button", { name: "正式比赛" }));
    assert.ok(screen.getByRole("button", { name: "训练比赛" }));
    assert.ok(screen.getByText("2 / 1"));
    assert.ok(screen.getByText("ERA 2.25"));
    assert.ok(screen.getByText("WHIP 1.00 · 4 局 · 5 K"));
    assert.ok(screen.getByText("南山高中"));
    assert.ok(screen.getByText("北一中学"));
    assert.equal(screen.queryByText("队内红白"), null);

    await user.click(screen.getByRole("button", { name: "训练比赛" }));
    assert.ok(screen.getByText("队内红白"));

    await user.click(screen.getByRole("button", { name: "+ 新增比赛" }));
    assert.ok(screen.getByRole("dialog", { name: /新增比赛/ }));

    await user.click(screen.getByRole("button", { name: "取消" }));
    assert.equal(screen.queryByRole("dialog", { name: /新增比赛/ }), null);
  });

  it("adds and deletes records while persisting the updated workspace", async () => {
    const user = userEvent.setup();
    const workspace = workspaceWithPlayer(playerId);

    render(
      <GamesPageClient
        initialWorkspace={workspace}
        initialVersion={5}
        playerId={playerId}
      />,
    );

    await screen.findByRole("heading", { name: /陈浩宇/ });

    await user.click(screen.getByRole("button", { name: "+ 新增比赛" }));
    await user.type(screen.getByLabelText("日期"), "2026-05-30");
    await user.type(screen.getByLabelText("对手"), "新桥高中");
    await user.click(screen.getByRole("button", { name: "添加" }));

    await screen.findByText("新桥高中");
    assert.equal(savedWorkspaces.length, 1);
    assert.equal(savedWorkspaces[0]?.games.length, 4);

    await user.click(screen.getAllByRole("button", { name: "删除" })[0]);
    await screen.findAllByText("比赛数据已更新");
    assert.equal(savedWorkspaces.length, 2);
    assert.equal(savedWorkspaces[1]?.games.length, 3);
    assert.equal(screen.queryByText("新桥高中"), null);
  });

  it("rejects invalid baseball inning notation before saving", async () => {
    const user = userEvent.setup();
    const workspace = workspaceWithPlayer(playerId);

    render(
      <GamesPageClient
        initialWorkspace={workspace}
        initialVersion={5}
        playerId={playerId}
      />,
    );

    await screen.findByRole("heading", { name: /陈浩宇/ });
    await user.click(screen.getByRole("button", { name: "+ 新增比赛" }));
    await user.type(screen.getByLabelText("日期"), "2026-06-01");
    await user.type(screen.getByLabelText("对手"), "测试队");
    await user.type(screen.getByLabelText("IP"), "1.3");
    await user.click(screen.getByRole("button", { name: "添加" }));

    assert.ok(screen.getByText("投球局数只能以 .0 / .1 / .2 结尾"));
    assert.equal(savedWorkspaces.length, 0);
  });

  it("edits an existing record and persists the saved changes", async () => {
    const user = userEvent.setup();
    const workspace = workspaceWithPlayer(playerId);

    render(
      <GamesPageClient
        initialWorkspace={workspace}
        initialVersion={5}
        playerId={playerId}
      />,
    );

    await screen.findByRole("heading", { name: /陈浩宇/ });
    await user.click(screen.getAllByRole("button", { name: "编辑" })[0]);
    const opponentInput = screen.getByLabelText("对手");
    await user.clear(opponentInput);
    await user.type(opponentInput, "修正版对手");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await screen.findByText("修正版对手");
    assert.equal(savedWorkspaces.length, 1);
    assert.equal(savedWorkspaces[0]?.games[0]?.opponent, "修正版对手");
  });

  it("renders empty state when player is not found", async () => {
    render(
      <GamesPageClient
        initialWorkspace={baseWorkspace}
        initialVersion={5}
        playerId="non-existent"
      />,
    );

    await screen.findByRole("heading", { name: "未找到球员" });
  });
});
