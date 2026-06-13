"use client";

import styles from "@/components/player-profile-editor.module.css";

export function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  index: number,
  total: number,
) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
}

export function RadarChart({
  values,
}: {
  values: Array<{ label: string; value: number | null }>;
}) {
  const center = 150;
  const gridRadius = 102;
  const dataRadius = 96;
  const levels = [20, 35, 50, 65, 80];
  const n = values.length;

  const axisPoints = values.map((_, i) =>
    polarToCartesian(center, center, gridRadius, i, n),
  );

  const polygonPoints = values.map((item, i) => {
    const norm = item.value === null ? 0.1 : (item.value - 20) / 60;
    return polarToCartesian(center, center, dataRadius * Math.max(norm, 0.1), i, n);
  });

  const hasData = values.some((v) => v.value !== null);

  return (
    <svg
      viewBox="0 0 300 300"
      role="img"
      aria-label="球员六维能力图"
      className={styles.chartSvg}
    >
      <defs>
        <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--profile-bg)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--profile-bg)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="data-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--profile-accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--profile-accent-strong)" stopOpacity="0.10" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background circle */}
      <circle
        cx={center}
        cy={center}
        r={gridRadius + 4}
        fill="var(--profile-bg)"
        stroke="none"
      />

      {/* Grid rings */}
      {levels.map((level) => {
        const r = gridRadius * ((level - 20) / 60);
        const pts = values
          .map((_, i) => polarToCartesian(center, center, r, i, n))
          .map((p) => `${p.x},${p.y}`)
          .join(" ");
        return (
          <polygon
            key={level}
            points={pts}
            fill="none"
            stroke="var(--profile-grid-line)"
            strokeWidth={level === 80 ? "0.8" : "0.5"}
            opacity={level === 80 ? "0.6" : "0.35"}
          />
        );
      })}

      {/* Axis spokes */}
      {axisPoints.map((pt, i) => (
        <line
          key={`axis-${i}`}
          x1={center}
          y1={center}
          x2={pt.x}
          y2={pt.y}
          stroke="var(--profile-grid-line)"
          strokeWidth="0.5"
          opacity="0.5"
        />
      ))}

      {/* Axis labels */}
      {axisPoints.map((pt, i) => {
        const labelR = gridRadius + 16;
        const lp = polarToCartesian(center, center, labelR, i, n);
        return (
          <text
            key={`label-${i}`}
            x={lp.x}
            y={lp.y}
            fill="var(--profile-text-muted)"
            fontSize="10.5"
            fontWeight="600"
            textAnchor="middle"
            dominantBaseline="middle"
            letterSpacing="0.02em"
          >
            {values[i].label}
          </text>
        );
      })}

      {/* Data polygon + dots */}
      {hasData && (
        <>
          <polygon
            points={polygonPoints.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="url(#data-fill)"
            stroke="var(--profile-accent)"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#glow)"
          />
          {polygonPoints.map((p, i) => (
            <circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="var(--theme-surface)"
              stroke="var(--profile-accent)"
              strokeWidth="1.5"
            />
          ))}
        </>
      )}

      {/* Center accent */}
      <circle
        cx={center}
        cy={center}
        r="3"
        fill="var(--profile-accent-strong)"
        opacity="0.6"
      />
      <circle
        cx={center}
        cy={center}
        r="1.5"
        fill="var(--profile-accent-strong)"
      />
    </svg>
  );
}
