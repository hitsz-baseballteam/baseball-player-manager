# 技术债务跟踪

按严重程度和影响域记录已知技术债务。每项债务应有明确的解决方案或计划。

## 已知限制

以下项目是刻意的设计权衡，非待修复债务：

| ID | 描述 | 原因 |
|---|---|---|
| KL-01 | 速率限制器使用内存 Map，不跨进程/实例 | 单人使用场景下单实例够用；跨实例一致限制需 Redis / 外部网关，当前性价比低 |
| KL-02 | globals.css 中 `.omp-toast`、`.omp-drawer-scrim`、`.unlock-*` 等使用全局选择器（加 `omp-` 前缀以降低冲突风险） | Toast / Drawer / Guide / Unlock 等组件通过 portal 渲染到 `document.body`，CSS Module 隔离对其无效 |

## 活跃债务

| ID | 严重程度 | 描述 | 影响域 | 计划 |
|---|---|---|---|---|
| TD-09 | 高 | GitHub Actions CI 在 Node 22 环境下运行 `npm test` 时因测试入口与 loader / module mock 组合不兼容而稳定失败 | CI, 测试, 开发流程 | [20260616-ci-test-compatibility.md](./active/20260616-ci-test-compatibility.md) |
| TD-10 | 高 | 面板（`/panel/*`）操作存在明显延迟和卡顿：客户端无 SWR、Server Component 无 `cache()`、连接池 `max: 1` 强制 9 个 `SELECT` 串行、写路径 wipe + reinsert 导致 20 球员 / 5 方案 / 50 比赛工作区单次写操作 2–5s | 数据访问, 性能, 用户体验 | [20260616-latency-optimization.md](./completed/20260616-latency-optimization.md) |

## 已解决债务

| ID | 描述 | 解决日期 | 解决方案 |
|---|---|---|---|
| TD-10 | 面板操作延迟和卡顿 | 2026-06-17 | P0-1 客户端 `useWorkspaceSnapshot` 切 tab 0 RTT；P0-2 RSC `cache()` 合并同请求查询 + `Cache-Control: private, max-age=10, stale-while-revalidate=30`；P0-3 `DB_POOL_MAX` env + 动态按 host/port 决策；P1-1 `unnest` 批量 INSERT 替代 9 个 for-loop；P1-2 `unstable_cache(..., { revalidate: 10, tags: ["workspace"] })` 5–10s 服务端短窗口 + mutation 后 `revalidateTag`；P1-3 写事务 `REPEATABLE READ` 防御性硬化。基线 P95 见 `docs/RELIABILITY.md` |
| TD-08 | 首页 legacy runtime 仍依赖 `player-manager-dom.ts` / `legacy-bridge.ts` / `legacy-template.ts` / `index.html` | 2026-06-05 | 首页收敛为纯 React command desk，删除 legacy homepage runtime chain，并将首页动作改为共享逻辑或显式导航 |
| TD-01 | DOM 管理器过大（1525 行单文件） | 2026-06-02 | 提取到 4 个模块（dom-renderers/dom-dialogs/dom-io/dom-scenario-ops），主文件 1525→841 行（-45%） |
| TD-02 | 无 React 组件测试（旧组件） | 2026-06-02 | PlayerProfileEditor 11 个测试 + CSS module mock loader，总计 53 个测试覆盖 5 个组件 |
| TD-03 | 无 API 集成测试 | 2026-06-02 | unlock route（4 tests）+ workspace route（4 tests），mock pg.Pool.prototype.connect |
| TD-04 | workspace-client 无重试逻辑 | 2026-06-02 | `saveWithRetry` 自动重试 3 次 |
| TD-05 | 无速率限制 | 2026-06-02 | `rate-limiter.ts` 内存速率限制（5 次/分钟） |
| TD-06 | 旧 DOM 管理器直接操作全局状态 | 2026-06-02 | 提取为显式接口模块，通过参数传递 commitWorkspace/workspace，消除闭包隐式依赖 |
| TD-07 | globals.css 中旧 DOM 样式与 React 组件样式无命名空间隔离 | 2026-06-02 | CSS Modules 天然隔离（React 组件用 .module.css），旧 DOM 样式通过 legacy-template.ts 独立提取 |

## 严重程度定义

| 级别 | 含义 |
|---|---|
| 高 | 阻碍新功能开发 / 存在数据风险 / 严重影响可维护性 |
| 中 | 可工作但有明显改进空间 / 缺少测试覆盖 |
| 低 | 锦上添花的优化 / 无紧急修复需求 |
