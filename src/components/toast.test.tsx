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
    assert.equal(toast.className, "");
    assert.equal(toast.textContent, "");
  });

  it("shows message when showToast is called", () => {
    render(<TestHarness toastRef={toastRef} />);
    act(() => {
      toastRef.current?.showToast("保存成功");
    });
    const toast = document.getElementById("toast");
    assert.ok(toast);
    assert.equal(toast.className, "show");
    assert.equal(toast.textContent, "保存成功");
  });

  it("hides toast after 1800ms", async () => {
    render(<TestHarness toastRef={toastRef} />);
    act(() => {
      toastRef.current?.showToast("test message");
    });
    const toast = document.getElementById("toast")!;
    assert.equal(toast.className, "show");

    await act(() => new Promise((resolve) => setTimeout(resolve, 1900)));
    assert.equal(toast.className, "");
  });

  it("resets timer on repeated calls", async () => {
    render(<TestHarness toastRef={toastRef} />);
    act(() => {
      toastRef.current?.showToast("first");
    });
    const toast = document.getElementById("toast")!;

    // Advance 1000ms and send another toast
    await act(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    act(() => {
      toastRef.current?.showToast("second");
    });

    // 1000ms after second call, it should still be visible
    await act(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    assert.equal(toast.className, "show");
    assert.equal(toast.textContent, "second");

    // After full 1800ms from second call, it should hide
    await act(() => new Promise((resolve) => setTimeout(resolve, 900)));
    assert.equal(toast.className, "");
  });
});
