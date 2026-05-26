---
status: archived
owner: helm-core
created: 2026-04-24
review_after: 2026-10-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Runtime Server Minimal Implementation Report V1

更新时间：2026-04-24
状态：Delivered on Branch

## 1. 结论

本轮完成 Runtime Server Minimal Implementation V1：在本地纯函数层新增共享 runtime seam 和窄 worker queue。

新增能力只覆盖：

- lifecycle event
- review request
- acknowledgement
- monitor event
- handoff
- local reducer / operator review worker queue

这不是 server process，也不是 remote execution plane、真实 sandbox 或 swarm UI。

## 2. 本轮落点

### 2.1 Local runtime seam

`lib/runtime-server-minimal.ts` 新增 `buildRuntimeServerMinimalThread`：

- 将 `lifecycle_event` 收成 shared lifecycle posture
- 将 `review_request` 保留为 review-required posture
- 将 `acknowledgement` 映射为 receipt truth，acknowledgement 不等于 official success
- 将 `monitor_event` 映射为 report/review posture，不自动 remediation
- 将 `handoff` 保留为 handoff-ready / delivered 状态，不自动对外发送

输出包含：

- `sourceChain`
- `operatorNextMove`
- `boundaryNotes`
- `workerQueueCandidates`
- `audit.replaySafe`

### 2.2 Narrow worker queue

新增：

- `createRuntimeWorkerQueueState`
- `enqueueRuntimeWorkerQueueItem`
- `planRuntimeWorkerQueueTick`
- `completeRuntimeWorkerQueueItem`
- `deadLetterRuntimeWorkerQueueItem`

queue 行为：

- 使用 `idempotency_key` 去重
- 使用 `lease_token` 做本地 tick 租约计划
- 支持 `dead_letter`
- 只允许 `local_reducer` 与 `operator_review`
- 阻断 `remote_execution`、`real_sandbox`、`swarm_ui`、`external_side_effect`

### 2.3 Summary

新增 `buildRuntimeServerMinimalSummary`：

- 汇总 thread posture
- 汇总 queue counts
- 输出 review / blocked thread keys
- 保留同一组边界说明

## 3. 边界

本轮显式保留：

- local runtime seam only
- runtime server minimal 不创建 remote execution plane
- runtime server minimal 不做真实 sandbox
- runtime server minimal 不做 swarm UI
- worker queue 不执行外部副作用
- acknowledgement 不等于 official success

## 4. 测试覆盖

`lib/runtime-server-minimal.test.ts` 覆盖：

1. lifecycle / review request / acknowledgement / monitor event / handoff 统一进本地 runtime seam
2. acknowledgement 只有在 receipt truth 明确成功时才成为 official success
3. worker queue 通过 `idempotency_key` 幂等入队
4. worker queue tick 只给出本地 reducer / operator review 租约计划，不执行外部副作用
5. remote execution / real sandbox / swarm UI / external side effect 被阻断
6. completion 和 dead letter 只作用于本地 queue item
7. summary 能汇总 posture 与 queue counts

## 5. 验证

本轮已执行：

```bash
./node_modules/.bin/vitest run lib/runtime-server-minimal.test.ts
./node_modules/.bin/eslint lib/runtime-server-minimal.ts lib/runtime-server-minimal.test.ts scripts/helm-self-check-refactored.ts scripts/helm-self-check.ts scripts/decision-first-boundary-check.ts
DATABASE_URL="mysql://root:***@rm-shuyao-dev-pub.mysql.rds.aliyuncs.com:3306/helm2026_ci_verify?charset=utf8mb4" npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run quality:regression
npm run build
./node_modules/.bin/next build --webpack
DATABASE_URL="mysql://root:***@rm-shuyao-dev-pub.mysql.rds.aliyuncs.com:3306/helm2026_ci_verify?charset=utf8mb4" npm run test
DATABASE_URL="mysql://root:***@rm-shuyao-dev-pub.mysql.rds.aliyuncs.com:3306/helm2026_ci_verify?charset=utf8mb4" ./node_modules/.bin/vitest run lib/operating-system/index.test.ts lib/billing/ops-summary.test.ts features/memory/memory-approval-evidence-context.test.ts
git diff --check
```

结果：

- `lib/runtime-server-minimal.test.ts`：通过，1 file / 7 tests
- targeted ESLint：通过，仅保留 `scripts/helm-self-check.ts` 体积超过 500KB 的 Babel deopt notice
- `DATABASE_URL=helm2026_ci_verify npm run self-check`：通过，17 / 17
- `npm run check:boundaries`：通过，新增 `helm_runtime_server_minimal_implementation_boundary`
- `npm run typecheck`：通过
- `npm run lint`：通过，0 errors / 7 existing warnings；warning 不在本轮新增文件内
- `npm run quality:regression`：通过，51 files / 181 tests
- `npm run build`：Turbopack 因临时 worktree 的 symlinked `node_modules` 报 `Symlink [project]/node_modules is invalid, it points out of the filesystem root`
- `./node_modules/.bin/next build --webpack`：通过
- `DATABASE_URL=helm2026_ci_verify npm run test`：未通过；full suite 暴露 3 个当前 main 既有断言漂移后中止归因
- targeted failing tests：复现 3 个非本轮失败，分别是 memory timeline 正则对 JSX 属性位置过窄、billing 中文 copy `settings`/`设置` 漂移、operating-system 中文 copy `阻碍`/`阻塞` 漂移
- `git diff --check`：通过

说明：本轮没有执行 `npm run db:reset` 和 `npm run e2e`。当前改动是纯本地 runtime seam / queue reducer，不涉及 DB schema、seed、browser route 或外部执行；`db:reset` 会改动共享 `helm2026_ci_verify` 数据库，`e2e` 不会提高本轮纯函数 seam 的验证质量。

## 6. 分级结论

| 类别 | 结论 |
| --- | --- |
| 已经完整成立 | 本地 runtime seam 与窄 worker queue 的最小实现 |
| 已成形但仍需下一层 | 真实 runtime server、真实 sandbox、真实 swarm orchestration、remote execution plane |
| 刻意未做 | server process、background daemon、remote execution、真实 sandbox、swarm UI、workflow engine、外部副作用执行 |
| 风险项 | 如果后续把 local queue tick 当成执行器，会突破 review-first / no-external-side-effect 边界 |

## 7. 下一步

本阶段只应继续做收口验证、守卫修正和合并。真实 runtime server / sandbox / remote execution 需要单独立项，不应混入本轮分支。
