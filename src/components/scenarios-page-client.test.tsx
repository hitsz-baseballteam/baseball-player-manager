import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ScenariosPageClient } from "@/components/scenarios-page-client";
import { createDefaultWorkspace } from "@/lib/workspace";

describe("ScenariosPageClient", () => {
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

  it("renders the unified scenarios+lineup page with toolbar", () => {
    render(
      <ScenariosPageClient
        initialWorkspace={workspace}
        initialVersion={1}
      />,
    );

    // Nav link should exist
    assert.ok(screen.getByRole("link", { name: "战术场景" }));
    // Toolbar buttons
    assert.ok(screen.getByRole("button", { name: "+ 新建" }));
    assert.ok(screen.getByRole("button", { name: "改名" }));
    assert.ok(screen.getByRole("button", { name: "复制" }));
    // View toggle tabs
    assert.ok(screen.getByRole("button", { name: "排阵" }));
    assert.ok(screen.getByRole("button", { name: "对比" }));
    // Scenario select
    assert.ok(screen.getByRole("combobox", { name: "切换当前方案" }));
    // Board area should be visible in lineup mode
    assert.ok(screen.getByText("打线顺序"));
  });

  it("opens create dialog and creates a new scenario", async () => {
    render(
      <ScenariosPageClient
        initialWorkspace={workspace}
        initialVersion={1}
      />,
    );

    // Open create dialog
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "+ 新建" }));
    });

    const dialog = screen.getByRole("dialog", { name: "新建方案" });
    assert.ok(dialog);

    // Fill in the form via label text
    const nameInput = screen.getByLabelText("方案名称") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "秋季赛方案" } });
    });

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "创建" }));
    });

    // Dialog should close after submission
    assert.ok(!screen.queryByRole("dialog", { name: "新建方案" }));
  });

  it("copies the active scenario", async () => {
    render(
      <ScenariosPageClient
        initialWorkspace={workspace}
        initialVersion={1}
      />,
    );

    const copyBtn = screen.getByRole("button", { name: "复制" });
    assert.ok(copyBtn);
    assert.ok(!(copyBtn as HTMLButtonElement).disabled);

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    // Dialog shouldn't appear for copy (it's direct)
    assert.ok(!screen.queryByRole("dialog"));
  });

  it("switches to compare view", async () => {
    render(
      <ScenariosPageClient
        initialWorkspace={workspace}
        initialVersion={1}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "对比" }));
    });

    // Compare view should show a message that needs 2+ scenarios
    // With only 1 scenario, it shows a hint
    assert.ok(screen.getByText(/需要至少 2 个方案才能对比/));
  });

  it("disables delete button when only one scenario remains", () => {
    render(
      <ScenariosPageClient
        initialWorkspace={workspace}
        initialVersion={1}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: "删除" });
    assert.ok((deleteBtn as HTMLButtonElement).disabled);
  });
});
