# Cost/Model/Tool Intelligence Failure Taxonomy

## 一、Failure 分类

| Failure Type | Description | Expected Handling | Not Allowed |
|---|---|---|---|
| token_usage_runaway | tokenUsagePerCall > 10000 | Escalate to `review_required`; runaway consumption needs human diagnosis | Auto-truncate the call context |
| zero_token_usage | tokenUsagePerCall is 0 | Escalate to `rejected`; zero-token call is an invalid record | Treat zero-token as a successful no-op |
| excessive_tool_boundary_hits | toolBoundaryHitCount ≥ 8 | Escalate to `rejected`; repeated boundary violations indicate architectural constraint breach | Auto-widen tool boundaries for this call type |
| moderate_tool_boundary_hits | toolBoundaryHitCount 3–7 | Downgrade to `watch_only`; boundary contact pattern needs monitoring | Treat moderate boundary hits as acceptable noise |
| auto_model_switch_attempted | Any indication that the model was automatically switched without human approval | Escalate to `rejected`; model switching is strictly review-first | Allow automatic model switching for cost savings |
| model_id_empty | modelId is empty or not a recognized alias | Escalate to `review_required`; model identity is required for cost attribution | Assign a default model ID |
| downgrade_candidate_without_evaluation | modelDowngradeCandidateEvaluated is false but token usage is very high | Downgrade to `watch_only`; high usage without downgrade exploration is a missed optimization signal | Auto-evaluate downgrade candidates based on token thresholds |
| no_evidence_refs_zero_tokens | No evidence refs combined with zero token usage | Escalate to `rejected`; call record is entirely unverifiable | Treat as a valid baseline zero-cost record |

## 二、边界保持

- 不改生产 prompt
- 不做 DB schema
- 不做 API
- 不做 UI
- review-first：模型选择变更不走自动路径
- 不做自动模型切换：autoModelSwitchAttempted 必须始终为 false
- no-auto-promote：成本 eval 结果只作为 learning candidate，不自动晋升
