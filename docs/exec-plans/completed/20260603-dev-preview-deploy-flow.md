# dev 分支开发 + Vercel Preview 部署流程

## 目标

建立并记录一套清晰流程：日常开发走 `dev` 分支，推送到 `dev` 后自动生成 Vercel Preview 部署；`main` 继续保持自动 Production 部署。

## 当前证据

基于仓库当前状态可确认：

- 本地与远程都存在 `dev` 分支与 `main` 分支
- `.github/workflows/ci.yml` 当前会对所有 push 跑 CI，对 `main` 的 PR 也会跑 CI
- 仓库中没有 `vercel.json` 或其他 repo-local 的 Vercel 分支路由配置；`.vercel/` 仅包含本地 link 信息，不应提交
- `docs/ARCHITECTURE.md` 也明确说明：当前仓库没有项目内的部署配置，Vercel 行为主要由 Vercel/Git 集成侧控制
- 已通过 `npx vercel api /v9/projects/...` 验证：当前链接仓库为 `fristzzz/baseball-player-manager`，`link.productionBranch = "main"`
- 已通过 Vercel Project API 验证：项目当前同时存在 `production` 目标（`main`）与 `preview` 目标（最近一次来自 `dev`）
- Vercel 官方文档说明：若 Git 仓库已连接，默认会对**非生产分支的 push**创建 Preview Deployment，对**生产分支**创建 Production Deployment

## 范围

- 明确 `dev` / `main` 的职责边界
- 确认 Vercel 项目的 Production Branch 仍为 `main`
- 确认 `dev` 分支 push 会触发 Preview，而不会提升到 Production
- 如有需要，补充仓库内文档或 GitHub workflow，减少误操作
- 记录最终操作步骤，便于后续 agent 或维护者复用

## 不做

- 不改动应用业务代码
- 不把 Vercel 的现有 Production 行为从 `main` 切走
- 不在未确认需求前限制所有其他 feature branches 的部署行为

## 已确认决策

1. `dev` 是**主要开发分支**，但**不是唯一**允许自动 Preview 的分支。
   - 已确认采用：**方案 A**
   - 含义：只要求 `dev` 推送后稳定生成 Preview；其他非 `main` 分支可继续保留 Vercel 默认 Preview 行为

这意味着本次更偏向于：核对并固化现有分支/部署约定，而不是收紧到只允许 `dev` 部署。

## 计划步骤

1. **固化分支策略**
   - 记录 `dev` 为主要开发分支
   - 保持 `main` 为生产发布分支
   - 明确推荐合并路径为 `dev -> main`

2. **核对 Vercel 项目设置**
   - 检查 Vercel 项目的 Production Branch 是否是 `main`
   - 检查 Git 自动部署是否开启
   - 检查是否已有 branch deployment rules 干预默认行为

3. **根据确认结果实施**
   - 如果选择方案 A：通常无需代码改动，主要补充文档/操作约定，并做一次 `dev` 推送验证
   - 如果选择方案 B：在 Vercel 项目设置中限制自动部署分支，仅允许 `dev` 产生 Preview、`main` 产生 Production
   - 如有必要，补充 GitHub 分支保护或 PR 约束

4. **补充仓库文档**
   - 在 README 或运维相关文档中写明：
     - 日常开发分支
     - Preview 与 Production 的触发条件
     - 推荐发布路径（如 `dev` 验证通过后再合并到 `main`）

5. **实际验证**
   - 从 `dev` 推送一个可识别提交，确认 Vercel 生成 Preview URL
   - 确认该部署没有绑定生产域名
   - 确认 `main` 当前仍保持 Production 部署指向

## 执行结果

- 已用 Vercel Project API 确认 `link.productionBranch = "main"`
- 已将仓库文档补充为明确的双分支流程说明（`README.md`）
- 已将修复提交推送到 `origin/dev`：`fb1864e`
- Vercel 已为该 `dev` 提交创建 Preview 部署：
  - commit sha: `fb1864ec13048088cd0cb445d229a0b6de6a7cf4`
  - preview url: `https://baseball-player-manager-r1xp86a02-kennys-projects-5914ded3.vercel.app`
  - branch alias: `https://baseball-player-manager-git-dev-kennys-projects-5914ded3.vercel.app`
  - target: `preview`（未绑定生产域名）
- 当前 Production 仍指向 `main`：
  - commit sha: `2c058523795b86374216f8ce3962fd48f5e64e0d`
  - production alias 仍包含 `https://hitsz-baseball.online`

## 验证

- [x] `git push origin dev` 后，Vercel 自动生成 Preview Deployment
- [x] `dev` 部署不会接管 Production 域名
- [x] `main` 当前仍保持 Production 部署
- [x] 仓库文档与实际流程一致

## 进度

- [x] 2026-06-03 — 读取仓库内 CI / 分支 / 文档现状
- [x] 2026-06-03 — 确认 `dev` 分支策略边界（采用方案 A：`dev` 为主要开发分支，但不限制其他非 `main` 分支的 Preview）
- [x] 2026-06-03 — 核对 Vercel 分支部署设置（已确认 GitHub 已连接，Production Branch = `main`，且 `dev` 最近一次部署为 Preview）
- [x] 2026-06-03 — 更新仓库文档
- [x] 2026-06-03 — 用真实推送验证 Preview / Production 行为
