# ADR-005: 选择单表 app_workspace jsonb 存储而非关系表

状态：已替代

替代说明：该决策已在 2026-06-16 被归一化 `app_*` 表存储方案替代。本文保留用于解释项目早期为何先采用单表 `jsonb`。

## 背景

Workspace 数据包含球员列表、多套方案、偏好设置。可以用关系表（`players`、`scenarios`、`assignments` 等）规范化存储，也可以用单表 jsonb 字段存储整个 workspace。

## 决策

使用单表 `app_workspace`，核心数据存储在 `data`（jsonb）字段中。表结构：`slug`（TEXT）、`version`（INT）、`data`（JSONB）。

## 理由

- **数据局部性**：workspace 的所有数据总是一起读写（加载 workspace → 编辑 → 保存整个 workspace），不存在"只读某一个球员"的场景
- **无需 JOIN**：关系表方案需要多表 JOIN 才能组装 workspace，单表一次查询即可
- **schema 灵活**：jsonb 允许随时添加新字段（如 `preferences`、新球员属性），不需要 ALTER TABLE 迁移
- **简单导入导出**：workspace 导出就是 `data` 字段的内容，导入就是写入 `data` 字段

## 备选方案

- **关系表**（players, scenarios, assignments 等）：数据规范化，适合复杂查询。但项目的访问模式是"整读整写"，关系表的优势发挥不出来，反而增加查询复杂度和迁移成本
- **多文档（MongoDB 风格）**：功能上可行，但 Supabase 提供的 PostgreSQL 已足够，不需要额外引入 NoSQL 数据库

## 后果

- 无法对 jsonb 内部字段建高效索引（当前不需要）
- PostgreSQL jsonb 查询语法较冗长（但当前只有整读整写，不涉及 jsonb 内部查询）
- 数据校验完全依赖应用层的 `sanitizeWorkspace()`，无法依赖 DB 约束
