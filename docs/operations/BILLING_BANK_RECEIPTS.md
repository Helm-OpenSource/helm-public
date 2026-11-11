---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No deployment approval, payment, bank account, credential or customer data.
---

# Billing bank receipts and wallet read / 对公到账复核与钱包查询

Billing V1 slice S2-c: one platform finance person drafts a corporate bank receipt from the bank fact, another approves (posting in the
same Core transaction) or rejects it; plus a read-only wallet query. 对公到账须制单、他人复核后才入账；截图或业务声明不能增加余额。

## Model / 模型（migration `20261110170000_billing_bank_receipts`）

- `BankReceipt`: `payerAccountId`, opaque `receivingAccountRef`, byte-exact `bankTxnRef`, optional `payerNameDigest` (`hmac-sha256:<hex>`
  keyed outside Core, or `ref:<opaque>`; plaintext names are refused), `amountFen` BIGINT, `currency` `CNY`, `valueDate` DATE, `state`,
  `draftedByUserId`, `reviewedByUserId`, `evidenceRef`, `reviewEvidenceRef`, `fundsTransactionId` (UNIQUE), `version`.
- DB rules: CHECK `reviewedByUserId <> draftedByUserId`; CHECK state shape; UNIQUE `(receivingAccountRef, activeBankTxnRef)` (NULL once
  rejected: one live receipt per bank transaction, re-draft only after rejection); trigger allows only `drafted -> reviewed | rejected` and
  `reviewed -> posted`, keeps bank facts and drafter immutable, requires `version + 1`, refuses DELETE.
- `PlatformFinanceGrant`: `userId`, `role` (`maker` | `checker`), `state`, `grantedByUserId` (CHECK not the grantee), `evidenceRef`; one
  active grant per role and user; revoke keeps the row, DELETE refused.
- Funds (S2-a, extended): `bank_topup` is exactly debit `bank_clearing` (debit-normal) / credit wallet; no other kind touches `bank_clearing`.

## Authority / 权限

- Platform finance = an active grant held by an ACTIVE, unscoped member of the operational Helm reserved workspace (`systemKey
  helm_reserved_primary`); leaving it stops the grant. Only its OWNER grants or revokes, never to themselves, only to its members.
- Customer OWNER / BILLING_ADMIN, other roles and service identities have no draft, review or posting path. One person may hold both
  roles but never reviews their own draft (service + CHECK).

## Granting finance roles / 授予平台财务角色（`npm run billing:finance-grant`）

Operator CLI over `grantPlatformFinanceRole` / `revokePlatformFinanceRole` (`lib/billing/bank-receipts/finance-grant-operator.ts`);
no HTTP route. Reads by default, writes only with `--apply`; one JSON document; exit 0 ok, 1 refusal, 2 usage. The service rules
above apply unchanged (reserved-workspace OWNER only, never to themselves, only to ACTIVE unscoped members, one active grant per role
and user, AuditLog in the same transaction).

| Command | Flags |
|---|---|
| `list` | `[--user-id] [--include-revoked=true]` (read only) |
| `grant` | `--actor-user-id --user-id --role=maker\|checker --evidence-ref [--apply]`; without `--apply` prints `preflight` |
| `revoke` | `--actor-user-id --grant-id --expected-version --evidence-ref [--apply]` |

Refusals: `finance_grant_forbidden` (actor not the reserved OWNER, self-grant, grantee not an ACTIVE unscoped reserved member),
`finance_grant_exists`, `finance_grant_unavailable` (not active or version moved), `usage:*`.

Runbook / 运行手册:
1. **Read-only check first** (production included): `grant ... ` without `--apply` for each of the two finance people; `preflight`
   must show `actorIsReservedOwner: true`, `userIsReservedMember: true`, `selfGrant: false` and no `activeGrant`. If the reserved
   workspace, its OWNER or either membership is missing, stop: creating them is a separate, owner-approved step, not this tool.
2. **Grant**: the reserved workspace OWNER runs it in person, from their own login, with the owner ruling as `--evidence-ref`;
   `--actor-user-id` is declared, not authenticated, so nobody else runs it on the OWNER's behalf. Keep the JSON output.
3. **Read back**: `list`; one active grant per person and role. The maker and the checker for any two-person flow must be
   different people (the services refuse self-approval; one person may hold both roles).
4. **Offboarding**: `revoke` with the version from `list`; leaving the reserved workspace also stops a grant.

## Service / 服务（`lib/billing/bank-receipts/bank-receipts.ts`）

- `draftBankReceipt(client, input)`: maker; payer must be `active`, `CNY`, `billingMode` `shadow` | `enforce`; duplicate live bank
  transaction refuses `bank_receipt_duplicate`. Audit `BILLING_BANK_RECEIPT_DRAFTED` in the reserved workspace.
- `reviewBankReceipt(client, input)` / `reviewBankReceiptInTransaction(tx, input)`: checker, `expectedVersion`, `approve` | `reject`.
  Approve: CAS `drafted -> reviewed`, `postFundsTransactionInTransaction` (`bank_topup`, operation key `bank-receipt:<id>`), then
  `reviewed -> posted` with the funds id; journal, projection, funds audit, outbox, receipt and review audit commit or roll back together.
  Reject never posts. The same checker repeating the same decision replays; otherwise a decided receipt refuses `bank_receipt_not_pending`.
- Lock order: grant (share) -> reserved membership (share) -> `PayerAccount FOR UPDATE` -> `BankReceipt FOR UPDATE` -> funds rows.

## Wallet read / 钱包查询

- `getWalletInTransaction(tx, { workspaceId, actorUserId, cursor?, limit? })` (`lib/billing/wallet/wallet.ts`): reader must be an ACTIVE,
  unscoped OWNER / BILLING_ADMIN of the workspace (no finance-viewer role exists yet); the payer is resolved server-side from the active
  binding. Returns `availableFen` from the projection and transactions newest first as `{ id, kind, walletDeltaFen, reversalOfId,
  createdAt }`; no evidence, operation key or business data. Keyset cursor = a transaction id of the same payer; `limit` 1-100.
- `GET /api/billing/v1/wallet?limit=&cursor=`: workspace session; 401, 403 `wallet_forbidden`, 400 `wallet_query_invalid`, 404 `payer_unresolved`.

## Verification and rollback / 验证与回滚

- Unit tests plus `npm run test:billing:mysql`: grants, self-review (service and CHECK), OWNER/service refusal, concurrent double approval
  (one post), reject, duplicates, rollback on posting failure and abort, trigger immutability, wallet pagination and isolation.
- Application rollback: stop calling the service. Schema rollback `prisma/rollback/20261110_rollback_billing_bank_receipts.sql`
  refuses while any receipt, grant, `bank_topup` or `bank_clearing` row exists; run it before the S2-a rollback.
- Grant CLI: `finance-grant-operator.test.ts`; `finance-grant-operator.mysql.test.ts` in `npm run test:billing:mysql` (dry run,
  OWNER-only, self-grant, non-member and scoped member refused, audit in the same transaction, revoke). It adds no schema.
- Not enabled: bank-receipt HTTP routes and the finance queue UI (S6), statement import, reconciliation of `bank_clearing` against the
  bank (S5), outbox delivery. Real receiving accounts and finance rosters are enablement blockers, not code.
