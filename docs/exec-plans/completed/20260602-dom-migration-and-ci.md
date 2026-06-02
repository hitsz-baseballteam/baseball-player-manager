# DOM 管理器迁移与 CI 引入

引用：[ADR-001](../design-docs/adr-001-dom-migration-and-ci.md)

## 目标

为项目引入 CI 自动验证，并开始拆分 1742 行的旧 DOM 管理器为 React 组件。

## 范围

### 做
- 创建 GitHub Actions CI 流水线（lint + test + build）
- Wave 1 迁移：主题切换、Toast、帮助抽屉、引导浮层 → React 组件
- 将 workspace 状态从 DOM 管理器闭包提升到 `PlayerManagerClient`
- DOM 管理器 `render()` 停止渲染已迁移区域

### 不做
- 不迁移 Wave 2~4（警告面板、球员列表、守位球场、棒次、方案管理）——后续计划
- 不解决 TD-02（组件测试）、TD-03（API 集成测试）、TD-04（重试逻辑）、TD-05（速率限制）、TD-07（CSS 命名空间）、TD-08（Turbopack）
- 不引入新的依赖库（React Testing Library 等留到 TD-02 时引入）

## 步骤

### 阶段 1：CI 流水线

1. 创建 `.github/workflows/ci.yml`
   - 触发器：`push`（所有分支）+ `pull_request`（main）
   - Job：ubuntu-latest, Node 20
   - 步骤：checkout → install → lint → test → build
   - 超时：10 分钟
   - 缓存 `node_modules` 加速后续运行

2. 推送到 GitHub 触发首次 CI 运行，确认全部通过

### 阶段 2：状态上提到 PlayerManagerClient

3. 将 `PlayerManagerClient` 从薄桥接层升级为状态持有者
   - 添加 `useState` 管理 workspace、version、saveStatus
   - 实现 `saveWorkspace` 回调（含 409 冲突处理）
   - 将状态通过 props 传给 DOM 管理器
   - DOM 管理器从 props 读取 workspace 而非内部闭包

4. 调整 `mountPlayerManager` 签名，接收状态读写回调而非自行 fetch
   - 移除 DOM 管理器内的 `loadWorkspaceSnapshot` / `saveWorkspaceSnapshot` 调用
   - 改为通过回调向上通知状态变更

5. 验证：页面正常加载、球员数据可见、方案切换正常、保存写入正常

### 阶段 3：Wave 1 迁移——自包含 UI 组件

每个组件独立拆分，完成一个验证一个：

6. **Toast 组件**（`src/components/toast.tsx`）
   - 创建 ToastContext + ToastProvider，提供 `showToast(message)` 方法
   - 实现 toast 消息渲染（底部居中、2s 自动消失）
   - DOM 管理器中的 `showToast` 改为调用 context 方法

7. **帮助抽屉组件**（`src/components/help-drawer.tsx`）
   - 接收 `isOpen` + `onClose` props
   - 渲染帮助内容（操作流程、导入导出说明、快捷键列表）
   - 可访问性：焦点陷阱、Escape 关闭

8. **引导浮层组件**（`src/components/guide-overlay.tsx`）
   - 接收 `steps` + `onDismiss` props
   - 逐步引导 UI（前后步进、跳过按钮）
   - 高亮目标元素（通过 `target` ID 定位 DOM 节点）
   - 完成/跳过时回调通知 workspace 更新 `preferences.helpDismissed`

9. **主题切换按钮**（`src/components/theme-toggle.tsx`）
   - 读取 document data-theme 属性，显示当前主题
   - 点击在 classic / night / field 间循环
   - 持久化到 localStorage

10. 迁移后 DOM 管理器清理
    - 移除 `showToast`、`renderHelpDrawer`、`renderGuide`、`initTheme`/`cycleTheme` 及相关事件绑定
    - 确保 `render()` 不再创建这些区域的 DOM

11. ~~更新 `index.html` 模板：移除被迁移区域的 HTML 占位（由 React 组件渲染替代）~~ → 跳过：旧 HTML 保留为 inert，React 组件通过 portal 渲染自己的 DOM

### 阶段 4：收尾

12. 更新 `docs/QUALITY_SCORE.md`
    - UI (Legacy DOM) 评分从 C → C+（反映 Wave 1 迁移完成、代码量减少）
    - UI (React) 评分从 B → B+（新增 4 个组件）

13. 更新 `docs/exec-plans/tech-debt-tracker.md`
    - TD-01、TD-06 状态更新（部分完成，标注剩余工作量）

14. 更新 `docs/FRONTEND.md`
    - 新增组件列表和架构说明
    - 更新 DOM 管理器行数（迁移后预计减少 200~300 行）

## 验证

- [x] CI 流水线已创建（`.github/workflows/ci.yml`），首次 push 将触发运行
- [x] `npm test` — 9 tests passing
- [x] `npm run lint` — 0 errors
- [x] `npm run build` — exit 0
- [ ] 手动验证：解锁 → 主页加载 → 球员名册可见 → 方案切换正常（待浏览器实测）
- [x] Toast / 帮助抽屉 / 引导浮层 / 主题切换：4 个组件均有单元测试覆盖（22 tests，后补于第二批）

## 进度

- [x] 2026-06-02 — ADR 文档完成
- [x] 2026-06-02 — 执行计划完成
- [x] 2026-06-02 — 阶段 1：CI 流水线（`.github/workflows/ci.yml`）
- [x] 2026-06-02 — 阶段 2：状态上提（回调 ref 模式，PlayerManagerClient 升级）
- [x] 2026-06-02 — 阶段 3：Wave 1 迁移
  - [x] Toast 组件（Portal → document.body）
  - [x] 帮助抽屉组件（焦点陷阱 + Escape 关闭）
  - [x] 引导浮层组件（步骤导航 + 元素高亮）
  - [x] 主题切换组件（localStorage 持久化）
  - [x] DOM 管理器清理（-217 行，移除所有迁移区域的代码）
- [x] 阶段 4：收尾（QUALITY_SCORE / tech-debt / FRONTEND 已在后续批次更新）
