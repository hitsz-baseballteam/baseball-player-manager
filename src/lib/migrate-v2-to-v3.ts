/**
 * Migrate a v2 workspace (per-player GameRecord[] in PlayerProfile.games)
 * to v3 workspace (top-level Game[] in Workspace.games).
 *
 * Each player's GameRecord[] becomes separate Game entities with that
 * player's stats as the sole statLine entry. Inning data and fielding
 * stats are defaulted (no per-inning data in old format).
 */

import type { Game, GameRecord, Player, PlayerGameStatLine, Workspace } from "./workspace/types";

function gameRecordToStatLine(playerId: string, gr: GameRecord): PlayerGameStatLine {
  return {
    playerId,
    pa: gr.pa,
    ab: gr.ab,
    h: gr.h,
    hr: gr.hr,
    rbi: gr.rbi,
    r: gr.r,
    sb: gr.sb,
    bb: gr.bb,
    so: gr.so,
    ip: gr.ip,
    er: gr.er,
    soPitching: gr.soPitching,
    bbPitching: gr.bbPitching,
    hPitching: gr.hPitching,
    po: 0,
    a: 0,
    e: 0,
  };
}

function gameRecordToGame(playerId: string, gr: GameRecord): Game {
  return {
    id: gr.id,
    date: gr.date,
    opponent: gr.opponent,
    gameType: gr.gameType,
    totalInnings: 9,
    innings: [],
    statLines: [gameRecordToStatLine(playerId, gr)],
  };
}

/** Workspace shape before v3 — for migration source typing only. */
type WorkspaceV2 = {
  version: 2;
  players: Player[];
  scenarios: Array<{ id: string; name: string; note?: string; assignments: Record<string, unknown> }>;
  activeScenarioId: string;
  preferences?: { helpDismissed?: boolean };
};

export function migrateV2toV3(raw: unknown): Workspace | null {
  const v2 = raw as WorkspaceV2 | null | undefined;
  if (!v2 || v2.version !== 2) return null;

  const games: Game[] = [];
  const players = (Array.isArray(v2.players) ? v2.players : []).map((player) => {
    const profile = player.profile as { games?: GameRecord[] } | undefined;
    const oldGames = Array.isArray(profile?.games) ? profile.games : [];
    for (const gr of oldGames) {
      if (gr.id && gr.date && gr.opponent) {
        games.push(gameRecordToGame(player.id, gr));
      }
    }
    // Strip games from profile — sanitizer will rebuild without it
    const { games: _, ...profileRest } = (profile ?? {}) as Record<string, unknown>;
    return { ...player, profile: profileRest } as Player;
  });

  const scenarios = (Array.isArray(v2.scenarios) ? v2.scenarios : []).map((s) => ({
    id: String(s.id ?? ""),
    name: String(s.name ?? "").slice(0, 40),
    note: String((s as Record<string, unknown>).note ?? "").slice(0, 200),
    assignments: (s as Record<string, unknown>).assignments ?? {},
  }));

  return {
    version: 3,
    players,
    scenarios: scenarios as Workspace["scenarios"],
    activeScenarioId: String(v2.activeScenarioId ?? ""),
    games,
    preferences: {
      helpDismissed: Boolean((v2.preferences as Record<string, boolean> | undefined)?.helpDismissed),
    },
  };
}
