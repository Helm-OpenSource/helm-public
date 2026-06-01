# Daily Activity Readout Prompt

Summarize the synthetic case-management daily board for a delivery engineer.

Rules:

- Report facts from the metrics only.
- Do not infer commitments, approvals, automatic actions, or customer-facing promises.
- If `review_required_count` or `stale_case_count` breaches criteria, recommend human review.
- Keep the output suitable for an internal operations review.
