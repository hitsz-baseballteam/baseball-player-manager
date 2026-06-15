import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDefaultWorkspace, type Workspace, type Game } from "@/lib/workspace";

let StatsPageClient: typeof import("./stats-page-client").StatsPageClient;

function cloneWorkspace<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeWorkspace(): Workspace {
  const ws = createDefaultWorkspace(true);
  ws.players = ws.players.slice(0, 1);
  ws.players[0]!.id = "p-test";
  ws.players[0]!.name = "测试球员";
  ws.players[0]!.number = "99";
  ws.games = [
    {
      id: "g-1",
      date: "2026-06-01",
      opponent: "测试对手",
      gameType: "official" as const,
      totalInnings: 9,
      innings: [],
      statLines: [
        {
          playerId: "p-test",
          pa: 4, ab: 4, h: 2, hr: 0, rbi: 1, r: 1, sb: 0, bb: 0, so: 1,
          ip: null, er: null, soPitching: null, bbPitching: null, hPitching: null,
          po: 0, a: 0, e: 0,
        },
      ],
    },
  ] satisfies Game[];
  return ws;
}

// Configurable mock behavior per test — mutated by individual tests before render
const mockConfig = {
  saveWithRetry: null as
    | ((workspace: Workspace, version: number, _mutation: unknown) => Promise<{ workspace: Workspace; version: number; updatedAt: string }>)
    | null,
  loadWorkspaceSnapshot: null as
    | (() => Promise<{ workspace: Workspace; version: number; updatedAt: string }>)
    | null,
};

function defaultSaveRetry(workspace: Workspace, version: number) {
  return Promise.resolve({
    workspace: cloneWorkspace(workspace),
    version: version + 1,
    updatedAt: "2026-06-15T10:00:00.000Z",
  });
}

function defaultReload() {
  return Promise.resolve({
    workspace: cloneWorkspace(makeWorkspace()),
    version: 1,
    updatedAt: "2026-06-15T10:00:00.000Z",
  });
}

describe("StatsPageClient save lock & rollback", () => {
  const originalConfirm = window.confirm;

  beforeEach(async () => {
    mockConfig.saveWithRetry = defaultSaveRetry;
    mockConfig.loadWorkspaceSnapshot = defaultReload;

    document.documentElement.removeAttribute("data-theme");
    window.confirm = (() => true) as typeof window.confirm;

    mock.module("@/lib/workspace-client", {
      namedExports: {
        async saveWithRetry(workspace: Workspace, version: number, mutation: unknown) {
          const fn = mockConfig.saveWithRetry;
          if (fn) return fn(workspace, version, mutation);
          return defaultSaveRetry(workspace, version);
        },
        async loadWorkspaceSnapshot() {
          const fn = mockConfig.loadWorkspaceSnapshot;
          if (fn) return fn();
          return defaultReload();
        },
        isVersionConflict() {
          return false;
        },
      },
    });

    ({ StatsPageClient } = await import("./stats-page-client"));
  });

  afterEach(() => {
    cleanup();
    mock.reset();
    document.documentElement.removeAttribute("data-theme");
    document.body.innerHTML = "";
    window.confirm = originalConfirm;
  });

  it("saves a new game and shows it in the game list", async () => {
    const user = userEvent.setup();
    const ws = makeWorkspace();

    render(<StatsPageClient initialWorkspace={ws} initialVersion={1} />);

    await user.click(screen.getByRole("button", { name: "比赛数据" }));
    await user.click(screen.getByRole("button", { name: "＋ 添加比赛" }));
    await screen.findByRole("dialog", { name: "新增比赛" });

    await user.type(screen.getByLabelText("日期"), "2026-06-10");
    await user.type(screen.getByLabelText("对手"), "新对手");
    await user.click(screen.getByRole("button", { name: "添加" }));

    await screen.findByText("新对手");
    assert.ok(screen.getByText("2026-06-10"));
  });

  it("on save failure with reload success: rolls back to server state and shows error", async () => {
    mockConfig.saveWithRetry = async () => {
      throw new Error("Save failed");
    };
    // Reload returns empty games to verify the rollback replaces optimistic state
    mockConfig.loadWorkspaceSnapshot = async () => {
      const ws = cloneWorkspace(makeWorkspace());
      ws.games = [];
      return { workspace: ws, version: 2, updatedAt: "2026-06-15T10:00:00.000Z" };
    };

    const user = userEvent.setup();
    const ws = makeWorkspace();

    render(<StatsPageClient initialWorkspace={ws} initialVersion={1} />);

    await user.click(screen.getByRole("button", { name: "比赛数据" }));
    assert.ok(screen.getByText("测试对手"));

    await user.click(screen.getByRole("button", { name: "删除" }));

    // The inline save error should show the rollback message
    await screen.findByText(/已恢复到最新数据/);

    // The server returned empty games, so the optimistic game should be gone
    await waitFor(() => {
      assert.equal(screen.queryByText("测试对手"), null);
    });
  });

  it("on save failure with reload failure: shows unreachable message", async () => {
    mockConfig.saveWithRetry = async () => {
      throw new Error("Save failed");
    };
    mockConfig.loadWorkspaceSnapshot = async () => {
      throw new Error("Reload also failed");
    };

    const user = userEvent.setup();
    const ws = makeWorkspace();

    render(<StatsPageClient initialWorkspace={ws} initialVersion={1} />);

    await user.click(screen.getByRole("button", { name: "比赛数据" }));
    await user.click(screen.getByRole("button", { name: "删除" }));

    // The inline save error should show the unreachable-server message
    await screen.findByText(/检查网络后刷新页面/);
  });

  it("disables action buttons while save is in progress", async () => {
    // A slow save that lets us inspect the UI mid-flight
    const saveStarted = new Promise<void>((resolve) => {
      mockConfig.saveWithRetry = async (workspace: Workspace, version: number) => {
        resolve();
        await new Promise((r) => setTimeout(r, 5000));
        return {
          workspace: cloneWorkspace(workspace),
          version: version + 1,
          updatedAt: "2026-06-15T10:00:00.000Z",
        };
      };
    });

    const user = userEvent.setup();
    const ws = makeWorkspace();

    render(<StatsPageClient initialWorkspace={ws} initialVersion={1} />);

    await user.click(screen.getByRole("button", { name: "比赛数据" }));
    await user.click(screen.getByRole("button", { name: "删除" }));
    await saveStarted;

    // All action buttons should be disabled during save
    const addBtn = screen.getByRole("button", { name: "＋ 添加比赛" });
    assert.ok(addBtn.hasAttribute("disabled"));
  });
});
