---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3H Named Source Function Planning V1

更新时间：2026-04-26
状态：Named source function planning complete / Runtime adoption No-Go / 条件批准 Phase 3I runtime source review

---

## 结论

Phase 3H 完成了 TPQR-001、TPQR-003、TPQR-004 三条 family 的具名 planning-only source function artifact 交付。

三个具名 source function 已在合成 fixture 行上验证，并通过 44 项 vitest 测试和 11/11 CLI evaluator checks。

**Runtime adoption 继续 No-Go。**

下一步唯一允许的工作是：**Phase 3I runtime source review**（单独 review，不得直接将这些 source function 写入任何 production 路径）。

---

## 一、Phase 3H 是什么

Phase 3H 将 Phase 3G 已证明的三条 query shape 实例化为具名的、纯 TypeScript planning-only source function，以合成 fixture 行作为唯一输入。

**本阶段不是、也没有做：**

- 不是 runtime adapter，不是 DB reader，不是 production query
- 不是 API route，不是 UI 变更，不是 schema 变更
- 不是 mobile read-model 修改（不触及 `features/mobile/lib/mobile-command-read-model.ts`）
- 不修改 `data/queries.ts`
- 不修改 `app/` 或 `app/api/`
- 不修改 `prisma/schema.prisma`
- 不做 official write，不做 automated execution
- 不做 LLM final ranking
- 不进行 threshold 真实校准（thresholdStatus 仍为 `calibration_placeholder`）
- 不做 TPQR-002 / TPQR-005

---

## 二、三个具名 source function

### 2.1 `sourceBlockedDecisionCandidates` — TPQR-001

**文件：** `features/business-advancement/phase3h-source-function-planning.ts`

**Query shape（planning-only）：**
```
ActionItem WHERE workspaceId = :ws
  AND approvalTask IS NULL
  AND updatedAt < (:referenceClockMs - :thresholdMs)
```

**行为：**
- `enabled=false`：所有行以 `disabled` 排除，返回 0 candidates
- `workspaceId` 不匹配：`workspace_mismatch` 排除
- `hasApprovalTask=true`：`already_in_review` 排除（即使行已非常 stale）
- `updatedAtMs >= cutoffMs`：`threshold_not_met` 排除，audit.thresholdStatus = `threshold_not_met`
- 通过：返回 candidate，携带 `stalenessMs` 与完整 audit bundle

**Fixture 结果（enabled=true）：** included=1，excluded=3

### 2.2 `sourceOverdueCommitmentCandidates` — TPQR-003

**Query shape（planning-only）：**
```
Commitment WHERE workspaceId = :ws
  AND dueDate IS NOT NULL
  AND dueDate < :referenceClockMs
  AND status NOT IN ('FULFILLED', 'CANCELED')
```

**行为：**
- `enabled=false`：所有行以 `disabled` 排除
- `workspaceId` 不匹配：`workspace_mismatch` 排除
- `dueDateMs === null`：`missing_due_date` 排除
- status 在 terminal set：`terminal_status` 排除
- `dueDateMs >= referenceClockMs`：`threshold_not_met` 排除
- 通过：返回 candidate，携带 `overdueByMs` 与完整 audit bundle
- **关键**：`persistedOverdueFlag` 字段携带但不作为 inclusion 过滤依据；翻转全部 `persistedOverdueFlag` 不改变 candidate inclusion（已通过 non-authority proof 验证）
- `referenceClockMs` 由调用方显式注入，不读取 wall clock

**Fixture 结果（enabled=true）：** included=2，excluded=4

### 2.3 `sourceCustomerWaitingCandidates` — TPQR-004

**Query shape（planning-only）：**

CRM-linked producer：
```
EmailThread WHERE workspaceId = :ws
  AND status = 'WAITING_US'
  AND opportunityId IS NOT NULL
```

Generic producer：
```
EmailThread WHERE workspaceId = :ws
  AND status = 'WAITING_US'
```

**行为：**
- `enabled=false`：所有行以 `disabled` 排除
- `workspaceId` 不匹配：`workspace_mismatch` 排除
- `threadStatus !== 'WAITING_US'`：`not_waiting_us` 排除
- After-producer dedup by `emailThreadId`：CRM-linked 优先；generic producer 中与 CRM-linked 共享同一 `emailThreadId` 的行以 `deduped_by_crm_linked` 排除
- 返回 `crmLinkedCandidateCount` 与 `genericCandidateCount` 统计

**Fixture 结果（enabled=true）：** included=2，excluded=3，crm=1，generic=1

---

## 三、Evaluator checks（11/11）

| # | checkName | 结论 |
|---|---|---|
| 1 | `all_functions_disabled_when_enabled_false` | PASS |
| 2 | `workspace_mismatch_excluded_for_all_families` | PASS |
| 3 | `tpqr001_stale_no_review_row_included` | PASS |
| 4 | `tpqr001_in_review_row_excluded` | PASS |
| 5 | `tpqr001_fresh_row_excluded` | PASS |
| 6 | `tpqr003_persisted_flag_non_authority` | PASS |
| 7 | `tpqr003_reference_clock_controls_inclusion` | PASS |
| 8 | `tpqr004_both_producers_used` | PASS |
| 9 | `tpqr004_dedup_crm_linked_winner` | PASS |
| 10 | `audit_metadata_complete_on_all_results` | PASS |
| 11 | `no_runtime_imports_or_forbidden_patterns` | PASS |

---

## 四、验证结果

已运行并通过：

- `npx vitest run features/business-advancement/phase3h-source-function-planning.test.ts`
  - 1 file / **44 tests PASS**
- `npx tsx scripts/business-advancement-phase3h-source-function-planning.ts`
  - **11/11 checks PASS**，runtime posture No-Go，exit 0
- `git diff --check`
  - Clean

---

## 五、当前决策

| 决策项 | 结论 |
|---|---|
| Phase 3H named source function planning | **Complete** |
| Runtime adoption | **No-Go** |
| Schema / API / UI / mobile read-model 修改 | **No-Go** |
| `data/queries.ts` 写入 | **No-Go** |
| Official write / automated execution / LLM final ranking | **No-Go** |
| TPQR-002 / TPQR-005 | **No-Go** |
| Phase 3I runtime source review | **Conditional-Go**（需单独 Phase 3I review，不得直接以本文件结论为依据进行 production adoption） |

下一步唯一允许的工作：

**Phase 3I**：针对这三个具名 source function 进行独立 runtime source review。要求：

- 不得直接将 `sourceBlockedDecisionCandidates`、`sourceOverdueCommitmentCandidates`、`sourceCustomerWaitingCandidates` 写入 `data/queries.ts`、`features/mobile/lib/mobile-command-read-model.ts`、`app/`、`app/api/` 或任何 production 路径
- 需要真实数据校准或明确的 conservative default，方可替代 `calibration_placeholder`
- Phase 3I 完成并通过独立 review 后方可申请 production adoption
