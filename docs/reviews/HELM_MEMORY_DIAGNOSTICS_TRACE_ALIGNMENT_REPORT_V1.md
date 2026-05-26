---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Diagnostics Trace Alignment Report v1

更新时间：2026-04-20
状态：MEM-OBS-002B diagnostics trace alignment implemented

## 1. 本轮目标

完成 `MEM-OBS-002B`：把 `MEM-PACK-004B` 的真实 retrieval pack surface trace 接入 diagnostics，让 operator 能同时看到：

1. `MEM-OBS-002` 的 baseline proxy。
2. briefing / recommendation / meeting detail 的真实 surface pack trace 汇总。

本轮仍不启动：

1. meeting memory 写路径去重。
2. retrieval pack ranking owner 改写。
3. canonical fact rewrite、auto-promotion 或 auto-send。
4. distillation runtime。
5. shared dev DB reset。

## 2. 本轮改动

代码：

- `lib/observability/memory-metrics.service.ts`
  - 新增 `MemoryRetrievalSurfaceTraceOverview`。
  - 从 briefing snapshot payload 读取 `retrievalPackTrace`。
  - 从 recommendation payload 读取 `memoryRetrievalPack`。
  - 对最近 meeting detail 做 bounded sample，并复用 `buildMemoryFactRetrievalPack` 生成 `meeting_detail` trace。
  - 汇总 trace count、selected / omitted、fallback、stale suppression、estimated tokens、source breakdown 与 surface breakdown。
- `features/diagnostics/diagnostics-client.tsx`
  - 在 diagnostics 的 memory readout 中并列展示 baseline proxy 与 surface pack trace。
  - 新增 pack trace by surface、trace source、recent trace refs 三组只读读数。
- `lib/observability/memory-metrics.test.ts`
  - 覆盖 surface trace 汇总、fallback、stale suppression 与 non-commitment boundary。

文档：

- `docs/reviews/HELM_MEMORY_DIAGNOSTICS_TRACE_ALIGNMENT_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_OBSERVABILITY_BASELINE_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_RETRIEVAL_PACK_SURFACE_REPORT_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_MEMORY_REQUIREMENTS_UPGRADE_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| Diagnostics surface trace overview | diagnostics 可读取 briefing snapshot、recommendation payload 与 meeting detail sample 的真实 pack trace |
| Proxy / trace 分层 | baseline proxy 继续保留，真实 surface trace 单独展示，避免口径混淆 |
| Boundary note | surface trace 只解释 evidence packaging，不改变 ranking、approval、commitment 或 write-back authority |
| Test coverage | `memory-metrics.test.ts` 覆盖 surface trace aggregation |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| meeting detail persistence | meeting detail trace 当前是 diagnostics bounded sample，不是用户每次打开 detail 的持久 event trail |
| candidate coverage | 当前 trace 仍主要覆盖 MemoryFact lane，commitment / blocker / briefing snapshot 尚未统一进入 pack candidate |
| write path duplicate guard | 后续 `MEM-WRITE-005` 已完成 meeting `MemoryFact` lane 第一层 duplicate / conflict guard；batch / retry semantics 与 operator review surface 仍待下一层 |
| freeze baseline | 还需要 Phase 3 或 staging explain 后再做更完整 freeze |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| 新 schema / migration | 本轮只读汇总现有 payload 与 bounded sample |
| 改 recommendation ranking | pack 只控制 evidence loading 与 diagnostics trace |
| 改 memory write path | 本轮未改写路径；后续 `MEM-WRITE-005` 已另行完成第一层 `MemoryFact` duplicate / conflict guard |
| 全量 runtime trace ledger | 先补 diagnostics readout，不把局部 trace 写成全平台 trace system |
| reset shared MySQL | 当前 datasource 指向 shared `helm2026`，不能默认 reset |

## 6. 风险项

1. recommendation logs 可能一轮生成多条建议，因此 recommendation trace count 是 payload trace 数，不等于唯一 recommendation run 数。
2. meeting detail sample 是 diagnostics bounded sample，适合作为当前 readout，不等于完整用户行为审计。
3. 如果历史 briefing / recommendation payload 没有 pack trace，diagnostics 会显示较低 trace count，这是 rollout truth，不是数据缺失。
4. token estimate 仍来自 retrieval pack conservative estimate，不能写成模型 tokenizer 精确消耗。

## 7. 验证结果

已运行：

```bash
npm run test -- lib/observability/memory-metrics.test.ts lib/memory/retrieval-pack-adapter.test.ts
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
| targeted memory tests | 通过，4 files / 11 tests |
| `npm run self-check` | 通过，11 / 11 |
| `npm run check:boundaries` | 通过 |
| `npm run eval:memory` | 通过，总体 3 / 3；既有 `duplicate_omission` 分类仍为 0 / 3 |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过，0 errors；保留既有 5 warnings |
| `prisma validate` | 通过；保留既有 `relationMode = "prisma"` index warning |
| `npm run test` | 未全绿：226 / 232 test files、977 / 992 tests 通过；15 个 Helm v2 runtime DB tests 因无法连接本地 `127.0.0.1:3306` 失败 |
| `npm run build` | 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过，51 files / 180 tests |
| `npm run e2e` | 阻断：脚本缺少 create database 权限后 fallback 到 `db:reset`，但当前 `.env` 指向 shared `helm2026`，安全守卫拒绝 reset |
| `git diff --check` | 通过 |

未单独执行 `npm run db:reset`：当前 datasource 是 shared MySQL dev database，本轮只记录 reset 守卫拒绝结果，不对共享库做破坏性 reset。

## 8. 下一阶段最该做的 5 件事

1. 延续 `MEM-WRITE-005`，补 batch / retry semantics 与 operator-review-required failure posture。
2. 在 staging / CI temp MySQL 环境应用 MEM-QUERY-003 migration，并补 explain 记录。
3. 评估 commitment / blocker / briefing snapshot 是否进入 pack candidate adapter。
4. 把 meeting detail 用户打开时的 pack trace 写入更正式的 read-only event trail。
5. 保持 selected / omitted reason 只作为 evidence explanation，不写成 commitment 或 authority。
