# Project Context

This file is a **map**, not a manual. Keep it short. Follow links to deeper docs.

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

Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `APP_ADMIN_PASSCODE_HASH`, and `AUTH_SECRET`.
Database migrations live in `supabase/migrations/`.

## Key Files

| File | Purpose |
|---|---|
| `src/lib/workspace/` | Domain types, sanitizers, auto-assignment, import/export — pure workspace rules (split into `types.ts` / `base.ts` / `sanitizers.ts` / `helpers.ts` / `index.ts`) |
| `src/lib/workspace-store.ts` | Normalized-table read/write with version-based optimistic concurrency (replaces single-row `app_workspace` JSONB writes; legacy table retained as rollback source) |
| `src/lib/panel-server.ts` | Server-side auth check + workspace reader wrappers (`getPanelBootstrap` / `getPanelGames` / `getPanelMilestones` / `getPanelWorkspaceSnapshot`) used by every `/panel/*` page |
| `src/lib/scoreboard-actions.ts` | Live game state engine: PA-result derivation, runner advancement, defense, finalize |
| `src/lib/hall-of-fame.ts` | Career-stats and badge computation for the Hall of Fame page |
| `src/lib/use-workspace-snapshot.ts` | Shared client workspace/version state, snapshot application, and conflict refresh |
| `src/components/app-shell.tsx` | Global shell shared by all pages |
| `src/components/player-manager-client.tsx` | Homepage command-desk client |
| `src/components/home-overview.tsx` | Homepage alert deck, command strip, metrics, lineup pulse |
| `src/components/roster-page-client.tsx` | Roster page: workspace, filters, selection, dialogs, save/conflict |
| `src/components/lineup-page-client.tsx` | Lineup page: scenario switch, drag/drop assignments, save/conflict |
| `src/components/scenarios-page-client.tsx` | Scenarios page: CRUD, active switch, compare mode, save/conflict |
| `src/lib/roster-actions.ts` | Shared roster logic: upsert, bulk-edit, delete, filters |
| `src/lib/lineup-actions.ts` | Shared lineup/scenario pure actions |
| `src/lib/auth.ts` | Shared-passcode cookie signing and verification |

## Core Rule: The Repository Is the System of Record

Every piece of knowledge the agent needs must live in this repository.
If information only exists in chat history or human memory, it is invisible at runtime.
Write it into the repo.

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Design Decisions

See [docs/design-docs/](./docs/design-docs/index.md) for ADRs and [docs/design-docs/core-beliefs.md](./docs/design-docs/core-beliefs.md) for principles.

## Planning

Not every task needs a plan file. Match the approach to the change size:

- **Small (< 1 day)**: inline plan in task description, commit message, or PR description.
- **Medium (1-3 days / multi-step / cross-session)**: create a Markdown file in `docs/exec-plans/active/`. Move to `docs/exec-plans/completed/` when done.
- **Large (> 3 days / architecture-affecting)**: write an ADR in `docs/design-docs/` first, then an exec plan.

Plan file naming: `YYYYMMDD-简短描述.md`. Known debt lives in `docs/exec-plans/tech-debt-tracker.md`.

## Existing Docs

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — observed current-state architecture
- [docs/SCHEMA.md](./docs/SCHEMA.md) — normalized database schema and storage conventions
- [docs/API.md](./docs/API.md) — complete HTTP API contract
- [docs/DESIGN.md](./docs/DESIGN.md) — visual and interaction guidance
- [docs/FRONTEND.md](./docs/FRONTEND.md) — frontend conventions
- [docs/SECURITY.md](./docs/SECURITY.md) — auth and data protection
- [docs/RELIABILITY.md](./docs/RELIABILITY.md) — concurrency and failure modes
- [docs/QUALITY_SCORE.md](./docs/QUALITY_SCORE.md) — quality assessment
- [docs/PRODUCT_SENSE.md](./docs/PRODUCT_SENSE.md) — product principles and priorities
- [docs/references/](./docs/references/) — external references (`-llms.txt` suffix)

## Working Rules

1. Verify with commands before claiming success.
2. Read files before editing them.
3. When docs and code disagree, trust the code, then fix the docs.
4. Keep changes self-contained: implementation, tests, docs, and verification notes together.
