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
| **React 组件** (`components/`) | B+ | Toast、HelpDrawer、GuideOverlay、ThemeToggle 等壳层组件职责清晰，和 legacy manager 的回调 ref 边界已跑通 |
| **旧 DOM 管理器** (`player-manager-dom.ts` + 提取模块) | B | 提取到 4 个模块（renderers/dialogs/io/scenario-ops），主文件 1525→856 行（-44%），并新增挂载 smoke test 防止初始化时序回归 |
| **样式系统** (`globals.css` + CSS Modules) | A | 三套主题完整、变量体系清晰 |
| **导入导出** | B | 功能完整、格式文档化，但缺少导入冲突的自动化解决 |
| 测试 | A- | 58 个测试结果项（57 通过 + 1 todo），覆盖业务逻辑、5 个组件、legacy manager 挂载、认证/限流工具、API 路由及方案操作 |

## 按架构层级评分

| 层级 | 分数 | 说明 |
|---|---|---|
| Types | A | 完整、一致 |
| Config | A | 明确、有边界校验 |
| Repo | B+ | 乐观并发持久化 + 读写边界净化 |
| Service | B | 核心逻辑有测试，边界覆盖可改进 |
| Runtime | B+ | API 路由已覆盖主要路径（当前 7 个通过 + 1 个 todo），解锁接口有限流 |
| UI (React) | A- | 5 个组件已测试（34 tests）+ 2 个 API route 已覆盖主要路径 |
| UI (Legacy DOM) | B | 4 个提取模块，显式接口，可维护性显著提升，并有基础挂载回归测试 |

## 技术债务影响

| 债务 | 影响分数 | 当前状态 |
|---|---|---|
| DOM 管理器过大 | UI (Legacy DOM) C+→B | ✅ 提取到 4 个模块，主文件 1525→856 行（-44%），并补充挂载 smoke test |
| 无前端组件测试 | UI (React) B→A- | ✅ 5 个组件已有测试（34 tests） |
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
