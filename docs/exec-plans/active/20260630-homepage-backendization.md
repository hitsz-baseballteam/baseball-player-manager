# 2026-06-30 主页内容后台化计划

## 背景

当前公开主页 `/` 已经具备展示型官网结构，并且部分内容已经通过工作区偏好配置读取：

- `src/app/page.tsx` 作为公开主页入口，读取 `getPublicHomeData()` 后传给 `PublicHome`。
- `src/lib/public-site-data.ts` 会从 `Workspace.preferences.publicHomeConfig` 读取训练信息、联系方式、FAQ、队史，以及动态 milestones / games feed。
- `src/lib/workspace/types.ts` 中已有 `PublicHomeConfig`，但范围仍只覆盖 training / contacts / faq / history / feeds。
- `src/lib/public-site-content.ts` 仍是大量主页内容的静态兜底与事实来源，包括 hero、intro、stats、timeline、firstMatch、trainingSteps、culture、members、gallery。
- `src/components/settings-page-client.tsx` 已有“主页展示设置”入口，可作为继续扩展后台编辑能力的落点。

最近 PR：`#22 feat(homepage): add complete jersey number wall` 已把 30 位队员的号码墙补齐到静态内容层。主页后台化应在该 PR 合入后基于最新 `main` 开始实施，避免在计划分支里混入功能代码。

## 目标

让非开发者能在后台维护公开主页的关键内容，减少改文案、背号、照片和展示模块时对代码发布的依赖。

第一阶段不追求 CMS 化，也不引入多用户/权限/实时协作；仍遵守单人教练工具的产品边界。

## 非目标

- 不引入独立 CMS、对象存储后台、富文本编辑器或多用户审核流。
- 不做公开投稿、社交分享、评论、通知。
- 不改变现有共享口令认证模型。
- 不把所有视觉样式变成可配置项；后台只维护内容，不维护设计系统。

## 推荐方案

扩展现有 `PublicHomeConfig`，继续存储在 `Workspace.preferences.publicHomeConfig`，并通过设置页维护。

理由：

1. 已有数据通路最短：`Workspace.preferences -> public-site-data -> PublicHome` 已存在。
2. 与当前单工作区模型一致，不需要新表和新 API 边界。
3. 继承现有版本号乐观并发、导入导出、重置示例数据能力。
4. 对公开页面安全：公开页只读经过 sanitizer 的展示字段，不暴露私有 roster/scenario 数据。

## 内容模型拆分

### Phase 1 — 号码墙后台化

新增 `PublicHomeConfig.members`：

```ts
type PublicHomeMember = {
  number: string;
  name: string;
  nickname?: string;
  role: string;
  note: string;
  tone: "captain" | "vice" | "manager" | "active" | "open";
};
```

实施要点：

- `src/lib/public-site-content.ts` 继续保留静态兜底。
- `createDefaultPublicHomeConfig()` 从静态内容复制 `members`。
- `sanitizePublicHomeConfig()` 增加 members 校验：
  - 最多 60 人。
  - `number` 最多 4 字符，允许数字、`+`、短横线。
  - `name` 最多 48 字符。
  - `nickname` 最多 32 字符，可选。
  - `note` 最多 120 字符。
  - `tone` 不合法时降级为 `active`。
- `resolveContent()` 优先使用 `config.members`，否则使用静态兜底。
- 设置页新增号码墙编辑区：列表编辑 + 新增 + 删除 + 上移/下移。

验收：

- 设置页可编辑成员并保存。
- 刷新公开主页后展示最新号码墙。
- 非法/过长字段被 sanitizer 截断或兜底，不会破坏页面。
- 现有导入导出包含新配置字段。

### Phase 2 — 相册后台化

新增 `PublicHomeConfig.gallery`：

```ts
type PublicHomeGalleryItem = {
  id: string;
  category: "match" | "training" | "group" | "detail";
  categoryLabel: string;
  title: string;
  date: string;
  src: string;
  alt: string;
  wide?: boolean;
  tall?: boolean;
};
```

实施要点：

- 第一版只允许填写已存在于 `public/team/` 或外部 HTTPS 的图片 URL。
- 不在本阶段做上传；上传会引入存储、大小限制、图片处理和安全扫描问题。
- sanitizer 限制 `src` 为 `/team/...` 或 `https://...`。
- 设置页提供分类、标题、日期、图片路径、alt 文本、宽/高卡片选项。

验收：

- 可新增/编辑/删除/排序相册项。
- 不合法图片路径不会进入公开页。
- 公开页 filter/lightbox 行为保持不变。

### Phase 3 — 首屏与叙事模块后台化

扩展 `PublicHomeConfig`：

- `navigation`
- `hero`
- `intro`
- `stats`
- `timeline`
- `firstMatch`
- `trainingSteps`
- `culture`

实施要点：

- 优先把高频变化内容后台化：hero 文案、stats、timeline、firstMatch。
- navigation 可由模块启用状态派生，避免用户配置出不存在的锚点。
- 每个数组字段设置上限：stats <= 6、timeline <= 12、trainingSteps <= 10、culture <= 12。

验收：

- 主要文案可以在后台改完后公开页生效。
- 删除某个模块内容时页面能优雅隐藏或回退，不出现空白/报错。

### Phase 4 — 设置页 UX 收敛

当前设置页已经承担导入导出、重置、里程碑、公开主页设置。随着字段增加，需要避免变成长表单。

建议：

- 将公开主页设置拆成折叠分组：基础信息、号码墙、相册、FAQ、联系方式、动态 feed。
- 对数组型字段做可复用组件：`EditableListSection`。
- 保存策略先保持“整块 publicHomeConfig 保存”，不做每项单独 API，降低并发复杂度。
- 每个分组显示“已保存 / 未保存 / 保存中 / 保存失败”。

## 测试计划

新增或扩展：

- `src/lib/public-site-content.test.ts`
  - 静态兜底内容合法。
- `src/lib/workspace/sanitizers.test.ts` 或现有 sanitizer 测试
  - 新 publicHomeConfig 字段的截断、默认值、数组上限、URL 限制。
- `src/components/public-home.test.tsx`
  - config.members / config.gallery 覆盖静态内容。
  - 空数组或非法字段不会崩溃。
- `src/components/settings-page-client.test.tsx`
  - 编辑成员、增删排序、保存调用 `updateWorkspacePreferences()`。

回归命令：

```bash
npm test
npm run lint
npm run build
```

## 风险与约束

| 风险 | 影响 | 缓解 |
|---|---|---|
| `PublicHomeConfig` 过大，设置页表单复杂 | 维护成本上升 | 分阶段后台化，抽可复用列表编辑组件 |
| 用户输入图片路径错误 | 公开页图片破图 | sanitizer 限制路径；UI 增加预览与 alt 必填 |
| 公开页读取私有 roster 造成隐私边界模糊 | 数据泄露风险 | 主页只读 `publicHomeConfig`，不自动公开完整 roster |
| 配置结构升级影响旧数据库 | 老数据缺字段 | sanitizer 和 `createDefaultPublicHomeConfig()` 提供完整默认值 |
| PR #22 未合入前并行开发 | 冲突 | 计划分支不写功能代码；实现分支从合入后的 main 新建 |

## 实施顺序建议

1. 等 PR #22 合入。
2. 新建实现分支：`feat/homepage-members-config`。
3. 先做 Phase 1 号码墙后台化，并完整测试。
4. 视设置页复杂度决定是否先抽 `EditableListSection`。
5. Phase 1 合入后再做相册后台化，避免一次 PR 过大。

## 完成定义

Phase 1 完成时需要满足：

- 管理员能在设置页维护号码墙。
- 公开主页优先展示后台配置。
- 静态内容仍作为安全兜底。
- sanitizer 覆盖所有新增字段。
- 测试、lint、build 通过。
- `docs/DESIGN.md`、`docs/API.md` 或相关文档同步描述新的配置字段。
- `docs/QUALITY_SCORE.md` 更新验证记录。
