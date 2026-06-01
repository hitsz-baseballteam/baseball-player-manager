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

export function isVersionConflict(error: unknown) {
  return error instanceof VersionConflictError;
}
