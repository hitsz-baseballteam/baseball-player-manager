# 设计标准

## 公开球队主页

主域名 `/` 是独立于控制台的哈工深小熊猫棒球队官方展示主页。视觉方向采用“白色校园运动档案馆”：以球队身份、队史开端、首次正式出征、训练文化和真实影像建立长期品牌门面，招新只作为页尾轻量入口。

- 暖白、深海军蓝、土地红、草地绿与少量队服金为核心色
- 真实球队照片承担主要视觉，不使用虚构球员或图库占位图
- 首屏强调“哈工深小熊猫棒球队 / HITSZ Red Pandas Baseball Team”官方身份，不再以短期招新活动作为主叙事
- 页面内容依次覆盖球队简介、核心数字、队史时间线、首次出征、训练流程、球队文化、成员背号墙、相册、FAQ 与联系方式
- 移动端保留首屏球队身份、队史/首战 CTA、加入入口和队员入口

公开主页使用 `public-home.tsx` 与独立 CSS Module，不复用后台 `AppShell`。静态文案集中在 `src/lib/public-site-content.ts`，包含：

- `navigation`：主导航锚点（认识球队、队史、首战、训练、成员、相册、加入我们）
- `hero` / `intro` / `stats`：首屏身份、球队简介与核心数字
- `timeline` / `firstMatch`：2026 队史开端与首次正式出征专题
- `trainingSteps` / `culture`：训练流程与球队文化
- `members` / `gallery`：背号墙与精选影像
- `training`：结构化训练信息卡（时间、地点、自带物品、球队提供物品、注意事项）
- `history`：球队成立年份、故事与荣誉列表
- `faq`：常见问题折叠面板
- `contacts`：联系方式矩阵（微信群二维码、邮箱、社媒链接）

新增模块继续使用公开主页独立 CSS Module，不引入 CSS 框架。交互使用 sticky 毛玻璃导航、滚动进度条、IntersectionObserver reveal、训练 stepper、照片筛选和 lightbox；所有动效都必须支持 `prefers-reduced-motion`。

公开主页同时注入 JSON-LD 结构化数据（`SportsOrganization`、`FAQPage`、`SportsEvent`），提升搜索引擎对球队信息、FAQ 和比赛的识别能力。

从第二阶段起，公开主页的文案和动态内容开关可通过后台 `/panel/settings` 的「主页展示设置」卡片配置，修改后立即生效。号码墙已纳入 `publicHomeConfig.members`，管理员可以维护成员姓名、背号、昵称、角色、备注与卡片样式；公开页优先读取后台配置，静态内容仅作为兜底。

当工作区中有里程碑数据时，主页自动展示「球队最新动态」区块；当有比赛数据时，展示「近期比赛」区块。数据通过 `src/lib/public-site-data.ts` 安全读取，仅暴露汇总信息，不包含球员个人数据。

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

主题仍通过 `<html data-theme="...">` 属性生效，配合 `transition: background 0.3s, color 0.3s` 保留平滑过渡能力。当前生产 UI 没有用户可见的 `ThemeToggle` 入口，默认使用 classic 主题；如未来重新引入入口或在测试中设置 `data-theme`，三套 token 仍可正常切换。

## 字体

| 用途 | 字体 | 来源 |
|---|---|---|
| 正文 / UI / 标题 | Inter | 项目内置本地字体（`src/fonts/`，`next/font/local`） |
| 中文 | Noto Sans SC Variable | Fontsource variable Unicode-range 分片，自托管并按页面字符加载 |
| 后备 | ui-monospace / 系统 sans | 本地字体不可用时的回退 |

Inter 在全局 layout 中通过 `next/font/local` 注入并暴露 `--font-ui`。Noto Sans SC Variable 通过 Fontsource 的 Unicode-range CSS 注入，`--font-body-sc` 指向该字体族；`--font-display` 作为 UI 字体别名供标题样式复用。

## 配色原则

- **绿色系**（`--theme-accent`）为主操作色：确认、提交、主要按钮
- **暖橙**（`--theme-warm`）为警告色：伤停状态、删除确认
- **冷蓝**（`--theme-cool`）为信息色：链接、次要操作
- **金色**（`--theme-gold`）为标记色：特殊标记、评级高亮
- **红色**（`--theme-danger`）为危险操作色：不可逆删除

## 首页壳层设计

控制台首页 `/panel` 通过 `src/components/app-shell.tsx` 提供统一壳层，视觉角色是：

- **Command Sidebar**：首页使用深绿侧栏承载一级导航；窄屏回落为顶部导航条
- **Command Masthead**：比赛日指挥台题头、同步状态、当前方案与帮助动作
- **HomeOverview**：以球场守备阵型为主视觉，右侧并列阵容警报与 1–9 棒打序，底部承载出勤指标、快捷动作与自动排阵
- **RosterOverview**：名册工作台页面，包含筛选、统计、球员卡片列表、批量动作条、抽屉档案入口与完整档案页跳转

壳层样式放在 `src/components/app-shell.module.css`，总控区样式放在 `src/components/home-overview.module.css`。首页已不再依赖 legacy DOM 模板或 legacy frame，页面字体与布局完全由 React 壳层控制。

首页赛事指挥台保留一份视觉参考。生产球场底图使用版本化 WebP，队徽同样使用版本化 near-lossless WebP；两者通过长期 immutable 缓存发布。球员节点和动作控件必须保持为真实 HTML 控件，不能烘焙进底图。

## 解锁页特殊设计

解锁页（`/panel/login` 页面）不跟随主题切换。它使用独立的渐变色背景和入口卡片样式（`.unlock-shell`、`.unlock-card`），始终以暖绿 / 奶油色调呈现，与首页壳层保持同一品牌语言，但不依赖已解锁后的主题状态。

## 交互设计

- **过渡动画**：全局背景/前景色保留 0.3s CSS transition；悬停态用 `:hover` 伪类
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
