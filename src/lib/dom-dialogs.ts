import {
  createId,
  createDefaultPlayerProfile,
  createEmptyAssignments,
  createScenario,
  createUniqueScenarioName,
  inferPlayerProfileType,
  removePlayersFromWorkspace,
  sanitizePositions,
  type Player,
  type PositionCode,
  type Workspace,
} from "@/lib/workspace";

export type DialogElements = {
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
  bulkPlayerDialog: HTMLDialogElement;
  bulkPlayerForm: HTMLFormElement;
  bulkPlayerSummary: HTMLElement;
  bulkStatus: HTMLSelectElement;
  bulkBats: HTMLSelectElement;
  bulkThrows: HTMLSelectElement;
  bulkPositionMode: HTMLSelectElement;
  bulkPositionChecks: HTMLElement;
  scenarioDialog: HTMLDialogElement;
  scenarioForm: HTMLFormElement;
  scenarioMode: HTMLInputElement;
  scenarioDialogTitle: HTMLElement;
  scenarioNameInput: HTMLInputElement;
  scenarioNoteInput: HTMLTextAreaElement;
};

export type DialogCallbacks = {
  showToast: (message: string) => void;
  getWorkspace: () => Workspace;
  getCurrentPlayer: (id: string | null | undefined) => Player | null;
  getSelectedPlayerIds: () => string[];
  commitWorkspace: (mutator: (draft: Workspace) => Workspace | void, options?: { message?: string; recordHistory?: boolean }) => boolean;
  clearSelectedIds: () => void;
  removeFromSelectedIds: (id: string) => void;
};

export function openPlayerDialog(
  els: DialogElements,
  callbacks: DialogCallbacks,
  id: string | null = null,
) {
  const player = id ? callbacks.getCurrentPlayer(id) : null;
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

export function handlePlayerSubmit(
  event: Event,
  els: DialogElements,
  callbacks: DialogCallbacks,
) {
  event.preventDefault();
  const id = els.playerId.value || createId();
  const existingPlayer = callbacks.getCurrentPlayer(id);
  const positions = Array.from(
    els.positionChecks.querySelectorAll("input:checked"),
  ).map((checkbox) => (checkbox as HTMLInputElement).value as PositionCode);
  const player: Player = {
    id,
    name: els.playerName.value.trim(),
    number: els.playerNumber.value.trim(),
    bats: els.playerBats.value as Player["bats"],
    throws: els.playerThrows.value as Player["throws"],
    positions,
    status: els.playerStatus.value as Player["status"],
    profile:
      existingPlayer?.profile
        ? { ...existingPlayer.profile, profileType: inferPlayerProfileType(positions) }
        : createDefaultPlayerProfile(inferPlayerProfileType(positions)),
  };

  if (!player.name || !player.number) {
    callbacks.showToast("姓名和背号不能为空");
    return;
  }

  const workspace = callbacks.getWorkspace();
  const isDuplicateNumber = workspace.players.some(
    (p) => p.number === player.number && p.id !== id,
  );
  if (isDuplicateNumber) {
    callbacks.showToast(`背号 ${player.number} 已被使用，请更换`);
    return;
  }

  callbacks.commitWorkspace((draft) => {
    const existingIndex = draft.players.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      draft.players[existingIndex] = player as typeof draft.players[number];
    } else {
      draft.players.push(player as typeof draft.players[number]);
    }
  }, { message: "球员已保存" });

  els.playerDialog.close();
}

export function openBulkPlayerDialog(
  els: DialogElements,
  callbacks: DialogCallbacks,
) {
  const ids = callbacks.getSelectedPlayerIds();
  if (!ids.length) {
    callbacks.showToast("请先选择球员");
    return;
  }
  els.bulkPlayerSummary.textContent = `将修改 ${ids.length} 名已选球员。未选择的字段保持原值。`;
  els.bulkStatus.value = "keep";
  els.bulkBats.value = "keep";
  els.bulkThrows.value = "keep";
  els.bulkPositionMode.value = "keep";
  syncBulkPositionMode(els);
  els.bulkPlayerDialog.showModal();
  window.setTimeout(() => els.bulkStatus.focus(), 0);
}

export function syncBulkPositionMode(els: DialogElements) {
  const disabled = els.bulkPositionMode.value === "keep";
  els.bulkPositionChecks.querySelectorAll("input").forEach((checkbox) => {
    const input = checkbox as HTMLInputElement;
    input.disabled = disabled;
    if (disabled) {
      input.checked = false;
    }
  });
}

export function handleBulkPlayerSubmit(
  event: Event,
  els: DialogElements,
  callbacks: DialogCallbacks,
) {
  event.preventDefault();
  const ids = callbacks.getSelectedPlayerIds();
  if (!ids.length) {
    callbacks.showToast("没有可批量修改的球员");
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
    callbacks.showToast("请至少选择一个批量修改项");
    return;
  }
  if (positionMode !== "keep" && !nextPositions.length) {
    callbacks.showToast("请选择至少一个守位");
    return;
  }

  callbacks.commitWorkspace((draft) => {
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
      if (positionMode !== "keep") {
        updatedPlayer.profile = {
          ...updatedPlayer.profile,
          profileType: inferPlayerProfileType(updatedPlayer.positions),
        };
      }
      return updatedPlayer;
    });
  }, { message: `已批量修改 ${ids.length} 名球员` });

  els.bulkPlayerDialog.close();
}

export function deletePlayer(
  id: string,
  callbacks: DialogCallbacks,
) {
  const player = callbacks.getCurrentPlayer(id);
  if (!player) {
    return;
  }
  const confirmed = window.confirm(`删除 ${player.name}？`);
  if (!confirmed) {
    return;
  }

  callbacks.commitWorkspace((draft) => {
    removePlayersFromWorkspace(draft, [id]);
  }, { message: "球员已删除" });

  callbacks.removeFromSelectedIds(id);
}

export function bulkDeletePlayers(callbacks: DialogCallbacks) {
  const ids = callbacks.getSelectedPlayerIds();
  if (!ids.length) {
    callbacks.showToast("请先选择球员");
    return;
  }
  const confirmed = window.confirm(`删除已选的 ${ids.length} 名球员？相关守位和棒次会一并清空。`);
  if (!confirmed) {
    return;
  }

  callbacks.commitWorkspace((draft) => {
    removePlayersFromWorkspace(draft, ids);
  }, { message: `已删除 ${ids.length} 名球员` });
  callbacks.clearSelectedIds();
}

export function openScenarioDialog(
  els: DialogElements,
  mode: "create" | "edit",
  activeScenarioName: string,
  activeScenarioNote: string,
) {
  els.scenarioMode.value = mode;
  els.scenarioDialogTitle.textContent = mode === "create" ? "新建方案" : "编辑方案";
  els.scenarioNameInput.value = mode === "create" ? "" : activeScenarioName;
  els.scenarioNoteInput.value = mode === "create" ? "" : activeScenarioNote;
  els.scenarioDialog.showModal();
  window.setTimeout(() => els.scenarioNameInput.focus(), 0);
}

export function handleScenarioSubmit(
  event: Event,
  els: DialogElements,
  callbacks: DialogCallbacks,
) {
  event.preventDefault();
  const mode = els.scenarioMode.value;
  const name = els.scenarioNameInput.value.trim();
  const note = els.scenarioNoteInput.value.trim();
  if (!name) {
    callbacks.showToast("方案名称不能为空");
    return;
  }

  const activeScenario = callbacks.getCurrentPlayer(null) as unknown as { name: string };

  if (mode === "create") {
    callbacks.commitWorkspace((draft) => {
      const uniqueName = createUniqueScenarioName(name, draft.scenarios, "");
      const scenario = createScenario(uniqueName, note, createEmptyAssignments());
      draft.scenarios.push(scenario);
      draft.activeScenarioId = scenario.id;
    }, { message: "已新建方案" });
  } else {
    callbacks.commitWorkspace((draft) => {
      const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
      const otherScenarios = draft.scenarios.filter((item) => item.id !== scenario.id);
      scenario.name = createUniqueScenarioName(name, otherScenarios, "");
      scenario.note = note.slice(0, 120);
      scenario.updatedAt = new Date().toISOString();
    }, { message: `已更新方案 ${activeScenario.name}` });
  }

  els.scenarioDialog.close();
}

export function duplicateScenario(callbacks: DialogCallbacks) {
  callbacks.commitWorkspace((draft) => {
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

export function deleteScenario(
  callbacks: DialogCallbacks,
  scenarioCount: number,
  activeScenarioName: string,
) {
  if (scenarioCount <= 1) {
    callbacks.showToast("至少保留一套方案");
    return;
  }
  const confirmed = window.confirm(`删除方案「${activeScenarioName}」？`);
  if (!confirmed) {
    return;
  }
  callbacks.commitWorkspace((draft) => {
    draft.scenarios = draft.scenarios.filter(
      (scenario) => scenario.id !== draft.activeScenarioId,
    );
    draft.activeScenarioId = draft.scenarios[0].id;
  }, { message: "方案已删除" });
}
