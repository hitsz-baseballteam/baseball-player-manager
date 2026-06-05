"use client";

import styles from "@/components/scenario-compare.module.css";
import { POSITIONS, type Player, type Scenario } from "@/lib/workspace";

type ScenarioCompareProps = {
  scenarios: Scenario[];
  players: Player[];
  leftId: string | null;
  rightId: string | null;
  onSetLeft: (id: string | null) => void;
  onSetRight: (id: string | null) => void;
};

export function ScenarioCompare({
  scenarios,
  players,
  leftId,
  rightId,
  onSetLeft,
  onSetRight,
}: ScenarioCompareProps) {
  const left = scenarios.find((s) => s.id === leftId) ?? null;
  const right = scenarios.find((s) => s.id === rightId) ?? null;

  function playerName(id: string | null | undefined) {
    if (!id) return "—";
    const p = players.find((pl) => pl.id === id);
    return p
      ? `${p.number} ${p.name}`
      : "—";
  }

  return (
    <div className={styles.compareBoard}>
      {/* Left picker */}
      <div className={styles.pickerRow}>
        <select
          className={styles.pickerSelect}
          value={leftId ?? ""}
          onChange={(e) => onSetLeft(e.target.value || null)}
          aria-label="选择场景 A"
        >
          <option value="">— 选择场景 A —</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <div className={styles.pickerSpacer} />

        <select
          className={styles.pickerSelect}
          value={rightId ?? ""}
          onChange={(e) => onSetRight(e.target.value || null)}
          aria-label="选择场景 B"
        >
          <option value="">— 选择场景 B —</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Two-column comparison */}
      <div className={styles.columns}>
        {/* Left */}
        <div className={styles.column}>
          <h3 className={styles.columnTitle}>{left?.name ?? "场景 A"}</h3>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>守备</h4>
            <table className={styles.table}>
              <tbody>
                {POSITIONS.map((pos) => {
                  const leftPlayer = left?.assignments.defense[pos.code] ?? null;
                  const rightPlayer = right?.assignments.defense[pos.code] ?? null;
                  const diff = leftPlayer !== rightPlayer;

                  return (
                    <tr
                      key={pos.code}
                      className={diff ? styles.rowDiff : ""}
                    >
                      <td className={styles.posLabel}>{pos.label}</td>
                      <td className={styles.posValue}>
                        {playerName(leftPlayer)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>打线</h4>
            <table className={styles.table}>
              <tbody>
                {Array.from({ length: 9 }, (_, i) => {
                  const leftPlayer = left?.assignments.lineup[i] ?? null;
                  const rightPlayer = right?.assignments.lineup[i] ?? null;
                  const diff = leftPlayer !== rightPlayer;

                  return (
                    <tr
                      key={i}
                      className={diff ? styles.rowDiff : ""}
                    >
                      <td className={styles.slotIndex}>{i + 1}</td>
                      <td className={styles.slotValue}>
                        {playerName(leftPlayer)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>

        {/* Right */}
        <div className={styles.column}>
          <h3 className={styles.columnTitle}>{right?.name ?? "场景 B"}</h3>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>守备</h4>
            <table className={styles.table}>
              <tbody>
                {POSITIONS.map((pos) => {
                  const leftPlayer = left?.assignments.defense[pos.code] ?? null;
                  const rightPlayer = right?.assignments.defense[pos.code] ?? null;
                  const diff = leftPlayer !== rightPlayer;

                  return (
                    <tr
                      key={pos.code}
                      className={diff ? styles.rowDiff : ""}
                    >
                      <td className={styles.posLabel}>{pos.label}</td>
                      <td className={styles.posValue}>
                        {playerName(rightPlayer)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>打线</h4>
            <table className={styles.table}>
              <tbody>
                {Array.from({ length: 9 }, (_, i) => {
                  const leftPlayer = left?.assignments.lineup[i] ?? null;
                  const rightPlayer = right?.assignments.lineup[i] ?? null;
                  const diff = leftPlayer !== rightPlayer;

                  return (
                    <tr
                      key={i}
                      className={diff ? styles.rowDiff : ""}
                    >
                      <td className={styles.slotIndex}>{i + 1}</td>
                      <td className={styles.slotValue}>
                        {playerName(rightPlayer)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
