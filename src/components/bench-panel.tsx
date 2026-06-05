"use client";

import styles from "@/components/bench-panel.module.css";
import { POSITIONS, type Player, type PositionCode } from "@/lib/workspace";

type BenchPanelProps = {
  players: Player[];
  defense: Record<PositionCode, string | null>;
  lineup: Array<string | null>;
};

export function BenchPanel({ players, defense, lineup }: BenchPanelProps) {
  const defenseSet = new Set(Object.values(defense).filter(Boolean) as string[]);
  const lineupSet = new Set(lineup.filter(Boolean) as string[]);

  return (
    <div className={styles.panel}>
      <p className={styles.title}>全队球员</p>
      <div className={styles.cardList}>
        {players.map((p) => {
          const inDefense = defenseSet.has(p.id);
          const inLineup = lineupSet.has(p.id);
          const isAvailable = p.status === "available";

          // Find which position this player is assigned to
          const defensePos = inDefense
            ? (Object.entries(defense).find(([, id]) => id === p.id)?.[0] as PositionCode | undefined)
            : undefined;
          const lineupIdx = inLineup ? lineup.indexOf(p.id) : -1;

          return (
            <div key={p.id} className={styles.card}>
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
