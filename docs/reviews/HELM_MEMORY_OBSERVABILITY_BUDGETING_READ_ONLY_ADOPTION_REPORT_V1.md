---
status: archived
owner: helm-core
created: 2026-04-24
review_after: 2026-10-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Observability Budgeting Read-Only Adoption Report V1

更新时间：2026-04-24
状态：Delivered on Branch

## 1. 结论

本轮把 Harness gap 里的第四步 `Memory Observability and Budgeting` 从 plan-only 推进到 read-only implementation：

- 新增 `buildMemoryObservabilityBudgetReadout`
- 新增 `buildMemoryObservabilityBudgetSummary`
- 把已有 `MemoryRetrievalPackSurfaceTrace` 收成 operator-readable `memory index + load budget + load trace`
- 覆盖 healthy trace、budget pressure、fallback trace、missing trace 和 summary aggregation
- 没有新增完整 memory trace ledger、startup memory runtime、distillation runtime、auto-promotion、canonical fact write-back 或 recommendation ranking authority

## 2. 本轮落点

### 2.1 Read-only builder

- `lib/memory-observability-budgeting.ts`
  - `buildMemoryObservabilityBudgetReadout`
  - `buildMemoryObservabilityBudgetSummary`
  - `MemoryObservabilityBudgetReadout`
  - `MemoryObservabilityBudgetSummary`

Builder 保持纯函数：

- 不读 DB
- 不写 DB
- 不调用 LLM
- 不改 retrieval pack
- 不改 recommendation ranking
- 不触发 memory promotion
- 不写 canonical fact

### 2.2 Targeted tests

- `lib/memory-observability-budgeting.test.ts`
  - healthy retrieval trace -> `ok / within_budget`
  - budget-driven omitted reasons -> `watch / budget_pressure`
  - fallback trace -> `fallback / fallback_used`
  - missing trace -> `review / insufficient_trace`
  - summary aggregation -> highest priority operator next move

## 3. 当前已覆盖 posture

当前 posture 覆盖：

- `ok`
- `watch`
- `review`
- `fallback`

当前 reason code 覆盖：

- `within_budget`
- `budget_pressure`
- `budget_exceeded`
- `fallback_used`
- `insufficient_trace`
- `scope_empty`

当前 source chain 覆盖：

- `trace_truth`
- `index_scope`
- `load_budget`
- `authority_boundary`

## 4. 保留边界

本轮继续明确：

- read-only memory observability budgeting 不是新 memory runtime
- memory observability 不创建完整 memory trace ledger
- memory observability 不启动 distillation runtime
- memory observability 不改变 retrieval selection
- memory observability 不改变 recommendation ranking
- memory observability 不改变 approval routing
- memory observability 不做 auto-promotion
- memory observability 不写 canonical facts
- load budget 是 conservative estimate，不是精确 tokenizer bill

## 5. 验证

本轮已执行：

```bash
npx vitest run lib/memory-observability-budgeting.test.ts
DATABASE_URL="mysql://root:***@${HELM_CI_DATABASE_HOST}:3306/helm2026_ci_verify?charset=utf8mb4" npm run self-check
npm run check:boundaries
npm run typecheck
npx eslint lib/memory-observability-budgeting.ts lib/memory-observability-budgeting.test.ts scripts/helm-self-check-refactored.ts scripts/helm-self-check.ts scripts/decision-first-boundary-check.ts
DATABASE_URL="mysql://root:***@${HELM_CI_DATABASE_HOST}:3306/helm2026_ci_verify?charset=utf8mb4" npm run test
npm run build
npm run quality:regression
git diff --check
```

结果：

- `npx vitest run lib/memory-observability-budgeting.test.ts`：通过，1 file / 5 tests
- `DATABASE_URL=helm2026_ci_verify npm run self-check`：通过，15 / 15
- `npm run check:boundaries`：通过，含 `helm_memory_observability_budgeting_read_only_adoption_boundary`
- `npm run typecheck`：通过
- 定向 ESLint：通过，仅保留 `scripts/helm-self-check.ts` 体积超过 500KB 的 Babel deopt notice
- `DATABASE_URL=helm2026_ci_verify npm run test`：通过，316 files / 1328 tests
- `npm run build`：通过，仅保留既有 Turbopack NFT tracing warning
- `npm run quality:regression`：通过，51 files / 181 tests
- `git diff --check`：通过

说明：未使用默认 `helm2026` 库作为 test DB；默认库当前不存在，全量 DB-backed test 使用物理隔离验证库 `helm2026_ci_verify` 执行。

## 6. 下一步

下一阶段建议进入 `Swarm Isolation + Task Ledger + Plan Gate` 的只读第一刀；如果要继续 memory 线，则只能接 operator diagnostics readout，仍不做 full trace ledger、distillation runtime 或 auto-promotion。
