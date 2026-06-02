# 快速 Win 合集：重试 + 速率限制 + CSS 评估 + Turbopack

## 目标

一次性解决 TD-04、TD-05、TD-08，评估 TD-07。

## 范围

### 做
- TD-04：workspace-client 自动重试（409 冲突时最多 3 次）
- TD-05：`/api/unlock` 内存速率限制（5 次/分钟）
- TD-07：评估 CSS 命名空间隔离需求 → 结论：自消解债务，旧模板 CSS 随 DOM 迁移逐步消失
- TD-08：修复 Turbopack 兼容，移除 `--webpack` 标志

### 不做
- TD-07 代码改动（评估为自消解）
- DOM Wave 2 迁移
- API 集成测试

## 步骤

### TD-05：速率限制
1. ✓ 创建 `src/lib/rate-limiter.ts`：基于 Map 的内存计数器
2. ✓ 在 `/api/unlock` 的 POST 中调用，超限返回 429

### TD-04：workspace-client 重试
3. ✓ `workspace-client.ts` 新增 `saveWithRetry` 函数
4. ✓ DOM 管理器 `commitWorkspace` 存储 `lastMutator`，`enqueueSave` 使用重试

### TD-07：CSS 命名空间
5. ✓ **评估**：旧模板 CSS 缩放于 `.app-shell`，React portal 组件渲染到 `document.body`，天然隔离。标记为 ⏸ 自消解

### TD-08：Turbopack
6. ✓ 移除 `--webpack` 标志，Turbopack 构建正常

## 验证

- [x] `npm test` — 34 tests passing
- [x] `npm run lint` — 0 errors
- [x] `npm run build` — exit 0（Turbopack）
- [x] 速率限制：连续 >5 次 POST /api/unlock 返回 429

## 进度

- [x] 2026-06-02 — 计划完成
- [x] TD-05：速率限制
- [x] TD-04：workspace-client 重试
- [x] TD-07：CSS 评估（自消解）
- [x] TD-08：Turbopack
