import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act, fireEvent } from "@testing-library/react";

import { getLegacyTemplate } from "@/lib/legacy-template";
import { mountPlayerManager } from "@/lib/player-manager-dom";
import { createDefaultWorkspace } from "@/lib/workspace";

describe("player manager DOM mount", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("mounts the legacy manager without throwing", () => {
    const root = document.createElement("div");
    const template = getLegacyTemplate();
    root.innerHTML = template.markup;
    document.body.appendChild(root);

    const cleanup = mountPlayerManager(
      root,
      {
        workspace: createDefaultWorkspace(false),
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        toast: { current: null },
        helpDrawer: { current: null },
        guide: { current: null },
      },
    );

    assert.equal(typeof cleanup, "function");
    assert.notEqual(document.querySelector("#saveStatus")?.textContent, "");

    cleanup();
  });

  it("opens the profile drawer when the profile button is clicked", async () => {
    const root = document.createElement("div");
    const template = getLegacyTemplate();
    root.innerHTML = template.markup;
    document.body.appendChild(root);

    const cleanup = mountPlayerManager(
      root,
      {
        workspace: createDefaultWorkspace(false),
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        toast: { current: null },
        helpDrawer: { current: null },
        guide: { current: null },
      },
    );

    const profileButton = root.querySelector("[data-profile-id]");
    assert.ok(profileButton);
    assert.equal(document.getElementById("player-profile-dialog-title"), null);

    const openCalls: Array<[string | URL | undefined, string | undefined, string | undefined]> = [];
    const originalOpen = window.open;
    window.open = ((...args: [string | URL | undefined, string | undefined, string | undefined]) => {
      openCalls.push(args);
      return null;
    }) as typeof window.open;

    try {
      await act(async () => {
        fireEvent.click(profileButton);
        await Promise.resolve();
      });

      assert.ok(document.getElementById("player-profile-dialog-title"));
      assert.match(document.body.textContent ?? "", /打开完整页面/);

      const openPageButton = Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("打开完整页面"),
      );
      assert.ok(openPageButton);

      await act(async () => {
        fireEvent.click(openPageButton);
        await Promise.resolve();
      });

      assert.equal(openCalls.length, 1);
      assert.match(String(openCalls[0][0]), /^\/players\//);
    } finally {
      window.open = originalOpen;
      cleanup();
    }
  });
});
