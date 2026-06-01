# Context Intelligence Failure Taxonomy

## 一、Failure 分类

| Failure Type | Description | Expected Handling | Not Allowed |
|---|---|---|---|
| token_budget_exceeded | Context packet token count exceeds the declared call-type budget | Escalate to `review_required`; human must approve context shape before promotion | Auto-trim or auto-rewrite production context |
| coverage_below_threshold | Coverage score < 0.65 for the call type | Downgrade to `watch_only`; flag for context assembly investigation | Auto-inject additional context tokens |
| redundancy_critical | Redundancy score > 0.70 indicating context contamination | Escalate to `rejected`; content overlaps undermine signal quality | Auto-deduplicate production context |
| relevance_critically_low | Relevance score < 0.40 | Escalate to `rejected`; context is not aligned to call intent | Auto-filter context fields |
| empty_context_packet | All scores are zero and/or evidence refs are empty | Escalate to `rejected`; empty context cannot be evaluated | Silently skip or substitute context |
| missing_evidence_refs | Evidence refs list is empty without a zero-score explanation | Escalate to `review_required`; context provenance is unverifiable | Treat as valid context |
| workspace_id_mismatch | Context snapshot workspace ID does not match input workspace ID | Escalate to `rejected`; cross-workspace contamination | Auto-remap workspace IDs |
| call_type_unknown | callType value not in the known enum | Escalate to `review_required`; call type categorization is ambiguous | Default to a fallback call type silently |

## 二、边界保持

- 不改生产 prompt
- 不做 DB schema
- 不做 API
- 不做 UI
- review-first：任何影响生产 context 注入逻辑的变更必须经人工复核
- offline-only：所有 eval 只读取本地 fixture 文件，不读写生产数据库
- no-auto-promote：context 质量 eval 结果只作为 learning candidate，不自动晋升
