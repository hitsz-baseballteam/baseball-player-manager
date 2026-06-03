import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { HelpDrawer, type HelpDrawerHandle } from "./help-drawer";

function TestHarness({
  isOpen,
  onOpen,
  onClose,
  onReplayGuide,
  helpRef,
}: {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onReplayGuide: () => void;
  helpRef: React.MutableRefObject<HelpDrawerHandle | null>;
}) {
  return (
    <HelpDrawer
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      onReplayGuide={onReplayGuide}
      helpRef={helpRef}
    />
  );
}

function StatefulHarness({
  helpRef,
}: {
  helpRef: React.MutableRefObject<HelpDrawerHandle | null>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <HelpDrawer
      isOpen={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      onReplayGuide={() => {}}
      helpRef={helpRef}
    />
  );
}

describe("HelpDrawer", () => {
  let onOpenCalls: number;
  let onCloseCalls: number;
  let onReplayCalls: number;
  let helpRef: React.MutableRefObject<HelpDrawerHandle | null>;

  const setup = () => {
    onOpenCalls = 0;
    onCloseCalls = 0;
    onReplayCalls = 0;
    helpRef = { current: null } as React.MutableRefObject<HelpDrawerHandle | null>;
  };

  afterEach(() => {
    cleanup();
    document.querySelectorAll(".drawer-scrim, .help-drawer").forEach((el) => el.remove());
  });

  it("renders nothing when closed", () => {
    setup();
    render(
      <TestHarness
        isOpen={false}
        onOpen={() => onOpenCalls++}
        onClose={() => onCloseCalls++}
        onReplayGuide={() => onReplayCalls++}
        helpRef={helpRef}
      />,
    );
    assert.equal(document.querySelector(".help-drawer.open"), null);
    assert.equal(document.querySelector(".drawer-scrim.open"), null);
  });

  it("renders drawer and scrim when open", () => {
    setup();
    render(
      <TestHarness
        isOpen={true}
        onOpen={() => onOpenCalls++}
        onClose={() => onCloseCalls++}
        onReplayGuide={() => onReplayCalls++}
        helpRef={helpRef}
      />,
    );
    assert.ok(document.querySelector(".help-drawer.open"));
    assert.ok(document.querySelector(".drawer-scrim.open"));
    assert.ok(screen.getByText("使用指引 / 帮助"));
  });

  it("calls onClose on Escape key", () => {
    setup();
    render(
      <TestHarness
        isOpen={true}
        onOpen={() => onOpenCalls++}
        onClose={() => onCloseCalls++}
        onReplayGuide={() => onReplayCalls++}
        helpRef={helpRef}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    assert.equal(onCloseCalls, 1);
  });

  it("calls onClose when scrim is clicked", () => {
    setup();
    render(
      <TestHarness
        isOpen={true}
        onOpen={() => onOpenCalls++}
        onClose={() => onCloseCalls++}
        onReplayGuide={() => onReplayCalls++}
        helpRef={helpRef}
      />,
    );
    const scrim = document.querySelector(".drawer-scrim")!;
    fireEvent.click(scrim);
    assert.equal(onCloseCalls, 1);
  });

  it("calls onClose when close button is clicked", () => {
    setup();
    render(
      <TestHarness
        isOpen={true}
        onOpen={() => onOpenCalls++}
        onClose={() => onCloseCalls++}
        onReplayGuide={() => onReplayCalls++}
        helpRef={helpRef}
      />,
    );
    const closeBtn = screen.getByLabelText("关闭帮助");
    fireEvent.click(closeBtn);
    assert.equal(onCloseCalls, 1);
  });

  it("calls onReplayGuide when replay button is clicked", () => {
    setup();
    render(
      <TestHarness
        isOpen={true}
        onOpen={() => onOpenCalls++}
        onClose={() => onCloseCalls++}
        onReplayGuide={() => onReplayCalls++}
        helpRef={helpRef}
      />,
    );
    const replayBtn = screen.getByText("重新查看新手引导");
    fireEvent.click(replayBtn);
    assert.equal(onReplayCalls, 1);
  });

  it("exposes open/close via helpRef", () => {
    setup();
    render(
      <TestHarness
        isOpen={true}
        onOpen={() => onOpenCalls++}
        onClose={() => onCloseCalls++}
        onReplayGuide={() => onReplayCalls++}
        helpRef={helpRef}
      />,
    );
    assert.ok(helpRef.current);
    assert.equal(typeof helpRef.current.open, "function");
    assert.equal(typeof helpRef.current.close, "function");
  });

  it("opens the drawer when helpRef.open is called", async () => {
    setup();
    render(<StatefulHarness helpRef={helpRef} />);
    assert.equal(document.querySelector(".help-drawer.open"), null);

    await act(async () => {
      helpRef.current?.open();
    });

    assert.ok(document.querySelector(".help-drawer.open"));
  });
});
