# 性能优化 — 前后端调用链路延迟与卡顿

## 背景

面板（`/panel/*`）操作存在明显延迟和卡顿，教练日常使用体感较差。根因不在 UI 层，而在数据访问层和缓存策略：

- **客户端无 SWR / React Query**：每次 mutation 后手动 `loadWorkspaceSnapshot` 整库重读
- **Server Component 无 React `cache()`**：每次页面导航都重新读库
- **HTTP 层无缓存头**：浏览器不会复用响应
- **写路径是 wipe + reinsert**：工作区越大写越慢
- **连接池 `max: 1`**：9 个 `SELECT` 串行化，"并行"只是装饰

## 现状（代码事实）

### 读路径

- `src/lib/panel-server.ts::getPanelWorkspaceSnapshot` → `src/lib/workspace-store.ts::getOrCreateWorkspaceSnapshot` → 1 个事务 + 9 个 `SELECT`（代码上是 `Promise.all`，但 `max: 1` 串行执行）
- 每次 Server Component 渲染都重新查 DB，无 `import { cache } from "react"`
- `src/app/api/workspace/route.ts` 的 `GET` 响应无 `Cache-Control` / `ETag` / `Last-Modified`
- 客户端使用 `useState` 持有 workspace，跨页面导航不共享

### 写路径

- `src/lib/workspace-store.ts::mutateWorkspaceSnapshot` 单事务内：
  1. `ensureNormalizedWorkspaceRecord`（9 个 `SELECT`）
  2. `SELECT ... FOR UPDATE`（锁 meta）
  3. `wipeNormalizedWorkspace`（4 个 `DELETE`）
  4. `writeNormalizedWorkspace`（N 个 `INSERT`，N ≈ 球员 × 1 + 球员 × positions + 方案 × 19 + 比赛 × (1 + 局数 + stat lines) + milestones）
- 20 球员 + 5 方案 + 50 比赛工作区：约 2000 个 `INSERT`，每次约 5s

### 连接池

- `src/lib/db.ts:99` `max: 1`（Supabase 路径）
- `src/lib/db.ts:102` `max: 5`（其他 Postgres 路径）
- 注释说明：`max: 1` 是为绕开 Supabase PgBouncer transaction-mode 的 prepared statement 冲突

### 缓存

- Server Component 无 React `cache()`
- 客户端无 SWR / React Query
- 无 Next.js `unstable_cache` / `revalidateTag`
- 无 HTTP `Cache-Control` / `ETag`
- 无 `src/middleware.ts`

## 目标结果

| 指标 | 现状（估） | 目标结果 |
|---|---|---|
| 切 tab / 重进页面 | 数百 ms 重新打 DB | **0 次 `/api/workspace` 请求**（SWR 命中） |
| 初次打开 `/panel` | 0.5–1.2s | **P95 < 400ms** |
| 写操作（小工作区） | 2–5s | **P95 < 500ms** |
| 写操作（中工作区 ~20 球员 / 50 比赛） | 3–6s | **P95 < 1s** |
| 9 个 `SELECT` 串行总耗时 | 50–270ms | **< 50ms**（真并行） |
| 409 冲突触发的客户端 reload | 200–800ms | **0ms**（同事务 snapshot + SWR `mutate`） |
| 浏览器 10 秒内重复读 | 每次 1 个 RTT | **0 个 RTT**（HTTP 缓存） |

---

## 实施步骤（按优先级）

### P0 — 关键路径优化（每项独立可发布，零行为变更）

#### P0-1. 客户端加 SWR 缓存

**目标结果：**
- 切 tab / 浏览器返回 / 5 秒内重复进入同一页面 → **0 次** `/api/workspace` 请求
- 同一页面多个组件同时挂载时 → **1 次**请求（dedupe）
- 现有 `useState(sanitizeWorkspace(initialWorkspace))` 全部替换为 `useWorkspaceSnapshot(initial)`

**改动范围：**
- 新增 `src/lib/use-workspace-snapshot.ts`（`useSWR` 包装，`fallbackData` 用 `initialSnapshot`）
- 修改 `src/components/player-manager-client.tsx`、`roster-page-client.tsx`、`scenarios-page-client.tsx`、`stats-page-client.tsx`、`hall-of-fame-page-client.tsx`
- 保留 mutation 流程不变：mutate 成功后用 `mutate("workspace-snapshot", newSnapshot, { revalidate: false })` 同步本地缓存

**验证：**
- `npm test` 全绿
- `npm run build` 成功
- 浏览器 Network 面板：切 tab 不再产生 `/api/workspace` 请求
- 同一页面挂载两次 → 只 1 个请求
- 409 冲突后 SWR 自动重新验证拿最新数据

**兜底：**
- `fallbackData` 用 `initialWorkspace` / `initialVersion`，首次请求失败也不阻塞 UI
- SWR 默认静默重试，无需额外错误处理

---

#### P0-2. Server Component `cache()` + 客户端请求去重

**目标结果：**
- 单次 Next.js 渲染中，多个 Server Component 调用 `getOrCreateWorkspaceSnapshot()` → **1 次** DB 调用
- `GET /api/workspace` 响应头 `Cache-Control: private, max-age=10, stale-while-revalidate=30`，浏览器端命中短缓存

**改动范围：**
- `src/lib/workspace-store.ts`：在 `getOrCreateWorkspaceSnapshot` 外层包 `import { cache } from "react"`
- `src/app/api/workspace/route.ts` 响应头注入 `Cache-Control`
- 不动 `mutateWorkspaceSnapshot` / `replaceWorkspaceSnapshot`（写路径不能 cache）

**验证：**
- `npm test` 全绿
- 浏览器 dev tools：10 秒内重复 `GET /api/workspace` 显示 `200 (from disk cache)` 或 `from memory cache`
- 单页 RSC 渲染中 `getOrCreateWorkspaceSnapshot` 只触发 1 个事务（debug 日志验证）

**注意：**
- Next.js `cache()` 仅在同一请求内有效，跨请求仍然每次都查 DB — 这是 P1-2 短窗口缓存的前提

---

#### P0-3. 调查并放宽 `max: 1` 连接池

**目标结果：**
- `selectNormalizedWorkspaceRecord` 内部 9 个 `SELECT` **真并行**
- Supabase 直连（端口 5432）时 `max` 放宽到 5–10
- Supabase transaction-mode Pooler（端口 6543）时维持 `max: 1`，或迁移到 session-mode Pooler
- 读路径 P95 延迟下降 ≥ 50ms

**前置调查：**
- 读取当前 `DATABASE_URL` 解析 hostname / port / query params
- 判断是 Supabase 直连还是 Pooler、Pooler 模式（transaction vs session）
- 监控 Supabase dashboard "Connection" 指标，确认放宽后无 prepared-statement 错误

**改动范围：**
- `src/lib/db.ts`：根据 hostname + port 动态决定 `max`，或新增 `DB_POOL_MAX` env 让运维随时调整
- 注释解释每种模式的取舍

**验证：**
- `npm test` 全绿
- 实际工作区下读 P95 延迟下降 ≥ 50ms
- Supabase dashboard 无新 prepared-statement 错误日志

**兜底：**
- 放宽后出现 prepared-statement 错误 → 通过 `DB_POOL_MAX=1` env 立即回退
- 准备 feature flag 控制是否启用放宽

---

### P1 — 写路径性能提升（行为不变，只优化 IO）

#### P1-1. 批量 INSERT（`unnest`）

**目标结果：**
- `writeNormalizedWorkspace` 中所有 for-loop `INSERT` 改为单条 `unnest` 批量 `INSERT`
- 工作区写入 RTT 数量从 ~2000 降到 ~10（每个被改的表 1 个 RTT）
- 写延迟从 2–5s 降到 600ms–1s（小工作区）

**改动范围：**
- `src/lib/workspace-store.ts::writeNormalizedWorkspace`
- 5 处 for-loop：players / positions / scenarios / defense / lineup / games / innings / stat_lines / milestones
- 每个循环改为 `INSERT ... SELECT * FROM unnest($1::uuid[], $2::text[], $3::int[], ...)`
- 新增 `src/lib/workspace-store.test.ts` 单元测试覆盖空数组 / 单行 / 多行 / 类型不匹配

**验证：**
- `npm test` 全绿
- 端到端：编辑一个球员，写操作耗时下降 ≥ 50%
- 写入后 `getOrCreateWorkspaceSnapshot` 返回结果与改动前**字段级一致**（用现有快照测试覆盖）

---

#### P1-2. `unstable_cache` 短窗口缓存（5–10s）

**目标结果：**
- 同一 5–10 秒窗口内的多次 `loadWorkspaceSnapshot()` 共享同一个服务端缓存值
- 不影响 mutation：写操作完成后 SWR 主动 `mutate(key)` 重新验证
- 写操作不被错误地返回旧数据（mutation 后调用 `revalidateTag`）

**改动范围：**
- `src/lib/workspace-store.ts`：`getOrCreateWorkspaceSnapshot` 改用 `unstable_cache(fn, ["workspace"], { revalidate: 10, tags: ["workspace"] })`
- 写操作（`mutateWorkspaceSnapshot` / `replaceWorkspaceSnapshot`）成功后调用 `revalidateTag("workspace")`
- 客户端无需改动（P0-1 的 SWR 失效由 `mutate` 触发）

**验证：**
- `npm test` 全绿
- 写后立刻读（绕过 SWR 直接 `fetch /api/workspace`）能拿到新数据
- 5 秒内重复读命中缓存

---

#### P1-3. `REPEATABLE READ` 隔离级 + 409 reload 收敛

**目标结果：**
- 写事务使用 `REPEATABLE READ` 隔离级
- 409 reload 时拿到的 snapshot 一定是一致版本（不会反复 409）
- 409 reload 通过 SWR `mutate(key)` 触发，不再单独 `loadWorkspaceSnapshot`

**改动范围：**
- `src/lib/workspace-store.ts::withTransaction`：写事务（`mutateWorkspaceSnapshot` / `replaceWorkspaceSnapshot`）第一个 `BEGIN` 后加 `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`
- 客户端 `applyWorkspaceMutation` 错误处理中：409 → 触发 SWR `mutate("workspace-snapshot")` 而非手动 `loadWorkspaceSnapshot`

**验证：**
- `npm test` 全绿
- 模拟并发写：两个客户端同时改 → 一个成功一个收到 409 → 409 客户端拿到的版本号正好是写后的版本

---

### P2 — 写路径重构（API 契约更精细）

#### P2-1. 写路径改 diff（取消 wipe + reinsert）

**目标结果：**
- 客户端只发"变更"（`{upsert, delete} × {players, scenarios, games, ...}`）
- 服务端只动受影响的行，不再 wipe 全表
- 单次"改一个球员号码"延迟 < 100ms

**改动范围：**
- 新增 `src/lib/workspace-diff.ts`：纯函数 `diffWorkspace(prev, next): WorkspaceDiff`
- `src/lib/workspace-store.ts::mutateWorkspaceSnapshot` 改用 diff：
  - `INSERT ... ON CONFLICT (workspace_id, id) DO UPDATE` 做 upsert
  - `DELETE ... WHERE id = ANY($1::text[])` 做 delete
- 客户端 `submitMutationWithRetry` 改为发 diff 而非全量 workspace
- 兼容：保留全量发送的能力作为 fallback（API dual-mode，feature flag 控制）

**验证：**
- 现有 240 个测试全绿
- 新增 diff 单测覆盖：增 / 删 / 改 / 不动 / 嵌套改 / 数组改
- 端到端：编辑单球员 < 100ms；编辑单 stat line < 100ms

**风险：**
- 数据一致性最关键的环节 → 改完必须人工验证 demo 数据集完全可恢复
- 建议：先在分支上开发，feature flag 控制使用 diff 还是全量

---

#### P2-2. 真 REST 资源 API（窄写面）

**目标结果：**
- `PATCH /api/players/{id}` 只 UPDATE 一行，返回新 version + 该 player
- `PUT /api/scenarios/{id}/assignments` 只更新该 scenario 的 assignments
- API 契约跟实现一致（不再是"假装 PATCH 实际 PUT 全量"）
- 减少 409 发生率（窄写面 → 锁粒度更细）

**改动范围：**
- `src/app/api/players/[playerId]/route.ts::PATCH`：改为单行 UPDATE
- `src/app/api/scenarios/[scenarioId]/assignments/route.ts::PUT`：改为单 scenario UPDATE
- 其他 resource route 类比
- 保留全量 workspace API 作为 backup（`/api/workspace` PUT 仍可工作）

**验证：**
- `npm test` 全绿
- 端到端：编辑一个球员 → 数据库实际只动 1 行（用 Supabase 日志或 pgaudit 验证）

---

### P3 — 架构升级（可选，独立决策）

#### P3-1. 迁移到 Neon + `@neondatabase/serverless` HTTP driver

**目标结果：**
- Vercel function 冷启省 200–400ms（HTTP 协议 + 池化）
- 不再有 Supabase transaction-mode Pooler 的 `max: 1` 限制
- 标准 PostgreSQL 兼容，迁移零代码改动（除 db.ts）

**改动范围：**
- `src/lib/db.ts`：用 `@neondatabase/serverless` 替换 `pg.Pool`
- CI / Vercel env 注入新 `DATABASE_URL`
- 三个 SQL 迁移文件继续在 Neon 上跑（标准 PG 完全兼容）

**验证：**
- `npm test` 全绿
- Vercel 部署后冷启延迟下降（Vercel Analytics 验证）
- 数据完整性：现有 demo 数据完整迁移

**前置条件：**
- 必须先完成 P0-3 确认当前 `DATABASE_URL` 模式，否则无法判断能否直接切换

---

#### P3-2. 冷热数据分离

**目标结果：**
- 慢变数据（球员档案、历史比赛）走长缓存（`revalidate: 300`）
- 热数据（活动方案、待保存的草稿）走 SWR 短 TTL
- 大数据量下（500 球员 / 500 比赛）初次加载 < 200ms

**改动范围：**
- 拆 `getOrCreateWorkspaceSnapshot` 为 `getStaticWorkspacePart`（球员 / 历史比赛）和 `getActiveScenarioPart`（活动方案）
- 客户端按需订阅

**验证：**
- 大数据集下首屏 < 200ms
- 写操作不影响慢变数据缓存

---

## 风险与回滚

| 风险 | 触发条件 | 缓解 / 回滚 |
|---|---|---|
| SWR 引入新依赖 | 任意 SWR 行为异常 | pin 版本；可平滑回退到 `useState + useEffect` |
| `cache()` 在并发下泄漏快照 | 写后立刻读 | 写操作后用 `revalidateTag` 强制失效 |
| 放宽 `max` 导致 prepared-statement 错 | Supabase dashboard 报错 | `DB_POOL_MAX=1` env 立即回退 |
| `unnest` 类型不匹配 | 数组为空 / 字段类型错误 | 强类型 + 单元测试覆盖空数组 / 单行 / 多行 |
| diff 写路径数据不一致 | 嵌套对象 / 数组部分更新 | 保留全量路径作为 fallback；feature flag 控制 |
| Neon 迁移数据丢失 | 切换 DATABASE_URL 瞬间 | 迁移前 `pg_dump` 全量备份；保留旧 env 24h |

## 不在范围

- 不改数据库 schema（除非 diff 写路径需要新列）
- 不改 UI 设计
- 不改认证 / 权限模型
- 不引入 Redis / 外部缓存（除非 P3 阶段有强需求）
- 不动 `globals.css` / CSS module（除非性能相关）

## 验证流程（每项完成后必做）

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. 浏览器 Network 面板：观察 `/api/workspace` 请求次数与延迟
5. 实际操作场景：编辑球员、拖守位、切 tab
6. （如适用）Supabase / Neon dashboard 错误日志

## 完成判据（整体）

- 所有 P0 项上线并稳定 1 周
- 所有 P1 项上线
- 性能基线（在 demo 数据集上）：
  - 初次打开 `/panel` P95 < 400ms
  - 切 tab P95 < 100ms（SWR 缓存命中）
  - 写操作 P95 < 500ms（小工作区）
  - 写操作 P95 < 1s（中工作区 ~20 球员 / 50 比赛）
- `npm run lint` + `npm test` + `npm run build` 全绿
- Supabase / Neon dashboard 无新错误日志

## 完成后

- 把本文件移到 `docs/exec-plans/completed/`
- 更新 `docs/exec-plans/tech-debt-tracker.md`，标记对应 TD 为已解决
- 在 `docs/RELIABILITY.md` 补充性能基线数字
- 在 `docs/ARCHITECTURE.md` 更新数据流图
