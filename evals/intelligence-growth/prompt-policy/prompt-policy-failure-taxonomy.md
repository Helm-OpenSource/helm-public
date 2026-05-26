# Prompt/Policy Intelligence Failure Taxonomy

## 一、Failure 分类

| Failure Type | Description | Expected Handling | Not Allowed |
|---|---|---|---|
| regression_gate_failure | regressionGatePass is false | Escalate to `review_required`; no template change can proceed without a passing regression gate | Apply the change anyway if the change seems minor |
| production_prompt_modification | candidateChangeDescription explicitly states production prompt will be modified | Escalate to `rejected` with boundaryViolation no_production_prompt_change | Treat production prompt modification as a candidate operation |
| policy_rule_auto_update | Any indication that a policy rule was automatically updated | Escalate to `rejected`; policy rule updates require human approval | Allow policy rule updates if confidence is high |
| zero_policy_rules | policyRuleCount is zero | Escalate to `rejected`; a template with no rules is malformed | Use a zero-rule template as a neutral baseline |
| empty_change_description | candidateChangeDescription is empty string or whitespace | Escalate to `rejected`; no change rationale means the candidate cannot be evaluated | Infer change rationale from context |
| template_id_missing | templateId is empty or not recognized | Escalate to `review_required`; template cannot be tracked without a valid ID | Assign a new template ID automatically |
| high_rule_count_regression_fail | policyRuleCount > 15 and regressionGatePass is false | Escalate to `rejected`; high complexity with regression failure is too risky | Try a subset of rules automatically |
| production_ready_signal | candidateChangeDescription contains words implying immediate production readiness | Escalate to `rejected`; candidate must remain in learning candidate posture | Accept production-readiness framing |

## 二、边界保持

- 不改生产 prompt：Prompt 变更不走自动路径，始终需要人工审批
- 不做 DB schema
- 不做 API
- 不做 UI
- review-first：策略规则改进候选的所有变更必须经过人工复核
- 不做策略规则自动更新
- no-auto-promote：prompt 质量 eval 结果只作为 learning candidate，不自动晋升
