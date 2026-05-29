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
  const { data, error } = await supabase
    .from("app_workspace")
    .select("id, slug, version, data, created_at, updated_at")
    .eq("slug", DEFAULT_WORKSPACE_SLUG)
    .maybeSingle<WorkspaceRow>();

  if (error) {
    throw error;
  }

  if (data) {
    return {
      workspace: sanitizeWorkspace(data.data),
      version: data.version,
      updatedAt: data.updated_at,
    };
  }

  const defaultWorkspace = createDefaultWorkspace(false);
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("app_workspace")
    .insert({
      slug: DEFAULT_WORKSPACE_SLUG,
      version: 1,
      data: defaultWorkspace,
      created_at: now,
      updated_at: now,
    })
    .select("version, data, updated_at")
    .single();

  if (insertError) {
    throw insertError;
  }

  return {
    workspace: sanitizeWorkspace(inserted.data as Workspace),
    version: inserted.version as number,
    updatedAt: inserted.updated_at as string,
  };
}

export async function updateWorkspaceSnapshot(params: {
  workspace: Workspace;
  version: number;
}): Promise<WorkspaceSnapshot | null> {
  const nextWorkspace = sanitizeWorkspace(params.workspace);
  const nextVersion = params.version + 1;
  const updatedAt = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_workspace")
    .update({
      data: nextWorkspace,
      version: nextVersion,
      updated_at: updatedAt,
    })
    .eq("slug", DEFAULT_WORKSPACE_SLUG)
    .eq("version", params.version)
    .select("version, data, updated_at");

  if (error) {
    throw error;
  }

  if (!data.length) {
    return null;
  }

  return {
    workspace: sanitizeWorkspace(data[0].data as Workspace),
    version: data[0].version as number,
    updatedAt: data[0].updated_at as string,
  };
}
