# 性能优化 — 前后端调用链路延迟与卡顿

## 背景

面板（`/panel/*`）操作存在明显延迟和卡顿，教练日常使用体感较差。根因不在 UI 层，而在数据访问层和缓存策略：

- **客户端无 SWR / React Query**：每次 mutation 后手动 `loadWorkspaceSnapshot` 整库重读
- **Server Component 无 React `cache()`**：每次页面导航都重新读库
- **HTTP 层无缓存头**：浏览器不会复用响应
- **写路径是 wipe + reinsert**：工作区越大写越慢
- **连接池 `max: 1`**：在 Supabase Pooler transaction-mode 下保守；9 个 `SELECT` 串行实际是因 `withTransaction` 共享同一 `PoolClient`，与 `max` 无关

## 现状（代码事实）

### 读路径

- `src/lib/panel-server.ts::getPanelWorkspaceSnapshot` → `src/lib/workspace-store.ts::getOrCreateWorkspaceSnapshot` → 1 个事务 + 9 个 `SELECT`（代码上是 `Promise.all`，但**所有查询复用 `withTransaction` 给的同一个 `PoolClient`**；node-postgres 在同一 client 上对查询排队执行，**与 `db.ts:91` 的 pool `max` 无关**）
- 每次 Server Component 渲染都重新查 DB，无 `import { cache } from "react"`
- `src/app/api/workspace/route.ts` 的 `GET` 响应无 `Cache-Control` / `ETag` / `Last-Modified`
- 客户端使用 `useState` 持有 workspace，跨页面导航不共享

### 写路径

- `src/lib/workspace-store.ts::mutateWorkspaceSnapshot` 单事务内：
  1. `ensureNormalizedWorkspaceRecord`（9 个 `SELECT`）
  2. `SELECT ... FOR UPDATE`（锁 meta）
  3. `wipeNormalizedWorkspace`（4 个 `DELETE`）
  4. `writeNormalizedWorkspace`（N 个 `INSERT`，N ≈ 球员 × 1 + 球员 × positions + 方案 × 19 + 比赛 × (1 + 局数 + stat lines) + milestones）
- 20 球员 + 5 方案 + 50 比赛工作区：约 1,000–1,500 个 `INSERT`（按 ~9 innings / ~9 stat lines per game 估算），每次约 3–5s

### 连接池

- `src/lib/db.ts:91` `max: supabaseConnection ? 1 : 5`（三元同表，Supabase 路径 vs 其他）
- 注释说明：`max: 1` 是为绕开 Supabase PgBouncer transaction-mode 的 prepared statement 冲突
- **澄清：`max` 控制 pool 大小，与 `selectNormalizedWorkspaceRecord` 内 9 SELECT 串行无关**（后者因共享同一 `PoolClient` 而排队）。`max: 1` 只影响跨请求的并发，不影响单次请求的查询串行

### 缓存

- Server Component 无 React `cache()`
- 客户端无 SWR / React Query
- 无 Next.js `unstable_cache` / `revalidateTag`
- 无 HTTP `Cache-Control` / `ETag`

## 目标结果

| 指标 | 现状（估） | 目标结果 |
|---|---|---|
| 切 tab / 重进页面 | 数百 ms 重新打 DB | **0 次 `/api/workspace` 请求**（SWR 命中） |
| 初次打开 `/panel` | 0.5–1.2s | **P95 < 400ms** |
| 写操作（小工作区） | 2–5s | **P95 < 500ms** |
| 写操作（中工作区 ~20 球员 / 50 比赛） | 3–6s | **P95 < 1s** |
| 9 个 `SELECT` 串行总耗时 | 50–270ms | **不在 P0+P1 优化范围**（单 client 串行是设计选择；需架构变更才能并行，见下方"明确放弃的目标"） |
| 409 冲突触发的客户端 reload | 200–800ms | **0ms**（同事务 snapshot + SWR `mutate`） |
| 浏览器 10 秒内重复读 | 每次 1 个 RTT | **0 个 RTT**（HTTP 缓存） |

### 不在 P0 + P1 优化范围的目标

| 目标 | 不优化的原因 |
|---|---|
| 9 个 SELECT 串行耗时降到 < 50ms | 单 `PoolClient` 上 node-postgres 强制查询排队（与 `max` 无关）。要真并行需架构改动（多 client 共享 MVCC snapshot、或单 SQL JOIN）—— 不在 P0 + P1 范围。**50–270ms 现状可接受**：仍满足"初次打开 /panel P95 < 400ms"的总目标（其它开销 30–50ms，总计 80–320ms） |

---

## 实施步骤（按优先级）

### P0 — 关键路径优化（每项独立可发布，零行为变更）

#### P0-1. 客户端加 SWR 缓存

**修改原因：** 客户端无 SWR / 缓存，切 tab / 重复进页面都重新打 DB；当前 `useState` 持有 workspace 跨页面不共享

**变动范围：** 见下方"目标结果 / 改动范围"

**产生的影响：** 切 tab / 重进页面用户感知延迟从"数百 ms 重新打 DB"降到"瞬间"

**副作用：** SWR 是新依赖；`fallbackData` 必须保留否则首屏等待；SWR 行为异常时回退到 `useState + useEffect`

**目标结果：**
- 切 tab / 浏览器返回 / 5 秒内重复进入同一页面 → **0 次** `/api/workspace` 请求
- 同一页面多个组件同时挂载时 → **1 次**请求（dedupe）
- 现有 `useState(sanitizeWorkspace(initialWorkspace))` 全部替换为 `useWorkspaceSnapshot(initial)`

**改动范围：**
- 新增 `src/lib/use-workspace-snapshot.ts`（`useSWR` 包装，`fallbackData` 用 `initialSnapshot`）
- 修改 `src/components/player-manager-client.tsx`、`roster-page-client.tsx`、`scenarios-page-client.tsx`、`stats-page-client.tsx`、`hall-of-fame-page-client.tsx`（**注意**：HallOfFame 用 `useMemo` 而非 `useState`、无 mutation callback；接入 SWR 应是只读模式（其他 tab 写入时 live-update）而非全 mutation 客户端）
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

**修改原因：** Server Component 无 `import { cache } from "react"`、API 无 `Cache-Control` 头，单次页面渲染中多个 Server Component 调用都打 DB；浏览器 10s 内重复读不命中本地缓存

**产生的影响：** 单次 RSC 渲染中 9 个 SELECT 合并为 1 次；浏览器 10s 内重复读命中 `from disk cache`

**副作用：** Next.js React `cache()` 跨请求失效（不替代 P1-2 的服务端短缓存）

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

#### P0-3. 调查并按连接模式动态决定 `max`

**修改原因：** `db.ts:91` 的 `max: supabaseConnection ? 1 : 5` 是**保守**的：仅在 Supabase transaction-mode Pooler（端口 6543）下为绕开 prepared-statement 限制才需要 `max: 1`；其他路径（Supabase 直连 5432、session-mode Pooler、非 Supabase Postgres）放宽不会触发该错误。本步骤聚焦"是否对其他路径过度保守"。**澄清：本步骤不会让 9 个 SELECT 真并行**（它们因共享同一 `PoolClient` 而排队，与 `max` 无关；详见"明确放弃的目标"）

**产生的影响：**
- 间接：放宽 `max` 不影响 `selectNormalizedWorkspaceRecord` 的 9 SELECT 串行
- 正面：放宽后并发写、并发读请求（不同 tab 同时打开）不互相阻塞；写路径的连接获取更宽容

**副作用：** Supabase transaction-mode Pooler 放宽后可能触发 prepared-statement "already exists" 错误

**目标结果：**
- 审计后 `DB_POOL_MAX` env 文档化（`.env.example` 增加）
- 代码根据连接模式自动选择 `max`：Supabase transaction-mode Pooler 默认 `max: 1`，其他默认 `max: 5–10`
- 显式记录在什么条件下"9 SELECT 真并行"才有可能（架构改动 → 不在 P0+P1 范围）

**前置调查：**
- 读取当前 `DATABASE_URL` 解析 hostname / port / query params
- 判断是 Supabase 直连还是 Pooler、Pooler 模式（transaction vs session）
- 监控 Supabase dashboard "Connection" 指标，确认放宽后无 prepared-statement 错误

**改动范围：**
- `src/lib/db.ts`：根据 hostname + port 动态决定 `max`，新增 `DB_POOL_MAX` env 作为手动覆盖
- `.env.example`：增加 `DB_POOL_MAX` 注释
- 注释解释每种模式的取舍

**验证：**
- `npm test` 全绿
- Supabase dashboard 无新 prepared-statement 错误日志
- 切换到 session-mode Pooler（如果适用）后能正常 `max: 5`
- 实际读 P95 延迟**不下降也是预期结果**（9 SELECT 仍串行）

**兜底：**
- 放宽后出现 prepared-statement 错误 → 通过 `DB_POOL_MAX=1` env 立即回退
- 准备 feature flag 控制是否启用放宽

---

### P1 — 写路径性能提升（行为不变，只优化 IO）

#### P1-1. 批量 INSERT（`unnest`）

**修改原因：** `src/lib/workspace-store.ts::writeNormalizedWorkspace` 用 9 个 for-loop 逐行 `INSERT`，每个 RTT 插 1 行；工作区规模线性放大写延迟

**产生的影响：** 写延迟从 2–5s 降到 600ms–1s（小工作区）；RTT 数量从 ~2000 降到 ~9

**副作用：** `unnest` 类型不匹配需要测试覆盖空数组 / 单行 / 多行 / 字段类型错误

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

**修改原因：** Server Component `cache()` 跨请求失效；5–10s 窗口内多次 `loadWorkspaceSnapshot()` 仍每次都打 DB

**产生的影响：** 5–10s 窗口内多次读共享服务端缓存值；mutation 仍即时反映到下次读

**副作用：** 写后必须 `revalidateTag("workspace")` 强制失效，否则 mutation 后 5s 内读到旧数据

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

**修改原因：** 当前 default isolation（READ COMMITTED）下，409 reload 拿到的 snapshot 不一定是写后的最新一致版本，理论上可能"反复 409"

**产生的影响：** 409 reload 拿到的版本号确定收敛到写后版本；客户端 SWR `mutate(key)` 不再单独调 `loadWorkspaceSnapshot`

**副作用：** 写事务持有 snapshot 稍长，理论上锁竞争增加（实际低并发场景无感）

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

### P2 — 高级重构（可选，独立决策）

> P0 + P1 已经能达成"目标结果"表里所有 P95 数字。P2 是为了"再快一档"和"代码契约更干净"，**不是必做**。
> 每项独立可评估、独立可回滚，灰度上线。

#### P2-1. 写路径改成 diff（取消 wipe + reinsert）

**修改原因：**
- 当前 `mutateWorkspaceSnapshot` 是 wipe + reinsert：编辑一个球员号码会让 N 个 `INSERT` 在事务中执行，N 随工作区规模线性增长
- 9 个 `SELECT` 读全表 + 4 个 `DELETE` 清空 + ~2000 个 `INSERT` 重建，是反范式的实现
- 违反"操作只应触达被改数据"的最小写入原则

**变动范围：**
- 新增 `src/lib/workspace-diff.ts`：纯函数 `diffWorkspace(prev, next): WorkspaceDiff`，返回 `{upsertPlayers, deletePlayers, upsertScenarios, ...}`
- `src/lib/workspace-store.ts::mutateWorkspaceSnapshot` 改用 diff：
  - `INSERT ... ON CONFLICT (workspace_id, id) DO UPDATE` 做 upsert
  - `DELETE FROM app_player WHERE workspace_id = $1 AND id = ANY($2::text[])` 做 delete
- 客户端 `workspace-client.ts` 改为发 diff + version 而非全量
- API 路由接受新 payload shape，保留旧 shape 作为 fallback（dual-mode + feature flag）
- 新增 `src/lib/workspace-diff.test.ts`：覆盖增 / 删 / 改 / 不动 / 嵌套数组变化

**产生的影响：**
- 性能：写延迟 2–5s → 50–200ms（看实际变更量；典型"改一个球员号码"应 < 100ms）
- 写 RTT 数量：~2000 → ~10（每个被改的表 1 个 RTT）
- 网络负载：客户端只发变更，payload 从"全量 workspace"降到"diff payload"
- 锁粒度：不变（仍是 meta 行锁）

**副作用：**
- 风险：数据一致性。diff 算错会丢数据或留垃圾。必须保留全量路径作为 fallback，至少 1 个版本的灰度
- 兼容性：dual-mode 期间 API 接收两种 payload shape，需要清晰识别
- 测试：现有 240 passing tests 不直接覆盖 diff；需要新增 diff 单测覆盖所有边界
- 复杂度：增加一个模块（`workspace-diff`），需要在 client / API / server 三处联动
- 版本号语义：当前是整个 workspace 的 OCC token；diff 模式仍可保持这个语义（meta.version 单调递增）
- 排序：`sort_order` 变化需要 diff 识别并处理

---

#### P2-2. 写入改 partial resource API（窄写面）

**修改原因：**
- 当前 `/api/players/{id}` PATCH 接口接收 `{ version, player }`（**单球员对象**），但底层实现走 `mutateWorkspaceSnapshot` → `writeNormalizedWorkspace` 仍是全 workspace 替换——名不副实
- 真实意图是"更新这一个 player"，但实现是 wipe + reinsert 整个工作区
- API 契约与实现不一致，不利于客户端理解和维护
- 全 workspace 锁放大了 409 冲突概率

**变动范围：**
- `src/app/api/players/[playerId]/route.ts::PATCH`：改为单行 `UPDATE` + 返回新 version
- `src/app/api/scenarios/[scenarioId]/route.ts::PATCH`：同理
- `src/app/api/scenarios/[scenarioId]/assignments/route.ts::PUT`：同理
- 其他 resource route 类比
- 保留 `/api/workspace` 全量端点作为 backup
- 客户端 mutation 函数相应改为发"单 resource + version" payload

**产生的影响：**
- 性能：每次写只动 1 行（DB 实际行数），写延迟降到 < 100ms
- 409 冲突率：显著下降（写面变窄）
- API 契约：清晰，客户端更容易理解
- 版本号：仍按 workspace 级别递增，客户端维持 OCC 协议

**副作用：**
- 风险：写路径分裂（resource-level PATCH vs workspace PUT），两条路径都要测
- 客户端：所有 mutation 都要改，需要回归测试
- 兼容：保留旧端点做 dual-mode 一段时间
- 与 P2-1 的关系：P2-1（diff writes）已能达到"窄写"的效果，P2-2 是更彻底的 API 重构
- 收益递减：如果 P2-1 已上线，P2-2 价值变小

---

### 明确拒绝的方案

> 以下方案在被评估后**明确不采用**。保留记录是为了让未来的 agent / 协作者知道这些是已评估、刻意跳过的方向，避免重复讨论。

#### ❌ SELECT `json_build_object` 一次取回

**不采用原因：**
- 与刚完成的 `docs/exec-plans/completed/20260616-normalize-workspace-storage-cutover.md` 工作方向相反（从 JSONB 单行迁到归一化表）
- 9 个 `SELECT` 当前是"假串行"（`max: 1` 导致），**P0-3 修复后真并行**，延迟不是瓶颈
- 即便用 VIEW 把 9 个查询合并成 1 个，也等同于把聚合层下沉到 SQL，未来要拆分更难
- 单租户场景下"9 个并行查询 + `buildWorkspaceFromRows` 在 JS 里聚合"的成本 < 50ms

#### ❌ 冷热 cache 分离

**不采用原因：**
- 当前工作区数据规模小（典型 20 球员 / 50 比赛，全量 JSON < 100KB）
- 冷热分离的收益要工作区 > 1MB 才明显，目前远未达到
- 增加 API 复杂度（两个端点 / 区分 hot vs cold），与 P1-2 的 `unstable_cache` 短窗口缓存重叠
- 真正的"冷数据"（历史比赛）目前不常访问，不需要独立 cache 路径

---

## 风险与回滚

| 风险 | 触发条件 | 缓解 / 回滚 |
|---|---|---|
| SWR 引入新依赖 | 任意 SWR 行为异常 | pin 版本；可平滑回退到 `useState + useEffect` |
| `cache()` 在并发下泄漏快照 | 写后立刻读 | 写操作后用 `revalidateTag` 强制失效 |
| 放宽 `max` 导致 prepared-statement 错 | Supabase dashboard 报错 | `DB_POOL_MAX=1` env 立即回退 |
| `unnest` 类型不匹配 | 数组为空 / 字段类型错误 | 强类型 + 单元测试覆盖空数组 / 单行 / 多行 |
| P2-1 diff 算错导致数据丢失 | 客户端发 diff 与服务端 schema 不一致 | feature flag 关闭 diff 路径，回退全量；至少 1 版本灰度 |
| P2-2 resource API 与客户端不同步 | 客户端发旧 payload 走新端点 | 保留 `/api/workspace` 全量端点作为 fallback 一段时间 |

## 不在范围

- 不改数据库 schema
- 不改 UI 设计
- 不改认证 / 权限模型
- 不引入 Redis / 外部缓存
- 不动 `globals.css` / CSS module
- 不换数据库供应商
- 不改 API 端点契约（resource 级别的 PATCH/PUT 拆分留作未来工作）

## 验证流程（每项完成后必做）

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. 浏览器 Network 面板：观察 `/api/workspace` 请求次数与延迟
5. 实际操作场景：编辑球员、拖守位、切 tab
6. Supabase dashboard 错误日志

## 完成判据（整体）

### 必做（P0 + P1）

- 所有 P0 项上线
- 所有 P1 项上线
- 性能基线（在 `scripts/seed-demo-data.ts` 生成的 demo 数据集上）：
  - 初次打开 `/panel` P95 < 400ms
  - 切 tab P95 < 100ms（SWR 缓存命中）
  - 写操作 P95 < 500ms（小工作区）
  - 写操作 P95 < 1s（中工作区 ~20 球员 / 50 比赛）
- `npm run lint` + `npm test` + `npm run build` 全绿
- Supabase dashboard 无新错误日志

### 可选（P2）

- P2-1 / P2-2 上线后写延迟进一步下降，无回归
- P2 验收不阻塞 P0 + P1 标"完成"

## 完成后

- 把本文件移到 `docs/exec-plans/completed/`
- 更新 `docs/exec-plans/tech-debt-tracker.md`，标记对应 TD 为已解决
- 在 `docs/RELIABILITY.md` 补充性能基线数字
- 在 `docs/ARCHITECTURE.md` 更新数据流图
