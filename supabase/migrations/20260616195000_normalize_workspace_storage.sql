create table if not exists public.app_workspace_meta (
  id uuid primary key,
  slug text not null unique,
  version integer not null check (version > 0),
  active_scenario_id text,
  help_dismissed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_player (
  workspace_id uuid not null references public.app_workspace_meta(id) on delete cascade,
  id text not null,
  sort_order integer not null,
  name text not null,
  number text not null,
  throws text not null,
  bats text not null,
  status text not null,
  joined_on date,
  profile_type text not null,
  age integer,
  height_cm integer,
  weight_kg integer,
  fastball_top_kmh numeric,
  fastball_avg_kmh numeric,
  arm_strength_m numeric,
  thirty_meter_sec numeric,
  scouting_summary text not null default '',
  pitcher_radar jsonb not null default '{}'::jsonb,
  fielder_radar jsonb not null default '{}'::jsonb,
  pitch_types text[] not null default '{}',
  primary key (workspace_id, id),
  unique (workspace_id, number)
);

create table if not exists public.app_player_position (
  workspace_id uuid not null,
  player_id text not null,
  position_code text not null,
  primary key (workspace_id, player_id, position_code),
  foreign key (workspace_id, player_id)
    references public.app_player(workspace_id, id)
    on delete cascade
);

create table if not exists public.app_scenario (
  workspace_id uuid not null references public.app_workspace_meta(id) on delete cascade,
  id text not null,
  sort_order integer not null,
  name text not null,
  note text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (workspace_id, id),
  unique (workspace_id, name)
);

create table if not exists public.app_scenario_defense_assignment (
  workspace_id uuid not null,
  scenario_id text not null,
  position_code text not null,
  player_id text,
  primary key (workspace_id, scenario_id, position_code),
  foreign key (workspace_id, scenario_id)
    references public.app_scenario(workspace_id, id)
    on delete cascade
);

create table if not exists public.app_scenario_lineup_slot (
  workspace_id uuid not null,
  scenario_id text not null,
  slot_index smallint not null,
  player_id text,
  primary key (workspace_id, scenario_id, slot_index),
  foreign key (workspace_id, scenario_id)
    references public.app_scenario(workspace_id, id)
    on delete cascade
);

create table if not exists public.app_game (
  workspace_id uuid not null references public.app_workspace_meta(id) on delete cascade,
  id text not null,
  sort_order integer not null,
  game_date date not null,
  opponent text not null,
  game_type text not null,
  total_innings integer not null,
  note text,
  primary key (workspace_id, id)
);

create index if not exists app_game_workspace_date_idx
  on public.app_game (workspace_id, game_date desc);

create table if not exists public.app_game_inning (
  workspace_id uuid not null,
  game_id text not null,
  inning_number integer not null,
  hits integer not null,
  runs integer not null,
  batters text[] not null default '{}',
  primary key (workspace_id, game_id, inning_number),
  foreign key (workspace_id, game_id)
    references public.app_game(workspace_id, id)
    on delete cascade
);

create table if not exists public.app_game_stat_line (
  workspace_id uuid not null,
  game_id text not null,
  player_id text not null,
  sort_order integer not null,
  pa integer not null,
  ab integer not null,
  h integer not null,
  doubles integer not null,
  triples integer not null,
  hr integer not null,
  rbi integer not null,
  r integer not null,
  sb integer not null,
  bb integer not null,
  hbp integer not null,
  sf integer not null,
  so integer not null,
  ip numeric,
  er integer,
  so_pitching integer,
  bb_pitching integer,
  h_pitching integer,
  po integer not null,
  a integer not null,
  e integer not null,
  w integer not null default 0,
  l integer not null default 0,
  sv integer not null default 0,
  np integer not null default 0,
  primary key (workspace_id, game_id, player_id),
  foreign key (workspace_id, game_id)
    references public.app_game(workspace_id, id)
    on delete cascade
);

create table if not exists public.app_milestone (
  workspace_id uuid not null references public.app_workspace_meta(id) on delete cascade,
  id text not null,
  sort_order integer not null,
  milestone_date date not null,
  title text not null,
  description text not null default '',
  media_url text,
  primary key (workspace_id, id)
);

alter table public.app_workspace_meta enable row level security;
alter table public.app_player enable row level security;
alter table public.app_player_position enable row level security;
alter table public.app_scenario enable row level security;
alter table public.app_scenario_defense_assignment enable row level security;
alter table public.app_scenario_lineup_slot enable row level security;
alter table public.app_game enable row level security;
alter table public.app_game_inning enable row level security;
alter table public.app_game_stat_line enable row level security;
alter table public.app_milestone enable row level security;

revoke all on public.app_workspace_meta from anon;
revoke all on public.app_workspace_meta from authenticated;
revoke all on public.app_player from anon;
revoke all on public.app_player from authenticated;
revoke all on public.app_player_position from anon;
revoke all on public.app_player_position from authenticated;
revoke all on public.app_scenario from anon;
revoke all on public.app_scenario from authenticated;
revoke all on public.app_scenario_defense_assignment from anon;
revoke all on public.app_scenario_defense_assignment from authenticated;
revoke all on public.app_scenario_lineup_slot from anon;
revoke all on public.app_scenario_lineup_slot from authenticated;
revoke all on public.app_game from anon;
revoke all on public.app_game from authenticated;
revoke all on public.app_game_inning from anon;
revoke all on public.app_game_inning from authenticated;
revoke all on public.app_game_stat_line from anon;
revoke all on public.app_game_stat_line from authenticated;
revoke all on public.app_milestone from anon;
revoke all on public.app_milestone from authenticated;
