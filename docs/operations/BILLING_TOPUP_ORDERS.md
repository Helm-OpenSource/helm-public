---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No deployment approval, payment, merchant credential or customer data.
---

# Billing wallet top-up orders / 钱包充值订单与支付核验

Billing V1 slice S2-b: server-created `wallet_topup` orders and one verification entry shared by provider callbacks and active queries.
No route, UI, provider call or merchant credential. 本片只提供订单与核验原语；不接真实商户、不改旧订阅回调。

## Model / 模型（migration `20261110160000_billing_topup_orders`）

- `PaymentOrder`: persisted `orderType` ENUM with the single value `wallet_topup` (legacy subscription orders live elsewhere and can
  never be read as a top-up), `provider` (`wechat_pay` | `alipay`), UNIQUE byte-exact `providerOrderNo` (`tpw_`/`tpa_` + 28 hex, never the
  legacy `helm_wx_`/`helm_ali_`), `amountFen` BIGINT, `CNY`, opaque `merchantRef`/`appRef` (server config refs, never secrets),
  `state`, `version`, `expiresAt`, `createdBy`, plus the `payerAccountId`/`payerBindingId` snapshot it was created under.
- `VerifiedPayment`: UNIQUE `(provider, providerTxnId)`, UNIQUE `paymentOrderId`, UNIQUE `fundsTransactionId`, `source` (`callback` |
  `query`), `lateAfterClose`. Triggers reject UPDATE/DELETE.

## Service / 服务（`lib/billing/topup/`）

- `createTopupOrder(client, input)`: OWNER or BILLING_ADMIN of the workspace (`topup_forbidden`); payer resolved server-side by
  `resolvePayerForWorkspaceInTransaction`; `billingMode` must be `shadow` or `enforce` (`topup_billing_off`); amount 100 – 5 000 000 fen
  (provisional bounds, `topup_amount_out_of_range`); merchant/app refs come from server config, not the client.
- `verifyTopupPaymentInTransaction(tx, { provider, observed })` is the **only** entry; `verifyTopupCallback` and `verifyTopupByQuery`
  call the injected `TopupProviderAdapter` outside the transaction and then this entry with `runFundsTransactionWithRetry`.
- Checks, in order: signature flag set by the adapter (`topup_signature_invalid`, before any read), order exists (`topup_order_unknown`)
  and is `wallet_topup`, provider, merchant **and** app ref, then for `paid`: currency and amount exact, provider txn unused by another
  order (`topup_txn_conflict`), no other txn for this order (`topup_order_paid_by_other_txn`).
- On success, in one Core transaction: order -> `paid_verified` (version CAS), `VerifiedPayment`, `FundsTransaction` kind `topup` with
  operationKey `topup:<provider>:<providerTxnId>`, AuditLog `BILLING_TOPUP_VERIFIED`, outbox `topup.verified`. Any refusal rolls all back.
- Lock order: `PayerAccount FOR UPDATE` -> `PaymentOrder FOR UPDATE` -> `VerifiedPayment` -> funds journal (S2-a). Duplicate callbacks and
  the loser of a callback/query race replay (`outcome: "replayed"`), never a second credit.
- Non-paid observations: `not_paid` moves `created` -> `pending`; `unknown` (including WeChat `REFUND` and any unlisted status) parks the
  order in `unknown`; `closed` (provider confirms closed unpaid) -> `closed_unpaid`. Nothing changes state by time; a paid order never moves back.
- **Late success decision**: a verified success for an order already `closed_unpaid` still credits exactly once (the money arrived) and is
  flagged `lateAfterClose` in the payment, audit and outbox for reconciliation. 关单后迟到的已核验成功仍只入账一次并打标记。
- A payer switched to `off` after ordering refuses `payer_billing_off`; the order stays unverified and is re-verified by retry or query.
- Write conflicts: Prisma P2034, MySQL 1213 deadlocks and same-key insert races retry up to 3 times, then refuse `funds_write_conflict`.

## Provider adapter / 支付渠道适配

- `provider-observation.ts` maps a WeChat Pay v3 transaction (`amount.total` fen) or Alipay trade (`total_amount` yuan, exact two-place
  parse, absent `trans_currency` = CNY) into `ObservedPayment`; merchant/app ids map to refs through a server lookup.
- Production callbacks wrap `verifyWeChatPayNotifySignature` + `decryptWeChatPayNotifyPayload` / `verifyAlipayNotifyPayload`. The existing
  query helpers drop amount and merchant fields, so an amount-returning query adapter is a later slice. Existing subscription notify routes
  are unchanged; they may dispatch `isTopupProviderOrderNo` orders here once wired.

## Verification and rollback / 验证与回滚

- Unit `lib/billing/topup/topup-orders.test.ts`; `npm run test:billing:mysql` (CI `mysql:8.4`) with a synthetic HMAC adapter covers forged
  signature, wrong merchant/app/amount/currency/provider, duplicate callback, concurrent callback/query, unknown/unpaid states, late
  success, legacy order and reused txn refusal, rollback and DB immutability.
- Application rollback: stop calling the service. Schema rollback `prisma/rollback/20261110_rollback_billing_topup_orders.sql` refuses while
  any order or payment row exists; roll it back before the funds journal.
- Not enabled: routes, real adapters, order expiry closing via provider, exception queue for refused paid observations, consumer payers.
