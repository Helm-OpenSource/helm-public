---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No deployment approval, payment, merchant credential or customer data.
---

# Billing wallet top-up orders / 钱包充值订单与支付核验

Billing V1 slice S2-b: server-created `wallet_topup` orders and one private verification entry shared by provider callbacks and active
queries. No route, UI, real provider call or merchant credential; legacy subscription notify routes are unchanged. 本片不接真实商户。

## Model / 模型（migration `20261110160000_billing_topup_orders`）

- `PaymentOrder`: persisted `orderType` ENUM with the single value `wallet_topup` (a subscription order can never be read as a top-up),
  `provider`, UNIQUE byte-exact `providerOrderNo` (`tpw_`/`tpa_` + 28 hex, never legacy `helm_wx_`/`helm_ali_`), `amountFen` BIGINT, `CNY`,
  opaque `merchantRef`/`appRef` (server config refs, never secrets), `state`, `version`, `expiresAt`, `createdBy`, payer/binding snapshot.
- `VerifiedPayment`: UNIQUE `(provider, providerTxnId)`, `paymentOrderId` and `fundsTransactionId`; `source`, `lateAfterClose`; immutable by trigger.

## Service / 服务（`lib/billing/topup/`）

- `createTopupOrder`: OWNER or BILLING_ADMIN (`topup_forbidden`); payer resolved server-side; `billingMode` `shadow`|`enforce`
  (`topup_billing_off`); 100 – 5 000 000 fen (provisional). `lockBillingAuthority` now requires an explicit role rule.
- Trust: only `defineTopupProviderAdapter(provider, io)` mints observations (frozen, registered in a module-private WeakSet); anything else
  is `topup_observation_untrusted`. `io.verifyCallback` authenticates the raw notify itself and throws on failure (`topup_signature_invalid`);
  no caller-supplied trust flag exists. Public entries: `verifyTopupCallback(client, adapter, request)` and
  `verifyTopupByQuery(client, adapter, paymentOrderId)` (re-queries the original order number). Provider IO runs outside the transaction.
- Checks: order exists and is `wallet_topup`, provider, merchant and app ref; for `paid`, exact currency and amount, txn not bound to another
  order (`topup_txn_conflict`), no other txn for this order. Success in one transaction: order CAS -> `paid_verified`, `VerifiedPayment`,
  `topup` funds transaction (`topup:<provider>:<providerTxnId>`), audit `BILLING_TOPUP_VERIFIED`, outbox `topup.verified`.
- Lock order `PayerAccount` -> `PaymentOrder` -> `VerifiedPayment` -> funds journal. Duplicate callbacks and callback/query race losers replay.
- Non-paid: `not_paid` `created`->`pending`; `unknown` (any unlisted status) -> `unknown`; `closed` -> `closed_unpaid`; nothing by time.
- **Late success**: a verified success after `closed_unpaid` credits exactly once, flagged `lateAfterClose`. 关单后迟到成功仍只入账一次并打标。
- **Payment exceptions** (outbox `aggregateType=PaymentException`, `eventType=payment_exception`, plus audit `BILLING_TOPUP_PAYMENT_EXCEPTION`;
  idempotent per `reason:provider:txn`; never a balance change): `paid_then_closed` / `paid_then_unknown` (e.g. REFUND) for a credited order,
  in the same transaction; `order_paid_by_other_txn`, `payer_billing_off`, `amount_mismatch`, `currency_mismatch` in a separate transaction
  after the credit rolls back. A billing-off payment is credited by a later retry/query once the payer is re-enabled.
- Write conflicts (P2034, MySQL 1213, same-key insert) retry up to 3 times, then `funds_write_conflict`.

## Verification and rollback / 验证与回滚

- Unit `topup-orders.test.ts`; `npm run test:billing:mysql` (CI `mysql:8.4`) with a synthetic HMAC adapter covers the rules above,
  concurrent callback/query and concurrent txns for one order, refund news, late success, rollback, legacy orders and DB immutability.
- Application rollback: stop calling the service. Schema rollback `prisma/rollback/20261110_rollback_billing_topup_orders.sql` refuses while
  any row exists; roll it back before the funds journal. Not enabled: routes, real adapters (existing query helpers drop amount fields).
