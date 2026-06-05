import {
  createDefaultWorkspace,
  createId,
  createUniqueScenarioName,
  getActiveScenario,
  HAND_LABELS,
  prepareImport,
  STATUS_LABELS,
  WORKSPACE_SCHEMA_VERSION,
  type PendingImport,
  type ScenarioExportPayload,
  type Workspace,
  type WorkspaceExportPayload,
} from "@/lib/workspace";

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function uniqueNewPlayersById(current: Workspace, pending: PendingImport) {
  if (pending.type !== "scenario") {
    return [];
  }

  const currentIds = new Set(current.players.map((player) => player.id));
  return pending.players.filter((player) => !currentIds.has(player.id));
}

export function buildWorkspaceExport(workspace: Workspace): WorkspaceExportPayload {
  return {
    type: "workspace",
    version: WORKSPACE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    players: workspace.players,
    scenarios: workspace.scenarios,
    activeScenarioId: workspace.activeScenarioId,
  };
}

export function buildScenarioExport(
  workspace: Workspace,
  scenarioId?: string,
): ScenarioExportPayload {
  const scenario = scenarioId
    ? workspace.scenarios.find((item) => item.id === scenarioId)
    : getActiveScenario(workspace);

  if (!scenario) {
    throw new Error("scenario not found");
  }

  const referencedIds = new Set([
    ...Object.values(scenario.assignments.defense).filter(Boolean),
    ...scenario.assignments.lineup.filter(Boolean),
  ]);

  return {
    type: "scenario",
    version: WORKSPACE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    players: workspace.players.filter((player) => referencedIds.has(player.id)),
    scenario,
  };
}

export function buildCsvExport(workspace: Workspace): string {
  const header = "背号,姓名,状态,守位,打击,投球";
  const rows = workspace.players.map((player) => {
    return [
      csvEscape(player.number),
      csvEscape(player.name),
      csvEscape(STATUS_LABELS[player.status]),
      csvEscape(player.positions.join(",")),
      csvEscape(HAND_LABELS[player.bats]),
      csvEscape(HAND_LABELS[player.throws]),
    ].join(",");
  });

  return `\uFEFF${[header, ...rows].join("\n")}`;
}

export function parseImportPayload(value: unknown): PendingImport {
  return prepareImport(createDefaultWorkspace(false), value, "import.json");
}

export function applyWorkspaceImport(_current: Workspace, pending: PendingImport): Workspace {
  if (pending.type !== "workspace") {
    throw new Error("pending import is not a workspace payload");
  }

  return pending.workspace;
}

export function applyScenarioImport(current: Workspace, pending: PendingImport): Workspace {
  if (pending.type !== "scenario") {
    throw new Error("pending import is not a scenario payload");
  }

  const workspace = structuredClone(current);
  const newPlayers = uniqueNewPlayersById(current, pending);
  workspace.players.push(...newPlayers);

  const scenario = structuredClone(pending.scenario);
  if (workspace.scenarios.some((item) => item.id === scenario.id)) {
    scenario.id = createId();
  }
  if (workspace.scenarios.some((item) => item.name === scenario.name)) {
    scenario.name = createUniqueScenarioName(scenario.name, workspace.scenarios, "");
  }

  workspace.scenarios.push(scenario);
  return workspace;
}
