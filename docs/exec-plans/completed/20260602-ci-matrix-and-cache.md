# CI 改进：Node 版本矩阵 + Next.js 构建缓存

## 目标

CI 增加 Node 22/24 矩阵测试 + Next.js 构建缓存加速。

## 范围

- `.github/workflows/ci.yml` 增加 `strategy.matrix.node-version`
- 增加 `actions/cache@v4` 缓存 `.next/cache`
- 增加 `concurrency` 避免重复 job

## 验证

- [x] CI workflow 语法正确
- [x] 本地 npm run build 正常

## 进度

- [x] 2026-06-02 — 计划完成
- [x] 2026-06-02 — Node 22/24 矩阵 + 构建缓存 + 并发控制
