"use client";

import { useCallback, useState } from "react";

import { sanitizeWorkspace, type Workspace } from "@/lib/workspace";
import {
  loadWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from "@/lib/workspace-client";

export function useWorkspaceSnapshot(initialWorkspace: Workspace, initialVersion: number) {
  const [workspace, setWorkspace] = useState(() => sanitizeWorkspace(initialWorkspace));
  const [version, setVersion] = useState(initialVersion);

  const applySnapshot = useCallback((snapshot: WorkspaceSnapshot) => {
    setWorkspace(sanitizeWorkspace(snapshot.workspace));
    setVersion(snapshot.version);
    return snapshot;
  }, []);

  const refreshWorkspace = useCallback(async () => {
    const snapshot = await loadWorkspaceSnapshot();
    return applySnapshot(snapshot);
  }, [applySnapshot]);

  return {
    workspace,
    version,
    setWorkspace,
    applySnapshot,
    refreshWorkspace,
  };
}
