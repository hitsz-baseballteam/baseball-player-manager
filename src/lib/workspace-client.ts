import type { Workspace } from "@/lib/workspace";

export type WorkspaceSnapshot = {
  workspace: Workspace;
  version: number;
  updatedAt: string;
};

export class VersionConflictError extends Error {
  constructor() {
    super("version_conflict");
  }
}

export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const response = await fetch("/api/workspace", {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Failed to load workspace: ${response.status}`);
  }

  return response.json();
}

export async function saveWorkspaceSnapshot(
  workspace: Workspace,
  version: number,
): Promise<WorkspaceSnapshot> {
  const response = await fetch("/api/workspace", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({ workspace, version }),
  });

  if (response.status === 409) {
    throw new VersionConflictError();
  }
  if (!response.ok) {
    throw new Error(`Failed to save workspace: ${response.status}`);
  }

  return response.json();
}

/**
 * Save with automatic retry on version conflict.
 * First tries the already-mutated local workspace, then reloads the latest
 * server snapshot, re-applies the mutation, and retries up to `maxRetries`
 * times (default 3).
 */
export async function saveWithRetry(
  initialWorkspace: Workspace,
  currentVersion: number,
  applyMutation: (latest: Workspace) => Workspace,
  maxRetries = 3,
): Promise<WorkspaceSnapshot> {
  let version = currentVersion;
  let workspace = initialWorkspace;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const latest = await loadWorkspaceSnapshot();
      workspace = applyMutation(latest.workspace);
      version = latest.version;
    }

    try {
      return await saveWorkspaceSnapshot(workspace, version);
    } catch (error) {
      if (!isVersionConflict(error) || attempt >= maxRetries) {
        throw error;
      }
    }
  }

  throw new VersionConflictError();
}

export function isVersionConflict(error: unknown) {
  return error instanceof VersionConflictError;
}
