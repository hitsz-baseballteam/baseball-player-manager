# 技术债务跟踪

按严重程度和影响域记录已知技术债务。每项债务应有明确的解决方案或计划。

## 活跃债务

当前无活跃技术债务。

## 已解决债务

| ID | 描述 | 解决日期 | 解决方案 |
|---|---|---|---|
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
