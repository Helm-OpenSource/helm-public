---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Business Advancement Phase 3G Source-Query Evidence Audit V1

更新时间：2026-04-26
状态：Source-query evidence audit complete / Runtime adoption No-Go / 条件批准 Phase 3H named source-function planning

---

## 结论

Phase 3G 完成了 TPQR-001、TPQR-003、TPQR-004 三条 family 的 source-query evidence audit。

本阶段回答了 Phase 3F 提出的全部六个 gate 问题，并证明三条 query shape 的边界是安全的、可定义的，但尚未实例化为具名 runtime source function。

**Runtime adoption 继续 No-Go。**

下一步唯一允许的工作是：**Phase 3H 具名 source function 规划**（仍是 planning-only artifact，不得写入 `data/queries.ts`、`features/mobile/lib/mobile-command-read-model.ts` 或任何 runtime 路径）。

---

## 一、Phase 3F 六个问题的回答

### Q1：TPQR-001 是否存在安全的 read-only query source，可以表达 action item blocked beyond threshold without already being in review？

**结论：CONDITIONAL**

- `ActionItem.workspaceId` 为非空 workspace scope（`prisma/schema.prisma`）
- `ActionItem.approvalTask` 为可选 relation（`prisma/schema.prisma`）
- 现有 `loadPendingApprovals` 读取已进入 approval queue 的 task，不等价于 TPQR-001 所需的 "blocked before review" source
- 可以定义安全 query shape：`WHERE workspaceId = :ws AND approvalTask IS NULL AND updatedAt < (:referenceClockMs - :thresholdMs)`
- 该 query shape 是 read-only，基于 approvalTask structural absence 而非持久化 flag
- **Gap**：该 query shape 尚未成为具名 runtime source function

### Q2：TPQR-003 是否可以用 explicit reference clock 做 read-time dueDate/status source query，并完全绕开 persisted overdue flag authority？

**结论：CONDITIONAL**

- `Commitment.dueDate`（DateTime?）与 `Commitment.overdueFlag`（Boolean）均已存在
- 现有 `deriveCommitmentStatus` / `deriveOverdueFlag` 使用 `Date.now()`，不是 explicit referenceClockMs
- 可以定义安全 query shape：`WHERE workspaceId = :ws AND dueDate IS NOT NULL AND dueDate < :referenceClockMs AND status NOT IN ('FULFILLED','CANCELED')`
- 该 query shape 完全不依赖 `Commitment.overdueFlag` 作为 inclusion 过滤条件
- `getCommitments` 已有 read-time derivation 模式，只需接受 referenceClockMs 参数即可适配
- **Gap**：具名 source function 尚未存在

### Q3：TPQR-004 是否可以定义 CRM-linked producer 与 generic producer 的 merge/dedup source boundary？

**结论：CONDITIONAL**

- `EmailThread.opportunityId` 为 nullable FK，是区分 CRM-linked vs generic 的结构性 seam
- 现有 `loadWaitingEmailThreads` 是 generic producer（读取所有 `WAITING_US` thread，不区分 opportunityId）
- CRM-linked producer query shape：`WHERE workspaceId = :ws AND status = 'WAITING_US' AND opportunityId IS NOT NULL`
- After-producer dedup by `emailThread.id`，CRM-linked-first tie-break 已在 Phase 3A PF3A-004 与 Phase 3E 证明
- **Gap**：CRM-linked producer 尚未成为具名 runtime source function；after-producer dedup 尚未有 runtime seam

### Q4：三条 source 是否都继承 workspace membership / capability，而不是在 adapter 内重造权限？

**结论：PASS**

| Family | Schema scope | 继承方式 |
| --- | --- | --- |
| TPQR-001 | `ActionItem.workspaceId` 非空 | WHERE workspaceId = :ws |
| TPQR-003 | `Commitment.workspaceId` 非空，有索引 | WHERE workspaceId = :ws |
| TPQR-004 | `EmailThread.workspaceId` 非空 | WHERE workspaceId = :ws |

三条 source 均通过 WHERE workspaceId = :ws 继承现有工作区边界，不在 adapter 内重建权限逻辑。

### Q5：三条 source 是否可以通过 feature flag / family disable switch 完整关闭？

**结论：PASS**

Phase 3E 已建立 per-family disable switch：

- `enabledFamilies.blockedDecision = false` → TPQR-001 不查询、不生成 candidate
- `enabledFamilies.overdueCommitment = false` → TPQR-003 不查询、不生成 candidate
- `enabledFamilies.customerWaiting = false` → TPQR-004 不查询（含 CRM-linked 与 generic 两个 producer）、不生成 candidate

默认值均为 `false`（继承 `DEFAULT_THIN_READ_MODEL_ADAPTER_ENABLED_FAMILIES`）。

### Q6：三条 source 是否能提供 audit bundle：source row、rule version、threshold status、exclusion reason？

**结论：PASS**

Phase 3E adapter contract 已定义 audit bundle 字段：

| Family | sourceRowId | ruleVersion | thresholdStatus | exclusion reasons |
| --- | --- | --- | --- | --- |
| TPQR-001 | ActionItem.id | phase3g-source-query-evidence-audit/v1（采用时） | calibration_placeholder | threshold_not_met、already_in_review、workspace_boundary_not_confirmed |
| TPQR-003 | Commitment.id | 同上 | calibration_placeholder | terminal_status、missing_due_date、threshold_not_met、workspace_boundary_not_confirmed |
| TPQR-004 | EmailThread.id + dedupKey | 同上 | calibration_placeholder | deduped_by_email_thread_id_after_producers、threshold_not_met、workspace_boundary_not_confirmed |

---

## 二、Query Shape 证明矩阵

| shapeId | tpqrId | WHERE clause | explicitClock | persistedFlagAuthority | wsInherited | gateStatus |
| --- | --- | --- | --- | --- | --- | --- |
| tpqr001_blocked_decision | TPQR-001 | `workspaceId = :ws AND approvalTask IS NULL AND updatedAt < (:referenceClockMs - :thresholdMs)` | true | false | true | needs_named_runtime_function |
| tpqr003_overdue_commitment | TPQR-003 | `workspaceId = :ws AND dueDate IS NOT NULL AND dueDate < :referenceClockMs AND status NOT IN ('FULFILLED','CANCELED')` | true | false | true | needs_named_runtime_function |
| tpqr004_crm_linked_producer | TPQR-004 | `workspaceId = :ws AND status = 'WAITING_US' AND opportunityId IS NOT NULL` | false | false | true | needs_named_runtime_function |
| tpqr004_generic_producer | TPQR-004 | `workspaceId = :ws AND status = 'WAITING_US'` | false | false | true | needs_named_runtime_function |

所有 query shape 均声明 `persistedFlagAuthority=false` 与 `workspaceScopeInherited=true`。

---

## 三、Evidence Row 汇总

| evidenceId | tpqrId | question | verdict |
| --- | --- | --- | --- |
| EV-001-001 | TPQR-001 | Q1_tpqr001_safe_readonly_source | PASS |
| EV-001-002 | TPQR-001 | Q1_tpqr001_safe_readonly_source | PASS |
| EV-001-003 | TPQR-001 | Q1_tpqr001_safe_readonly_source | CONDITIONAL |
| EV-001-004 | TPQR-001 | Q1_tpqr001_safe_readonly_source | CONDITIONAL |
| EV-001-005 | TPQR-001 | Q4_workspace_membership_inherited | PASS |
| EV-001-006 | TPQR-001 | Q5_family_disable_switch | PASS |
| EV-001-007 | TPQR-001 | Q6_audit_bundle_fields | PASS |
| EV-003-001 | TPQR-003 | Q2_tpqr003_explicit_clock_source | PASS |
| EV-003-002 | TPQR-003 | Q2_tpqr003_explicit_clock_source | CONDITIONAL |
| EV-003-003 | TPQR-003 | Q2_tpqr003_explicit_clock_source | CONDITIONAL |
| EV-003-004 | TPQR-003 | Q2_tpqr003_explicit_clock_source | CONDITIONAL |
| EV-003-005 | TPQR-003 | Q4_workspace_membership_inherited | PASS |
| EV-003-006 | TPQR-003 | Q5_family_disable_switch | PASS |
| EV-003-007 | TPQR-003 | Q6_audit_bundle_fields | PASS |
| EV-004-001 | TPQR-004 | Q3_tpqr004_crm_generic_dedup_boundary | PASS |
| EV-004-002 | TPQR-004 | Q3_tpqr004_crm_generic_dedup_boundary | PASS |
| EV-004-003 | TPQR-004 | Q3_tpqr004_crm_generic_dedup_boundary | CONDITIONAL |
| EV-004-004 | TPQR-004 | Q3_tpqr004_crm_generic_dedup_boundary | CONDITIONAL |
| EV-004-005 | TPQR-004 | Q4_workspace_membership_inherited | PASS |
| EV-004-006 | TPQR-004 | Q5_family_disable_switch | PASS |
| EV-004-007 | TPQR-004 | Q6_audit_bundle_fields | PASS |

---

## 四、已经完整成立

| 项目 | 结论 |
| --- | --- |
| Q4 workspace scope 继承 | 三条 family 均通过 workspaceId WHERE 子句继承现有工作区边界，无需重建权限 |
| Q5 per-family disable switch | Phase 3E 建立的三个开关均有效；默认全部 false |
| Q6 audit bundle 字段 | Phase 3E adapter contract 已定义所有必要 audit 字段，包括 sourceRowId、ruleVersion、thresholdStatus、exclusionReason |
| TPQR-001 schema seam | ActionItem.approvalTask 可选 relation 是识别 "blocked before review" 的结构性依据 |
| TPQR-003 dueDate/status 派生规则 | dueDate < referenceClockMs AND status NOT IN terminal 可完全绕开 persisted overdueFlag |
| TPQR-004 CRM/generic producer boundary | EmailThread.opportunityId IS NOT NULL 是 CRM-linked producer 的结构性 seam；after-producer dedup 设计已证明 |

---

## 五、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| TPQR-001 source function | query shape 证明完成 | Phase 3H：具名 planning-only source function artifact，不写入 data/queries.ts |
| TPQR-003 source function | query shape 证明完成；`getCommitments` 存在 Date.now() gap | Phase 3H：具名 planning-only source function，显式接受 referenceClockMs |
| TPQR-004 CRM-linked producer | query shape 证明完成；无具名 runtime function | Phase 3H：具名 planning-only source function artifact |
| TPQR-004 after-producer dedup seam | 设计在 Phase 3A/3E 已证明 | Phase 3H：planning-only artifact 中实例化 merge/dedup function |
| Threshold calibration | 三条 family 仍为 calibration_placeholder | 需要真实数据校准或 explicit conservative default，方可进入 runtime |

---

## 六、刻意未做

| 未做项 | 原因 |
| --- | --- |
| 不修改 `data/queries.ts` | Phase 3G 不是 production query adoption |
| 不修改 `features/mobile/lib/mobile-command-read-model.ts` | Phase 3G 不是 mobile read-model 修改 |
| 不修改 `app/` 或 `app/api/` | Phase 3G 不新增 UI / API surface |
| 不修改 `prisma/schema.prisma` | Phase 3G 不新增 schema |
| 不新增具名 runtime source function | Phase 3G 只做 evidence audit，不做 runtime instantiation |
| 不做 TPQR-002 / TPQR-005 | 仍维持 No-Go |
| 不做 official write / automated execution | Business Advancement 当前仍是 review-first planning layer |

---

## 七、验证结果

已运行并通过：

- `npx vitest run features/business-advancement/source-query-evidence-audit.test.ts`
  - 1 file / 23 tests PASS
- `npx tsx scripts/business-advancement-source-query-evidence-audit.ts`
  - 10/10 checks PASS，exit 0
- `npx eslint features/business-advancement/source-query-evidence-audit.ts features/business-advancement/source-query-evidence-audit.test.ts scripts/business-advancement-source-query-evidence-audit.ts`
  - No errors
- `git diff --check`
  - Clean

Phase 3G evaluator checks：

1. `all_evidence_rows_have_correct_rule_version`
2. `all_six_phase3f_questions_answered`
3. `all_three_families_have_evidence`
4. `no_persisted_flag_authority_in_query_shapes`
5. `all_query_shapes_inherit_workspace_scope`
6. `tpqr003_query_shape_requires_explicit_clock`
7. `tpqr004_has_both_crm_and_generic_producer_shapes`
8. `all_query_shapes_have_disable_switches`
9. `no_runtime_adoption_in_audit`
10. `gap_evidence_rows_have_gap_detail`

---

## 八、当前决策

| 决策项 | 结论 |
| --- | --- |
| Phase 3G source-query evidence audit | **Complete** |
| Runtime adoption | **No-Go** |
| Schema / API / UI / mobile read-model / production query adoption | **No-Go** |
| Official write / automated execution / LLM final ranking | **No-Go** |
| Phase 3H named source-function planning | **Conditional-Go**（需单独 Phase 3H review，仍是 planning-only artifact） |

下一步唯一允许的工作：

**Phase 3H**：为 TPQR-001、TPQR-003、TPQR-004 分别交付具名 planning-only source function artifact。要求：

- 不写入 `data/queries.ts`
- 不写入 `features/mobile/lib/mobile-command-read-model.ts`
- 不修改 `app/`、`app/api/`、`prisma/schema.prisma`
- 每个 function 接受 `workspaceId` 与 `referenceClockMs`，返回 planning-only typed result
- 每个 function 有 workspace scope 验证、explicit clock 注入（TPQR-003）、after-producer dedup（TPQR-004）
- Phase 3H 完成后需单独 Phase 3H runtime source review 方可申请 runtime adoption
