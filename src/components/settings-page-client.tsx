"use client";

import { useCallback, useRef, useState, type ChangeEvent } from "react";

import { AppShell } from "@/components/app-shell";
import styles from "@/components/settings-page-client.module.css";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import {
  cloneWorkspace,
  createMilestone,
  timestampFilePart,
  type PendingImport,
  type PublicHomeMember,
  type PublicHomeMemberTone,
  type Workspace,
} from "@/lib/workspace";
import {
  createWorkspaceMilestone,
  deleteWorkspaceMilestone,
  importWorkspaceSnapshot,
  isVersionConflict,
  resetWorkspace,
  updateWorkspacePreferences,
} from "@/lib/workspace-client";
import { useWorkspaceSnapshot } from "@/lib/use-workspace-snapshot";

import {
  applyScenarioImport,
  applyWorkspaceImport,
  buildCsvExport,
  buildWorkspaceExport,
  parseImportPayload,
} from "@/lib/export-actions";
import { panelNavItems, PANEL_ROUTES } from "@/lib/routes";

const NAV_ITEMS = panelNavItems("设置");

type SettingsPageClientProps = {
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

export function SettingsPageClient({
  initialWorkspace,
  initialVersion,
}: SettingsPageClientProps) {
  const toastRef = useRef<ToastHandle | null>(null);

  const { workspace, version, applySnapshot, refreshWorkspace } =
    useWorkspaceSnapshot(initialWorkspace, initialVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Import/Export ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPayload, setImportPayload] = useState<PendingImport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExportJson = useCallback(() => {
    const ts = timestampFilePart();
    downloadJson(`workspace-${ts}.json`, buildWorkspaceExport(workspace));
  }, [workspace]);

  const handleExportCsv = useCallback(() => {
    const ts = timestampFilePart();
    downloadText(`roster-${ts}.csv`, buildCsvExport(workspace), "text/csv");
  }, [workspace]);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const payload = parseImportPayload(text);
      if ("error" in payload) {
        setImportError(String(payload.error));
        return;
      }
      setImportPayload(payload);
    };
    reader.onerror = () => setImportError("文件读取失败");
    reader.readAsText(file);
    // reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleApplyImport = useCallback(async () => {
    if (!importPayload) return;
    const current = cloneWorkspace(workspace);
    let next: Workspace;
    try {
      if (importPayload.type === "workspace") {
        next = applyWorkspaceImport(current, importPayload);
      } else {
        next = applyScenarioImport(current, importPayload);
      }
    } catch (err) {
      setImportError(String(err instanceof Error ? err.message : err));
      return;
    }
    setImportPayload(null);
    setImportError(null);
    try {
      const result = await importWorkspaceSnapshot(next, version);
      applySnapshot(result);
      toastRef.current?.showToast("导入成功");
    } catch {
      setImportError("保存失败，请重试。");
    }
  }, [importPayload, workspace, version, applySnapshot]);

  const handleResetExampleData = useCallback(async () => {
    if (!window.confirm("确认重置为示例数据？当前共享工作区会被默认球员与默认方案覆盖。")) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const result = await resetWorkspace(workspace.preferences.helpDismissed, version);
      applySnapshot(result);
      toastRef.current?.showToast("已重置为示例数据");
    } catch (error) {
      if (isVersionConflict(error)) {
        await refreshWorkspace();
        toastRef.current?.showToast("数据已被其他会话更新，已刷新最新内容");
      } else {
        setSaveError("重置失败，请稍后重试");
        toastRef.current?.showToast("重置失败，请稍后重试");
      }
    } finally {
      setIsSaving(false);
    }
  }, [version, workspace.preferences.helpDismissed, applySnapshot, refreshWorkspace]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      window.location.href = PANEL_ROUTES.login;
    }
  }, []);

  // ── Milestone form ──
  const [milestoneDraft, setMilestoneDraft] = useState({
    date: "",
    title: "",
    description: "",
  });

  async function handleAddMilestone() {
    if (!milestoneDraft.date || !milestoneDraft.title) return;
    const ms = createMilestone(
      milestoneDraft.date,
      milestoneDraft.title,
      milestoneDraft.description,
    );
    setIsSaving(true);
    setSaveError(null);
    setMilestoneDraft({ date: "", title: "", description: "" });
    try {
      const result = await createWorkspaceMilestone(ms, version);
      applySnapshot(result);
      toastRef.current?.showToast("里程碑已添加");
    } catch (error) {
      try {
        await refreshWorkspace();
        if (isVersionConflict(error)) {
          toastRef.current?.showToast("数据已被其他会话更新，已刷新最新内容。");
        } else {
          setSaveError("保存失败，已恢复到最新数据。");
        }
      } catch {
        toastRef.current?.showToast("保存失败且无法连接服务器。");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteMilestone(id: string) {
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await deleteWorkspaceMilestone(id, version);
      applySnapshot(result);
      toastRef.current?.showToast("里程碑已删除");
    } catch (error) {
      try {
        await refreshWorkspace();
        if (isVersionConflict(error)) {
          toastRef.current?.showToast("数据已被其他会话更新，已刷新最新内容。");
        } else {
          setSaveError("删除失败，已恢复到最新数据。");
        }
      } catch {
        toastRef.current?.showToast("操作失败且无法连接服务器。");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ToastProvider toastRef={toastRef}>
      <AppShell
          eyebrow="Workspace Settings"
          title="设置"
          description="查看共享工作区状态、导入或导出数据、管理访问控制。"
          statusLabel="工作区"
          statusValue={`v${version}`}
          statusMeta={isSaving ? "保存中…" : "设置页已连接共享工作区"}
          navItems={[...NAV_ITEMS]}
        >
          <div className={styles.layout}>
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

            <section className={styles.card} aria-label="数据导入导出区">
              <p className={styles.eyebrow}>Data</p>
              <h2 className={styles.title}>数据导入与导出</h2>
              <p className={styles.description}>导出工作区备份、球员名单 CSV，或导入 JSON 格式的工作区与方案数据。</p>
              <div className={styles.actionRow}>
                <button className={styles.btnPrimary} type="button" onClick={handleExportJson}>
                  导出工作区 (JSON)
                </button>
                <button className={styles.btnSecondary} type="button" onClick={handleExportCsv}>
                  导出名册 (CSV)
                </button>
              </div>
              <div className={styles.actionRow}>
                <button
                  className={styles.btnSecondary}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  导入数据 (JSON)
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  hidden
                />
              </div>
              {importError && <p className={styles.errorText}>{importError}</p>}
              {importPayload && (
                <div className={styles.actionRow}>
                  <button className={styles.btnPrimary} type="button" onClick={handleApplyImport}>
                    确认导入{importPayload.type === "workspace" ? "工作区" : "方案"}
                  </button>
                  <button
                    className={styles.btnSecondary}
                    type="button"
                    onClick={() => setImportPayload(null)}
                  >
                    取消
                  </button>
                </div>
              )}
              {isSaving && <p className={styles.statusText}>正在保存…</p>}
            </section>

            <section className={styles.card} aria-label="球队里程碑区">
              <p className={styles.eyebrow}>History</p>
              <h2 className={styles.title}>球队里程碑</h2>
              <p className={styles.description}>记录球队历史上的重要时刻，将在名人堂页面展示。</p>

              {workspace.milestones.length > 0 ? (
                <div className={styles.milestoneList}>
                  {[...workspace.milestones]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((m) => (
                      <div key={m.id} className={styles.milestoneItem}>
                        <div className={styles.milestoneHeader}>
                          <span className={styles.milestoneDate}>{m.date}</span>
                          <button
                            className={styles.btnSmallDanger}
                            type="button"
                            onClick={() => handleDeleteMilestone(m.id)}
                          >
                            删除
                          </button>
                        </div>
                        <strong className={styles.milestoneItemTitle}>{m.title}</strong>
                        <p className={styles.milestoneItemDesc}>{m.description}</p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className={styles.statusText}>暂无里程碑记录</p>
              )}

              <div className={styles.milestoneForm}>
                <div className={styles.milestoneFormRow}>
                  <label className={styles.milestoneField}>
                    <span>日期</span>
                    <input
                      type="date"
                      value={milestoneDraft.date}
                      onChange={(e) =>
                        setMilestoneDraft((d) => ({ ...d, date: e.target.value }))
                      }
                    />
                  </label>
                  <label className={styles.milestoneField}>
                    <span>标题</span>
                    <input
                      value={milestoneDraft.title}
                      onChange={(e) =>
                        setMilestoneDraft((d) => ({ ...d, title: e.target.value }))
                      }
                      maxLength={60}
                      placeholder="例如：夺得XX邀请赛冠军"
                    />
                  </label>
                </div>
                <label className={styles.milestoneField}>
                  <span>描述</span>
                  <textarea
                    value={milestoneDraft.description}
                    onChange={(e) =>
                      setMilestoneDraft((d) => ({ ...d, description: e.target.value }))
                    }
                    maxLength={280}
                    rows={2}
                    placeholder="描述里程碑事件…"
                  />
                </label>
                <button
                  className={styles.btnPrimary}
                  type="button"
                  onClick={handleAddMilestone}
                  disabled={
                    !milestoneDraft.date ||
                    !milestoneDraft.title.trim() ||
                    isSaving
                  }
                >
                  添加里程碑
                </button>
              </div>
            </section>

            <PublicHomeConfigCard
              workspace={workspace}
              version={version}
              isSaving={isSaving}
              onSaved={(snapshot) => applySnapshot(snapshot)}
              onError={async (error) => {
                if (isVersionConflict(error)) {
                  await refreshWorkspace();
                  toastRef.current?.showToast("数据已被其他会话更新，已刷新最新内容。");
                } else {
                  setSaveError("保存失败，请稍后重试。");
                }
              }}
              onSavingChange={setIsSaving}
            />
          </div>
        </AppShell>
    </ToastProvider>
  );
}

// ── Public homepage configuration card ──

type PublicHomeConfigCardProps = {
  workspace: Workspace;
  version: number;
  isSaving: boolean;
  onSaved: (snapshot: WorkspaceSnapshot) => void;
  onError: (error: unknown) => void | Promise<void>;
  onSavingChange: (saving: boolean) => void;
};

type WorkspaceSnapshot = {
  workspace: Workspace;
  version: number;
  updatedAt: string;
};

function PublicHomeConfigCard({
  workspace,
  version,
  isSaving,
  onSaved,
  onError,
  onSavingChange,
}: PublicHomeConfigCardProps) {
  const [schedule, setSchedule] = useState(workspace.preferences.publicHomeConfig.training.schedule);
  const [location, setLocation] = useState(workspace.preferences.publicHomeConfig.training.location);
  const [note, setNote] = useState(workspace.preferences.publicHomeConfig.training.note);
  const [feedMilestonesEnabled, setFeedMilestonesEnabled] = useState(
    workspace.preferences.publicHomeConfig.feeds.milestones.enabled,
  );
  const [feedMilestonesMax, setFeedMilestonesMax] = useState(
    String(workspace.preferences.publicHomeConfig.feeds.milestones.maxCount),
  );
  const [feedGamesEnabled, setFeedGamesEnabled] = useState(
    workspace.preferences.publicHomeConfig.feeds.games.enabled,
  );
  const [feedGamesMax, setFeedGamesMax] = useState(
    String(workspace.preferences.publicHomeConfig.feeds.games.maxCount),
  );
  const [members, setMembers] = useState<PublicHomeMember[]>(() =>
    workspace.preferences.publicHomeConfig.members.map((member) => ({ ...member })),
  );

  const membersDirty = JSON.stringify(members) !== JSON.stringify(workspace.preferences.publicHomeConfig.members);

  const dirty =
    schedule !== workspace.preferences.publicHomeConfig.training.schedule ||
    location !== workspace.preferences.publicHomeConfig.training.location ||
    note !== workspace.preferences.publicHomeConfig.training.note ||
    feedMilestonesEnabled !== workspace.preferences.publicHomeConfig.feeds.milestones.enabled ||
    feedMilestonesMax !== String(workspace.preferences.publicHomeConfig.feeds.milestones.maxCount) ||
    feedGamesEnabled !== workspace.preferences.publicHomeConfig.feeds.games.enabled ||
    feedGamesMax !== String(workspace.preferences.publicHomeConfig.feeds.games.maxCount) ||
    membersDirty;

  function updateMember(index: number, patch: Partial<PublicHomeMember>) {
    setMembers((current) => current.map((member, memberIndex) => (
      memberIndex === index ? { ...member, ...patch } : member
    )));
  }

  function addMember() {
    setMembers((current) => [
      ...current,
      { number: "", name: "", nickname: "", role: "队员", note: "", tone: "active" },
    ]);
  }

  function removeMember(index: number) {
    setMembers((current) => current.filter((_, memberIndex) => memberIndex !== index));
  }

  function moveMember(index: number, delta: -1 | 1) {
    setMembers((current) => {
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [member] = next.splice(index, 1);
      if (!member) return current;
      next.splice(nextIndex, 0, member);
      return next;
    });
  }

  async function handleSave() {
    onSavingChange(true);
    try {
      const updatedConfig = {
        ...workspace.preferences.publicHomeConfig,
        training: {
          ...workspace.preferences.publicHomeConfig.training,
          schedule,
          location,
          note,
        },
        members,
        feeds: {
          milestones: {
            enabled: feedMilestonesEnabled,
            maxCount: Number.parseInt(feedMilestonesMax, 10) || 0,
          },
          games: {
            enabled: feedGamesEnabled,
            maxCount: Number.parseInt(feedGamesMax, 10) || 0,
            gameTypes: workspace.preferences.publicHomeConfig.feeds.games.gameTypes,
          },
        },
      };
      const result = await updateWorkspacePreferences(
        { publicHomeConfig: updatedConfig },
        version,
      );
      onSaved(result);
    } catch (error) {
      await onError(error);
    } finally {
      onSavingChange(false);
    }
  }

  return (
    <section className={styles.card} aria-label="主页展示设置区">
      <p className={styles.eyebrow}>Public Homepage</p>
      <h2 className={styles.title}>主页展示设置</h2>
      <p className={styles.description}>
        配置公开主页的训练信息文案、动态内容开关。修改后会立即在公开主页生效。
      </p>

      <div className={styles.configGroup}>
        <h3 className={styles.configGroupTitle}>训练信息</h3>
        <label className={styles.milestoneField}>
          <span>训练时间</span>
          <input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            maxLength={200}
            placeholder="例如：每周二、五 18:30–21:00"
          />
        </label>
        <label className={styles.milestoneField}>
          <span>训练地点</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={200}
            placeholder="例如：大学城体育中心棒球场"
          />
        </label>
        <label className={styles.milestoneField}>
          <span>注意事项</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="例如：雨天会提前在群里通知是否改室内训练"
          />
        </label>
      </div>

      <div className={styles.configGroup}>
        <h3 className={styles.configGroupTitle}>号码墙</h3>
        <p className={styles.description}>维护公开主页成员墙的姓名、背号与昵称。保存后公开主页立即使用这份配置。</p>
        <div className={styles.memberEditorList}>
          {members.map((member, index) => (
            <fieldset key={`${index}-${member.number}-${member.name}`} className={styles.memberEditor}>
              <legend>成员 {index + 1}</legend>
              <div className={styles.memberEditorGrid}>
                <label className={styles.milestoneField}>
                  <span>背号</span>
                  <input
                    value={member.number}
                    onChange={(e) => updateMember(index, { number: e.target.value })}
                    maxLength={4}
                    placeholder="81"
                  />
                </label>
                <label className={styles.milestoneField}>
                  <span>姓名</span>
                  <input
                    value={member.name}
                    onChange={(e) => updateMember(index, { name: e.target.value })}
                    maxLength={48}
                    placeholder="范张晨"
                  />
                </label>
                <label className={styles.milestoneField}>
                  <span>昵称</span>
                  <input
                    value={member.nickname ?? ""}
                    onChange={(e) => updateMember(index, { nickname: e.target.value })}
                    maxLength={32}
                    placeholder="FAN"
                  />
                </label>
                <label className={styles.milestoneField}>
                  <span>角色</span>
                  <input
                    value={member.role}
                    onChange={(e) => updateMember(index, { role: e.target.value })}
                    maxLength={24}
                    placeholder="队员"
                  />
                </label>
                <label className={styles.milestoneField}>
                  <span>样式</span>
                  <select
                    value={member.tone}
                    onChange={(e) => updateMember(index, { tone: e.target.value as PublicHomeMemberTone })}
                  >
                    <option value="active">普通</option>
                    <option value="captain">队长</option>
                    <option value="vice">副队长</option>
                    <option value="manager">经理</option>
                    <option value="open">开放位</option>
                  </select>
                </label>
                <label className={styles.milestoneField}>
                  <span>备注</span>
                  <input
                    value={member.note}
                    onChange={(e) => updateMember(index, { note: e.target.value })}
                    maxLength={120}
                    placeholder="Nickname · FAN"
                  />
                </label>
              </div>
              <div className={styles.memberActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => moveMember(index, -1)} disabled={index === 0 || isSaving}>
                  上移
                </button>
                <button type="button" className={styles.btnSecondary} onClick={() => moveMember(index, 1)} disabled={index === members.length - 1 || isSaving}>
                  下移
                </button>
                <button type="button" className={styles.btnSmallDanger} onClick={() => removeMember(index)} disabled={members.length <= 1 || isSaving}>
                  删除
                </button>
              </div>
            </fieldset>
          ))}
        </div>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={addMember}
          disabled={members.length >= 60 || isSaving}
        >
          添加成员
        </button>
      </div>

      <div className={styles.configGroup}>
        <h3 className={styles.configGroupTitle}>动态内容</h3>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={feedMilestonesEnabled}
            onChange={(e) => setFeedMilestonesEnabled(e.target.checked)}
          />
          <span>显示最新里程碑/动态</span>
          <input
            type="number"
            min={0}
            max={20}
            value={feedMilestonesMax}
            onChange={(e) => setFeedMilestonesMax(e.target.value)}
            className={styles.numInput}
          />
        </label>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={feedGamesEnabled}
            onChange={(e) => setFeedGamesEnabled(e.target.checked)}
          />
          <span>显示近期比赛</span>
          <input
            type="number"
            min={0}
            max={20}
            value={feedGamesMax}
            onChange={(e) => setFeedGamesMax(e.target.value)}
            className={styles.numInput}
          />
        </label>
      </div>

      <div className={styles.actionRow}>
        <button
          className={styles.btnPrimary}
          type="button"
          onClick={handleSave}
          disabled={!dirty || isSaving}
        >
          保存主页配置
        </button>
      </div>
    </section>
  );
}
