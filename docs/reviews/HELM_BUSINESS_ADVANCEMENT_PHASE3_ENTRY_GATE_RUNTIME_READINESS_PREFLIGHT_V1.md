---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3 Entry Gate — Runtime Readiness Preflight V1

更新时间：2026-04-26
状态：Phase 3 entry gate preflight complete / runtime adoption not started
本阶段：Runtime Readiness Preflight（5 个 thin projection 的 runtime 就绪度预检）
上游报告：[HELM_BUSINESS_ADVANCEMENT_PHASE2C_THIN_PROJECTION_QUERY_REVIEW_REPORT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE2C_THIN_PROJECTION_QUERY_REVIEW_REPORT_V1.md)

---

## 声明

**Phase 3 Entry Gate 是 preflight/review-only，未进入 runtime implementation。**

本报告对 Phase 2C 通过 query-level review 的五个 thin projection 完成 runtime 就绪度预检：引用仓库证据回答具体的运行时就绪度问题，标注 `ready_for_thin_read_model_planning` 或 `conditional_requires_runtime_guard`，并为每个条件行给出具体的 guard 要求。

本阶段 **不** 包含：
- 任何 Prisma schema 新增
- 任何 API route 新增
- 任何 runtime extractor 或 event ingestion
- 任何 official write / auto-write
- 任何 execution authority
- 任何 LLM final ranking
- 任何 dashboard / mobile / operating 页面行为变更
- 任何生产 runtime query 实现

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Preflight artifact | `features/business-advancement/runtime-readiness-preflight.ts` | 5 行 preflight rows，覆盖 PF3-001 至 PF3-005；每行含 preflightId、linkedTpqrId、runtimeReadinessStatus、repoEvidence、workspaceMembershipBoundaryConfirmed、conditionalRuntimeGuard（条件行）、runtimeAdoptionPosture |
| Preflight evaluator | `features/business-advancement/runtime-readiness-preflight.ts :: evaluateRuntimeReadinessPreflight` | 9 项纯函数检查；全部通过 |
| Preflight tests | `features/business-advancement/runtime-readiness-preflight.test.ts` | 18 个测试，全部通过；覆盖 fixture coverage、regression guard、TPQR-003 overdueFlag evidence correctness、DB-flag-only guard、conditional guard text、forbidden authorization、TPQR-001 readiness、deduplication、derivedStaleDays |
| Preflight CLI | `scripts/business-advancement-runtime-readiness-preflight.ts` | 打印 preflight 摘要，exit 0 on pass / 1 on fail；无 DB、无网络、无 write authority |

**当前 preflight 结果：**

| Preflight ID | TPQR | Source | Fixture | Signal type | Runtime Readiness Status |
| --- | --- | --- | --- | --- | --- |
| PF3-001 | TPQR-001 | meeting | AS-FX-002 | blocked_decision | `ready_for_thin_read_model_planning` |
| PF3-002 | TPQR-002 | crm | AS-FX-004 | stalled_opportunity | `conditional_requires_runtime_guard` |
| PF3-003 | TPQR-003 | crm | AS-FX-005 | overdue_commitment | `conditional_requires_runtime_guard` |
| PF3-004 | TPQR-004 | crm | AS-FX-006 | customer_waiting | `conditional_requires_runtime_guard` |
| PF3-005 | TPQR-005 | tenant_resource | AS-FX-007 | stalled_case | `conditional_requires_runtime_guard` |

**Phase 2C 残留风险预检结论：**

| Phase 2C 残留风险 | 仓库证据 | Phase 3 结论 |
| --- | --- | --- |
| TPQR-002：系统 job 可能误重置 Opportunity.updatedAt | `loadHighRiskOpportunities` 使用 updatedAt；未找到阻止自动同步重置的代码证据 | **条件行**：runtime 前须确认无 sync job 自动重置 updatedAt |
| TPQR-003：Commitment.overdueFlag 运行时使用方式需明确 | `deriveOverdueFlag` 在 `lib/memory/shared.ts:254`；`getCommitments` 在 `lib/memory/commitment.service.ts:72` 读时派生；`createCommitment` / `updateCommitmentStatus` 在 `lib/memory/commitment.service.ts:112/194` 写入；`data/queries.ts:351` 与 `features/meetings/queries.ts:437` 读取该字段 | **条件行**：runtime 前须避免把持久化 `overdueFlag` 列作为唯一过滤条件；优先使用 dueDate/status heuristic 或既有读时派生逻辑 |
| TPQR-004：WAITING_US 线程与 loadWaitingEmailThreads 重叠 | `loadWaitingEmailThreads` 查询 WAITING_US 线程无 opportunityId 过滤；TPQR-004 是 CRM-scoped 子集；两路径共享同一 status 过滤器 | **条件行**：runtime 前须实现按 emailThread.id 去重 |
| TPQR-005：derivedStaleDays 计算来源不确定 | `TenantResourceOperatingImpactItem` 无 staleDays 字段；readout pipeline 有 connector.lastSyncedAt / importSource.updatedAt / importJob.finishedAt 但未暴露至 item type | **条件行**：runtime 前须定义计算来源并在 pipeline 内实现 |

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| PF3-001 TPQR-001 48h threshold | `ready_for_thin_read_model_planning`；schema 证据完整；query 结构干净 | runtime 实现前需用真实数据校准 48h threshold |
| PF3-002 TPQR-002 updatedAt 自动重置风险 | `conditional_requires_runtime_guard`；guard 已记录 | 须核查是否存在每日自动同步 job 重置 Opportunity.updatedAt；如确认存在，需新增 lastHumanActivityAt 字段或 sync-exempt flag |
| PF3-003 TPQR-003 overdueFlag 使用方式 | `conditional_requires_runtime_guard`；已引用实际 TypeScript 派生、写入、读取证据 | 须明确 runtime 不能只依赖持久化 `overdueFlag` 列；优先使用 dueDate/status heuristic 或既有读时派生逻辑；7d ownerUserId 阈值需真实数据校准 |
| PF3-004 TPQR-004 deduplication 逻辑 | `conditional_requires_runtime_guard`；guard 已记录 | 须设计 emailThread.id 去重逻辑，决定 TPQR-004 是否取得 opportunityId IS NOT NULL 线程的独占所有权 |
| PF3-005 TPQR-005 derivedStaleDays 来源 | `conditional_requires_runtime_guard`；guard 已记录 | 须在 readout pipeline 内实现 derivedStaleDays 计算，并校准 take: 2 noise guard |
| 所有 5 个 thin projection | Phase 3 entry gate preflight 完成 | Phase 3 是 preflight，不是 runtime 实现；PF3-002/003/004/005 的 guard 须全部解消后才能进入 read model integration |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| Prisma schema 新增 | Phase 3 entry gate 是 preflight，不持久化，不新增表或字段 |
| API route | 不暴露 runtime 接口 |
| Runtime extractor | 不扫描实时数据 |
| Event ingestion / queue | 不创建事件流 |
| Official write / auto-write | 永久禁止 |
| Page behavior change | 未接任何页面 |
| LLM final ranking | 不涉及 |
| 仅依赖持久化 overdueFlag 列 | 该字段虽有 TypeScript 派生、写入和读取路径，但 dueDate 随时间跨过后，持久化列是否被定时刷新仍未确认；本报告明确禁止把 DB 列作为唯一 runtime 过滤条件 |
| PF3-002/003/004/005 runtime guard 解消 | 这四个 guard 的解消工作不属于 Phase 3 entry gate 范围；须在进入 Phase 3 read model integration 前单独评审 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| TPQR-002：系统 job 误重置 Opportunity.updatedAt | 中 | 仓库中未找到阻止自动同步的代码证据；14d staleness 检测可能因自动同步失效。Guard：runtime 实现前必须确认 sync job 行为 |
| TPQR-003：仅用持久化 overdueFlag 列可能漏报 | 中 | `overdueFlag` 有应用层派生、写入、读取路径，但如果 dueDate 过期只由时间推进触发，持久化列是否自动刷新仍未确认。Guard：runtime 规划使用 dueDate/status heuristic 或既有读时派生逻辑，不把 DB 列作为唯一过滤条件 |
| TPQR-004：WAITING_US 线程双重展示 | 中 | loadWaitingEmailThreads 无 opportunityId 过滤；若 TPQR-004 与此路径同时 active，同一线程出现两次。Guard：按 emailThread.id 去重 |
| TPQR-005：derivedStaleDays 来源不确定 | 中 | 候选来源有三个（connector.lastSyncedAt, importSource.updatedAt, importJob.finishedAt），均未在 impact item type 暴露。Guard：定义公式并在 pipeline 内实现 |
| PF3-001 threshold 校准 | 低 | 48h threshold 是预期调参；不是结构性阻塞。可进入 planning，但实现前须用真实数据验证 |

---

## 五、验证结果

### 5.1 Preflight tests

```
npx vitest run features/business-advancement/runtime-readiness-preflight.test.ts

 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### 5.2 Preflight CLI

```
npx tsx scripts/business-advancement-runtime-readiness-preflight.ts

Helm Business Advancement — Phase 3 Entry Gate: Runtime Readiness Preflight
================================================================================
Preflight rows:  5

PF3-001  [TPQR-001]  meeting/AS-FX-002  [blocked_decision]
  Status:        ready_for_thin_read_model_planning
  Posture:       review_only_not_implemented

PF3-002  [TPQR-002]  crm/AS-FX-004  [stalled_opportunity]
  Status:        conditional_requires_runtime_guard
  Posture:       review_only_not_implemented
  Guard:         Before runtime adoption: verify that no scheduled CRM sync job auto-updates Opportunity.updatedAt...

PF3-003  [TPQR-003]  crm/AS-FX-005  [overdue_commitment]
  Status:        conditional_requires_runtime_guard
  Posture:       review_only_not_implemented
  Guard:         Before runtime adoption: do not use the persisted Commitment.overdueFlag column as the sole...

PF3-004  [TPQR-004]  crm/AS-FX-006  [customer_waiting]
  Status:        conditional_requires_runtime_guard
  Posture:       review_only_not_implemented
  Guard:         Before runtime adoption: implement deduplication by emailThread.id between TPQR-004 output...

PF3-005  [TPQR-005]  tenant_resource/AS-FX-007  [stalled_case]
  Status:        conditional_requires_runtime_guard
  Posture:       review_only_not_implemented
  Guard:         Before runtime adoption: define the derivedStaleDays computation formula...

Eval Checks:
  PASS exactly_five_preflight_rows
  PASS all_tpqr_ids_covered
  PASS all_postures_review_only_not_implemented
  PASS no_ready_for_runtime_adoption_wording
  PASS tpqr003_overdue_flag_evidence_correct
  PASS all_conditional_rows_have_guard_text
  PASS no_forbidden_authorization_patterns
  PASS tpqr001_is_ready_for_thin_read_model_planning
  PASS workspace_membership_boundary_confirmed_all

9/9 checks passed
Phase 3 entry gate runtime readiness preflight PASSED
```

### 5.3 ESLint

```
npx eslint features/business-advancement/runtime-readiness-preflight.ts \
  features/business-advancement/runtime-readiness-preflight.test.ts \
  scripts/business-advancement-runtime-readiness-preflight.ts

(0 errors, 0 warnings)
```

### 5.4 Git whitespace check

```
git diff --check -- \
  features/business-advancement/runtime-readiness-preflight.ts \
  features/business-advancement/runtime-readiness-preflight.test.ts \
  scripts/business-advancement-runtime-readiness-preflight.ts \
  docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_ENTRY_GATE_RUNTIME_READINESS_PREFLIGHT_V1.md \
  docs/README.md

(0 whitespace errors)
```

---

## 六、下一阶段建议

Phase 3 entry gate 已完成 5 个 thin projection 的 runtime 就绪度预检。PF3-001（TPQR-001/blocked_decision）状态为 `ready_for_thin_read_model_planning`；其余四个为 `conditional_requires_runtime_guard`。在进入 Phase 3 read model integration 前，建议：

1. **PF3-002 guard 解消**：审查 CRM 数据同步 job，确认 Opportunity.updatedAt 是否被自动重置；若是，评估新增 lastHumanActivityAt 字段的必要性。
2. **PF3-003 guard 解消**：确认 runtime 规划采用 dueDate/status heuristic 或既有 `deriveOverdueFlag` 读时派生逻辑，不把持久化 `Commitment.overdueFlag` 列作为唯一过滤条件；校准 7d ownerUserId 阈值。
3. **PF3-004 guard 解消**：设计 emailThread.id 去重逻辑，确定 TPQR-004 与 loadWaitingEmailThreads 之间的所有权边界。
4. **PF3-005 guard 解消**：在 readout pipeline 内定义并实现 derivedStaleDays 计算公式，校准 take: 2 noise guard。
5. **完成上述四项 guard 解消后**，可以评估进入 Phase 3 read model integration（runtime 实现规划）。

**未完成上述 guard 解消前，不进入 runtime extractor、official write、auto execution 或页面行为变更。**
