"use client";

import type { RunnerState } from "@/lib/scoreboard-actions";
import styles from "./opponent-base-diamond.module.css";

type OpponentBaseDiamondProps = {
  runners: RunnerState[];
};

/** Compact diamond showing occupied bases for opponent — no player names. */
export function OpponentBaseDiamond({ runners }: OpponentBaseDiamondProps) {
  const occupied = new Set(runners.map((r) => r.base));

  return (
    <div className={styles.container}>
      <svg viewBox="0 0 100 100" className={styles.svg}>
        {/* Base paths */}
        <line x1="50" y1="82" x2="75" y2="58" className={styles.line} />
        <line x1="75" y1="58" x2="50" y2="28" className={styles.line} />
        <line x1="50" y1="28" x2="25" y2="58" className={styles.line} />
        <line x1="25" y1="58" x2="50" y2="82" className={styles.line} />

        {/* Home */}
        <circle cx="50" cy="82" r="4" fill="none" stroke="var(--theme-muted)" strokeWidth="1" />
        <text x="50" y="90" textAnchor="middle" fill="var(--theme-muted)" fontSize="3" fontWeight="500">本</text>

        {/* 1B */}
        <circle cx="75" cy="58" r={occupied.has(1) ? 5 : 3.5}
          fill={occupied.has(1) ? "var(--theme-accent)" : "none"}
          stroke={occupied.has(1) ? "var(--theme-accent)" : "var(--theme-muted)"}
          strokeWidth="1" />
        <text x="75" y={occupied.has(1) ? 66 : 64} textAnchor="middle"
          fill={occupied.has(1) ? "var(--theme-accent)" : "var(--theme-muted)"}
          fontSize="3" fontWeight="600">一</text>

        {/* 2B */}
        <circle cx="50" cy="28" r={occupied.has(2) ? 5 : 3.5}
          fill={occupied.has(2) ? "var(--theme-accent)" : "none"}
          stroke={occupied.has(2) ? "var(--theme-accent)" : "var(--theme-muted)"}
          strokeWidth="1" />
        <text x="50" y={occupied.has(2) ? 21 : 19} textAnchor="middle"
          fill={occupied.has(2) ? "var(--theme-accent)" : "var(--theme-muted)"}
          fontSize="3" fontWeight="600">二</text>

        {/* 3B */}
        <circle cx="25" cy="58" r={occupied.has(3) ? 5 : 3.5}
          fill={occupied.has(3) ? "var(--theme-accent)" : "none"}
          stroke={occupied.has(3) ? "var(--theme-accent)" : "var(--theme-muted)"}
          strokeWidth="1" />
        <text x="25" y={occupied.has(3) ? 66 : 64} textAnchor="middle"
          fill={occupied.has(3) ? "var(--theme-accent)" : "var(--theme-muted)"}
          fontSize="3" fontWeight="600">三</text>
      </svg>
    </div>
  );
}
