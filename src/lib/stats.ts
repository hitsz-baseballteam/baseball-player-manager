/**
 * Computed baseball statistics from top-level Game arrays.
 *
 * All functions are pure — they compute from immutable input and produce
 * deterministic output. String-formatted stats use `.XXX` for averages and
 * `X.XX` for rates, with safe zero-division handling.
 */

import type { Game } from "@/lib/workspace";

// ── Helpers ──

function totalBases(h: number, hr: number): number {
  return h + 3 * hr;
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
        HR: acc.HR + (sl.hr ?? 0),
        RBI: acc.RBI + (sl.rbi ?? 0),
        R: acc.R + (sl.r ?? 0),
        SB: acc.SB + (sl.sb ?? 0),
        BB: acc.BB + (sl.bb ?? 0),
        SO: acc.SO + (sl.so ?? 0),
      };
    },
    { G: 0, PA: 0, AB: 0, H: 0, HR: 0, RBI: 0, R: 0, SB: 0, BB: 0, SO: 0 },
  );

  const obp = pctString(totals.H + totals.BB, totals.PA);
  const slg = pctString(totalBases(totals.H, totals.HR), totals.AB);

  return {
    ...totals,
    AVG: avgString(totals.H, totals.AB),
    OBP: obp,
    SLG: slg,
    OPS: pctString(Number.parseFloat(obp) + Number.parseFloat(slg), 1),
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
      };
    },
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
