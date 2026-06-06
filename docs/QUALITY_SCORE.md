# 质量评分

按领域和架构层级跟踪代码质量。每次重大变更后更新。

## 评分标准

| 分数 | 含义 |
|---|---|
| A (90-100) | 优秀：充分测试、文档完整、边界处理到位 |
| B (75-89) | 良好：有测试覆盖、基本文档、已知边缘情况有限 |
| C (60-74) | 及格：有基本功能但测试不足或文档缺失 |
| D (< 60) | 需改进：存在已知问题、测试空洞 |

## 按领域评分

| 领域 | 分数 | 说明 |
|---|---|---|
| **类型系统** (`workspace.ts` 类型定义) | A | 完整的 TypeScript 类型，常量和标签映射齐全 |
| **业务逻辑** (`workspace.ts` 纯函数) | B | 测试覆盖 sanitize / auto-assign / warnings / cascade-delete，但部分边缘情况未覆盖 |
| **数据访问** (`db.ts` + `workspace-store.ts`) | B+ | 乐观并发控制正确；连接层与 `DATABASE_URL` / `pg` 约定保持一致，并补充了 Supabase/Vercel SSL 兼容处理，但缺少连接池失败重试逻辑 |
| **认证** (`auth.ts` + `proxy.ts`) | B+ | HMAC 签名 + 常量时间比较 + 解锁速率限制；仍是共享口令模型 |
| **API 路由** (`api/*`) | B | 结构化错误返回，但缺少请求体校验中间件 |
| **React 组件** (`components/`) | A | `AppShell` 已统一承载首页、名册、排阵、场景、数据中心、设置、档案页与比赛数据页；球员档案页现已直接链接比赛数据页，`GamesPageClient` 对棒球局数记法、增删改保存与摘要计算都有页面级测试覆盖 |
| **旧 DOM 运行时** | A | 首页 legacy runtime 已清退，不再构成当前实现复杂度 |
| **样式系统** (`globals.css` + CSS Modules) | A | 三套主题完整、变量体系清晰 |
| **导入导出** | B+ | 已迁入 `export-actions.ts` + `/import-export` 数据中心页面；仍缺少 CSV 导入 |
| 测试 | A- | 当前 166 个测试结果项（165 通过 + 1 todo），覆盖业务逻辑、页面级工作台（首页 / 名册 / 排阵 / 场景 / 档案 / 数据中心 / 设置 / 比赛数据）、共享逻辑层、认证/限流与 API 路由；比赛数据页已补上增删改保存、局数记法与摘要计算验证，并覆盖导入路径上的局数清洗 |

## 按架构层级评分

| 层级 | 分数 | 说明 |
|---|---|---|
| Types | A | 完整、一致 |
| Config | A | 明确、有边界校验 |
| Repo | B+ | 乐观并发持久化 + 读写边界净化 |
| Service | B | 核心逻辑有测试，边界覆盖可改进 |
| Runtime | B+ | API 路由已覆盖主要路径（当前 7 个通过 + 1 个 todo），解锁接口有限流 |
| UI (React) | A | 首页、名册、排阵、场景、数据中心、设置与档案页都已落入统一 React 壳层并有组件测试；当前主要缺口不再是迁移，而是后续体验深化与视觉回归自动化 |
| UI (Legacy DOM) | A | legacy homepage runtime 已清退；当前无活跃 legacy UI 运行路径 |

## 技术债务影响

| 债务 | 影响分数 | 当前状态 |
|---|---|---|
| DOM 管理器过大 | UI (Legacy DOM) C+→A | ✅ 先提取为 4 个模块，再在首页 legacy retirement 中彻底删除运行时链 |
| 无前端组件测试 | UI (React) B→A | ✅ 主要 React 工作台与页面客户端均已有测试，覆盖首页 / 名册 / 排阵 / 场景 / 数据中心 / 设置 |
| 首页 legacy runtime | UI (Legacy DOM) B→A | ✅ `index.html` / `legacy-template.ts` / `legacy-bridge.ts` / `player-manager-dom.ts` / `dom-*` 已从运行路径清退 |
| 无 CI/CD | —→B | ✅ GitHub Actions 已添加（lint + test + build） |
| 无 API 集成测试 | Runtime B→B+ | ✅ 2 个 API route 已覆盖主要路径（当前 7 个通过 + 1 个 todo） |
| 无速率限制 | Runtime B→B+ | ✅ 内存速率限制（5 次/分钟） |
| 无保存重试 | Repo B→B+ | ✅ saveWithRetry（409 自动重试 3 次） |
| Turbopack 不兼容 | — | ✅ --webpack 已移除，Turbopack 正常 |

## 更新记录

| 日期 | 变更 | 影响域 |
|---|---|---|
| 2026-06-02 | 初始质量评估 | 全局 |
| 2026-06-02 | Wave 1 迁移 + CI 添加 | UI (React) B→B+、UI (Legacy DOM) C→C+、新增 CI/CD B |
| 2026-06-02 | 组件测试 + ADR 补齐 | 测试 B→B+、设计文档 A（5 个 ADR 全部记录） |
| 2026-06-02 | 初始化文档重整（基于仓库证据） | 分数不变；修正文档漂移，提升初始化与架构说明可信度 |
| 2026-06-02 | 活动文档事实校对 | 分数不变；纠正文档与代码不一致之处 |
| 2026-06-02 | 球员档案页重设计 | 分数不变；提升页面层次与可读性，保留现有数据与保存逻辑 |
| 2026-06-02 | 计划规则收敛 | 分数不变；减少机械建计划文件的要求，和现有工作流保持一致 |
| 2026-06-02 | DOM 管理器模块提取（Wave 2-4） | UI (Legacy DOM) C+→B-，提取 771 行到 3 个聚焦模块 |
| 2026-06-02 | 技术债全部清零 | UI (Legacy DOM) B-→B、测试 B+→A-、UI (React) B+→A-；新增 dom-scenario-ops 模块 + ProfileEditor 测试 |
| 2026-06-03 | 恢复 `pg` + `DATABASE_URL` 数据访问路径 | 数据访问 B→B+；修复解锁后页面因缺少 `SUPABASE_*` 环境变量而 500 的问题 |
| 2026-06-03 | 文档与交互一致性修正 | 分数不变；补充 `workspace-client` / `HelpDrawer` 测试并修正文档描述 |
| 2026-06-03 | Supabase 连接兼容与 legacy manager 初始化修复 | 分数不变；补充 `db.ts` 的 Supabase SSL 兼容逻辑，并新增 `player-manager-dom` 挂载 smoke test |
| 2026-06-03 | 档案抽屉打开回归修复 | 分数不变；新增 `player-manager-dom` 测试覆盖点击“档案”按钮后成功打开抽屉 |
| 2026-06-03 | `next dev` EPIPE 死循环修复 | 分数不变；将开发入口改为 resilient wrapper，并为断管后继续写日志的行为补充测试 |
| 2026-06-03 | 字体改为项目内置本地字体 | 分数不变；移除 Google Fonts 运行时依赖，改用 `src/fonts/` 内置的 Inter 与 Noto Sans SC 子集 |
| 2026-06-04 | 首页全局壳层重建（Slice 1 收尾） | React 组件 B+→A-；新增 `AppShell`、首页摘要轨与 legacy frame，并补上 `PlayerManagerClient` 集成测试；HelpDrawer / GuideOverlay / Toast 已接入 shell 级视觉覆写，且通过 `npm test`、`npm run lint`、`npm run build` 与本地 `curl` 锁定/解锁首页检查完成核验 |
| 2026-06-04 | Phase 2 首页总控区首版实现 | 分数不变；新增 `HomeOverview`、首页提醒/动作/指标/方案切换/阵容概览，以及 legacy→React 的 `onStateChange` 同步桥；补充首页桥接行为测试与 manager snapshot 测试 |
| 2026-06-04 | Phase 2 深度桥接与交互细化 | 分数不变；新增 `legacy-bridge`，把首页动作、提醒、指标与阵容概览精确桥接到 legacy 面板，并补充 `legacy-bridge.test.ts` 与 `PlayerManagerClient` 深桥接测试 |
| 2026-06-04 | Phase 3 名册工作台与共享逻辑 | 分数不变；新增 `/roster` 路由、`RosterPageClient`、`RosterOverview`、`roster-actions` 共享逻辑层，legacy 名册区改接共享 `roster-actions`，独立档案页纳入 `AppShell` 统一壳层 |
| 2026-06-04 | Phase 3 完整收尾 | 分数不变；新增页面级测试（`roster-page-client.test.tsx`、`player-profile-page-client.test.tsx`），修正弹层层叠错误与档案页嵌套设计，Playwright 自动验收 6 项均通过 |
| 2026-06-05 | Phase 4 + 5 收尾 | React 组件 A-→A、导入导出 B→B+；新增 `lineup-actions` / `export-actions`、`/lineup` / `/scenarios` / `/import-export` / `/settings` 页面与对应测试；通过 `npm test`、`npm run lint`、`npm run build` 核验 |
| 2026-06-05 | 首页 legacy runtime 退役 | UI (React) A-→A、UI (Legacy DOM) B→A；首页改为纯 React command desk，删除 `index.html` / `legacy-template.ts` / `legacy-bridge.ts` / `player-manager-dom.ts` / `dom-*` 运行时链，并通过 `npm test`、`npm run lint`、`npm run build` 核验 |
| 2026-06-05 | UI polish + 比赛数据页 + 档案字段修正 | 数据模型新增 `GameRecord` 类型与 `/players/[playerId]/games` 比赛数据独立页；档案字段 `armStrengthKmh`/`sixtyMeterSec` 改名 `armStrengthM`/`thirtyMeterSec`；标题字号缩小与英文 kicker 中文化；通过 `npm test`、`npm run lint`、`npm run build` 核验 |
| 2026-06-05 | UI plan 收尾与一致性补齐 | 分数不变；球员档案页补上“查看比赛数据”入口，`AppShell` 品牌 badge 中文化，比赛数据页补上棒球局数记法校验与摘要计算测试 |
| 2026-06-05 | 排阵页布局重排 | 分数不变；`/lineup` 改为“左球场、右侧打线+球员堆叠”布局，球员区独立滚动，浏览器验收确认中等宽度下守位图不再被侧栏挤压 |
| 2026-06-05 | HelpDrawer 打开/关闭链路收口 | 分数不变；帮助抽屉改为仅在打开时 portal 渲染，补齐固定定位/层级样式，并统一首页/设置页的打开入口与关闭测试 |
