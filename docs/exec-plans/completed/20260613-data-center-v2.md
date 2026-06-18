# 数据中心 v2 — Execution Plan

## Decisions

| Question | Answer |
|----------|--------|
| Data model | Games promoted to `Workspace.games: Game[]` top-level (not per-player) |
| Fielding data | FPCT (守备率), E (失误), PO (刺杀), A (助杀), TC (总守备机会) |
| Inning detail | Per-inning summary: hits, runs, batter list |
| Migration | One-time migration script converting old per-player GameRecord[] to top-level Game[] |

## New Data Model

### New Types

```typescript
export type InningRecord = {
  inning: number;        // 局次 (1-9+)
  hits: number;          // 该局安打数
  runs: number;          // 该局得分
  batters: string[];     // 该局上场打者 (player IDs)
};

export type PlayerGameStatLine = {
  playerId: string;
  // 打击
  pa: number;  ab: number;  h: number;  hr: number;
  rbi: number;  r: number;  sb: number;  bb: number;  so: number;
  // 投球
  ip: number | null;  er: number | null;
  soPitching: number | null;  bbPitching: number | null;  hPitching: number | null;
  // 守备 (NEW)
  po: number;  // putouts
  a: number;   // assists
  e: number;   // errors
};

export type Game = {
  id: string;
  date: string;
  opponent: string;
  gameType: "official" | "training";
  totalInnings: number;
  innings: InningRecord[];
  statLines: PlayerGameStatLine[];
  note?: string;
};
```

### Schema Changes

| Change | Detail |
|--------|--------|
| `WORKSPACE_SCHEMA_VERSION` | 2 → 3 |
| `Workspace` | + `games: Game[]` |
| `PlayerProfile` | - `games: GameRecord[]` |
| `sanitizeWorkspace` | + `sanitizeGames` path |
| `sanitizePlayerProfile` | - `games` field |
| New file | `src/lib/migrate-v2-to-v3.ts` |

### Computed Stats Additions

| Stat | Formula |
|------|---------|
| TC (total chances) | PO + A + E |
| FPCT (fielding %) | (PO + A) / TC → `.XXX` |
| Fielding display | E, PO, A per player (aggregate across all games) |

## Page Layout

```
┌─ Data Center ────────────────────────────────────┐
│ [球员数据 ▏比赛数据]                              │
├──────────────────────────────────────────────────┤
│                                                   │
│ TAB 1: 球员数据 (enhanced)                        │
│ ┌─ Leaderboard ────────────────────────────────┐ │
│ │ 球员  G  AVG HR RBI OPS  E FPCT  PO  A  SO │ │
│ │ 张伟  12 .385  3  18 .962  1 .967  25   4  8│ │
│ │ 李明  8  .290  1   7 .810  2 .933  18   3 12│ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ TAB 2: 比赛数据 (NEW)                             │
│ ┌─ Game List ──────────────────────────────────┐ │
│ │ 06/10 vs 红鹰队  正式赛  9局          [展开] │ │
│ │   1回: 2安 1得 | 2回: 0安 0得 | 3回: 1安... │ │
│ │   参赛: 张伟, 李明, 王芳, 赵六, ...          │ │
│ │                                              │ │
│ │ ┌─ Expanded View ─────────────────────────┐  │ │
│ │ │ 每局详情                                 │  │ │
│ │ │ 1回: 安打 2, 得分 1                      │  │ │
│ │ │   打者: 张伟, 李明, 王芳                  │  │ │
│ │ │ 2回: 安打 0, 得分 0                      │  │ │
│ │ │   打者: 赵六, 孙七                        │  │ │
│ │ │ ...                                      │  │ │
│ │ │ ──────────────────────────────────────── │  │ │
│ │ │ 球员本场数据                              │  │ │
│ │ │ 张伟  4AB 2H 1HR 3RBI  E:0 PO:3 A:1     │  │ │
│ │ │ 李明  3AB 0H 0RBI       E:1 PO:0 A:2    │  │ │
│ │ └──────────────────────────────────────────┘  │ │
│ │                                              │ │
│ │ [+ 添加比赛]                                  │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## Add Game Flow (multi-step)

1. **Step 1: Game Info** — date, opponent, type, total innings (default 9)
2. **Step 2: Per-inning data** — for each inning: hits, runs, select batters from roster (multi-pick)
3. **Step 3: Player stats** — per selected player: batting line + pitching line + fielding (optional, can be filled later)
4. **Save** → writes to Workspace.games

## Migration Strategy

`migrateV2toV3(workspaceV2): WorkspaceV3`
- For each player's `profile.games[]`, create a standalone `Game` with:
  - `statLines: [{ playerId, ...stats }]` (single player)
  - `innings: []` (no inning data in old format)
  - `totalInnings: 9` (default)
- PlayerGameStatLine extracts from old GameRecord fields
- After migration, `PlayerProfile.games` is removed

## Implementation Phases

### Phase 1: Data Model + Migration
- [ ] Define new types in `types.ts` (`InningRecord`, `PlayerGameStatLine`, `Game`)
- [ ] Update `Workspace` (add `games`, bump version to 3)
- [ ] Create `sanitizeGame`, `sanitizeGames` in sanitizers
- [ ] Update `sanitizeWorkspace`, drop `games` from `sanitizePlayerProfile`
- [ ] Create `migrate-v2-to-v3.ts` with migration function
- [ ] Wire migration into `workspace-store` on load
- [ ] Add tests for migration

### Phase 2: Computed Stats
- [ ] Add `fieldingStats` to `stats.ts`: TC, FPCT, PO, A, E aggregation
- [ ] Update BattingLine/PitchingLine to read from `Workspace.games`
- [ ] Update tests

### Phase 3: Data Center Page Redesign
- [ ] Create `src/components/data-center-client.tsx` (two-tab layout)
- [ ] Tab 1: Player data leaderboard (batting + fielding columns)
- [ ] Tab 2: Game list with expandable inning details + player stats
- [ ] Add game multi-step dialog
- [ ] CSS module
- [ ] Tests

### Phase 4: Cleanup
- [ ] Remove `GameRecord` type and old references
- [ ] Update export/import to include games
- [ ] Update all NAV_ITEMS (keep pointing to `/stats`)
- [ ] Build, lint, full test suite

## Files Touched

| File | Action |
|------|--------|
| `src/lib/workspace/types.ts` | EDIT — new types, Workspace +games |
| `src/lib/workspace/sanitizers.ts` | EDIT — sanitizeGames, drop games from profile |
| `src/lib/workspace/base.ts` | EDIT — createDefaultWorkspace includes games |
| `src/lib/workspace/index.ts` | EDIT — re-export new types |
| `src/lib/migrate-v2-to-v3.ts` | NEW |
| `src/lib/migrate-v2-to-v3.test.ts` | NEW |
| `src/lib/stats.ts` | EDIT — fielding stats, update to use Workspace.games |
| `src/lib/stats.test.ts` | EDIT — fielding stat tests |
| `src/lib/workspace-store.ts` | EDIT — auto-migrate on load |
| `src/components/data-center-client.tsx` | NEW (rewrite) |
| `src/components/data-center-client.module.css` | NEW |
| `src/components/data-center-client.test.tsx` | NEW |
| `src/app/stats/page.tsx` | EDIT — renamed import |
| `src/lib/export-actions.ts` | EDIT — include games in export |
| Various page components | EDIT — drop GameRecord imports |
