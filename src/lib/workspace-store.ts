import {
  createDefaultWorkspace,
  DEFAULT_WORKSPACE_SLUG,
  sanitizeWorkspace,
  type Workspace,
} from "@/lib/workspace";
import { migrateV2toV3 } from "@/lib/migrate-v2-to-v3";
import { getPool } from "@/lib/db";

type WorkspaceRow = {
  slug: string;
  version: number;
  data: Workspace;
  updated_at: Date | string;
};

export type WorkspaceSnapshot = {
  workspace: Workspace;
  version: number;
  updatedAt: string;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function hydrate(data: unknown): Workspace {
  const migrated = migrateV2toV3(data);
  return sanitizeWorkspace((migrated ?? data) as Workspace);
}

export async function getOrCreateWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const pool = getPool();

  const selectResult = await pool.query<WorkspaceRow>(
    `
      select slug, version, data, updated_at
      from public.app_workspace
      where slug = $1
      limit 1
    `,
    [DEFAULT_WORKSPACE_SLUG],
  );

  if (selectResult.rows[0]) {
    const row = selectResult.rows[0];
    return {
      workspace: hydrate(row.data),
      version: row.version,
      updatedAt: toIsoString(row.updated_at),
    };
  }

  const defaultWorkspace = createDefaultWorkspace(false);
  const insertResult = await pool.query<WorkspaceRow>(
    `
      insert into public.app_workspace (slug, version, data)
      values ($1, 1, $2::jsonb)
      on conflict (slug) do nothing
      returning slug, version, data, updated_at
    `,
    [DEFAULT_WORKSPACE_SLUG, JSON.stringify(defaultWorkspace)],
  );

  if (insertResult.rows[0]) {
    const row = insertResult.rows[0];
    return {
      workspace: hydrate(row.data),
      version: row.version,
      updatedAt: toIsoString(row.updated_at),
    };
  }

  const retryResult = await pool.query<WorkspaceRow>(
    `
      select slug, version, data, updated_at
      from public.app_workspace
      where slug = $1
      limit 1
    `,
    [DEFAULT_WORKSPACE_SLUG],
  );

  const row = retryResult.rows[0];
  if (!row) {
    throw new Error("Workspace row missing after create retry");
  }

  return {
    workspace: hydrate(row.data),
    version: row.version,
    updatedAt: toIsoString(row.updated_at),
  };
}

export async function updateWorkspaceSnapshot(params: {
  workspace: Workspace;
  version: number;
}): Promise<WorkspaceSnapshot | null> {
  const pool = getPool();
  const nextWorkspace = sanitizeWorkspace(params.workspace);
  const nextVersion = params.version + 1;

  const result = await pool.query<WorkspaceRow>(
    `
      update public.app_workspace
      set data = $1::jsonb,
          version = $2,
          updated_at = timezone('utc', now())
      where slug = $3 and version = $4
      returning slug, version, data, updated_at
    `,
    [JSON.stringify(nextWorkspace), nextVersion, DEFAULT_WORKSPACE_SLUG, params.version],
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];
  return {
    workspace: sanitizeWorkspace(row.data),
    version: row.version,
    updatedAt: toIsoString(row.updated_at),
  };
}
