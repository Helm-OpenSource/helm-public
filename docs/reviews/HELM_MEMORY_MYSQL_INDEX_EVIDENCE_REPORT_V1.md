---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory MySQL Index Evidence Report v1

更新时间：2026-04-21
状态：clean CI verify DB migration proof passed; shared dev DB blocker documented

## 1. 本轮目标

本轮延续 `HELM Native Memory Efficiency & Reliability v1`，只补 `MEM-QUERY-003 / MEM-WRITE-005` 的 MySQL 证据：

1. 读取本地配置的开发 MySQL migration / index 状态。
2. 验证当前 memory query / write guard 的 EXPLAIN 姿态。
3. 在不 reset 共享库、不手动改共享库 schema 的前提下，修正尚未落库的 memory index migration。

本轮仍不启动：

1. 自动 retry executor。
2. 正式 operator queue。
3. shared `helm2026` reset。
4. 手动绕过 Prisma migration history 的 shared DB DDL。
5. recommendation ranking、commitment authority 或 external send 扩面。

## 2. 只读数据库事实

目标 datasource 来自本地 `.env.local`，连接到开发库 `helm2026`，MySQL 版本为 `8.0.28`。

只读检查结果：

| 项 | 结果 |
| --- | --- |
| `20260420000100_memory_query_bounded_indexes` | `_prisma_migrations` 未记录 |
| `20260420000200_memory_write_dedupe_index` | `_prisma_migrations` 未记录 |
| 目标 memory index count | 0 |
| visible temp verification schemas | 0 |

共享库存在先于本轮的 migration blocker：

| Migration | 状态 | 关键错误 |
| --- | --- | --- |
| `20260416000100_longtext_meeting_opportunity_summaries` | `finished_at = null`，未 rollback | `'helm2026.opportunity' is not BASE TABLE` |

进一步只读 inventory 显示：

| 项 | 结果 |
| --- | --- |
| `@@lower_case_table_names` | `1` |
| tables summary | 110 base tables / 107 views |
| `opportunity / meeting / memoryfact / memoryentry / commitment / blocker / memorycorrection` | 当前均为 `VIEW` |
| 对应 base tables | `memory_fact / memory_entry / memory_correction / n_commitment / n_blocker / n_meeting / n_opportunity` 等 snake_case 或 `n_` 前缀表 |

结论：当前 shared `helm2026` 不是一份干净的 Prisma migration target。它有 compatibility view layer 与旧失败 migration，不能把 Mem migration 未 apply 直接归因于 Mem migration 本身。

## 3. 临时库验证结果

尝试使用同一 RDS 创建临时验证库 `helm2026_memverify_20260421121431` 并执行 `npm run db:migrate`。

结果：

| 项 | 结果 |
| --- | --- |
| 临时 schema create / use | 失败 |
| 错误 | `User was denied access on the database helm2026_memverify_20260421121431` |
| 残留检查 | `INFORMATION_SCHEMA.SCHEMATA` 未发现 `helm2026_memverify_%` 可见残留 |

按本轮 DB 环境修复计划再次执行 clean schema provisioning preflight，目标为 `helm2026_memverify_20260421123545`。

结果：

| 项 | 结果 |
| --- | --- |
| 临时 schema create / use | 失败 |
| 错误 | `Access denied for user 'root'@'%' to database 'helm2026_memverify_20260421123545'` |
| 残留检查 | `INFORMATION_SCHEMA.SCHEMATA` 未发现 `helm2026_memverify_%` 可见残留 |
| shared `helm2026` DDL | 未执行 |
| shared `helm2026` reset / migrate | 未执行 |

结论：当前账号可读 shared dev DB，但没有可用的 ad-hoc `helm2026_memverify_*` temp schema create/use 权限。这里不是 Mem migration SQL 的新失败，而是临时 schema 权限边界。

DBA 最小授权或替代交付物：

1. 预创建一份 clean schema，例如 `helm2026_memverify_<timestamp>` 或 `helm2026_staging_mem`。
2. 给当前开发账号仅在该 schema 上授予 `SELECT / INSERT / UPDATE / DELETE / CREATE / ALTER / DROP / INDEX`。
3. 或提供一条只指向该 clean schema 的临时 `DATABASE_URL`。
4. 不需要授权 shared `helm2026` 的 reset，也不需要在本轮修复 shared `helm2026` 的旧 migration state。

## 3.1 CI verify 库验证结果

后续确认当前 DB 采用物理隔离：

1. `helm2026`：正常开发 / 数据访问库。
2. `helm2026_ci_verify`：PR / CI / 全链路验证库。

本轮使用 session 级 `DATABASE_URL` 指向 `helm2026_ci_verify`，未改 `.env.local`，未写入 Git。

只读 preflight 结果：

| 项 | 结果 |
| --- | --- |
| target database | `helm2026_ci_verify` |
| MySQL version | `8.0.28` |
| `@@lower_case_table_names` | `1` |
| failed migrations | 0 |
| `20260416000100_longtext_meeting_opportunity_summaries` | 已成功 apply |
| tables summary | 全部为 BASE TABLE，未观察到 shared `helm2026` 的 compatibility VIEW layer |
| target memory index count before migrate | 0 |

执行结果：

| 命令 | 结果 |
| --- | --- |
| `DATABASE_URL=<helm2026_ci_verify> npm run db:migrate` | 成功 apply `20260420000100_memory_query_bounded_indexes` 与 `20260420000200_memory_write_dedupe_index` |
| `DB_RESET_ALLOWLIST=helm2026_ci_verify DATABASE_URL=<helm2026_ci_verify> npm run db:reset` | 成功从空库 apply 全部 19 个 migrations 并完成 seed |
| post-reset target memory index count | 23 |
| post-reset failed migrations | 0 |

结论：`helm2026_ci_verify` 可以作为当前 Mem MySQL clean migration-chain proof 与 PR / CI 验证目标。shared `helm2026` 的旧失败 migration 仍是 shared DB 自身历史状态问题，不再阻断本轮 Mem migration proof。

## 4. EXPLAIN 证据

在 shared `helm2026` 上执行只读 EXPLAIN，基于当前 view/base-table 形态观察到：

| 查询 | 当前 key 姿态 | Extra |
| --- | --- | --- |
| `/api/memory/facts` object/status facts query | `idx_workspace_id_object_type_object_id` | `Using where; Using filesort` |
| meeting fact write guard lookup | `index_merge` over object/source indexes | `Using intersect(...); Using where` |
| memory timeline `MemoryEntry` query | `idx_workspace_id` | `Using where; Using filesort` |
| memory correction timeline query | `idx_workspace_id_memory_fact_id` | `Using filesort` |

这说明 shared DB 当前缺少本轮所需的 composite order/index path。

## 5. Session-only 对照 EXPLAIN

为避免持久改动 shared DB，本轮只创建 session-scoped temporary tables，复制少量当前 view 结果后添加对照索引。连接关闭后这些临时表自动消失。

对照结果：

| 对照索引 | EXPLAIN 结果 |
| --- | --- |
| `MemoryFact(workspaceId, objectType, objectId, status, importance, createdAt)` | 仍为 `Using filesort` |
| `MemoryFact(workspaceId, objectType, objectId, status, importance, createdAt, id)` | `Backward index scan` |
| `MemoryFact(workspaceId, sourceType, sourceId, objectType, objectId, factType)` | 单索引 `ref`，无 `index_merge` |
| `MemoryEntry(workspaceId, deletedAt, createdAt)` | 仍为 `Using index condition; Using filesort` |
| `MemoryEntry(workspaceId, deletedAt, createdAt, id)` | `Backward index scan` |

结论：bounded query 的稳定分页 cursor 使用 `id` 作为 tie-breaker，因此 MySQL index 也必须包含 `id`，否则关键 order path 仍会 filesort。

## 5.1 `helm2026_ci_verify` EXPLAIN 证据

在 `helm2026_ci_verify` 完成 `db:reset` 与 seed 后复跑 EXPLAIN：

| 查询 | key | Extra |
| --- | --- | --- |
| facts object/status bounded query | `MemoryFact_workspace_object_status_importance_created_idx` | `Backward index scan; Using index` |
| facts object retrieval updated order | `MemoryFact_workspace_object_importance_updated_idx` | `Backward index scan; Using index` |
| facts source/object/fact write guard | `MemoryFact_workspace_source_object_fact_idx` | `Using index` |
| memory entry workspace timeline | `MemoryEntry_workspace_deleted_created_idx` | `Using where; Backward index scan; Using index` |
| memory entry entity timeline | `MemoryEntry_workspace_entity_created_idx` | `Using where; Backward index scan; Using index` |
| memory entry opportunity timeline | `MemoryEntry_workspace_opportunity_created_idx` | `Using where; Backward index scan; Using index` |
| memory correction timeline | `MemoryCorrection_workspace_created_idx` | `Backward index scan; Using index` |
| commitment meeting timeline with forced composite index | `Commitment_workspace_meeting_created_idx` | `Backward index scan; Using index` |
| blocker meeting timeline with forced composite index | `Blocker_workspace_meeting_created_idx` | `Backward index scan; Using index` |

说明：在 seed 数据量很小的情况下，MySQL 对 `Commitment / Blocker` 的 meeting filter 会优先选择旧的 `relatedMeetingId` fkey 并显示 `Using filesort`；强制 composite index 后可证明新 index 本身可以提供无 filesort 的 order path。核心 Mem 表路径已经由优化器直接命中新索引。

## 6. 本轮索引修正

已在尚未 apply 的 migration 和 `prisma/schema.prisma` 中修正：

1. 所有 memory timeline / facts order index 增加 `id` 作为最后一列。
2. `MemoryEntry` object/entity indexes 增加 `deletedAt` 与 `id`，对齐 `deletedAt IS NULL + createdAt/id` 的分页读取。
3. `MemoryFact` 增加：
   - `MemoryFact_workspace_created_idx`
   - `MemoryFact_workspace_object_created_idx`
   - `MemoryFact_workspace_object_importance_updated_idx`
4. `Commitment / Blocker / MemoryCorrection` 的 created/order indexes 增加 `id`。
5. `MemoryFact_workspace_source_object_fact_idx` 保持不加 `id`，因为它服务 write guard equality lookup，不服务 order-by。

## 7. 验证结果

已运行：

```bash
shared dev DB read-only migration/index/view inventory
clean helm2026_memverify schema create/use preflight
helm2026_memverify residue check
DATABASE_URL=<helm2026_ci_verify> npm run db:migrate
DB_RESET_ALLOWLIST=helm2026_ci_verify DATABASE_URL=<helm2026_ci_verify> npm run db:reset
helm2026_ci_verify post-reset migration/index/EXPLAIN inventory
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
npm run test -- lib/memory/query-contract.test.ts lib/memory/query-routes.test.ts lib/memory/write-dedupe.test.ts lib/memory/memory-fact-batch-write.test.ts lib/memory/meeting-memory-pipeline-write-failure.test.ts lib/observability/memory-metrics.test.ts
npm run self-check
npm run check:boundaries
npm run eval:memory
npm run typecheck
npm run lint
npm run quality:regression
DATABASE_URL=<helm2026_ci_verify> npm run test
PLAYWRIGHT_DATABASE_URL=<helm2026_ci_verify> npm run e2e
git diff --check
```

结果：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| shared dev DB read-only preflight | 通过 | 确认 shared `helm2026`、MySQL `8.0.28`、`lower_case_table_names = 1`、旧失败 migration、目标 memory index count = 0、compatibility VIEW layer |
| ad-hoc clean schema create/use preflight | 阻断 | `helm2026_memverify_20260421123545` 被 RDS 返回 `Access denied`；未执行迁移 |
| `helm2026_memverify` residue check | 通过 | `INFORMATION_SCHEMA.SCHEMATA` 未发现 `helm2026_memverify_%` 可见残留 |
| `npm run db:migrate` on `helm2026_ci_verify` | 通过 | 两个目标 Mem migrations 成功 apply |
| `npm run db:reset` on `helm2026_ci_verify` | 通过 | allowlisted verify DB 从空库 apply 全部 19 个 migrations 并完成 seed |
| post-reset EXPLAIN on `helm2026_ci_verify` | 通过 | 核心 Mem facts / entries / corrections / write guard 查询直接命中新索引；commitment/blocker composite index forced 对照无 filesort |
| `prisma validate` | 通过 | schema valid；保留既有 Prisma `relationMode = "prisma"` index warnings 与 `package.json#prisma` deprecation warning |
| targeted memory tests | 通过 | 6 files / 20 tests |
| `npm run self-check` | 通过 | 11 / 11 |
| `npm run check:boundaries` | 通过 | boundary checks 全部通过 |
| `npm run eval:memory` | 通过 | 总体 3 / 3；`duplicate_omission` category 仍为 0 / 3，属于既有 golden / seed 数据风险 |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `npm run lint` | 通过 | 0 errors / 5 warnings；warnings 为既有 unused variable warnings |
| `npm run quality:regression` | 通过 | 51 files / 180 tests |
| `npm run test` with `helm2026_ci_verify` | 通过 | 235 files / 1003 tests |
| `npm run e2e` with `helm2026_ci_verify` | 部分通过 | runner 成功 reset verify DB、apply 19 migrations、seed、build 并启动生产服务；首次因本机缺 Playwright Chromium 失败，安装 browser 后复跑为 25 passed / 1 failed / 3 did not run；失败用例为 `tests/e2e/continuity-recovery.spec.ts` takeover button disabled timeout，非 DB migration/index blocker |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |

未运行：

| 命令 | 原因 |
| --- | --- |
| `npm run db:migrate` on shared `helm2026` | shared DB 有旧失败 migration 与 view/base-table blocker；本轮不手动改 shared schema |
| `npm run db:reset` on shared `helm2026` | shared DB，不允许破坏性 reset；已改用 `helm2026_ci_verify` 完成 reset proof |
| full migration-chain proof on ad-hoc temp schema | 当前账号没有 `helm2026_memverify_*` create/use 权限；已改用物理隔离的 `helm2026_ci_verify` |
| full e2e green | `tests/e2e/continuity-recovery.spec.ts` 仍有 takeover button disabled timeout，需要另起 continuity recovery surface 修复；DB reset/build/browser runner 已可用 |

## 8. 当前分级

| 分级 | 内容 |
| --- | --- |
| 已经完整成立 | 本轮找到了 shared DB migration blocker；用只读 EXPLAIN 证明 shared DB 索引缺口；用 session temporary EXPLAIN 证明 `id` tie-breaker 对 order path 必要；已修正未落库 migration；`helm2026_ci_verify` 已完成 `db:migrate`、allowlisted `db:reset`、seed、post-reset migration/index/EXPLAIN proof |
| 已成形但仍需下一层 | retry executor / formal operator queue 仍需作为下一独立切片实现，继续保持 review-first、no-auto-send、non-commitment boundary |
| 刻意未做 | 不 reset shared DB，不手动绕过 Prisma migration history，不启动 retry executor / operator queue |
| 风险项 | shared `helm2026` 的 compatibility view layer 与失败 migration 仍会阻断 shared DB 自身后续 migration；`helm2026_ci_verify` 可解除 Mem proof blocker，但不能替代 shared DB migration-state repair；e2e 仍有一个非 DB 的 continuity recovery takeover button timeout |

## 9. 下一步

1. 以 `helm2026_ci_verify` 作为 PR / CI / full-chain verify DB，后续 DB 验证命令使用 session 级 `DATABASE_URL`，不要改 `.env.local` 或提交凭据。
2. shared `helm2026` migration-state repair 另起任务处理，单独评估 `20260416000100_longtext_meeting_opportunity_summaries` failed migration、compatibility view layer、回滚路径和审批。
3. Mem DB proof blocker 已解除；下一切片可以进入 bounded retry executor / formal operator queue，但仍必须保持 review-first、不自动改写 canonical facts、不扩 recommendation / commitment authority。
4. `continuity-recovery` e2e 的 takeover button disabled timeout 不应混入 Mem DB 切片；如要追 e2e 全绿，另起 continuity recovery surface 修复。
