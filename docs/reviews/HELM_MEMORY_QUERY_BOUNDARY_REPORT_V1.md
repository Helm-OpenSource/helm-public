---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Query Boundary Report v1

更新时间：2026-04-20
状态：MEM-QUERY-003 implemented; MySQL index evidence added

## 1. 本轮目标

完成 `MEM-QUERY-003`：为 Memory Phase 1 补齐 `/api/memory/facts`、`/api/memory/timeline` 与 object-scoped retrieval 的第一轮 bounded query contract，避免高基数 memory 读取继续依赖调用方自律。

本轮仍不启动：

1. broader runtime retrieval pack integration。
2. selected / omitted runtime trace。
3. meeting memory write dedupe。
4. review-safe distillation candidate。
5. 自动 promotion 或 canonical fact rewrite。

## 2. 本轮改动

代码：

- `lib/memory/query-contract.ts`
  - 新增 memory query limit/cursor/pageInfo helper。
  - 定义 facts、timeline、object retrieval 三组 conservative default / max limit。
  - 新增 facts cursor、timeline cursor、stable timeline sort 与 cursor filter。
- `app/api/memory/facts/route.ts`
  - `limit` 进入 default / max clamp。
  - 支持 facts cursor。
  - response 从单纯 status 分组扩展为 `items + activeFacts / observedFacts / archivedFacts / invalidFacts + pageInfo`。
- `app/api/memory/timeline/route.ts`
  - `limit` 进入 default / max clamp。
  - 支持 timeline cursor。
  - response 从数组扩展为 `items + pageInfo`。
  - 多来源 timeline 按 `occurredAt + type/id` 做稳定排序，避免 cursor 翻页重复。
- `lib/memory/memory-fact.service.ts`
  - facts 查询支持 importance / createdAt / id cursor。
  - object-scoped retrieval 增加 max limit clamp，避免内部调用无界扩大。
- `prisma/schema.prisma`
- `prisma/migrations/20260420000100_memory_query_bounded_indexes/migration.sql`
  - 为 `MemoryFact / MemoryEntry / Commitment / Blocker / MemoryCorrection` 增加第一批 memory query 读取索引。
  - MySQL 只读 EXPLAIN 后已补齐 `id` tie-breaker、`MemoryFact` timeline createdAt index、object retrieval updatedAt index，以及 `MemoryEntry` object/entity indexes 的 `deletedAt` 条件。
- `lib/memory/query-contract.test.ts`
- `lib/memory/query-routes.test.ts`

文档：

- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/memory-system/api-examples.md`
- `PLANS.md`
- `docs/README.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| facts bounded contract | `/api/memory/facts` 已支持 default limit、max limit、cursor、`pageInfo` |
| timeline bounded contract | `/api/memory/timeline` 已支持 default limit、max limit、cursor、`pageInfo` |
| stable timeline paging | timeline cursor 使用 `occurredAt / type / id`，翻页不会只依赖时间戳 |
| object retrieval clamp | `getRelevantMemoryFacts` 已有 conservative max limit，防止内部调用扩大读取面 |
| first-index pass | 已补 `MemoryFact / MemoryEntry / Commitment / Blocker / MemoryCorrection` 高频读取索引 |
| targeted tests | 新增 pure contract 与 route contract tests |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| object-scoped retrieval cursor | 当前只做 limit clamp；MEM-PACK-004 已补 pure selected / omitted trace，下一层需要接入 briefing / recommendation / meeting detail surface |
| timeline DB fan-out | 当前每个来源按 `limit + 1` bounded fan-out；后续可用 retrieval trace 进一步收缩来源 |
| full migration-chain proof | shared `helm2026` 有旧失败 migration 与 compatibility view layer；当前只完成只读 EXPLAIN 与 session temporary index 对照，仍需 clean staging / temp schema 跑完整 `db:migrate` |
| API consumer migration | 当前 UI 未直接依赖旧 timeline 数组形态；若未来外部调用，需要按 `items + pageInfo` 消费 |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| broader retrieval pack integration | MEM-PACK-004B 已完成 briefing / recommendation / meeting detail 第一轮接入；更广 runtime surfaces 不在 query hardening 报告中追写 |
| 写路径去重 | 这是 `MEM-WRITE-005`，不把 query hardening 扩成 write path |
| canonical memory rewrite | 继续保留 review-first / non-auto-promotion 边界 |
| 对 shared dev DB 执行 reset | 当前 `.env` 指向 shared MySQL dev datasource，不应默认 reset |

## 6. 风险项

1. timeline 仍是多来源 fan-out 后合并排序；虽然已 bounded，但不是单表 materialized timeline。
2. object-scoped retrieval 只先 clamp limit；pure retrieval trace 已在 MEM-PACK-004 落地，但正式 surface runtime trace 仍需下一层接入。
3. shared `helm2026` 当前不是 clean Prisma migration target：`20260416000100_longtext_meeting_opportunity_summaries` 旧失败 migration 阻断后续 migration，且关键 memory 对象当前是 compatibility views。
4. response shape 已从 legacy array 扩展为 `items + pageInfo`；当前 repo 内未发现直接 fetch consumer，但未来外部调用方需要按新 contract 调整。
5. session-only temporary EXPLAIN 能证明索引形态，但不能替代真实 migration-applied staging schema 的最终性能证据。

## 7. 验证结果

本轮已运行：

```bash
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
npm run test -- lib/memory/query-contract.test.ts lib/memory/query-routes.test.ts lib/observability/memory-metrics.test.ts lib/evals/memory-evals.test.ts
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
| `./node_modules/.bin/prisma validate --schema prisma/schema.prisma` | 通过 | schema valid；保留既有 relationMode warning |
| `npm run test -- lib/memory/query-contract.test.ts lib/memory/query-routes.test.ts lib/observability/memory-metrics.test.ts lib/evals/memory-evals.test.ts` | 通过 | 4 个 test files / 10 个 tests 通过 |
| `npm run self-check` | 通过 | 11 / 11 项通过 |
| `npm run check:boundaries` | 通过 | recommendation / commitment / authority 边界检查通过 |
| `npm run eval:memory` | 通过 | extraction 总体 3 / 3 通过；relevance 与 stability category 均为 3 / 3；duplicate_omission category 仍为 0 / 3，继续作为 Phase 3 写路径去重债务 |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `npm run lint` | 通过 | 0 errors；保留既有 5 个 warning |
| `npm run test` | 未通过 | 224 / 230 test files 通过，970 / 985 tests 通过；剩余 15 个失败均为 Helm v2 runtime DB tests 连接默认 `127.0.0.1:3306` 失败 |
| `npm run build` | 通过 | production build 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过 | 51 / 51 test files、180 / 180 tests 通过 |
| `npm run e2e` | 未通过 | 当前 datasource 指向 shared `helm2026`，e2e 内部 `db:reset` 被仓库安全 allowlist 拒绝 |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |
| shared dev DB read-only migration/index inventory | 通过 | `helm2026` 可连接；目标 Mem migrations 未记录，目标 index count 为 0；发现旧失败 migration 和 view/base-table blocker |
| shared dev DB read-only EXPLAIN | 通过 | 当前旧索引下 facts / memory entry / correction 仍出现 `Using filesort`，write guard 只能走 `index_merge` |
| session-only temporary index EXPLAIN | 通过 | 加 `id` tie-breaker 后 facts / memory entry order path 从 `Using filesort` 变成 `Backward index scan`；write guard composite index 变成单索引 `ref` |
| `./node_modules/.bin/prisma validate --schema prisma/schema.prisma` | 通过 | 修正索引后 schema valid；保留既有 relationMode warnings |

补充说明：

- `npm run db:reset` 未主动运行；当前 `.env` 指向 shared MySQL dev datasource，不应对该库执行 reset。
- 新 migration 已写入仓库，但未在 shared dev DB 上自动 apply；当前 shared DB 旧失败 migration 与 compatibility view layer 会阻断 full migrate。
- 尝试创建同 RDS 临时验证库被权限拒绝，且未留下可见 `helm2026_memverify_%` schema；需要提供 clean staging / temp schema 权限后复跑。

## 8. 下一阶段最该做的 5 件事

1. MEM-OBS-002B 已把 Phase 0 diagnostics proxy 与 MEM-PACK-004B surface trace 分层展示；下一层继续补正式 trace ledger。
2. 保持 pack trace 只解释 evidence packaging，不改变 recommendation ranking owner。
3. 在 staging MySQL 上应用 MEM-QUERY-003 migration 并补 explain 记录。
4. 延续 `MEM-WRITE-005`，在第一层 `MemoryFact` duplicate / conflict guard 之后补 batch / retry semantics。
5. 评估 commitment / blocker / briefing snapshot 是否需要统一进入 pack candidate adapter。
