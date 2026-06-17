# 可靠性要求

## 数据完整性

### 乐观并发控制

`src/lib/workspace-store.ts` 现在基于归一化表和工作区版本号实现乐观并发：

```
BEGIN;
SELECT id
FROM app_workspace_meta
WHERE slug = $slug AND version = $currentVersion
FOR UPDATE;

-- 写入 players / scenarios / games / milestones 等归一化表
UPDATE app_workspace_meta
SET version = version + 1, updated_at = now()
WHERE id = $workspaceId;
COMMIT;
```

- 每次写入必须携带当前 `version`
- 版本冲突（锁不到对应版本行）→ API 返回 409
- 需要自动重放的页面路径会通过 `submitMutationWithRetry()` 重新加载最新数据并最多自动重试 3 次
- 其他页面冲突时会刷新到最新 workspace，但不会自动重放本次编辑

### 写操作保证

- **原子性**：每个资源写接口都在显式 SQL 事务中完成，包含版本校验、子表写入、版本递增
- **隔离性**：通过 `FOR UPDATE` 锁住 `app_workspace_meta` 当前版本行，避免并发写穿透
- **无分布式事务**：仍是单数据库事务，不需要两阶段提交

## 连接池策略

`src/lib/db.ts`：

| 参数 | 值 | 原因 |
| `max` | Supabase 主机为 1，其他主机为 5 | Supabase PgBouncer（事务模式）下 prepared statement 会冲突，单连接序列化可避免；本地或其他 PostgreSQL 主机保持 5 |
| `idleTimeoutMillis` | 30000 | 30 秒空闲即释放，避免占用连接 |
| `connectionTimeoutMillis` | 10000 | 10 秒连接超时，避免连接建立阶段长时间卡住 |

## 错误处理模式

### API 层

所有 API route 返回结构化 JSON 错误：

```json
{ "error": "描述性错误信息" }
```

HTTP 状态码（当前代码显式返回的部分）：
- 200：成功
- 204：解锁成功 / 登出成功
- 400：请求格式错误
- 401：未认证或口令错误
- 409：版本冲突
- 429：解锁速率限制
- 500：未捕获的服务端异常由框架层处理

### 客户端错误

- 网络错误：`fetch` 异常会直接向上传播；非 2xx 响应会在 `workspace-client.ts` 中被包装为描述性错误
- 版本冲突：`VersionConflictError` 在不同 UI 路径中分别由自动重试或刷新最新数据处理
- 维护窗口：`MAINTENANCE_READ_ONLY=1` 时所有写接口返回 503，但 `GET /api/workspace` 仍可读

### 数据边界

- **API 输入 / 输出**：workspace 聚合和资源负载都会在进入存储层前经 sanitizer 校验
- **DB 读取**：归一化表组装出的聚合快照仍会经过 `sanitizeWorkspace()`
- **JSON 导入**：`prepareImport()` 失败时当前 UI 会拒绝导入并显示通用失败提示，不会静默接受非法数据

## 可用性目标（建议）

由于这是一个单人管理工具（非多租户 SaaS），可用性要求相对宽松：

| 指标 | 目标 | 说明 |
|---|---|---|
| 可用性 | 99%（非关键） | 单人使用，短暂不可用可接受 |
| 数据持久性 | 100% | 依赖 Supabase PostgreSQL 持久化保证 |
| 恢复时间 | < 1 小时 | 通过 JSON 导入/导出恢复 |
| 部署回滚 | < 5 分钟 | Next.js 单体应用，回滚即重新部署旧版本 |

## 备份与恢复

- **导出**：前端提供 JSON 导出功能（workspace 完整导出 / 单 scenario 导出）
- **导入**：支持 workspace 和 scenario 两种导入模式，见 `references/import-json-format-llms.txt`
- **DB 备份**：仓库中未记录数据库备份策略；如依赖托管服务备份，需要另外在运维文档中明确

## 已知风险

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 连接池耗尽（非 Supabase 主机 > 5 并发写；Supabase 主机 > 1 并发连接） | 请求排队 / 超时 | 单人使用场景下概率极低；Supabase 连接数限制更保守 |
| 乐观冲突循环 | 用户操作被反复拒绝 | 自动重试路径先重放 3 次；仍失败时刷新最新数据并提示用户 |
| 归一化表与 legacy JSON 双存期间出现偏差 | 回滚/排障复杂度上升 | cutover 后只读 legacy 表并保留回滚窗口；稳定后再考虑移除 |
| passcode 泄露 | 数据可被任意访问 | passcode 只在环境变量中，不写死代码 |

## 性能基线（2026-06-17，TD-10 关闭时）

测试环境：本地 dev server（Turbopack）+ 本地 PostgreSQL 16 + 小型演示数据集（12 球员 / 3 方案 / 0 比赛）。中等规模（~20 球员 / 50 比赛）下数字会更高；下面所有值只覆盖该测试集。

| 指标 | 测量值 | 数据来源 | 备注 |
|---|---|---|---|
| 首次 `GET /api/workspace`（冷） | ~280ms | dev log: `next.js: 241ms, app: 34ms` | 9 个 SELECT 串行在同一 `PoolClient` 上排队；首次含 Turbopack 编译 |
| 重复 `GET /api/workspace`（5s 内） | 5–7ms | dev log: `next.js: <1ms, app: 1–2ms` | 命中 `unstable_cache` 10s 短窗口 |
| 客户端切 tab（5 个 panel 页面） | 0 RTT | 浏览器实测：0 `/api/workspace` 请求 | 客户端 `useWorkspaceSnapshot` + SSR 注入初始数据 |
| 服务端页面渲染冷（`/panel` 首次） | 200–290ms | dev log | 含 React `cache()` 同请求去重 + DB 查询 |
| 服务端页面渲染热（10s 内重访） | 21–32ms | dev log: `next.js: <2ms, app: 19–32ms` | 命中 `unstable_cache` |
| 单球员 `PATCH /api/players/:id` 写 | 20–25ms（热） | dev log: `app: 19–22ms` | 12 球员工作区下的小数据集结果；当时生产写路径仍是逐行 INSERT，不能外推出中等规模表现 |
| 首次写（Turbopack 冷编译） | 628ms | dev log: `next.js: 606ms` | 框架编译成本，不是应用代码 |
| 409 版本冲突 | 5–13ms | dev log: `app: 5ms` | 单纯版本检查 + `FOR UPDATE` |
| `Cache-Control` 头（`/api/workspace`） | `private, no-store, max-age=0` | `curl -I` | 浏览器与 CDN 不缓存私有 workspace 响应；性能依赖服务端 `unstable_cache` |

### 已知不在范围内的优化

- 9 个 SELECT 串行化（~50–270ms）需要架构改动（多 client 共享 MVCC snapshot 或单 SQL JOIN）才能并行；当前 `max: 1/5` 池大小与之无关（串行因共享 `PoolClient` 而排队）
- 中等规模（~20 球员 / 50 比赛）工作区写延迟：当前测试集无法验证，且批量 `unnest` 写入尚未接入 `writeNormalizedWorkspace()` 主路径
- 浏览器 HTTP 缓存不在当前策略内：`/api/workspace` 明确 `no-store`，以上热读收益来自服务端 `unstable_cache`

### 验证方法

```bash
# 读冷热
curl -sI -H "Cookie: baseball_manager_unlock=$COOKIE" http://127.0.0.1:3210/api/workspace

# 写延迟（小型数据集）
time curl -X PATCH -H "Cookie: baseball_manager_unlock=$COOKIE" \
  -H "content-type: application/json" \
  -d '{"player":...,"version":N}' http://127.0.0.1:3210/api/players/p-01
```

更详细的背景见 `docs/exec-plans/active/20260616-latency-optimization.md`。
