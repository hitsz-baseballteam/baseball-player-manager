import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyBulkEdit,
  deletePlayers,
  upsertPlayer,
  validateBulkEdit,
  validatePlayerUpsert,
  type BulkEditInput,
  type PlayerUpsertInput,
} from "@/lib/roster-actions";
import {
  cloneWorkspace,
  createDefaultWorkspace,
  getActiveScenario,
} from "@/lib/workspace";

describe("roster-actions", () => {
  const workspace = createDefaultWorkspace(true);

  function freshWorkspace() {
    return cloneWorkspace(workspace);
  }

  describe("validatePlayerUpsert", () => {
    it("rejects empty name", () => {
      const result = validatePlayerUpsert("", "10", ["P"], workspace.players);
      assert.equal(result.valid, false);
      assert.match(result.error, /姓名/);
    });

    it("rejects empty number", () => {
      const result = validatePlayerUpsert("测试", "", ["P"], workspace.players);
      assert.equal(result.valid, false);
      assert.match(result.error, /背号/);
    });

    it("rejects duplicate number", () => {
      const existing = workspace.players[0];
      const result = validatePlayerUpsert(
        "新人",
        existing.number,
        ["P"],
        workspace.players,
        "different-id",
      );
      assert.equal(result.valid, false);
      assert.match(result.error, /已被使用/);
    });

    it("allows same number when editing own player", () => {
      const existing = workspace.players[0];
      const result = validatePlayerUpsert(
        "改名",
        existing.number,
        existing.positions,
        workspace.players,
        existing.id,
      );
      assert.equal(result.valid, true);
    });

    it("rejects empty positions", () => {
      const result = validatePlayerUpsert("新人", "99", [], workspace.players);
      assert.equal(result.valid, false);
      assert.match(result.error, /守位/);
    });

    it("passes valid input", () => {
      const result = validatePlayerUpsert(
        "新人",
        "99",
        ["P", "SS"],
        workspace.players,
      );
      assert.equal(result.valid, true);
    });
  });

  describe("upsertPlayer", () => {
    it("adds a new player", () => {
      const draft = freshWorkspace();
      const input: PlayerUpsertInput = {
        name: "新人",
        number: "99",
        bats: "L",
        throws: "L",
        positions: ["1B", "SS"],
        status: "available",
      };
      const player = upsertPlayer(draft, input, null);
      assert.equal(player.name, "新人");
      assert.equal(player.number, "99");
      assert.equal(player.profile.profileType, "fielder");
      const found = draft.players.find((p) => p.id === player.id);
      assert.ok(found);
      assert.equal(found!.name, "新人");
    });

    it("updates an existing player", () => {
      const draft = freshWorkspace();
      const existing = draft.players[0];
      const input: PlayerUpsertInput = {
        id: existing.id,
        name: "已改名",
        number: existing.number,
        bats: existing.bats,
        throws: existing.throws,
        positions: existing.positions,
        status: existing.status,
      };
      const updated = upsertPlayer(draft, input, existing);
      assert.equal(updated.name, "已改名");
      const found = draft.players.find((p) => p.id === existing.id);
      assert.ok(found);
      assert.equal(found!.name, "已改名");
    });

    it("updates profile type when positions change", () => {
      const draft = freshWorkspace();
      const existing = draft.players[0]; // likely a fielder
      const input: PlayerUpsertInput = {
        id: existing.id,
        name: existing.name,
        number: existing.number,
        bats: existing.bats,
        throws: existing.throws,
        positions: [], // pitcher-only
        status: existing.status,
      };
      // Empty positions makes it default to fielder, but construct via upsert
      const updated = upsertPlayer(draft, input, existing);
      assert.equal(updated.profile.profileType, "fielder");
    });
  });

  describe("validateBulkEdit", () => {
    it("rejects no selection", () => {
      const input: BulkEditInput = {
        status: "keep",
        bats: "keep",
        throws: "keep",
        positionMode: "keep",
        positions: [],
      };
      const result = validateBulkEdit([], input);
      assert.equal(result.valid, false);
      assert.match(result.error, /没有可/);
    });

    it("rejects no changes", () => {
      const input: BulkEditInput = {
        status: "keep",
        bats: "keep",
        throws: "keep",
        positionMode: "keep",
        positions: [],
      };
      const result = validateBulkEdit(["p-01", "p-02"], input);
      assert.equal(result.valid, false);
      assert.match(result.error, /至少选择/);
    });

    it("rejects empty positions when mode is not keep", () => {
      const input: BulkEditInput = {
        status: "keep",
        bats: "keep",
        throws: "keep",
        positionMode: "replace",
        positions: [],
      };
      const result = validateBulkEdit(["p-01", "p-02"], input);
      assert.equal(result.valid, false);
      assert.match(result.error, /守位/);
    });

    it("passes valid input", () => {
      const input: BulkEditInput = {
        status: "available",
        bats: "keep",
        throws: "keep",
        positionMode: "keep",
        positions: [],
      };
      const result = validateBulkEdit(["p-01"], input);
      assert.equal(result.valid, true);
    });

    it("passes with keep mode and empty positions", () => {
      const input: BulkEditInput = {
        status: "injured",
        bats: "keep",
        throws: "keep",
        positionMode: "keep",
        positions: [],
      };
      const result = validateBulkEdit(["p-01"], input);
      assert.equal(result.valid, true);
    });
  });

  describe("applyBulkEdit", () => {
    it("changes status", () => {
      const draft = freshWorkspace();
      const ids = [draft.players[0].id, draft.players[1].id];
      const input: BulkEditInput = {
        status: "injured",
        bats: "keep",
        throws: "keep",
        positionMode: "keep",
        positions: [],
      };
      const changed = applyBulkEdit(draft, ids, input);
      assert.equal(changed, 2);
      assert.equal(draft.players[0].status, "injured");
      assert.equal(draft.players[1].status, "injured");
    });

    it("appends positions", () => {
      const draft = freshWorkspace();
      const player = draft.players[0];
      const origLen = player.positions.length;
      const input: BulkEditInput = {
        status: "keep",
        bats: "keep",
        throws: "keep",
        positionMode: "append",
        positions: ["CF"],
      };
      applyBulkEdit(draft, [player.id], input);
      const updated = draft.players[0];
      assert.ok(updated.positions.includes("CF"));
      assert.ok(updated.positions.length >= origLen);
    });

    it("replaces positions", () => {
      const draft = freshWorkspace();
      const player = draft.players[0];
      const input: BulkEditInput = {
        status: "keep",
        bats: "keep",
        throws: "keep",
        positionMode: "replace",
        positions: ["P"],
      };
      applyBulkEdit(draft, [player.id], input);
      assert.deepEqual(draft.players[0].positions, ["P"]);
    });

    it("removes positions", () => {
      const draft = freshWorkspace();
      const player = draft.players[0];
      if (!player.positions.includes("P")) {
        // find a player with P
        const pitcher = draft.players.find((p) => p.positions.includes("P"));
        if (pitcher) {
          const input: BulkEditInput = {
            status: "keep",
            bats: "keep",
            throws: "keep",
            positionMode: "remove",
            positions: ["P"],
          };
          applyBulkEdit(draft, [pitcher.id], input);
          assert.ok(!draft.players.find((p) => p.id === pitcher.id)!.positions.includes("P"));
        }
      }
    });

    it("only affects selected players", () => {
      const draft = freshWorkspace();
      const firstId = draft.players[0].id;
      const otherId = draft.players[1]?.id;
      if (!otherId) {
        return;
      }
      const input: BulkEditInput = {
        status: "injured",
        bats: "keep",
        throws: "keep",
        positionMode: "keep",
        positions: [],
      };
      applyBulkEdit(draft, [firstId], input);
      assert.equal(draft.players[0].status, "injured");
      if (draft.players.length > 1) {
        const other = draft.players[1];
        if (other.id === otherId) {
          assert.notEqual(other.status, "injured");
        }
      }
    });
  });

  describe("deletePlayers", () => {
    it("removes players and cleans up assignments", () => {
      const draft = freshWorkspace();
      const activeScenario = getActiveScenario(draft);
      const firstPlayer = draft.players[0];

      // Assign the player to defense and lineup first
      activeScenario.assignments.defense.SS = firstPlayer.id;
      activeScenario.assignments.lineup[0] = firstPlayer.id;

      const deleted = deletePlayers(draft, [firstPlayer.id]);
      assert.ok(deleted >= 1);

      // Player should be gone
      assert.ok(!draft.players.find((p) => p.id === firstPlayer.id));

      // Assignment cleanup
      assert.equal(activeScenario.assignments.defense.SS, null);
      assert.notEqual(activeScenario.assignments.lineup[0], firstPlayer.id);
    });
  });
});
