"use client";

import { useCallback, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { BenchPanel } from "@/components/bench-panel";
import { LineupOrder } from "@/components/lineup-order";
import { ScenarioCompare } from "@/components/scenario-compare";
import { SceneFieldBoard } from "@/components/scene-field-board";
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
import { panelNavItems } from "@/lib/routes";
import {
  analyzeScenarioWarnings,
  getActiveScenario,
  POSITIONS,
  type Player,
  type PositionCode,
  type Workspace,
} from "@/lib/workspace";
import {
  activateScenario,
  createScenario,
  deleteScenario,
  isVersionConflict,
  type WorkspaceSnapshot,
  updatePlayer,
  updateScenario,
  updateScenarioAssignments,
} from "@/lib/workspace-client";
import { useWorkspaceSnapshot } from "@/lib/use-workspace-snapshot";

const NAV_ITEMS = panelNavItems("战术场景");

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
  const { workspace, version, setWorkspace, applySnapshot, refreshWorkspace } =
    useWorkspaceSnapshot(initialWorkspace, initialVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ScenarioDialogState>({ type: "closed" });
  const [viewMode, setViewMode] = useState<ViewMode>("lineup");
  const [compareLeftId, setCompareLeftId] = useState<string | null>(null);
  const [compareRightId, setCompareRightId] = useState<string | null>(null);
  const toastRef = useRef<ToastHandle | null>(null);

  // DH (Designated Hitter) state
  const [dhEnabled, setDhEnabled] = useState(false);
  const [dhPlayerId, setDhPlayerId] = useState<string | null>(null);

  // Roster editor state
  const [showRosterEditor, setShowRosterEditor] = useState(false);

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


  // ── Scenario CRUD ──
  // ── Scenario CRUD ──
  function handleScenarioChange(id: string) {
    const updated = setActiveScenarioAction(workspace, id);
    void handleSave(updated, (_next, currentVersion) => activateScenario(id, currentVersion));
  }

  function handleCreate(name: string, note: string) {
    const updated = createScenarioAction(workspace, name, note);
    const scenario = updated.scenarios.at(-1);
    if (!scenario) return;
    void handleSave(updated, (_next, currentVersion) => createScenario(scenario, currentVersion));
    setDialog({ type: "closed" });
    toastRef.current?.showToast("新方案已创建");
  }

  function handleRename(id: string, name: string, note: string) {
    const updated = renameScenarioAction(workspace, id, name, note);
    void handleSave(updated, (_next, currentVersion) => updateScenario(id, name, note, currentVersion));
    setDialog({ type: "closed" });
    toastRef.current?.showToast("方案已更新");
  }

  function handleCopy(id: string) {
    const updated = copyScenarioAction(workspace, id);
    const scenario = updated.scenarios.at(-1);
    if (!scenario) return;
    void handleSave(updated, (_next, currentVersion) => createScenario(scenario, currentVersion));
    toastRef.current?.showToast("方案已复制");
  }

  function handleDelete(id: string) {
    if (!window.confirm("确认删除此方案？")) return;
    try {
      const updated = deleteScenarioAction(workspace, id);
      void handleSave(updated, (_next, currentVersion) => deleteScenario(id, currentVersion));
      toastRef.current?.showToast("方案已删除");
    } catch {
      toastRef.current?.showToast("无法删除最后一个方案");
    }
  }

  // ── Lineup actions ──
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

  function handleDefenseAssign(position: PositionCode, playerId: string) {
    const updated = assignDefensePosition(workspace, position, playerId);
    const scenario = getActiveScenario(updated);
    // DH mode: when assigning P, remove new P from lineup (DH bats instead)
    if (dhEnabled && position === "P") {
      const lineup = scenario.assignments.lineup;
      const pIdx = lineup.indexOf(playerId);
      if (pIdx >= 0) {
        lineup[pIdx] = dhPlayerId ?? null;
      }
    }
    void handleSave(
      updated,
      (_next, currentVersion) =>
        updateScenarioAssignments(scenario.id, scenario.assignments, currentVersion, scenario.updatedAt),
    );
  }

  // ── DH toggle ──

  function handleToggleDH() {
    const updated = structuredClone(workspace);
    const scenario = getActiveScenario(updated);
    const lineup = scenario.assignments.lineup;
    const pitcherId = scenario.assignments.defense["P"];

    if (!dhEnabled) {
      // Enable DH: remove P from lineup, pick bench player as DH
      setDhEnabled(true);
      if (pitcherId) {
        const pIdx = lineup.indexOf(pitcherId);
        if (pIdx >= 0) {
          const benchPlayer = workspace.players.find(
            (p) => p.status === "available" && p.id !== pitcherId && !lineup.includes(p.id)
          );
          const dhId = benchPlayer?.id ?? null;
          lineup[pIdx] = dhId;
          setDhPlayerId(dhId);
          scenario.updatedAt = new Date().toISOString();
          void handleSave(
            updated,
            (_next, currentVersion) =>
              updateScenarioAssignments(scenario.id, scenario.assignments, currentVersion, scenario.updatedAt),
          );
        }
      }
    } else {
      // Disable DH: find DH in lineup (player batting but not in defense) and replace with P
      setDhEnabled(false);
      if (pitcherId && !lineup.includes(pitcherId)) {
        // DH is the player in lineup who's not on defense
        const defenseIds = new Set(Object.values(scenario.assignments.defense).filter(Boolean) as string[]);
        const dhIdx = lineup.findIndex((id) => id !== null && !defenseIds.has(id!));
        if (dhIdx >= 0) {
          lineup[dhIdx] = pitcherId;
          scenario.updatedAt = new Date().toISOString();
          void handleSave(
            updated,
            (_next, currentVersion) =>
              updateScenarioAssignments(scenario.id, scenario.assignments, currentVersion, scenario.updatedAt),
          );
        }
      }
      setDhPlayerId(null);
    }
  }

  // ── Roster status editor ──

  async function handleRecoverPlayer(player: Player) {
    const ok = window.confirm(`确认「${player.name} #${player.number}」伤病已恢复？\n\n康复后该球员将出现在替补名单中。`);
    if (!ok) return;
    const updated: Player = { ...player, status: "available" };
    try {
      const result = await updatePlayer(updated, version);
      applySnapshot(result);
      toastRef.current?.showToast(`${player.name} 已恢复，加入替补名单`);
    } catch {
      toastRef.current?.showToast("状态更新失败，请重试");
    }
  }

  async function handleTempJoinGraduated(player: Player, days: number | null) {
    const label = days ? `临时加入 ${days} 天` : "仅此一次（本次比赛）";
    const ok = window.confirm(
      `确认让「${player.name} #${player.number}」${label}？\n\n该球员目前为毕业状态，临时加入后将出现在替补名单中。`
    );
    if (!ok) return;
    const updated: Player = { ...player, status: "available" };
    // Store the temp join expiry if days specified
    if (days) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);
      (updated as { _tempJoinExpiry?: string })._tempJoinExpiry = expiry.toISOString();
    }
    try {
      const result = await updatePlayer(updated, version);
      applySnapshot(result);
      toastRef.current?.showToast(`${player.name} 已临时加入替补名单`);
    } catch {
      toastRef.current?.showToast("状态更新失败，请重试");
    }
  }

  function handleDHAssign(playerId: string) {
    const updated = structuredClone(workspace);
    const scenario = getActiveScenario(updated);
    const lineup = scenario.assignments.lineup;
    const pitcherId = scenario.assignments.defense["P"];
    // Replace current DH in lineup
    const oldDHIdx = dhPlayerId ? lineup.indexOf(dhPlayerId) : (pitcherId ? lineup.indexOf(pitcherId) : -1);
    if (oldDHIdx >= 0) lineup[oldDHIdx] = playerId;
    setDhPlayerId(playerId);
    scenario.updatedAt = new Date().toISOString();
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
        eyebrow="Tactical Scenarios"
        title="战术场景 · 排阵工作台"
        description={`${workspace.scenarios.length} 个方案 · 当前：${activeScenario.name}`}
        statusLabel="工作区"
        statusValue={`v${version}`}
        statusMeta={isSaving ? "保存中…" : "方案与排阵已连接共享工作区"}
        navItems={[...NAV_ITEMS]}
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
              <button
                className={dhEnabled ? styles.btnDHToggleActive : styles.btnSecondary}
                onClick={handleToggleDH}
                disabled={isSaving}
                type="button"
                title={dhEnabled ? "关闭DH，投手恢复打击" : "启动DH，指定打击代替投手打击"}
              >
                {dhEnabled ? "DH ON" : "DH"}
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

        {/* Main area — 3 columns: Field | Lineup | Bench */}
        <div className={viewMode === "lineup" ? styles.board : styles.main}>
          {viewMode === "lineup" ? (
            <>
              {/* Column 1: Defense field (overview style) */}
              <div className={styles.boardField}>
                <SceneFieldBoard
                  players={workspace.players}
                  defense={activeScenario.assignments.defense}
                  onAssign={handleDefenseAssign}
                  onClear={handleDefenseClear}
                  onSwap={handleDefenseSwap}
                  dhEnabled={dhEnabled}
                  dhPlayerId={dhPlayerId}
                  onDHAssign={handleDHAssign}
                />
              </div>
              {/* Column 2: Lineup order */}
              <div className={styles.boardLineup}>
                <LineupOrder
                  players={workspace.players}
                  lineup={activeScenario.assignments.lineup}
                  defense={activeScenario.assignments.defense}
                  onAssign={handleLineupAssign}
                  onClear={handleLineupClear}
                  onMove={handleLineupMove}
                />
              </div>
              {/* Column 3: Bench */}
              <div className={styles.boardBench}>
                <div className={styles.benchHeader}>
                  <button
                    className={styles.btnSmall}
                    onClick={() => setShowRosterEditor(true)}
                    type="button"
                  >
                    ✏️ 编辑名单
                  </button>
                </div>
                <BenchPanel
                  players={workspace.players}
                  defense={activeScenario.assignments.defense}
                  lineup={activeScenario.assignments.lineup}
                  excludeIds={[...Object.values(activeScenario.assignments.defense).filter(Boolean) as string[], ...(dhEnabled && dhPlayerId ? [dhPlayerId] : [])]}
                />
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

        {/* Roster status editor popup */}
        {showRosterEditor && (
          <RosterStatusEditor
            players={workspace.players}
            onRecover={handleRecoverPlayer}
            onTempJoin={handleTempJoinGraduated}
            onClose={() => setShowRosterEditor(false)}
          />
        )}

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

// ── Roster Status Editor ──

type RosterStatusEditorProps = {
  players: import("@/lib/workspace").Player[];
  onRecover: (player: import("@/lib/workspace").Player) => void;
  onTempJoin: (player: import("@/lib/workspace").Player, days: number | null) => void;
  onClose: () => void;
};

function RosterStatusEditor({ players, onRecover, onTempJoin, onClose }: RosterStatusEditorProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [filter, setFilter] = useState<"all" | "injured" | "graduated">("all");

  const filtered = players.filter((p) => {
    if (filter === "injured") return p.status === "injured";
    if (filter === "graduated") return p.status === "graduated";
    return p.status === "injured" || p.status === "graduated";
  });

  return (
    <>
      <div className={styles.dialogBackdrop} onClick={onClose} />
      <div className={styles.rosterEditor}>
        <header className={styles.dialogHeader}>
          <h3>编辑名单</h3>
          <button className={styles.dialogClose} onClick={onClose} type="button">×</button>
        </header>

        <div className={styles.rosterFilter}>
          <button className={filter === "all" ? styles.rosterFilterActive : styles.rosterFilterBtn}
            onClick={() => setFilter("all")} type="button">伤停+毕业</button>
          <button className={filter === "injured" ? styles.rosterFilterActive : styles.rosterFilterBtn}
            onClick={() => setFilter("injured")} type="button">伤停</button>
          <button className={filter === "graduated" ? styles.rosterFilterActive : styles.rosterFilterBtn}
            onClick={() => setFilter("graduated")} type="button">毕业</button>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.rosterEmpty}>暂无相关球员</p>
        ) : (
          <div className={styles.rosterList}>
            {filtered.map((p) => {
              const isInjured = p.status === "injured";
              const isGraduated = p.status === "graduated";
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.rosterItem} ${selectedPlayer?.id === p.id ? styles.rosterItemActive : ""}`}
                  onClick={() => setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)}
                >
                  <span className={isInjured ? styles.rosterTagInjured : styles.rosterTagGraduated}>
                    {isInjured ? "伤停" : "毕业"}
                  </span>
                  <span className={styles.rosterName}>{p.name}</span>
                  <span className={styles.rosterNum}>#{p.number}</span>
                  <span className={styles.rosterPos}>
                    {p.positions.map((pos) => {
                      const m: Record<string, string> = { P: "投", C: "捕", "1B": "一", "2B": "二", "3B": "三", SS: "游", LF: "左", CF: "中", RF: "右" };
                      return m[pos] ?? pos;
                    }).join("/")}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Action panel for selected player */}
        {selectedPlayer && (
          <div className={styles.rosterActions}>
            {selectedPlayer.status === "injured" ? (
              <>
                <p className={styles.rosterActionHint}>
                  确认「{selectedPlayer.name}」伤病已恢复？
                </p>
                <button className={styles.btnPrimary} onClick={() => { onRecover(selectedPlayer); setSelectedPlayer(null); }}>
                  确认康复，加入替补
                </button>
              </>
            ) : selectedPlayer.status === "graduated" ? (
              <>
                <p className={styles.rosterActionHint}>
                  让「{selectedPlayer.name}」临时加入？
                </p>
                <div className={styles.rosterActionBtns}>
                  <button className={styles.btnPrimary}
                    onClick={() => { onTempJoin(selectedPlayer, null); setSelectedPlayer(null); }}>
                    仅此一次
                  </button>
                  <button className={styles.btnPrimary}
                    onClick={() => { onTempJoin(selectedPlayer, 7); setSelectedPlayer(null); }}>
                    加入 7 天
                  </button>
                  <button className={styles.btnPrimary}
                    onClick={() => { onTempJoin(selectedPlayer, 30); setSelectedPlayer(null); }}>
                    加入 30 天
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </>
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
