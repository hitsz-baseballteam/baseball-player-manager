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

export function createDefaultPublicHomeConfig(): Workspace["preferences"]["publicHomeConfig"] {
  return {
    training: {
      schedule: "每周二、周五 18:30–21:00（以群内通知为准）",
      location: "大学城体育中心棒球场",
      whatToBring: ["运动服", "运动鞋", "饮用水"],
      whatWeProvide: ["球棒", "手套", "棒球"],
      note: "雨天会提前在微信群通知是否改室内训练。第一次来不用买装备，先体验再决定。",
    },
    contacts: [
      {
        type: "wechat-group",
        label: "棒球队微信群",
        value: "扫码入群",
        qrImage: "/team/wechat-group-qr.jpg",
      },
      {
        type: "email",
        label: "球队邮箱",
        value: "hitsz.baseball@example.com",
        href: "mailto:hitsz.baseball@example.com",
      },
      {
        type: "social",
        label: "官方公众号",
        value: "HITSZ Baseball",
        href: "https://mp.weixin.qq.com",
      },
    ],
    faq: [
      {
        question: "零基础真的可以加入吗？",
        answer: "完全可以。我们从传接球、握棒、挥棒和跑垒开始教，每次训练都有老队员带新同学。",
      },
      {
        question: "需要买装备吗？",
        answer: "第一次来不用买。球队提供球棒、手套和训练用球。确定长期加入后，再根据自己的守位慢慢添置。",
      },
      {
        question: "训练频率和强度如何？",
        answer: "常规训练每周两次，每次约两个半小时。强度会兼顾新手和老队员，训练前会分组进行。",
      },
      {
        question: "如何平衡课业和训练？",
        answer: "训练安排在晚上和周末，期末周会酌情减量。学业优先，训练自愿，但建议尽量保持节奏。",
      },
      {
        question: "女生可以加入吗？",
        answer: "当然可以。球队欢迎所有对棒球感兴趣的同学，训练和比赛都会根据情况分组。",
      },
      {
        question: "加入后一定要参加比赛吗？",
        answer: "不强制。你可以先以跟练为主，等想上场了再报名比赛。比赛机会由教练和经理统一安排。",
      },
      {
        question: "怎么联系你们？",
        answer: "可以扫码进入微信群围观，也可以发邮件到球队邮箱。招新季群里会同步最新训练安排。",
      },
    ],
    history: {
      foundedYear: 2015,
      story: "哈工大（深圳）棒球队从一群热爱棒球的在校生起步，在深圳的校园和城际赛事中逐渐成长。这里没有专业背景门槛，只有认真对待每一次传接球的伙伴。",
      awards: [
        "深圳市大学生棒球联赛 季军",
        "大学城体育文化节 优秀团队",
        "多次校际友谊赛 最佳精神风貌奖",
      ],
    },
    feeds: {
      milestones: { enabled: true, maxCount: 3 },
      games: { enabled: true, maxCount: 3, gameTypes: ["official"] },
    },
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
      publicHomeConfig: createDefaultPublicHomeConfig(),
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
