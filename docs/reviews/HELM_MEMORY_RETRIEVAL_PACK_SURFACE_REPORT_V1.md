---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Retrieval Pack Surface Report v1

更新时间：2026-04-20
状态：MEM-PACK-004B surface integration implemented

## 1. 本轮目标

完成 `MEM-PACK-004B`：把 `MEM-PACK-004` 的 pure retrieval pack 接到 briefing、recommendation evidence 与 meeting detail 只读 surface，让三处入口消费同一套 selected / omitted / fallback trace。

本轮仍不启动：

1. recommendation ranking owner 改写。
2. meeting memory 写路径去重。
3. review-safe distillation runtime。
4. diagnostics formal trace 全量替换。
5. 自动 promotion、canonical fact rewrite 或 execution authority 扩面。

## 2. 本轮改动

代码：

- `lib/memory/retrieval-pack-adapter.ts`
  - 新增 `MemoryFact -> retrieval candidate` adapter。
  - 新增 per-surface budget：briefing / recommendation / meeting detail / runtime review。
  - 新增 serializable trace summary，避免 surface 直接吃完整 candidate object。
- `lib/memory/briefing.service.ts`
  - briefing 先读取 bounded candidate facts，再用 retrieval pack 选出实际 `sourceFactIds`。
  - briefing payload 保留 `retrievalPackTrace`。
- `lib/memory/memory-recommendation-bridge.service.ts`
  - recommendation evidence 现在通过 retrieval pack 选择 `supportingFacts`。
  - evidence 返回 `memoryRetrievalPack`，但 ranking 仍由 `rankRecommendationCandidates` 控制。
- `lib/recommendations/types.ts`
- `lib/recommendations/recommendation-presentation.ts`
- `lib/recommendations/recommendation.service.ts`
  - recommendation payload / telemetry 增加 retrieval pack trace summary。
- `features/meetings/queries.ts`
- `features/meetings/meeting-detail-client.tsx`
  - meeting detail 使用 `meeting_detail` pack 选择可见 supporting facts。
  - meeting detail 展示 selected / omitted / fallback 与 non-commitment boundary note。
- `lib/memory/retrieval-pack-adapter.test.ts`

文档：

- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/reviews/HELM_MEMORY_RETRIEVAL_PACK_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_RETRIEVAL_PACK_SURFACE_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_DIAGNOSTICS_TRACE_ALIGNMENT_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_QUERY_BOUNDARY_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_OBSERVABILITY_BASELINE_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_REQUIREMENTS_UPGRADE_REPORT_V1.md`
- `PLANS.md`
- `docs/README.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| MemoryFact adapter | 三处 surface 共用 `buildMemoryFactRetrievalPack`，不重复手写 selection logic |
| briefing surface trace | briefing payload 保留 `retrievalPackTrace`，`sourceFactIds` 来自 selected facts |
| recommendation evidence trace | recommendation evidence / payload / telemetry 可读 pack selected / omitted / fallback |
| meeting detail readout | meeting detail 显示 pack selected / omitted / fallback，并保留 non-commitment boundary |
| ranking boundary | pack 只控制 evidence loading，recommendation ranking 仍由 existing ranking service 决定 |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| diagnostics formal trace | MEM-OBS-002B 已完成第一轮 diagnostics surface trace alignment；更正式 trace ledger 仍待下一层 |
| fail-open runtime switch | builder 已有 fallback state；如果未来 pack adapter 异常，需要更显式的 fail-open 开关 |
| candidate coverage | 当前 pack candidate 主要来自 `MemoryFact`，commitment / blocker / briefing snapshot 仍保留在原 evidence lane |
| tokenizer accuracy | token estimate 仍是 conservative text length estimate |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| 改 ranking service | recommendation ranking owner 必须继续留在规则 / ranking service |
| 写路径去重 | 这是 `MEM-WRITE-005`，不把 retrieval surface 接入扩成 write path |
| distillation runtime | 继续保留 review-safe candidate 边界 |
| 全 runtime surface 切换 | 本轮只接 briefing / recommendation / meeting detail |
| 对 shared dev DB 执行 reset | 当前 `.env` 指向 shared MySQL dev datasource，不应默认 reset |

## 6. 风险项

1. meeting detail 可见 facts 现在来自 pack selected set，过紧 budget 可能让某些低分事实不再首屏可见。
2. commitment / blocker 还没有统一进入 pack candidate，因此 selected / omitted trace 暂时只覆盖 facts lane。
3. diagnostics 已区分 proxy baseline 与 surface trace，但 meeting detail trace 仍是 bounded sample，不是完整用户行为 ledger。
4. token estimate 仍是近似值，不能写成模型 tokenizer 精确消耗。

## 7. 验证结果

已运行：

```bash
npm run test -- lib/memory/retrieval-pack.test.ts lib/memory/retrieval-pack-adapter.test.ts lib/memory/query-contract.test.ts lib/memory/query-routes.test.ts lib/observability/memory-metrics.test.ts lib/evals/memory-evals.test.ts
npm run self-check
npm run check:boundaries
npm run eval:memory
npm run typecheck
npm run lint
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
npm run test
npm run build
npm run quality:regression
npm run e2e
git diff --check
```

结果：

| 命令 | 结果 |
| --- | --- |
| targeted memory tests | 通过，6 files / 16 tests |
| `npm run self-check` | 通过，11 / 11 |
| `npm run check:boundaries` | 通过 |
| `npm run eval:memory` | 通过，总体 3 / 3；既有 `duplicate_omission` 分类仍为 0 / 3 |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过，0 errors；保留既有 5 warnings |
| `prisma validate` | 通过；保留既有 `relationMode = "prisma"` index warning |
| `npm run test` | 未全绿：226 / 232 test files、976 / 991 tests 通过；15 个 Helm v2 runtime DB tests 因无法连接本地 `127.0.0.1:3306` 失败 |
| `npm run build` | 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过，51 files / 180 tests |
| `npm run e2e` | 阻断：脚本缺少 create database 权限后 fallback 到 `db:reset`，但当前 `.env` 指向 shared `helm2026`，安全守卫拒绝 reset |
| `git diff --check` | 通过 |

未单独执行 `npm run db:reset`：当前 datasource 是 shared MySQL dev database，本轮只记录 reset 守卫拒绝结果，不对共享库做破坏性 reset。

## 8. 下一阶段最该做的 5 件事

1. 延续 `MEM-WRITE-005`，在第一层 `MemoryFact` duplicate / conflict guard 之后补 batch / retry semantics 与 operator-review-required failure posture。
2. 在 staging / CI temp MySQL 环境应用 MEM-QUERY-003 migration，并补 explain 记录。
3. 把 meeting detail 用户打开时的 pack trace 写入更正式的 read-only event trail。
4. 评估 commitment / blocker / briefing snapshot 是否需要统一进入 pack candidate adapter。
5. 保持 recommendation / commitment A-minus 主线不被 selected reason 或 omitted reason 误写成承诺。
