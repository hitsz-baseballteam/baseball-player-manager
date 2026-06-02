import {
  createDefaultWorkspace,
  DEFAULT_WORKSPACE_SLUG,
  sanitizeWorkspace,
  type Workspace,
} from "@/lib/workspace";
import { getSupabaseAdmin } from "@/lib/supabase";

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
  const supabase = getSupabaseAdmin();

  const { data: rows, error: selectError } = await supabase
    .from("app_workspace")
    .select("id, slug, version, data, created_at, updated_at")
    .eq("slug", DEFAULT_WORKSPACE_SLUG)
    .limit(1)
    .returns<WorkspaceRow[]>();

  if (selectError) throw selectError;

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

  const { data: inserted, error: insertError } = await supabase
    .from("app_workspace")
    .upsert(
      {
        slug: DEFAULT_WORKSPACE_SLUG,
        version: 1,
        data: defaultWorkspace as unknown as Record<string, unknown>,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "slug", ignoreDuplicates: true },
    )
    .select("version, data, updated_at")
    .returns<Pick<WorkspaceRow, "version" | "data" | "updated_at">[]>();

  if (insertError) throw insertError;

  if (inserted && inserted.length > 0) {
    const row = inserted[0];
    return {
      workspace: sanitizeWorkspace(row.data as Workspace),
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  // Race condition: another instance created it between SELECT and INSERT
  const { data: retry, error: retryError } = await supabase
    .from("app_workspace")
    .select("id, slug, version, data, created_at, updated_at")
    .eq("slug", DEFAULT_WORKSPACE_SLUG)
    .limit(1)
    .returns<WorkspaceRow[]>();

  if (retryError) throw retryError;

  const row = retry![0];
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
  const supabase = getSupabaseAdmin();
  const nextWorkspace = sanitizeWorkspace(params.workspace);
  const nextVersion = params.version + 1;
  const updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("app_workspace")
    .update({
      data: nextWorkspace as unknown as Record<string, unknown>,
      version: nextVersion,
      updated_at: updatedAt,
    })
    .eq("slug", DEFAULT_WORKSPACE_SLUG)
    .eq("version", params.version)
    .select("version, data, updated_at")
    .returns<Pick<WorkspaceRow, "version" | "data" | "updated_at">[]>();

  if (error) throw error;

  if (!data || data.length === 0) {
    return null;
  }

  return {
    workspace: sanitizeWorkspace(data[0].data as Workspace),
    version: data[0].version,
    updatedAt: data[0].updated_at,
  };
}
