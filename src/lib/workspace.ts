export type PlayerStatus = "available" | "rest" | "injured";
export type Hand = "R" | "L" | "S";
export type PlayerProfileType = "pitcher" | "fielder";

export type PositionCode =
  | "P"
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "LF"
  | "CF"
  | "RF";

export type Player = {
  id: string;
  name: string;
  number: string;
  throws: Hand;
  bats: Hand;
  positions: PositionCode[];
  status: PlayerStatus;
  profile: PlayerProfile;
};

export type PitcherRadar = {
  velocity: number | null;
  command: number | null;
  movement: number | null;
  stamina: number | null;
  fielding: number | null;
  mental: number | null;
};

export type FielderRadar = {
  contact: number | null;
  power: number | null;
  speed: number | null;
  arm: number | null;
  defense: number | null;
  instinct: number | null;
};

export type PlayerProfile = {
  profileType: PlayerProfileType;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  fastballTopKmh: number | null;
  fastballAvgKmh: number | null;
  armStrengthKmh: number | null;
  sixtyMeterSec: number | null;
  pitchTypes: string[];
  scoutingSummary: string;
  radar: {
    pitcher: PitcherRadar;
    fielder: FielderRadar;
  };
};

export type ScenarioAssignments = {
  defense: Record<PositionCode, string | null>;
  lineup: Array<string | null>;
};

export type Scenario = {
  id: string;
  name: string;
  note: string;
  assignments: ScenarioAssignments;
  createdAt: string;
  updatedAt: string;
};

export type Workspace = {
  version: 2;
  players: Player[];
  scenarios: Scenario[];
  activeScenarioId: string;
  preferences: {
    helpDismissed: boolean;
  };
};

export type WorkspaceExportPayload = {
  type: "workspace";
  version: 2;
  exportedAt: string;
  players: Player[];
  scenarios: Scenario[];
  activeScenarioId: string;
};

export type ScenarioExportPayload = {
  type: "scenario";
  version: 2;
  exportedAt: string;
  players: Player[];
  scenario: Scenario;
};

export type PendingImport =
  | {
      type: "workspace";
      fileName: string;
      workspace: Workspace;
      names: string[];
      summary: string;
    }
  | {
      type: "scenario";
      fileName: string;
      scenario: Scenario;
      players: Player[];
      names: string[];
      summary: string;
    };

export const HISTORY_LIMIT = 30;
export const WORKSPACE_SCHEMA_VERSION = 2;
export const DEFAULT_WORKSPACE_SLUG = "default";

export const POSITIONS = [
  { code: "P", label: "投手", x: 50, y: 55 },
  { code: "C", label: "捕手", x: 50, y: 88 },
  { code: "1B", label: "一垒", x: 68, y: 62 },
  { code: "2B", label: "二垒", x: 59, y: 44 },
  { code: "3B", label: "三垒", x: 32, y: 62 },
  { code: "SS", label: "游击", x: 41, y: 45 },
  { code: "LF", label: "左外", x: 23, y: 25 },
  { code: "CF", label: "中外", x: 50, y: 16 },
  { code: "RF", label: "右外", x: 77, y: 25 },
] as const;

export const POSITION_CODES = POSITIONS.map(
  (position) => position.code,
) as PositionCode[];

export const DEFENSE_PRIORITY: PositionCode[] = [
  "P",
  "C",
  "SS",
  "2B",
  "3B",
  "CF",
  "1B",
  "LF",
  "RF",
];

export const STATUS_LABELS: Record<PlayerStatus, string> = {
  available: "可上场",
  rest: "轮休",
  injured: "伤停",
};

export const PROFILE_TYPE_LABELS: Record<PlayerProfileType, string> = {
  pitcher: "投手模型",
  fielder: "野手模型",
};

export const HAND_LABELS: Record<Hand, string> = {
  R: "右",
  L: "左",
  S: "双",
};

export const PITCHER_RADAR_LABELS: Record<keyof PitcherRadar, string> = {
  velocity: "球速",
  command: "控球",
  movement: "位移",
  stamina: "续航",
  fielding: "补位",
  mental: "抗压",
};

export const FIELDER_RADAR_LABELS: Record<keyof FielderRadar, string> = {
  contact: "击球",
  power: "长打",
  speed: "速度",
  arm: "臂力",
  defense: "守备",
  instinct: "球感",
};

export const GUIDE_STEPS = [
  {
    target: "scenarioPanel",
    title: "方案区",
    body: "这里管理多套阵容方案。你可以保存常规先发、守备优先或对左投等不同方案。",
  },
  {
    target: "rosterPanel",
    title: "球员池",
    body: "搜索、筛选、勾选或拖拽球员。编辑球员不会只影响当前方案，而是影响整个工作区。",
  },
  {
    target: "fieldPanel",
    title: "守备球场",
    body: "把球员拖到守位，或者先勾选球员再点守位。自动排阵也会直接覆盖当前方案的守位分配。",
  },
  {
    target: "lineupPanel",
    title: "棒次与提醒",
    body: "棒次支持拖拽排序。下方提醒区分强提醒和建议提醒，先处理强提醒再看建议提醒。",
  },
  {
    target: "helpBtn",
    title: "帮助入口",
    body: "后续忘记操作逻辑时，右上角帮助抽屉可以重新查看流程、导入导出差异和新手引导。",
  },
] as const;

export const DEFAULT_PLAYERS: Array<Omit<Player, "profile">> = [
  {
    id: "p-01",
    name: "陈浩宇",
    number: "18",
    throws: "R",
    bats: "R",
    positions: ["P", "1B"],
    status: "available",
  },
  {
    id: "p-02",
    name: "林子昂",
    number: "2",
    throws: "R",
    bats: "L",
    positions: ["C", "3B"],
    status: "available",
  },
  {
    id: "p-03",
    name: "王嘉诚",
    number: "7",
    throws: "R",
    bats: "S",
    positions: ["SS", "2B"],
    status: "available",
  },
  {
    id: "p-04",
    name: "赵铭",
    number: "11",
    throws: "L",
    bats: "L",
    positions: ["1B", "RF"],
    status: "available",
  },
  {
    id: "p-05",
    name: "周亦凡",
    number: "23",
    throws: "R",
    bats: "R",
    positions: ["CF", "LF"],
    status: "available",
  },
  {
    id: "p-06",
    name: "许天泽",
    number: "5",
    throws: "R",
    bats: "R",
    positions: ["3B", "SS"],
    status: "available",
  },
  {
    id: "p-07",
    name: "黄景澄",
    number: "9",
    throws: "L",
    bats: "L",
    positions: ["LF", "CF"],
    status: "available",
  },
  {
    id: "p-08",
    name: "李沐阳",
    number: "16",
    throws: "R",
    bats: "R",
    positions: ["RF", "P"],
    status: "available",
  },
  {
    id: "p-09",
    name: "郑一诺",
    number: "33",
    throws: "R",
    bats: "S",
    positions: ["2B", "SS"],
    status: "available",
  },
  {
    id: "p-10",
    name: "孙柏川",
    number: "12",
    throws: "R",
    bats: "L",
    positions: ["C", "1B"],
    status: "rest",
  },
  {
    id: "p-11",
    name: "唐睿",
    number: "27",
    throws: "L",
    bats: "L",
    positions: ["P", "CF"],
    status: "available",
  },
  {
    id: "p-12",
    name: "马启航",
    number: "44",
    throws: "R",
    bats: "R",
    positions: ["3B", "LF"],
    status: "injured",
  },
];

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function inferPlayerProfileType(
  positions: PositionCode[],
): PlayerProfileType {
  return positions.includes("P") ? "pitcher" : "fielder";
}

export function createEmptyPitcherRadar(): PitcherRadar {
  return {
    velocity: null,
    command: null,
    movement: null,
    stamina: null,
    fielding: null,
    mental: null,
  };
}

export function createEmptyFielderRadar(): FielderRadar {
  return {
    contact: null,
    power: null,
    speed: null,
    arm: null,
    defense: null,
    instinct: null,
  };
}

export function createDefaultPlayerProfile(
  profileType: PlayerProfileType,
): PlayerProfile {
  return {
    profileType,
    age: null,
    heightCm: null,
    weightKg: null,
    fastballTopKmh: null,
    fastballAvgKmh: null,
    armStrengthKmh: null,
    sixtyMeterSec: null,
    pitchTypes: [],
    scoutingSummary: "",
    radar: {
      pitcher: createEmptyPitcherRadar(),
      fielder: createEmptyFielderRadar(),
    },
  };
}

function createDemoPlayerProfile(
  player: Omit<Player, "profile">,
  index: number,
): PlayerProfile {
  const profileType = inferPlayerProfileType(player.positions);
  const profile = createDefaultPlayerProfile(profileType);
  const handedBias = player.throws === "L" ? 1 : 0;

  profile.age = 18 + (index % 6);
  profile.heightCm = 171 + index * 2 + handedBias;
  profile.weightKg = 67 + index * 2;
  profile.armStrengthKmh = 118 + index + handedBias;
  profile.sixtyMeterSec = Number((7.8 - index * 0.08).toFixed(2));

  profile.radar.fielder = {
    contact: 42 + (index % 5) * 6,
    power: 40 + (index % 4) * 7,
    speed: 46 + ((index + 2) % 5) * 5,
    arm: 44 + (index % 6) * 5,
    defense: 45 + ((index + 1) % 5) * 6,
    instinct: 43 + ((index + 3) % 5) * 6,
  };

  if (profileType === "pitcher") {
    profile.fastballTopKmh = 132 + index * 2 + handedBias;
    profile.fastballAvgKmh = profile.fastballTopKmh - 4;
    profile.pitchTypes = player.throws === "L"
      ? ["四缝线", "滑球", "变速球"]
      : ["四缝线", "曲球", "变速球"];
    profile.radar.pitcher = {
      velocity: 46 + (index % 5) * 7,
      command: 42 + ((index + 1) % 5) * 6,
      movement: 45 + ((index + 2) % 5) * 6,
      stamina: 44 + ((index + 3) % 5) * 6,
      fielding: 40 + ((index + 4) % 5) * 5,
      mental: 43 + (index % 5) * 6,
    };
    profile.scoutingSummary = `${player.name} 具备先发投手轮换潜力，球速带宽稳定，具备二级球种发展空间。`;
  } else {
    profile.fastballTopKmh = null;
    profile.fastballAvgKmh = null;
    profile.pitchTypes = [];
    profile.scoutingSummary = `${player.name} 具备稳定守备覆盖与跑动能力，适合作为比赛日机动型野手培养。`;
  }

  return profile;
}

export function createEmptyAssignments(): ScenarioAssignments {
  return {
    defense: Object.fromEntries(
      POSITIONS.map((position) => [position.code, null]),
    ) as Record<PositionCode, string | null>,
    lineup: Array(9).fill(null),
  };
}

export function createScenario(
  name: string,
  note = "",
  assignments = createEmptyAssignments(),
): Scenario {
  const now = new Date().toISOString();

  return {
    id: createId(),
    name,
    note,
    assignments,
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultWorkspace(helpDismissed: boolean): Workspace {
  const scenario = createScenario(
    "默认方案",
    "常规先发方案",
    createEmptyAssignments(),
  );
  const players = structuredClone(DEFAULT_PLAYERS).map((player, index) => ({
    ...player,
    profile: createDemoPlayerProfile(player, index),
  }));

  return {
    version: WORKSPACE_SCHEMA_VERSION,
    players,
    scenarios: [scenario],
    activeScenarioId: scenario.id,
    preferences: {
      helpDismissed,
    },
  };
}

export function migrateLegacyState(legacyState: unknown): Workspace {
  const source = legacyState as {
    players?: unknown[];
    assignments?: ScenarioAssignments;
  };

  const players = sanitizePlayers(Array.isArray(source?.players) ? source.players : []);
  const assignments = sanitizeAssignments(
    source?.assignments,
    new Set(players.map((player) => player.id)),
  );
  const scenario = createScenario("默认方案", "由 v1 数据迁移", assignments);

  return sanitizeWorkspace({
    version: WORKSPACE_SCHEMA_VERSION,
    players,
    scenarios: [scenario],
    activeScenarioId: scenario.id,
    preferences: {
      helpDismissed: false,
    },
  });
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

  return {
    version: WORKSPACE_SCHEMA_VERSION,
    players,
    scenarios,
    activeScenarioId,
    preferences: {
      helpDismissed: Boolean(source.preferences?.helpDismissed),
    },
  };
}

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
        status: STATUS_LABELS[player.status as PlayerStatus]
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
    armStrengthKmh: sanitizeNullableNumber(source?.armStrengthKmh, 60, 180),
    sixtyMeterSec: sanitizeNullableNumber(source?.sixtyMeterSec, 5, 12),
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

export function normalizeHand(value: unknown): Hand {
  return typeof value === "string" && value in HAND_LABELS
    ? (value as Hand)
    : "R";
}

function sanitizeNullableNumber(
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

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function cloneWorkspace(currentWorkspace: Workspace): Workspace {
  return structuredClone(currentWorkspace);
}

export function getActiveScenario(workspace: Workspace): Scenario {
  return (
    workspace.scenarios.find(
      (scenario) => scenario.id === workspace.activeScenarioId,
    ) ?? workspace.scenarios[0]
  );
}

export function getPlayer(workspace: Workspace, id: string | null | undefined) {
  if (!id) {
    return null;
  }

  return workspace.players.find((player) => player.id === id) ?? null;
}

export function getPlayerAssignmentState(
  scenario: Scenario,
  playerId: string,
) {
  return {
    defense: Object.values(scenario.assignments.defense).includes(playerId),
    lineup: scenario.assignments.lineup.includes(playerId),
  };
}

export function createUniqueScenarioName(
  baseName: string,
  scenarios: Scenario[],
  suffix = "",
) {
  const trimmed = (baseName || "未命名方案").trim().slice(0, 24);
  const existingNames = new Set(scenarios.map((scenario) => scenario.name));
  const baseCandidate = suffix ? `${trimmed}${suffix}` : trimmed;

  if (!existingNames.has(baseCandidate)) {
    return baseCandidate;
  }

  let index = 2;
  while (existingNames.has(`${baseCandidate} ${index}`)) {
    index += 1;
  }

  return `${baseCandidate} ${index}`;
}

export function removePlayersFromWorkspace(draft: Workspace, ids: string[]) {
  const idSet = new Set(ids);
  draft.players = draft.players.filter((player) => !idSet.has(player.id));
  draft.scenarios.forEach((scenario) => {
    POSITION_CODES.forEach((position) => {
      if (scenario.assignments.defense[position] && idSet.has(scenario.assignments.defense[position]!)) {
        scenario.assignments.defense[position] = null;
      }
    });
    scenario.assignments.lineup = scenario.assignments.lineup.map((playerId) =>
      playerId && idSet.has(playerId) ? null : playerId,
    );
    scenario.updatedAt = new Date().toISOString();
  });
}

export function getPreferredBattingSlots(
  player: Player,
  assignedPosition?: PositionCode,
) {
  const isBattery = assignedPosition === "P" || assignedPosition === "C";
  if (isBattery) {
    return [7, 8, 5, 6, 4, 3, 2, 1, 0];
  }
  if (player.bats === "S") {
    return [0, 1, 5, 2, 3, 4, 6, 7, 8];
  }
  if (player.bats === "L") {
    return [1, 4, 6, 0, 2, 3, 5, 7, 8];
  }
  return [2, 3, 7, 8, 0, 1, 4, 5, 6];
}

export function buildAutoScenario(
  workspace: Workspace,
  currentScenario: Scenario,
): Scenario {
  const availablePlayers = workspace.players.filter(
    (player) => player.status === "available",
  );
  const remaining = [...availablePlayers];
  const defense = createEmptyAssignments().defense;

  DEFENSE_PRIORITY.forEach((positionCode) => {
    const candidates = remaining
      .filter((player) => player.positions.includes(positionCode))
      .sort((a, b) => {
        const aPrimary = a.positions[0] === positionCode ? 1 : 0;
        const bPrimary = b.positions[0] === positionCode ? 1 : 0;
        if (aPrimary !== bPrimary) {
          return bPrimary - aPrimary;
        }
        if (a.positions.length !== b.positions.length) {
          return a.positions.length - b.positions.length;
        }
        return a.number.localeCompare(b.number);
      });

    const chosen = candidates[0];
    if (!chosen) {
      return;
    }

    defense[positionCode] = chosen.id;
    const chosenIndex = remaining.findIndex((player) => player.id === chosen.id);
    if (chosenIndex >= 0) {
      remaining.splice(chosenIndex, 1);
    }
  });

  const lineup: Array<string | null> = Array(9).fill(null);
  const assignedPlayerIds = Object.values(defense).filter(
    (playerId): playerId is string => Boolean(playerId),
  );
  const defenseByPlayer = Object.fromEntries(
    Object.entries(defense)
      .filter((entry): entry is [PositionCode, string] => Boolean(entry[1]))
      .map(([position, playerId]) => [playerId, position as PositionCode]),
  ) as Record<string, PositionCode>;

  assignedPlayerIds.forEach((playerId) => {
    const player = getPlayer(workspace, playerId);
    if (!player) {
      return;
    }

    const preferredSlots = getPreferredBattingSlots(
      player,
      defenseByPlayer[playerId],
    );
    const targetSlot = preferredSlots.find((slot) => lineup[slot] === null);
    const fallbackSlot = lineup.findIndex((slot) => slot === null);
    const finalSlot = targetSlot ?? fallbackSlot;

    if (finalSlot >= 0) {
      lineup[finalSlot] = playerId;
    }
  });

  return {
    ...currentScenario,
    assignments: {
      defense,
      lineup,
    },
  };
}

export function analyzeScenarioWarnings(
  workspace: Workspace,
  scenario: Scenario,
) {
  const critical: string[] = [];
  const advisory: string[] = [];
  const defenseEntries = Object.entries(scenario.assignments.defense) as Array<
    [PositionCode, string | null]
  >;
  const defenseIds = defenseEntries
    .map(([, playerId]) => playerId)
    .filter((playerId): playerId is string => Boolean(playerId));
  const lineupIds = scenario.assignments.lineup.filter(
    (playerId): playerId is string => Boolean(playerId),
  );
  const uniqueAssignedIds = Array.from(new Set([...defenseIds, ...lineupIds]));
  const missingPositions = defenseEntries
    .filter(([, playerId]) => !playerId)
    .map(([position]) => position);
  const repeatedDefense = findRepeatedIds(defenseIds).map((id) =>
    formatPlayerName(workspace, id),
  );
  const unavailablePlayers = uniqueAssignedIds
    .map((id) => getPlayer(workspace, id))
    .filter(
      (player): player is Player =>
        Boolean(player && player.status !== "available"),
    );

  if (missingPositions.length) {
    critical.push(`守位未满：${missingPositions.join("、")}`);
  }
  if (lineupIds.length < 9) {
    critical.push(`棒次未满：还缺 ${9 - lineupIds.length} 人`);
  }
  if (repeatedDefense.length) {
    critical.push(`同一球员重复占用守位：${repeatedDefense.join("、")}`);
  }
  if (unavailablePlayers.length) {
    critical.push(
      `非可上场球员已进入阵容：${unavailablePlayers
        .map((player) => `${player.name}（${STATUS_LABELS[player.status]}）`)
        .join("、")}`,
    );
  }

  defenseEntries.forEach(([position, playerId]) => {
    const player = getPlayer(workspace, playerId);
    if (player && !player.positions.includes(position)) {
      advisory.push(
        `${player.name} 当前被放在 ${position}，但他的可守位置不包含该守位`,
      );
    }
  });

  scenario.assignments.lineup.slice(0, 2).forEach((playerId, index) => {
    if (!playerId) {
      return;
    }

    const defensePosition = defenseEntries.find(
      ([, assignedId]) => assignedId === playerId,
    )?.[0];
    if (defensePosition === "P" || defensePosition === "C") {
      advisory.push(
        `第 ${index + 1} 棒是 ${defensePosition}，建议确认是否需要把投手或捕手前置`,
      );
    }
  });

  const injuredPlayers = uniqueAssignedIds
    .map((id) => getPlayer(workspace, id))
    .filter((player): player is Player => Boolean(player && player.status === "injured"));
  if (injuredPlayers.length) {
    advisory.push(`伤停球员仍被安排：${injuredPlayers.map((player) => player.name).join("、")}`);
  }

  const restPlayers = uniqueAssignedIds
    .map((id) => getPlayer(workspace, id))
    .filter((player): player is Player => Boolean(player && player.status === "rest"));
  if (restPlayers.length) {
    advisory.push(`轮休球员仍被安排：${restPlayers.map((player) => player.name).join("、")}`);
  }

  return { critical, advisory };
}

export function prepareImport(
  workspace: Workspace,
  payload: unknown,
  fileName: string,
): PendingImport {
  const source = payload as {
    type?: string;
    version?: number;
    players?: unknown[];
    scenarios?: unknown[];
    activeScenarioId?: string;
    scenario?: unknown;
  };

  if (source?.type === "workspace" && source?.version === WORKSPACE_SCHEMA_VERSION) {
    const candidate = sanitizeWorkspace({
      version: WORKSPACE_SCHEMA_VERSION,
      players: source.players,
      scenarios: source.scenarios,
      activeScenarioId: source.activeScenarioId,
      preferences: workspace.preferences,
    });

    return {
      type: "workspace",
      fileName,
      workspace: candidate,
      names: candidate.scenarios.map((scenario) => scenario.name),
      summary: `将用 ${fileName} 替换当前工作区。帮助已读状态会保留在本地。`,
    };
  }

  if (source?.type === "scenario" && source?.version === WORKSPACE_SCHEMA_VERSION) {
    const importedPlayers = sanitizePlayers(
      Array.isArray(source.players) ? source.players : [],
    );
    const importedScenario = sanitizeScenario(
      source.scenario,
      new Set(importedPlayers.map((player) => player.id)),
    );

    if (!importedScenario) {
      throw new Error("invalid scenario payload");
    }

    return {
      type: "scenario",
      fileName,
      scenario: importedScenario,
      players: importedPlayers,
      names: [importedScenario.name],
      summary: `将把 ${fileName} 追加为新方案，并合并它引用到的球员。`,
    };
  }

  throw new Error("unsupported payload");
}

export function formatDateTime(isoString: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function timestampFilePart() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "-",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
}

export function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function findRepeatedIds(ids: string[]) {
  const counts = ids.reduce((map, id) => {
    map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
}

function formatPlayerName(workspace: Workspace, id: string) {
  const player = getPlayer(workspace, id);
  return player ? player.name : "未知球员";
}
