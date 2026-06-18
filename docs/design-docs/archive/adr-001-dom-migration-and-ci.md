# ADR-001: DOM 管理器逐步迁移与 CI 引入

状态：已采纳

## 背景

该 ADR 制定时，`player-manager-dom.ts` 约 1742 行，是项目最大的技术债务。当前文件已降到 1525 行，但主力交互 UI 仍大部分集中在这个单文件里通过直接 DOM 操作实现。当时项目也没有 CI 流水线，所有验证依赖手动运行。

需要做出两个决策：
1. DOM 管理器的迁移顺序和状态管理策略
2. CI 流水线的结构和触发条件

## 决策

### DOM 迁移：自包含组件优先、状态上提

迁移顺序按耦合度从低到高分四波：

| 波次 | 面板 | 特点 | 依赖 |
|---|---|---|---|
| Wave 1 | 主题切换、Toast、帮助抽屉、引导浮层 | 纯 UI，几乎无 workspace 依赖 | GUIDE_STEPS 常量 |
| Wave 2 | 警告面板、状态数据栏、统计栏 | 只读，接收 workspace 数据 | workspace 对象（props） |
| Wave 3 | 导入导出、球员编辑对话框、方案管理对话框 | 对话框式交互，可独立打开 | workspace 读写回调 |
| Wave 4 | 球员列表、守位球场、棒次编辑 | 核心交互面板，拖拽复杂 | 全部 workspace + 选择状态 |

**状态管理策略**：DOM 管理器通过 `ManagerCallbacks` 接口（三个 MutableRefObject）调用 React 组件方法。Toast、HelpDrawer、GuideOverlay 各暴露一个 Handle 类型（`{ showToast }` / `{ open, close }`），DOM 管理器通过 `callbacks.toast.current?.showToast()` 等调用。此模式避免 React state 驱动 DOM 管理器导致重挂载。

**理由**：
- 自包含组件迁移风险最低，可以先练手
- 每个 wave 独立可发布，不阻塞业务
- 状态上提避免 React 和 DOM 管理器各自维护一份 workspace 副本

### CI：GitHub Actions 基础流水线

```yaml
触发器: push (所有分支) + pull_request (main)
矩阵: Node 22, 24
步骤: install → lint → test → build
超时: 10 分钟
```

**理由**：
- 用有限矩阵覆盖当前仓库实际支持的两个 Node 版本
- 暂不部署（部署方案未定，CI 聚焦代码质量门禁）
- 构建阶段保留为标准 `next build`，不再依赖旧的 `--webpack` 兼容参数

## 备选方案

### 方案 A：大爆炸重写（一次全换 React）

- 优点：一次性干净，没有过渡期
- 缺点：工期长（5-7 天），期间功能不可用，风险高
- 结论：不选。违反核心信念"逐步迁移 > 大爆炸重写"

### 方案 B：用 Web Component 替代 DOM 操作

- 优点：不需要引入状态管理，组件自带 shadow DOM
- 缺点：项目不使用 Web Component 生态，引入新技术栈增加复杂度
- 结论：不选。项目已有 React 基础（4 个组件），多一套技术栈是负担

### 方案 C：保持 DOM 管理器不动，只做 CI

- 优点：无风险
- 缺点：不解决核心问题，新功能继续堆在 DOM 管理器里
- 结论：不选。DOM 管理器已经在阻碍可维护性

## 后果

**正面**：
- 每次迁移让 DOM 管理器缩小一块，可维护性递增
- CI 提供自动化质量门禁，减少手动验证
- 状态上提后，React DevTools 可以检查 workspace 状态

**负面**：
- 过渡期内 `PlayerManagerClient` 同时管理 React 组件和 DOM 管理器，复杂度暂时增加
- DOM 管理器中的 `render()` 函数需要在每次迁移后调整，确保不再渲染已迁移区域

## 验证

- 每个 wave 完成后，完整走一遍用户流程（解锁 → 查看球员 → 编辑阵容 → 导出），确保功能无回归
- CI 流水线首次运行成功（lint + test + build 全部通过）
- 迁移面板前后的 DOM 节点结构通过 snapshot 对比保持一致（CSS class、内联样式不变）
