/**
 * Hall of Fame induction logic and season award computation.
 *
 * All functions are pure — they compute from immutable input and produce
 * deterministic output. No side effects.
 *
 * Induction criteria:
 * 1. joinedAt is set AND at least HALL_OF_FAME_MIN_DAYS (90) days ago
 * 2. Has appeared in at least 1 official game
 */

import type { Game, Player, Workspace } from "@/lib/workspace";
import {
  HALL_OF_FAME_MIN_DAYS,
  SEASON_AWARD_LABELS,
} from "@/lib/workspace";
import {
  computeBattingLine,
  computeFieldingLine,
  computePitchingLine,
  deriveSeasons,
  filterGamesBySeason,
  filterGamesByType,
  qualifiesForRateLeaderboard,
  type BattingLine,
  type FieldingLine,
  type PitchingLine,
} from "@/lib/stats";

// ── Types ──

export type SeasonAward = {
  season: string;
  award: string;
  label: string;
  statValue: string;
};

export type Inductee = {
  player: Player;
  batting: BattingLine;
  pitching: PitchingLine | null;
  fielding: FieldingLine;
  seasonBadges: SeasonAward[];
};

// ── Induction ──

/**
 * A player qualifies for the Hall of Fame if:
 * - joinedAt is set and is at least HALL_OF_FAME_MIN_DAYS days ago, AND
 * - has appeared in at least 1 official game
 */
export function isInducted(
  player: Player,
  allGames: Game[],
  now?: Date,
): boolean {
  if (!player.joinedAt) return false;
  const joined = new Date(player.joinedAt);
  if (Number.isNaN(joined.getTime())) return false;
  const reference = now ?? new Date();
  const daysSinceJoined =
    (reference.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceJoined < HALL_OF_FAME_MIN_DAYS) return false;

  const officialGames = filterGamesByType(allGames, "official");
  return officialGames.some((g) =>
    g.statLines.some((sl) => sl.playerId === player.id),
  );
}

// ── Inductees ──

export function getInductees(workspace: Workspace): Inductee[] {
  const allGames = workspace.games;

  return workspace.players
    .filter((p) => isInducted(p, allGames))
    .map((player) => {
      const batting = computeBattingLine(allGames, player.id);
      const pitching = computePitchingLine(allGames, player.id);
      const fielding = computeFieldingLine(allGames, player.id);
      const seasonBadges = computeSeasonBadges(player, allGames);

      return {
        player,
        batting,
        pitching: pitching.G > 0 ? pitching : null,
        fielding,
        seasonBadges,
      };
    })
    .sort((a, b) => b.batting.G - a.batting.G);
}

// ── Data Milestones ──

export type DataMilestone = {
  id: string;
  date: string;
  title: string;
  description: string;
};

export type PlayerMilestone = {
  id: string;
  date: string;
  opponent: string;
  title: string;
  description: string;
};

const H_THRESHOLDS = [1, 10, 50, 100];
const HR_THRESHOLDS = [1, 10, 20, 50];
const RBI_THRESHOLDS = [1, 10, 50, 100];
const R_THRESHOLDS = [1, 10, 50, 100];
const SO_THRESHOLDS = [1, 10, 50, 100];
const W_THRESHOLDS = [1, 5, 10, 20];

/**
 * Compute team-level data milestones — the team's Nth hit, HR, etc.
 * Each milestone records which player contributed to reach it.
 */
export function computeDataMilestones(
  games: Game[],
  players: Player[],
): DataMilestone[] {
  const milestones: DataMilestone[] = [];
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? id;

  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));

  // Team cumulative totals
  let teamH = 0, teamHR = 0, teamRBI = 0, teamR = 0, teamSO = 0, teamW = 0;

  function checkTeam(name: string, oldVal: number, newVal: number,
    thresholds: number[], label: string, pid: string, date: string, unit: string,
  ) {
    for (const t of thresholds) {
      if (oldVal < t && newVal >= t) {
        const prefix = t === 1 ? "队史首" : `队史第${t}`;
        milestones.push({
          id: `tm-${label}-${t}`,
          date,
          title: `${prefix}${label}`,
          description: `${playerName(pid)} 在 ${date} 为球队贡献${prefix}${label}（全队累计 ${newVal} ${unit}）。`,
        });
      }
    }
  }

  for (const game of sorted) {
    for (const sl of game.statLines) {
      if (!sl.playerId) continue;

      const prevH = teamH, prevHR = teamHR, prevRBI = teamRBI, prevR = teamR;
      const prevSO = teamSO, prevW = teamW;

      teamH += sl.h ?? 0;
      teamHR += sl.hr ?? 0;
      teamRBI += sl.rbi ?? 0;
      teamR += sl.r ?? 0;
      teamSO += sl.soPitching ?? 0;
      teamW += sl.w ?? 0;

      checkTeam("安打", prevH, teamH, H_THRESHOLDS, "安打", sl.playerId, game.date, "支");
      checkTeam("本垒打", prevHR, teamHR, HR_THRESHOLDS, "本垒打", sl.playerId, game.date, "支");
      checkTeam("打点", prevRBI, teamRBI, RBI_THRESHOLDS, "打点", sl.playerId, game.date, "分");
      checkTeam("得分", prevR, teamR, R_THRESHOLDS, "得分", sl.playerId, game.date, "分");
      checkTeam("夺三振", prevSO, teamSO, SO_THRESHOLDS, "夺三振", sl.playerId, game.date, "次");
      checkTeam("胜投", prevW, teamW, W_THRESHOLDS, "胜投", sl.playerId, game.date, "场");
    }
  }

  // Sort descending (newest first) for display
  milestones.sort((a, b) => b.date.localeCompare(a.date));
  return milestones;
}

/**
 * Compute per-player milestones — a player's personal 1st/10th/50th hit, etc.
 * Includes game context (opponent) for each milestone.
 */
export function computePlayerMilestones(
  playerId: string,
  games: Game[],
): PlayerMilestone[] {
  const milestones: PlayerMilestone[] = [];
  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));

  let pH = 0, pHR = 0, pRBI = 0, pR = 0, pSO = 0, pW = 0;

  function check(name: string, oldVal: number, newVal: number,
    thresholds: number[], label: string, date: string, opponent: string, unit: string,
  ) {
    for (const t of thresholds) {
      if (oldVal < t && newVal >= t) {
        const prefix = t === 1 ? "生涯首" : `生涯第${t}`;
        milestones.push({
          id: `pm-${playerId}-${label}-${t}`,
          date,
          opponent,
          title: `${prefix}${label}`,
          description: `${date} 对阵 ${opponent}，达成${prefix}${label}（累计 ${newVal} ${unit}）。`,
        });
      }
    }
  }

  for (const game of sorted) {
    const sl = game.statLines.find((s) => s.playerId === playerId);
    if (!sl) continue;

    const prevH = pH, prevHR = pHR, prevRBI = pRBI, prevR = pR;
    const prevSO = pSO, prevW = pW;

    pH += sl.h ?? 0;
    pHR += sl.hr ?? 0;
    pRBI += sl.rbi ?? 0;
    pR += sl.r ?? 0;
    pSO += sl.soPitching ?? 0;
    pW += sl.w ?? 0;

    check("安打", prevH, pH, H_THRESHOLDS, "安打", game.date, game.opponent, "支");
    check("本垒打", prevHR, pHR, HR_THRESHOLDS, "本垒打", game.date, game.opponent, "支");
    check("打点", prevRBI, pRBI, RBI_THRESHOLDS, "打点", game.date, game.opponent, "分");
    check("得分", prevR, pR, R_THRESHOLDS, "得分", game.date, game.opponent, "分");
    check("夺三振", prevSO, pSO, SO_THRESHOLDS, "夺三振", game.date, game.opponent, "次");
    check("胜投", prevW, pW, W_THRESHOLDS, "胜投", game.date, game.opponent, "场");
  }

  // Sort descending (newest first) for display
  milestones.sort((a, b) => b.date.localeCompare(a.date));
  return milestones;
}

// ── All-Time Kings (for Hall of Fame display) ──

export type AllTimeKing = {
  award: string;
  label: string;
  playerName: string;
  playerNumber: string;
  statValue: string;
};

export function getAllTimeKings(inductees: Inductee[]): AllTimeKing[] {
  const kings: AllTimeKing[] = [];

  // Hit King — most career H
  const hitKing = inductees.reduce<Inductee | null>(
    (best, i) => (i.batting.H > (best?.batting.H ?? 0) ? i : best), null);
  if (hitKing && hitKing.batting.H > 0) {
    kings.push({
      award: "hitKing", label: "历史安打王",
      playerName: hitKing.player.name, playerNumber: hitKing.player.number,
      statValue: String(hitKing.batting.H),
    });
  }

  // HR King
  const hrKing = inductees.reduce<Inductee | null>(
    (best, i) => (i.batting.HR > (best?.batting.HR ?? 0) ? i : best), null);
  if (hrKing && hrKing.batting.HR > 0) {
    kings.push({
      award: "hrKing", label: "历史本垒打王",
      playerName: hrKing.player.name, playerNumber: hrKing.player.number,
      statValue: String(hrKing.batting.HR),
    });
  }

  // RBI King
  const rbiKing = inductees.reduce<Inductee | null>(
    (best, i) => (i.batting.RBI > (best?.batting.RBI ?? 0) ? i : best), null);
  if (rbiKing && rbiKing.batting.RBI > 0) {
    kings.push({
      award: "rbiKing", label: "历史打点王",
      playerName: rbiKing.player.name, playerNumber: rbiKing.player.number,
      statValue: String(rbiKing.batting.RBI),
    });
  }

  // On-Base King (min 30 PA for all-time)
  const obpMinPA = 30;
  const obpQualified = inductees.filter((i) => i.batting.PA >= obpMinPA);
  const onBaseKing = obpQualified.reduce<Inductee | null>(
    (best, i) => (Number.parseFloat(i.batting.OBP) > Number.parseFloat(best?.batting.OBP ?? "0") ? i : best), null);
  if (onBaseKing) {
    kings.push({
      award: "onBaseKing", label: "历史上垒王",
      playerName: onBaseKing.player.name, playerNumber: onBaseKing.player.number,
      statValue: onBaseKing.batting.OBP,
    });
  }

  // Strikeout King (pitching)
  const strikeoutKing = inductees
    .filter((i) => i.pitching && i.pitching.SO > 0)
    .reduce<Inductee | null>(
      (best, i) => ((i.pitching?.SO ?? 0) > (best?.pitching?.SO ?? 0) ? i : best), null);
  if (strikeoutKing && strikeoutKing.pitching) {
    kings.push({
      award: "strikeoutKing", label: "历史三振王",
      playerName: strikeoutKing.player.name, playerNumber: strikeoutKing.player.number,
      statValue: String(strikeoutKing.pitching.SO),
    });
  }

  // Wins King (pitching)
  const winsKing = inductees
    .filter((i) => i.pitching && i.pitching.W > 0)
    .reduce<Inductee | null>(
      (best, i) => ((i.pitching?.W ?? 0) > (best?.pitching?.W ?? 0) ? i : best), null);
  if (winsKing && winsKing.pitching) {
    kings.push({
      award: "winsKing", label: "历史多胜王",
      playerName: winsKing.player.name, playerNumber: winsKing.player.number,
      statValue: String(winsKing.pitching.W),
    });
  }

  // AVG King (min 30 PA)
  const avgQualified = inductees.filter((i) => i.batting.PA >= obpMinPA && i.batting.AB > 0);
  const avgKing = avgQualified.reduce<Inductee | null>(
    (best, i) => (Number.parseFloat(i.batting.AVG) > Number.parseFloat(best?.batting.AVG ?? "0") ? i : best), null);
  if (avgKing) {
    kings.push({
      award: "avgKing", label: "历史打击王",
      playerName: avgKing.player.name, playerNumber: avgKing.player.number,
      statValue: avgKing.batting.AVG,
    });
  }

  return kings;
}

// ── Season Badges ──

type SeasonPlayerLine = {
  playerId: string;
  batting: BattingLine;
  pitching: PitchingLine;
};

/**
 * Compute "Season King" badges for a player across all seasons.
 * For each season, checks if the player led in any award category.
 */
export function computeSeasonBadges(
  player: Player,
  allGames: Game[],
): SeasonAward[] {
  const seasons = deriveSeasons(allGames);
  const badges: SeasonAward[] = [];

  for (const season of seasons) {
    const seasonGames = filterGamesBySeason(allGames, season);
    const officialSeasonGames = filterGamesByType(seasonGames, "official");
    const teamGamesCount = officialSeasonGames.length;

    if (teamGamesCount === 0) continue;

    // Build stat lines for all players who appeared this season
    const playerIds = new Set(
      seasonGames.flatMap((g) => g.statLines.map((sl) => sl.playerId)),
    );
    const lines: SeasonPlayerLine[] = Array.from(playerIds).map((pid) => ({
      playerId: pid,
      batting: computeBattingLine(seasonGames, pid),
      pitching: computePitchingLine(seasonGames, pid),
    }));

    // Hit King (安打王) — most hits
    const hitKing = lines
      .filter((r) => r.batting.H > 0)
      .reduce<SeasonPlayerLine | null>(
        (best, r) => (r.batting.H > (best?.batting.H ?? 0) ? r : best),
        null,
      );
    if (hitKing?.playerId === player.id) {
      badges.push({
        season,
        award: "hitKing",
        label: SEASON_AWARD_LABELS.hitKing,
        statValue: String(hitKing.batting.H),
      });
    }

    // HR King (本垒打王) — most HR
    const hrKing = lines
      .filter((r) => r.batting.HR > 0)
      .reduce<SeasonPlayerLine | null>(
        (best, r) => (r.batting.HR > (best?.batting.HR ?? 0) ? r : best),
        null,
      );
    if (hrKing?.playerId === player.id) {
      badges.push({
        season,
        award: "hrKing",
        label: SEASON_AWARD_LABELS.hrKing,
        statValue: String(hrKing.batting.HR),
      });
    }

    // RBI King (打点王) — most RBI
    const rbiKing = lines
      .filter((r) => r.batting.RBI > 0)
      .reduce<SeasonPlayerLine | null>(
        (best, r) => (r.batting.RBI > (best?.batting.RBI ?? 0) ? r : best),
        null,
      );
    if (rbiKing?.playerId === player.id) {
      badges.push({
        season,
        award: "rbiKing",
        label: SEASON_AWARD_LABELS.rbiKing,
        statValue: String(rbiKing.batting.RBI),
      });
    }

    // On-Base King (上垒王) — highest OBP (must qualify)
    const onBaseKing = lines
      .filter((r) =>
        qualifiesForRateLeaderboard(r.batting.PA, teamGamesCount) &&
        Number.parseFloat(r.batting.OBP) > 0,
      )
      .reduce<SeasonPlayerLine | null>(
        (best, r) =>
          Number.parseFloat(r.batting.OBP) >
          Number.parseFloat(best?.batting.OBP ?? "0")
            ? r
            : best,
        null,
      );
    if (onBaseKing?.playerId === player.id) {
      badges.push({
        season,
        award: "onBaseKing",
        label: SEASON_AWARD_LABELS.onBaseKing,
        statValue: onBaseKing.batting.OBP,
      });
    }

    // Strikeout King (三振王) — most strikeouts (pitching)
    const strikeoutKing = lines
      .filter((r) => r.pitching.SO > 0)
      .reduce<SeasonPlayerLine | null>(
        (best, r) =>
          r.pitching.SO > (best?.pitching.SO ?? 0) ? r : best,
        null,
      );
    if (strikeoutKing?.playerId === player.id) {
      badges.push({
        season,
        award: "strikeoutKing",
        label: SEASON_AWARD_LABELS.strikeoutKing,
        statValue: String(strikeoutKing.pitching.SO),
      });
    }

    // Wins King (多胜王) — most pitching wins
    const winsKing = lines
      .filter((r) => r.pitching.W > 0)
      .reduce<SeasonPlayerLine | null>(
        (best, r) =>
          r.pitching.W > (best?.pitching.W ?? 0) ? r : best,
        null,
      );
    if (winsKing?.playerId === player.id) {
      badges.push({
        season,
        award: "winsKing",
        label: SEASON_AWARD_LABELS.winsKing,
        statValue: String(winsKing.pitching.W),
      });
    }
  }

  return badges;
}
