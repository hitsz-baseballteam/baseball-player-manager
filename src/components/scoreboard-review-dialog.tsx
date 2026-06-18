"use client";

import { useMemo, useState } from "react";

import { finalizeGame, reopenGame, type ScoreboardGame } from "@/lib/scoreboard-actions";
import type { Game, Player, Workspace } from "@/lib/workspace";
import styles from "./scoreboard-review-dialog.module.css";

type ScoreboardReviewDialogProps = {
  game: ScoreboardGame;
  workspace: Workspace;
  onFinalize: (finalGame: Game) => void;
  onEdit: () => void;
  onCancel: () => void;
};

export function ScoreboardReviewDialog({
  game,
  workspace,
  onFinalize,
  onEdit,
  onCancel,
}: ScoreboardReviewDialogProps) {
  // Pitcher overrides: per-pitcher ER, NP, W, L, SV
  const [pitcherData, setPitcherData] = useState<Record<string, { er: string; np: string; w: string; l: string; sv: string }>>(() => {
    const data: Record<string, { er: string; np: string; w: string; l: string; sv: string }> = {};
    // Gather all pitchers who appeared
    const pitcherIds = new Set<string>();
    if (game.currentPitcherId) pitcherIds.add(game.currentPitcherId);
    for (const ch of game.pitcherChanges) pitcherIds.add(ch.newPitcherId);
    for (const id of pitcherIds) {
      data[id] = { er: "0", np: "0", w: "0", l: "0", sv: "0" };
    }
    return data;
  });
  const [error, setError] = useState("");

  const allPAs = useMemo(
    () => game.innings.flatMap((inn) => inn.plateAppearances),
    [game.innings],
  );

  function getPlayer(id: string): Player | undefined {
    return workspace.players.find((p) => p.id === id);
  }

  // Inning summary
  const inningSummaries = useMemo(() => {
    return game.innings.map((inn) => ({
      inning: inn.inning,
      runs: inn.plateAppearances.reduce((sum, pa) => sum + pa.runsScored, 0),
      hits: inn.plateAppearances.filter(
        (pa) => pa.result === "1B" || pa.result === "2B" || pa.result === "3B" || pa.result === "HR",
      ).length,
      errors: inn.plateAppearances.filter((pa) => pa.result === "ROE").length,
      pas: inn.plateAppearances.length,
    }));
  }, [game.innings]);

  // Batting summary by player
  const battingSummary = useMemo(() => {
    const map = new Map<string, { name: string; number: string; pa: number; ab: number; h: number; hr: number; rbi: number; r: number; bb: number; so: number }>();
    for (const pa of allPAs) {
      const player = getPlayer(pa.batterId);
      if (!player) continue;
      const entry = map.get(pa.batterId) ?? { name: player.name, number: player.number, pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, r: 0, bb: 0, so: 0 };
      entry.pa++;
      if (!["BB", "HBP", "SF", "SAC"].includes(pa.result)) entry.ab++;
      if (["1B", "2B", "3B", "HR"].includes(pa.result)) entry.h++;
      if (pa.result === "HR") entry.hr++;
      entry.rbi += pa.rbi;
      if (pa.result === "BB") entry.bb++;
      if (pa.result === "SO") entry.so++;
      // R is tracked differently — from statLines
      map.set(pa.batterId, entry);
    }

    // Add R from statLines
    for (const [id, sl] of Object.entries(game.statLines)) {
      const entry = map.get(id);
      if (entry && sl.r > 0) entry.r = sl.r;
    }

    return Array.from(map.values()).sort((a, b) => b.h - a.h);
  }, [allPAs, game.statLines, workspace.players]);

  function updatePitcher(id: string, field: "er" | "np" | "w" | "l" | "sv", value: string) {
    setPitcherData((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  function handleFinalize() {
    // Convert string values to numbers
    const overrides: Record<string, { er?: number; np?: number; w?: number; l?: number; sv?: number }> = {};
    for (const [id, data] of Object.entries(pitcherData)) {
      overrides[id] = {
        er: Number(data.er) || 0,
        np: Number(data.np) || 0,
        w: Number(data.w) || 0,
        l: Number(data.l) || 0,
        sv: Number(data.sv) || 0,
      };
    }

    try {
      const finalGame = finalizeGame(game, overrides);
      onFinalize(finalGame);
    } catch (err) {
      setError("生成比赛数据失败，请重试。");
      console.error(err);
    }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onCancel} />
      <div className={styles.dialog} role="dialog" aria-label="比赛确认">
        <header className={styles.dialogHeader}>
          <h3>比赛确认</h3>
          <button className={styles.dialogClose} onClick={onCancel} type="button">×</button>
        </header>

        <div className={styles.content}>
          {/* Inning summary table */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>每局概要</h4>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>局</th>
                  <th>得分</th>
                  <th>安打</th>
                  <th>失误</th>
                  <th>打席</th>
                </tr>
              </thead>
              <tbody>
                {inningSummaries.map((inn) => (
                  <tr key={inn.inning}>
                    <td>{inn.inning}</td>
                    <td>{inn.runs}</td>
                    <td>{inn.hits}</td>
                    <td>{inn.errors || "-"}</td>
                    <td>{inn.pas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Batting summary */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>打击成绩</h4>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>球员</th>
                  <th>PA</th>
                  <th>AB</th>
                  <th>H</th>
                  <th>HR</th>
                  <th>RBI</th>
                  <th>R</th>
                  <th>BB</th>
                  <th>SO</th>
                </tr>
              </thead>
              <tbody>
                {battingSummary.map((row) => (
                  <tr key={row.name}>
                    <td>
                      {row.name}
                      <span className={styles.playerNum}>#{row.number}</span>
                    </td>
                    <td>{row.pa}</td>
                    <td>{row.ab}</td>
                    <td>{row.h}</td>
                    <td>{row.hr || "-"}</td>
                    <td>{row.rbi || "-"}</td>
                    <td>{row.r || "-"}</td>
                    <td>{row.bb || "-"}</td>
                    <td>{row.so || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pitcher data form */}
          {Object.keys(pitcherData).length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>投手数据（手动补充）</h4>
              {Object.entries(pitcherData).map(([id, data]) => {
                const player = getPlayer(id);
                return (
                  <div key={id} className={styles.pitcherForm}>
                    <span className={styles.pitcherFormLabel}>
                      {player?.name ?? id} #{player?.number ?? ""}
                    </span>
                    <div className={styles.pitcherFields}>
                      <label className={styles.miniField}>
                        ER (自责分)
                        <input
                          type="number"
                          min="0"
                          value={data.er}
                          onChange={(e) => updatePitcher(id, "er", e.target.value)}
                        />
                      </label>
                      <label className={styles.miniField}>
                        NP (投球数)
                        <input
                          type="number"
                          min="0"
                          value={data.np}
                          onChange={(e) => updatePitcher(id, "np", e.target.value)}
                        />
                      </label>
                      <label className={styles.miniField}>
                        W (胜)
                        <input
                          type="number"
                          min="0"
                          max="1"
                          value={data.w}
                          onChange={(e) => updatePitcher(id, "w", e.target.value)}
                        />
                      </label>
                      <label className={styles.miniField}>
                        L (败)
                        <input
                          type="number"
                          min="0"
                          max="1"
                          value={data.l}
                          onChange={(e) => updatePitcher(id, "l", e.target.value)}
                        />
                      </label>
                      <label className={styles.miniField}>
                        SV (救援)
                        <input
                          type="number"
                          min="0"
                          max="1"
                          value={data.sv}
                          onChange={(e) => updatePitcher(id, "sv", e.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PA log */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              打席记录 ({allPAs.length})
            </h4>
            <div className={styles.paLog}>
              {allPAs.length === 0 ? (
                <p className={styles.emptyText}>暂无打席记录</p>
              ) : (
                allPAs.map((pa, idx) => {
                  const batter = getPlayer(pa.batterId);
                  return (
                    <div key={pa.id} className={styles.paRow}>
                      <span className={styles.paIdx}>{idx + 1}.</span>
                      <span className={styles.paBatter}>
                        {batter?.name ?? pa.batterId}
                      </span>
                      <span className={styles.paResult}>{resultLabel(pa.result)}</span>
                      {pa.runsScored > 0 && (
                        <span className={styles.paRuns}>+{pa.runsScored}分</span>
                      )}
                      {pa.rbi > 0 && (
                        <span className={styles.paRbi}>{pa.rbi}RBI</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={onCancel} type="button">放弃</button>
          <button className={styles.btnSecondary} onClick={onEdit} type="button">返回编辑</button>
          <button className={styles.btnPrimary} onClick={handleFinalize} type="button">完成录入</button>
        </div>
      </div>
    </>
  );
}

function resultLabel(result: string): string {
  const map: Record<string, string> = {
    "1B": "一安", "2B": "二安", "3B": "三安", "HR": "本打",
    "BB": "四坏", "HBP": "触身", "SO": "三振",
    "GO": "滚地", "FO": "飞球", "LO": "平飞",
    "DP": "双杀", "SF": "牺飞", "SAC": "牺触",
    "ROE": "失误", "FC": "野选",
  };
  return map[result] ?? result;
}
