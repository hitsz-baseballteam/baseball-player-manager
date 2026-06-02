# 重新生成初始化文档

## 目标
基于当前仓库已验证事实，重新整理初始化目录映射与核心文档，同时保留现有有意义文档。

## 范围
- 更新 `AGENTS.md`
- 更新 `docs/ARCHITECTURE.md`
- 更新 `.pi/APPEND_SYSTEM.md`
- 视需要微调 `docs/index.md`、`README.md` 与 `docs/QUALITY_SCORE.md`
- 不删除现有设计文档、规格、历史记录与其他已存在文档

## 步骤
1. 审查仓库结构、脚本、入口点、测试与现有文档
2. 基于证据重写核心初始化文档，避免未验证陈述
3. 运行验证命令并记录输出

## 验证
- [x] `npm test`
- [x] `npm run lint`
- [x] `git status --short`

## 进度
- [x] 2026-06-02 审查顶层结构、`package.json`、关键源码与现有文档
- [x] 2026-06-02 更新 `AGENTS.md`、`docs/ARCHITECTURE.md`、`.pi/APPEND_SYSTEM.md`、`docs/index.md`、`README.md`
- [x] 2026-06-02 运行验证并整理证据图

## 验证结果
- `npm test`：42/42 通过
- `npm run lint`：通过
- `git status --short`：仓库存在本次工作之外的既有未提交改动；本次主要涉及文档文件
