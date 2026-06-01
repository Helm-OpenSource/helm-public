# Object/Signal Intelligence Failure Taxonomy

## 一、Failure 分类

| Failure Type | Description | Expected Handling | Not Allowed |
|---|---|---|---|
| stale_signal_majority | More than 50% of signals on an object are stale | Escalate to `review_required`; gate may be overstated | Auto-revoke gate decision |
| zero_signal_gate_claim | Object claims must_push_ready or review_required with zero signals | Escalate to `rejected`; no evidentiary basis for gate | Auto-set gate to watch_only |
| all_signals_stale | Every signal on the object is stale | Escalate to `rejected`; object state is indeterminate | Continue using the gate value |
| gate_accuracy_false_positive | Object gated as must_push_ready but signal quality does not support it | Escalate to `review_required`; gate accuracy is suspect | Auto-demote the object gate |
| gate_accuracy_false_negative | Object gated as watch_only or rejected but signal evidence suggests higher readiness | Flag as `watch_only`; route to human adjudication | Auto-promote the gate |
| object_kind_mismatch | Object ref kind is not in the recognized enum | Escalate to `review_required`; object type is not supported | Silently reclassify object kind |
| remediation_loop | Object has been through remediation more than 3 times without gate change | Escalate to `review_required`; pattern suggests unresolved blocker | Automatically trigger additional remediation cycles |
| cross_workspace_object_ref | Object ref workspace ID does not match eval workspace ID | Escalate to `rejected`; isolation boundary violation | Auto-remap workspace IDs |

## 二、边界保持

- 不改生产 prompt
- 不做 DB schema
- 不做 API
- 不做 UI
- review-first：gate 变更不走自动路径
- 不做 runtime revocation 自动化
- no-auto-promote：object gate 评估结果只作为 learning candidate，不自动晋升
