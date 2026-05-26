---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Business Advancement Phase 2B — Read-Model Projection Proof Report V1

更新时间：2026-04-26
状态：Phase 2B planning-only proof complete / runtime adoption not started
本阶段：Read-Model Projection Proof（3 个 active candidate sources 的只读投影可行性证明）
上游报告：[HELM_BUSINESS_ADVANCEMENT_PHASE2_SIGNAL_TO_MUST_PUSH_REPORT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE2_SIGNAL_TO_MUST_PUSH_REPORT_V1.md)

---

## 声明

**Phase 2B 仍是 planning-only，未进入 runtime adoption。**

本报告证明 meeting、tenant_resource、crm 三个 active candidate source type 已有现成或可 thin-project 的 read model 路径，无需新增 schema、runtime extractor、event queue 或 write authority，即可支持 Phase 2 Must Push adapter 的后续 projection review。

本阶段 **不** 包含：
- 任何 Prisma schema 新增
- 任何 API route 新增
- 任何 runtime extractor 或 event ingestion
- 任何 official write / auto-write
- 任何 execution authority
- 任何 LLM final ranking
- 任何 dashboard / mobile / operating 页面行为变更
- 任何生产 adapter 接入

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Projection proof matrix | `features/business-advancement/read-model-projection-proof.ts` | 3 行只读 proof rows，覆盖 meeting / crm / tenant_resource；每行含 existingReadModelPath、projectedSignalTypes、membershipCapabilityBoundaryNote、whyNoSchemaOrExtractor、readinessStatus |
| Proof evaluator | `features/business-advancement/read-model-projection-proof.ts :: evaluateReadModelProjectionProof` | 5 项纯函数检查：source types 覆盖、read-only 边界、active fixture 验证、无 future_only/blocked、非空字段 |
| Proof tests | `features/business-advancement/read-model-projection-proof.test.ts` | 11 个测试，全部通过；覆盖 source coverage、forbidden authorization、fixture active status、deferred isolation、evaluator checks |
| Proof CLI script | `scripts/business-advancement-read-model-projection-proof.ts` | 打印 proof 摘要，exit 0 on pass / 1 on fail；无 DB、无网络、无 write authority |

**当前 proof 结果：**

| Source type | Covered fixtures | Readiness status |
| --- | --- | --- |
| meeting | AS-FX-001, AS-FX-002, AS-FX-003 | `needs_thin_projection_review` |
| crm | AS-FX-004, AS-FX-005, AS-FX-006 | `needs_thin_projection_review` |
| tenant_resource | AS-FX-007, AS-FX-008, AS-FX-009 | `needs_thin_projection_review` |

**每个 source 的现有 read model 路径：**

| Source type | 现有路径（Phase 1B 引用） |
| --- | --- |
| meeting | `features/mobile/lib/mobile-command-read-model.ts :: loadPostMeetingItems`（AS-FX-001/003 current）、`loadPendingApprovals`（AS-FX-002 thin） |
| crm | `features/mobile/lib/mobile-command-read-model.ts :: loadHighRiskOpportunities / loadOverdueOpportunities`；`data/queries.ts :: getOpportunityCommercialDetailData`（all three thin） |
| tenant_resource | `features/mobile/lib/mobile-command-read-model.ts :: loadTenantResourceIssues`；`lib/tenant-resources/workspace-operating-impact-query.ts :: getWorkspaceTenantResourceOperatingImpactReadout`（AS-FX-008/009 current，AS-FX-007 thin） |

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| meeting / AS-FX-002 thin projection | Phase 2B 证明不需要新 schema；只需在 `loadPendingApprovals` 路径上加入 actionItem 无 approvalTask + 48h 超时过滤 | 下一阶段正式实现 thin filter 前需做 query-level review，确认 workspace scope 和 membership gate 完全覆盖 |
| crm / AS-FX-004 staleness filter | `updatedAt < now-14d` 过滤已证明可行；current query 仅覆盖 HIGH/CRITICAL | 下一阶段实现 thin staleness filter 时需确认不会突破 workspace 边界，不会误包含 DONE/LOST opportunity |
| crm / AS-FX-005 commitment thin query | `db.commitment` 表已存在；thin read query 可行 | 下一阶段需明确 commitment 表的 workspace scope 约束，补充 no-owner-update 判断的精确条件 |
| crm / AS-FX-006 customer_waiting join | `opportunity.updatedAt + emailThread FK` join 可行 | 下一阶段需验证 emailThread 到 opportunity 的 FK 路径完整，不会跨 workspace |
| tenant_resource / AS-FX-007 thin staleness | `staleDays > 14` filter 可行；当前 loadTenantResourceIssues 仅覆盖 high/critical severity | 下一阶段实现 thin severity-independent filter 时需验证不会因低优先级噪声淹没 high-severity 项 |
| Projection review 闭环 | Phase 2B 仅证明 projection 路径可行 | 下一阶段需对每个 thin projection 写 query-level review（不是 page 接入），评审 workspace scope、membership gate 和 boundary note 覆盖 |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| Prisma schema | Phase 2B 仍是 planning proof，不持久化，不新增表或字段 |
| API route | 不暴露 runtime 接口 |
| Runtime extractor | 不扫描会议记录、CRM 活动流、旧系统事件或用户行为 |
| Event ingestion / queue | 不创建事件流 |
| Official write / auto-write | 永久禁止，Phase 2B 无任何写路径 |
| Page behavior change | 未接 dashboard / mobile / operating 页面 |
| LLM final ranking | 排序完全由 deterministic sortKey 决定，Phase 2B 不涉及排序 |
| email / ask_helm / user_behavior / combined / report sources | Phase 2B 只做 3 个 active candidate source 的 projection proof；其余 source 保留 Phase 1B 结论（email/combined 仍为 active 但不在本轮 proof 范围；report/ask_helm/user_behavior future_only 继续 deferred） |
| Production adapter adoption | Phase 2B proof 不是 runtime integration，不触发生产 query 变更 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| 3 个 source 均为 `needs_thin_projection_review` | 低 | 这是预期结论；thin projection review 是下一阶段的精确 query-level 验证，不是阻塞 Phase 2B 的缺陷 |
| `db.commitment` 表 workspace scope 未经 Phase 2B 明确验证 | 中 | Phase 1B 已记录 commitment 表存在；AS-FX-005 projection 路径依赖该表的 workspace scope 约束；下一阶段 thin projection review 必须核实 |
| crm AS-FX-006 的 emailThread FK 完整性未经 Phase 2B 验证 | 中 | Phase 1B feasibility matrix 引用了 opportunity.emailThreads 关联；下一阶段 query review 需要确认 FK 路径和 workspace scope |
| tenant_resource AS-FX-007 staleness filter 可能增加低优先级噪声 | 低 | 下一阶段实现时需要测试 severity-independent filter 是否会稀释 high-severity 项的可见性；当前 planning proof 不受影响 |
| Phase 2B 证明范围不包含 email / combined / user_behavior sources | 低 | 这是刻意决策；email / combined source 的 active fixtures（AS-FX-012/013/018/019/020）在 Phase 1B 中已有 feasibility 结论，Phase 2B 不需要重复证明 |

---

## 五、验证结果

### 5.1 Proof tests

```
npx vitest run features/business-advancement/read-model-projection-proof.test.ts

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

### 5.2 Proof CLI

```
npx tsx scripts/business-advancement-read-model-projection-proof.ts

Helm Business Advancement — Phase 2B Read-Model Projection Proof
================================================================
Proof rows:      3
Source types:    meeting, crm, tenant_resource

Source:          meeting
  Fixtures:      AS-FX-001, AS-FX-002, AS-FX-003
  Signals:       customer_waiting, blocked_decision, overdue_commitment
  Read-model:    features/mobile/lib/mobile-command-read-model.ts :: loadPostMeetingItems (AS-FX-001, AS-FX-003 current), loadPendingApprovals (AS-FX-002 thin review)
  Readiness:     needs_thin_projection_review

Source:          crm
  Fixtures:      AS-FX-004, AS-FX-005, AS-FX-006
  Signals:       stalled_opportunity, overdue_commitment, customer_waiting
  Read-model:    features/mobile/lib/mobile-command-read-model.ts :: loadHighRiskOpportunities (AS-FX-004 thin), loadOverdueOpportunities (AS-FX-005 thin); data/queries.ts :: getOpportunityCommercialDetailData (AS-FX-005 thin, AS-FX-006 thin)
  Readiness:     needs_thin_projection_review

Source:          tenant_resource
  Fixtures:      AS-FX-007, AS-FX-008, AS-FX-009
  Signals:       stalled_case, overdue_commitment, resource_evidence_gap
  Read-model:    features/mobile/lib/mobile-command-read-model.ts :: loadTenantResourceIssues; lib/tenant-resources/workspace-operating-impact-query.ts :: getWorkspaceTenantResourceOperatingImpactReadout
  Readiness:     needs_thin_projection_review

Eval Checks:
  PASS required_source_types_covered
  PASS all_proof_rows_read_only
  PASS covered_fixture_ids_are_active_candidates
  PASS no_future_only_or_blocked_covered_as_active
  PASS all_rows_have_non_empty_fields

5/5 checks passed
Phase 2B read-model projection proof PASSED
```

### 5.3 ESLint

```
npx eslint features/business-advancement/read-model-projection-proof.ts \
  features/business-advancement/read-model-projection-proof.test.ts \
  scripts/business-advancement-read-model-projection-proof.ts

(0 errors, 0 warnings)
```

### 5.4 Git whitespace check

```
git diff --check -- \
  features/business-advancement/read-model-projection-proof.ts \
  features/business-advancement/read-model-projection-proof.test.ts \
  scripts/business-advancement-read-model-projection-proof.ts \
  docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE2B_READ_MODEL_PROJECTION_PROOF_REPORT_V1.md \
  docs/README.md

(0 whitespace errors)
```

---

## 六、下一阶段建议

Phase 2B 已证明 meeting、crm、tenant_resource 三个 source 的 projection 路径可行。下一阶段建议：

1. **Phase 2C Query Review**：对 AS-FX-002、AS-FX-004、AS-FX-005、AS-FX-006、AS-FX-007 五个 thin projection 逐一做 query-level review：
   - 精确 Prisma where clause 草稿
   - Workspace scope 验证
   - Membership / capability gate 验证
   - Boundary note 完整性验证

2. 通过 query review 后，再评估是否进入 Phase 3 read model integration（只读展示接入 dashboard / mobile / operating）。

**未完成上述条件前，不进入 runtime extractor、official write、auto execution 或页面行为变更。**
