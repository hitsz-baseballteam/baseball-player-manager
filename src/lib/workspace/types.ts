// ── Domain types and constants ──

export type PlayerStatus = "available" | "rest" | "injured" | "graduated";
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
  joinedAt?: string;
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



export type InningRecord = {
  inning: number;
  hits: number;
  runs: number;
  batters: string[];
};

export type PlayerGameStatLine = {
  playerId: string;
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

export type Milestone = {
  id: string;
  date: string;
  title: string;
  description: string;
  mediaUrl?: string;
};

export type Game = {
  id: string;
  date: string;
  opponent: string;
  gameType: "official" | "training";
  totalInnings: number;
  innings: InningRecord[];
  statLines: PlayerGameStatLine[];
  note?: string;
};

export type PlayerProfile = {
  profileType: PlayerProfileType;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  fastballTopKmh: number | null;
  fastballAvgKmh: number | null;
  armStrengthM: number | null;
  thirtyMeterSec: number | null;
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

export type PublicHomeMemberTone = "captain" | "vice" | "manager" | "active" | "open";

export type PublicHomeMember = {
  number: string;
  name: string;
  nickname?: string;
  role: string;
  note: string;
  tone: PublicHomeMemberTone;
};

export type PublicHomeConfig = {
  training: {
    schedule: string;
    location: string;
    whatToBring: string[];
    whatWeProvide: string[];
    note: string;
  };
  contacts: Array<{
    type: "wechat-group" | "email" | "social";
    label: string;
    value: string;
    href?: string;
    qrImage?: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  history: {
    foundedYear: number | null;
    story: string;
    awards: string[];
  };
  members: PublicHomeMember[];
  feeds: {
    milestones: {
      enabled: boolean;
      maxCount: number;
    };
    games: {
      enabled: boolean;
      maxCount: number;
      gameTypes: Array<"official" | "training">;
    };
  };
};

export type Workspace = {
  version: 3;
  players: Player[];
  scenarios: Scenario[];
  activeScenarioId: string;
  games: Game[];
  milestones: Milestone[];
  preferences: {
    helpDismissed: boolean;
    publicHomeConfig: PublicHomeConfig;
  };
};

export type WorkspaceExportPayload = {
  type: "workspace";
  version: 3;
  exportedAt: string;
  players: Player[];
  scenarios: Scenario[];
  games: Game[];
  milestones: Milestone[];
  activeScenarioId: string;
};

export type ScenarioExportPayload = {
  type: "scenario";
  version: 3;
  exportedAt: string;
  players: Player[];
  scenario: Scenario;
  games: Game[];
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

// ── Constants ──

export const HISTORY_LIMIT = 30;
export const WORKSPACE_SCHEMA_VERSION = 3;
export const DEFAULT_WORKSPACE_SLUG = "default";
export const MAX_WORKSPACE_PLAYERS = 200;
export const MAX_WORKSPACE_SCENARIOS = 50;
export const MAX_WORKSPACE_GAMES = 400;
export const MAX_GAME_INNINGS = 30;
export const MAX_GAME_STAT_LINES = 200;
export const MAX_WORKSPACE_MILESTONES = 200;

export const HALL_OF_FAME_MIN_DAYS = 90;
export const AWARD_MIN_PA_MULTIPLIER = 1.5;

export const SEASON_AWARD_LABELS: Record<string, string> = {
  hitKing: "安打王",
  hrKing: "本垒打王",
  rbiKing: "打点王",
  onBaseKing: "上垒王",
  strikeoutKing: "三振王",
  winsKing: "多胜王",
} as const;

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
  graduated: "毕业",
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
    target: "alertDeck",
    title: "比赛日提醒",
    body: "首页先看强提醒与建议提醒。先确认当前方案是否可用，再决定进入排阵页还是先回名册补人。",
  },
  {
    target: "commandStrip",
    title: "快捷动作区",
    body: "这里保留高频动作：自动排阵、新建方案、导入导出，以及通往名册 / 场景 / 数据中心的入口。",
  },
  {
    target: "metricsPanel",
    title: "关键指标",
    body: "可上场人数、轮休伤停、守位完成度和棒次完成度会直接告诉你今天能不能排出一套可用阵容。",
  },
  {
    target: "scenarioPanel",
    title: "当前方案摘要",
    body: "这里可以快速切换当前方案，并查看最近更新时间、方案数和当前状态；更复杂的方案管理进入战术场景页。",
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
