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
  const radius = 106;
  const levels = [20, 35, 50, 65, 80];
  const axisPoints = values.map((_, index) =>
    polarToCartesian(center, center, radius, index, values.length),
  );
  const polygonPoints = values.map((item, index) => {
    const normalized = item.value === null ? 0.18 : (item.value - 20) / 60;
    return polarToCartesian(
      center,
      center,
      radius * Math.max(normalized, 0.18),
      index,
      values.length,
    );
  });

  return (
    <svg
      viewBox="0 0 300 300"
      role="img"
      aria-label="球员六维能力图"
      className={styles.chartSvg}
    >
      {levels.map((level) => {
        const points = values
          .map((_, index) =>
            polarToCartesian(
              center,
              center,
              radius * ((level - 20) / 60),
              index,
              values.length,
            ),
          )
          .map((point) => `${point.x},${point.y}`)
          .join(" ");

        return (
          <polygon
            key={level}
            points={points}
            fill="none"
            stroke="var(--profile-grid-line)"
            strokeWidth="1"
            strokeDasharray={level === 80 ? undefined : "3 5"}
          />
        );
      })}

      {axisPoints.map((point, index) => (
        <g key={values[index].label}>
          <line
            x1={center}
            y1={center}
            x2={point.x}
            y2={point.y}
            stroke="var(--profile-axis-line)"
            strokeWidth="1"
          />
          <text
            x={point.x}
            y={point.y}
            fill="var(--profile-text-muted)"
            fontSize="11"
            textAnchor={point.x >= center ? "start" : "end"}
            dominantBaseline={point.y >= center ? "hanging" : "auto"}
          >
            {values[index].label}
          </text>
        </g>
      ))}

      <circle
        cx={center}
        cy={center}
        r="2.5"
        fill="var(--profile-accent)"
        opacity="0.8"
      />
      <polygon
        points={polygonPoints.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="var(--profile-polygon-fill)"
        stroke="var(--profile-accent)"
        strokeWidth="2"
      />
      {polygonPoints.map((point, index) => (
        <circle
          key={`${values[index].label}-dot`}
          cx={point.x}
          cy={point.y}
          r="3.5"
          fill="var(--profile-accent-strong)"
        />
      ))}
    </svg>
  );
}
