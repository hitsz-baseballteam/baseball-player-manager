# 2026-06-02 文档事实校对

## 范围
- 已检查：`README.md`、`AGENTS.md`、`docs/*.md`、`docs/design-docs/*.md`
- 未逐项重写：`docs/generated/history/` 与 `docs/exec-plans/completed/`（这些属于历史记录）

## 已修正的文档漂移

1. **主题系统描述**
   - `docs/DESIGN.md`
   - 修正主题变量数量为 14
   - 修正主题切换责任方为 `src/components/theme-toggle.tsx`
   - 补全 `src/app/layout.tsx` 暴露的字体变量

2. **前端架构描述**
   - `docs/FRONTEND.md`
   - 修正 `PlayerManagerClient` 的实际职责
   - 修正首页传参示意，匹配 `src/app/page.tsx`
   - 修正导入净化链路与样式约束中的 `composes:` 说法

3. **安全文档**
   - `docs/SECURITY.md`
   - 修正 cookie `secure` / `sameSite` 描述，匹配 `src/app/api/unlock/route.ts`
   - 修正限流现状，匹配 `src/lib/rate-limiter.ts`
   - 修正 RLS 状态，匹配 `supabase/migrations/20260529093022_create_app_workspace.sql`

4. **可靠性文档**
   - `docs/RELIABILITY.md`
   - 修正并发冲突后的自动重试现状，匹配 `src/lib/workspace-client.ts` 与 `src/lib/player-manager-dom.ts`
   - 删除“显式事务保护”等不准确表述，改为单语句原子写入
   - 修正客户端错误传播与导入失败提示描述
   - 移除仓库内无证据的数据库备份断言

5. **ADR / 规则 / 质量文档**
   - `docs/design-docs/adr-001-dom-migration-and-ci.md`
   - `docs/design-docs/adr-003-hmac-cookie-auth.md`
   - `docs/design-docs/adr-004-optimistic-concurrency.md`
   - `docs/design-docs/core-beliefs.md`
   - `docs/PLANS.md`
   - `docs/QUALITY_SCORE.md`
   - 主要修正行数、CI 矩阵、限流、自动重试等已变更事实

## 仍保留的非代码型判断
以下内容未按“代码事实”改写，因为它们属于产品判断、设计原则或 ADR 背景，而非可直接由源码验证的行为声明：
- 单人教练工具定位
- 优先级判断（P0/P1/P2/P3）
- 渐进式迁移的价值判断

## 验证
- `npm test` 通过（42/42）
- `npm run lint` 通过
