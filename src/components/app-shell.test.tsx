import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { cleanup, render, screen } from "@testing-library/react";

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders masthead, nav, summary cards, and frame content", () => {
    render(
      <AppShell
        eyebrow="Game Day Overview"
        title="比赛日总控台"
        description="统一首页外壳。"
        statusLabel="共享工作区"
        statusValue="Workspace v3"
        statusMeta="状态已连接。"
        navItems={[
          { label: "总览", href: "/", active: true },
          { label: "名册", disabled: true, status: "规划中" },
        ]}
        summaryItems={[
          { label: "球员总数", value: "18", detail: "12 名可上场。", tone: "accent" },
        ]}
        frameEyebrow="Legacy Workspace"
        frameTitle="阵容操作台"
        frameDescription="旧管理器容器。"
      >
        <div>legacy content</div>
      </AppShell>,
    );

    assert.ok(screen.getByText("比赛日总控台"));
    assert.ok(screen.getByRole("link", { name: "总览" }));
    assert.ok(screen.getByText("名册"));
    assert.ok(screen.getByText("规划中"));
    assert.ok(screen.getByText("球员总数"));
    assert.ok(screen.getByText("18"));
    assert.ok(screen.getByText("阵容操作台"));
    assert.ok(screen.getByText("legacy content"));
  });
});
