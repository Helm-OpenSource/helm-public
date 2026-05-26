---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-06-02
artifact_type: requirements
runtime_adoption: no-go
---

# B2B Sales Advancement Pack Requirements

## 1. 状态与目标

本文把本地完成评审的 `B2B Sales Advancement Pack` 转成仓库内第一版可执行需求。

当前阶段只成立：

- repo-tracked requirements
- alias-only fixture pack
- deterministic offline eval
- Pack A overlap / Core arbitration / Tenant Overlay 收窄边界

当前阶段不成立，也不授权：

- runtime / API / UI / schema / connector capability
- marketplace / workflow platform / remote execution
- auto-send / silent CRM write / price commitment / direct Must Push truth
- production query adoption

目标是证明行业 Pack 不是 worker / skill catalog，而是一个行业经营判断合同：它声明对象、字段、signal、rubric、proof、action template、worker binding 与 fixture gate；最终 truth 仍由 Helm Core 仲裁。

## 2. 设计结论

### 2.1 Industry Pack 分层

| 层 | 职责 | 边界 |
|---|---|---|
| Helm Core | lifecycle、trace、review-first、permission、proof、workspace isolation、Must Push arbitration | 不为行业 fork Core |
| B2B Sales Advancement Pack | B2B advancement 对象、字段、signal、rubric、proof、action template、worker binding、offline fixtures | 只输出 candidate，不拥有 truth |
| Tenant Overlay | 租户字段映射、owner alias、freshness、review 收窄 | 只能收窄 Pack / Core，不能扩大 |

强制关系：

```text
Tenant Overlay subset Industry Pack subset Helm Core
```

### 2.2 Pack A 关系

`B2B Sales Advancement Pack` 与 Pack A 是 `coexist_then_upgrade`：

- Pack A 继续承担 readiness / pilot baseline。
- 本 Pack 只覆盖 B2B advancement 的行业化判断合同。
- supersede 粒度只能是 `per_signal`，不存在整 Pack 接管。
- overlap 必须经 `pack_compatibility_gate` 去重，禁止 silent overlap / silent supersede。
- Core 合并 candidate 时必须保留 `sourcePack` trace，合并结果仍是 `candidate-only`。

## 3. Manifest Contract

入库 manifest 必须包含并保持以下顶层字段：

- `packId` / `packName` / `packVersion`
- `helmCoreCompat`
- `industryArchetype`
- `status`
- `ownershipBoundary: candidate-only`
- `relationshipToPackA`
- `coreObjects`
- `criticalFields`
- `signals`
- `signalEvaluationOrder`
- `signalConflictResolution`
- `judgementRubrics`
- `proofPolicies`
- `actionTemplates`
- `workerSkillBindings`
- `permissionSummary`
- `tenantOverlayRules`
- `degradationPolicy`
- `confidenceSourceEnum`

任一字段缺失或弱化都应使 `eval:industry-pack-b2b` fail。

## 4. Critical Fields

| 字段 | 影响 | 缺失结果 |
|---|---|---|
| `opportunity.stage` | 推进阶段判断 | `no_judgement` |
| `opportunity.amountBand` | 优先级 / 风险 | `watch_only`，除非 high-value 判断依赖 |
| `opportunity.ownerAlias` | DRI / handoff | `no_judgement` |
| `opportunity.ownerAliasConflict` | owner 冲突标记 | `mapping_gap_review_required` |
| `opportunity.nextStepAt` | stalled / missed follow-through | `no_judgement` |
| `opportunity.lastInteractionAt` | freshness / absence proof | `no_judgement` |
| `account.tier` | customer priority | `watch_only` |
| `account.healthStatus` | risk context | `watch_only` |
| `contact.role` | reviewer / customer-visible context | `mapping_gap_review_required` |
| `contact.relationshipStrength` | draft tone / risk | `watch_only` |
| `email_thread.lastCustomerReplyAt` | follow-through evidence | `no_judgement` |

关键字段缺失不能被低置信度猜测替代；必须降级到 `no_judgement`、`watch_only` 或 `mapping_gap_review_required`。

## 5. Signal Contract

本 Pack 第一版只允许 5 个 signal：

| Signal | 用途 | Rubric |
|---|---|---|
| `stalled_opportunity` | next step overdue 且 freshness window 内没有合格互动 | `b2b_advancement_priority` |
| `missed_follow_through` | meeting 后 48h 未承接 | `customer_visible_risk` |
| `high_value_owner_gap` | 高价值机会 owner 缺失或冲突 | `mapping_gap_degradation` |
| `customer_visible_draft_needed` | 客户要求材料 / 下一步，且没有 reviewed response | `customer_visible_risk` |
| `mapping_gap_blocks_advancement` | judgement-critical 字段缺失阻塞判断 | `mapping_gap_degradation` |

Signal evaluation order 固定为：

1. `customer_visible_draft_needed`
2. `stalled_opportunity`
3. `missed_follow_through`
4. `high_value_owner_gap`
5. `mapping_gap_blocks_advancement`

冲突规则：

- `high_value_owner_gap` 在 owner 冲突或缺失是主阻塞时优先于 `mapping_gap_blocks_advancement`。
- `mapping_gap_blocks_advancement` 只能作为 generic fallback。
- 多 signal 可以同时存在，但 Core 必须先 dedupe candidate，再考虑 Must Push。

## 6. Routing Matrix

每条 Pack fixture 必须命中唯一 routing row。

| Route | Signal / default | Rubric / evaluator | Branch | Proof | Action | Fixture |
|---|---|---|---|---|---|---|
| R1 | `stalled_opportunity` | `b2b_advancement_priority` | `review_required_priority_candidate` | `absence_of_interaction_review` | `prepare_owner_handoff` | `b2b_advancement_001` |
| R2 | `stalled_opportunity` | `b2b_advancement_priority` | `watch_only` | `source_snapshot_timestamp` | `mark_watch_only` | `b2b_advancement_005` |
| R3 | `missed_follow_through` | `customer_visible_risk` | `internal_handoff_only` | `absence_of_interaction_review` | `prepare_owner_handoff` | `b2b_advancement_002` |
| R4 | `customer_visible_draft_needed` | `customer_visible_risk` | `draft_review_required` | `customer_visible_draft_review` | `prepare_customer_followup_draft` | `b2b_advancement_003`, `b2b_advancement_011` |
| R5 | `customer_visible_draft_needed` | `customer_visible_risk` | `deny` | `denied_internal_record` | `mark_internal_denied` | `b2b_advancement_006`, `b2b_advancement_012` |
| R6 | `high_value_owner_gap` | `mapping_gap_degradation` | `mapping_gap_review_required` | `source_snapshot_timestamp` | `request_mapping_gap_review` | `b2b_advancement_007` |
| R7 | `mapping_gap_blocks_advancement` | `mapping_gap_degradation` | `no_judgement` | `source_snapshot_timestamp` | `request_mapping_gap_review` | `b2b_advancement_004`, `b2b_advancement_010` |
| R8 | `mapping_gap_blocks_advancement` | `mapping_gap_degradation` | `mapping_gap_review_required` | `source_snapshot_timestamp` | `request_mapping_gap_review` | `b2b_advancement_009` |
| R9 | `no_signal_healthy_snapshot` | `healthy_snapshot_default` | `none` | `source_snapshot_timestamp` | `mark_watch_only` | `b2b_advancement_008` |

Core compatibility fixtures 不走 Pack routing：

| Route | Core gate | Decision | Fixture |
|---|---|---|---|
| C1 | `tenant_overlay_narrowing_validator` | `reject_overlay_broadening` | `core_compat_001` |
| C2 | `pack_compatibility_gate` | `merge_duplicate_candidates_with_source_trace` | `core_compat_002` |

## 7. Rubric / Proof / Action Requirements

### 7.1 Rubrics

- `b2b_advancement_priority`: `review_required_priority_candidate` / `watch_only` / `no_judgement`
- `customer_visible_risk`: `draft_review_required` / `internal_handoff_only` / `deny`
- `mapping_gap_degradation`: `no_judgement` / `watch_only` / `mapping_gap_review_required`

`deny` 必须覆盖 pricing / terms / legal commitment、worker provenance 缺失、boundary 不允许的 customer-visible 输出。

### 7.2 Proof policies

- `source_snapshot_timestamp`: `sourceObjectAlias` / `checkedAt` / `freshnessWindow`
- `absence_of_interaction_review`: `sourceObjectAlias` / `checkedSourceList` / `checkedTimeWindow` / `noQualifyingInteractionFound` / `reviewerAlias`
- `customer_visible_draft_review`: `sourceObjectAlias` / `latestInteractionAlias` / `boundaryNote` / `reviewerAlias` / `nonCommitmentNote`
- `denied_internal_record`: `sourceObjectAlias` / `deniedReason` / `checkedAt` / `boundaryRule`

### 7.3 Action templates

| Action | Class | Customer-visible | Review | Output |
|---|---|---|---|---|
| `prepare_owner_handoff` | handoff | false | false | `internal_review_packet` |
| `prepare_customer_followup_draft` | draft | true | true | `draft_only` |
| `request_mapping_gap_review` | ask_review | false | true | `mapping_gap_readout` |
| `prepare_proof_request` | ask_review | false | true | `proof_request` |
| `mark_internal_denied` | deny | false | false | `denied_readout` |
| `mark_watch_only` | watch | false | false | `operating_readout_candidate` |

## 8. Worker / Skill Binding Requirements

Worker / skill 只是执行单元，不是 Pack 的 truth owner。

| Worker | Allowed output |
|---|---|
| `b2b_signal_reader` | `signal_candidate` |
| `b2b_mapping_gap_reader` | `mapping_gap_candidate` |
| `b2b_draft_preparer` | `draft_review_packet` |
| `b2b_proof_preparer` | `proof_candidate` |

Worker output 进入下游 action 前必须：

1. 通过 rubric branch。
2. 携带 `provenance` / `branchId` / `rubricVersion`。
3. 经过 Core arbitration。

否则必须走 R5 `deny`。

## 9. Permission / Overlay Requirements

`permissionSummary` 是声明，不是授权。最终允许集由 Core permission gate 计算。

| 轨道 | 允许内容 |
|---|---|
| `autoAllowed` | 只读 alias source objects、internal review packet、mapping gap readout、watch-only candidate |
| `reviewRequired` | customer-visible draft、proof request、owner conflict handoff |
| `neverAllowed` | send customer message、write CRM silently、commit pricing、approve legal terms、settle commercial exception、create direct Must Push truth |

Tenant Overlay 只能收窄：

- 可收窄：`freshnessWindow` / `reviewRequired` / `allowedSourceObject` / `allowedActionTemplate` / `ownerAliasMapping`
- 不可拓宽：`autoAllowed` / `customerVisibleActions` / `outboundActions` / `writePermissions` / `coreNeverAllow`

## 10. Offline Eval Requirements

可运行入口：

```bash
npm run eval:industry-pack-b2b
npm run test -- lib/evals/industry-pack-b2b-evals.test.ts
```

Fixture pack:

- [`evals/industry-pack-b2b/b2b-sales-advancement-pack-cases.json`](../../evals/industry-pack-b2b/b2b-sales-advancement-pack-cases.json)
- [`lib/evals/industry-pack-b2b-evals.ts`](../../lib/evals/industry-pack-b2b-evals.ts)
- [`lib/evals/industry-pack-b2b-evals.test.ts`](../../lib/evals/industry-pack-b2b-evals.test.ts)
- [`scripts/industry-pack-b2b-eval.ts`](../../scripts/industry-pack-b2b-eval.ts)

Acceptance:

1. Exactly 12 Pack fixtures.
2. Exactly 2 Core compatibility fixtures.
3. Exactly 9 Pack routes and 2 Core routes.
4. Every Pack fixture maps to exactly one Pack route.
5. Core compat fixtures do not map into Pack routing.
6. Pack A relationship stays `coexist_then_upgrade`, `per_signal`, `coreDedupRequired=true`, `silentOverlapAllowed=false`.
7. Tenant Overlay broadening is rejected by Core compat fixture C1.
8. Pack A overlap is deduped by Core compat fixture C2.
9. Deny branches use `denied_internal_record` and `mark_internal_denied`.
10. No raw PII field, no customer-identifiable text field, no connector/runtime/API/UI/schema capability grant.

## 11. Repo Entry Gate

This gate is now repo-tracked but still offline-only. A later implementation request may only proceed if all of these remain true:

1. Requirements + fixture + eval stay green.
2. Owner explicitly accepts the next implementation layer.
3. Next layer still declares whether it is docs-only, eval-only, readout-only, or runtime.
4. Any runtime/API/UI/schema/connector proposal is a separate PR and cannot be smuggled through this Pack requirements PR.

## 12. 状态短表

| 类别 | 结论 |
|---|---|
| 已经完整成立 | Requirements + alias-only fixture pack + deterministic eval gate |
| 已成形但仍需下一层 | Pack runtime adoption, UI readout, tenant-specific overlay authoring |
| 刻意未做 | runtime / API / UI / schema / connector / marketplace / workflow platform / official write |
| 风险项 | Pack A per-signal supersede 后续若进入 runtime，需要 Core dedupe 和 owner acceptance 再验证 |

## 13. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-02 | 首版入库：B2B Sales Advancement Pack requirements + offline fixture gate；继续 No-Go runtime/API/UI/schema/connector |
