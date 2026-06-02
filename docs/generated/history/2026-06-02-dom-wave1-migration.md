# 会话记录 — 2026-06-02

## 主题

DOM 管理器 Wave 1 迁移 + CI 流水线引入

## 触发

用户要求分析项目问题和改进方向 → 发现 8 项技术债务 → 决定聚焦 DOM 拆分（TD-01、TD-06）和 CI 引入。

## 完成内容

### CI 流水线

- 新建 `.github/workflows/ci.yml`
- 触发器：push（全分支）+ pull_request（main）
- 步骤：`npm ci → lint → test → build`
- 超时：10 分钟，Node 22

### Wave 1 迁移：4 个 UI 区域从 DOM 管理器迁入 React

| 组件 | 文件 | 说明 |
|---|---|---|
| **Toast** | `src/components/toast.tsx` | Portal 渲染，通过 `ToastHandle` ref 暴露 `showToast()` 给 DOM 管理器 |
| **主题切换** | `src/components/theme-toggle.tsx` | 自包含：localStorage 持久化，classic/night/field 循环 |
| **帮助抽屉** | `src/components/help-drawer.tsx` | 焦点陷阱 + Escape 关闭，通过 `HelpDrawerHandle` ref 暴露 open/close |
| **引导浮层** | `src/components/guide-overlay.tsx` | 步骤导航 + 目标元素高亮，通过 `GuideHandle` ref 暴露 open/close |

### 桥接层

- 新建 `src/lib/manager-callbacks.ts`：定义 `ManagerCallbacks` 类型（三个 ref）
- 升级 `PlayerManagerClient`：从薄桥接层升级为状态协调者，管理 4 个组件的 open/close 状态，通过 `ToastProvider` 包裹

### DOM 管理器清理

- 从 1742 行缩减至 **1515 行**（-227 行，-13%）
- 移除函数：`initTheme`, `cycleTheme`, `showToast`, `setHelpOpen`, `renderHelpDrawer`, `openGuide`, `dismissGuide`, `nextGuideStep`, `previousGuideStep`, `renderGuide`, `trapFocusWithin`, `getFocusableElements`
- 移除状态变量：`toastTimer`, `helpOpen`, `guideStep`, `helpRestoreFocusTo`
- 移除 Elements 类型中的 13 个已迁移字段、queryElements 中的对应查询、bindEvents 中的对应绑定
- 所有 `showToast()` 调用改为 `callbacks.toast.current?.showToast()`
- 帮助按钮改为 `callbacks.helpDrawer.current?.open()`

### 文档

- 新建 ADR-001：DOM 迁移策略和 CI 设计（已采纳）
- 新建执行计划（已移至 `docs/exec-plans/completed/`）
- 更新：QUALITY_SCORE.md（4 项评分提升）、tech-debt-tracker.md（TD-01/TD-06 进度）、FRONTEND.md（组件列表 + DOM 管理器行数）

## 验证结果

- **ESLint**: 0 errors, 0 warnings
- **Test**: 9/9 pass
- **Build**: compiled successfully

## 设计决策

- **回调 ref 模式**：DOM 管理器通过 `MutableRefObject` 调用 React 组件方法，避免 React state 驱动 DOM 管理器导致重挂载
- **Portal 渲染**：Toast/HelpDrawer/GuideOverlay 通过 `createPortal` 渲染到 `document.body`，利用遗留模板的全局 CSS
- **自包含优先**：Wave 1 选的是耦合度最低的 4 个 UI 区域，不需要 workspace 状态

## 待完成

- Wave 2：警告面板、状态数据栏、统计栏（只读组件）
- Wave 3：导入导出对话框、球员编辑对话框、方案管理对话框
- Wave 4：球员列表、守位球场、棒次编辑（核心交互面板）
- 完全消除 `player-manager-dom.ts` 后清理 `legacy-template.ts` 和 `index.html`

## 关键文件变更

```
新增:
  .github/workflows/ci.yml
  src/components/toast.tsx
  src/components/theme-toggle.tsx
  src/components/help-drawer.tsx
  src/components/guide-overlay.tsx
  src/lib/manager-callbacks.ts
  docs/design-docs/adr-001-dom-migration-and-ci.md
  docs/exec-plans/completed/20260602-dom-migration-and-ci.md

修改:
  src/components/player-manager-client.tsx (44→74 行)
  src/lib/player-manager-dom.ts (1742→1515 行)
  docs/design-docs/index.md
  docs/QUALITY_SCORE.md
  docs/exec-plans/tech-debt-tracker.md
  docs/FRONTEND.md
```
