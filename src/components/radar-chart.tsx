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

/** Build a smooth closed path through points using Catmull-Rom → cubic Bézier. */
function smoothClosedPath(
  pts: { x: number; y: number }[],
  tension = 0.3,
): string {
  const n = pts.length;
  if (n < 3) return "";

  const segments: string[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];

    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3;

    if (i === 0) segments.push(`M${p1.x},${p1.y}`);
    segments.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  segments.push("Z");
  return segments.join(" ");
}

export function RadarChart({
  values,
}: {
  values: Array<{ label: string; value: number | null }>;
}) {
  const cx = 150;
  const cy = 150;
  const R = 100;
  const n = values.length;

  /* Concentric circle radii for 20/40/60/80 scale */
  const rings = [
    { r: R * 0.25, label: "20" },
    { r: R * 0.5, label: "40" },
    { r: R * 0.75, label: "60" },
    { r: R, label: "80" },
  ];

  const axisAngles = Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { a, dx: Math.cos(a), dy: Math.sin(a) };
  });

  const dataPoints = values.map((item, i) => {
    const frac =
      item.value === null ? 0 : Math.max(0, (item.value - 20) / 60);
    const r = R * frac;
    return {
      x: cx + r * axisAngles[i].dx,
      y: cy + r * axisAngles[i].dy,
      value: item.value,
    };
  });

  const hasData = values.some((v) => v.value !== null);
  const smoothPath = hasData ? smoothClosedPath(dataPoints) : "";

  return (
    <svg
      viewBox="0 0 300 300"
      role="img"
      aria-label="球员六维能力图"
      className={styles.chartSvg}
    >
      <defs>
        {/* Radial fill gradient */}
        <radialGradient id="rc-fill" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="var(--theme-accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--theme-accent)" stopOpacity="0.06" />
        </radialGradient>
        {/* Soft inner shadow for depth */}
        <filter id="rc-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="3"
            floodColor="var(--theme-accent)"
            floodOpacity="0.18"
          />
        </filter>
      </defs>

      {/* --- Background --- */}
      <circle
        cx={cx}
        cy={cy}
        r={R + 2}
        fill="var(--theme-surface)"
        stroke="none"
      />

      {/* --- Concentric grid circles --- */}
      {rings.map(({ r }) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--profile-grid-line)"
          strokeWidth="0.6"
        />
      ))}

      {/* --- Axis spokes --- */}
      {axisAngles.map(({ dx, dy }, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + R * dx}
          y2={cy + R * dy}
          stroke="var(--profile-axis-line)"
          strokeWidth="0.6"
        />
      ))}

      {/* --- Data shape --- */}
      {hasData && (
        <>
          <path
            d={smoothPath}
            fill="url(#rc-fill)"
            stroke="var(--theme-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            filter="url(#rc-shadow)"
          />

          {/* Data point markers */}
          {dataPoints.map((pt, i) => (
            <g key={`marker-${i}`}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r="5"
                fill="var(--theme-surface)"
                stroke="var(--theme-accent)"
                strokeWidth="1.8"
              />
              <circle
                cx={pt.x}
                cy={pt.y}
                r="2"
                fill="var(--theme-accent)"
              />
            </g>
          ))}

          {/* Score labels near data points */}
          {dataPoints.map((pt, i) => {
            if (pt.value === null) return null;
            const offset = 14;
            const lx = cx + (pt.x - cx) + axisAngles[i].dx * offset;
            const ly = cy + (pt.y - cy) + axisAngles[i].dy * offset;
            return (
              <text
                key={`val-${i}`}
                x={lx}
                y={ly}
                fill="var(--theme-accent)"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="var(--font-display), var(--font-ui), system-ui, sans-serif"
              >
                {pt.value}
              </text>
            );
          })}
        </>
      )}

      {/* --- Axis labels (outside the chart) --- */}
      {axisAngles.map(({ dx, dy }, i) => {
        const labelR = R + 24;
        const lx = cx + labelR * dx;
        const ly = cy + labelR * dy;
        return (
          <text
            key={`lbl-${i}`}
            x={lx}
            y={ly}
            fill="var(--profile-text)"
            fontSize="11.5"
            fontWeight="600"
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="var(--font-ui), var(--font-body-sc), system-ui, sans-serif"
            letterSpacing="0.01em"
          >
            {values[i].label}
          </text>
        );
      })}

      {/* --- Scale tick (top) --- */}
      <text
        x={cx}
        y={cy - R + 12}
        fill="var(--profile-text-muted)"
        fontSize="8"
        textAnchor="middle"
        dominantBaseline="middle"
        opacity="0.6"
      >
        80
      </text>
    </svg>
  );
}
