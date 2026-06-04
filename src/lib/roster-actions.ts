import {
  createDefaultPlayerProfile,
  createId,
  inferPlayerProfileType,
  removePlayersFromWorkspace,
  sanitizePositions,
  type Hand,
  type Player,
  type PlayerStatus,
  type PositionCode,
  type Workspace,
} from "@/lib/workspace";

// ── Validation ──

export type PlayerUpsertValidation = {
  valid: false;
  error: string;
} | {
  valid: true;
};

export function validatePlayerUpsert(
  name: string,
  number: string,
  positions: PositionCode[],
  existingPlayers: Player[],
  excludePlayerId?: string,
): PlayerUpsertValidation {
  if (!name.trim() || !number.trim()) {
    return { valid: false, error: "姓名和背号不能为空" };
  }

  const duplicate = existingPlayers.some(
    (player) => player.number === number.trim() && player.id !== (excludePlayerId ?? ""),
  );
  if (duplicate) {
    return { valid: false, error: `背号 ${number.trim()} 已被使用，请更换` };
  }

  if (!positions.length) {
    return { valid: false, error: "请至少选择一个守位" };
  }

  return { valid: true };
}

// ── Player Upsert ──

export type PlayerUpsertInput = {
  id?: string;
  name: string;
  number: string;
  bats: Hand;
  throws: Hand;
  positions: PositionCode[];
  status: PlayerStatus;
};

export function upsertPlayer(
  draft: Workspace,
  input: PlayerUpsertInput,
  existingPlayer: Player | null,
): Player {
  const id = input.id || createId();
  const profile = existingPlayer?.profile
    ? { ...existingPlayer.profile, profileType: inferPlayerProfileType(input.positions) }
    : createDefaultPlayerProfile(inferPlayerProfileType(input.positions));

  const player: Player = {
    id,
    name: input.name.trim(),
    number: input.number.trim(),
    bats: input.bats,
    throws: input.throws,
    positions: input.positions,
    status: input.status,
    profile,
  };

  const existingIndex = draft.players.findIndex((p) => p.id === id);
  if (existingIndex >= 0) {
    draft.players[existingIndex] = player;
  } else {
    draft.players.push(player);
  }

  return player;
}

// ── Bulk Edit ──

export type BulkEditInput = {
  status: "keep" | PlayerStatus;
  bats: "keep" | Hand;
  throws: "keep" | Hand;
  positionMode: "keep" | "append" | "replace" | "remove";
  positions: PositionCode[];
};

export type BulkEditValidation = {
  valid: false;
  error: string;
} | {
  valid: true;
};

export function validateBulkEdit(
  selectedIds: string[],
  input: BulkEditInput,
): BulkEditValidation {
  if (!selectedIds.length) {
    return { valid: false, error: "没有可批量修改的球员" };
  }

  const hasFieldChange =
    input.status !== "keep" ||
    input.bats !== "keep" ||
    input.throws !== "keep" ||
    input.positionMode !== "keep";

  if (!hasFieldChange) {
    return { valid: false, error: "请至少选择一个批量修改项" };
  }
  if (input.positionMode !== "keep" && !input.positions.length) {
    return { valid: false, error: "请选择至少一个守位" };
  }

  return { valid: true };
}

export function applyBulkEdit(
  draft: Workspace,
  selectedIds: string[],
  input: BulkEditInput,
): number {
  const selectedSet = new Set(selectedIds);
  let changedCount = 0;

  draft.players = draft.players.map((player) => {
    if (!selectedSet.has(player.id)) {
      return player;
    }
    changedCount += 1;
    const updated = { ...player };
    if (input.status !== "keep") {
      updated.status = input.status;
    }
    if (input.bats !== "keep") {
      updated.bats = input.bats;
    }
    if (input.throws !== "keep") {
      updated.throws = input.throws;
    }
    if (input.positionMode === "append") {
      updated.positions = sanitizePositions([
        ...updated.positions,
        ...input.positions,
      ]);
    } else if (input.positionMode === "replace") {
      updated.positions = sanitizePositions(input.positions);
    } else if (input.positionMode === "remove") {
      updated.positions = updated.positions.filter(
        (position) => !input.positions.includes(position),
      );
    }
    if (input.positionMode !== "keep") {
      updated.profile = {
        ...updated.profile,
        profileType: inferPlayerProfileType(updated.positions),
      };
    }
    return updated;
  });

  return changedCount;
}

// ── Delete ──

export function deletePlayers(
  draft: Workspace,
  ids: string[],
): number {
  const before = draft.players.length;
  removePlayersFromWorkspace(draft, ids);
  return before - draft.players.length;
}
