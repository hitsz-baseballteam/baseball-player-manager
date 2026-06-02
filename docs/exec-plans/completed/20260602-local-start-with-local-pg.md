# 本地启动并切换到本地 PostgreSQL

## 目标
让项目在本地启动，并将后端数据库连接切换为本机 PostgreSQL。

## 范围
- 检查本机 PostgreSQL 可用性
- 创建本地开发数据库（如缺失）
- 应用仓库内现有迁移
- 将本地运行的 `DATABASE_URL` 指向本地 PostgreSQL
- 启动 Next.js 开发服务器并验证关键接口可访问

## 已观察事实
- `psql` 与 `pg_isready` 已安装
- 本机 `5432` 端口 PostgreSQL 当前可连接
- 项目数据库连接只依赖 `DATABASE_URL`
- 仓库已有 SQL 迁移：`supabase/migrations/20260529172000_create_app_workspace.sql`
- 本机已存在数据库：`baseball_manager`
- `baseball_manager.public.app_workspace` 已存在且有 1 行种子数据

## 步骤
1. 检查当前本地环境配置，避免破坏已有本地变量
2. 创建本地数据库并执行迁移
3. 将本地运行配置切换到本地 PostgreSQL
4. 启动开发服务器并验证

## 执行结果
- 已备份原 `.env.local` 为 `.env.local.backup-20260602-212455`
- 已将 `.env.local` 中的 `DATABASE_URL` 更新为 `postgres://kennywang@127.0.0.1:5432/baseball_manager`
- 已确认本地开发服务器启动于 `http://localhost:3000`
- 已通过 `POST /api/unlock` 与 `GET /api/workspace` 验证本地服务可正常访问工作区数据

## 验证
- [x] `pg_isready` 可通过
- [x] 迁移表 `public.app_workspace` 存在
- [x] `npm run dev` 可启动
- [x] `/api/workspace` 在本地环境可工作
