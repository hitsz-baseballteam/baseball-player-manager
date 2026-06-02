import {
  createDefaultWorkspace,
  DEFAULT_WORKSPACE_SLUG,
  sanitizeWorkspace,
  type Workspace,
} from "@/lib/workspace";
import { withClient } from "@/lib/db";

type WorkspaceRow = {
  id: string;
  slug: string;
  version: number;
  data: Workspace;
  created_at: string;
  updated_at: string;
};

export type WorkspaceSnapshot = {
  workspace: Workspace;
  version: number;
  updatedAt: string;
};

export async function getOrCreateWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  return withClient(async (client) => {
    const selectResult = await client.query<WorkspaceRow>(
      `SELECT id, slug, version, data, created_at, updated_at
       FROM app_workspace
       WHERE slug = $1
       LIMIT 1`,
      [DEFAULT_WORKSPACE_SLUG],
    );

    if (selectResult.rows.length > 0) {
      const row = selectResult.rows[0];
      return {
        workspace: sanitizeWorkspace(row.data),
        version: row.version,
        updatedAt: row.updated_at,
      };
    }

    const defaultWorkspace = createDefaultWorkspace(false);
    const now = new Date().toISOString();
    const insertResult = await client.query<Pick<WorkspaceRow, "version" | "data" | "updated_at">>(
      `INSERT INTO app_workspace (slug, version, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO NOTHING
       RETURNING version, data, updated_at`,
      [DEFAULT_WORKSPACE_SLUG, 1, JSON.stringify(defaultWorkspace), now, now],
    );

    if (insertResult.rows.length > 0) {
      const row = insertResult.rows[0];
      return {
        workspace: sanitizeWorkspace(row.data as Workspace),
        version: row.version,
        updatedAt: row.updated_at,
      };
    }

    // Race condition: another request created it between our SELECT and INSERT
    const retryResult = await client.query<WorkspaceRow>(
      `SELECT id, slug, version, data, created_at, updated_at
       FROM app_workspace
       WHERE slug = $1
       LIMIT 1`,
      [DEFAULT_WORKSPACE_SLUG],
    );

    const row = retryResult.rows[0];
    return {
      workspace: sanitizeWorkspace(row.data),
      version: row.version,
      updatedAt: row.updated_at,
    };
  });
}

export async function updateWorkspaceSnapshot(params: {
  workspace: Workspace;
  version: number;
}): Promise<WorkspaceSnapshot | null> {
  const nextWorkspace = sanitizeWorkspace(params.workspace);
  const nextVersion = params.version + 1;
  const updatedAt = new Date().toISOString();

  return withClient(async (client) => {
    const result = await client.query<Pick<WorkspaceRow, "version" | "data" | "updated_at">>(
      `UPDATE app_workspace
       SET data = $1, version = $2, updated_at = $3
       WHERE slug = $4 AND version = $5
       RETURNING version, data, updated_at`,
      [JSON.stringify(nextWorkspace), nextVersion, updatedAt, DEFAULT_WORKSPACE_SLUG, params.version],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      workspace: sanitizeWorkspace(result.rows[0].data as Workspace),
      version: result.rows[0].version,
      updatedAt: result.rows[0].updated_at,
    };
  });
}
