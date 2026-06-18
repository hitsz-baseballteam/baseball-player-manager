import type {
  Game,
  Milestone,
  Player,
  Scenario,
  ScenarioAssignments,
  Workspace,
} from "@/lib/workspace";
import type { BulkEditInput } from "@/lib/roster-actions";

export type WorkspaceSnapshot = {
  workspace: Workspace;
  version: number;
  updatedAt: string;
};

export class VersionConflictError extends Error {
  constructor() {
    super("version_conflict");
  }
}

export class MaintenanceReadOnlyError extends Error {
  constructor() {
    super("maintenance_read_only");
  }
}

async function parseWorkspaceResponse(response: Response) {
  if (response.status === 409) {
    throw new VersionConflictError();
  }
  if (response.status === 503) {
    throw new MaintenanceReadOnlyError();
  }
  if (!response.ok) {
    throw new Error(`Failed to save workspace: ${response.status}`);
  }

  return response.json() as Promise<WorkspaceSnapshot>;
}

async function sendWorkspaceRequest(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  return parseWorkspaceResponse(response);
}

export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const response = await fetch("/api/workspace", {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Failed to load workspace: ${response.status}`);
  }

  return response.json();
}

export async function createPlayer(player: Player, version: number) {
  return sendWorkspaceRequest("/api/players", "POST", { player, version });
}

export async function updatePlayer(player: Player, version: number) {
  return sendWorkspaceRequest(`/api/players/${encodeURIComponent(player.id)}`, "PATCH", {
    player,
    version,
  });
}

export async function deletePlayer(playerId: string, version: number) {
  return sendWorkspaceRequest(`/api/players/${encodeURIComponent(playerId)}`, "DELETE", {
    version,
  });
}

export async function bulkUpdatePlayers(ids: string[], input: BulkEditInput, version: number) {
  return sendWorkspaceRequest("/api/players/bulk-update", "POST", {
    ids,
    input,
    version,
  });
}

export async function bulkDeletePlayers(ids: string[], version: number) {
  return sendWorkspaceRequest("/api/players/bulk-delete", "POST", {
    ids,
    version,
  });
}

export async function createScenario(scenario: Scenario, version: number, activate = false) {
  return sendWorkspaceRequest("/api/scenarios", "POST", {
    scenario,
    activate,
    version,
  });
}

export async function updateScenario(scenarioId: string, name: string, note: string, version: number) {
  return sendWorkspaceRequest(`/api/scenarios/${encodeURIComponent(scenarioId)}`, "PATCH", {
    name,
    note,
    version,
  });
}

export async function deleteScenario(scenarioId: string, version: number) {
  return sendWorkspaceRequest(`/api/scenarios/${encodeURIComponent(scenarioId)}`, "DELETE", {
    version,
  });
}

export async function activateScenario(scenarioId: string, version: number) {
  return sendWorkspaceRequest(`/api/scenarios/${encodeURIComponent(scenarioId)}/activate`, "POST", {
    version,
  });
}

export async function updateScenarioAssignments(
  scenarioId: string,
  assignments: ScenarioAssignments,
  version: number,
  updatedAt?: string,
) {
  return sendWorkspaceRequest(`/api/scenarios/${encodeURIComponent(scenarioId)}/assignments`, "PUT", {
    assignments,
    updatedAt,
    version,
  });
}

export async function createGame(game: Game, version: number) {
  return sendWorkspaceRequest("/api/games", "POST", { game, version });
}

export async function updateGame(game: Game, version: number) {
  return sendWorkspaceRequest(`/api/games/${encodeURIComponent(game.id)}`, "PATCH", {
    game,
    version,
  });
}

export async function deleteGame(gameId: string, version: number) {
  return sendWorkspaceRequest(`/api/games/${encodeURIComponent(gameId)}`, "DELETE", {
    version,
  });
}

export async function createWorkspaceMilestone(milestone: Milestone, version: number) {
  return sendWorkspaceRequest("/api/milestones", "POST", { milestone, version });
}

export async function updateWorkspaceMilestone(milestone: Milestone, version: number) {
  return sendWorkspaceRequest(`/api/milestones/${encodeURIComponent(milestone.id)}`, "PATCH", {
    milestone,
    version,
  });
}

export async function deleteWorkspaceMilestone(milestoneId: string, version: number) {
  return sendWorkspaceRequest(`/api/milestones/${encodeURIComponent(milestoneId)}`, "DELETE", {
    version,
  });
}

export async function updateWorkspacePreferences(helpDismissed: boolean, version: number) {
  return sendWorkspaceRequest("/api/workspace/preferences", "PATCH", {
    helpDismissed,
    version,
  });
}

export async function importWorkspaceSnapshot(workspace: Workspace, version: number) {
  return sendWorkspaceRequest("/api/workspace/import", "POST", {
    workspace,
    version,
  });
}

export async function resetWorkspace(helpDismissed: boolean, version: number) {
  return sendWorkspaceRequest("/api/workspace/reset", "POST", {
    helpDismissed,
    version,
  });
}

export async function submitMutationWithRetry(
  currentWorkspace: Workspace,
  currentVersion: number,
  applyMutation: (latest: Workspace) => Workspace,
  submit: (nextWorkspace: Workspace, version: number) => Promise<WorkspaceSnapshot>,
  maxRetries = 3,
): Promise<WorkspaceSnapshot> {
  let version = currentVersion;
  let latest = currentWorkspace;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (attempt > 0) {
      const snapshot = await loadWorkspaceSnapshot();
      latest = snapshot.workspace;
      version = snapshot.version;
    }

    const nextWorkspace = applyMutation(latest);
    try {
      return await submit(nextWorkspace, version);
    } catch (error) {
      if (!isVersionConflict(error) || attempt >= maxRetries) {
        throw error;
      }
    }
  }

  throw new VersionConflictError();
}

export function isVersionConflict(error: unknown) {
  return error instanceof VersionConflictError;
}

export function isMaintenanceReadOnly(error: unknown) {
  return error instanceof MaintenanceReadOnlyError;
}
