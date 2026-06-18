I'll include the full review report here, then the supervisor can persist it.

---

## Review Report for `docs/exec-plans/active/20260616-latency-optimization.md`

---

### BLOCKER (must fix before plan can be acted on)

#### B1. Fundamental technical error: pool `max` does not cause query serialization

**Location:** Plan sections "现状（代码事实）→ 连接池" and "P0-3. 调查并放宽 `max: 1` 连接池"

**What's wrong:** The plan repeatedly claims that `max: 1` in the connection pool causes the 9 `SELECT` queries inside `selectNormalizedWorkspaceRecord` to execute serially. This is **incorrect**.

The 9 queries are serialized because they **all use the same `PoolClient`** object, obtained via `withTransaction()` at `src/lib/workspace-store.ts:213`:

```typescript
async function withTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();  // single client
  ...
}

// selectNormalizedWorkspaceRecord — all 9 queries on the same `client`:
const [playersResult, positionsResult, ...] = await Promise.all([
  client.query(...),   // same client
  client.query(...),   // same client
  ...
]);
```

In the `pg` library, `client.query()` uses a single TCP connection. Calls to `client.query()` on the same client are queued and executed serially by the driver — **regardless of pool `max` setting**. Even with `max: 100`, these 9 queries would still be serial because they share one `PoolClient`.

The pool `max` setting controls how many total connections exist in the pool, but `withTransaction` only ever checks out **one** client. The serialization is inherent to the single-client transaction pattern, not the pool size.

**Impact on the plan:**
- P0-3's goal "selectNormalizedWorkspaceRecord 内部 9 个 SELECT **真并行**" is **unachievable** by adjusting `max` alone
- The "目标结果" table promise "9 个 SELECT 串行总耗时 50–270ms → **< 50ms**（真并行）" is misleading — there's no viable path to this target in P0+P1
- The "读路径 P95 延迟下降 ≥ 50ms" claim for P0-3 may not materialize
- The entire "连接池" diagnosis section needs to be rewritten

**Smallest safe fix:**
- Correct the diagnosis: serialization is from single-client usage within `withTransaction`, not pool `max`
- Either accept the serialization as-is (~5-30ms per query, 50-270ms total — reasonable for single-coach use case) OR consider a redesign: use `REPEATABLE READ` isolation (as P1-3 already proposes for writes), then read tables on separate connections in parallel, relying on the MVCC snapshot for consistency
- Remove or revise the "真并行" goal from the 目标结果 table

#### B2. Wrong line numbers in "连接池" section

**Location:** Plan section "现状（代码事实）→ 连接池"

**What's wrong:** The plan cites:
```
- `src/lib/db.ts:99` `max: 1`（Supabase 路径）
- `src/lib/db.ts:102` `max: 5`（其他 Postgres 路径）
```

Verified at `src/lib/db.ts`:
- **Line 99** is actually `export function getPool() {`
- **Line 102** is actually `  }` (closing brace of `getPool`)
- The actual `max:` configuration is on **line 91**: `max: supabaseConnection ? 1 : 5,`

The P0-3 section correctly cites `db.ts:91` — the inconsistency is within the plan itself (two different line numbers for the same code).

**Smallest safe fix:** Update "连接池" section to cite `src/lib/db.ts:91` instead of lines 99 and 102.

---

### SHOULD-FIX (worth doing now)

#### S1. P0-3's stated goals are partially unachievable

**Location:** P0-3 "目标结果" section

**What's wrong:** As established in B1, "真并行" of the 9 SELECTs on the same client is not achievable by relaxing pool max. Two of P0-3's three stated goals are problematic:

1. "`selectNormalizedWorkspaceRecord` 内部 9 个 `SELECT` **真并行**" — **unachievable** by the described approach
2. "读路径 P95 延迟下降 ≥ 50ms" — **may not materialize from P0-3 alone**; this is more likely to come from P0-2 (`cache()`) and P1-2 (`unstable_cache`)
3. "Supabase 直连（端口 5432）时 `max` 放宽到 5–10" — achievable, but this helps write concurrency, not the 9-SELECT read path

**Smallest safe fix:** Reframe P0-3's goals:
- Change "真并行" to "确认 `max: 1` 是否影响其他路径（并发写、多页面同时加载）"
- Remove or revise the "读路径 P95 延迟下降 ≥ 50ms" target, or acknowledge it comes from P1-2 and P0-2 instead

#### S2. P2-2 description of current API contract is stale

**Location:** P2-2 section: "当前 `/api/players/{id}` PATCH 接口实际接收的是'全量 workspace + version'"

**What's wrong:** The actual PATCH handler at `src/app/api/players/[playerId]/route.ts` accepts `{ version, player }` where `player` is a single player object (validated by `workspaceObjectSchema` then sanitized by `sanitizePlayers`). The contract has already been partially improved by the cutover — it accepts a **single player object** (not full workspace).

What's still true: the underlying implementation (`mutateWorkspaceSnapshot` → `writeNormalizedWorkspace`) still does a full wipe+reinsert. So the plan's point about "执行的是'全 workspace 替换'——名不副实" is still accurate. But the API contract is better than claimed.

**Smallest safe fix:** Update to: "PATCH 接收 `{ version, player }`（单球员对象，但底层仍是全 workspace 替换）"

#### S3. HallOfFamePageClient uses `useMemo`, not `useState(sanitizeWorkspace(...))`

**Location:** P0-1 "改动范围" — lists `hall-of-fame-page-client.tsx`

**What's wrong:** `HallOfFamePageClient` at `src/components/hall-of-fame-page-client.tsx:40-47` uses:
```typescript
const workspace = useMemo(
  () => sanitizeWorkspace(initialWorkspace),
  [initialWorkspace],
);
```

This is a **read-only page** — no mutation callbacks, no `setWorkspace`, no `commitAndSave`. Adding SWR caching would be a **behavior change** (the page would start live-updating when mutations happen in other tabs), not just a mechanical replacement of `useState` with `useSWR`.

The plan's P0-1 claims "所有 `useState(sanitizeWorkspace(initialWorkspace))` 全部替换" and lists HallOfFame, but the pattern there is fundamentally different from the mutation-capable pages.

**Smallest safe fix:** Either acknowledge HallOfFame needs different treatment (add SWR for live-updates but keep it read-only), or remove it from P0-1 scope if the intent is "zero behavior change".

#### S4. INSERT count estimate is somewhat inflated

**Location:** "现状（代码事实）→ 写路径": "约 2000 个 INSERT，每次约 5s"

**What's wrong:** For the stated workload of "20 球员 + 5 方案 + 50 比赛", counting the actual for-loops in `writeNormalizedWorkspace` (`src/lib/workspace-store.ts:626-825`):
- 20 players × 1 + ~60 positions = ~80
- 5 scenarios × (1 + 9 defense + 9 lineup) = 95
- 50 games × (1 + ~9 innings + ~9-12 stat lines) = 50 × 19-22 ≈ 950-1100
- ~10 milestones = 10

Total: ~1,135–1,285. The "约 2000" estimate is ~60% high for the stated workload.

**Smallest safe fix:** Adjust to "约 1000–1500" to match the stated workload.

---

### OPTIONAL (nitpicks / future improvements)

#### O1. No existing test file for workspace-store.ts

**Location:** P1-1: "新增 `src/lib/workspace-store.test.ts`"

This is a proposed addition, not a bug. But note: test files in `src/lib/` use `*.test.ts` naming (e.g., `workspace.test.ts`, `workspace-client.test.ts`). Consider whether `unnest` operations would be better tested as integration tests (requiring a real DB) vs mocked unit tests.

#### O2. "缓存" section lists "无 `src/middleware.ts`" as a missing cache layer

**Location:** "现状（代码事实）→ 缓存"

Listing the absence of middleware as a "missing cache" is misleading. Next.js middleware runs on every request and is typically used for redirects/rewrites/headers, not caching. The header-based caching (P0-2's `Cache-Control`) is the correct approach. Recommend removing or rephrasing this bullet.

#### O3. Goal-to-steps alignment: "9 SELECT < 50ms" has no viable path

**Finding:** Mapping the 7-row "目标结果" table to P0+P1:

| Goal | Delivered by | Status |
|---|---|---|
| 切 tab 0 次请求 | P0-1 (SWR) | ✅ Viable |
| 初次打开 /panel P95 < 400ms | P0-2 + P1-2 (caching) | ✅ Viable |
| 写操作（小）P95 < 500ms | P1-1 (batch INSERT) | ✅ Viable |
| 写操作（中）P95 < 1s | P1-1 (batch INSERT) | ✅ Viable |
| 9 个 SELECT 串行 < 50ms | **No path** | ❌ No viable path in P0+P1 |
| 409 reload 0ms | P1-3 (SWR mutate) | ✅ Viable |
| 浏览器 10s 重复读 0 RTT | P0-2 (Cache-Control) | ✅ Viable |

The "9 个 SELECT < 50ms" goal has no viable path because P0-3 cannot achieve parallelization on a single client, and P1-2 reduces read frequency but not per-read latency. The actual 50-270ms is inherent to serial execution.

---

### Summary

| Severity | Count | Key items |
|---|---|---|
| **BLOCKER** | 2 | B1: `max:1` diagnosis is wrong (serialization is from single-client, not pool size). B2: Wrong line numbers in "连接池" section (99/102 should be 91). |
| **SHOULD-FIX** | 4 | S1: P0-3 goals unachievable as written. S2: P2-2 API description is stale. S3: HallOfFame uses `useMemo` not `useState`. S4: INSERT count ~60% high. |
| **OPTIONAL** | 3 | O1-O3: Test file pattern, middleware cache claim, goal alignment gap. |