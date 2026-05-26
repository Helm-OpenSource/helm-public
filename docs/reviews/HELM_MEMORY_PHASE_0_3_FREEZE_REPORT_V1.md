---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Phase 0-3 Freeze Report v1

更新时间：2026-04-21
状态：MEM-FREEZE-007 Phase 0-3 frozen

## 1. 冻结结论

Memory Phase 0-3 当前可以冻结为第一阶段基线：

1. Phase 0 / 0B：observability baseline proxy 与 diagnostics trace alignment 已成立。
2. Phase 1：bounded timeline / facts query contract 与第一批索引 / EXPLAIN evidence 已成立。
3. Phase 2：budgeted retrieval pack pure builder 与 briefing / recommendation / meeting detail 第一轮 surface trace 已成立。
4. Phase 3：meeting `MemoryFact` write reliability 第一阶段已成立，包括 duplicate / conflict guard、batch failure semantics、failure review surface、operator queue substrate、bounded retry contract、receipt / attempt ledger、DB-level idempotency guard、source reconstruction proof 与 review-first bounded retry executor。

冻结边界：这是 Helm native memory efficiency / reliability 的 Phase 0-3 freeze，不是完整 memory platform、distillation runtime、owner workflow、auto-execution plane 或 commitment / blocker retry lane。

## 2. 已经完整成立

| 类别 | 已成立项 |
| --- | --- |
| Observability | diagnostics 可区分 baseline proxy、surface pack trace、write failure review 与 retry review state |
| Query | `/api/memory/facts` 与 `/api/memory/timeline` 有 bounded limit / cursor contract |
| Retrieval | `buildMemoryRetrievalPack` 能输出 selected / omitted / fallback / boundary trace |
| Surface trace | briefing、recommendation evidence、meeting detail 已接入 retrieval pack 第一轮 trace |
| Write dedupe | meeting `MemoryFact` lane 有 normalized duplicate guard 与 conflict candidate posture |
| Batch failure | `createMemoryFactsWithWriteResult` 输出 retryable / non-retryable / operator-review-required failure classification |
| Failure review | diagnostics 可读 failure audit sample、operator queue、retry contract、receipt ledger 与 attempt ledger |
| DB idempotency | `MemoryWriteRetryLock` 提供 DB-level lock key 与 write hash guard |
| Source proof | `MEETING_NOTE` source 可重建唯一 `CreateFactInput` 并阻断不可靠 source |
| Bounded executor | manually confirmed executor 最多写一个 reconstructed `MemoryFact`，不扩 broader side effects |

## 3. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| clean DB proof | shared DB 仍有旧 failed migration / view blocker；需 clean staging 或 repair 后补 migration-chain proof |
| owner workflow | 需要 dedicated owner review workflow：ack、SLA、resolution state、review history |
| Phase 4 distillation | 需要 review-safe distillation candidate，不覆盖 canonical facts |
| broader retry lanes | commitment / blocker lane 尚未纳入同一 retry contract |
| trace ledger | 当前 trace 分散在 diagnostics / audit payload / reports，未形成 durable full trace ledger |
| transactional executor | 当前 executor 已 bounded，但 lock / proof / write 还可进一步收成事务 seam |

## 4. 刻意未做

| 项 | 原因 |
| --- | --- |
| 第二套 memory stack | 当前目标是 harden native memory，不引入外部或平行栈 |
| broad auto-write | Helm 继续保持 review-first，不默认拥有高风险自动写入权限 |
| auto-send | retry 与 distillation 不改变 send authority |
| canonical fact 自动重写 | source proof 只能重建并写入单个 fact，不能自动覆盖确认事实 |
| workflow / orchestration 平台 | retry executor 是 bounded service contract，不是通用 orchestration engine |

## 5. 风险项

1. DB migration 尚未在 clean MySQL chain 上重新跑本轮新增 migration；当前已通过 schema validate，完整 DB proof 需后续补。
2. executor 当前只覆盖 `MemoryFact` / `MEETING_NOTE`，不能泛化到全部 memory source。
3. diagnostics 信息密度较高，owner workflow 下一层应迁出执行性 readout。
4. full `npm run test` 历史上仍受本机 MySQL `127.0.0.1:3306` runtime tests 影响，freeze 需如实记录。
5. `duplicate_omission` eval golden / seed 风险仍需单独收口。

## 6. 验证结果

本轮已运行：

```bash
npm run test -- lib/memory/write-retry-idempotency-guard.test.ts lib/memory/write-retry-source-reconstruction.test.ts lib/memory/write-retry-bounded-executor.test.ts
npx prisma validate --schema prisma/schema.prisma
SQLITE_SOURCE_DATABASE_URL=file:./dev.db npx prisma validate --schema prisma/schema.sqlite.prisma
SQLITE_SOURCE_DATABASE_URL=file:./dev.db npm run db:generate
npm run typecheck
npm run self-check
npm run check:boundaries
git diff --check
npm run lint
npm run build
npm run quality:regression
npm run test
npm run eval:memory
npm run eval:recommendation
```

结果：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| targeted 005H/005I/005J tests | 通过 | 3 files / 18 tests |
| Prisma MySQL schema validate | 通过 | schema valid；保留既有 relationMode warning |
| Prisma SQLite schema validate | 通过 | schema valid；命令需显式 SQLite URL |
| `npm run db:generate` | 通过 | MySQL Prisma Client 与 SQLite generated client 均生成成功 |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `npm run self-check` | 通过 | 11 / 11 |
| `npm run check:boundaries` | 通过 | boundary guard 通过 |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |
| `npm run lint` | 通过 | 0 errors；保留既有 5 warnings |
| `npm run build` | 通过 | production build 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过 | 51 files / 180 tests |
| `npm run test` | 未全绿 | 236 / 242 files、1023 / 1038 tests 通过；15 个失败均为 Helm v2 runtime tests 连接不到本机 MySQL `127.0.0.1:3306` |
| `npm run eval:memory` | 通过但有风险 | total 3 / 3 passed；`duplicate_omission` category 仍 0 / 3，暴露 golden / seed 重复风险 |
| `npm run eval:recommendation` | 未通过 | 0 / 4；既有 decisionRole / decisionLabel / supporting evidence expectation drift |

未运行：

| 命令 | 状态 | 说明 |
| --- | --- | --- |
| `npm run db:reset` | 未运行 | 本轮不直接 reset shared DB；full test 已显示本机 MySQL `127.0.0.1:3306` 不可达，clean DB proof 后续应使用隔离 schema |
| `npm run e2e` | 未运行 | 当前 DB runtime 不可达会使 e2e reset/seed 链路低信号；历史上 continuity 用例还有非 DB blocker |

## 7. 下一阶段最该做的 5 件事

1. `MEM-DISTILL-006`：review-safe distillation candidate。
2. owner-aware retry workflow hardening：ack / SLA / resolution state。
3. clean DB migration-chain proof：隔离 schema 跑新增 `MemoryWriteRetryLock` migration。
4. commitment / blocker retry lane 设计，但仍保持 review-first。
5. eval/golden 数据修复：特别是 duplicate / omission category。
