---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No deployment approval, payment, merchant credential or customer data.
---

# Billing wallet top-up orders / 钱包充值订单与支付核验

Billing V1 slice S2-b: server-created `wallet_topup` orders and one private verification entry shared by provider callbacks and active
queries. No route, UI, real provider call or merchant credential (S2-d1 adds the Alipay adapter and notify entry below); legacy subscription notify routes are unchanged. 本片不接真实商户。

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
  in the same transaction; `unknown_before_credit` (e.g. refund news reaching an uncredited order; the record survives a later credit),
  in the same transaction as the state change; `order_paid_by_other_txn`, `payer_billing_off`, `amount_mismatch`, `currency_mismatch` in
  a separate transaction after the credit rolls back; `observation_invalid` (an authenticated, merchant/app-matched `paid` report that
  cannot be parsed, e.g. no txn id or a malformed amount) on its own transaction, keyed by the order number. A billing-off payment is credited by a later retry/query once the payer is re-enabled.
- Write conflicts (P2034, MySQL 1213, same-key insert) retry up to 3 times, then `funds_write_conflict`.

## Alipay adapter and notify entry / 支付宝适配器与充值通知入口（S2-d1）

`lib/billing/topup/alipay-topup.ts`, route `POST /api/billing/v1/topup-notify/alipay`. Separate from the legacy subscription
notify route (`/api/billing/alipay/notify`, unchanged): top-up orders are created (S2-d2) with this `notify_url` and without
`passback_params`. 与旧订阅通知入口分开；订阅单号（`helm_ali_`）在开事务前即被拒。

- **Gate**: `HELM_BILLING_TOPUP_ALIPAY_ENABLED` (capability `billing_topup_alipay`) and `financial_action`; either set to `false`
  answers a plain 404 before reading the body or the database. **On by default** since 2026-11-12 (owner: the payment entry is a public
  collection interface and should collect by default). 充值开关缺省打开；前提是商户配置齐全，否则一律失败即关闭。
- **Config** (environment only): existing `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY` (secret), `ALIPAY_PUBLIC_KEY`, `ALIPAY_GATEWAY_URL`
  (https only) and the new non-secret `HELM_BILLING_TOPUP_ALIPAY_SELLER_ID`. One decision, `resolveAlipayTopup(entry)`, serves every
  entry: any key missing, an identifier malformed, a key that does not parse as PEM, or a non-https gateway closes the entry
  (notify `503 fail`, never credited; order creation in S2-d2 answers `topup_unavailable`) and logs one
  `{"event":"topup_unavailable","reason":"config_unavailable","entry",problems:[fixed codes]}` alert, never a value. Only the configured
  seller + app pair maps to `merchantRef=alipay-seller:<id>` / `appRef=alipay-app:<id>`; anything else is `topup_merchant_mismatch`.
- **Notify**: `application/x-www-form-urlencoded`, at most 16 KiB (declared and streamed), raw bytes strict UTF-8 (percent-decoded
  values are not re-checked; they are covered by the signature), no duplicate names,
  `sign_type=RSA2`, RSA2 signature over every parameter but `sign`/`sign_type` (`buildAlipaySignContent`), `charset` utf-8 if present.
  Unknown fields are signed, accepted and ignored. Empty values are outside the signature and are dropped after verification;
  `trade_status` must then be present (signed return-page parameters are refused). `total_amount` is converted with `yuanToFenExact`. A notify carrying refund fields
  (`refund_fee` > 0, `gmt_refund`, `out_biz_no`) maps to `unknown` even if it says `TRADE_SUCCESS`: never a first credit; for a credited
  order it is a `paid_then_unknown` exception, for an uncredited one `unknown_before_credit`. No time window: late success must credit and replays are idempotent per trade.
- **Answer**: `success` when credited, replayed, a state recorded, or a payment exception persisted (amount/currency mismatch, order paid
  by another trade, unparseable paid report); `fail` otherwise so Alipay retries: 400 (signature, form, unknown or non-top-up order, merchant/app mismatch,
  txn conflict), 503 (payer billing off, write conflict, database), 500 (unexpected). Logs carry a fixed reason code only.
- **Query** (`createAlipayTopupAdapter(config).queryOrder`, for `verifyTopupByQuery`): `alipay.trade.query` signed by the configured app,
  10 s timeout, redirects refused; the raw `alipay_trade_query_response` text is RSA2-verified before it is parsed and keeps `total_amount`. Identity is the
  querying app (its seller unless the response names another). `ACQ.TRADE_NOT_EXIST` is `not_paid`; other errors throw (order unchanged).
  The session-triggered query route and order creation are S2-d2.
- **Verify / rollback**: `alipay-topup.test.ts` (per-run RSA keys, in-process gateway double) and `alipay-topup.mysql.test.ts` in
  `npm run test:billing:mysql` (forged signature, app/seller mismatch, subscription order number, amount mismatch, duplicate notify,
  concurrent notify and query, late success after close, refund news, billing off, gate off). Roll back: set the gate to `false`; no migration.

## Verification and rollback / 验证与回滚

- Unit `topup-orders.test.ts`; `npm run test:billing:mysql` (CI `mysql:8.4`) with a synthetic HMAC adapter covers the rules above,
  concurrent callback/query and concurrent txns for one order, refund news, late success, rollback, legacy orders and DB immutability.
- Application rollback: stop calling the service. Schema rollback `prisma/rollback/20261110_rollback_billing_topup_orders.sql` refuses while
  any row exists; roll it back before the funds journal. Not enabled: order creation and query routes (S2-d2); the legacy query helpers drop amount fields and are not used.
