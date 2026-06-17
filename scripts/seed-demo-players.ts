/**
 * Seed 23 demo players (19 available, 3 graduated, 1 injured) + stats.
 * Inserts directly into normalized tables.
 *
 * Run: npx tsx scripts/seed-demo-players.ts
 */

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });

interface PlayerSeed {
  id: string; name: string; number: string; throws: string; bats: string;
  status: string; joinedOn: string | null; positions: string[];
  profileType: string; age: number | null; heightCm: number | null;
  weightKg: number | null; fastballTop: number | null; fastballAvg: number | null;
  armStrength: number | null; thirtyMeter: number | null; scouting: string;
  pitchTypes: string[]; pitcherRadar: Record<string,number|null>; fielderRadar: Record<string,number|null>;
}

const PLAYERS: PlayerSeed[] = [
  // === 19 available ===
  { id:"p-01",name:"陈浩宇",number:"18",throws:"R",bats:"R",status:"available",joinedOn:"2024-09-01",positions:["P","1B"],profileType:"pitcher",age:22,heightCm:185,weightKg:82,fastballTop:142,fastballAvg:136,armStrength:88,thirtyMeter:4.3,scouting:"王牌投手，球速快控球稳，具备先发轮值潜力。",pitchTypes:["四缝线","滑球","变速球"],pitcherRadar:{velocity:72,command:68,movement:65,stamina:70,fielding:55,mental:72},fielderRadar:{contact:48,power:55,speed:52,arm:72,defense:55,instinct:58}},
  { id:"p-02",name:"林子昂",number:"2",throws:"R",bats:"L",status:"available",joinedOn:"2024-09-01",positions:["C","3B"],profileType:"fielder",age:21,heightCm:178,weightKg:75,fastballTop:null,fastballAvg:null,armStrength:75,thirtyMeter:4.5,scouting:"主力捕手，防守意识好，左打有优势。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:62,power:48,speed:50,arm:68,defense:72,instinct:70}},
  { id:"p-03",name:"王嘉诚",number:"7",throws:"R",bats:"S",status:"available",joinedOn:"2024-09-01",positions:["SS","2B"],profileType:"fielder",age:20,heightCm:176,weightKg:70,fastballTop:null,fastballAvg:null,armStrength:72,thirtyMeter:4.2,scouting:"游击核心，左右开弓，速度型内野手。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:74,power:42,speed:78,arm:68,defense:76,instinct:72}},
  { id:"p-04",name:"赵铭",number:"11",throws:"L",bats:"L",status:"available",joinedOn:"2024-09-01",positions:["1B","RF"],profileType:"fielder",age:22,heightCm:182,weightKg:80,fastballTop:null,fastballAvg:null,armStrength:70,thirtyMeter:4.6,scouting:"左打重炮，一垒和外野皆可。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:58,power:76,speed:45,arm:62,defense:58,instinct:55}},
  { id:"p-05",name:"周亦凡",number:"23",throws:"R",bats:"R",status:"available",joinedOn:"2024-09-01",positions:["CF","LF"],profileType:"fielder",age:21,heightCm:179,weightKg:72,fastballTop:null,fastballAvg:null,armStrength:68,thirtyMeter:4.1,scouting:"中外野核心，覆盖范围大速度快。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:64,power:50,speed:82,arm:60,defense:74,instinct:65}},
  { id:"p-06",name:"许天泽",number:"5",throws:"R",bats:"R",status:"available",joinedOn:"2024-09-15",positions:["3B","SS"],profileType:"fielder",age:20,heightCm:177,weightKg:73,fastballTop:null,fastballAvg:null,armStrength:74,thirtyMeter:4.4,scouting:"三垒手，臂力强劲防守稳健。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:56,power:58,speed:55,arm:76,defense:70,instinct:62}},
  { id:"p-07",name:"黄景澄",number:"9",throws:"L",bats:"L",status:"available",joinedOn:"2024-10-01",positions:["LF","CF"],profileType:"fielder",age:19,heightCm:175,weightKg:68,fastballTop:null,fastballAvg:null,armStrength:62,thirtyMeter:4.2,scouting:"左打外野，一年级新人潜力股。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:52,power:40,speed:72,arm:55,defense:60,instinct:50}},
  { id:"p-08",name:"李沐阳",number:"16",throws:"R",bats:"R",status:"available",joinedOn:"2024-09-01",positions:["RF","P"],profileType:"pitcher",age:22,heightCm:183,weightKg:78,fastballTop:138,fastballAvg:132,armStrength:82,thirtyMeter:4.5,scouting:"二刀流选手，外野+中继投手。",pitchTypes:["四缝线","曲球"],pitcherRadar:{velocity:65,command:58,movement:62,stamina:52,fielding:60,mental:58},fielderRadar:{contact:55,power:52,speed:58,arm:74,defense:62,instinct:54}},
  { id:"p-09",name:"郑一诺",number:"33",throws:"R",bats:"S",status:"available",joinedOn:"2024-09-01",positions:["2B","SS"],profileType:"fielder",age:20,heightCm:174,weightKg:67,fastballTop:null,fastballAvg:null,armStrength:66,thirtyMeter:4.1,scouting:"二垒手，左右开弓巧打型。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:68,power:38,speed:74,arm:60,defense:68,instinct:66}},
  { id:"p-10",name:"孙柏川",number:"12",throws:"R",bats:"L",status:"available",joinedOn:"2024-03-01",positions:["C","1B"],profileType:"fielder",age:23,heightCm:180,weightKg:76,fastballTop:null,fastballAvg:null,armStrength:70,thirtyMeter:4.7,scouting:"老将捕手，攻守兼备。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:54,power:45,speed:42,arm:66,defense:70,instinct:72}},
  { id:"p-11",name:"唐睿",number:"27",throws:"L",bats:"L",status:"available",joinedOn:"2025-03-01",positions:["P","CF"],profileType:"pitcher",age:19,heightCm:181,weightKg:74,fastballTop:140,fastballAvg:134,armStrength:80,thirtyMeter:4.4,scouting:"左投新星，二年级先发轮值。",pitchTypes:["四缝线","滑球","变速球","曲球"],pitcherRadar:{velocity:70,command:64,movement:68,stamina:66,fielding:52,mental:60},fielderRadar:{contact:42,power:38,speed:62,arm:70,defense:54,instinct:48}},
  { id:"p-13",name:"刘子轩",number:"6",throws:"R",bats:"R",status:"available",joinedOn:"2024-09-01",positions:["P"],profileType:"pitcher",age:21,heightCm:186,weightKg:83,fastballTop:144,fastballAvg:137,armStrength:84,thirtyMeter:4.5,scouting:"二年级先发，球速队内最快。",pitchTypes:["四缝线","滑球","指叉球"],pitcherRadar:{velocity:76,command:60,movement:62,stamina:68,fielding:50,mental:56},fielderRadar:{contact:35,power:30,speed:45,arm:70,defense:45,instinct:42}},
  { id:"p-14",name:"何明远",number:"8",throws:"R",bats:"L",status:"available",joinedOn:"2024-09-01",positions:["1B","3B"],profileType:"fielder",age:22,heightCm:184,weightKg:85,fastballTop:null,fastballAvg:null,armStrength:72,thirtyMeter:4.8,scouting:"一垒重炮，力量型打者。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:52,power:72,speed:38,arm:64,defense:56,instinct:50}},
  { id:"p-15",name:"宋佳明",number:"21",throws:"R",bats:"R",status:"available",joinedOn:"2025-03-01",positions:["CF","RF"],profileType:"fielder",age:19,heightCm:178,weightKg:70,fastballTop:null,fastballAvg:null,armStrength:66,thirtyMeter:4.0,scouting:"一年级外野，速度出色。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:50,power:35,speed:84,arm:58,defense:62,instinct:46}},
  { id:"p-16",name:"戴宇轩",number:"30",throws:"L",bats:"L",status:"available",joinedOn:"2025-03-01",positions:["LF","1B"],profileType:"fielder",age:19,heightCm:176,weightKg:69,fastballTop:null,fastballAvg:null,armStrength:60,thirtyMeter:4.3,scouting:"左打外野，一年级新人。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:48,power:42,speed:66,arm:52,defense:54,instinct:44}},
  { id:"p-17",name:"彭浩然",number:"45",throws:"R",bats:"S",status:"available",joinedOn:"2025-03-01",positions:["2B","SS"],profileType:"fielder",age:19,heightCm:173,weightKg:65,fastballTop:null,fastballAvg:null,armStrength:64,thirtyMeter:4.2,scouting:"内野新人，左右开弓。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:54,power:30,speed:70,arm:56,defense:58,instinct:52}},
  { id:"p-18",name:"苏子涵",number:"19",throws:"R",bats:"R",status:"available",joinedOn:"2025-09-01",positions:["C"],profileType:"fielder",age:18,heightCm:179,weightKg:73,fastballTop:null,fastballAvg:null,armStrength:68,thirtyMeter:4.6,scouting:"新捕手，防守基本功扎实。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:44,power:35,speed:48,arm:64,defense:66,instinct:54}},
  { id:"p-19",name:"秦朗",number:"22",throws:"R",bats:"L",status:"available",joinedOn:"2024-09-01",positions:["P","3B"],profileType:"pitcher",age:22,heightCm:182,weightKg:77,fastballTop:136,fastballAvg:130,armStrength:78,thirtyMeter:4.5,scouting:"老将投手，可守三垒。",pitchTypes:["四缝线","变速球","滑球"],pitcherRadar:{velocity:62,command:66,movement:60,stamina:64,fielding:56,mental:68},fielderRadar:{contact:46,power:48,speed:50,arm:68,defense:60,instinct:56}},

  // === 3 graduated ===
  { id:"p-20",name:"韩立",number:"3",throws:"L",bats:"L",status:"graduated",joinedOn:"2020-09-01",positions:["P","LF"],profileType:"pitcher",age:26,heightCm:184,weightKg:80,fastballTop:146,fastballAvg:138,armStrength:86,thirtyMeter:4.4,scouting:"传奇左投，生涯胜投王，已毕业。",pitchTypes:["四缝线","滑球","变速球","曲球"],pitcherRadar:{velocity:78,command:72,movement:70,stamina:76,fielding:58,mental:80},fielderRadar:{contact:52,power:48,speed:58,arm:74,defense:56,instinct:62}},
  { id:"p-21",name:"程远",number:"10",throws:"R",bats:"R",status:"graduated",joinedOn:"2020-09-01",positions:["1B","3B"],profileType:"fielder",age:26,heightCm:186,weightKg:88,fastballTop:null,fastballAvg:null,armStrength:74,thirtyMeter:4.9,scouting:"队史安打王，重炮一垒，已毕业。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:80,power:82,speed:35,arm:66,defense:54,instinct:60}},
  { id:"p-22",name:"董大伟",number:"24",throws:"R",bats:"R",status:"graduated",joinedOn:"2021-03-01",positions:["SS","2B"],profileType:"fielder",age:25,heightCm:180,weightKg:75,fastballTop:null,fastballAvg:null,armStrength:76,thirtyMeter:4.3,scouting:"前游击核心，守备精湛，已毕业。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:66,power:54,speed:68,arm:72,defense:80,instinct:74}},

  // === 1 injured ===
  { id:"p-23",name:"马启航",number:"44",throws:"R",bats:"R",status:"injured",joinedOn:"2025-03-01",positions:["3B","LF"],profileType:"fielder",age:20,heightCm:177,weightKg:71,fastballTop:null,fastballAvg:null,armStrength:70,thirtyMeter:4.5,scouting:"三垒/外野多面手，肩伤休养中。",pitchTypes:[],pitcherRadar:{velocity:null,command:null,movement:null,stamina:null,fielding:null,mental:null},fielderRadar:{contact:52,power:55,speed:58,arm:68,defense:58,instinct:50}},
  { id:"p-24",name:"萧天乐",number:"55",throws:"R",bats:"R",status:"available",joinedOn:"2025-09-01",positions:["P","RF"],profileType:"pitcher",age:18,heightCm:180,weightKg:72,fastballTop:134,fastballAvg:128,armStrength:76,thirtyMeter:4.5,scouting:"一年级新投手，潜力待开发。",pitchTypes:["四缝线","曲球"],pitcherRadar:{velocity:58,command:48,movement:52,stamina:50,fielding:44,mental:46},fielderRadar:{contact:36,power:34,speed:54,arm:66,defense:48,instinct:40}},
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Insert workspace_meta row
    const metaResult = await client.query(
      `INSERT INTO public.app_workspace_meta (id, slug, version, active_scenario_id, help_dismissed, created_at, updated_at)
       SELECT id, slug, version,
         nullif(data->>'activeScenarioId', ''),
         coalesce((data->'preferences'->>'helpDismissed')::boolean, false),
         created_at, updated_at
       FROM public.app_workspace
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
    );
    const workspaceId = metaResult.rows[0]?.id;
    if (!workspaceId) {
      // Already exists — get it
      const existing = await client.query(`SELECT id FROM public.app_workspace_meta LIMIT 1`);
      if (!existing.rows[0]) throw new Error("No workspace found");
    }
    const wsId = workspaceId ?? (await client.query(`SELECT id FROM public.app_workspace_meta LIMIT 1`)).rows[0].id;

    // 2. Clear existing player data, then insert fresh
    await client.query(`DELETE FROM public.app_player_position WHERE workspace_id=$1`, [wsId]);
    await client.query(`DELETE FROM public.app_player WHERE workspace_id=$1`, [wsId]);

    for (let i = 0; i < PLAYERS.length; i++) {
      const p = PLAYERS[i];
      await client.query(
        `INSERT INTO public.app_player (workspace_id, id, sort_order, name, number, throws, bats, status, joined_on, profile_type, age, height_cm, weight_kg, fastball_top_kmh, fastball_avg_kmh, arm_strength_m, thirty_meter_sec, scouting_summary, pitcher_radar, fielder_radar, pitch_types)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (workspace_id, id) DO UPDATE SET
           name=EXCLUDED.name, number=EXCLUDED.number, throws=EXCLUDED.throws, bats=EXCLUDED.bats,
           status=EXCLUDED.status, joined_on=EXCLUDED.joined_on, profile_type=EXCLUDED.profile_type,
           age=EXCLUDED.age, height_cm=EXCLUDED.height_cm, weight_kg=EXCLUDED.weight_kg,
           fastball_top_kmh=EXCLUDED.fastball_top_kmh, fastball_avg_kmh=EXCLUDED.fastball_avg_kmh,
           arm_strength_m=EXCLUDED.arm_strength_m, thirty_meter_sec=EXCLUDED.thirty_meter_sec,
           scouting_summary=EXCLUDED.scouting_summary, pitcher_radar=EXCLUDED.pitcher_radar,
           fielder_radar=EXCLUDED.fielder_radar, pitch_types=EXCLUDED.pitch_types, sort_order=$3`,
        [wsId, p.id, i, p.name, p.number, p.throws, p.bats, p.status, p.joinedOn, p.profileType,
         p.age, p.heightCm, p.weightKg, p.fastballTop, p.fastballAvg, p.armStrength, p.thirtyMeter,
         p.scouting, JSON.stringify(p.pitcherRadar), JSON.stringify(p.fielderRadar), p.pitchTypes],
      );

      // Upsert positions
      for (let j = 0; j < p.positions.length; j++) {
        await client.query(
          `INSERT INTO public.app_player_position (workspace_id, player_id, position_code)
           VALUES ($1,$2,$3)
           ON CONFLICT (workspace_id, player_id, position_code) DO NOTHING`,
          [wsId, p.id, p.positions[j]],
        );
      }
    }

    await client.query("COMMIT");
    console.log(`✅ Seeded ${PLAYERS.length} players (${PLAYERS.filter(p=>p.status==="available").length} available, ${PLAYERS.filter(p=>p.status==="graduated").length} graduated, ${PLAYERS.filter(p=>p.status==="injured").length} injured)`);

    console.log("✅ Player seeding complete");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => { console.error("Seed failed:", err); process.exit(1); });
