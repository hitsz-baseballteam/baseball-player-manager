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

const WORKSPACE_CACHE_TAG = "workspace";

/**
 * Column lists for each table that `writeNormalizedWorkspace` bulk-inserts.
 * These are the camelCase keys to read from each row object; the actual
 * SQL parameter type casts are handled inside the INSERT statement.
 */
export const UNNEST_TABLE_COLUMNS = {
  players: [
    "id",
    "workspaceId",
    "sortOrder",
    "name",
    "number",
    "throws",
    "bats",
    "status",
    "joinedOn",
    "profileType",
    "age",
    "heightCm",
    "weightKg",
    "fastballTopKmh",
    "fastballAvgKmh",
    "armStrengthM",
    "thirtyMeterSec",
    "scoutingSummary",
    "pitcherRadar",
    "fielderRadar",
    "pitchTypes",
  ],
  positions: ["playerId", "positionCode"],
  scenarios: [
    "id",
    "workspaceId",
    "sortOrder",
    "name",
    "note",
    "createdAt",
    "updatedAt",
  ],
  defenseAssignments: ["scenarioId", "positionCode", "playerId"],
  lineupSlots: ["scenarioId", "slotIndex", "playerId"],
  games: [
    "id",
    "workspaceId",
    "sortOrder",
    "gameDate",
    "opponent",
    "gameType",
    "totalInnings",
    "note",
  ],
  innings: ["gameId", "inningNumber", "hits", "runs", "batters"],
  statLines: [
    "gameId",
    "playerId",
    "sortOrder",
    "pa",
    "ab",
    "h",
    "doubles",
    "triples",
    "hr",
    "rbi",
    "r",
    "sb",
    "bb",
    "hbp",
    "sf",
    "so",
    "ip",
    "er",
    "soPitching",
    "bbPitching",
    "hPitching",
    "po",
    "a",
    "e",
    "w",
    "l",
    "sv",
    "np",
  ],
  milestones: [
    "id",
    "workspaceId",
    "sortOrder",
    "date",
    "title",
    "description",
    "mediaUrl",
  ],
} as const;

export type UnnestTableName = keyof typeof UNNEST_TABLE_COLUMNS;

/**
 * Convert an array of row objects into per-column value arrays suitable
 * for a PostgreSQL `unnest()` batch INSERT. Returns `[]` for an empty
 * input array (no INSERT needed).
 */
export function prepareUnnestArgs<T extends Record<string, unknown>>(
  rows: T[],
  tableName: UnnestTableName,
): unknown[][] {
  if (rows.length === 0) return [];
  const columns = UNNEST_TABLE_COLUMNS[tableName];
  return columns.map((col) => rows.map((row) => row[col]));
}

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

type PlayerInsertRow = {
  id: string;
  workspaceId: string;
  sortOrder: number;
  name: string;
  number: string;
  throws: Player["throws"];
  bats: Player["bats"];
  status: Player["status"];
  joinedOn: string | null;
  profileType: Player["profile"]["profileType"];
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  fastballTopKmh: number | null;
  fastballAvgKmh: number | null;
  armStrengthM: number | null;
  thirtyMeterSec: number | null;
  scoutingSummary: string;
  pitcherRadar: string;
  fielderRadar: string;
  pitchTypes: string[];
};

type PositionInsertRow = {
  playerId: string;
  positionCode: Player["positions"][number];
};

type ScenarioInsertRow = {
  id: string;
  workspaceId: string;
  sortOrder: number;
  name: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type DefenseAssignmentInsertRow = {
  scenarioId: string;
  positionCode: Player["positions"][number];
  playerId: string | null;
};

type LineupSlotInsertRow = {
  scenarioId: string;
  slotIndex: number;
  playerId: string | null;
};

type GameInsertRow = {
  id: string;
  workspaceId: string;
  sortOrder: number;
  gameDate: string | null;
  opponent: string;
  gameType: Game["gameType"];
  totalInnings: number;
  note: string | null;
};

type InningInsertRow = {
  gameId: string;
  inningNumber: number;
  hits: number;
  runs: number;
  batters: string[];
};

type StatLineInsertRow = {
  gameId: string;
  playerId: string;
  sortOrder: number;
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
  soPitching: number | null;
  bbPitching: number | null;
  hPitching: number | null;
  po: number;
  a: number;
  e: number;
  w: number;
  l: number;
  sv: number;
  np: number;
};

type MilestoneInsertRow = {
  id: string;
  workspaceId: string;
  sortOrder: number;
  date: string | null;
  title: string;
  description: string;
  mediaUrl: string | null;
};

type WorkspaceWriteRows = {
  players: PlayerInsertRow[];
  positions: PositionInsertRow[];
  scenarios: ScenarioInsertRow[];
  defenseAssignments: DefenseAssignmentInsertRow[];
  lineupSlots: LineupSlotInsertRow[];
  games: GameInsertRow[];
  innings: InningInsertRow[];
  statLines: StatLineInsertRow[];
  milestones: MilestoneInsertRow[];
};

export function buildWorkspaceWriteRows(
  workspaceId: string,
  workspace: Workspace,
): WorkspaceWriteRows {
  const players: PlayerInsertRow[] = [];
  const positions: PositionInsertRow[] = [];
  const scenarios: ScenarioInsertRow[] = [];
  const defenseAssignments: DefenseAssignmentInsertRow[] = [];
  const lineupSlots: LineupSlotInsertRow[] = [];
  const games: GameInsertRow[] = [];
  const innings: InningInsertRow[] = [];
  const statLines: StatLineInsertRow[] = [];
  const milestones: MilestoneInsertRow[] = [];

  for (const [index, player] of workspace.players.entries()) {
    players.push({
      id: player.id,
      workspaceId,
      sortOrder: index,
      name: player.name,
      number: player.number,
      throws: player.throws,
      bats: player.bats,
      status: player.status,
      joinedOn: normalizeDateOnly(player.joinedAt),
      profileType: player.profile.profileType,
      age: player.profile.age,
      heightCm: player.profile.heightCm,
      weightKg: player.profile.weightKg,
      fastballTopKmh: player.profile.fastballTopKmh,
      fastballAvgKmh: player.profile.fastballAvgKmh,
      armStrengthM: player.profile.armStrengthM,
      thirtyMeterSec: player.profile.thirtyMeterSec,
      scoutingSummary: player.profile.scoutingSummary,
      pitcherRadar: JSON.stringify(player.profile.radar.pitcher),
      fielderRadar: JSON.stringify(player.profile.radar.fielder),
      pitchTypes: player.profile.pitchTypes ?? [],
    });

    for (const position of player.positions) {
      positions.push({
        playerId: player.id,
        positionCode: position,
      });
    }
  }

  for (const [index, scenario] of workspace.scenarios.entries()) {
    scenarios.push({
      id: scenario.id,
      workspaceId,
      sortOrder: index,
      name: scenario.name,
      note: scenario.note,
      createdAt: scenario.createdAt,
      updatedAt: scenario.updatedAt,
    });

    for (const [positionCode, playerId] of Object.entries(scenario.assignments.defense)) {
      defenseAssignments.push({
        scenarioId: scenario.id,
        positionCode: positionCode as Player["positions"][number],
        playerId,
      });
    }

    for (const [slotIndex, playerId] of scenario.assignments.lineup.entries()) {
      lineupSlots.push({
        scenarioId: scenario.id,
        slotIndex,
        playerId,
      });
    }
  }

  for (const [index, game] of workspace.games.entries()) {
    games.push({
      id: game.id,
      workspaceId,
      sortOrder: index,
      gameDate: normalizeDateOnly(game.date),
      opponent: game.opponent,
      gameType: game.gameType,
      totalInnings: game.totalInnings,
      note: game.note ?? null,
    });

    for (const inning of game.innings) {
      innings.push({
        gameId: game.id,
        inningNumber: inning.inning,
        hits: inning.hits,
        runs: inning.runs,
        batters: inning.batters,
      });
    }

    for (const [statIndex, statLine] of game.statLines.entries()) {
      statLines.push({
        gameId: game.id,
        playerId: statLine.playerId,
        sortOrder: statIndex,
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
        soPitching: statLine.soPitching,
        bbPitching: statLine.bbPitching,
        hPitching: statLine.hPitching,
        po: statLine.po,
        a: statLine.a,
        e: statLine.e,
        w: statLine.w,
        l: statLine.l,
        sv: statLine.sv,
        np: statLine.np,
      });
    }
  }

  for (const [index, milestone] of workspace.milestones.entries()) {
    milestones.push({
      id: milestone.id,
      workspaceId,
      sortOrder: index,
      date: normalizeDateOnly(milestone.date),
      title: milestone.title,
      description: milestone.description,
      mediaUrl: milestone.mediaUrl ?? null,
    });
  }

  return {
    players,
    positions,
    scenarios,
    defenseAssignments,
    lineupSlots,
    games,
    innings,
    statLines,
    milestones,
  };
}

async function insertRowsWithUnnest<T extends Record<string, unknown>>(
  client: Queryable,
  tableName: UnnestTableName,
  sql: string,
  rows: T[],
  leadingArgs: unknown[] = [],
) {
  const args = prepareUnnestArgs(rows, tableName);
  if (args.length === 0) {
    return;
  }

  await client.query(sql, [...leadingArgs, ...args]);
}

/**
 * Wrap `work` in a read transaction on the given client.
 *
 * The client must be checked out from the pool and released by the caller
 * (see `withTransaction` below). This is the read path — no isolation-level
 * change, because a fresh `BEGIN` on a single connection already gives us
 * a consistent snapshot of the data we just read.
 */
export async function wrapReadTransaction<T>(
  client: Queryable,
  work: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    const result = await work();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

/**
 * Wrap `work` in a write transaction on the given client.
 *
 * Sets `REPEATABLE READ` after `BEGIN` so the 9 SELECT reads inside a
 * single write transaction see a consistent snapshot. Without this, between
 * our SELECTs another writer could commit and we'd read a mix of v1 and
 * v2 data.
 *
 * 409 convergence is *not* affected by the isolation level — it is
 * guaranteed by the OCC version check + `SELECT ... FOR UPDATE` in
 * `replaceWorkspaceSnapshot` / `mutateWorkspaceSnapshot`.
 */
export async function wrapWriteTransaction<T>(
  client: Queryable,
  work: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  await client.query("set transaction isolation level repeatable read");
  try {
    const result = await work();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

type TransactionMode = "read" | "write";

async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
  options: { mode?: TransactionMode } = {},
): Promise<T> {
  const client = await getPool().connect();
  try {
    const wrap = options.mode === "write" ? wrapWriteTransaction : wrapReadTransaction;
    return await wrap(client, () => work(client));
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
      select id, slug, version, active_scenario_id, help_dismissed, created_at, updated_at
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

  const [
    playersResult,
    positionsResult,
    scenariosResult,
    defenseResult,
    lineupResult,
    gamesResult,
    inningsResult,
    statLinesResult,
    milestonesResult,
  ] = await Promise.all([
    client.query<PlayerRow>(
      `
        select *
        from public.app_player
        where workspace_id = $1
        order by sort_order asc
      `,
      [workspaceId],
    ),
    client.query<PlayerPositionRow>(
      `
        select player_id, position_code
        from public.app_player_position
        where workspace_id = $1
        order by player_id asc, position_code asc
      `,
      [workspaceId],
    ),
    client.query<ScenarioRow>(
      `
        select *
        from public.app_scenario
        where workspace_id = $1
        order by sort_order asc
      `,
      [workspaceId],
    ),
    client.query<DefenseAssignmentRow>(
      `
        select scenario_id, position_code, player_id
        from public.app_scenario_defense_assignment
        where workspace_id = $1
        order by scenario_id asc, position_code asc
      `,
      [workspaceId],
    ),
    client.query<LineupSlotRow>(
      `
        select scenario_id, slot_index, player_id
        from public.app_scenario_lineup_slot
        where workspace_id = $1
        order by scenario_id asc, slot_index asc
      `,
      [workspaceId],
    ),
    client.query<GameRow>(
      `
        select *
        from public.app_game
        where workspace_id = $1
        order by sort_order asc
      `,
      [workspaceId],
    ),
    client.query<GameInningRow>(
      `
        select game_id, inning_number, hits, runs, batters
        from public.app_game_inning
        where workspace_id = $1
        order by game_id asc, inning_number asc
      `,
      [workspaceId],
    ),
    client.query<GameStatLineRow>(
      `
        select game_id, player_id, sort_order, pa, ab, h, doubles, triples, hr, rbi, r, sb, bb,
               hbp, sf, so, ip, er, so_pitching, bb_pitching, h_pitching, po, a, e, w, l, sv, np
        from public.app_game_stat_line
        where workspace_id = $1
        order by game_id asc, sort_order asc
      `,
      [workspaceId],
    ),
    client.query<MilestoneRow>(
      `
        select *
        from public.app_milestone
        where workspace_id = $1
        order by sort_order asc
      `,
      [workspaceId],
    ),
  ]);

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
        id, slug, version, active_scenario_id, help_dismissed, created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
      on conflict (id) do update
      set slug = excluded.slug,
          version = excluded.version,
          active_scenario_id = excluded.active_scenario_id,
          help_dismissed = excluded.help_dismissed,
          updated_at = excluded.updated_at
    `,
    [
      workspaceId,
      slug,
      version,
      safeWorkspace.activeScenarioId,
      safeWorkspace.preferences.helpDismissed,
      createdAtValue,
      updatedAtValue,
    ],
  );

  await wipeNormalizedWorkspace(client, workspaceId);
  const rows = buildWorkspaceWriteRows(workspaceId, safeWorkspace);

  await insertRowsWithUnnest(
    client,
    "players",
    `
      insert into public.app_player (
        id, workspace_id, sort_order, name, number, throws, bats, status, joined_on,
        profile_type, age, height_cm, weight_kg, fastball_top_kmh, fastball_avg_kmh,
        arm_strength_m, thirty_meter_sec, scouting_summary, pitcher_radar, fielder_radar,
        pitch_types
      )
      select *
      from unnest(
        $1::text[],
        $2::uuid[],
        $3::integer[],
        $4::text[],
        $5::text[],
        $6::text[],
        $7::text[],
        $8::text[],
        $9::date[],
        $10::text[],
        $11::integer[],
        $12::integer[],
        $13::integer[],
        $14::numeric[],
        $15::numeric[],
        $16::numeric[],
        $17::numeric[],
        $18::text[],
        $19::jsonb[],
        $20::jsonb[],
        $21::text[][]
      ) as rows(
        id,
        workspace_id,
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
    `,
    rows.players,
  );

  await insertRowsWithUnnest(
    client,
    "positions",
    `
      insert into public.app_player_position (workspace_id, player_id, position_code)
      select $1::uuid, rows.player_id, rows.position_code
      from unnest($2::text[], $3::text[]) as rows(player_id, position_code)
    `,
    rows.positions,
    [workspaceId],
  );

  await insertRowsWithUnnest(
    client,
    "scenarios",
    `
      insert into public.app_scenario (
        id, workspace_id, sort_order, name, note, created_at, updated_at
      )
      select *
      from unnest(
        $1::text[],
        $2::uuid[],
        $3::integer[],
        $4::text[],
        $5::text[],
        $6::timestamptz[],
        $7::timestamptz[]
      ) as rows(id, workspace_id, sort_order, name, note, created_at, updated_at)
    `,
    rows.scenarios,
  );

  await insertRowsWithUnnest(
    client,
    "defenseAssignments",
    `
      insert into public.app_scenario_defense_assignment (
        workspace_id, scenario_id, position_code, player_id
      )
      select $1::uuid, rows.scenario_id, rows.position_code, rows.player_id
      from unnest($2::text[], $3::text[], $4::text[]) as rows(
        scenario_id,
        position_code,
        player_id
      )
    `,
    rows.defenseAssignments,
    [workspaceId],
  );

  await insertRowsWithUnnest(
    client,
    "lineupSlots",
    `
      insert into public.app_scenario_lineup_slot (
        workspace_id, scenario_id, slot_index, player_id
      )
      select $1::uuid, rows.scenario_id, rows.slot_index, rows.player_id
      from unnest($2::text[], $3::smallint[], $4::text[]) as rows(
        scenario_id,
        slot_index,
        player_id
      )
    `,
    rows.lineupSlots,
    [workspaceId],
  );

  await insertRowsWithUnnest(
    client,
    "games",
    `
      insert into public.app_game (
        id, workspace_id, sort_order, game_date, opponent, game_type, total_innings, note
      )
      select *
      from unnest(
        $1::text[],
        $2::uuid[],
        $3::integer[],
        $4::date[],
        $5::text[],
        $6::text[],
        $7::integer[],
        $8::text[]
      ) as rows(
        id,
        workspace_id,
        sort_order,
        game_date,
        opponent,
        game_type,
        total_innings,
        note
      )
    `,
    rows.games,
  );

  await insertRowsWithUnnest(
    client,
    "innings",
    `
      insert into public.app_game_inning (
        workspace_id, game_id, inning_number, hits, runs, batters
      )
      select $1::uuid, rows.game_id, rows.inning_number, rows.hits, rows.runs, rows.batters
      from unnest(
        $2::text[],
        $3::integer[],
        $4::integer[],
        $5::integer[],
        $6::text[][]
      ) as rows(game_id, inning_number, hits, runs, batters)
    `,
    rows.innings,
    [workspaceId],
  );

  await insertRowsWithUnnest(
    client,
    "statLines",
    `
      insert into public.app_game_stat_line (
        workspace_id, game_id, player_id, sort_order, pa, ab, h, doubles, triples, hr, rbi,
        r, sb, bb, hbp, sf, so, ip, er, so_pitching, bb_pitching, h_pitching, po, a, e,
        w, l, sv, np
      )
      select $1::uuid, *
      from unnest(
        $2::text[],
        $3::text[],
        $4::integer[],
        $5::integer[],
        $6::integer[],
        $7::integer[],
        $8::integer[],
        $9::integer[],
        $10::integer[],
        $11::integer[],
        $12::integer[],
        $13::integer[],
        $14::integer[],
        $15::integer[],
        $16::integer[],
        $17::integer[],
        $18::numeric[],
        $19::integer[],
        $20::integer[],
        $21::integer[],
        $22::integer[],
        $23::integer[],
        $24::integer[],
        $25::integer[],
        $26::integer[],
        $27::integer[],
        $28::integer[],
        $29::integer[]
      ) as rows(
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
    `,
    rows.statLines,
    [workspaceId],
  );

  await insertRowsWithUnnest(
    client,
    "milestones",
    `
      insert into public.app_milestone (
        id, workspace_id, sort_order, milestone_date, title, description, media_url
      )
      select *
      from unnest(
        $1::text[],
        $2::uuid[],
        $3::integer[],
        $4::date[],
        $5::text[],
        $6::text[],
        $7::text[]
      ) as rows(id, workspace_id, sort_order, milestone_date, title, description, media_url)
    `,
    rows.milestones,
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

async function getOrCreateWorkspaceSnapshotImpl(): Promise<WorkspaceSnapshot> {
  return withTransaction(async (client) => {
    const record = await ensureNormalizedWorkspaceRecord(client, DEFAULT_WORKSPACE_SLUG);
    return {
      workspace: record.workspace,
      version: record.version,
      updatedAt: record.updatedAt,
    };
  });
}

/**
 * Read the workspace snapshot, cached for 10s in the Next.js cache layer.
 * Mutations call `revalidateTag("workspace")` to invalidate.
 */
export const getOrCreateWorkspaceSnapshot = unstable_cache(
  getOrCreateWorkspaceSnapshotImpl,
  ["workspace-snapshot"],
  { revalidate: 10, tags: ["workspace"] },
);

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
  }, { mode: "write" });

  if (result) {
    revalidateTag(WORKSPACE_CACHE_TAG, "max");
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
  }, { mode: "write" });

  if (result) {
    revalidateTag(WORKSPACE_CACHE_TAG, "max");
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
