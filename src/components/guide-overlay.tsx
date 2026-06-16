"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { GUIDE_STEPS } from "@/lib/workspace";

export type GuideHandle = {
  open: () => void;
  close: () => void;
};

type GuideOverlayProps = {
  isOpen: boolean;
  onDismiss: () => void;
  guideRef: React.MutableRefObject<GuideHandle | null>;
  rootRef: React.RefObject<HTMLElement | null>;
};

export function GuideOverlay({ isOpen, onDismiss, guideRef, rootRef }: GuideOverlayProps) {
  const [step, setStep] = useState(0);
  // Defer portal rendering until after hydration (avoids SSR mismatch).
  // useSyncExternalStore reads the client snapshot synchronously without
  // triggering the react-hooks lint warnings that useEffect + setState causes.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const open = useCallback(() => {
    setStep(0);
  }, []);

  const close = useCallback(() => {
    clearHighlights();
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    guideRef.current = { open, close };
    return () => { guideRef.current = null; };
  }, [open, close, guideRef]);

  useEffect(() => {
    if (!isOpen) return;
    highlightTarget(step, rootRef.current);
    return () => clearHighlights();
  }, [isOpen, step, rootRef]);

  const total = GUIDE_STEPS.length;

  const goNext = () => {
    if (step < total - 1) {
      setStep((s) => s + 1);
    } else {
      close();
    }
  };

  const goPrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goPrev();
  };

  if (!isOpen || !mounted) return null;

  const currentStep = GUIDE_STEPS[step];

  return createPortal(
    <>
      <div className="guide-overlay open" aria-hidden="false" />
      <div
        className="guide-card open"
        aria-hidden="false"
        onKeyDown={handleKeyDown}
      >
        <div className="guide-progress">
          步骤 {step + 1} / {total}
        </div>
        <h3>{currentStep.title}</h3>
        <p>{currentStep.body}</p>
        <div className="guide-actions">
          <button className="btn secondary" type="button" onClick={close}>
            关闭引导
          </button>
          <div className="inline-actions">
            <button
              className="btn secondary"
              type="button"
              onClick={goPrev}
              disabled={step === 0}
            >
              上一步
            </button>
            <button className="btn" type="button" onClick={goNext}>
              {step === total - 1 ? "完成" : "下一步"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function highlightTarget(stepIndex: number, root: HTMLElement | null) {
  clearHighlights();
  const step = GUIDE_STEPS[stepIndex];
  if (!step || !root) return;

  const target = root.querySelector(`#${step.target}`) as HTMLElement | null;
  if (target) {
    target.classList.add("guide-focus");
    target.scrollIntoView({
      block: step.target === "helpBtn" ? "start" : "center",
      inline: "nearest",
    });
  }
}

function clearHighlights() {
  document.querySelectorAll(".guide-focus").forEach((el) => {
    el.classList.remove("guide-focus");
  });
}
