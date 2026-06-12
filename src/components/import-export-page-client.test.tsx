import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { createDefaultWorkspace, type PendingImport, type Workspace } from "@/lib/workspace";

type ExportActionsModule = typeof import("@/lib/export-actions");

type ImportExportPageClientType = typeof import("./import-export-page-client").ImportExportPageClient;

let ImportExportPageClient: ImportExportPageClientType;
const baseWorkspace = createDefaultWorkspace(true);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("ImportExportPageClient", () => {
  let buildWorkspaceExportCalls = 0;
  let buildScenarioExportCalls = 0;
  let buildCsvExportCalls = 0;
  let createUrlCalls = 0;
  let anchorClickCalls = 0;
  const originalCreateElement = document.createElement.bind(document);
  const originalCreateObjectUrl = globalThis.URL.createObjectURL;
  const originalRevokeObjectUrl = globalThis.URL.revokeObjectURL;

  const workspacePending: PendingImport = {
    type: "workspace",
    fileName: "workspace.json",
    workspace: clone(baseWorkspace),
    names: baseWorkspace.scenarios.map((item) => item.name),
    summary: "导入完整工作区，将覆盖当前共享数据。",
  };

  const scenarioPending: PendingImport = {
    type: "scenario",
    fileName: "scenario.json",
    scenario: clone(baseWorkspace.scenarios[0]),
    players: clone(baseWorkspace.players.slice(0, 3)),
    names: [baseWorkspace.scenarios[0].name],
    summary: "导入单个方案并补齐缺失球员。",
  };

  beforeEach(async () => {
    buildWorkspaceExportCalls = 0;
    buildScenarioExportCalls = 0;
    buildCsvExportCalls = 0;
    createUrlCalls = 0;
    anchorClickCalls = 0;
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");

    document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
      const el = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        el.click = () => {
          anchorClickCalls += 1;
        };
      }
      return el;
    }) as typeof document.createElement;

    globalThis.URL.createObjectURL = (() => {
      createUrlCalls += 1;
      return `blob:mock-${createUrlCalls}`;
    }) as typeof URL.createObjectURL;
    globalThis.URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;

    mock.module("@/lib/export-actions", {
      namedExports: {
        buildWorkspaceExport(workspace: Workspace) {
          buildWorkspaceExportCalls += 1;
          return {
            type: "workspace",
            version: 2,
            exportedAt: "2026-06-05T00:00:00.000Z",
            players: workspace.players,
            scenarios: workspace.scenarios,
            activeScenarioId: workspace.activeScenarioId,
          };
        },
        buildScenarioExport(workspace: Workspace) {
          buildScenarioExportCalls += 1;
          return {
            type: "scenario",
            version: 2,
            exportedAt: "2026-06-05T00:00:00.000Z",
            players: workspace.players.slice(0, 2),
            scenario: workspace.scenarios[0],
          };
        },
        buildCsvExport() {
          buildCsvExportCalls += 1;
          return "背号,姓名\n18,陈浩宇";
        },
        parseImportPayload(value: unknown) {
          const v = value as { kind?: string };
          return v.kind === "scenario" ? scenarioPending : workspacePending;
        },
        applyWorkspaceImport() {
          return clone(baseWorkspace);
        },
        applyScenarioImport() {
          return clone(baseWorkspace);
        },
      } satisfies Partial<ExportActionsModule>,
    });

    ({ ImportExportPageClient } = await import("./import-export-page-client"));
  });

  afterEach(() => {
    cleanup();
    mock.reset();
    document.body.innerHTML = "";
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.createElement = originalCreateElement;
    globalThis.URL.createObjectURL = originalCreateObjectUrl;
    globalThis.URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it("renders 3 export buttons and import input", () => {
    render(
      <ImportExportPageClient
        initialWorkspace={baseWorkspace}
        initialVersion={3}
      />,
    );

    assert.ok(screen.getByRole("button", { name: "导出工作区 JSON" }));
    assert.ok(screen.getByRole("button", { name: "导出当前方案 JSON" }));
    assert.ok(screen.getByRole("button", { name: "导出球员 CSV" }));
    assert.ok(screen.getByLabelText("选择 JSON 文件"));
  });

  it("clicking export buttons calls builders and triggers download helper", () => {
    render(
      <ImportExportPageClient
        initialWorkspace={baseWorkspace}
        initialVersion={3}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "导出工作区 JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "导出当前方案 JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "导出球员 CSV" }));

    assert.equal(buildWorkspaceExportCalls, 1);
    assert.equal(buildScenarioExportCalls, 1);
    assert.equal(buildCsvExportCalls, 1);
    assert.equal(createUrlCalls, 3);
    assert.equal(anchorClickCalls, 3);
  });

  it("uploads valid workspace JSON and shows summary card", async () => {
    render(
      <ImportExportPageClient
        initialWorkspace={baseWorkspace}
        initialVersion={3}
      />,
    );

    const input = screen.getByLabelText("选择 JSON 文件") as HTMLInputElement;
    const file = new File([JSON.stringify({ kind: "workspace" })], "workspace.json", {
      type: "application/json",
    });

    fireEvent.change(input, { target: { files: [file] } });

    assert.ok(await screen.findByLabelText("导入摘要卡"));
    assert.ok(screen.getByText("workspace"));
    assert.ok(screen.getByText("导入完整工作区，将覆盖当前共享数据。"));
  });

  it("uploads valid scenario JSON and shows summary card", async () => {
    render(
      <ImportExportPageClient
        initialWorkspace={baseWorkspace}
        initialVersion={3}
      />,
    );

    const input = screen.getByLabelText("选择 JSON 文件") as HTMLInputElement;
    const file = new File([JSON.stringify({ kind: "scenario" })], "scenario.json", {
      type: "application/json",
    });

    fireEvent.change(input, { target: { files: [file] } });

    assert.ok(await screen.findByLabelText("导入摘要卡"));
    assert.ok(screen.getByText("scenario"));
    assert.ok(screen.getByText("导入单个方案并补齐缺失球员。"));
  });

  it("clicking cancel import hides summary card", async () => {
    render(
      <ImportExportPageClient
        initialWorkspace={baseWorkspace}
        initialVersion={3}
      />,
    );

    const input = screen.getByLabelText("选择 JSON 文件") as HTMLInputElement;
    const file = new File([JSON.stringify({ kind: "workspace" })], "workspace.json", {
      type: "application/json",
    });

    fireEvent.change(input, { target: { files: [file] } });
    assert.ok(await screen.findByLabelText("导入摘要卡"));

    fireEvent.click(screen.getByRole("button", { name: "取消导入" }));
    assert.equal(screen.queryByLabelText("导入摘要卡"), null);
  });
});
