/**
 * Computed baseball statistics from top-level Game arrays.
 *
 * All functions are pure — they compute from immutable input and produce
 * deterministic output. String-formatted stats use `.XXX` for averages and
 * `X.XX` for rates, with safe zero-division handling.
 */

import type { Game } from "@/lib/workspace";

export type StatsGameScope = "all" | "official" | "training";

// ── Helpers ──

function totalBases(h: number, doubles: number, triples: number, hr: number): number {
  const singles = Math.max(0, h - doubles - triples - hr);
  return singles + doubles * 2 + triples * 3 + hr * 4;
}

function avgString(h: number, ab: number): string {
  if (ab === 0) return ".000";
  return (h / ab).toFixed(3).replace(/^0(?=\.)/, "");
}

function pctString(numerator: number, denominator: number): string {
  if (denominator === 0) return ".000";
  return (numerator / denominator).toFixed(3).replace(/^0(?=\.)/, "");
}

function rateString(numerator: number, denominator: number, multiplier = 9): string {
  if (denominator === 0) return "0.00";
  return ((numerator * multiplier) / denominator).toFixed(2);
}

function opsString(obp: string, slg: string): string {
  const value = Number.parseFloat(obp) + Number.parseFloat(slg);
  if (!Number.isFinite(value)) return ".000";
  const text = value.toFixed(3);
  return text.startsWith("0.") ? text.slice(1) : text;
}

export function filterGamesByType(games: Game[], scope: StatsGameScope): Game[] {
  if (scope === "all") return games;
  return games.filter((game) => game.gameType === scope);
}

export function deriveSeasons(games: Game[]): string[] {
  const years = new Set<string>();
  for (const g of games) {
    const year = g.date.slice(0, 4);
    if (/^\d{4}$/.test(year)) years.add(year);
  }
  return Array.from(years).sort().reverse();
}

export function filterGamesBySeason(games: Game[], season: string | null): Game[] {
  if (!season) return games;
  return games.filter((g) => g.date.startsWith(season));
}

export function qualifiesForRateLeaderboard(
  pa: number,
  teamGamesInSeason: number,
): boolean {
  if (teamGamesInSeason === 0) return false;
  return pa >= teamGamesInSeason * 1.5;
}

function decimalInnings(ip: number | null): number {
  if (ip === null || !Number.isFinite(ip) || ip <= 0) return 0;
  const whole = Math.trunc(ip);
  const outs = Math.round((ip - whole) * 10);
  return whole + outs / 3;
}

function formatInningsPitched(decimal: number): string {
  if (decimal === 0) return "0.0";
  const whole = Math.trunc(decimal);
  const outs = Math.round((decimal - whole) * 3);
  if (outs === 3) return `${whole + 1}.0`;
  return `${whole}.${outs}`;
}

// ── Batting ──

export interface BattingLine {
  G: number;
  PA: number;
  AB: number;
  H: number;
  Doubles: number;
  Triples: number;
  AVG: string;
  HR: number;
  RBI: number;
  R: number;
  SB: number;
  BB: number;
  HBP: number;
  SF: number;
  TOB: number;
  SO: number;
  OBP: string;
  SLG: string;
  OPS: string;
}

export function computeBattingLine(games: Game[], playerId: string): BattingLine {
  const totals = games.reduce(
    (acc, game) => {
      const sl = game.statLines.find((s) => s.playerId === playerId);
      if (!sl) return acc;
      return {
        G: acc.G + 1,
        PA: acc.PA + (sl.pa ?? 0),
        AB: acc.AB + (sl.ab ?? 0),
        H: acc.H + (sl.h ?? 0),
        Doubles: acc.Doubles + (sl.doubles ?? 0),
        Triples: acc.Triples + (sl.triples ?? 0),
        HR: acc.HR + (sl.hr ?? 0),
        RBI: acc.RBI + (sl.rbi ?? 0),
        R: acc.R + (sl.r ?? 0),
        SB: acc.SB + (sl.sb ?? 0),
        BB: acc.BB + (sl.bb ?? 0),
        HBP: acc.HBP + (sl.hbp ?? 0),
        SF: acc.SF + (sl.sf ?? 0),
        SO: acc.SO + (sl.so ?? 0),
      };
    },
    { G: 0, PA: 0, AB: 0, H: 0, Doubles: 0, Triples: 0, HR: 0, RBI: 0, R: 0, SB: 0, BB: 0, HBP: 0, SF: 0, SO: 0 },
  );

  const tob = totals.H + totals.BB + totals.HBP;
  const obp = pctString(tob, totals.AB + totals.BB + totals.HBP + totals.SF);
  const slg = pctString(totalBases(totals.H, totals.Doubles, totals.Triples, totals.HR), totals.AB);

  return {
    ...totals,
    TOB: tob,
    AVG: avgString(totals.H, totals.AB),
    OBP: obp,
    SLG: slg,
    OPS: opsString(obp, slg),
  };
}

// ── Pitching ──

export interface PitchingLine {
  G: number;
  IP: string;
  ER: number;
  ERA: string;
  WHIP: string;
  H: number;
  BB: number;
  SO: number;
  K9: string;
  BB9: string;
  W: number;
  L: number;
  SV: number;
  NP: number;
}

export function computePitchingLine(games: Game[], playerId: string): PitchingLine {
  const totals = games.reduce(
    (acc, game) => {
      const sl = game.statLines.find((s) => s.playerId === playerId);
      if (!sl) return acc;
      return {
        G: acc.G + 1,
        IP: acc.IP + decimalInnings(sl.ip),
        ER: acc.ER + (sl.er ?? 0),
        H: acc.H + (sl.hPitching ?? 0),
        BB: acc.BB + (sl.bbPitching ?? 0),
        SO: acc.SO + (sl.soPitching ?? 0),
        W: acc.W + (sl.w ?? 0),
        L: acc.L + (sl.l ?? 0),
        SV: acc.SV + (sl.sv ?? 0),
        NP: acc.NP + (sl.np ?? 0),
      };
    },
    { G: 0, IP: 0, ER: 0, H: 0, BB: 0, SO: 0, W: 0, L: 0, SV: 0, NP: 0 },
  );

  return {
    G: totals.G,
    IP: formatInningsPitched(totals.IP),
    ER: totals.ER,
    ERA: rateString(totals.ER, totals.IP),
    WHIP: rateString(totals.BB + totals.H, totals.IP, 1),
    H: totals.H,
    BB: totals.BB,
    SO: totals.SO,
    K9: rateString(totals.SO, totals.IP),
    BB9: rateString(totals.BB, totals.IP),
    W: totals.W,
    L: totals.L,
    SV: totals.SV,
    NP: totals.NP,
  };
}

// ── Fielding ──

export interface FieldingLine {
  G: number;
  PO: number;
  A: number;
  E: number;
  TC: number;
  FPCT: string;
}

export function computeFieldingLine(games: Game[], playerId: string): FieldingLine {
  const totals = games.reduce(
    (acc, game) => {
      const sl = game.statLines.find((s) => s.playerId === playerId);
      if (!sl) return acc;
      return {
        G: acc.G + 1,
        PO: acc.PO + (sl.po ?? 0),
        A: acc.A + (sl.a ?? 0),
        E: acc.E + (sl.e ?? 0),
      };
    },
    { G: 0, PO: 0, A: 0, E: 0 },
  );

  const tc = totals.PO + totals.A + totals.E;
  return {
    ...totals,
    TC: tc,
    FPCT: pctString(totals.PO + totals.A, tc),
  };
}
