-- Add public_home_config to workspace meta for homepage content configuration.
-- Kept in app_workspace_meta for now because there is only one logical workspace.
-- If preferences continue to grow, migrate to a dedicated app_workspace_preferences table later.

alter table public.app_workspace_meta
  add column if not exists public_home_config jsonb not null default '{}'::jsonb;
