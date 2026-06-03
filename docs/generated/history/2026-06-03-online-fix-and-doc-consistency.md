# 2026-06-03 线上修复与文档一致性校对

## 背景
本次会话围绕 `hitsz-baseball.online` 的线上异常展开，目标包括：

1. 修复解锁后首页 `This page couldn’t load` / `A server error occurred`
2. 确认 Supabase / Vercel 配置路径
3. 修复数据库连接与客户端初始化问题
4. 将修复推送到远程仓库
5. 复查文档与代码一致性，并补充会话记录

## 关键问题与根因

### 1. 解锁后首页 500
**现象**：
- 未解锁时首页正常显示 `UnlockForm`
- `POST /api/unlock` 返回 `204`
- 带解锁 cookie 请求 `/` 时返回 `500`

**根因**：
- 当前项目已恢复为 `pg + DATABASE_URL` 路径
- Vercel 上连接 Supabase 时，`pg@8.21.0` 与 Supabase 连接串中的 `sslmode=require` / TLS 行为在 Node/Vercel 环境下出现兼容问题
- 结果是服务端在读取 `app_workspace` 时失败

**修复**：
- 在 `src/lib/db.ts` 中为 Supabase 主机做连接串规范化：移除 `sslmode` 查询参数，显式传入 TLS 选项，并为 serverless 场景收紧连接池参数
- 推送提交：`fb6e712` — `fix: normalize supabase pg ssl config`

### 2. 页面先正常闪现，随后切到错误页
**现象**：
- SSR 工作区内容能先渲染出来
- 随后浏览器端 hydration / mount 阶段崩溃，页面被 Next.js 错误边界替换

**根因**：
- `src/lib/player-manager-dom.ts` 存在初始化顺序问题
- `bindEvents()` 调用时，`clearAssignmentsLocal` / `resetExampleDataLocal` 仍未初始化
- `render()` 调用时，`renderCtx` 也仍未初始化
- 该问题会导致客户端抛出 `ReferenceError`

**修复**：
- 调整 `player-manager-dom.ts` 内部初始化顺序，将 `renderCtx` / `importCtx` / 本地 helper 定义放到调用前
- 将部分局部 helper 改为函数声明，避免 TDZ 问题
- 新增挂载 smoke test：`src/lib/player-manager-dom.test.ts`
- 推送提交：`e94b6f2` — `fix: hoist legacy manager init before mount`

## 相关提交
- `6cedbda` — `fix: restore pg workspace store and unlock flow`
- `8f47706` — `fix: align docs, workspace client, and migration history`
- `fb6e712` — `fix: normalize supabase pg ssl config`
- `e94b6f2` — `fix: hoist legacy manager init before mount`

## 文档一致性复查
本次复查主要确认以下文档与当前代码一致：

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND.md`
- `docs/DESIGN.md`
- `docs/QUALITY_SCORE.md`
- `docs/design-docs/core-beliefs.md`

### 本次校正项
- `docs/ARCHITECTURE.md`
  - 更新观察日期到 2026-06-03
  - 补充 `db.ts` 中 Supabase/Vercel SSL 兼容处理的事实描述
- `docs/FRONTEND.md`
  - 将 `player-manager-dom.ts` 的近似行数由约 841 修正为约 856
  - 将“难以测试”的表述补充为“已有基础挂载 smoke test，但细粒度 DOM 行为仍难测”
- `docs/design-docs/core-beliefs.md`
  - 将 legacy DOM 管理器的近似行数同步为约 856
- `docs/QUALITY_SCORE.md`
  - 更新测试统计到 58 个结果项（57 通过 + 1 todo）
  - 补充 `db.ts` 的 Supabase SSL 兼容逻辑
  - 补充 `player-manager-dom` 挂载 smoke test
  - 修复技术债表格中的重复/串行错误

## 验证证据
执行过的关键验证包括：

### 代码级
- `npm test` ✅
- `npm run build` ✅
- `npm run lint` ✅（仅 warnings，无 errors）

### 线上级
- `POST https://hitsz-baseball.online/api/unlock` with configured passcode → `204`
- 解锁后访问首页 → `200`
- 浏览器自动化验证页面正文包含：
  - `Workspace v2`
  - `云端工作区已准备`
  - 当前真实工作区数据
- 不再出现：
  - `This page couldn’t load`
  - `A server error occurred`

## 结论
本次线上异常由两层问题叠加造成：

1. **服务端数据库连接兼容问题**（Supabase + `pg` + TLS）
2. **客户端 legacy manager 初始化顺序问题**（TDZ / 挂载阶段崩溃）

两者均已修复并推送远程，当前文档也已与代码状态重新对齐。
