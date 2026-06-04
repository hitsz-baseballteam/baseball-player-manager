# 设计标准

## 主题系统

项目内置三套主题，通过 CSS 自定义属性切换，存储在 `src/app/globals.css`。

| 主题 | 属性选择器 | 基调 | 适用场景 |
|---|---|---|---|
| **Classic** | `[data-theme="classic"]`（默认） | 暖白 / 墨绿 | 白天使用，棒球经典配色 |
| **Night** | `[data-theme="night"]` | 暗灰 / 翡翠绿 | 夜间使用，降低屏幕亮度 |
| **Field** | `[data-theme="field"]` | 深绿 / 柔白 | 棒球场氛围，沉浸感 |

每套主题当前定义相同的 14 个 CSS 变量：

```
--theme-bg           # 页面背景
--theme-fg           # 前景文字
--theme-surface      # 卡片 / 面板背景
--theme-surface-alt  # 次级面板背景
--theme-border       # 边框 / 分割线
--theme-muted        # 次要文字 / 禁用态
--theme-accent       # 主强调色（按钮、链接）
--theme-accent-hover # 悬停态
--theme-warm         # 暖色调（警告、高亮）
--theme-cool         # 冷色调（信息、链接）
--theme-gold         # 金色（重要标记、奖赏）
--theme-danger       # 危险 / 错误
--theme-shadow       # 弱阴影
--theme-shadow-strong# 强阴影
```

### 壳层变量映射

`globals.css` 现在额外定义 `--shell-*` 变量，供首页 `AppShell` 使用，例如：

- `--shell-max-width`
- `--shell-page-gutter`
- `--shell-panel-radius`
- `--shell-panel-border`
- `--shell-panel-shadow`
- `--shell-hero-ink`
- `--shell-muted`
- `--shell-accent-soft`
- `--shell-grid-line`

这些变量都从 `--theme-*` 派生，保证 classic / night / field 三套主题切换时，首页壳层也会整体联动，而不是只改背景色。

### 球员档案变量映射

`globals.css` 额外定义 `--profile-*` 变量，将主题变量映射到球员档案编辑器的命名空间，避免组件硬编码主题变量名。

### 主题切换

主题通过 `<html data-theme="...">` 属性切换，配合 `transition: background 0.3s, color 0.3s` 实现平滑过渡。当前由 `ThemeToggle` 组件负责切换 `document.documentElement.dataset.theme`，并将选择持久化到 `localStorage`。

## 字体

| 用途 | 字体 | 来源 |
|---|---|---|
| 正文 / UI / 标题 | Inter | 项目内置本地字体（`src/fonts/`，`next/font/local`） |
| 中文 | Noto Sans SC（简体子集） | 项目内置本地字体（`src/fonts/`，`next/font/local`） |
| 后备 | ui-monospace / 系统 sans | 本地字体不可用时的回退 |

字体在 `src/app/layout.tsx` 中通过 `next/font/local` 注入，并暴露 `--font-ui`、`--font-body-sc`；`--font-display` 作为 UI 字体别名供标题样式复用。

## 配色原则

- **绿色系**（`--theme-accent`）为主操作色：确认、提交、主要按钮
- **暖橙**（`--theme-warm`）为警告色：伤停状态、删除确认
- **冷蓝**（`--theme-cool`）为信息色：链接、次要操作
- **金色**（`--theme-gold`）为标记色：特殊标记、评级高亮
- **红色**（`--theme-danger`）为危险操作色：不可逆删除

## 首页壳层设计

首页现在通过 `src/components/app-shell.tsx` 提供统一壳层，视觉角色是：

- **Global Header**：产品名、一级导航、帮助 / 主题动作
- **Page Masthead**：比赛日总控台题头 + 当前方案身份卡
- **HomeOverview**：Alert Deck、Command Strip、Key Metrics、Scenario Snapshot、Lineup Pulse
- **Legacy Frame**：把旧 DOM manager 收纳到统一的面板容器里，而不是直接裸露成整页入口

壳层样式放在 `src/components/app-shell.module.css`，总控区样式放在 `src/components/home-overview.module.css`，并通过更高优先级的局部选择器覆盖 legacy `.app-shell` / `.topbar` / `.brand` 布局，避免和旧模板全局类名冲突。首页壳层根节点会显式恢复项目内置本地字体，避免 legacy `body` 样式把字体栈回退到旧模板。

## 解锁页特殊设计

解锁页（`UnlockForm` 组件）不跟随主题切换。它使用独立的渐变色背景和入口卡片样式（`.unlock-shell`、`.unlock-card`），始终以暖绿 / 奶油色调呈现，与首页壳层保持同一品牌语言，但不依赖已解锁后的主题状态。

## 交互设计

- **过渡动画**：主题切换使用 0.3s CSS transition；悬停态用 `:hover` 伪类
- **焦点可见**：输入框聚焦时显示 4px 绿色光晕（`box-shadow`），确保可访问性
- **禁用态**：按钮 `:disabled` 降低不透明度至 0.6 + 禁用光标
- **响应式**：首页壳层的 hero / command desk / legacy frame 都基于网格和 `auto-fit` 卡片收缩；Alert Deck、Command Strip、Metrics 与 Lineup Pulse 会在窄屏回落为单列；解锁卡片 `width: min(620px, 100%)`，移动端回落到 24px 内边距；帮助抽屉、引导卡和 toast 通过 `globals.css` 的高优先级覆写继续沿用 portal 结构但贴近新壳层；档案编辑器支持 drawer（侧边抽屉）和 page（独立页面）两种展示模式

## 设计资产

- **Favicon**：`src/app/favicon.ico`（26KB）
- **图标**：旧版 UI 使用 emoji / Unicode 字符（⚾ 等），新版 React 组件使用内联 SVG（如雷达图）

## 设计约束

- 不要引入 CSS 框架（Bootstrap、Tailwind 等）——当前样式体系以 CSS 自定义属性 + 全局类名为主，局部复杂组件按需使用 CSS Modules
- 当前 React 组件样式分三层：全局 token 在 `globals.css`，首页壳层在 `app-shell.module.css`，首页总控区在 `home-overview.module.css`；解锁页仍保留少量硬编码颜色作为独立入口视觉
- 新旧 UI 共存期间，确保旧 DOM 元素的 className 不与新 React 组件样式冲突；首页壳层需要优先通过 CSS Modules + `:global(...)` 限定 legacy 覆盖范围
