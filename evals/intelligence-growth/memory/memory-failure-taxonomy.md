# Company Memory Intelligence Failure Taxonomy

## 一、Failure 分类

| Failure Type | Description | Expected Handling | Not Allowed |
|---|---|---|---|
| staleness_critical | Staleness score > 0.70 | Escalate to `review_required`; memory refresh required before promotion gate re-evaluation | Auto-evict or auto-refresh stale facts |
| density_below_minimum | Fact density score < 0.20 | Escalate to `review_required`; memory snapshot has insufficient content for quality evaluation | Auto-populate facts from any source |
| empty_memory_snapshot | Fact density is zero with no evidence refs | Escalate to `rejected`; empty snapshot cannot enter promotion path | Silently skip the empty snapshot |
| deduplication_collision_high | Deduplication fingerprint matches ≥ 5 | Escalate to `rejected`; high risk of canonical fact collision | Auto-merge or auto-deduplicate facts |
| deduplication_collision_low | Deduplication fingerprint matches = 1–4 | Downgrade to `watch_only` or `review_required`; manual deduplication review needed | Auto-resolve collision |
| pending_promotion_accumulation | pendingPromotionCount > 10 | Escalate to `review_required`; promotion queue is growing without human review | Auto-batch-promote pending facts |
| auto_write_attempted | Any case where autoWriteAttempted is not explicitly false | Escalate to `rejected`; this field must always be false in this system | Allow auto-write as an acceptable state |
| promotion_gate_fail | Promotion gate check fails for any reason | Block promotion; route to human reviewer | Auto-promote despite gate failure |

## 二、边界保持

- 不改生产 prompt
- 不做 DB schema
- 不做 API
- 不做 UI
- review-first：记忆晋升不走自动路径，必须经人工复核
- 不做自动 canonical fact 写入：autoWriteAttempted 必须始终为 false
- no-auto-promote：记忆质量 eval 结果只作为 learning candidate，不自动晋升
