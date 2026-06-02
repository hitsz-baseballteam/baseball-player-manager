import { createRoot, type Root as ReactRoot } from "react-dom/client";

import type { ManagerCallbacks } from "@/lib/manager-callbacks";
import {
  cloneWorkspace,
  getActiveScenario,
  getPlayer,
  HISTORY_LIMIT,
  POSITIONS,
  sanitizeWorkspace,
  type PendingImport,
  type PositionCode,
  type Workspace,
} from "@/lib/workspace";
import {
  isVersionConflict,
  loadWorkspaceSnapshot,
  saveWithRetry,
  saveWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from "@/lib/workspace-client";
import {
  renderHeader,
  renderScenarioControls,
  renderField,
  renderLineup,
  renderStats,
  renderWarnings,
  renderProfileDrawer,
  renderImportPreview,
  generatePlayerCardsHtml,
  type RenderContext,
} from "@/lib/dom-renderers";
import {
  assignDefense,
  assignLineup,
  clearAssignments,
  clearDefensePosition,
  clearLineupSlot,
  filterPlayers,
  moveLineup,
  playerIdFromDragToken,
  resetExampleData,
  type CommitFn,
  type PlayerFilterState,
} from "@/lib/dom-scenario-ops";
import {
  openPlayerDialog,
  handlePlayerSubmit,
  openBulkPlayerDialog,
  syncBulkPositionMode,
  handleBulkPlayerSubmit,
  deletePlayer,
  bulkDeletePlayers,
  openScenarioDialog,
  handleScenarioSubmit,
  duplicateScenario,
  deleteScenario,
  type DialogElements,
  type DialogCallbacks,
} from "@/lib/dom-dialogs";
import {
  exportWorkspace,
  exportScenario,
  autoAssignScenario,
  handleImportFile,
  appendImportedScenario,
  replaceWorkspaceFromImport,
  type ImportContext,
} from "@/lib/dom-io";

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
};

type CommitOptions = {
  message?: string;
  recordHistory?: boolean;
};

export function mountPlayerManager(
  root: HTMLElement,
  initialSnapshot: WorkspaceSnapshot,
  callbacks: ManagerCallbacks,
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
  let activeProfileId: string | null = null;
  let destroyed = false;
  let saveStatusTimer: number | null = null;
  let saveQueue = Promise.resolve();
  let saveEpoch = 0;
  let lastMutator: ((draft: Workspace) => Workspace | void) | null = null;
  let lastDrawerPlayer: { current: typeof workspace.players[number] | null } = { current: null };
  let lastDrawerPlayerJson: { current: string } = { current: "" };
  const saveStatusIdleMessage = "云端工作区已准备";
  const profileDrawerContainer = document.createElement("div");
  const profileDrawerRoot: ReactRoot = createRoot(profileDrawerContainer);

  const els = queryElements(root);
  document.body.appendChild(profileDrawerContainer);

  // Helper accessors for extracted modules
  const dialogEls: DialogElements = els;
  const dialogCallbacks: DialogCallbacks = {
    showToast: (msg) => callbacks.toast.current?.showToast(msg),
    getWorkspace: () => workspace,
    getCurrentPlayer: (id) => getPlayer(workspace, id),
    getSelectedPlayerIds: () => getSelectedPlayerIds(),
    commitWorkspace: (mutator, options) => commitWorkspace(mutator, options),
    clearSelectedIds: () => selectedIds.clear(),
    removeFromSelectedIds: (id) => selectedIds.delete(id),
  };

  buildPositionFilter();
  buildPositionChecks();
  buildBulkPositionChecks();
  syncBulkPositionMode(dialogEls);
  bindEvents();
  render();
  setSaveStatus(saveStatusIdleMessage);

  return () => {
    destroyed = true;
    window.removeEventListener("keydown", handleGlobalKeydown);
    if (saveStatusTimer) {
      window.clearTimeout(saveStatusTimer);
    }
    profileDrawerRoot.unmount();
    profileDrawerContainer.remove();
  };

  const renderCtx: RenderContext = {
    workspace,
    historyState,
    selectedIds,
    activeProfileId,
    remoteVersion,
    els,
    onCommitWorkspace: (mutator, options) => commitWorkspace(mutator, options),
    onOpenProfile: (playerId) => {
      activeProfileId = playerId;
      renderProfileDrawer(renderCtx);
    },
    onCloseProfile: () => {
      activeProfileId = null;
      renderProfileDrawer(renderCtx);
    },
    profileDrawerRoot,
    lastDrawerPlayer,
    lastDrawerPlayerJson,
  };

  const importCtx: ImportContext = {
    workspace,
    pendingImport,
    setPendingImport: (p) => { pendingImport = p; },
    showToast: (msg) => callbacks.toast.current?.showToast(msg),
    commitWorkspace: (mutator, options) => commitWorkspace(mutator, options),
    els: { importInput: els.importInput, importDialog: els.importDialog },
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
    const mutator = lastMutator;
    const queuedSaveEpoch = saveEpoch;

    saveQueue = saveQueue.then(async () => {
      if (destroyed) {
        return;
      }
      if (queuedSaveEpoch !== saveEpoch) {
        return;
      }

      try {
        setSaveStatus("正在同步到云端...", false);
        const result = mutator
          ? await saveWithRetry(remoteVersion, (latest) => {
              const draft = cloneWorkspace(latest);
              mutator(draft);
              return sanitizeWorkspace(draft);
            })
          : await saveWorkspaceSnapshot(candidateSnapshot, remoteVersion);
        remoteVersion = result.version;
        if (JSON.stringify(workspace) === serializedCandidate) {
          workspace = sanitizeWorkspace(result.workspace);
          render();
        }
        setSaveStatus("已同步到云端");
      } catch (error) {
        if (isVersionConflict(error)) {
          saveEpoch += 1;
          try {
            const latest = await loadWorkspaceSnapshot();
            workspace = sanitizeWorkspace(latest.workspace);
            remoteVersion = latest.version;
            historyState = { undo: [], redo: [] };
            selectedIds = new Set();
            pendingImport = null;
            render();
            callbacks.toast.current?.showToast("数据已被其他会话更新，已刷新最新内容");
            setSaveStatus("已刷新最新云端数据");
          } catch (recoverError) {
            console.error(recoverError);
          }
          return;
        }

        console.error(error);
        try {
          setSaveStatus("云端保存失败");
          callbacks.toast.current?.showToast("保存失败，请稍后重试");
        } catch (domError) {
          console.error(domError);
        }
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

    lastMutator = mutator;
    workspace = candidate;
    render();
    enqueueSave(candidate);
    if (options.message) {
      callbacks.toast.current?.showToast(options.message || "");
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
    callbacks.toast.current?.showToast("已撤销上一步");
  }

  function redo() {
    if (!historyState.redo.length) {
      return;
    }

    historyState.undo.push(cloneWorkspace(workspace));
    workspace = sanitizeWorkspace(historyState.redo.pop());
    render();
    enqueueSave(workspace);
    callbacks.toast.current?.showToast("已恢复上一步");
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
    els.bulkEditBtn.addEventListener("click", () => openBulkPlayerDialog(dialogEls, dialogCallbacks));
    els.bulkDeleteBtn.addEventListener("click", () => bulkDeletePlayers(dialogCallbacks));
    els.scenarioSelect.addEventListener("change", (event) => {
      setActiveScenario((event.currentTarget as HTMLSelectElement).value);
    });
    els.addPlayerBtn.addEventListener("click", () => openPlayerDialog(dialogEls, dialogCallbacks));
    els.autoAssignBtn.addEventListener("click", () => autoAssignScenario(workspace, getCurrentScenario, commitWorkspace));
    els.undoBtn.addEventListener("click", undo);
    els.redoBtn.addEventListener("click", redo);
    els.exportWorkspaceBtn.addEventListener("click", () => exportWorkspace(workspace, (msg) => callbacks.toast.current?.showToast(msg)));
    els.exportScenarioBtn.addEventListener("click", () => exportScenario(workspace, getCurrentScenario, (msg) => callbacks.toast.current?.showToast(msg)));
    els.importBtn.addEventListener("click", () => {
      els.importInput.value = "";
      els.importInput.click();
    });
    els.importInput.addEventListener("change", (e) => handleImportFile(e, importCtx, () => renderImportPreview(pendingImport, els)));
    els.clearAssignmentsBtn.addEventListener("click", clearAssignmentsLocal);
    els.resetBtn.addEventListener("click", resetExampleDataLocal);
    els.helpBtn.addEventListener("click", () => callbacks.helpDrawer.current?.open());
    els.newScenarioBtn.addEventListener("click", () => {
      const active = getCurrentScenario();
      openScenarioDialog(dialogEls, "create", active.name, active.note);
    });
    els.renameScenarioBtn.addEventListener("click", () => {
      const active = getCurrentScenario();
      openScenarioDialog(dialogEls, "edit", active.name, active.note);
    });
    els.duplicateScenarioBtn.addEventListener("click", () => duplicateScenario(dialogCallbacks));
    els.deleteScenarioBtn.addEventListener("click", () => {
      const active = getCurrentScenario();
      deleteScenario(dialogCallbacks, workspace.scenarios.length, active.name);
    });
    els.cancelPlayerDialogBtn.addEventListener("click", () => els.playerDialog.close());
    els.cancelBulkPlayerDialogBtn.addEventListener("click", () => els.bulkPlayerDialog.close());
    els.cancelScenarioDialogBtn.addEventListener("click", () => els.scenarioDialog.close());
    els.cancelImportDialogBtn.addEventListener("click", () => {
      pendingImport = null;
      els.importDialog.close();
    });
    els.playerForm.addEventListener("submit", (e) => handlePlayerSubmit(e, dialogEls, dialogCallbacks));
    els.bulkPlayerForm.addEventListener("submit", (e) => handleBulkPlayerSubmit(e, dialogEls, dialogCallbacks));
    els.bulkPositionMode.addEventListener("change", () => syncBulkPositionMode(dialogEls));
    els.scenarioForm.addEventListener("submit", (e) => handleScenarioSubmit(e, dialogEls, dialogCallbacks));
    els.appendImportBtn.addEventListener("click", () => appendImportedScenario(importCtx));
    els.replaceImportBtn.addEventListener("click", () => replaceWorkspaceFromImport(importCtx));
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
    // Update render context with latest state
    renderCtx.workspace = workspace;
    renderCtx.historyState = historyState;
    renderCtx.selectedIds = selectedIds;
    renderCtx.activeProfileId = activeProfileId;
    renderCtx.remoteVersion = remoteVersion;

    reconcileSelectedIds();
    renderHeader(renderCtx);
    renderScenarioControls(renderCtx);
    renderPlayers();
    renderField(renderCtx);
    renderLineup(renderCtx);
    renderStats(renderCtx);
    renderWarnings(renderCtx);
    renderProfileDrawer(renderCtx);
    updateSelectedCount();
    updateHistoryButtons();
  }

  function renderPlayers() {
    const players = getFilteredPlayers();
    els.playerCount.textContent = `${players.length} 人`;
    els.playerList.innerHTML = generatePlayerCardsHtml(players, selectedIds, getCurrentScenario());

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
        openPlayerDialog(dialogEls, dialogCallbacks, (button as HTMLButtonElement).dataset.editId || null);
      });
    });
    root.querySelectorAll("[data-profile-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const playerId = (button as HTMLButtonElement).dataset.profileId || null;
        if (!playerId) {
          return;
        }
        activeProfileId = playerId;
        renderProfileDrawer(renderCtx);
      });
    });
    root.querySelectorAll("[data-delete-id]").forEach((button) => {
      button.addEventListener("click", () => {
        deletePlayer((button as HTMLButtonElement).dataset.deleteId || "", dialogCallbacks);
      });
    });
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
    const filter: PlayerFilterState = {
      query: els.searchInput.value.trim().toLowerCase(),
      position: els.positionFilter.value,
      status: els.statusFilter.value,
      bats: els.batsFilter.value,
      throws: els.throwsFilter.value,
      assignment: els.assignmentFilter.value,
    };
    return filterPlayers(workspace.players, getCurrentScenario(), filter);
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
      callbacks.toast.current?.showToast("当前筛选没有可选球员");
      return;
    }

    players.forEach((player) => selectedIds.add(player.id));
    renderPlayers();
    updateSelectedCount();
    callbacks.toast.current?.showToast(`已选择当前筛选的 ${players.length} 名球员`);
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
    const playerId = playerIdFromDragToken(token, getCurrentScenario());
    if (!playerId) {
      return;
    }
    assignDefenseLocal(target.dataset.position as PositionCode, playerId);
  }

  function handleLineupDrop(event: Event) {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove("drop-target");
    const targetIndex = Number(target.dataset.lineupIndex);
    const token = (event as DragEvent).dataTransfer?.getData("text/plain") || "";
    if (token.startsWith("player:")) {
      assignLineupLocal(targetIndex, token.slice("player:".length));
    } else if (token.startsWith("lineup:")) {
      moveLineupLocal(Number(token.slice("lineup:".length)), targetIndex);
    }
  }



  function assignSelectedToPosition(position: PositionCode) {
    const playerId = getSelectedPlayerIds()[0];
    if (!playerId) {
      return;
    }
    assignDefenseLocal(position, playerId);
    selectedIds.delete(playerId);
    updateSelectedCount();
    renderPlayers();
  }

  function assignSelectedToLineup(index: number) {
    const playerId = getSelectedPlayerIds()[0];
    if (!playerId) {
      return;
    }
    assignLineupLocal(index, playerId);
    selectedIds.delete(playerId);
    updateSelectedCount();
    renderPlayers();
  }

  // Assignment operations delegated to dom-scenario-ops
  const assignDefenseLocal = (position: PositionCode, playerId: string) =>
    assignDefense(position, playerId, workspace, commitWorkspace);
  const clearDefensePositionLocal = (position: PositionCode) =>
    clearDefensePosition(position, commitWorkspace);
  const assignLineupLocal = (index: number, playerId: string) =>
    assignLineup(index, playerId, workspace, commitWorkspace);
  const moveLineupLocal = (fromIndex: number, toIndex: number) =>
    moveLineup(fromIndex, toIndex, commitWorkspace);
  const clearLineupSlotLocal = (index: number) =>
    clearLineupSlot(index, commitWorkspace);
  const clearAssignmentsLocal = () =>
    clearAssignments(commitWorkspace);
  const resetExampleDataLocal = () =>
    resetExampleData(workspace, commitWorkspace, () => { historyState.redo = []; });

  function handleGlobalKeydown(event: KeyboardEvent) {
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
}
