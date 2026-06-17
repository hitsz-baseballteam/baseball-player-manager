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
import type { WorkspaceSnapshot } from "@/lib/workspace-client";
import {
  createGame,
  isVersionConflict,
  loadWorkspaceSnapshot,
  submitMutationWithRetry,
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
  const [batFirst, setBatFirst] = useState(true); // official mode: true=先攻, false=先防

  // Refs for save
  const workspaceRef = useRef(workspace);
  const versionRef = useRef(version);
  const savingRef = useRef(false);
  useEffect(() => { workspaceRef.current = workspace; versionRef.current = version; }, [workspace, version]);

  // ── localStorage crash recovery ──
  useEffect(() => {
    try {
      const draft = loadDraftFromLocalStorage(DRAFT_KEY);
      if (draft?.phase === "recording" && window.confirm("检测到未完成的比赛记录，是否恢复？")) {
        const timer = setTimeout(() => {
          setPhase({ type: "recording", mode: "standard", teamA: draft, teamB: null });
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch { /* ignore corrupted draft */ }
    // No valid draft — start fresh
    clearDraftFromLocalStorage(DRAFT_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Save handler (adapted to new resource-specific API) ──

  const handleSave = useCallback(
    async (
      applyMutation: (current: Workspace) => Workspace,
      submit: (nextWorkspace: Workspace, version: number) => Promise<WorkspaceSnapshot>,
    ) => {
      if (savingRef.current) {
        toastRef.current?.showToast("操作已在保存中，请稍后再试。");
        return;
      }
      savingRef.current = true;

      const optimistic = applyMutation(workspaceRef.current);
      setWorkspace(optimistic);
      setIsSaving(true);
      setSaveError(null);

      try {
        const result = await submitMutationWithRetry(
          workspaceRef.current,
          versionRef.current,
          applyMutation,
          submit,
        );
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
            toastRef.current?.showToast("数据已被其他会话更新，已恢复到最新状态，请重新操作。");
          } else {
            console.error("Save failed:", error);
            setSaveError("保存失败，已恢复到最新数据，请重试。");
          }
        } else {
          console.error("Save failed and reload failed:", error);
          toastRef.current?.showToast("保存失败且无法连接服务器，当前显示内容可能未同步。");
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
    // Game always starts in the top of the 1st inning.
    // batFirst determines WHO bats in the top half, not which half it is.
    const gameA = createScoreboardGame(
      setup,
      workspace.scenarios[0]?.id ?? "",
      teamA,
      "top",  // always top half to start
    );
    const gameB = teamB
      ? createScoreboardGame(setup, workspace.scenarios[0]?.id ?? "", teamB, "bottom")
      : null;

    setPhase({
      type: "recording",
      mode: mode as "standard" | "dual",
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
    handleSave(
      (current) => {
        const next = cloneWorkspace(current);
        next.games = [...next.games, game];
        return next;
      },
      (_nextWorkspace, currentVersion) => createGame(game, currentVersion),
    );
    setPhase({ type: "setup" });
    clearDraftFromLocalStorage(DRAFT_KEY);
    toastRef.current?.showToast("比赛已保存到数据中心！");
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

  // ── Countdown timer ──
  const timeLimit = isRecording && phase.type === "recording" && phase.teamA.setup.timeLimitMinutes
    ? phase.teamA.setup.timeLimitMinutes : null;
  const [remainingSeconds, setRemainingSeconds] = useState(timeLimit ? timeLimit * 60 : 0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showTimeExpiredDialog, setShowTimeExpiredDialog] = useState(false);
  const timeExpiredRef = useRef(false);

  useEffect(() => {
    if (!timeLimit) return;
    const id = setTimeout(() => setRemainingSeconds(timeLimit * 60), 0);
    timeExpiredRef.current = false;
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (!timeExpiredRef.current) {
            timeExpiredRef.current = true;
            setTimeout(() => setShowTimeExpiredDialog(true), 100);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { clearTimeout(id); if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLimit]);

  function handleTimeExpiredAction(action: "tie" | "extend") {
    setShowTimeExpiredDialog(false);
    if (action === "extend") {
      if (isRecording && phase.type === "recording") {
        const g = phase.teamA;
        const updated = { ...g, setup: { ...g.setup, totalInnings: g.setup.totalInnings + 1 } };
        setPhase({ ...phase, teamA: updated });
        toastRef.current?.showToast("已延长一局！");
      }
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

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
            batFirst={batFirst}
            onSetBatFirst={setBatFirst}
            onStart={handleStartGame}
            onCancel={() => {}}
          />
        )}

        {/* Recording */}
        {isRecording && (
          <>
            {/* Timer bar */}
            {timeLimit && (
              <div className={`${styles.timerBar} ${remainingSeconds < 300 ? styles.timerBarWarn : ""} ${remainingSeconds === 0 ? styles.timerBarExpired : ""}`}>
                <span>⏱ 剩余 {formatTime(remainingSeconds)}</span>
                <span>{remainingSeconds === 0 ? "时间到" : timeLimit + "分制"}</span>
              </div>
            )}

            {/* Time expired dialog */}
            {showTimeExpiredDialog && (
              <div className={styles.dialogOverlay}>
                <div className={styles.dialogBox}>
                  <h3>⏰ 比赛时间到</h3>
                  <p>时间已用完。当前是否为新开局？<br />若两队平分本局结束，可决定平局或延长一局。</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button className={styles.btnSecondary} onClick={() => handleTimeExpiredAction("tie")}>
                      🤝 时间到（平局）
                    </button>
                    <button className={styles.btnPrimary} onClick={() => handleTimeExpiredAction("extend")}>
                      +1 延长一局
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: "var(--theme-muted)", marginTop: 8 }}>
                    本局结束后不再新开。可随时结束比赛。
                  </p>
                </div>
              </div>
            )}

            <div className={styles.singleGrid}>
            {phase.mode === "dual" ? (
              /* Dual mode: batting+fielding swap per half-inning */
              <Scorecard
                battingGame={phase.teamA.halfInning === "top" ? phase.teamA : phase.teamB}
                fieldingGame={phase.teamA.halfInning === "top" ? phase.teamB : phase.teamA}
                workspace={workspace}
                teamLabel={phase.teamA.halfInning === "top" ? "A队攻 | B队守" : "B队攻 | A队守"}
                isActive={true}
                isOpponentBatting={false}
                onUpdateBatting={(g) => {
                  if (phase.teamA.halfInning === "top") handleUpdateTeamA(g as ScoreboardGame);
                  else handleUpdateTeamB(g as ScoreboardGame);
                }}
                onUpdateFielding={(g) => {
                  if (phase.teamA.halfInning === "top") handleUpdateTeamB(g as ScoreboardGame);
                  else handleUpdateTeamA(g as ScoreboardGame);
                }}
              />
            ) : (
              /* Official mode: determine who's batting based on batFirst */
              (() => {
                const isOurBatting =
                  (batFirst && phase.teamA.halfInning === "top") ||
                  (!batFirst && phase.teamA.halfInning === "bottom");

                return isOurBatting ? (
                  /* We are batting → show batting controls, no defense field */
                  <Scorecard
                    battingGame={phase.teamA}
                    fieldingGame={null}
                    workspace={workspace}
                    teamLabel="我方"
                    isActive={true}
                    isOpponentBatting={false}
                    onUpdateBatting={handleUpdateTeamA}
                    onUpdateFielding={handleUpdateTeamA}
                  />
                ) : (
                  /* Opponent batting → show our defense field + pitch counter */
                  <Scorecard
                    battingGame={null}
                    fieldingGame={phase.teamA}
                    workspace={workspace}
                    teamLabel="我方"
                    isActive={true}
                    isOpponentBatting={true}
                    onUpdateBatting={handleUpdateTeamA}
                    onUpdateFielding={handleUpdateTeamA}
                  />
                );
              })()
            )}
          </div>
          </>
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
  batFirst,
  onSetBatFirst,
  onStart,
  onCancel,
}: {
  workspace: Workspace;
  batFirst: boolean;
  onSetBatFirst: (v: boolean) => void;
  onStart: (setup: GameSetup, teamA: TeamSetup, teamB?: TeamSetup) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"standard" | "dual" | null>(null);
  const [batFirstChosen, setBatFirstChosen] = useState<boolean | null>(null);

  if (!mode) {
    return (
      <div className={styles.modeSelect}>
        <h2 className={styles.modeTitle}>选择比赛模式</h2>
        <div className={styles.modeCards}>
          <button type="button" className={styles.modeCard}
            onClick={() => setMode("standard")}>
            <span className={styles.modeIcon}>⚾</span>
            <span className={styles.modeLabel}>正式比赛</span>
            <span className={styles.modeDesc}>对外比赛，只记录我方数据</span>
          </button>
          <button type="button" className={styles.modeCard}
            onClick={() => setMode("dual")}>
            <span className={styles.modeIcon}>🔄</span>
            <span className={styles.modeLabel}>队内训练赛</span>
            <span className={styles.modeDesc}>红白战，左右双栏记录AB队</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Official mode: choose bat-first or field-first ──
  if (mode === "standard" && batFirstChosen === null) {
    return (
      <div className={styles.modeSelect}>
        <h2 className={styles.modeTitle}>选择先攻/先防</h2>
        <p className={styles.modeSubtitle}>决定我方在第一局上半还是下半进攻</p>
        <div className={styles.modeCards}>
          <button type="button" className={styles.modeCard}
            onClick={() => { onSetBatFirst(true); setBatFirstChosen(true); }}>
            <span className={styles.modeIcon}>⚾</span>
            <span className={styles.modeLabel}>先攻</span>
            <span className={styles.modeDesc}>上半局我方先进攻<br/>下半局对手进攻</span>
          </button>
          <button type="button" className={styles.modeCard}
            onClick={() => { onSetBatFirst(false); setBatFirstChosen(false); }}>
            <span className={styles.modeIcon}>🛡️</span>
            <span className={styles.modeLabel}>先防</span>
            <span className={styles.modeDesc}>上半局对手先进攻<br/>下半局我方进攻</span>
          </button>
        </div>
        <button type="button" className={styles.btnBack}
          onClick={() => { setMode(null); setBatFirstChosen(null); }}>
          ← 返回选择模式
        </button>
      </div>
    );
  }

  return (
    <ScoreboardSetupDialog
      workspace={workspace}
      mode={mode}
      batFirst={batFirst}
      onStart={onStart}
      onCancel={() => { setMode(null); setBatFirstChosen(null); }}
    />
  );
}
