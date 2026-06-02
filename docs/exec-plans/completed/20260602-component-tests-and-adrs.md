# Wave 1 组件测试补全与 ADR 文档补齐

## 目标

为 Wave 1 迁移新增的 4 个 React 组件补测试，补齐 4 个待记录的架构决策文档。

## 范围

### 做
- 引入 React Testing Library + jsdom 测试环境
- 为 Toast、ThemeToggle、HelpDrawer、GuideOverlay 编写组件测试
- 编写 4 个待记录 ADR（pg 选型、HMAC 认证、乐观并发、单表 jsonb）

### 不做
- 不给旧组件（ProfileEditor、UnlockForm）补测试（TD-02 后续范围）
- 不写 API 集成测试（TD-03）

## 验证

- [x] `npm test` — 31 tests passing（+22 组件测试）
- [x] `npm run lint` — 0 errors
- [x] `npm run build` — exit 0
- [x] ADR 文档全部齐全（002~005）

## 进度

- [x] 2026-06-02 — 执行计划完成
- [x] 阶段 1：测试环境搭建（@testing-library/react + jsdom + tsx）
- [x] 阶段 2：组件测试（Toast 4 + ThemeToggle 4 + HelpDrawer 7 + GuideOverlay 7）
- [x] 阶段 3：ADR 文档（002~005）
- [x] 阶段 4：收尾（QUALITY_SCORE、tech-debt-tracker 更新）
