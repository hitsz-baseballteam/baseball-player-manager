# 20260604 Phase 2 计划：首页总览设计

## 目标
在 Phase 1 已完成统一壳层的基础上，把首页从“带新壳的 legacy 工作台入口”升级为真正的**比赛日总控台**：用户进入首页后，先看到风险、可用性、快捷动作和当前方案状态，再进入下方 legacy 操作区。

## 已确认决策
- **首屏信息重心**：采用 **“总控台优先”**。
  - 用户已明确选择：首页首屏先突出风险提醒、人数状态、快捷动作和关键摘要；阵容图放到下一屏或次级区块。
- **快捷动作触发方式**：采用 **“直接桥接为主”**。
  - 首页 Command Strip 里的高频动作优先直接触发 legacy 现有能力，而不是只做滚动定位。
- **方案切换首波形态**：采用 **轻量 React 方案切换器**。
  - 首页直接切换当前方案；复杂方案管理（重命名 / 复制 / 删除）仍留在 legacy 工作台。
- **最近变更模块首版处理**：采用 **降级实现**。
  - 首版展示“当前方案最近更新时间 + 工作区状态说明”，不伪造活动流或编辑时间线。
- **总体视觉方向**：继续沿用总蓝图中的 **Team Ops Editorial / 球队作战指挥台**。
- **技术边界**：不新增后端接口；优先基于当前 `workspace` 数据和已有纯函数派生视图。

## 当前仓库事实（作为设计约束）
- 首页当前由 `src/components/player-manager-client.tsx` 渲染 `AppShell`，其下仍挂载 legacy manager。
- 现有首页只提供 3 个轻量摘要卡，还没有真正的总控台分区。
- 当前可直接复用的数据来源：
  - `getActiveScenario(workspace)`：当前方案
  - `analyzeScenarioWarnings(workspace, scenario)`：强提醒 / 建议提醒
  - `workspace.players`：总人数、可上场人数、轮休 / 伤停人数、守位覆盖情况
  - `scenario.assignments.defense / lineup`：守位与棒次完成度
  - `scenario.updatedAt`：方案更新时间
- **数据缺口**：仓库当前没有“球员编辑历史”或独立审计日志，因此“最近变更”首版不能假装有真实时间线；Phase 2 首波应降级为“当前方案最近更新时间 + 工作区状态说明”，或明确延期。
- legacy 工作台当前已经有真实操作能力（新增球员、导入导出、自动排阵、方案切换等），但它们仍主要藏在 legacy UI 内。

## 页面定位
首页不是“全部功能缩略图”，而是**比赛日前的判断面板**。

用户进入首页后，应该在 3 秒内知道：
1. 今天能不能排出一套完整阵容
2. 当前方案最危险的问题是什么
3. 下一步最该点哪个动作
4. 目前使用的是哪套方案

## 页面设计方向

### 页面概念名
**Dugout Command Desk / 休息区总控桌**

### 记忆点
首屏不是普通 dashboard 卡片墙，而是一个带有“赛前判断感”的总控桌：
- 上方是总状态与当前方案身份
- 中间是强提醒和下一步动作
- 下方才进入阵容概览与 legacy 操作区

### 视觉气质
- editorial：像年鉴目录页与战术页的混合体
- athletic：带球场标线、编号、记号笔批注感
- restrained：不走电竞 HUD，也不做花哨渐变 SaaS
- tactical：让“危险 / 可用 / 下一步”三个层级一眼可分

## 页面结构（Phase 2 目标态）

### 0. 保留层：Global Header
继续复用 Phase 1 的 `AppShell` header，不在 Phase 2 重做导航系统。

### 1. Hero Masthead 升级为“战备概览”
目的：把当前静态题头升级为带判断信息的首页题头。

建议内容：
- 左侧：
  - eyebrow：比赛日总控台 / 当前方案模式
  - 主标题：当前方案名
  - 副标题：一句自然语言状态总结，例如“还差 2 个守位才能形成完整首发”
- 右侧状态卡：
  - 工作区版本
  - 最近方案更新时间（来自 `scenario.updatedAt`）
  - 当前主题 / 共享模式说明（二选一，避免信息过密）

### 2. Alert Deck（首页第一优先级）
目的：把 `analyzeScenarioWarnings()` 的结果上提到首页首屏最醒目的区域。

建议拆成两层：
- **Critical Alerts**：强提醒，红土锈红 / 深色边框 / 大字一句话
- **Advisory Notes**：建议提醒，弱对比、较轻体量

交互策略：
- 强提醒最多首屏显示 2~3 条，避免整页变成错误墙
- 提供“查看全部提醒 / 跳转到下方工作台”入口
- 若无强提醒，显示“阵容可用”的正向状态块，而不是留空

### 3. Command Strip（首页第二优先级）
目的：把高频动作从 legacy 工具区前移出来。

第一波建议动作：
- 自动排阵
- 新增球员
- 导入数据
- 切换方案

已确认实现方向：
- 优先复用现有 legacy 能力
- React 首页按钮以**直接桥接**为主，避免用户点了首页动作却还要自己去工作台里找入口
- 仅在某个动作桥接成本明显超出当前切片边界时，才退回“滚动定位 + 高亮 legacy 区域”的兜底方案

### 4. Key Metrics Grid（首页第三优先级）
目的：给出“今天能否开打”的基础计量，不做通用 BI 仪表盘。

建议 4 块：
- 可上场人数
- 伤停 / 轮休人数
- 守位完成度
- 棒次完成度

设计要求：
- 不重复 Phase 1 现有文案，而是升级为可判断的指标
- 每张卡底部带一句行动导向说明，例如“还缺 SS、RF”或“9 棒已满，可直接检查风险”

### 5. Scenario Snapshot（次级区块）
目的：告诉用户“当前正在看哪套方案”，并快速切换上下文。

建议内容：
- 当前方案名
- 方案备注 `scenario.note`
- 最近更新时间 `scenario.updatedAt`
- 方案总数
- **轻量 React 方案切换器**（只负责切换当前方案）
- 指向 legacy 工作台完整方案管理区的明确入口

### 6. Lineup Pulse（次级区块，非首屏主角）
目的：在不重写完整排阵板的前提下，提供一个“快速看一眼”的阵容概览。

首波建议：
- 左侧：守位完成度 mini board（9 宫格 / 守位清单）
- 右侧：棒次完成度 / 前三棒概览 / 缺口位摘要

约束：
- 不直接复制 legacy 球场 UI
- 只做“概览”，不承诺在这里完成全部编辑

### 7. Legacy Workspace Frame（保留并下沉）
目的：保留完整工作能力，但把它变成“深入编辑区”，不是首页第一视觉锚点。

调整方向：
- 标题改成“深入编辑 / 完整工作台”而不是默认主舞台
- 在进入 frame 前先经过首页总控区块
- 保留现有 legacy 功能和 DOM 挂载方式

## 组件拆分建议

### 新增/改造组件（优先）
- `HomeOverviewHero`（可直接并入 `PlayerManagerClient` 首轮实现）
- `AlertDeck`
- `CommandStrip`
- `MetricGrid`
- `ScenarioSnapshot`
- `LineupPulse`

### 可复用
- `AppShell`
- `ThemeToggle`
- `HelpDrawer`
- `GuideOverlay`

### 暂不拆
- legacy manager 内部具体交互
- 完整守位球场 / 棒次拖拽

## 数据映射计划

### 直接可得
- 总球员数：`workspace.players.length`
- 可上场人数：`players.filter(status === "available")`
- 轮休 / 伤停人数：按 `status`
- 当前方案：`getActiveScenario(workspace)`
- 提醒：`analyzeScenarioWarnings(workspace, scenario)`
- 守位完成度：`Object.values(scenario.assignments.defense)`
- 棒次完成度：`scenario.assignments.lineup`
- 方案更新时间：`scenario.updatedAt`

### 需要谨慎表达
- 最近变更：当前只有 `scenario.updatedAt`，没有真正的活动流
- 守位缺口明细：可以从空缺守位推导，但文案要避免伪精确

### 本阶段明确不做
- 新增事件流 / 审计日志表
- 为首页单独创建 API route
- 复制一套独立排阵业务逻辑

## 视觉与版式规则
- 首屏信息顺序：**判断 > 动作 > 概览 > 深入编辑**
- 强提醒必须比任何统计卡更抢眼
- Command Strip 不做普通按钮排排站，应该更像“比赛日前指令条”
- Metrics 要有统一骨架，但允许 1 张主卡打破栅格，形成视觉记忆点
- 继续复用 shell token，不重新发明第二套主题变量
- 字体短期沿用项目本地字体；若标题性格仍不足，另开 typography spike，不混入本阶段

## 进度
- [x] 2026-06-04 — 完成 Phase 2 页面设计、首屏信息重心与三项产品取舍确认
- [x] 2026-06-04 — 新增 `HomeOverview` 与 `home-overview.module.css`，落地 Alert Deck / Command Strip / Key Metrics / Scenario Snapshot / Lineup Pulse
- [x] 2026-06-04 — `PlayerManagerClient` 接入首页总控区，并将 legacy frame 下沉为“深入编辑工作台”
- [x] 2026-06-04 — 通过 `ManagerCallbacks.onStateChange` 将 legacy manager 的最新 workspace / version / saveStatus 回推到 React 总控区
- [x] 2026-06-04 — 补充首页桥接行为测试与 legacy manager snapshot 测试

## 实施切片建议

### Slice 2A — 页面设计落地
- 明确首页 section 顺序、组件边界、数据映射和文案语气
- 产出本计划，并在总蓝图里挂引用

### Slice 2B — React 总控区首版实现
- 在 `PlayerManagerClient` 中把静态题头升级为总控区块
- 新增提醒、动作、指标、方案摘要组件
- legacy frame 下沉到首屏后方

### Slice 2C — 阵容概览增强
- 补上 `LineupPulse`
- 优化首页与 legacy 工作台的跳转 / 定位关系

### Slice 2D — 深度桥接与交互细化（已完成）
- 执行计划：`docs/exec-plans/completed/20260604-phase2-deep-bridge-and-interaction-polish.md`
- 已建立结构化 bridge 层（动作触发 + 面板定位 + 高亮反馈）
- 已扩展首页动作：导出、方案辅助动作、提醒/指标/阵容概览的精确跳转
- 已补齐桥接与面板高亮测试

## 验证
- [x] 页面首屏明确以总控台为主，而不是 legacy 工作台为主
- [x] 无强提醒时首页仍有完整的正向状态表达（代码路径已覆盖）
- [x] 不新增后端接口
- [x] `npm test`
- [x] `npm run lint`（保留既有 warning，无新增 error）
- [x] `npm run build`
- [x] 页面核验：本地 `curl` 解锁后可命中 `比赛日总控台` / `Alert Deck` / `Command Strip` / `Lineup Pulse` / `深入编辑工作台`

## 残留风险（非 blocker）
1. **视觉人工验收仍偏轻量**：当前已有命令验证与页面命中验证，但还没有浏览器截图级的自动视觉断言。
2. **轻量方案切换器边界**：仍只负责切换当前方案，不扩展为完整方案 CRUD 面板。
3. **最近变更区块的文案纪律**：继续只表达“最近更新时间 / 当前状态说明”，不伪造活动流。

> Phase 2 首页总览重做已完成，可进入 Phase 3。
