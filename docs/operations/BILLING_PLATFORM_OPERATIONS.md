---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-12
review_after: 2026-12-12
public_safety: Public source contract and synthetic test verification only. No deployment approval, workspace roster, payment or customer data.
---

# Billing platform operations / 平台计费运营操作

Billing V1 E1a (Core): migration `20261112120000_billing_platform_operations`, `lib/billing/platform/platform-operations.ts`,
batch runner `lib/billing/platform/platform-batch.ts`, CLI `npm run billing:platform-ops`. Command line only: no HTTP route or UI.
平台代客户建付款主体与绑定、切换计费模式；制单与复核必须是两个不同的平台财务人员，证据为 owner 裁定编号，不要求客户 OWNER 操作。

## Authority / 权限

- Reuses the S2-c `PlatformFinanceGrant` ([bank receipts](BILLING_BANK_RECEIPTS.md)): a **maker** drafts, a **different checker**
  approves or rejects (service check + DB CHECK `reviewedByUserId <> draftedByUserId`). Both must be ACTIVE, unscoped members of the
  Helm reserved workspace with an active grant. Customer OWNER / BILLING_ADMIN and service identities are refused
  (`platform_operation_forbidden`). This path is separate from the customer-side `createPayerAccount` / `bindScope`, which are unchanged.
- `--actor-user-id` is asserted by whoever runs the CLI on the server; the CLI does not authenticate a person. Run it only under the
  reviewed operations procedure, one person per role.

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
- **Enforce**: any step to `enforce` needs `--confirm-enforce` on both draft and approval (`platform_enforce_not_confirmed`).
  **真扣钱前另有前置（透支下限、事后结算、开拨前余额标志等，见启用方案 C 组），本命令不代表可以启用 enforce。** Switching a payer to
  `enforce` is not enablement. Rollback: draft and approve `enforce -> off` (no confirmation flag) for that workspace.
- Audit in the same transaction: `BILLING_PLATFORM_OPERATION_DRAFTED | APPLIED | REJECTED` in the reserved and the target workspace,
  plus `BILLING_PAYER_SCOPE_BOUND` or `BILLING_PAYER_MODE_CHANGED` in the target workspace.
- Idempotency: `operationKey` derives from (ruling, kind, workspace, mode step). The same request replays; the same key with other
  content refuses `platform_operation_conflict`; the same checker repeating a decision replays. Repeating a mode step already taken
  under one ruling replays it, so a second identical step needs a new ruling reference.

## Batch CLI / 批量命令

The roster is supplied by operations from the owner ruling; nothing in code names an institution.

```json
{ "evidenceRef": "owner-ruling:OWNER_RULINGS_BILLING_TO_MAIN_20261111:example",
  "entries": [{ "kind": "payer_onboard", "workspaceId": "<workspace id>", "contractSubjectRef": "<contract ref>" },
              { "kind": "billing_mode", "workspaceId": "<workspace id>", "fromMode": "off", "toMode": "enforce" }] }
```

1. Dry run (default, read-only): `npm run billing:platform-ops -- --command=draft --list-file=list.json --actor-user-id=<maker>`
   prints the list `listSha` (sha256 of the file bytes), each entry's operation key, operation state and current mode.
2. Maker: add `--apply --list-sha=<listSha>` (plus `--confirm-enforce` if any entry goes to enforce).
3. Checker: `--command=review --decision=approve|reject --review-evidence-ref=<ref>`, dry run, then `--apply --list-sha=<listSha>`.
- One transaction per entry in file order; the run stops at the first refusal and prints `stoppedAt`. Fix the cause and re-run the
  same list: committed entries replay. A different list (different sha) must be dry-run and confirmed again.
- Fields are closed; refs are ASCII (`[A-Za-z0-9._:/-]`). Output carries ids, states and closed codes only.

## Verification and rollback / 验证与回滚

- Unit `platform-operations.test.ts`; `npm run test:billing:mysql`: distinct maker/checker, non-platform and revoked identities refused,
  CAS conflict between draft and approval, replay of both steps, concurrent approvals (one applies), audit rolled back with the change,
  dry run writes nothing, wrong sha refused, stop-and-resume.
- Application rollback: stop running the CLI. Data written through it is undone by new operations (mode back to `off`, binding revoke
  by its OWNER), never by editing rows. Schema rollback `prisma/rollback/20261112_rollback_billing_platform_operations.sql` refuses while
  any operation row exists.
