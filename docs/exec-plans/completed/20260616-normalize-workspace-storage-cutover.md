# 2026-06-16 Normalize Workspace Storage Cutover

## 背景

- 远程 `origin/main` 已合入 PR #1，`milestones`、`joinedAt`、`graduated` 和扩展 stat line 已是主线模型，不再视为未来字段。
- 现网存储仍是 `public.app_workspace(data jsonb)` 单行大对象，导致表编辑器不可读、资源级写入困难、后续分析和迁移成本高。

## 对齐后的实施范围

1. 引入归一化 `app_*` 表，保留 `app_workspace` 作为回滚窗口内的 legacy 来源。
2. 保持 `GET /api/workspace` 作为 bootstrap/read 聚合接口。
3. 停止常规 UI 对 `PUT /api/workspace` 的依赖，改为资源级写接口。
4. 保留单一 workspace 版本号作为整个工作区的 OCC token。

## 已实施结果

- 新增迁移：`supabase/migrations/20260616195000_normalize_workspace_storage.sql`
- 新增归一化存储与回填脚本：
  - `src/lib/workspace-store.ts`
  - `scripts/backfill-normalized-workspace.ts`
- 新增资源接口：
  - `players`, `scenarios`, `games`, `milestones`, `workspace/import|reset|preferences`
- `PUT /api/workspace` 现在固定返回 `405`
- 新增维护窗口开关：`MAINTENANCE_READ_ONLY=1`
- 客户端改为通过 `workspace-client.ts` 调用资源级写接口
- 修复并发锁、场景复制保真、日期序列化与相关测试/文档

## 验证

- `npm test`
- `npm run lint`
- `npm run build`

三项均已通过。
