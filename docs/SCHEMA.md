# Schema

This document describes the current PostgreSQL schema used by the app after the normalized storage cutover.

## Overview

- Database: PostgreSQL managed through Supabase
- Logical workspace count: currently one shared workspace, slug `default`
- Write model: resource-specific API routes mutate normalized tables inside one transaction
- Concurrency token: `public.app_workspace_meta.version`
- Legacy rollback source: `public.app_workspace` is still retained temporarily and is not part of the active write path

## Runtime Aggregate

`GET /api/workspace` still returns one aggregate `WorkspaceSnapshot`:

```ts
type WorkspaceSnapshot = {
  workspace: Workspace;
  version: number;
  updatedAt: string;
};
```

That aggregate is assembled from the normalized `app_*` tables below.

Aggregate and slice reads run on one PostgreSQL client in a `REPEATABLE READ READ ONLY` transaction so related rows come from one database snapshot.

## Date And Time Conventions

- `joined_on`, `game_date`, `milestone_date` use SQL `date`
- `created_at` and `updated_at` use `timestamptz`
- Scenario timestamps are preserved per scenario
- `WorkspaceSnapshot.updatedAt` comes from `app_workspace_meta.updated_at`

The app intentionally treats joined dates, game dates, and milestone dates as date-only values rather than timezone-sensitive wall-clock timestamps.

## Tables

### `public.app_workspace_meta`

One row per logical workspace.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `slug` | `text` | Unique workspace slug; production currently uses `default` |
| `version` | `integer` | Global optimistic-concurrency token; `check (version > 0)` |
| `active_scenario_id` | `text` | Current active scenario id |
| `help_dismissed` | `boolean` | Workspace-level UI preference |
| `created_at` | `timestamptz` | Default `timezone('utc', now())` |
| `updated_at` | `timestamptz` | Default `timezone('utc', now())`; bumped on each successful write |

Key role:

- Lock target for all mutations
- Stores the single version checked by every write API

### `public.app_player`

One row per player in a workspace.

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | `uuid` | FK to `app_workspace_meta(id)` with `on delete cascade` |
| `id` | `text` | Stable player id inside workspace |
| `sort_order` | `integer` | Preserves array order from the aggregate model |
| `name` | `text` | Player display name |
| `number` | `text` | Jersey number; unique within workspace |
| `throws` | `text` | `R`, `L`, or `S` |
| `bats` | `text` | `R`, `L`, or `S` |
| `status` | `text` | `available`, `rest`, `injured`, `graduated` |
| `joined_on` | `date` | Optional join date |
| `profile_type` | `text` | `pitcher` or `fielder` |
| `age` | `integer` | Nullable |
| `height_cm` | `integer` | Nullable |
| `weight_kg` | `integer` | Nullable |
| `fastball_top_kmh` | `numeric` | Nullable |
| `fastball_avg_kmh` | `numeric` | Nullable |
| `arm_strength_m` | `numeric` | Nullable |
| `thirty_meter_sec` | `numeric` | Nullable |
| `scouting_summary` | `text` | Default `''` |
| `pitcher_radar` | `jsonb` | Default `'{}'::jsonb` |
| `fielder_radar` | `jsonb` | Default `'{}'::jsonb` |
| `pitch_types` | `text[]` | Default empty array |

Constraints:

- Primary key: `(workspace_id, id)`
- Unique: `(workspace_id, number)`

### `public.app_player_position`

Join table replacing `player.positions: PositionCode[]`.

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | `uuid` | Part of PK and FK |
| `player_id` | `text` | FK target player id |
| `position_code` | `text` | One of `P`, `C`, `1B`, `2B`, `3B`, `SS`, `LF`, `CF`, `RF` |

Constraints:

- Primary key: `(workspace_id, player_id, position_code)`
- FK: `(workspace_id, player_id)` → `app_player(workspace_id, id)` with `on delete cascade`

### `public.app_scenario`

One row per defensive/batting-order scenario.

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | `uuid` | FK to `app_workspace_meta(id)` |
| `id` | `text` | Stable scenario id |
| `sort_order` | `integer` | Preserves aggregate order |
| `name` | `text` | Scenario name; unique within workspace |
| `note` | `text` | Default `''` |
| `created_at` | `timestamptz` | Scenario creation timestamp |
| `updated_at` | `timestamptz` | Scenario update timestamp |

Constraints:

- Primary key: `(workspace_id, id)`
- Unique: `(workspace_id, name)`

### `public.app_scenario_defense_assignment`

One row per scenario defensive position.

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | `uuid` | Part of PK and FK |
| `scenario_id` | `text` | FK target scenario id |
| `position_code` | `text` | Field position code |
| `player_id` | `text` | Nullable assigned player id |

Constraints:

- Primary key: `(workspace_id, scenario_id, position_code)`
- FK: `(workspace_id, scenario_id)` → `app_scenario(workspace_id, id)` with `on delete cascade`

Design note:

- There is intentionally no hard FK from `player_id` to `app_player`, because assignments are sanitized in application code and player deletion already clears scenario assignments during mutation.

### `public.app_scenario_lineup_slot`

One row per lineup slot.

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | `uuid` | Part of PK and FK |
| `scenario_id` | `text` | FK target scenario id |
| `slot_index` | `smallint` | Zero-based lineup slot |
| `player_id` | `text` | Nullable assigned player id |

Constraints:

- Primary key: `(workspace_id, scenario_id, slot_index)`
- FK: `(workspace_id, scenario_id)` → `app_scenario(workspace_id, id)` with `on delete cascade`

Design note:

- `slot_index` remains `0..8` to match the current client array shape.

### `public.app_game`

One row per game.

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | `uuid` | FK to `app_workspace_meta(id)` |
| `id` | `text` | Stable game id |
| `sort_order` | `integer` | Preserves aggregate order |
| `game_date` | `date` | Date-only game date |
| `opponent` | `text` | Opponent label |
| `game_type` | `text` | `official` or `training` |
| `total_innings` | `integer` | Planned/actual game length |
| `note` | `text` | Nullable note |

Constraints and indexes:

- Primary key: `(workspace_id, id)`
- Index: `app_game_workspace_date_idx (workspace_id, game_date desc)`

### `public.app_game_inning`

One row per inning record inside a game.

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | `uuid` | Part of PK and FK |
| `game_id` | `text` | FK target game id |
| `inning_number` | `integer` | Inning ordinal |
| `hits` | `integer` | Hits recorded in the inning |
| `runs` | `integer` | Runs recorded in the inning |
| `batters` | `text[]` | Ordered batter-id list for the inning |

Constraints:

- Primary key: `(workspace_id, game_id, inning_number)`
- FK: `(workspace_id, game_id)` → `app_game(workspace_id, id)` with `on delete cascade`

### `public.app_game_stat_line`

One row per game/player stat line.

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | `uuid` | Part of PK and FK |
| `game_id` | `text` | FK target game id |
| `player_id` | `text` | Historical player id |
| `sort_order` | `integer` | Preserves aggregate order |
| `pa` | `integer` | Plate appearances |
| `ab` | `integer` | At-bats |
| `h` | `integer` | Hits |
| `doubles` | `integer` | Doubles |
| `triples` | `integer` | Triples |
| `hr` | `integer` | Home runs |
| `rbi` | `integer` | Runs batted in |
| `r` | `integer` | Runs scored |
| `sb` | `integer` | Stolen bases |
| `bb` | `integer` | Walks |
| `hbp` | `integer` | Hit by pitch |
| `sf` | `integer` | Sacrifice flies |
| `so` | `integer` | Strikeouts while batting |
| `ip` | `numeric` | Innings pitched in baseball notation |
| `er` | `integer` | Earned runs |
| `so_pitching` | `integer` | Strikeouts while pitching |
| `bb_pitching` | `integer` | Walks allowed |
| `h_pitching` | `integer` | Hits allowed |
| `po` | `integer` | Putouts |
| `a` | `integer` | Assists |
| `e` | `integer` | Errors |
| `w` | `integer` | Wins |
| `l` | `integer` | Losses |
| `sv` | `integer` | Saves |
| `np` | `integer` | Pitch count |

Constraints:

- Primary key: `(workspace_id, game_id, player_id)`
- FK: `(workspace_id, game_id)` → `app_game(workspace_id, id)` with `on delete cascade`

Design note:

- There is intentionally no FK from `player_id` to `app_player`. Historical stat lines are preserved even if a player is later deleted from the roster.

### `public.app_milestone`

Manual workspace milestones only.

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | `uuid` | FK to `app_workspace_meta(id)` |
| `id` | `text` | Stable milestone id |
| `sort_order` | `integer` | Preserves aggregate order |
| `milestone_date` | `date` | Date-only milestone date |
| `title` | `text` | Milestone title |
| `description` | `text` | Default `''` |
| `media_url` | `text` | Optional media link |

Constraints:

- Primary key: `(workspace_id, id)`

### `public.app_workspace`

Legacy single-row JSONB storage table.

Current status:

- Not used by the normalized write path
- Retained temporarily for rollback and cutover safety
- Backfill source for `20260616223000_backfill_normalized_workspace_storage.sql`

## Security Posture

All normalized tables:

- have row level security enabled
- revoke `anon` access
- revoke `authenticated` access

The application reaches the database through the server-side `pg` connection, not through direct browser-to-Supabase table access.

## Assembly Rules

`src/lib/workspace-store.ts` rebuilds the aggregate model using these conventions:

- `sort_order` restores player, scenario, game, milestone, and stat-line ordering
- `joined_on`, `game_date`, and `milestone_date` are converted back to date-only strings
- scenario defense assignments are reassembled from keyed rows
- scenario lineup slots are reassembled from ordered slot rows
- player positions are reassembled from `app_player_position`

## Write Path

All mutations follow the same high-level flow:

1. Assemble the current normalized record inside a write transaction
2. Lock the `app_workspace_meta` row only when slug and incoming `version` both match
3. Abort with a conflict when the conditional lock fails
4. Sanitize the next aggregate and compute the incremented version in memory
5. Upsert workspace meta, then delete current child rows; cascades remove dependent rows
6. Reinsert each non-empty table as one set-based `jsonb_to_recordset()` statement in foreign-key order
7. Commit, then invalidate all server-side workspace read slices
8. Return the committed `WorkspaceSnapshot`

This remains a whole-workspace wipe-and-rewrite model. Resource-specific HTTP routes narrow the client contract, but they do not perform row-level partial persistence internally.

See [API.md](./API.md) for the route-level contract and [ARCHITECTURE.md](./ARCHITECTURE.md) for the broader runtime context.
