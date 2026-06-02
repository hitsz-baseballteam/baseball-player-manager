# 计划工作流

## 计划粒度

不是每个任务都要单独建计划文件。根据变更复杂度选择不同的计划方式：

### 小变更（< 1 天）

直接在任务描述、commit message 或 PR 描述中记录计划，无需单独文件。

示例：
```
feat: add player position validation on import

- Add validatePositions() to workspace.ts
- Show position warnings in import preview
- Test: duplicate positions, invalid codes, empty arrays
```

### 中等变更（1-3 天 / 多步骤 / 可能跨 session）

在 `docs/exec-plans/active/` 创建单个 Markdown 文件，包含：

```markdown
# [计划标题]

## 目标
[一句话描述要完成什么]

## 范围
- [具体要做的事]
- 不做：[明确排除的内容]

## 步骤
1. [步骤 1]
2. [步骤 2]

## 验证
- [ ] 测试通过：`npm test`
- [ ] 构建通过：`npm run build`
- [ ] 手动验证：[具体场景]
```

### 大型变更（> 3 天 / 涉及架构决策）

1. 先在 `docs/design-docs/` 写设计文档（ADR 格式）
2. 在 `docs/exec-plans/active/` 创建执行计划，引用设计文档
3. 计划完成后移动到 `docs/exec-plans/completed/`

## 计划生命周期

```
active/ → 开发中 → 完成 → completed/
                          ↘ 废弃 → 删除或标注 [ABANDONED]
```

## 计划文件命名

`YYYYMMDD-简短描述.md`

示例：`20260602-player-import-validation.md`

## 进度跟踪

在执行计划中维护进度检查点：

```markdown
## 进度

- [x] 2026-06-02 10:00 — 设计文档完成
- [x] 2026-06-02 14:00 — 实现 validatePositions()
- [ ] 2026-06-02 16:00 — 导入预览警告 UI
- [ ] 2026-06-03 10:00 — 测试 + 文档更新
```

## 技术债务

在 `docs/exec-plans/tech-debt-tracker.md` 中记录已知债务：

```markdown
| ID | 描述 | 影响域 | 严重程度 | 计划 |
|---|---|---|---|---|
| TD-01 | DOM 管理器过大（1525 行） | UI | 中 | 逐步拆分为 React 组件 |
```

## 规则

- 不要为一次性的小任务机械地创建计划文件；只有在复杂度、持续时间、跨 session 协作或架构影响值得记录时才建文件
- 不要在计划中写实现细节（代码示例）——计划描述"做什么"和"为什么"，实现细节留给代码和注释
- 计划完成后必须更新 `docs/QUALITY_SCORE.md`
- 如果计划引入新的架构决策，必须在 `docs/design-docs/` 记录
