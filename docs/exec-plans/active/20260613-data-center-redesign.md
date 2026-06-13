# 数据中心 Redesign — Execution Plan

## Decisions (from user)

| Question | Answer |
|----------|--------|
| Data scope | League-wide stats table with per-player inline drill-down |
| Game editing | Inline add/edit/delete within data center |
| Import/Export | Move to settings page, remove `/import-export` |

## Architecture Changes

### New Route
- `src/app/stats/page.tsx` — data center server page
- `src/components/stats-page-client.tsx` — client component
- `src/components/stats-page-client.module.css` — styles

### Removed
- `src/app/import-export/page.tsx` — route deleted
- Navigation: `数据中心` label now points to `/stats` instead of `/import-export`
- Import/export moves to settings page

### Computed Stats (pure functions)
New file: `src/lib/stats.ts`
- `computeBattingStats(games: GameRecord[])` → { G, PA, AB, H, AVG, HR, RBI, R, SB, BB, SO, OBP, SLG, OPS }
- `computePitchingStats(games: GameRecord[])` → { G, W, L, SV, IP, ER, ERA, WHIP, H, BB, SO, K9, BB9 }
- All pure, testable, edge-case-safe (0 AB → ".000", 0 IP → "0.00")

### Schema
GameRecord stays as-is. No migration needed — games already live in `PlayerProfile.games`.

## Page Layout

```
┌─ AppShell ─────────────────────────────────────┐
│ 总览 | 名册 | 战术场景 | 数据中心 | 设置         │
├─────────────────────────────────────────────────┤
│ ┌─ Stats Header ──────────────────────────────┐ │
│ │ 数据中心  [野手 ▏投手]                        │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─ Leaderboard Table (sortable) ──────────────┐ │
│ │ Name  G  AVG  HR  RBI  OPS   → sort headers │ │
│ │ 张伟   12 .385  3   18  .962                 │ │
│ │ 李明   8  .290  1    7  .810  ← click expand │ │
│ │   ┌─ Expanded Player Panel ────────────────┐ │ │
│ │   │ 李明 #12 二垒手/游击手                  │ │ │
│ │   │ [G:8] [AVG:.290] [HR:1] [RBI:7]        │ │ │
│ │   │                                         │ │ │
│ │   │ Game Log Table (sortable)               │ │ │
│ │   │ Date ▼   Opponent    AB  H  HR  RBI     │ │ │
│ │   │ 06/10    红鹰队      4   2   1   3      │ │ │
│ │   │ 06/08    黑豹队      3   0   0   0      │ │ │
│ │   │ [+ Add Game] [Edit] [Delete]            │ │ │
│ │   └────────────────────────────────────────┘ │ │
│ │ 王芳   15 .410  5   22  1.100                 │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Computed Stats Engine
- [ ] Create `src/lib/stats.ts` — `computeBattingStats`, `computePitchingStats`
- [ ] Create `src/lib/stats.test.ts` — edge cases (0 AB, 0 IP, null fields, empty array)
- [ ] Add `formatStat` helper (".XXX" for AVG, "X.XX" for ERA)

### Phase 2: Data Center Page
- [ ] Create `src/app/stats/page.tsx` — server wrapper (auth, data fetch)
- [ ] Create `src/components/stats-page-client.tsx` — main component
  - [ ] Batting/Pitching tab toggle
  - [ ] Sortable leaderboard table (click header to sort)
  - [ ] Row click → expand/collapse player detail
  - [ ] Expanded view: player summary card + game log table
  - [ ] Inline Add Game button → dialog
  - [ ] Edit/Delete on existing game rows
  - [ ] Empty states ("暂无比赛记录")
  - [ ] Loading skeleton
- [ ] Create `src/components/stats-page-client.module.css`
- [ ] Create `src/components/stats-page-client.test.tsx`

### Phase 3: Navigation & Route Changes
- [ ] Update NAV_ITEMS in ALL 5 page components: `/import-export` → `/stats`
- [ ] Delete `/import-export` route directory
- [ ] Add import/export section to settings page
- [ ] Remove `import-export-page-client.*` files

### Phase 4: Verification
- [ ] `npm run build` — clean
- [ ] `npm test` — all passing
- [ ] `npm run lint` — clean
- [ ] Manual check: nav highlights, sorting, expand/collapse, add/edit game

## Files Touched

| File | Action |
|------|--------|
| `src/lib/stats.ts` | NEW |
| `src/lib/stats.test.ts` | NEW |
| `src/app/stats/page.tsx` | NEW |
| `src/components/stats-page-client.tsx` | NEW |
| `src/components/stats-page-client.module.css` | NEW |
| `src/components/stats-page-client.test.tsx` | NEW |
| `src/app/import-export/page.tsx` | DELETE |
| `src/components/import-export-page-client.tsx` | DELETE |
| `src/components/import-export-page-client.module.css` | DELETE |
| `src/components/import-export-page-client.test.tsx` | DELETE |
| `src/components/home-overview.tsx` | EDIT (NAV_ITEMS) |
| `src/components/roster-page-client.tsx` | EDIT (NAV_ITEMS) |
| `src/components/scenarios-page-client.tsx` | EDIT (NAV_ITEMS) |
| `src/components/settings-page-client.tsx` | EDIT (add import/export) |
| `src/components/player-profile-page-client.tsx` | EDIT (NAV_ITEMS) |
