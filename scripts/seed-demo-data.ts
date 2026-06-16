/**
 * Seed the workspace with demo data to showcase the new Data Center
 * and Hall of Fame features.
 *
 * Run: npx tsx scripts/seed-demo-data.ts
 */

import { Pool } from "pg";
import { createDefaultWorkspace, type Workspace } from "../src/lib/workspace";

// Use the same DATABASE_URL as the app
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });

async function seed() {
  const ws = createDefaultWorkspace(true);
  const now = new Date();

  // ── Set joinedAt for some players (for Hall of Fame) ──
  const oldDate = new Date(now);
  oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years ago

  const recentDate = new Date(now);
  recentDate.setMonth(recentDate.getMonth() - 1); // 1 month ago

  ws.players.forEach((p) => {
    // Most players joined 2 years ago (qualify for HoF)
    if (p.id !== "p-12") {
      // p-12 (马启航, injured) joined recently
      p.joinedAt = p.id === "p-12" ? recentDate.toISOString() : oldDate.toISOString();
    }
    // p-10 (孙柏川) = graduated — still in HoF, but excluded from active leaderboard
    if (p.id === "p-10") {
      p.joinedAt = new Date(Date.now() - 1500 * 24 * 60 * 60 * 1000).toISOString(); // joined 4+ years ago
      p.status = "graduated";
    }
  });

  // ── Generate demo games across two seasons ──
  const playerIds = ws.players.map((p) => p.id);

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

  // 2025 season games (6 official games)
  const season2025 = [
    {
      date: "2025-03-15",
      opponent: "深圳大学",
      gameType: "official" as const,
      statLines: [
        // Game 1: Big offensive game
        makeSl("p-01", { h: 3, hr: 1, rbi: 3, r: 2, doubles: 1 }, { ip: 5, er: 1, soPitching: 6, w: 1, np: 78 }),
        makeSl("p-02", { h: 2, rbi: 2, bb: 1, r: 1 }, { po: 5, a: 2 }),
        makeSl("p-03", { h: 4, doubles: 2, hr: 1, rbi: 4, r: 3 }, { po: 3, a: 4 }),
        makeSl("p-04", { h: 3, bb: 2, rbi: 1, r: 2 }, {}),
        makeSl("p-05", { h: 2, hr: 1, rbi: 2, r: 2, sb: 1 }, {}),
        makeSl("p-06", { h: 1, bb: 1, r: 1 }, { po: 1, a: 3 }),
        makeSl("p-07", { h: 2, rbi: 1 }, {}),
        makeSl("p-08", { h: 1, so: 2 }, { po: 2 }),
        makeSl("p-09", { h: 3, doubles: 1, rbi: 2, r: 1 }, { a: 2 }),
        // p-10 is resting, no stats
      ],
    },
    {
      date: "2025-04-02",
      opponent: "南方科技大学",
      gameType: "official" as const,
      statLines: [
        makeSl("p-01", { h: 2, doubles: 1, rbi: 1, r: 1 }, { ip: 6, er: 2, soPitching: 8, w: 1, np: 95 }),
        makeSl("p-02", { h: 1, bb: 2, r: 2 }, { po: 4, a: 1 }),
        makeSl("p-03", { h: 3, hr: 1, rbi: 3, r: 2 }, { a: 2 }),
        makeSl("p-04", { h: 2, hr: 1, rbi: 2, r: 1 }, {}),
        makeSl("p-05", { h: 1, sb: 1, r: 1 }, {}),
        makeSl("p-06", { h: 2, doubles: 1, rbi: 1 }, { po: 2, a: 2 }),
        makeSl("p-07", { h: 0, so: 2, bb: 1 }, {}),
        makeSl("p-08", { h: 1, r: 1 }, {}),
        makeSl("p-09", { h: 2, rbi: 1, bb: 1 }, { a: 3, e: 1 }),
        makeSl("p-11", { h: 1, so: 3 }, { ip: 2, er: 1, soPitching: 2, np: 30 }),
      ],
    },
    {
      date: "2025-04-20",
      opponent: "暨南大学",
      gameType: "official" as const,
      statLines: [
        makeSl("p-01", { h: 1, bb: 1, r: 1 }, { ip: 7, er: 0, soPitching: 9, w: 1, np: 102 }),
        makeSl("p-02", { h: 3, hr: 1, rbi: 2, r: 2 }, { po: 5, a: 1 }),
        makeSl("p-03", { h: 2, rbi: 1, r: 1 }, { a: 3 }),
        makeSl("p-04", { h: 1, bb: 1, rbi: 1 }, {}),
        makeSl("p-05", { h: 3, doubles: 1, rbi: 3, r: 2 }, {}),
        makeSl("p-06", { h: 2, hr: 1, rbi: 2, r: 1 }, { po: 3, a: 1 }),
        makeSl("p-07", { h: 2, sb: 2, r: 2 }, {}),
        makeSl("p-08", { h: 0, bb: 1, so: 1 }, {}),
        makeSl("p-09", { h: 1, r: 1 }, { a: 2 }),
        makeSl("p-11", { h: 0 }, { ip: 1, er: 0, soPitching: 1, sv: 1, np: 12 }),
      ],
    },
    {
      date: "2025-05-10",
      opponent: "中山大学",
      gameType: "official" as const,
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
      ],
    },
    {
      date: "2025-06-01",
      opponent: "华南理工大学",
      gameType: "official" as const,
      statLines: [
        makeSl("p-01", { h: 2, doubles: 1, rbi: 2, r: 1 }, { ip: 5.2, er: 1, soPitching: 7, w: 1, np: 82 }),
        makeSl("p-02", { h: 3, hr: 1, rbi: 3, r: 2, bb: 1 }, { po: 3 }),
        makeSl("p-03", { h: 4, doubles: 1, triples: 1, rbi: 2, r: 3 }, { a: 3 }),
        makeSl("p-04", { h: 1, bb: 1, r: 1, so: 1 }, {}),
        makeSl("p-05", { h: 3, hr: 1, rbi: 4, r: 2 }, {}),
        makeSl("p-06", { h: 2, rbi: 1, r: 1 }, { a: 2 }),
        makeSl("p-07", { h: 1, sb: 1 }, {}),
        makeSl("p-08", { h: 2, doubles: 1, rbi: 1 }, { ip: 1.1, er: 0, sv: 1, np: 18 }),
        makeSl("p-09", { h: 2, r: 1, bb: 1 }, { po: 2, a: 3 }),
        makeSl("p-10", { h: 1, so: 1 }, { po: 4, a: 1 }),
        makeSl("p-11", { h: 0, bb: 1 }, {}),
      ],
    },
    {
      date: "2025-09-20",
      opponent: "香港中文大学（深圳）",
      gameType: "official" as const,
      statLines: [
        makeSl("p-01", { h: 3, hr: 2, rbi: 5, r: 3 }, { ip: 7, er: 1, soPitching: 10, bbPitching: 1, w: 1, np: 99 }),
        makeSl("p-02", { h: 2, doubles: 1, rbi: 1, r: 2 }, { po: 4, a: 1 }),
        makeSl("p-03", { h: 3, hr: 1, rbi: 3, r: 2 }, { a: 5 }),
        makeSl("p-04", { h: 2, hr: 1, rbi: 2, r: 1 }, {}),
        makeSl("p-05", { h: 2, rbi: 1, r: 1, sb: 1 }, {}),
        makeSl("p-06", { h: 2, doubles: 1, rbi: 2 }, { po: 2, a: 2 }),
        makeSl("p-07", { h: 3, triples: 1, rbi: 2, r: 2 }, {}),
        makeSl("p-08", { h: 1, r: 1, bb: 1 }, {}),
        makeSl("p-09", { h: 2, rbi: 1, sb: 1 }, { a: 3 }),
        makeSl("p-10", { h: 1, rbi: 1 }, { po: 3, e: 1 }),
      ],
    },
  ];

  // 2026 season games (4 official + 2 training)
  const season2026 = [
    {
      date: "2026-03-08",
      opponent: "深圳大学",
      gameType: "official" as const,
      statLines: [
        makeSl("p-01", { h: 2, doubles: 1, rbi: 2, r: 1 }, { ip: 6, er: 2, soPitching: 7, w: 1, np: 91 }),
        makeSl("p-02", { h: 3, hr: 1, rbi: 3, r: 2, bb: 1 }, { po: 3, a: 2 }),
        makeSl("p-03", { h: 2, doubles: 1, rbi: 2, r: 2 }, { a: 4 }),
        makeSl("p-04", { h: 3, hr: 1, rbi: 3, r: 2 }, {}),
        makeSl("p-05", { h: 2, r: 1, sb: 1 }, {}),
        makeSl("p-06", { h: 1, bb: 2, r: 2 }, { po: 2, a: 1 }),
        makeSl("p-07", { h: 2, rbi: 1, r: 1 }, {}),
        makeSl("p-08", { h: 1, rbi: 1 }, { ip: 1, er: 0, sv: 1, np: 14 }),
        makeSl("p-09", { h: 3, hr: 1, rbi: 3, r: 2 }, { a: 2 }),
        makeSl("p-11", { h: 1, so: 1 }, {}),
      ],
    },
    {
      date: "2026-04-12",
      opponent: "南方科技大学",
      gameType: "official" as const,
      statLines: [
        makeSl("p-01", { h: 1, bb: 2, r: 2, rbi: 1 }, { ip: 5.1, er: 3, soPitching: 5, bbPitching: 3, w: 0, l: 1, np: 85 }),
        makeSl("p-02", { h: 2, rbi: 1, r: 1 }, { po: 5, a: 2 }),
        makeSl("p-03", { h: 4, doubles: 2, rbi: 4, r: 3 }, { po: 2, a: 3 }),
        makeSl("p-04", { h: 2, rbi: 2, bb: 1 }, {}),
        makeSl("p-05", { h: 3, hr: 1, rbi: 2, r: 2 }, {}),
        makeSl("p-06", { h: 2, doubles: 1, rbi: 1 }, { a: 2, e: 1 }),
        makeSl("p-07", { h: 1, sb: 1, so: 2 }, {}),
        makeSl("p-08", { h: 1, r: 1 }, { po: 1 }),
        makeSl("p-09", { h: 2, rbi: 1, r: 1 }, { a: 3 }),
        makeSl("p-11", { h: 0, bb: 1 }, { ip: 2.2, er: 1, soPitching: 3, np: 42 }),
      ],
    },
    {
      date: "2026-05-01",
      opponent: "北京大学深圳研究生院",
      gameType: "official" as const,
      statLines: [
        makeSl("p-11", { h: 1, rbi: 1 }, { ip: 6, er: 1, soPitching: 8, bbPitching: 1, hPitching: 3, w: 1, np: 89 }),
        makeSl("p-02", { h: 2, hr: 1, rbi: 2, r: 2 }, { po: 4, a: 1 }),
        makeSl("p-03", { h: 3, hr: 1, rbi: 3, r: 2 }, { a: 3 }),
        makeSl("p-04", { h: 2, doubles: 1, r: 1 }, {}),
        makeSl("p-05", { h: 2, rbi: 1, r: 1 }, {}),
        makeSl("p-06", { h: 1, bb: 1, rbi: 1 }, { po: 3, a: 3 }),
        makeSl("p-07", { h: 3, doubles: 1, rbi: 2, r: 2 }, {}),
        makeSl("p-08", { h: 2, rbi: 1, r: 1 }, {}),
        makeSl("p-09", { h: 1, r: 2, bb: 2, sb: 2 }, { a: 4 }),
        makeSl("p-10", { h: 0, so: 1 }, { po: 5 }),
      ],
    },
    {
      date: "2026-05-25",
      opponent: "哈尔滨工业大学（深圳）校内联赛",
      gameType: "official" as const,
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
      ],
    },
    // Training games (not counted for official awards)
    {
      date: "2026-04-25",
      opponent: "队内红白战 A组 vs B组",
      gameType: "training" as const,
      statLines: [
        makeSl("p-01", { h: 1, bb: 1, rbi: 1 }, { ip: 3, er: 1, soPitching: 4, np: 45 }),
        makeSl("p-03", { h: 3, doubles: 1, rbi: 3, r: 2 }, {}),
        makeSl("p-05", { h: 2, sb: 1, r: 1 }, {}),
        makeSl("p-07", { h: 2, rbi: 1 }, {}),
        makeSl("p-09", { h: 1, r: 1 }, {}),
      ],
    },
    {
      date: "2026-06-07",
      opponent: "队内红白战 A组 vs B组",
      gameType: "training" as const,
      statLines: [
        makeSl("p-02", { h: 2, hr: 1, rbi: 2, r: 2 }, {}),
        makeSl("p-04", { h: 3, doubles: 1, rbi: 2, r: 1 }, {}),
        makeSl("p-06", { h: 2, r: 1 }, {}),
        makeSl("p-08", { h: 1, rbi: 1 }, { ip: 2, er: 0, soPitching: 3, np: 28 }),
        makeSl("p-10", { h: 1, bb: 1, r: 1 }, {}),
      ],
    },
  ];

  // Add all games with sequential IDs
  let gameCounter = 1;
  const allGames = [...season2025, ...season2026];
  for (const g of allGames) {
    ws.games.push({
      id: `g-demo-${String(gameCounter++).padStart(2, "0")}`,
      date: g.date,
      opponent: g.opponent,
      gameType: g.gameType,
      totalInnings: 9,
      innings: [],
      statLines: g.statLines.map((sl, idx) => ({
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

  // ── Add milestones ──
  ws.milestones = [
    {
      id: "milestone-1",
      date: "2024-09-01",
      title: "HITSZ 棒球社正式成立",
      description: "哈尔滨工业大学（深圳）棒球社经校团委批准正式成立，首批招募队员15人。",
    },
    {
      id: "milestone-2",
      date: "2025-03-15",
      title: "首场正式对外交流赛",
      description: "对阵深圳大学，标志着球队从校内训练走向正式比赛。",
    },
    {
      id: "milestone-3",
      date: "2025-09-20",
      title: "击败香港中文大学（深圳）",
      description: "陈浩宇完投7局10K，单场双响炮5打点，带领球队取得赛季最佳胜利。",
    },
    {
      id: "milestone-4",
      date: "2026-05-25",
      title: "校内联赛揭幕战大胜",
      description: "陈浩宇7局无失分11K完封，郑一诺4安4打点，全队15支安打火力全开。",
    },
  ];

  // ── Save to database ──
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE public.app_workspace
       SET data = $1, version = version + 1, updated_at = now()
       WHERE slug = 'default'
       RETURNING version`,
      [JSON.stringify(ws)],
    );
    console.log(`✅ Demo data seeded! Workspace version: ${result.rows[0].version}`);
    console.log(`   Players: ${ws.players.length}`);
    console.log(`   Games: ${ws.games.length} (${season2025.length} in 2025, ${season2026.length} in 2026)`);
    console.log(`   Milestones: ${ws.milestones.length}`);
    console.log(`   Players with joinedAt (HoF eligible): ${ws.players.filter(p => p.joinedAt).length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
