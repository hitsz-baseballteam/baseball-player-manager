# 设计标准

## 公开球队主页

主域名 `/` 是独立于控制台的 HITSZ 棒球队品牌与招新主页。视觉方向采用“新生开球”校园体育海报语言：

- 深海军蓝、球衣金橙、泥土红与暖白为核心色
- 真实球队照片承担主要视觉，不使用虚构球员或图库占位图
- 超大中文标题、倾斜构图和赛事海报式信息层级强调招新行动
- 页面内容依次覆盖球队品牌、入队步骤、球队精神、训练方式、照片与联系方式
- 移动端保留首屏招新 CTA、联系方式和队员入口

公开主页使用 `public-home.tsx` 与独立 CSS Module，不复用后台 `AppShell`。静态文案集中在 `public-site-content.ts`。

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

控制台首页 `/panel` 通过 `src/components/app-shell.tsx` 提供统一壳层，视觉角色是：

- **Command Sidebar**：首页使用深绿侧栏承载一级导航；窄屏回落为顶部导航条
- **Command Masthead**：比赛日指挥台题头、同步状态、当前方案与帮助 / 主题动作
- **HomeOverview**：以球场守备阵型为主视觉，右侧并列阵容警报与 1–9 棒打序，底部承载出勤指标、快捷动作与自动排阵
- **RosterOverview**：名册工作台页面，包含筛选、统计、球员卡片列表、批量动作条、抽屉档案入口与完整档案页跳转

壳层样式放在 `src/components/app-shell.module.css`，总控区样式放在 `src/components/home-overview.module.css`。首页已不再依赖 legacy DOM 模板或 legacy frame，页面字体与布局完全由 React 壳层控制。

首页赛事指挥台的视觉参考保存在 `public/ui-reference/game-day-command-center.png`，球场底图资产保存在 `public/assets/baseball-field-command-board.png`。球员节点和动作控件必须保持为真实 HTML 控件，不能烘焙进底图。

## 解锁页特殊设计

解锁页（`UnlockForm` 组件）不跟随主题切换。它使用独立的渐变色背景和入口卡片样式（`.unlock-shell`、`.unlock-card`），始终以暖绿 / 奶油色调呈现，与首页壳层保持同一品牌语言，但不依赖已解锁后的主题状态。

## 交互设计

- **过渡动画**：主题切换使用 0.3s CSS transition；悬停态用 `:hover` 伪类
- **焦点可见**：输入框聚焦时显示 4px 绿色光晕（`box-shadow`），确保可访问性
- **禁用态**：按钮 `:disabled` 降低不透明度至 0.6 + 禁用光标
- **响应式**：首页壳层的 hero / command desk / metrics / scenario snapshot / lineup pulse 都基于网格和 `auto-fit` 卡片收缩；Alert Deck、Command Strip、Metrics 与 Lineup Pulse 会在窄屏回落为单列；次级动作区会从五列回落到三列再到单列；解锁卡片 `width: min(620px, 100%)`，移动端回落到 24px 内边距；帮助抽屉、引导卡和 toast 继续沿用 portal 结构但贴近新壳层；档案编辑器支持 drawer（侧边抽屉）和 page（独立页面）两种展示模式

## 设计资产

- **Favicon**：`src/app/favicon.ico`（26KB）
- **图标**：旧版 UI 使用 emoji / Unicode 字符（⚾ 等），新版 React 组件使用内联 SVG（如雷达图）

## 设计约束

- 不要引入 CSS 框架（Bootstrap、Tailwind 等）——当前样式体系以 CSS 自定义属性 + 全局类名为主，局部复杂组件按需使用 CSS Modules
- 当前 React 组件样式分三层：全局 token 在 `globals.css`，首页壳层在 `app-shell.module.css`，首页总控区在 `home-overview.module.css`；解锁页仍保留少量硬编码颜色作为独立入口视觉
- 仓库里仍保留少量 legacy 兼容样式钩子；在继续清理残留时，确保这些选择器不会误伤当前 React 组件样式
