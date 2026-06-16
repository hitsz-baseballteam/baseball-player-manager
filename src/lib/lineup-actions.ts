import {
  buildAutoScenario,
  createEmptyAssignments,
  createScenario,
  createUniqueScenarioName,
  getActiveScenario,
  type PositionCode,
  type Workspace,
} from "@/lib/workspace";

// ── Helpers ──

function cloneActive(workspace: Workspace) {
  const ws = structuredClone(workspace);
  const scenario = ws.scenarios.find((s) => s.id === ws.activeScenarioId) ?? ws.scenarios[0];
  return { ws, scenario };
}

// ── Defense ──

export function assignDefensePosition(
  workspace: Workspace,
  position: PositionCode,
  playerId: string,
): Workspace {
  const { ws, scenario } = cloneActive(workspace);
  const defense = scenario.assignments.defense;
  const lineup = scenario.assignments.lineup;

  // Clear the same player from any other defense slot
  for (const pos of Object.keys(defense) as PositionCode[]) {
    if (pos !== position && defense[pos] === playerId) {
      defense[pos] = null;
    }
  }

  const oldPlayerId = defense[position];
  defense[position] = playerId;

  // Auto-sync lineup: new defender replaces old defender's batting slot
  if (playerId !== oldPlayerId && !lineup.includes(playerId)) {
    if (oldPlayerId) {
      // Replace old defender's slot in the lineup
      const oldSlot = lineup.indexOf(oldPlayerId);
      if (oldSlot >= 0) {
        lineup[oldSlot] = playerId;
      } else {
        // Old player wasn't batting — put new player in first empty slot
        const firstEmpty = lineup.findIndex((slot) => slot === null);
        if (firstEmpty >= 0) lineup[firstEmpty] = playerId;
      }
    } else {
      // Position was empty — add to first empty batting slot
      const firstEmpty = lineup.findIndex((slot) => slot === null);
      if (firstEmpty >= 0) lineup[firstEmpty] = playerId;
    }
  }

  scenario.updatedAt = new Date().toISOString();
  return ws;
}

export function clearDefensePosition(
  workspace: Workspace,
  position: PositionCode,
): Workspace {
  const { ws, scenario } = cloneActive(workspace);
  scenario.assignments.defense[position] = null;
  scenario.updatedAt = new Date().toISOString();
  return ws;
}

export function swapDefensePositions(
  workspace: Workspace,
  fromPos: PositionCode,
  toPos: PositionCode,
): Workspace {
  if (fromPos === toPos) return structuredClone(workspace);
  const { ws, scenario } = cloneActive(workspace);
  const defense = scenario.assignments.defense;
  const tmp = defense[fromPos];
  defense[fromPos] = defense[toPos];
  defense[toPos] = tmp;
  scenario.updatedAt = new Date().toISOString();
  return ws;
}

// ── Lineup ──

export function assignLineupSlot(
  workspace: Workspace,
  index: number,
  playerId: string,
): Workspace {
  const { ws, scenario } = cloneActive(workspace);
  // Clear the same player from any other lineup slot
  scenario.assignments.lineup = scenario.assignments.lineup.map((id, i) => {
    if (i === index) return playerId;
    if (id === playerId) return null;
    return id;
  });
  scenario.updatedAt = new Date().toISOString();
  return ws;
}

export function clearLineupSlot(
  workspace: Workspace,
  index: number,
): Workspace {
  const { ws, scenario } = cloneActive(workspace);
  scenario.assignments.lineup[index] = null;
  scenario.updatedAt = new Date().toISOString();
  return ws;
}

export function moveLineupSlot(
  workspace: Workspace,
  fromIndex: number,
  toIndex: number,
): Workspace {
  if (fromIndex === toIndex) return structuredClone(workspace);
  const { ws, scenario } = cloneActive(workspace);
  const lineup = [...scenario.assignments.lineup];
  const [moved] = lineup.splice(fromIndex, 1);
  lineup.splice(toIndex, 0, moved);
  scenario.assignments.lineup = lineup.slice(0, 9);
  scenario.updatedAt = new Date().toISOString();
  return ws;
}

// ── Bulk ──

export function clearAllAssignments(workspace: Workspace): Workspace {
  const { ws, scenario } = cloneActive(workspace);
  scenario.assignments = createEmptyAssignments();
  scenario.updatedAt = new Date().toISOString();
  return ws;
}

export function autoAssignActive(workspace: Workspace): Workspace {
  const ws = structuredClone(workspace);
  const scenario = ws.scenarios.find((s) => s.id === ws.activeScenarioId) ?? ws.scenarios[0];
  const result = buildAutoScenario(ws, scenario);
  scenario.assignments = result.assignments;
  scenario.updatedAt = new Date().toISOString();
  return ws;
}

// ── Scenario CRUD ──

export function createScenarioAction(
  workspace: Workspace,
  name: string,
  note: string,
): Workspace {
  const ws = structuredClone(workspace);
  const scenario = createScenario(name.trim().slice(0, 24) || "未命名方案", note.trim().slice(0, 120));
  ws.scenarios.push(scenario);
  return ws;
}

export function renameScenarioAction(
  workspace: Workspace,
  id: string,
  name: string,
  note: string,
): Workspace {
  const ws = structuredClone(workspace);
  const scenario = ws.scenarios.find((s) => s.id === id);
  if (!scenario) return ws;
  scenario.name = name.trim().slice(0, 24) || "未命名方案";
  scenario.note = note.trim().slice(0, 120);
  scenario.updatedAt = new Date().toISOString();
  return ws;
}

export function copyScenarioAction(workspace: Workspace, id: string): Workspace {
  const ws = structuredClone(workspace);
  const source = ws.scenarios.find((s) => s.id === id);
  if (!source) return ws;
  const newName = createUniqueScenarioName(source.name, ws.scenarios, " (副本)");
  const copy = createScenario(newName, source.note, structuredClone(source.assignments));
  ws.scenarios.push(copy);
  return ws;
}

export function deleteScenarioAction(workspace: Workspace, id: string): Workspace {
  if (workspace.scenarios.length <= 1) {
    throw new Error("无法删除最后一个方案");
  }
  const ws = structuredClone(workspace);
  ws.scenarios = ws.scenarios.filter((s) => s.id !== id);
  if (ws.activeScenarioId === id) {
    ws.activeScenarioId = ws.scenarios[0].id;
  }
  return ws;
}

export function setActiveScenarioAction(workspace: Workspace, id: string): Workspace {
  const ws = structuredClone(workspace);
  const exists = ws.scenarios.some((s) => s.id === id);
  if (!exists) return ws;
  ws.activeScenarioId = id;
  return ws;
}

// ── Validation ──

export function validateScenarioName(
  name: string,
  workspace: Workspace,
  excludeId?: string,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "方案名称不能为空";
  if (trimmed.length > 24) return "方案名称不能超过 24 个字符";
  const duplicate = workspace.scenarios.some(
    (s) => s.name === trimmed && s.id !== (excludeId ?? ""),
  );
  if (duplicate) return `已有名为"${trimmed}"的方案，请换一个名称`;
  return null;
}

// Re-export active scenario helper for convenience
export { getActiveScenario };
