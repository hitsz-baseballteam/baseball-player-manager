import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SettingsPageClient } from "@/components/settings-page-client";
import { createDefaultWorkspace } from "@/lib/workspace";

describe("SettingsPageClient", () => {
  const workspace = createDefaultWorkspace(true);
  const originalConfirm = window.confirm;
  const originalFetch = globalThis.fetch;
  const originalHref = window.location.href;

  let confirmCalls = 0;
  let fetchCalls: Array<{ input: string; init?: RequestInit }> = [];

  beforeEach(() => {
    cleanup();
    document.body.innerHTML = "";
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");

    confirmCalls = 0;
    fetchCalls = [];

    window.confirm = (() => {
      confirmCalls += 1;
      return false;
    }) as typeof window.confirm;

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ input: String(input), init });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    window.confirm = originalConfirm;
    globalThis.fetch = originalFetch;
    window.history.replaceState({}, "", originalHref);
  });

  it("renders 4 sections and core action buttons", () => {
    render(
      <SettingsPageClient
        initialWorkspace={workspace}
        initialVersion={7}
      />,
    );

    assert.ok(screen.getByLabelText("外观主题区"));
    assert.ok(screen.getByLabelText("工作区状态区"));
    assert.ok(screen.getByLabelText("访问控制区"));
    assert.ok(screen.getByLabelText("帮助与引导区"));
    assert.ok(screen.getAllByRole("button", { name: /切换主题，当前：/ }).length >= 1);
    assert.ok(screen.getByRole("button", { name: "重置示例数据" }));
    assert.ok(screen.getByRole("button", { name: "退出登录" }));
    assert.ok(screen.getByRole("button", { name: "重新播放引导" }));
    assert.ok(screen.getByRole("button", { name: "打开帮助" }));
  });

  it("clicking 重置示例数据 calls window.confirm", async () => {
    render(
      <SettingsPageClient
        initialWorkspace={workspace}
        initialVersion={7}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重置示例数据" }));
    });

    assert.equal(confirmCalls, 1);
    assert.equal(fetchCalls.length, 0);
  });

  it("clicking 退出登录 sends POST /api/logout", async () => {
    render(
      <SettingsPageClient
        initialWorkspace={workspace}
        initialVersion={7}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0]?.input, "/api/logout");
    assert.equal(fetchCalls[0]?.init?.method, "POST");
  });

  it("clicking 重新播放引导 opens GuideOverlay", async () => {
    render(
      <SettingsPageClient
        initialWorkspace={workspace}
        initialVersion={7}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重新播放引导" }));
    });

    assert.ok(await screen.findByText(/步骤 1 \/ /));
  });

  it("clicking 打开帮助 opens HelpDrawer", async () => {
    render(
      <SettingsPageClient
        initialWorkspace={workspace}
        initialVersion={7}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "打开帮助" }));
    });

    assert.ok(await screen.findByRole("dialog", { name: "使用指引 / 帮助" }));
  });
});
