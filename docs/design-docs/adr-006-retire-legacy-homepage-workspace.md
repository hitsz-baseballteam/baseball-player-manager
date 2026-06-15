# ADR-006: 退役首页 legacy workspace，首页收敛为纯 React 总控台

状态：已采纳

注：本文记录的是 2026-06-05 当时的决策语境。后续在 2026-06-13，`/lineup` 已并入 `/panel/scenarios`，导入导出已收敛到 `/panel/settings`；阅读下文路由示例时请以此现状为准。

## 背景

到 2026-06-05 为止，`/roster`、`/lineup`、`/scenarios`、`/import-export`、`/settings` 和 `/players/[playerId]` 都已经迁移到独立 React 页面，但首页 `/` 仍保留一条 legacy 运行时链：

- `src/app/page.tsx` 调用 `getLegacyTemplate()` 读取 `index.html`
- `src/components/player-manager-client.tsx` 调用 `mountPlayerManager()`
- 首页动作通过 `legacy-bridge.ts` 使用 selector 触发 `player-manager-dom.ts`

这意味着首页仍然依赖 `index.html`、`legacy-template.ts`、`legacy-bridge.ts`、`player-manager-dom.ts` 与 `dom-*` 模块。该链条已成为当前主要剩余的前端技术债。

需要做出两个决策：
1. 首页在移除 legacy workspace 后的产品形态
2. 是否继续保留 `index.html` 提取 + DOM bridge 的运行时模式

## 决策

### 决策 1：首页收敛为纯 React 总控台，不再内嵌深度编辑工作台

首页保留：
- 比赛日提醒
- 快捷动作
- 指标概览
- 当前方案摘要
- 守位 / 棒次概览

首页不再保留：
- 内嵌 legacy workspace frame
- 通过 selector 聚焦旧面板的交互方式

深度编辑统一进入独立页面完成：
- 名册 → `/roster`
- 排阵 → `/lineup`
- 场景管理 → `/scenarios`
- 导入导出 → `/import-export`
- 设置与帮助 → `/settings`

### 决策 2：首页高频直接动作改为 React 直接执行或显式导航

保留为首页直接动作：
- 自动排阵
- 新建方案
- 复制方案
- 清空当前阵容
- 导出工作区
- 导出当前方案
- 切换当前方案

改为显式导航：
- 新增球员 → `/roster`
- 导入数据 → `/import-export`
- 重命名方案 → `/scenarios`
- 守位 / 棒次 / 提醒 / 场景 / 名册定位动作 → 对应独立页面

### 决策 3：移除 legacy homepage runtime chain

首页不再依赖以下运行时资产：
- `index.html`
- `legacy-template.ts`
- `legacy-bridge.ts`
- `player-manager-dom.ts`
- `dom-renderers.ts`
- `dom-dialogs.ts`
- `dom-io.ts`
- `dom-scenario-ops.ts`

## 理由

1. 主页继续保留一套 legacy 工作台，会和已经存在的独立 React 页面形成双轨产品，增加学习成本和维护成本。
2. 当前高频编辑场景已经有专页承载，legacy homepage frame 主要剩下历史包袱，而不是不可替代的产品能力。
3. 删除 `index.html` 提取链与 selector bridge 后，首页测试、构建、状态流和文档都会更简单。
4. 真正关闭 `TD-08` 的前提不是“文档改口”，而是运行时不再依赖 legacy DOM。

## 备选方案

### 方案 A：首页继续保留内嵌工作台，但改写为 React 版

- 优点：保留首页一站式编辑体验
- 缺点：会和现有 `/roster` `/lineup` `/scenarios` 页面形成重复产品面，需要重新设计首页与专页的边界
- 结论：不选。当前项目更需要先完成 legacy runtime 清退，而不是再造一套首页工作台

### 方案 B：继续保留 legacy workspace，仅在文档中弱化其重要性

- 优点：短期改动最小
- 缺点：技术债并未减少，只是文档措辞变化；运行时依赖仍然存在
- 结论：不选。不能把仍在生产路径上的代码标记为“已解决”

### 方案 C：一次性重做整个首页信息架构与所有子组件

- 优点：可以同步完成一次视觉与交互重构
- 缺点：范围过大，会把“移除 legacy 运行时”与“重新设计首页产品”绑定在一起，风险增大
- 结论：不选。先完成 runtime retirement，再单独做体验增强

## 后果

**正面**：
- 首页完全脱离 legacy DOM 运行时链
- 删除 `index.html` 和一组 `dom-*` 模块后，前端边界更清晰
- 首页行为变成“总控台 + 明确入口”，与现有路由结构一致
- `TD-08` 可以真实关闭

**负面**：
- 首页不再提供内嵌深度编辑区，用户需要进入专页完成复杂操作
- 需要重写首页测试，并更新架构/前端文档
- 若未来需要首页内嵌编辑能力，应作为新的 React 功能重新设计，而不是恢复旧逻辑

## 验证

- 首页运行路径不再引用 `getLegacyTemplate()`、`mountPlayerManager()`、`legacy-bridge.ts`
- `player-manager-dom.ts` 与 `dom-*` 模块从运行时 import graph 中移除
- `npm test`、`npm run lint`、`npm run build` 通过
- `TD-08` 从活跃债务转为已解决债务
