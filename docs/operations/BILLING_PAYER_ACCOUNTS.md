---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No deployment approval, payment, credential or customer data.
---

# Billing payer accounts / 付款主体与范围绑定

Billing V1 slice S1-c. Payer identity only: no wallet, balance, price, charge, payment, invoice or provider call.
本片只建立付款主体身份与绑定；不产生余额、价格、扣费、收款、发票或供应商调用。

## Contract / 契约

- `PayerAccount`: `kind` (`consumer` | `enterprise_contract`), `contractSubjectRef`, optional `collectionSubjectRef`,
  `governingWorkspaceId` (required for enterprise), `currency` (`CNY` only, SQL CHECK), `billingMode`
  (`off` | `shadow` | `enforce`, **default `off`**), `status`, `version`. The existing `BillingAccount` subscription row is unchanged.
- `PayerScopeBinding`: `scopeKind` (`workspace` | `consumer_principal`), byte-exact `scopeRef`, `state` (`active` | `revoked`),
  `version`, `authorizedByUserId`, `evidenceRef`, `effectiveFrom`, `revokedAt`/`revokedByUserId`.
- At most one active binding per `(scopeKind, scopeRef)` is a database invariant: `activeScopeRef` equals `scopeRef` while active
  and is NULL once revoked (CHECK), under a UNIQUE key. Revoked rows are kept as payer history and never re-pointed.
- 每个范围同时最多一条有效绑定由数据库唯一键保证；撤销只释放有效键，原行保留，历史付款人不被改写。

## Service / 服务（`lib/billing/payer/payer-accounts.ts`）

| Function | Authority | Effect |
|---|---|---|
| `createPayerAccount` | OWNER/BILLING_ADMIN of `workspaceId` (becomes governing workspace) | enterprise payer, `billingMode=off` |
| `bindScope` | **OWNER** of **both** the payer's governing workspace and the target workspace (BILLING_ADMIN refused); `expectedPayerVersion` | one active binding, payer `version+1` |
| `revokeBinding` | **OWNER** of the governing workspace, or **OWNER** of the bound workspace (BILLING_ADMIN refused); `expectedVersion` | `revoked`, binding `version+1` |
| `resolvePayerForWorkspaceInTransaction(tx, workspaceId)` | server-side only | snapshot `{payerAccountId, bindingId, bindingVersion, billingMode, currency}` |

- Authority is the actor's current Membership row, locked `FOR UPDATE OF m`, never a caller flag. Per S0 §7 binding and
  revocation are OWNER-only; payer creation (no money effect) uses the existing billing capability (OWNER/BILLING_ADMIN).
  `actorUserId` must come from the server session. Lock order: Membership → PayerAccount → PayerScopeBinding.
- Revocation by the **bound workspace's OWNER** is that workspace declining the payer (拒付): it stops future resolution
  for that workspace only, without the payer side's consent; it does not undo history. 目标工作区 OWNER 撤销即本工作区拒绝由该付款方付费。
- Clients never supply a payer id at use time; callers persist the resolved snapshot with the operation so history stays frozen.
  The resolver locks only the binding (`FOR SHARE OF b`), so a concurrent revoke waits for the caller's commit.
  Money paths (S2/S3) must lock `PayerAccount` `FOR UPDATE` first, then resolve (resolve once unlocked to learn the id,
  lock, resolve again and require identical snapshots). Missing/foreign/case-variant scopes fail closed (`payer_unresolved`).
- Every write audits (`BILLING_PAYER_*`) in the same transaction, in each affected workspace. No automatic retry: stale versions
  return `payer_version_conflict`, a lost unique race returns `payer_scope_already_bound`.
- 客户端不传付款账户；跨工作区统账要求同一操作者同时具备两侧计费权限并留证据引用。

## Not enabled / 未启用

- `consumer` payers and `consumer_principal` bindings fail closed (`payer_kind_not_enabled`, `payer_scope_kind_not_enabled`) until a
  trusted consumer-service identity exists (later slice). No HTTP route, UI, `billingMode` change path or env switch is added.
- Finance read-only visibility, contract/collection subject master data and real activation remain separate prerequisites.

## Verification and rollback / 验证与回滚

- `npm run test:billing:mysql` (CI job `model-egress-mysql`, migrated `mysql:8.4`): DB rejects a second active binding, revoke→rebind,
  frozen snapshot, non-admin and one-sided authority refused, foreign/case-variant workspace unresolved, concurrent double-bind single winner,
  transaction rollback removes binding and audit together. Unit: `lib/billing/payer/payer-accounts.test.ts`.
- Migration `20261110120000_billing_payer_accounts` adds two tables only. Application rollback: stop calling the service (all accounts stay `off`).
  Schema rollback `prisma/rollback/20261110_rollback_billing_payer_accounts.sql` refuses while any row exists;
  **stop all writers first** (deploy code without callers / revoke write grants) so no row can appear between the check and the DROP.
