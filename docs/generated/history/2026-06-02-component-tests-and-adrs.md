# 会话记录 — 2026-06-02（第 2 次）

## 主题

Wave 1 组件测试补全 + 架构决策文档（ADR）补齐

## 触发

上一批新增了 4 个 React 组件但无测试，同时有 4 个架构决策未记录为正式 ADR。用户选择先补测试和文档。

## 完成内容

### 测试环境搭建

- 安装 `@testing-library/react`、`@testing-library/dom`、`@testing-library/user-event`、`jsdom`、`tsx`
- 创建 `src/lib/test-setup.cjs`：jsdom 初始化 + 全局 mock（localStorage、matchMedia、ResizeObserver 等）
- 测试脚本改为：`node --require ./src/lib/test-setup.cjs --import tsx --test`
- `--import tsx` 替代 `--experimental-strip-types`（后者不支持 `.tsx`）
- ESLint 配置新增 `src/lib/test-setup.cjs` 忽略规则

### 组件测试（22 个新增测试）

| 组件 | 测试数 | 覆盖点 |
|---|---|---|
| **ThemeToggle** | 4 | 默认渲染、主题循环、localStorage 持久化、从 localStorage 恢复 |
| **Toast** | 4 | 默认隐藏、显示消息、1.8s 自动消失、重复调用重置计时器 |
| **HelpDrawer** | 7 | 关闭/打开态、Escape 关闭、scrim 点击关闭、关闭按钮、replay 按钮、ref 暴露 |
| **GuideOverlay** | 7 | 关闭/打开态、第一步渲染、下一步/上一步导航、最后一步"完成"、skip 关闭、Escape、ref 暴露 |

**总计**: 31 tests（9 原有 + 22 新增），0 failures

### ADR 文档（4 个新增）

| ID | 标题 | 决策 |
|---|---|---|
| ADR-002 | pg (node-postgres) vs Supabase JS SDK | 选 pg，理由：最小依赖、无 vendor lock-in |
| ADR-003 | HMAC cookie 认证 vs JWT / Supabase Auth | 选 HMAC cookie，理由：单人工具不需要复杂认证 |
| ADR-004 | 乐观并发 vs 悲观锁 | 选乐观并发，理由：冲突概率极低 |
| ADR-005 | 单表 jsonb vs 关系表 | 选单表 jsonb，理由：数据整读整写 |

设计决策索引现已完整——5 个 ADR 全部记录，无待记录项。

### 文档更新

- `QUALITY_SCORE.md`：测试 B→B+、设计文档评级新增
- `tech-debt-tracker.md`：TD-02 状态更新
- `design-docs/index.md`：5 个 ADR 全部录入，"待记录"清空
- `eslint.config.mjs`：忽略 CJS 测试 setup

## 验证结果

- **ESLint**: 0 errors, 0 warnings
- **Test**: 31/31 pass（7 suites）
- **Build**: compiled successfully

## 关键文件变更

```
新增:
  src/lib/test-setup.cjs
  src/components/theme-toggle.test.tsx
  src/components/toast.test.tsx
  src/components/help-drawer.test.tsx
  src/components/guide-overlay.test.tsx
  docs/design-docs/adr-002-pg-over-supabase-sdk.md
  docs/design-docs/adr-003-hmac-cookie-auth.md
  docs/design-docs/adr-004-optimistic-concurrency.md
  docs/design-docs/adr-005-single-table-jsonb.md
  docs/exec-plans/completed/20260602-component-tests-and-adrs.md

修改:
  package.json (test 脚本 + devDependencies)
  eslint.config.mjs (ignore test-setup.cjs)
  docs/design-docs/index.md
  docs/QUALITY_SCORE.md
  docs/exec-plans/tech-debt-tracker.md
```

## 剩余债务

| ID | 描述 | 状态 |
|---|---|---|
| TD-04 | workspace-client 无重试 | 未开始 |
| TD-05 | 无速率限制 | 未开始 |
| TD-07 | CSS 命名空间隔离 | 未开始 |
| TD-08 | Turbopack 兼容 | 未开始 |
| TD-01 | DOM Wave 2~4 | Wave 2 待开始 |
| TD-02 | ProfileEditor/UnlockForm 测试 | 部分完成 |
| TD-03 | API 集成测试 | 未开始 |
