import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = "classic";
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders with classic theme by default", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");
    assert.ok(btn.textContent?.includes("经典"));
    assert.equal(btn.getAttribute("aria-label"), "切换主题，当前：经典");
  });

  it("cycles theme on click: classic → night → field → classic", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");

    assert.equal(document.documentElement.dataset.theme, "classic");

    await user.click(btn);
    assert.equal(document.documentElement.dataset.theme, "night");
    assert.ok(btn.textContent?.includes("暗夜"));
    assert.equal(btn.getAttribute("aria-label"), "切换主题，当前：暗夜");

    await user.click(btn);
    assert.equal(document.documentElement.dataset.theme, "field");
    assert.ok(btn.textContent?.includes("球场"));
    assert.equal(btn.getAttribute("aria-label"), "切换主题，当前：球场");

    await user.click(btn);
    assert.equal(document.documentElement.dataset.theme, "classic");
    assert.ok(btn.textContent?.includes("经典"));
  });

  it("persists theme to localStorage", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");

    await user.click(btn);
    assert.equal(localStorage.getItem("baseball-manager-theme"), "night");

    await user.click(btn);
    assert.equal(localStorage.getItem("baseball-manager-theme"), "field");
  });

  it("reads theme from localStorage on mount", () => {
    localStorage.setItem("baseball-manager-theme", "field");
    document.documentElement.dataset.theme = "classic";

    render(<ThemeToggle />);
    assert.equal(document.documentElement.dataset.theme, "field");
  });
});
