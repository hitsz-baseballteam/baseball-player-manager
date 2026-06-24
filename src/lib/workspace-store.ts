import { randomUUID } from "node:crypto";
import { revalidateTag, unstable_cache } from "next/cache";

import {
  createDefaultWorkspace,
  DEFAULT_WORKSPACE_SLUG,
  sanitizeWorkspace,
  type FielderRadar,
  type Game,
  type InningRecord,
  type Milestone,
  type PitcherRadar,
  type Player,
  type PlayerGameStatLine,
  type Scenario,
  type Workspace,
  WORKSPACE_SCHEMA_VERSION,
} from "@/lib/workspace";
import { migrateV2toV3 } from "@/lib/migrate-v2-to-v3";
import { getPool } from "@/lib/db";
import type { PoolClient } from "pg";

type Queryable = Pick<PoolClient, "query">;

const WORKSPACE_CACHE_TAG = `workspace:${DEFAULT_WORKSPACE_SLUG}`;

type LegacyWorkspaceRow = {
  id: string;
  slug: string;
  version: number;
  data: Workspace;
  created_at: Date | string;
  updated_at: Date | string;
};

type WorkspaceMetaRow = {
  id: string;
  slug: string;
  version: number;
  active_scenario_id: string | null;
  help_dismissed: boolean;
  public_home_config: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

type PlayerRow = {
  workspace_id: string;
  id: string;
  sort_order: number;
  name: string;
  number: string;
  throws: Player["throws"];
  bats: Player["bats"];
  status: Player["status"];
  joined_on: Date | string | null;
  profile_type: Player["profile"]["profileType"];
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  fastball_top_kmh: number | null;
  fastball_avg_kmh: number | null;
  arm_strength_m: number | null;
  thirty_meter_sec: number | null;
  scouting_summary: string;
  pitcher_radar: PitcherRadar | null;
  fielder_radar: FielderRadar | null;
  pitch_types: string[] | null;
};

type PlayerPositionRow = {
  player_id: string;
  position_code: Player["positions"][number];
};

type ScenarioRow = {
  workspace_id: string;
  id: string;
  sort_order: number;
  name: string;
  note: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type DefenseAssignmentRow = {
  scenario_id: string;
  position_code: Player["positions"][number];
  player_id: string | null;
};

type LineupSlotRow = {
  scenario_id: string;
  slot_index: number;
  player_id: string | null;
};

type GameRow = {
  workspace_id: string;
  id: string;
  sort_order: number;
  game_date: Date | string;
  opponent: string;
  game_type: Game["gameType"];
  total_innings: number;
  note: string | null;
};

type GameInningRow = {
  game_id: string;
  inning_number: number;
  hits: number;
  runs: number;
  batters: string[] | null;
};

type GameStatLineRow = {
  game_id: string;
  player_id: string;
  sort_order: number;
  pa: number;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  r: number;
  sb: number;
  bb: number;
  hbp: number;
  sf: number;
  so: number;
  ip: number | null;
  er: number | null;
  so_pitching: number | null;
  bb_pitching: number | null;
  h_pitching: number | null;
  po: number;
  a: number;
  e: number;
  w: number;
  l: number;
  sv: number;
  np: number;
};

type MilestoneRow = {
  workspace_id: string;
  id: string;
  sort_order: number;
  milestone_date: Date | string;
  title: string;
  description: string;
  media_url: string | null;
};

type NormalizedWorkspaceRecord = {
  workspaceId: string;
  slug: string;
  version: number;
  workspace: Workspace;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceSnapshot = {
  workspace: Workspace;
  version: number;
  updatedAt: string;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDateOnly(value: Date | string) {
  return toIsoString(value).slice(0, 10);
}

function normalizeDateOnly(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function hydrate(data: unknown): Workspace {
  const migrated = migrateV2toV3(data);
  return sanitizeWorkspace((migrated ?? data) as Workspace);
}

function normalizePlayerNumbersForStorage(workspace: Workspace): Workspace {
  const seen = new Map<string, number>();

  return {
    ...workspace,
    players: workspace.players.map((player, index) => {
      const rawNumber = player.number.trim() || `unknown-${index + 1}`;
      const nextCount = (seen.get(rawNumber) ?? 0) + 1;
      seen.set(rawNumber, nextCount);

      return nextCount === 1
        ? { ...player, number: rawNumber }
        : { ...player, number: `${rawNumber}-${nextCount}` };
    }),
  };
}

async function withTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function withReadTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin transaction isolation level repeatable read read only");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function selectLegacyWorkspaceRow(
  client: Queryable,
  slug: string,
): Promise<LegacyWorkspaceRow | null> {
  const result = await client.query<LegacyWorkspaceRow>(
    `
      select id, slug, version, data, created_at, updated_at
      from public.app_workspace
      where slug = $1
      limit 1
    `,
    [slug],
  );

  return result.rows[0] ?? null;
}

async function selectWorkspaceMeta(
  client: Queryable,
  slug: string,
): Promise<WorkspaceMetaRow | null> {
  const result = await client.query<WorkspaceMetaRow>(
    `
      select id, slug, version, active_scenario_id, help_dismissed, public_home_config, created_at, updated_at
      from public.app_workspace_meta
      where slug = $1
      limit 1
    `,
    [slug],
  );

  return result.rows[0] ?? null;
}

function buildWorkspaceFromRows(args: {
  meta: WorkspaceMetaRow;
  players: PlayerRow[];
  positions: PlayerPositionRow[];
  scenarios: ScenarioRow[];
  defenseAssignments: DefenseAssignmentRow[];
  lineupSlots: LineupSlotRow[];
  games: GameRow[];
  innings: GameInningRow[];
  statLines: GameStatLineRow[];
  milestones: MilestoneRow[];
}): Workspace {
  const playerPositions = new Map<string, Player["positions"]>();
  for (const row of args.positions) {
    const list = playerPositions.get(row.player_id) ?? [];
    list.push(row.position_code);
    playerPositions.set(row.player_id, list);
  }

  const players: Player[] = args.players.map((row) => ({
    id: row.id,
    name: row.name,
    number: row.number,
    throws: row.throws,
    bats: row.bats,
    positions: playerPositions.get(row.id) ?? [],
    status: row.status,
    ...(row.joined_on ? { joinedAt: toDateOnly(row.joined_on) } : {}),
    profile: {
      profileType: row.profile_type,
      age: row.age,
      heightCm: row.height_cm,
      weightKg: row.weight_kg,
      fastballTopKmh: row.fastball_top_kmh,
      fastballAvgKmh: row.fastball_avg_kmh,
      armStrengthM: row.arm_strength_m,
      thirtyMeterSec: row.thirty_meter_sec,
      pitchTypes: row.pitch_types ?? [],
      scoutingSummary: row.scouting_summary,
      radar: {
        pitcher: row.pitcher_radar ?? {
          velocity: null,
          command: null,
          movement: null,
          stamina: null,
          fielding: null,
          mental: null,
        },
        fielder: row.fielder_radar ?? {
          contact: null,
          power: null,
          speed: null,
          arm: null,
          defense: null,
          instinct: null,
        },
      },
    },
  }));

  const defenseByScenario = new Map<string, Scenario["assignments"]["defense"]>();
  for (const row of args.defenseAssignments) {
    const current = defenseByScenario.get(row.scenario_id) ?? {
      P: null,
      C: null,
      "1B": null,
      "2B": null,
      "3B": null,
      SS: null,
      LF: null,
      CF: null,
      RF: null,
    };
    current[row.position_code] = row.player_id;
    defenseByScenario.set(row.scenario_id, current);
  }

  const lineupByScenario = new Map<string, Array<string | null>>();
  for (const row of args.lineupSlots) {
    const current = lineupByScenario.get(row.scenario_id) ?? Array<string | null>(9).fill(null);
    current[row.slot_index] = row.player_id;
    lineupByScenario.set(row.scenario_id, current);
  }

  const scenarios: Scenario[] = args.scenarios.map((row) => ({
    id: row.id,
    name: row.name,
    note: row.note,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    assignments: {
      defense:
        defenseByScenario.get(row.id) ?? {
          P: null,
          C: null,
          "1B": null,
          "2B": null,
          "3B": null,
          SS: null,
          LF: null,
          CF: null,
          RF: null,
        },
      lineup: lineupByScenario.get(row.id) ?? Array<string | null>(9).fill(null),
    },
  }));

  const inningsByGame = new Map<string, InningRecord[]>();
  for (const row of args.innings) {
    const current = inningsByGame.get(row.game_id) ?? [];
    current.push({
      inning: row.inning_number,
      hits: row.hits,
      runs: row.runs,
      batters: row.batters ?? [],
    });
    inningsByGame.set(row.game_id, current);
  }

  const statLinesByGame = new Map<string, PlayerGameStatLine[]>();
  for (const row of args.statLines) {
    const current = statLinesByGame.get(row.game_id) ?? [];
    current.push({
      playerId: row.player_id,
      pa: row.pa,
      ab: row.ab,
      h: row.h,
      doubles: row.doubles,
      triples: row.triples,
      hr: row.hr,
      rbi: row.rbi,
      r: row.r,
      sb: row.sb,
      bb: row.bb,
      hbp: row.hbp,
      sf: row.sf,
      so: row.so,
      ip: row.ip,
      er: row.er,
      soPitching: row.so_pitching,
      bbPitching: row.bb_pitching,
      hPitching: row.h_pitching,
      po: row.po,
      a: row.a,
      e: row.e,
      w: row.w,
      l: row.l,
      sv: row.sv,
      np: row.np,
    });
    statLinesByGame.set(row.game_id, current);
  }

  const games: Game[] = args.games.map((row) => ({
    id: row.id,
    date: toDateOnly(row.game_date),
    opponent: row.opponent,
    gameType: row.game_type,
    totalInnings: row.total_innings,
    innings: inningsByGame.get(row.id) ?? [],
    statLines: statLinesByGame.get(row.id) ?? [],
    ...(row.note ? { note: row.note } : {}),
  }));

  const milestones: Milestone[] = args.milestones.map((row) => ({
    id: row.id,
    date: toDateOnly(row.milestone_date),
    title: row.title,
    description: row.description,
    ...(row.media_url ? { mediaUrl: row.media_url } : {}),
  }));

  return sanitizeWorkspace({
    version: WORKSPACE_SCHEMA_VERSION,
    players,
    scenarios,
    activeScenarioId:
      args.meta.active_scenario_id && scenarios.some((scenario) => scenario.id === args.meta.active_scenario_id)
        ? args.meta.active_scenario_id
        : scenarios[0]?.id ?? "",
    games,
    milestones,
    preferences: {
      helpDismissed: args.meta.help_dismissed,
      publicHomeConfig: args.meta.public_home_config,
    },
  });
}

async function selectNormalizedWorkspaceRecord(
  client: Queryable,
  slug: string,
): Promise<NormalizedWorkspaceRecord | null> {
  const meta = await selectWorkspaceMeta(client, slug);
  if (!meta) {
    return null;
  }

  const workspaceId = meta.id;

  // Serialize queries to avoid concurrent client.query() on the same connection,
  // which is deprecated in pg@8 and will be removed in pg@9.
  const playersResult = await client.query<PlayerRow>(
    `
      select *
      from public.app_player
      where workspace_id = $1
      order by sort_order asc
    `,
    [workspaceId],
  );
  const positionsResult = await client.query<PlayerPositionRow>(
    `
      select player_id, position_code
      from public.app_player_position
      where workspace_id = $1
      order by player_id asc, position_code asc
    `,
    [workspaceId],
  );
  const scenariosResult = await client.query<ScenarioRow>(
    `
      select *
      from public.app_scenario
      where workspace_id = $1
      order by sort_order asc
    `,
    [workspaceId],
  );
  const defenseResult = await client.query<DefenseAssignmentRow>(
    `
      select scenario_id, position_code, player_id
      from public.app_scenario_defense_assignment
      where workspace_id = $1
      order by scenario_id asc, position_code asc
    `,
    [workspaceId],
  );
  const lineupResult = await client.query<LineupSlotRow>(
    `
      select scenario_id, slot_index, player_id
      from public.app_scenario_lineup_slot
      where workspace_id = $1
      order by scenario_id asc, slot_index asc
    `,
    [workspaceId],
  );
  const gamesResult = await client.query<GameRow>(
    `
      select *
      from public.app_game
      where workspace_id = $1
      order by sort_order asc
    `,
    [workspaceId],
  );
  const inningsResult = await client.query<GameInningRow>(
    `
      select game_id, inning_number, hits, runs, batters
      from public.app_game_inning
      where workspace_id = $1
      order by game_id asc, inning_number asc
    `,
    [workspaceId],
  );
  const statLinesResult = await client.query<GameStatLineRow>(
    `
      select game_id, player_id, sort_order, pa, ab, h, doubles, triples, hr, rbi, r, sb, bb,
             hbp, sf, so, ip, er, so_pitching, bb_pitching, h_pitching, po, a, e, w, l, sv, np
      from public.app_game_stat_line
      where workspace_id = $1
      order by game_id asc, sort_order asc
    `,
    [workspaceId],
  );
  const milestonesResult = await client.query<MilestoneRow>(
    `
      select *
      from public.app_milestone
      where workspace_id = $1
      order by sort_order asc
    `,
    [workspaceId],
  );

  return {
    workspaceId,
    slug: meta.slug,
    version: meta.version,
    workspace: buildWorkspaceFromRows({
      meta,
      players: playersResult.rows,
      positions: positionsResult.rows,
      scenarios: scenariosResult.rows,
      defenseAssignments: defenseResult.rows,
      lineupSlots: lineupResult.rows,
      games: gamesResult.rows,
      innings: inningsResult.rows,
      statLines: statLinesResult.rows,
      milestones: milestonesResult.rows,
    }),
    createdAt: toIsoString(meta.created_at),
    updatedAt: toIsoString(meta.updated_at),
  };
}

async function wipeNormalizedWorkspace(client: Queryable, workspaceId: string) {
  await client.query("delete from public.app_milestone where workspace_id = $1", [workspaceId]);
  await client.query("delete from public.app_game where workspace_id = $1", [workspaceId]);
  await client.query("delete from public.app_scenario where workspace_id = $1", [workspaceId]);
  await client.query("delete from public.app_player where workspace_id = $1", [workspaceId]);
}

async function insertJsonRows(
  client: Queryable,
  sql: string,
  rows: ReadonlyArray<Record<string, unknown>>,
) {
  if (rows.length === 0) {
    return;
  }

  await client.query(sql, [JSON.stringify(rows)]);
}

async function writeNormalizedWorkspace(params: {
  client: Queryable;
  workspaceId: string;
  slug: string;
  version: number;
  workspace: Workspace;
  createdAt?: string;
  updatedAt?: string;
}) {
  const {
    client,
    workspaceId,
    slug,
    version,
    workspace,
    createdAt,
    updatedAt,
  } = params;
  const safeWorkspace = normalizePlayerNumbersForStorage(sanitizeWorkspace(workspace));
  const createdAtValue = createdAt ?? new Date().toISOString();
  const updatedAtValue = updatedAt ?? new Date().toISOString();

  await client.query(
    `
      insert into public.app_workspace_meta (
        id, slug, version, active_scenario_id, help_dismissed, public_home_config, created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)
      on conflict (id) do update
      set slug = excluded.slug,
          version = excluded.version,
          active_scenario_id = excluded.active_scenario_id,
          help_dismissed = excluded.help_dismissed,
          public_home_config = excluded.public_home_config,
          updated_at = excluded.updated_at
    `,
    [
      workspaceId,
      slug,
      version,
      safeWorkspace.activeScenarioId,
      safeWorkspace.preferences.helpDismissed,
      JSON.stringify(safeWorkspace.preferences.publicHomeConfig ?? {}),
      createdAtValue,
      updatedAtValue,
    ],
  );

  await wipeNormalizedWorkspace(client, workspaceId);

  await insertJsonRows(
    client,
    `
      insert into public.app_player (
        workspace_id, id, sort_order, name, number, throws, bats, status, joined_on,
        profile_type, age, height_cm, weight_kg, fastball_top_kmh, fastball_avg_kmh,
        arm_strength_m, thirty_meter_sec, scouting_summary, pitcher_radar, fielder_radar,
        pitch_types
      )
      select workspace_id, id, sort_order, name, number, throws, bats, status, joined_on,
             profile_type, age, height_cm, weight_kg, fastball_top_kmh, fastball_avg_kmh,
             arm_strength_m, thirty_meter_sec, scouting_summary, pitcher_radar, fielder_radar,
             pitch_types
      from jsonb_to_recordset($1::jsonb) as rows(
        workspace_id uuid, id text, sort_order integer, name text, number text, throws text,
        bats text, status text, joined_on date, profile_type text, age integer, height_cm integer,
        weight_kg integer, fastball_top_kmh numeric, fastball_avg_kmh numeric,
        arm_strength_m numeric, thirty_meter_sec numeric, scouting_summary text,
        pitcher_radar jsonb, fielder_radar jsonb, pitch_types text[]
      )
    `,
    safeWorkspace.players.map((player, sortOrder) => ({
      workspace_id: workspaceId,
      id: player.id,
      sort_order: sortOrder,
      name: player.name,
      number: player.number,
      throws: player.throws,
      bats: player.bats,
      status: player.status,
      joined_on: normalizeDateOnly(player.joinedAt),
      profile_type: player.profile.profileType,
      age: player.profile.age,
      height_cm: player.profile.heightCm,
      weight_kg: player.profile.weightKg,
      fastball_top_kmh: player.profile.fastballTopKmh,
      fastball_avg_kmh: player.profile.fastballAvgKmh,
      arm_strength_m: player.profile.armStrengthM,
      thirty_meter_sec: player.profile.thirtyMeterSec,
      scouting_summary: player.profile.scoutingSummary,
      pitcher_radar: player.profile.radar.pitcher,
      fielder_radar: player.profile.radar.fielder,
      pitch_types: player.profile.pitchTypes,
    })),
  );

  await insertJsonRows(
    client,
    `
      insert into public.app_player_position (workspace_id, player_id, position_code)
      select workspace_id, player_id, position_code
      from jsonb_to_recordset($1::jsonb) as rows(
        workspace_id uuid, player_id text, position_code text
      )
    `,
    safeWorkspace.players.flatMap((player) =>
      player.positions.map((position) => ({
        workspace_id: workspaceId,
        player_id: player.id,
        position_code: position,
      })),
    ),
  );

  await insertJsonRows(
    client,
    `
      insert into public.app_scenario (
        workspace_id, id, sort_order, name, note, created_at, updated_at
      )
      select workspace_id, id, sort_order, name, note, created_at, updated_at
      from jsonb_to_recordset($1::jsonb) as rows(
        workspace_id uuid, id text, sort_order integer, name text, note text,
        created_at timestamptz, updated_at timestamptz
      )
    `,
    safeWorkspace.scenarios.map((scenario, sortOrder) => ({
      workspace_id: workspaceId,
      id: scenario.id,
      sort_order: sortOrder,
      name: scenario.name,
      note: scenario.note,
      created_at: scenario.createdAt,
      updated_at: scenario.updatedAt,
    })),
  );

  await insertJsonRows(
    client,
    `
      insert into public.app_scenario_defense_assignment (
        workspace_id, scenario_id, position_code, player_id
      )
      select workspace_id, scenario_id, position_code, player_id
      from jsonb_to_recordset($1::jsonb) as rows(
        workspace_id uuid, scenario_id text, position_code text, player_id text
      )
    `,
    safeWorkspace.scenarios.flatMap((scenario) =>
      Object.entries(scenario.assignments.defense).map(([positionCode, playerId]) => ({
        workspace_id: workspaceId,
        scenario_id: scenario.id,
        position_code: positionCode,
        player_id: playerId,
      })),
    ),
  );

  await insertJsonRows(
    client,
    `
      insert into public.app_scenario_lineup_slot (
        workspace_id, scenario_id, slot_index, player_id
      )
      select workspace_id, scenario_id, slot_index, player_id
      from jsonb_to_recordset($1::jsonb) as rows(
        workspace_id uuid, scenario_id text, slot_index smallint, player_id text
      )
    `,
    safeWorkspace.scenarios.flatMap((scenario) =>
      scenario.assignments.lineup.map((playerId, slotIndex) => ({
        workspace_id: workspaceId,
        scenario_id: scenario.id,
        slot_index: slotIndex,
        player_id: playerId,
      })),
    ),
  );

  await insertJsonRows(
    client,
    `
      insert into public.app_game (
        workspace_id, id, sort_order, game_date, opponent, game_type, total_innings, note
      )
      select workspace_id, id, sort_order, game_date, opponent, game_type, total_innings, note
      from jsonb_to_recordset($1::jsonb) as rows(
        workspace_id uuid, id text, sort_order integer, game_date date, opponent text,
        game_type text, total_innings integer, note text
      )
    `,
    safeWorkspace.games.map((game, sortOrder) => ({
      workspace_id: workspaceId,
      id: game.id,
      sort_order: sortOrder,
      game_date: normalizeDateOnly(game.date),
      opponent: game.opponent,
      game_type: game.gameType,
      total_innings: game.totalInnings,
      note: game.note ?? null,
    })),
  );

  await insertJsonRows(
    client,
    `
      insert into public.app_game_inning (
        workspace_id, game_id, inning_number, hits, runs, batters
      )
      select workspace_id, game_id, inning_number, hits, runs, batters
      from jsonb_to_recordset($1::jsonb) as rows(
        workspace_id uuid, game_id text, inning_number integer, hits integer, runs integer,
        batters text[]
      )
    `,
    safeWorkspace.games.flatMap((game) =>
      game.innings.map((inning) => ({
        workspace_id: workspaceId,
        game_id: game.id,
        inning_number: inning.inning,
        hits: inning.hits,
        runs: inning.runs,
        batters: inning.batters,
      })),
    ),
  );

  await insertJsonRows(
    client,
    `
      insert into public.app_game_stat_line (
        workspace_id, game_id, player_id, sort_order, pa, ab, h, doubles, triples, hr, rbi,
        r, sb, bb, hbp, sf, so, ip, er, so_pitching, bb_pitching, h_pitching, po, a, e,
        w, l, sv, np
      )
      select workspace_id, game_id, player_id, sort_order, pa, ab, h, doubles, triples, hr,
             rbi, r, sb, bb, hbp, sf, so, ip, er, so_pitching, bb_pitching, h_pitching,
             po, a, e, w, l, sv, np
      from jsonb_to_recordset($1::jsonb) as rows(
        workspace_id uuid, game_id text, player_id text, sort_order integer, pa integer,
        ab integer, h integer, doubles integer, triples integer, hr integer, rbi integer,
        r integer, sb integer, bb integer, hbp integer, sf integer, so integer, ip numeric,
        er integer, so_pitching integer, bb_pitching integer, h_pitching integer, po integer,
        a integer, e integer, w integer, l integer, sv integer, np integer
      )
    `,
    safeWorkspace.games.flatMap((game) =>
      game.statLines.map((statLine, sortOrder) => ({
        workspace_id: workspaceId,
        game_id: game.id,
        player_id: statLine.playerId,
        sort_order: sortOrder,
        pa: statLine.pa,
        ab: statLine.ab,
        h: statLine.h,
        doubles: statLine.doubles,
        triples: statLine.triples,
        hr: statLine.hr,
        rbi: statLine.rbi,
        r: statLine.r,
        sb: statLine.sb,
        bb: statLine.bb,
        hbp: statLine.hbp,
        sf: statLine.sf,
        so: statLine.so,
        ip: statLine.ip,
        er: statLine.er,
        so_pitching: statLine.soPitching,
        bb_pitching: statLine.bbPitching,
        h_pitching: statLine.hPitching,
        po: statLine.po,
        a: statLine.a,
        e: statLine.e,
        w: statLine.w,
        l: statLine.l,
        sv: statLine.sv,
        np: statLine.np,
      })),
    ),
  );

  await insertJsonRows(
    client,
    `
      insert into public.app_milestone (
        workspace_id, id, sort_order, milestone_date, title, description, media_url
      )
      select workspace_id, id, sort_order, milestone_date, title, description, media_url
      from jsonb_to_recordset($1::jsonb) as rows(
        workspace_id uuid, id text, sort_order integer, milestone_date date, title text,
        description text, media_url text
      )
    `,
    safeWorkspace.milestones.map((milestone, sortOrder) => ({
      workspace_id: workspaceId,
      id: milestone.id,
      sort_order: sortOrder,
      milestone_date: normalizeDateOnly(milestone.date),
      title: milestone.title,
      description: milestone.description,
      media_url: milestone.mediaUrl ?? null,
    })),
  );
}

async function ensureNormalizedWorkspaceRecord(
  client: Queryable,
  slug: string,
): Promise<NormalizedWorkspaceRecord> {
  const normalized = await selectNormalizedWorkspaceRecord(client, slug);
  if (normalized) {
    return normalized;
  }

  const legacy = await selectLegacyWorkspaceRow(client, slug);
  if (legacy) {
    const hydrated = hydrate(legacy.data);
    await writeNormalizedWorkspace({
      client,
      workspaceId: legacy.id,
      slug: legacy.slug,
      version: legacy.version,
      workspace: hydrated,
      createdAt: toIsoString(legacy.created_at),
      updatedAt: toIsoString(legacy.updated_at),
    });
    const record = await selectNormalizedWorkspaceRecord(client, slug);
    if (record) {
      return record;
    }
  }

  const defaultWorkspace = createDefaultWorkspace(false);
  const workspaceId = randomUUID();
  await writeNormalizedWorkspace({
    client,
    workspaceId,
    slug,
    version: 1,
    workspace: defaultWorkspace,
  });

  const created = await selectNormalizedWorkspaceRecord(client, slug);
  if (!created) {
    throw new Error("Workspace row missing after normalized create");
  }

  return created;
}

async function readNormalizedWorkspaceIfExists(
  client: Queryable,
  slug: string,
): Promise<WorkspaceSnapshot | null> {
  const record = await selectNormalizedWorkspaceRecord(client, slug);
  if (!record) {
    return null;
  }

  return {
    workspace: record.workspace,
    version: record.version,
    updatedAt: record.updatedAt,
  };
}

async function readBootstrapWorkspaceIfExists(
  client: Queryable,
  slug: string,
): Promise<WorkspaceSnapshot | null> {
  const metaResult = await client.query<WorkspaceMetaRow>(
    `select id, slug, version, active_scenario_id, help_dismissed, public_home_config, created_at, updated_at
     from public.app_workspace_meta where slug = $1 limit 1`,
    [slug],
  );
  const meta = metaResult.rows[0] ?? null;
  if (!meta) return null;

  const workspaceId = meta.id;
  const playersResult = await client.query<PlayerRow>(
      `select * from public.app_player where workspace_id = $1 order by sort_order asc`,
      [workspaceId],
    );
  const positionsResult = await client.query<PlayerPositionRow>(
      `select player_id, position_code from public.app_player_position where workspace_id = $1 order by player_id asc, position_code asc`,
      [workspaceId],
    );
  const scenariosResult = await client.query<ScenarioRow>(
      `select * from public.app_scenario where workspace_id = $1 order by sort_order asc`,
      [workspaceId],
    );
  const defenseResult = await client.query<DefenseAssignmentRow>(
      `select scenario_id, position_code, player_id from public.app_scenario_defense_assignment where workspace_id = $1 order by scenario_id asc, position_code asc`,
      [workspaceId],
    );
  const lineupResult = await client.query<LineupSlotRow>(
      `select scenario_id, slot_index, player_id from public.app_scenario_lineup_slot where workspace_id = $1 order by scenario_id asc, slot_index asc`,
      [workspaceId],
    );

  const playerPositions = new Map<string, Player["positions"]>();
  for (const row of positionsResult.rows) {
    const list = playerPositions.get(row.player_id) ?? [];
    list.push(row.position_code);
    playerPositions.set(row.player_id, list);
  }

  const players: Player[] = playersResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    number: row.number,
    throws: row.throws,
    bats: row.bats,
    positions: playerPositions.get(row.id) ?? [],
    status: row.status,
    ...(row.joined_on ? { joinedAt: toDateOnly(row.joined_on) } : {}),
    profile: {
      profileType: row.profile_type,
      age: row.age,
      heightCm: row.height_cm,
      weightKg: row.weight_kg,
      fastballTopKmh: row.fastball_top_kmh,
      fastballAvgKmh: row.fastball_avg_kmh,
      armStrengthM: row.arm_strength_m,
      thirtyMeterSec: row.thirty_meter_sec,
      pitchTypes: row.pitch_types ?? [],
      scoutingSummary: row.scouting_summary,
      radar: {
        pitcher: row.pitcher_radar ?? { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: row.fielder_radar ?? { contact: null, power: null, speed: null, arm: null, defense: null, instinct: null },
      },
    },
  }));

  const defenseByScenario = new Map<string, Scenario["assignments"]["defense"]>();
  for (const row of defenseResult.rows) {
    const current = defenseByScenario.get(row.scenario_id) ?? {
      P: null, C: null, "1B": null, "2B": null, "3B": null, SS: null, LF: null, CF: null, RF: null,
    };
    current[row.position_code] = row.player_id;
    defenseByScenario.set(row.scenario_id, current);
  }

  const lineupByScenario = new Map<string, Array<string | null>>();
  for (const row of lineupResult.rows) {
    const current = lineupByScenario.get(row.scenario_id) ?? Array<string | null>(9).fill(null);
    current[row.slot_index] = row.player_id;
    lineupByScenario.set(row.scenario_id, current);
  }

  const scenarios: Scenario[] = scenariosResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    note: row.note,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    assignments: {
      defense: defenseByScenario.get(row.id) ?? {
        P: null, C: null, "1B": null, "2B": null, "3B": null, SS: null, LF: null, CF: null, RF: null,
      },
      lineup: lineupByScenario.get(row.id) ?? Array<string | null>(9).fill(null),
    },
  }));

  const workspace: Workspace = {
    version: WORKSPACE_SCHEMA_VERSION,
    players,
    scenarios,
    activeScenarioId: meta.active_scenario_id && scenarios.some((s) => s.id === meta.active_scenario_id)
      ? meta.active_scenario_id : scenarios[0]?.id ?? "",
    games: [],
    milestones: [],
    preferences: { helpDismissed: meta.help_dismissed, publicHomeConfig: meta.public_home_config as unknown as Workspace["preferences"]["publicHomeConfig"] },
  };

  return {
    workspace,
    version: meta.version,
    updatedAt: toIsoString(meta.updated_at),
  };
}

async function readGamesWorkspaceIfExists(
  client: Queryable,
  slug: string,
): Promise<WorkspaceSnapshot | null> {
  const metaResult = await client.query<WorkspaceMetaRow>(
    `select id, slug, version, active_scenario_id, help_dismissed, public_home_config, created_at, updated_at
     from public.app_workspace_meta where slug = $1 limit 1`,
    [slug],
  );
  const meta = metaResult.rows[0] ?? null;
  if (!meta) return null;

  const workspaceId = meta.id;
  const playersResult = await client.query<PlayerRow>(
      `select * from public.app_player where workspace_id = $1 order by sort_order asc`,
      [workspaceId],
    );
  const positionsResult = await client.query<PlayerPositionRow>(
      `select player_id, position_code from public.app_player_position where workspace_id = $1 order by player_id asc, position_code asc`,
      [workspaceId],
    );
  const gamesResult = await client.query<GameRow>(
      `select * from public.app_game where workspace_id = $1 order by sort_order asc`,
      [workspaceId],
    );
  const inningsResult = await client.query<GameInningRow>(
      `select game_id, inning_number, hits, runs, batters from public.app_game_inning where workspace_id = $1 order by game_id asc, inning_number asc`,
      [workspaceId],
    );
  const statLinesResult = await client.query<GameStatLineRow>(
      `select game_id, player_id, sort_order, pa, ab, h, doubles, triples, hr, rbi, r, sb, bb, hbp, sf, so, ip, er, so_pitching, bb_pitching, h_pitching, po, a, e, w, l, sv, np from public.app_game_stat_line where workspace_id = $1 order by game_id asc, sort_order asc`,
      [workspaceId],
    );

  const playerPositions = new Map<string, Player["positions"]>();
  for (const row of positionsResult.rows) {
    const list = playerPositions.get(row.player_id) ?? [];
    list.push(row.position_code);
    playerPositions.set(row.player_id, list);
  }

  const players: Player[] = playersResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    number: row.number,
    throws: row.throws,
    bats: row.bats,
    positions: playerPositions.get(row.id) ?? [],
    status: row.status,
    ...(row.joined_on ? { joinedAt: toDateOnly(row.joined_on) } : {}),
    profile: {
      profileType: row.profile_type,
      age: row.age,
      heightCm: row.height_cm,
      weightKg: row.weight_kg,
      fastballTopKmh: row.fastball_top_kmh,
      fastballAvgKmh: row.fastball_avg_kmh,
      armStrengthM: row.arm_strength_m,
      thirtyMeterSec: row.thirty_meter_sec,
      pitchTypes: row.pitch_types ?? [],
      scoutingSummary: row.scouting_summary,
      radar: {
        pitcher: row.pitcher_radar ?? { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: row.fielder_radar ?? { contact: null, power: null, speed: null, arm: null, defense: null, instinct: null },
      },
    },
  }));

  const inningsByGame = new Map<string, InningRecord[]>();
  for (const row of inningsResult.rows) {
    const current = inningsByGame.get(row.game_id) ?? [];
    current.push({ inning: row.inning_number, hits: row.hits, runs: row.runs, batters: row.batters ?? [] });
    inningsByGame.set(row.game_id, current);
  }

  const statLinesByGame = new Map<string, PlayerGameStatLine[]>();
  for (const row of statLinesResult.rows) {
    const current = statLinesByGame.get(row.game_id) ?? [];
    current.push({
      playerId: row.player_id, pa: row.pa, ab: row.ab, h: row.h, doubles: row.doubles,
      triples: row.triples, hr: row.hr, rbi: row.rbi, r: row.r, sb: row.sb,
      bb: row.bb, hbp: row.hbp, sf: row.sf, so: row.so, ip: row.ip, er: row.er,
      soPitching: row.so_pitching, bbPitching: row.bb_pitching, hPitching: row.h_pitching,
      po: row.po, a: row.a, e: row.e, w: row.w, l: row.l, sv: row.sv, np: row.np,
    });
    statLinesByGame.set(row.game_id, current);
  }

  const games: Game[] = gamesResult.rows.map((row) => ({
    id: row.id,
    date: toDateOnly(row.game_date),
    opponent: row.opponent,
    gameType: row.game_type,
    totalInnings: row.total_innings,
    innings: inningsByGame.get(row.id) ?? [],
    statLines: statLinesByGame.get(row.id) ?? [],
    ...(row.note ? { note: row.note } : {}),
  }));

  const workspace: Workspace = {
    version: WORKSPACE_SCHEMA_VERSION,
    players,
    scenarios: [],
    activeScenarioId: "",
    games,
    milestones: [],
    preferences: { helpDismissed: meta.help_dismissed, publicHomeConfig: meta.public_home_config as unknown as Workspace["preferences"]["publicHomeConfig"] },
  };

  return {
    workspace,
    version: meta.version,
    updatedAt: toIsoString(meta.updated_at),
  };
}

async function readMilestonesWorkspaceIfExists(
  client: Queryable,
  slug: string,
): Promise<WorkspaceSnapshot | null> {
  const metaResult = await client.query<WorkspaceMetaRow>(
    `select id, slug, version, active_scenario_id, help_dismissed, public_home_config, created_at, updated_at
     from public.app_workspace_meta where slug = $1 limit 1`,
    [slug],
  );
  const meta = metaResult.rows[0] ?? null;
  if (!meta) return null;

  const workspaceId = meta.id;
  const playersResult = await client.query<PlayerRow>(
      `select * from public.app_player where workspace_id = $1 order by sort_order asc`,
      [workspaceId],
    );
  const positionsResult = await client.query<PlayerPositionRow>(
      `select player_id, position_code from public.app_player_position where workspace_id = $1 order by player_id asc, position_code asc`,
      [workspaceId],
    );
  const gamesResult = await client.query<GameRow>(
      `select * from public.app_game where workspace_id = $1 order by sort_order asc`,
      [workspaceId],
    );
  const statLinesResult = await client.query<GameStatLineRow>(
      `select game_id, player_id, sort_order, pa, ab, h, doubles, triples, hr, rbi, r, sb, bb, hbp, sf, so, ip, er, so_pitching, bb_pitching, h_pitching, po, a, e, w, l, sv, np from public.app_game_stat_line where workspace_id = $1 order by game_id asc, sort_order asc`,
      [workspaceId],
    );
  const milestonesResult = await client.query<MilestoneRow>(
      `select * from public.app_milestone where workspace_id = $1 order by sort_order asc`,
      [workspaceId],
    );

  const playerPositions = new Map<string, Player["positions"]>();
  for (const row of positionsResult.rows) {
    const list = playerPositions.get(row.player_id) ?? [];
    list.push(row.position_code);
    playerPositions.set(row.player_id, list);
  }

  const players: Player[] = playersResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    number: row.number,
    throws: row.throws,
    bats: row.bats,
    positions: playerPositions.get(row.id) ?? [],
    status: row.status,
    ...(row.joined_on ? { joinedAt: toDateOnly(row.joined_on) } : {}),
    profile: {
      profileType: row.profile_type,
      age: row.age,
      heightCm: row.height_cm,
      weightKg: row.weight_kg,
      fastballTopKmh: row.fastball_top_kmh,
      fastballAvgKmh: row.fastball_avg_kmh,
      armStrengthM: row.arm_strength_m,
      thirtyMeterSec: row.thirty_meter_sec,
      pitchTypes: row.pitch_types ?? [],
      scoutingSummary: row.scouting_summary,
      radar: {
        pitcher: row.pitcher_radar ?? { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: row.fielder_radar ?? { contact: null, power: null, speed: null, arm: null, defense: null, instinct: null },
      },
    },
  }));

  const statLinesByGame = new Map<string, PlayerGameStatLine[]>();
  for (const row of statLinesResult.rows) {
    const current = statLinesByGame.get(row.game_id) ?? [];
    current.push({
      playerId: row.player_id, pa: row.pa, ab: row.ab, h: row.h, doubles: row.doubles,
      triples: row.triples, hr: row.hr, rbi: row.rbi, r: row.r, sb: row.sb,
      bb: row.bb, hbp: row.hbp, sf: row.sf, so: row.so, ip: row.ip, er: row.er,
      soPitching: row.so_pitching, bbPitching: row.bb_pitching, hPitching: row.h_pitching,
      po: row.po, a: row.a, e: row.e, w: row.w, l: row.l, sv: row.sv, np: row.np,
    });
    statLinesByGame.set(row.game_id, current);
  }

  const games: Game[] = gamesResult.rows.map((row) => ({
    id: row.id,
    date: toDateOnly(row.game_date),
    opponent: row.opponent,
    gameType: row.game_type,
    totalInnings: row.total_innings,
    innings: [],
    statLines: statLinesByGame.get(row.id) ?? [],
    ...(row.note ? { note: row.note } : {}),
  }));

  const milestones: Milestone[] = milestonesResult.rows.map((row) => ({
    id: row.id,
    date: toDateOnly(row.milestone_date),
    title: row.title,
    description: row.description,
    ...(row.media_url ? { mediaUrl: row.media_url } : {}),
  }));

  const workspace: Workspace = {
    version: WORKSPACE_SCHEMA_VERSION,
    players,
    scenarios: [],
    activeScenarioId: "",
    games,
    milestones,
    preferences: { helpDismissed: meta.help_dismissed, publicHomeConfig: meta.public_home_config as unknown as Workspace["preferences"]["publicHomeConfig"] },
  };

  return {
    workspace,
    version: meta.version,
    updatedAt: toIsoString(meta.updated_at),
  };
}

async function readOrCreateWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const existing = await withReadTransaction((client) =>
    readNormalizedWorkspaceIfExists(client, DEFAULT_WORKSPACE_SLUG),
  );
  if (existing) {
    return existing;
  }

  // Slow path: first request ever (no normalized rows yet) — create or
  // migrate inside a transaction.
  return withTransaction(async (client) => {
    const record = await ensureNormalizedWorkspaceRecord(client, DEFAULT_WORKSPACE_SLUG);
    return {
      workspace: record.workspace,
      version: record.version,
      updatedAt: record.updatedAt,
    };
  });
}

async function readBootstrapWorkspace(): Promise<WorkspaceSnapshot> {
  const existing = await withReadTransaction((client) =>
    readBootstrapWorkspaceIfExists(client, DEFAULT_WORKSPACE_SLUG),
  );
  if (existing) return existing;
  return readOrCreateWorkspaceSnapshot();
}

async function readGamesWorkspace(): Promise<WorkspaceSnapshot> {
  const existing = await withReadTransaction((client) =>
    readGamesWorkspaceIfExists(client, DEFAULT_WORKSPACE_SLUG),
  );
  if (existing) return existing;
  return readOrCreateWorkspaceSnapshot();
}

async function readMilestonesWorkspace(): Promise<WorkspaceSnapshot> {
  const existing = await withReadTransaction((client) =>
    readMilestonesWorkspaceIfExists(client, DEFAULT_WORKSPACE_SLUG),
  );
  if (existing) return existing;
  return readOrCreateWorkspaceSnapshot();
}

export const getOrCreateWorkspaceSnapshot = unstable_cache(
  readOrCreateWorkspaceSnapshot,
  ["workspace", DEFAULT_WORKSPACE_SLUG, "full"],
  { tags: [WORKSPACE_CACHE_TAG], revalidate: false },
);

export const getBootstrapWorkspace = unstable_cache(
  readBootstrapWorkspace,
  ["workspace", DEFAULT_WORKSPACE_SLUG, "bootstrap"],
  { tags: [WORKSPACE_CACHE_TAG], revalidate: false },
);

export const getGamesWorkspace = unstable_cache(
  readGamesWorkspace,
  ["workspace", DEFAULT_WORKSPACE_SLUG, "games"],
  { tags: [WORKSPACE_CACHE_TAG], revalidate: false },
);

export const getMilestonesWorkspace = unstable_cache(
  readMilestonesWorkspace,
  ["workspace", DEFAULT_WORKSPACE_SLUG, "milestones"],
  { tags: [WORKSPACE_CACHE_TAG], revalidate: false },
);

function invalidateWorkspaceCache() {
  revalidateTag(WORKSPACE_CACHE_TAG, { expire: 0 });
}

export async function replaceWorkspaceSnapshot(params: {
  workspace: Workspace;
  version: number;
}): Promise<WorkspaceSnapshot | null> {
  const result = await withTransaction(async (client) => {
    const record = await ensureNormalizedWorkspaceRecord(client, DEFAULT_WORKSPACE_SLUG);
    const lockResult = await client.query(
      `
        select id
        from public.app_workspace_meta
        where slug = $1 and version = $2
        for update
      `,
      [DEFAULT_WORKSPACE_SLUG, params.version],
    );

    if (lockResult.rows.length === 0 || record.version !== params.version) {
      return null;
    }

    const nextWorkspace = sanitizeWorkspace(params.workspace);
    const nextVersion = record.version + 1;
    const updatedAt = new Date().toISOString();
    await writeNormalizedWorkspace({
      client,
      workspaceId: record.workspaceId,
      slug: record.slug,
      version: nextVersion,
      workspace: nextWorkspace,
      createdAt: record.createdAt,
      updatedAt,
    });

    return {
      workspace: nextWorkspace,
      version: nextVersion,
      updatedAt,
    };
  });

  if (result) {
    invalidateWorkspaceCache();
  }
  return result;
}

export async function mutateWorkspaceSnapshot(params: {
  version: number;
  mutate: (current: Workspace) => Workspace;
}): Promise<WorkspaceSnapshot | null> {
  const result = await withTransaction(async (client) => {
    const record = await ensureNormalizedWorkspaceRecord(client, DEFAULT_WORKSPACE_SLUG);
    const lockResult = await client.query(
      `
        select id
        from public.app_workspace_meta
        where slug = $1 and version = $2
        for update
      `,
      [DEFAULT_WORKSPACE_SLUG, params.version],
    );

    if (lockResult.rows.length === 0 || record.version !== params.version) {
      return null;
    }

    const nextWorkspace = sanitizeWorkspace(params.mutate(structuredClone(record.workspace)));
    const nextVersion = record.version + 1;
    const updatedAt = new Date().toISOString();
    await writeNormalizedWorkspace({
      client,
      workspaceId: record.workspaceId,
      slug: record.slug,
      version: nextVersion,
      workspace: nextWorkspace,
      createdAt: record.createdAt,
      updatedAt,
    });

    return {
      workspace: nextWorkspace,
      version: nextVersion,
      updatedAt,
    };
  });

  if (result) {
    invalidateWorkspaceCache();
  }
  return result;
}

export async function backfillLegacyWorkspacesToNormalized() {
  return withTransaction(async (client) => {
    const result = await client.query<LegacyWorkspaceRow>(
      `
        select id, slug, version, data, created_at, updated_at
        from public.app_workspace
        order by created_at asc
      `,
    );

    for (const row of result.rows) {
      await writeNormalizedWorkspace({
        client,
        workspaceId: row.id,
        slug: row.slug,
        version: row.version,
        workspace: hydrate(row.data),
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at),
      });
    }

    return result.rows.length;
  });
}
