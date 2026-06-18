import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act, cleanup, renderHook } from "@testing-library/react";

import { createDefaultWorkspace } from "./workspace";
import { useWorkspaceSnapshot } from "./use-workspace-snapshot";

describe("useWorkspaceSnapshot", () => {
  afterEach(cleanup);

  it("applies workspace and version from one server snapshot", () => {
    const initial = createDefaultWorkspace(false);
    const next = structuredClone(initial);
    next.preferences.helpDismissed = true;
    const { result } = renderHook(() => useWorkspaceSnapshot(initial, 3));

    act(() => {
      result.current.applySnapshot({
        workspace: next,
        version: 4,
        updatedAt: "2026-06-18T00:00:00.000Z",
      });
    });

    assert.equal(result.current.version, 4);
    assert.equal(result.current.workspace.preferences.helpDismissed, true);
  });
});
