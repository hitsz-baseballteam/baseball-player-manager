"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ScenarioCompare } from "@/components/scenario-compare";
import { ScenarioList } from "@/components/scenario-list";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import styles from "@/components/scenarios-page-client.module.css";
import {
  copyScenarioAction,
  createScenarioAction,
  deleteScenarioAction,
  renameScenarioAction,
  setActiveScenarioAction,
  validateScenarioName,
} from "@/lib/lineup-actions";
import {
  analyzeScenarioWarnings,
  getActiveScenario,
  sanitizeWorkspace,
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
  { label: "排阵", href: "/lineup" },
  { label: "战术场景", href: "/scenarios", active: true },
  { label: "数据中心", disabled: true, status: "规划中" },
  { label: "设置", disabled: true, status: "规划中" },
] as const;

type ScenarioDialogState =
  | { type: "closed" }
  | { type: "create" }
  | { type: "rename"; scenarioId: string; currentName: string; currentNote: string };

type ViewMode = "list" | "compare";

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
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [compareLeftId, setCompareLeftId] = useState<string | null>(null);
  const [compareRightId, setCompareRightId] = useState<string | null>(null);
  const toastRef = useRef<ToastHandle | null>(null);

  const activeScenario = getActiveScenario(workspace);

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

  // derive warnings per-scenario for the list
  const scenarioWarnings = useMemo(() => {
    const map = new Map<string, { critical: number; advisory: number }>();
    for (const s of workspace.scenarios) {
      const w = analyzeScenarioWarnings(workspace, s);
      map.set(s.id, {
        critical: w.critical.length,
        advisory: w.advisory.length,
      });
    }
    return map;
  }, [workspace]);

  function handleSetActive(id: string) {
    handleSave(setActiveScenarioAction(workspace, id));
    toastRef.current?.showToast("已切换当前方案");
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

  return (
    <ToastProvider toastRef={toastRef}>
      <AppShell
        eyebrow="Tactical Scenarios"
        title="战术场景"
        description={`${workspace.scenarios.length} 个方案 · 当前：${activeScenario.name}`}
        statusLabel="工作区"
        statusValue={`v${version}`}
        statusMeta={isSaving ? "保存中…" : "场景已连接共享工作区"}
        navItems={[...NAV_ITEMS]}
        actions={<ThemeToggle />}
      >
        {/* Action bar */}
        <div className={styles.actionBar}>
          <button
            className={styles.btnPrimary}
            onClick={() =>
              setDialog({ type: "create" })
            }
            disabled={isSaving}
            type="button"
          >
            + 新建方案
          </button>

          <div className={styles.tabGroup}>
            <button
              className={`${styles.tabBtn} ${viewMode === "list" ? styles.tabBtnActive : ""}`}
              onClick={() => setViewMode("list")}
              type="button"
            >
              列表
            </button>
            <button
              className={`${styles.tabBtn} ${viewMode === "compare" ? styles.tabBtnActive : ""}`}
              onClick={() => {
                setViewMode("compare");
                // Set default compare targets
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

          <div className={styles.actionSpacer} />

          {saveError && <span className={styles.saveError}>{saveError}</span>}
          {isSaving && <span className={styles.saveStatus}>保存中…</span>}
        </div>

        {/* View area */}
        <div className={styles.main}>
          {viewMode === "list" ? (
            <ScenarioList
              scenarios={workspace.scenarios}
              activeScenarioId={workspace.activeScenarioId}
              scenarioWarnings={scenarioWarnings}
              onSetActive={handleSetActive}
              onRename={(id) => {
                const s = workspace.scenarios.find((sc) => sc.id === id);
                setDialog({
                  type: "rename",
                  scenarioId: id,
                  currentName: s?.name ?? "",
                  currentNote: s?.note ?? "",
                });
              }}
              onCopy={handleCopy}
              onDelete={handleDelete}
            />
          ) : workspace.scenarios.length < 2 ? (
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
          )}
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

  const title = mode === "create" ? "新建方案" : "重命名方案";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateScenarioName(name, workspace, excludeId);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSubmit(name.trim(), note.trim());
  }

  return (
    <>
      <div className={styles.dialogBackdrop} onClick={onClose} />
      <div className={styles.dialog} role="dialog" aria-label={title}>
        <header className={styles.dialogHeader}>
          <h3>{title}</h3>
          <button
            className={styles.dialogClose}
            onClick={onClose}
            type="button"
            aria-label="关闭"
          >
            ×
          </button>
        </header>
        <form onSubmit={handleSubmit} className={styles.dialogForm}>
          <label className={styles.dialogField}>
            <span>方案名称</span>
            <input
              className={styles.dialogInput}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="例如：对强投方案"
              maxLength={24}
              autoFocus
            />
          </label>
          <label className={styles.dialogField}>
            <span>备注（可选）</span>
            <textarea
              className={styles.dialogTextarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：适合面对右投手时使用"
              rows={3}
              maxLength={120}
            />
          </label>
          {error && <div className={styles.dialogError}>{error}</div>}
          <div className={styles.dialogActions}>
            <button
              className={styles.btnSecondary}
              onClick={onClose}
              type="button"
            >
              取消
            </button>
            <button className={styles.btnPrimary} type="submit">
              {mode === "create" ? "创建" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
