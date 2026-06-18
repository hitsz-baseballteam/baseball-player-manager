"use client";

import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { PlayerProfileEditor } from "@/components/player-profile-editor";
import {
  cloneWorkspace,
  type Player,
  type Workspace,
} from "@/lib/workspace";
import {
  isVersionConflict,
  updatePlayer,
} from "@/lib/workspace-client";
import { useWorkspaceSnapshot } from "@/lib/use-workspace-snapshot";
import { panelNavItems, PANEL_ROUTES } from "@/lib/routes";

const NAV_ITEMS = panelNavItems("名册");

type PlayerProfilePageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
  playerId: string;
};

export function PlayerProfilePageClient(
  props: PlayerProfilePageClientProps,
) {
  const { workspace, version, applySnapshot, refreshWorkspace } =
    useWorkspaceSnapshot(props.initialWorkspace, props.initialVersion);
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
      const result = await updatePlayer(nextPlayer, version);
      applySnapshot(result);
      setStatusMessage("球员档案已同步到云端");
    } catch (error) {
      if (isVersionConflict(error)) {
        await refreshWorkspace();
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
    <AppShell
      eyebrow="球员档案"
      title={player ? player.name : "球员档案"}
      description={
        player
          ? `#${player.number} · ${player.positions.join(" / ") || "待定守位"}`
          : "当前链接没有对应球员，或该球员已从共享工作区移除。"
      }
      statusLabel="工作区"
      statusValue={`v${version}`}
      statusMeta={statusMessage}
      navItems={NAV_ITEMS.map((item) => ({ ...item }))}
      content={
        <PlayerProfileEditor
          key={
            player
              ? `${player.id}:${version}`
              : `missing:${props.playerId}:${version}`
          }
          player={player}
          variant="page"
          pageSurface="embedded"
          saving={saving}
          statusMessage={statusMessage}
          backHref={PANEL_ROUTES.roster}
          onSave={handleSave}
        />
      }
    />
  );
}
