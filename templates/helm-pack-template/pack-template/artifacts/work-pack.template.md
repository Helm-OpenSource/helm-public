# Review-Ready Work Pack Template / Review-Ready Work Pack 模板

> **语言 / Language**: **中文主文本** + **English reference**

> 用于准备复核的静态 Pack 工件。它不是工作流引擎、智能体编排层、执行计划、
> 法律建议、财务建议、医疗建议或客户承诺。
>
> Static Pack artifact for preparing review. This is not a workflow engine,
> agent orchestration layer, execution plan, legal advice, financial advice,
> medical advice, or customer commitment.

## 1. Goal

交付工程师先填写本节，确保 Pack 只准备一个窄判断，不扩成工作流或执行计划。

- Pack ID:
- Work Pack ID:
- Business problem:
- Run window:
- Data posture: `synthetic | redacted | alias_only`

## 2. Scope Questions

| Question | Answer | Evidence Ref | Reviewer |
|---|---|---|---|
| What narrow decision should this Pack prepare? |  |  |  |
| Who owns the decision? |  |  |  |
| What sample data is available? |  |  |  |
| What is explicitly out of scope? |  |  |  |

## 3. Required Sources

| Source Family | Required? | Redaction Required? | Freshness Rule | Notes |
|---|---|---|---|---|
| meeting | yes | yes | current or reviewed stale |  |
| email | optional | yes | current or reviewed stale |  |
| crm | optional | yes | current or reviewed stale | read-only only |
| report | optional | yes | current or reviewed stale |  |

## 4. Allowed Actions

- 准备复核包。
- 向负责人索取缺失的脱敏样本。
- 把声明标为证据不足 / 相互矛盾 / 已过期 / 敏感 / 已支撑。
- 推荐下一步复核安全动作。

- Prepare a review packet.
- Ask the owner for missing redacted samples.
- Mark a claim as insufficient, contradicted, stale, sensitive, or supported.
- Recommend a next review step.

## 5. Never Actions

- 不自动发送客户可见消息。
- 不自动审批。
- 不自动执行。
- 不静默写入客户关系系统或客户系统字段。
- 不从本工件创建公开声明。
- 不包含原始客户数据、密钥、私有域名、内网 IP 或部署细节。

- Do not auto-send customer-visible messages.
- Do not auto-approve.
- Do not auto-execute.
- Do not silently write CRM or customer system fields.
- Do not create public claims from this artifact.
- Do not include raw customer data, secrets, private domains, intranet IPs, or deployment details.

## 6. Prepared Work For Review

| Prepared Item | Owner Alias | Evidence Ref | Status | Stop Condition |
|---|---|---|---|---|
|  |  |  | pending_review | missing owner or missing evidence |

## 7. Evidence Matrix Columns

- `business_pain`
- `owner_available`
- `data_available`
- `review_first_acceptance`
- `action_safe`
- `72h_outcome_observable`
- `proof_candidate_eligible`
- `public_claim_candidate`

## 8. Review Packet Output

- Summary:
- Supported claims:
- Contradicted claims:
- Insufficient claims:
- Sensitive claims:
- Recommended review-safe next action:

## 9. Owner Decision

- Decision: `go | defer | no-go | split-scope`
- Decided by:
- Decided at:
- Reason:
- Boundary notes:

## 10. Outcome Ledger

| Proposed Action | Reviewed By | Reviewed At | 72h Outcome State | Evidence Ref | Notes |
|---|---|---|---|---|---|
|  |  |  | not_started |  |  |

## Closeout Boundary

This artifact may become an internal proof candidate only after review. It may not become customer-visible or public without separate customer authorization and claim review.
