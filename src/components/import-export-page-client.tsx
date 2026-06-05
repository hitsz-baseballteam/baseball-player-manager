"use client";

import { useCallback, useRef, useState, type ChangeEvent } from "react";

import { AppShell } from "@/components/app-shell";
import styles from "@/components/import-export-page-client.module.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import {
  applyScenarioImport,
  applyWorkspaceImport,
  buildCsvExport,
  buildScenarioExport,
  buildWorkspaceExport,
  parseImportPayload,
} from "@/lib/export-actions";
import { sanitizeWorkspace, timestampFilePart, type PendingImport, type Workspace } from "@/lib/workspace";
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
  { label: "数据中心", href: "/import-export", active: true },
  { label: "设置", href: "/settings" },
] as const;

type ImportExportPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

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

export function ImportExportPageClient({
  initialWorkspace,
  initialVersion,
}: ImportExportPageClientProps) {
  const [workspace, setWorkspace] = useState(() => sanitizeWorkspace(initialWorkspace));
  const [version, setVersion] = useState(initialVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const toastRef = useRef<ToastHandle | null>(null);

  const handleExportWorkspace = useCallback(() => {
    const payload = buildWorkspaceExport(workspace);
    downloadJson(`baseball-workspace-${timestampFilePart()}.json`, payload);
    toastRef.current?.showToast("工作区 JSON 已导出");
  }, [workspace]);

  const handleExportScenario = useCallback(() => {
    const payload = buildScenarioExport(workspace, workspace.activeScenarioId);
    downloadJson(`baseball-scenario-${timestampFilePart()}.json`, payload);
    toastRef.current?.showToast("当前方案 JSON 已导出");
  }, [workspace]);

  const handleExportCsv = useCallback(() => {
    const csv = buildCsvExport(workspace);
    downloadText(`baseball-players-${timestampFilePart()}.csv`, csv, "text/csv;charset=utf-8");
    toastRef.current?.showToast("球员 CSV 已导出");
  }, [workspace]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setSaveError(null);
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const pending = parseImportPayload(parsed);
      setPendingImport(pending);
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入解析失败，请检查 JSON 文件";
      setSaveError(message);
      toastRef.current?.showToast(message);
      setPendingImport(null);
    } finally {
      input.value = "";
    }
  }, []);

  const handleCancelImport = useCallback(() => {
    setPendingImport(null);
    setSaveError(null);
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImport) return;

    const nextWorkspace = pendingImport.type === "workspace"
      ? applyWorkspaceImport(workspace, pendingImport)
      : applyScenarioImport(workspace, pendingImport);

    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await saveWorkspaceSnapshot(nextWorkspace, version);
      setWorkspace(sanitizeWorkspace(result.workspace));
      setVersion(result.version);
      setPendingImport(null);
      toastRef.current?.showToast(pendingImport.type === "workspace" ? "工作区导入成功" : "方案导入成功");
    } catch (error) {
      if (isVersionConflict(error)) {
        const latest = await loadWorkspaceSnapshot();
        setWorkspace(sanitizeWorkspace(latest.workspace));
        setVersion(latest.version);
        toastRef.current?.showToast("数据已被其他会话更新，已刷新最新内容");
      } else {
        const message = error instanceof Error ? error.message : "导入保存失败，请稍后重试";
        setSaveError(message);
        toastRef.current?.showToast(message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [pendingImport, version, workspace]);

  const pendingPlayerCount = pendingImport?.type === "workspace"
    ? pendingImport.workspace.players.length
    : pendingImport?.players.length ?? 0;
  const pendingScenarioCount = pendingImport?.type === "workspace"
    ? pendingImport.workspace.scenarios.length
    : pendingImport
    ? 1
    : 0;

  return (
    <ToastProvider toastRef={toastRef}>
      <AppShell
        eyebrow="Data Center"
        title="数据中心"
        description="导出工作区 / 当前方案 / 球员 CSV，并在导入前预览摘要。"
        statusLabel="工作区"
        statusValue={`v${version}`}
        statusMeta={isSaving ? "保存中…" : "数据中心已连接共享工作区"}
        navItems={[...NAV_ITEMS]}
        actions={<ThemeToggle />}
      >
        <div className={styles.layout}>
          <section className={styles.sectionCard} aria-label="导出工作区数据">
            <p className={styles.sectionEyebrow}>Export Workspace</p>
            <h2 className={styles.sectionTitle}>导出工作区数据</h2>
            <p className={styles.sectionDescription}>
              下载完整工作区 JSON、当前激活方案 JSON，或球员 CSV 列表，便于备份与分享。
            </p>
            <div className={styles.actionRow}>
              <button className={styles.btnPrimary} type="button" onClick={handleExportWorkspace}>
                导出工作区 JSON
              </button>
              <button className={styles.btnSecondary} type="button" onClick={handleExportScenario}>
                导出当前方案 JSON
              </button>
              <button className={styles.btnSecondary} type="button" onClick={handleExportCsv}>
                导出球员 CSV
              </button>
            </div>
          </section>

          <section className={styles.sectionCard} aria-label="导入 JSON 数据">
            <p className={styles.sectionEyebrow}>Import JSON</p>
            <h2 className={styles.sectionTitle}>导入 JSON 数据</h2>
            <p className={styles.sectionDescription}>
              选择合法的 workspace / scenario JSON 文件，先预览摘要，再确认写回共享工作区。
            </p>
            <div className={styles.importRow}>
              <label className={styles.uploadLabel} htmlFor="import-json-input">
                选择 JSON 文件
              </label>
              <input
                id="import-json-input"
                className={styles.fileInput}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
              />
              <span className={styles.fileHint}>支持 workspace / scenario JSON；本 slice 暂不实现拖拽上传。</span>
            </div>

            {saveError ? <div className={styles.errorText}>{saveError}</div> : null}
            {isSaving ? <div className={styles.statusText}>正在保存导入内容…</div> : null}

            {pendingImport ? (
              <div className={styles.summaryCard} aria-label="导入摘要卡">
                <p className={styles.sectionEyebrow}>Import Preview</p>
                <h3 className={styles.sectionTitle} style={{ fontSize: "1rem" }}>导入摘要</h3>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>类型</span>
                    <span className={styles.summaryValue}>{pendingImport.type}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>球员数</span>
                    <span className={styles.summaryValue}>{pendingPlayerCount}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>场景数</span>
                    <span className={styles.summaryValue}>{pendingScenarioCount}</span>
                  </div>
                </div>
                <p className={styles.summaryText}>{pendingImport.summary}</p>
                <ul className={styles.nameList}>
                  {pendingImport.names.map((name) => <li key={name}>{name}</li>)}
                </ul>
                <div className={styles.actionRow}>
                  <button className={styles.btnSecondary} type="button" onClick={handleCancelImport}>
                    取消导入
                  </button>
                  <button className={styles.btnPrimary} type="button" onClick={handleConfirmImport} disabled={isSaving}>
                    确认导入
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </AppShell>
    </ToastProvider>
  );
}
