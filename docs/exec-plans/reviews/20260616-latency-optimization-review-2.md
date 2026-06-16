# Re-Review Report: `docs/exec-plans/active/20260616-latency-optimization.md`

Reviewer: deepseek/deepseek-v4-flash (fresh context)
Date: 2026-06-16
Run ID: `701bd0a0-9ec7-4a26-8bfa-aea952da8e56`

This is a **re-review** after fixes were applied to address findings from the previous review (saved at `20260616-latency-optimization-review.md`).

## Verification of previous findings

| ID | Status | Notes |
|---|---|---|
| B1 (pool max diagnosis) | ✅ FULLY ADDRESSED | Plan now correctly attributes 9-SELECT serialization to shared `PoolClient` from `withTransaction`, not `max` |
| B2 (wrong line numbers) | ✅ FULLY ADDRESSED | All references now cite `db.ts:91` |
| S1 (P0-3 goals unachievable) | ✅ ADDRESSED | "真并行" goal removed; P0-3 refocused on cross-request concurrency |
| S2 (P2-2 API description) | ✅ ADDRESSED | Now says PATCH receives `{ version, player }` single object |
| S3 (HallOfFame useMemo) | ✅ ADDRESSED | P0-1 scope note added with explicit guidance |
| S4 (INSERT count inflated) | ✅ ADDRESSED | 现状 section updated; P1-1/P2-1 updated in this round |
| O2 (middleware bullet) | ✅ ADDRESSED | Removed from 缓存 section |

## BLOCKER

**None.**

## SHOULD-FIX

### S5. P1-3 REPEATABLE READ rationale was technically confused — REFRAMED

**Original claim:** REPEATABLE READ prevents "反复 409"
**Reality:** 409 convergence is guaranteed by OCC version check + `FOR UPDATE` at `workspace-store.ts:889-901`. REPEATABLE READ only matters for intra-transaction consistency.

**Real value of REPEATABLE READ (now documented):** Single write transaction's 9 SELECTs see a consistent snapshot. With READ COMMITTED, between SELECTs another writer could commit, leading to "半个 v1 + 半个 v2" inconsistency.

**Fix:** P1-3 reframe — honest rationale about intra-transaction consistency, explicit "does NOT solve 409", verification note that 409 convergence test is for OCC mechanism regression (not for REPEATABLE READ).

### S6. `unstable_cache` → `cacheTag` / `cacheLife` (Next.js 16) — NOTED

**Reality:** Next.js 16.2.6 exports `cacheTag` and `cacheLife` from `next/cache` (`node_modules/next/cache.d.ts` lines 14, 28). The newer pattern uses `'use cache'` directive + `cacheTag('workspace')` + `cacheLife({ revalidate: 10 })`.

**Decision:** Keep `unstable_cache` for now (works in API routes, low migration risk). Document the newer pattern as future migration in P1-2's 副作用 section.

## OPTIONAL

### O4. `~2000` still in P1-1 / P2-1 — FIXED

Updated all 4 occurrences to `~1,200` to match the corrected count (20 players + ~60 positions + 5 scenarios × 19 + 50 games × ~19 + ~10 milestones ≈ 1,135–1,285).

### O5. HallOfFame also uses `useState` for UI state — DEFERRED

Clarification suggestion: "HallOfFame 用 `useMemo` 持有 workspace（非 `useState`），且无写回 mutation". Not strictly necessary; the current note ("用 useMemo 而非 useState、无 mutation callback") is accurate for the workspace data path.

### O6. Where to document "9 SELECT parallelization conditions" — DEFERRED

The P0-3 target "显式记录什么条件下 9 SELECT 真并行才有可能" implies documenting in `db.ts` comments. Reviewer suggested `docs/ARCHITECTURE.md` or `docs/RELIABILITY.md` instead. Acceptable either way; can move during P0-3 implementation.

## Summary

| Severity | Previous review | This review |
|---|---|---|
| **BLOCKER** | 2 (resolved ✅) | **0** |
| **SHOULD-FIX** | 4 (resolved ✅) | 2 (1 reframed, 1 noted for future) |
| **OPTIONAL** | 3 (1 resolved ✅) | 3 (1 fixed, 2 deferred) |

**Bottom line:** The plan is technically sound for P0 + P1 execution. All previously-flagged BLOCKER issues are resolved. The remaining SHOULD-FIX items are not blockers. Plan is ready to be acted on.
