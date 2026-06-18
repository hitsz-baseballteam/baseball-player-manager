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

-- 计算 next workspace / next version
-- upsert app_workspace_meta，然后清空并集合式重写归一化子表
COMMIT;

-- commit 成功后失效 workspace server-cache tag
```

- 每次写入必须携带当前 `version`
- 版本冲突（锁不到对应版本行）→ API 返回 409
- 需要自动重放的页面路径会通过 `submitMutationWithRetry()` 重新加载最新数据并最多自动重试 3 次
- 其他页面冲突时会刷新到最新 workspace，但不会自动重放本次编辑

### 写操作保证

- **原子性**：每个资源写接口都在显式 SQL 事务中完成，包含版本校验、子表写入、版本递增
- **隔离性**：通过 `FOR UPDATE` 锁住 `app_workspace_meta` 当前版本行，避免并发写穿透
- **无分布式事务**：仍是单数据库事务，不需要两阶段提交
- **固定写入往返上限**：子表通过 `jsonb_to_recordset()` 集合式写入，往返次数不再随记录数线性增长
- **提交后失效**：只有成功提交的写入才失效 full/bootstrap/games/milestones 的共享缓存 tag；冲突和失败不会清除缓存

### 读取一致性与缓存

- full、bootstrap、games、milestones reader 各自在一个 `REPEATABLE READ READ ONLY` 事务内读取
- 单次读取只使用一个 checked-out `PoolClient`，不会跨连接拼装关联表
- React `cache()` 负责同一次 Server Component 请求内去重
- `unstable_cache()` 负责跨请求复用，四类 reader 共享同一个 workspace 失效 tag
- 浏览器/API 响应仍为 `private, no-store`；服务端缓存不依赖浏览器缓存

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
