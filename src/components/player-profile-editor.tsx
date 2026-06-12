"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import styles from "@/components/player-profile-editor.module.css";
import {
  createDefaultPlayerProfile,
  FIELDER_RADAR_LABELS,
  HAND_LABELS,
  inferPlayerProfileType,
  PITCHER_RADAR_LABELS,
  POSITIONS,
  PROFILE_TYPE_LABELS,
  sanitizeNullableNumber,
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
  pageSurface?: "standalone" | "embedded";
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
  const { onClose, variant } = props;
  const [draft, setDraft] = useState<Player | null>(props.player);
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (variant !== "drawer") {
      return;
    }

    const container = drawerRef.current;
    const previousActive = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    closeButtonRef.current?.focus();

    function handleDrawerKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== "Tab" || !container) {
        return;
      }

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    container?.addEventListener("keydown", handleDrawerKeydown);

    return () => {
      container?.removeEventListener("keydown", handleDrawerKeydown);
      if (previousActive?.isConnected) {
        previousActive.focus();
      }
    };
  }, [onClose, variant]);

  const pageShellClassName = props.pageSurface === "embedded"
    ? styles.pageEmbeddedShell
    : styles.pageShell;

  if (!draft) {
    return (
      <div className={`${styles.shell} ${pageShellClassName} ${styles.empty}`}>
        <div className={styles.emptyCard}>
          <div className={styles.kicker}>球员记录</div>
          <h2>球员不存在</h2>
          <p>当前链接没有对应球员，或该球员已从共享工作区移除。</p>
          {props.backHref ? (
            <Link href={props.backHref} className={styles.secondaryButton}>
              返回工作区
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const current = draft;
  const profile = current.profile ?? createDefaultPlayerProfile("fielder");
  const radarEntries = profile.profileType === "pitcher"
    ? pitcherRadarKeys.map((key) => ({
        key,
        label: PITCHER_RADAR_LABELS[key],
        value: profile.radar.pitcher[key],
      }))
    : fielderRadarKeys.map((key) => ({
        key,
        label: FIELDER_RADAR_LABELS[key],
        value: profile.radar.fielder[key],
      }));

  const pitchCount = profile.pitchTypes.length;
  const positionsLabel = current.positions.length > 0
    ? current.positions.join(" · ")
    : "待定守位";
  const physicalLabel = [
    profile.heightCm ? `${profile.heightCm} cm` : null,
    profile.weightKg ? `${profile.weightKg} kg` : null,
  ].filter(Boolean).join(" / ") || "待补充";
  const primaryMetric = profile.profileType === "pitcher"
    ? formatMetric(profile.fastballTopKmh, "km/h")
    : formatMetric(profile.armStrengthM, "m");
  const secondaryMetric = profile.profileType === "pitcher"
    ? formatMetric(profile.fastballAvgKmh, "km/h")
    : formatMetric(profile.thirtyMeterSec, "s");

  const overviewItems = [
    {
      label: profile.profileType === "pitcher" ? "最快球速" : "掷远",
      value: primaryMetric,
    },
    {
      label: profile.profileType === "pitcher" ? "均速" : "30m",
      value: secondaryMetric,
    },
    {
      label: "身体条件",
      value: physicalLabel,
    },
    {
      label: profile.profileType === "pitcher" ? "球种数量" : "可守位置",
      value: profile.profileType === "pitcher"
        ? `${pitchCount || 0} 种`
        : `${current.positions.length || 0} 位`,
    },
  ];

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
    setDraft((currentDraft) =>
      currentDraft ? { ...currentDraft, ...patch } : currentDraft,
    );
  }

  function updateProfile(patch: Partial<PlayerProfile>) {
    setDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            profile: {
              ...currentDraft.profile,
              ...patch,
            },
          }
        : currentDraft,
    );
  }

  function updatePitcherRadar(key: keyof PitcherRadar, value: string) {
    setDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            profile: {
              ...currentDraft.profile,
              radar: {
                ...currentDraft.profile.radar,
                pitcher: {
                  ...currentDraft.profile.radar.pitcher,
                  [key]: sanitizeNullableNumber(value, 20, 80, true),
                },
              },
            },
          }
        : currentDraft,
    );
  }

  function updateFielderRadar(key: keyof FielderRadar, value: string) {
    setDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            profile: {
              ...currentDraft.profile,
              radar: {
                ...currentDraft.profile.radar,
                fielder: {
                  ...currentDraft.profile.radar.fielder,
                  [key]: sanitizeNullableNumber(value, 20, 80, true),
                },
              },
            },
          }
        : currentDraft,
    );
  }

  function updateNumericDraft(
    fieldKey: string,
    rawValue: string,
    min: number,
    max: number,
    apply: (value: number | null) => void,
    integer = false,
  ) {
    setNumericDrafts((currentDrafts) => ({
      ...currentDrafts,
      [fieldKey]: rawValue,
    }));

    const sanitized = sanitizeNullableNumber(rawValue, min, max, integer);
    if (rawValue === "" || sanitized !== null) {
      apply(sanitized);
    }
  }

  function finalizeNumericDraft(
    fieldKey: string,
    min: number,
    max: number,
    apply: (value: number | null) => void,
    integer = false,
  ) {
    const rawValue = numericDrafts[fieldKey];
    if (rawValue === undefined) {
      return;
    }

    const sanitized = sanitizeNullableNumber(rawValue, min, max, integer);
    apply(sanitized);
    setNumericDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[fieldKey];
      return nextDrafts;
    });
  }

  function numericInputValue(fieldKey: string, value: number | null) {
    return numericDrafts[fieldKey] ?? (value ?? "");
  }

  function togglePosition(position: PositionCode, checked: boolean) {
    setDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextPositions = checked
        ? [...currentDraft.positions, position]
        : currentDraft.positions.filter((item) => item !== position);

      return {
        ...currentDraft,
        positions: nextPositions,
        profile: {
          ...currentDraft.profile,
          profileType: inferPlayerProfileType(nextPositions),
        },
      };
    });
  }

  const shellClass = props.variant === "page"
    ? pageShellClassName
    : styles.drawerShell;
  const gamesHref = `/players/${encodeURIComponent(current.id)}/games`;

  const frameContent = (
    <section className={styles.frame}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          {props.backHref ? (
            <Link href={props.backHref} className={styles.secondaryButton}>
              返回工作区
            </Link>
          ) : null}
          <div className={styles.statusText}>
            {props.statusMessage || "球员档案会同步写回共享工作区"}
          </div>
        </div>
        <div className={styles.topbarRight}>
          {props.variant === "page" ? (
            <Link href={gamesHref} className={styles.secondaryButton}>
              查看比赛数据
            </Link>
          ) : null}
          {props.onOpenPage ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={props.onOpenPage}
            >
              打开完整页面
            </button>
          ) : null}
          {props.onClose ? (
            <button
              ref={closeButtonRef}
              type="button"
              className={styles.secondaryButton}
              onClick={props.onClose}
            >
              关闭
            </button>
          ) : null}
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.masthead}>
          <div className={styles.mastheadMain}>
            <div className={styles.kicker}>球探记录</div>
            <div className={styles.titleRow}>
              <div className={styles.titleBlock}>
                <h1
                  id={props.variant === "drawer" ? "player-profile-dialog-title" : undefined}
                  className={styles.title}
                >
                  {current.name}
                </h1>
                <p className={styles.deck}>
                  {profile.scoutingSummary || "在这里记录该球员的角色轮廓、比赛气质与培养方向，让档案读起来像一页完整的球探笔记。"}
                </p>
              </div>
              <div className={styles.numberPlate} aria-label={`背号 ${current.number}`}>
                <span className={styles.numberPlateLabel}>No.</span>
                <strong>{current.number}</strong>
              </div>
            </div>
            <div className={styles.tagRow}>
              <span className={styles.tag}>{STATUS_LABELS[current.status]}</span>
              <span className={styles.tag}>{PROFILE_TYPE_LABELS[profile.profileType]}</span>
              <span className={styles.tag}>打 {HAND_LABELS[current.bats]} / 投 {HAND_LABELS[current.throws]}</span>
              <span className={styles.highlightTag}>{positionsLabel}</span>
            </div>
            <div className={styles.metricStrip}>
              {overviewItems.map((item) => (
                <div key={item.label} className={styles.metricCard}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <aside className={styles.identityCard}>
            <div className={styles.kickerMuted}>球员备注</div>
            <dl className={styles.identityList}>
              <div>
                <dt>年龄</dt>
                <dd>{profile.age ?? "待补充"}</dd>
              </div>
              <div>
                <dt>身体条件</dt>
                <dd>{physicalLabel}</dd>
              </div>
              <div>
                <dt>守位</dt>
                <dd>{positionsLabel}</dd>
              </div>
              <div>
                <dt>球种 / 角色</dt>
                <dd>{profile.pitchTypes.join(" · ") || "待补充"}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className={styles.editorGrid}>
          <div className={styles.primaryColumn}>
            <article className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.kickerMuted}>基本信息</div>
                  <h2>身份与角色</h2>
                </div>
                <p>先完善最常被查看的信息，保证档案首屏可快速扫读。</p>
              </div>

              <div className={styles.fieldGridTwo}>
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
                      updateDraft({ status: event.target.value as Player["status"] })}
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
                      updateDraft({ throws: event.target.value as Player["throws"] })}
                  >
                    <option value="R">右投</option>
                    <option value="L">左投</option>
                    <option value="S">左右皆可</option>
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.groupLabel}>守位</div>
                <div className={styles.positionGrid}>
                  {POSITIONS.map((position) => (
                    <label key={position.code} className={styles.positionTag}>
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
            </article>

            <article className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.kickerMuted}>身体素质</div>
                  <h2>身体素质与模型</h2>
                </div>
                <p>球员可在同一份档案中保存投手与野手两套观察维度。</p>
              </div>

              <div className={styles.fieldGridTwo}>
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
                    value={numericInputValue("age", profile.age)}
                    onChange={(event) =>
                      updateNumericDraft(
                        "age",
                        event.target.value,
                        10,
                        60,
                        (value) => updateProfile({ age: value }),
                        true,
                      )}
                    onBlur={() =>
                      finalizeNumericDraft(
                        "age",
                        10,
                        60,
                        (value) => updateProfile({ age: value }),
                        true,
                      )}
                  />
                </div>
              </div>

              <div className={styles.fieldGridThree}>
                <div className={styles.field}>
                  <label htmlFor="profile-height">身高 cm</label>
                  <input
                    id="profile-height"
                    type="number"
                    value={numericInputValue("heightCm", profile.heightCm)}
                    onChange={(event) =>
                      updateNumericDraft(
                        "heightCm",
                        event.target.value,
                        100,
                        250,
                        (value) => updateProfile({ heightCm: value }),
                        true,
                      )}
                    onBlur={() =>
                      finalizeNumericDraft(
                        "heightCm",
                        100,
                        250,
                        (value) => updateProfile({ heightCm: value }),
                        true,
                      )}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="profile-weight">体重 kg</label>
                  <input
                    id="profile-weight"
                    type="number"
                    value={numericInputValue("weightKg", profile.weightKg)}
                    onChange={(event) =>
                      updateNumericDraft(
                        "weightKg",
                        event.target.value,
                        30,
                        200,
                        (value) => updateProfile({ weightKg: value }),
                        true,
                      )}
                    onBlur={() =>
                      finalizeNumericDraft(
                        "weightKg",
                        30,
                        200,
                        (value) => updateProfile({ weightKg: value }),
                        true,
                      )}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="profile-30m">30m 秒</label>
                  <input
                    id="profile-30m"
                    type="number"
                    step="0.01"
                    value={numericInputValue("thirtyMeterSec", profile.thirtyMeterSec)}
                    onChange={(event) =>
                      updateNumericDraft(
                        "thirtyMeterSec",
                        event.target.value,
                        3,
                        8,
                        (value) => updateProfile({ thirtyMeterSec: value }),
                      )}
                    onBlur={() =>
                      finalizeNumericDraft(
                        "thirtyMeterSec",
                        3,
                        8,
                        (value) => updateProfile({ thirtyMeterSec: value }),
                      )}
                  />
                </div>
              </div>

              <div className={styles.fieldGridThree}>
                <div className={styles.field}>
                  <label htmlFor="profile-fastball-top">最快球速 km/h</label>
                  <input
                    id="profile-fastball-top"
                    type="number"
                    value={numericInputValue("fastballTopKmh", profile.fastballTopKmh)}
                    onChange={(event) =>
                      updateNumericDraft(
                        "fastballTopKmh",
                        event.target.value,
                        50,
                        180,
                        (value) => updateProfile({ fastballTopKmh: value }),
                      )}
                    onBlur={() =>
                      finalizeNumericDraft(
                        "fastballTopKmh",
                        50,
                        180,
                        (value) => updateProfile({ fastballTopKmh: value }),
                      )}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="profile-fastball-avg">均速 km/h</label>
                  <input
                    id="profile-fastball-avg"
                    type="number"
                    value={numericInputValue("fastballAvgKmh", profile.fastballAvgKmh)}
                    onChange={(event) =>
                      updateNumericDraft(
                        "fastballAvgKmh",
                        event.target.value,
                        50,
                        180,
                        (value) => updateProfile({ fastballAvgKmh: value }),
                      )}
                    onBlur={() =>
                      finalizeNumericDraft(
                        "fastballAvgKmh",
                        50,
                        180,
                        (value) => updateProfile({ fastballAvgKmh: value }),
                      )}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="profile-arm">掷远 m</label>
                  <input
                    id="profile-arm"
                    type="number"
                    value={numericInputValue("armStrengthM", profile.armStrengthM)}
                    onChange={(event) =>
                      updateNumericDraft(
                        "armStrengthM",
                        event.target.value,
                        10,
                        150,
                        (value) => updateProfile({ armStrengthM: value }),
                      )}
                    onBlur={() =>
                      finalizeNumericDraft(
                        "armStrengthM",
                        10,
                        150,
                        (value) => updateProfile({ armStrengthM: value }),
                      )}
                  />
                </div>
              </div>
            </article>

            <article className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.kickerMuted}>球探纪要</div>
                  <h2>球探纪要</h2>
                </div>
                <p>用简洁、可复读的语言记录这个球员最值得记住的特征。</p>
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
            </article>
          </div>

          <div className={styles.secondaryColumn}>
            <article className={`${styles.sectionCard} ${styles.radarCard}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.kickerMuted}>能力轮廓</div>
                  <h2>六维能力图</h2>
                </div>
                <p>按当前模型切换标签，保持一眼可读的轮廓感。</p>
              </div>

              <div className={styles.radarWrap}>
                <RadarChart values={radarEntries} />
              </div>

              <div className={styles.legendList}>
                {radarEntries.map((item) => (
                  <div key={item.label} className={styles.legendRow}>
                    <span>{item.label}</span>
                    <strong>{item.value ?? "--"}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.kickerMuted}>六维评分</div>
                  <h2>六维评分</h2>
                </div>
                <p>使用 20–80 球探刻度，空值表示暂未观察。</p>
              </div>

              <div className={styles.gradeGrid}>
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
                        value={numericInputValue(
                          `radar-${String(key)}`,
                          profile.profileType === "pitcher"
                            ? profile.radar.pitcher[key as keyof PitcherRadar]
                            : profile.radar.fielder[key as keyof FielderRadar],
                        )}
                        onChange={(event) =>
                          updateNumericDraft(
                            `radar-${String(key)}`,
                            event.target.value,
                            20,
                            80,
                            (value) =>
                              profile.profileType === "pitcher"
                                ? updatePitcherRadar(
                                    key as keyof PitcherRadar,
                                    value === null ? "" : String(value),
                                  )
                                : updateFielderRadar(
                                    key as keyof FielderRadar,
                                    value === null ? "" : String(value),
                                  ),
                            true,
                          )}
                        onBlur={() =>
                          finalizeNumericDraft(
                            `radar-${String(key)}`,
                            20,
                            80,
                            (value) =>
                              profile.profileType === "pitcher"
                                ? updatePitcherRadar(
                                    key as keyof PitcherRadar,
                                    value === null ? "" : String(value),
                                  )
                                : updateFielderRadar(
                                    key as keyof FielderRadar,
                                    value === null ? "" : String(value),
                                  ),
                            true,
                          )}
                      />
                    </div>
                  ),
                )}
              </div>
            </article>
          </div>
        </section>

        <footer className={styles.footerBar}>
          <div className={styles.footerText}>
            {error || "保存后会覆盖当前球员档案，并同步到共享工作区。"}
          </div>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={props.saving}
          >
            {props.saving ? "保存中..." : "保存球员档案"}
          </button>
        </footer>
      </form>
    </section>
  );

  return (
    <>
      {props.variant === "drawer" ? (
        <div className={styles.backdrop} onClick={props.onClose}>
          <div
            ref={drawerRef}
            className={`${styles.shell} ${shellClass}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-profile-dialog-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            {frameContent}
          </div>
        </div>
      ) : (
        <div className={`${styles.shell} ${shellClass}`}>{frameContent}</div>
      )}
    </>
  );
}

function RadarChart({
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

export function formatMetric(value: number | null, suffix: string) {
  return value === null ? "--" : `${value} ${suffix}`;
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden"));
}
