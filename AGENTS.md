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
| `src/lib/player-manager-dom.ts` | Legacy DOM-based manager that still owns most of the main roster/scenario UI |
| `src/components/app-shell.tsx` | New global shell for the homepage: masthead, nav, summary rail, content slots, and legacy workspace frame |
| `src/components/home-overview.tsx` | Phase 2 homepage command desk: alert deck, command strip, metrics, scenario snapshot, lineup pulse, and bridge-driven entry actions |
| `src/lib/legacy-bridge.ts` | Structured bridge from React homepage actions into legacy DOM buttons, selects, panel focus, and highlight feedback |
| `src/app/roster/page.tsx` | Roster server route: auth gate, workspace snapshot load, renders `RosterPageClient` |
| `src/components/roster-page-client.tsx` | Roster workbench page state hub: workspace/version, filters, selection, dialogs, save and conflict handling |
| `src/components/roster-overview.tsx` | Roster workbench UI: action bar, filters, counts, player cards, bulk actions |
| `src/lib/roster-actions.ts` | Shared roster business actions: upsert/bulk-edit/delete — single source of truth used by both React and legacy |
| `src/components/player-profile-editor.tsx` | React-based player profile editor for both page (`pageSurface="embedded"`) and drawer flows |
| `src/components/player-profile-page-client.tsx` | Player profile page client state and AppShell shell integration |
| `src/lib/auth.ts` | Shared-passcode cookie signing and verification |
| `src/lib/rate-limiter.ts` | In-memory unlock rate limiter used by `POST /api/unlock` |
| `src/lib/legacy-template.ts` | Extracts legacy markup and styles from `index.html` for the hybrid UI |

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

## Working Rules

1. Verify with commands before claiming success.
2. Read files before editing them.
3. When docs and code disagree, trust the code, then fix the docs.
4. Keep changes self-contained: implementation, tests, docs, and verification notes together.
