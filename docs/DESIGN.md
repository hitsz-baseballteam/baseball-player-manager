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

### 球员档案变量映射

`globals.css` 额外定义 `--profile-*` 变量，将主题变量映射到球员档案编辑器的命名空间，避免组件硬编码主题变量名。

### 主题切换

主题通过 `<html data-theme="...">` 属性切换，配合 `transition: background 0.3s, color 0.3s` 实现平滑过渡。当前由 `ThemeToggle` 组件负责切换 `document.documentElement.dataset.theme`，并将选择持久化到 `localStorage`。

## 字体

| 用途 | 字体 | 来源 |
|---|---|---|
| 正文 / UI | Geist Sans | `next/font/google` |
| 数字 / 标题 | Bebas Neue | `next/font/google` |
| 中文 | Noto Sans SC | `next/font/google` |
| 后备 | "Avenir Next", "PingFang SC", sans-serif | 系统字体 |

字体设置在 `src/app/layout.tsx` 中，通过 CSS 变量暴露了 `--font-geist-sans`、`--font-geist-mono`、`--font-display` 和 `--font-body-sc`。

## 配色原则

- **绿色系**（`--theme-accent`）为主操作色：确认、提交、主要按钮
- **暖橙**（`--theme-warm`）为警告色：伤停状态、删除确认
- **冷蓝**（`--theme-cool`）为信息色：链接、次要操作
- **金色**（`--theme-gold`）为标记色：特殊标记、评级高亮
- **红色**（`--theme-danger`）为危险操作色：不可逆删除

## 解锁页特殊设计

解锁页（`UnlockForm` 组件）不跟随主题切换。它使用独立的渐变色背景和卡片样式（`.unlock-shell`、`.unlock-card`），始终以暖绿 / 奶油色调呈现，与 Classic 主题基调一致。

## 交互设计

- **过渡动画**：主题切换使用 0.3s CSS transition；悬停态用 `:hover` 伪类
- **焦点可见**：输入框聚焦时显示 4px 绿色光晕（`box-shadow`），确保可访问性
- **禁用态**：按钮 `:disabled` 降低不透明度至 0.6 + 禁用光标
- **响应式**：解锁卡片 `width: min(460px, 100%)` 适配移动端；档案编辑器支持 drawer（侧边抽屉）和 page（独立页面）两种展示模式

## 设计资产

- **Favicon**：`src/app/favicon.ico`（26KB）
- **图标**：旧版 UI 使用 emoji / Unicode 字符（⚾ 等），新版 React 组件使用内联 SVG（如雷达图）

## 设计约束

- 不要引入 CSS 框架（Bootstrap、Tailwind 等）——所有样式通过 CSS 自定义属性 + CSS Modules 实现
- 主题变量是唯一配色入口：不要在组件中硬编码颜色值，始终使用 `var(--theme-*)`
- 新旧 UI 共存期间，确保旧 DOM 元素的 className 不与新 React CSS Modules 冲突
