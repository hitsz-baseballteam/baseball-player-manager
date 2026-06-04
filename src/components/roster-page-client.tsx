"use client";

import { useCallback, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { RosterOverview } from "@/components/roster-overview";
import { PlayerProfileEditor } from "@/components/player-profile-editor";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import styles from "@/components/roster-page-client.module.css";
import {
  applyBulkEdit,
  deletePlayers,
  upsertPlayer,
  validateBulkEdit,
  validatePlayerUpsert,
  type BulkEditInput,
  type PlayerUpsertInput,
} from "@/lib/roster-actions";
import { type PlayerFilterState } from "@/lib/dom-scenario-ops";
import {
  cloneWorkspace,
  getActiveScenario,
  getPlayer,
  sanitizeWorkspace,
  type Hand,
  type Player,
  type PlayerStatus,
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
  { label: "名册", href: "/roster", active: true },
  { label: "排阵", disabled: true, status: "规划中" },
  { label: "战术场景", disabled: true, status: "规划中" },
  { label: "数据中心", disabled: true, status: "规划中" },
  { label: "设置", disabled: true, status: "规划中" },
] as const;

type RosterPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

type RosterDialogState =
  | { type: "closed" }
  | { type: "addPlayer" }
  | { type: "bulkEdit" }
  | { type: "deleteConfirm"; playerId: string; playerName: string }
  | { type: "bulkDeleteConfirm"; count: number };

export function RosterPageClient(props: RosterPageClientProps) {
  const [workspace, setWorkspace] = useState(() =>
    sanitizeWorkspace(props.initialWorkspace),
  );
  const [version, setVersion] = useState(props.initialVersion);
  const [statusMessage, setStatusMessage] = useState("名册已连接共享工作区");
  const toastRef = useRef<ToastHandle | null>(null);
  const [filter, setFilter] = useState<PlayerFilterState>({
    query: "",
    position: "all",
    status: "all",
    bats: "all",
    throws: "all",
    assignment: "all",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<RosterDialogState>({ type: "closed" });

  const activeScenario = getActiveScenario(workspace);
  const availableCount = workspace.players.filter(
    (p) => p.status === "available",
  ).length;

  const commitAndSave = useCallback(
    async (
      mutator: (draft: Workspace) => void,
      { successMessage, errorFallback }: { successMessage: string; errorFallback: string },
    ) => {
      const draft = cloneWorkspace(workspace);
      mutator(draft);
      setStatusMessage("正在同步到云端...");

      try {
        const result = await saveWorkspaceSnapshot(draft, version);
        setWorkspace(sanitizeWorkspace(result.workspace));
        setVersion(result.version);
        setStatusMessage(successMessage);
        toastRef.current?.showToast(successMessage);
      } catch (error) {
        if (isVersionConflict(error)) {
          const latest = await loadWorkspaceSnapshot();
          setWorkspace(sanitizeWorkspace(latest.workspace));
          setVersion(latest.version);
          setSelectedIds(new Set());
          setStatusMessage("数据已被其他会话更新，已刷新最新内容");
          toastRef.current?.showToast("数据已被其他会话更新，已刷新最新内容");
        } else {
          console.error(error);
          setStatusMessage(errorFallback);
          toastRef.current?.showToast(errorFallback);
        }
      } finally {
        // save complete
      }
    },
    [workspace, version],
  );

  // ── Player upsert (add new) ──
  const handleUpsertPlayer = useCallback(
    async (input: PlayerUpsertInput) => {
      const existing = input.id ? getPlayer(workspace, input.id) : null;
      const validation = validatePlayerUpsert(
        input.name,
        input.number,
        input.positions,
        workspace.players,
        input.id,
      );
      if (!validation.valid) {
        toastRef.current?.showToast(validation.error);
        return;
      }

      await commitAndSave(
        (draft) => {
          upsertPlayer(draft, input, existing);
        },
        { successMessage: "球员已保存", errorFallback: "保存失败，请稍后重试" },
      );
      setDialog({ type: "closed" });
    },
    [workspace, commitAndSave],
  );

  // ── Bulk edit ──
  const handleBulkEdit = useCallback(
    async (input: BulkEditInput) => {
      const ids = Array.from(selectedIds);
      const validation = validateBulkEdit(ids, input);
      if (!validation.valid) {
        toastRef.current?.showToast(validation.error);
        return;
      }

      await commitAndSave(
        (draft) => {
          applyBulkEdit(draft, ids, input);
        },
        {
          successMessage: `已批量修改 ${ids.length} 名球员`,
          errorFallback: "批量编辑失败",
        },
      );
      setDialog({ type: "closed" });
    },
    [selectedIds, commitAndSave],
  );

  // ── Single delete ──
  const handleDeletePlayer = useCallback(
    async (playerId: string) => {
      const player = getPlayer(workspace, playerId);
      if (!player) {
        return;
      }
      // Show confirmation dialog
      setDialog({
        type: "deleteConfirm",
        playerId: player.id,
        playerName: player.name,
      });
    },
    [workspace],
  );

  const confirmDeletePlayer = useCallback(
    async (playerId: string) => {
      await commitAndSave(
        (draft) => {
          deletePlayers(draft, [playerId]);
        },
        { successMessage: "球员已删除", errorFallback: "删除失败" },
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(playerId);
        return next;
      });
      setDialog({ type: "closed" });
    },
    [commitAndSave],
  );

  // ── Bulk delete ──
  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toastRef.current?.showToast("请先选择球员");
      return;
    }
    setDialog({ type: "bulkDeleteConfirm", count: ids.length });
  }, [selectedIds]);

  const confirmBulkDelete = useCallback(
    async () => {
      const ids = Array.from(selectedIds);
      await commitAndSave(
        (draft) => {
          deletePlayers(draft, ids);
        },
        {
          successMessage: `已删除 ${ids.length} 名球员`,
          errorFallback: "批量删除失败",
        },
      );
      setSelectedIds(new Set());
      setDialog({ type: "closed" });
    },
    [selectedIds, commitAndSave],
  );

  // ── Profile drawer ──
  const handleOpenProfile = useCallback((playerId: string) => {
    setActiveProfileId(playerId);
  }, []);

  const handleCloseProfile = useCallback(() => {
    setActiveProfileId(null);
  }, []);

  const handleProfileSave = useCallback(
    async (nextPlayer: Player) => {
      const existing = getPlayer(workspace, nextPlayer.id);
      if (!existing) {
        toastRef.current?.showToast("球员不存在，无法保存");
        return;
      }

      await commitAndSave(
        (draft) => {
          const index = draft.players.findIndex((p) => p.id === nextPlayer.id);
          if (index >= 0) {
            draft.players[index] = nextPlayer;
          }
        },
        {
          successMessage: "球员档案已保存",
          errorFallback: "保存失败，请稍后重试",
        },
      );
      // Refresh drawer data
      setActiveProfileId((prev) => (prev === nextPlayer.id ? prev : prev));
    },
    [workspace, commitAndSave],
  );

  // ── Selection ──
  const toggleSelect = useCallback((playerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(
    (playerIds: string[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        playerIds.forEach((id) => next.add(id));
        return next;
      });
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ── Filter & open full page ──
  const handleOpenFullPage = useCallback((playerId: string) => {
    window.open(`/players/${playerId}`, "_blank", "noopener,noreferrer");
  }, []);

  const profilePlayer = activeProfileId
    ? getPlayer(workspace, activeProfileId)
    : null;

  return (
    <ToastProvider toastRef={toastRef}>
      <AppShell
        eyebrow="Team Roster"
        title="名册工作台"
        description={`共 ${workspace.players.length} 名球员 · ${availableCount} 名可上场。筛选、选择、编辑或进入完整档案页。`}
        statusLabel="工作区"
        statusValue={`v${version}`}
        statusMeta={statusMessage}
        navItems={NAV_ITEMS.map((item) => ({ ...item }))}
        actions={<ThemeToggle />}
        content={
          <RosterOverview
            workspace={workspace}
            version={version}
            activeScenario={activeScenario}
            filter={filter}
            setFilter={setFilter}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            selectAllFiltered={selectAllFiltered}
            clearSelection={clearSelection}
            onOpenProfile={handleOpenProfile}
            onOpenFullPage={handleOpenFullPage}
            onDeletePlayer={handleDeletePlayer}
            onAddPlayer={() => setDialog({ type: "addPlayer" })}
            onBulkEdit={() => setDialog({ type: "bulkEdit" })}
            onBulkDelete={handleBulkDelete}
          />
        }
      />

      {/* Profile Drawer */}
      {activeProfileId && profilePlayer ? (
        <PlayerProfileEditor
          key={`${profilePlayer.id}:${version}`}
          player={profilePlayer}
          variant="drawer"
          statusMessage="名册抽屉保存后会立即回写当前工作区"
          onClose={handleCloseProfile}
          onOpenPage={() => handleOpenFullPage(profilePlayer.id)}
          onSave={handleProfileSave}
        />
      ) : null}

      {/* Add Player Dialog */}
      {dialog.type === "addPlayer" && (
        <AddPlayerDialog
          workspace={workspace}
          onSave={handleUpsertPlayer}
          onClose={() => setDialog({ type: "closed" })}
        />
      )}

      {/* Bulk Edit Dialog */}
      {dialog.type === "bulkEdit" && (
        <BulkEditDialog
          selectedCount={selectedIds.size}
          onSave={handleBulkEdit}
          onClose={() => setDialog({ type: "closed" })}
        />
      )}

      {/* Delete Confirm Dialog */}
      {dialog.type === "deleteConfirm" && (
        <ConfirmDialog
          title="删除球员"
          message={`确定要删除「${dialog.playerName}」吗？相关守位和棒次会一并清空。`}
          confirmLabel="删除"
          danger
          onConfirm={() => confirmDeletePlayer(dialog.playerId)}
          onCancel={() => setDialog({ type: "closed" })}
        />
      )}

      {/* Bulk Delete Confirm Dialog */}
      {dialog.type === "bulkDeleteConfirm" && (
        <ConfirmDialog
          title="批量删除"
          message={`确定要删除已选的 ${dialog.count} 名球员吗？相关守位和棒次会一并清空。`}
          confirmLabel="删除"
          danger
          onConfirm={confirmBulkDelete}
          onCancel={() => setDialog({ type: "closed" })}
        />
      )}
    </ToastProvider>
  );
}

// ── Add Player Dialog ──

type AddPlayerDialogProps = {
  workspace: Workspace;
  onSave: (input: PlayerUpsertInput) => void;
  onClose: () => void;
};

function AddPlayerDialog({ workspace, onSave, onClose }: AddPlayerDialogProps) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [bats, setBats] = useState<Hand>("R");
  const [throws, setThrows] = useState<Hand>("R");
  const [status, setStatus] = useState<PlayerStatus>("available");
  const [positions, setPositions] = useState<Set<PositionCode>>(new Set());
  const [error, setError] = useState("");

  function togglePosition(pos: PositionCode) {
    setPositions((prev) => {
      const next = new Set(prev);
      if (next.has(pos)) {
        next.delete(pos);
      } else {
        next.add(pos);
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const posList = Array.from(positions) as PositionCode[];
    const validation = validatePlayerUpsert(
      name,
      number,
      posList,
      workspace.players,
    );
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    onSave({
      name,
      number,
      bats,
      throws,
      positions: posList,
      status,
    });
  }

  const POSITIONS = [
    { code: "P" as const, label: "投手" },
    { code: "C" as const, label: "捕手" },
    { code: "1B" as const, label: "一垒" },
    { code: "2B" as const, label: "二垒" },
    { code: "3B" as const, label: "三垒" },
    { code: "SS" as const, label: "游击" },
    { code: "LF" as const, label: "左外" },
    { code: "CF" as const, label: "中外" },
    { code: "RF" as const, label: "右外" },
  ];

  return (
    <div className={styles.dialogBackdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h3>新增球员</h3>
          <button type="button" className={styles.dialogClose} onClick={onClose}>×</button>
        </header>
        <form onSubmit={handleSubmit} className={styles.dialogForm}>
          <label>
            姓名
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={28}
            />
          </label>
          <label>
            背号
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
              maxLength={3}
            />
          </label>
          <div className={styles.dialogRow}>
            <label>
              打击
              <select value={bats} onChange={(e) => setBats(e.target.value as Hand)}>
                <option value="R">右打</option>
                <option value="L">左打</option>
                <option value="S">双打</option>
              </select>
            </label>
            <label>
              投球
              <select value={throws} onChange={(e) => setThrows(e.target.value as Hand)}>
                <option value="R">右投</option>
                <option value="L">左投</option>
              </select>
            </label>
          </div>
          <label>
            状态
            <select value={status} onChange={(e) => setStatus(e.target.value as PlayerStatus)}>
              <option value="available">可上场</option>
              <option value="rest">轮休</option>
              <option value="injured">伤停</option>
            </select>
          </label>
          <fieldset>
            <legend>守位</legend>
            <div className={styles.dialogChecks}>
              {POSITIONS.map((p) => (
                <label key={p.code} className={styles.dialogCheckLabel}>
                  <input
                    type="checkbox"
                    checked={positions.has(p.code)}
                    onChange={() => togglePosition(p.code)}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error ? <div className={styles.dialogError}>{error}</div> : null}
          <div className={styles.dialogActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              取消
            </button>
            <button type="submit" className={styles.btnPrimary}>
              保存球员
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Bulk Edit Dialog ──

type BulkEditDialogProps = {
  selectedCount: number;
  onSave: (input: BulkEditInput) => void;
  onClose: () => void;
};

function BulkEditDialog({ selectedCount, onSave, onClose }: BulkEditDialogProps) {
  const [status, setStatus] = useState<"keep" | PlayerStatus>("keep");
  const [bats, setBats] = useState<"keep" | Hand>("keep");
  const [throws, setThrows] = useState<"keep" | Hand>("keep");
  const [positionMode, setPositionMode] = useState<"keep" | "append" | "replace" | "remove">("keep");
  const [positions, setPositions] = useState<Set<PositionCode>>(new Set());
  const [error, setError] = useState("");

  const POSITIONS = [
    { code: "P" as const, label: "投手" },
    { code: "C" as const, label: "捕手" },
    { code: "1B" as const, label: "一垒" },
    { code: "2B" as const, label: "二垒" },
    { code: "3B" as const, label: "三垒" },
    { code: "SS" as const, label: "游击" },
    { code: "LF" as const, label: "左外" },
    { code: "CF" as const, label: "中外" },
    { code: "RF" as const, label: "右外" },
  ];

  function togglePosition(pos: PositionCode) {
    if (positionMode === "keep") {
      return;
    }
    setPositions((prev) => {
      const next = new Set(prev);
      if (next.has(pos)) {
        next.delete(pos);
      } else {
        next.add(pos);
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const input: BulkEditInput = {
      status,
      bats,
      throws,
      positionMode,
      positions: Array.from(positions),
    };

    const validation = validateBulkEdit(
      Array.from({ length: selectedCount }, (_, i) => `id-${i}`),
      input,
    );
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    onSave(input);
  }

  const keepDisabled = positionMode === "keep";

  return (
    <div className={styles.dialogBackdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h3>批量编辑</h3>
          <button type="button" className={styles.dialogClose} onClick={onClose}>×</button>
        </header>
        <p className={styles.dialogSummary}>
          将修改 {selectedCount} 名已选球员。未选择的字段保持原值。
        </p>
        <form onSubmit={handleSubmit} className={styles.dialogForm}>
          <label>
            状态
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="keep">保持原值</option>
              <option value="available">可上场</option>
              <option value="rest">轮休</option>
              <option value="injured">伤停</option>
            </select>
          </label>
          <div className={styles.dialogRow}>
            <label>
              打击
              <select value={bats} onChange={(e) => setBats(e.target.value as typeof bats)}>
                <option value="keep">保持原值</option>
                <option value="R">右打</option>
                <option value="L">左打</option>
                <option value="S">双打</option>
              </select>
            </label>
            <label>
              投球
              <select value={throws} onChange={(e) => setThrows(e.target.value as typeof throws)}>
                <option value="keep">保持原值</option>
                <option value="R">右投</option>
                <option value="L">左投</option>
              </select>
            </label>
          </div>
          <label>
            守位模式
            <select
              value={positionMode}
              onChange={(e) => {
                setPositionMode(e.target.value as typeof positionMode);
                if (e.target.value === "keep") {
                  setPositions(new Set());
                }
              }}
            >
              <option value="keep">保持原值</option>
              <option value="append">追加守位</option>
              <option value="replace">替换守位</option>
              <option value="remove">移除守位</option>
            </select>
          </label>
          <fieldset disabled={keepDisabled}>
            <legend>守位选择</legend>
            <div className={styles.dialogChecks}>
              {POSITIONS.map((p) => (
                <label key={p.code} className={styles.dialogCheckLabel}>
                  <input
                    type="checkbox"
                    checked={positions.has(p.code)}
                    onChange={() => togglePosition(p.code)}
                    disabled={keepDisabled}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error ? <div className={styles.dialogError}>{error}</div> : null}
          <div className={styles.dialogActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              取消
            </button>
            <button type="submit" className={styles.btnPrimary}>
              应用批量修改
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm Dialog ──

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className={styles.dialogBackdrop} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h3>{title}</h3>
          <button type="button" className={styles.dialogClose} onClick={onCancel}>×</button>
        </header>
        <p className={styles.dialogSummary}>{message}</p>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={danger ? styles.btnDanger : styles.btnPrimary}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
