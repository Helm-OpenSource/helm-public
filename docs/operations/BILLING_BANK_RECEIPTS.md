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

- `BankReceipt`: `payerAccountId`, `receivingAccountRef` (a registered receiving account, below), `bankTxnRef` kept as typed, optional `payerNameDigest` (`hmac-sha256:<hex>`
  keyed outside Core, or `ref:<opaque>`; plaintext names are refused), `amountFen` BIGINT, `currency` `CNY`, `valueDate` DATE, `state`,
  `draftedByUserId`, `reviewedByUserId`, `evidenceRef`, `reviewEvidenceRef`, `fundsTransactionId` (UNIQUE), `version`.
- DB rules: CHECK `reviewedByUserId <> draftedByUserId`; CHECK state shape; UNIQUE `(receivingAccountRef, activeBankTxnRef)` (NULL once
  rejected: one live receipt per bank transaction, re-draft only after rejection), where `activeBankTxnRef` is the **dedupe key** of
  `bankTxnRef`, not its bytes (#528 review P1-2, migration `20261112110000_billing_bank_receipt_txn_key`; CHECK holds the same
  expression, so a raw write cannot store another key); trigger allows only `drafted -> reviewed | rejected` and
  `reviewed -> posted`, keeps bank facts and drafter immutable, requires `version + 1`, refuses DELETE.
- `PlatformFinanceGrant`: `userId`, `role` (`maker` | `checker`), `state`, `grantedByUserId` (CHECK not the grantee), `evidenceRef`; one
  active grant per role and user; revoke keeps the row, DELETE refused.
- Funds (S2-a, extended): `bank_topup` is exactly debit `bank_clearing` (debit-normal) / credit wallet; no other kind touches `bank_clearing`.

## Dedupe key and receiving accounts / 流水号规范化与收款账户登记

- Bank transaction reference rule (`bankTxnKey`): the format check (`[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}`) runs first, so leading or
  trailing whitespace, inner spaces, full-width characters and other non-ASCII are refused, never trimmed. The key then upper-cases
  ASCII letters and removes the separators `-`, `_`, `.`, `:`, `/`. Digits and leading zeros are kept (`00123` and `0123` differ).
  `Txn-0001`, `TXN_0001`, `txn.0001` and `TXN0001` are one bank transaction. Statement serial numbers are expected to be letters and
  digits, with separators added by people or exports (an assumption, not verified per bank). Merging two references that truly differ only by separators or case
  can only refuse a draft (`bank_receipt_duplicate`; finance checks the statement), never post twice.
- Receiving accounts come from the server, not the drafter: `HELM_BILLING_BANK_RECEIVING_ACCOUNTS`, a plain (not confidential) JSON array of
  opaque, lowercase references to our own receiving accounts (`[a-z0-9][a-z0-9._:-]{0,63}`, e.g. `recv:bank-a-main`; never the account
  number). A draft must name one entry exactly, else `bank_receipt_account_unregistered`. Absent, malformed, or two entries that differ
  only in separators register nothing, so every draft is refused (default). Different registered accounts may each take the same bank
  reference. Changing the list is a reviewed deployment change, like the service-grant pins; the CP env-contract entry is a follow-up.

## Authority / 权限

- Platform finance = an active grant held by an ACTIVE, unscoped member of the operational Helm reserved workspace (`systemKey
  helm_reserved_primary`); leaving it stops the grant. Only its OWNER grants or revokes, never to themselves, only to its members.
- Customer OWNER / BILLING_ADMIN, other roles and service identities have no draft, review or posting path. One person may hold both
  roles but never reviews their own draft (service + CHECK).

## Service / 服务（`lib/billing/bank-receipts/bank-receipts.ts`）

- `draftBankReceipt(client, input)`: maker, then a registered receiving account (checked after the maker check, so non-makers cannot probe the list); payer must be `active`, `CNY`, `billingMode` `shadow` |
  `enforce`; a live receipt with the same receiving account and dedupe key refuses `bank_receipt_duplicate`. Audit `BILLING_BANK_RECEIPT_DRAFTED` in the reserved workspace.
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
- P1-2 adds: case and separator variants refused, unregistered or variant receiving accounts refused, distinct registered accounts
  each drafting the same reference, leading zeros kept, re-draft after rejection, the CHECK refusing a raw exact-bytes key.
- Application rollback: stop calling the service. P1-2 rollback: revert the code first, then
  `prisma/rollback/20261112_rollback_billing_bank_receipt_txn_key.sql` (refuses while any receipt or later billing migration exists;
  restores the byte-exact CHECK). Schema rollback `prisma/rollback/20261110_rollback_billing_bank_receipts.sql`
  refuses while any receipt, grant, `bank_topup` or `bank_clearing` row exists; run it before the S2-a rollback.
- Not enabled: bank-receipt HTTP routes and the finance queue UI (S6), statement import, reconciliation of `bank_clearing` against the
  bank (S5), outbox delivery. Real receiving accounts and finance rosters are enablement blockers, not code.
