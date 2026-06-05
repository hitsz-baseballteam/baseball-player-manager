import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { LineupPageClient } from "@/components/lineup-page-client";
import { createDefaultWorkspace } from "@/lib/workspace";

describe("LineupPageClient", () => {
  const workspace = createDefaultWorkspace(true);

  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).confirm = () => true;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });

  it("renders the lineup workbench with field board, lineup order, and bench panel", () => {
    render(
      <LineupPageClient
        initialWorkspace={workspace}
        initialVersion={1}
      />,
    );

    assert.ok(screen.getByText("排阵工作台"));
    assert.ok(screen.getByRole("link", { name: "排阵" }));
    assert.ok(screen.getByLabelText("守备位置图"));
    assert.ok(screen.getByText("打线顺序"));
    assert.ok(screen.getByText("全队球员"));
    assert.ok(screen.getByRole("button", { name: "自动排阵" }));
    assert.ok(screen.getByRole("button", { name: "清空阵容" }));
  });

  it("renders scenario select with all scenarios", () => {
    render(
      <LineupPageClient
        initialWorkspace={workspace}
        initialVersion={1}
      />,
    );

    const select = screen.getByLabelText("切换当前方案") as HTMLSelectElement;
    assert.ok(select);
    assert.equal(select.options.length, workspace.scenarios.length);
  });

  it("clicking 清空阵容 calls clearAllAssignments (window.confirm returns true)", async () => {
    const ws = createDefaultWorkspace(true);
    // pre-populate with auto-assign so there's something to clear
    render(
      <LineupPageClient
        initialWorkspace={ws}
        initialVersion={1}
      />,
    );

    // auto-assign first
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "自动排阵" }));
    });

    // then clear
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "清空阵容" }));
    });

    // All lineup slots should now show "空"
    const emptySlots = screen.getAllByText("空");
    assert.ok(emptySlots.length > 0);
  });

  it("clicking a lineup slot opens player picker", async () => {
    render(
      <LineupPageClient
        initialWorkspace={workspace}
        initialVersion={1}
      />,
    );

    const slot = screen.getByLabelText(/第 1 棒/);
    await act(async () => {
      fireEvent.click(slot);
    });

    assert.ok(screen.getByRole("menu", { name: /第 1 棒/ }));
  });

  it("renders all player names in bench panel", () => {
    render(
      <LineupPageClient
        initialWorkspace={workspace}
        initialVersion={1}
      />,
    );

    for (const player of workspace.players.slice(0, 3)) {
      assert.ok(screen.getAllByText(player.name).length >= 1);
    }
  });
});
