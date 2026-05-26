---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_ENGINEERING_DELIVERY_REVIEW_PLAN_V1

## 1. 范围

本轮只在现有 `/reports` 里增加一块 internal-only 的工程交付复盘视图，基于当前仓库 git 历史读取贡献者工作内容、数量、质量信号、交付充分度和协同风险。

本轮明确不做：

- live GitHub API / PR review / issue / CI 集成
- 新 schema、持久化 telemetry object 或 engineering BI 平台
- 自动绩效打分、自动裁员建议或任何自动管理决策
- 多仓库聚合、组织级工程控制台或 workflow expansion

## 2. 当前状态

当前 `reports` 已有管理者周报、business-loop gap readout 和 insight governance posture，但还没有一层可复用的工程团队交付复盘：

- 谁主要在推进什么
- 哪些提交有 docs / tests / guardrails 闭环
- 哪些关键路径过度集中在单一 contributor
- 哪些共享文件已经出现协同重叠
- 当前工程方向是否还对齐 Helm 的 current-main priority

## 3. 目标

1. 在 `/reports` 前台增加一块 judgement-first 的工程交付 readout。
2. 用当前仓库 git 历史和 `.mailmap` 汇总 contributor output，而不是凭空构造数据。
3. 对每个 contributor 给出：
   - 工作内容焦点
   - 数量读数
   - 质量信号
   - 方向判断
   - 交付充分度
   - 下一步改进建议
4. 对团队给出：
   - ownership pressure
   - collaboration hotspot
   - current blocker
   - next management suggestion
5. 缺少 git 仓库访问时必须优雅降级，不伪造 GitHub 事实。

## 4. 影响面

- `app/(workspace)/reports/page.tsx`
- `features/reports/reports-client.tsx`
- `features/reports/engineering-delivery-review-panel.tsx`
- `lib/reports/engineering-delivery-review.ts`
- `lib/reports/engineering-delivery-review.test.ts`
- `README.md`
- `docs/README.md`
- `PLANS.md`

## 5. 关键假设

1. Helm 当前先服务 Helm 团队自身，所以“当前仓库 git 历史”可以作为第一版工程团队管理输入源。
2. commit 历史只足够形成 heuristic judgement，不足以形成正式绩效结论。
3. contributor identity 以 git author + `.mailmap` 为准，不尝试额外做人事、角色或组织结构推断。

## 6. 风险

1. 运行环境可能没有 `.git` 或 `git` 命令，所以必须保持 fallback posture。
2. 单纯 commit 数会误导，所以必须把 docs / tests / guardrails / shared-file overlap 一起纳入判断。
3. heuristic 如果写得过满，会被误读成正式 code review 或绩效评分。

## 7. 验证

- `npx vitest run lib/reports/engineering-delivery-review.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run lint`
- `npm run test`
- `npm run build`

完整仓库验证链仍建议继续沿：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```
