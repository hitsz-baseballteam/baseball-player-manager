// ── Base factories (no sanitizer deps) ──

import {
  DEFAULT_PLAYERS,
  POSITIONS,
  WORKSPACE_SCHEMA_VERSION,
  type Milestone,
  type PitcherRadar,
  type FielderRadar,
  type Player,
  type PlayerProfile,
  type PlayerProfileType,
  type PositionCode,
  type Scenario,
  type ScenarioAssignments,
  type Workspace,
} from "./types";

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
    armStrengthM: null,
    thirtyMeterSec: null,

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
  profile.armStrengthM = 72 + index * 2 + handedBias;
  profile.thirtyMeterSec = Number((4.6 - index * 0.05).toFixed(2));

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
    games: [],
    milestones: [],
    preferences: {
      helpDismissed,
    },
  };
}

export function cloneWorkspace(currentWorkspace: Workspace): Workspace {
  return structuredClone(currentWorkspace);
}

export function createMilestone(
  date: string,
  title: string,
  description: string,
  mediaUrl?: string,
): Milestone {
  return {
    id: createId(),
    date,
    title: title.trim().slice(0, 60),
    description: description.trim().slice(0, 280),
    mediaUrl: mediaUrl?.trim().slice(0, 500) || undefined,
  };
}
