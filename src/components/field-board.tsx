"use client";

import { useEffect, useRef, useState } from "react";

import styles from "@/components/field-board.module.css";
import { POSITIONS, type Player, type PositionCode } from "@/lib/workspace";

type PickerState = {
  position: PositionCode;
  x: number;
  y: number;
} | null;

type FieldBoardProps = {
  players: Player[];
  defense: Record<PositionCode, string | null>;
  onAssign: (position: PositionCode, playerId: string) => void;
  onClear: (position: PositionCode) => void;
  onSwap: (fromPos: PositionCode, toPos: PositionCode) => void;
};

export function FieldBoard({ players, defense, onAssign, onClear, onSwap }: FieldBoardProps) {
  const [picker, setPicker] = useState<PickerState>(null);
  const [dragOverPos, setDragOverPos] = useState<PositionCode | null>(null);
  const [dragSourcePos, setDragSourcePos] = useState<PositionCode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Click picker ──
  function handlePositionClick(pos: PositionCode, svgX: number, svgY: number) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = rect.left + (svgX / 100) * rect.width;
    const y = rect.top + (svgY / 100) * rect.height;
    setPicker((prev) => (prev?.position === pos ? null : { position: pos, x, y }));
  }

  function handlePick(playerId: string) {
    if (!picker) return;
    onAssign(picker.position, playerId);
    setPicker(null);
  }

  function handleClear() {
    if (!picker) return;
    onClear(picker.position);
    setPicker(null);
  }

  useEffect(() => {
    if (!picker) return;
    const onResize = () => setPicker(null);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [picker]);

  function clearDragState() {
    setDragOverPos(null);
    setDragSourcePos(null);
  }

  // ── Drop handler shared across all positions ──
  // ── Drop handler shared across all positions ──
  function handleDrop(targetPos: PositionCode, e: React.DragEvent) {
    e.preventDefault();
    const token = e.dataTransfer.getData("text/plain");
    clearDragState();
    if (!token) return;
    if (token.startsWith("player:")) {
      const playerId = token.slice("player:".length);
      onAssign(targetPos, playerId);
    } else if (token.startsWith("defense:")) {
      const fromPos = token.slice("defense:".length) as PositionCode;
      if (fromPos !== targetPos) {
        onSwap(fromPos, targetPos);
      }
    }
  }

  const availablePlayers = players.filter((p) => p.status === "available");

  return (
    <div className={styles.fieldWrapper}>
      <div ref={containerRef} className={styles.fieldContainer}>
        {/* SVG field diagram */}
        <svg
          className={styles.fieldSvg}
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          aria-label="守备位置图"
        >
          <path className={styles.fieldGrass} d="M50,96 L8,96 L8,8 Q50,2 92,8 L92,96 Z" />
          <polygon className={styles.fieldDirt} points="50,58 68,72 50,92 32,72" />
          <line className={styles.fieldLine} x1="50" y1="96" x2="10" y2="10" />
          <line className={styles.fieldLine} x1="50" y1="96" x2="90" y2="10" />
          <polygon className={styles.fieldLine} points="50,58 68,72 50,86 32,72" />
          <circle className={styles.fieldLine} cx="50" cy="70" r="3.5" />
          <path className={styles.fieldLine} d="M12,88 Q50,10 88,88" />

          {POSITIONS.map((pos) => {
            const assignedId = defense[pos.code] ?? null;
            const assignedPlayer = assignedId ? players.find((p) => p.id === assignedId) : null;
            const isAssigned = !!assignedPlayer;
            const isWarn = isAssigned && assignedPlayer && !assignedPlayer.positions.includes(pos.code);
            const isDragging = dragSourcePos === pos.code;
            const isDropActive = dragOverPos === pos.code;
            const r = 5.5;

            return (
              <g key={pos.code}
                className={`${isDragging ? styles.posNodeDragging : ""} ${isDropActive ? styles.posNodeDropActive : ""}`}
              >
                <circle
                  cx={pos.x} cy={pos.y} r={r}
                  className={`${styles.posCircle} ${isAssigned ? styles.posCircleAssigned : ""} ${isWarn ? styles.posCircleWarn : ""}`}
                />
                {isAssigned && assignedPlayer ? (
                  <>
                    <text x={pos.x} y={pos.y - 1.2} className={styles.posPlayerNumber} style={{ pointerEvents: "none" }}>
                      {assignedPlayer.number}
                    </text>
                    <text x={pos.x} y={pos.y + 2.2} className={styles.posPlayerName} style={{ pointerEvents: "none" }}>
                      {assignedPlayer.name.slice(0, 4)}
                    </text>
                  </>
                ) : (
                  <text x={pos.x} y={pos.y} className={styles.posLabel} style={{ pointerEvents: "none" }}>
                    {pos.code}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* HTML overlay for drag-and-drop — absolutely positioned over each position circle */}
        {POSITIONS.map((pos) => {
          const assignedId = defense[pos.code] ?? null;
          const assignedPlayer = assignedId ? players.find((p) => p.id === assignedId) : null;
          const isAssigned = !!assignedPlayer;
          const isDragging = dragSourcePos === pos.code;
          const isDropActive = dragOverPos === pos.code;

          // Position the overlay at the SVG coordinate percentage
          return (
            <div
              key={`dnd-${pos.code}`}
              className={`${styles.dndOverlay} ${isDragging ? styles.dndOverlayDragging : ""} ${isDropActive ? styles.dndOverlayDropActive : ""}`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
              draggable={isAssigned}
              onClick={(e) => {
                e.stopPropagation();
                handlePositionClick(pos.code, pos.x, pos.y);
              }}
              onDragStart={(e) => {
                if (!isAssigned) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData("text/plain", `defense:${pos.code}`);
                e.dataTransfer.effectAllowed = "move";
                setDragSourcePos(pos.code);
              }}
              onDragEnd={() => {
                clearDragState();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverPos(pos.code);
              }}
              onDragLeave={() => {
                if (dragOverPos === pos.code) setDragOverPos(null);
              }}
              onDrop={(e) => {
                handleDrop(pos.code, e);
              }}
              role="button"
              aria-label={`${pos.label}${isAssigned ? `：${assignedPlayer?.name}` : "：空"}`}
            />
          );
        })}
      </div>

      {/* Player picker */}
      {picker && (
        <>
          <div className={styles.pickerBackdrop} onClick={() => setPicker(null)} />
          <PlayerPicker
            position={picker.position}
            anchorX={picker.x}
            anchorY={picker.y}
            players={availablePlayers}
            currentId={defense[picker.position]}
            onPick={handlePick}
            onClear={handleClear}
          />
        </>
      )}
    </div>
  );
}

type PlayerPickerProps = {
  position: PositionCode;
  anchorX: number;
  anchorY: number;
  players: Player[];
  currentId: string | null | undefined;
  onPick: (playerId: string) => void;
  onClear: () => void;
};

function PlayerPicker({
  position,
  anchorX,
  anchorY,
  players,
  currentId,
  onPick,
  onClear,
}: PlayerPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      el.style.left = `${anchorX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight - 8) {
      el.style.top = `${anchorY - rect.height}px`;
    }
  }, [anchorX, anchorY]);

  const POSITION_LABELS: Record<string, string> = {
    P: "投手", C: "捕手", "1B": "一垒", "2B": "二垒",
    "3B": "三垒", SS: "游击", LF: "左外", CF: "中外", RF: "右外",
  };

  return (
    <div
      ref={ref}
      className={styles.picker}
      style={{ top: anchorY + 8, left: anchorX - 8 }}
      role="menu"
      aria-label={`选择${POSITION_LABELS[position] ?? position}守备球员`}
    >
      <div className={styles.pickerHeader}>{POSITION_LABELS[position] ?? position}</div>
      {players.map((p) => {
        const isActive = p.id === currentId;
        const isWarn = !p.positions.includes(position);
        return (
          <button
            key={p.id}
            className={`${styles.pickerItem} ${isActive ? styles.pickerItemActive : ""}`}
            onClick={() => onPick(p.id)}
            type="button"
          >
            <span className={styles.pickerBadge}>{p.number}</span>
            {p.name}
            {isWarn && <span className={styles.pickerWarn}>非惯用</span>}
          </button>
        );
      })}
      {currentId && (
        <button className={`${styles.pickerItem} ${styles.pickerItemClear}`} onClick={onClear} type="button">
          清空此位置
        </button>
      )}
    </div>
  );
}
