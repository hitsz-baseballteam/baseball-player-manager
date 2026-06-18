"use client";

import { useCallback, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { BenchPanel } from "@/components/bench-panel";
import { FieldBoard } from "@/components/field-board";
import { LineupOrder } from "@/components/lineup-order";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import styles from "@/components/lineup-page-client.module.css";
import {
  assignDefensePosition,
  assignLineupSlot,
  autoAssignActive,
  clearAllAssignments,
  clearDefensePosition,
  clearLineupSlot,
  moveLineupSlot,
  setActiveScenarioAction,
  swapDefensePositions,
} from "@/lib/lineup-actions";
import { panelNavItems } from "@/lib/routes";
import {
  analyzeScenarioWarnings,
  getActiveScenario,
  type PositionCode,
  type Workspace,
} from "@/lib/workspace";
import {
  activateScenario,
  isVersionConflict,
  type WorkspaceSnapshot,
  updateScenarioAssignments,
} from "@/lib/workspace-client";
import { useWorkspaceSnapshot } from "@/lib/use-workspace-snapshot";

const NAV_ITEMS = panelNavItems("战术场景");

type LineupPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

export function LineupPageClient({ initialWorkspace, initialVersion }: LineupPageClientProps) {
  const { workspace, version, setWorkspace, applySnapshot, refreshWorkspace } =
    useWorkspaceSnapshot(initialWorkspace, initialVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const toastRef = useRef<ToastHandle | null>(null);

  const activeScenario = getActiveScenario(workspace);
  const warnings = analyzeScenarioWarnings(workspace, activeScenario);
  const allWarnings = [...warnings.critical, ...warnings.advisory];

  const handleSave = useCallback(
    async (
      updated: Workspace,
      submit: (workspace: Workspace, version: number) => Promise<WorkspaceSnapshot>,
    ) => {
      setWorkspace(updated);
      setSaveError(null);
      setIsSaving(true);
      try {
        const result = await submit(updated, version);
        applySnapshot(result);
      } catch (error) {
        if (isVersionConflict(error)) {
          await refreshWorkspace();
          toastRef.current?.showToast("工作区已被更新，已刷新到最新版本");
        } else {
          setSaveError("保存失败，请重试");
        }
      } finally {
        setIsSaving(false);
      }
    },
    [version, setWorkspace, applySnapshot, refreshWorkspace],
  );

  function handleAutoAssign() {
    const updated = autoAssignActive(workspace);
    const scenario = getActiveScenario(updated);
    void handleSave(
      updated,
      (_next, currentVersion) =>
        updateScenarioAssignments(scenario.id, scenario.assignments, currentVersion, scenario.updatedAt),
    );
    toastRef.current?.showToast("已自动排阵");
  }

  function handleClearAll() {
    if (!window.confirm("确认清空当前方案的守备和打线分配？")) return;
    const updated = clearAllAssignments(workspace);
    const scenario = getActiveScenario(updated);
    void handleSave(
      updated,
      (_next, currentVersion) =>
        updateScenarioAssignments(scenario.id, scenario.assignments, currentVersion, scenario.updatedAt),
    );
    toastRef.current?.showToast("阵容已清空");
  }

  function handleScenarioChange(id: string) {
    void handleSave(setActiveScenarioAction(workspace, id), (_next, currentVersion) =>
      activateScenario(id, currentVersion));
  }

  function handleDefenseAssign(position: PositionCode, playerId: string) {
    const updated = assignDefensePosition(workspace, position, playerId);
    const scenario = getActiveScenario(updated);
    void handleSave(
      updated,
      (_next, currentVersion) =>
        updateScenarioAssignments(scenario.id, scenario.assignments, currentVersion, scenario.updatedAt),
    );
  }

  function handleDefenseClear(position: PositionCode) {
    const updated = clearDefensePosition(workspace, position);
    const scenario = getActiveScenario(updated);
    void handleSave(
      updated,
      (_next, currentVersion) =>
        updateScenarioAssignments(scenario.id, scenario.assignments, currentVersion, scenario.updatedAt),
    );
  }

  function handleDefenseSwap(fromPos: PositionCode, toPos: PositionCode) {
    const updated = swapDefensePositions(workspace, fromPos, toPos);
    const scenario = getActiveScenario(updated);
    void handleSave(
      updated,
      (_next, currentVersion) =>
        updateScenarioAssignments(scenario.id, scenario.assignments, currentVersion, scenario.updatedAt),
    );
  }

  function handleLineupAssign(index: number, playerId: string) {
    const updated = assignLineupSlot(workspace, index, playerId);
    const scenario = getActiveScenario(updated);
    void handleSave(
      updated,
      (_next, currentVersion) =>
        updateScenarioAssignments(scenario.id, scenario.assignments, currentVersion, scenario.updatedAt),
    );
  }

  function handleLineupClear(index: number) {
    const updated = clearLineupSlot(workspace, index);
    const scenario = getActiveScenario(updated);
    void handleSave(
      updated,
      (_next, currentVersion) =>
        updateScenarioAssignments(scenario.id, scenario.assignments, currentVersion, scenario.updatedAt),
    );
  }

  function handleLineupMove(fromIndex: number, toIndex: number) {
    const updated = moveLineupSlot(workspace, fromIndex, toIndex);
    const scenario = getActiveScenario(updated);
    void handleSave(
      updated,
      (_next, currentVersion) =>
        updateScenarioAssignments(scenario.id, scenario.assignments, currentVersion, scenario.updatedAt),
    );
  }

  return (
    <ToastProvider toastRef={toastRef}>
      <AppShell
        eyebrow="Lineup Board"
        title="排阵工作台"
        description={`${workspace.scenarios.length} 个方案 · 当前：${activeScenario.name}`}
        statusLabel="工作区"
        statusValue={`v${version}`}
        statusMeta={isSaving ? "保存中…" : "排阵已连接共享工作区"}
        navItems={[...NAV_ITEMS]}
      >
        {/* Action bar */}
        <div className={styles.actionBar}>
          <select
            className={styles.scenarioSelect}
            value={workspace.activeScenarioId}
            onChange={(e) => handleScenarioChange(e.target.value)}
            aria-label="切换当前方案"
          >
            {workspace.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            className={styles.btnPrimary}
            onClick={handleAutoAssign}
            disabled={isSaving}
            type="button"
          >
            自动排阵
          </button>
          <button
            className={styles.btnSecondary}
            onClick={handleClearAll}
            disabled={isSaving}
            type="button"
          >
            清空阵容
          </button>

          <div className={styles.actionSpacer} />

          {saveError && <span className={styles.saveError}>{saveError}</span>}
          {isSaving && <span className={styles.saveStatus}>保存中…</span>}
        </div>

        {/* Warnings bar */}
        {allWarnings.length > 0 && (
          <div className={styles.warningsBar} aria-label="排阵警告">
            {allWarnings.map((w, i) => (
              <span key={i} className={styles.warningChip}>
                {w}
              </span>
            ))}
          </div>
        )}

        {/* Three-column board: field | lineup | bench */}
        <div className={styles.board}>
          <div className={styles.boardField}>
            <FieldBoard
              players={workspace.players}
              defense={activeScenario.assignments.defense}
              onAssign={handleDefenseAssign}
              onClear={handleDefenseClear}
              onSwap={handleDefenseSwap}
            />
          </div>

          <div className={styles.sideRail}>
            <LineupOrder
              players={workspace.players}
              lineup={activeScenario.assignments.lineup}
              onAssign={handleLineupAssign}
              onClear={handleLineupClear}
              onMove={handleLineupMove}
            />
          </div>

          <div className={styles.benchColumn}>
            <BenchPanel
              players={workspace.players}
              defense={activeScenario.assignments.defense}
              lineup={activeScenario.assignments.lineup}
            />
          </div>
        </div>
      </AppShell>
    </ToastProvider>
  );
}
