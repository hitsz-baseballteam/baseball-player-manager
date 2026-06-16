insert into public.app_workspace_meta (
  id,
  slug,
  version,
  active_scenario_id,
  help_dismissed,
  created_at,
  updated_at
)
select
  legacy.id,
  legacy.slug,
  legacy.version,
  nullif(legacy.data->>'activeScenarioId', ''),
  coalesce((legacy.data->'preferences'->>'helpDismissed')::boolean, false),
  legacy.created_at,
  legacy.updated_at
from public.app_workspace as legacy
on conflict (id) do update
set slug = excluded.slug,
    version = excluded.version,
    active_scenario_id = excluded.active_scenario_id,
    help_dismissed = excluded.help_dismissed,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at;

delete from public.app_milestone
where workspace_id in (select id from public.app_workspace);

delete from public.app_game
where workspace_id in (select id from public.app_workspace);

delete from public.app_scenario
where workspace_id in (select id from public.app_workspace);

delete from public.app_player
where workspace_id in (select id from public.app_workspace);

with workspace_rows as (
  select id as workspace_id, data
  from public.app_workspace
),
player_rows as (
  select
    workspace_id,
    player,
    ordinality - 1 as sort_order,
    coalesce(player->>'number', '') as raw_number,
    row_number() over (
      partition by workspace_id, coalesce(player->>'number', '')
      order by ordinality
    ) as number_rank
  from workspace_rows
  cross join lateral jsonb_array_elements(coalesce(data->'players', '[]'::jsonb))
    with ordinality as players(player, ordinality)
)
insert into public.app_player (
  workspace_id,
  id,
  sort_order,
  name,
  number,
  throws,
  bats,
  status,
  joined_on,
  profile_type,
  age,
  height_cm,
  weight_kg,
  fastball_top_kmh,
  fastball_avg_kmh,
  arm_strength_m,
  thirty_meter_sec,
  scouting_summary,
  pitcher_radar,
  fielder_radar,
  pitch_types
)
select
  workspace_id,
  player->>'id',
  sort_order::integer,
  coalesce(player->>'name', ''),
  case
    when raw_number = '' then format('unknown-%s', sort_order + 1)
    when number_rank = 1 then raw_number
    else format('%s-%s', raw_number, number_rank)
  end,
  coalesce(player->>'throws', 'R'),
  coalesce(player->>'bats', 'R'),
  coalesce(player->>'status', 'available'),
  nullif(left(coalesce(player->>'joinedAt', ''), 10), '')::date,
  coalesce(player->'profile'->>'profileType', 'fielder'),
  nullif(player->'profile'->>'age', '')::integer,
  nullif(player->'profile'->>'heightCm', '')::integer,
  nullif(player->'profile'->>'weightKg', '')::integer,
  nullif(player->'profile'->>'fastballTopKmh', '')::numeric,
  nullif(player->'profile'->>'fastballAvgKmh', '')::numeric,
  nullif(player->'profile'->>'armStrengthM', '')::numeric,
  nullif(player->'profile'->>'thirtyMeterSec', '')::numeric,
  coalesce(player->'profile'->>'scoutingSummary', ''),
  coalesce(player->'profile'->'radar'->'pitcher', '{}'::jsonb),
  coalesce(player->'profile'->'radar'->'fielder', '{}'::jsonb),
  coalesce(
    array(
      select jsonb_array_elements_text(coalesce(player->'profile'->'pitchTypes', '[]'::jsonb))
    ),
    '{}'::text[]
  )
from player_rows;

with workspace_rows as (
  select id as workspace_id, data
  from public.app_workspace
),
player_rows as (
  select
    workspace_id,
    player
  from workspace_rows
  cross join lateral jsonb_array_elements(coalesce(data->'players', '[]'::jsonb)) as players(player)
)
insert into public.app_player_position (
  workspace_id,
  player_id,
  position_code
)
select
  workspace_id,
  player->>'id',
  position_code
from player_rows
cross join lateral jsonb_array_elements_text(coalesce(player->'positions', '[]'::jsonb))
  as positions(position_code);

with workspace_rows as (
  select id as workspace_id, created_at as workspace_created_at, updated_at as workspace_updated_at, data
  from public.app_workspace
),
scenario_rows as (
  select
    workspace_id,
    workspace_created_at,
    workspace_updated_at,
    scenario,
    ordinality - 1 as sort_order
  from workspace_rows
  cross join lateral jsonb_array_elements(coalesce(data->'scenarios', '[]'::jsonb))
    with ordinality as scenarios(scenario, ordinality)
)
insert into public.app_scenario (
  workspace_id,
  id,
  sort_order,
  name,
  note,
  created_at,
  updated_at
)
select
  workspace_id,
  scenario->>'id',
  sort_order::integer,
  coalesce(scenario->>'name', ''),
  coalesce(scenario->>'note', ''),
  coalesce(nullif(scenario->>'createdAt', '')::timestamptz, workspace_created_at),
  coalesce(nullif(scenario->>'updatedAt', '')::timestamptz, workspace_updated_at)
from scenario_rows;

with workspace_rows as (
  select id as workspace_id, data
  from public.app_workspace
),
scenario_rows as (
  select
    workspace_id,
    scenario
  from workspace_rows
  cross join lateral jsonb_array_elements(coalesce(data->'scenarios', '[]'::jsonb)) as scenarios(scenario)
)
insert into public.app_scenario_defense_assignment (
  workspace_id,
  scenario_id,
  position_code,
  player_id
)
select
  workspace_id,
  scenario->>'id',
  position_code,
  case
    when jsonb_typeof(player_value) = 'null' then null
    else player_value #>> '{}'
  end
from scenario_rows
cross join lateral jsonb_each(coalesce(scenario->'assignments'->'defense', '{}'::jsonb))
  as defense(position_code, player_value);

with workspace_rows as (
  select id as workspace_id, data
  from public.app_workspace
),
scenario_rows as (
  select
    workspace_id,
    scenario
  from workspace_rows
  cross join lateral jsonb_array_elements(coalesce(data->'scenarios', '[]'::jsonb)) as scenarios(scenario)
)
insert into public.app_scenario_lineup_slot (
  workspace_id,
  scenario_id,
  slot_index,
  player_id
)
select
  workspace_id,
  scenario->>'id',
  ordinality - 1,
  case
    when jsonb_typeof(player_value) = 'null' then null
    else player_value #>> '{}'
  end
from scenario_rows
cross join lateral jsonb_array_elements(coalesce(scenario->'assignments'->'lineup', '[]'::jsonb))
  with ordinality as lineup(player_value, ordinality);

with workspace_rows as (
  select id as workspace_id, data
  from public.app_workspace
),
game_rows as (
  select
    workspace_id,
    game,
    ordinality - 1 as sort_order
  from workspace_rows
  cross join lateral jsonb_array_elements(coalesce(data->'games', '[]'::jsonb))
    with ordinality as games(game, ordinality)
)
insert into public.app_game (
  workspace_id,
  id,
  sort_order,
  game_date,
  opponent,
  game_type,
  total_innings,
  note
)
select
  workspace_id,
  game->>'id',
  sort_order::integer,
  nullif(left(coalesce(game->>'date', ''), 10), '')::date,
  coalesce(game->>'opponent', ''),
  coalesce(game->>'gameType', 'official'),
  coalesce(nullif(game->>'totalInnings', '')::integer, 9),
  nullif(game->>'note', '')
from game_rows;

with workspace_rows as (
  select id as workspace_id, data
  from public.app_workspace
),
game_rows as (
  select
    workspace_id,
    game
  from workspace_rows
  cross join lateral jsonb_array_elements(coalesce(data->'games', '[]'::jsonb)) as games(game)
)
insert into public.app_game_inning (
  workspace_id,
  game_id,
  inning_number,
  hits,
  runs,
  batters
)
select
  workspace_id,
  game->>'id',
  coalesce(nullif(inning->>'inning', '')::integer, 0),
  coalesce(nullif(inning->>'hits', '')::integer, 0),
  coalesce(nullif(inning->>'runs', '')::integer, 0),
  coalesce(
    array(
      select jsonb_array_elements_text(coalesce(inning->'batters', '[]'::jsonb))
    ),
    '{}'::text[]
  )
from game_rows
cross join lateral jsonb_array_elements(coalesce(game->'innings', '[]'::jsonb)) as innings(inning);

with workspace_rows as (
  select id as workspace_id, data
  from public.app_workspace
),
game_rows as (
  select
    workspace_id,
    game
  from workspace_rows
  cross join lateral jsonb_array_elements(coalesce(data->'games', '[]'::jsonb)) as games(game)
),
stat_line_rows as (
  select
    workspace_id,
    game,
    stat_line,
    ordinality - 1 as sort_order
  from game_rows
  cross join lateral jsonb_array_elements(coalesce(game->'statLines', '[]'::jsonb))
    with ordinality as stat_lines(stat_line, ordinality)
)
insert into public.app_game_stat_line (
  workspace_id,
  game_id,
  player_id,
  sort_order,
  pa,
  ab,
  h,
  doubles,
  triples,
  hr,
  rbi,
  r,
  sb,
  bb,
  hbp,
  sf,
  so,
  ip,
  er,
  so_pitching,
  bb_pitching,
  h_pitching,
  po,
  a,
  e,
  w,
  l,
  sv,
  np
)
select
  workspace_id,
  game->>'id',
  stat_line->>'playerId',
  sort_order::integer,
  coalesce(nullif(stat_line->>'pa', '')::integer, 0),
  coalesce(nullif(stat_line->>'ab', '')::integer, 0),
  coalesce(nullif(stat_line->>'h', '')::integer, 0),
  coalesce(nullif(stat_line->>'doubles', '')::integer, 0),
  coalesce(nullif(stat_line->>'triples', '')::integer, 0),
  coalesce(nullif(stat_line->>'hr', '')::integer, 0),
  coalesce(nullif(stat_line->>'rbi', '')::integer, 0),
  coalesce(nullif(stat_line->>'r', '')::integer, 0),
  coalesce(nullif(stat_line->>'sb', '')::integer, 0),
  coalesce(nullif(stat_line->>'bb', '')::integer, 0),
  coalesce(nullif(stat_line->>'hbp', '')::integer, 0),
  coalesce(nullif(stat_line->>'sf', '')::integer, 0),
  coalesce(nullif(stat_line->>'so', '')::integer, 0),
  nullif(stat_line->>'ip', '')::numeric,
  nullif(stat_line->>'er', '')::integer,
  nullif(stat_line->>'soPitching', '')::integer,
  nullif(stat_line->>'bbPitching', '')::integer,
  nullif(stat_line->>'hPitching', '')::integer,
  coalesce(nullif(stat_line->>'po', '')::integer, 0),
  coalesce(nullif(stat_line->>'a', '')::integer, 0),
  coalesce(nullif(stat_line->>'e', '')::integer, 0),
  coalesce(nullif(stat_line->>'w', '')::integer, 0),
  coalesce(nullif(stat_line->>'l', '')::integer, 0),
  coalesce(nullif(stat_line->>'sv', '')::integer, 0),
  coalesce(nullif(stat_line->>'np', '')::integer, 0)
from stat_line_rows;

with workspace_rows as (
  select id as workspace_id, data
  from public.app_workspace
),
milestone_rows as (
  select
    workspace_id,
    milestone,
    ordinality - 1 as sort_order
  from workspace_rows
  cross join lateral jsonb_array_elements(coalesce(data->'milestones', '[]'::jsonb))
    with ordinality as milestones(milestone, ordinality)
)
insert into public.app_milestone (
  workspace_id,
  id,
  sort_order,
  milestone_date,
  title,
  description,
  media_url
)
select
  workspace_id,
  milestone->>'id',
  sort_order::integer,
  nullif(left(coalesce(milestone->>'date', ''), 10), '')::date,
  coalesce(milestone->>'title', ''),
  coalesce(milestone->>'description', ''),
  nullif(milestone->>'mediaUrl', '')
from milestone_rows;
