import { createElement } from "react";
import { createRoot, type Root as ReactRoot } from "react-dom/client";

import { PlayerProfileEditor } from "@/components/player-profile-editor";
import {
  analyzeScenarioWarnings,
  escapeHtml,
  formatDateTime,
  getActiveScenario,
  HAND_LABELS,
  getPlayer,
  getPlayerAssignmentState,
  POSITIONS,
  STATUS_LABELS,
  type Player,
  type PositionCode,
  type Scenario,
  type Workspace,
} from "@/lib/workspace";

export type RenderContext = {
  workspace: Workspace;
  historyState: { undo: Workspace[]; redo: Workspace[] };
  selectedIds: Set<string>;
  activeProfileId: string | null;
  remoteVersion: number;
  els: {
    workspaceVersionChip: HTMLElement;
    scenarioCountChip: HTMLElement;
    historyChip: HTMLElement;
    workspacePlayerChip: HTMLElement;
    activeScenarioBadge: HTMLElement;
    scenarioSelect: HTMLSelectElement;
    scenarioCountInline: HTMLElement;
    scenarioNameDisplay: HTMLElement;
    scenarioNoteDisplay: HTMLElement;
    scenarioTimeDisplay: HTMLElement;
    deleteScenarioBtn: HTMLButtonElement;
    playerCount: HTMLElement;
    defenseCount: HTMLElement;
    lineupCount: HTMLElement;
    selectedCount: HTMLElement;
    defenseStat: HTMLElement;
    lineupStat: HTMLElement;
    availableStat: HTMLElement;
    playerList: HTMLElement;
    field: HTMLElement;
    lineupList: HTMLElement;
    warningSummary: HTMLElement;
    warnings: HTMLElement;
    undoBtn: HTMLButtonElement;
    redoBtn: HTMLButtonElement;
    clearSelectionBtn: HTMLButtonElement;
    selectFilteredBtn: HTMLButtonElement;
    bulkEditBtn: HTMLButtonElement;
    bulkDeleteBtn: HTMLButtonElement;
    importSummary: HTMLElement;
    importTypeValue: HTMLElement;
    importScenarioCountValue: HTMLElement;
    importPlayerCountValue: HTMLElement;
    importNameList: HTMLElement;
    appendImportBtn: HTMLButtonElement;
    replaceImportBtn: HTMLButtonElement;
  };
  onCommitWorkspace: (mutator: (draft: Workspace) => Workspace | void, options?: { message?: string; recordHistory?: boolean }) => boolean;
  onOpenProfile: (playerId: string) => void;
  onCloseProfile: () => void;
  profileDrawerRoot: ReactRoot;
  lastDrawerPlayer: { current: Player | null };
  lastDrawerPlayerJson: { current: string };
};

export function renderHeader(ctx: RenderContext) {
  const activeScenario = getActiveScenario(ctx.workspace);
  ctx.els.workspaceVersionChip.textContent = "Workspace v2";
  ctx.els.scenarioCountChip.textContent = `${ctx.workspace.scenarios.length} 套方案`;
  ctx.els.workspacePlayerChip.textContent = `${ctx.workspace.players.length} 名球员`;
  ctx.els.historyChip.textContent = `撤销 ${ctx.historyState.undo.length} / 重做 ${ctx.historyState.redo.length}`;
  ctx.els.activeScenarioBadge.textContent = activeScenario.name;
}

export function renderScenarioControls(ctx: RenderContext) {
  const activeScenario = getActiveScenario(ctx.workspace);
  ctx.els.scenarioSelect.innerHTML = ctx.workspace.scenarios
    .map((scenario) => {
      const selected = scenario.id === activeScenario.id ? "selected" : "";
      return `<option value="${scenario.id}" ${selected}>${escapeHtml(scenario.name)}</option>`;
    })
    .join("");
  ctx.els.scenarioCountInline.textContent = `${ctx.workspace.scenarios.length} 套`;
  ctx.els.scenarioNameDisplay.textContent = activeScenario.name;
  ctx.els.scenarioNoteDisplay.textContent =
    activeScenario.note ||
    "保存不同比赛构想，对左投、守备优先和常规先发可以分别留一套。";
  ctx.els.scenarioTimeDisplay.textContent = `创建于 ${formatDateTime(activeScenario.createdAt)} · 更新于 ${formatDateTime(activeScenario.updatedAt)}`;
  ctx.els.deleteScenarioBtn.disabled = ctx.workspace.scenarios.length <= 1;
}

export function renderField(ctx: RenderContext) {
  const activeScenario = getActiveScenario(ctx.workspace);
  ctx.els.field.innerHTML = `
    <div class="outfield-stripe"></div>
    <div class="foul-line left"></div>
    <div class="foul-line right"></div>
    <div class="baseline first"></div>
    <div class="baseline third"></div>
    <div class="infield-dirt"></div>
    <div class="mound"></div>
    <div class="base home"></div>
    <div class="base first"></div>
    <div class="base second"></div>
    <div class="base third"></div>
    ${POSITIONS.map((position) => renderFieldZone(position.code, activeScenario, ctx.workspace)).join("")}
  `;
}

function renderFieldZone(positionCode: PositionCode, activeScenario: Scenario, workspace: Workspace) {
  const position = POSITIONS.find((item) => item.code === positionCode)!;
  const player = getPlayer(workspace, activeScenario.assignments.defense[position.code]);
  const filledClass = player ? " filled" : "";
  const content = player
    ? `<div class="zone-name" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</div><div class="zone-number">#${escapeHtml(player.number)}</div>`
    : `<div class="empty-label">${position.label}</div>`;

  return `
    <button class="field-zone${filledClass}" type="button" data-position="${position.code}" style="left:${position.x}%; top:${position.y}%;">
      <span class="zone-code">${position.code}</span>
      <span class="zone-player">${content}</span>
      <span class="clear-zone">清空</span>
    </button>
  `;
}

export function renderLineup(ctx: RenderContext) {
  const activeScenario = getActiveScenario(ctx.workspace);
  ctx.els.lineupList.innerHTML = activeScenario.assignments.lineup
    .map((playerId, index) => {
      const player = getPlayer(ctx.workspace, playerId);
      const draggable = player ? ' draggable="true"' : "";
      const content = player
        ? `<div class="lineup-name" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</div><div class="lineup-meta">#${escapeHtml(player.number)} / ${player.positions.join(", ") || "未设守位"}</div>`
        : '<div class="empty-label">空棒次</div>';
      const tools = player
        ? `<button class="btn icon secondary" type="button" title="清空" data-clear-lineup="${index}">×</button>`
        : "";

      return `
        <article class="lineup-slot" data-lineup-index="${index}"${draggable}>
          <div class="bat-order">${index + 1}</div>
          <div class="lineup-player">${content}</div>
          <div class="lineup-tools">${tools}</div>
        </article>
      `;
    })
    .join("");
}

export function renderStats(ctx: RenderContext) {
  const activeScenario = getActiveScenario(ctx.workspace);
  const defenseFilled = Object.values(activeScenario.assignments.defense).filter(Boolean).length;
  const lineupFilled = activeScenario.assignments.lineup.filter(Boolean).length;
  const available = ctx.workspace.players.filter((player) => player.status === "available").length;
  ctx.els.defenseCount.textContent = `${defenseFilled} / 9`;
  ctx.els.lineupCount.textContent = `${lineupFilled} / 9`;
  ctx.els.defenseStat.textContent = String(defenseFilled);
  ctx.els.lineupStat.textContent = String(lineupFilled);
  ctx.els.availableStat.textContent = String(available);
}

export function renderWarnings(ctx: RenderContext) {
  const activeScenario = getActiveScenario(ctx.workspace);
  const analysis = analyzeScenarioWarnings(ctx.workspace, activeScenario);
  ctx.els.warningSummary.innerHTML = [
    `<span class="small-chip critical-chip">强提醒 ${analysis.critical.length}</span>`,
    `<span class="small-chip advisory-chip">建议 ${analysis.advisory.length}</span>`,
  ].join("");

  if (!analysis.critical.length && !analysis.advisory.length) {
    ctx.els.warnings.innerHTML = '<div class="ok-item">阵容规则检查通过</div>';
    return;
  }

  const groups: string[] = [];
  if (analysis.critical.length) {
    groups.push(`
      <section class="warning-group">
        <div class="warning-heading"><span>强提醒</span><span>${analysis.critical.length} 条</span></div>
        ${analysis.critical.map((warning) => `<div class="warning-item critical">${escapeHtml(warning)}</div>`).join("")}
      </section>
    `);
  }
  if (analysis.advisory.length) {
    groups.push(`
      <section class="warning-group">
        <div class="warning-heading"><span>建议提醒</span><span>${analysis.advisory.length} 条</span></div>
        ${analysis.advisory.map((warning) => `<div class="warning-item advisory">${escapeHtml(warning)}</div>`).join("")}
      </section>
    `);
  }
  ctx.els.warnings.innerHTML = groups.join("");
}

export function generatePlayerCardsHtml(
  players: Player[],
  selectedIds: Set<string>,
  activeScenario: Scenario,
): string {
  if (!players.length) {
    return '<div class="empty-state">没有匹配的球员</div>';
  }

  const defenseAssignments = activeScenario.assignments.defense;
  return players
    .map((player) => {
      const selected = selectedIds.has(player.id) ? " selected" : "";
      const positions = player.positions
        .map((position) => `<span class="position-pill">${position}</span>`)
        .join("");
      const assignmentPills: string[] = [];
      const defensePosition = (Object.entries(defenseAssignments) as Array<
        [PositionCode, string | null]
      >).find(([, playerId]) => playerId === player.id)?.[0];
      const lineupIndex = activeScenario.assignments.lineup.findIndex(
        (playerId) => playerId === player.id,
      );
      if (defensePosition) {
        assignmentPills.push(`<span class="assignment-pill">守 ${defensePosition}</span>`);
      }
      if (lineupIndex >= 0) {
        assignmentPills.push(`<span class="assignment-pill">第 ${lineupIndex + 1} 棒</span>`);
      }

      return `
        <article class="player-card${selected}" draggable="true" data-player-id="${player.id}">
          <input class="player-select" type="checkbox" aria-label="选择 ${escapeHtml(player.name)}" data-select-id="${player.id}" ${selected ? "checked" : ""}>
          <div class="number-badge">${escapeHtml(player.number)}</div>
          <div class="player-main">
            <div class="player-name-row">
              <div class="player-name" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</div>
              <span class="status-chip ${player.status}">${STATUS_LABELS[player.status]}</span>
            </div>
            <div class="player-meta">打 ${HAND_LABELS[player.bats]} / 投 ${HAND_LABELS[player.throws]}</div>
            <div class="position-pills">${positions}${assignmentPills.join("")}</div>
            <div class="player-actions">
              <button class="link-btn" type="button" data-profile-id="${player.id}">档案</button>
              <button class="link-btn" type="button" data-edit-id="${player.id}">编辑</button>
              <button class="link-btn danger" type="button" data-delete-id="${player.id}">删除</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderProfileDrawer(ctx: RenderContext) {
  const player = ctx.activeProfileId ? getPlayer(ctx.workspace, ctx.activeProfileId) : null;
  if (ctx.activeProfileId && !player) {
    ctx.onCloseProfile();
    return;
  }

  if (!ctx.activeProfileId || !player) {
    ctx.profileDrawerRoot.render(null);
    ctx.lastDrawerPlayer.current = null;
    ctx.lastDrawerPlayerJson.current = "";
    return;
  }

  const playerJson = JSON.stringify(player);
  if (playerJson !== ctx.lastDrawerPlayerJson.current) {
    ctx.lastDrawerPlayer.current = player;
    ctx.lastDrawerPlayerJson.current = playerJson;
  }

  ctx.profileDrawerRoot.render(
    createElement(PlayerProfileEditor, {
      key: `${player.id}:${ctx.remoteVersion}:${ctx.lastDrawerPlayerJson.current}`,
      player: ctx.lastDrawerPlayer.current!,
      variant: "drawer",
      statusMessage: "抽屉保存后会立即回写当前工作区",
      onClose: ctx.onCloseProfile,
      onOpenPage: () => {
        if (ctx.activeProfileId) {
          window.open(`/players/${ctx.activeProfileId}`, "_blank", "noopener,noreferrer");
        }
      },
      onSave: async (nextPlayer: Player) => {
        ctx.onCommitWorkspace((draft) => {
          const index = draft.players.findIndex((item) => item.id === nextPlayer.id);
          if (index >= 0) {
            draft.players[index] = nextPlayer;
          }
        }, { message: "球员档案已保存" });
      },
    }),
  );
}

export function renderImportPreview(
  pendingImport: {
    summary: string;
    type: "workspace" | "scenario";
    workspace?: { scenarios: unknown[]; players: unknown[] };
    players?: unknown[];
    scenario?: unknown;
    names: string[];
  } | null,
  els: RenderContext["els"],
) {
  if (!pendingImport) {
    return;
  }
  els.importSummary.textContent = pendingImport.summary;
  els.importTypeValue.textContent =
    pendingImport.type === "workspace" ? "工作区" : "单方案";
  els.importScenarioCountValue.textContent =
    pendingImport.type === "workspace"
      ? String(pendingImport.workspace!.scenarios.length)
      : "1";
  els.importPlayerCountValue.textContent =
    pendingImport.type === "workspace"
      ? String(pendingImport.workspace!.players.length)
      : String(pendingImport.players!.length);
  els.importNameList.innerHTML = pendingImport.names
    .map((name) => `<div>${escapeHtml(name)}</div>`)
    .join("");
  els.appendImportBtn.hidden = pendingImport.type !== "scenario";
  els.replaceImportBtn.hidden = pendingImport.type !== "workspace";
}
