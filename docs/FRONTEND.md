# 前端规范

## 架构概述

当前前端已经收敛为 **纯 React / Next.js App Router**：

- 首页 `/` 是 React 总控台（command desk）
- `/roster`、`/lineup`、`/scenarios`、`/import-export`、`/settings`、`/players/[playerId]` 都是独立 React 页面
- 旧的 homepage legacy DOM runtime（`index.html` / `legacy-template.ts` / `legacy-bridge.ts` / `player-manager-dom.ts` / `dom-*`）已清退
- 共享业务逻辑继续沉淀在 `src/lib/` 中，由多个页面复用

## 组件模式

### Server Components（默认）

各业务页面 `page.tsx` 默认是服务端组件，职责统一：

- 读取 cookie，执行认证守卫
- 调用 `getOrCreateWorkspaceSnapshot()` 加载共享 workspace
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
| `UnlockForm` | 纯客户端：输入 passcode → POST `/api/unlock` |
| `AppShell` | 全局壳层：导航、页面题头、状态卡、内容槽位 |
| `HomeOverview` | 首页总控区：Alert Deck、Command Strip、Key Metrics、Scenario Snapshot、Lineup Pulse |
| `PlayerManagerClient` | 首页 command-desk 客户端：直接动作、页面跳转、帮助/引导/主题 |
| `RosterPageClient` | 名册工作台状态：workspace/version、筛选、选择、对话框、保存与冲突处理 |
| `RosterOverview` | 名册工作台视图层：filters、counts、cards、bulk actions |
| `LineupPageClient` | 排阵工作台状态：scenario 切换、守位/棒次拖拽、保存与冲突处理 |
| `ScenariosPageClient` | 场景页状态：CRUD、当前方案切换、对比模式、保存与冲突处理 |
| `ImportExportPageClient` | 数据中心状态：导出、JSON 导入预览与确认导入 |
| `SettingsPageClient` | 设置页状态：主题、重置数据、退出登录、帮助/引导入口 |
| `GamesPageClient` | 比赛数据页状态：正式/训练 tab、逐场增删改、合计摘要、保存与冲突处理 |
| `PlayerProfilePageClient` | 球员档案页状态：workspace 读写 + 版本冲突处理 |
| `PlayerProfileEditor` | 纯客户端：档案表单 + SVG 雷达图 |
| `Toast` | Portal 渲染的 toast 通知 |
| `HelpDrawer` | 帮助抽屉 |
| `GuideOverlay` | 新手引导浮层 |
| `ThemeToggle` | 主题切换按钮 |

## 组件文件结构

```text
src/components/
├── app-shell.tsx
├── home-overview.tsx
├── player-manager-client.tsx
├── roster-page-client.tsx
├── roster-overview.tsx
├── lineup-page-client.tsx
├── scenarios-page-client.tsx
├── import-export-page-client.tsx
├── settings-page-client.tsx
├── player-profile-page-client.tsx
├── player-profile-editor.tsx
├── unlock-form.tsx
├── toast.tsx
├── help-drawer.tsx
├── guide-overlay.tsx
└── theme-toggle.tsx

src/lib/
├── workspace.ts
├── workspace-client.ts
├── roster-actions.ts
├── lineup-actions.ts
└── export-actions.ts
```

## 状态管理

### 核心状态流

```text
Server page.tsx
  └── getOrCreateWorkspaceSnapshot()
       ↓
Client page component
  └── 本地 workspace state + 交互
       ↓
workspace-client.ts
  └── GET/PUT /api/workspace
       ↓
API route + optimistic concurrency
```

### 原则

- **无全局状态库**：不使用 Redux、Zustand 等
- **workspace 是业务真相源**：球员、方案、分配等持久化数据都来自 workspace
- **跨页面共享逻辑优先抽纯函数**：
  - 名册 → `roster-actions.ts`
  - 排阵 / 场景 → `lineup-actions.ts`
  - 导入导出 → `export-actions.ts`
- **客户端持久化统一走 `workspace-client.ts`**
- **冲突处理显式化**：页面客户端负责展示“已刷新最新数据”或“保存失败”等状态消息

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
| `/` | Server + Client | 首页总控台：提醒、快捷动作、方案摘要、阵容概览 |
| `/roster` | Server + Client | 名册工作台：筛选、批量操作、档案入口 |
| `/lineup` | Server + Client | 排阵工作台：守备图、棒次、替补区、自动排阵 |
| `/scenarios` | Server + Client | 场景管理：CRUD + 双方案对比 |
| `/import-export` | Server + Client | 数据中心：JSON 导入预览、JSON/CSV 导出 |
| `/settings` | Server + Client | 设置与帮助：主题、重置数据、退出登录、帮助入口 |
| `/players/[playerId]/games` | Server + Client | 比赛数据：正式 / 训练双 tab、逐场增删编辑、合计摘要卡 |
| `/players/[playerId]` | Server + Client | 球员档案独立页 |
| `/api/unlock` | API (POST) | 验证 passcode，签发 cookie |
| `/api/logout` | API (POST) | 清除 cookie |
| `/api/workspace` | API (GET/PUT) | 工作区读写 |

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
