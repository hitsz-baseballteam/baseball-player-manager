// ── Input sanitization ──

import {
  createDefaultPublicHomeConfig,
} from "./base";
import {
  POSITIONS,
  POSITION_CODES,
  STATUS_LABELS,
  HAND_LABELS,
  WORKSPACE_SCHEMA_VERSION,
  MAX_GAME_INNINGS,
  MAX_GAME_STAT_LINES,
  MAX_WORKSPACE_GAMES,
  MAX_WORKSPACE_PLAYERS,
  MAX_WORKSPACE_SCENARIOS,
  MAX_WORKSPACE_MILESTONES,
  type Hand,
  type Milestone,
  type PitcherRadar,
  type FielderRadar,
  type Player,
  type PlayerProfile,
  type PlayerStatus,
  type PublicHomeMember,
  type PublicHomeMemberTone,
  type PositionCode,
  type Scenario,
  type ScenarioAssignments,
  type Workspace,

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


// ── Player sanitizers ──

export function sanitizePlayers(players: unknown[]): Player[] {
  return players
    .slice(0, MAX_WORKSPACE_PLAYERS)
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
        ...(player.joinedAt && isIsoDate(player.joinedAt)
          ? { joinedAt: String(player.joinedAt) }
          : {}),
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

export function sanitizePublicHomeConfig(
  value: unknown,
): Workspace["preferences"]["publicHomeConfig"] {
  const defaults = createDefaultPublicHomeConfig();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const source = value as Record<string, unknown>;

  return {
    training: sanitizeTrainingInfo(source.training),
    contacts: sanitizeContacts(source.contacts),
    faq: sanitizeFaq(source.faq),
    history: sanitizeHistory(source.history),
    members: sanitizePublicHomeMembers(source.members),
    feeds: sanitizeFeeds(source.feeds),
  };
}

const PUBLIC_HOME_MEMBER_TONES: PublicHomeMemberTone[] = [
  "captain",
  "vice",
  "manager",
  "active",
  "open",
];

function sanitizePublicHomeMembers(
  value: unknown,
): Workspace["preferences"]["publicHomeConfig"]["members"] {
  const defaults = createDefaultPublicHomeConfig().members;
  if (!Array.isArray(value)) {
    return defaults;
  }

  const members = value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item): PublicHomeMember => {
      const nickname = typeof item.nickname === "string"
        ? item.nickname.trim().slice(0, 32)
        : "";
      const tone = PUBLIC_HOME_MEMBER_TONES.includes(item.tone as PublicHomeMemberTone)
        ? (item.tone as PublicHomeMemberTone)
        : "active";
      return {
        number: String(item.number ?? "").trim().slice(0, 4),
        name: String(item.name ?? "").trim().slice(0, 48),
        ...(nickname ? { nickname } : {}),
        role: String(item.role ?? "队员").trim().slice(0, 24) || "队员",
        note: String(item.note ?? "").trim().slice(0, 120),
        tone,
      };
    })
    .filter((member) => Boolean(member.number && member.name))
    .slice(0, 60);

  return members.length > 0 ? members : defaults;
}

function sanitizeTrainingInfo(
  value: unknown,
): Workspace["preferences"]["publicHomeConfig"]["training"] {
  const defaults = createDefaultPublicHomeConfig().training;
  if (!value || typeof value !== "object") {
    return defaults;
  }
  const source = value as Record<string, unknown>;
  return {
    schedule: typeof source.schedule === "string" ? source.schedule : defaults.schedule,
    location: typeof source.location === "string" ? source.location : defaults.location,
    whatToBring: Array.isArray(source.whatToBring)
      ? source.whatToBring.filter((item): item is string => typeof item === "string")
      : defaults.whatToBring,
    whatWeProvide: Array.isArray(source.whatWeProvide)
      ? source.whatWeProvide.filter((item): item is string => typeof item === "string")
      : defaults.whatWeProvide,
    note: typeof source.note === "string" ? source.note : defaults.note,
  };
}

function sanitizeContacts(
  value: unknown,
): Workspace["preferences"]["publicHomeConfig"]["contacts"] {
  const defaults = createDefaultPublicHomeConfig().contacts;
  if (!Array.isArray(value)) {
    return defaults;
  }
  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      type: ["wechat-group", "email", "social"].includes(String(item.type))
        ? (String(item.type) as "wechat-group" | "email" | "social")
        : "social",
      label: typeof item.label === "string" ? item.label : "联系方式",
      value: typeof item.value === "string" ? item.value : "",
      href: typeof item.href === "string" ? item.href : undefined,
      qrImage: typeof item.qrImage === "string" ? item.qrImage : undefined,
    }));
}

function sanitizeFaq(
  value: unknown,
): Workspace["preferences"]["publicHomeConfig"]["faq"] {
  const defaults = createDefaultPublicHomeConfig().faq;
  if (!Array.isArray(value)) {
    return defaults;
  }
  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      question: typeof item.question === "string" ? item.question : "",
      answer: typeof item.answer === "string" ? item.answer : "",
    }))
    .filter((item) => item.question.length > 0 && item.answer.length > 0);
}

function sanitizeHistory(
  value: unknown,
): Workspace["preferences"]["publicHomeConfig"]["history"] {
  const defaults = createDefaultPublicHomeConfig().history;
  if (!value || typeof value !== "object") {
    return defaults;
  }
  const source = value as Record<string, unknown>;
  const foundedYear = typeof source.foundedYear === "number" ? source.foundedYear : null;
  return {
    foundedYear: foundedYear === null || Number.isFinite(foundedYear) ? foundedYear : null,
    story: typeof source.story === "string" ? source.story : defaults.story,
    awards: Array.isArray(source.awards)
      ? source.awards.filter((item): item is string => typeof item === "string")
      : defaults.awards,
  };
}

function sanitizeFeeds(
  value: unknown,
): Workspace["preferences"]["publicHomeConfig"]["feeds"] {
  const defaults = createDefaultPublicHomeConfig().feeds;
  if (!value || typeof value !== "object") {
    return defaults;
  }
  const source = value as Record<string, unknown>;
  const milestones = source.milestones && typeof source.milestones === "object"
    ? source.milestones as Record<string, unknown>
    : {};
  const games = source.games && typeof source.games === "object"
    ? source.games as Record<string, unknown>
    : {};
  return {
    milestones: {
      enabled: typeof milestones.enabled === "boolean" ? milestones.enabled : defaults.milestones.enabled,
      maxCount: typeof milestones.maxCount === "number" && Number.isFinite(milestones.maxCount)
        ? Math.max(0, Math.min(20, Math.trunc(milestones.maxCount)))
        : defaults.milestones.maxCount,
    },
    games: {
      enabled: typeof games.enabled === "boolean" ? games.enabled : defaults.games.enabled,
      maxCount: typeof games.maxCount === "number" && Number.isFinite(games.maxCount)
        ? Math.max(0, Math.min(20, Math.trunc(games.maxCount)))
        : defaults.games.maxCount,
      gameTypes: Array.isArray(games.gameTypes)
        ? games.gameTypes.filter((t): t is "official" | "training" => t === "official" || t === "training")
        : defaults.games.gameTypes,
    },
  };
}

export function sanitizeWorkspace(value: unknown): Workspace {
  const fallback = createDefaultWorkspace(false);
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const source = value as Partial<Workspace>;
  const players = sanitizePlayers(Array.isArray(source.players) ? source.players : []);
  const validIds = new Set(players.map((player) => player.id));
  const scenarios = (Array.isArray(source.scenarios) ? source.scenarios : [])
    .slice(0, MAX_WORKSPACE_SCENARIOS)
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
  const milestones = sanitizeMilestones(
    Array.isArray(source.milestones) ? source.milestones : [],
  );

  return {
    version: WORKSPACE_SCHEMA_VERSION,
    players,
    scenarios,
    activeScenarioId,
    games,
    milestones,
    preferences: {
      helpDismissed: Boolean(source.preferences?.helpDismissed),
      publicHomeConfig: sanitizePublicHomeConfig(
        (source.preferences as Record<string, unknown> | undefined)?.publicHomeConfig,
      ),
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
    doubles: sanitizeGameInt(s?.doubles),
    triples: sanitizeGameInt(s?.triples),
    hr: sanitizeGameInt(s?.hr),
    rbi: sanitizeGameInt(s?.rbi),
    r: sanitizeGameInt(s?.r),
    sb: sanitizeGameInt(s?.sb),
    bb: sanitizeGameInt(s?.bb),
    hbp: sanitizeGameInt(s?.hbp),
    sf: sanitizeGameInt(s?.sf),
    so: sanitizeGameInt(s?.so),
    ip: sanitizeGameInnings(s?.ip),
    er: sanitizeNullableNumber(s?.er, 0, 99),
    soPitching: sanitizeNullableNumber(s?.soPitching, 0, 99, true),
    bbPitching: sanitizeNullableNumber(s?.bbPitching, 0, 99, true),
    hPitching: sanitizeNullableNumber(s?.hPitching, 0, 99, true),
    po: sanitizeGameInt(s?.po),
    a: sanitizeGameInt(s?.a),
    e: sanitizeGameInt(s?.e),
    w: sanitizeGameInt(s?.w),
    l: sanitizeGameInt(s?.l),
    sv: sanitizeGameInt(s?.sv),
    np: sanitizeGameInt(s?.np),
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
    innings: (Array.isArray(s.innings) ? s.innings : [])
      .slice(0, MAX_GAME_INNINGS)
      .map(sanitizeInning),
    statLines: (Array.isArray(s.statLines) ? s.statLines : [])
      .slice(0, MAX_GAME_STAT_LINES)
      .map(sanitizeStatLine)
      .filter((sl) => sl.playerId),
    note: String(s.note ?? "").trim().slice(0, 200) || undefined,
  };
}

export function sanitizeGames(value: unknown): Game[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_WORKSPACE_GAMES)
    .map(sanitizeGame)
    .filter((g): g is Game => g !== null);
}

export function sanitizeMilestone(value: unknown): Milestone | null {
  const s = value as Record<string, unknown> | null | undefined;
  if (!s?.id || !s?.date || !s?.title) return null;
  return {
    id: String(s.id),
    date: String(s.date),
    title: String(s.title).trim().slice(0, 60),
    description: String(s.description ?? "").trim().slice(0, 280),
    mediaUrl:
      s.mediaUrl && typeof s.mediaUrl === "string"
        ? s.mediaUrl.trim().slice(0, 500) || undefined
        : undefined,
  };
}

export function sanitizeMilestones(value: unknown): Milestone[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_WORKSPACE_MILESTONES)
    .map(sanitizeMilestone)
    .filter((m): m is Milestone => m !== null);
}
