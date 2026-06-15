import styles from "@/components/home-overview.module.css";
import {
  ArrowSquareOut,
  BaseballCap,
  CalendarDots,
  ClipboardText,
  Export,
  MagicWand,
  Plus,
  ShareNetwork,
  Trash,
  UserPlus,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
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
  const warnings = [
    ...critical.map((message) => ({ message, tone: "critical" as const })),
    ...advisory.map((message) => ({ message, tone: "advisory" as const })),
  ].slice(0, 3);
  const defensePositionByPlayer = Object.fromEntries(
    defenseAssignments
      .filter((entry) => entry.player)
      .map((entry) => [entry.player!.id, entry.code]),
  );

  return (
    <div className={styles.dashboard}>
      <section className={styles.scenarioBar} aria-label="当前方案">
        <div>
          <span className={styles.sectionKicker}>当前方案</span>
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
        </div>
        <div className={styles.scenarioSummary}>
          <span className={hasCritical ? styles.summaryDotDanger : styles.summaryDotOk} />
          <span>{hasCritical ? `${critical.length} 项需要处理` : "阵容可用"}</span>
        </div>
      </section>

      <div className={styles.primaryGrid}>
        <section className={styles.fieldCard} aria-labelledby="field-heading">
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.sectionKicker}>今日阵型</span>
              <h2 id="field-heading">守备阵型</h2>
            </div>
            <div className={styles.cardHeaderActions}>
              <button type="button" onClick={onOpenFieldPanel}>
                <BaseballCap size={18} weight="duotone" aria-hidden="true" />
                调整守备
              </button>
              <button type="button" onClick={onExportScenario}>
                <ShareNetwork size={18} weight="duotone" aria-hidden="true" />
                分享
              </button>
            </div>
          </div>

          <div className={styles.fieldBoard}>
            {defenseAssignments.map((entry) => (
              <button
                key={entry.code}
                className={styles.positionNode}
                style={{ left: `${entry.x}%`, top: `${entry.y}%` }}
                type="button"
                onClick={onOpenFieldPanel}
                aria-label={`${entry.label}：${entry.player?.name ?? "待补位"}`}
              >
                <span className={styles.positionCode}>{entry.code}</span>
                <span className={styles.positionPlayer}>
                  {entry.player ? (
                    <>
                      <strong>{entry.player.number}</strong>
                      <span>{entry.player.name}</span>
                      <small>{entry.player.throws}</small>
                    </>
                  ) : (
                    <span className={styles.emptyCell}>待补位</span>
                  )}
                </span>
              </button>
            ))}
            <button className={styles.clearField} type="button" onClick={onClearAssignments}>
              <Trash size={17} aria-hidden="true" />
              清空阵容
            </button>
          </div>
        </section>

        <div className={styles.rightRail}>
          <section className={styles.warningCard} aria-labelledby="warning-heading">
            <div className={styles.cardHeader}>
              <div className={styles.warningHeading}>
                <Warning size={23} weight="fill" aria-hidden="true" />
                <h2 id="warning-heading">阵容警报</h2>
              </div>
              <button className={styles.textAction} type="button" onClick={onOpenWarningsPanel}>
                查看全部 ({critical.length + advisory.length})
                <ArrowSquareOut size={15} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.warningList}>
              {warnings.length ? warnings.map((warning, index) => (
                <button
                  key={`${warning.message}-${index}`}
                  className={warning.tone === "critical" ? styles.warningItemCritical : styles.warningItem}
                  type="button"
                  onClick={onOpenWarningsPanel}
                >
                  <Warning size={20} weight={warning.tone === "critical" ? "fill" : "duotone"} aria-hidden="true" />
                  <span>{warning.message}</span>
                  <strong>{warning.tone === "critical" ? "处理" : "注意"}</strong>
                </button>
              )) : (
                <div className={styles.warningEmpty}>阵容状态良好，可以进入比赛准备。</div>
              )}
            </div>
          </section>

          <section className={styles.lineupCard} aria-labelledby="lineup-heading">
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.sectionKicker}>1–9 棒</span>
                <h2 id="lineup-heading">打击顺序</h2>
              </div>
              <button className={styles.textAction} type="button" onClick={onOpenLineupPanel}>
                <ClipboardText size={17} aria-hidden="true" />
                编辑打线
              </button>
            </div>
            <div className={styles.lineupHeader} aria-hidden="true">
              <span>棒次</span><span>球员</span><span>守位</span><span>打席</span>
            </div>
            <ol className={styles.lineupList}>
              {lineupAssignments.map((entry) => (
                <li key={entry.slot}>
                  <button type="button" onClick={onOpenLineupPanel}>
                    <strong className={styles.lineupSlot}>{entry.slot}</strong>
                    <span className={styles.lineupPlayer}>
                      {entry.player ? (
                        <>
                          <small>{entry.player.number}</small>
                          <strong>{entry.player.name}</strong>
                        </>
                      ) : <span className={styles.emptyCell}>待定</span>}
                    </span>
                    <span className={styles.lineupPosition}>
                      {entry.player ? defensePositionByPlayer[entry.player.id] ?? "—" : "—"}
                    </span>
                    <span className={styles.lineupHand}>{entry.player?.bats ?? "—"}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <section className={styles.metricsCard} aria-labelledby="metrics-heading">
          <div className={styles.compactHeading}>
            <UsersThree size={20} weight="duotone" aria-hidden="true" />
            <h2 id="metrics-heading">阵容与出勤</h2>
          </div>
          <div className={styles.metricGrid}>
            <button type="button" onClick={onOpenRosterPanel}>
              <span>可上场</span><strong>{availableCount}</strong>
            </button>
            <button type="button" onClick={onOpenRosterPanel}>
              <span>轮休/伤停</span><strong className={styles.warmValue}>{restCount + injuredCount}</strong>
            </button>
            <button type="button" onClick={onOpenFieldPanel}>
              <span>守位</span><strong>{assignedDefenseCount}/9</strong>
            </button>
            <button type="button" onClick={onOpenLineupPanel}>
              <span>棒次</span><strong>{assignedLineupCount}/9</strong>
            </button>
          </div>
        </section>

        <section className={styles.quickCard} aria-labelledby="quick-heading">
          <div className={styles.compactHeading}>
            <MagicWand size={20} weight="duotone" aria-hidden="true" />
            <h2 id="quick-heading">快捷操作</h2>
          </div>
          <div className={styles.quickActions}>
            <button type="button" onClick={onAddPlayer}><UserPlus size={22} /><span>新增球员</span></button>
            <button type="button" onClick={onCreateScenario}><Plus size={22} /><span>新建方案</span></button>
            <button type="button" onClick={onDuplicateScenario}><ClipboardText size={22} /><span>复制方案</span></button>
            <button type="button" onClick={onImport}><ArrowSquareOut size={22} /><span>导入数据</span></button>
            <button type="button" onClick={onExportWorkspace}><Export size={22} /><span>导出工作区</span></button>
          </div>
        </section>

        <section className={styles.autoCard}>
          <button className={styles.autoAssign} type="button" onClick={onAutoAssign}>
            <MagicWand size={34} weight="duotone" aria-hidden="true" />
            <span><strong>自动排阵</strong><small>基于球员状态与守位适配</small></span>
          </button>
          <button className={styles.compareButton} type="button" onClick={onOpenScenarioPanel}>
            <CalendarDots size={20} aria-hidden="true" />
            方案比较
          </button>
        </section>
      </div>
    </div>
  );
}
