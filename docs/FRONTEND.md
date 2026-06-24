# 前端规范

## 架构概述

当前前端已经收敛为 **纯 React / Next.js App Router**：

- `/` 是公开球队主页；认证控制台首页是 `/panel`
- 真实工作台页面位于 `/panel/*`，包括名册、战术场景、数据中心、设置和球员档案
- `/roster`、`/scenarios`、`/stats`、`/settings`、`/players/[playerId]` 及其比赛数据路由保留为永久重定向别名
- `/lineup` 仅保留兼容入口，永久重定向到 `/panel/scenarios`
- 旧的 homepage legacy DOM runtime（`index.html` / `legacy-template.ts` / `legacy-bridge.ts` / `player-manager-dom.ts` / `dom-*`）已清退
- 共享业务逻辑继续沉淀在 `src/lib/` 中，由多个页面复用

## 组件模式

### Server Components（默认）

各受保护业务页面 `page.tsx` 默认是服务端组件，职责统一：

- 读取 cookie，执行认证守卫
- 根据页面调用 full / bootstrap / games / milestones server reader 加载裁剪后的共享 workspace
- 将 `workspace` 和 `version` 作为 props 传给客户端页面组件

典型结构：

```tsx
page.tsx (server)
  ├── 验证解锁 cookie
  ├── 加载 workspace snapshot
  └── 渲染 <XxxPageClient initialWorkspace={...} initialVersion={...} />
```

`layout.tsx` 只负责全局字体与 metadata，不负责认证或数据加载。

### Client Components（'use client'）

仅在需要交互时使用：

| 组件 | 职责 |
|---|---|
| `AppShell` | 全局壳层：导航、页面题头、状态卡、内容槽位 |
| `HomeOverview` | 首页总控区：Alert Deck、Command Strip、Key Metrics、Scenario Snapshot、Lineup Pulse |
| `PlayerManagerClient` | 首页 command-desk 客户端：直接动作、页面跳转、帮助/引导 |
| `RosterPageClient` | 名册工作台状态：筛选、选择、对话框、保存与冲突处理；workspace/version 由共享 hook 管理 |
| `RosterOverview` | 名册工作台视图层：filters、counts、cards、bulk actions |
| `LineupPageClient` | 独立排阵板实现，保留为抽取后的守位/棒次工作台组件与测试载体；当前生产路由已并入 `ScenariosPageClient` |
| `ScenariosPageClient` | 场景页状态：CRUD、当前方案切换、对比模式、保存与冲突处理 |
| `SettingsPageClient` | 设置页状态：工作区状态、导入导出、重置数据、退出登录 |
| `StatsPageClient` | 数据中心状态：球员统计与比赛记录管理 |
| `GamesPageClient` | 比赛数据页状态：正式/训练 tab、逐场增删改、合计摘要、保存与冲突处理；IP 使用棒球记法（`.1`=1 出局、`.2`=2 出局） |
| `PlayerProfilePageClient` | 球员档案页状态：workspace 读写 + 版本冲突处理，并提供跳转到比赛数据页的入口 |
| `PlayerProfileEditor` | 纯客户端：档案表单 + SVG 雷达图；page 形态在顶部提供“查看比赛数据”链接 |
| `PublicHome` | 公开球队展示主页（`/`），独立于 `AppShell`；文案集中在 `public-site-content.ts`，包含队史、首战、训练、背号墙、相册与轻量加入入口 |
| `ScoreboardPageClient` | 记分板页状态：赛前设置 → 实时记分 → 赛后确认；标准/双模式切换、PA 推导、localStorage 崩溃恢复 |
| `Scorecard` | 记分卡面板：组合 `PitchCounter` / `PaResultGrid` / `RunnerDiamond` / `OpponentBaseDiamond` 完成一次打席记录 |
| `HallOfFamePageClient` | 名人堂页状态：球员生涯统计聚合、徽章/荣誉列表、个人战绩卡 |
| `Toast` | Portal 渲染的 toast 通知 |
| `HelpDrawer` | 帮助抽屉 |
| `GuideOverlay` | 新手引导浮层 |

## 组件文件结构

```text
src/components/
├── app-shell.tsx
├── bench-panel.tsx
├── field-board.tsx
├── games-page-client.tsx
├── hall-of-fame-page-client.tsx
├── home-overview.tsx
├── lineup-order.tsx
├── lineup-page-client.tsx
├── lineup-strip.tsx
├── opponent-base-diamond.tsx
├── pa-result-grid.tsx
├── pitch-counter.tsx
├── player-manager-client.tsx
├── player-profile-editor.tsx
├── player-profile-page-client.tsx
├── public-home.tsx
├── radar-chart.tsx
├── roster-overview.tsx
├── roster-page-client.tsx
├── runner-diamond.tsx
├── scenario-compare.tsx
├── scenario-list.tsx
├── scene-field-board.tsx
├── scenarios-page-client.tsx
├── scoreboard-page-client.tsx
├── scoreboard-review-dialog.tsx
├── scoreboard-setup-dialog.tsx
├── scorecard.tsx
├── settings-page-client.tsx
├── stats-page-client.tsx
├── toast.tsx
├── help-drawer.tsx
└── guide-overlay.tsx

src/lib/
├── auth.ts
├── db.ts
├── dev-server-output.ts
├── export-actions.ts
├── hall-of-fame.ts
├── lineup-actions.ts
├── local-id.ts
├── maintenance.ts
├── migrate-v2-to-v3.ts
├── panel-server.ts
├── public-site-content.ts
├── rate-limiter.ts
├── roster-actions.ts
├── routes.ts
├── schemas.ts
├── scoreboard-actions.ts
├── stats.ts
├── workspace/                  # Domain barrel; see src/lib/workspace/index.ts
│   ├── base.ts
│   ├── helpers.ts
│   ├── index.ts
│   ├── sanitizers.ts
│   └── types.ts
├── workspace-client.ts
├── use-workspace-snapshot.ts
└── workspace-store.ts
```

## 状态管理

### 核心状态流

```text
Server page.tsx
  └── panel-server.ts (checkPanelAuth + getPanelBootstrap / getPanelGames / getPanelMilestones / getPanelWorkspaceSnapshot)
       ↓
Client page component
  └── useWorkspaceSnapshot() + 页面交互状态
       ↓
workspace-client.ts
  └── 冲突刷新 GET /api/workspace + resource-specific write APIs
       ↓
API routes + optimistic concurrency
       ↓
src/proxy.ts (Next.js 16 代理)
  └── 守护 /panel/* 与 /api/workspace/*；当前 matcher 之外的资源写 API 归 TD-10 管理
```

### 原则

- **无全局状态库**：不使用 Redux、Zustand 等
- **workspace 是业务真相源**：球员、方案、分配等持久化数据都来自 workspace
- **跨页面共享逻辑优先抽纯函数**：
  - 名册 → `roster-actions.ts`
  - 排阵 / 场景 → `lineup-actions.ts`
  - 导入导出 → `export-actions.ts`
- **客户端持久化统一走 `workspace-client.ts`**
- **snapshot contract 统一走 `useWorkspaceSnapshot()`**：成功响应通过 `applySnapshot()` 同步 workspace/version，冲突或失败恢复通过 `refreshWorkspace()`
- **冲突处理显式化**：页面客户端负责展示“已刷新最新数据”或“保存失败”等状态消息
- **不自动预取 Panel 兄弟路由**：Panel 导航链接设置 `prefetch={false}`，避免进入页面时并发触发多个私有 RSC 读取

## 样式方法

| 范围 | 方法 |
|---|---|
| 全局主题 + 基础样式 | `src/app/globals.css` |
| 页面 / 复杂局部组件 | CSS Modules |
| 少量动态值 | JSX inline style（仅限必要场景） |

### 约束

- 优先使用主题变量 `var(--theme-*)`
- 不把视觉状态硬编码在业务逻辑中
- 新页面优先使用 CSS Modules 保持边界清晰

## 路由

| 路由 | 类型 | 功能 |
|---|---|---|
| `/` | Server + Client | 公开球队展示主页：球队身份、队史开端、首次出征、训练文化、背号墙、相册、FAQ 与轻量加入入口 |
| `/panel/login` | Server + Server Action | 共享口令登录页；表单提交到 `unlockAction` |
| `/panel` | Server + Client | 控制台首页：提醒、快捷动作、方案摘要、阵容概览 |
| `/panel/roster` | Server + Client | 名册工作台：筛选、批量操作、档案入口 |
| `/panel/scenarios` | Server + Client | 战术场景工作台：方案 CRUD、守备图、棒次、对比视图 |
| `/panel/stats` | Server + Client | 数据中心：球员统计与比赛记录管理；主导航主动预取该动态路由，并提供路由级加载骨架以缩短首次点击等待感 |
| `/panel/settings` | Server + Client | 设置页：工作区状态、导入导出、重置数据、退出登录 |
| `/panel/players/[playerId]/games` | Server + Client | 比赛数据：正式 / 训练双 tab、逐场增删编辑、合计摘要卡，ERA/WHIP 按棒球局数记法计算 |
| `/panel/players/[playerId]` | Server + Client | 球员档案独立页，页内提供进入比赛数据页的链接 |
| `/panel/scoreboard` | Server + Client | 实时记分板：标准 / 双模式切换、PA 结果自动推导统计、localStorage 崩溃恢复、赛后确认弹窗 |
| `/panel/hall-of-fame` | Server + Client | 名人堂：球员生涯统计聚合、徽章/荣誉列表、个人战绩卡 |
| `/roster` `/scenarios` `/stats` `/settings` | Redirect | 永久重定向到对应 `/panel/*` 页面 |
| `/players/[playerId]` `/players/[playerId]/games` | Redirect | 永久重定向到对应 `/panel/*` 页面 |
| `/lineup` | Redirect | 兼容入口，重定向到 `/panel/scenarios` |
| `/api/logout` | API (POST) | 清除 cookie |
| `/api/workspace` | API (GET) | 工作区 bootstrap 读取 |
| `/api/players` `/api/players/*` | API | 球员创建、更新、删除、批量操作 |
| `/api/scenarios` `/api/scenarios/*` | API | 场景创建、重命名、删除、激活、分配更新 |
| `/api/games` `/api/games/*` | API | 比赛创建、更新、删除 |
| `/api/milestones` `/api/milestones/*` | API | 里程碑创建、更新、删除 |
| `/api/workspace/import` `/api/workspace/reset` `/api/workspace/preferences` | API | 导入、重置、偏好设置 |

## 数据流边界

| 方向 | 校验点 |
|---|---|
| DB → API | `sanitizeWorkspace()` |
| API → Client | `sanitizeWorkspace()` |
| Client → API | `sanitizeWorkspace()` |
| Import JSON → Client | `prepareImport()` |

## 当前迁移结论

旧 DOM 运行时已经退役。后续前端工作不再围绕“继续兼容 legacy manager”，而是围绕：

1. 强化 React 页面体验
2. 继续下沉共享纯逻辑
3. 在 React 页面之间保持信息架构和视觉语言一致
