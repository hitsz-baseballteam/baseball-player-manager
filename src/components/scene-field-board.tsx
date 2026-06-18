"use client";

import { useState } from "react";

import { POSITIONS, type Player, type PositionCode } from "@/lib/workspace";
import styles from "./scene-field-board.module.css";

export type SceneFieldBoardProps = {
  players: Player[];
  defense: Record<PositionCode, string | null>;
  onAssign: (position: PositionCode, playerId: string) => void;
  onClear: (position: PositionCode) => void;
  onSwap: (fromPos: PositionCode, toPos: PositionCode) => void;
  dhEnabled?: boolean;
  dhPlayerId?: string | null;
  onDHAssign?: (playerId: string) => void;
  /** When true, clicking positions opens a modal picker instead of calling onAssign directly (for scorecard two-step mode) */
  pickingMode?: boolean;
  pickingLabel?: string;
  onPickingSelect?: (position: PositionCode) => void;
  onPickingCancel?: () => void;
};

const DH_POS = { x: 87, y: 88 };

export function SceneFieldBoard({
  players,
  defense,
  onAssign,
  onClear,
  onSwap,
  dhEnabled,
  dhPlayerId,
  onDHAssign,
  pickingMode,
  pickingLabel,
  onPickingSelect,
  onPickingCancel,
}: SceneFieldBoardProps) {
  const [picker, setPicker] = useState<{ pos: PositionCode; x: number; y: number } | null>(null);
  const [dragOver, setDragOver] = useState<PositionCode | null>(null);

  function getPlayer(id: string | null) { return players.find((p) => p.id === id) ?? null; }

  function handleClick(pos: PositionCode, e: React.MouseEvent) {
    e.stopPropagation();
    if (pickingMode) {
      onPickingSelect?.(pos);
      return;
    }
    setPicker((prev) => (prev?.pos === pos ? null : { pos, x: e.clientX, y: e.clientY }));
  }

  function handlePick(playerId: string) {
    if (!picker) return;
    onAssign(picker.pos, playerId);
    setPicker(null);
  }

  function handleClear() {
    if (!picker) return;
    onClear(picker.pos);
    setPicker(null);
  }

  function handleDrop(pos: PositionCode, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const token = e.dataTransfer.getData("text/plain");
    if (!token) return;
    if (token.startsWith("player:")) {
      onAssign(pos, token.slice("player:".length));
      return;
    }
    if (token.startsWith("defense:")) {
      const fromPos = token.slice("defense:".length) as PositionCode;
      if (fromPos && fromPos !== pos) onSwap(fromPos, pos);
    }
  }

  return (
    <div className={styles.fieldBoard}>
      {pickingMode && pickingLabel && (
        <div className={styles.pickingBanner}>
          {pickingLabel}
          {onPickingCancel && (
            <button type="button" className={styles.pickingCancel} onClick={onPickingCancel}>取消</button>
          )}
        </div>
      )}

      {POSITIONS.map((entry) => {
        const player = getPlayer(defense[entry.code]);
        const hasPlayer = !!player;
        return (
          <button
            key={entry.code}
            type="button"
            draggable={hasPlayer && !pickingMode}
            className={`${styles.posNode} ${dragOver === entry.code ? styles.posNodeDragOver : ""} ${hasPlayer ? styles.posNodeFilled : ""} ${pickingMode ? styles.posNodePicking : ""}`}
            style={{ left: `${entry.x}%`, top: `${entry.y}%` }}
            onClick={(e) => handleClick(entry.code, e)}
            onDragStart={(e) => {
              if (hasPlayer && !pickingMode) e.dataTransfer.setData("text/plain", `defense:${entry.code}`);
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(entry.code); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(entry.code, e)}
            aria-label={`${entry.label}：${player?.name ?? "待补位"}`}
          >
            <span className={styles.posCode}>{entry.code}</span>
            <span className={styles.posPlayer}>
              {player ? (
                <>
                  <strong>{player.number}</strong>
                  <span>{player.name}</span>
                </>
              ) : (
                <span className={styles.posEmpty}>待补位</span>
              )}
            </span>
          </button>
        );
      })}

      {dhEnabled && (
        (() => {
          const dhPlayer = dhPlayerId ? getPlayer(dhPlayerId) : null;
          return (
        <button
          type="button"
          draggable={!!dhPlayer && !pickingMode}
          className={`${styles.posNode} ${styles.dhNode} ${dhPlayer ? styles.posNodeFilled : ""}`}
          style={{ left: `${DH_POS.x}%`, top: `${DH_POS.y}%` }}
          onClick={(e) => {
            if (pickingMode) { onPickingSelect?.("P" as PositionCode); return; }
            handleClick("P" as PositionCode, e);
          }}
          onDragStart={(e) => {
            if (dhPlayer && !pickingMode) e.dataTransfer.setData("text/plain", "defense:DH");
          }}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            const token = e.dataTransfer.getData("text/plain");
            if (token?.startsWith("player:")) onDHAssign?.(token.slice("player:".length));
          }}
          aria-label={`DH：${dhPlayer?.name ?? "待选择"}`}
        >
          <span className={`${styles.posCode} ${styles.dhCode}`}>DH</span>
          <span className={styles.posPlayer}>
            {dhPlayer ? (
              <>
                <strong>{dhPlayer.number}</strong>
                <span>{dhPlayer.name}</span>
              </>
            ) : (
              <span className={styles.posEmpty}>拖入球员</span>
            )}
          </span>
        </button>
          );
        })()
      )}

      {picker && (
        <>
          <div className={styles.pickerBackdrop} onClick={() => setPicker(null)} />
          <div className={styles.picker} style={{ left: picker.x, top: picker.y }}>
            <div className={styles.pickerTitle}>选择{picker.pos}位球员</div>
            <div className={styles.pickerList}>
              {players.filter((p) => p.status === "available").map((p) => (
                <button key={p.id} type="button" className={styles.pickerBtn}
                  onClick={() => handlePick(p.id)}>
                  <span className={styles.pickerNum}>#{p.number}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
            {defense[picker.pos] && (
              <button type="button" className={styles.pickerClear} onClick={handleClear}>
                清空此位置
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
