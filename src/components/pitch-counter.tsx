"use client";

import styles from "./pitch-counter.module.css";

type PitchCounterProps = {
  balls: number;
  strikes: number;
  outs: number;
  onBall: () => void;
  onStrike: () => void;
  onResetCount: () => void;
  pitcherName: string | null;
  pitcherNumber: string | null;
  disabled?: boolean;
};

export function PitchCounter({
  balls,
  strikes,
  outs,
  onBall,
  onStrike,
  onResetCount,
  pitcherName,
  pitcherNumber,
  disabled = false,
}: PitchCounterProps) {
  return (
    <div className={`${styles.panel} ${disabled ? styles.disabled : ""}`}>
      {/* Pitcher info */}
      <div className={styles.pitcherRow}>
        <span className={styles.pitcherLabel}>投手</span>
        <span className={styles.pitcherName}>
          {pitcherName ?? "—"}
          {pitcherNumber && <span className={styles.pitcherNum}>#{pitcherNumber}</span>}
        </span>
      </div>

      {/* Balls / Strikes / Outs display */}
      <div className={styles.countRow}>
        {/* Balls */}
        <div className={styles.countGroup}>
          <span className={styles.countLabel}>B</span>
          <div className={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={`b-${i}`}
                className={`${styles.dot} ${i < balls ? styles.dotBall : styles.dotEmpty}`}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.countBtn}
            disabled={disabled || balls >= 4}
            onClick={onBall}
            title="坏球 +1"
          >
            +
          </button>
        </div>

        {/* Strikes */}
        <div className={styles.countGroup}>
          <span className={styles.countLabel}>S</span>
          <div className={styles.dots}>
            {[0, 1, 2].map((i) => (
              <span
                key={`s-${i}`}
                className={`${styles.dot} ${i < strikes ? styles.dotStrike : styles.dotEmpty}`}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.countBtn}
            disabled={disabled || strikes >= 3}
            onClick={onStrike}
            title="好球 +1"
          >
            +
          </button>
        </div>

        {/* Outs */}
        <div className={styles.countGroup}>
          <span className={styles.countLabel}>Out</span>
          <div className={styles.dots}>
            {[0, 1, 2].map((i) => (
              <span
                key={`o-${i}`}
                className={`${styles.dot} ${i < outs ? styles.dotOut : styles.dotEmpty}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Auto-status indicators */}
      <div className={styles.statusRow}>
        {balls >= 4 && (
          <span className={styles.statusAlert}>四坏球保送！</span>
        )}
        {strikes >= 3 && (
          <span className={styles.statusAlert}>三振！</span>
        )}
      </div>

      {/* Reset count button (after each PA) */}
      <button
        type="button"
        className={styles.resetBtn}
        disabled={disabled || (balls === 0 && strikes === 0)}
        onClick={onResetCount}
      >
        重置球数
      </button>
    </div>
  );
}
