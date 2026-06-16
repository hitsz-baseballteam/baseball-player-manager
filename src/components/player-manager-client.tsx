"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { GuideOverlay, type GuideHandle } from "@/components/guide-overlay";
import { HelpDrawer, type HelpDrawerHandle } from "@/components/help-drawer";
import { HomeOverview } from "@/components/home-overview";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import {
  autoAssignActive,
  clearAllAssignments,
  copyScenarioAction,
  createScenarioAction,
  setActiveScenarioAction,
} from "@/lib/lineup-actions";
import {
  buildScenarioExport,
  buildWorkspaceExport,
} from "@/lib/export-actions";
import {
  createUniqueScenarioName,
  getActiveScenario,
  sanitizeWorkspace,
  type Workspace,
} from "@/lib/workspace";
import {
  activateScenario,
  createScenario,
  isVersionConflict,
  loadWorkspaceSnapshot,
  submitMutationWithRetry,
  type WorkspaceSnapshot,
  updateScenarioAssignments,
} from "@/lib/workspace-client";
import { panelNavItems, PANEL_ROUTES } from "@/lib/routes";

type PlayerManagerClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

const NAV_ITEMS = panelNavItems("总览");

function downloadText(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadJson(fileName: string, payload: unknown): void {
  downloadText(fileName, JSON.stringify(payload, null, 2), "application/json");
}

export function PlayerManagerClient(props: PlayerManagerClientProps) {
  const router = useRouter();
  const appRootRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<ToastHandle | null>(null);
  const helpRef = useRef<HelpDrawerHandle | null>(null);
  const guideRef = useRef<GuideHandle | null>(null);

  const [workspace, setWorkspace] = useState(() => sanitizeWorkspace(props.initialWorkspace));
  const [remoteVersion, setRemoteVersion] = useState(props.initialVersion);
  const [saveStatus, setSaveStatus] = useState("云端工作区已准备");
  const [helpOpen, setHelpOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(
    !props.initialWorkspace.preferences.helpDismissed,
  );

  const handleHelpOpen = useCallback(() => setHelpOpen(true), []);
  const handleHelpClose = useCallback(() => setHelpOpen(false), []);
  const handleGuideDismiss = useCallback(() => setGuideOpen(false), []);
  const handleReplayGuide = useCallback(() => {
    setHelpOpen(false);
    setGuideOpen(true);
  }, []);

  const activeScenario = useMemo(() => getActiveScenario(workspace), [workspace]);

  const applyWorkspaceMutation = useCallback(async (
    applyMutation: (current: Workspace) => Workspace,
    submit: (nextWorkspace: Workspace, version: number) => Promise<WorkspaceSnapshot>,
    messages: { success: string; failure: string },
  ) => {
    const optimistic = applyMutation(workspace);
    setWorkspace(optimistic);
    setSaveStatus("正在同步到云端...");

    try {
      const result = await submitMutationWithRetry(
        workspace,
        remoteVersion,
        applyMutation,
        submit,
      );
      setWorkspace(sanitizeWorkspace(result.workspace));
      setRemoteVersion(result.version);
      setSaveStatus(messages.success);
      toastRef.current?.showToast(messages.success);
    } catch (error) {
      if (isVersionConflict(error)) {
        const latest = await loadWorkspaceSnapshot();
        setWorkspace(sanitizeWorkspace(latest.workspace));
        setRemoteVersion(latest.version);
        setSaveStatus("工作区已被其他会话更新，已刷新最新数据");
        toastRef.current?.showToast("工作区已被其他会话更新，已刷新最新数据");
      } else {
        console.error(error);
        setSaveStatus(messages.failure);
        toastRef.current?.showToast(messages.failure);
      }
    }
  }, [workspace, remoteVersion]);

  const handleAutoAssign = useCallback(() => {
    void applyWorkspaceMutation(
      (current) => autoAssignActive(current),
      (nextWorkspace, currentVersion) => {
        const scenario = getActiveScenario(nextWorkspace);
        return updateScenarioAssignments(
          scenario.id,
          scenario.assignments,
          currentVersion,
          scenario.updatedAt,
        );
      },
      { success: "已自动排阵", failure: "自动排阵失败，请稍后重试" },
    );
  }, [applyWorkspaceMutation]);

  const handleCreateScenario = useCallback(() => {
    void applyWorkspaceMutation(
      (current) => {
        const name = createUniqueScenarioName("新方案", current.scenarios);
        const updated = createScenarioAction(current, name, "");
        const createdId = updated.scenarios.at(-1)?.id;
        return createdId ? setActiveScenarioAction(updated, createdId) : updated;
      },
      (nextWorkspace, currentVersion) => {
        const scenario = nextWorkspace.scenarios.at(-1);
        if (!scenario) {
          throw new Error("scenario_missing");
        }
        return createScenario(scenario, currentVersion, true);
      },
      { success: "已创建新方案", failure: "新建方案失败，请稍后重试" },
    );
  }, [applyWorkspaceMutation]);

  const handleDuplicateScenario = useCallback(() => {
    void applyWorkspaceMutation(
      (current) => {
        const updated = copyScenarioAction(current, current.activeScenarioId);
        const copiedId = updated.scenarios.at(-1)?.id;
        return copiedId ? setActiveScenarioAction(updated, copiedId) : updated;
      },
      (nextWorkspace, currentVersion) => {
        const scenario = nextWorkspace.scenarios.at(-1);
        if (!scenario) {
          throw new Error("scenario_missing");
        }
        return createScenario(scenario, currentVersion, true);
      },
      { success: "已复制当前方案", failure: "复制方案失败，请稍后重试" },
    );
  }, [applyWorkspaceMutation]);

  const handleClearAssignments = useCallback(() => {
    if (!window.confirm("确认清空当前方案的守备和打线分配？")) {
      return;
    }

    void applyWorkspaceMutation(
      (current) => clearAllAssignments(current),
      (nextWorkspace, currentVersion) => {
        const scenario = getActiveScenario(nextWorkspace);
        return updateScenarioAssignments(
          scenario.id,
          scenario.assignments,
          currentVersion,
          scenario.updatedAt,
        );
      },
      { success: "已清空当前阵容", failure: "清空阵容失败，请稍后重试" },
    );
  }, [applyWorkspaceMutation]);

  const handleScenarioChange = useCallback((scenarioId: string) => {
    void applyWorkspaceMutation(
      (current) => setActiveScenarioAction(current, scenarioId),
      (_nextWorkspace, currentVersion) => activateScenario(scenarioId, currentVersion),
      { success: "已切换当前方案", failure: "切换方案失败，请稍后重试" },
    );
  }, [applyWorkspaceMutation]);

  const handleExportWorkspace = useCallback(() => {
    downloadJson(`baseball-workspace-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`, buildWorkspaceExport(workspace));
    toastRef.current?.showToast("工作区 JSON 已导出");
  }, [workspace]);

  const handleExportScenario = useCallback(() => {
    downloadJson(`baseball-scenario-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`, buildScenarioExport(workspace, workspace.activeScenarioId));
    toastRef.current?.showToast("当前方案 JSON 已导出");
  }, [workspace]);

  const navigate = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  const heroDescription = `${saveStatus} · Workspace v${remoteVersion}`;
  const statusMeta = `最近更新 ${formatTimestamp(activeScenario.updatedAt)}`;

  return (
    <ToastProvider toastRef={toastRef}>
      <div ref={appRootRef}>
        <AppShell
          variant="command"
          eyebrow="Baseball Player Manager"
          title="比赛日指挥台"
          description={heroDescription}
          statusLabel="当前方案"
          statusValue={activeScenario.name}
          statusMeta={statusMeta}
          navItems={NAV_ITEMS.map((item) => ({ ...item }))}
          actions={(
            <>
              <button
                id="helpBtn"
                type="button"
                onClick={handleHelpOpen}
              >
                <span aria-hidden="true">?</span>
                <span className="btn-label">帮助</span>
              </button>
            </>
          )}
          content={(
            <HomeOverview
              workspace={workspace}
              remoteVersion={remoteVersion}
              saveStatus={saveStatus}
              onAutoAssign={handleAutoAssign}
              onAddPlayer={() => navigate(PANEL_ROUTES.roster)}
              onImport={() => navigate(PANEL_ROUTES.settings)}
              onCreateScenario={handleCreateScenario}
              onExportWorkspace={handleExportWorkspace}
              onExportScenario={handleExportScenario}
              onRenameScenario={() => navigate(PANEL_ROUTES.scenarios)}
              onDuplicateScenario={handleDuplicateScenario}
              onClearAssignments={handleClearAssignments}
              onOpenWorkspace={() => navigate(PANEL_ROUTES.scenarios)}
              onOpenScenarioPanel={() => navigate(PANEL_ROUTES.scenarios)}
              onOpenRosterPanel={() => navigate(PANEL_ROUTES.roster)}
              onOpenFieldPanel={() => navigate(PANEL_ROUTES.scenarios)}
              onOpenLineupPanel={() => navigate(PANEL_ROUTES.scenarios)}
              onOpenWarningsPanel={() => navigate(PANEL_ROUTES.scenarios)}
              onScenarioChange={handleScenarioChange}
            />
          )}
        />
      </div>
      <HelpDrawer
        isOpen={helpOpen}
        onOpen={handleHelpOpen}
        onClose={handleHelpClose}
        onReplayGuide={handleReplayGuide}
        helpRef={helpRef}
      />
      <GuideOverlay
        isOpen={guideOpen}
        onDismiss={handleGuideDismiss}
        guideRef={guideRef}
        rootRef={appRootRef}
      />
    </ToastProvider>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
