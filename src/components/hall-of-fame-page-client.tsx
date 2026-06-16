"use client";

import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import styles from "@/components/hall-of-fame-page-client.module.css";
import {
  computeDataMilestones,
  computePlayerMilestones,
  getAllTimeKings,
  getInductees,
  type Inductee,
} from "@/lib/hall-of-fame";
import { panelNavItems } from "@/lib/routes";
import {
  sanitizeWorkspace,
  type Workspace,
} from "@/lib/workspace";

const NAV_ITEMS = panelNavItems("名人堂");

type HallOfFamePageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

type RankingTab = "H" | "HR" | "RBI" | "AVG" | "OBP" | "OPS" | "SO" | "W";

const RANKING_TABS: { key: RankingTab; label: string }[] = [
  { key: "H", label: "安打" },
  { key: "HR", label: "本垒打" },
  { key: "RBI", label: "打点" },
  { key: "AVG", label: "打击率" },
  { key: "OBP", label: "上垒率" },
  { key: "OPS", label: "OPS" },
  { key: "SO", label: "三振" },
  { key: "W", label: "胜投" },
];

export function HallOfFamePageClient({
  initialWorkspace,
  initialVersion,
}: HallOfFamePageClientProps) {
  const workspace = useMemo(
    () => sanitizeWorkspace(initialWorkspace),
    [initialWorkspace],
  );

  const inductees = useMemo(
    () => getInductees(workspace),
    [workspace],
  );

  // Separate team events and data milestones
  const teamEvents = useMemo(
    () => [...workspace.milestones].sort((a, b) => b.date.localeCompare(a.date)),
    [workspace.milestones],
  );

  const dataMilestones = useMemo(
    () => computeDataMilestones(workspace.games, workspace.players),
    [workspace.games, workspace.players],
  );

  const allTimeKings = useMemo(
    () => getAllTimeKings(inductees),
    [inductees],
  );

  const [rankingTab, setRankingTab] = useState<RankingTab>("H");

  // Sort inductees by the selected ranking tab, exclude zero values
  const rankedInductees = useMemo(() => {
    const sorted = [...inductees].filter((i) => {
      switch (rankingTab) {
        case "H": return i.batting.H > 0;
        case "HR": return i.batting.HR > 0;
        case "RBI": return i.batting.RBI > 0;
        case "AVG": return i.batting.AB > 0;
        case "OBP": return i.batting.PA > 0;
        case "OPS": return i.batting.AB > 0;
        case "SO": return (i.pitching?.SO ?? 0) > 0;
        case "W": return (i.pitching?.W ?? 0) > 0;
      }
    });
    switch (rankingTab) {
      case "H":
        sorted.sort((a, b) => b.batting.H - a.batting.H);
        break;
      case "HR":
        sorted.sort((a, b) => b.batting.HR - a.batting.HR);
        break;
      case "RBI":
        sorted.sort((a, b) => b.batting.RBI - a.batting.RBI);
        break;
      case "AVG":
        sorted.sort((a, b) => Number.parseFloat(b.batting.AVG) - Number.parseFloat(a.batting.AVG));
        break;
      case "OBP":
        sorted.sort((a, b) => Number.parseFloat(b.batting.OBP) - Number.parseFloat(a.batting.OBP));
        break;
      case "OPS":
        sorted.sort((a, b) => Number.parseFloat(b.batting.OPS) - Number.parseFloat(a.batting.OPS));
        break;
      case "SO":
        sorted.sort((a, b) => (b.pitching?.SO ?? 0) - (a.pitching?.SO ?? 0));
        break;
      case "W":
        sorted.sort((a, b) => (b.pitching?.W ?? 0) - (a.pitching?.W ?? 0));
        break;
    }
    return sorted;
  }, [inductees, rankingTab]);

  function rankValue(i: Inductee, tab: RankingTab): string {
    switch (tab) {
      case "H": return String(i.batting.H);
      case "HR": return String(i.batting.HR);
      case "RBI": return String(i.batting.RBI);
      case "AVG": return i.batting.AVG;
      case "OBP": return i.batting.OBP;
      case "OPS": return i.batting.OPS;
      case "SO": return String(i.pitching?.SO ?? 0);
      case "W": return String(i.pitching?.W ?? 0);
    }
  }

  return (
    <AppShell
      eyebrow="Hall of Fame"
      title="名人堂"
      description="社团老友记 — 入选球员的生涯数据、赛季荣誉与球队里程碑。"
      statusLabel="工作区"
      statusValue={`v${initialVersion}`}
      navItems={[...NAV_ITEMS]}
    >
      {/* ── All-Time Kings ── */}
      {allTimeKings.length > 0 && (
        <div className={styles.kingsGrid}>
          {allTimeKings.map((king) => (
            <div key={king.award} className={styles.kingCard}>
              <div className={styles.kingIcon}>&#x1F451;</div>
              <div className={styles.kingLabel}>{king.label}</div>
              <div className={styles.kingName}>
                {king.playerName}
                <span className={styles.kingNumber}>#{king.playerNumber}</span>
              </div>
              <div className={styles.kingStat}>{king.statValue}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── All-Time Ranking Table ── */}
      {inductees.length > 0 && (
        <div className={styles.rankingSection}>
          <h2 className={styles.rankingTitle}>生涯历史排名</h2>
          <p className={styles.rankingSub}>
            包含所有曾入选名人堂的球员（现役 + 已毕业）。
          </p>

          <div className={styles.rankingTabs}>
            {RANKING_TABS.map((t) => (
              <button
                key={t.key}
                className={rankingTab === t.key ? styles.rankingTabActive : styles.rankingTab}
                onClick={() => setRankingTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className={styles.rankingScroll}>
            <table className={styles.rankingTable}>
              <thead>
                <tr>
                  <th className={styles.rankCol}>#</th>
                  <th>球员</th>
                  <th className={styles.rankValCol}>
                    {RANKING_TABS.find((t) => t.key === rankingTab)?.label}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankedInductees.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", padding: 20, color: "var(--theme-muted)" }}>
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  rankedInductees.map((i, idx) => (
                    <tr key={i.player.id} className={idx === 0 ? styles.rankRowFirst : undefined}>
                      <td className={styles.rankCol}>
                        {idx === 0 ? <span className={styles.rankBadge}>&#x1F451;</span> : idx + 1}
                      </td>
                      <td>
                        <span className={styles.rankPlayerName}>{i.player.name}</span>
                        <span className={styles.rankPlayerMeta}>#{i.player.number}</span>
                        {i.player.status === "graduated" && (
                          <span className={styles.rankGraduatedTag}>毕业</span>
                        )}
                      </td>
                      <td className={styles.rankValCol}>
                        <strong>{rankValue(i, rankingTab)}</strong>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Inductee Cards ── */}
      <div className={styles.grid}>
        {inductees.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>&#x1F3C6;</div>
            <p className={styles.emptyText}>暂无名人堂成员</p>
            <p className={styles.emptySub}>
              需要至少加入社团 90 天并有正式比赛记录
            </p>
          </div>
        ) : (
          inductees.map((inductee) => (
            <InducteeCard key={inductee.player.id} inductee={inductee} games={workspace.games} />
          ))
        )}
      </div>

      {/* ── Milestones Timeline (two columns) ── */}
      {(teamEvents.length > 0 || dataMilestones.length > 0) && (
        <section className={styles.timelineSection}>
          <h2 className={styles.timelineTitle}>球队里程碑</h2>
          <div className={styles.timelineGrid}>
            {/* Left: Team Events */}
            <div className={styles.timelineColumn}>
              <h3 className={styles.timelineColTitle}>&#x1F4C5; 球队大事记</h3>
              {teamEvents.length === 0 ? (
                <p className={styles.timelineEmpty}>暂无记录</p>
              ) : (
                <div className={styles.timeline}>
                  {teamEvents.map((m) => (
                    <div key={m.id} className={styles.timelineItem}>
                      <div className={styles.timelineDot} />
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineDate}>{m.date}</div>
                        <div className={styles.timelineEventTitle}>{m.title}</div>
                        <div className={styles.timelineDescription}>{m.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Right: Data Milestones */}
            <div className={styles.timelineColumn}>
              <h3 className={styles.timelineColTitle}>&#x26A1; 队史数据里程碑</h3>
              {dataMilestones.length === 0 ? (
                <p className={styles.timelineEmpty}>暂无数据</p>
              ) : (
                <div className={styles.timeline}>
                  {dataMilestones.map((dm) => (
                    <div key={dm.id} className={`${styles.timelineItem} ${styles.timelineItemData}`}>
                      <div className={`${styles.timelineDot} ${styles.timelineDotData}`} />
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineDate}>{dm.date}</div>
                        <div className={styles.timelineEventTitle}>{dm.title}</div>
                        <div className={styles.timelineDescription}>{dm.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}

// ── Inductee Card ──

function InducteeCard({ inductee, games }: { inductee: Inductee; games: import("@/lib/workspace").Game[] }) {
  const { player, batting, pitching, fielding, seasonBadges } = inductee;
  const [expanded, setExpanded] = useState(false);
  const [referenceNow] = useState(() => Date.now());

  const daysSinceJoined = useMemo(() => {
    if (!player.joinedAt) return null;
    return Math.floor(
      (referenceNow - new Date(player.joinedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
  }, [player.joinedAt, referenceNow]);

  const personalMilestones = useMemo(
    () => computePlayerMilestones(player.id, games),
    [player.id, games],
  );

  return (
    <div
      className={`${styles.card} ${expanded ? styles.cardExpanded : ""}`}
      onClick={() => setExpanded(!expanded)}
      style={{ cursor: "pointer" }}
    >
      <div className={styles.cardHeader}>
        <div>
          <span className={styles.playerName}>{player.name}</span>
          <span className={styles.playerMeta}>#{player.number}</span>
        </div>
        <span className={styles.statusBadge}>
          {player.status === "graduated"
            ? "毕业"
            : daysSinceJoined !== null
              ? `入社 ${daysSinceJoined} 天`
              : "老队员"}
        </span>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{batting.G}</div>
          <div className={styles.statLabel}>G</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{batting.AVG}</div>
          <div className={styles.statLabel}>AVG</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{batting.HR}</div>
          <div className={styles.statLabel}>HR</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{batting.RBI}</div>
          <div className={styles.statLabel}>RBI</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{batting.OPS}</div>
          <div className={styles.statLabel}>OPS</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{pitching?.ERA ?? "-"}</div>
          <div className={styles.statLabel}>ERA</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{pitching?.W ?? "-"}</div>
          <div className={styles.statLabel}>W</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{fielding.G > 0 ? fielding.FPCT : "-"}</div>
          <div className={styles.statLabel}>FPCT</div>
        </div>
      </div>

      {seasonBadges.length > 0 && (
        <div className={styles.badges}>
          {seasonBadges.map((badge, i) => (
            <span key={`${badge.season}-${badge.award}-${i}`} className={styles.badge}>
              <span className={styles.badgeSeason}>{badge.season}</span>
              {" "}
              {badge.label} {badge.statValue}
            </span>
          ))}
        </div>
      )}

      {/* Expanded: personal milestone details */}
      {expanded && personalMilestones.length > 0 && (
        <div className={styles.personalMilestones} onClick={(e) => e.stopPropagation()}>
          <div className={styles.pmTitle}>个人里程碑</div>
          <div className={styles.pmList}>
            {personalMilestones.map((pm) => (
              <div key={pm.id} className={styles.pmItem}>
                <span className={styles.pmDate}>{pm.date}</span>
                <span className={styles.pmOpponent}>vs {pm.opponent}</span>
                <span className={styles.pmDesc}>{pm.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {expanded && personalMilestones.length === 0 && (
        <div className={styles.personalMilestones} onClick={(e) => e.stopPropagation()}>
          <p className={styles.pmEmpty}>暂无个人里程碑数据</p>
        </div>
      )}

      {!expanded && (
        <div className={styles.expandHint}>点击查看个人里程碑</div>
      )}
    </div>
  );
}
