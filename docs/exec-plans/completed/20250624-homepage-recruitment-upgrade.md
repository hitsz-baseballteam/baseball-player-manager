# 执行计划：主页展示与招新能力提升

状态：进行中  
负责人：待分配  
创建日期：2026-06-24  
预计周期：4–5 周（可独立交付一、二阶段）  
跟踪 Issues：#20（阶段一总览 Parent Issue），子任务为其 sub-issues：#15、#16、#17、#18、#19

---

## 1. 背景与目标

当前公开主页（`/`）已完成「品牌海报 + 招新入口」的基础形态，但内容偏静态：训练信息、联系方式、球队历史、近期动态都硬编码在 `public-site-content.ts` 中，每次更新都要改代码发版。

本计划目标：

1. **把主页升级为可运营的球队展示门户**——训练时间、FAQ、联系方式、近期比赛/新闻都能在后台配置或自动从已有数据生成。
2. **提升招新转化**——让新生在首页快速获得「什么时候、在哪里、怎么加入」的答案，降低进群前的决策成本。
3. **复用现有数据资产**——把后台已有的 `milestone`（里程碑/新闻）和 `games`（官方比赛）安全地开放到公开页，避免重复维护。

---

## 2. 范围边界

### 2.1 做（In Scope）

- 公开主页新增/强化模块：
  - 训练信息卡（时间、地点、装备、交通）
  - 近期比赛/赛程展示（只读，不暴露球员个人统计）
  - 最新动态/里程碑/公告流
  - FAQ 折叠面板
  - 联系方式矩阵（微信、邮箱、公众号、B站/小红书等）
  - 球队历史与荣誉静态叙事区
  - 图片画廊/轮播（复用现有 `public/team/` 资产，可扩展）
- 后台 `/panel/settings` 增加「主页展示设置」入口，可配置：
  - 训练信息文案
  - FAQ 列表
  - 联系方式列表
  - 要展示的最新里程碑数量
  - 要展示的比赛数量与筛选条件（官方赛/训练赛/全部）
- 数据层：扩展 `Workspace.preferences` 支持 `publicHomeConfig`，并通过 `/api/workspace/preferences` 持久化。
- 公开数据服务：新增只读 helper，从 `workspace-store` 读取并筛选适合公开的数据。

### 2.2 不做（Out of Scope）

- 不做独立 CMS 或多媒体上传系统；图片仍走 `public/` 目录 + 重新部署。
- 不做公开的球员个人档案页（避免隐私风险）。
- 不做多语言版本（中文优先）。
- 不做用户评论、报名系统、在线支付等社交/交易功能。

### 2.3 数据安全边界

公开页只能读取以下脱敏数据：

| 数据源 | 可公开字段 | 不可公开字段 |
|---|---|---|
| `milestone` | `date`, `title`, `description`, `mediaUrl` | 无 |
| `games` | `date`, `opponent`, `gameType`, `totalInnings`, 汇总比分 | `innings.batters`, `statLines`（含球员个人数据） |
| `players` | 仅总人数/可上场人数聚合 | 姓名、背号、档案等个人信息 |

---

## 3. 阶段划分

### 阶段一：静态内容增强（第 1–2 周，可独立发布）

目标：不改动数据库，先补齐高价值静态模块，让招新信息更完整。

#### 3.1.1 训练信息区块升级

当前 `content.training` 是 3 个键值对，信息不够。改为结构化的训练信息卡：

```ts
type TrainingInfo = {
  schedule: string;      // e.g. "每周二、五 18:30–21:00"
  location: string;      // e.g. "大学城体育中心棒球场"
  whatToBring: string[]; // ["运动服", "运动鞋", "饮用水"]
  whatWeProvide: string[]; // ["球棒", "手套", "棒球"]
  note: string;          // e.g. "雨天会在群里通知是否改室内"
};
```

改动文件：

- `src/lib/public-site-content.ts`：扩展类型和常量。
- `src/components/public-home.tsx` + `public-home.module.css`：新增/替换训练信息区块。

验收：

- 首页能看到训练时间、地点、带什么、球队提供什么。
- 移动端不破坏现有布局。

#### 3.1.2 FAQ 折叠面板

新增 6–8 条招新常见问题：

- 零基础真的可以加入吗？
- 需要买装备吗？
- 训练频率和强度如何？
- 如何平衡课业和训练？
- 女生可以加入吗？
- 加入后一定要参加比赛吗？
- 怎么联系你们？

改动文件：

- `src/lib/public-site-content.ts`：新增 `faq: Array<{ question: string; answer: string }>`。
- `src/components/public-home.tsx` + CSS：新增 FAQ 区，使用 `<details>`/`<summary>` 或自定义折叠组件。

验收：

- FAQ 可展开/收起。
- 支持键盘操作（Enter/Space）。

#### 3.1.3 联系方式矩阵

当前只有一个微信群二维码。改为矩阵：

```ts
type ContactChannel = {
  type: "wechat-group" | "email" | "social";
  label: string;
  value: string;
  href?: string;
  qrImage?: string;
};
```

改动文件：

- `src/lib/public-site-content.ts`：新增 `contacts`。
- `src/components/public-home.tsx` + CSS：替换或扩展 `#join` 区域。

验收：

- 邮箱可复制，社媒可跳转，微信群保留二维码。
- 不暴露个人微信号/手机号。

#### 3.1.4 球队历史与荣誉静态叙事

新增一个轻量区块：成立年份、队训、主要荣誉、历届赛事经历。内容先走 `public-site-content.ts`。

改动文件：

- `src/lib/public-site-content.ts`：新增 `history`、`awards`。
- `src/components/public-home.tsx` + CSS。

验收：

- 视觉上与现有「一支在深圳成长的大学棒球队」区块区分开。

#### 3.1.5 导航锚点更新

导航从 3 项扩展到：认识球队、训练日常、近期动态、常见问题、加入我们。

改动文件：

- `src/lib/public-site-content.ts`：`navigation`。
- `src/components/public-home.tsx`：对应 `id` 锚点。

验收：

- 点击导航平滑滚动到对应区块。
- 移动端菜单也能跳转并关闭。

---

### 阶段二：动态内容接入（第 2–4 周）

目标：让主页能自动展示后台维护的里程碑和比赛，减少发版频率。

#### 3.2.1 扩展数据模型：公开主页配置

在 `Workspace.preferences` 中新增 `publicHomeConfig`：

```ts
type PublicHomeConfig = {
  training: TrainingInfo;
  contacts: ContactChannel[];
  faq: Array<{ question: string; answer: string }>;
  history: {
    foundedYear: number | null;
    story: string;
    awards: string[];
  };
  feeds: {
    milestones: {
      enabled: boolean;
      maxCount: number;
    };
    games: {
      enabled: boolean;
      maxCount: number;
      gameTypes: Array<"official" | "training">;
    };
  };
};

// Workspace.preferences 扩展为：
type WorkspacePreferences = {
  helpDismissed: boolean;
  publicHomeConfig: PublicHomeConfig;
};
```

数据库迁移：

- 由于配置嵌套在 `app_workspace_meta.preferences`（或当前未独立的 `help_dismissed`）中，需要把 preferences 改为 JSONB 列，或新增 `app_workspace_preferences` 表。
- 推荐：**新增 `app_workspace_preferences` 表**，把 `help_dismissed` 和 `public_home_config` 一起迁移过去，保持 meta 表精简。

改动文件：

- `supabase/migrations/20250624_add_workspace_preferences.sql`
- `src/lib/workspace/types.ts`
- `src/lib/workspace/sanitizers.ts`：提供默认值，保证向后兼容。
- `src/lib/workspace/base.ts`：`createDefaultWorkspace` 提供默认 `publicHomeConfig`。
- `src/lib/workspace-store.ts`：读写 preferences 的新列/新表。

验收：

- 新工作区创建时包含默认 `publicHomeConfig`。
- 旧工作区读取时自动回退到默认值。
- `npm test` 全过。

#### 3.2.2 创建公开数据读取服务

新增 `src/lib/public-site-data.ts`：

```ts
export type PublicMilestone = Pick<Milestone, "id" | "date" | "title" | "description" | "mediaUrl">;
export type PublicGame = {
  id: string;
  date: string;
  opponent: string;
  gameType: "official" | "training";
  totalInnings: number;
  score: { us: number; them: number } | null; // 从 innings 汇总
  result: "win" | "loss" | "tie" | "upcoming";
};

export async function getPublicHomeData(): Promise<{
  config: PublicHomeConfig;
  milestones: PublicMilestone[];
  games: PublicGame[];
}>;
```

实现要点：

- 不经过 `panel-server.ts`（需要登录），直接调用 `workspace-store` 的只读方法或新增 `getPublicWorkspaceSnapshot()`。
- 对 `games` 只返回「未来 3 个月 + 历史 N 场」的比赛，并按日期排序。
- 比分只从 `innings` 的 `runs` 汇总，不暴露任何球员 ID。

改动文件：

- `src/lib/public-site-data.ts`（新）
- `src/lib/workspace-store.ts`：新增/复用只读 snapshot 方法。

验收：

- 未登录用户访问 `/` 能看到公开数据。
- 公开 API 不返回球员姓名、背号、个人统计。

#### 3.2.3 公开主页改为数据驱动

`src/app/page.tsx` 改为 Server Component，预取公开数据：

```tsx
import { getPublicHomeData } from "@/lib/public-site-data";

export default async function HomePage() {
  const { config, milestones, games } = await getPublicHomeData();
  return <PublicHome content={config} milestones={milestones} games={games} />;
}
```

`PublicHome` 改为接收 props，但仍为 Client Component（保留移动端菜单状态）。

改动文件：

- `src/app/page.tsx`
- `src/components/public-home.tsx`：props 化。
- `src/components/public-home.module.css`：新增动态模块样式。

验收：

- 页面首屏仍能静态渲染或 ISR。
- Lighthouse 性能分数不下降。

#### 3.2.4 新增动态模块组件

- `src/components/public-milestones.tsx`：最新动态/里程碑卡片流。
- `src/components/public-schedule.tsx`：近期比赛赛程表，区分「即将开始」「已结束」。
- `src/components/public-training-card.tsx`：结构化训练信息展示。
- `src/components/public-faq.tsx`：FAQ 折叠组件。
- `src/components/public-contacts.tsx`：联系方式矩阵。

验收：

- 每个组件都有对应测试。
- 无数据时展示友好空状态。

#### 3.2.5 后台设置页增加「主页展示设置」

在 `/panel/settings` 新增一个 tab 或区块：

- 训练信息表单
- FAQ 编辑器（可增删改）
- 联系方式编辑器
- 历史/荣誉文本区
- 动态内容开关：是否显示 milestones / games，各显示几条

改动文件：

- `src/components/settings-page-client.tsx`
- `src/lib/workspace-client.ts`：新增 `updatePublicHomeConfig(config, version)`。
- `src/app/api/workspace/preferences/route.ts`：扩展 schema 接受 `publicHomeConfig`。
- `src/lib/export-actions.ts`：导入导出包含 `publicHomeConfig`。

验收：

- 在 settings 页修改配置后，公开主页同步更新。
- 导入/导出 JSON 能保留配置。

---

### 阶段三：打磨、SEO 与性能（第 4–5 周）

#### 3.3.1 图片画廊/轮播

将现有 `gallery` 区块升级：

- 支持点击放大（lightbox）。
- 可选：从 milestone 的 `mediaUrl` 自动聚合图片。
- 懒加载非首屏图片。

改动文件：

- `src/components/public-gallery.tsx`（新）
- `src/components/public-home.tsx`

#### 3.3.2 结构化数据（Schema.org / JSON-LD）

为公开页添加：

- `SportsOrganization`（球队组织）
- `SportsEvent`（近期比赛）
- `FAQPage`（FAQ 区）

改动文件：

- `src/app/page.tsx`：注入 JSON-LD。

验收：

- Google 富媒体测试可识别球队名称、赛事、FAQ。

#### 3.3.3 SEO 与分享优化

- `sitemap.ts` 保持首页即可（公开页仍是单页锚点）。
- Open Graph 图片可配置化（从 `publicHomeConfig` 读取）。
- 各区块语义化标题（`h2`），便于搜索引擎理解。

#### 3.3.4 性能与可访问性

- 图片使用 `next/image` 的 `priority` 仅保留首屏 1–2 张。
- FAQ 折叠使用原生 `<details>` 以保证无障碍。
- 跑一遍 Lighthouse，目标：Performance ≥ 90，Accessibility ≥ 95。

#### 3.3.5 测试与文档

- 新增/更新：
  - `src/components/public-home.test.tsx`
  - `src/lib/public-site-data.test.ts`
  - `src/app/api/workspace/preferences/route.test.ts`
  - `src/lib/workspace/sanitizers.test.ts`（默认值）
- 更新 `docs/API.md`：preferences 接口新增字段。
- 更新 `docs/SCHEMA.md`：数据库 preferences 变更。
- 更新 `docs/DESIGN.md`：公开主页新增模块的视觉规范。
- 更新/创建 `docs/QUALITY_SCORE.md`，说明本计划带来的变化。
- 移动执行计划到 `docs/exec-plans/completed/`。

---

## 4. 数据模型详细设计

### 4.1 推荐迁移

新增表：

```sql
CREATE TABLE app_workspace_preferences (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspace_meta(id) ON DELETE CASCADE,
  help_dismissed boolean NOT NULL DEFAULT false,
  public_home_config jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

迁移脚本负责：

1. 创建新表。
2. 从 `app_workspace_meta.help_dismissed` 回填数据。
3. 为现有工作区生成默认 `public_home_config`。
4. （可选）在 `app_workspace_meta` 保留 `help_dismissed` 列作为过渡，后续版本删除。

### 4.2 默认值

```ts
const DEFAULT_PUBLIC_HOME_CONFIG: PublicHomeConfig = {
  training: {
    schedule: "每周二、周五 18:30–21:00（以群内通知为准）",
    location: "大学城体育中心棒球场",
    whatToBring: ["运动服", "运动鞋", "饮用水"],
    whatWeProvide: ["球棒", "手套", "棒球"],
    note: "雨天会提前在微信群通知是否改室内训练。",
  },
  contacts: [
    { type: "wechat-group", label: "棒球队微信群", value: "扫码入群", qrImage: "/team/wechat-group-qr.jpg" },
  ],
  faq: [ /* 默认 6 条 */ ],
  history: {
    foundedYear: null,
    story: "",
    awards: [],
  },
  feeds: {
    milestones: { enabled: true, maxCount: 3 },
    games: { enabled: true, maxCount: 3, gameTypes: ["official"] },
  },
};
```

---

## 5. 风险与注意事项

| 风险 | 缓解措施 |
|---|---|
| 扩展 preferences 导致现有导入导出格式不兼容 | sanitizers 提供默认值；导入时 merge 而非替换 |
| 公开 games 数据意外泄露球员信息 | `public-site-data.ts` 只返回汇总比分，不返回 `innings.batters` 和 `statLines` |
| 公开数据读取拖慢首页加载 | 使用 Next.js `cache()` + `unstable_cache`；必要时 ISR 或分页 |
| 配置文件过大导致 payload 超标 | 限制 FAQ、contacts、awards 数量；必要时服务端校验 |
| 图片仍走 `public/` 目录，运营同学不会发版 | 在 settings 页提供清晰说明：图片更新需替换文件并重新部署 |

---

## 6. 验收清单

- [ ] 阶段一：首页包含训练信息卡、FAQ、联系方式矩阵、历史荣誉区。
- [ ] 阶段一：导航可跳转，移动端可用。
- [ ] 阶段二：数据库迁移成功，旧数据不丢失。
- [ ] 阶段二：settings 页可配置主页所有静态内容。
- [ ] 阶段二：主页能展示最新 milestones 和近期 official games，且不暴露球员隐私。
- [ ] 阶段三：Lighthouse Performance ≥ 90，Accessibility ≥ 95。
- [ ] 全阶段：`npm run lint`、`npm test`、`npm run build` 全部通过。
- [ ] 全阶段：`docs/API.md`、`docs/SCHEMA.md`、`docs/DESIGN.md`、QUALITY_SCORE 同步更新。
- [ ] 计划完成后移动到 `docs/exec-plans/completed/`。
