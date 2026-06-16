# Architecture

## Status

This document describes the repository as currently observed on 2026-06-15.
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
| `src/components/` | React UI components, including the homepage app shell, command-desk overview, help/toast/guide overlays, roster and scenario workbenches, and player profile editor |
| `src/lib/` | Shared domain model, pure business logic, database access, auth, rate limiting, and cross-page client helpers |
| `public/` | Static assets shipped by Next.js |
| `supabase/migrations/` | SQL schema migration for the workspace table |
| `docs/` | Architecture, design docs, quality notes, and references |
| `.github/workflows/` | CI workflow for lint, test, and build |

## Entry Points

### Developer commands

From `package.json`:

- `npm run dev` → `tsx scripts/next-dev.ts` → `next dev`
- `npm run build` → `next build`
- `npm run start` → `next start`
- `npm run lint` → `eslint`
- `npm test` → `tsx --experimental-test-module-mocks --import ./src/lib/test-setup.mjs --test ...`

### Runtime entry points

| Entry point | Role |
|---|---|
| `src/app/page.tsx` | Public HITSZ Baseball recruitment homepage; does not read the private workspace |
| `src/app/panel/login/page.tsx` | Shared-passcode login page with validated return-path support |
| `src/app/panel/login/actions.ts` | Login server action that rate-limits passcode attempts, sets the signed cookie, and redirects |
| `src/app/panel/page.tsx` | Authenticated command-desk homepage |
| `src/app/panel/roster/page.tsx` | Authenticated roster workbench |
| `src/app/panel/scenarios/page.tsx` | Authenticated scenario and lineup workbench |
| `src/app/panel/stats/page.tsx` | Authenticated statistics and game-data center |
| `src/app/panel/settings/page.tsx` | Authenticated settings, import/export, reset, logout, and help page |
| `src/app/panel/players/[playerId]/games/page.tsx` | Authenticated player game-data page |
| `src/app/panel/players/[playerId]/page.tsx` | Authenticated player profile page |
| `src/app/{roster,scenarios,stats,settings,players/**}/` | Redirect aliases that permanently forward to their `/panel` equivalents |
| `src/app/lineup/page.tsx` | Compatibility redirect that forwards `/lineup` to `/panel/scenarios` |
| `src/app/api/logout/route.ts` | Clears the unlock cookie |
| `src/app/api/workspace/route.ts` | Reads the shared workspace snapshot bootstrap endpoint |
| `src/proxy.ts` | Protects `/panel/*` and `/api/workspace/*` by validating the signed unlock cookie |
| `scripts/next-dev.ts` | Wrapper around `next dev` that mirrors logs to `.next/dev/logs/next-dev-wrapper.log` and tolerates broken stdout/stderr pipes |

## Major Components

### 1. Domain model and business rules

`src/lib/workspace/` is the central domain module, split into:

- `types.ts` — workspace, player, scenario, and profile types plus shared constants (positions, labels, guide steps)
- `base.ts` — pure factory functions (createId, createDefaultPlayerProfile, createScenario, createDefaultWorkspace, cloneWorkspace)
- `sanitizers.ts` — input sanitization at every boundary (sanitizeWorkspace, sanitizePlayers, sanitizePlayerProfile, sanitizeScenario, sanitizeAssignments, migrateLegacyState)
- `helpers.ts` — domain helpers (getActiveScenario, buildAutoScenario, analyzeScenarioWarnings, prepareImport, formatting)
- `index.ts` — barrel re-export for backward-compatible `@/lib/workspace` imports

### 2. Persistence and concurrency

Database access is split across:

- `src/lib/db.ts` — lazy `pg.Pool` creation using `DATABASE_URL`, with Supabase-host detection that normalizes `sslmode` handling and enforces strict TLS certificate verification
- `src/lib/workspace-store.ts` — assembles the shared workspace snapshot from normalized tables and applies transactional version-checked writes

Observed behavior:

- the app uses one logical workspace slug: `default`
- `app_workspace_meta` stores the workspace version/token and top-level preferences
- players, positions, scenarios, assignments, games, innings, stat lines, and milestones live in dedicated `app_*` tables
- reads sanitize database data before returning it
- writes sanitize incoming workspace data before persisting it
- updates increment a numeric `version`
- update conflicts return `null` when the requested `version` no longer matches the locked workspace-meta row
- the legacy `public.app_workspace` JSONB table is retained only as a rollback/bootstrap source during the cutover window

On the client side, `src/lib/workspace-client.ts` keeps `GET /api/workspace` as the bootstrap read path, while normal writes go through resource-specific routes such as `/api/players`, `/api/scenarios/*`, `/api/games/*`, `/api/milestones/*`, and `/api/workspace/import|reset|preferences`. Conflict retries are handled by `submitMutationWithRetry()`.

### 3. Authentication and request protection

The app uses a shared-passcode model rather than per-user accounts. The public homepage is deliberately outside this boundary.

Relevant files:

- `src/lib/auth.ts` — verifies `APP_ADMIN_PASSCODE_HASH`, signs cookies with `AUTH_SECRET`, and enforces absolute session expiry
- `src/app/panel/login/actions.ts` — verifies the submitted passcode, applies rate limiting, sets the `baseball_manager_unlock` cookie, and redirects
- `src/lib/rate-limiter.ts` — in-memory fixed-window rate limiter used by login submissions, logout, and workspace routes
- `src/proxy.ts` — redirects unauthenticated `/panel/*` requests to `/panel/login` and rejects unauthenticated `/api/workspace/*` requests with `401`
- `src/app/api/logout/route.ts` — expires the cookie

Observed limits and boundaries:

- login submissions are limited per IP to 5 requests per 60 seconds
- workspace reads, workspace resource writes, and logout requests also have route-level rate limits
- the unlock cookie is `httpOnly`, `sameSite=lax`, `secure` in production, and includes a server-validated absolute expiry
- `/panel/login` validates its `next` parameter against `/panel`-local paths before navigation
- panel and API responses receive `private, no-store` headers through `next.config.ts`

### 4. React page-shell architecture

The legacy homepage runtime has been retired. The current UI is now route-based React throughout.

- `src/components/player-manager-client.tsx` renders the homepage command desk using `AppShell` + `HomeOverview`
- `src/components/roster-page-client.tsx`, `scenarios-page-client.tsx`, `stats-page-client.tsx`, `settings-page-client.tsx`, `player-profile-page-client.tsx`, and `games-page-client.tsx` each own one dedicated workbench/page surface
- `src/components/lineup-page-client.tsx` remains as a standalone extracted lineup-board implementation and test surface, but no live route renders it directly
- shared business logic is factored into reusable pure modules: `roster-actions.ts`, `lineup-actions.ts`, and `export-actions.ts`
- `Toast`, `HelpDrawer`, and `GuideOverlay` are reusable adjunct UI layered around the page shells rather than around a DOM manager

This means the repository now has one primary UI mode:

1. React route pages and shell-driven workbenches for public home / command desk / roster / scenarios / stats / settings / player profile / player games, with redirect aliases for legacy entry paths

### 5. Database schema

Current production schema is defined by these migrations:

- `20260529093022_create_app_workspace.sql`
- `20260616195000_normalize_workspace_storage.sql`
- `20260616223000_backfill_normalized_workspace_storage.sql`

The current runtime shape is:

- `public.app_workspace_meta`
  - workspace slug, version token, active scenario id, preferences, timestamps
- `public.app_player`
- `public.app_player_position`
- `public.app_scenario`
- `public.app_scenario_defense_assignment`
- `public.app_scenario_lineup_slot`
- `public.app_game`
- `public.app_game_inning`
- `public.app_game_stat_line`
- `public.app_milestone`
- legacy `public.app_workspace`
  - retained temporarily as rollback / bootstrap source during the cutover window

Observed SQL behavior:

- `pgcrypto` is enabled if needed
- row level security is enabled on all exposed workspace tables
- `anon` and `authenticated` roles are revoked from the tables used by the app
- one logical workspace slug, `default`, is still used across the system

## Dependency / Boundary Notes

These notes are based on current code imports and call sites, not aspirational rules.

- `src/app/**` acts as the runtime boundary: pages and API routes call into `src/lib/**`
- `src/lib/workspace.ts` is intentionally reused across server and client code for shared types and pure logic
- browser code does not import `pg`; database access stays in `db.ts` / `workspace-store.ts`
- client bootstrap reads go through `fetch('/api/workspace')` in `workspace-client.ts`
- auth verification happens at the cookie/API boundary, not inside business-rule helpers
- React route pages persist through `workspace-client.ts` and the resource-oriented `/api/*` boundary rather than calling database code directly
- homepage direct actions reuse shared pure logic (`lineup-actions.ts`, `export-actions.ts`) instead of selector-based DOM bridge calls
- `roster-actions.ts` now also owns roster filter helpers used by the roster workbench

## Tooling and Enforcement

Evidence-backed enforcement currently present in the repo:

- **TypeScript strict mode** — `tsconfig.json` sets `"strict": true`
- **Linting** — `eslint.config.mjs` uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- **Automated tests** — `npm test` runs Node tests for `src/lib/*.test.ts`, `src/components/*.test.tsx`, and `src/app/api/*.test.ts`
- **CI** — `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm test`, and `npm run build` on Node 22 and 24

## Open Questions

- No repository-local deployment configuration beyond the generic Next.js app structure is present; operational hosting details are therefore out of scope for this document.
