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

  it("renders 3 sections and core action buttons", () => {
    render(
      <SettingsPageClient
        initialWorkspace={workspace}
        initialVersion={7}
      />,
    );

    assert.ok(screen.getByLabelText("工作区状态区"));
    assert.ok(screen.getByLabelText("访问控制区"));
    assert.ok(screen.getByLabelText("数据导入导出区"));
    // removed sections
    assert.equal(screen.queryByLabelText("外观主题区"), null);
    assert.equal(screen.queryByLabelText("帮助与引导区"), null);
    // no theme/help/intro buttons any more
    assert.equal(screen.queryByRole("button", { name: /切换主题，当前：/ }), null);
    assert.equal(screen.queryByRole("button", { name: "重新播放引导" }), null);
    assert.equal(screen.queryByRole("button", { name: "打开帮助" }), null);
    // core actions still there
    assert.ok(screen.getByRole("button", { name: "重置示例数据" }));
    assert.ok(screen.getByRole("button", { name: "退出登录" }));
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

  it("saves homepage member edits through workspace preferences", async () => {
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ input: String(input), init });
      const body = JSON.parse(String(init?.body ?? "{}"));
      return Response.json({
        workspace: {
          ...workspace,
          preferences: {
            ...workspace.preferences,
            publicHomeConfig: body.publicHomeConfig,
          },
        },
        version: 8,
        updatedAt: "2026-06-30T00:00:00.000Z",
      });
    }) as typeof fetch;

    render(
      <SettingsPageClient
        initialWorkspace={workspace}
        initialVersion={7}
      />,
    );

    await act(async () => {
      fireEvent.change(screen.getAllByLabelText("昵称")[0], { target: { value: "CMS" } });
      fireEvent.click(screen.getByRole("button", { name: "保存主页配置" }));
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0]?.input, "/api/workspace/preferences");
    assert.equal(fetchCalls[0]?.init?.method, "PATCH");
    const payload = JSON.parse(String(fetchCalls[0]?.init?.body ?? "{}"));
    assert.equal(payload.version, 7);
    assert.equal(payload.publicHomeConfig.members[0].nickname, "CMS");
  });

  it("clicking 重新播放引导 is no longer a settings-page action", () => {
    render(
      <SettingsPageClient
        initialWorkspace={workspace}
        initialVersion={7}
      />,
    );
    assert.equal(
      screen.queryByRole("button", { name: "重新播放引导" }),
      null,
    );
  });
});
