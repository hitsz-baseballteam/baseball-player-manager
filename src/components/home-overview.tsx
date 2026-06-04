import styles from "@/components/home-overview.module.css";
import {
  analyzeScenarioWarnings,
  getActiveScenario,
  getPlayer,
  POSITIONS,
  STATUS_LABELS,
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

const FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function HomeOverview({
  workspace,
  remoteVersion,
  saveStatus,
  onAutoAssign,
  onAddPlayer,
  onImport,
  onCreateScenario,
  onExportWorkspace,
  onExportScenario,
  onRenameScenario,
  onDuplicateScenario,
  onClearAssignments,
  onScenarioChange,
  onOpenWorkspace,
  onOpenScenarioPanel,
  onOpenRosterPanel,
  onOpenFieldPanel,
  onOpenLineupPanel,
  onOpenWarningsPanel,
}: HomeOverviewProps) {
  const activeScenario = getActiveScenario(workspace);
  const { critical, advisory } = analyzeScenarioWarnings(workspace, activeScenario);

  const availableCount = workspace.players.filter((player) => player.status === "available").length;
  const restCount = workspace.players.filter((player) => player.status === "rest").length;
  const injuredCount = workspace.players.filter((player) => player.status === "injured").length;
  const defenseAssignments = POSITIONS.map((position) => ({
    ...position,
    player: getPlayer(workspace, activeScenario.assignments.defense[position.code]),
  }));
  const lineupAssignments = activeScenario.assignments.lineup.map((playerId, index) => ({
    slot: index + 1,
    player: getPlayer(workspace, playerId),
  }));
  const assignedDefenseCount = defenseAssignments.filter((entry) => entry.player).length;
  const assignedLineupCount = lineupAssignments.filter((entry) => entry.player).length;
  const missingPositions = defenseAssignments
    .filter((entry) => !entry.player)
    .map((entry) => entry.code);

  const statusSummary = critical.length > 0
    ? `当前方案有 ${critical.length} 条强提醒，先处理“${critical[0]}”。`
    : assignedDefenseCount < 9 || assignedLineupCount < 9
    ? `阵容接近可用：还差 ${9 - assignedDefenseCount} 个守位、${9 - assignedLineupCount} 个棒次。`
    : advisory.length > 0
    ? `阵容已可用，但还有 ${advisory.length} 条建议提醒值得复查。`
    : "当前方案已具备完整首发框架，可以直接进入完整工作台微调。";

  const quickActions = [
    {
      label: "自动排阵",
      detail: "用当前可上场球员生成初稿",
      onClick: onAutoAssign,
      tone: "primary",
    },
    {
      label: "新增球员",
      detail: "直接打开 legacy 新建球员对话框",
      onClick: onAddPlayer,
      tone: "default",
    },
    {
      label: "导入数据",
      detail: "导入工作区或单套方案文件",
      onClick: onImport,
      tone: "default",
    },
    {
      label: "新建方案",
      detail: "为不同比赛条件建立新方案",
      onClick: onCreateScenario,
      tone: "default",
    },
  ] as const;

  const supportActions = [
    {
      label: "导出工作区",
      detail: "备份全部球员与全部方案",
      onClick: onExportWorkspace,
    },
    {
      label: "导出当前方案",
      detail: "只导出当前阵容与引用球员",
      onClick: onExportScenario,
    },
    {
      label: "重命名方案",
      detail: "调整当前方案标题与备注",
      onClick: onRenameScenario,
    },
    {
      label: "复制方案",
      detail: "基于当前方案快速派生变体",
      onClick: onDuplicateScenario,
    },
    {
      label: "清空当前阵容",
      detail: "快速清空守位与棒次后重新排",
      onClick: onClearAssignments,
    },
  ] as const;

  const warningActions = {
    onOpenScenarioPanel,
    onOpenRosterPanel,
    onOpenFieldPanel,
    onOpenLineupPanel,
    onOpenWarningsPanel,
  };

  return (
    <>
      <section className={styles.alertDeck} aria-label="比赛日提醒">
        <article className={critical.length > 0 ? styles.alertHeroCritical : styles.alertHeroHealthy}>
          <div className={styles.kicker}>Alert Deck</div>
          <div className={styles.alertHeroHeader}>
            <h2 className={styles.alertTitle}>
              {critical.length > 0 ? "先处理强提醒，再谈阵容美观。" : "当前方案可用，先做赛前确认。"}
            </h2>
            <div className={styles.alertBadge}>
              {critical.length > 0 ? `${critical.length} 条强提醒` : "阵容可用"}
            </div>
          </div>
          <p className={styles.alertSummary}>{statusSummary}</p>
          <ul className={styles.alertList}>
            {(critical.length > 0
              ? critical.slice(0, 3)
              : ["守位与棒次均已形成完整骨架，可把注意力转向细节风险与战术微调。"])
              .map((item) => {
                const action = resolveWarningAction(item, warningActions);
                return (
                  <li key={item} className={styles.alertItem}>
                    <span className={styles.alertItemText}>{item}</span>
                    {action ? (
                      <button className={styles.alertAction} type="button" onClick={action.onClick}>
                        {action.label}
                      </button>
                    ) : null}
                  </li>
                );
              })}
          </ul>
          <div className={styles.alertFooter}>
            <button className={styles.jumpButton} type="button" onClick={onOpenFieldPanel}>
              去守位区
            </button>
            <button className={styles.jumpButton} type="button" onClick={onOpenLineupPanel}>
              去棒次区
            </button>
            <button className={styles.jumpButton} type="button" onClick={onOpenWarningsPanel}>
              去提醒区
            </button>
          </div>
        </article>

        <article className={styles.alertNotes}>
          <div className={styles.kicker}>Advisory Notes</div>
          <h3 className={styles.notesTitle}>建议提醒</h3>
          <ul className={styles.notesList}>
            {(advisory.length > 0
              ? advisory.slice(0, 4)
              : ["当前没有额外建议提醒。可以直接进入下方工作台做最终排阵微调。"])
              .map((item) => {
                const action = resolveWarningAction(item, warningActions);
                return (
                  <li key={item} className={styles.noteItem}>
                    <span className={styles.alertItemText}>{item}</span>
                    {action ? (
                      <button className={styles.noteAction} type="button" onClick={action.onClick}>
                        {action.label}
                      </button>
                    ) : null}
                  </li>
                );
              })}
          </ul>
          <div className={styles.noteFooter}>
            <button className={styles.jumpButton} type="button" onClick={onOpenWarningsPanel}>
              定位到提醒区
            </button>
            <button className={styles.jumpButton} type="button" onClick={onOpenWorkspace}>
              进入完整工作台
            </button>
          </div>
        </article>
      </section>

      <section className={styles.commandStrip} aria-label="快捷动作">
        <div className={styles.commandIntro}>
          <div className={styles.kicker}>Command Strip</div>
          <h2 className={styles.commandTitle}>今天先做哪一步，不该藏在旧工具栏里。</h2>
          <p className={styles.commandDescription}>
            首页动作以直接桥接为主：高频操作从总控台直接触发，复杂编辑再进入下方完整工作台。
          </p>
        </div>
        <div className={styles.commandGrid}>
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.tone === "primary" ? styles.commandPrimary : styles.commandButton}
              onClick={action.onClick}
            >
              <span className={styles.commandLabel}>{action.label}</span>
              <span className={styles.commandDetail}>{action.detail}</span>
            </button>
          ))}
        </div>
        <div className={styles.commandSubgrid}>
          {supportActions.map((action) => (
            <button key={action.label} type="button" className={styles.commandSubButton} onClick={action.onClick}>
              <span className={styles.commandSubLabel}>{action.label}</span>
              <span className={styles.commandSubDetail}>{action.detail}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.overviewGrid} aria-label="总控台概览">
        <article className={styles.metricsPanel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.kicker}>Key Metrics</div>
              <h2 className={styles.panelTitle}>今天能不能开打，先看这四格。</h2>
            </div>
            <div className={styles.panelMeta}>Workspace v{remoteVersion}</div>
          </div>

          <div className={styles.metricGrid}>
            <button type="button" className={`${styles.metricButton} ${styles.metricCardAccent}`} onClick={onOpenRosterPanel}>
              <span className={styles.metricLabel}>可上场人数</span>
              <span className={styles.metricValue}>{availableCount}</span>
              <span className={styles.metricDetail}>
                共 {workspace.players.length} 人；{availableCount >= 9 ? "基础人数够排一套阵容。" : `人数仍短缺 ${9 - availableCount} 人。`}
              </span>
            </button>

            <button type="button" className={`${styles.metricButton} ${styles.metricCardWarm}`} onClick={onOpenRosterPanel}>
              <span className={styles.metricLabel}>轮休 / 伤停</span>
              <span className={styles.metricValue}>{restCount + injuredCount}</span>
              <span className={styles.metricDetail}>
                轮休 {restCount} 人，伤停 {injuredCount} 人。
              </span>
            </button>

            <button type="button" className={styles.metricButton} onClick={onOpenFieldPanel}>
              <span className={styles.metricLabel}>守位完成度</span>
              <span className={styles.metricValue}>{assignedDefenseCount}/9</span>
              <span className={styles.metricDetail}>
                {missingPositions.length > 0 ? `还缺 ${missingPositions.join("、")}` : "九个守位均已有人。"}
              </span>
            </button>

            <button type="button" className={`${styles.metricButton} ${styles.metricCardCool}`} onClick={onOpenLineupPanel}>
              <span className={styles.metricLabel}>棒次完成度</span>
              <span className={styles.metricValue}>{assignedLineupCount}/9</span>
              <span className={styles.metricDetail}>
                {assignedLineupCount === 9 ? "九个棒次已排满。" : `还缺 ${9 - assignedLineupCount} 个棒次。`}
              </span>
            </button>
          </div>
        </article>

        <article className={styles.scenarioPanel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.kicker}>Scenario Snapshot</div>
              <h2 className={styles.panelTitle}>当前方案</h2>
            </div>
            <button className={styles.inlineLink} type="button" onClick={onOpenScenarioPanel}>
              去工作台完整管理
            </button>
          </div>

          <label className={styles.selectLabel} htmlFor="homeScenarioSelect">
            切换当前方案
          </label>
          <select
            id="homeScenarioSelect"
            className={styles.select}
            value={activeScenario.id}
            onChange={(event) => onScenarioChange(event.currentTarget.value)}
          >
            {workspace.scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>

          <div className={styles.scenarioName}>{activeScenario.name}</div>
          <p className={styles.scenarioNote}>
            {activeScenario.note || "当前方案还没有备注。建议在完整工作台里补充适用场景说明。"}
          </p>

          <div className={styles.scenarioActions}>
            <button className={styles.inlineLink} type="button" onClick={onRenameScenario}>
              重命名
            </button>
            <button className={styles.inlineLink} type="button" onClick={onDuplicateScenario}>
              复制方案
            </button>
            <button className={styles.inlineLink} type="button" onClick={onExportScenario}>
              导出当前方案
            </button>
          </div>

          <dl className={styles.statusGrid}>
            <div>
              <dt>最近更新</dt>
              <dd>{formatTimestamp(activeScenario.updatedAt)}</dd>
            </div>
            <div>
              <dt>当前状态</dt>
              <dd>{saveStatus}</dd>
            </div>
            <div>
              <dt>方案总数</dt>
              <dd>{workspace.scenarios.length} 套</dd>
            </div>
            <div>
              <dt>比赛名单</dt>
              <dd>{availableCount} 名 {STATUS_LABELS.available}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className={styles.lineupPulse} aria-label="阵容概览">
        <article className={styles.pulsePanel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.kicker}>Lineup Pulse</div>
              <h2 className={styles.panelTitle}>守位概览</h2>
            </div>
            <button className={styles.inlineLink} type="button" onClick={onOpenFieldPanel}>
              去守位区
            </button>
          </div>

          <div className={styles.defenseGrid}>
            {defenseAssignments.map((entry) => (
              <button
                key={entry.code}
                type="button"
                className={entry.player ? styles.defenseCardFilled : styles.defenseCardEmpty}
                onClick={onOpenFieldPanel}
              >
                <span className={styles.defenseCode}>{entry.code}</span>
                <span className={styles.defenseLabel}>{entry.label}</span>
                <span className={styles.defensePlayer}>{entry.player?.name || "待补位"}</span>
              </button>
            ))}
          </div>
        </article>

        <article className={styles.pulsePanel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.kicker}>Batting Order</div>
              <h2 className={styles.panelTitle}>棒次概览</h2>
            </div>
            <button className={styles.inlineLink} type="button" onClick={onOpenLineupPanel}>
              去棒次区
            </button>
          </div>

          <ol className={styles.lineupList}>
            {lineupAssignments.map((entry) => (
              <li key={entry.slot}>
                <button type="button" className={styles.lineupItem} onClick={onOpenLineupPanel}>
                  <span className={styles.lineupSlot}>{entry.slot}</span>
                  <span className={styles.lineupName}>{entry.player?.name || "待定"}</span>
                  <span className={styles.lineupMeta}>
                    {entry.player ? entry.player.positions.join(" / ") : "等待分配"}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </article>
      </section>
    </>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未记录";
  }
  return FORMATTER.format(date);
}

function resolveWarningAction(
  message: string,
  actions: Pick<HomeOverviewProps, "onOpenRosterPanel" | "onOpenFieldPanel" | "onOpenLineupPanel" | "onOpenWarningsPanel" | "onOpenScenarioPanel">,
) {
  if (message.includes("守位未满") || message.includes("重复占用守位") || message.includes("可守位置不包含") || message.includes("当前被放在")) {
    return { label: "去守位区", onClick: actions.onOpenFieldPanel };
  }

  if (message.includes("棒次未满") || (message.includes("第 ") && message.includes("棒"))) {
    return { label: "去棒次区", onClick: actions.onOpenLineupPanel };
  }

  if (message.includes("非可上场球员已进入阵容")) {
    return { label: "去名单区", onClick: actions.onOpenRosterPanel };
  }

  return { label: "去提醒区", onClick: actions.onOpenWarningsPanel };
}
