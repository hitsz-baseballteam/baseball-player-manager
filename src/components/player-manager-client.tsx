"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { GuideOverlay, type GuideHandle } from "@/components/guide-overlay";
import { HelpDrawer, type HelpDrawerHandle } from "@/components/help-drawer";
import { HomeOverview } from "@/components/home-overview";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import { mountPlayerManager } from "@/lib/player-manager-dom";
import { getActiveScenario, type Workspace } from "@/lib/workspace";

type PlayerManagerClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
  markup: string;
  styles: string;
};

const NAV_ITEMS = [
  { label: "总览", href: "/", active: true },
  { label: "名册", disabled: true, status: "规划中" },
  { label: "排阵", disabled: true, status: "规划中" },
  { label: "战术场景", disabled: true, status: "规划中" },
  { label: "数据中心", disabled: true, status: "规划中" },
  { label: "设置", disabled: true, status: "规划中" },
] as const;

function prepareLegacyMarkup(markup: string) {
  return markup
    .replace(/<div class="drawer-scrim"[\s\S]*?(?=<div class="guide-overlay")/i, "")
    .replace(/<div class="guide-overlay"[\s\S]*?(?=<dialog id="playerDialog")/i, "")
    .replace(/id="helpBtn"/g, 'id="legacyHelpBtn"')
    .replace(/id="theme-toggle-btn"/g, 'id="legacyThemeToggleBtn"');
}

export function PlayerManagerClient(props: PlayerManagerClientProps) {
  const appRootRef = useRef<HTMLDivElement>(null);
  const legacyRootRef = useRef<HTMLDivElement>(null);
  const legacyFrameAnchorRef = useRef<HTMLDivElement>(null);

  const toastRef = useRef<ToastHandle | null>(null);
  const helpRef = useRef<HelpDrawerHandle | null>(null);
  const guideRef = useRef<GuideHandle | null>(null);

  const [workspace, setWorkspace] = useState(props.initialWorkspace);
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

  const preparedMarkup = useMemo(() => prepareLegacyMarkup(props.markup), [props.markup]);
  const activeScenario = useMemo(() => getActiveScenario(workspace), [workspace]);

  const clickLegacyControl = useCallback((selector: string) => {
    const root = legacyRootRef.current;
    if (!root) {
      return false;
    }

    const target = root.querySelector<HTMLElement>(selector);
    if (!target) {
      toastRef.current?.showToast("入口暂时不可用，请在完整工作台中继续操作");
      return false;
    }

    target.click();
    return true;
  }, []);

  const changeLegacyScenario = useCallback((scenarioId: string) => {
    const root = legacyRootRef.current;
    if (!root) {
      return;
    }

    const nextScenario = workspace.scenarios.find((scenario) => scenario.id === scenarioId);
    if (!nextScenario) {
      return;
    }

    const select = root.querySelector<HTMLSelectElement>("#scenarioSelect");
    if (!select) {
      toastRef.current?.showToast("方案切换暂时不可用，请在完整工作台中继续操作");
      return;
    }

    setWorkspace((current) => ({
      ...current,
      activeScenarioId: scenarioId,
    }));

    select.value = scenarioId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, [workspace.scenarios]);

  const scrollToWorkspace = useCallback(() => {
    legacyFrameAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const root = legacyRootRef.current;
    if (!root) return;

    const cleanup = mountPlayerManager(root, {
      workspace: props.initialWorkspace,
      version: props.initialVersion,
      updatedAt: "",
    }, {
      toast: toastRef,
      helpDrawer: helpRef,
      guide: guideRef,
      onStateChange: (snapshot) => {
        setWorkspace(snapshot.workspace);
        setRemoteVersion(snapshot.version);
        setSaveStatus(snapshot.saveStatus);
      },
    });

    return cleanup;
  }, [preparedMarkup, props.initialVersion, props.initialWorkspace]);

  const heroDescription = `${activeScenario.name} · ${saveStatus}。进入首页后先看提醒、快捷动作和当前方案状态，再进入完整工作台深入编辑。`;
  const statusMeta = `最近更新 ${formatTimestamp(activeScenario.updatedAt)} · Workspace v${remoteVersion}`;

  return (
    <ToastProvider toastRef={toastRef}>
      <style dangerouslySetInnerHTML={{ __html: props.styles }} />
      <div ref={appRootRef}>
        <AppShell
          eyebrow="Game Day Command Desk"
          title="比赛日总控台"
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
                onClick={() => helpRef.current?.open() ?? handleHelpOpen()}
              >
                <span aria-hidden="true">?</span>
                <span className="btn-label">帮助</span>
              </button>
              <ThemeToggle />
            </>
          )}
          content={(
            <HomeOverview
              workspace={workspace}
              remoteVersion={remoteVersion}
              saveStatus={saveStatus}
              onAutoAssign={() => void clickLegacyControl("#autoAssignBtn")}
              onAddPlayer={() => void clickLegacyControl("#addPlayerBtn")}
              onImport={() => void clickLegacyControl("#importBtn")}
              onCreateScenario={() => void clickLegacyControl("#newScenarioBtn")}
              onScenarioChange={changeLegacyScenario}
              onOpenWorkspace={scrollToWorkspace}
            />
          )}
          frameEyebrow="Deep Edit Workspace"
          frameTitle="深入编辑工作台"
          frameDescription="首页总控区负责判断与入口，完整球员编辑、拖拽排阵和方案细调继续留在下方 legacy 工作台。"
          frameVariant="legacy"
        >
          <div ref={legacyFrameAnchorRef} />
          <div ref={legacyRootRef} dangerouslySetInnerHTML={{ __html: preparedMarkup }} />
        </AppShell>
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
