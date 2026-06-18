"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { reportDataCenterReady } from "@/components/panel-performance-telemetry";
import { ToastProvider, type ToastHandle } from "@/components/toast";
import styles from "@/components/stats-page-client.module.css";
import {
  computeBattingLine,
  computeFieldingLine,
  deriveSeasons,
  filterGamesBySeason,
  filterGamesByType,
  computePitchingLine,
  type StatsGameScope,
} from "@/lib/stats";
import {
  cloneWorkspace,
  createId,
  type Game,
  type InningRecord,
  type Player,
  type PlayerGameStatLine,
  type Workspace,
} from "@/lib/workspace";
import {
  createGame,
  deleteGame,
  isVersionConflict,
  submitMutationWithRetry,
  type WorkspaceSnapshot,
  updateGame,
} from "@/lib/workspace-client";
import { useWorkspaceSnapshot } from "@/lib/use-workspace-snapshot";
import { panelNavItems } from "@/lib/routes";

const NAV_ITEMS = panelNavItems("数据中心");

type TabType = "players" | "games" | "glossary";
type PlayerSortKey = "G" | "H" | "AVG" | "OBP" | "HR" | "RBI" | "OPS" | "E" | "FPCT" | "ERA" | "WHIP" | "SO_PITCHING" | "W" | "SV";
type SortDir = "asc" | "desc";

type GameDialogState =
  | { type: "closed" }
  | { type: "add" }
  | { type: "edit"; game: Game };

type StatsPageClientProps = {
  initialWorkspace: Workspace;
  initialVersion: number;
};

function emptyPlayerGameStatLine(playerId: string): PlayerGameStatLine {
  return {
    playerId,
    pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, r: 0, sb: 0, bb: 0, hbp: 0, sf: 0, so: 0,
    ip: null, er: null, soPitching: null, bbPitching: null, hPitching: null,
    po: 0, a: 0, e: 0,
    w: 0, l: 0, sv: 0, np: 0,
  };
}

function emptyInning(inning: number): InningRecord {
  return { inning, hits: 0, runs: 0, batters: [] };
}

function emptyGame(playerIds: string[]): Game {
  return {
    id: createId(),
    date: "",
    opponent: "",
    gameType: "official",
    totalInnings: 9,
    innings: Array.from({ length: 9 }, (_, i) => emptyInning(i + 1)),
    statLines: playerIds.map(emptyPlayerGameStatLine),
  };
}

function sortNumeric(a: number, b: number, dir: SortDir): number {
  return dir === "desc" ? b - a : a - b;
}

function sortStringAsNum(a: string, b: string, dir: SortDir): number {
  return sortNumeric(Number.parseFloat(a) || 0, Number.parseFloat(b) || 0, dir);
}

export function StatsPageClient({
  initialWorkspace,
  initialVersion,
}: StatsPageClientProps) {
  const toastRef = useRef<ToastHandle | null>(null);

  const { workspace, version, setWorkspace, applySnapshot, refreshWorkspace } =
    useWorkspaceSnapshot(initialWorkspace, initialVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    reportDataCenterReady();
  }, []);

  // Refs to avoid stale closures in async save handler and prevent concurrent saves
  const workspaceRef = useRef(workspace);
  const versionRef = useRef(version);
  const savingRef = useRef(false);

  useEffect(() => {
    workspaceRef.current = workspace;
    versionRef.current = version;
  }, [workspace, version]);

  const [tab, setTab] = useState<TabType>("players");
  const [gameScope, setGameScope] = useState<StatsGameScope>("official");
  const [season, setSeason] = useState<string | null>(null);
  const [playerSortKey, setPlayerSortKey] = useState<PlayerSortKey>("AVG");
  const [playerSortDir, setPlayerSortDir] = useState<SortDir>("desc");
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<GameDialogState>({ type: "closed" });

  const seasons = useMemo(() => deriveSeasons(workspace.games), [workspace.games]);

  // ── Save ──
  // applyMutation is the pure function to apply to the latest workspace.
  // It is used both for optimistic local update and conflict retry.
  const handleSave = useCallback(
    async (
      applyMutation: (current: Workspace) => Workspace,
      submit: (nextWorkspace: Workspace, version: number) => Promise<WorkspaceSnapshot>,
    ) => {
      // Prevent concurrent saves within the same session
      if (savingRef.current) {
        toastRef.current?.showToast("操作已在保存中，请稍后再试。");
        return;
      }
      savingRef.current = true;

      const optimistic = applyMutation(workspaceRef.current);
      setWorkspace(optimistic);
      setIsSaving(true);
      setSaveError(null);

      try {
        const result = await submitMutationWithRetry(
          workspaceRef.current,
          versionRef.current,
          applyMutation,
          submit,
        );
        applySnapshot(result);
      } catch (error) {
        // On any failure, reload server snapshot to roll back optimistic update
        let reloaded = false;
        try {
          await refreshWorkspace();
          reloaded = true;
        } catch {
          // If reload also fails, leave current state as-is (best effort)
        }

        if (reloaded) {
          if (isVersionConflict(error)) {
            toastRef.current?.showToast("数据已被其他会话更新，已恢复到最新状态，请重新操作。");
          } else {
            console.error("Save failed:", error);
            setSaveError("保存失败，已恢复到最新数据，请重试。");
          }
        } else {
          console.error("Save failed and reload failed:", error);
          toastRef.current?.showToast("保存失败且无法连接服务器，当前显示内容可能未同步。");
          setSaveError("保存失败，请检查网络后刷新页面。");
        }
      } finally {
        setIsSaving(false);
        savingRef.current = false;
      }
    },
    [setWorkspace, applySnapshot, refreshWorkspace],
  );

  // ── Player leaderboard ──
  const scopedGames = useMemo(() => {
    const byType = filterGamesByType(workspace.games, gameScope);
    return filterGamesBySeason(byType, season);
  }, [workspace.games, gameScope, season]);

  const playerRows = useMemo(() => {
    return workspace.players
      .map((player) => {
        const batting = computeBattingLine(scopedGames, player.id);
        const fielding = computeFieldingLine(scopedGames, player.id);
        const pitching = player.profile.profileType === "pitcher"
          ? computePitchingLine(scopedGames, player.id)
          : null;
        return { player, batting, pitching, fielding };
      })
      .filter((r) => r.batting.G > 0 || (r.pitching && r.pitching.G > 0) || r.fielding.G > 0)
      .sort((a, b) => {
        switch (playerSortKey) {
          case "H": return sortNumeric(a.batting.H, b.batting.H, playerSortDir);
          case "AVG": return sortStringAsNum(a.batting.AVG, b.batting.AVG, playerSortDir);
          case "OBP": return sortStringAsNum(a.batting.OBP, b.batting.OBP, playerSortDir);
          case "HR": return sortNumeric(a.batting.HR, b.batting.HR, playerSortDir);
          case "RBI": return sortNumeric(a.batting.RBI, b.batting.RBI, playerSortDir);
          case "OPS": return sortStringAsNum(a.batting.OPS, b.batting.OPS, playerSortDir);
          case "E": return sortNumeric(a.fielding.E, b.fielding.E, playerSortDir === "desc" ? "asc" : "desc");
          case "FPCT": return sortStringAsNum(a.fielding.FPCT, b.fielding.FPCT, playerSortDir);
          case "ERA": return sortStringAsNum(
            a.pitching?.ERA ?? "999.99",
            b.pitching?.ERA ?? "999.99",
            playerSortDir === "desc" ? "asc" : "desc",
          );
          case "WHIP": return sortStringAsNum(
            a.pitching?.WHIP ?? "999.99",
            b.pitching?.WHIP ?? "999.99",
            playerSortDir === "desc" ? "asc" : "desc",
          );
          case "SO_PITCHING": return sortNumeric(
            a.pitching?.SO ?? 0,
            b.pitching?.SO ?? 0,
            playerSortDir,
          );
          case "W": return sortNumeric(
            a.pitching?.W ?? 0,
            b.pitching?.W ?? 0,
            playerSortDir,
          );
          case "SV": return sortNumeric(
            a.pitching?.SV ?? 0,
            b.pitching?.SV ?? 0,
            playerSortDir,
          );
          case "G":
          default: return sortNumeric(a.batting.G, b.batting.G, playerSortDir);
        }
      });
  }, [workspace.players, scopedGames, playerSortKey, playerSortDir]);

  function handlePlayerSort(key: PlayerSortKey) {
    if (playerSortKey === key) {
      setPlayerSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setPlayerSortKey(key);
      setPlayerSortDir(key === "ERA" || key === "WHIP" || key === "E" ? "asc" : "desc");
    }
  }

  function sortIndicator(dir: SortDir | null) {
    if (!dir) return null;
    return <span className={styles.sortDir}>{dir === "desc" ? "▾" : "▴"}</span>;
  }

  const activePlayerSort = (key: PlayerSortKey): SortDir | null =>
    playerSortKey === key ? playerSortDir : null;

  const teamOfficialGames = useMemo(
    () => filterGamesByType(filterGamesBySeason(workspace.games, season), "official").length,
    [workspace.games, season],
  );

  // Only active players (non-graduated) compete for current season awards
  const activePlayerRows = useMemo(
    () => playerRows.filter((r) => r.player.status !== "graduated"),
    [playerRows],
  );

  const leaders = useMemo(() => {
    const minPA = teamOfficialGames * 1.5;

    const hitKing = activePlayerRows.reduce<(typeof playerRows)[number] | null>((best, row) => {
      if (!best || row.batting.H > best.batting.H) return row;
      return best;
    }, null);

    const hrKing = activePlayerRows.reduce<(typeof playerRows)[number] | null>((best, row) => {
      if (!best || row.batting.HR > best.batting.HR) return row;
      return best;
    }, null);

    const rbiKing = activePlayerRows.reduce<(typeof playerRows)[number] | null>((best, row) => {
      if (!best || row.batting.RBI > best.batting.RBI) return row;
      return best;
    }, null);

    const onBaseCandidates = activePlayerRows.filter((row) => row.batting.PA >= minPA);
    const onBaseKing = onBaseCandidates.reduce<(typeof playerRows)[number] | null>((best, row) => {
      if (!best || Number.parseFloat(row.batting.OBP) > Number.parseFloat(best.batting.OBP)) {
        return row;
      }
      return best;
    }, null);

    const strikeoutKing = activePlayerRows.reduce<(typeof playerRows)[number] | null>((best, row) => {
      const currentSo = row.pitching?.SO ?? 0;
      const bestSo = best?.pitching?.SO ?? -1;
      if (currentSo > bestSo) return row;
      return best;
    }, null);

    const winsKing = activePlayerRows.reduce<(typeof playerRows)[number] | null>((best, row) => {
      const currentW = row.pitching?.W ?? 0;
      const bestW = best?.pitching?.W ?? -1;
      if (currentW > bestW) return row;
      return best;
    }, null);

    return { hitKing, hrKing, rbiKing, onBaseKing, strikeoutKing, winsKing };
  }, [activePlayerRows, teamOfficialGames]);

  // ── Games list ──
  const sortedGames = useMemo(
    () => [...scopedGames].sort((a, b) => b.date.localeCompare(a.date)),
    [scopedGames],
  );

  // ── Game operations ──
  function handleAddGame(game: Game) {
    handleSave((current) => {
      const next = cloneWorkspace(current);
      next.games = [...current.games, game];
      return next;
    }, (_nextWorkspace, currentVersion) => createGame(game, currentVersion));
    setDialog({ type: "closed" });
  }

  function handleEditGame(game: Game) {
    handleSave((current) => {
      const next = cloneWorkspace(current);
      next.games = current.games.map((g) => (g.id === game.id ? game : g));
      return next;
    }, (_nextWorkspace, currentVersion) => updateGame(game, currentVersion));
    setDialog({ type: "closed" });
  }

  function handleDeleteGame(gameId: string) {
    if (!window.confirm("确认删除该场比赛？")) return;
    handleSave((current) => {
      const next = cloneWorkspace(current);
      next.games = current.games.filter((g) => g.id !== gameId);
      return next;
    }, (_nextWorkspace, currentVersion) => deleteGame(gameId, currentVersion));
  }

  return (
    <ToastProvider toastRef={toastRef}>
      <AppShell
        eyebrow="Data Center"
        title="数据中心"
        description="球员统计与比赛记录管理。"
        statusLabel="工作区"
        statusValue={`v${version}`}
        statusMeta={isSaving ? "保存中…" : ""}
        navItems={[...NAV_ITEMS]}
      >
        {/* Filters */}
        <div className={styles.filterBar}>
          <select
            className={styles.filterSelect}
            value={gameScope}
            onChange={(e) => setGameScope(e.target.value as StatsGameScope)}
          >
            <option value="all">全部比赛</option>
            <option value="official">正式比赛</option>
            <option value="training">训练比赛</option>
          </select>
          <select
            className={styles.filterSelect}
            value={season ?? ""}
            onChange={(e) => setSeason(e.target.value || null)}
          >
            <option value="">全部赛季</option>
            {seasons.map((s) => (
              <option key={s} value={s}>{s} 赛季</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={tab === "players" ? styles.tabActive : styles.tab}
            onClick={() => setTab("players")}
          >
            球员数据
          </button>
          <button
            className={tab === "games" ? styles.tabActive : styles.tab}
            onClick={() => setTab("games")}
          >
            比赛数据
          </button>
          <button
            className={tab === "glossary" ? styles.tabActive : styles.tab}
            onClick={() => setTab("glossary" as TabType)}
          >
            统计说明
          </button>
        </div>

        <div className={styles.saveBar}>
          {saveError && <span className={styles.saveError}>{saveError}</span>}
          {isSaving && <span className={styles.saveStatus}>保存中…</span>}
        </div>

        {/* TAB: Players */}
        {tab === "players" && (
          <>
            {/* ── Leaderboard ── */}
            {playerRows.length > 0 && (
              <div className={styles.leaderboardGrid}>
                {leaders.hitKing && (
                  <div className={styles.leaderCard}>
                    <div className={styles.leaderIcon}>&#x1F3C6;</div>
                    <div className={styles.leaderLabel}>安打王</div>
                    <div className={styles.leaderName}>{leaders.hitKing.player.name}</div>
                    <div className={styles.leaderStat}>H: {leaders.hitKing.batting.H}</div>
                  </div>
                )}
                {leaders.hrKing && leaders.hrKing.batting.HR > 0 && (
                  <div className={styles.leaderCard}>
                    <div className={styles.leaderIcon}>&#x1F4A3;</div>
                    <div className={styles.leaderLabel}>本垒打王</div>
                    <div className={styles.leaderName}>{leaders.hrKing.player.name}</div>
                    <div className={styles.leaderStat}>HR: {leaders.hrKing.batting.HR}</div>
                  </div>
                )}
                {leaders.rbiKing && leaders.rbiKing.batting.RBI > 0 && (
                  <div className={styles.leaderCard}>
                    <div className={styles.leaderIcon}>&#x1F3AF;</div>
                    <div className={styles.leaderLabel}>打点王</div>
                    <div className={styles.leaderName}>{leaders.rbiKing.player.name}</div>
                    <div className={styles.leaderStat}>RBI: {leaders.rbiKing.batting.RBI}</div>
                  </div>
                )}
                {leaders.onBaseKing && (
                  <div className={styles.leaderCard}>
                    <div className={styles.leaderIcon}>&#x1F3C3;</div>
                    <div className={styles.leaderLabel}>上垒王</div>
                    <div className={styles.leaderName}>{leaders.onBaseKing.player.name}</div>
                    <div className={styles.leaderStat}>OBP: {leaders.onBaseKing.batting.OBP}</div>
                  </div>
                )}
                {leaders.strikeoutKing && leaders.strikeoutKing.pitching && leaders.strikeoutKing.pitching.SO > 0 && (
                  <div className={styles.leaderCard}>
                    <div className={styles.leaderIcon}>&#x26A1;</div>
                    <div className={styles.leaderLabel}>三振王</div>
                    <div className={styles.leaderName}>{leaders.strikeoutKing.player.name}</div>
                    <div className={styles.leaderStat}>SO: {leaders.strikeoutKing.pitching.SO}</div>
                  </div>
                )}
                {leaders.winsKing && leaders.winsKing.pitching && leaders.winsKing.pitching.W > 0 && (
                  <div className={styles.leaderCard}>
                    <div className={styles.leaderIcon}>&#x2B50;</div>
                    <div className={styles.leaderLabel}>多胜王</div>
                    <div className={styles.leaderName}>{leaders.winsKing.player.name}</div>
                    <div className={styles.leaderStat}>W: {leaders.winsKing.pitching.W}</div>
                  </div>
                )}
              </div>
            )}

            {playerRows.length === 0 ? (
              <div className={styles.tableWrap}>
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>暂无球员统计数据</p>
                </div>
              </div>
            ) : (
              <>
                {/* 打击数据 */}
                <div className={styles.tableWrap}>
                  <div className={styles.sectionHeader}>打击数据</div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>球员</th>
                        <th className={styles.sortable} onClick={() => handlePlayerSort("G")}>G{sortIndicator(activePlayerSort("G"))}</th>
                        <th className={styles.sortable} onClick={() => handlePlayerSort("H")}>H{sortIndicator(activePlayerSort("H"))}</th>
                        <th className={styles.sortable} onClick={() => handlePlayerSort("AVG")}>AVG{sortIndicator(activePlayerSort("AVG"))}</th>
                        <th className={styles.sortable} onClick={() => handlePlayerSort("OBP")}>OBP{sortIndicator(activePlayerSort("OBP"))}</th>
                        <th className={styles.sortable} onClick={() => handlePlayerSort("HR")}>HR{sortIndicator(activePlayerSort("HR"))}</th>
                        <th className={styles.sortable} onClick={() => handlePlayerSort("RBI")}>RBI{sortIndicator(activePlayerSort("RBI"))}</th>
                        <th className={styles.sortable} onClick={() => handlePlayerSort("OPS")}>OPS{sortIndicator(activePlayerSort("OPS"))}</th>
                        <th>SO</th>
                        <th>SB</th>
                        <th>BB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerRows.map(({ player, batting }) => (
                        <tr key={player.id}>
                          <td>
                            <span className={styles.playerName}>{player.name}</span>
                            <span className={styles.playerMeta}>#{player.number}</span>
                          </td>
                          <td>{batting.G}</td>
                          <td>{batting.H}</td>
                          <td>{batting.AVG}</td>
                          <td>{batting.OBP}</td>
                          <td>{batting.HR}</td>
                          <td>{batting.RBI}</td>
                          <td>{batting.OPS}</td>
                          <td>{batting.SO || "-"}</td>
                          <td>{batting.SB || "-"}</td>
                          <td>{batting.BB || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 投球数据 */}
                <div className={styles.tableWrap}>
                  <div className={styles.sectionHeader}>投球数据</div>
                  {playerRows.filter((r) => r.pitching && r.pitching.G > 0).length === 0 ? (
                    <div className={styles.emptyState}>
                      <p className={styles.emptyText}>暂无投球数据</p>
                    </div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>球员</th>
                          <th className={styles.sortable} onClick={() => handlePlayerSort("G")}>G{sortIndicator(activePlayerSort("G"))}</th>
                          <th>IP</th>
                          <th className={styles.sortable} onClick={() => handlePlayerSort("W")}>W{sortIndicator(activePlayerSort("W"))}</th>
                          <th className={styles.sortable} onClick={() => handlePlayerSort("SV")}>SV{sortIndicator(activePlayerSort("SV"))}</th>
                          <th className={styles.sortable} onClick={() => handlePlayerSort("ERA")}>ERA{sortIndicator(activePlayerSort("ERA"))}</th>
                          <th className={styles.sortable} onClick={() => handlePlayerSort("WHIP")}>WHIP{sortIndicator(activePlayerSort("WHIP"))}</th>
                          <th className={styles.sortable} onClick={() => handlePlayerSort("SO_PITCHING")}>SO{sortIndicator(activePlayerSort("SO_PITCHING"))}</th>
                          <th>K/9</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playerRows.filter((r) => r.pitching && r.pitching.G > 0).map(({ player, pitching }) => (
                          <tr key={player.id}>
                            <td>
                              <span className={styles.playerName}>{player.name}</span>
                              <span className={styles.playerMeta}>#{player.number}</span>
                            </td>
                            <td>{pitching!.G}</td>
                            <td>{pitching!.IP}</td>
                            <td>{pitching!.W || "-"}</td>
                            <td>{pitching!.SV || "-"}</td>
                            <td>{pitching!.ERA}</td>
                            <td>{pitching!.WHIP}</td>
                            <td>{pitching!.SO || "-"}</td>
                            <td>{pitching!.K9}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 守备数据 */}
                <div className={styles.tableWrap}>
                  <div className={styles.sectionHeader}>守备数据</div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>球员</th>
                        <th>G</th>
                        <th>PO</th>
                        <th>A</th>
                        <th className={styles.sortable} onClick={() => handlePlayerSort("E")}>E{sortIndicator(activePlayerSort("E"))}</th>
                        <th>TC</th>
                        <th className={styles.sortable} onClick={() => handlePlayerSort("FPCT")}>FPCT{sortIndicator(activePlayerSort("FPCT"))}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerRows.filter((r) => r.fielding.G > 0).map(({ player, fielding }) => (
                        <tr key={player.id}>
                          <td>
                            <span className={styles.playerName}>{player.name}</span>
                            <span className={styles.playerMeta}>#{player.number}</span>
                          </td>
                          <td>{fielding.G}</td>
                          <td>{fielding.PO}</td>
                          <td>{fielding.A}</td>
                          <td>{fielding.E || "-"}</td>
                          <td>{fielding.TC}</td>
                          <td>{fielding.FPCT}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* TAB: Games */}
        {tab === "games" && (
          <div className={styles.tableWrap}>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 0" }}>
              <button
                className={styles.btnSmall}
                onClick={() => setDialog({ type: "add" })}
                disabled={isSaving}
              >
                ＋ 添加比赛
              </button>
            </div>

            {sortedGames.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>暂无比赛记录</p>
                <p className={styles.emptySub}>点击上方「添加比赛」录入第一场比赛</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>对手</th>
                    <th>类型</th>
                    <th>局数</th>
                    <th>每局概况</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedGames.map((game) => {
                    const isExpanded = expandedGameId === game.id;
                    const inningSummary = game.innings
                      .map((inn) => `${inn.inning}回:${inn.hits}安${inn.runs}得`)
                      .join(" · ");
                    return (
                      <Fragment key={game.id}>
                        <tr
                          key={game.id}
                          className={isExpanded ? styles.expanded : undefined}
                          onClick={() => setExpandedGameId(isExpanded ? null : game.id)}
                        >
                          <td>{game.date}</td>
                          <td>{game.opponent}</td>
                          <td>
                            <span className={game.gameType === "official" ? styles.gameTypeOfficial : styles.gameTypeTraining}>
                              {game.gameType === "official" ? "正式" : "训练"}
                            </span>
                          </td>
                          <td>{game.totalInnings}</td>
                          <td style={{ fontSize: "11px", color: "var(--theme-muted)" }}>{inningSummary}</td>
                          <td>
                            <div className={styles.gameLogActions} onClick={(e) => e.stopPropagation()}>
                              <button className={styles.btnSmall} onClick={() => setDialog({ type: "edit", game })} disabled={isSaving}>编辑</button>
                              <button className={styles.btnSmallDanger} onClick={() => handleDeleteGame(game.id)} disabled={isSaving}>删除</button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className={styles.expandedRow}>
                            <td colSpan={6} className={styles.expandedCell}>
                              <div className={styles.expandedPanel}>
                                <div className={styles.expandedHeader}>
                                  <span className={styles.expandedTitle}>每局详情</span>
                                </div>
                                <table className={styles.gameLog}>
                                  <thead>
                                    <tr>
                                      <th>局次</th>
                                      <th>安打</th>
                                      <th>得分</th>
                                      <th>上场打者</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {game.innings.map((inn) => {
                                      const batterNames = inn.batters
                                        .map((id) => workspace.players.find((p) => p.id === id)?.name ?? id)
                                        .join("、");
                                      return (
                                        <tr key={inn.inning}>
                                          <td>{inn.inning}回</td>
                                          <td>{inn.hits}</td>
                                          <td>{inn.runs}</td>
                                          <td style={{ fontSize: "12px" }}>{batterNames || "-"}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>

                                {game.statLines.length > 0 && (
                                  <>
                                    <div className={styles.expandedHeader}>
                                      <span className={styles.expandedTitle}>球员本场数据</span>
                                    </div>
                                    {/* 打击 */}
                                    <div className={styles.subSectionLabel}>打击</div>
                                    <table className={styles.gameLog}>
                                      <thead>
                                        <tr>
                                          <th>球员</th>
                                          <th>PA</th>
                                          <th>AB</th>
                                          <th>H</th>
                                          <th>2B</th>
                                          <th>3B</th>
                                          <th>HR</th>
                                          <th>RBI</th>
                                          <th>R</th>
                                          <th>BB</th>
                                          <th>SO</th>
                                          <th>SB</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {game.statLines.map((sl) => {
                                          const p = workspace.players.find((x) => x.id === sl.playerId);
                                          const hasBatting = sl.pa > 0 || sl.ab > 0;
                                          if (!hasBatting) return null;
                                          return (
                                            <tr key={`bat-${sl.playerId}`}>
                                              <td>{p?.name ?? sl.playerId}</td>
                                              <td>{sl.pa}</td>
                                              <td>{sl.ab}</td>
                                              <td>{sl.h}</td>
                                              <td>{sl.doubles || "-"}</td>
                                              <td>{sl.triples || "-"}</td>
                                              <td>{sl.hr || "-"}</td>
                                              <td>{sl.rbi || "-"}</td>
                                              <td>{sl.r || "-"}</td>
                                              <td>{sl.bb || "-"}</td>
                                              <td>{sl.so || "-"}</td>
                                              <td>{sl.sb || "-"}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                    {/* 投球 */}
                                    {game.statLines.some((sl) => sl.ip !== null && (sl.ip ?? 0) > 0) && (
                                      <>
                                        <div className={styles.subSectionLabel}>投球</div>
                                        <table className={styles.gameLog}>
                                          <thead>
                                            <tr>
                                              <th>球员</th>
                                              <th>IP</th>
                                              <th>ER</th>
                                              <th>SO</th>
                                              <th>BB</th>
                                              <th>H</th>
                                              <th>W</th>
                                              <th>L</th>
                                              <th>SV</th>
                                              <th>NP</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {game.statLines.map((sl) => {
                                              const p = workspace.players.find((x) => x.id === sl.playerId);
                                              if (!sl.ip || sl.ip <= 0) return null;
                                              return (
                                                <tr key={`pit-${sl.playerId}`}>
                                                  <td>{p?.name ?? sl.playerId}</td>
                                                  <td>{sl.ip}</td>
                                                  <td>{sl.er ?? "-"}</td>
                                                  <td>{sl.soPitching ?? "-"}</td>
                                                  <td>{sl.bbPitching ?? "-"}</td>
                                                  <td>{sl.hPitching ?? "-"}</td>
                                                  <td>{sl.w || "-"}</td>
                                                  <td>{sl.l || "-"}</td>
                                                  <td>{sl.sv || "-"}</td>
                                                  <td>{sl.np || "-"}</td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </>
                                    )}
                                    {/* 守备 */}
                                    <div className={styles.subSectionLabel}>守备</div>
                                    <table className={styles.gameLog}>
                                      <thead>
                                        <tr>
                                          <th>球员</th>
                                          <th>PO</th>
                                          <th>A</th>
                                          <th>E</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {game.statLines.map((sl) => {
                                          const p = workspace.players.find((x) => x.id === sl.playerId);
                                          return (
                                            <tr key={`fld-${sl.playerId}`}>
                                              <td>{p?.name ?? sl.playerId}</td>
                                              <td>{sl.po || "-"}</td>
                                              <td>{sl.a || "-"}</td>
                                              <td>{sl.e || "-"}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB: Glossary */}
        {tab === "glossary" && (
          <div className={styles.tableWrap}>
            <StatsGlossary />
          </div>
        )}
      </AppShell>

      {/* Game Dialog */}
      {dialog.type !== "closed" && (
        <GameDialog
          mode={dialog.type === "add" ? "add" : "edit"}
          initial={dialog.type === "edit" ? structuredClone(dialog.game) : emptyGame(workspace.players.map((p) => p.id))}
          players={workspace.players}
          onSubmit={dialog.type === "add" ? handleAddGame : handleEditGame}
          onClose={() => setDialog({ type: "closed" })}
          disabled={isSaving}
        />
      )}
    </ToastProvider>
  );
}

// ── Stats Glossary ──

type GlossaryRow = {
  abbr: string;
  chinese: string;
  input: string;
  formula: string;
};

function StatsGlossary() {
  const battingGlossary: GlossaryRow[] = [
    { abbr: "G", chinese: "出场", input: "自动从比赛记录统计", formula: "球员有 statLine 记录的比赛场数" },
    { abbr: "PA", chinese: "打席", input: "每场手动输入", formula: "打者上场打击的总次数" },
    { abbr: "AB", chinese: "打数", input: "每场手动输入", formula: "PA 中扣除四坏球、触身球、牺牲飞球、牺牲触击后的次数" },
    { abbr: "H", chinese: "安打", input: "每场手动输入", formula: "打者击球后安全上垒的次数" },
    { abbr: "1B", chinese: "一垒打", input: "自动计算", formula: "H - 2B - 3B - HR" },
    { abbr: "2B", chinese: "二垒打", input: "每场手动输入", formula: "打者击球后安全到达二垒" },
    { abbr: "3B", chinese: "三垒打", input: "每场手动输入", formula: "打者击球后安全到达三垒" },
    { abbr: "HR", chinese: "本垒打", input: "每场手动输入", formula: "打者击球后跑回本垒得分" },
    { abbr: "RBI", chinese: "打点", input: "每场手动输入", formula: "打者击球造成跑者回本垒得分的次数" },
    { abbr: "R", chinese: "得分", input: "每场手动输入", formula: "打者自己跑回本垒得分的次数" },
    { abbr: "SB", chinese: "盗垒", input: "每场手动输入", formula: "打者在投手投球时成功推进一个垒包" },
    { abbr: "BB", chinese: "四坏球", input: "每场手动输入", formula: "投手投出4个坏球，打者保送上一垒" },
    { abbr: "HBP", chinese: "触身球", input: "每场手动输入", formula: "投手投球击中打者身体，打者保送上一垒" },
    { abbr: "SF", chinese: "牺牲飞球", input: "每场手动输入", formula: "打者击出外野飞球被接杀，但三垒跑者回本垒得分" },
    { abbr: "SO", chinese: "三振", input: "每场手动输入", formula: "打者被投手三振出局的次数（打击视角）" },
    { abbr: "AVG", chinese: "打击率", input: "自动计算", formula: "H ÷ AB，例：3安打/10打数 = .300" },
    { abbr: "OBP", chinese: "上垒率", input: "自动计算", formula: "(H + BB + HBP) ÷ (AB + BB + HBP + SF)" },
    { abbr: "SLG", chinese: "长打率", input: "自动计算", formula: "(1B + 2×2B + 3×3B + 4×HR) ÷ AB" },
    { abbr: "OPS", chinese: "攻击指数", input: "自动计算", formula: "OBP + SLG，综合衡量打者攻击能力" },
    { abbr: "TOB", chinese: "上垒次数", input: "自动计算", formula: "H + BB + HBP" },
  ];

  const pitchingGlossary: GlossaryRow[] = [
    { abbr: "IP", chinese: "投球局数", input: "每场手动输入", formula: "投手投球的局数。X.0=整局，X.1=1/3局，X.2=2/3局。例如5.2=5又2/3局" },
    { abbr: "ER", chinese: "自责分", input: "每场手动输入", formula: "因投手自身原因造成的失分" },
    { abbr: "H (投)", chinese: "被安打", input: "每场手动输入", formula: "投手被对手击出的安打数" },
    { abbr: "BB (投)", chinese: "四坏球", input: "每场手动输入", formula: "投手投出的四坏球保送次数" },
    { abbr: "SO (投)", chinese: "夺三振", input: "每场手动输入", formula: "投手使打者三振出局的次数" },
    { abbr: "W", chinese: "胜投", input: "每场手动输入", formula: "投手获得胜投的次数" },
    { abbr: "L", chinese: "败投", input: "每场手动输入", formula: "投手承担败投的次数" },
    { abbr: "SV", chinese: "救援成功", input: "每场手动输入", formula: "后援投手在领先情况下完成比赛并获得救援成功" },
    { abbr: "NP", chinese: "投球数", input: "每场手动输入", formula: "投手在该场比赛的总投球数" },
    { abbr: "ERA", chinese: "防御率", input: "自动计算", formula: "(ER × 9) ÷ IP，例：(2自责分×9)÷6局=3.00" },
    { abbr: "WHIP", chinese: "每局被上垒率", input: "自动计算", formula: "(H + BB) ÷ IP，衡量投手压制打者能力" },
    { abbr: "K/9", chinese: "每九局三振率", input: "自动计算", formula: "(SO × 9) ÷ IP" },
    { abbr: "BB/9", chinese: "每九局保送率", input: "自动计算", formula: "(BB × 9) ÷ IP" },
  ];

  const fieldingGlossary: GlossaryRow[] = [
    { abbr: "PO", chinese: "刺殺", input: "每场手动输入", formula: "野手直接使跑者出局的次数（如接杀、触杀）" },
    { abbr: "A", chinese: "助杀", input: "每场手动输入", formula: "野手传球协助完成出局的次数" },
    { abbr: "E", chinese: "失误", input: "每场手动输入", formula: "野手防守失误导致打者/跑者安全上垒" },
    { abbr: "TC", chinese: "守备机会", input: "自动计算", formula: "PO + A + E" },
    { abbr: "FPCT", chinese: "守备率", input: "自动计算", formula: "(PO + A) ÷ TC，例：(16+4)÷21=.952" },
  ];

  return (
    <div style={{ padding: "20px 24px" }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>统计指标说明</h3>
      <p style={{ fontSize: 13, color: "var(--theme-muted)", marginBottom: 20, lineHeight: 1.5 }}>
        下表列出数据中心涉及的所有棒球统计指标及其计算方式。
        <br />
        「手动输入」= 在比赛编辑对话框中逐场填写；「自动计算」= 系统根据原始数据实时汇总得出。
      </p>

      <GlossaryTable title="打击指标" rows={battingGlossary} />
      <GlossaryTable title="投球指标" rows={pitchingGlossary} />
      <GlossaryTable title="守备指标" rows={fieldingGlossary} />

      <h4 style={{ fontSize: 14, fontWeight: 700, marginTop: 24, marginBottom: 8 }}>榜单门槛</h4>
      <p style={{ fontSize: 13, color: "var(--theme-muted)", lineHeight: 1.5 }}>
        上垒王（OBP）和打击王（AVG）等比率榜单设有最低打席门槛：
        球员打席数（PA）需 ≥ 球队当前赛季正式比赛场数 × 1.5，以防止低样本霸榜。
      </p>
    </div>
  );
}

function GlossaryTable({ title, rows }: { title: string; rows: GlossaryRow[] }) {
  return (
    <>
      <h4 style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 8, color: "var(--theme-accent)" }}>{title}</h4>
      <table className="gameLog" style={{ width: "100%", marginBottom: 8 }}>
        <thead>
          <tr>
            <th style={{ width: 72 }}>缩写</th>
            <th style={{ width: 80 }}>中文</th>
            <th style={{ width: 120 }}>数据来源</th>
            <th>计算公式</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.abbr}>
              <td style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.abbr}</td>
              <td>{r.chinese}</td>
              <td style={{ fontSize: 12, color: "var(--theme-muted)" }}>{r.input}</td>
              <td style={{ fontSize: 13 }}>{r.formula}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ── Two‑col input for game dialog ──

function TwoColField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: string | number;
  onChange: (raw: string) => void;
  step?: string;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{
        fontWeight: 600, color: "var(--theme-muted)", minWidth: 72, textAlign: "right",
        whiteSpace: "nowrap",
      }}>{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1, padding: "5px 8px", border: "1px solid var(--theme-border)",
          borderRadius: 4, background: "var(--theme-surface)", color: "var(--theme-fg)",
          font: "inherit", fontSize: 12, maxWidth: 100,
        }}
      />
    </label>
  );
}

// ── Game Dialog ──

type GameDialogProps = {
  mode: "add" | "edit";
  initial: Game;
  players: Player[];
  onSubmit: (game: Game) => void;
  onClose: () => void;
  disabled?: boolean;
};

function GameDialog({
  mode,
  initial,
  players,
  onSubmit,
  onClose,
  disabled = false,
}: GameDialogProps) {
  const [game, setGame] = useState<Game>(initial);
  const [step, setStep] = useState<"info" | "innings" | "stats">("info");
  const [error, setError] = useState("");
  const title = mode === "add" ? "新增比赛" : "编辑比赛";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!game.date || !game.opponent) {
      setError("日期和对手不能为空");
      return;
    }
    setError("");
    onSubmit(game);
  }

  function updateInning(inning: number, field: Partial<InningRecord>) {
    setGame((prev) => ({
      ...prev,
      innings: prev.innings.map((inn) =>
        inn.inning === inning ? { ...inn, ...field } : inn,
      ),
    }));
  }

  function toggleBatter(inning: number, playerId: string) {
    setGame((prev) => ({
      ...prev,
      innings: prev.innings.map((inn) => {
        if (inn.inning !== inning) return inn;
        const has = inn.batters.includes(playerId);
        return {
          ...inn,
          batters: has
            ? inn.batters.filter((id) => id !== playerId)
            : [...inn.batters, playerId],
        };
      }),
    }));
  }

  function updateStatLine(playerId: string, field: Partial<PlayerGameStatLine>) {
    setGame((prev) => ({
      ...prev,
      statLines: prev.statLines.map((sl) =>
        sl.playerId === playerId ? { ...sl, ...field } : sl,
      ),
    }));
  }

  function updateStatNum(playerId: string, key: keyof PlayerGameStatLine, value: string) {
    const n = value === "" ? 0 : Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    updateStatLine(playerId, { [key]: n } as Partial<PlayerGameStatLine>);
  }

  function updateStatNullable(playerId: string, key: keyof PlayerGameStatLine, value: string) {
    if (value === "") {
      updateStatLine(playerId, { [key]: null } as Partial<PlayerGameStatLine>);
      return;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    updateStatLine(playerId, { [key]: n } as Partial<PlayerGameStatLine>);
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.dialog} role="dialog" aria-label={title}>
        <header className={styles.dialogHeader}>
          <h3>{title}</h3>
          <div style={{ display: "flex", gap: 4 }}>
            <button className={step === "info" ? styles.btnPrimary : styles.btnSecondary} type="button" onClick={() => setStep("info")} style={{ padding: "4px 12px", fontSize: 11 }}>比赛信息</button>
            <button className={step === "innings" ? styles.btnPrimary : styles.btnSecondary} type="button" onClick={() => setStep("innings")} style={{ padding: "4px 12px", fontSize: 11 }}>每局数据</button>
            <button className={step === "stats" ? styles.btnPrimary : styles.btnSecondary} type="button" onClick={() => setStep("stats")} style={{ padding: "4px 12px", fontSize: 11 }}>球员统计</button>
          </div>
          <button className={styles.dialogClose} onClick={onClose} type="button" aria-label="关闭">×</button>
        </header>
        <form onSubmit={handleSubmit} className={styles.dialogForm}>
          {step === "info" && (
            <>
              <div className={styles.dialogRow}>
                <label className={styles.dialogField}>
                  <span>日期</span>
                  <input type="date" value={game.date} onChange={(e) => setGame((g) => ({ ...g, date: e.target.value }))} />
                </label>
                <label className={styles.dialogField}>
                  <span>对手</span>
                  <input value={game.opponent} onChange={(e) => setGame((g) => ({ ...g, opponent: e.target.value }))} maxLength={40} placeholder="队伍名" />
                </label>
                <label className={styles.dialogField}>
                  <span>类型</span>
                  <select value={game.gameType} onChange={(e) => setGame((g) => ({ ...g, gameType: e.target.value as "official" | "training" }))}>
                    <option value="official">正式比赛</option>
                    <option value="training">训练比赛</option>
                  </select>
                </label>
              </div>
              <label className={styles.dialogField}>
                <span>总局数</span>
                <input type="number" min="1" max="20" value={game.totalInnings} onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n > 0 && n <= 20) {
                    setGame((g) => ({
                      ...g,
                      totalInnings: n,
                      innings: Array.from({ length: n }, (_, i) => g.innings[i] ?? emptyInning(i + 1)),
                    }));
                  }
                }} />
              </label>
              <p style={{ fontSize: 11, color: "var(--theme-muted)" }}>
                备注 (可选)
              </p>
              <input
                value={game.note ?? ""}
                onChange={(e) => setGame((g) => ({ ...g, note: e.target.value }))}
                maxLength={200}
                placeholder="比赛备注…"
                style={{ padding: "8px 10px", border: "1px solid var(--theme-border)", borderRadius: 6, background: "var(--theme-surface-alt)", color: "var(--theme-fg)", font: "inherit", fontSize: 13 }}
              />
            </>
          )}

          {step === "innings" && (
            <div style={{ display: "grid", gap: 12, maxHeight: "50vh", overflowY: "auto" }}>
              {game.innings.map((inn) => (
                <div key={inn.inning} style={{ display: "grid", gap: 6, padding: "10px 12px", background: "var(--theme-surface-alt)", borderRadius: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--theme-muted)" }}>{inn.inning} 回</span>
                  <div className={styles.dialogRow}>
                    <label className={styles.dialogField}>
                      <span>安打</span>
                      <input type="number" min="0" value={inn.hits} onChange={(e) => updateInning(inn.inning, { hits: Number(e.target.value) || 0 })} />
                    </label>
                    <label className={styles.dialogField}>
                      <span>得分</span>
                      <input type="number" min="0" value={inn.runs} onChange={(e) => updateInning(inn.inning, { runs: Number(e.target.value) || 0 })} />
                    </label>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {players.map((p) => {
                      const selected = inn.batters.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleBatter(inn.inning, p.id)}
                          style={{
                            padding: "3px 10px",
                            borderRadius: 4,
                            border: `1px solid ${selected ? "var(--theme-accent)" : "var(--theme-border)"}`,
                            background: selected ? "color-mix(in srgb, var(--theme-accent) 12%, transparent)" : "var(--theme-surface)",
                            color: selected ? "var(--theme-accent)" : "var(--theme-muted)",
                            fontSize: 11,
                            fontWeight: selected ? 700 : 500,
                            cursor: "pointer",
                          }}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "stats" && (
            <div style={{ display: "grid", gap: 12, maxHeight: "50vh", overflowY: "auto" }}>
              {players.filter((p) => game.statLines.some((sl) => sl.playerId === p.id) || game.innings.some((inn) => inn.batters.includes(p.id))).map((p) => {
                const sl = game.statLines.find((s) => s.playerId === p.id) ?? emptyPlayerGameStatLine(p.id);
                return (
                  <div key={p.id} style={{ display: "grid", gap: 10, padding: "12px 14px", background: "var(--theme-surface-alt)", borderRadius: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--theme-fg)" }}>{p.name} #{p.number}</span>

                    {/* 打击 */}
                    <div className={styles.dialogSectionHeader}>打击</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
                      <TwoColField label="打席 PA" value={sl.pa} onChange={(v) => updateStatNum(p.id, "pa", v)} />
                      <TwoColField label="打数 AB" value={sl.ab} onChange={(v) => updateStatNum(p.id, "ab", v)} />
                      <TwoColField label="安打 H" value={sl.h} onChange={(v) => updateStatNum(p.id, "h", v)} />
                      <TwoColField label="本垒打 HR" value={sl.hr} onChange={(v) => updateStatNum(p.id, "hr", v)} />
                      <TwoColField label="打点 RBI" value={sl.rbi} onChange={(v) => updateStatNum(p.id, "rbi", v)} />
                      <TwoColField label="得分 R" value={sl.r} onChange={(v) => updateStatNum(p.id, "r", v)} />
                      <TwoColField label="盗垒 SB" value={sl.sb} onChange={(v) => updateStatNum(p.id, "sb", v)} />
                      <TwoColField label="四坏 BB" value={sl.bb} onChange={(v) => updateStatNum(p.id, "bb", v)} />
                      <TwoColField label="三振 SO" value={sl.so} onChange={(v) => updateStatNum(p.id, "so", v)} />
                    </div>

                    {/* 守备 */}
                    <div className={styles.dialogSectionHeader}>守备</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
                      <TwoColField label="刺殺 PO" value={sl.po} onChange={(v) => updateStatNum(p.id, "po", v)} />
                      <TwoColField label="助杀 A" value={sl.a} onChange={(v) => updateStatNum(p.id, "a", v)} />
                      <TwoColField label="失误 E" value={sl.e} onChange={(v) => updateStatNum(p.id, "e", v)} />
                    </div>

                    {/* 投球 */}
                    <div className={styles.dialogSectionHeader}>投球 (可选)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
                      <TwoColField label="局数 IP" value={sl.ip ?? ""} onChange={(v) => updateStatNullable(p.id, "ip", v)} step="0.1" />
                      <TwoColField label="自责分 ER" value={sl.er ?? ""} onChange={(v) => updateStatNullable(p.id, "er", v)} />
                      <TwoColField label="夺三振 SO" value={sl.soPitching ?? ""} onChange={(v) => updateStatNullable(p.id, "soPitching", v)} />
                      <TwoColField label="四坏 BB" value={sl.bbPitching ?? ""} onChange={(v) => updateStatNullable(p.id, "bbPitching", v)} />
                      <TwoColField label="被安打 H" value={sl.hPitching ?? ""} onChange={(v) => updateStatNullable(p.id, "hPitching", v)} />
                      <TwoColField label="胜投 W" value={sl.w ?? ""} onChange={(v) => updateStatNullable(p.id, "w", v)} />
                      <TwoColField label="败投 L" value={sl.l ?? ""} onChange={(v) => updateStatNullable(p.id, "l", v)} />
                      <TwoColField label="救援 SV" value={sl.sv ?? ""} onChange={(v) => updateStatNullable(p.id, "sv", v)} />
                      <TwoColField label="投球数 NP" value={sl.np ?? ""} onChange={(v) => updateStatNullable(p.id, "np", v)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && <div className={styles.dialogError}>{error}</div>}

          <div className={styles.dialogActions}>
            <button className={styles.btnSecondary} onClick={onClose} type="button">取消</button>
            <button className={styles.btnPrimary} type="submit" disabled={disabled}>{mode === "add" ? "添加" : "保存"}</button>
          </div>
        </form>
      </div>
    </>
  );
}
