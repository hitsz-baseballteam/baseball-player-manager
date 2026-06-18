/**
 * Seed the workspace with rich demo data to showcase the Data Center
 * and Hall of Fame features with comprehensive stats across 3 seasons.
 *
 * Run: npx tsx scripts/seed-demo-data.ts
 */

import { Pool } from "pg";
import { createDefaultWorkspace, type Workspace } from "../src/lib/workspace";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });

// ── Helper types ──

type StatTemplate = {
  playerId: string;
  pa: number; ab: number; h: number; doubles: number; triples: number;
  hr: number; rbi: number; r: number; sb: number; bb: number; hbp: number; sf: number; so: number;
  ip: number | null; er: number | null;
  soPitching: number | null; bbPitching: number | null; hPitching: number | null;
  po: number; a: number; e: number;
  w: number; l: number; sv: number; np: number;
};

function makeSl(
  playerId: string,
  batting: Partial<StatTemplate> = {},
  pitching: Partial<StatTemplate> = {},
): StatTemplate {
  return {
    playerId,
    pa: 4, ab: 4, h: 1, doubles: 0, triples: 0, hr: 0, rbi: 0, r: 0, sb: 0, bb: 0, hbp: 0, sf: 0, so: 1,
    ip: null, er: null, soPitching: null, bbPitching: null, hPitching: null,
    po: 2, a: 1, e: 0,
    w: 0, l: 0, sv: 0, np: 0,
    ...batting,
    ...pitching,
  };
}

type GameTemplate = {
  date: string;
  opponent: string;
  gameType: "official" | "training";
  statLines: StatTemplate[];
};

async function seed() {
  const ws = createDefaultWorkspace(true);
  const now = new Date();

  // ═══════════════════════════════════════════════════════════════
  // 1. Expand roster — add 3 more players for richer data
  // ═══════════════════════════════════════════════════════════════

  ws.players.push(
    {
      id: "p-13",
      name: "林泽宇",
      number: "8",
      throws: "R",
      bats: "R",
      positions: ["CF", "LF"],
      status: "available",
      profile: {
        profileType: "fielder",
        age: 20,
        heightCm: 178,
        weightKg: 72,
        fastballTopKmh: null,
        fastballAvgKmh: null,
        armStrengthM: 75,
        thirtyMeterSec: 4.15,
        pitchTypes: [],
        scoutingSummary: "外场接手范围大，跑垒速度极快，是球队的盗垒王候选人。",
        radar: {
          pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
          fielder: { contact: 55, power: 40, speed: 75, arm: 60, defense: 65, instinct: 55 },
        },
      },
    },
    {
      id: "p-14",
      name: "吴昊天",
      number: "21",
      throws: "L",
      bats: "L",
      positions: ["P"],
      status: "available",
      profile: {
        profileType: "pitcher",
        age: 19,
        heightCm: 188,
        weightKg: 85,
        fastballTopKmh: 132,
        fastballAvgKmh: 126,
        armStrengthM: 88,
        thirtyMeterSec: 4.35,
        pitchTypes: ["四缝线", "曲球", "指叉球"],
        scoutingSummary: "左投优势明显，指叉球是主要决胜球，控球稳定但续航需提升。",
        radar: {
          pitcher: { velocity: 65, command: 60, movement: 55, stamina: 35, fielding: 45, mental: 50 },
          fielder: { contact: null, power: null, speed: null, arm: null, defense: null, instinct: null },
        },
      },
    },
    {
      id: "p-15",
      name: "谢远航",
      number: "55",
      throws: "R",
      bats: "S",
      positions: ["1B", "3B"],
      status: "available",
      profile: {
        profileType: "fielder",
        age: 22,
        heightCm: 182,
        weightKg: 90,
        fastballTopKmh: null,
        fastballAvgKmh: null,
        armStrengthM: 82,
        thirtyMeterSec: 4.55,
        pitchTypes: [],
        scoutingSummary: "左右开弓型打者，长打火力突出，一三垒都能守。",
        radar: {
          pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
          fielder: { contact: 50, power: 70, speed: 40, arm: 65, defense: 50, instinct: 45 },
        },
      },
    },
  );

  // ═══════════════════════════════════════════════════════════════
  // 2. Set player profiles for existing players (radar data)
  // ═══════════════════════════════════════════════════════════════

  const profileMap: Record<string, Partial<typeof ws.players[0]["profile"]>> = {
    "p-01": {
      profileType: "pitcher", age: 22, heightCm: 185, weightKg: 80,
      fastballTopKmh: 138, fastballAvgKmh: 130,
      armStrengthM: 90, thirtyMeterSec: 4.2,
      pitchTypes: ["四缝线", "滑球", "变速球", "曲球"],
      scoutingSummary: "王牌投手兼一垒手，球速和控球俱佳，变速球是主要决胜球。",
      radar: {
        pitcher: { velocity: 70, command: 65, movement: 60, stamina: 75, fielding: 55, mental: 70 },
        fielder: { contact: 55, power: 65, speed: 45, arm: 70, defense: 55, instinct: 50 },
      },
    },
    "p-02": {
      profileType: "fielder", age: 21, heightCm: 175, weightKg: 68,
      armStrengthM: 72, thirtyMeterSec: 4.3,
      pitchTypes: [],
      scoutingSummary: "主力捕手，臂力精准，善于配球和指挥内野。",
      radar: {
        pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: { contact: 50, power: 45, speed: 50, arm: 75, defense: 70, instinct: 65 },
      },
    },
    "p-03": {
      profileType: "fielder", age: 21, heightCm: 178, weightKg: 72,
      armStrengthM: 78, thirtyMeterSec: 3.95,
      pitchTypes: [],
      scoutingSummary: "游击手，攻守兼备，左右开弓，球队的安打制造机。",
      radar: {
        pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: { contact: 70, power: 50, speed: 65, arm: 60, defense: 65, instinct: 70 },
      },
    },
    "p-04": {
      profileType: "fielder", age: 22, heightCm: 183, weightKg: 82,
      armStrengthM: 80, thirtyMeterSec: 4.45,
      pitchTypes: [],
      scoutingSummary: "左打重炮手，一垒和外场都能胜任。",
      radar: {
        pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: { contact: 45, power: 75, speed: 40, arm: 55, defense: 45, instinct: 45 },
      },
    },
    "p-05": {
      profileType: "fielder", age: 20, heightCm: 180, weightKg: 70,
      armStrengthM: 74, thirtyMeterSec: 3.85,
      pitchTypes: [],
      scoutingSummary: "中坚手，速度一流，守备范围极大，打击稳定。",
      radar: {
        pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: { contact: 60, power: 45, speed: 80, arm: 60, defense: 75, instinct: 60 },
      },
    },
    "p-08": {
      profileType: "pitcher", age: 20, heightCm: 182, weightKg: 76,
      fastballTopKmh: 135, fastballAvgKmh: 128,
      armStrengthM: 85, thirtyMeterSec: 4.15,
      pitchTypes: ["四缝线", "滑球"],
      scoutingSummary: "二刀流选手，外场和投手都能胜任，后援投手角色。",
      radar: {
        pitcher: { velocity: 65, command: 50, movement: 55, stamina: 40, fielding: 55, mental: 50 },
        fielder: { contact: 50, power: 50, speed: 55, arm: 75, defense: 55, instinct: 50 },
      },
    },
    "p-11": {
      profileType: "pitcher", age: 20, heightCm: 180, weightKg: 73,
      fastballTopKmh: 134, fastballAvgKmh: 127,
      armStrengthM: 82, thirtyMeterSec: 4.25,
      pitchTypes: ["四缝线", "变速球", "滑球"],
      scoutingSummary: "左投先发/后援皆可，中坚外场也能客串。",
      radar: {
        pitcher: { velocity: 60, command: 55, movement: 60, stamina: 55, fielding: 55, mental: 55 },
        fielder: { contact: 40, power: 35, speed: 55, arm: 60, defense: 50, instinct: 50 },
      },
    },
    "p-14": {
      profileType: "pitcher", age: 19, heightCm: 188, weightKg: 85,
      fastballTopKmh: 132, fastballAvgKmh: 126,
      armStrengthM: 88, thirtyMeterSec: 4.35,
      pitchTypes: ["四缝线", "曲球", "指叉球"],
      scoutingSummary: "左投优势明显，指叉球是主要决胜球，控球稳定但续航需提升。",
      radar: {
        pitcher: { velocity: 65, command: 60, movement: 55, stamina: 35, fielding: 45, mental: 50 },
        fielder: { contact: null, power: null, speed: null, arm: null, defense: null, instinct: null },
      },
    },
  };

  // Apply profiles
  for (const p of ws.players) {
    const overrides = profileMap[p.id];
    if (overrides) {
      p.profile = { ...p.profile, ...overrides } as typeof p.profile;
    }
  }

  // Set default fielder profiles for remaining players
  const defaultFielderProfiles: Record<string, { scoutingSummary: string; radar: typeof ws.players[0]["profile"]["radar"] }> = {
    "p-06": {
      scoutingSummary: "三垒游击双修，铁壁防守，关键时刻打击有惊喜。",
      radar: {
        pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: { contact: 45, power: 55, speed: 50, arm: 65, defense: 70, instinct: 55 },
      },
    },
    "p-07": {
      scoutingSummary: "左打外场手，上垒率高，守备稳健。",
      radar: {
        pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: { contact: 50, power: 40, speed: 60, arm: 50, defense: 55, instinct: 55 },
      },
    },
    "p-09": {
      scoutingSummary: "二游全能，左右开弓，速度与技巧兼备。",
      radar: {
        pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: { contact: 60, power: 40, speed: 70, arm: 55, defense: 60, instinct: 65 },
      },
    },
    "p-10": {
      scoutingSummary: "捕手兼一垒，经验丰富的老将，已毕业。",
      radar: {
        pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: { contact: 50, power: 50, speed: 35, arm: 60, defense: 60, instinct: 60 },
      },
    },
    "p-12": {
      scoutingSummary: "三垒左外双修，目前在伤病恢复期。",
      radar: {
        pitcher: { velocity: null, command: null, movement: null, stamina: null, fielding: null, mental: null },
        fielder: { contact: 45, power: 50, speed: 55, arm: 55, defense: 50, instinct: 45 },
      },
    },
  };

  for (const p of ws.players) {
    if (!profileMap[p.id] && defaultFielderProfiles[p.id]) {
      const df = defaultFielderProfiles[p.id];
      p.profile.profileType = "fielder";
      p.profile.scoutingSummary = df.scoutingSummary;
      p.profile.radar = df.radar;
      // Keep existing physical attributes from defaults
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Set joinedAt dates for Hall of Fame eligibility
  // ═══════════════════════════════════════════════════════════════

  const joinedOld2Y = new Date(now);
  joinedOld2Y.setFullYear(joinedOld2Y.getFullYear() - 2);

  const joinedOld3Y = new Date(now);
  joinedOld3Y.setFullYear(joinedOld3Y.getFullYear() - 3);

  const joinedOld4Y = new Date(now);
  joinedOld4Y.setFullYear(joinedOld4Y.getFullYear() - 4);

  const joinedRecent1M = new Date(now);
  joinedRecent1M.setMonth(joinedRecent1M.getMonth() - 1);

  const joinedRecent2W = new Date(now);
  joinedRecent2W.setDate(joinedRecent2W.getDate() - 14);

  // HoF ELIGIBLE (joined 90+ days ago + at least 1 official game)
  // p-01~p-11 (except p-12): joined 2 years ago → eligible
  // p-10 (孙柏川): graduated 4 years ago → eligible with "graduated" badge
  // p-13 (林泽宇): joined 3 years ago → eligible, speed demon
  // p-14 (吴昊天): joined 2 years ago → eligible, pitcher

  // NOT eligible:
  // p-12 (马启航): joined only 1 month ago → < 90 days
  // p-15 (谢远航): joined 2 weeks ago → < 90 days

  for (const p of ws.players) {
    if (p.id === "p-10") {
      p.joinedAt = joinedOld4Y.toISOString();
      p.status = "graduated";
    } else if (p.id === "p-12") {
      p.joinedAt = joinedRecent1M.toISOString();
      p.status = "injured";
    } else if (p.id === "p-15") {
      p.joinedAt = joinedRecent2W.toISOString();
    } else if (p.id === "p-13") {
      p.joinedAt = joinedOld3Y.toISOString();
    } else {
      p.joinedAt = joinedOld2Y.toISOString();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Generate games — 3 seasons, ~20+ official + training games
  //
  // Award design:
  //   2024: H-king=王嘉诚(p-03), HR-king=赵铭(p-04), RBI-king=陈浩宇(p-01)
  //   2025: H-king=郑一诺(p-09), HR-king=陈浩宇(p-01), RBI-king=王嘉诚(p-03)
  //   2026: H-king=周亦凡(p-05), HR-king=谢远航(p-15), RBI-king=许天泽(p-06)
  //   SO-king(all-time)=陈浩宇(p-01), W-king=陈浩宇(p-01)
  //   AVG-king(all-time)=王嘉诚(p-03)
  // ═══════════════════════════════════════════════════════════════

  // -- 2024 season: 6 official games --
  const season2024: GameTemplate[] = [
    {
      date: "2024-03-23", opponent: "深圳大学", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 2, doubles: 1, rbi: 2, r: 1 }, { ip: 5, er: 2, soPitching: 5, w: 1, np: 76 }),
        makeSl("p-02", { h: 1, bb: 1, r: 1 }, { po: 5, a: 1 }),
        makeSl("p-03", { h: 3, doubles: 1, hr: 1, rbi: 3, r: 3 }, { a: 3 }),
        makeSl("p-04", { h: 2, hr: 1, rbi: 2, r: 1 }, {}),
        makeSl("p-05", { h: 1, sb: 1, r: 1 }, {}),
        makeSl("p-06", { h: 1, r: 0 }, { po: 2, a: 2 }),
        makeSl("p-07", { h: 2, rbi: 1 }, {}),
        makeSl("p-08", { h: 0, so: 2 }, { po: 1 }),
        makeSl("p-09", { h: 1, bb: 1, r: 1 }, { a: 2 }),
        makeSl("p-10", { h: 2, doubles: 1, rbi: 2 }, { po: 3, a: 1 }),
        makeSl("p-13", { h: 2, sb: 2, r: 2 }, {}),
      ],
    },
    {
      date: "2024-04-12", opponent: "南方科技大学", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 3, hr: 1, rbi: 4, r: 2 }, { ip: 6, er: 1, soPitching: 7, w: 1, np: 89 }),
        makeSl("p-02", { h: 2, rbi: 1, bb: 1 }, { po: 4, a: 2 }),
        makeSl("p-03", { h: 4, doubles: 2, rbi: 2, r: 3, sb: 1 }, { a: 3 }),
        makeSl("p-04", { h: 2, hr: 1, rbi: 3, r: 1 }, {}),
        makeSl("p-05", { h: 3, triples: 1, rbi: 2, r: 2 }, {}),
        makeSl("p-06", { h: 1, bb: 2, r: 1 }, { po: 3, a: 2, e: 1 }),
        makeSl("p-07", { h: 1, so: 1 }, {}),
        makeSl("p-08", { h: 1, r: 1 }, { ip: 2, er: 0, sv: 1, np: 24 }),
        makeSl("p-09", { h: 3, rbi: 2, r: 2 }, { a: 3 }),
        makeSl("p-10", { h: 1, rbi: 1, bb: 1 }, { po: 3 }),
        makeSl("p-11", { h: 0 }, { ip: 1, er: 0, soPitching: 1, np: 11 }),
        makeSl("p-13", { h: 3, sb: 2, r: 3 }, {}),
      ],
    },
    {
      date: "2024-05-08", opponent: "暨南大学深圳校区", gameType: "official",
      statLines: [
        makeSl("p-11", { h: 0 }, { ip: 6, er: 3, soPitching: 4, bbPitching: 2, hPitching: 6, w: 0, l: 1, np: 82 }),
        makeSl("p-02", { h: 2, hr: 1, rbi: 2, r: 1 }, { po: 6, a: 1 }),
        makeSl("p-03", { h: 3, doubles: 1, rbi: 3, r: 2 }, { a: 4 }),
        makeSl("p-04", { h: 3, hr: 2, rbi: 5, r: 3 }, {}),
        makeSl("p-05", { h: 2, rbi: 1, sb: 1 }, {}),
        makeSl("p-06", { h: 1, rbi: 1 }, { po: 1, a: 3 }),
        makeSl("p-07", { h: 2, rbi: 2, bb: 1 }, {}),
        makeSl("p-08", { h: 1, so: 2 }, { ip: 2, er: 2, soPitching: 1, np: 33 }),
        makeSl("p-09", { h: 2, doubles: 1, r: 1 }, { a: 2, e: 1 }),
        makeSl("p-10", { h: 1, r: 1 }, { po: 5 }),
        makeSl("p-13", { h: 1, sb: 1, bb: 1, so: 1 }, {}),
        makeSl("p-14", { h: 0 }, { ip: 1, er: 1, soPitching: 1, np: 16 }),
      ],
    },
    {
      date: "2024-06-15", opponent: "中山大学（深圳）", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 2, rbi: 1, r: 1 }, { ip: 7, er: 0, soPitching: 8, w: 1, np: 97 }),
        makeSl("p-02", { h: 3, hr: 1, rbi: 3, r: 2 }, { po: 5, a: 1 }),
        makeSl("p-03", { h: 4, doubles: 1, triples: 1, rbi: 2, r: 3 }, { a: 3 }),
        makeSl("p-04", { h: 1, bb: 2, r: 1 }, {}),
        makeSl("p-05", { h: 3, hr: 1, rbi: 4, r: 2 }, {}),
        makeSl("p-06", { h: 2, rbi: 1, r: 1 }, { a: 2 }),
        makeSl("p-07", { h: 2, sb: 1 }, {}),
        makeSl("p-08", { h: 1, doubles: 1, rbi: 1 }, { ip: 1, er: 0, sv: 1, np: 13 }),
        makeSl("p-09", { h: 2, r: 1, bb: 1 }, { a: 3 }),
        makeSl("p-10", { h: 1, so: 1 }, { po: 4 }),
        makeSl("p-13", { h: 2, sb: 1, r: 2 }, {}),
      ],
    },
    {
      date: "2024-09-28", opponent: "香港中文大学（深圳）", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 3, hr: 1, rbi: 4, r: 3, doubles: 1 }, { ip: 6, er: 2, soPitching: 9, w: 1, np: 94 }),
        makeSl("p-02", { h: 2, rbi: 1, r: 1 }, { po: 3, a: 2 }),
        makeSl("p-03", { h: 3, hr: 1, doubles: 1, rbi: 3, r: 2 }, { a: 5 }),
        makeSl("p-04", { h: 2, hr: 1, rbi: 2, r: 1, bb: 1 }, {}),
        makeSl("p-05", { h: 3, doubles: 1, rbi: 2, r: 2, sb: 1 }, {}),
        makeSl("p-06", { h: 2, rbi: 2 }, { po: 2, a: 2 }),
        makeSl("p-07", { h: 1, bb: 1 }, {}),
        makeSl("p-08", { h: 1, r: 1 }, { po: 2 }),
        makeSl("p-09", { h: 2, rbi: 1, r: 1 }, { a: 4 }),
        makeSl("p-10", { h: 2, doubles: 1, rbi: 2, r: 1 }, { po: 3 }),
        makeSl("p-13", { h: 3, r: 2, sb: 2 }, {}),
        makeSl("p-14", { h: 0 }, { ip: 1, er: 0, soPitching: 2, np: 15 }),
      ],
    },
    {
      date: "2024-10-20", opponent: "华南理工大学", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 1, bb: 1, rbi: 1, r: 0 }, { ip: 5.2, er: 1, soPitching: 6, w: 1, np: 81 }),
        makeSl("p-02", { h: 2, hr: 1, rbi: 3, r: 2 }, { po: 5, a: 2 }),
        makeSl("p-03", { h: 3, doubles: 1, rbi: 1, r: 2 }, { a: 4 }),
        makeSl("p-04", { h: 3, hr: 1, rbi: 3, r: 2 }, {}),
        makeSl("p-05", { h: 2, rbi: 1, sb: 1 }, {}),
        makeSl("p-06", { h: 2, rbi: 2, r: 1 }, { po: 2, a: 3 }),
        makeSl("p-07", { h: 2, r: 1 }, {}),
        makeSl("p-08", { h: 0, so: 2 }, { ip: 2.1, er: 1, soPitching: 2, np: 30 }),
        makeSl("p-09", { h: 3, doubles: 1, rbi: 1, r: 2, sb: 1 }, { a: 3 }),
        makeSl("p-10", { h: 1, rbi: 1 }, { po: 4, e: 1 }),
        makeSl("p-11", { h: 0, bb: 1 }, {}),
        makeSl("p-13", { h: 2, r: 1, sb: 1 }, {}),
      ],
    },
  ];

  // -- 2025 season: 7 official + 2 training --
  const season2025: GameTemplate[] = [
    {
      date: "2025-03-15", opponent: "深圳大学", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 3, hr: 1, doubles: 1, rbi: 3, r: 2 }, { ip: 5, er: 1, soPitching: 6, w: 1, np: 78 }),
        makeSl("p-02", { h: 2, rbi: 2, bb: 1, r: 1 }, { po: 5, a: 2 }),
        makeSl("p-03", { h: 4, doubles: 2, hr: 1, rbi: 4, r: 3 }, { po: 3, a: 4 }),
        makeSl("p-04", { h: 3, bb: 2, rbi: 1, r: 2 }, {}),
        makeSl("p-05", { h: 2, hr: 1, rbi: 2, r: 2, sb: 1 }, {}),
        makeSl("p-06", { h: 1, bb: 1, r: 1 }, { po: 1, a: 3 }),
        makeSl("p-07", { h: 2, rbi: 1 }, {}),
        makeSl("p-08", { h: 1, so: 2 }, { po: 2 }),
        makeSl("p-09", { h: 4, doubles: 1, rbi: 2, r: 2, sb: 1 }, { a: 2 }),
        makeSl("p-13", { h: 1, sb: 1, so: 1 }, {}),
        makeSl("p-14", { h: 0 }, { ip: 2, er: 0, soPitching: 2, np: 26 }),
      ],
    },
    {
      date: "2025-04-02", opponent: "南方科技大学", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 2, doubles: 1, rbi: 1, r: 1 }, { ip: 6, er: 2, soPitching: 8, w: 1, np: 95 }),
        makeSl("p-02", { h: 1, bb: 2, r: 2 }, { po: 4, a: 1 }),
        makeSl("p-03", { h: 3, hr: 1, rbi: 3, r: 2 }, { a: 2 }),
        makeSl("p-04", { h: 2, hr: 1, rbi: 2, r: 1 }, {}),
        makeSl("p-05", { h: 1, sb: 1, r: 1 }, {}),
        makeSl("p-06", { h: 2, doubles: 1, rbi: 1 }, { po: 2, a: 2 }),
        makeSl("p-07", { h: 0, so: 2, bb: 1 }, {}),
        makeSl("p-08", { h: 1, r: 1 }, {}),
        makeSl("p-09", { h: 2, doubles: 1, rbi: 1, bb: 1, sb: 1 }, { a: 3, e: 1 }),
        makeSl("p-11", { h: 1, so: 3 }, { ip: 2, er: 1, soPitching: 2, np: 30 }),
        makeSl("p-13", { h: 3, r: 2, sb: 2 }, {}),
      ],
    },
    {
      date: "2025-04-20", opponent: "暨南大学", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 1, bb: 1, r: 1 }, { ip: 7, er: 0, soPitching: 9, w: 1, np: 102 }),
        makeSl("p-02", { h: 3, hr: 1, rbi: 2, r: 2 }, { po: 5, a: 1 }),
        makeSl("p-03", { h: 2, rbi: 1, r: 1 }, { a: 3 }),
        makeSl("p-04", { h: 1, bb: 1, rbi: 1 }, {}),
        makeSl("p-05", { h: 3, doubles: 1, rbi: 3, r: 2 }, {}),
        makeSl("p-06", { h: 2, hr: 1, rbi: 2, r: 1 }, { po: 3, a: 1 }),
        makeSl("p-07", { h: 2, sb: 2, r: 2 }, {}),
        makeSl("p-08", { h: 0, bb: 1, so: 1 }, {}),
        makeSl("p-09", { h: 3, hr: 1, rbi: 3, r: 2, sb: 1 }, { a: 2 }),
        makeSl("p-11", { h: 0 }, { ip: 1, er: 0, soPitching: 1, sv: 1, np: 12 }),
        makeSl("p-13", { h: 2, sb: 1, r: 1 }, {}),
      ],
    },
    {
      date: "2025-05-10", opponent: "中山大学", gameType: "official",
      statLines: [
        makeSl("p-11", { h: 0 }, { ip: 6, er: 3, soPitching: 5, bbPitching: 2, hPitching: 5, w: 0, l: 1, np: 88 }),
        makeSl("p-02", { h: 1, rbi: 1 }, { po: 6, a: 2 }),
        makeSl("p-03", { h: 2, r: 2, sb: 1 }, { a: 4 }),
        makeSl("p-04", { h: 3, hr: 1, rbi: 3, r: 2 }, {}),
        makeSl("p-05", { h: 2, rbi: 1 }, {}),
        makeSl("p-06", { h: 1, bb: 2, r: 1 }, { po: 1, a: 2, e: 1 }),
        makeSl("p-07", { h: 2, doubles: 1, rbi: 2 }, {}),
        makeSl("p-08", { h: 0, so: 2 }, { ip: 2, er: 2, soPitching: 1, np: 35 }),
        makeSl("p-09", { h: 3, hr: 1, rbi: 3, r: 2 }, { a: 1 }),
        makeSl("p-10", { h: 1, rbi: 1 }, { po: 3 }),
        makeSl("p-13", { h: 2, doubles: 1, rbi: 1, r: 1, sb: 1 }, {}),
        makeSl("p-14", { h: 0 }, { ip: 1, er: 0, soPitching: 1, np: 13 }),
      ],
    },
    {
      date: "2025-06-01", opponent: "华南理工大学", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 2, doubles: 1, rbi: 2, r: 1 }, { ip: 5.2, er: 1, soPitching: 7, w: 1, np: 82 }),
        makeSl("p-02", { h: 3, hr: 1, rbi: 3, r: 2, bb: 1 }, { po: 3 }),
        makeSl("p-03", { h: 4, doubles: 1, triples: 1, rbi: 2, r: 3 }, { a: 3 }),
        makeSl("p-04", { h: 1, bb: 1, r: 1, so: 1 }, {}),
        makeSl("p-05", { h: 3, hr: 1, rbi: 4, r: 2 }, {}),
        makeSl("p-06", { h: 2, rbi: 1, r: 1 }, { a: 2 }),
        makeSl("p-07", { h: 1, sb: 1 }, {}),
        makeSl("p-08", { h: 2, doubles: 1, rbi: 1 }, { ip: 1.1, er: 0, sv: 1, np: 18 }),
        makeSl("p-09", { h: 4, doubles: 2, rbi: 3, r: 3, sb: 2 }, { po: 2, a: 3 }),
        makeSl("p-10", { h: 1, so: 1 }, { po: 4, a: 1 }),
        makeSl("p-11", { h: 0, bb: 1 }, {}),
        makeSl("p-13", { h: 2, r: 1, sb: 1 }, {}),
      ],
    },
    {
      date: "2025-09-20", opponent: "香港中文大学（深圳）", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 3, hr: 2, rbi: 5, r: 3 }, { ip: 7, er: 1, soPitching: 10, bbPitching: 1, w: 1, np: 99 }),
        makeSl("p-02", { h: 2, doubles: 1, rbi: 1, r: 2 }, { po: 4, a: 1 }),
        makeSl("p-03", { h: 3, hr: 1, rbi: 3, r: 2 }, { a: 5 }),
        makeSl("p-04", { h: 2, hr: 1, rbi: 2, r: 1 }, {}),
        makeSl("p-05", { h: 2, rbi: 1, r: 1, sb: 1 }, {}),
        makeSl("p-06", { h: 2, doubles: 1, rbi: 2 }, { po: 2, a: 2 }),
        makeSl("p-07", { h: 3, triples: 1, rbi: 2, r: 2 }, {}),
        makeSl("p-08", { h: 1, r: 1, bb: 1 }, {}),
        makeSl("p-09", { h: 3, doubles: 1, rbi: 2, r: 2, sb: 1 }, { a: 3 }),
        makeSl("p-10", { h: 1, rbi: 1 }, { po: 3, e: 1 }),
        makeSl("p-13", { h: 3, rbi: 1, r: 2, sb: 3 }, {}),
        makeSl("p-14", { h: 0 }, { ip: 1, er: 0, soPitching: 1, np: 11 }),
      ],
    },
    {
      date: "2025-10-18", opponent: "深圳技术大学", gameType: "official",
      statLines: [
        makeSl("p-14", { h: 0 }, { ip: 5, er: 2, soPitching: 6, bbPitching: 1, hPitching: 4, w: 1, np: 75 }),
        makeSl("p-02", { h: 3, doubles: 1, rbi: 2, r: 2 }, { po: 5, a: 2 }),
        makeSl("p-03", { h: 3, hr: 1, rbi: 3, r: 3, sb: 1 }, { a: 3 }),
        makeSl("p-04", { h: 2, hr: 1, rbi: 2, r: 1 }, {}),
        makeSl("p-05", { h: 3, doubles: 1, rbi: 3, r: 2 }, {}),
        makeSl("p-06", { h: 2, rbi: 1 }, { a: 2 }),
        makeSl("p-07", { h: 2, rbi: 2 }, {}),
        makeSl("p-08", { h: 1, r: 1 }, { ip: 2, er: 0, soPitching: 2, sv: 1, np: 25 }),
        makeSl("p-09", { h: 4, doubles: 1, rbi: 4, r: 3 }, { po: 2, a: 4 }),
        makeSl("p-13", { h: 3, triples: 1, rbi: 2, r: 3, sb: 2 }, {}),
        makeSl("p-11", { h: 1, rbi: 1 }, { ip: 2, er: 0, soPitching: 2, np: 22 }),
      ],
    },
    // Training games
    {
      date: "2025-07-05", opponent: "队内红白战 A组 vs B组", gameType: "training",
      statLines: [
        makeSl("p-01", { h: 2, bb: 1, rbi: 1 }, { ip: 3, er: 1, soPitching: 4, np: 42 }),
        makeSl("p-03", { h: 3, doubles: 1, rbi: 3, r: 2 }, {}),
        makeSl("p-05", { h: 2, sb: 1, r: 1 }, {}),
        makeSl("p-07", { h: 2, rbi: 1 }, {}),
        makeSl("p-09", { h: 1, r: 1 }, {}),
        makeSl("p-13", { h: 2, sb: 2, r: 2 }, {}),
        makeSl("p-15", { h: 1, rbi: 1, bb: 1 }, {}),
      ],
    },
    {
      date: "2025-08-16", opponent: "队内红白战 A组 vs B组", gameType: "training",
      statLines: [
        makeSl("p-02", { h: 2, hr: 1, rbi: 2, r: 2 }, {}),
        makeSl("p-04", { h: 3, doubles: 1, rbi: 2, r: 1 }, {}),
        makeSl("p-06", { h: 2, r: 1 }, {}),
        makeSl("p-08", { h: 1, rbi: 1 }, { ip: 2, er: 0, soPitching: 3, np: 28 }),
        makeSl("p-10", { h: 1, bb: 1, r: 1 }, {}),
        makeSl("p-14", { h: 0 }, { ip: 3, er: 0, soPitching: 4, np: 40 }),
        makeSl("p-15", { h: 2, doubles: 1, rbi: 2, r: 1 }, {}),
      ],
    },
  ];

  // -- 2026 season: 5 official + 2 training --
  const season2026: GameTemplate[] = [
    {
      date: "2026-03-08", opponent: "深圳大学", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 2, doubles: 1, rbi: 2, r: 1 }, { ip: 6, er: 2, soPitching: 7, w: 1, np: 91 }),
        makeSl("p-02", { h: 3, hr: 1, rbi: 3, r: 2, bb: 1 }, { po: 3, a: 2 }),
        makeSl("p-03", { h: 2, doubles: 1, rbi: 2, r: 2 }, { a: 4 }),
        makeSl("p-04", { h: 3, hr: 1, rbi: 3, r: 2 }, {}),
        makeSl("p-05", { h: 4, doubles: 1, triples: 1, r: 3, sb: 2 }, {}),
        makeSl("p-06", { h: 3, hr: 1, rbi: 4, r: 2, bb: 1 }, { po: 2, a: 1 }),
        makeSl("p-07", { h: 2, rbi: 1, r: 1 }, {}),
        makeSl("p-08", { h: 1, rbi: 1 }, { ip: 1, er: 0, sv: 1, np: 14 }),
        makeSl("p-09", { h: 3, hr: 1, rbi: 3, r: 2 }, { a: 2 }),
        makeSl("p-11", { h: 1, so: 1 }, {}),
        makeSl("p-13", { h: 2, rbi: 1, sb: 2, r: 2 }, {}),
        makeSl("p-14", { h: 0 }, { ip: 2, er: 0, soPitching: 2, np: 24 }),
      ],
    },
    {
      date: "2026-04-12", opponent: "南方科技大学", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 1, bb: 2, r: 2, rbi: 1 }, { ip: 5.1, er: 3, soPitching: 5, bbPitching: 3, w: 0, l: 1, np: 85 }),
        makeSl("p-02", { h: 2, rbi: 1, r: 1 }, { po: 5, a: 2 }),
        makeSl("p-03", { h: 4, doubles: 2, rbi: 4, r: 3 }, { po: 2, a: 3 }),
        makeSl("p-04", { h: 2, rbi: 2, bb: 1 }, {}),
        makeSl("p-05", { h: 3, hr: 1, rbi: 2, r: 2, sb: 1 }, {}),
        makeSl("p-06", { h: 2, doubles: 1, rbi: 1 }, { a: 2, e: 1 }),
        makeSl("p-07", { h: 1, sb: 1, so: 2 }, {}),
        makeSl("p-08", { h: 1, r: 1 }, { po: 1 }),
        makeSl("p-09", { h: 2, rbi: 1, r: 1, sb: 1 }, { a: 3 }),
        makeSl("p-11", { h: 0, bb: 1 }, { ip: 2.2, er: 1, soPitching: 3, np: 42 }),
        makeSl("p-13", { h: 1, so: 1, sb: 1 }, {}),
        makeSl("p-15", { h: 2, hr: 1, rbi: 2, r: 1 }, {}),
      ],
    },
    {
      date: "2026-05-01", opponent: "北京大学深圳研究生院", gameType: "official",
      statLines: [
        makeSl("p-11", { h: 1, rbi: 1 }, { ip: 6, er: 1, soPitching: 8, bbPitching: 1, hPitching: 3, w: 1, np: 89 }),
        makeSl("p-02", { h: 2, hr: 1, rbi: 2, r: 2 }, { po: 4, a: 1 }),
        makeSl("p-03", { h: 3, hr: 1, rbi: 3, r: 2 }, { a: 3 }),
        makeSl("p-04", { h: 2, doubles: 1, r: 1 }, {}),
        makeSl("p-05", { h: 2, rbi: 1, r: 1, sb: 1 }, {}),
        makeSl("p-06", { h: 3, hr: 2, rbi: 5, r: 3, bb: 1 }, { po: 3, a: 3 }),
        makeSl("p-07", { h: 3, doubles: 1, rbi: 2, r: 2 }, {}),
        makeSl("p-08", { h: 2, rbi: 1, r: 1 }, {}),
        makeSl("p-09", { h: 2, r: 2, bb: 2, sb: 3 }, { a: 4 }),
        makeSl("p-10", { h: 0, so: 1 }, { po: 5 }),
        makeSl("p-13", { h: 1, bb: 1, sb: 1 }, {}),
        makeSl("p-15", { h: 3, hr: 2, doubles: 1, rbi: 5, r: 3 }, {}),
      ],
    },
    {
      date: "2026-05-25", opponent: "哈尔滨工业大学（深圳）校内联赛", gameType: "official",
      statLines: [
        makeSl("p-01", { h: 3, hr: 2, rbi: 6, r: 4, doubles: 1 }, { ip: 7, er: 0, soPitching: 11, w: 1, np: 105 }),
        makeSl("p-02", { h: 2, doubles: 1, rbi: 2, r: 2 }, { po: 3, a: 2 }),
        makeSl("p-03", { h: 4, hr: 1, doubles: 1, rbi: 4, r: 3 }, { a: 4 }),
        makeSl("p-04", { h: 3, hr: 1, rbi: 3, r: 2 }, {}),
        makeSl("p-05", { h: 3, rbi: 2, r: 3, sb: 2 }, {}),
        makeSl("p-06", { h: 2, hr: 1, rbi: 2, r: 1 }, { po: 2, a: 1 }),
        makeSl("p-07", { h: 2, doubles: 1, rbi: 2, r: 2 }, {}),
        makeSl("p-08", { h: 1, rbi: 1 }, { po: 1 }),
        makeSl("p-09", { h: 2, rbi: 1, r: 1, sb: 1 }, { a: 2 }),
        makeSl("p-10", { h: 1, bb: 1, r: 1 }, { po: 3, a: 1 }),
        makeSl("p-11", { h: 1 }, { ip: 1, er: 0, sv: 1, np: 10 }),
        makeSl("p-13", { h: 3, doubles: 1, rbi: 2, r: 2, sb: 1 }, {}),
        makeSl("p-15", { h: 2, hr: 1, rbi: 3, r: 2 }, {}),
      ],
    },
    {
      date: "2026-06-14", opponent: "香港中文大学（深圳）", gameType: "official",
      statLines: [
        makeSl("p-14", { h: 0 }, { ip: 5, er: 2, soPitching: 5, bbPitching: 2, w: 1, np: 78 }),
        makeSl("p-02", { h: 3, doubles: 1, rbi: 3, r: 2 }, { po: 4, a: 1 }),
        makeSl("p-03", { h: 3, doubles: 1, rbi: 2, r: 3, sb: 2 }, { a: 3 }),
        makeSl("p-04", { h: 2, hr: 1, rbi: 2, r: 1 }, {}),
        makeSl("p-05", { h: 4, doubles: 1, rbi: 3, r: 3, sb: 1 }, {}),
        makeSl("p-06", { h: 2, doubles: 1, rbi: 3, r: 1 }, { a: 2 }),
        makeSl("p-07", { h: 2, rbi: 1 }, {}),
        makeSl("p-08", { h: 1, r: 1 }, { ip: 2, er: 0, soPitching: 3, sv: 1, np: 27 }),
        makeSl("p-09", { h: 3, hr: 1, rbi: 2, r: 2 }, { a: 3 }),
        makeSl("p-13", { h: 2, sb: 1, r: 2 }, {}),
        makeSl("p-15", { h: 3, hr: 2, rbi: 4, r: 3 }, {}),
        makeSl("p-11", { h: 1 }, { ip: 1, er: 0, soPitching: 1, np: 14 }),
      ],
    },
    // Training games
    {
      date: "2026-04-25", opponent: "队内红白战 A组 vs B组", gameType: "training",
      statLines: [
        makeSl("p-01", { h: 1, bb: 1, rbi: 1 }, { ip: 3, er: 1, soPitching: 4, np: 45 }),
        makeSl("p-03", { h: 3, doubles: 1, rbi: 3, r: 2 }, {}),
        makeSl("p-05", { h: 2, sb: 1, r: 1 }, {}),
        makeSl("p-07", { h: 2, rbi: 1 }, {}),
        makeSl("p-09", { h: 1, r: 1 }, {}),
        makeSl("p-13", { h: 3, sb: 2, r: 2 }, {}),
        makeSl("p-15", { h: 1, rbi: 1, so: 1 }, {}),
      ],
    },
    {
      date: "2026-06-07", opponent: "队内红白战 A组 vs B组", gameType: "training",
      statLines: [
        makeSl("p-02", { h: 2, hr: 1, rbi: 2, r: 2 }, {}),
        makeSl("p-04", { h: 3, doubles: 1, rbi: 2, r: 1 }, {}),
        makeSl("p-06", { h: 2, r: 1 }, {}),
        makeSl("p-08", { h: 1, rbi: 1 }, { ip: 2, er: 0, soPitching: 3, np: 28 }),
        makeSl("p-10", { h: 1, bb: 1, r: 1 }, {}),
        makeSl("p-14", { h: 0 }, { ip: 2, er: 0, soPitching: 3, np: 30 }),
        makeSl("p-15", { h: 2, hr: 1, rbi: 2, r: 1 }, {}),
      ],
    },
  ];

  // ═══════════════════════════════════════════════════════════════
  // 5. Add all games to workspace
  // ═══════════════════════════════════════════════════════════════

  let gameCounter = 1;
  const allGames = [...season2024, ...season2025, ...season2026];
  for (const g of allGames) {
    ws.games.push({
      id: `g-demo-${String(gameCounter++).padStart(2, "0")}`,
      date: g.date,
      opponent: g.opponent,
      gameType: g.gameType,
      totalInnings: 9,
      innings: [],
      statLines: g.statLines.map((sl) => ({
        playerId: sl.playerId,
        pa: sl.pa, ab: sl.ab, h: sl.h,
        doubles: sl.doubles ?? 0, triples: sl.triples ?? 0,
        hr: sl.hr, rbi: sl.rbi, r: sl.r, sb: sl.sb,
        bb: sl.bb, hbp: sl.hbp ?? 0, sf: sl.sf ?? 0, so: sl.so,
        ip: sl.ip, er: sl.er,
        soPitching: sl.soPitching, bbPitching: sl.bbPitching, hPitching: sl.hPitching,
        po: sl.po, a: sl.a, e: sl.e,
        w: sl.w, l: sl.l, sv: sl.sv, np: sl.np,
      })),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Add milestones
  // ═══════════════════════════════════════════════════════════════

  ws.milestones = [
    {
      id: "milestone-1",
      date: "2023-09-01",
      title: "HITSZ 棒球社正式成立",
      description: "哈尔滨工业大学（深圳）棒球社经校团委批准正式成立，首批招募队员9人，配备基础训练器材。",
    },
    {
      id: "milestone-2",
      date: "2024-01-15",
      title: "首次校内热身赛",
      description: "在深圳大学城体育场举办首场队内公开热身赛，吸引了超过50名观众到场观赛。",
    },
    {
      id: "milestone-3",
      date: "2024-03-23",
      title: "首场正式对外交流赛",
      description: "对阵深圳大学，标志着球队从校内训练走向正式比赛，最终以8-5取得建队首胜。",
    },
    {
      id: "milestone-4",
      date: "2024-06-15",
      title: "陈浩宇7局无失分完封中山大学",
      description: "王牌投手陈浩宇投出代表作，7局8K无失分，王嘉诚单场4安打3分打点，球队10-0大胜。",
    },
    {
      id: "milestone-5",
      date: "2024-09-28",
      title: "深港高校棒球交流计划启动",
      description: "与香港中文大学（深圳）建立定期交流赛机制，每学期至少举办一次友谊赛。",
    },
    {
      id: "milestone-6",
      date: "2025-03-15",
      title: "2025赛季开幕战大胜深圳大学",
      description: "王嘉诚单场4安打4打点，郑一诺4安打2打点1盗垒，全队15支安打火力全开。",
    },
    {
      id: "milestone-7",
      date: "2025-04-20",
      title: "陈浩宇完封暨南大学",
      description: "完投7局9K无失分，展示王牌投手的统治力。",
    },
    {
      id: "milestone-8",
      date: "2025-09-20",
      title: "陈浩宇单场双响炮+10K",
      description: "对阵香港中文大学（深圳），陈浩宇投打两端全面统治：投球7局10K仅失1分，打击双响炮5打点。",
    },
    {
      id: "milestone-9",
      date: "2025-10-18",
      title: "新秀投手吴昊天生涯首胜",
      description: "大一左投吴昊天在对阵深圳技术大学的比赛中先发5局6K，拿下大学棒球生涯首场胜投。",
    },
    {
      id: "milestone-10",
      date: "2026-03-08",
      title: "2026赛季开幕 — 球队阵容进一步壮大",
      description: "新学期引入新生谢远航，球队总人数达到15人。周亦凡首战4安打3得分2盗垒。",
    },
    {
      id: "milestone-11",
      date: "2026-05-01",
      title: "许天泽双响炮5打点击退北大深研院",
      description: "许天泽单场双响炮5打点，唐睿先发6局8K仅失1分，合力拿下重要胜利。",
    },
    {
      id: "milestone-12",
      date: "2026-05-25",
      title: "校内联赛揭幕战 — 全队火力全开",
      description: "陈浩宇7局11K无失分完封，全队16支安打，6名球员各有打点入账，以14-0大胜。",
    },
  ];

  // ═══════════════════════════════════════════════════════════════
  // 7. Save to database
  // ═══════════════════════════════════════════════════════════════

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE public.app_workspace
       SET data = $1, version = version + 1, updated_at = now()
       WHERE slug = 'default'
       RETURNING version`,
      [JSON.stringify(ws)],
    );
    console.log("✅ Rich demo data seeded!");
    console.log(`   Workspace version: ${result.rows[0].version}`);
    console.log(`   Players: ${ws.players.length}`);
    console.log(`   Games: ${ws.games.length} (${season2024.length} in 2024, ${season2025.length} in 2025, ${season2026.length} in 2026)`);
    console.log(`     - Official: ${ws.games.filter(g => g.gameType === "official").length}`);
    console.log(`     - Training: ${ws.games.filter(g => g.gameType === "training").length}`);
    console.log(`   Milestones: ${ws.milestones.length}`);
    console.log(`   HoF eligible players: ${ws.players.filter(p => {
      const joinedAt = p.joinedAt ? new Date(p.joinedAt).getTime() : Infinity;
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      return joinedAt <= ninetyDaysAgo;
    }).length}`);
    console.log(`   NOT eligible (recent joiners): ${ws.players.filter(p => {
      const joinedAt = p.joinedAt ? new Date(p.joinedAt).getTime() : Infinity;
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      return joinedAt > ninetyDaysAgo;
    }).map(p => `${p.name}(#${p.number})`).join(", ") || "none"}`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
