"use client";

import { useCallback, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { BenchPanel } from "@/components/bench-panel";
import { FieldBoard } from "@/components/field-board";
import { LineupOrder } from "@/components/lineup-order";
import { ScenarioCompare } from "@/components/scenario-compare";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import styles from "@/components/scenarios-page-client.module.css";
import {
  assignDefensePosition,
  assignLineupSlot,
  autoAssignActive,
  clearAllAssignments,
  clearDefensePosition,
  clearLineupSlot,
  copyScenarioAction,
  createScenarioAction,
  deleteScenarioAction,
  moveLineupSlot,
  renameScenarioAction,
  setActiveScenarioAction,
  swapDefensePositions,
  validateScenarioName,
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
  { label: "战术场景", href: "/scenarios", active: true },
  { label: "数据中心", href: "/stats" },
  { label: "设置", href: "/settings" },
] as const;

type ScenarioDialogState =
  | { type: "closed" }
  | { type: "create" }
  | { type: "rename"; scenarioId: string; currentName: string; currentNote: string };

type ViewMode = "lineup" | "compare";

type ScenariosPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

export function ScenariosPageClient({
  initialWorkspace,
  initialVersion,
}: ScenariosPageClientProps) {
  const [workspace, setWorkspace] = useState(() => sanitizeWorkspace(initialWorkspace));
  const [version, setVersion] = useState(initialVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ScenarioDialogState>({ type: "closed" });
  const [viewMode, setViewMode] = useState<ViewMode>("lineup");
  const [compareLeftId, setCompareLeftId] = useState<string | null>(null);
  const [compareRightId, setCompareRightId] = useState<string | null>(null);
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


  // ── Scenario CRUD ──
  // ── Scenario CRUD ──
  function handleScenarioChange(id: string) {
    handleSave(setActiveScenarioAction(workspace, id));
  }

  function handleCreate(name: string, note: string) {
    handleSave(createScenarioAction(workspace, name, note));
    setDialog({ type: "closed" });
    toastRef.current?.showToast("新方案已创建");
  }

  function handleRename(id: string, name: string, note: string) {
    handleSave(renameScenarioAction(workspace, id, name, note));
    setDialog({ type: "closed" });
    toastRef.current?.showToast("方案已更新");
  }

  function handleCopy(id: string) {
    handleSave(copyScenarioAction(workspace, id));
    toastRef.current?.showToast("方案已复制");
  }

  function handleDelete(id: string) {
    if (!window.confirm("确认删除此方案？")) return;
    try {
      handleSave(deleteScenarioAction(workspace, id));
      toastRef.current?.showToast("方案已删除");
    } catch {
      toastRef.current?.showToast("无法删除最后一个方案");
    }
  }

  // ── Lineup actions ──
  function handleAutoAssign() {
    handleSave(autoAssignActive(workspace));
    toastRef.current?.showToast("已自动排阵");
  }

  function handleClearAll() {
    if (!window.confirm("确认清空当前方案的守备和打线分配？")) return;
    handleSave(clearAllAssignments(workspace));
    toastRef.current?.showToast("阵容已清空");
  }

  function handleDefenseAssign(position: PositionCode, playerId: string) {
    handleSave(assignDefensePosition(workspace, position, playerId));
  }

  function handleDefenseClear(position: PositionCode) {
    handleSave(clearDefensePosition(workspace, position));
  }

  function handleDefenseSwap(fromPos: PositionCode, toPos: PositionCode) {
    handleSave(swapDefensePositions(workspace, fromPos, toPos));
  }

  function handleLineupAssign(index: number, playerId: string) {
    handleSave(assignLineupSlot(workspace, index, playerId));
  }

  function handleLineupClear(index: number) {
    handleSave(clearLineupSlot(workspace, index));
  }

  function handleLineupMove(fromIndex: number, toIndex: number) {
    handleSave(moveLineupSlot(workspace, fromIndex, toIndex));
  }

  return (
    <ToastProvider toastRef={toastRef}>
      <AppShell
        eyebrow="Tactical Scenarios"
        title="战术场景 · 排阵工作台"
        description={`${workspace.scenarios.length} 个方案 · 当前：${activeScenario.name}`}
        statusLabel="工作区"
        statusValue={`v${version}`}
        statusMeta={isSaving ? "保存中…" : "方案与排阵已连接共享工作区"}
        navItems={[...NAV_ITEMS]}
        actions={<ThemeToggle />}
      >
        {/* Toolbar */}
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
            className={styles.btnSecondary}
            onClick={() => setDialog({ type: "create" })}
            disabled={isSaving}
            type="button"
          >
            + 新建
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => {
              const s = workspace.scenarios.find((sc) => sc.id === workspace.activeScenarioId);
              if (s) setDialog({ type: "rename", scenarioId: s.id, currentName: s.name, currentNote: s.note });
            }}
            disabled={isSaving}
            type="button"
          >
            改名
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => handleCopy(workspace.activeScenarioId)}
            disabled={isSaving}
            type="button"
          >
            复制
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => handleDelete(workspace.activeScenarioId)}
            disabled={isSaving || workspace.scenarios.length <= 1}
            type="button"
          >
            删除
          </button>

          <div className={styles.actionSpacer} />

          {/* View toggle */}
          <div className={styles.tabGroup}>
            <button
              className={`${styles.tabBtn} ${viewMode === "lineup" ? styles.tabBtnActive : ""}`}
              onClick={() => setViewMode("lineup")}
              type="button"
            >
              排阵
            </button>
            <button
              className={`${styles.tabBtn} ${viewMode === "compare" ? styles.tabBtnActive : ""}`}
              onClick={() => {
                setViewMode("compare");
                if (!compareLeftId) setCompareLeftId(workspace.activeScenarioId);
                if (!compareRightId && workspace.scenarios.length > 1) {
                  setCompareRightId(
                    workspace.scenarios.find((s) => s.id !== workspace.activeScenarioId)?.id ??
                      workspace.scenarios[0].id,
                  );
                }
              }}
              type="button"
            >
              对比
            </button>
          </div>

          {/* Lineup-only actions */}
          {viewMode === "lineup" && (
            <>
              <button className={styles.btnPrimary} onClick={handleAutoAssign} disabled={isSaving} type="button">
                自动排阵
              </button>
              <button className={styles.btnSecondary} onClick={handleClearAll} disabled={isSaving} type="button">
                清空
              </button>
            </>
          )}

          {saveError && <span className={styles.saveError}>{saveError}</span>}
          {isSaving && <span className={styles.saveStatus}>保存中…</span>}
        </div>

        {/* Warnings bar */}
        {viewMode === "lineup" && allWarnings.length > 0 && (
          <div className={styles.warningsBar} aria-label="排阵警告">
            {allWarnings.map((w, i) => (
              <span key={i} className={styles.warningChip}>
                {w}
              </span>
            ))}
          </div>
        )}

        {/* Main area */}
        <div className={viewMode === "lineup" ? styles.board : styles.main}>
          {viewMode === "lineup" ? (
            <>
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
                <div className={styles.sideTop}>
                  <LineupOrder
                    players={workspace.players}
                    lineup={activeScenario.assignments.lineup}
                    onAssign={handleLineupAssign}
                    onClear={handleLineupClear}
                    onMove={handleLineupMove}
                  />
                </div>
                <div className={styles.sideBottom}>
                  <BenchPanel
                    players={workspace.players}
                    defense={activeScenario.assignments.defense}
                    lineup={activeScenario.assignments.lineup}
                  />
                </div>
              </div>
            </>
          ) : viewMode === "compare" ? (
            workspace.scenarios.length < 2 ? (
              <div style={{ padding: "2rem", color: "var(--theme-muted)", textAlign: "center" }}>
                需要至少 2 个方案才能对比。请先新建或复制一个方案。
              </div>
            ) : (
              <ScenarioCompare
                scenarios={workspace.scenarios}
                players={workspace.players}
                leftId={compareLeftId}
                rightId={compareRightId}
                onSetLeft={setCompareLeftId}
                onSetRight={setCompareRightId}
              />
            )
          ) : null}
        </div>

        {/* Scenario dialog (create / rename) */}
        {dialog.type !== "closed" && (
          <ScenarioDialog
            mode={dialog.type}
            currentName={dialog.type === "rename" ? dialog.currentName : ""}
            currentNote={dialog.type === "rename" ? dialog.currentNote : ""}
            workspace={workspace}
            excludeId={dialog.type === "rename" ? dialog.scenarioId : undefined}
            onSubmit={(name, note) => {
              if (dialog.type === "create") handleCreate(name, note);
              else if (dialog.type === "rename") handleRename(dialog.scenarioId, name, note);
            }}
            onClose={() => setDialog({ type: "closed" })}
          />
        )}
      </AppShell>
    </ToastProvider>
  );
}

// ── Scenario Dialog (create / rename) ──
type ScenarioDialogProps = {
  mode: "create" | "rename";
  currentName: string;
  currentNote: string;
  workspace: Workspace;
  excludeId?: string;
  onSubmit: (name: string, note: string) => void;
  onClose: () => void;
};

function ScenarioDialog({
  mode,
  currentName,
  currentNote,
  workspace,
  excludeId,
  onSubmit,
  onClose,
}: ScenarioDialogProps) {
  const [name, setName] = useState(currentName);
  const [note, setNote] = useState(currentNote);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = name.trim();
    const err = validateScenarioName(trimmed, workspace, excludeId);
    if (err) {
      setError(err);
      return;
    }
    onSubmit(trimmed, note.trim());
  };

  return (
    <div className={styles.dialogBackdrop} onClick={onClose} role="presentation">
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={mode === "create" ? "新建方案" : "修改方案"}>
        <div className={styles.dialogHeader}>
          <h3>{mode === "create" ? "新建方案" : "修改方案"}</h3>
          <button className={styles.dialogClose} onClick={onClose} type="button" aria-label="关闭">
            ✕
          </button>
        </div>
        <div className={styles.dialogForm}>
          <label className={styles.dialogField}>
            方案名称
            <input
              className={styles.dialogInput}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
          </label>
          <label className={styles.dialogField}>
            备注（可选）
            <textarea
              className={styles.dialogTextarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </label>
          {error && <div className={styles.dialogError}>{error}</div>}
          <div className={styles.dialogActions}>
            <button className={styles.btnPrimary} onClick={handleSubmit} type="button">
              {mode === "create" ? "创建" : "保存"}
            </button>
            <button className={styles.btnSecondary} onClick={onClose} type="button">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
