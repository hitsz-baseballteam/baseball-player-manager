import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup, act } from "@testing-library/react";
import { ToastProvider, type ToastHandle } from "./toast";

function TestHarness({ toastRef }: { toastRef: React.MutableRefObject<ToastHandle | null> }) {
  return (
    <ToastProvider toastRef={toastRef}>
      <div data-testid="child">content</div>
    </ToastProvider>
  );
}

describe("Toast", () => {
  let toastRef: React.MutableRefObject<ToastHandle | null>;

  beforeEach(() => {
    toastRef = { current: null } as React.MutableRefObject<ToastHandle | null>;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders children and toast container hidden by default", () => {
    render(<TestHarness toastRef={toastRef} />);
    assert.ok(screen.getByTestId("child"));
    const toast = document.getElementById("toast");
    assert.ok(toast);
    assert.equal(toast.className, "omp-toast");
    assert.equal(toast.textContent, "");
  });

  it.todo("shows message when showToast is called");

  it("hides toast after 1800ms", async () => {
    render(<TestHarness toastRef={toastRef} />);
    act(() => {
      toastRef.current?.showToast("test message");
    });
    const toast = document.getElementById("toast")!;
    assert.equal(toast.className, "omp-toast show");

    await act(() => new Promise((resolve) => setTimeout(resolve, 1900)));
    assert.equal(toast.className, "omp-toast");
  });

  it.todo("resets timer on repeated calls");
});
