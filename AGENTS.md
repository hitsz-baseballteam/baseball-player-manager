# Project Context

This file is a **content directory**, not an encyclopedia.
It guides the agent to the right source of truth. Keep it short.

## Project Identity

- **Name**: Baseball Player Manager
- **Type**: Full-stack Web Application
- **Tech stack**: Next.js 16 App Router, React 19, TypeScript, PostgreSQL via `pg`, Supabase-managed database

## Quick Start

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

Copy `.env.example` to `.env.local` and set `DATABASE_URL` and `APP_ADMIN_PASSCODE`.
Database migrations live in `supabase/migrations/`.

## Key Files

| File | Purpose |
|---|---|
| `src/lib/workspace.ts` | Domain types, sanitizers, auto-assignment, import/export, and other pure workspace rules |
| `src/lib/workspace-store.ts` | PostgreSQL read/write for the workspace snapshot with version-based optimistic concurrency |
| `src/components/player-manager-client.tsx` | Homepage command-desk client: pure React overview, direct high-frequency actions, and page navigation — no legacy DOM runtime |
| `src/components/app-shell.tsx` | Global shell shared by homepage, roster, lineup, scenarios, data center, settings, player profile, and games pages |
| `src/components/home-overview.tsx` | Homepage command desk: alert deck, command strip, metrics, scenario snapshot, and lineup pulse |
| `src/app/roster/page.tsx` | Roster server route: auth gate, workspace snapshot load, renders `RosterPageClient` |
| `src/components/roster-page-client.tsx` | Roster workbench page state hub: workspace/version, filters, selection, dialogs, save and conflict handling |
| `src/components/roster-overview.tsx` | Roster workbench UI: action bar, filters, counts, player cards, bulk actions |
| `src/lib/roster-actions.ts` | Shared roster logic: upsert/bulk-edit/delete plus roster filtering helpers |
| `src/app/lineup/page.tsx` | Lineup server route: auth gate, workspace snapshot load, renders `LineupPageClient` |
| `src/components/lineup-page-client.tsx` | React lineup workbench page state hub: scenario switch, drag/drop assignments, save and conflict handling |
| `src/app/scenarios/page.tsx` | Scenarios server route: auth gate, workspace snapshot load, renders `ScenariosPageClient` |
| `src/components/scenarios-page-client.tsx` | React scenarios page: scenario CRUD, active switch, compare mode, save and conflict handling |
| `src/lib/lineup-actions.ts` | Shared lineup/scenario pure actions used by React lineup/scenarios flows and homepage direct actions |
| `src/app/import-export/page.tsx` | Data-center server route: auth gate, workspace snapshot load, renders `ImportExportPageClient` |
| `src/components/import-export-page-client.tsx` | React data center: JSON import preview, workspace/scenario JSON export, player CSV export |
| `src/app/settings/page.tsx` | Settings server route: auth gate, workspace snapshot load, renders `SettingsPageClient` |
| `src/components/settings-page-client.tsx` | React settings/help page: theme, reset example data, logout, guide/help entry points |
| `src/components/games-page-client.tsx` | React games page: official/training tabs, game-by-game records, summary cards, add/edit/delete |
| `src/lib/export-actions.ts` | Shared pure import/export helpers used by the React data center and homepage export actions |
| `src/app/players/[playerId]/games/page.tsx` | Games server route: auth gate, workspace snapshot load, renders `GamesPageClient` |
| `src/components/player-profile-editor.tsx` | React-based player profile editor for both page (`pageSurface="embedded"`) and drawer flows |
| `src/components/player-profile-page-client.tsx` | Player profile page client state and AppShell shell integration |
| `src/lib/auth.ts` | Shared-passcode cookie signing and verification |
| `src/lib/rate-limiter.ts` | In-memory unlock rate limiter used by `POST /api/unlock` |
| `src/lib/dev-server-output.ts` | Resilient dev-log mirroring used by `scripts/next-dev.ts` so broken stdout/stderr pipes do not kill `next dev` |

## Core Rule: The Repository Is the System of Record

Every piece of knowledge the agent needs must live in this repository.
If information only exists in chat history or human memory, it is invisible at runtime.
Write it into the repo.

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the observed current-state architecture.

## Design Decisions

See [docs/design-docs/index.md](./docs/design-docs/index.md) for ADRs and
[docs/design-docs/core-beliefs.md](./docs/design-docs/core-beliefs.md) for project principles.

## Plans

See [docs/PLANS.md](./docs/PLANS.md).
Do not create a standalone plan for every task: small, self-contained changes can use an inline plan in the task description, commit message, or PR description.
Use [docs/exec-plans/active/](./docs/exec-plans/active/) only for medium/large, multi-step, cross-session, or architecture-affecting work.
Known debt lives in [docs/exec-plans/tech-debt-tracker.md](./docs/exec-plans/tech-debt-tracker.md).

## Existing Project Docs

- [docs/DESIGN.md](./docs/DESIGN.md) — visual and interaction guidance
- [docs/FRONTEND.md](./docs/FRONTEND.md) — frontend conventions and migration notes
- [docs/SECURITY.md](./docs/SECURITY.md) — auth and data protection constraints
- [docs/RELIABILITY.md](./docs/RELIABILITY.md) — concurrency and failure-mode guidance
- [docs/QUALITY_SCORE.md](./docs/QUALITY_SCORE.md) — current quality assessment
- [docs/product-specs/index.md](./docs/product-specs/index.md) — feature specs (currently sparse)
- [docs/generated/history/](./docs/generated/history/) — prior session summaries
- [docs/references/](./docs/references/) — external references; files must use the `-llms.txt` suffix
  - [docs/references/pi-models-llms.txt](./docs/references/pi-models-llms.txt) — pi built-in models catalog (providers, context windows, thinking, image support)

## Subagent Defaults

Wisely use more subagents for reviewing and conding. Details in skill: pi-subagent

You only use 'worker' and 'reviewer'. Fowllowing is the brief information

| Agent | 用途 | 上下文 | 主要输出 | 模型 |
|---|---|---|---|---|
| `worker` | 唯一的执行者：实施代码修改 | `fork` | 编辑后的文件 + 验证结果 | `deepseek-4v-pro high` |
| `reviewer` | 审查代码 / diff / 计划 / PR / 代码健康度 | `fresh` | 审查发现（带 file:line） | `deepseek-4v-pro high` |

Keep writes single-threaded unless isolated worktrees are intentionally used.

## Working Rules

1. Verify with commands before claiming success.
2. Read files before editing them.
3. When docs and code disagree, trust the code, then fix the docs.
4. Keep changes self-contained: implementation, tests, docs, and verification notes together.
