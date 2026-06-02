import {
  buildAutoScenario,
  createId,
  createUniqueScenarioName,
  prepareImport,
  type Scenario,
  timestampFilePart,
  type PendingImport,
  type Workspace,
} from "@/lib/workspace";

export function downloadJson(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportWorkspace(workspace: Workspace, showToast: (msg: string) => void) {
  downloadJson(`baseball-workspace-${timestampFilePart()}.json`, {
    type: "workspace",
    version: 2,
    exportedAt: new Date().toISOString(),
    players: workspace.players,
    scenarios: workspace.scenarios,
    activeScenarioId: workspace.activeScenarioId,
  });
  showToast("工作区 JSON 已导出");
}

export function exportScenario(
  workspace: Workspace,
  getActiveScenario: () => Scenario,
  showToast: (msg: string) => void,
) {
  const activeScenario = getActiveScenario();
  const referencedIds = new Set([
    ...Object.values(activeScenario.assignments.defense).filter(Boolean),
    ...activeScenario.assignments.lineup.filter(Boolean),
  ]);
  const players = workspace.players.filter((player) => referencedIds.has(player.id));
  downloadJson(`baseball-scenario-${timestampFilePart()}.json`, {
    type: "scenario",
    version: 2,
    exportedAt: new Date().toISOString(),
    players,
    scenario: activeScenario,
  });
  showToast("当前方案 JSON 已导出");
}

export function autoAssignScenario(
  workspace: Workspace,
  getActiveScenario: () => Scenario,
  commitWorkspace: (mutator: (draft: Workspace) => Workspace | void, options?: { message?: string }) => boolean,
) {
  const activeScenario = getActiveScenario();
  const nextScenario = buildAutoScenario(workspace, activeScenario);
  commitWorkspace((draft) => {
    const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
    scenario.assignments = nextScenario.assignments;
    scenario.updatedAt = new Date().toISOString();
  }, { message: "已生成自动排阵初稿" });
}

export type ImportContext = {
  workspace: Workspace;
  pendingImport: PendingImport | null;
  setPendingImport: (pending: PendingImport | null) => void;
  showToast: (msg: string) => void;
  commitWorkspace: (mutator: (draft: Workspace) => Workspace | void, options?: { message?: string }) => boolean;
  els: {
    importInput: HTMLInputElement;
    importDialog: HTMLDialogElement;
  };
};

export async function handleImportFile(
  event: Event,
  ctx: ImportContext,
  renderImportPreview: () => void,
) {
  const file = (event.currentTarget as HTMLInputElement).files?.[0];
  if (!file) {
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    ctx.setPendingImport(prepareImport(ctx.workspace, parsed, file.name));
    renderImportPreview();
    ctx.els.importDialog.showModal();
  } catch {
    ctx.setPendingImport(null);
    ctx.showToast("导入失败：JSON 无法识别");
  }
}

export function appendImportedScenario(ctx: ImportContext) {
  if (!ctx.pendingImport || ctx.pendingImport.type !== "scenario") {
    return;
  }
  const scenarioImport = ctx.pendingImport;
  ctx.commitWorkspace((draft) => {
    scenarioImport.players.forEach((incomingPlayer) => {
      const index = draft.players.findIndex((player) => player.id === incomingPlayer.id);
      if (index >= 0) {
        draft.players[index] = incomingPlayer;
      } else {
        draft.players.push(incomingPlayer);
      }
    });
    const scenario = structuredClone(scenarioImport.scenario);
    scenario.id = createId();
    scenario.name = createUniqueScenarioName(
      `${scenario.name}（导入）`,
      draft.scenarios,
      "",
    );
    scenario.createdAt = new Date().toISOString();
    scenario.updatedAt = scenario.createdAt;
    draft.scenarios.push(scenario);
    draft.activeScenarioId = scenario.id;
  }, { message: "导入方案已追加" });

  ctx.setPendingImport(null);
  ctx.els.importDialog.close();
}

export function replaceWorkspaceFromImport(ctx: ImportContext) {
  if (!ctx.pendingImport || ctx.pendingImport.type !== "workspace") {
    return;
  }
  const workspaceImport = ctx.pendingImport;

  ctx.commitWorkspace(() => {
    workspaceImport.workspace.preferences = structuredClone(ctx.workspace.preferences);
    return workspaceImport.workspace;
  }, { message: "工作区已从导入内容恢复" });

  ctx.setPendingImport(null);
  ctx.els.importDialog.close();
}
