"use client";

import styles from "@/components/scenario-list.module.css";
import { formatDateTime, type Scenario } from "@/lib/workspace";

type ScenarioWarnings = {
  critical: number;
  advisory: number;
};

type ScenarioListProps = {
  scenarios: Scenario[];
  activeScenarioId: string;
  scenarioWarnings: Map<string, ScenarioWarnings>;
  onSetActive: (id: string) => void;
  onRename: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ScenarioList({
  scenarios,
  activeScenarioId,
  scenarioWarnings,
  onSetActive,
  onRename,
  onCopy,
  onDelete,
}: ScenarioListProps) {
  return (
    <div className={styles.list}>
      {scenarios.map((s) => {
        const isActive = s.id === activeScenarioId;
        const warnings = scenarioWarnings.get(s.id);
        const defenseFilled = warnings ? warnings.critical === 0 : true;
        const lineupFilled =
          s.assignments.lineup.filter(Boolean).length === 9;

        return (
          <article
            key={s.id}
            className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
          >
            <div className={styles.cardMain}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardName}>{s.name}</h3>
                {isActive && <span className={styles.activeBadge}>当前</span>}
              </div>

              {s.note && <p className={styles.cardNote}>{s.note}</p>}

              <div className={styles.cardMeta}>
                <span className={styles.cardTime}>
                  {formatDateTime(s.updatedAt)}
                </span>
              </div>

              <div className={styles.cardStats}>
                <span
                  className={`${styles.statChip} ${defenseFilled ? styles.statOk : styles.statWarn}`}
                >
                  守备 {defenseFilled ? "✓" : warnings?.critical ?? 0}
                </span>
                <span
                  className={`${styles.statChip} ${lineupFilled ? styles.statOk : styles.statEmpty}`}
                >
                  打线 {lineupFilled ? "✓" : s.assignments.lineup.filter(Boolean).length + "/9"}
                </span>
              </div>
            </div>

            <div className={styles.cardActions}>
              {!isActive && (
                <button
                  className={styles.cardBtn}
                  onClick={() => onSetActive(s.id)}
                  type="button"
                >
                  切换
                </button>
              )}
              <button
                className={styles.cardBtn}
                onClick={() => onRename(s.id)}
                type="button"
              >
                重命名
              </button>
              <button
                className={styles.cardBtn}
                onClick={() => onCopy(s.id)}
                type="button"
              >
                复制
              </button>
              <button
                className={`${styles.cardBtn} ${styles.cardBtnDanger}`}
                onClick={() => onDelete(s.id)}
                disabled={scenarios.length <= 1}
                type="button"
              >
                删除
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
