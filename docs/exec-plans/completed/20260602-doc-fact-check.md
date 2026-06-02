# 文档事实校对

## 目标
检查当前项目的活动文档是否与仓库实际状态一致，并修正文档漂移。

## 范围
- 检查活动文档：`README.md`、`AGENTS.md`、`docs/*.md`、`docs/design-docs/*.md`
- 排除历史性记录：`docs/generated/history/`、`docs/exec-plans/completed/`
- 如发现不一致，直接做最小必要修正，并保留文档原有结构

## 步骤
1. 读取活动文档并提取可验证声明
2. 对照源码、配置、测试、CI 与目录结构逐项核验
3. 修正文档漂移并补充验证摘要
4. 运行验证命令并汇总差异

## 验证
- [x] 文档中的关键事实均有仓库证据
- [x] `npm test`
- [x] `npm run lint`
- [x] `git status --short`

## 结果
- 已修正文档漂移：主题变量数量、主题切换职责、前端 props/状态流、RLS 与 cookie 描述、限流现状、自动重试现状、若干 ADR 与行数/CI 事实
- 已写入校对记录：`docs/generated/history/2026-06-02-doc-fact-check.md`
- 验证结果：`npm test` 42/42 通过；`npm run lint` 通过
