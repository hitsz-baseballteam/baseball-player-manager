# 球员档案页重设计

## 目标
在不改变数据结构、保存流程与页面路由的前提下，重新设计球员档案页，使其更简洁、更美观、更统一。

## 范围
- 重设计 `src/components/player-profile-editor.tsx`
- 重设计 `src/components/player-profile-editor.module.css`
- 保持 `/players/[playerId]` 页面加载、保存、冲突处理逻辑不变
- 视需要微调文案、信息分组与交互层次
- 不修改数据库结构、API 合同或工作区数据模型

## 当前观察
- 当前档案页已是 React 页面，保存逻辑在 `src/components/player-profile-page-client.tsx`
- 页面使用 `PlayerProfileEditor` 统一支撑 page / drawer 两种变体
- 样式集中在 `player-profile-editor.module.css`
- 项目已有主题变量与字体变量，约束是继续使用 CSS Modules + CSS 变量，不引入 CSS 框架
- 现有档案页信息密度较高，视觉元素较多，适合进行“减法式”重构

## 计划步骤
1. 锁定视觉方向与成功标准（简洁的具体含义、保留哪些信息层次）
2. 重新设计信息架构：首屏、核心指标、资料分组、雷达图区域、操作区
3. 重写页面布局与样式系统，统一 page / drawer 的视觉语言
4. 检查响应式、键盘可达性、保存状态与空态表现
5. 运行测试与 lint，并更新文档/质量记录

## 风险与约束
- `PlayerProfileEditor` 同时用于 page 与 drawer，重构时要避免破坏抽屉版本
- 不能只做“换皮”；需要改善层次、可读性和扫描效率
- 视觉方向如果不先对齐，后续返工成本会较高

## 验证
- [x] 页面在 `variant="page"` 与 `variant="drawer"` 下都可正常工作
- [x] 保存、冲突提示、空态仍正常
- [x] `npm test`
- [x] `npm run lint`
- [x] `npm run build`

## 已确认决策
- 视觉方向：**低调高级 / 编辑感**
- 目标气质：像精致球探年鉴，减少装饰噪音，靠排版、留白、材质感和信息秩序取胜
- 保持不变：数据结构、保存逻辑、冲突处理、page/drawer 双变体

## 当前状态
- 已完成，可归档
