# 前端规范

## 架构概述

当前 UI 处于 **React + 旧 DOM 混合** 过渡期：

- **新功能**以 React 组件实现（Next.js App Router）
- **主力交互 UI**（球员名册、守位球场、棒次、方案管理）仍由旧 DOM 管理器 `player-manager-dom.ts`（~1525 行）驱动
- **迁移方向**：逐步将 DOM 管理器中的功能拆分为独立 React 组件

## 组件模式

### Server Components（默认）

Next.js App Router 中，`page.tsx` 和 `layout.tsx` 默认是服务端组件。它们负责：

- 认证守卫（读取 cookie、验证 HMAC 签名）
- 从数据库加载 workspace
- 将 workspace 作为 props 传递给客户端组件

```
page.tsx (server)
  ├── 验证解锁 cookie
  ├── 并行加载 workspace + legacy template
  └── 渲染 <PlayerManagerClient initialWorkspace={...} initialVersion={...} markup={...} styles={...} />
       └── 挂载旧 DOM 管理器
```

### Client Components（'use client'）

仅在需要交互时使用：

| 组件 | 职责 |
|---|---|
| `UnlockForm` | 纯客户端：输入 passcode → POST /api/unlock |
| `PlayerManagerClient` | 混合 UI 容器：挂载 legacy manager，管理 Toast/HelpDrawer/GuideOverlay 与帮助/引导开关；DOM 管理器通过回调 ref 调用 toast/help/guide |
| `PlayerProfilePageClient` | 状态管理：workspace 读写 + 版本冲突处理 |
| `PlayerProfileEditor` | 纯客户端：完整档案编辑表单 + SVG 雷达图 |
| `Toast` | Portal 渲染的 toast 通知 |
| `HelpDrawer` | 帮助抽屉（焦点陷阱 + Escape 关闭） |
| `GuideOverlay` | 新手引导浮层（步骤导航 + 元素高亮） |
| `ThemeToggle` | 主题切换按钮 |

### 组件文件结构

```
src/components/
├── unlock-form.tsx                  # 认证表单
├── player-manager-client.tsx        # 状态桥接 + DOM 管理器挂载点
├── player-profile-page-client.tsx   # 档案页面状态
├── player-profile-editor.tsx        # 档案编辑器（page + drawer）
├── player-profile-editor.module.css # 档案编辑器样式（CSS Modules）
├── toast.tsx                         # Toast 通知（Portal）
├── help-drawer.tsx                   # 帮助抽屉
├── guide-overlay.tsx                 # 新手引导浮层
└── theme-toggle.tsx                  # 主题切换按钮
```

## 状态管理

### 核心状态流

```
Server (page.tsx)
  │  GET /api/workspace → workspace snapshot
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
  └── 409: 版本冲突 → 重新加载最新数据 → 重试
```

### 原则

- **无全局状态库**：不使用 Redux、Zustand 等。状态通过 props 向下传递
- **workspace 是唯一真实源**：所有数据（球员、方案、偏好）都在 workspace 对象中
- **客户端 fetch 通过 `workspace-client.ts`**：封装 GET/PUT 请求，处理 409 冲突和错误
- **无乐观更新**：客户端在服务器确认后才更新 UI，避免数据不一致

## 样式方法

| 范围 | 方法 |
|---|---|
| 全局主题 + 基础样式 | `src/app/globals.css`（CSS 自定义属性 + 全局选择器） |
| React 组件样式 | CSS Modules（`*.module.css`） |
| 旧 DOM 管理器样式 | 内联在 `index.html`，由 `legacy-template.ts` 提取注入 |

### 约束

- 不要在 JSX 中写 inline style（除动态计算值如雷达图坐标外）
- 当前组件样式主要依赖 CSS Modules 自身类名和全局主题变量；仓库中目前没有使用 `composes:`
- 颜色始终用 `var(--theme-*)`，不硬编码

## 旧 DOM 管理器（`player-manager-dom.ts`）

### 当前状态

- ~1525 行（从 1742 行减少 12%）
- Toast、帮助抽屉、引导浮层、主题切换已迁移至 React 组件
- 其余 UI 区域（名册、球场、棒次、方案管理、球员编辑）仍由 DOM 管理器驱动

### 已知问题

- 大量全局状态、闭包副作用
- 难以测试（纯 DOM 断言困难）
- 与 React 生命周期不协调

### 迁移策略

1. 每个 UI 区域独立拆分为 React 组件
2. 新组件通过 `PlayerManagerClient` 挂载，逐步替换旧 DOM 片段
3. 拆分完成后删除 `legacy-template.ts` 和 `index.html` 提取逻辑
4. 拆分期间确保新旧组件不互相覆盖 DOM 节点

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
