import {
  HAND_LABELS,
  POSITIONS,
  STATUS_LABELS,
  type Scenario,
  type Workspace,
} from "@/lib/workspace";
import { filterPlayers, type PlayerFilterState } from "@/lib/roster-actions";

import styles from "@/components/roster-overview.module.css";

type RosterOverviewProps = {
  workspace: Workspace;
  version: number;
  activeScenario: Scenario;
  filter: PlayerFilterState;
  setFilter: React.Dispatch<React.SetStateAction<PlayerFilterState>>;
  selectedIds: Set<string>;
  toggleSelect: (playerId: string) => void;
  selectAllFiltered: (playerIds: string[]) => void;
  clearSelection: () => void;
  onOpenProfile: (playerId: string) => void;
  onOpenFullPage: (playerId: string) => void;
  onDeletePlayer: (playerId: string) => void;
  onAddPlayer: () => void;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
};

export function RosterOverview({
  workspace,
  activeScenario,
  filter,
  setFilter,
  selectedIds,
  toggleSelect,
  selectAllFiltered,
  clearSelection,
  onOpenProfile,
  onOpenFullPage,
  onDeletePlayer,
  onAddPlayer,
  onBulkEdit,
  onBulkDelete,
}: RosterOverviewProps) {
  const filteredPlayers = filterPlayers(
    workspace.players,
    activeScenario,
    filter,
  );

  const availableCount = workspace.players.filter(
    (p) => p.status === "available",
  ).length;
  const filteredIds = new Set(filteredPlayers.map((p) => p.id));
  const selectedCount = Array.from(selectedIds).filter((id) =>
    filteredIds.has(id),
  ).length;

  const updateFilter = (patch: Partial<PlayerFilterState>) => {
    setFilter((prev) => ({ ...prev, ...patch }));
  };

  const handleSelectAll = () => {
    selectAllFiltered(filteredPlayers.map((p) => p.id));
  };

  return (
    <div className={styles.overview}>
      {/* Action Bar */}
      <section className={styles.actionBar} aria-label="名册操作">
        <button className={styles.btnPrimary} onClick={onAddPlayer}>
          + 新增球员
        </button>
        <button
          className={styles.btnSecondary}
          onClick={onBulkEdit}
          disabled={selectedCount === 0}
        >
          批量编辑
        </button>
        <button
          className={styles.btnDanger}
          onClick={onBulkDelete}
          disabled={selectedCount === 0}
        >
          批量删除
        </button>
        <div className={styles.actionSpacer} />
        <button
          className={styles.btnSecondary}
          onClick={handleSelectAll}
          disabled={filteredPlayers.length === 0}
        >
          全选当前
        </button>
        <button
          className={styles.btnSecondary}
          onClick={clearSelection}
          disabled={selectedCount === 0}
        >
          清除选择
        </button>
      </section>

      {/* Count Bar */}
      <section className={styles.countBar} aria-label="名册统计">
        <div className={styles.countItem}>
          <span className={styles.countLabel}>总计</span>
          <span className={styles.countValue}>{workspace.players.length}</span>
        </div>
        <div className={styles.countItem}>
          <span className={styles.countLabel}>可上场</span>
          <span className={`${styles.countValue} ${styles.countAccent}`}>
            {availableCount}
          </span>
        </div>
        <div className={styles.countItem}>
          <span className={styles.countLabel}>当前筛选</span>
          <span className={styles.countValue}>{filteredPlayers.length}</span>
        </div>
        <div className={styles.countItem}>
          <span className={styles.countLabel}>已选</span>
          <span className={styles.countValue}>{selectedCount}</span>
        </div>
      </section>

      {/* Filters */}
      <section className={styles.filters} aria-label="名册筛选">
        <input
          type="search"
          className={styles.search}
          placeholder="搜索姓名或背号..."
          value={filter.query}
          onChange={(e) => updateFilter({ query: e.target.value })}
        />
        <select
          value={filter.position}
          onChange={(e) => updateFilter({ position: e.target.value })}
        >
          <option value="all">全部守位</option>
          {POSITIONS.map((p) => (
            <option key={p.code} value={p.code}>
              {p.code} {p.label}
            </option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => updateFilter({ status: e.target.value })}
        >
          <option value="all">全部状态</option>
          <option value="available">可上场</option>
          <option value="rest">轮休</option>
          <option value="injured">伤停</option>
        </select>
        <select
          value={filter.bats}
          onChange={(e) => updateFilter({ bats: e.target.value })}
        >
          <option value="all">全部打击</option>
          <option value="R">右打</option>
          <option value="L">左打</option>
          <option value="S">双打</option>
        </select>
        <select
          value={filter.throws}
          onChange={(e) => updateFilter({ throws: e.target.value })}
        >
          <option value="all">全部投球</option>
          <option value="R">右投</option>
          <option value="L">左投</option>
          <option value="S">双投</option>
        </select>
        <select
          value={filter.assignment}
          onChange={(e) => updateFilter({ assignment: e.target.value })}
        >
          <option value="all">全部分配</option>
          <option value="unassigned">未分配</option>
          <option value="defenseAssigned">已守位</option>
          <option value="lineupAssigned">已排棒</option>
          <option value="fullyAssigned">已完整分配</option>
        </select>
      </section>

      {/* Player List */}
      <section className={styles.list} aria-label="球员列表">
        {filteredPlayers.length === 0 ? (
          <div className={styles.empty}>没有匹配的球员</div>
        ) : (
          filteredPlayers.map((player) => {
            const defensePosition = (
              Object.entries(activeScenario.assignments.defense) as [
                string,
                string | null,
              ][]
            ).find(([, pid]) => pid === player.id)?.[0];
            const lineupIndex = activeScenario.assignments.lineup.findIndex(
              (pid) => pid === player.id,
            );
            const isSelected = selectedIds.has(player.id);

            return (
              <article
                key={player.id}
                className={`${styles.card}${isSelected ? ` ${styles.cardSelected}` : ""}`}
              >
                <label className={styles.cardSelect}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(player.id)}
                    aria-label={`选择 ${player.name}`}
                  />
                </label>
                <div className={styles.cardBadge}>{player.number}</div>
                <div className={styles.cardMain}>
                  <div className={styles.cardNameRow}>
                    <span className={styles.cardName}>{player.name}</span>
                    <span className={`${styles.statusChip} ${styles[`status${player.status.charAt(0).toUpperCase() + player.status.slice(1)}`] || ""}`}>
                      {STATUS_LABELS[player.status]}
                    </span>
                  </div>
                  <div className={styles.cardMeta}>
                    打 {HAND_LABELS[player.bats]} / 投{" "}
                    {HAND_LABELS[player.throws]}
                  </div>
                  <div className={styles.cardPositions}>
                    {player.positions.map((pos) => (
                      <span key={pos} className={styles.positionPill}>
                        {pos}
                      </span>
                    ))}
                    {defensePosition && (
                      <span className={styles.assignmentPill}>
                        守 {defensePosition}
                      </span>
                    )}
                    {lineupIndex >= 0 && (
                      <span className={styles.assignmentPill}>
                        第 {lineupIndex + 1} 棒
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button
                    className={styles.cardBtn}
                    onClick={() => onOpenProfile(player.id)}
                  >
                    档案
                  </button>
                  <button
                    className={styles.cardBtn}
                    onClick={() => onOpenFullPage(player.id)}
                  >
                    完整页
                  </button>
                  <button
                    className={`${styles.cardBtn} ${styles.cardBtnDanger}`}
                    onClick={() => onDeletePlayer(player.id)}
                  >
                    删除
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
