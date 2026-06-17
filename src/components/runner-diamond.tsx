"use client";

import type { RunnerState } from "@/lib/scoreboard-actions";
import type { Player } from "@/lib/workspace";
import styles from "./runner-diamond.module.css";

type RunnerDiamondProps = {
  runners: RunnerState[];
  players: Player[];
  runsScoredInning: number;
};

const BASE_POSITIONS: Record<1 | 2 | 3, { x: number; y: number; label: string }> = {
  1: { x: 78, y: 60, label: "一垒" },
  2: { x: 50, y: 24, label: "二垒" },
  3: { x: 22, y: 60, label: "三垒" },
};

export function RunnerDiamond({ runners, players, runsScoredInning }: RunnerDiamondProps) {
  function getPlayer(id: string): Player | undefined {
    return players.find((p) => p.id === id);
  }

  const runnerOnBase: Record<number, RunnerState | undefined> = { 1: undefined, 2: undefined, 3: undefined };
  for (const r of runners) {
    runnerOnBase[r.base] = r;
  }

  return (
    <div className={styles.container}>
      <svg viewBox="0 0 100 100" className={styles.svg}>
        {/* Base paths */}
        <line x1="50" y1="85" x2="78" y2="60" className={styles.baseLine} />
        <line x1="78" y1="60" x2="50" y2="24" className={styles.baseLine} />
        <line x1="50" y1="24" x2="22" y2="60" className={styles.baseLine} />
        <line x1="22" y1="60" x2="50" y2="85" className={styles.baseLine} />

        {/* Bases */}
        <BaseCircle cx={50} cy={85} label="本" filled={false} />
        {([1, 2, 3] as const).map((base) => {
          const runner = runnerOnBase[base];
          const player = runner ? getPlayer(runner.playerId) : undefined;
          const pos = BASE_POSITIONS[base];
          return (
            <g key={base}>
              <BaseCircle cx={pos.x} cy={pos.y} label={pos.label} filled={!!runner} />
              {player && (
                <>
                  <text
                    x={pos.x}
                    y={pos.y - 7}
                    textAnchor="middle"
                    className={styles.runnerNumber}
                  >
                    #{player.number}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y - 1.5}
                    textAnchor="middle"
                    className={styles.runnerName}
                  >
                    {player.name.length > 3 ? player.name.slice(0, 3) + "…" : player.name}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Inning runs counter */}
      <div className={styles.runsBadge}>
        本局得分: <strong>{runsScoredInning}</strong>
      </div>
    </div>
  );
}

function BaseCircle({ cx, cy, filled, label }: { cx: number; cy: number; filled: boolean; label: string }) {
  return (
    <>
      <circle
        cx={cx}
        cy={cy}
        r={filled ? 6 : 4}
        fill={filled ? "var(--theme-accent)" : "none"}
        stroke={filled ? "var(--theme-accent)" : "var(--theme-muted)"}
        strokeWidth={1}
      />
      <text
        x={cx}
        y={cy + (filled ? 9 : 7.5)}
        textAnchor="middle"
        fill="var(--theme-muted)"
        fontSize="2.6"
        fontWeight={500}
      >
        {label}
      </text>
    </>
  );
}
