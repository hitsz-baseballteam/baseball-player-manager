import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

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
});
