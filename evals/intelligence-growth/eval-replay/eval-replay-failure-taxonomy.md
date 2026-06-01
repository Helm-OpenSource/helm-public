# Eval/Replay Intelligence Failure Taxonomy

## 一、Failure 分类

| Failure Type | Description | Expected Handling | Not Allowed |
|---|---|---|---|
| zero_fixture_count | No fixtures are loaded for the eval run | Escalate to `review_required`; eval cannot function without fixtures | Silently skip the eval run |
| covered_exceeds_total | coveredProductionPathCount > totalKnownProductionPathCount | Escalate to `rejected`; data integrity violation in coverage counts | Auto-cap covered count at total |
| coverage_below_minimum | Coverage ratio < 0.40 | Downgrade to `watch_only`; coverage is insufficient for reliable quality assessment | Auto-generate synthetic fixtures to fill coverage gap |
| production_data_replayed | Any indication that production database records were used in replay | Escalate to `rejected`; replay must be fixture-only, never production data | Allow production data replay if data is redacted |
| no_evidence_refs | Evidence refs list is empty | Escalate to `rejected`; replay run cannot be verified without evidence | Treat unverified replays as valid |
| failure_cases_zero_with_low_coverage | failureCasesReplayed is 0 and coverage is low | Escalate to `review_required`; no failure cases means failure detection cannot be tested | Assume no failures exist |
| eval_report_unstructured | Eval report is not machine-readable JSON | Escalate to `review_required`; reporting format must be standardized | Accept human-readable-only reports as complete |
| dimension_not_covered | A known IGS dimension has zero fixtures in the eval run | Downgrade to `watch_only`; uncovered dimension represents a gap in quality gating | Claim full IGS coverage without dimension-level fixtures |

## 二、边界保持

- 不改生产 prompt
- 不做 DB schema
- 不做 API
- 不做 UI
- review-first：eval framework 改动必须经人工复核
- 不做 production data 回放：所有 replay 只使用本地 fixture
- no-auto-promote：eval 覆盖率指标只作为 learning candidate，不自动晋升
