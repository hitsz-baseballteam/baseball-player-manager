"use client";

import { useState } from "react";

import styles from "@/components/bench-panel.module.css";
import { POSITIONS, type Player, type PositionCode } from "@/lib/workspace";

type BenchPanelProps = {
  players: Player[];
  defense: Record<PositionCode, string | null>;
  lineup: Array<string | null>;
  /** IDs to exclude (already on field: defense players + DH) */
  excludeIds?: string[];
};

export function BenchPanel({ players, defense, lineup, excludeIds = [] }: BenchPanelProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const defenseSet = new Set(Object.values(defense).filter(Boolean) as string[]);
  const lineupSet = new Set(lineup.filter(Boolean) as string[]);
  const excludeSet = new Set(excludeIds);

  // Only show: available players NOT already on the field
  const benchPlayers = players.filter((p) => {
    if (p.status !== "available") return false;
    if (defenseSet.has(p.id)) return false;
    if (excludeSet.has(p.id)) return false;
    return true;
  });

  return (
    <div
      className={styles.panel}
      onDragOver={(e) => {
        const types = e.dataTransfer.types;
        if (types.includes("text/plain")) e.preventDefault();
      }}
      onDrop={() => {}}
    >
      <p className={styles.title}>替补球员</p>
      <div className={styles.cardList}>
        {benchPlayers.length === 0 ? (
          <p className={styles.empty}>无替补球员</p>
        ) : (
          benchPlayers.map((p) => {
            const isAvailable = p.status === "available";
            return (
              <div
                key={p.id}
                className={`${styles.card} ${dragOverId === p.id ? styles.cardDropActive : ""} ${dragFrom === p.id ? styles.cardDragging : ""}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", `player:${p.id}`);
                  e.dataTransfer.effectAllowed = "move";
                  setDragFrom(p.id);
                }}
                onDragEnd={() => { setDragFrom(null); setDragOverId(null); }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(p.id); }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => { e.preventDefault(); setDragOverId(null); }}
                role="listitem"
                aria-label={`${p.name} #${p.number}`}
              >
                <span className={styles.badge}>{p.number}</span>
                <div className={styles.info}>
                  <div className={styles.name}>{p.name}</div>
                  <div className={styles.meta}>
                    <span className={`${styles.tag} ${styles.tagMuted}`}>替补</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
