# 棒球队球员管理系统

[English README](./README.md)

棒球队球员管理系统是一个基于 Next.js 的全栈应用，用于管理共享球队工作区：名册、守备与打序方案、球员档案，以及比赛数据。

## 项目概览

- 技术栈：Next.js 16 App Router、React 19、TypeScript、通过 `pg` 连接 PostgreSQL
- 认证方式：共享口令登录，使用签名 `httpOnly` Cookie
- 持久化模型：一个共享工作区快照存储在 PostgreSQL 中，并通过 `version` 做乐观并发控制
- 数据库迁移：`supabase/migrations/`
- 存储模型：归一化 `app_*` 表，`GET /api/workspace` 作为聚合 bootstrap 读取接口

## 主要功能

- 公开球队主页 `/`，用于招新和球队展示
- 受保护的管理后台 `/panel`
- 名册工作台：球员资料、筛选、批量编辑
- 战术场景工作台：守备分配与打序规划
- 球员档案与个人比赛数据管理
- 设置页：导入导出、重置、退出登录

## 快速开始

```bash
npm install
cp .env.example .env.local
npm run auth:env -- "your-passcode"
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

## 开发者说明

这一节是给组织内开发成员使用的本地开发流程。

### 1. 前置条件

- Node.js 22 或 24
- npm
- 通过 GitHub SSH 访问本仓库的权限
- 一个可用的开发 PostgreSQL 数据库

当前 CI 运行在 Node 22 和 24 上，本地尽量保持一致，可以减少环境偏差。

### 2. 克隆并安装依赖

```bash
git clone git@github.com:hitsz-baseballteam/baseball-player-manager.git
cd baseball-player-manager
npm install
```

### 3. 准备环境变量

先创建本地环境文件：

```bash
cp .env.example .env.local
```

然后填写：

- `DATABASE_URL`
- `APP_ADMIN_PASSCODE_HASH`
- `AUTH_SECRET`
- `DATABASE_CA_CERT` 仅在数据库需要自定义 CA 时填写

使用一个本地开发口令生成认证相关变量：

```bash
npm run auth:env -- "your-local-passcode"
```

将输出的 `APP_ADMIN_PASSCODE_HASH` 和 `AUTH_SECRET` 写入 `.env.local`。

注意：

- 运行时不要使用 `APP_ADMIN_PASSCODE`，当前应用要求 `APP_ADMIN_PASSCODE_HASH` 和 `AUTH_SECRET`
- `.env.local` 不应提交到版本库

### 4. 准备数据库

你需要一个已经具备项目 schema 的 PostgreSQL 数据库。

团队内通常有两种方式：

1. 使用组织维护的共享开发库，并将其连接串配置到 `DATABASE_URL`
2. 自己创建本地 PostgreSQL 数据库，并手动应用 `supabase/migrations/` 下的迁移

对于全新本地库，至少需要应用：

- [supabase/migrations/20260529093022_create_app_workspace.sql](/Users/kennywang/app/baseball-player-manager/supabase/migrations/20260529093022_create_app_workspace.sql)
- [supabase/migrations/20260616195000_normalize_workspace_storage.sql](/Users/kennywang/app/baseball-player-manager/supabase/migrations/20260616195000_normalize_workspace_storage.sql)

如果你是在已有旧库上升级，并且库里已经有 `public.app_workspace`，还需要应用：

- [supabase/migrations/20260616223000_backfill_normalized_workspace_storage.sql](/Users/kennywang/app/baseball-player-manager/supabase/migrations/20260616223000_backfill_normalized_workspace_storage.sql)

当前运行时已经从归一化分表读取。旧的 `public.app_workspace` 会在切换窗口内保留，用于回滚或 bootstrap。

### 5. 启动应用

```bash
npm run dev
```

然后访问：

- `http://localhost:3000` 公开主页
- `http://localhost:3000/panel/login` 管理后台登录页

登录时使用和你生成 `APP_ADMIN_PASSCODE_HASH` 时相同的口令。

### 6. 先了解几个关键本地路由

- `/` 公开球队主页
- `/panel` 指挥台首页
- `/panel/roster` 名册管理
- `/panel/scenarios` 场景与排阵管理
- `/panel/stats` 统计与比赛数据
- `/panel/settings` 导入导出、重置与退出登录

### 7. 去哪里修改代码

- `src/app/` 放路由、页面、布局和 API 处理器
- `src/components/` 放交互式 UI 组件
- `src/lib/` 放共享业务逻辑、认证、持久化和数据清洗
- `supabase/migrations/` 放数据库 schema 变更

建议遵守这些边界：

- 业务规则优先放在 `src/lib/`
- 数据库访问集中在 `src/lib/db.ts` 和 `src/lib/workspace-store.ts`
- 客户端数据保存统一走 `src/lib/workspace-client.ts` 和资源化 `/api/*` 路由

### 8. 推送前先运行检查

```bash
npm run lint
npm test
npm run build
```

这些就是当前 CI 强制执行的核心检查。

### 9. 团队协作约定

- 每个改动使用独立功能分支
- 推送前先在本地完成验证
- 代码、测试和文档尽量一起提交
- 如果文档和代码冲突，先以代码为准，再补正文档

中大型改动建议按 `AGENTS.md` 里的仓库约定，在 `docs/` 下补充 exec plan 或 ADR。

## 环境变量

将 `.env.example` 复制为 `.env.local` 后，配置以下变量：

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 |
| `DATABASE_CA_CERT` | 否 | 私有或非公网根证书场景下的自定义 CA 证书 |
| `APP_ADMIN_PASSCODE_HASH` | 是 | 登录流程使用的管理员口令哈希 |
| `AUTH_SECRET` | 是 | 用于签名认证 Cookie 的密钥 |

使用以下命令生成 `APP_ADMIN_PASSCODE_HASH` 和 `AUTH_SECRET`：

```bash
npm run auth:env -- "your-passcode"
```

说明：

- 运行时不再支持明文 `APP_ADMIN_PASSCODE`
- `AUTH_SECRET` 和 `APP_ADMIN_PASSCODE_HASH` 必须同时存在

## 数据库

应用通过 `pg` 直接连接 PostgreSQL。数据库迁移位于：

- [supabase/migrations/20260529093022_create_app_workspace.sql](/Users/kennywang/app/baseball-player-manager/supabase/migrations/20260529093022_create_app_workspace.sql)
- [supabase/migrations/20260616195000_normalize_workspace_storage.sql](/Users/kennywang/app/baseball-player-manager/supabase/migrations/20260616195000_normalize_workspace_storage.sql)
- [supabase/migrations/20260616223000_backfill_normalized_workspace_storage.sql](/Users/kennywang/app/baseball-player-manager/supabase/migrations/20260616223000_backfill_normalized_workspace_storage.sql)

当前 schema 特点：

- 仍只维护一个逻辑工作区 `default`
- 聚合元数据位于 `public.app_workspace_meta`
- 球员、守位、场景、分配、比赛、局数据、统计行、里程碑拆到独立表
- 旧 `public.app_workspace` 临时保留，作为回滚 / bootstrap 来源
- 写入依赖 `app_workspace_meta.version` 做乐观并发控制

## 常用命令

```bash
npm run dev
npm run lint
npm test
npm run build
npm run start
```

## 应用结构

### 页面结构

| 路由 | 用途 |
|---|---|
| `/` | 公开球队主页 |
| `/panel/login` | 共享口令登录页 |
| `/panel` | 指挥台首页 |
| `/panel/roster` | 名册管理 |
| `/panel/scenarios` | 场景与排阵工作台 |
| `/panel/stats` | 统计与比赛数据中心 |
| `/panel/settings` | 导入导出、重置、退出登录 |
| `/panel/players/[playerId]` | 球员档案 |
| `/panel/players/[playerId]/games` | 球员比赛记录 |

### 关键代码文件

| 文件 | 作用 |
|---|---|
| `src/lib/workspace.ts` | 领域类型、数据清洗、导入导出、工作区规则 |
| `src/lib/workspace-store.ts` | PostgreSQL 持久化与乐观并发控制 |
| `src/lib/auth.ts` | 口令认证与签名 Cookie 校验 |
| `src/lib/roster-actions.ts` | 共享名册业务逻辑 |
| `src/lib/lineup-actions.ts` | 共享场景与排阵业务逻辑 |
| `src/components/player-manager-client.tsx` | 控制台首页客户端 |
| `src/components/roster-page-client.tsx` | 名册页客户端 |
| `src/components/scenarios-page-client.tsx` | 场景页客户端 |
| `src/components/home-overview.tsx` | 首页总览面板 |

## 接口

当前服务端接口：

- `POST /api/logout`
- `GET /api/workspace`
- `PUT /api/workspace`

`/api/workspace` 依赖登录后签发的解锁 Cookie 保护。

## 验证

提交或合并前建议执行以下检查：

```bash
npm run lint
npm test
npm run build
```

## 相关文档

- [AGENTS.md](/Users/kennywang/app/baseball-player-manager/AGENTS.md) - 仓库地图与协作规则
- [docs/ARCHITECTURE.md](/Users/kennywang/app/baseball-player-manager/docs/ARCHITECTURE.md) - 当前架构说明
- [docs/DESIGN.md](/Users/kennywang/app/baseball-player-manager/docs/DESIGN.md) - 视觉与交互规范
- [docs/FRONTEND.md](/Users/kennywang/app/baseball-player-manager/docs/FRONTEND.md) - 前端约定
- [docs/SECURITY.md](/Users/kennywang/app/baseball-player-manager/docs/SECURITY.md) - 认证与安全模型
- [docs/RELIABILITY.md](/Users/kennywang/app/baseball-player-manager/docs/RELIABILITY.md) - 并发与可靠性说明
- [docs/design-docs/index.md](/Users/kennywang/app/baseball-player-manager/docs/design-docs/index.md) - ADR 索引
- [docs/design-docs/core-beliefs.md](/Users/kennywang/app/baseball-player-manager/docs/design-docs/core-beliefs.md) - 设计原则

## 部署说明

当前仓库采用双分支部署流程：

- `dev` 用于预览部署
- `main` 用于生产部署

当前部署行为由 Vercel 项目配置控制，而不是仓库内的 `vercel.json`。
