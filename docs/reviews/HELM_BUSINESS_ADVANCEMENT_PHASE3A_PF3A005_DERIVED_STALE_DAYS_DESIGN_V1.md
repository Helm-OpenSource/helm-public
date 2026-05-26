---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3A — PF3A-005 Derived Stale Days Derivation Design V1

更新时间：2026-04-26
状态：Phase 3A / PF3A-005 readout-derivation design artifact / planning-only / runtime adoption not authorized / human-meaningful staleness guard NOT cleared
本阶段：解消 PF3A-005 留下的 `tenant_resource` `stalled_case` `derivedStaleDays` 来源/公式 **文档化** 问题，输出 deterministic 的 source 候选目录、单一公式、take:2 校准与 evaluator；同时 **诚实保留** PF3A-005 的"human-meaningful staleness"上游守护未清空（gate not cleared）这一事实，所有未来运行时/类型表/thin read-model 规划必须 stop-and-re-surface 或显式将语义降级为 evidence-freshness-only 后再考虑接入
上游：[HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md)
最终需求：[HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)

---

## 声明

**本报告是 PF3A-005 的 planning-only readout-derivation design artifact，不是 runtime integration、type-surface change，也不是 thin read-model planning 的批准；它仅把"derivedStaleDays 的来源/公式"作为 evidence-freshness 规划候选完成文档化，并不清空 PF3A-005 的"human-meaningful staleness"上游守护。**

它把 Phase 3 entry-gate preflight 中标记为 `conditional_requires_runtime_guard` 的 PF3-005（TPQR-005 / `tenant_resource` / `stalled_case` 的 `derivedStaleDays` 来源未定）转化为一份 deterministic 的 evidence matrix：列出当前仓库中 `getWorkspaceTenantResourceOperatingImpactReadout` 选取的 connector / import_source / import_job 三类原始时间戳、`buildTenantResourceReadiness` 内部已有的 connector 与 import-source 归一化、`buildTenantResourceEvidenceDetail` 已经计算的 `timing.observedAt` 表达式、`TenantResourceOperatingImpactItem` 当前的真实字段集（不包含 `derivedStaleDays`）、`loadTenantResourceIssues` 当前过滤器（无 `derivedStaleDays` 分支）、TPQR-005 提议、PF3-005 / PF3A-005 文档要求；据此选定单一 source、单一公式与 `take: 2` 的校准 fixture。

**但被选定的 `readiness_timing_observed_at_normalized` 仍然是 evidence-freshness 时间，不是"人没动"的人因不活跃信号；上游 PF3A-005 守护要求"被选定的 source 必须反映 human-meaningful staleness，否则 stop 并升级"——本 artifact 没有也不能清空该守护。**

本报告 **明确不构成** 对以下任一项的批准：

- Prisma schema 变更
- runtime extractor / event queue / background job 的引入
- `app/`、`app/api/`、`data/queries.ts` 任何 route / page 行为变更
- `lib/tenant-resources/*` 任何运行时修改
- `features/mobile/lib/mobile-command-read-model.ts` 任何修改（包括 `loadTenantResourceIssues` 函数体、过滤逻辑或聚合行为）
- `TenantResourceOperatingImpactItem` 或任何 tenant-resource readout runtime type 的字段扩展（包括 `derivedStaleDays` / `staleDays` / `lastSyncedAt` 任何新增）
- mobile / search / dashboard 任意 UI 表面的变更
- LLM final ranking
- official write、auto-send、auto-approval、auto-execute 的任何运行时授权
- production query adoption

`runtimeImplementationAllowed` 与 `schemaChangeAllowed` 在本 artifact 的语义上仍然是 `false`：本 artifact 只是规划证据。

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Design artifact | `features/business-advancement/tenant-resource-stale-days-derivation-design.ts` | 12 行 evidence 证据矩阵 + 4 项 source 候选目录 + 单一 formula 定义 + 4 项 take:2 校准 fixture + 纯函数 `computeDerivedStaleDays` 与 `applyTpqr005CalibrationRule` + `PF3A005_ADOPTION_POSTURE`（gate-not-cleared 结构性记号） |
| Source 选定 | `tenant-resource-stale-days-derivation-design.ts :: SELECTED_DERIVED_STALE_DAYS_SOURCE` | 选定 `readiness_timing_observed_at_normalized`，即 `TenantResourceEvidenceDetail.timing.observedAt`（`resource.connection.lastSyncAt ?? resource.updatedAt`，已在 `lib/tenant-resources/evidence-detail.ts:175` 计算）— **仅作为 evidence-freshness 规划候选**，不构成对 human-meaningful staleness 守护的清空 |
| Formula 定义 | `tenant-resource-stale-days-derivation-design.ts :: DERIVED_STALE_DAYS_FORMULA` | `derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000)`；null/invalid/future observedAt 一律返回 `null`（unknown / not filterable，绝不视为 stale）；threshold `strictly_greater_than 14`；noise guard `take: 2`；ordering `derivedStaleDays_desc_then_resource_key_asc`；staleness 标签为 `evidence_freshness_staleness_not_human_inactivity` |
| Adoption / gate posture | `tenant-resource-stale-days-derivation-design.ts :: PF3A005_ADOPTION_POSTURE` | `selectedSource = readiness_timing_observed_at_normalized`；`formulaStatus = selected_for_planning`；`humanMeaningfulStalenessGate = not_cleared`；`semanticScope = evidence_freshness_only_not_human_inactivity`；`nextRequiredDecision = stop_or_explicit_scope_downgrade_before_runtime_adoption`；明确不构成 runtime / schema / API / page / readout type / official write / auto-send / auto-approval / LLM ranking / production query adoption 的批准 |
| Pure derivation helper | `tenant-resource-stale-days-derivation-design.ts :: computeDerivedStaleDays` | 在最小 planning fixture 类型 `PlanningTenantResourceTimingFixture` 上执行；输入空/非法/未来 observedAt 返回 `null`，否则返回非负整数日数 |
| Calibration evaluator | `tenant-resource-stale-days-derivation-design.ts :: applyTpqr005CalibrationRule` | 实现 TPQR-005 的 in-memory 规则：filter `derivedStaleDays > 14`，orderBy `derivedStaleDays DESC` then `resourceKey ASC`，take 2；纯函数，无 DB / 网络 |
| Design evaluator | `tenant-resource-stale-days-derivation-design.ts :: evaluateDerivedStaleDaysDerivationDesign` | 23 项纯函数检查；其中 7 项专门守护 adoption posture 与 gate-not-cleared 语言；全部通过 |
| Design tests | `features/business-advancement/tenant-resource-stale-days-derivation-design.test.ts` | 覆盖矩阵存在性 / 字段非空 / `evidenceId` 唯一 / 必备 repo-truth locator / recommendation/explanation/draft/proof 边界 / 禁止授权措辞 / catalog 三个 guard 候选 / 选定来源与公式一致 / null/invalid/future observedAt 处理 / 13/14/15 天阈值示例 / take:2 校准案例 / evaluator checks / `PF3A005_ADOPTION_POSTURE` 五个字段值 / posture notes 必备措辞 / 禁止"gate cleared / runtime ready / thin read-model planning go"系措辞 |
| Design CLI | `scripts/business-advancement-tenant-resource-stale-days-derivation-design.ts` | 打印 candidate catalog、selected source/formula、`PF3A005_ADOPTION_POSTURE`、calibration 结果、evidence matrix 与 eval checks；exit 0 on pass / 1 on fail；PASS 输出附 gate-not-cleared 提示；无 DB、无网络、无 schema 改动、无 readout type 修改 |
| 索引同步 | `docs/README.md` | 新增本报告条目（含 gate-not-cleared posture 说明） |

**当前 design 概览：**

| 指标 | 数值 |
| --- | --- |
| Total evidence rows | 12 |
| Source candidates in catalog | 4（3 个 PF3A-005 guard 候选 + 1 个选定的归一化 source） |
| Selected source | `readiness_timing_observed_at_normalized` |
| Selected formula | `derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000)` |
| Threshold | `strictly_greater_than 14` |
| Noise guard | `take: 2`，`derivedStaleDays_desc_then_resource_key_asc` |
| Staleness label | `evidence_freshness_staleness_not_human_inactivity` |
| Calibration cases | 4（含饱和、边界、未知/非法/未来、全 fresh 四种） |
| Adoption posture | `formulaStatus = selected_for_planning`；`humanMeaningfulStalenessGate = not_cleared`；`semanticScope = evidence_freshness_only_not_human_inactivity`；`nextRequiredDecision = stop_or_explicit_scope_downgrade_before_runtime_adoption` |
| Eval checks | 23 / 23 全部通过；Vitest 54 个测试全部通过 |

### 1.1 Evidence matrix（按 `evidenceKind` 分组）

| evidenceKind | 行数 | 关键 evidenceId / 位置 |
| --- | --- | --- |
| `selected_query_source` | 3 | `PF3A005-EV-001` / `lib/tenant-resources/workspace-operating-impact-query.ts:38`（`connector.lastSyncedAt`），`PF3A005-EV-002` / `:56`（`importSource.updatedAt`），`PF3A005-EV-003` / `:71`（`importJob.finishedAt`） |
| `readiness_normalization` | 2 | `PF3A005-EV-004` / `lib/tenant-resources/readiness.ts:270`（`buildConnectorResource` 的 `connector.lastSyncedAt ?? connector.updatedAt` 与 `connection.lastSyncAt`、`updatedAt` 派生），`PF3A005-EV-005` / `lib/tenant-resources/readiness.ts:356`（`buildImportSourceResource` 的 `source.lastSyncedAt ?? latestJob.finishedAt ?? source.updatedAt`） |
| `readout_observed_at_definition` | 1 | `PF3A005-EV-006` / `lib/tenant-resources/evidence-detail.ts:175`（`timing.observedAt = resource.connection.lastSyncAt ?? resource.updatedAt`） |
| `impact_item_type_truth` | 1 | `PF3A005-EV-007` / `lib/tenant-resources/operating-impact.ts:24`（`TenantResourceOperatingImpactItem` 当前不含 `derivedStaleDays` / `staleDays` / `lastSyncedAt`） |
| `existing_filter_call_site` | 1 | `PF3A005-EV-008` / `features/mobile/lib/mobile-command-read-model.ts:350`（`loadTenantResourceIssues` 当前过滤无 `derivedStaleDays` 分支） |
| `tpqr005_proposal` | 1 | `PF3A005-EV-009` / `features/business-advancement/thin-projection-query-review.ts:315`（TPQR-005 提议） |
| `phase3_preflight_doc` | 1 | `PF3A005-EV-010` / `features/business-advancement/runtime-readiness-preflight.ts:187`（PF3-005 conditional guard） |
| `phase3a_guard_doc` | 1 | `PF3A005-EV-011` / `features/business-advancement/runtime-guard-resolution-plan.ts:218`（PF3A-005 `requires_readout_derivation_design`） |
| `design_decision_note` | 1 | `PF3A005-EV-012`（选定 `readiness_timing_observed_at_normalized` 与 `derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000)`，明确 take:2 校准范围、不批准 runtime adoption、不修改 `TenantResourceOperatingImpactItem`） |

### 1.2 关键证据：为什么选 readout-level normalized source

PF3A-005 的三条结构性 finding：

1. **三个 PF3A-005 guard 候选都有"自动同步污染"问题**：
   - `connector.lastSyncedAt`（`workspace-operating-impact-query.ts:38`）随连接器自动同步循环 bump，不反映人是否做事。
   - `importSource.updatedAt`（`workspace-operating-impact-query.ts:56`）随 import 状态机的系统写（如 SYNCING / ERROR）bump。
   - `importJob.finishedAt`（`workspace-operating-impact-query.ts:71`）只覆盖 import-source 形状，且本身是 pipeline 时间。
   - 任意一个直接当成 staleness 都会让 readout 形状（connector / import_source / capture_session / extension）之间退化为多套 ad-hoc 规则。

2. **readout pipeline 已经做了归一化**：
   - `buildConnectorResource`（`readiness.ts:270`）已经把 `connector.lastSyncedAt ?? connector.updatedAt` 当作 freshness。
   - `buildImportSourceResource`（`readiness.ts:356`）已经把 `source.lastSyncedAt ?? latestJob.finishedAt ?? source.updatedAt` 当作 freshness。
   - `buildTenantResourceEvidenceDetail`（`evidence-detail.ts:175`）已经把 `resource.connection.lastSyncAt ?? resource.updatedAt` 当作 `timing.observedAt`，对所有 readout 形状统一。

3. **`TenantResourceOperatingImpactItem` 当前并未暴露 `derivedStaleDays`**：
   - `operating-impact.ts:24` 上的字段不含 `derivedStaleDays` / `staleDays` / `lastSyncedAt`。
   - 任何把 `derivedStaleDays` 暴露到运行时类型的步骤，是单独的 type-surface review，不在 PF3A-005 范围内。

因此：选定 `TenantResourceEvidenceDetail.timing.observedAt` 作为 derivedStaleDays 的源；公式为：

```
derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000)
```

且对 `null` / 非法字符串 / 未来 observedAt 一律返回 `null`（unknown / not filterable，绝不当作 stale）。

### 1.3 为什么仍然必须保留诚实的"自动同步"限制

选定 source 仍然 **不是** 真正的"人没动"信号：在 connector / import_source 形状下，`resource.connection.lastSyncAt` 最终来自 `connector.lastSyncedAt` 或 `source.lastSyncedAt ?? latestJob.finishedAt`，仍可被自动同步刷新。PF3A-005 的诚实做法是：

- 将选定 source 上派生出的值显式标注为 `evidence_freshness_staleness_not_human_inactivity`。
- 任何后续把 `derivedStaleDays` 暴露到 `TenantResourceOperatingImpactItem` 或参与运行时过滤的步骤，必须通过 **单独** 的 type-surface review 与 runtime-adoption review。
- 本 artifact 不构成对该步骤的批准。

### 1.4 take:2 校准 fixture（planning-only）

| caseId | 描述 | 期望 top resource keys |
| --- | --- | --- |
| `PF3A005-CAL-001` | 4 个 stale 资源（两个 40d 平局、20d、15d）；take:2 应只保留两个 40d，并按 resourceKey ASC tie-break | `[connector:conn_a, connector:conn_b]` |
| `PF3A005-CAL-002` | 边界（13d / 14d / 15d）：strictly > 14 排除 13d 与 14d | `[connector:boundary_15]` |
| `PF3A005-CAL-003` | null / 非法字符串 / 未来 observedAt 视为 unknown，全部排除；只剩 30d 真实 stale | `[connector:thirty_days_stale]` |
| `PF3A005-CAL-004` | 全部 ≤ 14d；take:2 不能制造噪音 | `[]` |

`applyTpqr005CalibrationRule` 实现了 TPQR-005 的 in-memory 规则：

1. 用 `computeDerivedStaleDays` 计算每个 fixture。
2. 过滤 `derivedStaleDays != null && derivedStaleDays > 14`。
3. 排序：`derivedStaleDays DESC`，再 `resourceKey ASC`。
4. `take: 2`。

测试覆盖：直接 `computeDerivedStaleDays` 的 0 / 13 / 14 / 15 天数值检查、null / invalid / future observedAt 返回 null、Date 对象与 ISO 字符串等价、四个 calibration case 的预期输出。

### 1.5 Evaluator 强制条件（已通过）

`evaluateDerivedStaleDaysDerivationDesign` 强制执行：

1. `at_least_one_evidence_row` — 至少一行
2. `every_row_has_non_empty_evidence_and_boundary` — 每行 filePath / evidenceLocator / evidenceSummary / boundaryNotes 非空
3. `evidence_ids_are_unique` — `evidenceId` 唯一
4. `repo_truth_locators_cited` — 必须引用 `lib/tenant-resources/workspace-operating-impact-query.ts:38/56/71`、`lib/tenant-resources/readiness.ts:270/356`、`lib/tenant-resources/evidence-detail.ts:175`、`lib/tenant-resources/operating-impact.ts:24`、`features/mobile/lib/mobile-command-read-model.ts:350`、`features/business-advancement/thin-projection-query-review.ts:315`、`features/business-advancement/runtime-readiness-preflight.ts:187`、`features/business-advancement/runtime-guard-resolution-plan.ts:218`
5. `boundary_notes_preserve_recommendation_explanation_draft_proof` — recommendation/explanation/draft/proof 四组区分齐全
6. `no_row_grants_runtime_schema_or_execution_authority` — 禁止任何授权 schema 设计、runtime extractor、event queue、official write、auto-send、auto-approval、LLM ranking、page 行为变更、API route 添加、production query adoption、`TenantResourceOperatingImpactItem` 字段扩展的措辞（覆盖 evidence rows 与 catalog 文本）
7. `evidence_kinds_and_source_candidates_valid` — `evidenceKind` 与 `relatedSourceCandidate` 取值在白名单内
8. `catalog_covers_three_guard_candidates` — catalog 必须包含 `connector_last_synced_at` / `import_source_updated_at` / `import_job_finished_at`
9. `exactly_one_selected_candidate_matches_formula` — 必须恰有一行 `verdict === "selected"`，且与 `SELECTED_DERIVED_STALE_DAYS_SOURCE` 与 `DERIVED_STALE_DAYS_FORMULA.selectedSource` 一致
10. `selected_source_is_readiness_observed_at_normalized` — 选定 source 必须为 `readiness_timing_observed_at_normalized`
11. `formula_shape_is_explicit_and_planning_only` — 公式表达式必须显式包含 `floor` / `max(0,` / `referenceClockMs - observedAtMs` / `86_400_000`，且 threshold > 14、take 2、staleness label 是 `evidence_freshness_staleness_not_human_inactivity`
12. `compute_handles_null_invalid_future_observed_at` — null / 非法 / future observedAt 返回 null；clock 等值返回 0；15 天前返回 15
13. `fourteen_day_threshold_examples_resolved` — 13 / 14 / 15 天前的 observedAt 分别返回 13 / 14 / 15
14. `take_two_calibration_cases_match_expected` — 4 个 calibration case 的输出必须与文档中的 expected key 完全一致，且不超过 take 2
15. `design_note_refuses_runtime_and_type_surface_adoption` — `design_decision_note` 行必须显式声明 `not authorize`，必须命名 selected source 与公式表达式，必须引用 TPQR-005，必须显式 disclaim `TenantResourceOperatingImpactItem` 修改
16. `all_three_guard_candidates_covered_by_evidence` — 三个 guard 候选必须都有 evidence 行覆盖
17. `posture_formula_status_is_selected_for_planning` — 公式状态只能是 `selected_for_planning`
18. `posture_human_meaningful_staleness_gate_not_cleared` — `humanMeaningfulStalenessGate` 必须保持 `not_cleared`
19. `posture_semantic_scope_is_evidence_freshness_only` — 语义范围必须是 `evidence_freshness_only_not_human_inactivity`
20. `posture_next_required_decision_blocks_runtime_adoption` — 下一步必须是 `stop_or_explicit_scope_downgrade_before_runtime_adoption`
21. `posture_selected_source_matches_formula` — adoption posture 的 selected source 必须与公式 source 一致
22. `posture_notes_preserve_gate_not_cleared_language` — posture notes 必须显式包含 gate-not-cleared、human-meaningful staleness、stop-or-downgrade、evidence-freshness-only 与 no-authorization 语言
23. `no_row_implies_full_runtime_or_thin_read_model_readiness` — evidence、catalog 与 posture notes 不得暗示 PF3A-005 单独足以进入 runtime 或 thin read-model readiness

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| Source 选定 | `readiness_timing_observed_at_normalized` 已作为 evidence-freshness planning candidate 被选定，但 **没有** 清空 human-meaningful staleness guard | 任何进入 thin read-model planning、type-surface review 或 runtime-adoption review 前，必须先 stop-and-re-surface PF3A-005，或显式把 scope 降级为 evidence-freshness-only |
| Formula | `derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000)` 已记录；null/invalid/future 均返回 `null` | 仍需在 runtime-adoption review 中：(a) 选定 reference clock 来源（建议复用 `readiness.generatedAt` 或调用方 `now`，不要新引入时钟）；(b) 校准 14 天阈值与 `take: 2` 是否仍合适；(c) 决定值 `null` 在 readout 中如何呈现给 UI |
| `TenantResourceOperatingImpactItem` | `operating-impact.ts:24` 当前不含 `derivedStaleDays`；本 artifact 不修改它 | 任何字段扩展（`derivedStaleDays?` 或派生字段）必须独立评审，并显式回应 `evidence_freshness_staleness_not_human_inactivity` 标签的 UI 表达 |
| `loadTenantResourceIssues` | 当前过滤（severity / proofRequired / blocked）已被记录，不含 `derivedStaleDays` 分支 | 任何把 TPQR-005 输出与 `loadTenantResourceIssues` 整合的步骤，必须由单独的 thin read-model planning artifact 承担，并显式回应去重、排序、severity 字段交互 |
| 与 PF3A-002 / PF3A-003 / PF3A-004 的交叉条件 | PF3A-002 / PF3A-003 / PF3A-004 已各自完成独立 artifact；PF3A-005 仅完成 formula/source 文档化 | 即使四份 artifact 都齐备，thin read-model planning 仍不能无条件 Go；PF3A-005 依赖项必须先处理 `humanMeaningfulStalenessGate = not_cleared` |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| 任何 Prisma schema 变更 | Phase 3A planning-only；`PF3A005-EV-001/002/003/004/005/006/007` 仅记录现状，不提议加列、加触发器、加索引 |
| 任何 runtime 实现 / extractor / event queue / background job | 永久禁止；boundary notes 与 evaluator 共同守护 |
| `lib/tenant-resources/*` 任何代码改动 | 范围严格限定在新建 3 个允许文件 + Chinese report + `docs/README.md` 索引同步 |
| `features/mobile/lib/mobile-command-read-model.ts` 任何代码改动 | 不在 allowed write set；`loadTenantResourceIssues` 仅作为 evidence 行被引用 |
| `data/queries.ts` 任何代码改动 | 不在 allowed write set |
| `app/`、`app/api/` 任意 page / route 改动 | 不在 allowed write set |
| `prisma/schema.prisma` 任何修改 | 任务明确禁止 |
| `PLANS.md` 任何修改 | 任务明确禁止 |
| 重复脏文件（` 2.ts` / ` 2.tsx`）任何修改 | 与本任务无关；不动 |
| 把 `derivedStaleDays` 暴露到 `TenantResourceOperatingImpactItem` 或任何 readout runtime type | 显式禁止；任何此类步骤必须由单独 type-surface review 承担 |
| 修改 14 天阈值或 take:2 噪音守护 | TPQR-005 自身的阈值校准与 PF3A-005 公式选择正交；阈值校准留给后续独立评审 |
| 选择 `connector.lastSyncedAt` / `importSource.updatedAt` / `importJob.finishedAt` 作为 source | 三者都被 catalog 显式 reject，原因写明（automated sync only / too narrow / job timing only），不在本 artifact 内授权 |
| 自动写、自动发、自动审批、LLM final ranking | 永久禁止；不在 PF3A-005 内授权，不在任何 evidence 行措辞中授权，不在 catalog rationale 中授权 |
| 把 PF3A-002 / PF3A-003 / PF3A-004 拉进本 artifact | 它们由各自独立的 Phase 3A 解消子任务承担；PF3A-005 只解消 derivedStaleDays 来源/公式 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| 误读 PF3A-005 为 implementation-ready | 高 | 报告显式声明并由测试守护：每条 evidence 行 boundary notes 强制 recommendation/explanation/draft/proof 四组区分；`no_row_grants_runtime_schema_or_execution_authority` 检查覆盖任何 auto-write / auto-send / schema / type-surface 授权措辞，并扩展到 catalog 文本 |
| 把"自动同步刷新"误读为"人在跟进" | 高 | catalog 中所有四个候选都保留 `limitationNote`，选定候选的 `limitationNote` 显式标注 `evidence-freshness staleness, not human inactivity`，并要求未来 runtime adoption 仍须显式标注；`formula_shape_is_explicit_and_planning_only` 检查强制 `stalenessLabel === "evidence_freshness_staleness_not_human_inactivity"` |
| 把 formula/source 文档化误读为 human guard 已清空 | 高 | `PF3A005_ADOPTION_POSTURE.humanMeaningfulStalenessGate = not_cleared`；7 项 posture checks 强制 gate-not-cleared、stop-or-downgrade 与 no-readiness 语言；未来必须 stop-and-re-surface 或显式降级为 evidence-freshness-only |
| `null` / 非法 / 未来 observedAt 被错误当作 stale | 高 | `computeDerivedStaleDays` 显式对三种情况返回 `null`；`compute_handles_null_invalid_future_observed_at` 与 `take_two_calibration_cases_match_expected` 双重守护；CAL-003 显式覆盖三种情况 |
| 边界条件被误读（=14 错误地通过 > 14 过滤） | 中 | `fourteen_day_threshold_examples_resolved` 检查 13 / 14 / 15 三档；CAL-002 显式覆盖；`thresholdComparator` 取值固定为 `strictly_greater_than` |
| take:2 噪音守护制造平局歧义 | 中 | `applyTpqr005CalibrationRule` 显式按 `derivedStaleDays DESC, resourceKey ASC` 排序；CAL-001 双 40d 平局测试守护 |
| 把 `derivedStaleDays` 静默挂到 `TenantResourceOperatingImpactItem` | 高 | `design_note_refuses_runtime_and_type_surface_adoption` 强制 design note 显式 disclaim 修改 `TenantResourceOperatingImpactItem`；boundary notes 反复强调 PF3A-005 不修改任何 readout runtime type；任务级 allowed write set 在仓库层面拒绝该修改 |
| 误改 `loadTenantResourceIssues` 行为以"实施 TPQR-005" | 中 | `existing_filter_call_site` evidence 行明确记录当前过滤逻辑无 `derivedStaleDays` 分支；boundary notes 反复强调 PF3A-005 不修改 `features/mobile/lib/mobile-command-read-model.ts`；任务级 allowed write set 在仓库层面拒绝该修改 |
| 报告被当作"批准下一步" | 高 | 报告与 artifact 都明确声明：本 artifact 不是 implementation-ready；任何 thin read-model planning、Prisma schema、API、page 行为、runtime adoption、type-surface change 必须在独立评审中重新批准 |

---

## 五、结论

- **selectedSource**：`readiness_timing_observed_at_normalized`（`TenantResourceEvidenceDetail.timing.observedAt = resource.connection.lastSyncAt ?? resource.updatedAt`）
- **selectedFormula**：`derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000)`
- **threshold / noise guard**：`strictly_greater_than 14` / `take: 2` / `derivedStaleDays_desc_then_resource_key_asc`
- **stalenessLabel**：`evidence_freshness_staleness_not_human_inactivity`（明确诚实标签）
- **adoption posture**：`formulaStatus = selected_for_planning`；`humanMeaningfulStalenessGate = not_cleared`；`semanticScope = evidence_freshness_only_not_human_inactivity`；`nextRequiredDecision = stop_or_explicit_scope_downgrade_before_runtime_adoption`
- **rationale 摘要**：选 readout-level 归一化 source 是为了让公式跨 connector / import_source / capture_session / extension 形状统一，不引入新查询、新 schema、新类型字段；同时显式承认任意 connector/import 同步刷新仍可影响 observedAt，因此未来运行时使用必须额外通过 type-surface 与 runtime-adoption review

**关键结论**：PF3A-005 完成了 `derivedStaleDays` 的 source/formula 文档化，但没有清空上游要求的 human-meaningful staleness guard。后续如果要使用这条信号，只能先 stop-and-re-surface，或显式把产品/运行时语义降级为 evidence-freshness-only。

**本 artifact 不批准** thin read-model planning、Prisma schema、API route、runtime extractor、event queue、official write、auto execution、auto send、LLM final ranking、`TenantResourceOperatingImpactItem` 或任何 readout runtime type 字段扩展、dashboard / mobile / 操作页面 行为变更或生产 runtime query 实现。

---

## 六、验证结果

> 备注：以下验证已由 Codex 在本机会话独立运行。PF3A-005 仍是 planning-only artifact；验证通过不改变 `humanMeaningfulStalenessGate = not_cleared` 的 gate posture。

### 6.1 Vitest

```
npx vitest run features/business-advancement/tenant-resource-stale-days-derivation-design.test.ts
```

结果：1 个 test file 通过，54 个测试全部通过；`evaluator.allPassed === true`。

### 6.2 CLI

```
npx tsx scripts/business-advancement-tenant-resource-stale-days-derivation-design.ts
```

结果：

- 打印 12 行 evidence、4 项 source 候选目录、selected source `readiness_timing_observed_at_normalized`、selected formula `derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000)`、threshold `strictly_greater_than 14`、take:2 校准 4 项全部 PASS，并打印 `humanMeaningfulStalenessGate = not_cleared`；
- evaluator 23 / 23 PASS；
- 退出码 0。

### 6.3 ESLint

```
npx eslint features/business-advancement/tenant-resource-stale-days-derivation-design.ts \
  features/business-advancement/tenant-resource-stale-days-derivation-design.test.ts \
  scripts/business-advancement-tenant-resource-stale-days-derivation-design.ts
```

结果：0 errors / 0 warnings。

### 6.4 Git whitespace check

```
git diff --check -- \
  features/business-advancement/tenant-resource-stale-days-derivation-design.ts \
  features/business-advancement/tenant-resource-stale-days-derivation-design.test.ts \
  scripts/business-advancement-tenant-resource-stale-days-derivation-design.ts \
  docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A005_DERIVED_STALE_DAYS_DESIGN_V1.md \
  docs/README.md
```

结果：0 whitespace errors。

---

## 七、不视为 implementation-ready 的明示

**本 artifact 不是 runtime integration 的批准。**

在以下条件全部独立达成之前，不进入 thin read-model planning、runtime integration、Prisma schema 变更、API route、runtime extractor、event queue、official write、auto execution、auto send、LLM final ranking、`TenantResourceOperatingImpactItem` 或任何 readout runtime type 字段扩展、dashboard / mobile / 操作页面 行为变更或生产 runtime query 实现：

1. 先处理 `humanMeaningfulStalenessGate = not_cleared`：要么 stop-and-re-surface PF3A-005，要么由产品/治理显式批准把语义降级为 evidence-freshness-only。
2. 在独立 type-surface review 中决定是否、以及如何把 `derivedStaleDays` 暴露到 `TenantResourceOperatingImpactItem`；包括 `null`（unknown）值的 UI 表达。
3. 在独立 runtime-adoption review 中决定 reference clock 来源（建议复用 `readiness.generatedAt` 或调用方 `now`，不要新引入时钟）、阈值与 take:2 是否仍适合真实 workspace 数据，并显式标注 `evidence_freshness_staleness_not_human_inactivity`。
4. PF3A-002（`Opportunity.updatedAt` writer-source 审计）、PF3A-003（`Commitment.overdueFlag` 持久化列依赖）、PF3A-004（emailThread.id 去重）三项独立评审通过。
5. 任何对 `lib/tenant-resources/*`、`features/mobile/lib/mobile-command-read-model.ts`、`data/queries.ts`、`app/`、`app/api/`、`prisma/schema.prisma` 的修改提议必须在独立评审中通过；当前 artifact 不为之背书。

---

## 八、下一阶段建议

1. **PF3A-005 gate decision**：先决定是 stop-and-re-surface，还是明确把 `derivedStaleDays` 降级为 evidence-freshness-only 信号；没有这个决定，不进入 thin read-model planning。
2. **Type-surface review**：如果仍要继续，决定是否要把 `derivedStaleDays` 加到 `TenantResourceOperatingImpactItem`；如果加，必须显式回应 `null`（unknown）的渲染规则与 `evidence_freshness_staleness_not_human_inactivity` 的 UI 文案。
3. **Runtime-adoption review**：用真实 workspace shape 校准阈值（14 天 / take:2）、决定 reference clock 来源、确认 `null` 行为在 mobile / dashboard / settings 各 surface 一致。

**未完成上述独立评审之前，不进入 runtime extractor、official write、auto execution、page 行为变更或 production query adoption。**
