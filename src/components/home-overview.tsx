import styles from "@/components/home-overview.module.css";
import {
  analyzeScenarioWarnings,
  getActiveScenario,
  getPlayer,
  POSITIONS,
  type Workspace,
} from "@/lib/workspace";

type HomeOverviewProps = {
  workspace: Workspace;
  remoteVersion: number;
  saveStatus: string;
  onAutoAssign: () => void;
  onAddPlayer: () => void;
  onImport: () => void;
  onCreateScenario: () => void;
  onExportWorkspace: () => void;
  onExportScenario: () => void;
  onRenameScenario: () => void;
  onDuplicateScenario: () => void;
  onClearAssignments: () => void;
  onScenarioChange: (scenarioId: string) => void;
  onOpenWorkspace: () => void;
  onOpenScenarioPanel: () => void;
  onOpenRosterPanel: () => void;
  onOpenFieldPanel: () => void;
  onOpenLineupPanel: () => void;
  onOpenWarningsPanel: () => void;
};


export function HomeOverview({
  workspace,
  onAutoAssign,
  onAddPlayer,
  onImport,
  onCreateScenario,
  onExportWorkspace,
  onExportScenario,
  onDuplicateScenario,
  onClearAssignments,
  onScenarioChange,
  onOpenFieldPanel,
  onOpenLineupPanel,
  onOpenWarningsPanel,
  onOpenRosterPanel,
  onOpenScenarioPanel,
}: HomeOverviewProps) {
  const activeScenario = getActiveScenario(workspace);
  const { critical, advisory } = analyzeScenarioWarnings(workspace, activeScenario);

  const availableCount = workspace.players.filter((p) => p.status === "available").length;
  const restCount = workspace.players.filter((p) => p.status === "rest").length;
  const injuredCount = workspace.players.filter((p) => p.status === "injured").length;
  const defenseAssignments = POSITIONS.map((pos) => ({
    ...pos,
    player: getPlayer(workspace, activeScenario.assignments.defense[pos.code]),
  }));
  const lineupAssignments = activeScenario.assignments.lineup.map((playerId, index) => ({
    slot: index + 1,
    player: getPlayer(workspace, playerId),
  }));
  const assignedDefenseCount = defenseAssignments.filter((e) => e.player).length;
  const assignedLineupCount = lineupAssignments.filter((e) => e.player).length;

  const hasCritical = critical.length > 0;

  return (
    <>
      {/* Status & Metrics Bar — single compact row */}
      <section className={styles.statusBar} aria-label="状态概览">
        <div className={styles.warningStrip}>
          {hasCritical ? (
            <button className={styles.warningChip} type="button" onClick={onOpenWarningsPanel}>
              <span className={styles.warningChipIcon}>!</span>
              {critical[0]}
            </button>
          ) : advisory.length > 0 ? (
            <button className={styles.warningChipSoft} type="button" onClick={onOpenWarningsPanel}>
              {advisory.length} 建议
            </button>
          ) : (
            <span className={styles.warningChipOk}>阵容可用</span>
          )}

          <button className={styles.metricPill} type="button" onClick={onOpenRosterPanel}>
            <span>可上场</span>
            <strong>{availableCount}</strong>
          </button>
          <button className={styles.metricPill} type="button" onClick={onOpenRosterPanel}>
            <span>轮休/伤停</span>
            <strong>{restCount + injuredCount}</strong>
          </button>
          <button className={styles.metricPill} type="button" onClick={onOpenFieldPanel}>
            <span>守位</span>
            <strong>{assignedDefenseCount}/9</strong>
          </button>
          <button className={styles.metricPill} type="button" onClick={onOpenLineupPanel}>
            <span>棒次</span>
            <strong>{assignedLineupCount}/9</strong>
          </button>
        </div>

        <div className={styles.scenarioSwitch}>
          <select
            className={styles.inlineSelect}
            value={activeScenario.id}
            onChange={(e) => onScenarioChange(e.currentTarget.value)}
            aria-label="切换方案"
          >
            {workspace.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button className={styles.inlineBtn} type="button" onClick={onOpenScenarioPanel}>
            管理方案
          </button>
        </div>
      </section>

      {/* Toolbar — compact action row */}
      <section className={styles.toolbar} aria-label="快捷动作">
        <button className={styles.btnPrimary} type="button" onClick={onAutoAssign}>
          自动排阵
        </button>
        <button className={styles.btnToolbar} type="button" onClick={onAddPlayer}>
          新增球员
        </button>
        <button className={styles.btnToolbar} type="button" onClick={onImport}>
          导入
        </button>
        <button className={styles.btnToolbar} type="button" onClick={onCreateScenario}>
          新建方案
        </button>
        <div className={styles.toolbarSpacer} />
        <button className={styles.btnToolbar} type="button" onClick={onDuplicateScenario}>
          复制方案
        </button>
        <button className={styles.btnToolbar} type="button" onClick={onExportScenario}>
          导出方案
        </button>
        <button className={styles.btnToolbar} type="button" onClick={onExportWorkspace}>
          导出工作区
        </button>
        <button className={styles.btnToolbar} type="button" onClick={onClearAssignments}>
          清空
        </button>
      </section>

      {/* Roster Grid — combined defense + batting overview */}
      <section className={styles.rosterGrid} aria-label="阵容概览">
        <div className={styles.rosterGridHeader}>
          <span>守位</span>
          <span>守备球员</span>
          <span>棒次</span>
          <span>打线</span>
        </div>
        {defenseAssignments.map((entry, i) => {
          const lineupEntry = lineupAssignments[i] ?? null;
          return (
            <button
              key={entry.code}
              className={styles.rosterRow}
              type="button"
              onClick={onOpenFieldPanel}
            >
              <span className={styles.positionCell}>
                <span className={styles.positionCode}>{entry.code}</span>
                <span className={styles.positionLabel}>{entry.label}</span>
              </span>
              <span className={styles.playerCell}>
                {entry.player?.name ?? <span className={styles.emptyCell}>待补位</span>}
              </span>
              <span className={styles.slotCell}>{lineupEntry?.slot ?? "-"}</span>
              <span className={styles.playerCell}>
                {lineupEntry?.player?.name ?? <span className={styles.emptyCell}>待定</span>}
              </span>
            </button>
          );
        })}
      </section>
    </>
  );
}

