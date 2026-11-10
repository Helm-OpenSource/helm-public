---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No deployment approval, payment, credential or customer data.
---

# Billing funds journal / 资金分录与余额投影

Billing V1 slice S2-a: a Core-local, append-only, balanced funds journal with a rebuildable projection and a durable outbox row.
No payment order, callback, bank receipt, price, reservation, charge, HTTP route or UI. 本片只提供 Core 本库资金分录原语，不接支付、不扣费、不开放接口。

## Model / 模型（migration `20261110140000_billing_funds_journal`）

- `FundsTransaction`: `kind` (`topup` | `correction`; reserve/charge arrive in S3), byte-exact `operationKey`, `contentHash` (sha256 of the
  normalized posting), `reversalOfId`, `currency` (`CNY`, CHECK), `evidenceRef`, `createdBy` (`USER:<id>` | `SYSTEM:<service>`).
  UNIQUE `(payerAccountId, operationKey)`; UNIQUE `reversalOfId` (an original is reversed at most once).
- `FundsJournalEntry`: `account` (`customer_wallet_available` | `topup_clearing` | `correction_suspense`), `direction`, `amountFen` BIGINT,
  CHECK `0 < amountFen <= 2^53-1`; one line per account per transaction.
- `FundsAccountProjection`: PK `(payerAccountId, account)`, `balanceFen`, `version`. The wallet is credit-normal (owed to the customer);
  clearing and suspense are debit-normal. CHECK: wallet balance `>= 0`.
- `BillingOutbox`: `aggregateType`, `aggregateId`, `eventType` (`funds.posted`), `payload`, `payloadHash`, `deliveredAt` NULL; UNIQUE per
  aggregate and event. No delivery worker exists yet.
- Triggers reject UPDATE and DELETE on transactions and entries. 分录不可改不可删；错账只追加引用原交易的冲正。

## Money / 金额（`lib/billing/funds/money.ts`）

- Integer fen as `bigint`; interfaces use unsigned integer decimal strings (`fenFromDecimalString` / `fenToDecimalString`): no sign, fraction,
  exponent, padding or leading zero; bound `MAX_FEN = 2^53 - 1`.
- `liToFen` (1 fen = 10 厘) and `microToFen` (1 fen = 10 000 微元) take an explicit mode: `exact` refuses a remainder; `half_up` rounds a
  remainder of at least half a fen up. No other rounding exists.

## Service / 服务（`lib/billing/funds/funds-journal.ts`）

- `postFundsTransactionInTransaction(tx, input)`: transaction + entries + projections + AuditLog (governing workspace) + outbox in the caller's
  transaction. `reverseFundsTransactionInTransaction(tx, input)`: appends a `correction` mirroring the original with `reversalOfId`.
  `recomputeFundsProjection(tx, payerAccountId)`: rebuilds balances from entries, reports drift and unbalanced transactions; never repairs.
- Lock order (S1-c): `PayerAccount FOR UPDATE` first, then `FundsTransaction`, then projections in ascending account order; reads after the
  lock are locking reads so a REPEATABLE READ snapshot cannot hide a committed posting.
- Validation: 2–3 distinct accounts, positive bounded bigint amounts, Σdebit = Σcredit (`funds_unbalanced`). `topup` is exactly debit
  `topup_clearing` / credit wallet; a free `correction` uses only the wallet and `correction_suspense` (`funds_accounts_not_allowed`).
- Payer gate: locked row `active`, `CNY`, with a governing workspace (`payer_account_unavailable`); `billingMode` `shadow` or `enforce`,
  `off` refuses `payer_billing_off` (S2-a decision).
- Idempotency: same key and content returns the original rows (`replayed: true`, no new audit/outbox), even if the payer changed state since;
  same key with other content refuses `funds_operation_conflict`. Unknown execution retries the same key.
- Projection: version CAS plus the non-negative guard in the UPDATE's own WHERE (`funds_insufficient`, `funds_projection_conflict`); the
  CHECK is the final guard. Refusals throw `FundsRefusal` so the whole caller transaction rolls back; no automatic retry.
- It does **not** authorize people: S2-b (verified payment) / S2-c (maker/checker receipt) prove authority and pass a server-derived `actor`.

## Verification and rollback / 验证与回滚

- Unit: `lib/billing/funds/money.test.ts`, `funds-journal.test.ts`. `npm run test:billing:mysql` (CI job `model-egress-mysql`, `mysql:8.4`):
  balanced posting with audit/outbox, unbalanced and off/suspended/unknown payers, replay and conflicting content, two connections
  overdrawing (one wins), rollback leaves no rows, 40 random postings recompute equal plus injected drift, reversal, and DB triggers/UNIQUE/CHECK.
- Application rollback: stop calling the service (accounts stay `off`). Schema rollback `prisma/rollback/20261110_rollback_billing_funds_journal.sql`
  refuses while any journal, projection or outbox row exists; **stop all writers first**. A journal holding money is never dropped.
- Not enabled: wallet query API, payment/receipt entry points, outbox delivery, drift alerting, consumer payers.
