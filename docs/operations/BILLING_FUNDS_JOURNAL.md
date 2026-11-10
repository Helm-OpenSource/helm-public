---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No deployment approval, payment, credential or customer data.
---

# Billing funds journal / 资金分录与余额投影

Billing V1 slice S2-a: Core-local, append-only, balanced funds journal, rebuildable projection and durable outbox. No payment, charge,
route or UI. 本片只提供 Core 本库资金分录原语，不接支付、不扣费、不开放接口。

## Model / 模型（migration `20261110140000_billing_funds_journal`）

- `FundsTransaction`: `kind` (`topup` | `correction` | `bank_topup` (S2-c) | `charge` (S3-b2 settle)), byte-exact `operationKey`, `contentHash` (sha256 of the normalized
  posting), `reversalOfId`, `currency` (`CNY`), `evidenceRef`, `createdBy` (`USER:<id>` | `SYSTEM:<service>`). UNIQUE `(payerAccountId,
  operationKey)` and UNIQUE `reversalOfId` (one reversal per original).
- `FundsJournalEntry`: `account` (`customer_wallet_available` | `topup_clearing` | `correction_suspense` | `bank_clearing` | `charge_revenue`), `direction`, `amountFen` BIGINT
  (CHECK `0 < amountFen <= 2^53-1`); one line per account per transaction. Triggers reject UPDATE/DELETE on both tables. 分录不可改不可删，错账只追加冲正。
- `FundsAccountProjection` PK `(payerAccountId, account)`, `balanceFen`, `version`: wallet credit-normal (owed to the customer), clearing and
  suspense debit-normal; CHECK wallet `>= 0`. `BillingOutbox` (`funds.posted`, `payloadHash`, `deliveredAt` NULL): no delivery worker yet.

## Money / 金额（`lib/billing/funds/money.ts`）

- `fenFromDecimalString` / `fenToDecimalString`: unsigned integer fen strings, no sign, fraction, exponent, padding or leading zero, `MAX_FEN`.
  `liToFen` (1 fen = 10 厘) and `microToFen` (1 fen = 10 000 微元): `exact` refuses a remainder; `half_up` is the only rounding.

## Service / 服务（`lib/billing/funds/funds-journal.ts`）

- `postFundsTransactionInTransaction(tx, input)`: transaction + entries + projections + AuditLog (governing workspace) + outbox in the caller's
  transaction. `reverseFundsTransactionInTransaction(tx, input)`: appends a `correction` mirroring the original with `reversalOfId`.
  `recomputeFundsProjection(tx, payerAccountId)`: rebuilds balances from entries, reports drift and unbalanced transactions; never repairs.
- Lock order (S1-c): `PayerAccount FOR UPDATE`, then `FundsTransaction`, then projections by ascending account; later reads are locking reads.
- Validation: 2–5 distinct accounts, positive bounded bigint amounts, Σdebit = Σcredit (`funds_unbalanced`). `topup` is exactly debit
  `topup_clearing` / credit wallet; a free `correction` uses only the wallet and `correction_suspense`; a `charge` is exactly debit wallet / credit
  credit-normal `charge_revenue`, needs a `charge:` key (reserved for it) and cannot be reversed (no refunds in V1); it is
  the one kind admitted for a suspended or off payer, because it settles already-held work (protocol v3.5). Later billing
  migrations block this slice's rollback.
- Payer gate: locked row `active`, `CNY`, with a governing workspace (`payer_account_unavailable`); `billingMode` `shadow` or `enforce`,
  `off` refuses `payer_billing_off` (S2-a decision).
- Idempotency: same key and content returns the original rows (`replayed: true`, no new audit/outbox), even if the payer changed state since;
  same key with other content refuses `funds_operation_conflict`. Unknown execution retries the same key.
- Projection: version CAS plus the non-negative guard in the UPDATE's own WHERE (`funds_insufficient`, `funds_projection_conflict`); the
  CHECK is the final guard. Refusals throw `FundsRefusal` so the whole caller transaction rolls back; no automatic retry.
- It does **not** authorize people: S2-b (verified payment) / S2-c (maker/checker receipt) prove authority and pass a server-derived `actor`.

## Verification and rollback / 验证与回滚

- Unit `lib/billing/funds/*.test.ts`; `npm run test:billing:mysql` (CI job `model-egress-mysql`, `mysql:8.4`) covers the rules above, two-connection
  overdraw, rollback, 40-posting recompute with injected drift and reversal.
- Application rollback: stop calling the service (accounts stay `off`). Schema rollback `prisma/rollback/20261110_rollback_billing_funds_journal.sql`
  refuses while any journal, projection or outbox row exists; **stop all writers first**. A journal holding money is never dropped.
- Not enabled: wallet query API, payment/receipt entry points, outbox delivery, drift alerting, consumer payers.
