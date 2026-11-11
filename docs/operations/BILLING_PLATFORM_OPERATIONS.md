---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-12
review_after: 2026-12-12
public_safety: Public source contract and synthetic test verification only. No deployment approval, workspace roster, payment or customer data.
---

# Billing platform operations / 平台计费运营操作

Billing V1 E1a/E1b (Core): migration `20261112120000_billing_platform_operations`, `lib/billing/platform/platform-operations.ts`,
batch runner `lib/billing/platform/platform-batch.ts`, CLI `npm run billing:platform-ops`. Command line only: no HTTP route or UI.
平台代客户建付款主体与绑定、切换计费模式；制单与复核必须是两个不同的平台财务人员，证据为 owner 裁定编号，不要求客户 OWNER 操作。

## Authority / 权限

- Reuses the S2-c `PlatformFinanceGrant` ([bank receipts](BILLING_BANK_RECEIPTS.md)): a **maker** drafts, a **different checker**
  approves or rejects (service check + DB CHECK `reviewedByUserId <> draftedByUserId`). Both must be ACTIVE, unscoped members of the
  Helm reserved workspace with an active grant. Customer OWNER / BILLING_ADMIN and service identities are refused
  (`platform_operation_forbidden`). This path is separate from the customer-side `createPayerAccount` / `bindScope`, which are unchanged.
- `--actor-user-id` is asserted by whoever runs the CLI on the server (not authenticated by it): one person per role, by procedure.

## Operations / 操作

- `PlatformBillingOperation`: `kind`, `operationKey` (UNIQUE), `workspaceId`, frozen `request` JSON and `contentHash`, `state`
  (`drafted -> applied | rejected`), drafter, reviewer, `evidenceRef` (owner ruling), `reviewEvidenceRef`, `resultRef`, `version`.
  Triggers freeze the drafted facts and refuse DELETE.
- `payer_onboard { workspaceId, contractSubjectRef }`: approval creates one `enterprise_contract` payer governed by that workspace
  (`billingMode=off`) and its active workspace binding (`authorizedByUserId` = checker, `evidenceRef` = ruling) in one transaction. The
  workspace must be ACTIVE, not the reserved workspace, and unbound (`payer_scope_already_bound`).
- `billing_mode { workspaceId, fromMode, toMode }`: any step between two distinct modes of `off | shadow | enforce`. Approval locks the
  payer and updates it with the expected old mode in the UPDATE's own WHERE (CAS); a mode changed since the draft refuses
  `billing_mode_conflict` and leaves the draft pending (reject it and draft again). `version + 1` on success.
- **Enforce** (owner 11-12: skip shadow, `off -> enforce` is the main path): any step to `enforce` needs `--confirm-enforce` on both
  draft and approval (`platform_enforce_not_confirmed`). Approval also requires exactly one active grant per billing event and meter unit
  (`enforce_grant_not_ready`) and headroom = wallet + undrawn credit - held/unknown enforce reservations > 0
  (`enforce_headroom_insufficient`), so the switch never stops the payer at once. **真扣钱前另有前置（透支下限、事后结算、开拨前余额
  标志等，见 ENFORCE_DIRECT 方案），本命令不代表可以启用 enforce。** Rollback per workspace: `enforce -> shadow` (recommended: keeps
  metering, moves no money) or `enforce -> off`, no confirmation flag, still maker + checker and dry run first.
- Audit in the same transaction: `BILLING_PLATFORM_OPERATION_DRAFTED | APPLIED | REJECTED` in the reserved and the target workspace,
  plus `BILLING_PAYER_SCOPE_BOUND` or `BILLING_PAYER_MODE_CHANGED` in the target workspace.
- Idempotency: `operationKey` derives from (ruling, kind, workspace, mode step). The same request replays; the same key with other
  content refuses `platform_operation_conflict`; the same checker repeating a decision replays. Repeating a mode step already taken
  under one ruling replays it; if the mode has moved since, the draft refuses `platform_operation_stale_replay` (E1b), so a second identical
  step (e.g. a second rollback) needs a new ruling reference. A rejected operation likewise needs a new reference to be drafted again.

## Prices and spend grants (E1b) / 发价与消费授权

- `price_publish { productCode, version, billingEventRef, meterUnit, acceptanceRef, unitPriceFenNumerator, unitPriceDenominator,
  effectiveFrom, effectiveUntil, approvalRef, priceLabel }`: approval appends that version through the S3-a
  `publishPriceVersionInTransaction` (actor `SYSTEM:platform-op:<operation id>`, filed under the reserved workspace). Amounts are decimal
  strings, times ISO-8601 UTC. A zero numerator refuses `price_zero_refused` (reserve would refuse it as `grant_charge_zero`). Versions stay
  append-only; same content replays, other content `price_version_conflict`.
- `priceLabel` is a closed set that is part of the reviewed content; today only `planning_estimate_not_a_quote`, printed as
  **「规划试算价，不作为报价」**; the owner ruling behind the price is carried by the list's ASCII `approvalRef`, not by code. The owner-chosen price is 财模规划价 0.35 元/分钟 = `unitPriceFenNumerator "35"`,
  `unitPriceDenominator "1"`, `meterUnit "minute"`, `billingEventRef "service-billing-event-v1:robot_call_minute"`. These literals are the
  observer's provisional names and **must equal the Pack E4 event list** (`service-billing-event-v1`) before use; a mismatch makes quote
  find no grant (`grant_not_active`). `approvalRef` is ASCII, e.g. `<ruling ref>:planning-estimate-not-a-quote`.
- `spend_grant { workspaceId, productCode, priceVersion, validFrom, validUntil, perChargeLimitFen, dailyLimitFen, monthlyLimitFen }`:
  approval runs the S3-a service steps create (disabled) -> `set_limits` -> `activate` under the `platform_checker` authority (the active
  checker grant is re-checked inside `price-grants.ts`; customer OWNER/BILLING_ADMIN paths are unchanged), each audited in the workspace.
  Refuses `price_version_unavailable`, `grant_limits_zero`, and `grant_active_exists` while the payer still has a disabled, active or
  paused grant for the product: quote needs exactly one. Changing price means a new version plus revoking the old grant (later step).
- Limits apply in shadow and enforce alike and are checked when the after-the-call meter reserves. A use refused by a limit is **not
  charged (under-billed, never over-charged)** and goes to manual review; size limits from real daily volume. The dry run prints
  `limitUnits` (meter units each limit covers at the referenced price) as the basis.

## Emergency rollback / 一人紧急回退

Owner ruling 2026-11-12: one person may roll a payer back at once; a second person confirms afterwards. 一人回退立即生效、留痕，并生成
待补复核记录；24 小时内须由另一人复核确认。逾期只告警、不自动撤销回退。切 enforce 仍须两人。

- Direction: **`enforce -> shadow` only** (keeps metering, moves no money; the recommended rollback). `-> off` and `-> enforce` stay
  maker + checker above. Migration `20261112130000_billing_platform_emergency_rollbacks`, `lib/billing/platform/platform-emergency.ts`.
- `--command=emergency-rollback --workspace-id=<id> --actor-user-id=<id> --evidence-ref=<ref> [--apply]`: any platform finance role
  (maker or checker). Dry run prints the current mode. Apply: CAS `enforce -> shadow` on the payer (also when suspended) and a
  `PlatformEmergencyRollback` row `pending_review` with `reviewDueAt = executedAt + 24h` (DB CHECK), audited
  (`BILLING_PAYER_MODE_CHANGED`, `BILLING_PLATFORM_EMERGENCY_ROLLBACK_EXECUTED`) in the same transaction. Same person + same
  `(evidenceRef, workspace)` replays; anyone else refuses `emergency_conflict`; a payer not in enforce refuses `billing_mode_conflict`.
- `--command=confirm-rollback --rollback-id=<id> --actor-user-id=<checker> --evidence-ref=<ref> [--apply]`: a platform finance
  **checker other than the executor** (service and DB CHECK); allowed after the due time too, audited with `overdue`.
- `--command=pending-rollbacks`: read-only list, oldest due first, `overdue` on database time; when any is overdue it sets
  `alert: emergency_rollback_review_overdue`, prints it on stderr and exits **3**, so a scheduled check can raise an alarm.
- Rows refuse DELETE and keep their facts (trigger); rollback script refuses while any row exists.

## Batch CLI / 批量命令

The roster is supplied by operations from the owner ruling; nothing in code names an institution.

```json
{ "evidenceRef": "owner-ruling:OWNER_RULINGS_BILLING_TO_MAIN_20261111:example",
  "entries": [{ "kind": "payer_onboard", "workspaceId": "<workspace id>", "contractSubjectRef": "<contract ref>" },
              { "kind": "billing_mode", "workspaceId": "<workspace id>", "fromMode": "off", "toMode": "enforce" }] }
```

A price list entry (one per product version; approve it before the grants that use it, e.g. earlier in the same list):

```json
{ "kind": "price_publish", "productCode": "robot-call-minute", "version": 1,
  "billingEventRef": "service-billing-event-v1:robot_call_minute", "meterUnit": "minute", "acceptanceRef": "<acceptance ref>",
  "unitPriceFenNumerator": "35", "unitPriceDenominator": "1", "effectiveFrom": "<ISO UTC>", "effectiveUntil": null,
  "approvalRef": "<ruling ref>:planning-estimate-not-a-quote", "priceLabel": "planning_estimate_not_a_quote" }
```

1. Dry run (default, read-only): `npm run billing:platform-ops -- --command=draft --list-file=list.json --actor-user-id=<maker>`
   prints the list `listSha` (sha256 of the file bytes), each entry's operation key, operation state and current mode.
2. Maker: add `--apply --list-sha=<listSha>` (plus `--confirm-enforce` if any entry goes to enforce).
3. Checker: `--command=review --decision=approve|reject --review-evidence-ref=<ref>`, dry run, then `--apply --list-sha=<listSha>`.
- One transaction per entry in file order; stops at the first refusal (`stoppedAt`); re-running the same list resumes (committed entries
  replay). A changed list has a new sha and is dry-run again. Fields are closed, refs ASCII; output carries ids, states and codes only.

## Verification and rollback / 验证与回滚

- Unit `platform-operations.test.ts`; `npm run test:billing:mysql`: distinct maker/checker, non-platform and revoked identities refused,
  CAS conflict between draft and approval, replay of both steps, concurrent approvals (one applies), audit rolled back with the change,
  dry run writes nothing, wrong sha refused, stop-and-resume.
- Application rollback: stop running the CLI. Data written through it is undone by new operations (mode back to `off`, binding revoke
  by its OWNER), never by editing rows. Schema rollback `prisma/rollback/20261112_rollback_billing_platform_operations.sql` refuses while
  any operation row exists.
