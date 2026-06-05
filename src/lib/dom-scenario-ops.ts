import {
  createDefaultWorkspace,
  createEmptyAssignments,
  getPlayer,
  getPlayerAssignmentState,
  type Player,
  type PositionCode,
  type Scenario,
  type Workspace,
} from "@/lib/workspace";

export type CommitFn = (
  mutator: (draft: Workspace) => Workspace | void,
  options?: { message?: string; recordHistory?: boolean },
) => boolean;

// MIGRATED: pure versions of these functions now live in src/lib/lineup-actions.ts (Phase 4A).
// These CommitFn-based versions remain for legacy DOM manager use only.
export function assignDefense(
  position: PositionCode,
  playerId: string,
  workspace: Workspace,
  commitWorkspace: CommitFn,
) {
  const player = getPlayer(workspace, playerId);
  if (!player) {
    return;
  }
  commitWorkspace((draft) => {
    const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
    const defense = scenario.assignments.defense;
    (Object.keys(defense) as PositionCode[]).forEach((pos) => {
      if (pos !== position && defense[pos] === playerId) {
        defense[pos] = null;
      }
    });
    scenario.assignments.lineup = scenario.assignments.lineup.map(
      (id) => (id === playerId ? null : id),
    );
    defense[position] = playerId;
    scenario.updatedAt = new Date().toISOString();
  }, { message: `已安排 ${player.name} 守 ${position}` });
}

export function clearDefensePosition(position: PositionCode, commitWorkspace: CommitFn) {
  commitWorkspace((draft) => {
    const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
    scenario.assignments.defense[position] = null;
    scenario.updatedAt = new Date().toISOString();
  }, { message: `已清空 ${position}` });
}

export function assignLineup(
  index: number,
  playerId: string,
  workspace: Workspace,
  commitWorkspace: CommitFn,
) {
  const player = getPlayer(workspace, playerId);
  if (!player) {
    return;
  }
  commitWorkspace((draft) => {
    const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
    scenario.assignments.lineup = scenario.assignments.lineup.map(
      (id, i) => (i === index ? playerId : id === playerId ? null : id),
    );
    scenario.updatedAt = new Date().toISOString();
  }, { message: `已放入第 ${index + 1} 棒` });
}

export function moveLineup(fromIndex: number, toIndex: number, commitWorkspace: CommitFn) {
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

export function clearLineupSlot(index: number, commitWorkspace: CommitFn) {
  commitWorkspace((draft) => {
    const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
    scenario.assignments.lineup[index] = null;
    scenario.updatedAt = new Date().toISOString();
  }, { message: `已清空第 ${index + 1} 棒` });
}

export function clearAssignments(commitWorkspace: CommitFn) {
  commitWorkspace((draft) => {
    const scenario = draft.scenarios.find((item) => item.id === draft.activeScenarioId)!;
    scenario.assignments = createEmptyAssignments();
    scenario.updatedAt = new Date().toISOString();
  }, { message: "当前方案阵容已清空" });
}

export function resetExampleData(
  workspace: Workspace,
  commitWorkspace: CommitFn,
  clearRedo: () => void,
): boolean {
  const confirmed = window.confirm(
    "重置示例会恢复默认球员和默认方案，但保留帮助已读状态。继续吗？",
  );
  if (!confirmed) {
    return false;
  }
  commitWorkspace(() => {
    return createDefaultWorkspace(workspace.preferences.helpDismissed);
  }, { message: "已重置为示例数据" });
  clearRedo();
  return true;
}

export type PlayerFilterState = {
  query: string;
  position: string;
  status: string;
  bats: string;
  throws: string;
  assignment: string;
};

export function filterPlayers(
  players: Player[],
  activeScenario: Scenario,
  filter: PlayerFilterState,
) {
  return players.filter((player) => {
    const assignmentState = getPlayerAssignmentState(activeScenario, player.id);
    const matchesSearch =
      !filter.query ||
      player.name.toLowerCase().includes(filter.query) ||
      player.number.toLowerCase().includes(filter.query);
    const matchesPosition =
      filter.position === "all" || player.positions.includes(filter.position as PositionCode);
    const matchesStatus = filter.status === "all" || player.status === filter.status;
    const matchesBats = filter.bats === "all" || player.bats === filter.bats;
    const matchesThrows = filter.throws === "all" || player.throws === filter.throws;
    const matchesAssignment =
      filter.assignment === "all" ||
      (filter.assignment === "unassigned" &&
        !assignmentState.defense &&
        !assignmentState.lineup) ||
      (filter.assignment === "defenseAssigned" && assignmentState.defense) ||
      (filter.assignment === "lineupAssigned" && assignmentState.lineup) ||
      (filter.assignment === "fullyAssigned" &&
        assignmentState.defense &&
        assignmentState.lineup);

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

export function playerIdFromDragToken(
  token: string,
  activeScenario: Scenario,
): string | null {
  if (token.startsWith("player:")) {
    return token.slice("player:".length);
  }
  if (token.startsWith("lineup:")) {
    return activeScenario.assignments.lineup[Number(token.slice("lineup:".length))] || null;
  }
  return null;
}
