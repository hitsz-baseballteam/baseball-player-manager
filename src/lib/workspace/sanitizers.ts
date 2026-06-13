// ── Input sanitization ──

import {
  POSITIONS,
  POSITION_CODES,
  STATUS_LABELS,
  HAND_LABELS,
  WORKSPACE_SCHEMA_VERSION,
  type Hand,
  type PitcherRadar,
  type FielderRadar,
  type Player,
  type PlayerProfile,
  type PlayerStatus,
  type PositionCode,
  type Scenario,
  type ScenarioAssignments,
  type Workspace,
  type GameRecord,
  type Game,
  type InningRecord,
  type PlayerGameStatLine,
} from "./types";
import {
  createDefaultPlayerProfile,
  createDefaultWorkspace,
  createEmptyAssignments,
  createScenario,
  inferPlayerProfileType,
} from "./base";

// ── Helpers ──

function sanitizeStringList(value: unknown, limit: number, maxLength: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, limit);
}

function sanitizeRadar<T extends Record<string, number | null>>(
  value: unknown,
  fallback: T,
) {
  if (!value || typeof value !== "object") {
    return structuredClone(fallback);
  }

  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(fallback).map((key) => [
      key,
      sanitizeNullableNumber(source[key], 20, 80, true),
    ]),
  ) as T;
}

function sanitizeGameInt(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function sanitizeGameInnings(value: unknown): number | null {
  const sanitized = sanitizeNullableNumber(value, 0, 30);
  if (sanitized === null) return null;

  const whole = Math.trunc(sanitized);
  const tenth = Math.round((sanitized - whole) * 10);
  if (tenth < 0 || tenth > 2) return null;

  const normalized = whole + tenth / 10;
  return Math.abs(sanitized - normalized) < 1e-9 ? normalized : null;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function normalizeHand(value: unknown): Hand {
  return typeof value === "string" && value in HAND_LABELS
    ? (value as Hand)
    : "R";
}

export function sanitizeNullableNumber(
  value: unknown,
  min: number,
  max: number,
  integer = false,
) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  const normalized = integer ? Math.round(parsed) : Number(parsed.toFixed(2));
  if (normalized < min || normalized > max) {
    return null;
  }

  return normalized;
}

export function sanitizePositions(value: unknown): PositionCode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((position, index): position is PositionCode => {
    return (
      typeof position === "string" &&
      POSITION_CODES.includes(position as PositionCode) &&
      value.indexOf(position) === index
    );
  });
}

function sanitizeGameRecords(value: unknown): GameRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      id: String((item as Record<string, unknown>).id ?? ""),
      date: String((item as Record<string, unknown>).date ?? ""),
      opponent: String((item as Record<string, unknown>).opponent ?? "").trim().slice(0, 40),
      gameType: (item as Record<string, unknown>).gameType === "training" ? "training" : "official",
      pa: sanitizeGameInt((item as Record<string, unknown>).pa),
      ab: sanitizeGameInt((item as Record<string, unknown>).ab),
      h: sanitizeGameInt((item as Record<string, unknown>).h),
      hr: sanitizeGameInt((item as Record<string, unknown>).hr),
      rbi: sanitizeGameInt((item as Record<string, unknown>).rbi),
      r: sanitizeGameInt((item as Record<string, unknown>).r),
      sb: sanitizeGameInt((item as Record<string, unknown>).sb),
      bb: sanitizeGameInt((item as Record<string, unknown>).bb),
      so: sanitizeGameInt((item as Record<string, unknown>).so),
      ip: sanitizeGameInnings((item as Record<string, unknown>).ip),
      er: sanitizeNullableNumber((item as Record<string, unknown>).er, 0, 99),
      soPitching: sanitizeNullableNumber((item as Record<string, unknown>).soPitching, 0, 99, true),
      bbPitching: sanitizeNullableNumber((item as Record<string, unknown>).bbPitching, 0, 99, true),
      hPitching: sanitizeNullableNumber((item as Record<string, unknown>).hPitching, 0, 99, true),
    } as GameRecord))
    .filter((item) => item.id && item.date && item.opponent);
}

// ── Player sanitizers ──

export function sanitizePlayers(players: unknown[]): Player[] {
  return players
    .filter((player): player is Record<string, unknown> => {
      return Boolean(player && typeof player === "object");
    })
    .filter((player) => player.id && player.name)
    .map((player) => {
      const positions = sanitizePositions(player.positions);
      return {
        id: String(player.id),
        name: String(player.name).trim().slice(0, 28),
        number: String(player.number ?? "").trim().slice(0, 3),
        throws: normalizeHand(player.throws),
        bats: normalizeHand(player.bats),
        positions,
        status: (player.status as string) in STATUS_LABELS
          ? (player.status as PlayerStatus)
          : "available",
        profile: sanitizePlayerProfile(player.profile, positions),
      };
    })
    .filter((player) => Boolean(player.name && player.number));
}

export function sanitizePlayerProfile(
  value: unknown,
  positions: PositionCode[],
): PlayerProfile {
  const source = value as Partial<PlayerProfile> | undefined;
  const profileType =
    source?.profileType === "pitcher" || source?.profileType === "fielder"
      ? source.profileType
      : inferPlayerProfileType(positions);
  const fallback = createDefaultPlayerProfile(profileType);

  return {
    profileType,
    age: sanitizeNullableNumber(source?.age, 10, 60, true),
    heightCm: sanitizeNullableNumber(source?.heightCm, 100, 240, true),
    weightKg: sanitizeNullableNumber(source?.weightKg, 30, 200, true),
    fastballTopKmh: sanitizeNullableNumber(source?.fastballTopKmh, 60, 180),
    fastballAvgKmh: sanitizeNullableNumber(source?.fastballAvgKmh, 60, 180),
    armStrengthM: sanitizeNullableNumber(
      source?.armStrengthM ?? (source as Record<string, unknown>)?.armStrengthKmh,
      10,
      150,
    ),
    thirtyMeterSec: sanitizeNullableNumber(
      source?.thirtyMeterSec ?? (source as Record<string, unknown>)?.sixtyMeterSec,
      3,
      8,
    ),

  games: sanitizeGameRecords((source as Record<string, unknown>)?.games),
    pitchTypes: sanitizeStringList(source?.pitchTypes, 6, 10),
    scoutingSummary: String(source?.scoutingSummary ?? "").trim().slice(0, 180),
    radar: {
      pitcher: sanitizeRadar(
        source?.radar?.pitcher,
        fallback.radar.pitcher,
      ) as PitcherRadar,
      fielder: sanitizeRadar(
        source?.radar?.fielder,
        fallback.radar.fielder,
      ) as FielderRadar,
    },
  };
}

// ── Scenario sanitizers ──

export function sanitizeScenario(
  scenario: unknown,
  validIds: Set<string>,
): Scenario | null {
  if (!scenario || typeof scenario !== "object") {
    return null;
  }

  const source = scenario as Partial<Scenario>;
  if (!source.id || !source.name) {
    return null;
  }

  const createdAt = isIsoDate(source.createdAt)
    ? source.createdAt
    : new Date().toISOString();
  const updatedAt = isIsoDate(source.updatedAt) ? source.updatedAt : createdAt;

  return {
    id: String(source.id),
    name: String(source.name).trim().slice(0, 24) || "未命名方案",
    note: String(source.note ?? "").trim().slice(0, 120),
    assignments: sanitizeAssignments(source.assignments, validIds),
    createdAt,
    updatedAt,
  };
}

export function sanitizeAssignments(
  assignments: unknown,
  validIds: Set<string>,
): ScenarioAssignments {
  const source = assignments as Partial<ScenarioAssignments> | undefined;
  const defense = Object.fromEntries(
    POSITIONS.map((position) => {
      const candidate =
        source?.defense?.[position.code as keyof typeof source.defense] ?? null;
      return [position.code, validIds.has(String(candidate)) ? String(candidate) : null];
    }),
  ) as Record<PositionCode, string | null>;

  const lineupSource = Array.isArray(source?.lineup) ? source.lineup : [];
  const lineup = Array.from({ length: 9 }, (_, index) => {
    const candidate = lineupSource[index] ?? null;
    return validIds.has(String(candidate)) ? String(candidate) : null;
  });

  return { defense, lineup };
}

// ── Workspace sanitizers ──

export function sanitizeWorkspace(value: unknown): Workspace {
  const fallback = createDefaultWorkspace(false);
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const source = value as Partial<Workspace>;
  const players = sanitizePlayers(Array.isArray(source.players) ? source.players : []);
  const validIds = new Set(players.map((player) => player.id));
  const scenarios = (Array.isArray(source.scenarios) ? source.scenarios : [])
    .map((scenario) => sanitizeScenario(scenario, validIds))
    .filter((scenario): scenario is Scenario => Boolean(scenario));

  if (!scenarios.length) {
    scenarios.push(
      createScenario("默认方案", "默认工作区方案", createEmptyAssignments()),
    );
  }

  const activeScenarioId = scenarios.some(
    (scenario) => scenario.id === source.activeScenarioId,
  )
    ? (source.activeScenarioId as string)
    : scenarios[0].id;

  const games = sanitizeGames(Array.isArray(source.games) ? source.games : []);

  return {
    version: WORKSPACE_SCHEMA_VERSION,
    players,
    scenarios,
    activeScenarioId,
    games,
    preferences: {
      helpDismissed: Boolean(source.preferences?.helpDismissed),
    },
  };
}

// ── Game sanitizers ──

function sanitizeStatLine(value: unknown): PlayerGameStatLine {
  const s = value as Record<string, unknown> | null | undefined;
  return {
    playerId: String(s?.playerId ?? ""),
    pa: sanitizeGameInt(s?.pa),
    ab: sanitizeGameInt(s?.ab),
    h: sanitizeGameInt(s?.h),
    hr: sanitizeGameInt(s?.hr),
    rbi: sanitizeGameInt(s?.rbi),
    r: sanitizeGameInt(s?.r),
    sb: sanitizeGameInt(s?.sb),
    bb: sanitizeGameInt(s?.bb),
    so: sanitizeGameInt(s?.so),
    ip: sanitizeGameInnings(s?.ip),
    er: sanitizeNullableNumber(s?.er, 0, 99),
    soPitching: sanitizeNullableNumber(s?.soPitching, 0, 99, true),
    bbPitching: sanitizeNullableNumber(s?.bbPitching, 0, 99, true),
    hPitching: sanitizeNullableNumber(s?.hPitching, 0, 99, true),
    po: sanitizeGameInt(s?.po),
    a: sanitizeGameInt(s?.a),
    e: sanitizeGameInt(s?.e),
  };
}

function sanitizeInning(value: unknown): InningRecord {
  const s = value as Record<string, unknown> | null | undefined;
  return {
    inning: Math.max(1, sanitizeGameInt(s?.inning) || 1),
    hits: sanitizeGameInt(s?.hits),
    runs: sanitizeGameInt(s?.runs),
    batters: sanitizeStringList(s?.batters, 12, 36),
  };
}

export function sanitizeGame(value: unknown): Game | null {
  const s = value as Record<string, unknown> | null | undefined;
  if (!s?.id || !s?.date || !s?.opponent) return null;
  return {
    id: String(s.id),
    date: String(s.date),
    opponent: String(s.opponent).trim().slice(0, 40),
    gameType: s.gameType === "training" ? "training" : "official",
    totalInnings: Math.max(1, sanitizeGameInt(s.totalInnings) || 9),
    innings: (Array.isArray(s.innings) ? s.innings : []).map(sanitizeInning),
    statLines: (Array.isArray(s.statLines) ? s.statLines : [])
      .map(sanitizeStatLine)
      .filter((sl) => sl.playerId),
    note: String(s.note ?? "").trim().slice(0, 200) || undefined,
  };
}

export function sanitizeGames(value: unknown): Game[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(sanitizeGame)
    .filter((g): g is Game => g !== null);
}
