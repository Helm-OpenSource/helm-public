---
status: active
owner: helm-core
created: 2026-04-24
review_after: 2026-07-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Runtime Server Minimal Implementation Plan V1

更新时间：2026-04-24
状态：Plan Accepted

## 1. 背景

上一轮 Harness closeout 已经把 `Runtime Server / App Server Seam` 收成 read-only readout，但仍明确没有真实 runtime server、background worker、remote execution plane 或 sandbox。

本轮只向前推进一层最小实现：把共享 lifecycle / review request / acknowledgement / monitor event / handoff 统一到本地 runtime seam，并补一个窄 worker queue。这个 queue 只做本地投影、operator review 和幂等租约计划，不执行外部副作用。

## 2. 本轮目标

新增：

- `buildRuntimeServerMinimalThread`
- `createRuntimeWorkerQueueState`
- `enqueueRuntimeWorkerQueueItem`
- `planRuntimeWorkerQueueTick`
- `completeRuntimeWorkerQueueItem`
- `deadLetterRuntimeWorkerQueueItem`
- `buildRuntimeServerMinimalSummary`

覆盖五类共享事件：

- `lifecycle_event`
- `review_request`
- `acknowledgement`
- `monitor_event`
- `handoff`

## 3. 影响面

代码：

- `lib/runtime-server-minimal.ts`
- `lib/runtime-server-minimal.test.ts`

文档与守卫：

- `PLANS.md`
- `docs/README.md`
- `scripts/helm-self-check-refactored.ts`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `docs/reviews/HELM_RUNTIME_SERVER_MINIMAL_IMPLEMENTATION_PLAN_V1.md`
- `docs/reviews/HELM_RUNTIME_SERVER_MINIMAL_IMPLEMENTATION_REPORT_V1.md`

## 4. 明确不做

- runtime server minimal 不创建 remote execution plane
- runtime server minimal 不做真实 sandbox
- runtime server minimal 不做 swarm UI
- 不创建 server process
- 不创建 background daemon / scheduler
- 不接管 app shell
- 不做 workflow engine
- worker queue 不执行外部副作用

## 5. 实现规则

本地 runtime seam 只负责：

- 归一 lifecycle event
- 保留 review request 为 operator review posture
- 记录 acknowledgement receipt truth，并且 acknowledgement 不等于 official success
- 将 monitor event 映射为 report/review posture，不自动 remediation
- 将 handoff 保留为本地交接状态，不自动对外发送

窄 worker queue 只负责：

- `idempotency_key` 去重
- `lease_token` 本地租约计划
- `dead_letter` 本地失败归档
- `local_reducer` / `operator_review` 两种 effect
- 阻断 `remote_execution`、`real_sandbox`、`swarm_ui`、`external_side_effect`

## 6. 验证计划

```bash
./node_modules/.bin/vitest run lib/runtime-server-minimal.test.ts
./node_modules/.bin/eslint lib/runtime-server-minimal.ts lib/runtime-server-minimal.test.ts scripts/helm-self-check-refactored.ts scripts/helm-self-check.ts scripts/decision-first-boundary-check.ts
DATABASE_URL="mysql://root:***@${HELM_DB_HOST}/helm2026_ci_verify?charset=utf8mb4" npm run self-check
npm run check:boundaries
npm run typecheck
npm run test
npm run build
npm run quality:regression
git diff --check
```

## 7. 完成定义

- 本地 runtime seam 能统一 lifecycle / review request / acknowledgement / monitor event / handoff
- 窄 worker queue 支持幂等入队、租约 tick、completion 和 dead letter
- 不支持的 remote execution / real sandbox / swarm UI / external side effect 会被阻断
- 文档、self-check 和 boundary guard 同步
- 没有把 Helm 扩成真实 runtime server、sandbox runtime、swarm UI 或 remote execution plane
