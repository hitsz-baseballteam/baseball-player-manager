/**
 * Computed baseball statistics from GameRecord arrays.
 *
 * All functions are pure — they compute from immutable input and produce
 * deterministic output. String-formatted stats use `.XXX` for averages and
 * `X.XX` for rates, with safe zero-division handling.
 */

import type { GameRecord } from "@/lib/workspace";

// ── Batting ──

export interface BattingLine {
  G: number;
  PA: number;
  AB: number;
  H: number;
  AVG: string;
  HR: number;
  RBI: number;
  R: number;
  SB: number;
  BB: number;
  SO: number;
  OBP: string;
  SLG: string;
  OPS: string;
}

/** Total bases estimate from H and HR (assumes all non-HR hits are singles). */
function totalBases(h: number, hr: number): number {
  return h + 3 * hr;
}

function avgString(h: number, ab: number): string {
  if (ab === 0) return ".000";
  return (h / ab).toFixed(3).replace(/^0(?=\.)/, "");
}

function obpString(h: number, bb: number, pa: number): string {
  if (pa === 0) return ".000";
  return ((h + bb) / pa).toFixed(3).replace(/^0(?=\.)/, "");
}

function slgString(h: number, hr: number, ab: number): string {
  if (ab === 0) return ".000";
  return (totalBases(h, hr) / ab).toFixed(3).replace(/^0(?=\.)/, "");
}

function opsString(obp: string, slg: string): string {
  const o = Number.parseFloat(obp);
  const s = Number.parseFloat(slg);
  if (!Number.isFinite(o) || !Number.isFinite(s)) return ".000";
  return (o + s).toFixed(3).replace(/^0(?=\.)/, "");
}

export function computeBattingLine(games: GameRecord[]): BattingLine {
  const totals = games.reduce(
    (acc, g) => ({
      G: acc.G + 1,
      PA: acc.PA + (g.pa ?? 0),
      AB: acc.AB + (g.ab ?? 0),
      H: acc.H + (g.h ?? 0),
      HR: acc.HR + (g.hr ?? 0),
      RBI: acc.RBI + (g.rbi ?? 0),
      R: acc.R + (g.r ?? 0),
      SB: acc.SB + (g.sb ?? 0),
      BB: acc.BB + (g.bb ?? 0),
      SO: acc.SO + (g.so ?? 0),
    }),
    { G: 0, PA: 0, AB: 0, H: 0, HR: 0, RBI: 0, R: 0, SB: 0, BB: 0, SO: 0 },
  );

  const avg = avgString(totals.H, totals.AB);
  const obp = obpString(totals.H, totals.BB, totals.PA);
  const slg = slgString(totals.H, totals.HR, totals.AB);

  return {
    ...totals,
    AVG: avg,
    OBP: obp,
    SLG: slg,
    OPS: opsString(obp, slg),
  };
}

// ── Pitching ──

export interface PitchingLine {
  G: number;
  IP: string;       // decimal innings (e.g. "5.2" = 5⅔)
  ER: number;
  ERA: string;
  WHIP: string;
  H: number;
  BB: number;
  SO: number;
  K9: string;
  BB9: string;
}

/** Convert IP notation (5.2 = 5⅔) to decimal innings for calculation. */
function decimalInnings(ip: number | null): number {
  if (ip === null || !Number.isFinite(ip) || ip <= 0) return 0;
  const whole = Math.trunc(ip);
  const frac = ip - whole;
  const outs = Math.round(frac * 10);
  return whole + outs / 3;
}

/** Convert decimal innings to IP display string (e.g. 5.6667 → 5.2). */
function formatInningsPitched(decimal: number): string {
  if (decimal === 0) return "0.0";
  const whole = Math.trunc(decimal);
  const outs = Math.round((decimal - whole) * 3);
  if (outs === 3) return `${whole + 1}.0`;
  return `${whole}.${outs}`;
}

function rateString(numerator: number, denominator: number, multiplier = 9): string {
  if (denominator === 0) return "0.00";
  return ((numerator * multiplier) / denominator).toFixed(2);
}

export function computePitchingLine(games: GameRecord[]): PitchingLine {
  const totals = games.reduce(
    (acc, g) => ({
      G: acc.G + 1,
      IP: acc.IP + decimalInnings(g.ip),
      ER: acc.ER + (g.er ?? 0),
      H: acc.H + (g.hPitching ?? 0),
      BB: acc.BB + (g.bbPitching ?? 0),
      SO: acc.SO + (g.soPitching ?? 0),
    }),
    { G: 0, IP: 0, ER: 0, H: 0, BB: 0, SO: 0 },
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
  };
}
