# Action/Outcome Intelligence Failure Taxonomy

## 一、Failure 分类

| Failure Type | Description | Expected Handling | Not Allowed |
|---|---|---|---|
| missing_outcome_annotation | Action has no outcome annotation and no feedback cycles | Escalate to `review_required` for must_push; downgrade to `watch_only` for others | Auto-infer outcome from signal |
| empty_evidence_refs | No evidence refs with no outcome annotation | Escalate to `rejected`; case is untracked and cannot enter the correlation path | Treat as a valid but low-confidence case |
| runaway_feedback_loop | feedbackCycleCount > 20 without outcome annotation | Escalate to `rejected`; likely data integrity issue or infinite loop | Continue accumulating cycles |
| auto_judgment_attempted | Any case where autoJudgmentAttempted is not explicitly false | Escalate to `rejected`; automatic outcome judgment is not permitted | Allow auto-judgment as a fallback |
| outcome_correlation_below_minimum | Correlation score is critically low despite multiple feedback cycles | Downgrade to `watch_only`; route for human adjudication | Auto-discard the action from learning pipeline |
| action_category_unknown | actionCategory not in the recognized enum | Escalate to `review_required`; category is not classifiable | Default to learning_candidate silently |
| feedback_without_annotation | Feedback cycles completed but outcome still not annotated | Downgrade to `watch_only`; annotation is overdue | Auto-annotate from last feedback cycle |
| must_push_missing_evidence | Must_push action with zero evidence refs and zero annotation | Escalate to `review_required`; high-urgency action cannot proceed without tracking | Auto-promote must_push actions regardless |

## 二、边界保持

- 不改生产 prompt
- 不做 DB schema
- 不做 API
- 不做 UI
- review-first：行动结果判断不走自动路径
- 不做自动结果判断：autoJudgmentAttempted 必须始终为 false
- no-auto-promote：行动结果 eval 只作为 learning candidate，不自动晋升
