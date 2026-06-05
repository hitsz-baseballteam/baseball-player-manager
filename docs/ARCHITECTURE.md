# Architecture

## Status

This document describes the repository as currently observed on 2026-06-05.
Where something is unknown from repository evidence, it is listed under **Open Questions** instead of being guessed.

## Repository Shape

- **Type**: Full-stack web application
- **Primary languages**: TypeScript, SQL, CSS
- **Framework/runtime**: Next.js 16 App Router with React 19
- **Persistence**: PostgreSQL accessed through `pg`, with SQL migrations under `supabase/migrations/`
- **Build/test tooling**: npm, ESLint 9, TypeScript strict mode, Node test runner via `tsx`

## Top-Level Structure

| Path | What it currently owns |
|---|---|
| `src/app/` | Next.js routes, pages, global styles, and API endpoints |
| `src/components/` | React UI components, including the homepage app shell, command-desk overview, unlock form, help UI, theme toggle, toast/guide overlays, and player profile editor |
| `src/lib/` | Shared domain model, pure business logic, database access, auth, rate limiting, and cross-page client helpers |
| `public/` | Static assets shipped by Next.js |
| `supabase/migrations/` | SQL schema migration for the workspace table |
| `docs/` | Architecture, planning, design docs, quality notes, references, and session history |
| `.github/workflows/` | CI workflow for lint, test, and build |

## Entry Points

### Developer commands

From `package.json`:

- `npm run dev` → `tsx scripts/next-dev.ts` → `next dev`
- `npm run build` → `next build`
- `npm run start` → `next start`
- `npm run lint` → `eslint`
- `npm test` → `node --experimental-test-module-mocks --require ./src/lib/test-setup.cjs --import tsx --test ...`

### Runtime entry points

| Entry point | Role |
|---|---|
| `src/app/page.tsx` | Home page; checks unlock cookie, renders `UnlockForm` when locked, otherwise loads workspace snapshot and renders the React command-desk homepage |
| `src/app/roster/page.tsx` | Roster workbench page; checks auth, loads workspace, renders React roster workbench inside `AppShell` |
| `src/app/lineup/page.tsx` | Lineup workbench page; checks auth, loads workspace, renders React lineup board inside `AppShell` |
| `src/app/scenarios/page.tsx` | Scenario management page; checks auth, loads workspace, renders React scenario list/compare UI inside `AppShell` |
| `src/app/import-export/page.tsx` | Data-center page; checks auth, loads workspace, renders JSON import + export actions inside `AppShell` |
| `src/app/settings/page.tsx` | Settings/help page; checks auth, loads workspace, renders theme/reset/logout/help controls inside `AppShell` |
| `src/app/players/[playerId]/games/page.tsx` | Game-data page; checks auth, loads workspace, renders React game records with official/training tabs inside `AppShell` |
| `src/app/players/[playerId]/page.tsx` | Player profile page; checks auth, loads workspace, renders React editor inside `AppShell` |
| `src/app/api/unlock/route.ts` | Verifies shared passcode, applies rate limiting, sets signed cookie |
| `src/app/api/logout/route.ts` | Clears the unlock cookie |
| `src/app/api/workspace/route.ts` | Reads and writes the shared workspace snapshot |
| `src/proxy.ts` | Protects `/api/workspace` routes by validating the signed unlock cookie |
| `scripts/next-dev.ts` | Wrapper around `next dev` that mirrors logs to `.next/dev/logs/next-dev-wrapper.log` and tolerates broken stdout/stderr pipes |

## Major Components

### 1. Domain model and business rules

`src/lib/workspace.ts` is the central domain module. It defines the workspace, player, scenario, and profile types, along with pure helpers for:

- workspace sanitization
- player/profile sanitization
- scenario sanitization
- auto-assignment
- warning analysis
- import/export preparation
- legacy-state migration
- workspace cloning and default-state creation

This file is also where shared constants such as positions, labels, and guide steps live.

### 2. Persistence and concurrency

Database access is split across:

- `src/lib/db.ts` — lazy `pg.Pool` creation using `DATABASE_URL`, with Supabase-host detection that normalizes `sslmode` handling and applies explicit TLS options for Node/Vercel compatibility
- `src/lib/workspace-store.ts` — read/create/update operations for the single shared workspace snapshot

Observed behavior:

- the app uses one logical workspace slug: `default`
- reads sanitize database data before returning it
- writes sanitize incoming workspace data before persisting it
- updates increment a numeric `version`
- update conflicts return `null` when `WHERE slug = $4 AND version = $5` matches no row

On the client side, `src/lib/workspace-client.ts` wraps `/api/workspace` and provides `saveWithRetry()` to reload and retry after a version conflict.

### 3. Authentication and request protection

The app uses a shared-passcode model rather than per-user accounts.

Relevant files:

- `src/lib/auth.ts` — derives an HMAC-SHA256 signature from `APP_ADMIN_PASSCODE`
- `src/app/api/unlock/route.ts` — verifies the submitted passcode and sets the `baseball_manager_unlock` cookie
- `src/lib/rate-limiter.ts` — in-memory fixed-window rate limiter used only by unlock requests
- `src/proxy.ts` — rejects unauthenticated `/api/workspace` requests with `401`
- `src/app/api/logout/route.ts` — expires the cookie

Observed limits and boundaries:

- unlock attempts are limited per IP to 5 requests per 60 seconds
- the unlock cookie is `httpOnly`, `sameSite=lax`, and `secure` in production
- API route protection is applied only to `/api/workspace/:path*`

### 4. React page-shell architecture

The legacy homepage runtime has been retired. The current UI is now route-based React throughout.

- `src/components/player-manager-client.tsx` renders the homepage command desk using `AppShell` + `HomeOverview`
- `src/components/roster-page-client.tsx`, `lineup-page-client.tsx`, `scenarios-page-client.tsx`, `import-export-page-client.tsx`, `settings-page-client.tsx`, and `player-profile-page-client.tsx` each own one dedicated workbench/page surface
- shared business logic is factored into reusable pure modules: `roster-actions.ts`, `lineup-actions.ts`, and `export-actions.ts`
- `Toast`, `HelpDrawer`, `GuideOverlay`, and `ThemeToggle` are reusable adjunct UI layered around the page shells rather than around a DOM manager

This means the repository now has one primary UI mode:

1. React route pages and shell-driven workbenches for home / roster / lineup / scenarios / import-export / settings / player profile

### 5. Database schema

`supabase/migrations/20260529093022_create_app_workspace.sql` currently defines a single table:

- `public.app_workspace`
  - `id uuid primary key`
  - `slug text unique`
  - `version integer`
  - `data jsonb`
  - timestamps

Observed SQL behavior:

- `pgcrypto` is enabled if needed
- row level security is enabled on `public.app_workspace`
- `anon` and `authenticated` roles are revoked from the table
- a default `slug = 'default'` row is inserted if missing

## Dependency / Boundary Notes

These notes are based on current code imports and call sites, not aspirational rules.

- `src/app/**` acts as the runtime boundary: pages and API routes call into `src/lib/**`
- `src/lib/workspace.ts` is intentionally reused across server and client code for shared types and pure logic
- browser code does not import `pg`; database access stays in `db.ts` / `workspace-store.ts`
- client persistence goes through `fetch('/api/workspace')` in `workspace-client.ts`
- auth verification happens at the cookie/API boundary, not inside business-rule helpers
- React route pages persist through `workspace-client.ts` and the shared `/api/workspace` boundary rather than calling database code directly
- homepage direct actions reuse shared pure logic (`lineup-actions.ts`, `export-actions.ts`) instead of selector-based DOM bridge calls
- `roster-actions.ts` now also owns roster filter helpers used by the roster workbench

## Tooling and Enforcement

Evidence-backed enforcement currently present in the repo:

- **TypeScript strict mode** — `tsconfig.json` sets `"strict": true`
- **Linting** — `eslint.config.mjs` uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- **Automated tests** — `npm test` runs Node tests for `src/lib/*.test.ts`, `src/components/*.test.tsx`, and `src/app/api/*.test.ts`
- **CI** — `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm test`, and `npm run build` on Node 22 and 24

## Open Questions

- `docs/product-specs/` exists, but implemented features are not yet backed by formal per-feature specs.
- No repository-local deployment configuration beyond the generic Next.js app structure is present; operational hosting details are therefore out of scope for this document.
