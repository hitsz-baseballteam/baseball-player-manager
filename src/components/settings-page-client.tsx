"use client";

import { useCallback, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { GuideOverlay, type GuideHandle } from "@/components/guide-overlay";
import { HelpDrawer, type HelpDrawerHandle } from "@/components/help-drawer";
import styles from "@/components/settings-page-client.module.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import { createDefaultWorkspace, sanitizeWorkspace, type Workspace } from "@/lib/workspace";
import {
  isVersionConflict,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
} from "@/lib/workspace-client";

const NAV_ITEMS = [
  { label: "总览", href: "/" },
  { label: "名册", href: "/roster" },
  { label: "排阵", href: "/lineup" },
  { label: "战术场景", href: "/scenarios" },
  { label: "数据中心", href: "/import-export" },
  { label: "设置", href: "/settings", active: true },
] as const;

type SettingsPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

export function SettingsPageClient({
  initialWorkspace,
  initialVersion,
}: SettingsPageClientProps) {
  const appRootRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<ToastHandle | null>(null);
  const helpRef = useRef<HelpDrawerHandle | null>(null);
  const guideRef = useRef<GuideHandle | null>(null);

  const [workspace, setWorkspace] = useState(() => sanitizeWorkspace(initialWorkspace));
  const [version, setVersion] = useState(initialVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const handleHelpOpen = useCallback(() => setHelpOpen(true), []);
  const handleHelpClose = useCallback(() => setHelpOpen(false), []);
  const handleGuideDismiss = useCallback(() => setGuideOpen(false), []);
  const handleReplayGuide = useCallback(() => {
    setHelpOpen(false);
    setGuideOpen(true);
    queueMicrotask(() => guideRef.current?.open());
  }, []);

  const handleResetExampleData = useCallback(async () => {
    if (!window.confirm("确认重置为示例数据？当前共享工作区会被默认球员与默认方案覆盖。")) {
      return;
    }

    const nextWorkspace = createDefaultWorkspace(workspace.preferences.helpDismissed);
    setIsSaving(true);
    setSaveError(null);

    try {
      const result = await saveWorkspaceSnapshot(nextWorkspace, version);
      setWorkspace(sanitizeWorkspace(result.workspace));
      setVersion(result.version);
      toastRef.current?.showToast("已重置为示例数据");
    } catch (error) {
      if (isVersionConflict(error)) {
        const latest = await loadWorkspaceSnapshot();
        setWorkspace(sanitizeWorkspace(latest.workspace));
        setVersion(latest.version);
        toastRef.current?.showToast("数据已被其他会话更新，已刷新最新内容");
      } else {
        setSaveError("重置失败，请稍后重试");
        toastRef.current?.showToast("重置失败，请稍后重试");
      }
    } finally {
      setIsSaving(false);
    }
  }, [version, workspace.preferences.helpDismissed]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      window.location.href = "/";
    }
  }, []);

  const openGuide = useCallback(() => {
    setGuideOpen(true);
    queueMicrotask(() => guideRef.current?.open());
  }, []);

  const openHelp = useCallback(() => {
    if (helpRef.current) {
      helpRef.current.open();
      return;
    }
    handleHelpOpen();
  }, [handleHelpOpen]);

  return (
    <ToastProvider toastRef={toastRef}>
      <div ref={appRootRef} className={styles.helpMount}>
        <AppShell
          eyebrow="Workspace Settings"
          title="设置与帮助"
          description="管理当前工作区外观、重置示例数据、访问控制与帮助入口。"
          statusLabel="工作区"
          statusValue={`v${version}`}
          statusMeta={isSaving ? "保存中…" : "设置页已连接共享工作区"}
          navItems={[...NAV_ITEMS]}
          actions={<ThemeToggle />}
        >
          <div className={styles.layout}>
            <section className={styles.card} aria-label="外观主题区">
              <p className={styles.eyebrow}>Appearance</p>
              <h2 className={styles.title}>外观主题</h2>
              <p className={styles.description}>当前支持经典 / 夜场 / 球场三套主题，可随时切换。</p>
              <div className={styles.actionRow}>
                <ThemeToggle />
              </div>
            </section>

            <section className={styles.card} aria-label="工作区状态区">
              <p className={styles.eyebrow}>Workspace</p>
              <h2 className={styles.title}>工作区状态</h2>
              <p className={styles.description}>查看当前共享工作区版本、球员数量与方案数量。</p>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>当前版本</span>
                  <span className={styles.statValue}>{`v${version}`}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>球员数</span>
                  <span className={styles.statValue}>{workspace.players.length}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>方案数</span>
                  <span className={styles.statValue}>{workspace.scenarios.length}</span>
                </div>
              </div>
              <div className={styles.actionRow}>
                <button
                  className={styles.btnDanger}
                  type="button"
                  onClick={handleResetExampleData}
                  disabled={isSaving}
                >
                  重置示例数据
                </button>
              </div>
              {saveError ? <p className={styles.errorText}>{saveError}</p> : null}
              {isSaving ? <p className={styles.statusText}>正在同步工作区…</p> : null}
            </section>

            <section className={styles.card} aria-label="访问控制区">
              <p className={styles.eyebrow}>Access</p>
              <h2 className={styles.title}>访问控制</h2>
              <p className={styles.description}>当前工作区采用共享口令模式，仅持有管理口令者可访问。</p>
              <div className={styles.actionRow}>
                <button className={styles.btnSecondary} type="button" onClick={handleLogout}>
                  退出登录
                </button>
              </div>
            </section>

            <section className={styles.card} aria-label="帮助与引导区">
              <p className={styles.eyebrow}>Help</p>
              <h2 className={styles.title}>帮助与引导</h2>
              <p className={styles.description}>重新播放引导流程，或打开帮助抽屉查看主要操作说明。</p>
              <div className={styles.actionRow}>
                <button className={styles.btnPrimary} type="button" onClick={openGuide}>
                  重新播放引导
                </button>
                <button className={styles.btnSecondary} type="button" onClick={openHelp}>
                  打开帮助
                </button>
              </div>
            </section>
          </div>
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
