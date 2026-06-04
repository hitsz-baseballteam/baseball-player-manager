# 20260604 Phase 2 计划：深度桥接与交互细化

## 目标
在首页总控区首版已经落地的基础上，继续把 React 首页与 legacy 工作台之间的关系从“几个高频按钮直连”升级为**有结构的桥接层**：让首页不仅能触发更多真实动作，还能把用户准确带到对应的工作台区域，并给出明确的交互反馈。

## 当前事实（基于仓库）
- 首页总控区已经存在：`src/components/home-overview.tsx`
  - 已有 `Alert Deck`
  - 已有 `Command Strip`
  - 已有 `Key Metrics`
  - 已有 `Scenario Snapshot`
  - 已有 `Lineup Pulse`
- 当前桥接主要在 `src/components/player-manager-client.tsx` 中通过 `clickLegacyControl()` 和 `changeLegacyScenario()` 完成。
  - 已桥接：`#autoAssignBtn` / `#addPlayerBtn` / `#importBtn` / `#newScenarioBtn` / `#scenarioSelect`
- legacy 工作台中还存在更多可桥接入口（已在 `player-manager-dom.ts` 的元素查询中出现）：
  - `#renameScenarioBtn`
  - `#duplicateScenarioBtn`
  - `#deleteScenarioBtn`
  - `#exportWorkspaceBtn`
  - `#exportScenarioBtn`
  - `#clearAssignmentsBtn`
  - `#resetBtn`
  - 以及工作台面板 / 区域锚点：`#scenarioPanel` / `#rosterPanel` / `#fieldPanel` / `#lineupPanel` / `#warnings`
- React 首页目前“进入完整工作台”仍是泛化滚动，尚未做到：
  - 针对提醒跳到具体风险区域
  - 针对指标跳到具体工作台面板
  - 针对方案卡跳到完整方案管理区
  - 统一的高亮 / 定位 / 反馈机制

## 为什么需要这个 slice
如果只做几个首页按钮直连，首页仍然像“带快捷方式的封面页”。

深度桥接的目标是让首页成为真正的总控台：
1. 首页做出判断
2. 首页直接触发正确动作
3. 首页把用户带到正确的 legacy 区域
4. 用户能感知“我刚才点的动作已经落到了哪里”

## 范围

### 要做
> 已确认：**本轮排除“删除方案”首页前置/桥接**。

1. **桥接层结构化**
   - 把目前分散的 selector 点击逻辑收敛为可维护的 bridge 层
   - 至少区分两类能力：
     - `command bridge`：直接触发按钮 / select
     - `focus bridge`：滚动并高亮 legacy 面板/区域

2. **首页动作增强**
   - 在总控区补充第二层动作，不只保留 4 个首波按钮
   - 候选动作：
     - 导出工作区
     - 导出当前方案
     - 重命名方案
     - 复制方案
     - 清空当前阵容
   - 其中**非破坏性动作优先**；本轮明确排除“删除方案”前置/桥接

3. **提醒 → 工作台 的精确跳转**
   - `Alert Deck` 中的主提醒不再只显示文案
   - 要能根据提醒类型把用户带到：
     - `#fieldPanel`
     - `#lineupPanel`
     - `#warnings`
     - 必要时 `#rosterPanel`
   - 首版允许用规则映射，不要求 NLP 解析

4. **指标 / 阵容概览 → 工作台 的精确跳转**
   - `Key Metrics` 卡支持跳到对应工作台面板
   - `Lineup Pulse` 中的守位和棒次概览支持跳到守备球场 / 棒次区
   - `Scenario Snapshot` 的“完整管理”入口应明确落到 `#scenarioPanel`

5. **交互反馈细化**
   - 被跳转到的 legacy 区域要有短暂高亮态，而不是只滚动
   - 首页触发动作后保留适度反馈：
     - 复用 toast
     - 或显示局部状态（如“已跳转到守位区”）
   - 避免让用户怀疑“按钮没反应”

6. **测试补充**
   - 补 bridge 层的集成测试
   - 至少覆盖：
     - 直接桥接按钮
     - scenarioSelect 切换
     - 精确滚动目标 / 面板高亮触发
     - 首页新增动作的桥接存在性

### 不做
- 不重写 legacy 工作台内部逻辑
- 不新增后端接口
- 不新建活动流 / 审计日志
- 不在本 slice 中把完整方案 CRUD 全部迁到 React
- 不桥接或前置 `deleteScenarioBtn`
- 不把明显危险的 destructive action 直接做成首页主动作而不加额外确认

## 设计原则

### 1. 首页是总控台，不是镜像工作台
React 首页不复制 legacy 布局；只承载：
- 判断
- 入口
- 导向
- 反馈

### 2. 动作桥接优先级
优先顺序：
1. 非破坏、高频、用户收益大的动作
2. 精确定位和高亮
3. 才考虑更危险或更低频动作

### 3. destructive action 要克制
像 `deleteScenarioBtn`、`resetBtn` 这种动作：
- 可以留在计划候选项里
- 但不默认上首页主动作位
- 如果要前置，需要单独确认交互与风险提示

### 4. 高亮优于额外说明文案
对“跳到了哪里”的反馈，首选：
- smooth scroll
- 面板 flash/highlight
- 必要时配合 toast

而不是增加更多说明文字。

## 实现策略

### A. 建立 typed legacy bridge
建议在 `PlayerManagerClient` 附近抽一层轻量 bridge（文件名以实现时选择为准）：
- `trigger(selector)`
- `changeSelect(selector, value)`
- `focus(selector, options)`
- `triggerAndFocus(...)`

目标：
- 避免桥接 selector 散落在 JSX 回调里
- 给后续 roster / lineup / scenario 页迁移保留复用点

### B. 引入 focus/highlight 机制
建议在 legacy root 内对目标节点：
- `scrollIntoView({ behavior: "smooth" })`
- 临时加 class，例如 `.bridge-focus`
- 1.2s~1.8s 后移除

样式可落在：
- `home-overview.module.css` 不合适（作用域不在 legacy）
- 更适合 `globals.css` 或壳层对 legacy 的全局覆写区

### C. 首页区块增强建议

#### 1. Alert Deck
- 每条 critical/advisory 可挂一个“去处理”按钮
- 或主卡底部提供 2~3 个上下文动作：
  - 去守位区
  - 去棒次区
  - 去提醒区

#### 2. Command Strip
- 保留首波 4 个动作
- 增加第二层“辅助动作”或次级 action row：
  - 导出工作区
  - 导出当前方案
  - 复制方案
  - 重命名方案

#### 3. Scenario Snapshot
- 除轻量切换器外，增加：
  - 复制当前方案
  - 重命名当前方案
  - 去完整方案区

#### 4. Key Metrics / Lineup Pulse
- 守位完成度卡 → `#fieldPanel`
- 棒次完成度卡 → `#lineupPanel`
- 可上场人数卡 → `#rosterPanel`
- 守位 mini board / 棒次列表 → 对应面板聚焦

## 进度
- [x] 2026-06-04 — 明确深度桥接范围，并确认本轮排除“删除方案”
- [x] 2026-06-04 — 新增 `src/lib/legacy-bridge.ts`，统一 trigger / changeSelect / focus / highlight 逻辑
- [x] 2026-06-04 — 首页补充导出 / 重命名 / 复制 / 清空阵容等桥接动作
- [x] 2026-06-04 — Alert Deck / Metrics / Scenario Snapshot / Lineup Pulse 接入精确跳转
- [x] 2026-06-04 — 在 `globals.css` 中新增 `.bridge-focus` 高亮反馈
- [x] 2026-06-04 — 新增 `legacy-bridge.test.ts` 并增强 `PlayerManagerClient` 深桥接测试

## 文件计划

### 预计修改
- `src/components/player-manager-client.tsx`
- `src/components/home-overview.tsx`
- `src/components/home-overview.module.css`
- `src/app/globals.css`（若需要全局 bridge-focus 样式）
- `src/components/player-manager-client.test.tsx`

### 可能新增
- `src/lib/legacy-bridge.ts` 或 `src/components/home-overview-bridge.ts`
  - 视实现方式决定；如果桥接逻辑继续扩展，建议抽出独立文件

### 预计文档更新
- `docs/FRONTEND.md`
- `docs/DESIGN.md`
- `docs/QUALITY_SCORE.md`
- 当前 Phase 2 计划文件进度

## 验证
- [x] 首页新增桥接动作能触发对应 legacy 行为
- [x] 提醒 / 指标 / 阵容概览能准确跳到对应 legacy 区域
- [x] 被定位到的区域有明确高亮反馈
- [x] `npm test`
- [x] `npm run lint`（保留既有 warning，无新增 error）
- [x] `npm run build`
- [x] 页面核验：本地 `curl` 解锁后可命中 `导出工作区` / `去守位区` / `深入编辑工作台`

## 结论与残留风险
1. **destructive action 边界已落实**
   - 本 slice 未把删除方案放到首页，也未做对应桥接
   - 重置示例数据仍保持不前置
2. **提醒映射粒度**
   - 首版使用规则映射，满足当前总控台导向需求；未来若提醒文案更多样，再考虑更细映射
3. **桥接层已独立落地**
   - 当前已抽成 `legacy-bridge.ts`，后续可继续复用到 roster / lineup / scenario 页面
4. **视觉验收仍以代码与页面命中验证为主**
   - 当前没有截图级自动视觉回归，这是本 slice 的非 blocker 残留项

> Phase 2 的深度桥接与交互细化已完成。
