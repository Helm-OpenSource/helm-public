---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Business Advancement Phase 2C — Thin Projection Query Review Report V1

更新时间：2026-04-26
状态：Phase 2C query-review-only complete / runtime adoption not started
本阶段：Thin Projection Query Review（5 个 thin projection 的 query-level 评审）
上游报告：[HELM_BUSINESS_ADVANCEMENT_PHASE2B_READ_MODEL_PROJECTION_PROOF_REPORT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE2B_READ_MODEL_PROJECTION_PROOF_REPORT_V1.md)

---

## 声明

**Phase 2C 是 query-review-only，未进入 runtime implementation。**

本报告对 Phase 2B 标记为 `needs_thin_projection_review` 的五个 thin projection 完成 query-level 评审：提出 proposed read-only where clause，确认 workspace scope，记录 membership/capability gate，列出 excluded states 和 noise guards，并记录残留风险。

本阶段 **不** 包含：
- 任何 Prisma schema 新增
- 任何 API route 新增
- 任何 runtime extractor 或 event ingestion
- 任何 official write / auto-write
- 任何 execution authority
- 任何 LLM final ranking
- 任何 dashboard / mobile / operating 页面行为变更
- 任何生产 runtime query 变更

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Query review artifact | `features/business-advancement/thin-projection-query-review.ts` | 5 行 review rows，覆盖 TPQR-001 至 TPQR-005；每行含 proposedReadOnlyWhereClause、workspaceScopeCheck、membershipCapabilityGateCheck、excludedStatesOrNoiseGuards、boundaryNote、runtimeAdoptionPosture、readinessStatus、residualRisk |
| Query review evaluator | `features/business-advancement/thin-projection-query-review.ts :: evaluateThinProjectionQueryReview` | 9 项纯函数检查；全部通过 |
| Query review tests | `features/business-advancement/thin-projection-query-review.test.ts` | 16 个测试，全部通过；覆盖 fixture coverage、active candidate check、forbidden authorization、where clause logical connector regression、workspace/membership fields、per-fixture special checks |
| Query review CLI | `scripts/business-advancement-thin-projection-query-review.ts` | 打印 review 摘要，exit 0 on pass / 1 on fail；无 DB、无网络、无 write authority |

**当前 review 结果：**

| Review ID | Source | Fixture | Signal type | Readiness |
| --- | --- | --- | --- | --- |
| TPQR-001 | meeting | AS-FX-002 | blocked_decision | `query_review_passed_for_later_thin_projection` |
| TPQR-002 | crm | AS-FX-004 | stalled_opportunity | `query_review_passed_for_later_thin_projection` |
| TPQR-003 | crm | AS-FX-005 | overdue_commitment | `query_review_passed_for_later_thin_projection` |
| TPQR-004 | crm | AS-FX-006 | customer_waiting | `query_review_passed_for_later_thin_projection` |
| TPQR-005 | tenant_resource | AS-FX-007 | stalled_case | `query_review_passed_for_later_thin_projection` |

**Phase 2B 残留风险解消：**

| Phase 2B 残留风险 | Phase 2C 结论 |
| --- | --- |
| `db.commitment` 表 workspace scope 未经 Phase 2B 明确验证 | **已解消**：`prisma/schema.prisma` line 3916 确认 `Commitment.workspaceId` 非空 FK，含 CASCADE delete；多个 `(workspaceId, ...)` 复合索引存在 |
| crm AS-FX-006 的 emailThread FK 完整性未经 Phase 2B 验证 | **已解消**：`prisma/schema.prisma` line 3022 确认 `EmailThread.opportunityId` FK 存在；两个表均有独立 `workspaceId` 列；join 安全 |

**Proposed where clauses（概要）：**

| Review ID | Table | Key where clauses |
| --- | --- | --- |
| TPQR-001 | ActionItem | workspaceId, meetingId IS NOT NULL, status IN PENDING_APPROVAL/MANUAL, approvalTask IS NULL, updatedAt < now-48h |
| TPQR-002 | Opportunity | workspaceId, stage NOT IN DONE/LOST, updatedAt < now-14d, dueDate exclusion guard |
| TPQR-003 | Commitment | workspaceId, dueDate < now, status NOT FULFILLED/CANCELED, ownerUserId IS NULL OR updatedAt < now-7d |
| TPQR-004 | EmailThread | workspaceId, opportunityId IS NOT NULL, status = WAITING_US, opportunity.stage NOT DONE/LOST, opportunity.updatedAt < now-7d |
| TPQR-005 | TenantResourceOperatingImpactReadout (in-memory) | severity IN medium/low, not blocked/proof items, derivedStaleDays > 14, take: 2 noise guard |

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| TPQR-001 48h threshold | Query review 通过；where clause 结构已定 | 实现前需用真实数据校准 48h threshold 是否会漏掉合理的新建未分配 action item |
| TPQR-002 updatedAt vs "last human activity" | 14d staleness 用 updatedAt；系统自动同步可能误重置 updatedAt | 实现前需评估 opportunity 有多少由系统 job 自动更新；可能需要 `lastHumanActivityAt` 字段，但这需要新增字段，须评审 |
| TPQR-003 ownerUserId/updatedAt heuristic | 7d heuristic 合理但粗糙 | 实现前需验证 `Commitment.overdueFlag` 是否已被现有流程维护；如果是，改用 `overdueFlag = true` 更可靠 |
| TPQR-004 deduplication | opportunityId IS NOT NULL 过滤减少重叠 | 实现时必须确认与 `loadWaitingEmailThreads`（已有 WAITING_US 逻辑）不会双重展示同一线程 |
| TPQR-005 derivedStaleDays 计算 | in-memory filter 结构已定 | 实现时需确认 `staleDays` 从哪个字段计算（connector.lastSyncedAt vs importSource.updatedAt）；take: 2 上限需实际验证 |
| 所有 5 个 thin projection | Phase 2C 完成 query-level review | Phase 2C 不是 runtime 实现；下一阶段（Phase 3 read model integration）才能考虑实际接入 |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| Prisma schema 新增 | Phase 2C 是 query review，不持久化，不新增表或字段 |
| API route | 不暴露 runtime 接口 |
| Runtime extractor | 不扫描实时数据 |
| Event ingestion / queue | 不创建事件流 |
| Official write / auto-write | 永久禁止 |
| Page behavior change | 未接任何页面 |
| LLM final ranking | 不涉及 |
| AS-FX-001 / AS-FX-003 query review（current_read_model_supported） | 这两个 fixtures 已经是 current_read_model_supported；不需要 thin projection review；Phase 2C 只评审 requires_thin_projection 的 5 个 |
| email / combined / user_behavior sources | Phase 2C 只做 meeting/crm/tenant_resource 的 thin projections；email/combined 的 thin projections（AS-FX-013/018/019/020）不在本轮范围 |
| 生产 runtime query 实现 | Phase 2C query review 不等于实现授权；runtime adoption 需要单独评审 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| TPQR-002：系统 job 误重置 updatedAt 导致 staleness 检测失效 | 中 | `loadHighRiskOpportunities` 中已有 `updatedAt` 用法；但如果自动 sync job 每日更新所有 opportunity，14d staleness 会失效。实现前需验证 opportunity 更新来源 |
| TPQR-003：`Commitment.overdueFlag` 可能比 `dueDate < now` 更可靠 | 低 | schema 中 `overdueFlag Boolean @default(false)` 存在；如果现有 commitment 管理流程维护此 flag，则 `overdueFlag = true` 是更精确的 overdue 检测；需在实现前确认 |
| TPQR-004：WAITING_US 线程与 loadWaitingEmailThreads 重叠 | 中 | 实现时若两个路径同时 active，同一 WAITING_US 线程可能出现两次。需要 deduplication 逻辑（按 emailThread.id 去重）；这不是 Phase 2C 的阻塞，但实现时必须处理 |
| TPQR-005：derivedStaleDays 计算来源不确定 | 中 | `TenantResourceOperatingImpactItem` 不暴露 staleDays 字段；需在 readout 管道内从 connector.lastSyncedAt 或 importSource.updatedAt 推导；计算逻辑要测试，防止系统 sync 误重置 |
| 5 个 thin projections 全部 `query_review_passed` 但均 `review_only_not_implemented` | 低 | 这是预期结论；Phase 2C 是 query review，不是实现授权。下一阶段才能考虑 runtime 接入 |

---

## 五、验证结果

### 5.1 Query review tests

```
npx vitest run features/business-advancement/thin-projection-query-review.test.ts

 Test Files  1 passed (1)
      Tests  16 passed (16)
```

### 5.2 Query review CLI

```
npx tsx scripts/business-advancement-thin-projection-query-review.ts

Helm Business Advancement — Phase 2C Thin Projection Query Review
================================================================
Review rows:     5

TPQR-001  meeting/AS-FX-002  [blocked_decision]
  Table:         ActionItem
  Where:         workspaceId = $workspaceId AND meetingId IS NOT NULL AND ...
  Readiness:     query_review_passed_for_later_thin_projection
  Posture:       review_only_not_implemented

TPQR-002  crm/AS-FX-004  [stalled_opportunity]
  ...
  Readiness:     query_review_passed_for_later_thin_projection

TPQR-003  crm/AS-FX-005  [overdue_commitment]
  ...
  Readiness:     query_review_passed_for_later_thin_projection

TPQR-004  crm/AS-FX-006  [customer_waiting]
  ...
  Readiness:     query_review_passed_for_later_thin_projection

TPQR-005  tenant_resource/AS-FX-007  [stalled_case]
  ...
  Readiness:     query_review_passed_for_later_thin_projection

Eval Checks:
  PASS exactly_five_review_rows
  PASS required_fixture_ids_covered
  PASS all_fixtures_are_active_candidates
  PASS all_postures_review_only_not_implemented
  PASS no_forbidden_authorization_patterns
  PASS non_empty_scope_gate_and_risk_fields
  PASS commitment_workspace_scope_addressed
  PASS email_thread_fk_workspace_addressed
  PASS tenant_resource_noise_guard_present

9/9 checks passed
Phase 2C thin projection query review PASSED
```

### 5.3 ESLint

```
npx eslint features/business-advancement/thin-projection-query-review.ts \
  features/business-advancement/thin-projection-query-review.test.ts \
  scripts/business-advancement-thin-projection-query-review.ts

(0 errors, 0 warnings)
```

### 5.4 Git whitespace check

```
git diff --check -- \
  features/business-advancement/thin-projection-query-review.ts \
  features/business-advancement/thin-projection-query-review.test.ts \
  scripts/business-advancement-thin-projection-query-review.ts \
  docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE2C_THIN_PROJECTION_QUERY_REVIEW_REPORT_V1.md \
  docs/README.md

(0 whitespace errors)
```

---

## 六、下一阶段建议

Phase 2C 已完成 5 个 thin projection 的 query-level review，所有 review row 的 readiness 为 `query_review_passed_for_later_thin_projection`。下一阶段（Phase 3 read model integration）建议：

1. 对 TPQR-003 先确认 `Commitment.overdueFlag` 的维护状态；如果已维护，改用 `overdueFlag = true` 替换 `dueDate < now` 检测。
2. 对 TPQR-002 验证 opportunity.updatedAt 的更新来源，确认系统 sync 频率不会导致 staleness 误判。
3. 对 TPQR-004 设计 deduplication 逻辑，防止与现有 `loadWaitingEmailThreads` 重叠。
4. 对 TPQR-005 在 readout 管道内明确 `staleDays` 的计算来源。
5. 完成上述验证后，再评估是否进入 Phase 3 runtime implementation。

**未完成上述验证前，不进入 runtime extractor、official write、auto execution 或页面行为变更。**
