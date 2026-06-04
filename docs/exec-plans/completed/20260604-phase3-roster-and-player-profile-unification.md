# 20260604 Phase 3 计划：名册与球员档案统一语言

## 目标
把当前“首页总控台 + legacy 名册区 + 独立球员档案页”的分裂体验，推进到一个可持续的 Phase 3 形态：
- 新增 `/roster` 页面，并把它做成**完整名册工作台**，而不只是浏览入口
- 优化 `/players/[playerId]`，让独立档案页与首页壳层、名册页共享同一套产品语言
- 统一“抽屉编辑”与“独立档案页”的视觉和结构关系，让用户理解：抽屉是快速编辑，页面是完整档案
- 把当前 legacy 名册区里的新增球员、批量编辑、批量删除等核心能力，明确迁移到 React 或抽成可复用逻辑层

## 当前仓库事实（已验证）
1. **还没有 `/roster` 路由**
   - `src/app/` 当前只有 `/` 与 `/players/[playerId]` 两个页面路由
2. **球员档案页已是 React 页面**
   - `src/app/players/[playerId]/page.tsx` 做解锁校验后，直接渲染 `PlayerProfilePageClient`
   - `PlayerProfilePageClient` 负责 workspace 读写、版本冲突刷新、保存状态文案
3. **档案编辑 UI 已抽成共享组件**
   - `PlayerProfileEditor` 同时支持 `variant="page"` 与 `variant="drawer"`
   - legacy manager 里的档案抽屉由 `src/lib/dom-renderers.ts` 渲染，并已支持“打开完整页面”
4. **名册主交互仍在 legacy DOM 中**
   - `player-manager-dom.ts` 仍拥有球员筛选、批量选择、批量编辑/删除、新增球员等主力逻辑
   - 相关筛选状态当前基于 `searchInput / positionFilter / statusFilter / batsFilter / throwsFilter / assignmentFilter`
5. **部分纯逻辑已可复用**
   - `src/lib/dom-scenario-ops.ts` 已有 `filterPlayers()` 与 `PlayerFilterState`，可作为 `/roster` 首波筛选逻辑的复用起点
6. **首页壳层已成熟**
   - `AppShell` 已用于首页，且 Phase 2 已完成首页总控台与 legacy bridge
   - Phase 3 最自然的方向，是把 `/roster` 和独立档案页纳入同一套壳层/导航语言，而不是再造第三套页面骨架

## 产品问题定义
当前用户路径仍然有明显断层：
- 在首页看到“名册”导航，但还不能真正进入独立名册页
- 在 legacy 名册区里打开档案抽屉时，是一套体验；点“打开完整页面”后，又切到另一套 page 体验
- 名册、档案、编辑之间已经有功能连接，但尚未形成统一的“浏览 → 快速编辑 → 深入档案”的闭环

Phase 3 的价值，不只是新增一个 `/roster` 路由，而是把这三者关系讲清楚。

## 范围与非范围
### 本阶段范围
- 新建 `/roster` React 页面，并承接完整名册工作台职责
- 把新增球员、批量编辑、单删、批量删除迁入 React 工作流
- 统一 `/roster`、档案抽屉、独立档案页的产品语言与跳转链路
- 让 `AppShell` 的“名册”导航真实可用

### 本阶段非范围
- 不处理排阵页 `/lineup` 与方案页 `/scenarios` 的 React 化
- 不新增后端接口、数据库表或审计日志
- 不在本阶段重做首页总控台信息架构
- 不迁移 scenario delete 等非名册主线能力
- 不追求一次性删除 legacy manager；Phase 3 的目标是让名册域完成独立闭环

## Phase 3 目标态（建议）

### 1. `/roster` 成为“完整名册工作台”
首屏职责：
- 浏览球员池
- 用统一筛选快速定位人选
- 一眼看出守位、状态、当前方案分配情况
- 进入抽屉快速编辑或独立档案页
- 直接完成新增球员、批量编辑、批量删除等名册主力操作

### 2. 球员详情形成双层体验
- **抽屉**：用于快进快出、保持名册上下文不断裂
- **独立页面**：用于完整阅读与深编辑

两者应共享：
- 同一套信息分组
- 同一套视觉 token
- 同一套字段优先级

两者可以保留：
- 不同的外层容器（drawer vs page）
- 不同的导航/返回方式

### 3. 首页导航开始真实落地
- `AppShell` 的“名册”导航不再只是 disabled 占位
- 首页 / 名册 / 球员详情三者之间形成真实跳转链路

## 设计原则
1. **完整工作台优先**：已确认 `/roster` 首波不是只做浏览层，而是要承接完整名册主力操作
2. **先抽逻辑，再换 UI**：对于当前绑在 `dom-dialogs.ts` / `player-manager-dom.ts` 里的新增、批量编辑、批量删除流程，优先抽出可复用的校验与 mutation 逻辑，再落 React UI
3. **统一语言，而不是复制布局**：抽屉和 page 可以不同容器，但信息层次和组件语法要一致
4. **列表与详情形成闭环**：从 `/roster` 进入详情后，返回路径、当前筛选上下文、下一步动作要明确
5. **不新增后端接口**：继续基于 `workspace` / `workspace-client` / 现有纯函数推进
6. **单一业务真相**：新增/编辑/删除球员的业务规则只能收敛到一处共享逻辑，不能在 React 与 legacy 中各写一份

## 已确认决策
1. **`/roster` 首波定位**：采用 **完整名册工作台**，不只做浏览闭环。
2. **迁移边界**：新增球员、批量编辑、批量删除都应纳入 Phase 3 计划，而不是继续长期留在 legacy。
3. **球员点击主路径**：采用 **抽屉优先（推荐）**，保留完整档案页作为深编辑入口。
4. **独立档案页外层**：`/players/[playerId]` 在 Phase 3 就纳入 **统一一级壳层**。

## 状态与数据流（目标形态）
### `/roster`
- `src/app/roster/page.tsx`：解锁校验 + 读取 workspace snapshot
- `RosterPageClient`：持有页面级 state
  - `workspace`
  - `version`
  - `saving/status message`
  - `filter state`
  - `selected player ids`
  - `active profile id`
  - `dialog state`（新增 / 批量编辑 / 删除确认）
- 所有保存动作统一走 `saveWorkspaceSnapshot()`；若遇到版本冲突，重载最新 snapshot 并刷新页面 state

### 抽屉档案
- 默认从 `/roster` 打开
- 继续复用 `PlayerProfileEditor variant="drawer"`
- 保存后直接刷新当前页面 `workspace`，不跳页
- 提供“打开完整页面”入口进入 `/players/[playerId]`

### 独立档案页
- 继续用 `PlayerProfilePageClient` 负责保存与冲突处理
- 外层纳入统一壳层
- 内容主体仍优先复用 `PlayerProfileEditor variant="page"`

### 共享 roster actions
- 新增/编辑球员：校验姓名、背号、守位与 profileType 同步
- 批量编辑：处理 keep/replace/append/remove 语义
- 删除：统一复用 `removePlayersFromWorkspace()`，确保 scenario 分配同步清理
- legacy manager 与 React roster 页面都调用同一套共享 action helpers

## 关键实施面

### A. `/roster` 路由与壳层落地
建议新增：
- `src/app/roster/page.tsx`
- `src/components/roster-page-client.tsx`
- `src/components/roster-overview.tsx` 或等价拆分

建议职责：
- Server route 负责解锁校验 + 读取 workspace snapshot
- Client 容器负责筛选 state、详情入口、抽屉开关、保存后刷新本地 workspace/version
- 复用 `AppShell`，使 `/roster` 与首页保持统一导航和 hero 语法

### B. React 名册工作台层
首波必须包含：
- 搜索
- 守位筛选
- 状态筛选
- 打/投筛选
- 当前方案分配状态筛选
- 名册计数（总数 / 当前筛选 / 可上场 / 已选）
- 球员卡片或紧凑列表
- 单球员动作：打开档案抽屉 / 进入完整档案页 / 删除
- 批量选择
- 批量编辑入口
- 批量删除入口
- 新增球员入口

建议优先复用：
- `filterPlayers()` / `PlayerFilterState`
- `getActiveScenario()` / `getPlayer()` / `getPlayerAssignmentState()` 等 workspace 纯函数
- `removePlayersFromWorkspace()` 等已验证 mutation 纯逻辑

### C. 抽屉 / 页面统一语言
建议把当前 `PlayerProfileEditor` 的“内容骨架”继续收敛为共享区块：
- 顶部身份区
- 核心指标条
- 基础资料区
- 雷达图区
- 球探摘要区
- 保存 / 返回 / 打开完整页动作区

可接受的技术方向：
- 继续使用一个 `PlayerProfileEditor` 同时支撑 page + drawer
- 如 page 需要接入 `AppShell` 或新的外层壳层，可新增更薄的 wrapper，而不是复制 editor 主体

### D. 旧名册区的迁移边界
已确认的目标是：
- `/roster` 首波承接完整名册工作台能力
- 新增球员、批量编辑、批量删除不再只是 legacy 附属功能

因此 Phase 3 的关键不再是“要不要迁”，而是：
1. 哪些 mutation 逻辑先从 DOM 事件处理器中抽离
2. React 首版是否直接使用新的表单/确认流
3. 首页与 legacy 工作台保留多少桥接入口，避免 Phase 3 期间出现两套不一致名册真相

## 执行顺序（详细）
1. **先抽共享 roster actions，再做页面 UI**
   - 原因：如果先写 React 表单，再回头抽逻辑，极易出现 legacy/React 双份规则漂移
2. **先落 `/roster` 浏览与选择态，再接入 destructive/bulk 动作**
   - 原因：先建立页面骨架与抽屉闭环，再把新增/批量动作挂上去，调试成本更低
3. **最后统一独立档案页壳层**
   - 原因：此时 `/roster` 的导航、返回语义和操作文案已经稳定，档案页更容易对齐
4. **每个切片都保留可停点**
   - 3A 后：共享 actions 可被 legacy 调用
   - 3B 后：`/roster` 至少可浏览/筛选/开抽屉
   - 3C 后：`/roster` 成为完整工作台
   - 3D 后：名册/详情语言统一完成

## 文件责任细化
| 文件 | Phase 3 角色 |
|---|---|
| `src/app/roster/page.tsx` | `/roster` server route：解锁校验、加载 snapshot、渲染 client 容器 |
| `src/components/roster-page-client.tsx` | 页面级状态中心：workspace/version、筛选、选择、对话框开关、保存与冲突处理 |
| `src/components/roster-overview.tsx` | 名册工作台可视层：hero、filters、计数、列表、批量动作条 |
| `src/components/roster-overview.module.css` | 名册页样式与响应式布局 |
| `src/components/roster-player-dialog.tsx` | 新增/编辑球员的 React 表单容器（若沿用单组件，也需明确承载新增入口） |
| `src/components/roster-bulk-editor.tsx` | 批量编辑表单容器 |
| `src/lib/roster-actions.ts` | 共享业务动作：新增/编辑/批量编辑/删除/批量删除 |
| `src/lib/dom-dialogs.ts` | 改为 DOM 壳层：负责读取 legacy form 控件并调用共享 roster actions |
| `src/lib/dom-renderers.ts` | 保持 drawer 打开与 page 跳转语义和新工作台一致 |
| `src/components/player-profile-page-client.tsx` | 独立档案页 client 状态与壳层接入点 |
| `src/components/player-profile-editor.tsx` | page/drawer 共用内容骨架；避免信息结构分叉 |
| `src/components/app-shell.tsx` | 名册页和档案页一级导航壳层 |

## 测试与验证细化
### 预计新增/增强测试
- `src/lib/roster-actions.test.ts`
  - 新增球员成功
  - 背号重复失败
  - 批量编辑 keep/append/replace/remove 语义
  - 单删/批量删除后 scenario 分配清理
- `src/components/roster-page-client.test.tsx`
  - `/roster` 初始渲染
  - 筛选与计数联动
  - 选择态与批量动作可用性
  - 抽屉打开 / 完整页面入口
- `src/components/player-profile-editor.test.tsx`
  - 继续覆盖 drawer/page 共用结构不漂移
- `src/components/app-shell.test.tsx`
  - 导航中的“名册”从 disabled 切为 link
- 如 legacy 接入共享 action 逻辑后有必要：
  - 扩展 `src/lib/player-manager-dom.test.ts`
  - 验证 legacy 表单仍可通过共享 actions 工作

### 手动验证重点
- 桌面端：完整名册工作台的密度与操作节奏
- 移动端：筛选区、批量动作条、抽屉不挤压到不可用
- 主题：classic / night / field 三套下卡片、筛选区、危险动作对比度
- 回归：从首页 → 名册 → 抽屉 → 完整档案页 → 返回名册的链路是否自然

## 初步切片建议

### Slice 3A — 抽离名册 mutation 与校验逻辑
目标：先把新增球员、批量编辑、删除等核心行为从 DOM 事件处理器里解耦出来，给 React 工作台复用。

建议范围：
- 盘点 `dom-dialogs.ts` 中与球员相关的行为：
  - `handlePlayerSubmit`
  - `handleBulkPlayerSubmit`
  - `deletePlayer`
  - `bulkDeletePlayers`
- 将“表单取值 / DOM 控件读写”与“业务校验 / workspace mutation”拆开
- 新增可被 React 与 legacy 共用的 roster action helpers（文件名实现时决定）
- 为这些 helper 补纯逻辑测试

完成标准：
- 新增球员、批量编辑、删除逻辑有 React 可调用入口
- legacy 行为仍保持可用
- 关键校验（姓名/背号、空选择、确认删除）不丢失

### Slice 3B — `/roster` 工作台骨架 + 浏览层
目标：落地新的 React 名册页壳层与浏览体验。

建议范围：
- `src/app/roster/page.tsx`
- `src/components/roster-page-client.tsx`
- `src/components/roster-overview.tsx`
- 名册筛选、计数、卡片列表、选择态
- 导航把“名册”从 disabled 改成可点击
- 接入抽屉打开与完整档案页入口

完成标准：
- `/roster` 可直接访问
- 可筛选球员并查看分配状态
- 可维护选择态并打开抽屉/完整档案页
- `npm test` / `npm run lint` / `npm run build` 通过

### Slice 3C — 完整名册动作落地
目标：让 `/roster` 真正具备工作台能力，而不是只有浏览。

建议范围：
- 新增球员表单（modal / drawer / page 内 sheet，按设计决定）
- 批量编辑表单
- 单删与批量删除确认流
- 保存后同步 workspace/version，并更新页面列表与抽屉数据
- 如有必要，为危险动作补 toast / confirm 反馈规范

完成标准：
- `/roster` 上可直接新增球员
- 可对已选球员批量编辑
- 可单删与批量删除，且场景分配同步清理仍正确
- 与 legacy 相比，不减少主力能力

### Slice 3D — 球员档案页壳层统一
目标：让 `/players/[playerId]` 不再像一块独立飞地，并与 `/roster` 的抽屉体验保持统一。

建议范围：
- 给独立档案页接入统一页面壳层或等价页面 chrome
- 对齐返回路径、状态信息、标题区、动作语义
- 确保 drawer/page 共享相同内容层次
- 统一 roster → drawer → page 的跳转语言

完成标准：
- 档案页与首页/名册页视觉语言统一
- drawer/page 不出现明显的信息结构漂移
- 保存、冲突处理、空态继续正常

## 预计改动文件（首波）
### 新增
- `src/app/roster/page.tsx`
- `src/components/roster-page-client.tsx`
- `src/components/roster-overview.tsx`
- `src/components/roster-overview.module.css`
- `src/components/roster-player-dialog.tsx`（若新增球员做成 React 表单容器）
- `src/components/roster-bulk-editor.tsx`（若批量编辑独立成组件）
- `src/lib/roster-actions.ts`（或等价命名；承接新增/批量编辑/删除逻辑）
- 视实现需要，可能新增 `src/components/profile-page-shell.tsx`

### 修改
- `src/components/app-shell.tsx`（若需要支持 active nav 的复用配置）
- `src/components/player-profile-page-client.tsx`
- `src/components/player-profile-editor.tsx`
- `src/components/player-profile-editor.module.css`
- `src/lib/dom-dialogs.ts`（抽离 DOM 专属取值逻辑，改为调用共享 actions）
- `src/lib/dom-renderers.ts`（统一 drawer → page 跳转语义）
- `src/lib/player-manager-dom.ts`（改接共享 roster actions 时可能需少量适配）
- `docs/ARCHITECTURE.md`
- `docs/DESIGN.md`
- `docs/FRONTEND.md`
- `docs/QUALITY_SCORE.md`

## 验证
- [x] `/roster` 路由可访问并通过解锁校验
- [x] `/roster` 的筛选、计数、球员卡浏览正常
- [x] `/roster` 上可新增球员
- [x] `/roster` 上可批量编辑与批量删除
- [x] 单删 / 批量删除后，scenario 分配会同步清理
- [x] 能从 `/roster` 打开抽屉或进入完整档案页
- [x] `/players/[playerId]` 保存、冲突刷新、空态保持正常
- [x] drawer/page 的主要字段分组一致
- [x] 首页 / 名册 / 球员档案三者导航链路完整
- [x] `npm test`
- [x] `npm run lint`（保留既有 warning，无新增 error）
- [x] `npm run build`
- [x] 手动验收：Playwright 浏览器自动验收所有检查项
  - 锁定态 `/roster` 正确显示解锁卡片
  - 解锁后名册工作台正常渲染，操作栏/筛选/计数/球员卡全部就位
  - 新增球员弹层图层正常，有灯光效果和圆角
  - 球员档案抽屉从右侧滑入，内容就位，“打开完整页面”入口存在
  - `/players/p-01` 项层 AppShell 导航正常显示，档案编辑器内嵌正常
  - 移动端 390px 路由可用，无装布溢出

## 残留风险（非 blocker）
1. 移动端导航项 6 个在 390px 下折行占 3 行，Phase 4/5 再做手机导航精简。
2. 弹层 backdrop 透明度偏低，封闭感稍弱，可后续差异调整。
3. 没有截图级差异回归检验（非 blocker）。

> Phase 3 已完成，可进入 Phase 4。

## 进度
- [x] 2026-06-04 — 完成详细计划草案
- [x] 2026-06-04 — 已确认全部产品决策
- [x] 2026-06-04 — Slice 3A：新增 `src/lib/roster-actions.ts` 并补 20 个纯逻辑测试，legacy `dom-dialogs.ts` 已改接共享 actions
- [x] 2026-06-04 — Slice 3B：新增 `/roster` 路由、`RosterPageClient`、`RosterOverview`、样式，首页导航“名册”已改为真实链接
- [x] 2026-06-04 — Slice 3C：`/roster` 完整名册工作台（新增球员表单、批量编辑表单、单删/批量删除确认流），所有操作调用共享 `roster-actions`
- [x] 2026-06-04 — Slice 3D：`/players/[playerId]` 纳入 `AppShell` 统一一级壳层，保持原有 save/conflict/empty-state 行为
- [x] 2026-06-04 — 文档更新：`ARCHITECTURE.md`、`FRONTEND.md`、`QUALITY_SCORE.md`
- [x] 2026-06-04 — 敀修层叠错误：弹层改用 CSS module，档案页接入 `pageSurface="embedded"` 避免嵌套背景
- [x] 2026-06-04 — 新增页面级测试：`roster-page-client.test.tsx`、`player-profile-page-client.test.tsx`
- [x] 2026-06-04 — Playwright 浏览器自动验收：全部检查项均通过

## 当前工作假设
1. 抽屉与 page 继续共用 `PlayerProfileEditor` 主体，只在外层容器与导航控件上分化。
2. `AppShell` 需要支持首页 / 名册 / 档案页三处 active nav 切换，但不新增第二套壳层组件。
3. 共享 `roster-actions` 应先被 legacy 接入再被 React 接入，借此降低迁移回归风险。

## 风险清单
1. **bulk 语义迁移风险**
   - 当前 bulk 编辑有 `keep / append / replace / remove` 四类语义，React 版若表达不清，容易造成功能退化。
2. **删除确认流分叉风险**
   - legacy 目前依赖 `window.confirm`；React 版若改为自定义确认 UI，需要保证语义一致。
3. **抽屉与页面结构漂移风险**
   - 若 `/roster` 需要更多快捷编辑字段，而 page 更强调阅读，可能造成同一组件被迫双向拉扯。
4. **导航一致性风险**
   - 首页、名册页、档案页都接入统一壳层后，active nav、返回按钮、状态文案需要一致，不然会显得像“统一了一半”。

## 当前建议
在已确认“完整名册工作台 + 抽屉优先 + 独立档案页纳入统一一级壳层”前提下，建议继续采用：
- **先抽 `roster-actions` 之类的共享逻辑层，再做 React 表单与批量动作 UI**
- **把 legacy 名册区视为 Phase 3 迁移对照物，而不是长期双轨产品**
- **在 3C 前不要急着美化过度，先保证与 legacy 同等能力和同等规则**

这样可以避免把当前 `dom-dialogs.ts` 的 DOM 读写直接复制进 React，同时保持 legacy 与新工作台在业务规则上共用同一套真相。
