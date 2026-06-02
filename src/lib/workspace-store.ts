import {
  createDefaultWorkspace,
  DEFAULT_WORKSPACE_SLUG,
  sanitizeWorkspace,
  type Workspace,
} from "@/lib/workspace";
import { getPool } from "@/lib/db";

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
  const pool = getPool();
  const { rows } = await pool.query<WorkspaceRow>(
    `select id, slug, version, data, created_at, updated_at
     from app_workspace
     where slug = $1
     limit 1`,
    [DEFAULT_WORKSPACE_SLUG],
  );

  if (rows && rows.length > 0) {
    const row = rows[0];
    return {
      workspace: sanitizeWorkspace(row.data),
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  const defaultWorkspace = createDefaultWorkspace(false);
  const now = new Date().toISOString();

  const inserted = await pool.query<
    Pick<WorkspaceRow, "version" | "data" | "updated_at">
  >(
    `insert into app_workspace (slug, version, data, created_at, updated_at)
     values ($1, $2, $3::jsonb, $4, $4)
     on conflict (slug) do nothing
     returning version, data, updated_at`,
    [DEFAULT_WORKSPACE_SLUG, 1, JSON.stringify(defaultWorkspace), now],
  );

  if (inserted.rows.length > 0) {
    const row = inserted.rows[0];
    return {
      workspace: sanitizeWorkspace(row.data as Workspace),
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  // Race condition: another instance created it between SELECT and INSERT
  const retry = await pool.query<WorkspaceRow>(
    `select id, slug, version, data, created_at, updated_at
     from app_workspace
     where slug = $1
     limit 1`,
    [DEFAULT_WORKSPACE_SLUG],
  );

  const row = retry.rows[0];
  return {
    workspace: sanitizeWorkspace(row.data),
    version: row.version,
    updatedAt: row.updated_at,
  };
}

export async function updateWorkspaceSnapshot(params: {
  workspace: Workspace;
  version: number;
}): Promise<WorkspaceSnapshot | null> {
  const pool = getPool();
  const nextWorkspace = sanitizeWorkspace(params.workspace);
  const nextVersion = params.version + 1;
  const updatedAt = new Date().toISOString();

  const { rows } = await pool.query<
    Pick<WorkspaceRow, "version" | "data" | "updated_at">
  >(
    `update app_workspace
     set data = $1::jsonb,
         version = $2,
         updated_at = $3
     where slug = $4
       and version = $5
     returning version, data, updated_at`,
    [
      JSON.stringify(nextWorkspace),
      nextVersion,
      updatedAt,
      DEFAULT_WORKSPACE_SLUG,
      params.version,
    ],
  );

  if (rows.length === 0) {
    return null;
  }

  return {
    workspace: sanitizeWorkspace(rows[0].data as Workspace),
    version: rows[0].version,
    updatedAt: rows[0].updated_at,
  };
}
