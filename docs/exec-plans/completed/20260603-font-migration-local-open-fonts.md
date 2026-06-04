# 20260603 字体迁移：本地打包开源字体（中文 + 英文）

## 目标
移除 `next/font/google`，改用项目内置的开源字体文件；中文用可分发的中文无衬线字体，英文用简洁优雅的无衬线字体；保持现有视觉层级尽量不变，并消除构建时字体联网依赖。

## 范围
- 改 `src/app/layout.tsx`：去掉 Google Fonts 导入与变量挂载，改为本地字体加载
- 改 `src/app/globals.css`：定义全局字体变量与 `body` 默认字体
- 新增/放置字体文件到仓库内可追踪位置
- 必要时微调 `src/components/player-profile-editor.module.css` 的字体引用
- 同步 `docs/DESIGN.md`
- 验证 `npm test` / `npm run lint` / `npm run build`

不做：
- 不改页面结构
- 不改配色/布局
- 不引入新的远程字体资源

## 建议字体栈
- 英文/UI：自托管 `Inter`
- 中文：自托管开源中文无衬线（优先 `Source Han Sans SC` / `Noto Sans SC`）
- 等宽：`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

## 选定方案
- 英文/UI：`Inter`（本地 woff2 子集）
- 中文：`Noto Sans SC` 简体中文子集（本地 woff2 子集）
- 加载方式：`next/font/local`

## 步骤
1. 清理 `src/app/layout.tsx` 的 `next/font/google` 导入和 `<html>` 变量类名，改用 `next/font/local` 或等价本地字体加载方式。
2. 将字体文件放入仓库内的可追踪目录（例如 `src/fonts/` 或 `public/fonts/`），并为英文/中文建立对应变量。
3. 在 `src/app/globals.css` 里建立全局字体变量，并把 `body` 切到新的英文主栈。
4. 检查 `player-profile-editor.module.css` 等局部样式，确保标题/数字不会因新字体产生明显溢出或过宽。
5. 更新 `docs/DESIGN.md` 的字体表述，改成离线可用、项目内置字体方案。
6. 跑测试、lint、build，并手动检查首页、解锁页、球员档案页。

## 进度
- [x] 2026-06-03 — 识别 Google Fonts 来源与受影响文件
- [x] 2026-06-03 — 输出执行计划
- [x] 2026-06-03 — 实施字体迁移
- [x] 2026-06-03 — 验证与文档同步

## 验证
- [x] `npm test`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run dev` 后检查首页 / 解锁页 / 球员档案页

## 风险
- 中文字体文件可能体积较大，需要考虑只保留必要字重/字形子集
- 替换 `Bebas Neue` / `Geist` 后，标题和数字视觉可能要轻微调字距
- 若保留旧变量名，后续阅读者会误以为仍依赖 Google Fonts
- 需确认所选字体的开源许可与仓库分发方式兼容

## 结果
- 已改为 `src/fonts/` 内置的 Inter 与 Noto Sans SC 子集，构建不再访问 Google Fonts
