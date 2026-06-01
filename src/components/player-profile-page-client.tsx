"use client";

import { useState } from "react";

import { PlayerProfileEditor } from "@/components/player-profile-editor";
import {
  cloneWorkspace,
  sanitizeWorkspace,
  type Player,
  type Workspace,
} from "@/lib/workspace";
import {
  isVersionConflict,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
} from "@/lib/workspace-client";

type PlayerProfilePageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
  playerId: string;
};

export function PlayerProfilePageClient(
  props: PlayerProfilePageClientProps,
) {
  const [workspace, setWorkspace] = useState(() =>
    sanitizeWorkspace(props.initialWorkspace),
  );
  const [version, setVersion] = useState(props.initialVersion);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("球员档案已连接共享工作区");

  const player =
    workspace.players.find((item) => item.id === props.playerId) ?? null;

  async function handleSave(nextPlayer: Player) {
    const nextWorkspace = cloneWorkspace(workspace);
    const index = nextWorkspace.players.findIndex(
      (item) => item.id === nextPlayer.id,
    );

    if (index < 0) {
      setStatusMessage("球员不存在，无法保存");
      return;
    }

    nextWorkspace.players[index] = nextPlayer;
    setSaving(true);
    setStatusMessage("正在同步球员档案...");

    try {
      const result = await saveWorkspaceSnapshot(nextWorkspace, version);
      setWorkspace(sanitizeWorkspace(result.workspace));
      setVersion(result.version);
      setStatusMessage("球员档案已同步到云端");
    } catch (error) {
      if (isVersionConflict(error)) {
        const latest = await loadWorkspaceSnapshot();
        setWorkspace(sanitizeWorkspace(latest.workspace));
        setVersion(latest.version);
        setStatusMessage("工作区已被其他会话更新，当前页面已刷新最新数据");
      } else {
        console.error(error);
        setStatusMessage("保存失败，请稍后重试");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlayerProfileEditor
      player={player}
      variant="page"
      saving={saving}
      statusMessage={statusMessage}
      backHref="/"
      onSave={handleSave}
    />
  );
}
