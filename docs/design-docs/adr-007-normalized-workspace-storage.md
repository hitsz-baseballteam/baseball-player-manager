# ADR-007: 归一化 workspace 存储（替代 ADR-005 的 jsonb 单行方案）

状态：已采纳

替代说明：本决策替代 [ADR-005](./adr-005-single-table-jsonb.md) 的单表 `app_workspace(data jsonb)` 方案。完整实施细节见 [exec-plans/completed/20260616-normalize-workspace-storage-cutover.md](../exec-plans/completed/20260616-normalize-workspace-storage-cutover.md)；本文只记录为什么做出这一方向调整。

## 背景

ADR-005 早期选择 `app_workspace(slug, version, data jsonb)` 单行大对象存储整个 workspace，理由是"整读整写、无 JOIN 需求、schema 灵活、导入导出即字段内容"。该方案在项目早期规模下确实成立。

到 2026-06 中期，主线模型已经定型：

- `milestones`、`joinedAt`、`graduated` 与扩展 stat line 都是 `Workspace` 的常驻字段，不再是"未来字段"
- 字段粒度开始触及 Supabase 表编辑器的可读性上限
- 资源级写接口（`POST /api/players`、`PATCH /api/scenarios/[id]` 等）的需求出现——只要还在单行 jsonb 上做整写，资源级写就只能靠"读 → 改 → 整写"绕路，无法真正落库
- 单行大对象的 optimistic concurrency 在并发写场景下把所有编辑都串到同一行，对未来的多写者扩展不友好

## 决策

将 workspace 拆分为归一化 `app_*` 表族：

- `app_workspace_meta` — 锁目标，持有 slug / version / active_scenario_id / preferences / 时间戳
- `app_player` + `app_player_position` — 球员主体与多对多位置
- `app_scenario` + `app_scenario_defense_assignment` + `app_scenario_lineup_slot` — 方案、守备与棒次
- `app_game` + `app_game_inning` + `app_game_stat_line` — 比赛、逐局、逐人 stat line
- `app_milestone` — 里程碑
- legacy `app_workspace(data jsonb)` — 在回滚窗口内保留为回滚/回填源，不参与运行时写路径

写路径改为：

1. 入口走资源级 API（`/api/players/*`、`/api/scenarios/*`、`/api/games/*`、`/api/milestones/*`）
2. 服务端在 `BEGIN; SELECT ... FOR UPDATE;` 锁住 `app_workspace_meta` 当前版本行
3. 重新归一化整个 workspace 内存对象（仍是整 workspace wipe-and-rewrite），按外键顺序 `jsonb_to_recordset()` 集合式重写子表
4. 递增 `app_workspace_meta.version`，提交后 `revalidateTag('workspace:default')` 失效跨请求缓存
5. 返回 `WorkspaceSnapshot`（与 `GET /api/workspace` 同形）

`GET /api/workspace` 仍是 bootstrap 聚合接口；`PUT /api/workspace` 改为固定 `405 method_not_allowed`，强制所有 UI 走资源级写。

## 理由

- **资源级写可落地**：每个资源写接口在事务内能确定自己的影响面
- **可读性与可分析性**：每个 `app_*` 表在 Supabase 表编辑器里都是普通表，可以直接 `SELECT *`、加索引、做统计
- **OCC 仍可用**：`app_workspace_meta.version` 仍然是整个 workspace 的版本锁，409 语义不变
- **客户端迁移成本可控**：现有 `WorkspaceSnapshot` 协议不变；`workspace-client.ts` 改走资源级 helper（`createPlayer` / `updateScenarioAssignments` 等），调用方只需要改 import 路径
- **回滚窗口明确**：legacy `app_workspace` 在 cutover 期间保留为回填源，确认稳定后再考虑清理

## 备选方案

- **继续 jsonb 单行 + 资源级写**：在单行 jsonb 上做"读 → 改局部 → 整写"。可以保留 ADR-005 的简单性，但所有资源级写都要重新组装整个 workspace 才能落库，并发场景下锁竞争仍然存在；不解决表编辑器可读性问题。
- **多表 + 行级 OCC**：把 `version` 下放到每个 `app_*` 表。理论上减少锁竞争，但当前是单人管理工具，行级 OCC 的复杂度远超收益；保留单 workspace 版本号是当前规模下最务实的方案。
- **完全文档库（NoSQL）**：放弃 PostgreSQL 关系能力。当前 Supabase 已是 PostgreSQL，迁移成本与运维成本不划算。

## 后果

- 写路径依然在事务内做整 workspace wipe-and-rewrite（不是行级增量写），所有子表在每次写时整体重写；这意味着每写一次会更新所有子表的行
- 子表通过 `jsonb_to_recordset()` 集合式写入，往返次数不随记录数线性增长
- 旧版 `migrateV2toV3()` 仍保留作为旧数据兜底，归一化表取代了它在线上路径中的位置
- 资源写 API（`/api/players/*` 等）目前不在 `src/proxy.ts` 的 matcher 内，**记为 TD-10**——这是本决策的副作用之一：资源级 API 出现后，统一请求边界的责任更明确
- 引入 `MAINTENANCE_READ_ONLY=1` 维护窗口开关：在切库、回填等敏感操作期间强制所有写返回 503

## 验证

- `npm test`：302 个测试、300 通过、2 todo（覆盖 OCC 冲突、归一化表的回填、resource API、proxy 鉴权等）
- `npm run lint`：0 errors
- `npm run build`：通过
- 实际接口行为：`POST /api/workspace` → `405`、`POST /api/workspace/bootstrap` → `401`（无 cookie）
- 文档：ARCHITECTURE.md §5、§2、§3 与 SCHEMA.md 同步反映本决策

## 关联文档

- [ADR-005 (已替代)](./adr-005-single-table-jsonb.md)
- [exec-plans/completed/20260616-normalize-workspace-storage-cutover.md](../exec-plans/completed/20260616-normalize-workspace-storage-cutover.md)
- [docs/SCHEMA.md](../SCHEMA.md)
- [docs/API.md](../API.md)
- [docs/RELIABILITY.md](../RELIABILITY.md)
- [docs/exec-plans/tech-debt-tracker.md](../exec-plans/tech-debt-tracker.md)（TD-10）
