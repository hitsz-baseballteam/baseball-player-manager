# 20260605 Phase 4 + 5 计划：排阵、场景、数据中心、设置

## 完成状态

- 状态：已完成
- 完成日期：2026-06-05
- 实际验证：`npm test` ✅ / `npm run lint` ✅（0 error，存在既有 legacy warning）/ `npm run build` ✅
- 说明：仓库当前没有 Playwright / E2E 脚本，因此本计划未新增自动化浏览器验收命令；相关页面行为主要由组件测试与构建路由验证覆盖。

## 已确认决策

| 决策 | 选择 |
|---|---|
| Phase 4 排阵操作方式 | 全拖拽：SVG 球场图可拖拽分配守备，打线列表可拖拽排序 |
| Phase 4 战术场景范围 | 场景管理 + 场景对比视图 |
| Phase 4 实现策略 | 完全新写 React，先抽共享逻辑层，不走 legacy 桥接 |
| Phase 4 与 5 推进方式 | 串行：Phase 4 全完成后推进 Phase 5 |
| Phase 5 数据中心 | 迁移现有 JSON 导入导出 + 新增 CSV 球员导出 |
| Phase 5 设置形态 | 独立 `/settings` 页面 |

---

## Phase 4 — 排阵与战术场景专业化

### 目标
把排阵与方案管理从 legacy DOM 中完整迁出，提供：
- 可视化球场守备图（全拖拽分配）
- 打线顺序管理（拖拽排棒）
- 方案 CRUD + 两方案守备/打线并排对比
- 激活导航"排阵"和"战术场景"链接

### 已有可复用资产（已验证）

| 资产 | 位置 | 复用方式 |
|---|---|---|
| 守备 / 打线纯操作函数 | `src/lib/dom-scenario-ops.ts` | 重新封装为 workspace → workspace 签名 |
| 方案 CRUD 基础函数 | `src/lib/workspace.ts`（`createScenario`, `createUniqueScenarioName`, `cloneWorkspace` 等） | 直接复用 |
| 自动排阵 | `src/lib/workspace.ts`（`buildAutoScenario`, `analyzeScenarioWarnings`） | 直接复用 |
| 导入导出 | `src/lib/dom-io.ts` | Phase 5 再迁 |
| 位置坐标 | `src/lib/workspace.ts`（`POSITIONS`，含 x/y 百分比）| SVG 球场定位直接使用 |
| 拖拽 token 解析 | `src/lib/dom-scenario-ops.ts`（`playerIdFromDragToken`） | 重用逻辑，去掉 DOM 依赖 |

### Slice 4A — 共享排阵逻辑层

**目标**：抽出纯函数逻辑层，供 React 排阵页复用，与 legacy 共用同一套业务规则。

**新增文件**：`src/lib/lineup-actions.ts`

导出函数（全部为 `(workspace: Workspace, ...) → Workspace` 签名）：

```
// 守备分配
assignDefensePosition(workspace, position, playerId)  → Workspace
clearDefensePosition(workspace, position)             → Workspace
swapDefensePositions(workspace, fromPos, toPos)       → Workspace

// 打线
assignLineupSlot(workspace, index, playerId)          → Workspace
clearLineupSlot(workspace, index)                     → Workspace
moveLineupSlot(workspace, fromIndex, toIndex)         → Workspace

// 整体
clearAllAssignments(workspace)                        → Workspace
autoAssignActive(workspace)                           → Workspace  (包装 buildAutoScenario)

// 方案 CRUD
createScenarioAction(workspace, name, note)           → Workspace
renameScenarioAction(workspace, id, name, note)       → Workspace
copyScenarioAction(workspace, id)                     → Workspace
deleteScenarioAction(workspace, id)                   → Workspace  (不能删除最后一个)
setActiveScenarioAction(workspace, id)                → Workspace

// 校验
validateScenarioName(name: string, workspace, excludeId?)  → string | null
```

**新增测试**：`src/lib/lineup-actions.test.ts`（目标 ≥ 25 个测试用例）

覆盖点：
- 守备分配：同一球员不能同时守两个位置，分配时清除旧位置
- 守备交换：两个已分配位置互换
- 打线分配：同一球员不能占两个棒次
- 打线移位：index 合法性
- 方案删除：拒绝删除最后一个方案
- 自动排阵：返回包含完整分配的工作区快照
- 方案命名校验：空名/超长/重名

**完成标准**：
- `npm test` 全部通过
- legacy `dom-scenario-ops.ts` 中的对应函数不删除（只在 Phase 4 末尾决定是否清退）

---

### Slice 4B — `/lineup` 排阵页骨架 + 球场图

**新增路由**：`src/app/lineup/page.tsx`

**新增组件**：

| 文件 | 职责 |
|---|---|
| `src/components/lineup-page-client.tsx` | 页面状态中枢：workspace/version/save/冲突重试，协调三个子面板 |
| `src/components/lineup-page-client.module.css` | 排阵页布局 |
| `src/components/field-board.tsx` | SVG 球场守备图：9 个 drop zone，使用 `POSITIONS[].x/y` 定位 |
| `src/components/field-board.module.css` | 球场图样式 |
| `src/components/lineup-order.tsx` | 打线列表：1–9 棒，可拖拽排序 |
| `src/components/bench-panel.tsx` | 替补/未分配球员面板，球员卡作为拖拽 drag source |

**布局设计**（桌面端三栏）：

```
┌──────────────────┬────────────────────┬──────────────┐
│   BenchPanel     │   FieldBoard       │ LineupOrder  │
│   替补/待分配    │   SVG 守备图        │  1–9 棒次    │
│   (drag source)  │   (drop zone ×9)   │  (reorderable│
│                  │                    │   + droppable│
└──────────────────┴────────────────────┴──────────────┘
```

移动端：BenchPanel 折叠到底部抽屉，FieldBoard + LineupOrder 垂直堆叠。

**FieldBoard SVG 设计要点**：
- 外框为圆角正方形，内嵌球场背景（纯 CSS / SVG 路径，不依赖图片）
- 9 个位置圆形 drop zone，使用 `POSITIONS.x/y`（百分比）绝对定位
- 每个位置圆：显示位置代码 + 球员背号/姓名（已分配时），或"空" hint（未分配时）
- 已分配且不属于球员能力范围内的位置，显示橙色警告环（数据从 `player.positions` 派生）
- 球员卡片显示：背号 + 姓名 + 状态芯片 + 守位标签

**拖拽协议（HTML5 DnD，不引入第三方库）**：
- `dragstart`：在 `dataTransfer` 写入 `"player:<id>"` 或 `"pos:<posCode>"`（从位置拖拽时带源位置）
- `dragover`：`preventDefault()` 允许 drop
- `drop`：解析 token，根据来源类型调用 `assignDefensePosition` 或 `swapDefensePositions`
- `dragend`：清理高亮状态

**LineupOrder 拖拽**：
- 9 行可排序列表
- 每行既是 drag source（拖走已有球员）也是 drop target（接收球员）
- 行内拖拽 → `moveLineupSlot`
- 从 BenchPanel 拖入 → `assignLineupSlot`
- 行内球员拖出到 BenchPanel → `clearLineupSlot`

**完成标准**：
- `npm test` / `npm run lint` / `npm run build` 通过
- 桌面端三栏布局渲染正确，三套主题均无明显视觉破损
- 守备图 9 个位置可点击选人（此 slice 先做点击弹出选人菜单，4C 再接拖拽）

---

### Slice 4C — 拖拽交互落地

**目标**：补全 4B 中的拖拽实现，让守备图和打线列表完全可以通过拖拽操作。

**重点交互**：

1. **BenchPanel → FieldBoard**：拖球员到守备位置 → `assignDefensePosition`
2. **FieldBoard position → FieldBoard position**：守备位置互换 → `swapDefensePositions`
3. **FieldBoard position → BenchPanel**：清空守备位置 → `clearDefensePosition`
4. **BenchPanel → LineupOrder slot**：拖球员到棒次 → `assignLineupSlot`
5. **LineupOrder 行内排序**：上下拖拽调整棒次 → `moveLineupSlot`
6. **LineupOrder slot → BenchPanel**：清空棒次 → `clearLineupSlot`

**视觉反馈**：
- 拖拽悬停目标时加 `.dropActive` 样式（高亮边框）
- 非法 drop target（如已满位且来源与目标相同类型）不应用 drop，显示禁止光标
- 操作成功后位置数据立即反映（乐观更新），save 走 `saveWithRetry`

**操作区按钮**（位于排阵页顶部 action bar）：
- `自动排阵`：调用 `autoAssignActive`
- `清空阵容`：调用 `clearAllAssignments`（需二次确认）
- 当前场景切换 select

**测试**：补充 `lineup-page-client.test.tsx` 覆盖核心 DnD 事件处理逻辑（通过 `fireEvent.dragStart/dragOver/drop`）。

---

### Slice 4D — `/scenarios` 场景管理 + 对比视图

**新增路由**：`src/app/scenarios/page.tsx`

**新增组件**：

| 文件 | 职责 |
|---|---|
| `src/components/scenarios-page-client.tsx` | 场景页状态中枢，管理弹层/选择态/保存 |
| `src/components/scenarios-page-client.module.css` | 样式 |
| `src/components/scenario-list.tsx` | 场景卡片列表：每张卡含名称/备注/时间/操作按钮 |
| `src/components/scenario-compare.tsx` | 两场景守备 + 打线并排对比表 |

**场景卡片操作**：
- 切换当前 → `setActiveScenarioAction`（标记"当前"标签）
- 重命名 → 行内 inline edit 或 `<dialog>` 表单
- 复制 → `copyScenarioAction`（名称自动加 " (副本)"）
- 删除 → 确认后 `deleteScenarioAction`（最后一个场景禁用删除）

**对比视图**：
- 顶部两个 select 分别选"场景 A"和"场景 B"
- 并排两列：每列展示该场景的守备分配（SVG minimap）和打线列表（1–9 棒）
- 仅展示，不可在对比视图内编辑
- 差异高亮：守备位置或棒次球员不同时，对应行/位置加对比色背景

**场景统计卡**（页面 hero 区）：
- 场景总数
- 当前场景名 + 最后更新时间
- 守备完整度 / 打线完整度（从 `analyzeScenarioWarnings` 派生）

**测试**：`src/components/scenarios-page-client.test.tsx`

---

### Slice 4E — 导航激活 + legacy 排阵清退

**导航**：
- `src/components/app-shell.tsx`：`/lineup` 和 `/scenarios` 导航项改为真实 `<a>` 链接
- 对应 `aria-disabled` 和"规划中"标签移除

**legacy 清退（标注为已迁移）**：
- `src/lib/player-manager-dom.ts`：守备拖拽事件处理函数（`handleLineupDragStart`, `allowDrop`, `markDropTarget`, `unmarkDropTarget`, `handleDefenseDrop`, `handleLineupDrop` 等已标注为 `@deprecated`）加注释 `// MIGRATED: see lineup-actions.ts`，不立即删除（留给后续 Phase 清除）
- `src/lib/dom-renderers.ts`：守备图渲染函数同样加迁移注释

**完成标准（整个 Phase 4）**：
- `npm test` 全部通过（新增测试 ≥ 35 个）
- `npm run lint` 无新增 error
- `npm run build` 通过
- Playwright 浏览器自动验收：
  - `/lineup` 渲染球场图和打线列表
  - 拖拽球员到守备位置成功并持久化
  - 打线棒次拖拽排序成功
  - `/scenarios` 展示场景列表，创建/复制/删除操作生效
  - 场景对比视图两列正确显示差异

---

## Phase 5 — 数据中心与设置收尾

### 目标
把数据进出口和全局设置从 legacy 彻底迁出，激活最后两个导航项，清退 legacy 内对应模块。

---

### Slice 5A — 共享导入导出逻辑层

**新增文件**：`src/lib/export-actions.ts`

导出函数：

```ts
// JSON 导出（纯逻辑，不操作 DOM / 触发下载）
buildWorkspaceExport(workspace: Workspace): WorkspaceExportPayload
buildScenarioExport(workspace: Workspace, scenarioId: string): ScenarioExportPayload
buildCsvExport(workspace: Workspace): string   // 新增：球员列表 CSV

// 导入解析（已有，封装自 workspace.ts prepareImport）
parseImportPayload(json: unknown): PendingImport
applyWorkspaceImport(currentWorkspace: Workspace, pending: PendingImport): Workspace
applyScenarioImport(currentWorkspace: Workspace, pending: PendingImport): Workspace
```

**CSV 格式**（球员列表）：
```csv
背号,姓名,状态,守位,打击,投球
18,陈浩宇,可上场,"P,1B",右打,右投
```

**测试**：`src/lib/export-actions.test.ts`（目标 ≥ 12 个测试用例）

覆盖点：
- buildWorkspaceExport 输出结构完整
- buildScenarioExport 只含当前场景引用的球员
- buildCsvExport 输出格式正确（含多守位引号转义）
- parseImportPayload 拒绝 malformed JSON / 错误 type 字段
- applyWorkspaceImport / applyScenarioImport 正确合并

---

### Slice 5B — `/import-export` 数据中心页面

**新增路由**：`src/app/import-export/page.tsx`

**新增组件**：

| 文件 | 职责 |
|---|---|
| `src/components/import-export-page-client.tsx` | 数据中心状态中枢 |
| `src/components/import-export-page-client.module.css` | 样式 |

**页面结构**：

```
┌─────────────────────────────────────────────────┐
│  EXPORT WORKSPACE                               │
│  [下载 JSON]  [下载场景 JSON]  [下载球员 CSV]  │
├─────────────────────────────────────────────────┤
│  IMPORT                                         │
│  点击上传 JSON 文件                              │
│  ↓ 预览摘要（类型/球员数/场景数/名称列表）        │
│  [取消]  [确认导入]                             │
└─────────────────────────────────────────────────┘
```

**导出流程**：
1. 调用 `buildWorkspaceExport` / `buildScenarioExport` / `buildCsvExport`
2. 调用 `downloadJson` / `downloadCsv`（`data:text/csv`）
3. Toast 提示成功

**导入流程**：
1. `<input type="file" accept=".json">` 点击上传
2. FileReader → JSON.parse → `parseImportPayload`
3. 展示摘要卡（类型、球员数、场景数、导入后影响描述）
4. 用户确认 → `applyWorkspaceImport` / `applyScenarioImport`
5. `saveWithRetry` → 成功后 Toast + 跳转到对应页

**测试**：`src/components/import-export-page-client.test.tsx`

---

### Slice 5C — `/settings` 设置页

**新增路由**：`src/app/settings/page.tsx`

**新增组件**：

| 文件 | 职责 |
|---|---|
| `src/components/settings-page-client.tsx` | 设置页客户端 |
| `src/components/settings-page-client.module.css` | 样式 |

**设置分区**：

```
APPEARANCE / 外观
  主题：[经典] [夜场] [球场]  （复用 ThemeToggle 逻辑）

WORKSPACE / 工作区
  当前版本 / 球员数 / 方案数（只读展示）
  [重置示例数据]（需二次确认，调用 createDefaultWorkspace）

ACCESS / 访问控制
  说明文字：本工作区使用共享口令模式
  [退出登录]（调用 /api/logout，跳转到锁定态）

HELP / 帮助
  [重新播放新手引导]（触发 GuideOverlay）
  [查看帮助抽屉]（触发 HelpDrawer）
```

**测试**：`src/components/settings-page-client.test.tsx`

---

### Slice 5D — 导航激活 + legacy 清退

**导航**：
- `app-shell.tsx`：`/import-export` 和 `/settings` 改为真实链接

**legacy 清退**：
- `player-manager-dom.ts`：导入导出按钮事件处理器（`importBtn`, `exportWorkspaceBtn`, `exportScenarioBtn`）加迁移注释 `// MIGRATED: see export-actions.ts`
- `dom-io.ts`：`exportWorkspace` / `exportScenario` / `autoAssignScenario` 加迁移注释

> **注意**：legacy manager 此时仍然挂载在首页，以上迁移只是"注释标注"，不删除代码。完整删除 legacy 是单独的 Phase（蓝图中未规划，留给将来）。

**完成标准（整个 Phase 5）**：
- `npm test` 全部通过（当前 161 pass + 1 todo）
- `npm run lint` 无新增 error（保留既有 legacy unused warning）
- `npm run build` 通过
- 组件测试已覆盖：
  - `/import-export` 导出按钮渲染、导出 helper 调用、workspace/scenario JSON 上传摘要、取消导入
  - `/settings` 重置示例数据确认、退出登录请求、引导重播、帮助抽屉打开
- 构建产物已包含：`/import-export`、`/settings`

---

## 新增文件总览

### Phase 4

```
src/lib/
├── lineup-actions.ts                    # 共享排阵 + 场景 CRUD 纯函数
└── lineup-actions.test.ts

src/app/
├── lineup/page.tsx                      # 排阵页 server route
└── scenarios/page.tsx                   # 场景管理页 server route

src/components/
├── lineup-page-client.tsx               # 排阵页状态中枢
├── lineup-page-client.module.css
├── field-board.tsx                      # SVG 守备球场图（拖拽 drop zone）
├── field-board.module.css
├── lineup-order.tsx                     # 1–9 棒次可拖拽列表
├── bench-panel.tsx                      # 替补/待分配球员面板
├── scenarios-page-client.tsx            # 场景页状态中枢
├── scenarios-page-client.module.css
├── scenario-list.tsx                    # 场景卡片列表
├── scenario-compare.tsx                 # 两场景并排对比
└── lineup-page-client.test.tsx          # 排阵页集成测试
    scenarios-page-client.test.tsx       # 场景页集成测试
```

### Phase 5

```
src/lib/
├── export-actions.ts                    # 纯导入导出逻辑（含 CSV）
└── export-actions.test.ts

src/app/
├── import-export/page.tsx               # 数据中心 server route
└── settings/page.tsx                    # 设置页 server route

src/components/
├── import-export-page-client.tsx        # 数据中心状态中枢
├── import-export-page-client.module.css
├── settings-page-client.tsx             # 设置页
└── settings-page-client.module.css
    import-export-page-client.test.tsx
    settings-page-client.test.tsx
```

---

## 修改文件

| 文件 | 变更 |
|---|---|
| `src/components/app-shell.tsx` | Phase 4E：激活 /lineup /scenarios 链接；Phase 5D：激活 /import-export /settings 链接 |
| `src/lib/player-manager-dom.ts` | Phase 4E/5D：相关函数加迁移注释 |
| `src/lib/dom-scenario-ops.ts` | Phase 4E：对应函数加迁移注释 |
| `src/lib/dom-io.ts` | Phase 5D：对应函数加迁移注释 |

---

## 风险清单

| 风险 | 影响 | 缓解方案 |
|---|---|---|
| HTML5 DnD 在移动端不可用 | `/lineup` 移动端无法拖拽 | 备用：点击选人模式（tap position → show player picker overlay），与拖拽并存 |
| SVG 球场尺寸与各屏幕适配 | 极小或极宽屏位置覆盖 | 使用 `viewBox` + `preserveAspectRatio="xMidYMid meet"` 保证等比例缩放 |
| 场景对比视图数据量大 | 渲染卡顿 | 限制同时加载两场景，不加虚拟滚动 |
| legacy 清退注释而非删除 | 技术债继续累积 | 明确记录在 tech-debt-tracker.md |
| CSV 特殊字符（中文逗号/换行） | 导出文件在 Excel 中乱码 | UTF-8 BOM + 字段全部加引号包裹 |

---

## 进度

- [x] 2026-06-05 — 产品决策确认（全拖拽 / 场景对比 / 串行 / 完全新写 React / JSON+CSV / 独立设置页）
- [x] 2026-06-05 — 完成详细计划草案
- [x] Slice 4A：共享排阵逻辑层（`lineup-actions.ts` + 测试）
- [x] Slice 4B：`/lineup` 排阵页骨架 + SVG 球场图（点击选人，无拖拽）
- [x] Slice 4C：全拖拽交互落地（守备图 + 打线列表）
- [x] Slice 4D：`/scenarios` 场景管理 + 对比视图
- [x] Slice 4E：导航激活 + legacy 排阵清退注释
- [x] Slice 5A：共享导入导出逻辑层（`export-actions.ts` + CSV + 测试）
- [x] Slice 5B：`/import-export` 数据中心页面
- [x] Slice 5C：`/settings` 设置页
- [x] Slice 5D：导航激活 + legacy 导入导出清退注释

## 收尾备注

- `src/lib/export-actions.ts` 已作为 React 数据中心的共享导入导出逻辑层落地。
- `src/app/import-export/page.tsx` 与 `src/app/settings/page.tsx` 已加入主导航并通过 `next build` 路由收集。
- 该计划完成时，legacy 首页仍挂载 `player-manager-dom.ts`；后续已在 `docs/exec-plans/completed/20260605-legacy-homepage-retirement.md` 中完成 homepage legacy runtime 清退。
