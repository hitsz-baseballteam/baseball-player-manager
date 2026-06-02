import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { createRef, type RefObject } from "react";
import { GuideOverlay, type GuideHandle } from "./guide-overlay";
import { GUIDE_STEPS } from "@/lib/workspace";

describe("GuideOverlay", () => {
  let onDismissCalls: number;
  let guideRef: React.MutableRefObject<GuideHandle | null>;
  let rootRef: RefObject<HTMLElement | null>;

  const setup = () => {
    onDismissCalls = 0;
    guideRef = { current: null } as React.MutableRefObject<GuideHandle | null>;
    rootRef = createRef<HTMLElement>();
  };

  afterEach(() => {
    cleanup();
    document.querySelectorAll(".guide-overlay, .guide-card, .guide-focus").forEach((el) => el.remove());
  });

  it("renders nothing when closed", () => {
    setup();
    render(
      <GuideOverlay
        isOpen={false}
        onDismiss={() => onDismissCalls++}
        guideRef={guideRef}
        rootRef={rootRef}
      />,
    );
    assert.equal(document.querySelector(".guide-overlay.open"), null);
    assert.equal(document.querySelector(".guide-card.open"), null);
  });

  it("renders overlay and card with first step when open", () => {
    setup();
    render(
      <GuideOverlay
        isOpen={true}
        onDismiss={() => onDismissCalls++}
        guideRef={guideRef}
        rootRef={rootRef}
      />,
    );
    assert.ok(document.querySelector(".guide-overlay.open"));
    const card = document.querySelector(".guide-card.open");
    assert.ok(card);
    assert.ok(card!.textContent!.includes("步骤 1"));
    assert.ok(card!.textContent!.includes(GUIDE_STEPS[0].title));
  });

  it("navigates to next and previous steps", () => {
    setup();
    render(
      <GuideOverlay
        isOpen={true}
        onDismiss={() => onDismissCalls++}
        guideRef={guideRef}
        rootRef={rootRef}
      />,
    );

    const getCardText = () => document.querySelector(".guide-card.open")?.textContent || "";

    // First step
    assert.ok(getCardText().includes(GUIDE_STEPS[0].title));

    // Next step
    const nextBtn = document.querySelector(".guide-card.open .btn:not(.secondary)")!;
    fireEvent.click(nextBtn);
    assert.ok(getCardText().includes(GUIDE_STEPS[1].title));

    // Previous step
    const prevBtn = document.querySelectorAll(".guide-card.open .btn.secondary")[1]!;
    fireEvent.click(prevBtn);
    assert.ok(getCardText().includes(GUIDE_STEPS[0].title));
  });

  it("shows '完成' on last step and calls onDismiss", () => {
    setup();
    render(
      <GuideOverlay
        isOpen={true}
        onDismiss={() => onDismissCalls++}
        guideRef={guideRef}
        rootRef={rootRef}
      />,
    );

    const lastStepIndex = GUIDE_STEPS.length - 1;
    const nextBtn = () => document.querySelector(".guide-card.open .btn:not(.secondary)")!;

    // Navigate to last step
    for (let i = 0; i < lastStepIndex; i++) {
      fireEvent.click(nextBtn());
    }

    assert.ok(nextBtn().textContent!.includes("完成"));

    fireEvent.click(nextBtn());
    assert.equal(onDismissCalls, 1);
  });

  it("calls onDismiss when skip button is clicked", () => {
    setup();
    render(
      <GuideOverlay
        isOpen={true}
        onDismiss={() => onDismissCalls++}
        guideRef={guideRef}
        rootRef={rootRef}
      />,
    );
    const skipBtn = document.querySelector(".guide-card.open .btn.secondary")!;
    fireEvent.click(skipBtn);
    assert.equal(onDismissCalls, 1);
  });

  it("closes on Escape key", () => {
    setup();
    render(
      <GuideOverlay
        isOpen={true}
        onDismiss={() => onDismissCalls++}
        guideRef={guideRef}
        rootRef={rootRef}
      />,
    );
    const card = document.querySelector(".guide-card.open")!;
    fireEvent.keyDown(card, { key: "Escape" });
    assert.equal(onDismissCalls, 1);
  });

  it("exposes open/close via guideRef", () => {
    setup();
    render(
      <GuideOverlay
        isOpen={true}
        onDismiss={() => onDismissCalls++}
        guideRef={guideRef}
        rootRef={rootRef}
      />,
    );
    assert.ok(guideRef.current);
    assert.equal(typeof guideRef.current.open, "function");
    assert.equal(typeof guideRef.current.close, "function");
  });
});
