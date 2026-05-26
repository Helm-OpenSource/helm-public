---
status: archived
owner: helm-core
created: 2026-04-24
review_after: 2026-10-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Monitor Substrate Read-Only Adoption Report V1

更新时间：2026-04-24
状态：Delivered on Branch

## 1. 结论

本轮把 Harness gap 里的第三步 `Monitor Substrate` 从 plan-only 推进到 read-only implementation：

- 新增 `buildMonitorSubstrateReadout`
- 新增 `buildMonitorSubstrateSummary`
- 覆盖 connector lag、webhook failure、meeting ingest backlog、memory sync anomaly、settlement exception、review queue drift
- 统一输出 `severity / output posture / primary reason / operator next move`
- 保留 `signal_truth -> threshold_check -> review_posture -> authority_boundary`
- 没有新增控制面、scheduler、notification center、auto-execution 或 customer-visible send authority

## 2. 本轮落点

### 2.1 Read-only builder

- `lib/monitor-substrate.ts`
  - `buildMonitorSubstrateReadout`
  - `buildMonitorSubstrateSummary`
  - `MonitorSignalKind`
  - `MonitorReadout`
  - `MonitorSubstrateSummary`

Builder 保持纯函数：

- 不读 DB
- 不写 DB
- 不调用外部服务
- 不触发 webhook replay
- 不发送通知
- 不创建 payout rail

### 2.2 Targeted tests

- `lib/monitor-substrate.test.ts`
  - connector lag within threshold -> `report_only`
  - connector lag over threshold -> `route_to_review`
  - webhook failure -> review routing, not automatic replay
  - settlement exception -> `blocked`
  - summary aggregation -> highest priority next move

### 2.3 Validation drift fix

- `extensions/guangpu/tests/reports-page.extensions.test.ts`
  - 补齐 `@/lib/workspace-identity` mock 的 `canViewEngineeringDeliveryReview`
  - 这是全量 Vitest 暴露的测试替身 drift，不改变 reports page runtime 行为

## 3. 当前已覆盖 posture

当前 severity 覆盖：

- `ok`
- `watch`
- `escalate`
- `blocked`

当前 output posture 覆盖：

- `report_only`
- `route_to_review`
- `human_ack_required`
- `blocked`

当前 reason code 至少覆盖：

- `within_threshold`
- `connector_lag_detected`
- `webhook_receipt_stale`
- `meeting_ingest_backlog`
- `memory_sync_anomaly`
- `settlement_exception_open`
- `review_queue_drift`
- `manual_ack_required`
- `insufficient_signal`

## 4. 保留边界

本轮继续明确：

- read-only monitor substrate 不是新控制面
- monitor substrate 不接管 source system truth
- monitor substrate 不做 scheduler
- monitor substrate 不做 notification center
- monitor substrate 不做 auto-execution
- monitor substrate 不做 customer-visible send
- settlement exception monitor substrate 不创建 payout rail、不标记付款、不越过 manual settlement guard

## 5. 验证

本轮已执行：

```bash
npx vitest run lib/monitor-substrate.test.ts
DATABASE_URL="mysql://root:***@rm-shuyao-dev-pub.mysql.rds.aliyuncs.com:3306/helm2026_ci_verify?charset=utf8mb4" npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
DATABASE_URL="mysql://root:***@rm-shuyao-dev-pub.mysql.rds.aliyuncs.com:3306/helm2026_ci_verify?charset=utf8mb4" npm run test
npx vitest run extensions/guangpu/tests/reports-page.extensions.test.ts
npm run build
npm run quality:regression
npx eslint lib/monitor-substrate.ts lib/monitor-substrate.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts scripts/helm-self-check-refactored.ts scripts/helm-self-check.ts scripts/decision-first-boundary-check.ts
git diff --check
```

结果：

- `monitor-substrate` targeted tests 5/5 通过
- Guangpu reports page extension targeted tests 3/3 通过
- `self-check` 覆盖 monitor substrate adoption 文件和关键 snippet
- `check:boundaries` 覆盖 read-only / review-first / no auto-execution / no notification center / no payout rail 边界
- `typecheck` 通过
- `lint` 通过，保留 7 个 existing warnings
- 隔离库全量 `npm run test` 315/315 test files、1323/1323 tests 通过
- `build` 通过，保留既有 Turbopack NFT tracing warnings
- `quality:regression` 51/51 test files、181/181 tests 通过
- `git diff --check` 通过

另外尝试了隔离库 `npm run e2e`。该命令完成 `db:reset` / seed / build 后，在当前本地 dirty worktree 下失败 8 个既有页面可见性 / 文案断言；本地同时存在非本轮 Prisma / seed 脏变更，因此该 e2e 结果不作为本轮 read-only monitor substrate 的 clean branch gate。

## 6. 下一步

下一阶段建议继续做 `Memory Observability and Budgeting` 的 read-only 第一刀，而不是直接进入 scheduler、notification center、runtime server 或 swarm orchestration。
