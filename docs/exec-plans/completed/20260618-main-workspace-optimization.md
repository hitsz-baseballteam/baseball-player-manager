# Main 分支端到端性能优化计划

## Original Baseline

- 基线分支: `main`
- 基线提交: `686b1a8`
- 证据来源: `hitsz-baseball.online.har` (`2026-06-18`)
- 目标范围: Panel 路由预取、Workspace I/O 与缓存、字体和静态图片

优化前 HAR 共记录 53 个请求。以下内容描述基线提交的问题,不代表当前工作树:

1. Panel RSC 预取收益低且制造额外负载
   19 个 `/panel*?_rsc=` 请求中有 14 个带 `next-router-prefetch: 1`。这些预取累计约 `7.69s`,平均约 `549ms`;进入 Panel 后会同时预取 settings、hall-of-fame、stats、scoreboard、scenarios、roster。随后 5 次真实导航仍累计约 `13.37s`,平均约 `2.67s`,说明预取没有可靠地转化为导航收益。
2. 真实导航的服务端读取过慢
   `/panel/stats`、`/panel/roster`、`/panel` 的最慢 RSC 请求分别约 `3.37s`、`3.19s`、`3.18s`。当前 `main` 已经按页面拆分读取,但 server read 只有请求内 `cache()` 去重,缺少跨请求缓存和写后显式失效。
3. 读路径存在快照风险
   `getOrCreateWorkspaceSnapshot()` 及其几个 slice reader 在 fast path 中使用多次 `getPool().query()` + `Promise.all` 读取多张关联表。这会减少单次等待,但在并发写期间可能把不同提交版本的数据拼成一个从未真实存在过的 workspace。
4. 写路径 RTT 随数据量线性增长
   `writeNormalizedWorkspace()` 仍然按球员、守备、打线、比赛、里程碑逐行 `insert`。数据规模从演示集扩到真实赛季后,写延迟会接近线性放大。
5. 首访静态资源体积过大
   图片传输约 `3.50MB`,字体约 `3.46MB`。其中 `baseball-field-command-board.png` 约 `2.9MB`;三份 Noto Sans SC 字体每份约 `1.1MB`;`team-logo.png` 约 `204KB`。背景图和队徽当前使用 `max-age=0, must-revalidate`,无法充分利用长期缓存。

## Goals

- 在不放松并发正确性的前提下缩短 workspace 读写延迟
- 减少不会转化为用户导航收益的 RSC 请求和数据库负载
- 保留 `main` 已有的按页面裁剪数据能力
- 降低中等规模数据集下的写入 RTT
- 建立可验证的缓存失效链路,避免私有数据 stale read
- 降低首次访问的字体和图片传输体积

## Non-Goals

- 不修改数据库 schema
- 不引入 Redis、队列或额外基础设施
- 不把 workspace 拆成多资源独立保存模型
- 不追求通过多连接 fan-out 获得“理论最快”但不安全的读取
- 不通过扩大数据库连接池掩盖预取和查询模型问题
- 不为静态资源优化改变现有视觉设计

## Constraints

- `app_*` 表之间存在强关联,单次 workspace 读取需要字段级自洽
- Supabase transaction pooler 场景下连接池可能只能安全使用 `max=1`
- 浏览器侧私有 API 响应仍应保持 `no-store`
- 现有 OCC 语义(`version` + `FOR UPDATE`)不能回退

## Progress

### 2026-06-18

- Phase 0: 已将生产 HAR 的请求数、延迟和资源体积写入基线;部署后的冷/热复测待执行
- Phase 1: 已实现
  - Panel 导航和公开首页 Panel 入口均设置 `prefetch={false}`
  - 本地测试与生产构建通过;部署后需用 HAR 确认 Panel 自动预取降为 0
- Phase 2: 已实现代码路径
  - 完整读取复用单一 hydration 实现
  - 所有 slice read 使用单个 `PoolClient` 和 `REPEATABLE READ READ ONLY` 事务
  - full/bootstrap/games/milestones 使用统一 tag 的 `unstable_cache`
  - 成功写入后通过 `revalidateTag()` 同时失效全部 workspace 读取缓存
  - 数据库延迟和缓存命中率待部署后测量
  - slice reader 仍保留各自的 projection mapping;当前未抽取统一 hydration helper
- Phase 3: 已实现代码路径
  - 各 normalized 子表改为集合式 `jsonb_to_recordset()` 批量插入
  - 保持 meta upsert、wipe + rewrite、外键插入顺序和 OCC 事务语义不变
  - 完整 workspace 的写入往返次数由随记录数增长改为固定上限
  - 已通过真实 PostgreSQL 只读类型转换验证;中型数据集写入基准待部署后执行
- Phase 4: 已实现
  - 新增统一 `useWorkspaceSnapshot()` 管理 SSR 初始值、workspace/version 应用和失败刷新
  - 九个主要 client 页面统一通过 `applySnapshot()` 接收成功响应,通过 `refreshWorkspace()` 处理冲突或失败回滚
  - optimistic workspace 更新和页面级提示策略保持不变
  - 删除无调用方的 `loadBootstrapSnapshot/loadGamesSnapshot/loadMilestonesSnapshot` client helper
  - 新增 hook 回归测试
- Phase 5: 已实现
  - `baseball-field-command-board` 从 2.9MB PNG 转为 269KB WebP,体积降低约 91%
  - `team-logo` 从 204KB PNG 转为 99KB near-lossless WebP
  - 两项资源使用版本化 URL,响应验证为 `public, max-age=31536000, immutable`
  - Noto Sans SC 从三份完整静态字重改为 Fontsource variable Unicode-range 分片
  - 公开首页冷会话实测 Noto 字体约 676KB,相对 HAR 的 3.46MB 降低约 80%
  - Panel 登录页冷会话实测 Noto 字体约 586KB
  - 修复 `globals.css` 中遗漏的根变量块闭合,确保字体变量实际生效
  - 桌面、390px 移动端和 Panel 登录页已完成视觉检查
- Phase 6: 待数据复测后决定是否实施

验证记录:

- `npm test`: 302 tests, 300 passed, 0 failed, 2 todo
- `npm run build`: passed
- 本次修改文件的 ESLint: passed
- 全仓库 `npm run lint`: 被既有 `src/components/scorecard.tsx` React lint errors 阻塞

## Plan

### Phase 0: 固化 HAR 基线与保护网

- 建立可重复的浏览器导航采样,分别记录冷启动与热启动:
  - Panel RSC 请求总数、prefetch 请求数和传输量
  - `/panel`、roster、stats、hall-of-fame 的 TTFB 与导航完成时间
  - 字体、图片和总传输体积
- 记录 API/数据库基线:
  - 冷读/热读 `/api/workspace*`
  - 小型与中型数据集的单次写入耗时
- 补充测试覆盖:
  - 读路径返回的 workspace 结构一致性
  - 写后再次读取的字段级等价性
  - 缓存失效后不会继续返回旧版本 snapshot

### Phase 1: 消除无效 Panel 预取

- 对 `app-shell.tsx` 中 Panel 全量导航链接设置 `prefetch={false}`
- 对 `public-home.tsx` 中进入 Panel 的入口设置 `prefetch={false}`,避免公开首页访问触发私有重型 RSC
- 不默认增加手写 `router.prefetch()`;只有复测证明某一条高概率下一跳能稳定降低导航时间时,才做针对性预取
- 复测确认不再在进入 Panel 后并发预取全部六个兄弟路由

交付标准:

- Panel 初始进入时不产生兄弟路由的自动 RSC 预取风暴
- HAR 中 `next-router-prefetch: 1` 的 Panel 请求从 14 个降到 0 或仅保留经数据证明有效的少量请求
- 真实导航功能和鉴权行为不变

### Phase 2: 修正读路径并增加可控缓存

- 保留 `bootstrap/games/milestones` 三类 slice loader 的 API 形态
- 去掉 fast path 中“多连接并行拼装 workspace”的实现
- 改为:
  - 每次 slice read 使用单个 checked-out `PoolClient`
  - 在一个显式读事务内完成该 slice 所需查询
  - 保留 projection-specific mapping,仅在后续修改触及这些 reader 时抽取稳定的共享 hydration primitive
- 在共享 read API 外层增加带 workspace/slice 维度 key 的 `unstable_cache`
- 对所有成功写入路径调用 `revalidateTag()`,保留 `panel-server` 的 React `cache()` 作为请求内去重
- 保持 `/api/workspace*` 响应头 `private, no-store`;server cache 不依赖浏览器缓存

交付标准:

- `getOrCreateWorkspaceSnapshot()` 和三个 slice reader 都回到单快照读取
- 不再依赖并发 `client.query()` 或多连接 `Pool.query()` fan-out
- 同一版本的重复读取可命中 server cache
- 写入成功后的下一次读取不会返回旧版本 snapshot
- 热导航 RSC 延迟相对 Phase 0 显著下降,目标 P95 小于 `1s`

### Phase 3: 写路径批量化

- 引入 workspace 展平 helper,先把内存中的 workspace 转成各表 row arrays
- 用集合式 `jsonb_to_recordset()` 批量插入替换逐行 `insert`;简单定长数据可按需使用 `unnest()`
- 保持现有 wipe + rewrite 模型不变,只优化写入形态
- 保持现有显式事务和 meta row `FOR UPDATE` 锁,不改变 OCC 隔离语义

交付标准:

- `writeNormalizedWorkspace()` 不再按记录逐条写入
- 中型数据集写入耗时显著低于当前 `main`

### Phase 4: 统一 client snapshot contract

- 用一个统一的 `useWorkspaceSnapshot()` hook 承接:
  - SSR 注入的初始 workspace
  - optimistic mutate
  - 冲突/失败后的 refresh
- 评估三个 `load*Snapshot()` helper 的保留价值:
  - 如果页面仍需要客户端按需懒加载,保留
  - 如果只剩 server-side slice render,删除未使用 helper

交付标准:

- client 侧不再散落“本地 state + 手动 reload”模式
- 409 冲突后的 refresh 路径统一

### Phase 5: 降低字体和图片成本

- 审计全局 `Noto Sans SC` 的实际字重使用,删除未使用字重;优先评估变量字体或按需子集
- 将 `baseball-field-command-board.png` 转为 WebP/AVIF,在可接受视觉误差下显著降低体积
- 压缩 `team-logo.png` 及公开首页大图,为响应式内容图提供合理尺寸
- 对内容寻址或带版本的静态资源设置长期 immutable cache;不对会原路径覆盖的文件盲目设置永久缓存
- 复测移动端和桌面端,确认背景、中文字体回退和图片清晰度无回归

交付标准:

- 首访字体传输量至少降低 `40%`
- `baseball-field-command-board` 体积至少降低 `60%`
- 首访图片与字体合计传输量从约 `6.96MB` 降到 `3MB` 以下

### Phase 6: 只在仍有瓶颈时继续深挖

如果完成前五阶段后,读路径 P95 仍不可接受,再评估更重的方案:

- 单 statement `json_agg/jsonb_agg` 读模型
- 进一步裁剪 slice 数据结构
- 面向统计/名人堂页的只读 projection

这一阶段不默认进入实施。

## Implementation Order

1. Phase 0 基线与测试
2. Phase 1 关闭全量自动预取并复测
3. Phase 2 单快照读取 + server cache + invalidation
4. Phase 3 写路径批量化
5. Phase 4 client contract 收敛
6. Phase 5 字体和图片优化
7. Phase 6 仅在数据证明需要时启动

## Verification

- `npm test`
- `npm run lint`
- `npm run build`
- 手工验证:
  - `/panel`
  - `/panel/roster`
  - `/panel/scenarios`
  - `/panel/stats`
  - `/panel/hall-of-fame`
- 浏览器/HAR 验证:
  - Panel RSC prefetch 数量
  - 每条真实导航的 TTFB、总耗时和 payload
  - 字体、图片和页面总传输量
- 压测/脚本验证:
  - 重复读取命中率
  - 中型数据集单次写入耗时
  - 写后立即读是否返回新版本

## Success Metrics

- 读路径: 保持 snapshot 一致性的前提下,热读接近内存缓存命中成本
- 导航: 不再预取全部 Panel 兄弟路由,热导航 RSC P95 目标小于 `1s`
- 写路径: 中型数据集写入耗时明显优于当前逐条 `insert`
- 资源: 首访字体和图片合计传输量低于 `3MB`
- 代码质量: full reader 只有一套完整 hydration;slice reader 的 projection mapping 不影响快照一致性
- 可靠性: 缓存收益建立在显式失效链路之上,而不是浏览器缓存或不安全 fan-out
