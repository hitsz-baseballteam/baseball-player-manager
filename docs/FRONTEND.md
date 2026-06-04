# 前端规范

## 架构概述

当前 UI 处于 **React + 旧 DOM 混合** 过渡期：

- **新功能**以 React 组件实现（Next.js App Router）
- **主力交互 UI**（球员名册、守位球场、棒次、方案管理）仍由旧 DOM 管理器 `player-manager-dom.ts`（当前约 876 行）驱动
- **迁移方向**：逐步将 DOM 管理器中的功能拆分为独立 React 组件

## 组件模式

### Server Components（默认）

Next.js App Router 中，`page.tsx`、`players/[playerId]/page.tsx` 和 `layout.tsx` 默认是服务端组件，但职责并不相同：

- `page.tsx` / `players/[playerId]/page.tsx` 负责认证守卫（读取 cookie、验证 HMAC 签名）
- 这两个 page server component 直接调用 `getOrCreateWorkspaceSnapshot()` 从数据库加载 workspace
- `layout.tsx` 主要负责全局字体与 metadata，不承担认证或数据加载
- server component 将 workspace 作为 props 传递给客户端组件

```
page.tsx (server)
  ├── 验证解锁 cookie
  ├── 并行加载 workspace + legacy template
  └── 渲染 <PlayerManagerClient initialWorkspace={...} initialVersion={...} markup={...} styles={...} />
       ├── 渲染 React `AppShell`
       ├── 渲染 `HomeOverview`（提醒 / 快捷动作 / 指标 / 方案切换 / 阵容概览）
       ├── 通过 `onStateChange` 同步 legacy manager 的最新 workspace 到 React 概览层
       └── 在 shell 根节点内挂载旧 DOM 管理器
```

### Client Components（'use client'）

仅在需要交互时使用：

| 组件 | 职责 |
|---|---|
| `UnlockForm` | 纯客户端：输入 passcode → POST /api/unlock，并渲染比赛日入口卡片 |
| `AppShell` | React 外壳：全局导航、页面题头、概览内容槽位、legacy frame 与 shell 级动作区 |
| `HomeOverview` | 首页总控区：Alert Deck、Command Strip、Key Metrics、Scenario Snapshot 与 Lineup Pulse |
| `PlayerManagerClient` | 混合 UI 容器：渲染 `AppShell` + `HomeOverview`，预处理 legacy markup（移除旧帮助/引导 DOM，避免重复 overlay），并在 shell 根节点挂载 legacy manager；DOM 管理器通过回调 ref 调用 toast/help，同时用 `onStateChange` 把最新 workspace / version / saveStatus 回推给 React 概览层 |
| `PlayerProfilePageClient` | 状态管理：workspace 读写 + 版本冲突处理 |
| `PlayerProfileEditor` | 纯客户端：完整档案编辑表单 + SVG 雷达图 |
| `Toast` | Portal 渲染的 toast 通知 |
| `HelpDrawer` | 帮助抽屉（焦点陷阱 + Escape 关闭） |
| `GuideOverlay` | 新手引导浮层（步骤导航 + 元素高亮） |
| `ThemeToggle` | 主题切换按钮 |

### 组件文件结构

```
src/components/
├── app-shell.tsx                    # 首页全局壳层
├── app-shell.module.css             # 壳层与 legacy frame 样式隔离
├── home-overview.tsx                # 首页总控区（提醒 / 动作 / 指标 / 阵容概览）
├── home-overview.module.css         # 总控区样式
├── unlock-form.tsx                  # 认证表单 / 比赛日入口卡片
├── player-manager-client.tsx        # 状态桥接 + shell 内 DOM 管理器挂载点
├── player-profile-page-client.tsx   # 档案页面状态
├── player-profile-editor.tsx        # 档案编辑器（page + drawer）
├── player-profile-editor.module.css # 档案编辑器样式（CSS Modules）
├── toast.tsx                        # Toast 通知（Portal）
├── help-drawer.tsx                  # 帮助抽屉
├── guide-overlay.tsx                # 新手引导浮层
└── theme-toggle.tsx                 # 主题切换按钮
```

## 状态管理

### 核心状态流

```
Server (`page.tsx` / `players/[playerId]/page.tsx`)
  │  直接调用 `getOrCreateWorkspaceSnapshot()` → workspace snapshot
  │
  ▼
Client Component / Legacy Manager
  │  接收 workspace props
  │  由 DOM 管理器或客户端页面组件维护可变 workspace 状态
  │  用户操作 → 修改本地状态
  │
  ▼
  PUT /api/workspace → 服务器验证 + 乐观并发写入
  │
  ├── 200: 写入成功
  ├── 409（主工作区）: 重新加载最新数据 → 自动重试
  └── 409（球员档案页）: 刷新到最新数据并提示用户，不自动重放本次编辑
```

### 原则

- **无全局状态库**：不使用 Redux、Zustand 等。状态通过 props 向下传递
- **workspace 是主要业务真实源**：球员、方案等持久化业务数据都在 workspace 对象中；首页总控区不会自建第二套业务状态，而是消费 legacy manager 通过 `onStateChange` 回推的最新 workspace；少量瞬时 UI 开关（如当前引导是否展开）仍由本地 React state 管理
- **客户端 fetch 通过 `workspace-client.ts`**：封装 GET/PUT 请求，处理 409 冲突和错误
- **主工作区使用乐观 UI + 后台保存**：DOM 管理器会先更新本地 `workspace` 并立即 `render()`，随后异步调用 `/api/workspace`；服务端仍通过版本号做乐观并发控制

## 样式方法

| 范围 | 方法 |
|---|---|
| 全局主题 + 基础样式 | `src/app/globals.css`（CSS 自定义属性 + 全局选择器，含 `--shell-*` token） |
| React 组件样式 | 新首页壳层与总控区优先使用 CSS Modules（`app-shell.module.css` + `home-overview.module.css`）；portal 组件（`HelpDrawer` / `GuideOverlay` / `Toast`）继续复用 legacy className，但由 `globals.css` 中更高优先级的 shell override 接管视觉；其余组件仍以全局类名 + 主题变量为主，局部复杂组件按需使用 CSS Modules |
| 旧 DOM 管理器样式 | 内联在 `index.html`，由 `legacy-template.ts` 提取注入 |

### 约束

- 不要在 JSX 中写 inline style（除动态计算值如雷达图坐标外）
- 当前 React 组件样式主要依赖全局类名和全局主题变量；首页壳层用 CSS Modules，portal 组件通过 `globals.css` 对 legacy 类名做高优先级覆写。仓库中目前没有使用 `composes:`
- 主题化区域优先使用 `var(--theme-*)`；当前解锁页等少数独立视觉区仍存在硬编码颜色，这是已知现状而非统一约束

## 旧 DOM 管理器（`player-manager-dom.ts`）

### 当前状态

- ~876 行（相较更早的 1742 行版本已明显收敛）
- Toast、帮助抽屉、引导浮层、主题切换、首页壳层与首页总控区已迁移至 React 组件
- 其余 UI 区域（名册、球场、棒次、方案管理、球员编辑）仍由 DOM 管理器驱动

### 已知问题

- 大量全局状态、闭包副作用
- 细粒度行为仍难测（纯 DOM 断言困难）；当前已补充基础挂载 smoke test，避免初始化阶段回归
- 与 React 生命周期不协调

### 迁移策略

1. 每个 UI 区域独立拆分为 React 组件
2. 新组件通过 `PlayerManagerClient` 挂载，逐步替换旧 DOM 片段
3. 拆分完成后删除 `legacy-template.ts` 和 `index.html` 提取逻辑
4. 拆分期间确保新旧组件不互相覆盖 DOM 节点；如果 legacy 模板里已有同名 overlay / 按钮，优先在进入 React shell 前移除或重命名
5. 对于短期仍留在 legacy 的高频动作，可先由 React 总控区直接桥接 legacy 按钮 / select；React 只承载入口与状态呈现，不复制底层业务实现

## 路由

| 路由 | 类型 | 功能 |
|---|---|---|
| `/` | Server + Client | 主页：认证门 → 工作区 → 球员管理器 |
| `/players/[playerId]` | Server + Client | 球员档案独立页 |
| `/api/unlock` | API (POST) | 认证：验证 passcode，签发 cookie |
| `/api/logout` | API (POST) | 登出：清除 cookie |
| `/api/workspace` | API (GET/PUT) | 工作区读写 |

## 数据流边界

| 方向 | 校验点 |
|---|---|
| API → Client | `sanitizeWorkspace()` 在 API route 返回前执行 |
| Client → API | `sanitizeWorkspace()` 在 API route 处理前执行 |
| DB → API | GET route 读取后经过 `sanitizeWorkspace()` |
| Import JSON → Client | `prepareImport()`（内部按导入类型调用 `sanitizeWorkspace()` 或 `sanitizePlayers()` / `sanitizeScenario()`） |
