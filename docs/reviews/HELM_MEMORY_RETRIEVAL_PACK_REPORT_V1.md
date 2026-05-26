---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Retrieval Pack Report v1

更新时间：2026-04-20
状态：MEM-PACK-004 pure builder implemented

## 1. 本轮目标

完成 `MEM-PACK-004` 的第一刀：新增一个 pure、可测试、可回退的 budgeted retrieval pack builder，让后续 briefing / recommendation / meeting detail surface 能用同一套 selected / omitted trace 消费 memory。

本轮仍不启动：

1. briefing / recommendation / meeting detail surface 全量切换。
2. recommendation ranking owner 改写。
3. meeting memory 写路径去重。
4. review-safe distillation runtime。
5. 自动 promotion、canonical fact rewrite 或 execution authority 扩面。

## 2. 本轮改动

代码：

- `lib/memory/retrieval-pack.ts`
  - 新增 `buildMemoryRetrievalPack` pure builder。
  - 输入包含 surface、object scope、budget、candidate 与 fallback reason。
  - 输出包含 selected items、omitted items、fallback state 与 trace。
  - selection score 只用于 evidence packaging，综合 importance、trust、recency、primary-object match 与 promotion posture。
  - 对 `system_inference / candidate / distillation_candidate` 做降权，避免 inferred pattern 越过 confirmed fact。
  - pre-budget omission 覆盖 duplicate、inactive / invalid、stale、low-trust。
  - budget omission 覆盖 item limit 与 token limit。
  - trace 固定 non-commitment boundary note。
- `lib/memory/retrieval-pack.test.ts`
  - 覆盖预算内 selection、budget omission、duplicate / stale / inactive / low-trust omission，以及 invalid budget fallback。

文档：

- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/reviews/HELM_MEMORY_RETRIEVAL_PACK_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_QUERY_BOUNDARY_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_OBSERVABILITY_BASELINE_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_REQUIREMENTS_UPGRADE_REPORT_V1.md`
- `PLANS.md`
- `docs/README.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| pure pack builder | `buildMemoryRetrievalPack` 不访问 DB，不改写 runtime state，可直接单测 |
| budgeted selection | builder 按 `maxItems` 与 `maxEstimatedTokens` 输出 bounded selected set |
| selected / omitted trace | trace 包含 selected reason、omitted reason、token usage、evidence refs 与 stale suppression refs |
| fallback posture | explicit fallback reason 或 invalid budget 会进入 fallback state，不伪造 selected facts |
| recommendation boundary | trace 明确 pack 只是 evidence packaging，不改变 recommendation ranking、approval ownership 或 commitment authority |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| surface runtime integration | MEM-PACK-004B 已完成 briefing / recommendation / meeting detail 第一轮接入；更广 runtime surfaces 待下一层 |
| diagnostics alignment | Phase 0 diagnostics 仍展示 proxy；下一层需要接正式 selected / omitted trace |
| token estimator | 当前用 conservative text length estimate；下一层可按实际 model tokenizer 或 prompt budget 细化 |
| candidate source adapter | 当前 builder 接收 normalized candidates；下一层需要从 `MemoryFact / Commitment / Blocker / BriefingSnapshot` 组装统一候选 |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| 改 recommendation ranking | pack 只负责 evidence packaging，不接管 judgement / ranking owner |
| 改所有 surface | 先冻结 pure contract，避免一次性扩大 briefing / recommendation / detail 的行为面 |
| 写路径去重 | 这是 `MEM-WRITE-005`，不把 retrieval pack 扩成 write path |
| distillation runtime | 继续保留 review-safe candidate 边界，不自动改 canonical memory |
| 对 shared dev DB 执行 reset | 当前 `.env` 指向 shared MySQL dev datasource，不应默认 reset |

## 6. 风险项

1. MEM-PACK-004B 已让 builder 被 briefing / recommendation / meeting detail 消费；但不能写成所有 memory / runtime surfaces 都已切到 retrieval pack。
2. token 估算是近似值，只适合作为 budget guard，不代表真实模型 tokenizer 的精确用量。
3. duplicate key 仍是 object / fact / normalized value 级别；后续 `MEM-WRITE-005` 已为 meeting `MemoryFact` lane 补第一层 conflict-vs-duplicate guard，但不代表 batch / retry semantics 已完整成立。
4. stale suppression 当前只按 candidate freshness score 判断，后续 richer connector 进入后需要更细时间窗。

## 7. 验证结果

本轮已运行：

```bash
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
npm run test -- lib/memory/retrieval-pack.test.ts lib/memory/query-contract.test.ts lib/memory/query-routes.test.ts lib/observability/memory-metrics.test.ts lib/evals/memory-evals.test.ts
npm run self-check
npm run check:boundaries
npm run eval:memory
npm run typecheck
npm run lint
npm run test
npm run build
npm run quality:regression
npm run e2e
git diff --check
```

结果：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `./node_modules/.bin/prisma validate --schema prisma/schema.prisma` | 通过 | schema valid；保留既有 `relationMode = "prisma"` index warning 与 package.json prisma config deprecation warning |
| `npm run test -- lib/memory/retrieval-pack.test.ts lib/memory/query-contract.test.ts lib/memory/query-routes.test.ts lib/observability/memory-metrics.test.ts lib/evals/memory-evals.test.ts` | 通过 | 5 个 test files / 13 个 tests 通过 |
| `npm run self-check` | 通过 | 11 / 11 项通过 |
| `npm run check:boundaries` | 通过 | recommendation / commitment / authority 边界检查通过 |
| `npm run eval:memory` | 通过 | extraction 总体 3 / 3 通过；relevance 与 stability category 均为 3 / 3；duplicate_omission category 仍为 0 / 3，继续作为 MEM-WRITE-005 债务 |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `npm run lint` | 通过 | 0 errors；保留既有 5 个 warning |
| `npm run test` | 未通过 | 225 / 231 test files 通过，973 / 988 tests 通过；剩余 15 个失败均为 Helm v2 runtime DB tests 连接默认 `127.0.0.1:3306` 失败 |
| `npm run build` | 通过 | production build 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过 | 51 / 51 test files、180 / 180 tests 通过 |
| `npm run e2e` | 未通过 | 当前 datasource 指向 shared `helm2026`，e2e 内部 `db:reset` 被仓库安全 allowlist 拒绝 |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |

补充说明：

- `npm run db:reset` 未主动运行；当前 `.env` 指向 shared MySQL dev datasource，不应对该库执行 reset。
- MEM-QUERY-003 migration 仍未在 shared dev DB 上自动 apply；需要 staging / CI temp DB 先执行 migration 与 explain 验证。

## 8. 下一阶段最该做的 5 件事

1. MEM-OBS-002B 已将 Phase 0 diagnostics proxy 与 MEM-PACK-004B surface trace 分层展示；下一层继续补正式 trace ledger。
2. 在 staging / CI temp MySQL 环境应用 MEM-QUERY-003 migration，并补 explain 记录。
3. 延续 `MEM-WRITE-005`，在第一层 `MemoryFact` duplicate / conflict guard 之后补 batch / retry semantics 与 operator-review-required failure posture。
4. 评估是否把 `Commitment / Blocker / BriefingSnapshot` 也纳入统一 pack candidate adapter。
5. 保持 recommendation / commitment A-minus 主线不被 selected reason 或 omitted reason 误写成承诺。
