import { cache } from "react";

import {
  getBootstrapWorkspace,
  getGamesWorkspace,
  getMilestonesWorkspace,
} from "@/lib/workspace-store";
import { createDefaultPublicHomeConfig } from "@/lib/workspace/base";
import {
  sanitizePublicHomeConfig,
} from "@/lib/workspace/sanitizers";
import type { PublicHomeConfig } from "@/lib/workspace/types";

export type PublicMilestone = {
  id: string;
  date: string;
  title: string;
  description: string;
  mediaUrl?: string;
};

export type PublicGame = {
  id: string;
  date: string;
  opponent: string;
  gameType: "official" | "training";
  totalInnings: number;
  ourScore: number | null;
  opponentScore: number | null;
  result: "win" | "loss" | "tie" | "upcoming";
};

export type PublicHomeData = {
  config: PublicHomeConfig;
  milestones: PublicMilestone[];
  games: PublicGame[];
};

const emptySnapshot = {
  milestones: [] as PublicMilestone[],
  games: [] as PublicGame[],
};

async function loadPublicMilestones(): Promise<PublicMilestone[]> {
  try {
    const snapshot = await getMilestonesWorkspace();
    return snapshot.workspace.milestones.map((m) => ({
      id: m.id,
      date: m.date,
      title: m.title,
      description: m.description,
      ...(m.mediaUrl ? { mediaUrl: m.mediaUrl } : {}),
    }));
  } catch {
    return [];
  }
}

function summarizeGameRuns(
  innings: Array<{ runs: number }>,
  gameType: "official" | "training",
): { ourScore: number | null; opponentScore: number | null; result: PublicGame["result"] } {
  if (innings.length === 0) {
    return { ourScore: null, opponentScore: null, result: "upcoming" };
  }
  const total = innings.reduce((sum, inning) => sum + inning.runs, 0);
  // In this app each game represents the team's own innings only; do not guess opponent runs.
  return {
    ourScore: total,
    opponentScore: null,
    result: gameType === "official" ? "tie" : "upcoming",
  };
}

async function loadPublicGames(): Promise<PublicGame[]> {
  try {
    const snapshot = await getGamesWorkspace();
    return snapshot.workspace.games.map((g) => {
      const summary = summarizeGameRuns(g.innings ?? [], g.gameType);
      return {
        id: g.id,
        date: g.date,
        opponent: g.opponent,
        gameType: g.gameType,
        totalInnings: g.totalInnings,
        ourScore: summary.ourScore,
        opponentScore: summary.opponentScore,
        result: summary.result,
      };
    });
  } catch {
    return [];
  }
}

export const getPublicHomeData = cache(async (): Promise<PublicHomeData> => {
  let config: PublicHomeConfig = createDefaultPublicHomeConfig();

  try {
    const snapshot = await getBootstrapWorkspace();
    config = sanitizePublicHomeConfig(
      (snapshot.workspace.preferences as { publicHomeConfig?: unknown }).publicHomeConfig,
    );
  } catch {
    config = createDefaultPublicHomeConfig();
  }

  const feeds = config.feeds ?? createDefaultPublicHomeConfig().feeds;

  const [allMilestones, allGames] = await Promise.all([
    feeds.milestones.enabled ? loadPublicMilestones() : Promise.resolve([]),
    feeds.games.enabled ? loadPublicGames() : Promise.resolve([]),
  ]);

  const milestones = allMilestones
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, Math.max(0, feeds.milestones.maxCount));

  const allowedGameTypes = new Set(feeds.games.gameTypes);
  const games = allGames
    .filter((g) => allowedGameTypes.has(g.gameType))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, Math.max(0, feeds.games.maxCount));

  return {
    config,
    milestones,
    games: games.length > 0 ? games : emptySnapshot.games,
  };
});