---
status: archived
owner: helm-core
created: 2026-04-24
review_after: 2026-10-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Harness Swarm Runtime Sandbox Final Closeout Plan V1

更新时间：2026-04-24
状态：Plan Accepted

## 1. 背景

Harness gap 顺序已经完成前四刀：

1. `Extension Bundle + Capability Manifest`
2. `Capability Resolution Engine`
3. `Monitor Substrate`
4. `Memory Observability and Budgeting`

剩余 gap 是：

1. `Swarm Isolation + Task Ledger + Plan Gate`
2. `Runtime Server / App Server Seam`
3. `Sandbox Roadmap`

本轮目标是把这三项全部收成 read-only substrate，不直接做真实 swarm UI、runtime server、background worker、remote execution 或 sandbox。

## 2. 本轮目标

新增一组 read-only closeout builders：

- `buildSwarmIsolationPlanGateReadout`
- `buildRuntimeServerSeamReadout`
- `buildSandboxRoadmapReadout`
- `buildHarnessFinalCloseoutSummary`

这些 builder 只输出 operator-readable readout：

- read-only swarm isolation task ledger plan gate
- runtime server seam readout
- sandbox roadmap boundary
- harness final closeout summary

## 3. 影响面

代码：

- `lib/harness-final-closeout.ts`
- `lib/harness-final-closeout.test.ts`

文档与守卫：

- `PLANS.md`
- `docs/README.md`
- `scripts/helm-self-check-refactored.ts`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `docs/reviews/HELM_HARNESS_SWARM_RUNTIME_SANDBOX_FINAL_CLOSEOUT_PLAN_V1.md`
- `docs/reviews/HELM_HARNESS_SWARM_RUNTIME_SANDBOX_FINAL_CLOSEOUT_REPORT_V1.md`

## 4. Swarm 收口规则

`Swarm Isolation + Task Ledger + Plan Gate` 只成立在：

- `isolation_state` 存在
- `task_ledger` 存在
- `mailbox_handoff` 没有 unresolved conflict
- `before_write_plan_gate` 存在
- `authority_boundary` 明确阻止非审阅写入

明确不做：

- swarm isolation 不做 UI 编排
- swarm isolation 不启动 agent
- swarm isolation 不授予写权限
- swarm isolation 不自动 merge outputs
- task ledger 不变成 workflow engine

## 5. Runtime seam 收口规则

`Runtime Server / App Server Seam` 只做 contract/readout：

- `surface_entry`
- `run_thread_lifecycle`
- `review_gate`
- `acknowledgement`
- `trace_observability`
- `authority_boundary`

明确不做：

- runtime server seam 不创建 server process
- runtime server seam 不创建 background worker
- runtime server seam 不创建 remote execution plane
- runtime server seam 不创建新 control plane
- runtime server seam 不接管 app shell

## 6. Sandbox roadmap 收口规则

`Sandbox Roadmap` 只做 boundary contract：

- `current_runtime_truth`
- `short_term_controls`
- `mid_term_controls`
- `long_term_controls`
- `authority_boundary`

明确不做：

- sandbox roadmap 不声明真实 sandbox
- sandbox roadmap 不声明 filesystem isolation
- sandbox roadmap 不声明 network isolation
- sandbox roadmap 不声明 process isolation
- sandbox roadmap 不扩张 extension authority
- sandbox roadmap 不扩张 automation authority
- sandbox roadmap 不扩张 swarm autonomy

## 7. 验证计划

```bash
npx vitest run lib/harness-final-closeout.test.ts
npx eslint lib/harness-final-closeout.ts lib/harness-final-closeout.test.ts scripts/helm-self-check-refactored.ts scripts/helm-self-check.ts scripts/decision-first-boundary-check.ts
DATABASE_URL="mysql://root:***@${HELM_CI_DATABASE_HOST}:3306/helm2026_ci_verify?charset=utf8mb4" npm run self-check
npm run check:boundaries
npm run typecheck
DATABASE_URL="mysql://root:***@${HELM_CI_DATABASE_HOST}:3306/helm2026_ci_verify?charset=utf8mb4" npm run test
npm run build
npm run quality:regression
git diff --check
```

## 8. 完成定义

- `Swarm Isolation + Task Ledger + Plan Gate` 已有 read-only builder、测试、报告和守卫
- `Runtime Server / App Server Seam` 已有 read-only builder、测试、报告和守卫
- `Sandbox Roadmap` 已有 boundary builder、测试、报告和守卫
- `PLANS.md` 明确 Harness gap sequence 已在 read-only substrate 层完成
- 没有把 Helm 写成 generic coding harness、workflow engine、sandbox runtime 或 broad auto-execution plane
