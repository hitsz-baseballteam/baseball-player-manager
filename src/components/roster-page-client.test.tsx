import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { RosterPageClient } from "@/components/roster-page-client";
import { createDefaultWorkspace } from "@/lib/workspace";

describe("RosterPageClient", () => {
  const workspace = createDefaultWorkspace(true);
  const firstPlayer = workspace.players[0];
  const originalOpen = window.open;

  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    window.open = (() => null) as typeof window.open;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    window.open = originalOpen;
  });

  it("renders the roster workbench and opens add-player and drawer flows", async () => {
    render(
      <RosterPageClient
        initialWorkspace={workspace}
        initialVersion={3}
      />,
    );

    assert.ok(screen.getByText("名册工作台"));
    assert.ok(screen.getByRole("link", { name: "名册" }));
    assert.ok(screen.getByRole("button", { name: "+ 新增球员" }));
    assert.ok(screen.getByText(firstPlayer.name));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "+ 新增球员" }));
    });

    assert.ok(screen.getByRole("dialog"));
    assert.ok(screen.getByText("新增球员"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "×" }));
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "档案" })[0]);
    });

    assert.ok(screen.getByRole("dialog"));
    assert.ok(screen.getAllByText(firstPlayer.name).length >= 1);
    assert.ok(screen.getByRole("button", { name: "打开完整页面" }));
  });

  it("filters players and enables bulk actions after selection", async () => {
    render(
      <RosterPageClient
        initialWorkspace={workspace}
        initialVersion={3}
      />,
    );

    const bulkEditButton = screen.getByRole("button", { name: "批量编辑" }) as HTMLButtonElement;
    const bulkDeleteButton = screen.getByRole("button", { name: "批量删除" }) as HTMLButtonElement;

    assert.equal(bulkEditButton.disabled, true);
    assert.equal(bulkDeleteButton.disabled, true);

    const search = screen.getByPlaceholderText("搜索姓名或背号...") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(search, { target: { value: firstPlayer.name } });
    });

    assert.ok(screen.getByText(firstPlayer.name));

    const selectCheckbox = screen.getByLabelText(`选择 ${firstPlayer.name}`) as HTMLInputElement;
    await act(async () => {
      fireEvent.click(selectCheckbox);
    });

    assert.equal(bulkEditButton.disabled, false);
    assert.equal(bulkDeleteButton.disabled, false);

    await act(async () => {
      fireEvent.click(bulkEditButton);
    });

    assert.ok(screen.getByRole("dialog"));
    assert.ok(screen.getAllByText("批量编辑").length >= 1);
    assert.ok(screen.getByText(/将修改 1 名已选球员/));
  });
});
