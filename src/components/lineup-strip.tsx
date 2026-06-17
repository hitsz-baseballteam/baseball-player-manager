"use client";

import type { Player } from "@/lib/workspace";
import styles from "./lineup-strip.module.css";

type LineupStripProps = {
  lineup: Array<string | null>;
  currentBatterIndex: number;
  players: Player[];
};

export function LineupStrip({ lineup, currentBatterIndex, players }: LineupStripProps) {
  function getPlayer(id: string | null): Player | undefined {
    if (!id) return undefined;
    return players.find((p) => p.id === id);
  }

  return (
    <div className={styles.strip}>
      {lineup.map((playerId, i) => {
        const player = getPlayer(playerId);
        const isCurrent = i === currentBatterIndex;
        const hasBatted = i < currentBatterIndex;

        return (
          <div
            key={i}
            className={`${styles.slot} ${isCurrent ? styles.slotActive : ""} ${hasBatted && !isCurrent ? styles.slotBatted : ""}`}
            title={player ? `${player.name} #${player.number}` : `第${i + 1}棒 (空)`}
          >
            <span className={styles.slotIndex}>{i + 1}</span>
            {player ? (
              <>
                <span className={styles.slotNumber}>#{player.number}</span>
                <span className={styles.slotName}>{player.name}</span>
              </>
            ) : (
              <span className={styles.slotEmpty}>空</span>
            )}
            {isCurrent && <span className={styles.currentIndicator}>◀</span>}
          </div>
        );
      })}
    </div>
  );
}
