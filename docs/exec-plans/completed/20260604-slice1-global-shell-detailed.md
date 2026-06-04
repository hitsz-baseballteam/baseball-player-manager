# 20260604 Slice 1 详案：全局壳层重建

## 目标
在**不重写 legacy manager 内部业务交互**的前提下，先重建系统的第一层感知：让用户从解锁页进入首页时，看到的是一个**统一、克制、精致、具有球队作战气质**的产品，而不是“旧页面 + 新组件的拼接体”。

这份详案是 `docs/exec-plans/active/20260604-frontend-redesign-blueprint.md` 中 **Phase 1 / Slice 1** 的执行级拆解。

---

## 一、设计目标（针对这个 slice）

### 1. 要解决的问题
当前问题不是功能缺失，而是**产品感断裂**：
- 解锁页、首页、帮助抽屉、主题切换彼此像不同阶段的产物
- 首页解锁后直接落到 legacy manager，缺少品牌感与结构感
- 信息虽然多，但没有“这是球队总控台”的第一印象

### 2. 这个 slice 的职责
这个 slice 不负责完成整站 IA，也不负责重写阵容逻辑；它负责：
- 统一视觉语言
- 建立新的页面骨架
- 建立新的 header / nav / content frame
- 让 legacy manager 被纳入新的产品壳层中
- 为后续首页总控台、名册页、排阵页提供统一容器与节奏

### 3. 完成后用户应该感受到什么
- “这是一个为球队管理设计过的系统，不是随便拼出来的表单页。”
- “进入系统后马上能找到方向，不会一头扎进旧界面。”
- “虽然内部功能还在逐步迁移，但产品外壳已经统一、成熟、可信。”

---

## 二、视觉方向（更具体）

## 方向名
**Refined Dugout Editorial / 精炼型球队休息区年鉴风**

> 它不是花哨的竞技游戏 UI，也不是极简企业后台。
> 它更像：赛前战术板、球队年鉴、比赛日工作台的混合体。

## 风格关键词
- refined（高级但不浮夸）
- editorial（有编排感，而不是普通 dashboard）
- athletic（有运动张力）
- restrained（克制，不堆特效）
- tactile（有实体感、卡片感、纸感、标记感）

## 本 slice 的风格边界
### 要做
- 高级简洁
- 强结构感
- 明确的标题区和导航层级
- 稍带战术板/年鉴气质的细节
- 少量高质量动效

### 不做
- 不走重度电竞 UI
- 不走紫色渐变 SaaS 风
- 不做过度玻璃拟态
- 不做大面积花纹噪点导致信息难读
- 不让新壳层压过功能可用性

---

## 三、统一风格原则

## 1. 结构统一优先于装饰统一
先统一：
- 页边距
- 最大宽度
- Header 结构
- section 分隔节奏
- 主次按钮逻辑
- 状态标签体系

再统一：
- 光影
- 纹理
- 细节装饰

## 2. “高级简洁”通过以下方式实现
- 少而准的颜色，而不是全页面撒强调色
- 强标题 + 弱辅助 + 很克制的边框体系
- 大面积留白与少量深色锚点形成节奏
- 用材质感和排版感取代花哨图形

## 3. 首页必须具备“总控台”感
即使 legacy manager 仍存在：首页也要先出现：
- 明确的产品标题区
- 导航入口
- 状态摘要
- 内容边界

用户不应在进入系统的第一屏就直接掉进旧 DOM 区域。

---

## 四、信息与页面结构（仅针对 Slice 1）

## A. 未解锁态
### 页面目标
把 `UnlockForm` 从“受保护表单”升级为“比赛日入口”。

### 页面结构
1. **顶层背景层**
   - 深墨绿/夜场蓝绿基底
   - 低对比线条或网格，隐喻战术板/球场草纹
   - 非花哨，但要有气氛

2. **入口主卡**
   - 产品名 / 子标题
   - 一句定位文案：共享工作区、阵容/球员数据管理
   - 口令输入区
   - 错误态 / loading 态

3. **底部说明区**
   - 简短说明：这是共享工作区、为何需要口令
   - 不要写成长帮助文档

### 视觉要求
- 不像登录页模板
- 更像“进入球队控制台的入口封面”
- 文案密度低，视觉重心明确

---

## B. 已解锁首页（壳层）
### 页面目标
为 legacy manager 提供一个**新壳层 + 新秩序**。

### 首页结构（首屏）
1. **Global Header**
   - 产品名
   - 一级导航（先允许部分入口为 disabled / coming soon）
   - 主题切换
   - 帮助入口

2. **Page Masthead**
   - 页面标题：总览 / 比赛日总控台
   - 一句副标题：当前共享工作区状态
   - 右侧轻量状态区：当前主题 / 同步状态 / 工作区说明

3. **Summary Rail / Command Strip**
   - 3~4 个摘要块位
   - 先可以是静态占位或轻量动态信息
   - 例如：球员总数、可用人数、当前方案数、最近同步状态

4. **Legacy Frame**
   - 旧 manager 不裸露在页面上
   - 用统一容器包裹：边界、标题、背景、阴影、节奏一致
   - 未来可在这个 frame 上方/侧边逐步加 React 摘要区

### 首页结构（后续滚动区）
- 预留 section 节奏
- 即使暂时内容还不多，也要给出未来可扩展的页面骨架

---

## 五、组件规划

## 1. `AppShell`
### 职责
- 提供全局页面容器
- 承载 header、masthead、page body
- 为未来更多路由复用

### 应包含
- `variant`: locked / workspace
- `navItems`
- `title`
- `eyebrow`
- `description`
- `actions`
- `children`

### 不负责
- 不承载业务数据变更逻辑
- 不直接操作 workspace

## 2. `AppHeader`
### 职责
- 产品名称
- 一级导航
- theme/help 等全局动作

### 导航策略
本 slice 中导航可以先这样处理：
- `总览`：可点击（当前页）
- 其余入口：可以先渲染为二期入口 / disabled / “即将开放”

这样首页先建立全局导航感，不要求这些页面立刻存在。

## 3. `PageMasthead`
### 职责
- 页面题头
- 产品定位句
- 状态说明

### 设计原则
- 题头必须足够强，建立产品气场
- 不要做成普通 h1 + 段落
- 可以引入编号、小标签、状态 pill、辅助说明

## 4. `LegacyFrame`
### 职责
包裹 `PlayerManagerClient` 当前注入的 legacy markup。

### 设计原则
- 给旧内容一个统一边界
- 不在这个 slice 中深度重写内部旧样式
- 只重建它的“承载环境”

## 5. `ShellStatCard`（可选）
### 职责
首页首屏摘要卡。

### 数据来源
- 先用现有 `initialWorkspace` 衍生的安全统计
- 不新增复杂后端接口

---

## 六、样式系统规划

## 1. Token 规划
建议在 `globals.css` 中新增一层 **shell tokens**，避免直接复用全部旧 theme token：

- `--shell-max-width`
- `--shell-page-gutter`
- `--shell-header-height`
- `--shell-panel-radius`
- `--shell-panel-border`
- `--shell-panel-shadow`
- `--shell-hero-ink`
- `--shell-muted`
- `--shell-accent-soft`
- `--shell-grid-line`

目标：
- 不污染 legacy DOM 内部样式语义
- 为新 React 外壳建立独立语言

## 2. 色彩策略
### 默认主题（Classic）
- 底：暖纸色 / 浅羊皮 / 微奶油
- 主文字：深墨绿黑
- 面板：偏白但不纯白
- 强调：球场墨绿
- 金属强调：旧金黄或铜金
- 危险：锈红

### Night / Field
不推翻主题体系，只把 shell 的材质与层级同步过去。

重点：
- 主题切换后不能只是背景换色
- Header、面板、标签、边框都要整体联动

## 3. 字体策略
### 已知约束
仓库当前已自托管：
- `Inter`
- `Noto Sans SC`

### Slice 1 处理方式
- 正文继续使用现有高可读字体
- 通过字号、字距、字重、标签编排建立高级感
- 暂不在此 slice 强制新增第二套显示字体，以降低风险

### 后续可选增强
如果 shell 稳定后仍觉得标题性格不够，可单独开一个 typography spike，评估是否加入一套**本地自托管 display 字体**。

## 4. 动效策略
### 要做
- 首屏渐入（卡片 / masthead / nav 分层进入）
- hover 轻微抬升
- 状态 pill / 按钮有细腻反馈
- Drawer / overlay 与新壳层节奏一致

### 不做
- 大范围持续动画
- 高耗性能粒子、复杂 3D
- 过度弹跳

原则：
**动效是秩序感，不是噱头。**

---

## 七、具体文件计划

## 预计新增文件
- `src/components/app-shell.tsx`
- `src/components/app-shell.module.css` 或 `src/components/app-shell.css`
- `src/components/app-header.tsx`（如拆分有必要）
- `src/components/page-masthead.tsx`（如拆分有必要）

> 是否拆成多个组件，以实现时复杂度决定；计划上允许 `AppShell` 单文件起步。

## 预计修改文件
- `src/app/page.tsx`
  - 解锁态/已解锁态都挂到统一壳层思路下
- `src/components/unlock-form.tsx`
  - 重做结构与文案布局
- `src/components/player-manager-client.tsx`
  - 把 legacy 容器挂进新壳层
- `src/components/theme-toggle.tsx`
  - 保留逻辑，更新在 header 中的呈现方式
- `src/components/help-drawer.tsx`
  - 让视觉语言与新壳层一致
- `src/app/globals.css`
  - 新增 shell tokens 与新壳层基础样式
- `docs/DESIGN.md`
  - 补充 shell 的设计语言（实现后更新）

## 样式隔离策略
优先推荐：
- 新壳层使用 **CSS Modules**
- 全局只放 token、reset、主题变量、少量全站公用类

原因：
- 减少与 legacy manager class 冲突
- 便于后续模块化迁移

---

## 八、功能边界（本 slice 明确不做）
- 不新建 `/roster`、`/lineup`、`/scenarios` 实际路由页
- 不重写 `player-manager-dom.ts` 内部业务区
- 不修改 workspace 业务模型
- 不重做球员档案页主内容
- 不引入新的后端接口

这能保证 slice 小而完整。

---

## 九、风险与应对

## 风险 1：新壳层和 legacy DOM 冲突
### 应对
- 壳层用独立 CSS 命名空间或 CSS Modules
- 只包装、不覆盖 legacy 内部节点

## 风险 2：首页看起来像“新 header + 旧页面割裂”
### 应对
- 必须加 `LegacyFrame`
- 通过间距、背景、边框、section 标题统一承载
- 首屏先插入新的 masthead / summary strip，建立新秩序

## 风险 3：为了高级感而牺牲可读性
### 应对
- 不滥用浅灰文字
- 不做过度纹理
- 表单和控制按钮仍以清晰优先

## 风险 4：主题切换后新壳层不协调
### 应对
- shell tokens 必须从 theme tokens 映射，而不是写死
- 至少检查 classic / night / field 三套主题下的 header 与 panel

---

## 十、实施顺序（建议）
1. 定义 shell 视觉 token 与页面骨架
2. 实现 `AppShell`
3. 重做 `UnlockForm`
4. 在首页接入 header + masthead + legacy frame
5. 重新安放 `ThemeToggle` / `HelpDrawer`
6. 补齐响应式与交互状态
7. 跑验证并更新文档

## 进度
- [x] 2026-06-04 — 定义 `--shell-*` token，并在 `globals.css` 中落地
- [x] 2026-06-04 — 新增 `AppShell` + `app-shell.module.css`，建立 header / masthead / summary / legacy frame
- [x] 2026-06-04 — 重做 `UnlockForm`，统一为比赛日入口卡片视觉
- [x] 2026-06-04 — 首页接入新壳层，并将 legacy manager 收纳到 `LegacyFrame`
- [x] 2026-06-04 — 调整 legacy manager 挂载根节点，避免直接挂到整个 shell 根上
- [x] 2026-06-04 — 新增 `AppShell` / `PlayerManagerClient` 测试，并同步更新设计、前端与质量文档
- [x] 2026-06-04 — HelpDrawer / GuideOverlay / Toast 通过 `globals.css` 的 shell override 与本地字体栈对齐，并修复 React toast 缺少 `.toast` 基类导致的样式漂移

---

## 十一、验证标准
### 视觉与结构
- [x] 解锁页与首页属于同一产品语言
- [x] 首页首屏不再直接裸露 legacy manager
- [x] Header / Masthead / Summary / LegacyFrame 层级清晰
- [x] classic / night / field 三个主题都成立

### 工程
- [x] 不引入 legacy class 冲突
- [x] `npm test`
- [x] `npm run lint`
- [x] `npm run build`

### 页面核验
- [x] `curl http://localhost:3000` 可命中“进入球队共享工作区”，证明未解锁态入口仍正常
- [x] unlock cookie + `curl -b /tmp/baseball-manager.cookies http://localhost:3000` 可命中“比赛日总控台” / `Baseball Player Manager` / `helpBtn`，证明已解锁首页壳层已生效
- [x] `src/components/theme-toggle.test.tsx` 覆盖主题循环切换
- [x] `src/components/help-drawer.test.tsx` 覆盖抽屉打开/关闭与 replay guide
- [x] `src/components/toast.test.tsx` 覆盖 `.toast` 基类 + 显隐状态，防止 portal 样式回归

---

## 十二、完成定义
这个 slice 完成，不代表首页业务内容已经重构完成；它意味着：

- 产品已经有统一外壳
- 用户进入系统时有一致的品牌感与秩序感
- legacy manager 已被纳入新的页面骨架
- 后续首页总控台与其他页面可以在这个基础上继续演进
