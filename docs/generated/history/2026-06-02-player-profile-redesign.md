# 2026-06-02 球员档案页重设计

## 目标
在不修改数据结构、保存逻辑和路由的前提下，重新设计球员档案页，使其更简洁、更美观，并统一 page / drawer 视觉语言。

## 已完成内容
- 重写 `src/components/player-profile-editor.tsx`
- 重写 `src/components/player-profile-editor.module.css`
- 视觉方向采用“低调高级 / 编辑感”
- 保留 `PlayerProfilePageClient` 的保存、冲突处理与工作区同步逻辑

## 设计变化
- 从高密度卡片式布局改为更克制的编辑式编排
- 首屏聚焦身份信息、背号、角色标签与 4 个关键指标
- 将表单分为：身份与角色 / 身体素质与模型 / 球探纪要 / 六维能力图 / 六维评分
- 抽屉与独立页面沿用同一套视觉语言

## 实现注意点
- 修复了数值输入的中间态问题：通过本地 `numericDrafts` 允许用户输入 `18`、`180`、`60` 等值，不会因为最小值校验而立即清空
- 为守位选择 tile 补充了键盘焦点可见样式
- 保留了 drawer 的 Escape 关闭、focus trap、focus restore

## 验证
- `npm run lint` ✅
- `npm test` ✅ 42/42
- `npm run build` ✅
