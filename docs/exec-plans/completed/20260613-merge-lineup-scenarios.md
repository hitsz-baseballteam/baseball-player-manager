# 20260613 Merge Lineup into Scenarios

## Goal
Merge `/lineup` (field board, batting order, bench) into `/scenarios` (scenario CRUD, compare).
`/lineup` → redirect to `/scenarios`. Navigation drops "排阵" entry.

## Changes

### 1. Navigation (all pages)
- Remove `{ label: "排阵", href: "/lineup" }` from every `NAV_ITEMS`
- Update `{ label: "战术场景", href: "/scenarios" }` → maybe add `active: true` on /scenarios page

### 2. `/lineup` → redirect
- `src/app/lineup/page.tsx`: `redirect("/scenarios")`

### 3. ScenariosPageClient rewrite
- Absorb lineup board (FieldBoard, LineupOrder, BenchPanel) from LineupPageClient
- Absorb warnings bar
- View modes: `"lineup"` (default, shows board) | `"compare"` (shows ScenarioCompare)
- Toolbar: scenario select + CRUD + view toggle + lineup actions (auto-assign, clear)
- Import lineup-actions (assignDefensePosition, etc.)

### 4. Homepage links
- `onOpenFieldPanel`, `onOpenLineupPanel`, `onOpenWarningsPanel` → navigate to `/scenarios`
- `onOpenScenarioPanel` → navigate to `/scenarios`

### 5. Keep
- `LineupPageClient` stays (for backward compat, or redirect on mount)
- Actually, change it to just redirect

## Verification
- `npm run build` — clean
- `npm test` — update tests for merged page
