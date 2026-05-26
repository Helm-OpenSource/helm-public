---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3I Runtime Source Review V1

更新时间：2026-04-26
状态：Runtime source review complete / Runtime adoption No-Go / 条件批准 Phase 3J disabled-by-default plan

---

## 结论

Phase 3I 对 Phase 3H 三个具名 source function（`sourceBlockedDecisionCandidates`、`sourceOverdueCommitmentCandidates`、`sourceCustomerWaitingCandidates`）进行了独立 runtime source review。

**Runtime adoption 继续 No-Go。**

三条 family 的 schema seam 已从静态 repo truth 证明，但无一具备进入真实 runtime source adoption 所需的完整条件：threshold 未校准、无 function-to-DB seam、未经 permission/capability 集成复核、从未在真实 DB rows 上测试过。

**下一步唯一条件批准的工作：Phase 3J — disabled-by-default 内部 runtime source module plan（仅 plan，不得实现）。**

---

## 一、Phase 3I 是什么

Phase 3I 是 Phase 3H 要求的独立 runtime source review。

Phase 3I 完成了以下工作：

- 对照 `prisma/schema.prisma`、`lib/memory/commitment.service.ts`、`lib/memory/shared.ts`、`features/mobile/lib/mobile-command-read-model.ts` 和 `data/queries.ts` 静态 truth，逐条评审 Phase 3H 三个具名 source function 是否可以安全映射到真实 read-only runtime source
- 回答 Phase 3H 要求的全部六个 review 问题
- 交付具名 evaluator artifact（13 项 checks 全部通过）、vitest 测试（48/48 PASS）和 CLI 评审脚本（13/13 PASS）

**Phase 3I 不是、也没有做：**

- 不是 runtime adapter 实现，不是 DB reader，不是 production query
- 不是 API route，不是 UI 变更，不是 schema 变更
- 不修改 `data/queries.ts`、`features/mobile/lib/mobile-command-read-model.ts`、`app/`、`app/api/`、`prisma/schema.prisma`
- 不做 official write，不做 automated execution
- 不做 TPQR-002 / TPQR-005

---

## 二、六个必答问题

### Q1：TPQR-001 Phase 3H source function 是否能安全映射到真实 read-only ActionItem source，且不混淆现有 ApprovalTask pending queue？

**结论：CONDITIONAL（安全映射可行，但 threshold 未校准，blocking runtime adoption）**

- **Schema seam**（来自 `prisma/schema.prisma`）：
  - `ActionItem.workspaceId`: `String`（非空）— workspace scope ✓
  - `ActionItem.approvalTask`: `ApprovalTask?`（optional one-to-one）— 结构性缺失 = blocked-before-review ✓
  - `ActionItem.updatedAt`: `DateTime @updatedAt`— staleness predicate ✓
  - `ApprovalTask.actionItemId`: `String @unique`— 已进队列的任务有唯一 actionItemId

- **与现有 pending queue 的边界**：
  - `loadPendingApprovals` 读取 `db.approvalTask.findMany({ where: { workspaceId, status: "PENDING" } })`— 读的是 **ApprovalTask rows**（已进审核队列）
  - Phase 3H `sourceBlockedDecisionCandidates` 目标是 **ActionItem WHERE approvalTask IS NULL**（尚未进队列）
  - 两者读的是**不同 model 的不同 rows**，结构上互斥，不会相互混淆

- **Blocking gap**：
  - 48h staleness threshold（`PHASE3H_BLOCKED_DECISION_THRESHOLD_MS=172800000ms`）仍是 `calibration_placeholder`
  - 无 function-to-DB seam：Phase 3H function 接受 row arrays，不读 Prisma queries
  - 未经 permission/capability 集成复核
  - 从未在真实 DB rows 上测试

### Q2：TPQR-003 Phase 3H source function 是否能安全映射到真实 read-only Commitment source，explicit referenceClockMs，不用 Date.now，不以 persistedOverdueFlag 作为 inclusion authority？

**结论：CONDITIONAL（safe mapping 可行，三项要求均已证明，但无 function-to-DB seam，blocking runtime adoption）**

- **Schema seam**（来自 `prisma/schema.prisma`）：
  - `Commitment.workspaceId`: `String`（非空）— workspace scope ✓
  - `Commitment.dueDate`: `DateTime?`（nullable）— inclusion predicate ✓
  - `Commitment.status`: `CommitmentStatus`（OPEN|IN_PROGRESS|OVERDUE|FULFILLED|CANCELED）— terminal set = {FULFILLED,CANCELED} ✓
  - `Commitment.overdueFlag`: `Boolean @default(false)`— persisted column，NOT inclusion authority ✓
  - Index: `(workspaceId, dueDate)`— efficient query ✓

- **Explicit clock 证明**：
  - 现有 `getCommitments` 通过 `deriveCommitmentStatus` 调用 `Date.now`— 隐式 wall-clock 依赖
  - Phase 3H `sourceOverdueCommitmentCandidates` 接受显式 `referenceClockMs` 参数，直接评估 `dueDate < referenceClockMs`— 无 wall-clock 读取
  - Phase 3H evaluator check `tpqr003_reference_clock_controls_inclusion` PASS

- **persistedOverdueFlag 非 authority 证明**：
  - Phase 3H evaluator check `tpqr003_persisted_flag_non_authority` PASS（44/44 tests PASS）：翻转所有 `persistedOverdueFlag` 不改变 candidate inclusion
  - Inclusion 由 `dueDate < referenceClockMs AND status NOT IN {FULFILLED, CANCELED}` 唯一决定

- **Blocking gap**：
  - 无 function-to-DB seam：Phase 3H function 接受 row arrays，不读 Prisma queries
  - `thresholdStatus='calibration_placeholder'` audit 惯例未解决（TPQR-003 无独立 time threshold，但 audit 字段仍需在 runtime 前明确）
  - 未经 permission/capability 集成复核

### Q3：TPQR-004 Phase 3H source function 是否能安全映射到真实 EmailThread sources，CRM-linked/generic producers 与 after-producer dedup？

**结论：CONDITIONAL（两个 producer 的 schema seam 均已证明，after-producer dedup 已证明，但无 function-to-DB seam，blocking runtime adoption）**

- **Schema seam**（来自 `prisma/schema.prisma`）：
  - `EmailThread.workspaceId`: `String`（非空）— workspace scope ✓
  - `EmailThread.opportunityId`: `String?`（nullable FK）— CRM-linked seam：IS NOT NULL = CRM-linked ✓
  - `EmailThread.status`: 含 `WAITING_US`— inclusion predicate ✓
  - `EmailThread.id`: dedup key ✓
  - Relation: `opportunity (Opportunity?, via opportunityId)` ✓

- **两个 producer 边界**：
  - 现有 `loadWaitingEmailThreads` = generic producer（WHERE workspaceId AND status = 'WAITING_US'）— 无 CRM-linked，无 dedup
  - Phase 3H CRM-linked producer：`WHERE workspaceId AND status = 'WAITING_US' AND opportunityId IS NOT NULL`
  - Phase 3H after-producer dedup by `emailThreadId`：CRM-linked 优先
  - Phase 3H evaluator checks `tpqr004_both_producers_used` 与 `tpqr004_dedup_crm_linked_winner` 均 PASS

- **Blocking gap**：
  - 无 function-to-DB seam：Phase 3H function 接受 row arrays，不读 Prisma queries
  - CRM-linked producer query shape 从未对真实 DB rows 测试
  - `thresholdStatus='calibration_placeholder'` audit 惯例未解决
  - 未经 permission/capability 集成复核

### Q4：Thresholds 是否仍为 calibration_placeholder，是否阻止 production adoption？

**结论：YES — 所有三条 family 均阻止**

| Family | Threshold 性质 | 状态 | 阻断 |
|--------|---------------|------|------|
| TPQR-001 | 可配置 staleness threshold（48h=172800000ms） | `calibration_placeholder` — 无真实业务数据支撑 | **YES** |
| TPQR-003 | 日期比较谓词（dueDate < referenceClockMs），无独立可配置 threshold | audit thresholdStatus = `calibration_placeholder` 惯例未解决 | YES（audit 层面） |
| TPQR-004 | 状态过滤谓词（WAITING_US），无独立可配置 threshold | audit thresholdStatus = `calibration_placeholder` 惯例未解决 | YES（audit 层面） |

所有三条 family 在进入 production 前必须：将 `thresholdStatus` 替换为已校准值，或以明确的 conservative default 加上业务理由替代 `calibration_placeholder`。

### Q5：现在是否允许真实 runtime source implementation，还是只允许更窄的 Phase 3J disabled-by-default feature flag？

**结论：不允许真实 runtime source implementation。条件批准 Phase 3J — disabled-by-default plan only。**

当前阻断因素（8 项）：

1. TPQR-001 staleness threshold（48h）未校准
2. TPQR-001 无 function-to-DB seam
3. TPQR-003 无 function-to-DB seam
4. TPQR-003 thresholdStatus audit 惯例未解决
5. TPQR-004 无 function-to-DB seam
6. TPQR-004 thresholdStatus audit 惯例未解决
7. 三条 family 均未完成 permission/capability 集成复核
8. 三条 family Phase 3H function 仅在合成 rows 上验证，从未对真实 DB rows 测试

Phase 3J 条件批准要求：
- 仅允许交付 disabled-by-default 内部 runtime source module **plan** artifact
- 不得实现真实 runtime adapter
- 不得触碰任何禁止文件
- threshold 校准必须先于任何 production adoption

### Q6：哪些文件仍然禁止？

| 禁止路径 | 原因 |
|----------|------|
| `data/queries.ts` | 查询聚合入口，不得直接写入未经 production 复核的 source query |
| `features/mobile/lib/mobile-command-read-model.ts` | Mobile read-model，不得在未经 surface review 前接入新 source |
| `app/` | Route owner，不得新增未经批准的 UI surface |
| `app/api/` | API route，不得新增未经批准的 API endpoint |
| `prisma/schema.prisma` | Schema 变更需要独立 migration review |
| `<official write paths>` | 任何对外部系统的写操作需要明确批准 |
| `<automated execution paths>` | 自动执行需要明确批准和 human-in-the-loop review |

---

## 三、Review Evidence Matrix

| checkName | tpqrId | verdict | runtimeBlocking |
|-----------|--------|---------|-----------------|
| `tpqr001_schema_seam_confirmed` | TPQR-001 | PASS | — |
| `tpqr001_source_does_not_confuse_pending_approval_queue` | TPQR-001 | PASS | — |
| `tpqr001_threshold_calibration_placeholder_blocks_runtime` | TPQR-001 | PASS (confirms blocker) | YES |
| `tpqr003_schema_seam_confirmed` | TPQR-003 | PASS | — |
| `tpqr003_explicit_reference_clock_no_date_now` | TPQR-003 | PASS | — |
| `tpqr003_persisted_overdue_flag_non_authority_reconfirmed` | TPQR-003 | PASS | — |
| `tpqr004_schema_seam_confirmed` | TPQR-004 | PASS | — |
| `tpqr004_both_producers_and_dedup_seam_proven` | TPQR-004 | PASS | — |
| `all_thresholds_are_calibration_placeholder` | ALL | PASS (confirms blocker) | YES |
| `no_runtime_db_seam_for_any_family` | ALL | PASS (confirms blocker) | YES |
| `runtime_adoption_posture_is_no_go` | ALL | PASS | YES |
| `phase3j_conditional_go_disabled_by_default` | Phase 3J | PASS | — |
| `forbidden_files_enumerated` | ALL | PASS | — |

---

## 四、已经完整成立

| 项目 | 结论 |
|------|------|
| TPQR-001 schema seam | ActionItem.approvalTask (optional) = safe structural seam，与现有 pending queue 互斥 |
| TPQR-003 explicit clock | Phase 3H function 接受 explicit referenceClockMs，不读 wall-clock |
| TPQR-003 persistedOverdueFlag 非 authority | Phase 3H flip test 证明，inclusion 不依赖 persisted flag |
| TPQR-004 CRM/generic producer boundary | opportunityId nullable FK = safe structural seam，两个 producer 与 after-producer dedup 均已证明 |
| Workspace scope inheritance | 三条 family 均通过 workspaceId WHERE clause 继承现有工作区边界 |
| Per-family disable switch | Phase 3E/3H 建立的三个开关均有效，默认全部关闭 |

---

## 五、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
|------|---------|-----------|
| function-to-DB seam | 三条 family 均缺失 | Phase 3J plan：设计如何将 row-array 接口桥接到 Prisma queries |
| TPQR-001 threshold | 48h = calibration_placeholder | 真实业务数据校准或明确 conservative default |
| thresholdStatus audit 惯例 | 三条 family 均为 calibration_placeholder | 在 runtime 前解决 audit 字段约定 |
| permission/capability integration | 三条 family 均未集成复核 | Phase 3J plan 必须明确继承路径 |
| 真实 DB row 测试 | 三条 family 仅在合成 rows 上验证 | Phase 3J plan 须设计 DB-level 验证方案 |

---

## 六、刻意未做

| 未做项 | 原因 |
|--------|------|
| 不修改 `data/queries.ts` | Phase 3I 不是 production query adoption |
| 不修改 `features/mobile/lib/mobile-command-read-model.ts` | Phase 3I 不是 mobile read-model 修改 |
| 不修改 `app/` 或 `app/api/` | Phase 3I 不新增 UI / API surface |
| 不修改 `prisma/schema.prisma` | Phase 3I 不新增 schema |
| 不实现 runtime adapter / function-to-DB seam | Phase 3I 只做 evidence review |
| 不做 TPQR-002 / TPQR-005 | 继续维持 No-Go |
| 不做 official write / automated execution | Business Advancement 当前仍是 review-first planning layer |

---

## 七、验证结果

已运行并通过：

- `npx vitest run features/business-advancement/phase3i-runtime-source-review.test.ts`
  - 1 file / **48 tests PASS**
- `npx tsx scripts/business-advancement-phase3i-runtime-source-review.ts`
  - **13/13 checks PASS**，runtime posture No-Go，exit 0
- `npx eslint features/business-advancement/phase3i-runtime-source-review.ts features/business-advancement/phase3i-runtime-source-review.test.ts scripts/business-advancement-phase3i-runtime-source-review.ts`
  - No errors
- `git diff --check`
  - Clean

Phase 3I evaluator checks（13/13）：

| # | checkName | 结论 |
|---|-----------|------|
| 1 | `tpqr001_schema_seam_confirmed` | PASS |
| 2 | `tpqr001_source_does_not_confuse_pending_approval_queue` | PASS |
| 3 | `tpqr001_threshold_calibration_placeholder_blocks_runtime` | PASS |
| 4 | `tpqr003_schema_seam_confirmed` | PASS |
| 5 | `tpqr003_explicit_reference_clock_no_date_now` | PASS |
| 6 | `tpqr003_persisted_overdue_flag_non_authority_reconfirmed` | PASS |
| 7 | `tpqr004_schema_seam_confirmed` | PASS |
| 8 | `tpqr004_both_producers_and_dedup_seam_proven` | PASS |
| 9 | `all_thresholds_are_calibration_placeholder` | PASS |
| 10 | `no_runtime_db_seam_for_any_family` | PASS |
| 11 | `runtime_adoption_posture_is_no_go` | PASS |
| 12 | `phase3j_conditional_go_disabled_by_default` | PASS |
| 13 | `forbidden_files_enumerated` | PASS |

---

## 八、当前决策

| 决策项 | 结论 |
|--------|------|
| Phase 3I runtime source review | **Complete** |
| Runtime adoption | **No-Go** |
| Schema / API / UI / mobile read-model / production query adoption | **No-Go** |
| Official write / automated execution / LLM final ranking | **No-Go** |
| TPQR-002 / TPQR-005 | **No-Go** |
| Phase 3J disabled-by-default runtime source module plan | **Conditional-Go** |

下一步唯一允许的工作：

**Phase 3J**：为 TPQR-001、TPQR-003、TPQR-004 交付 disabled-by-default 内部 runtime source module **plan** artifact（behind explicit feature flag）。

Phase 3J 要求：

- 不得直接将任何 source function 写入 `data/queries.ts`、`features/mobile/lib/mobile-command-read-model.ts`、`app/`、`app/api/` 或任何 production 路径
- 不得修改 `prisma/schema.prisma`
- 不得实现 official write / automated execution
- 需要解决 function-to-DB seam 设计（plan-only，不实现）
- 需要解决 threshold calibration 路径（plan-only）
- 需要明确 permission/capability 继承方式（plan-only）
- Phase 3J 完成并通过独立 review 后方可申请真实 runtime source implementation
