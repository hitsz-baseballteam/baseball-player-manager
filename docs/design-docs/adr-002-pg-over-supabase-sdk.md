# ADR-002: 选择 pg (node-postgres) 而非 Supabase JS SDK

状态：已采纳

## 背景

Supabase 提供官方的 `@supabase/supabase-js` SDK，封装了 PostgreSQL 查询、Auth、Realtime、Storage 等。项目只使用 Supabase 的 PostgreSQL 托管服务，不需要其他功能。

## 决策

使用 `pg`（node-postgres）直接连接 PostgreSQL，不使用 Supabase JS SDK。

## 理由

- **最小依赖**：`pg` 是一个成熟、稳定的 PostgreSQL 驱动，API 简单
- **无 vendor lock-in**：`pg` 操作的是标准 PostgreSQL，未来可换到任何 PostgreSQL 提供商
- **精确控制**：直接写 SQL，不需要学习或绕过 Supabase SDK 的抽象层
- **减少依赖体积**：`@supabase/supabase-js` 会引入 Auth、Realtime、postgrest-js 等大量代码，项目中完全用不到

## 备选方案

- **Supabase JS SDK**：功能丰富但引入大量不需要的依赖。Auth 和 Realtime 功能项目不需要，postgrest-js 的 API 不如直接写 SQL 直观
- **Drizzle / Prisma ORM**：项目数据模型简单（单表 jsonb），ORM 的迁移、类型生成等功能在当前规模下是过度设计

## 后果

- 需要手动管理连接池（已通过 `db.ts` 实现，max 5 connections）
- 查询参数化需要手动编写（`$1`, `$2`），无类型安全查询构建器
- 数据库迁移手动编写 SQL（`supabase/migrations/`）
