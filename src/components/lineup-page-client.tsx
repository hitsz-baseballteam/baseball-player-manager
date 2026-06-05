"use client";

import { useCallback, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { BenchPanel } from "@/components/bench-panel";
import { FieldBoard } from "@/components/field-board";
import { LineupOrder } from "@/components/lineup-order";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import styles from "@/components/lineup-page-client.module.css";
import {
  assignDefensePosition,
  assignLineupSlot,
  autoAssignActive,
  clearAllAssignments,
  clearDefensePosition,
  clearLineupSlot,
  setActiveScenarioAction,
} from "@/lib/lineup-actions";
import {
  analyzeScenarioWarnings,
  getActiveScenario,
  sanitizeWorkspace,
  type PositionCode,
  type Workspace,
} from "@/lib/workspace";
import {
  isVersionConflict,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
} from "@/lib/workspace-client";

const NAV_ITEMS = [
  { label: "总览", href: "/" },
  { label: "名册", href: "/roster" },
  { label: "排阵", href: "/lineup", active: true },
  { label: "战术场景", disabled: true, status: "规划中" },
  { label: "数据中心", disabled: true, status: "规划中" },
  { label: "设置", disabled: true, status: "规划中" },
] as const;

type LineupPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

export function LineupPageClient({ initialWorkspace, initialVersion }: LineupPageClientProps) {
  const [workspace, setWorkspace] = useState(() => sanitizeWorkspace(initialWorkspace));
  const [version, setVersion] = useState(initialVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const toastRef = useRef<ToastHandle | null>(null);

  const activeScenario = getActiveScenario(workspace);
  const warnings = analyzeScenarioWarnings(workspace, activeScenario);
  const allWarnings = [...warnings.critical, ...warnings.advisory];

  const handleSave = useCallback(
    async (updated: Workspace) => {
      setWorkspace(updated);
      setSaveError(null);
      setIsSaving(true);
      try {
        const result = await saveWorkspaceSnapshot(updated, version);
        setWorkspace(sanitizeWorkspace(result.workspace));
        setVersion(result.version);
      } catch (error) {
        if (isVersionConflict(error)) {
          const fresh = await loadWorkspaceSnapshot();
          setWorkspace(sanitizeWorkspace(fresh.workspace));
          setVersion(fresh.version);
          toastRef.current?.showToast("工作区已被更新，已刷新到最新版本");
        } else {
          setSaveError("保存失败，请重试");
        }
      } finally {
        setIsSaving(false);
      }
    },
    [version],
  );

  function handleAutoAssign() {
    handleSave(autoAssignActive(workspace));
    toastRef.current?.showToast("已自动排阵");
  }

  function handleClearAll() {
    if (!window.confirm("确认清空当前方案的守备和打线分配？")) return;
    handleSave(clearAllAssignments(workspace));
    toastRef.current?.showToast("阵容已清空");
  }

  function handleScenarioChange(id: string) {
    handleSave(setActiveScenarioAction(workspace, id));
  }

  function handleDefenseAssign(position: PositionCode, playerId: string) {
    handleSave(assignDefensePosition(workspace, position, playerId));
  }

  function handleDefenseClear(position: PositionCode) {
    handleSave(clearDefensePosition(workspace, position));
  }

  function handleLineupAssign(index: number, playerId: string) {
    handleSave(assignLineupSlot(workspace, index, playerId));
  }

  function handleLineupClear(index: number) {
    handleSave(clearLineupSlot(workspace, index));
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
        actions={<ThemeToggle />}
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

        {/* Three-column board */}
        <div className={styles.board}>
          <BenchPanel
            players={workspace.players}
            defense={activeScenario.assignments.defense}
            lineup={activeScenario.assignments.lineup}
          />
          <FieldBoard
            players={workspace.players}
            defense={activeScenario.assignments.defense}
            onAssign={handleDefenseAssign}
            onClear={handleDefenseClear}
          />
          <LineupOrder
            players={workspace.players}
            lineup={activeScenario.assignments.lineup}
            onAssign={handleLineupAssign}
            onClear={handleLineupClear}
          />
        </div>
      </AppShell>
    </ToastProvider>
  );
}
