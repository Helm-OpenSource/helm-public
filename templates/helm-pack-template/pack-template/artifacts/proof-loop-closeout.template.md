# Proof Loop Closeout Template / Proof Loop 收口模板

> **语言 / Language**: **中文主文本** + **English reference**

> 收口一个 7-day Run，但不把内部学习直接变成 public claim。
>
> Close a 7-day Run without turning internal learning into a public claim.

## 0. Boundary / 边界

- 本 closeout 默认 internal-only。/ This closeout is internal by default.
- `proof candidate` 不等于 proof。/ `proof candidate` does not mean proof.
- Public 或 customer-visible claims 需要单独 written customer authorization 与 claim review。/ Public or customer-visible claims require separate written customer authorization and claim review.
- 不包含 raw customer data、secrets、private domains、intranet IPs、deployment details 或 customer-specific configuration。/ Do not include raw customer data, secrets, private domains, intranet IPs, deployment details, or customer-specific configuration.

## 1. Run Summary

- Pack ID:
- Run ID:
- Run window:
- Data posture: `synthetic | redacted | alias_only`
- Business owner alias:
- Reviewer alias:
- Delivery engineer alias:

## 2. Artifact Coverage

| Artifact | Present? | Path / Ref | Notes |
|---|---|---|---|
| Context Packet | no |  |  |
| Pack Studio safe sample | no |  |  |
| Evidence Matrix | no |  |  |
| Review-Ready Work Pack | no |  |  |
| Incident register | no |  |  |

## 3. 72h Outcome Ledger

| Proposed Action | Reviewed? | Review Decision | 72h Outcome | Evidence Ref | Boundary Incident? |
|---|---|---|---|---|---|
|  | no | pending | not_started |  | no |

Outcome states:

- `not_started`
- `pending_72h`
- `observed_positive`
- `observed_negative`
- `blocked`
- `no_signal`
- `aborted`

## 4. Evidence Matrix Summary

| State | Count | Notes |
|---|---:|---|
| supported | 0 |  |
| contradicted | 0 |  |
| insufficient | 0 |  |
| stale | 0 |  |
| sensitive | 0 |  |
| needs_owner_review | 0 |  |

## 5. Proof Candidate Classification

| Label | Selected? | Reason |
|---|---|---|
| internal-only | yes | default |
| partner-review-candidate | no | requires NDA and no raw customer data |
| customer-visible-candidate | no | requires customer-side reviewer |
| public-eligible-candidate | no | requires separate claim review |

## 6. Claim Denylist

List every claim that must not be used externally.

| Claim | Reason | Revisit Condition |
|---|---|---|
|  | insufficient evidence |  |

## 7. Decision

- Decision: `continue | revise | defer | no-go`
- Decision owner:
- Reviewer:
- Next run candidate:
- Stop condition:

## 8. Validation Notes

- Boundary incidents:
- Raw data incidents:
- Auto-send / auto-execute incidents:
- Silent CRM write incidents:
- Customer-visible claim incidents:
