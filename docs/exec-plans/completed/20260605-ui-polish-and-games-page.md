# 20260605 UI Polish + 球员比赛数据独立页

## 完成状态

- 状态：已完成
- 完成日期：2026-06-05
- 结果：`GameRecord` 类型落地、档案字段改名、标题字号缩小与英文标签中文化、`/players/[playerId]/games` 比赛数据独立页上线

## 概览

三类改动：
1. **字号与标题语义优化**：降低过大标题、把英文 kicker 标签中文化
2. **球员比赛数据独立页**：`/players/[playerId]/games`，含"正式比赛"和"训练比赛"两个 tab，支持逐场增删
3. **档案单位修正**：臂力 km/h → 掷远 m、60m 冲刺 → 30m 冲刺

---

## Slice 1 — 球员比赛数据模型

### 新增类型（`src/lib/workspace.ts`）

```ts
export type GameRecord = {
  id: string;
  date: string;           // ISO date
  opponent: string;        // 对手名称
  gameType: "official" | "training";

  // 攻击
  pa: number;              // 打席
  ab: number;              // 打数
  h: number;               // 安打
  hr: number;              // 本垒打
  rbi: number;             // 打点
  r: number;               // 得分
  sb: number;              // 盗垒
  bb: number;              // 四坏球
  so: number;              // 被三振

  // 投球
  ip: number | null;       // 投球局数（.1 = 1/3 局，.2 = 2/3 局）
  er: number | null;       // 自责分
  soPitching: number | null; // 投球三振
  bbPitching: number | null; // 投球四坏球
  hPitching: number | null;  // 被安打
};
```

### 数据落点

`GameRecord[]` 放在 `PlayerProfile` 内，随球员一起导入导出行走。

```ts
export type PlayerProfile = {
  // ... existing fields ...
  games: GameRecord[];
};
```

### Sanitizer / 类型迁移

- `sanitizePlayerProfile()` 需要 sanitize `games` 数组
- `createDefaultPlayerProfile()` 和 `createDefaultWorkspace()` 的默认值包含 `games: []`
- `WORKSPACE_SCHEMA_VERSION` 不升版（只是新增字段，旧数据可自动兼容）

### 已完成数据迁移后的默认值

- 现有球员读取时自动补齐 `games: []`
- 新建球员默认无比赛记录

### 验证

- [ ] `npm test` — workspace sanitizer 测试通过
- [ ] workspace import 测试：旧 schema 数据自动补齐 `games: []`

---

## Slice 2 — 臂力 / 冲刺单位修正

### 数据模型改动（`src/lib/workspace.ts`）

| 旧字段 | 新字段 | 旧 label | 新 label | 旧范围 | 新范围 |
|---|---|---|---|---|---|
| `armStrengthKmh` | `armStrengthM` | 臂力 km/h | 掷远 m | 50–180 | 10–150 |
| `sixtyMeterSec` | `thirtyMeterSec` | 60m 秒 | 30m 秒 | 5–15 | 3–8 |

### 涉及文件

- `src/lib/workspace.ts`：类型定义、sanitizer、默认值
- `src/components/player-profile-editor.tsx`：表单 label / range / overview 卡片文案
- `src/lib/workspace.test.ts`：sanitizer 范围校验测试
- `src/components/player-profile-editor.test.tsx`：档案编辑器对应测试

### 验证

- [ ] 现有测试适配后通过
- [ ] 新字段名在 sanitizer / 编辑器 / overview 中一致

---

## Slice 3 — 字号与标题语义优化

### 3A — 降低过大标题

当前问题标题（按严重程度排）：

| 位置 | 当前字号 | 建议 |
|---|---|---|
| 球员档案名（`.player-profile-editor .title`） | `clamp(34px, 6vw, 74px)` | → `clamp(28px, 4vw, 48px)` |
| 球员档案页题头标题 | `clamp(34px, 5vw, 52px)` | → `clamp(28px, 4vw, 44px)` |
| Alert title（首页强提醒标题） | `clamp(28px, 4vw, 42px)` | → `clamp(24px, 3.5vw, 36px)` |
| `.metricValue`（指标数字） | `36px` | → `30px` |
| `.scenarioName`（方案名称） | `28px` | → `24px` |
| `.statusValue` / `.summaryValue` | `28px` | → `24px` |
| AppShell `.title`（页面题头） | `clamp(32px, 4vw, 52px)` | 保持不变（主标题需要辨识度） |
| `.frameTitle` | `26px` | 保持不变 |

### 3B — 英文 kicker 标签中文化

当前全部未翻译的英文 kicker：

| 位置 | 当前 | 建议 |
|---|---|---|
| 首页 | Alert Deck | 比赛日提醒 |
| 首页 | Command Strip | 快捷动作 |
| 首页 | Key Metrics | 关键指标 |
| 首页 | Scenario Snapshot | 当前方案 |
| 首页 | Lineup Pulse | 阵容概览 |
| 首页 | Batting Order | 棒次概览 |
| 首页 | Advisory Notes | 建议提醒 |
| 首页 | Game Day Command Desk | 比赛日总控台 |
| 首页 hero | Game Day Command Desk | 比赛日总控台（同左） |
| AppShell header | Team Ops Editorial | 球队作战指挥台 |
| 档案编辑器 | Scouting Record | 球探记录 |
| 档案编辑器 | Identity | 身份与角色 |
| 档案编辑器 | Athletic Baseline | 身体素质与模型 |
| 档案编辑器 | Narrative | 球探纪要 |
| 档案编辑器 | Ability Shape | 六维能力图 |
| 档案编辑器 | Grades | 六维评分 |
| 档案编辑器 | Player Notes | 球员备注 |
| 档案编辑器 | Player Record | 球员记录 |
| 排阵页 | Lineup Board | 排阵工作台 |
| 场景页 | Tactical Scenarios | 战术场景 |
| 数据中心 | Data Center | 数据中心 |
| 设置页 | Workspace Settings | 工作区设置 |
| 场景页区域 | Appearance | 外观 |
| 场景页区域 | Workspace | 工作区 |
| 场景页区域 | Access | 访问控制 |
| 场景页区域 | Help | 帮助 |

> **注意**：这些英文 kicker 目前是设计意图（editorial 风格），中文化会改变页面基调。本次只做"不明确的"和"过大"的：先处理首页和档案页的英文标签 + 档案页标题缩小。其余页面的英文 label（如 `Lineup Board`、`Tactical Scenarios`、`Data Center`）保持不变——它们作为单页 eyebrow 不会造成"意义不明确"。

### 涉及文件

- `src/components/home-overview.tsx`：kicker 标签文案 + 跳转按钮文案对齐
- `src/components/home-overview.module.css`：alert title 字号
- `src/components/player-profile-editor.tsx`：kicker 标签文案
- `src/components/player-profile-editor.module.css`：档案名标题字号
- `src/components/app-shell.tsx`：首页 eyebrow
- `src/components/app-shell.module.css`：可能无需改动（主标题保留）
- 各页面测试：文案匹配更新

### 验证

- [ ] 首页、档案页视觉验证
- [ ] `npm test` — 所有涉及文案匹配的测试通过

---

## Slice 4 — 比赛数据独立页 `/players/[playerId]/games`

### 路由

- `src/app/players/[playerId]/games/page.tsx`（Server Component：auth gate + workspace 加载）
- 渲染 `GamesPageClient`

### 新增文件

| 文件 | 职责 |
|---|---|
| `src/app/players/[playerId]/games/page.tsx` | Server route |
| `src/components/games-page-client.tsx` | 页面状态中枢：workspace/version、tab 切换、新增/编辑/删除记录、save + conflict |
| `src/components/games-page-client.module.css` | 样式 |
| `src/components/games-page-client.test.tsx` | 测试 |

### 页面结构

```
PlayersProfilePage 已有档案页
  └── 新增 tab / 链接入口 → /players/[playerId]/games

GamesPage
  ├── AppShell（复用全局壳层）
  ├── Player identity bar（姓名 + 背号 + 位置摘要）
  ├── Tab bar：「正式比赛」「训练比赛」
  ├── 对应 tab 的比赛记录列表
  │   每行：日期 / 对手 / 打席 / 安打 / HR / 打点 / 防御率(if pitcher) / [编辑] [删除]
  ├── 「+ 新增比赛」按钮
  └── 合计摘要卡（按当前 tab 汇总攻击 + 投球指标）
```

### 表单设计（新增 / 编辑弹层）

两种模式共用同一个 `<dialog>` 表单：

**比赛类型切换**：正式 / 训练

**攻击数据**（必填行）：
- 日期、对手
- 打席 PA / 打数 AB / 安打 H / 本垒打 HR / 打点 RBI / 得分 R / 盗垒 SB / 四坏 BB / 三振 SO

**投球数据**（可选展开）：
- 投球局数 IP / 自责分 ER / 投球三振 SO / 投球四坏 BB / 被安打 H

### 合计摘要卡

按当前 tab 汇总：

| 攻击合计 | 投球合计（如有数据） |
|---|---|
| 打席 / 打数 / 安打 / 打击率 | 投球局数 / 自责分 / 防御率 |
| HR / 打点 / 得分 / 盗垒 | 投球三振 / 投球四坏 / WHIP |
| 四坏 / 三振 | |

打击率和防御率都在渲染层计算，不持久化到 workspace。

### 数据流

```
GamesPageClient
  ├── 从 workspace 读取 player.profile.games
  ├── 增 / 删 / 改 → 构造新 workspace
  └── saveWorkspaceSnapshot() → 乐观并发 + 冲突重试
```

与档案页编辑的模式一致：不引入新 API，走 `/api/workspace`。

### 验证

- [ ] 导航到 `/players/[playerId]/games` 正常渲染
- [ ] 正式 / 训练 tab 切换正常
- [ ] 新增记录后列表更新
- [ ] 删除记录后列表更新
- [ ] 合计摘要卡数值正确
- [ ] save 后刷新不丢失
- [ ] `npm test` / `npm run lint` / `npm run build` 通过

---

## 实施顺序

建议：**Slice 1 → 2 → 3 → 4**

- Slice 1 先落地数据模型（所有后续 slices 的依赖）
- Slice 2 独立、改动面小，可先收掉
- Slice 3 独立、改动面小，可先收掉
- Slice 4 最重，在所有前置 work 就绪后推进

---

## 新增 / 修改文件总览

```
src/lib/
├── workspace.ts                        # + GameRecord 类型、sanitizer、默认值、字段改名
└── workspace.test.ts                   # 适配

src/app/players/[playerId]/games/
└── page.tsx                            # 新增 server route

src/components/
├── games-page-client.tsx               # 新增
├── games-page-client.module.css        # 新增
├── games-page-client.test.tsx          # 新增
├── player-profile-editor.tsx           # 字段 label 改、kicker 中文、字号缩小
├── player-profile-editor.module.css    # 字号缩小
├── player-profile-editor.test.tsx      # 适配
├── home-overview.tsx                   # kicker 中文
├── home-overview.module.css            # alert title 字号
└── home-overview.test.tsx（若无则不需要）
```

---

## 风险

| 风险 | 缓解 |
|---|---|
| `armStrengthKmh` → `armStrengthM` 字段改名导致导入旧数据断裂 | sanitizer 读旧字段名做回退（如果不存在新字段，尝试旧字段名） |
| 比赛数据记录数量过多性能差 | 首版不做虚拟滚动，后续按需加 |
| 比赛数据编辑态与档案编辑页 save 不协调 | 比赛页独立的 save 流程，不与档案编辑器联动 |
| 中文化标签改变测试文案 | 统一按新标签更新测试用例 |
