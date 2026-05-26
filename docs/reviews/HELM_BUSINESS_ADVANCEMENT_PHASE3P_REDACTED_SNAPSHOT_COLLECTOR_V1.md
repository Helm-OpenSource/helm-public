---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3P — Redacted Snapshot Collector V1

**状态**: Phase 3P Collector Ready
**Runtime Adoption 姿态**: No-Go
**生产接入**: No-Go
**日期**: 2026-04-26

---

## 概述

Phase 3P 在 Phase 3O evidence contract 之后，补齐一个 script-only、read-only 的脱敏 snapshot 采集器：

`scripts/business-advancement-phase3p-redacted-snapshot-collector.ts`

它的职责是从 DB 中只读采集 `ActionItem`、`Commitment`、`EmailThread` 的最小字段，映射为 Phase 3O evaluator 可消费的脱敏输入。

如果 `DATABASE_URL` 指向 `localhost` / `127.0.0.1` / `::1`，collector 会自动输出 `local_development_snapshot`。该类型只用于本地 schema / seed / collector 验证，不满足 Phase 3R/3S 的 live calibration 条件。只有非本地 DB target 才会输出 `redacted_live_db_snapshot`。

当前工作树没有 `.env.local`，环境中也没有 `DATABASE_URL`，因此本批次没有执行真实 DB 校准。脚本在缺少 `DATABASE_URL` 时会安全失败，不会回退到默认数据库。使用主仓库 `.env.local` 做只读 inventory 探测时，当前机器无法连通配置的 DB，因此没有采集任何 live rows。

---

## 边界

Phase 3P **是**：

- script-only redacted snapshot collector
- read-only Prisma `findMany/select`
- Phase 3O evaluator 的输入生成工具
- 脱敏 producer-view 行生成器
- runtime adoption review 的前置证据工具

Phase 3P **不是**：

- production runtime adapter
- `data/queries.ts` 集成
- app route / API route
- mobile read-model
- schema migration
- official write path
- automated execution authority

---

## 采集字段

| Source | 读取字段 | 明确不读取 / 不输出 |
|---|---|---|
| `ActionItem` | `id`, `workspaceId`, `updatedAt`, `approvalTask.id` | `title`, `description`, `aiReason`, `draftContent`, `metadata`, policy 文本 |
| `Commitment` | `id`, `workspaceId`, `dueDate`, `status`, `overdueFlag` | `title`, `commitmentText`, `statusNote`, source text |
| `EmailThread` | `id`, `workspaceId`, `status`, `opportunityId` | `subject`, `counterpart`, `summary`, `participants`, email body, raw email address |

所有 ID 输出前都经过 namespace-aware SHA-256 截断 hash，输出为 opaque ID。

---

## TPQR-004 Producer-View Probe

真实 `EmailThread` 是单行模型，同一物理行不可能同时 `opportunityId IS NOT NULL` 和 `opportunityId IS NULL`。但 Phase 3O 需要验证 CRM-linked wins 的 dedup 行为。

因此 Phase 3P 默认对 CRM-linked `WAITING_US` thread 生成一个脱敏 generic probe row：

- 原 CRM-linked producer-view row 保留 `opportunityId`
- generic probe row 使用同一 redacted `emailThreadId`
- generic probe row 的 `opportunityId=null`
- Phase 3O evaluator 应将 generic probe 排除为 `deduped_by_crm_linked`

这是校准 probe，不是生产查询行为。可以通过 `--no-dedup-probe-rows` 关闭。

---

## CLI 使用

必需参数：

```
DATABASE_URL=... \
npx tsx scripts/business-advancement-phase3p-redacted-snapshot-collector.ts \
  --workspace-id <workspace-id> \
  --reference-clock-iso 2026-04-26T00:00:00.000Z
```

可选参数：

```
--reference-clock-ms <epoch-ms>
--take <1..500>
--print-json
--no-dedup-probe-rows
```

默认只打印 summary；`--print-json` 会打印脱敏 evidence pack 与 Phase 3O evaluation，用于人工转交评审。脚本不写文件。

---

## 已经完整成立

| 项目 | 状态 | 说明 |
|---|---|---|
| No default DB fallback | Complete | 缺少 `DATABASE_URL` 直接失败 |
| Explicit workspace scope | Complete | 必须传 `--workspace-id` 或 `WORKSPACE_ID` |
| Explicit reference clock | Complete | 必须传 `REFERENCE_CLOCK_MS` 或 `REFERENCE_CLOCK_ISO`；不读 wall clock |
| Read-only query posture | Complete | 仅使用 Prisma `findMany/select` |
| Redacted ID output | Complete | 所有 ID 使用 namespace-aware hash |
| Sensitive field exclusion | Complete | 不 select 文本、邮件、正文、标题、counterpart 等敏感字段 |
| Phase 3O evaluator integration | Complete | 采集后运行 Phase 3O evaluator，输出 calibration summary |
| Runtime adoption No-Go | Complete | 脚本输出和文档均明确 No-Go |

---

## 已成形但仍需下一层

| 项目 | 当前状态 | 下一步 |
|---|---|---|
| 真实 DB 校准运行 | 未执行 | 需要提供 `DATABASE_URL` 和目标 workspaceId |
| 真实校准结果评审 | 未开始 | 运行 Phase 3P 后审计 JSON / summary，再决定是否进入 runtime adoption review |
| Production runtime adoption review | 未开始 | 仅在 Phase 3O/3P 真实数据校准通过后启动 |
| Runtime adapter | 未实现 | 仍然 No-Go |

---

## 刻意未做

| 项目 | 理由 |
|---|---|
| 写文件 | 避免把脱敏 snapshot 误落库进 repo |
| DB 写入 | 校准采集必须 read-only |
| 默认数据库回退 | 防止误连本地/shared DB |
| `data/queries.ts` 接入 | Runtime adoption No-Go |
| `app/` / `features/mobile/` 接入 | 仍未获批 |

---

## 验证结果

### Phase 3P helper tests

```
npx vitest run features/business-advancement/phase3p-redacted-snapshot-collector.test.ts
→ 1 file / 17 tests PASS
```

### Phase 3P eslint

```
npx eslint scripts/business-advancement-phase3p-redacted-snapshot-collector.ts \
  features/business-advancement/phase3p-redacted-snapshot-collector.test.ts
→ PASS
```

### No-DB Safe Failure

```
npx tsx scripts/business-advancement-phase3p-redacted-snapshot-collector.ts
→ DATABASE_URL is required. Phase 3P does not fall back to a default DB.
```

### Live DB Reachability

```
Main repo .env.local exists, but DB connectivity from this worktree/host failed.
→ No live rows collected; real-data validation remains incomplete.
```

### Business Advancement Full Vitest

```
npx vitest run features/business-advancement/*.test.ts
→ 29 files / 1111 tests PASS
```

### Typecheck

```
npm run typecheck
→ PASS
```

### Boundary Check

```
npm run check:boundaries
→ PASS
```

### Self Check

```
npm run self-check
→ 18 checks passed / 0 failed
```

---

## 结论

Phase 3P 完成的是真实数据校准的只读脱敏采集工具，不是 runtime adoption。

当前状态：

- Collector: Ready
- Real DB run: Not executed
- Real-data validation: Not completed
- Runtime adoption: No-Go

下一步必须在明确目标 workspace 与可用 `DATABASE_URL` 后运行采集器，审计输出，再决定是否进入 production runtime adoption review。
