# 技术债务跟踪

按严重程度和影响域记录已知技术债务。每项债务应有明确的解决方案或计划。

## 已知限制

以下项目是刻意的设计权衡,非待修复债务:

| ID | 描述 | 原因 |
|---|---|---|
| KL-01 | 速率限制器使用内存 Map,不跨进程/实例 | 单人使用场景下单实例够用;跨实例一致限制需 Redis / 外部网关,当前性价比低 |
| KL-02 | globals.css 中 `.omp-toast`、`.omp-drawer-scrim`、`.unlock-*` 等使用全局选择器(加 `omp-` 前缀以降低冲突风险) | Toast / Drawer / Guide / Unlock 等组件通过 portal 渲染到 `document.body`,CSS Module 隔离对其无效 |

## 活跃债务

当前无活跃技术债务。

## 已解决债务

| ID | 描述 | 解决日期 | 解决方案 |
|---|---|---|---|
| TD-10 | 面板(`/panel/*`)操作存在明显延迟和卡顿;写路径仍然 wipe + reinsert 但已用 unnest 批量 INSERT | 2026-06-18 | 全部 P0 + P1 项落地:客户端 snapshot 缓存、Server Component `cache()` + `unstable_cache` 短窗口缓存、动态连接池 max、unnest 批量 INSERT、REPEATABLE READ 隔离级 |
| TD-08 | 首页 legacy runtime 仍依赖 `player-manager-dom.ts` / `legacy-bridge.ts` / `legacy-template.ts` / `index.html` | 2026-06-05 | 首页收敛为纯 React command desk,删除 legacy homepage runtime chain,并将首页动作改为共享逻辑或显式导航 |
| TD-09 | GitHub Actions CI 在 Node 22 环境下运行 `npm test` 时因测试入口与 loader / module mock 组合不兼容而稳定失败 | 2026-06-16 | 将测试入口切换为 `tsx --test` + ESM setup,并修复 workflow 对 `codex/*` 分支的匹配;执行计划移至 `docs/exec-plans/completed/20260616-ci-test-compatibility.md` |
| TD-01 | DOM 管理器过大(1525 行单文件) | 2026-06-02 | 提取到 4 个模块(dom-renderers/dom-dialogs/dom-io/dom-scenario-ops),主文件 1525→841 行(-45%) |
| TD-02 | 无 React 组件测试(旧组件) | 2026-06-02 | PlayerProfileEditor 11 个测试 + CSS module mock loader,总计 53 个测试覆盖 5 个组件 |
| TD-03 | 无 API 集成测试 | 2026-06-02 | unlock route(4 tests)+ workspace route(4 tests),mock pg.Pool.prototype.connect |
| TD-04 | workspace-client 无重试逻辑 | 2026-06-02 | `saveWithRetry` 自动重试 3 次 |
| TD-05 | 无速率限制 | 2026-06-02 | `rate-limiter.ts` 内存速率限制(5 次/分钟) |
| TD-06 | 旧 DOM 管理器直接操作全局状态 | 2026-06-02 | 提取为显式接口模块,通过参数传递 commitWorkspace/workspace,消除闭包隐式依赖 |
| TD-07 | globals.css 中旧 DOM 样式与 React 组件样式无命名空间隔离 | 2026-06-02 | CSS Modules 天然隔离(React 组件用 .module.css),旧 DOM 样式通过 legacy-template.ts 独立提取 |

## 严重程度定义

| 级别 | 含义 |
|---|---|
| 高 | 阻碍新功能开发 / 存在数据风险 / 严重影响可维护性 |
| 中 | 可工作但有明显改进空间 / 缺少测试覆盖 |
| 低 | 锦上添花的优化 / 无紧急修复需求 |
