"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "@/components/player-profile-editor.module.css";
import {
  createDefaultPlayerProfile,
  FIELDER_RADAR_LABELS,
  HAND_LABELS,
  PITCHER_RADAR_LABELS,
  POSITIONS,
  PROFILE_TYPE_LABELS,
  STATUS_LABELS,
  type FielderRadar,
  type PitcherRadar,
  type Player,
  type PlayerProfile,
  type PlayerProfileType,
  type PositionCode,
} from "@/lib/workspace";

type PlayerProfileEditorProps = {
  player: Player | null;
  variant: "page" | "drawer";
  saving?: boolean;
  statusMessage?: string;
  backHref?: string;
  onSave: (player: Player) => Promise<void> | void;
  onClose?: () => void;
  onOpenPage?: () => void;
};

const pitcherRadarKeys = Object.keys(PITCHER_RADAR_LABELS) as Array<
  keyof PitcherRadar
>;
const fielderRadarKeys = Object.keys(FIELDER_RADAR_LABELS) as Array<
  keyof FielderRadar
>;

export function PlayerProfileEditor(props: PlayerProfileEditorProps) {
  const [draft, setDraft] = useState<Player | null>(props.player);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(props.player);
    setError("");
  }, [props.player]);

  if (!draft) {
    return (
      <div
        className={`${styles.shell} ${styles.pageShell} ${styles.empty}`}
      >
        <h2>球员不存在</h2>
        <p>当前链接没有对应球员，或该球员已从工作区移除。</p>
        {props.backHref ? (
          <Link href={props.backHref} className={styles.backLink}>
            返回工作区
          </Link>
        ) : null}
      </div>
    );
  }

  const current = draft;
  const profile = current.profile ?? createDefaultPlayerProfile("fielder");
  const radarValues = profile.profileType === "pitcher"
    ? pitcherRadarKeys.map((key) => ({
        label: PITCHER_RADAR_LABELS[key],
        value: profile.radar.pitcher[key],
      }))
    : fielderRadarKeys.map((key) => ({
        label: FIELDER_RADAR_LABELS[key],
        value: profile.radar.fielder[key],
      }));

  const pitchCount = profile.pitchTypes.length;
  const physicalLabel = [profile.heightCm ? `${profile.heightCm} cm` : null, profile.weightKg ? `${profile.weightKg} kg` : null]
    .filter(Boolean)
    .join(" / ") || "待补充";
  const speedMetric =
    profile.profileType === "pitcher"
      ? formatMetric(profile.fastballTopKmh, "km/h")
      : formatMetric(profile.armStrengthKmh, "km/h");
  const supportMetric =
    profile.profileType === "pitcher"
      ? formatMetric(profile.fastballAvgKmh, "km/h")
      : formatMetric(profile.sixtyMeterSec, "s");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }
    if (!current.name.trim() || !current.number.trim()) {
      setError("姓名和背号不能为空");
      return;
    }

    setError("");
    await props.onSave({
      ...current,
      name: current.name.trim(),
      number: current.number.trim(),
      profile: {
        ...current.profile,
        pitchTypes: current.profile.pitchTypes.filter(Boolean),
        scoutingSummary: current.profile.scoutingSummary.trim(),
      },
    });
  }

  function updateDraft(patch: Partial<Player>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function updateProfile(patch: Partial<PlayerProfile>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            profile: {
              ...current.profile,
              ...patch,
            },
          }
        : current,
    );
  }

  function updatePitcherRadar(
    key: keyof PitcherRadar,
    value: string,
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            profile: {
              ...current.profile,
              radar: {
                ...current.profile.radar,
                pitcher: {
                  ...current.profile.radar.pitcher,
                  [key]: parseNullableNumber(value, true),
                },
              },
            },
          }
        : current,
    );
  }

  function updateFielderRadar(
    key: keyof FielderRadar,
    value: string,
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            profile: {
              ...current.profile,
              radar: {
                ...current.profile.radar,
                fielder: {
                  ...current.profile.radar.fielder,
                  [key]: parseNullableNumber(value, true),
                },
              },
            },
          }
        : current,
    );
  }

  function togglePosition(position: PositionCode, checked: boolean) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextPositions = checked
        ? [...current.positions, position]
        : current.positions.filter((item) => item !== position);

      return {
        ...current,
        positions: nextPositions,
      };
    });
  }

  const frameClass = props.variant === "page" ? styles.pageFrame : "";
  const shellClass =
    props.variant === "page" ? styles.pageShell : styles.drawerShell;

  return (
    <>
      {props.variant === "drawer" ? (
        <div className={styles.backdrop} onClick={props.onClose}>
          <div
            className={`${styles.shell} ${shellClass}`}
            onClick={(event) => event.stopPropagation()}
          >
            <ProfileFrame />
          </div>
        </div>
      ) : (
        <div className={`${styles.shell} ${shellClass}`}>
          <ProfileFrame />
        </div>
      )}
    </>
  );

  function ProfileFrame() {
    return (
      <section className={`${styles.frame} ${frameClass}`}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {props.backHref ? (
              <Link href={props.backHref} className={styles.backLink}>
                返回工作区
              </Link>
            ) : null}
            <div className={styles.status}>
              {props.statusMessage || "球员档案会同步写回共享工作区"}
            </div>
          </div>
          <div className={styles.toolbarRight}>
            {props.onOpenPage ? (
              <button
                type="button"
                className={styles.outlineButton}
                onClick={props.onOpenPage}
              >
                打开完整页面
              </button>
            ) : null}
            {props.onClose ? (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={props.onClose}
              >
                关闭
              </button>
            ) : null}
          </div>
        </div>

        <form className={styles.content} onSubmit={handleSubmit}>
          <section className={styles.hero}>
            <article className={`${styles.panel} ${styles.heroCard}`}>
              <div className={styles.eyebrow}>
                {PROFILE_TYPE_LABELS[profile.profileType]}
              </div>
              <div className={styles.heroTitleRow}>
                <div>
                  <h1 className={styles.heroTitle}>{current.name}</h1>
                  <div className={styles.chipRow}>
                    <span className={styles.chip}>
                      {STATUS_LABELS[current.status]}
                    </span>
                    <span className={styles.chip}>
                      打 {HAND_LABELS[current.bats]} / 投 {HAND_LABELS[current.throws]}
                    </span>
                    <span className={styles.warnChip}>
                      {current.positions.join(" / ") || "未设守位"}
                    </span>
                  </div>
                </div>
                <div className={styles.numberBadge}>#{current.number}</div>
              </div>
              <p className={styles.summary}>
                {profile.scoutingSummary || "补充球探摘要后，这里会显示该球员的比赛角色、发展方向和临场判断。"}
              </p>
              <div className={styles.heroGrid}>
                <div className={styles.heroMetric}>
                  <span className={styles.heroMetricLabel}>
                    {profile.profileType === "pitcher" ? "Top Velocity" : "Arm Strength"}
                  </span>
                  <div className={styles.heroMetricValue}>{speedMetric}</div>
                </div>
                <div className={styles.heroMetric}>
                  <span className={styles.heroMetricLabel}>
                    {profile.profileType === "pitcher" ? "Avg Velocity" : "60m Dash"}
                  </span>
                  <div className={styles.heroMetricValue}>{supportMetric}</div>
                </div>
                <div className={styles.heroMetric}>
                  <span className={styles.heroMetricLabel}>Body Frame</span>
                  <div className={styles.heroMetricValue}>{physicalLabel}</div>
                </div>
                <div className={styles.heroMetric}>
                  <span className={styles.heroMetricLabel}>Pitch Mix / Roles</span>
                  <div className={styles.heroMetricValue}>
                    {profile.profileType === "pitcher"
                      ? `${pitchCount || "0"} 种`
                      : `${current.positions.length || 0} 位`}
                  </div>
                </div>
              </div>
            </article>

            <aside className={`${styles.panel} ${styles.summaryCard}`}>
              <div className={styles.summaryLabel}>Scout Console</div>
              <div className={styles.summaryList}>
                <div className={styles.summaryItem}>
                  <span>年龄</span>
                  <strong>{profile.age ?? "待补充"}</strong>
                </div>
                <div className={styles.summaryItem}>
                  <span>身高 / 体重</span>
                  <strong>{physicalLabel}</strong>
                </div>
                <div className={styles.summaryItem}>
                  <span>投手模型</span>
                  <strong>{formatMetric(profile.fastballTopKmh, "km/h")}</strong>
                </div>
                <div className={styles.summaryItem}>
                  <span>野手模型</span>
                  <strong>{formatMetric(profile.armStrengthKmh, "km/h")}</strong>
                </div>
                <div className={styles.summaryItem}>
                  <span>球种</span>
                  <strong>{profile.pitchTypes.join(" / ") || "待补充"}</strong>
                </div>
              </div>
            </aside>
          </section>

          <section className={styles.dashboard}>
            <article className={`${styles.panel} ${styles.radarPanel}`}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>六维能力图</h2>
                  <p>按当前模型切换六维标签。评分使用 20-80 球探刻度。</p>
                </div>
                <span className={styles.warnChip}>
                  {PROFILE_TYPE_LABELS[profile.profileType]}
                </span>
              </div>
              <div className={styles.chartWrap}>
                <RadarChart values={radarValues} />
              </div>
              <div className={styles.chartLegend}>
                {radarValues.map((item) => (
                  <div key={item.label} className={styles.legendItem}>
                    <span>{item.label}</span>
                    <strong>{item.value ?? "--"}</strong>
                  </div>
                ))}
              </div>
            </article>

            <div className={`${styles.panel} ${styles.formPanel}`}>
              <section className={styles.formSection}>
                <div className={styles.sectionHeading}>
                  <div>
                    <h3>基础资料</h3>
                    <p>该区域会同时驱动管理器卡片信息和独立球员档案页。</p>
                  </div>
                </div>
                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <label htmlFor="player-name">姓名</label>
                    <input
                      id="player-name"
                      value={current.name}
                      onChange={(event) => updateDraft({ name: event.target.value })}
                      maxLength={28}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="player-number">背号</label>
                    <input
                      id="player-number"
                      value={current.number}
                      onChange={(event) => updateDraft({ number: event.target.value })}
                      maxLength={3}
                    />
                  </div>
                </div>
                <div className={styles.fieldGridThree}>
                  <div className={styles.field}>
                    <label htmlFor="player-status">状态</label>
                    <select
                      id="player-status"
                      value={current.status}
                      onChange={(event) =>
                        updateDraft({
                          status: event.target.value as Player["status"],
                        })}
                    >
                      <option value="available">可上场</option>
                      <option value="rest">轮休</option>
                      <option value="injured">伤停</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="player-bats">打击</label>
                    <select
                      id="player-bats"
                      value={current.bats}
                      onChange={(event) =>
                        updateDraft({ bats: event.target.value as Player["bats"] })}
                    >
                      <option value="R">右打</option>
                      <option value="L">左打</option>
                      <option value="S">左右开弓</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="player-throws">投球</label>
                    <select
                      id="player-throws"
                      value={current.throws}
                      onChange={(event) =>
                        updateDraft({
                          throws: event.target.value as Player["throws"],
                        })}
                    >
                      <option value="R">右投</option>
                      <option value="L">左投</option>
                      <option value="S">左右皆可</option>
                    </select>
                  </div>
                </div>
                <div>
                  <div className={styles.checkboxGroupLabel}>守位</div>
                  <div className={styles.checkboxGrid}>
                    {POSITIONS.map((position) => (
                      <label key={position.code} className={styles.checkboxTile}>
                        <input
                          type="checkbox"
                          checked={current.positions.includes(position.code)}
                          onChange={(event) =>
                            togglePosition(position.code, event.target.checked)}
                        />
                        <span>{position.code}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              <section className={styles.formSection}>
                <div className={styles.sectionHeading}>
                  <div>
                    <h3>球速与身体素质</h3>
                    <p>两用球员可手动切换当前展示模型，但数据会始终保存在同一份档案中。</p>
                  </div>
                </div>
                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <label htmlFor="profile-type">当前模型</label>
                    <select
                      id="profile-type"
                      value={profile.profileType}
                      onChange={(event) =>
                        updateProfile({
                          profileType: event.target.value as PlayerProfileType,
                        })}
                    >
                      <option value="pitcher">投手模型</option>
                      <option value="fielder">野手模型</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="profile-age">年龄</label>
                    <input
                      id="profile-age"
                      type="number"
                      min="10"
                      max="60"
                      value={profile.age ?? ""}
                      onChange={(event) =>
                        updateProfile({
                          age: parseNullableNumber(event.target.value, true),
                        })}
                    />
                  </div>
                </div>
                <div className={styles.fieldGridThree}>
                  <div className={styles.field}>
                    <label htmlFor="profile-height">身高 cm</label>
                    <input
                      id="profile-height"
                      type="number"
                      value={profile.heightCm ?? ""}
                      onChange={(event) =>
                        updateProfile({
                          heightCm: parseNullableNumber(event.target.value, true),
                        })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="profile-weight">体重 kg</label>
                    <input
                      id="profile-weight"
                      type="number"
                      value={profile.weightKg ?? ""}
                      onChange={(event) =>
                        updateProfile({
                          weightKg: parseNullableNumber(event.target.value, true),
                        })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="profile-60m">60m 秒</label>
                    <input
                      id="profile-60m"
                      type="number"
                      step="0.01"
                      value={profile.sixtyMeterSec ?? ""}
                      onChange={(event) =>
                        updateProfile({
                          sixtyMeterSec: parseNullableNumber(event.target.value),
                        })}
                    />
                  </div>
                </div>
                <div className={styles.fieldGridThree}>
                  <div className={styles.field}>
                    <label htmlFor="profile-fastball-top">最快球速 km/h</label>
                    <input
                      id="profile-fastball-top"
                      type="number"
                      value={profile.fastballTopKmh ?? ""}
                      onChange={(event) =>
                        updateProfile({
                          fastballTopKmh: parseNullableNumber(event.target.value),
                        })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="profile-fastball-avg">均速 km/h</label>
                    <input
                      id="profile-fastball-avg"
                      type="number"
                      value={profile.fastballAvgKmh ?? ""}
                      onChange={(event) =>
                        updateProfile({
                          fastballAvgKmh: parseNullableNumber(event.target.value),
                        })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="profile-arm">臂力 km/h</label>
                    <input
                      id="profile-arm"
                      type="number"
                      value={profile.armStrengthKmh ?? ""}
                      onChange={(event) =>
                        updateProfile({
                          armStrengthKmh: parseNullableNumber(event.target.value),
                        })}
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="profile-pitches">球种</label>
                  <input
                    id="profile-pitches"
                    value={profile.pitchTypes.join("，")}
                    onChange={(event) =>
                      updateProfile({
                        pitchTypes: event.target.value
                          .split(/[,，/]/)
                          .map((item) => item.trim())
                          .filter(Boolean)
                          .slice(0, 6),
                      })}
                    placeholder="例如：四缝线，滑球，变速球"
                  />
                </div>
              </section>

              <section className={styles.formSection}>
                <div className={styles.sectionHeading}>
                  <div>
                    <h3>球探评估</h3>
                    <p>六维分数按 20-80 填写，摘要用于首页抽屉和完整档案顶部文案。</p>
                  </div>
                </div>
                <div className={styles.radarGrid}>
                  {(profile.profileType === "pitcher" ? pitcherRadarKeys : fielderRadarKeys).map(
                    (key) => (
                      <div key={key} className={styles.field}>
                        <label htmlFor={`radar-${key}`}>
                          {profile.profileType === "pitcher"
                            ? PITCHER_RADAR_LABELS[key as keyof PitcherRadar]
                            : FIELDER_RADAR_LABELS[key as keyof FielderRadar]}
                        </label>
                        <input
                          id={`radar-${key}`}
                          type="number"
                          min="20"
                          max="80"
                          step="1"
                          value={
                            profile.profileType === "pitcher"
                              ? profile.radar.pitcher[key as keyof PitcherRadar] ?? ""
                              : profile.radar.fielder[key as keyof FielderRadar] ?? ""
                          }
                          onChange={(event) =>
                            profile.profileType === "pitcher"
                              ? updatePitcherRadar(
                                  key as keyof PitcherRadar,
                                  event.target.value,
                                )
                              : updateFielderRadar(
                                  key as keyof FielderRadar,
                                  event.target.value,
                                )}
                        />
                      </div>
                    ),
                  )}
                </div>
                <div className={styles.field}>
                  <label htmlFor="scouting-summary">球探摘要</label>
                  <textarea
                    id="scouting-summary"
                    value={profile.scoutingSummary}
                    onChange={(event) =>
                      updateProfile({ scoutingSummary: event.target.value })}
                    maxLength={180}
                  />
                </div>
              </section>

              <div className={styles.footer}>
                <div className={styles.hint}>
                  {error || "保存后会覆盖当前球员档案，并同步到共享工作区。"}
                </div>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={props.saving}
                >
                  {props.saving ? "保存中..." : "保存球员档案"}
                </button>
              </div>
            </div>
          </section>
        </form>
      </section>
    );
  }
}

function RadarChart({
  values,
}: {
  values: Array<{ label: string; value: number | null }>;
}) {
  const center = 150;
  const radius = 108;
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
            stroke="rgba(143, 165, 155, 0.18)"
            strokeWidth="1"
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
            stroke="rgba(143, 165, 155, 0.22)"
            strokeWidth="1"
          />
          <text
            x={point.x}
            y={point.y}
            fill="#d7e3db"
            fontSize="11"
            textAnchor={point.x >= center ? "start" : "end"}
            dominantBaseline={point.y >= center ? "hanging" : "auto"}
          >
            {values[index].label}
          </text>
        </g>
      ))}

      <polygon
        points={polygonPoints.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="rgba(132, 199, 166, 0.22)"
        stroke="#84c7a6"
        strokeWidth="2.5"
      />
      {polygonPoints.map((point, index) => (
        <circle
          key={`${values[index].label}-dot`}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#f3c06d"
        />
      ))}
    </svg>
  );
}

function polarToCartesian(
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

function parseNullableNumber(value: string, round = false) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return round ? Math.round(parsed) : Number(parsed.toFixed(2));
}

function formatMetric(value: number | null, suffix: string) {
  return value === null ? "--" : `${value} ${suffix}`;
}
