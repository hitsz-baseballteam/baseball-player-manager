import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyScenarioImport,
  applyWorkspaceImport,
  buildCsvExport,
  buildScenarioExport,
  buildWorkspaceExport,
  parseImportPayload,
} from "@/lib/export-actions";
import {
  assignDefensePosition,
  assignLineupSlot,
  createScenarioAction,
} from "@/lib/lineup-actions";
import {
  cloneWorkspace,
  createDefaultWorkspace,
  createEmptyAssignments,
  createScenario,
  getActiveScenario,
  type Workspace,
} from "@/lib/workspace";

describe("export-actions", () => {
  function fresh() {
    return cloneWorkspace(createDefaultWorkspace(true));
  }

  describe("buildWorkspaceExport", () => {
    it("outputs the expected workspace export shape", () => {
      const workspace = fresh();
      const result = buildWorkspaceExport(workspace);

      assert.equal(result.type, "workspace");
      assert.equal(result.version, 2);
      assert.ok(result.exportedAt);
      assert.equal(result.players, workspace.players);
      assert.equal(result.scenarios, workspace.scenarios);
    });

    it("includes the activeScenarioId", () => {
      const workspace = fresh();
      const result = buildWorkspaceExport(workspace);
      assert.equal(result.activeScenarioId, workspace.activeScenarioId);
    });
  });

  describe("buildScenarioExport", () => {
    it("defaults to the active scenario", () => {
      const workspace = fresh();
      const result = buildScenarioExport(workspace);
      assert.equal(result.scenario.id, workspace.activeScenarioId);
    });

    it("exports the specified scenarioId when provided", () => {
      const workspace = createScenarioAction(fresh(), "备用方案", "");
      const scenarioId = workspace.scenarios.at(-1)!.id;
      const result = buildScenarioExport(workspace, scenarioId);
      assert.equal(result.scenario.id, scenarioId);
    });

    it("includes only players referenced by the scenario", () => {
      const workspace = fresh();
      const playerA = workspace.players[0].id;
      const playerB = workspace.players[1].id;
      let withAssignments = assignDefensePosition(workspace, "P", playerA);
      withAssignments = assignLineupSlot(withAssignments, 0, playerB);

      const result = buildScenarioExport(withAssignments);
      assert.deepEqual(
        result.players.map((player) => player.id),
        [playerA, playerB],
      );
    });

    it("throws when scenarioId does not exist", () => {
      assert.throws(() => buildScenarioExport(fresh(), "missing-scenario"), /scenario not found/);
    });
  });

  describe("buildCsvExport", () => {
    it("returns BOM-prefixed CSV with the expected header", () => {
      const csv = buildCsvExport(fresh());
      assert.ok(csv.startsWith("\uFEFF背号,姓名,状态,守位,打击,投球\n"));
    });

    it("uses Chinese status and hand labels", () => {
      const csv = buildCsvExport(fresh());
      assert.match(csv, /可上场/);
      assert.match(csv, /右/);
      assert.match(csv, /左/);
      assert.match(csv, /双/);
    });

    it("quotes and escapes the positions field", () => {
      const workspace = fresh();
      workspace.players[0].positions = ["P", "1B"];
      const csv = buildCsvExport(workspace);
      assert.match(csv, /"P,1B"/);
    });
  });

  describe("parseImportPayload", () => {
    it("returns PendingImport for workspace payload", () => {
      const pending = parseImportPayload(buildWorkspaceExport(fresh()));
      assert.equal(pending.type, "workspace");
      assert.equal(pending.fileName, "import.json");
    });

    it("throws on invalid payload", () => {
      assert.throws(() => parseImportPayload({ type: "bad" }), /unsupported payload/);
    });
  });

  describe("applyWorkspaceImport", () => {
    it("returns the imported workspace from a workspace pending payload", () => {
      const current = fresh();
      const imported = createScenarioAction(fresh(), "导入方案", "");
      const pending = parseImportPayload(buildWorkspaceExport(imported));
      assert.equal(pending.type, "workspace");
      const result = applyWorkspaceImport(current, pending);
      assert.equal(result, (pending as { type: "workspace"; workspace: Workspace }).workspace);
    });
  });

  describe("applyScenarioImport", () => {
    it("appends new scenario and missing players", () => {
      const current = fresh();
      const imported = fresh();
      imported.players.push({
        ...imported.players[0],
        id: "new-player",
        name: "新增球员",
        number: "88",
      });
      const importedScenario = createScenario(
        "导入方案",
        "备注",
        createEmptyAssignments(),
      );
      importedScenario.assignments.defense.P = "new-player";
      imported.scenarios = [importedScenario];
      imported.activeScenarioId = importedScenario.id;

      const pending = parseImportPayload(buildScenarioExport(imported));
      const result = applyScenarioImport(current, pending);

      assert.equal(result.scenarios.length, current.scenarios.length + 1);
      assert.ok(result.players.some((player) => player.id === "new-player"));
      assert.ok(result.scenarios.some((scenario) => scenario.name === "导入方案"));
    });

    it("resolves scenario id and name conflicts", () => {
      const current = fresh();
      const active = getActiveScenario(current);
      const incoming = buildScenarioExport(current);
      const pending = parseImportPayload(incoming);
      const result = applyScenarioImport(current, pending);
      const imported = result.scenarios.at(-1)!;

      assert.notEqual(imported.id, active.id);
      assert.notEqual(imported.name, active.name);
      assert.match(imported.name, new RegExp(`^${active.name}`));
    });

    it("keeps the current activeScenarioId unchanged", () => {
      const current = fresh();
      const pending = parseImportPayload(buildScenarioExport(current));
      const result = applyScenarioImport(current, pending);
      assert.equal(result.activeScenarioId, current.activeScenarioId);
    });

    it("throws when given a workspace pending payload", () => {
      const pending = parseImportPayload(buildWorkspaceExport(fresh()));
      assert.throws(
        () => applyScenarioImport(fresh(), pending),
        /pending import is not a scenario payload/,
      );
    });
  });
});
