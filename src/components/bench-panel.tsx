"use client";

import { useState } from "react";

import styles from "@/components/bench-panel.module.css";
import { POSITIONS, type Player, type PositionCode } from "@/lib/workspace";

type BenchPanelProps = {
  players: Player[];
  defense: Record<PositionCode, string | null>;
  lineup: Array<string | null>;
};

export function BenchPanel({ players, defense, lineup }: BenchPanelProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const defenseSet = new Set(Object.values(defense).filter(Boolean) as string[]);
  const lineupSet = new Set(lineup.filter(Boolean) as string[]);

  return (
    <div
      className={styles.panel}
      onDragOver={(e) => {
        // Accept drops from field/lineup that are returning a player to bench
        const types = e.dataTransfer.types;
        if (types.includes("text/plain")) {
          e.preventDefault();
        }
      }}
      onDrop={() => {
        // Drops onto the panel itself (not a card) are no-ops — 
        // only individual cards receive "return to bench" drops
      }}
    >
      <p className={styles.title}>全队球员</p>
      <div className={styles.cardList}>
        {players.map((p) => {
          const inDefense = defenseSet.has(p.id);
          const inLineup = lineupSet.has(p.id);
          const isAvailable = p.status === "available";

          const defensePos = inDefense
            ? (Object.entries(defense).find(([, id]) => id === p.id)?.[0] as PositionCode | undefined)
            : undefined;
          const lineupIdx = inLineup ? lineup.indexOf(p.id) : -1;

          return (
            <div
              key={p.id}
              className={`${styles.card} ${dragOverId === p.id ? styles.cardDropActive : ""} ${dragFrom === p.id ? styles.cardDragging : ""}`}
              draggable={isAvailable}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", `player:${p.id}`);
                e.dataTransfer.effectAllowed = "move";
                setDragFrom(p.id);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOverId(null);
              }}
              onDragOver={(e) => {
                // Accept drops from field/lineup — put this player "back on bench"
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverId(p.id);
              }}
              onDragLeave={() => {
                setDragOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverId(null);
                // The actual clearing logic is handled by the FieldBoard/LineupOrder
                // drop handlers when they detect the bench target.  We just allow the drop
                // so the browser doesn't show a "blocked" cursor.
                // The drop event on the originating component handles the action.
              }}
              role="listitem"
              aria-label={`${p.name} #${p.number}`}
            >
              <span className={`${styles.badge} ${isAvailable ? styles.badgeAvailable : ""}`}>
                {p.number}
              </span>
              <div className={styles.info}>
                <div className={styles.name}>{p.name}</div>
                <div className={styles.meta}>
                  {defensePos && (
                    <span className={styles.tag}>
                      {POSITIONS.find((pos) => pos.code === defensePos)?.label ?? defensePos}
                    </span>
                  )}
                  {inLineup && lineupIdx >= 0 && (
                    <span className={styles.tag}>第 {lineupIdx + 1} 棒</span>
                  )}
                  {!inDefense && !inLineup && isAvailable && (
                    <span className={`${styles.tag} ${styles.tagMuted}`}>待分配</span>
                  )}
                  {p.status === "rest" && (
                    <span className={`${styles.tag} ${styles.tagMuted}`}>轮休</span>
                  )}
                  {p.status === "injured" && (
                    <span className={`${styles.tag} ${styles.tagWarn}`}>伤停</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
