import {
  analyzeScenarioWarnings,
  buildAutoScenario,
  cloneWorkspace,
  createDefaultWorkspace,
  createEmptyAssignments,
  createId,
  createScenario,
  createUniqueScenarioName,
  escapeHtml,
  formatDateTime,
  getActiveScenario,
  getPlayer,
  getPlayerAssignmentState,
  GUIDE_STEPS,
  HAND_LABELS,
  HISTORY_LIMIT,
  POSITIONS,
  prepareImport,
  removePlayersFromWorkspace,
  sanitizePositions,
  sanitizeWorkspace,
  STATUS_LABELS,
  timestampFilePart,
  type PendingImport,
  type PositionCode,
  type Scenario,
  type Workspace,
} from "@/lib/workspace";

type WorkspaceSnapshot = {
  workspace: Workspace;
  version: number;
  updatedAt: string;
};

type Elements = {
  saveStatus: HTMLElement;
  workspaceVersionChip: HTMLElement;
  scenarioCountChip: HTMLElement;
  historyChip: HTMLElement;
  workspacePlayerChip: HTMLElement;
  activeScenarioBadge: HTMLElement;
  playerCount: HTMLElement;
  defenseCount: HTMLElement;
  lineupCount: HTMLElement;
  selectedCount: HTMLElement;
  scenarioCountInline: HTMLElement;
  scenarioSelect: HTMLSelectElement;
  scenarioNameDisplay: HTMLElement;
  scenarioNoteDisplay: HTMLElement;
  scenarioTimeDisplay: HTMLElement;
  warningSummary: HTMLElement;
  searchInput: HTMLInputElement;
  positionFilter: HTMLSelectElement;
  statusFilter: HTMLSelectElement;
  batsFilter: HTMLSelectElement;
  throwsFilter: HTMLSelectElement;
  assignmentFilter: HTMLSelectElement;
  playerList: HTMLElement;
  field: HTMLElement;
  defenseStat: HTMLElement;
  lineupStat: HTMLElement;
  availableStat: HTMLElement;
  lineupList: HTMLElement;
  warnings: HTMLElement;
  addPlayerBtn: HTMLButtonElement;
  autoAssignBtn: HTMLButtonElement;
  undoBtn: HTMLButtonElement;
  redoBtn: HTMLButtonElement;
  exportWorkspaceBtn: HTMLButtonElement;
  exportScenarioBtn: HTMLButtonElement;
  importBtn: HTMLButtonElement;
  importInput: HTMLInputElement;
  clearAssignmentsBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  helpBtn: HTMLButtonElement;
  clearSelectionBtn: HTMLButtonElement;
  selectFilteredBtn: HTMLButtonElement;
  bulkEditBtn: HTMLButtonElement;
  bulkDeleteBtn: HTMLButtonElement;
  newScenarioBtn: HTMLButtonElement;
  renameScenarioBtn: HTMLButtonElement;
  duplicateScenarioBtn: HTMLButtonElement;
  deleteScenarioBtn: HTMLButtonElement;
  playerDialog: HTMLDialogElement;
  playerForm: HTMLFormElement;
  dialogTitle: HTMLElement;
  playerId: HTMLInputElement;
  playerName: HTMLInputElement;
  playerNumber: HTMLInputElement;
  playerBats: HTMLSelectElement;
  playerThrows: HTMLSelectElement;
  playerStatus: HTMLSelectElement;
  positionChecks: HTMLElement;
  cancelPlayerDialogBtn: HTMLButtonElement;
  bulkPlayerDialog: HTMLDialogElement;
  bulkPlayerForm: HTMLFormElement;
  bulkPlayerSummary: HTMLElement;
  bulkStatus: HTMLSelectElement;
  bulkBats: HTMLSelectElement;
  bulkThrows: HTMLSelectElement;
  bulkPositionMode: HTMLSelectElement;
  bulkPositionChecks: HTMLElement;
  cancelBulkPlayerDialogBtn: HTMLButtonElement;
  scenarioDialog: HTMLDialogElement;
  scenarioForm: HTMLFormElement;
  scenarioMode: HTMLInputElement;
  scenarioDialogTitle: HTMLElement;
  scenarioNameInput: HTMLInputElement;
  scenarioNoteInput: HTMLTextAreaElement;
  cancelScenarioDialogBtn: HTMLButtonElement;
  importDialog: HTMLDialogElement;
  importSummary: HTMLElement;
  importTypeValue: HTMLElement;
  importScenarioCountValue: HTMLElement;
  importPlayerCountValue: HTMLElement;
  importNameList: HTMLElement;
  appendImportBtn: HTMLButtonElement;
  replaceImportBtn: HTMLButtonElement;
  cancelImportDialogBtn: HTMLButtonElement;
  drawerScrim: HTMLElement;
  helpDrawer: HTMLElement;
  closeHelpBtn: HTMLButtonElement;
  replayGuideBtn: HTMLButtonElement;
  guideOverlay: HTMLElement;
  guideCard: HTMLElement;
  guideProgress: HTMLElement;
  guideTitle: HTMLElement;
  guideBody: HTMLElement;
  guideSkipBtn: HTMLButtonElement;
  guidePrevBtn: HTMLButtonElement;
  guideNextBtn: HTMLButtonElement;
  toast: HTMLElement;
};

type CommitOptions = {
  message?: string;
  recordHistory?: boolean;
};

export function mountPlayerManager(
  root: HTMLElement,
  initialSnapshot: WorkspaceSnapshot,
) {
  let workspace = sanitizeWorkspace(initialSnapshot.workspace);
  let remoteVersion = initialSnapshot.version;
  let historyState: { undo: Workspace[]; redo: Workspace[] } = {
    undo: [],
    redo: [],
  };
  let pendingImport: PendingImport | null = null;
  let selectedIds = new Set<string>();
  let draggedElement: HTMLElement | null = null;
  let toastTimer: number | null = null;
  let guideStep = workspace.preferences.helpDismissed ? 0 : 0;
  let helpOpen = false;
  let destroyed = false;
  let saveStatusTimer: number | null = null;
  let saveQueue = Promise.resolve();
  const saveStatusIdleMessage = "云端工作区已准备";

  const els = queryElements(root);
  buildPositionFilter();
  buildPositionChecks();
  buildBulkPositionChecks();
  syncBulkPositionMode();
  bindEvents();
  render();
  if (!workspace.preferences.helpDismissed) {
    guideStep = 0;
  }
  setSaveStatus(saveStatusIdleMessage);

  return () => {
    destroyed = true;
    window.removeEventListener("keydown", handleGlobalKeydown);
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    if (saveStatusTimer) {
      window.clearTimeout(saveStatusTimer);
    }
  };

  function queryElements(scope: ParentNode): Elements {
    const query = <T extends Element>(selector: string) =>
      scope.querySelector(selector) as T | null;
    const required = <T extends Element>(selector: string) => {
      const element = query<T>(selector);
      if (!element) {
        throw new Error(`Missing required element: ${selector}`);
      }
      return element;
    };

    return {
      saveStatus: required("#saveStatus"),
      workspaceVersionChip: required("#workspaceVersionChip"),
      scenarioCountChip: required("#scenarioCountChip"),
      historyChip: required("#historyChip"),
      workspacePlayerChip: required("#workspacePlayerChip"),
      activeScenarioBadge: required("#activeScenarioBadge"),
      playerCount: required("#playerCount"),
      defenseCount: required("#defenseCount"),
      lineupCount: required("#lineupCount"),
      selectedCount: required("#selectedCount"),
      scenarioCountInline: required("#scenarioCountInline"),
      scenarioSelect: required("#scenarioSelect"),
      scenarioNameDisplay: required("#scenarioNameDisplay"),
      scenarioNoteDisplay: required("#scenarioNoteDisplay"),
      scenarioTimeDisplay: required("#scenarioTimeDisplay"),
      warningSummary: required("#warningSummary"),
      searchInput: required("#searchInput"),
      positionFilter: required("#positionFilter"),
      statusFilter: required("#statusFilter"),
      batsFilter: required("#batsFilter"),
      throwsFilter: required("#throwsFilter"),
      assignmentFilter: required("#assignmentFilter"),
      playerList: required("#playerList"),
      field: required("#field"),
      defenseStat: required("#defenseStat"),
      lineupStat: required("#lineupStat"),
      availableStat: required("#availableStat"),
      lineupList: required("#lineupList"),
      warnings: required("#warnings"),
      addPlayerBtn: required("#addPlayerBtn"),
      autoAssignBtn: required("#autoAssignBtn"),
      undoBtn: required("#undoBtn"),
      redoBtn: required("#redoBtn"),
      exportWorkspaceBtn: required("#exportWorkspaceBtn"),
      exportScenarioBtn: required("#exportScenarioBtn"),
      importBtn: required("#importBtn"),
      importInput: required("#importInput"),
      clearAssignmentsBtn: required("#clearAssignmentsBtn"),
      resetBtn: required("#resetBtn"),
      helpBtn: required("#helpBtn"),
      clearSelectionBtn: required("#clearSelectionBtn"),
      selectFilteredBtn: required("#selectFilteredBtn"),
      bulkEditBtn: required("#bulkEditBtn"),
      bulkDeleteBtn: required("#bulkDeleteBtn"),
      newScenarioBtn: required("#newScenarioBtn"),
      renameScenarioBtn: required("#renameScenarioBtn"),
      duplicateScenarioBtn: required("#duplicateScenarioBtn"),
      deleteScenarioBtn: required("#deleteScenarioBtn"),
      playerDialog: required("#playerDialog"),
      playerForm: required("#playerForm"),
      dialogTitle: required("#dialogTitle"),
      playerId: required("#playerId"),
      playerName: required("#playerName"),
      playerNumber: required("#playerNumber"),
      playerBats: required("#playerBats"),
      playerThrows: required("#playerThrows"),
      playerStatus: required("#playerStatus"),
      positionChecks: required("#positionChecks"),
      cancelPlayerDialogBtn: required("#cancelPlayerDialogBtn"),
      bulkPlayerDialog: required("#bulkPlayerDialog"),
      bulkPlayerForm: required("#bulkPlayerForm"),
      bulkPlayerSummary: required("#bulkPlayerSummary"),
      bulkStatus: required("#bulkStatus"),
      bulkBats: required("#bulkBats"),
      bulkThrows: required("#bulkThrows"),
      bulkPositionMode: required("#bulkPositionMode"),
      bulkPositionChecks: required("#bulkPositionChecks"),
      cancelBulkPlayerDialogBtn: required("#cancelBulkPlayerDialogBtn"),
      scenarioDialog: required("#scenarioDialog"),
      scenarioForm: required("#scenarioForm"),
      scenarioMode: required("#scenarioMode"),
      scenarioDialogTitle: required("#scenarioDialogTitle"),
      scenarioNameInput: required("#scenarioNameInput"),
      scenarioNoteInput: required("#scenarioNoteInput"),
      cancelScenarioDialogBtn: required("#cancelScenarioDialogBtn"),
      importDialog: required("#importDialog"),
      importSummary: required("#importSummary"),
      importTypeValue: required("#importTypeValue"),
      importScenarioCountValue: required("#importScenarioCountValue"),
      importPlayerCountValue: required("#importPlayerCountValue"),
      importNameList: required("#importNameList"),
      appendImportBtn: required("#appendImportBtn"),
      replaceImportBtn: required("#replaceImportBtn"),
      cancelImportDialogBtn: required("#cancelImportDialogBtn"),
      drawerScrim: required("#drawerScrim"),
      helpDrawer: required("#helpDrawer"),
      closeHelpBtn: required("#closeHelpBtn"),
      replayGuideBtn: required("#replayGuideBtn"),
      guideOverlay: required("#guideOverlay"),
      guideCard: required("#guideCard"),
      guideProgress: required("#guideProgress"),
      guideTitle: required("#guideTitle"),
      guideBody: required("#guideBody"),
      guideSkipBtn: required("#guideSkipBtn"),
      guidePrevBtn: required("#guidePrevBtn"),
      guideNextBtn: required("#guideNextBtn"),
      toast: required("#toast"),
    };
  }

  function getCurrentScenario() {
    return getActiveScenario(workspace);
  }

  function getCurrentPlayer(id: string | null | undefined) {
    return getPlayer(workspace, id);
  }

  function setSaveStatus(message: string, autoReset = true) {
    els.saveStatus.textContent = message;
    if (saveStatusTimer) {
      window.clearTimeout(saveStatusTimer);
    }
    if (!autoReset) {
      return;
    }
    saveStatusTimer = window.setTimeout(() => {
      els.saveStatus.textContent = saveStatusIdleMessage;
    }, 1800);
  }

  function enqueueSave(candidate: Workspace) {
    const candidateSnapshot = cloneWorkspace(candidate);
    const serializedCandidate = JSON.stringify(candidateSnapshot);

    saveQueue = saveQueue.then(async () => {
      if (destroyed) {
        return;
      }

      setSaveStatus("正在同步到云端...", false);
      try {
        const result = await saveWorkspaceSnapshot(candidateSnapshot, remoteVersion);
        remoteVersion = result.version;
        if (JSON.stringify(workspace) === serializedCandidate) {
          workspace = sanitizeWorkspace(result.workspace);
          render();
        }
        setSaveStatus("已同步到云端");
      } catch (error) {
        if (isVersionConflict(error)) {
          const latest = await loadWorkspaceSnapshot();
          workspace = sanitizeWorkspace(latest.workspace);
          remoteVersion = latest.version;
          historyState = { undo: [], redo: [] };
          selectedIds = new Set();
          pendingImport = null;
          render();
          showToast("数据已被其他会话更新，已刷新最新内容");
          setSaveStatus("已刷新最新云端数据");
          return;
        }

        console.error(error);
        setSaveStatus("云端保存失败");
        showToast("保存失败，请稍后重试");
      }
    });
  }

  function commitWorkspace(mutator: (draft: Workspace) => Workspace | void, options: CommitOptions = {}) {
    const before = cloneWorkspace(workspace);
    const beforeSerialized = JSON.stringify(before);
    const draft = cloneWorkspace(workspace);
    const result = mutator(draft);
    const candidate = sanitizeWorkspace(result || draft);
    const afterSerialized = JSON.stringify(candidate);

    if (beforeSerialized === afterSerialized) {
      return false;
    }

    if (options.recordHistory !== false) {
      historyState.undo.push(before);
      if (historyState.undo.length > HISTORY_LIMIT) {
        historyState.undo.shift();
      }
      historyState.redo = [];
    }

    workspace = candidate;
    render();
    enqueueSave(candidate);
    if (options.message) {
      showToast(options.message);
    }
    return true;
  }

  function setActiveScenario(scenarioId: string) {
    if (!workspace.scenarios.some((scenario) => scenario.id === scenarioId)) {
      return;
    }

    commitWorkspace((draft) => {
      draft.activeScenarioId = scenarioId;
    }, { recordHistory: false });
  }

  function undo() {
    if (!historyState.undo.length) {
      return;
    }

    historyState.redo.push(cloneWorkspace(workspace));
    workspace = sanitizeWorkspace(historyState.undo.pop());
    render();
    enqueueSave(workspace);
    showToast("已撤销上一步");
  }

  function redo() {
    if (!historyState.redo.length) {
      return;
    }

    historyState.undo.push(cloneWorkspace(workspace));
    workspace = sanitizeWorkspace(historyState.redo.pop());
    render();
    enqueueSave(workspace);
    showToast("已恢复上一步");
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", handlePlayerFilterChange);
    els.positionFilter.addEventListener("change", handlePlayerFilterChange);
    els.statusFilter.addEventListener("change", handlePlayerFilterChange);
    els.batsFilter.addEventListener("change", handlePlayerFilterChange);
    els.throwsFilter.addEventListener("change", handlePlayerFilterChange);
    els.assignmentFilter.addEventListener("change", handlePlayerFilterChange);
    els.clearSelectionBtn.addEventListener("click", () => {
      selectedIds.clear();
      renderPlayers();
      updateSelectedCount();
    });
    els.selectFilteredBtn.addEventListener("click", selectFilteredPlayers);
    els.bulkEditBtn.addEventListener("click", openBulkPlayerDialog);
    els.bulkDeleteBtn.addEventListener("click", bulkDeletePlayers);
    els.scenarioSelect.addEventListener("change", (event) => {
      setActiveScenario((event.currentTarget as HTMLSelectElement).value);
    });
    els.addPlayerBtn.addEventListener("click", () => openPlayerDialog());
    els.autoAssignBtn.addEventListener("click", autoAssignScenario);
    els.undoBtn.addEventListener("click", undo);
    els.redoBtn.addEventListener("click", redo);
    els.exportWorkspaceBtn.addEventListener("click", exportWorkspace);
    els.exportScenarioBtn.addEventListener("click", exportScenario);
    els.importBtn.addEventListener("click", () => {
      els.importInput.value = "";
      els.importInput.click();
    });
    els.importInput.addEventListener("change", handleImportFile);
    els.clearAssignmentsBtn.addEventListener("click", clearAssignments);
    els.resetBtn.addEventListener("click", resetExampleData);
    els.helpBtn.addEventListener("click", () => setHelpOpen(true));
    els.closeHelpBtn.addEventListener("click", () => setHelpOpen(false));
    els.drawerScrim.addEventListener("click", () => setHelpOpen(false));
    els.replayGuideBtn.addEventListener("click", () => {
      setHelpOpen(false);
      openGuide();
    });
    els.newScenarioBtn.addEventListener("click", () => openScenarioDialog("create"));
    els.renameScenarioBtn.addEventListener("click", () => openScenarioDialog("edit"));
    els.duplicateScenarioBtn.addEventListener("click", duplicateScenario);
    els.deleteScenarioBtn.addEventListener("click", deleteScenario);
    els.cancelPlayerDialogBtn.addEventListener("click", () => els.playerDialog.close());
    els.cancelBulkPlayerDialogBtn.addEventListener("click", () => els.bulkPlayerDialog.close());
    els.cancelScenarioDialogBtn.addEventListener("click", () => els.scenarioDialog.close());
    els.cancelImportDialogBtn.addEventListener("click", () => {
      pendingImport = null;
      els.importDialog.close();
    });
    els.playerForm.addEventListener("submit", handlePlayerSubmit);
    els.bulkPlayerForm.addEventListener("submit", handleBulkPlayerSubmit);
    els.bulkPositionMode.addEventListener("change", syncBulkPositionMode);
    els.scenarioForm.addEventListener("submit", handleScenarioSubmit);
    els.appendImportBtn.addEventListener("click", appendImportedScenario);
    els.replaceImportBtn.addEventListener("click", replaceWorkspaceFromImport);
    els.guideSkipBtn.addEventListener("click", dismissGuide);
    els.guidePrevBtn.addEventListener("click", previousGuideStep);
    els.guideNextBtn.addEventListener("click", nextGuideStep);
    window.addEventListener("keydown", handleGlobalKeydown);
  }

  function buildPositionFilter() {
    els.positionFilter.innerHTML = [
      '<option value="all">全部守位</option>',
      ...POSITIONS.map((position) => `<option value="${position.code}">${position.code}</option>`),
    ].join("");
  }

  function buildPositionChecks() {
    els.positionChecks.innerHTML = POSITIONS.map(
      (position) => `
        <label class="check-tile">
          <input type="checkbox" name="positions" value="${position.code}">
          <span>${position.code}</span>
        </label>
      `,
    ).join("");
  }

  function buildBulkPositionChecks() {
    els.bulkPositionChecks.innerHTML = POSITIONS.map(
      (position) => `
        <label class="check-tile">
          <input type="checkbox" name="bulkPositions" value="${position.code}">
          <span>${position.code}</span>
        </label>
      `,
    ).join("");
  }

  function render() {
    reconcileSelectedIds();
    renderHeader();
    renderScenarioControls();
    renderPlayers();
    renderField();
    renderLineup();
    renderStats();
    renderWarnings();
    renderHelpDrawer();
    renderGuide();
    updateSelectedCount();
    updateHistoryButtons();
  }

  function renderHeader() {
    els.workspaceVersionChip.textContent = "Workspace v2";
    els.scenarioCountChip.textContent = `${workspace.scenarios.length} 套方案`;
    els.workspacePlayerChip.textContent = `${workspace.players.length} 名球员`;
    els.historyChip.textContent = `撤销 ${historyState.undo.length} / 重做 ${historyState.redo.length}`;
    els.activeScenarioBadge.textContent = getCurrentScenario().name;
  }

  function renderScenarioControls() {
    const activeScenario = getCurrentScenario();
    els.scenarioSelect.innerHTML = workspace.scenarios
      .map((scenario) => {
        const selected = scenario.id === activeScenario.id ? "selected" : "";
        return `<option value="${scenario.id}" ${selected}>${escapeHtml(scenario.name)}</option>`;
      })
      .join("");
    els.scenarioCountInline.textContent = `${workspace.scenarios.length} 套`;
    els.scenarioNameDisplay.textContent = activeScenario.name;
    els.scenarioNoteDisplay.textContent =
      activeScenario.note ||
      "保存不同比赛构想，对左投、守备优先和常规先发可以分别留一套。";
    els.scenarioTimeDisplay.textContent = `创建于 ${formatDateTime(activeScenario.createdAt)} · 更新于 ${formatDateTime(activeScenario.updatedAt)}`;
    els.deleteScenarioBtn.disabled = workspace.scenarios.length <= 1;
  }

  function renderPlayers() {
    const players = getFilteredPlayers();
    els.playerCount.textContent = `${players.length} 人`;
    if (!players.length) {
      els.playerList.innerHTML = '<div class="empty-state">没有匹配的球员</div>';
      return;
    }

    const activeScenario = getCurrentScenario();
    const defenseAssignments = activeScenario.assignments.defense;
    els.playerList.innerHTML = players
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
                <button class="link-btn" type="button" data-edit-id="${player.id}">编辑</button>
                <button class="link-btn danger" type="button" data-delete-id="${player.id}">删除</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    root.querySelectorAll(".player-card").forEach((card) => {
      card.addEventListener("dragstart", handlePlayerDragStart);
      card.addEventListener("dragend", handleDragEnd);
    });
    root.querySelectorAll("[data-select-id]").forEach((checkbox) => {
      checkbox.addEventListener("change", (event) => {
        const target = event.currentTarget as HTMLInputElement;
        const id = target.dataset.selectId!;
        if (target.checked) {
          selectedIds.add(id);
        } else {
          selectedIds.delete(id);
        }
        renderPlayers();
        updateSelectedCount();
      });
    });
    root.querySelectorAll("[data-edit-id]").forEach((button) => {
      button.addEventListener("click", () => {
        openPlayerDialog((button as HTMLButtonElement).dataset.editId || null);
      });
    });
    root.querySelectorAll("[data-delete-id]").forEach((button) => {
      button.addEventListener("click", () => {
        deletePlayer((button as HTMLButtonElement).dataset.deleteId || "");
      });
    });
  }

  function renderField() {
    const activeScenario = getCurrentScenario();
    els.field.innerHTML = `
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
      ${POSITIONS.map((position) => renderFieldZone(position.code, activeScenario)).join("")}
    `;

    els.field.querySelectorAll(".field-zone").forEach((zone) => {
      zone.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest(".clear-zone")) {
          clearDefensePosition((zone as HTMLElement).dataset.position as PositionCode);
          return;
        }
        assignSelectedToPosition((zone as HTMLElement).dataset.position as PositionCode);
      });
      zone.addEventListener("dragover", allowDrop);
      zone.addEventListener("dragenter", markDropTarget);
      zone.addEventListener("dragleave", unmarkDropTarget);
      zone.addEventListener("drop", handleDefenseDrop);
    });
  }

  function renderFieldZone(positionCode: PositionCode, activeScenario: Scenario) {
    const position = POSITIONS.find((item) => item.code === positionCode)!;
    const player = getCurrentPlayer(activeScenario.assignments.defense[position.code]);
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

  function renderLineup() {
    const activeScenario = getCurrentScenario();
    els.lineupList.innerHTML = activeScenario.assignments.lineup
      .map((playerId, index) => {
        const player = getCurrentPlayer(playerId);
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

    els.lineupList.querySelectorAll(".lineup-slot").forEach((slot) => {
      slot.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest("[data-clear-lineup]")) {
          return;
        }
        assignSelectedToLineup(Number((slot as HTMLElement).dataset.lineupIndex));
      });
      slot.addEventListener("dragover", allowDrop);
      slot.addEventListener("dragenter", markDropTarget);
      slot.addEventListener("dragleave", unmarkDropTarget);
      slot.addEventListener("drop", handleLineupDrop);
      if ((slot as HTMLElement).draggable) {
        slot.addEventListener("dragstart", handleLineupDragStart);
        slot.addEventListener("dragend", handleDragEnd);
      }
    });
    els.lineupList.querySelectorAll("[data-clear-lineup]").forEach((button) => {
      button.addEventListener("click", () => {
        clearLineupSlot(Number((button as HTMLElement).dataset.clearLineup));
      });
    });
  }

  function renderStats() {
    const activeScenario = getCurrentScenario();
    const defenseFilled = Object.values(activeScenario.assignments.defense).filter(Boolean).length;
    const lineupFilled = activeScenario.assignments.lineup.filter(Boolean).length;
    const available = workspace.players.filter((player) => player.status === "available").length;
    els.defenseCount.textContent = `${defenseFilled} / 9`;
    els.lineupCount.textContent = `${lineupFilled} / 9`;
    els.defenseStat.textContent = String(defenseFilled);
    els.lineupStat.textContent = String(lineupFilled);
    els.availableStat.textContent = String(available);
  }

  function renderWarnings() {
    const analysis = analyzeScenarioWarnings(workspace, getCurrentScenario());
    els.warningSummary.innerHTML = [
      `<span class="small-chip critical-chip">强提醒 ${analysis.critical.length}</span>`,
      `<span class="small-chip advisory-chip">建议 ${analysis.advisory.length}</span>`,
    ].join("");

    if (!analysis.critical.length && !analysis.advisory.length) {
      els.warnings.innerHTML = '<div class="ok-item">阵容规则检查通过</div>';
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
    els.warnings.innerHTML = groups.join("");
  }

  function renderHelpDrawer() {
    els.helpDrawer.classList.toggle("open", helpOpen);
    els.helpDrawer.setAttribute("aria-hidden", String(!helpOpen));
    els.drawerScrim.classList.toggle("open", helpOpen);
  }

  function renderGuide() {
    const open = !workspace.preferences.helpDismissed;
    els.guideOverlay.classList.toggle("open", open);
    els.guideOverlay.setAttribute("aria-hidden", String(!open));
    els.guideCard.classList.toggle("open", open);
    els.guideCard.setAttribute("aria-hidden", String(!open));
    root.querySelectorAll(".guide-focus").forEach((node) => node.classList.remove("guide-focus"));
    if (!open) {
      return;
    }

    const step = GUIDE_STEPS[guideStep];
    const target = root.querySelector(`#${step.target}`);
    target?.scrollIntoView({
      block: step.target === "helpBtn" ? "start" : "center",
      inline: "nearest",
    });
    target?.classList.add("guide-focus");
    els.guideProgress.textContent = `步骤 ${guideStep + 1} / ${GUIDE_STEPS.length}`;
    els.guideTitle.textContent = step.title;
    els.guideBody.textContent = step.body;
    els.guidePrevBtn.disabled = guideStep === 0;
    els.guideNextBtn.textContent =
      guideStep === GUIDE_STEPS.length - 1 ? "完成" : "下一步";
  }

  function updateHistoryButtons() {
    els.undoBtn.disabled = historyState.undo.length === 0;
    els.redoBtn.disabled = historyState.redo.length === 0;
  }

  function updateSelectedCount() {
    const selectedCount = getSelectedPlayerIds().length;
    const filteredCount = getFilteredPlayers().length;
    els.selectedCount.textContent = `已选 ${selectedCount} / 当前 ${filteredCount}`;
    els.clearSelectionBtn.disabled = selectedCount === 0;
    els.selectFilteredBtn.disabled = filteredCount === 0;
    els.selectFilteredBtn.textContent = filteredCount
      ? `选择当前筛选 (${filteredCount})`
      : "选择当前筛选";
    els.bulkEditBtn.disabled = selectedCount === 0;
    els.bulkDeleteBtn.disabled = selectedCount === 0;
  }

  function handlePlayerFilterChange() {
    renderPlayers();
    updateSelectedCount();
  }

  function getFilteredPlayers() {
    const query = els.searchInput.value.trim().toLowerCase();
    const position = els.positionFilter.value;
    const status = els.statusFilter.value;
    const bats = els.batsFilter.value;
    const throws = els.throwsFilter.value;
    const assignment = els.assignmentFilter.value;
    const activeScenario = getCurrentScenario();

    return workspace.players.filter((player) => {
      const assignmentState = getPlayerAssignmentState(activeScenario, player.id);
      const matchesSearch =
        !query ||
        player.name.toLowerCase().includes(query) ||
        player.number.toLowerCase().includes(query);
      const matchesPosition = position === "all" || player.positions.includes(position as PositionCode);
      const matchesStatus = status === "all" || player.status === status;
      const matchesBats = bats === "all" || player.bats === bats;
      const matchesThrows = throws === "all" || player.throws === throws;
      const matchesAssignment =
        assignment === "all" ||
        (assignment === "unassigned" && !assignmentState.defense && !assignmentState.lineup) ||
        (assignment === "defenseAssigned" && assignmentState.defense) ||
        (assignment === "lineupAssigned" && assignmentState.lineup) ||
        (assignment === "fullyAssigned" && assignmentState.defense && assignmentState.lineup);

      return (
        matchesSearch &&
        matchesPosition &&
        matchesStatus &&
        matchesBats &&
        matchesThrows &&
        matchesAssignment
      );
    });
  }

  function reconcileSelectedIds() {
    selectedIds.forEach((id) => {
      if (!getCurrentPlayer(id)) {
        selectedIds.delete(id);
      }
    });
  }

  function getSelectedPlayerIds() {
    return workspace.players
      .filter((player) => selectedIds.has(player.id))
      .map((player) => player.id);
  }

  function selectFilteredPlayers() {
    const players = getFilteredPlayers();
    if (!players.length) {
      showToast("当前筛选没有可选球员");
      return;
    }

    players.forEach((player) => selectedIds.add(player.id));
    renderPlayers();
    updateSelectedCount();
    showToast(`已选择当前筛选的 ${players.length} 名球员`);
  }

  function syncBulkPositionMode() {
    const disabled = els.bulkPositionMode.value === "keep";
    els.bulkPositionChecks.querySelectorAll("input").forEach((checkbox) => {
      const input = checkbox as HTMLInputElement;
      input.disabled = disabled;
      if (disabled) {
        input.checked = false;
      }
    });
  }

  function handlePlayerDragStart(event: Event) {
    const target = event.currentTarget as HTMLElement;
    const dataTransfer = (event as DragEvent).dataTransfer;
    if (!dataTransfer) {
      return;
    }
    dataTransfer.effectAllowed = "copyMove";
    dataTransfer.setData("text/plain", `player:${target.dataset.playerId}`);
    draggedElement = target;
    target.classList.add("dragging");
  }

  function handleLineupDragStart(event: Event) {
    const target = event.currentTarget as HTMLElement;
    const dataTransfer = (event as DragEvent).dataTransfer;
    if (!dataTransfer) {
      return;
    }
    dataTransfer.effectAllowed = "move";
    dataTransfer.setData("text/plain", `lineup:${target.dataset.lineupIndex}`);
    draggedElement = target;
    target.classList.add("dragging");
  }

  function handleDragEnd() {
    if (draggedElement) {
      draggedElement.classList.remove("dragging");
    }
    draggedElement = null;
    root.querySelectorAll(".drop-target").forEach((element) => element.classList.remove("drop-target"));
  }

  function allowDrop(event: Event) {
    event.preventDefault();
  }

  function markDropTarget(event: Event) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add("drop-target");
  }

  function unmarkDropTarget(event: Event) {
    (event.currentTarget as HTMLElement).classList.remove("drop-target");
  }

  function handleDefenseDrop(event: Event) {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove("drop-target");
    const token = (event as DragEvent).dataTransfer?.getData("text/plain") || "";
    const playerId = playerIdFromDragToken(token);
    if (!playerId) {
      return;
    }
    assignDefense(target.dataset.position as PositionCode, playerId);
  }

  function handleLineupDrop(event: Event) {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove("drop-target");
    const targetIndex = Number(target.dataset.lineupIndex);
    const token = (event as DragEvent).dataTransfer?.getData("text/plain") || "";
    if (token.startsWith("player:")) {
      assignLineup(targetIndex, token.slice("player:".length));
    } else if (token.startsWith("lineup:")) {
      moveLineup(Number(token.slice("lineup:".length)), targetIndex);
    }
  }

  function playerIdFromDragToken(token: string) {
    const activeScenario = getCurrentScenario();
    if (token.startsWith("player:")) {
      return token.slice("player:".length);
    }
    if (token.startsWith("lineup:")) {
      return activeScenario.assignments.lineup[Number(token.slice("lineup:".length))] || null;
    }
    return null;
  }

  function assignSelectedToPosition(position: PositionCode) {
    const playerId = getSelectedPlayerIds()[0];
    if (!playerId) {
      return;
    }
    assignDefense(position, playerId);
    selectedIds.delete(playerId);
    updateSelectedCount();
    renderPlayers();
  }

  function assignSelectedToLineup(index: number) {
    const playerId = getSelectedPlayerIds()[0];
    if (!playerId) {
      return;
    }
    assignLineup(index, playerId);
    selectedIds.delete(playerId);
    updateSelectedCount();
    renderPlayers();
  }

  function assignDefense(position: PositionCode, playerId: string) {
    const player = getCurrentPlayer(playerId);
    if (!player) {
      return;
    }
    commitWorkspace((draft) => {
      const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
      scenario.assignments.defense[position] = playerId;
      scenario.updatedAt = new Date().toISOString();
    }, { message: `已安排 ${player.name} 守 ${position}` });
  }

  function clearDefensePosition(position: PositionCode) {
    commitWorkspace((draft) => {
      const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
      scenario.assignments.defense[position] = null;
      scenario.updatedAt = new Date().toISOString();
    }, { message: `已清空 ${position}` });
  }

  function assignLineup(index: number, playerId: string) {
    const player = getCurrentPlayer(playerId);
    if (!player) {
      return;
    }
    commitWorkspace((draft) => {
      const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
      scenario.assignments.lineup[index] = playerId;
      scenario.updatedAt = new Date().toISOString();
    }, { message: `已放入第 ${index + 1} 棒` });
  }

  function moveLineup(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) {
      return;
    }
    commitWorkspace((draft) => {
      const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
      const lineup = [...scenario.assignments.lineup];
      const [moved] = lineup.splice(fromIndex, 1);
      lineup.splice(toIndex, 0, moved);
      scenario.assignments.lineup = lineup.slice(0, 9);
      scenario.updatedAt = new Date().toISOString();
    }, { message: "已调整棒次顺序" });
  }

  function clearLineupSlot(index: number) {
    commitWorkspace((draft) => {
      const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
      scenario.assignments.lineup[index] = null;
      scenario.updatedAt = new Date().toISOString();
    }, { message: `已清空第 ${index + 1} 棒` });
  }

  function clearAssignments() {
    commitWorkspace((draft) => {
      const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
      scenario.assignments = createEmptyAssignments();
      scenario.updatedAt = new Date().toISOString();
    }, { message: "当前方案阵容已清空" });
  }

  function resetExampleData() {
    const confirmed = window.confirm(
      "重置示例会恢复默认球员和默认方案，但保留帮助已读状态。继续吗？",
    );
    if (!confirmed) {
      return;
    }
    commitWorkspace(() => {
      return createDefaultWorkspace(workspace.preferences.helpDismissed);
    }, { message: "已重置为示例数据" });
    historyState.redo = [];
  }

  function openPlayerDialog(id: string | null = null) {
    const player = id ? getCurrentPlayer(id) : null;
    els.dialogTitle.textContent = player ? "编辑球员" : "新增球员";
    els.playerId.value = player?.id || "";
    els.playerName.value = player?.name || "";
    els.playerNumber.value = player?.number || "";
    els.playerBats.value = player?.bats || "R";
    els.playerThrows.value = player?.throws || "R";
    els.playerStatus.value = player?.status || "available";
    const positions = new Set(player?.positions || []);
    els.positionChecks.querySelectorAll("input").forEach((checkbox) => {
      (checkbox as HTMLInputElement).checked = positions.has(
        (checkbox as HTMLInputElement).value as PositionCode,
      );
    });
    els.playerDialog.showModal();
    window.setTimeout(() => els.playerName.focus(), 0);
  }

  function openBulkPlayerDialog() {
    const ids = getSelectedPlayerIds();
    if (!ids.length) {
      showToast("请先选择球员");
      return;
    }
    els.bulkPlayerSummary.textContent = `将修改 ${ids.length} 名已选球员。未选择的字段保持原值。`;
    els.bulkStatus.value = "keep";
    els.bulkBats.value = "keep";
    els.bulkThrows.value = "keep";
    els.bulkPositionMode.value = "keep";
    syncBulkPositionMode();
    els.bulkPlayerDialog.showModal();
    window.setTimeout(() => els.bulkStatus.focus(), 0);
  }

  function handlePlayerSubmit(event: Event) {
    event.preventDefault();
    const id = els.playerId.value || createId();
    const positions = Array.from(
      els.positionChecks.querySelectorAll("input:checked"),
    ).map((checkbox) => (checkbox as HTMLInputElement).value as PositionCode);
    const player = {
      id,
      name: els.playerName.value.trim(),
      number: els.playerNumber.value.trim(),
      bats: els.playerBats.value,
      throws: els.playerThrows.value,
      positions,
      status: els.playerStatus.value,
    };

    if (!player.name || !player.number) {
      showToast("姓名和背号不能为空");
      return;
    }

    commitWorkspace((draft) => {
      const existingIndex = draft.players.findIndex((item) => item.id === id);
      if (existingIndex >= 0) {
        draft.players[existingIndex] = player as typeof draft.players[number];
      } else {
        draft.players.push(player as typeof draft.players[number]);
      }
    }, { message: "球员已保存" });

    els.playerDialog.close();
  }

  function handleBulkPlayerSubmit(event: Event) {
    event.preventDefault();
    const ids = getSelectedPlayerIds();
    if (!ids.length) {
      showToast("没有可批量修改的球员");
      return;
    }

    const positionMode = els.bulkPositionMode.value;
    const nextPositions = Array.from(
      els.bulkPositionChecks.querySelectorAll("input:checked"),
    ).map((checkbox) => (checkbox as HTMLInputElement).value as PositionCode);
    const hasFieldChange =
      els.bulkStatus.value !== "keep" ||
      els.bulkBats.value !== "keep" ||
      els.bulkThrows.value !== "keep" ||
      positionMode !== "keep";

    if (!hasFieldChange) {
      showToast("请至少选择一个批量修改项");
      return;
    }
    if (positionMode !== "keep" && !nextPositions.length) {
      showToast("请选择至少一个守位");
      return;
    }

    commitWorkspace((draft) => {
      const selectedSet = new Set(ids);
      draft.players = draft.players.map((player) => {
        if (!selectedSet.has(player.id)) {
          return player;
        }
        const updatedPlayer = { ...player };
        if (els.bulkStatus.value !== "keep") {
          updatedPlayer.status = els.bulkStatus.value as typeof updatedPlayer.status;
        }
        if (els.bulkBats.value !== "keep") {
          updatedPlayer.bats = els.bulkBats.value as typeof updatedPlayer.bats;
        }
        if (els.bulkThrows.value !== "keep") {
          updatedPlayer.throws = els.bulkThrows.value as typeof updatedPlayer.throws;
        }
        if (positionMode === "append") {
          updatedPlayer.positions = sanitizePositions([
            ...updatedPlayer.positions,
            ...nextPositions,
          ]);
        } else if (positionMode === "replace") {
          updatedPlayer.positions = sanitizePositions(nextPositions);
        } else if (positionMode === "remove") {
          updatedPlayer.positions = updatedPlayer.positions.filter(
            (position) => !nextPositions.includes(position),
          );
        }
        return updatedPlayer;
      });
    }, { message: `已批量修改 ${ids.length} 名球员` });

    els.bulkPlayerDialog.close();
  }

  function deletePlayer(id: string) {
    const player = getCurrentPlayer(id);
    if (!player) {
      return;
    }
    const confirmed = window.confirm(`删除 ${player.name}？`);
    if (!confirmed) {
      return;
    }

    commitWorkspace((draft) => {
      removePlayersFromWorkspace(draft, [id]);
    }, { message: "球员已删除" });

    selectedIds.delete(id);
  }

  function bulkDeletePlayers() {
    const ids = getSelectedPlayerIds();
    if (!ids.length) {
      showToast("请先选择球员");
      return;
    }
    const confirmed = window.confirm(`删除已选的 ${ids.length} 名球员？相关守位和棒次会一并清空。`);
    if (!confirmed) {
      return;
    }

    commitWorkspace((draft) => {
      removePlayersFromWorkspace(draft, ids);
    }, { message: `已删除 ${ids.length} 名球员` });
    selectedIds.clear();
  }

  function openScenarioDialog(mode: "create" | "edit") {
    const activeScenario = getCurrentScenario();
    els.scenarioMode.value = mode;
    els.scenarioDialogTitle.textContent = mode === "create" ? "新建方案" : "编辑方案";
    els.scenarioNameInput.value = mode === "create" ? "" : activeScenario.name;
    els.scenarioNoteInput.value = mode === "create" ? "" : activeScenario.note;
    els.scenarioDialog.showModal();
    window.setTimeout(() => els.scenarioNameInput.focus(), 0);
  }

  function handleScenarioSubmit(event: Event) {
    event.preventDefault();
    const mode = els.scenarioMode.value;
    const name = els.scenarioNameInput.value.trim();
    const note = els.scenarioNoteInput.value.trim();
    if (!name) {
      showToast("方案名称不能为空");
      return;
    }

    if (mode === "create") {
      commitWorkspace((draft) => {
        const uniqueName = createUniqueScenarioName(name, draft.scenarios, "");
        const scenario = createScenario(uniqueName, note, createEmptyAssignments());
        draft.scenarios.push(scenario);
        draft.activeScenarioId = scenario.id;
      }, { message: "已新建方案" });
    } else {
      const activeScenario = getCurrentScenario();
      commitWorkspace((draft) => {
        const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
        const otherScenarios = draft.scenarios.filter((item) => item.id !== scenario.id);
        scenario.name = createUniqueScenarioName(name, otherScenarios, "");
        scenario.note = note.slice(0, 120);
        scenario.updatedAt = new Date().toISOString();
      }, { message: `已更新方案 ${activeScenario.name}` });
    }

    els.scenarioDialog.close();
  }

  function duplicateScenario() {
    commitWorkspace((draft) => {
      const source = draft.scenarios.find((scenario) => scenario.id === draft.activeScenarioId)!;
      const clone = createScenario(
        createUniqueScenarioName(`${source.name} 副本`, draft.scenarios, ""),
        source.note,
        structuredClone(source.assignments),
      );
      draft.scenarios.push(clone);
      draft.activeScenarioId = clone.id;
    }, { message: "已复制当前方案" });
  }

  function deleteScenario() {
    if (workspace.scenarios.length <= 1) {
      showToast("至少保留一套方案");
      return;
    }
    const activeScenario = getCurrentScenario();
    const confirmed = window.confirm(`删除方案「${activeScenario.name}」？`);
    if (!confirmed) {
      return;
    }
    commitWorkspace((draft) => {
      draft.scenarios = draft.scenarios.filter(
        (scenario) => scenario.id !== draft.activeScenarioId,
      );
      draft.activeScenarioId = draft.scenarios[0].id;
    }, { message: "方案已删除" });
  }

  function exportWorkspace() {
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

  function exportScenario() {
    const activeScenario = getCurrentScenario();
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

  async function handleImportFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text());
      pendingImport = prepareImport(workspace, parsed, file.name);
      renderImportPreview();
      els.importDialog.showModal();
    } catch {
      pendingImport = null;
      showToast("导入失败：JSON 无法识别");
    }
  }

  function renderImportPreview() {
    if (!pendingImport) {
      return;
    }
    els.importSummary.textContent = pendingImport.summary;
    els.importTypeValue.textContent =
      pendingImport.type === "workspace" ? "工作区" : "单方案";
    els.importScenarioCountValue.textContent =
      pendingImport.type === "workspace"
        ? String(pendingImport.workspace.scenarios.length)
        : "1";
    els.importPlayerCountValue.textContent =
      pendingImport.type === "workspace"
        ? String(pendingImport.workspace.players.length)
        : String(pendingImport.players.length);
    els.importNameList.innerHTML = pendingImport.names
      .map((name) => `<div>${escapeHtml(name)}</div>`)
      .join("");
    els.appendImportBtn.hidden = pendingImport.type !== "scenario";
    els.replaceImportBtn.hidden = pendingImport.type !== "workspace";
  }

  function appendImportedScenario() {
    if (!pendingImport || pendingImport.type !== "scenario") {
      return;
    }
    const scenarioImport = pendingImport;
    commitWorkspace((draft) => {
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

    pendingImport = null;
    els.importDialog.close();
  }

  function replaceWorkspaceFromImport() {
    if (!pendingImport || pendingImport.type !== "workspace") {
      return;
    }
    const workspaceImport = pendingImport;

    commitWorkspace(() => {
      workspaceImport.workspace.preferences = structuredClone(workspace.preferences);
      return workspaceImport.workspace;
    }, { message: "工作区已从导入内容恢复" });

    pendingImport = null;
    els.importDialog.close();
  }

  function autoAssignScenario() {
    const activeScenario = getCurrentScenario();
    const nextScenario = buildAutoScenario(workspace, activeScenario);
    commitWorkspace((draft) => {
      const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
      scenario.assignments = nextScenario.assignments;
      scenario.updatedAt = new Date().toISOString();
    }, { message: "已生成自动排阵初稿" });
  }

  function setHelpOpen(open: boolean) {
    helpOpen = open;
    renderHelpDrawer();
  }

  function openGuide() {
    guideStep = 0;
    const changed = commitWorkspace((draft) => {
      draft.preferences.helpDismissed = false;
    }, { recordHistory: false });
    if (!changed) {
      renderGuide();
    }
  }

  function dismissGuide() {
    commitWorkspace((draft) => {
      draft.preferences.helpDismissed = true;
    }, { recordHistory: false });
  }

  function nextGuideStep() {
    if (guideStep >= GUIDE_STEPS.length - 1) {
      dismissGuide();
      return;
    }
    guideStep += 1;
    renderGuide();
  }

  function previousGuideStep() {
    if (guideStep === 0) {
      return;
    }
    guideStep -= 1;
    renderGuide();
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && helpOpen) {
      setHelpOpen(false);
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) {
      return;
    }

    const metaPressed = event.metaKey || event.ctrlKey;
    if (!metaPressed || event.key.toLowerCase() !== "z") {
      return;
    }

    event.preventDefault();
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
  }

  function downloadJson(fileName: string, payload: unknown) {
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

  function showToast(message: string) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("show");
    }, 1800);
  }
}

async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const response = await fetch("/api/workspace", {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`Failed to load workspace: ${response.status}`);
  }
  return response.json();
}

async function saveWorkspaceSnapshot(
  workspace: Workspace,
  version: number,
): Promise<WorkspaceSnapshot> {
  const response = await fetch("/api/workspace", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({ workspace, version }),
  });

  if (response.status === 409) {
    throw new Error("version_conflict");
  }
  if (!response.ok) {
    throw new Error(`Failed to save workspace: ${response.status}`);
  }
  return response.json();
}

function isVersionConflict(error: unknown) {
  return error instanceof Error && error.message === "version_conflict";
}
