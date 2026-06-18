# 设计决策文档

设计决策记录（ADR）用于归档重要的架构和产品决策。每条记录包含：决策内容、理由、考虑过的备选方案、验证状态。

## 格式

```markdown
# ADR-NNN: 简短标题

状态：[提议 | 已采纳 | 已废弃 | 已替代]

## 背景
[需要做出什么决定，为什么现在做]

## 决策
[我们决定做什么]

## 理由
[为什么选择这个方案]

## 备选方案
- 方案 A：[描述 + 为什么没选]
- 方案 B：[描述 + 为什么没选]

## 后果
[这个决策带来的影响，正面和负面]

## 验证
[如何验证这个决策是正确的 / 需要跟进什么]
```

## 当前有效决策

| ID | 标题 | 状态 | 日期 |
|---|---|---|---|
| ADR-002 | [选择 pg (node-postgres) 而非 Supabase JS SDK](./adr-002-pg-over-supabase-sdk.md) | 已采纳 | 2026-06-02 |
| ADR-003 | [选择 HMAC cookie 认证而非 JWT / Supabase Auth](./adr-003-hmac-cookie-auth.md) | 已采纳 | 2026-06-02 |
| ADR-004 | [选择乐观并发而非悲观锁](./adr-004-optimistic-concurrency.md) | 已采纳 | 2026-06-02 |
| ADR-006 | [退役首页 legacy workspace，首页收敛为纯 React 总控台](./adr-006-retire-legacy-homepage-workspace.md) | 已采纳 | 2026-06-05 |
| ADR-007 | [归一化 workspace 存储（替代 ADR-005）](./adr-007-normalized-workspace-storage.md) | 已采纳 | 2026-06-16 |

## 已归档决策

这些 ADR 保留历史解释价值，但不再作为后续开发的默认指导：

| ID | 标题 | 原因 |
|---|---|---|
| ADR-001 | [DOM 管理器逐步迁移与 CI 引入](./archive/adr-001-dom-migration-and-ci.md) | 主要记录已完成的迁移波次和 CI 引入过程 |
| ADR-005 | [选择单表 app_workspace jsonb 存储而非关系表](./archive/adr-005-single-table-jsonb.md) | 已被归一化 `app_*` 表存储替代 |

## 待记录决策

暂无。所有已知架构决策已记录。
