"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ScoreboardReviewDialog } from "@/components/scoreboard-review-dialog";
import { ScoreboardSetupDialog } from "@/components/scoreboard-setup-dialog";
import { Scorecard } from "@/components/scorecard";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import {
  clearDraftFromLocalStorage,
  createScoreboardGame,
  loadDraftFromLocalStorage,
  reopenGame,
  reviewGame,
  saveDraftToLocalStorage,
  type GameSetup,
  type ScoreboardGame,
  type TeamSetup,
} from "@/lib/scoreboard-actions";
import { panelNavItems } from "@/lib/routes";
import {
  cloneWorkspace,
  sanitizeWorkspace,
  type Game,
  type Workspace,
} from "@/lib/workspace";
import {
  isVersionConflict,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
} from "@/lib/workspace-client";
import styles from "./scoreboard-page-client.module.css";

const NAV_ITEMS = panelNavItems("记分板");
const DRAFT_KEY = "active";

type ScoreboardPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

type PhaseState =
  | { type: "setup" }
  | { type: "recording"; mode: "standard" | "dual"; teamA: ScoreboardGame; teamB: ScoreboardGame | null }
  | { type: "review"; mode: "standard" | "dual"; teamA: ScoreboardGame; teamB: ScoreboardGame | null };

export function ScoreboardPageClient({
  initialWorkspace,
  initialVersion,
}: ScoreboardPageClientProps) {
  const toastRef = useRef<ToastHandle | null>(null);

  const [workspace, setWorkspace] = useState(() => sanitizeWorkspace(initialWorkspace));
  const [version, setVersion] = useState(initialVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [phase, setPhase] = useState<PhaseState>({ type: "setup" });

  // Refs for save
  const workspaceRef = useRef(workspace);
  const versionRef = useRef(version);
  const savingRef = useRef(false);
  useEffect(() => { workspaceRef.current = workspace; versionRef.current = version; }, [workspace, version]);

  // ── localStorage crash recovery ──
  useEffect(() => {
    const draft = loadDraftFromLocalStorage(DRAFT_KEY);
    if (draft && draft.phase === "recording") {
      const resume = window.confirm("检测到未完成的比赛记录，是否恢复？");
      if (resume) {
        setPhase({
          type: "recording",
          mode: "standard",
          teamA: draft,
          teamB: null,
        });
        toastRef.current?.showToast("已恢复未完成的比赛");
        return;
      }
      clearDraftFromLocalStorage(DRAFT_KEY);
    }
  }, []);

  // Auto-save draft every 5 PAs
  useEffect(() => {
    if (phase.type !== "recording") return;
    const totalPAs = phase.teamA.innings.reduce((sum, inn) => sum + inn.plateAppearances.length, 0) +
      (phase.teamB?.innings.reduce((s, inn) => s + inn.plateAppearances.length, 0) ?? 0);
    if (totalPAs > 0 && totalPAs % 5 === 0) {
      saveDraftToLocalStorage(DRAFT_KEY, phase.teamA);
    }
  }, [phase]);

  // ── Save handler ──

  const handleSave = useCallback(
    async (applyMutation: (current: Workspace) => Workspace) => {
      if (savingRef.current) return;
      savingRef.current = true;

      const optimistic = applyMutation(workspaceRef.current);
      setWorkspace(optimistic);
      setIsSaving(true);
      setSaveError(null);

      try {
        const result = await saveWorkspaceSnapshot(optimistic, versionRef.current);
        setVersion(result.version);
        setWorkspace(sanitizeWorkspace(result.workspace));
      } catch (error) {
        let reloaded = false;
        try {
          const snapshot = await loadWorkspaceSnapshot();
          setVersion(snapshot.version);
          setWorkspace(sanitizeWorkspace(snapshot.workspace));
          reloaded = true;
        } catch { /* ignore */ }

        if (reloaded) {
          if (isVersionConflict(error)) {
            toastRef.current?.showToast("数据已被其他会话更新，已恢复到最新状态。");
          } else {
            setSaveError("保存失败，已恢复到最新数据。");
          }
        } else {
          setSaveError("保存失败，请检查网络后刷新页面。");
        }
      } finally {
        setIsSaving(false);
        savingRef.current = false;
      }
    },
    [],
  );

  // ── Phase transitions ──

  function handleStartGame(
    setup: GameSetup,
    teamA: TeamSetup,
    teamB?: TeamSetup,
  ) {
    const mode = teamB ? "dual" : "standard";
    const gameA = createScoreboardGame(setup, workspace.scenarios[0]?.id ?? "", teamA, "top");
    const gameB = teamB ? createScoreboardGame(setup, workspace.scenarios[0]?.id ?? "", teamB, "bottom") : null;

    setPhase({
      type: "recording",
      mode,
      teamA: gameA,
      teamB: gameB,
    });
    toastRef.current?.showToast(mode === "dual" ? "双队记录已开始" : "比赛记录已开始");
  }

  function handleUpdateTeamA(updated: ScoreboardGame) {
    if (phase.type !== "recording") return;
    setPhase({ ...phase, teamA: updated });

    // If game is over (phase changed to review), move to review
    if (updated.phase === "review") {
      handleReviewGame(updated, phase.teamB, phase.mode);
    }
  }

  function handleUpdateTeamB(updated: ScoreboardGame) {
    if (phase.type !== "recording" || !phase.teamB) return;
    setPhase({ ...phase, teamB: updated });

    if (updated.phase === "review") {
      handleReviewGame(phase.teamA, updated, phase.mode);
    }
  }

  function handleReviewGame(teamA: ScoreboardGame, teamB: ScoreboardGame | null, mode: "standard" | "dual") {
    setPhase({ type: "review", mode, teamA, teamB });
  }

  function handleFinalize(game: Game) {
    handleSave((current) => {
      const next = cloneWorkspace(current);
      next.games = [...next.games, game];
      return next;
    });
    // Reset
    setPhase({ type: "setup" });
    clearDraftFromLocalStorage(DRAFT_KEY);
    toastRef.current?.showToast("比赛已保存到数据中心！");
  }

  function handleFinalizeDual(gameA: Game, gameB: Game) {
    handleSave((current) => {
      const next = cloneWorkspace(current);
      next.games = [...next.games, gameA, gameB];
      return next;
    });
    setPhase({ type: "setup" });
    clearDraftFromLocalStorage(DRAFT_KEY);
    toastRef.current?.showToast("两场比赛已保存到数据中心！");
  }

  function handleCancel() {
    const hasData = phase.type === "recording" && phase.teamA.innings.some((inn) => inn.plateAppearances.length > 0);
    if (hasData) {
      const ok = window.confirm("确定放弃当前未完成的比赛记录？");
      if (!ok) return;
    }
    setPhase({ type: "setup" });
    clearDraftFromLocalStorage(DRAFT_KEY);
  }

  // ── Render ──

  const isRecording = phase.type === "recording";
  const isReview = phase.type === "review";

  return (
    <ToastProvider toastRef={toastRef}>
      <AppShell
        eyebrow="Scoreboard"
        title="比赛记分板"
        description={isRecording && phase.mode === "dual"
          ? "双队训练赛记录 — 左右并排记录，半局自动切换"
          : "逐打席记录比赛数据 — 自动推导球员统计"}
        statusLabel="工作区"
        statusValue={`v${version}`}
        statusMeta={isSaving ? "保存中…" : (phase.type === "recording" ? "记录中" : "")}
        navItems={[...NAV_ITEMS]}
      >
        {/* Save error bar */}
        {(saveError || isSaving) && (
          <div className={styles.saveBar}>
            {saveError && <span className={styles.saveError}>{saveError}</span>}
            {isSaving && <span className={styles.saveStatus}>保存中…</span>}
          </div>
        )}

        {/* Mode selector (only in setup) */}
        {phase.type === "setup" && (
          <SetupWrapper
            workspace={workspace}
            onStart={handleStartGame}
            onCancel={() => {}}
          />
        )}

        {/* Recording */}
        {isRecording && (
          <div className={phase.mode === "dual" ? styles.dualGrid : styles.singleGrid}>
            <Scorecard
              game={phase.teamA}
              workspace={workspace}
              teamLabel={phase.mode === "dual" ? "A队 ▲" : "我方"}
              isActive={phase.mode === "standard" || phase.teamA.halfInning === "top"}
              onUpdate={handleUpdateTeamA}
            />
            {phase.teamB && (
              <Scorecard
                game={phase.teamB}
                workspace={workspace}
                teamLabel="B队 ▼"
                isActive={phase.teamB.halfInning === "bottom"}
                onUpdate={handleUpdateTeamB}
              />
            )}
          </div>
        )}

        {/* Cancel button during recording */}
        {isRecording && (
          <div className={styles.actionBar}>
            <button
              type="button"
              className={styles.btnDanger}
              onClick={handleCancel}
            >
              放弃记录
            </button>
          </div>
        )}

        {/* Review dialogs */}
        {isReview && (
          <>
            <ScoreboardReviewDialog
              game={phase.teamA}
              workspace={workspace}
              onFinalize={(game) => {
                if (phase.teamB) {
                  // Will be finalized together when team B's review also confirms
                  // For simplicity, finalize them one at a time
                  handleFinalize(game);
                } else {
                  handleFinalize(game);
                }
              }}
              onEdit={() => setPhase({
                type: "recording",
                mode: phase.mode,
                teamA: reopenGame(phase.teamA),
                teamB: phase.teamB ? reopenGame(phase.teamB) : null,
              })}
              onCancel={handleCancel}
            />
            {phase.teamB && (
              <ScoreboardReviewDialog
                game={phase.teamB}
                workspace={workspace}
                onFinalize={(game) => handleFinalize(game)}
                onEdit={() => setPhase({
                  type: "recording",
                  mode: phase.mode,
                  teamA: reopenGame(phase.teamA),
                  teamB: reopenGame(phase.teamB!),
                })}
                onCancel={handleCancel}
              />
            )}
          </>
        )}
      </AppShell>
    </ToastProvider>
  );
}

/** Setup wrapper with mode selection */
function SetupWrapper({
  workspace,
  onStart,
  onCancel,
}: {
  workspace: Workspace;
  onStart: (setup: GameSetup, teamA: TeamSetup, teamB?: TeamSetup) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"standard" | "dual" | null>(null);

  if (!mode) {
    return (
      <div className={styles.modeSelect}>
        <h2 className={styles.modeTitle}>选择比赛模式</h2>
        <div className={styles.modeCards}>
          <button
            type="button"
            className={styles.modeCard}
            onClick={() => setMode("standard")}
          >
            <span className={styles.modeIcon}>⚾</span>
            <span className={styles.modeLabel}>正式比赛</span>
            <span className={styles.modeDesc}>对外比赛，只记录我方数据</span>
          </button>
          <button
            type="button"
            className={styles.modeCard}
            onClick={() => setMode("dual")}
          >
            <span className={styles.modeIcon}>🔄</span>
            <span className={styles.modeLabel}>队内训练赛</span>
            <span className={styles.modeDesc}>红白战，左右双栏记录AB队</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <ScoreboardSetupDialog
      workspace={workspace}
      mode={mode}
      onStart={onStart}
      onCancel={() => setMode(null)}
    />
  );
}
