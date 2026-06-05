# 20260605 Legacy Homepage Retirement

## 完成状态

- 状态：已完成
- 完成日期：2026-06-05
- 结果：首页已收敛为纯 React command desk，legacy homepage runtime chain 已从运行路径删除，`TD-08` 已转入已解决债务

## 结论 / 为什么这仍是技术债

> 以下内容是立项时的背景记录，保留用于说明为什么当时需要此计划。

`TD-08` 目前 **仍然成立**，不应直接标记为“已解决”。

基于仓库现状的证据：

- `src/app/page.tsx` 仍调用 `getLegacyTemplate()`，运行时读取 `index.html`
- `src/components/player-manager-client.tsx` 仍调用 `mountPlayerManager()` 挂载 legacy manager
- 首页快捷动作和聚焦逻辑仍依赖 `legacy-bridge.ts` 与 CSS selector（如 `#autoAssignBtn`、`#scenarioPanel`）
- `src/lib/player-manager-dom.ts` 仍在首页真实运行路径上，而不是仅作为未引用旧文件存在

因此，当前状态不是“文档里还有旧描述”，而是**运行时仍存在 legacy DOM 依赖链**：

`page.tsx -> legacy-template.ts -> index.html -> player-manager-client.tsx -> legacy-bridge.ts -> player-manager-dom.ts -> dom-* modules`

只要这条链还在，`TD-08` 就没有被真正消除。

---

## 目标

彻底移除首页对 legacy DOM / `index.html` / `player-manager-dom.ts` 的运行时依赖，使首页成为纯 React 页面，并将 `TD-08` 从“活跃债务”转为“已解决”。

---

## 推荐目标形态

**推荐：把首页收敛为纯“总控台 / command desk”页面，不再内嵌深度编辑工作台。**

理由：

1. `/roster`、`/lineup`、`/scenarios`、`/import-export`、`/settings`、`/players/[playerId]` 已经是独立 React 页面
2. 首页继续保留一个内嵌工作台，会形成“已有独立页 + 首页再复制一套编辑面”的双轨产品
3. 当前 homepage legacy frame 的主要价值已被独立路由覆盖，剩余更多是历史承载层，而不是必要产品能力
4. 这条路线能最彻底地删除 `legacy-template.ts` / `index.html` 提取链 / `legacy-bridge.ts` / `player-manager-dom.ts`

> 若后续仍需要“首页内嵌深度编辑区”，建议单独作为 **新功能** 重新设计 React 版，而不是继续保留 legacy manager。

---

## 范围

### 包含
- 首页去除 legacy frame，仅保留 React 总控台
- 首页动作从“桥接 legacy”改为“React 直接行为”或“显式导航”
- 删除首页对 `index.html` / `legacy-template.ts` / `legacy-bridge.ts` / `player-manager-dom.ts` 的运行时依赖
- 删除已无调用方的 `dom-*` legacy 模块
- 更新测试、架构文档、前端文档、技术债文档、质量评分

### 不包含
- 重新设计一个新的首页内嵌工作台
- 大改 `/roster`、`/lineup`、`/scenarios` 页面信息架构
- 引入新的后端 API

---

## 关键决策

### 决策 1：首页动作语义
首页现有动作分两类：

1. **应改为导航**
   - 打开名册
   - 打开排阵
   - 打开场景
   - 打开数据中心
   - 打开警告 / 工作区（这些在去掉内嵌工作台后应删除或改成导航）

2. **可保留为直接动作**（推荐保留）
   - 自动排阵
   - 新建方案
   - 导出工作区
   - 导出当前方案

推荐做法：
- 导航类动作改用 `next/link` 或 `router.push()`
- 直接动作改用共享纯逻辑（`lineup-actions.ts` / `export-actions.ts`）+ `workspace-client.ts`

### 决策 2：首页“导入”入口
推荐：
- 首页不直接弹导入流程
- 改为跳转 `/import-export`

原因：导入属于低频复杂操作，已经有专属页面。

### 决策 3：首页“清空阵容”
推荐：
- 保留为直接动作，调用共享排阵逻辑
- 若交互复杂度上升，再退回 `/lineup` 页面执行

---

## 分步计划

### Slice 0 — 设计决策落档
在实现前先记录一条设计/架构决策：

建议新增：
- `docs/design-docs/adr-006-retire-legacy-homepage-workspace.md`

记录内容：
- 首页不再内嵌 legacy workspace
- 首页收敛为纯 React command desk
- 深度编辑统一在独立路由完成
- 不再从 `index.html` 提取运行时 UI

---

### Slice 1 — 首页去 bridge 化
目标：先让首页动作不再依赖 legacy selector / focus。

改动方向：
- 修改 `src/components/home-overview.tsx`
- 修改 `src/components/player-manager-client.tsx`（或直接新建 `home-page-client.tsx`）
- 将以下动作从 bridge 改掉：
  - `onImport` -> 跳转 `/import-export`
  - `onOpenScenarioPanel` -> 跳转 `/scenarios`
  - `onOpenRosterPanel` -> 跳转 `/roster`
  - `onOpenFieldPanel` / `onOpenLineupPanel` -> 跳转 `/lineup`
  - `onOpenWarningsPanel` -> 跳转 `/lineup`（带 query/hash 或仅跳转）
- 保留直接动作时，改为调用共享逻辑：
  - `autoAssignActive`
  - `createScenarioAction`
  - `buildWorkspaceExport`
  - `buildScenarioExport`
  - `clearAllAssignments`

完成标准：
- 首页 React 区域不再调用 `legacy-bridge.ts`
- `PlayerManagerClient` 中不再出现 `#scenarioPanel` / `#fieldPanel` / `#lineupPanel` 等 selector

---

### Slice 2 — 首页去 legacy frame
目标：移除首页下半部“深入编辑工作台”。

改动方向：
- `src/components/player-manager-client.tsx`
  - 删除 `mountPlayerManager()`
  - 删除 `preparedMarkup` / `legacyRootRef` / `legacyFrameAnchorRef`
  - 删除 `dangerouslySetInnerHTML` 注入 legacy markup
  - 将组件重命名为更准确的 `HomePageClient`（推荐）
- `src/app/page.tsx`
  - 删除 `getLegacyTemplate()`
  - 不再并行加载 legacy template
- `src/components/app-shell.tsx`
  - 首页不再传 `frameVariant="legacy"` / legacy frame 内容

完成标准：
- 首页不再挂载 legacy DOM
- 首页渲染只依赖 React 组件

---

### Slice 3 — 删除 legacy runtime chain
目标：清掉不再使用的 legacy 运行时资产。

候选删除文件（以调用关系复核为准）：
- `src/lib/legacy-template.ts`
- `src/lib/legacy-bridge.ts`
- `src/lib/player-manager-dom.ts`
- `src/lib/dom-renderers.ts`
- `src/lib/dom-dialogs.ts`
- `src/lib/dom-io.ts`
- `src/lib/dom-scenario-ops.ts`
- `index.html`

同步检查：
- 删除不再需要的测试：
  - `src/lib/player-manager-dom.test.ts`
  - 依赖 legacy mock 的部分首页测试
- 将必要行为迁移到新的首页测试中

完成标准：
- `grep` 不再发现首页运行时依赖 legacy manager/template/bridge
- `src/app/page.tsx` 与 homepage client 不再引用 legacy 模块

---

### Slice 4 — 文档与技术债收口
目标：让文档与代码一致，并正式关闭 TD-08。

需要更新：
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND.md`
- `docs/QUALITY_SCORE.md`
- `docs/exec-plans/tech-debt-tracker.md`
- `docs/design-docs/index.md`

需要执行：
- 将 `TD-08` 从活跃债务移动到已解决债务
- 在 `QUALITY_SCORE.md` 中提升 Legacy DOM / React UI 相关说明
- 记录首页已完全脱离 `index.html` 与 legacy manager

---

## 验证

### 必跑
- [x] `npm test`
- [x] `npm run lint`
- [x] `npm run build`

### 代码级核验
- [x] `grep` 首页运行路径，不再引用：`getLegacyTemplate` / `mountPlayerManager` / `legacy-bridge`
- [x] `grep` 项目中不再存在已删除 legacy 文件的运行时 import

### 页面核验
- [x] `/` 能正常加载并展示总控台
- [x] 首页快捷动作全部可用（导航或直接动作）
- [x] `/roster` `/lineup` `/scenarios` `/import-export` `/settings` 正常打开
- [x] 自动排阵 / 新建方案 / 导出（若保留为首页直接动作）在首页可用

---

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 首页去掉内嵌工作台后，用户觉得“首页功能变少” | 产品感知变化 | 保留清晰 CTA，并把高频直接动作留在首页 |
| 首页快捷动作行为改变 | 用户习惯受影响 | 显式区分“立即执行”与“前往页面” |
| 删除 legacy 链时误删仍被引用模块 | build/test 失败 | Slice 3 前先用 `grep` 复核 import graph |
| 首页测试仍依赖 legacy mock | 测试漂移 | 重写为纯 React homepage contract test |

---

## 建议实施顺序

1. ADR / 设计决策落档
2. 首页动作去 bridge 化
3. 首页去 legacy frame
4. 删除 legacy runtime chain
5. 文档/技术债/质量分收口

---

## Definition of Done

满足以下条件时，才算“DOM 问题彻底解决”：

1. [x] 首页运行时不再依赖 `index.html`
2. [x] 首页运行时不再依赖 `player-manager-dom.ts`
3. [x] 首页运行时不再依赖 `legacy-bridge.ts`
4. [x] legacy DOM 相关模块从运行路径移除，且无残留 import
5. [x] `TD-08` 被移动到“已解决债务”，而不是仅改措辞
6. [x] `npm test` / `npm run lint` / `npm run build` 全通过
