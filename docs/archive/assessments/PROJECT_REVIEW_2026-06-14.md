# Project Review — Baseball Player Manager

**Date:** 2026-06-14  
**Scope:** Full codebase (~13K LOC) — domain, persistence, API routes, components, tests  
**Assessments synthesized from:** Architecture, Routes & Backend, Code Quality reviews

---

## 1. Executive Summary

- **The domain model is the app's strongest asset.** Pure functions with real baseball knowledge (auto-assignment, scenario warnings, position-aware profiles) are well-isolated from framework and IO concerns.
- **API routes are partially protected.** `src/proxy.ts` is active (Next.js 16 renamed `middleware.ts` → `proxy.ts`), but its matcher is narrower than "all `/api/*`" — see TD-10.
- **The persistence layer has zero automated tests.** Optimistic concurrency — the app's most critical reliability mechanism — runs entirely on untested code in `workspace-store.ts`.
- **Code duplication is the most actionable quality issue.** `NAV_ITEMS`, the lineup board layout (`FieldBoard` + `LineupOrder` + `BenchPanel`), and the save-with-retry logic are duplicated across 2–4 page components.
- **Test coverage is broad at the domain/component level but missing in the server layer.** Domain logic, components, and auth have good tests. The store, proxy/middleware, and database utilities do not.

> **Correction (2026-06-18):** the original review listed `src/proxy.ts` as "dead code" and recommended renaming it to `src/middleware.ts`. That recommendation was based on Next.js 15 knowledge. In **Next.js 16**, the file convention was renamed the other way: `middleware.ts` → `proxy.ts` (with the exported function also named `proxy`). The build output explicitly reports `ƒ Proxy (Middleware)` and `curl` against `/api/workspace` and `/panel/roster` returns `401` / `307 → /panel/login`, confirming the proxy is active. The remaining gap is the matcher scope, not the file itself.

---

## 2. Overall Health Score

**Grade: B (75–82)**

The app is production-quality for its current scale (single-team, single-instance). The architecture is clean, the domain model is deep, and most runtime paths are tested. Two things prevent an A:

| Blocker | Impact |
|---|---|
| Narrow proxy matcher → resource write APIs (`/api/players/*`, `/api/scenarios/*`, `/api/games/*`, `/api/milestones/*`) accept unauthenticated requests (TD-10) | 🔴 Security |
| Zero persistence-layer tests | 🔴 Reliability |
| Duplicated component logic across pages | 🟡 Maintainability |

---

## 3. Architecture

### 3.1 Layer Diagram

```
┌──────────────────────────────────────────────────────┐
│  UI (React 19 / Next.js 16 App Router)               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ AppShell    │  │ Page Clients │  │ Adjuncts    │ │
│  │ (masthead,  │  │ (roster,     │  │ (Toast,     │ │
│  │  nav, frame)│  │  lineup,     │  │  HelpDrawer,│ │
│  │             │  │  scenarios,  │  │  Guide,     │ │
│  │             │  │  settings,   │  │  ThemeToggle)│ │
│  │             │  │  stats,      │  │             │ │
│  │             │  │  profile)    │  │             │ │
│  └─────────────┘  └──────────────┘  └─────────────┘ │
├──────────────────────────────────────────────────────┤
│  API (Next.js Route Handlers)                        │
│  ┌────────────┐  ┌────────┐  ┌────────────────────┐ │
│  │ /unlock    │  │/logout │  │ /workspace (GET/PUT)│ │
│  │ Zod + rate │  │ Cookie │  │ Zod + OCC           │ │
│  │ limit      │  │ clear  │  │ ⚠️ NO AUTH GUARD    │ │
│  └────────────┘  └────────┘  └────────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │ proxy.ts (active, matches /panel/* + /api/workspace/*)  │ │
│  └─────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│  Persistence (workspace-store.ts / db.ts)            │
│  ┌──────────────────────────────────────────────────┐│
│  │ pg.Pool → public.app_workspace (single JSONB row)││
│  │ SQL: UPDATE ... WHERE slug=$1 AND version=$2     ││
│  │ Retry: client-side saveWithRetry (up to 3)       ││
│  │ Migration: migrateV2toV3 on every read           ││
│  └──────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────┤
│  Domain (src/lib/workspace/) — Pure, zero IO         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ types.ts │ │ base.ts  │ │ sanitiz. │ │helpers │ │
│  │ 12+      │ │ factories│ │ deep     │ │ auto-  │ │
│  │ domain   │ │ + demo   │ │ validat. │ │ assign │ │
│  │ types    │ │ data     │ │ at bound │ │ warning│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │roster-actions│ │lineup-actions│ │export-actions│ │
│  │ upsert/bulk/ │ │ defense/     │ │ import/      │ │
│  │ delete/filter│ │ lineup mut.  │ │ export/json  │ │
│  └──────────────┘ └──────────────┘ └─────────────┘ │
└──────────────────────────────────────────────────────┘
```

> **Correction (2026-06-18):** the persistence layer was re-architected on 2026-06-16 — see [ADR-007](../design-docs/adr-007-normalized-workspace-storage.md). The single `app_workspace` JSONB row was replaced by a normalized `app_*` table family (`app_workspace_meta` + `app_player` + `app_scenario` + `app_game` + …), with transactional version-checked writes and `revalidateTag()` cross-request cache invalidation. The diagram and §7 SQL below reflect the pre-cutover state at the time of the original review; current code is in `src/lib/workspace-store.ts`.

### 3.2 Layer Ratings

| Layer | Rating | Key Evidence |
|---|---|---|
| Domain | **Strong** | Pure functions; no framework/IO imports; deep baseball knowledge encoded |
| Persistence | **Adequate** | OCC is correct but untested; single-row bottleneck; no transaction wrapping |
| API | **Adequate** (🔴 Critical gap) | Good Zod validation and status codes, but proxy matcher does not cover resource write APIs (TD-10) |
| UI | **Strong** | Consistent server/client split pattern; `AppShell` composition; ARIA coverage |

### 3.3 Key Architectural Findings

**Strengths:**
- Clean four-layer separation: Domain → Persistence → API → UI
- Domain never imports React, Next.js, or `pg`
- Every page follows the same SSR pattern: check auth → load snapshot → render client
- `AppShell` provides consistent masthead/nav across all 8 workbench pages
- Action modules (`roster-actions`, `lineup-actions`, `export-actions`) are pure functions shared across pages

**Concerns:**
- Auth check + snapshot loading boilerplate duplicated across all 8 page files
- Single JSONB row for entire workspace — all edits compete on one database row
- In-memory rate limiter resets on server restart, doesn't scale horizontally
- No database migration framework (single SQL file, no versioning)

---

## 4. Routes & API

### 4.1 Route Inventory

| # | Route | Type | Auth Guard | Notes |
|---|-------|------|-----------|-------|
| 1 | `/` | Page (SSR) | ✅ Cookie check | Home / command desk |
| 2 | `/roster` | Page (SSR) | ✅ Cookie check | Roster management |
| 3 | `/lineup` | Page (SSR) | — | **Redirects 307 → `/scenarios`** (dead route) |
| 4 | `/scenarios` | Page (SSR) | ✅ Cookie check | Lineup scenarios |
| 5 | `/settings` | Page (SSR) | ✅ Cookie check | Settings |
| 6 | `/stats` | Page (SSR) | ✅ Cookie check | Stats dashboard |
| 7 | `/players/[playerId]` | Page (SSR) | ✅ Cookie check | Player profile |
| 8 | `/players/[playerId]/games` | Page (SSR) | ✅ Cookie check | Player game log |
| 9 | `POST /api/unlock` | API Route | ❌ None (rate limited) | Passcode → signed cookie |
| 10 | `POST /api/logout` | API Route | ❌ None | Clears cookie |
| 11 | `GET /api/workspace` | API Route | ✅ Cookie check (proxy active) | Read workspace snapshot |
| 12 | `PUT /api/workspace` | API Route | ✅ Cookie check (proxy active, 405 method_not_allowed) | Whole-workspace write disabled; resource-specific writes use `/api/players/*` etc. |

### 4.2 API Design Assessment: 🟢 Good

- Proper HTTP methods: `POST` for auth, `GET`/`PUT` for workspace CRUD
- Correct status codes: `200`, `204`, `400`, `401`, `409`, `429`
- Zod request body validation with structured error details
- Version-based OCC via `WHERE version = $4`
- Consistent JSON error envelope: `{ error: "code" }`

### 4.3 🔴 Critical: Proxy Is Active, But Matcher Is Too Narrow

`src/proxy.ts` exports a function `proxy(request: NextRequest)` with `config.matcher: ["/panel/:path*", "/api/workspace/:path*"]` that checks the signed unlock cookie and either redirects panel requests to `/panel/login` or returns `401` for unmatched API requests. **This file is alive and enforced** — Next.js 16 uses `proxy.ts` (not `middleware.ts`) as the request-processor file convention.

Empirical verification (2026-06-18):

- `npm run build` output reports `ƒ Proxy (Middleware)` for the project
- `curl -i http://localhost:3000/api/workspace` returns `HTTP/1.1 401 Unauthorized`
- `curl -i http://localhost:3000/panel/roster` returns `HTTP/1.1 307 → /panel/login?next=%2Fpanel%2Froster`

**The remaining gap is matcher scope, not file aliveness.** The proxy only protects `/api/workspace/:path*`; the resource write APIs under `/api/players/*`, `/api/scenarios/*`, `/api/games/*`, and `/api/milestones/*` are not in the matcher, so they currently accept any request that passes Zod validation. This is tracked as **TD-10** in `docs/exec-plans/tech-debt-tracker.md`.

**Fix:** Extend the matcher to `["/panel/:path*", "/api/:path*"]` (or split it into per-resource groups), and add tests covering each new matched route. The TD-10 entry already calls this out.

### 4.4 Auth Flow

```
User submits passcode
  → POST /api/unlock
    → verifyPasscode() — plain string comparison against APP_ADMIN_PASSCODE
    → createUnlockCookieValue() — HMAC-SHA256("v1:unlocked", passcode) → hex
  ← Set-Cookie: baseball_manager_unlock=v1:unlocked.<signature>
    (httpOnly, sameSite=lax, secure in prod, 7-day maxAge)

Page SSR:
  → isUnlockCookieValid() → split on "." → timingSafeEqual(HMAC compare)
```

**Strengths:** HMAC prevents cookie forgery; `timingSafeEqual` prevents timing attacks; `httpOnly` blocks JS access.

**Gaps:** Plain-text passcode comparison (no hash); passcode doubles as cookie signing key (changing it invalidates all sessions); no server-side session expiration; no CSRF token on `PUT /api/workspace`.

### 4.5 Missing Pages

| File | Impact |
|---|---|
| `not-found.tsx` | Missing/invalid routes show default Next.js 404, not a branded page |
| `error.tsx` | DB connection failures on pages produce unhandled crash, not user-facing error |
| `loading.tsx` | No suspense fallback while `getOrCreateWorkspaceSnapshot()` resolves — blank white screen |

### 4.6 Rate Limiting Gaps (state as of 2026-06-18)

| Endpoint | Rate Limited? | Risk |
|----------|--------------|------|
| `POST /api/unlock` | ✅ 5/60s/IP | Protected |
| `POST /api/logout` | ✅ 20/60s/IP (see `src/app/api/logout/route.ts`) | Protected |
| `GET /api/workspace` | ✅ 120/60s per IP+session (see `enforceWorkspaceReadRateLimit` in `_workspace-api.ts`) | Read flood guarded |
| `PUT /api/workspace` | ✅ 30/60s per IP+session (`PUT` is now `405 method_not_allowed`; preconditions still apply) | Write flood + 503 maintenance guard |
| Resource writes under `/api/players/*`, `/api/scenarios/*`, `/api/games/*`, `/api/milestones/*` | ❌ None at route level | **TD-10** — only proxy matcher gap remains; client retries do not defend server-side |

---

## 5. Code Quality

### 5.1 Top Issues by Severity

#### 🔴 Critical

| ID | Title | Location |
|---|---|---|
| — | Narrow proxy matcher → resource write APIs accept unauthenticated requests (TD-10) | `src/proxy.ts` matcher (see §4.3) |

#### 🟠 Major (4 issues)

| ID | Title | Files |
|---|---|---|
| CD1 | **NAV_ITEMS duplicated 4 times.** Only the `active` flag differs. | `player-manager-client.tsx:42-47`, `roster-page-client.tsx:43-48`, `lineup-page-client.tsx:44-49`, `scenarios-page-client.tsx:54-59` |
| CD2 | **Board rendering duplicated.** `<FieldBoard>` + `<LineupOrder>` + `<BenchPanel>` layout is identical in 2 pages. | `lineup-page-client.tsx:139-171`, `scenarios-page-client.tsx:260-292` |
| CD3 | **Save-with-retry logic duplicated.** Both define identical `handleSave` with version conflict handling. | `lineup-page-client.tsx:66-88`, `scenarios-page-client.tsx:90-108` |

> Note: CD1–CD3 are all instances of the same root cause — missing shared constants, components, and hooks. Extracting them would eliminate ~200 lines of duplicated code.

#### 🟡 Minor (10 issues)

| ID | Title | Location |
|---|---|---|
| DP1 | `removePlayersFromWorkspace` mutates draft in-place (inconsistent with `structuredClone`-and-return pattern in `lineup-actions`) | `helpers.ts:110-130` |
| EH1 | Empty catch swallows error — should check `instanceof Error` or log it | `scenarios-page-client.tsx:120-122` |
| EH2 | Unstructured `console.error` in catch blocks — no structured logging | Multiple client files |
| TS1 | `sanitizeRadar<T>` returns `as T` without runtime verification that fallback keys match generic | `sanitizers.ts:56` |
| CS2 | Magic number `9` scattered for lineup size — should be `LINEUP_SIZE` constant | `base.ts:106`, `helpers.ts:116`, `sanitizers.ts:220` |
| CS3 | Demo data logic coupled with factory in `createDemoPlayerProfile` | `base.ts:76-112` |
| TQ1 | Position-removal test uses conditional that silently passes if player lacks P | `roster-actions.test.ts:184` |
| TQ2 | Missing test coverage for helpers, stats, game sanitizers | `workspace.test.ts` (only 4 behaviors) |
| PF1 | `stats.ts` reduce over all games per-player without memoization | `stats.ts:59-86` |
| AX1 | Missing `htmlFor`/`id` association on dialog form labels | `roster-page-client.tsx:332-343` |
| AX2 | No focus trap or focus-return when dialogs open/close | All dialog components |

### 5.2 Quick Wins (< 1 hour each)

| # | Task | Estimated Time |
|---|---|---|
| 1 | Extend the proxy matcher in `src/proxy.ts` to cover `/api/:path*` (or per-resource groups) so `/api/players/*`, `/api/scenarios/*`, `/api/games/*`, `/api/milestones/*` reject unauthenticated requests; add unauthenticated-write tests for each new matched route (TD-10) | **20 min** |
| 2 | Extract `LINEUP_SIZE = 9` constant into `types.ts`, replace 3 inline `9`s | **15 min** |
| 3 | Extract shared `NAV_ITEMS` constant into a `nav-items.ts` file | **20 min** |
| 4 | Remove or populate the dead `/lineup` 307 redirect route | **10 min** |
| 5 | Add `htmlFor`/`id` associations on dialog form labels | **20 min** |
| 6 | Fix empty catch in `scenarios-page-client.tsx` — log the error before showing toast | **5 min** |
| 7 | Add `poweredByHeader: false` to `next.config.ts` | **2 min** |
| 8 | Bump `tsconfig.json` target from `ES2017` to `ES2022` | **2 min** |

**Total Quick Wins time: ~2 hours for 8 improvements**

### 5.3 TypeScript Discipline: Strong

- `strict: true` enabled
- Discriminated unions used throughout (`RosterDialogState`, `ScenarioDialogState`, `PendingImport`, validation returns)
- `unknown` at IO boundaries with narrow casts in sanitizers
- Virtually zero `any` in domain code
- One blind cast: `sanitizeRadar<T>` returns `as T` without runtime type verification

### 5.4 Domain Purity: Strong

| Module | Purity | Notes |
|---|---|---|
| `stats.ts` | ✅ Pure | All functions compute from immutable input |
| `sanitizers.ts` | ✅ Pure | Returns new objects; no mutation |
| `base.ts` | ✅ Pure | Factory functions only |
| `roster-actions.ts` | ⚠️ Mixed | Mutates `draft: Workspace` in-place (by design) |
| `lineup-actions.ts` | ✅ Better | Returns new `Workspace` via `structuredClone` |
| `export-actions.ts` | ✅ Pure | Read-only |
| `helpers.ts` | ⚠️ Mixed | `buildAutoScenario` is pure; `removePlayersFromWorkspace` mutates draft |

### 5.5 Test Coverage

**What IS tested (28 test files):**

| Category | Scope |
|---|---|
| Domain logic | Sanitizers, auto-assignment, warnings, player removal (4 behaviors only) |
| Auth | Passcode verification, cookie sign/validate |
| Rate limiting | Fixed-window rate checks |
| Roster actions | Upsert, bulk edit, delete, filter, validation |
| Lineup actions | Lineup mutations |
| Stats | Statistical computations |
| Export actions | Import/export logic |
| Components | 17 test files — all major pages and adjuncts |
| API routes | Unlock flow, workspace GET/PUT |

**What is NOT tested:**

| Untested Module | Risk Level |
|---|---|
| `workspace-store.ts` | 🔴 **High** — OCC, version conflicts, insert race |
| `db.ts` | 🟠 Medium — Connection pool, SSL config |
| `proxy.ts` | 🟢 Low — Active Next.js 16 request proxy; covered by `src/lib/proxy.test.ts` (matcher scope is TD-10, not file aliveness) |
| `migrate-v2-to-v3.ts` | 🟠 Medium — Runs on every read |
| `unlock-form.tsx` | 🟢 Low — Thin component |
| Server page components | 🟢 Low — Thin auth + load wrappers |

**Bottom line:** 302 test results (300 pass + 2 todo) as of 2026-06-18. Good breadth at the domain, component, scoreboard, hall-of-fame and auth/rate-limit/proxy layers. **The persistence layer is still the critical gap** — `workspace-store.ts` (1504 lines) remains untested; this is the highest-impact follow-up to close.

---

## 6. Security

### 6.1 Consolidated Assessment

| Area | Rating | Notes |
|---|---|---|
| Auth mechanism | 🟡 Fair | HMAC-signed cookies are sound; passcode = signing key prevents rotation |
| API route protection | 🟡 Fair (TD-10) | Proxy is active, but matcher is narrower than "all `/api/*`"; `/api/workspace/*` is protected, resource writes under `/api/players/*`, `/api/scenarios/*`, `/api/games/*`, `/api/milestones/*` are not |
| Cookie security | 🟢 Good | `httpOnly`, `sameSite=lax`, `secure` in production, 7-day maxAge |
| Timing attacks | 🟢 Good | `timingSafeEqual` on signature comparison |
| Rate limiting | 🟡 Fair | Only on `/api/unlock`; in-memory (resets on restart) |
| Input validation | 🟢 Good | Zod on API routes + sanitizers as defense-in-depth |
| CSRF | 🟡 Fair | `sameSite=lax` + JSON-only API is reasonable; no explicit CSRF token |
| Security headers | 🟢 Good (since 2026-06-04) | `next.config.ts` ships CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and `private, no-store` cache headers for `/panel/*` and `/api/*` |
| Passcode storage | 🟢 OK | Plain-text comparison is acceptable for shared-passcode model |
| Row-level security | 🟢 Good | RLS enabled on `app_workspace`; `anon`/`authenticated` roles revoked |

### 6.2 Security Fix Priorities (state as of 2026-06-18)

1. **Immediate:** Extend the proxy matcher in `src/proxy.ts` to cover `/api/:path*` (or per-resource groups) so `/api/players/*`, `/api/scenarios/*`, `/api/games/*`, `/api/milestones/*` reject unauthenticated requests (TD-10). The 2026-06-14 review's "rename to middleware.ts" recommendation is voided by the Next.js 16 proxy convention.
2. **High:** ~~Add rate limiting to `/api/workspace` and `/api/logout`.~~ **Done** — see `enforceWorkspaceReadRateLimit` / `enforceWorkspaceWritePreconditions` in `_workspace-api.ts` (120/30 req per 60s, keyed by IP+session) and the 20/60s limit in `src/app/api/logout/route.ts`. Remaining work: extend the same precondition to resource write APIs once the proxy matcher is widened (TD-10 dependency).
3. **Medium:** ~~Add security headers via `next.config.ts` `headers()` config.~~ **Done** — see `next.config.ts` (`CONTENT_SECURITY_POLICY`, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cache-Control).
4. **Low:** Separate passcode from cookie signing key (add `APP_COOKIE_SECRET`).
5. **Low:** Consider bcrypt/argon2 for passcode hashing if rotation support is desired.

---

## 7. Reliability

### 7.1 Optimistic Concurrency

The app uses a version-based OCC pattern:

```sql
UPDATE public.app_workspace
SET data = $1::jsonb, version = $2, updated_at = timezone('utc', now())
WHERE slug = $3 AND version = $4
RETURNING slug, version, data, updated_at
```

**Assessment:**
- Correct pattern — `WHERE version = $4` detects mid-air collisions
- PostgreSQL MVCC guarantees exactly one writer succeeds when two race on the same version
- Client-side `saveWithRetry()` reloads latest snapshot, re-applies mutation, retries up to 3 times
- Double-sanitization on both write and read is good defense-in-depth

**Risks:**
- Single JSONB row means all concurrent edits (even to different players) conflict — acceptable at current scale
- No server-side retry — retry logic lives only in the client
- The entire OCC path is **untested** — no automated coverage for the store

### 7.2 Error Handling

| Pattern | Assessment |
|---|---|
| Save/retry | ✅ `saveWithRetry` with 3 retries on 409 conflict |
| Version conflicts | ✅ 409 detection → reload → retry or notify user |
| Validation returns | ✅ Discriminated union: `{valid: false, error: string}` |
| User-facing errors | ✅ Toast notifications |
| Network errors | ✅ `try/catch` with user messages |
| Stale error swallowing | ⚠️ Empty catch in `scenarios-page-client.tsx:120-122` |
| Structured logging | ❌ Only unstructured `console.error` |

### 7.3 Failure Modes

| Scenario | Behavior | Assessment |
|---|---|---|
| DB connection fails on page load | Unhandled error → blank/crash (no `error.tsx`) | 🟡 Needs error boundary |
| DB connection fails on save | `try/catch` → toast "保存失败" | ✅ Handled |
| Version conflict on save | Retry up to 3 times, then toast | ✅ Handled |
| Insert race on first workspace | `ON CONFLICT DO NOTHING` + retry select | ✅ Handled |
| Invalid input | Zod validation rejects with structured errors | ✅ Handled |
| Passcode brute force | Rate limited (5/60s/IP), but in-memory | 🟡 Acceptable for single-instance |
| Server restart | Rate limit counters reset | 🟢 Low impact |
| Large payload attack | No request body size limit on `PUT /api/workspace` | 🟡 Needs limit |

---

## 8. Recommendations

### 8.1 By Priority

#### 🔴 Immediate (should ship this week)

| # | Action | Effort | Files |
|---|---|---|---|
| 1 | **Extend the proxy matcher** to cover all `/api/*` routes and add unauthenticated-write tests for each new matched route (TD-10) | **Low** (20 min) | `src/proxy.ts` matcher |
| 2 | **Add tests for `workspace-store.ts`** covering: version conflict detection, `getOrCreateWorkspaceSnapshot` insert race, OCC retry, migration on read | **Medium** (2–3 hours) | New `src/lib/workspace-store.test.ts` |

#### 🟠 High (next sprint)

| # | Action | Effort | Files |
|---|---|---|---|
| 3 | **Extract shared `useWorkspaceSave` hook** to eliminate duplicated save-with-retry logic | **Low** (30 min) | New `src/hooks/use-workspace-save.ts`; update `lineup-page-client.tsx`, `scenarios-page-client.tsx` |
| 4 | **Extract shared `<LineupBoard>` component** (FieldBoard + LineupOrder + BenchPanel) | **Low** (30 min) | New `src/components/lineup-board.tsx`; update 2 page clients |
| 5 | **Add rate limiting to resource write APIs** (`/api/players/*`, `/api/scenarios/*`, `/api/games/*`, `/api/milestones/*`) once the proxy matcher is extended | **Low** (20 min) | new route groups |

#### 🟡 Medium (this month)

| # | Action | Effort |
|---|---|---|
| 6 | Create `error.tsx`, `not-found.tsx`, `loading.tsx` in `src/app/` | **Low** (30 min) |
| 7 | Add security headers via `next.config.ts` (CSP, X-Frame-Options, X-Content-Type-Options) | **Low** (15 min) |
| 8 | Extract shared `NAV_ITEMS` constant + `LINEUP_SIZE = 9` constant | **Low** (20 min) |
| 9 | Add `htmlFor`/`id` associations and focus management in dialogs | **Low** (30 min) |
| 10 | Remove or repurpose the dead `/lineup` 307 redirect route | **Low** (10 min) |
| 11 | Add request body size limit to `PUT /api/workspace` | **Low** (5 min) |
| 12 | Expand `workspace.test.ts` coverage: `prepareImport`, `createUniqueScenarioName`, game sanitizers | **Medium** (1–2 hours) |

#### 🟢 Low (nice to have)

| # | Action | Effort |
|---|---|---|
| 13 | Separate passcode from cookie signing key (`APP_COOKIE_SECRET`) | **Low** (20 min) |
| 14 | Bump `tsconfig.json` target to `ES2022` | **Low** (2 min) |
| 15 | Add a shared authenticated layout to deduplicate auth check + snapshot loading boilerplate across 8 page files | **Medium** (1 hour) |
| 16 | Add a health/readiness endpoint (`/api/health`) | **Low** (15 min) |
| 17 | Add structured logging or swap `console.error` for a minimal logger | **Medium** (1 hour) |
| 18 | Move demo data out of `base.ts` into a separate `seed.ts` | **Low** (20 min) |

### 8.2 By Effort

| Effort | Items |
|---|---|
| **Low** (< 30 min) | #1, #3, #4, #5, #6, #7, #8, #9, #10, #11, #13, #14, #16, #18 |
| **Medium** (1–3 hours) | #2, #12, #15, #17 |

### 8.3 Expected Impact

If all Immediate + High items are completed:

- 🔴 **Security gap closed:** API routes protected by middleware
- 🔴 **Reliability improved:** Persistence layer tested, OCC coverage added
- 🟡 **~200 lines of duplicated code eliminated:** Shared hook + shared component + shared constants
- 🟡 **Rate limiting coverage expanded** to workspace and logout endpoints

Estimated total effort for Immediate + High + Medium items: **~10 hours**

---

## Appendix: File Index

| File | Lines (approx) | Role |
|---|---|---|
| `src/lib/workspace/types.ts` | 290 | Domain types, constants, labels |
| `src/lib/workspace/base.ts` | 120 | Factory functions, demo data |
| `src/lib/workspace/sanitizers.ts` | 350 | Deep validation at boundaries |
| `src/lib/workspace/helpers.ts` | 200 | Auto-assignment, warnings, cascade delete |
| `src/lib/roster-actions.ts` | 260 | Roster CRUD operations |
| `src/lib/lineup-actions.ts` | 180 | Lineup/scenario mutations |
| `src/lib/export-actions.ts` | 140 | Import/export logic |
| `src/lib/stats.ts` | 120 | Statistical computations |
| `src/lib/workspace-store.ts` | 210 | PostgreSQL OCC reads/writes |
| `src/lib/db.ts` | 40 | pg.Pool creation |
| `src/lib/auth.ts` | 60 | Passcode + cookie signing |
| `src/proxy.ts` | 33 | Next.js 16 request proxy protecting `/panel/*` and `/api/workspace/*` |
| `src/lib/workspace-client.ts` | 100 | Client-side fetch + retry |
| `src/components/app-shell.tsx` | 80 | Global layout shell |
| `src/components/player-manager-client.tsx` | 120 | Homepage command desk |
| `src/components/home-overview.tsx` | 160 | Homepage alert deck, metrics |
| `src/components/roster-page-client.tsx` | 760 | Roster management |
| `src/components/lineup-page-client.tsx` | 310 | Lineup assignments |
| `src/components/scenarios-page-client.tsx` | 440 | Scenario CRUD + compare |
| `src/app/api/unlock/route.ts` | 50 | Unlock endpoint |
| `src/app/api/workspace/route.ts` | 90 | Workspace GET/PUT |
| `src/app/api/logout/route.ts` | 20 | Logout endpoint |
