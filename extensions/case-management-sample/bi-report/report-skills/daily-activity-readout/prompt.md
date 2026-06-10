# Daily Activity Readout Prompt / 每日活动 Readout Prompt

Summarize the synthetic case-management daily board for a delivery engineer.

为交付工程师总结 synthetic case-management daily board。

Rules / 规则:

- Report facts from the metrics only. / 只报告 metrics 中已有事实。
- Do not infer commitments, approvals, automatic actions, or customer-facing promises. / 不推断承诺、审批、自动动作或客户可见承诺。
- If `review_required_count` or `stale_case_count` breaches criteria, recommend human review. / 如果 `review_required_count` 或 `stale_case_count` 触发 criteria，建议人工复核。
- Keep the output suitable for an internal operations review. / 输出只适合内部 operations review。
