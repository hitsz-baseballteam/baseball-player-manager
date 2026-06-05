"use client";

import { useEffect, useRef, useState } from "react";

import styles from "@/components/lineup-order.module.css";
import { type Player } from "@/lib/workspace";

type PickerState = {
  index: number;
  x: number;
  y: number;
} | null;

type LineupOrderProps = {
  players: Player[];
  lineup: Array<string | null>;
  onAssign: (index: number, playerId: string) => void;
  onClear: (index: number) => void;
};

export function LineupOrder({ players, lineup, onAssign, onClear }: LineupOrderProps) {
  const [picker, setPicker] = useState<PickerState>(null);

  function handleSlotClick(index: number, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPicker((prev) =>
      prev?.index === index ? null : { index, x: rect.left, y: rect.bottom + 4 },
    );
  }

  function handlePick(playerId: string) {
    if (picker === null) return;
    onAssign(picker.index, playerId);
    setPicker(null);
  }

  function handleClear() {
    if (picker === null) return;
    onClear(picker.index);
    setPicker(null);
  }

  const availablePlayers = players.filter((p) => p.status === "available");

  return (
    <div className={styles.panel}>
      <p className={styles.title}>打线顺序</p>
      <ol className={styles.slotList}>
        {Array.from({ length: 9 }, (_, i) => {
          const playerId = lineup[i] ?? null;
          const player = playerId ? players.find((p) => p.id === playerId) : null;
          return (
            <li key={i}>
              <div
                className={styles.slot}
                onClick={(e) => handleSlotClick(i, e)}
                role="button"
                aria-label={`第 ${i + 1} 棒${player ? `：${player.name}` : "：空"}`}
              >
                <span className={styles.slotIndex}>{i + 1}</span>
                {player ? (
                  <>
                    <span className={styles.slotBadge}>{player.number}</span>
                    <span className={styles.slotName}>{player.name}</span>
                  </>
                ) : (
                  <span className={styles.slotEmpty}>空</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {picker !== null && (
        <>
          <div className={styles.pickerBackdrop} onClick={() => setPicker(null)} />
          <LineupPicker
            index={picker.index}
            anchorX={picker.x}
            anchorY={picker.y}
            players={availablePlayers}
            currentId={lineup[picker.index]}
            onPick={handlePick}
            onClear={handleClear}
          />
        </>
      )}
    </div>
  );
}

type LineupPickerProps = {
  index: number;
  anchorX: number;
  anchorY: number;
  players: Player[];
  currentId: string | null | undefined;
  onPick: (playerId: string) => void;
  onClear: () => void;
};

function LineupPicker({
  index,
  anchorX,
  anchorY,
  players,
  currentId,
  onPick,
  onClear,
}: LineupPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      el.style.left = `${anchorX - rect.width + 200}px`;
    }
    if (rect.bottom > window.innerHeight - 8) {
      el.style.top = `${anchorY - rect.height - 44}px`;
    }
  }, [anchorX, anchorY]);

  return (
    <div
      ref={ref}
      className={styles.picker}
      style={{ top: anchorY, left: anchorX }}
      role="menu"
      aria-label={`选择第 ${index + 1} 棒球员`}
    >
      <div className={styles.pickerHeader}>第 {index + 1} 棒</div>
      {players.map((p) => (
        <button
          key={p.id}
          className={`${styles.pickerItem} ${p.id === currentId ? styles.pickerItemActive : ""}`}
          onClick={() => onPick(p.id)}
          type="button"
        >
          <span className={styles.pickerBadge}>{p.number}</span>
          {p.name}
        </button>
      ))}
      {currentId && (
        <button
          className={`${styles.pickerItem} ${styles.pickerItemClear}`}
          onClick={onClear}
          type="button"
        >
          清空此棒次
        </button>
      )}
    </div>
  );
}
