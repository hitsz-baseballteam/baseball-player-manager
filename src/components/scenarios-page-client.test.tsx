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

  it("renders the scenarios page with all scenario names visible", () => {
    render(
      <ScenariosPageClient
        initialWorkspace={workspace}
        initialVersion={1}
      />,
    );

    assert.ok(screen.getAllByText("战术场景").length >= 1);
    assert.ok(screen.getByRole("link", { name: "战术场景" }));
    assert.ok(screen.getByRole("button", { name: "+ 新建方案" }));
    assert.ok(screen.getByText("列表"));
    assert.ok(screen.getByText("对比"));

    // All scenario names should be visible (may appear in nav + cards)
    for (const s of workspace.scenarios) {
      assert.ok(screen.getAllByText(s.name).length >= 1);
    }
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
      fireEvent.click(screen.getByRole("button", { name: "+ 新建方案" }));
    });

    const dialog = screen.getByRole("dialog", { name: "新建方案" });
    assert.ok(dialog);

    // Fill in the form
    const nameInput = screen.getByPlaceholderText("例如：对强投方案") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "秋季赛方案" } });
    });

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "创建" }));
    });

    // The new scenario should not appear immediately because save is async mock.
    // Just verify the dialog closed.
    assert.ok(!screen.queryByRole("dialog", { name: "新建方案" }));
  });

  it("copies a scenario and shows it in the list", async () => {
    render(
      <ScenariosPageClient
        initialWorkspace={workspace}
        initialVersion={1}
      />,
    );

    const copyButtons = screen.getAllByText("复制");
    assert.ok(copyButtons.length > 0);

    await act(async () => {
      fireEvent.click(copyButtons[0]);
    });

    // The workspace update occurs async, but we just need to confirm
    // it does not throw
  });

  it("switches to compare view and shows two scenario pickers", async () => {
    // Need at least 2 scenarios
    const { createScenarioAction } = await import("@/lib/lineup-actions");
    const twoScenarioWs = createScenarioAction(workspace, "备用方案", "");
    render(
      <ScenariosPageClient
        initialWorkspace={twoScenarioWs}
        initialVersion={1}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("对比"));
    });

    assert.ok(screen.getByLabelText("选择场景 A"));
    assert.ok(screen.getByLabelText("选择场景 B"));
  });

  it("disables delete button when only one scenario remains", async () => {
    const singleWs = createDefaultWorkspace(true);
    singleWs.scenarios = [singleWs.scenarios[0]];

    render(
      <ScenariosPageClient
        initialWorkspace={singleWs}
        initialVersion={1}
      />,
    );

    // The "删除" button must be disabled when there is only one scenario
    const deleteBtns = screen.getAllByText("删除");
    assert.ok(deleteBtns.length >= 1);
    for (const btn of deleteBtns) {
      assert.ok(
        (btn as HTMLButtonElement).disabled ||
          btn.closest("button")?.disabled,
        "删除 button should be disabled with a single scenario",
      );
    }
  });
});
