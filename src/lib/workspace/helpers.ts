// ── Domain helpers ──

import {
  DEFENSE_PRIORITY,
  POSITION_CODES,
  STATUS_LABELS,
  WORKSPACE_SCHEMA_VERSION,
  type Player,
  type PendingImport,
  type PositionCode,
  type Scenario,
  type Workspace,
} from "./types";
import {
  createEmptyAssignments,
} from "./base";
import {
  sanitizePlayers,
  sanitizeScenario,
  sanitizeWorkspace,
} from "./sanitizers";

// ── Query helpers ──

export function getActiveScenario(workspace: Workspace): Scenario {
  return (
    workspace.scenarios.find(
      (scenario) => scenario.id === workspace.activeScenarioId,
    ) ?? workspace.scenarios[0]
  );
}

export function getPlayer(workspace: Workspace, id: string | null | undefined) {
  if (!id) {
    return null;
  }

  return workspace.players.find((player) => player.id === id) ?? null;
}

export function getPlayerAssignmentState(
  scenario: Scenario,
  playerId: string,
) {
  return {
    defense: Object.values(scenario.assignments.defense).includes(playerId),
    lineup: scenario.assignments.lineup.includes(playerId),
  };
}

// ── Name generation ──

export function createUniqueScenarioName(
  baseName: string,
  scenarios: Scenario[],
  suffix = "",
) {
  const trimmed = (baseName || "未命名方案").trim().slice(0, 24);
  const existingNames = new Set(scenarios.map((scenario) => scenario.name));
  const baseCandidate = (suffix ? `${trimmed}${suffix}` : trimmed).slice(0, 24);

  if (!existingNames.has(baseCandidate)) {
    return baseCandidate;
  }

  let index = 2;
  const maxIndex = 99;
  const suffixMaxLen = String(maxIndex).length + 1;
  const truncatedBase = baseCandidate.slice(0, 24 - suffixMaxLen);
  while (existingNames.has(`${truncatedBase} ${index}`) && index <= maxIndex) {
    index += 1;
  }

  return `${truncatedBase} ${index}`.slice(0, 24);
}

// ── Mutation helpers ──

export function removePlayersFromWorkspace(draft: Workspace, ids: string[]) {
  const idSet = new Set(ids);
  draft.players = draft.players.filter((player) => !idSet.has(player.id));
  draft.scenarios.forEach((scenario) => {
    POSITION_CODES.forEach((position) => {
      if (scenario.assignments.defense[position] && idSet.has(scenario.assignments.defense[position]!)) {
        scenario.assignments.defense[position] = null;
      }
    });
    scenario.assignments.lineup = scenario.assignments.lineup.map((playerId) =>
      playerId && idSet.has(playerId) ? null : playerId,
    );
    scenario.updatedAt = new Date().toISOString();
  });
}

// ── Auto-assignment ──

export function getPreferredBattingSlots(
  player: Player,
  assignedPosition?: PositionCode,
) {
  const isBattery = assignedPosition === "P" || assignedPosition === "C";
  if (isBattery) {
    return [7, 8, 5, 6, 4, 3, 2, 1, 0];
  }
  if (player.bats === "S") {
    return [0, 1, 5, 2, 3, 4, 6, 7, 8];
  }
  if (player.bats === "L") {
    return [1, 4, 6, 0, 2, 3, 5, 7, 8];
  }
  return [2, 3, 7, 8, 0, 1, 4, 5, 6];
}

export function buildAutoScenario(
  workspace: Workspace,
  currentScenario: Scenario,
): Scenario {
  const availablePlayers = workspace.players.filter(
    (player) => player.status === "available",
  );
  const remaining = [...availablePlayers];
  const defense = createEmptyAssignments().defense;

  DEFENSE_PRIORITY.forEach((positionCode) => {
    const candidates = remaining
      .filter((player) => player.positions.includes(positionCode))
      .sort((a, b) => {
        const aPrimary = a.positions[0] === positionCode ? 1 : 0;
        const bPrimary = b.positions[0] === positionCode ? 1 : 0;
        if (aPrimary !== bPrimary) {
          return bPrimary - aPrimary;
        }
        if (a.positions.length !== b.positions.length) {
          return a.positions.length - b.positions.length;
        }
        return a.number.localeCompare(b.number);
      });

    const chosen = candidates[0];
    if (!chosen) {
      return;
    }

    defense[positionCode] = chosen.id;
    const chosenIndex = remaining.findIndex((player) => player.id === chosen.id);
    if (chosenIndex >= 0) {
      remaining.splice(chosenIndex, 1);
    }
  });

  const lineup: Array<string | null> = Array(9).fill(null);
  const assignedPlayerIds = Object.values(defense).filter(
    (playerId): playerId is string => Boolean(playerId),
  );
  const defenseByPlayer = Object.fromEntries(
    Object.entries(defense)
      .filter((entry): entry is [PositionCode, string] => Boolean(entry[1]))
      .map(([position, playerId]) => [playerId, position as PositionCode]),
  ) as Record<string, PositionCode>;

  assignedPlayerIds.forEach((playerId) => {
    const player = getPlayer(workspace, playerId);
    if (!player) {
      return;
    }

    const preferredSlots = getPreferredBattingSlots(
      player,
      defenseByPlayer[playerId],
    );
    const targetSlot = preferredSlots.find((slot) => lineup[slot] === null);
    const fallbackSlot = lineup.findIndex((slot) => slot === null);
    const finalSlot = targetSlot ?? fallbackSlot;

    if (finalSlot >= 0) {
      lineup[finalSlot] = playerId;
    }
  });

  return {
    ...currentScenario,
    assignments: {
      defense,
      lineup,
    },
  };
}

// ── Warning analysis ──

function findRepeatedIds(ids: string[]) {
  const counts = ids.reduce((map, id) => {
    map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
}

function formatPlayerName(workspace: Workspace, id: string) {
  const player = getPlayer(workspace, id);
  return player ? player.name : "未知球员";
}

export function analyzeScenarioWarnings(
  workspace: Workspace,
  scenario: Scenario,
) {
  const critical: string[] = [];
  const advisory: string[] = [];
  const defenseEntries = Object.entries(scenario.assignments.defense) as Array<
    [PositionCode, string | null]
  >;
  const defenseIds = defenseEntries
    .map(([, playerId]) => playerId)
    .filter((playerId): playerId is string => Boolean(playerId));
  const lineupIds = scenario.assignments.lineup.filter(
    (playerId): playerId is string => Boolean(playerId),
  );
  const uniqueAssignedIds = Array.from(new Set([...defenseIds, ...lineupIds]));
  const missingPositions = defenseEntries
    .filter(([, playerId]) => !playerId)
    .map(([position]) => position);
  const repeatedDefense = findRepeatedIds(defenseIds).map((id) =>
    formatPlayerName(workspace, id),
  );
  const unavailablePlayers = uniqueAssignedIds
    .map((id) => getPlayer(workspace, id))
    .filter(
      (player): player is Player =>
        Boolean(player && player.status !== "available"),
    );

  if (missingPositions.length) {
    critical.push(`守位未满：${missingPositions.join("、")}`);
  }
  if (lineupIds.length < 9) {
    critical.push(`棒次未满：还缺 ${9 - lineupIds.length} 人`);
  }
  if (repeatedDefense.length) {
    critical.push(`同一球员重复占用守位：${repeatedDefense.join("、")}`);
  }
  if (unavailablePlayers.length) {
    critical.push(
      `非可上场球员已进入阵容：${unavailablePlayers
        .map((player) => `${player.name}（${STATUS_LABELS[player.status]}）`)
        .join("、")}`,
    );
  }

  defenseEntries.forEach(([position, playerId]) => {
    const player = getPlayer(workspace, playerId);
    if (player && !player.positions.includes(position)) {
      advisory.push(
        `${player.name} 当前被放在 ${position}，但他的可守位置不包含该守位`,
      );
    }
  });

  scenario.assignments.lineup.slice(0, 2).forEach((playerId, index) => {
    if (!playerId) {
      return;
    }

    const defensePosition = defenseEntries.find(
      ([, assignedId]) => assignedId === playerId,
    )?.[0];
    if (defensePosition === "P" || defensePosition === "C") {
      advisory.push(
        `第 ${index + 1} 棒是 ${defensePosition}，建议确认是否需要把投手或捕手前置`,
      );
    }
  });

  return { critical, advisory };
}

// ── Import / Export ──

export function prepareImport(
  workspace: Workspace,
  payload: unknown,
  fileName: string,
): PendingImport {
  const source = payload as {
    type?: string;
    version?: number;
    players?: unknown[];
    scenarios?: unknown[];
    activeScenarioId?: string;
    scenario?: unknown;
  };

  if (source?.type === "workspace" && source?.version === WORKSPACE_SCHEMA_VERSION) {
    const candidate = sanitizeWorkspace({
      version: WORKSPACE_SCHEMA_VERSION,
      players: source.players,
      scenarios: source.scenarios,
      activeScenarioId: source.activeScenarioId,
      preferences: workspace.preferences,
    });

    return {
      type: "workspace",
      fileName,
      workspace: candidate,
      names: candidate.scenarios.map((scenario) => scenario.name),
      summary: `将用 ${fileName} 替换当前工作区。帮助已读状态会保留在本地。`,
    };
  }

  if (source?.type === "scenario" && source?.version === WORKSPACE_SCHEMA_VERSION) {
    const importedPlayers = sanitizePlayers(
      Array.isArray(source.players) ? source.players : [],
    );
    const importedScenario = sanitizeScenario(
      source.scenario,
      new Set(importedPlayers.map((player) => player.id)),
    );

    if (!importedScenario) {
      throw new Error("invalid scenario payload");
    }

    return {
      type: "scenario",
      fileName,
      scenario: importedScenario,
      players: importedPlayers,
      names: [importedScenario.name],
      summary: `将把 ${fileName} 追加为新方案，并合并它引用到的球员。`,
    };
  }

  throw new Error("unsupported payload");
}

// ── Formatting ──

export function formatDateTime(isoString: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function timestampFilePart() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "-",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
}
