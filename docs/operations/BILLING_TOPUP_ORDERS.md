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
  (`topup_billing_off`); amount rule `checkTopupAmountFen` (see S2-d2a below). `lockBillingAuthority` now requires an explicit role rule.
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
  Since 2026-11-12 (#528 review P2-2) a **callback** "paid" for an order in `closed_unpaid` or `unknown` never credits by itself
  (`topup_query_required`): `verifyTopupCallback` re-queries the provider (outside any transaction) and the query's own status decides:
  paid credits once; closed (e.g. refunded in full) credits nothing and keeps a `paid_callback_closed` exception, then acknowledges;
  anything else (`not_paid`, unknown, no trade) is `topup_query_unconfirmed`, not acknowledged; a failed query fails the notify too.
  Both unsettled cases first keep one `paid_callback_unconfirmed` exception per order, so they stay visible after Alipay stops retrying.
- **Received amount**: once any report recorded an `amount_mismatch` for an order, no later report credits it (a refresh query that
  omits `receipt_amount` included); the record is the case a person settles.
  Not closed: a partial refund still queries as the original `TRADE_SUCCESS` amount (Q5, reconciliation via the refund record below).
- **Payment exceptions** (outbox `aggregateType=PaymentException`, `eventType=payment_exception`, plus audit `BILLING_TOPUP_PAYMENT_EXCEPTION`;
  idempotent per key — `reason:provider:txn`; `reason:provider:<order number>` for `observation_invalid` and `paid_callback_*`; and for
  `paid_then_*` / `unknown_before_credit` `reason:provider:<order number>:<refund batch>` when the report names a batch (one record
  per refund), else per order; never a balance change; refund amount (fen), batch and time travel
  in `refund` when the provider sent them): `paid_then_closed` / `paid_then_unknown` (e.g. REFUND) for a credited order,
  in the same transaction; `unknown_before_credit` (e.g. refund news reaching an uncredited order; the record survives a later credit),
  in the same transaction as the state change; `order_paid_by_other_txn`, `payer_billing_off`, `amount_mismatch`, `currency_mismatch` in
  a separate transaction after the credit rolls back; `observation_invalid` (an authenticated, merchant/app-matched `paid` report that
  cannot be parsed, e.g. no txn id or a malformed amount) on its own transaction, then refused as `topup_observation_recorded` (not
  handled, so the provider retries; contract P2-A option 甲). A billing-off payment is credited by a later retry/query once the payer is re-enabled.
- **Who handles them / 谁处理**: platform finance (owner 2026-11-12 10:08: finance prepares, the responsible person reviews) runs
  `npm run billing:topup-exceptions -- list` daily while top-up is open. "Unhandled" = `deliveredAt IS NULL` on the PaymentException
  outbox row (no dispatcher reads these rows; if one is added, this marker must move). After reconciling against the merchant
  console: `ack --key --actor-user-id --note --apply` (sets `deliveredAt`, audit `BILLING_TOPUP_PAYMENT_EXCEPTION_HANDLED`). For an
  order a notify could not settle (e.g. `observation_invalid` after a parser fix, or older than the 72 h session window):
  `reverify --order-id --actor-user-id --apply` re-queries the order's provider through the verification entry (credits at most once;
  audit `BILLING_TOPUP_REVERIFY`). Without `--apply` both only show. The actor must be the order workspace's OWNER/BILLING_ADMIN or
  hold an active platform finance role (maker or checker); anyone else is `actor_forbidden`. `list` also reports `unhandledTotal`.
- **Operating rule (owner 2026-11-12) / 运营规则**: an uncredited top-up order is **never refunded in the merchant console first** —
  run `reverify` first. A paid notify that is retried after a refund made behind the system's back would otherwise credit in full.
- **Before real collection (sandbox, owner authorization)**: confirm the actual shape of `receipt_amount` in `alipay.trade.query`
  answers (string, absent, or `"0.00"`): absent lets a query credit without the received-amount check (guarded only by an earlier
  `amount_mismatch` record), `"0.00"` would refuse every query credit.
- Write conflicts (P2034, MySQL 1213, same-key insert) retry up to 3 times, then `funds_write_conflict`.

## Alipay adapter and notify entry / 支付宝适配器与充值通知入口（S2-d1）

`lib/billing/topup/alipay-topup.ts`, route `POST /api/billing/v1/topup-notify/alipay`. Separate from the legacy subscription
notify route (`/api/billing/alipay/notify`, unchanged): top-up orders are created (S2-d2) with this `notify_url` and without
`passback_params`. 与旧订阅通知入口分开；订阅单号（`helm_ali_`）在开事务前即被拒。

- **Gate**: `HELM_BILLING_TOPUP_ALIPAY_ENABLED` (capability `billing_topup_alipay`) and `financial_action`; either set to `false`
  answers a plain 404 before reading the body or the database. **On by default** since 2026-11-12 (owner: the payment entry is a public
  collection interface and should collect by default). 充值开关缺省打开；前提是商户配置齐全，否则一律失败即关闭。
- **Config** (environment only): existing `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY` (secret), `ALIPAY_PUBLIC_KEY`, `ALIPAY_GATEWAY_URL`
  (https only) and the new non-confidential `HELM_BILLING_TOPUP_ALIPAY_SELLER_ID`. One decision, `resolveAlipayTopup(entry)`, serves every
  entry: any key missing, an identifier malformed, a key that does not parse as PEM, or a non-https gateway closes the entry
  (notify `503 fail`, never credited; order creation in S2-d2 answers `topup_unavailable`) and logs one
  `{"event":"topup_unavailable","reason":"config_unavailable","entry",problems:[fixed codes]}` alert, never a value. Only the configured
  seller + app pair maps to `merchantRef=alipay-seller:<id>` / `appRef=alipay-app:<id>`; anything else is `topup_merchant_mismatch`.
- **Notify**: `application/x-www-form-urlencoded`, at most 16 KiB (declared and streamed), raw bytes strict UTF-8 (percent-decoded
  values are not re-checked; they are covered by the signature), no duplicate names,
  `sign_type=RSA2`, RSA2 signature over every parameter but `sign`/`sign_type` (`buildAlipaySignContent`), `charset` utf-8 if present.
  Unknown fields are signed, accepted and ignored. Empty values are outside the signature and are dropped after verification;
  `trade_status` must then be present (signed return-page parameters are refused). `total_amount` is converted with `yuanToFenExact`; a `receipt_amount` (notify or query) that differs from it becomes the observed
  amount (owner 2026-11-12: no merchant discounts, credit the order amount only), so it is an `amount_mismatch` exception, never a credit. A notify carrying refund fields
  (`refund_fee` > 0, `gmt_refund`, `out_biz_no`) maps to `unknown` even if it says `TRADE_SUCCESS`: never a first credit; for a credited
  order it is a `paid_then_unknown` exception, for an uncredited one `unknown_before_credit`. No time window: late success must credit and replays are idempotent per trade.
- **Answer**: `success` when credited, replayed, a state recorded, or a payment exception persisted where a retry cannot help (amount/currency
  mismatch, order paid by another trade); `fail` otherwise so Alipay retries: 400 (signature, form, unknown or non-top-up order, merchant/app mismatch,
  txn conflict, unparseable paid report — kept once, log code `topup_observation_recorded`, or not locatable, `topup_observation_invalid`),
  503 (payer billing off, write conflict, database), 500 (unexpected, including a failed confirming query). Logs carry a fixed reason code only.
- **Query** (`createAlipayTopupAdapter(config).queryOrder`, for `verifyTopupByQuery`): `alipay.trade.query` signed by the configured app,
  10 s timeout, redirects refused; the raw `alipay_trade_query_response` text is RSA2-verified before it is parsed and keeps `total_amount`. Identity is the
  querying app (its seller unless the response names another). `ACQ.TRADE_NOT_EXIST` is `not_paid`; other errors throw (order unchanged).
  The session-triggered query route and order creation: see S2-d2a/d2b below.
- **Verify / rollback**: `alipay-topup.test.ts` (per-run RSA keys, in-process gateway double) and `alipay-topup.mysql.test.ts` in
  `npm run test:billing:mysql` (forged signature, app/seller mismatch, subscription order number, amount mismatch, duplicate notify,
  concurrent notify and query, late success after close, refund news, billing off, gate off). Roll back: set the gate to `false`; no migration.

## Order creation and cashier URL / 建单与支付链接（S2-d2a）

Route `POST /api/billing/v1/topup-orders` (`app/api/billing/v1/topup-orders/route.ts`), migration
`20261112120000_billing_topup_order_idempotency` (rollback `prisma/rollback/20261112_rollback_billing_topup_order_idempotency.sql`).

- **Gate**: the same `resolveAlipayTopup("create")` as the notify entry, plus `APP_URL` must be an https origin on the default port
  (`topupAppOrigin`); off → 404, incomplete → `503 {"error":"topup_unavailable"}` (充值暂不可用) and one alert. Nothing is created.
- **Request**: session required (401); header `Idempotency-Key` (8–128 of `[A-Za-z0-9._:-]`, 400 without it); JSON body
  `{"provider":"alipay","amountFen":"<integer string>"}`, anything else in the body is ignored. `wechat_pay` answers
  `topup_provider_unavailable` until its adapter lands. Workspace, payer, merchant/app refs and the order number are server-side.
- **Rules** (`createOrReplayTopupOrder`, one transaction after the creator's membership row lock): OWNER/BILLING_ADMIN (403), payer
  bound and `shadow|enforce` (409 `topup_billing_off`); amount (`checkTopupAmountFen`, the one rule for every provider, owner
  2026-11-12 11:24 「100 的整倍数，上不封顶」): whole multiples of 100 yuan (400 `topup_amount_not_multiple`), at least 100 yuan and no
  business cap — only Alipay's documented 100 000 000 yuan maximum as a technical bound (400 `topup_amount_out_of_range`); the same key with the same request replays the order (200,
  `replayed: true`), with a different request 409 `topup_idempotency_conflict`; per creator and workspace at most 5 open unpaid orders and
  5 creations a minute (429 `topup_rate_limited`). The transaction runs at READ COMMITTED (no gap locks, so different creators'
  first orders do not deadlock; needs ROW binlog like reservations); the creator's membership row lock serializes one creator and the
  reads after it see the latest commit. An unexpected failure answers 500 and logs one fixed-code `create_failed` event.
- **Cashier URL** (`buildAlipayTopupPayUrl`, built, never sent by the server): signed `alipay.trade.page.pay` GET URL with
  `notify_url = APP_URL + /api/billing/v1/topup-notify/alipay`, `return_url = APP_URL + /billing/topup?order=<order id>`,
  `product_code=FAST_INSTANT_TRADE_PAY`, `total_amount` formatted exactly from fen, fixed `subject`, `time_expire` = order expiry
  (Beijing time), and **no `passback_params`**. Returned only while the order is `created|pending` and unexpired.
- **Legacy guard**: the subscription notify route `/api/billing/alipay/notify` answers `400 fail` for any verified `tpa_`/`tpw_`
  `out_trade_no` before recording a callback event or resolving a workspace (no write). 旧订阅入口拒绝充值单号。The WeChat Pay
  subscription route gets the same guard in the WeChat d2 slice.

## Order status, refresh and close / 订单状态、主动查单与关单（S2-d2b）

Routes under `app/api/billing/v1/topup-orders/[id]/` (shared session handling `lib/billing/topup/topup-order-http.ts`), migration
`20261112130000_billing_topup_order_query_throttle` (rollback `prisma/rollback/20261112_rollback_billing_topup_order_query_throttle.sql`).
Only an order of the session's workspace, for its OWNER/BILLING_ADMIN (403); any other id is `404 topup_order_unknown`.

- `GET /{id}`: the order (id, provider, state, amount in fen, expiry, creation). Read-only; needs the gates only (404 when off).
- `POST /{id}/verify` (「刷新状态」): `alipay.trade.query` for the order's original number through `verifyTopupByQuery` (credits once if
  paid). `claimTopupOrderQuery` throttles per order: 10 s apart, 30 per hour window (429 `topup_rate_limited`), and only for
  `created|pending|unknown|closed_unpaid` orders up to 72 h old; a credited, older or non-queryable order is returned as is
  (`queried: false`). A provider or verification failure leaves the order unchanged and is reported as `queryError` (fixed code).
- `POST /{id}/close`: for `created|pending` only (409 `topup_order_not_closable`). Calls `alipay.trade.close` (signed, response node
  verified), then runs the same query: the order becomes `closed_unpaid` only when Alipay reports `TRADE_CLOSED`. `close` is
  `closed`, `not_created` (`ACQ.TRADE_NOT_EXIST`: the cashier was never submitted; the order stays open until it expires) or
  `close_failed`. A success arriving after close still credits once (`lateAfterClose`).
- Provider dispatch: an order is only ever sent to its own provider; another provider's order answers 409
  `topup_provider_mismatch` before any throttle write or provider call (WeChat Pay orders wait for the WeChat slice).
- Config: same `resolveAlipayTopup("query")` decision, checked after the session (unsigned requests log nothing); incomplete →
  `503 topup_unavailable`. Alipay is called only on these explicit
  user actions, never by a timer.

## Top-up page / 充值页（S2-d3）

`app/(workspace)/billing/topup/page.tsx` + `features/billing/topup-panel.tsx`; helpers `lib/billing/topup/topup-page.ts`.
`/billing` is a workspace page prefix, so an unsigned browser (e.g. opened by the seat desktop client) signs in first.

- 404 while the gates are off. Merchant configuration incomplete: the Alipay entry shows 充值暂不可用 (no order is attempted).
  Members without OWNER/BILLING_ADMIN see who can top up instead of the form.
- Amount: presets 100 / 500 / 1 000 / 5 000 yuan or typed (exact yuan → fen, no floating point), whole multiples of 100 yuan only
  (owner 2026-11-12, same rule as `checkTopupAmountFen`); prefilled from the server-issued `suggestedFen` rounded **up** to the next
  whole 100 yuan (integer; only a prefill, never an authority). The panel sends only
  `{provider:"alipay", amountFen}` with one `Idempotency-Key` per amount, then opens the returned cashier URL.
- WeChat Pay has a reserved, disabled slot on the same page (即将开通) until its slice wires it.
- If the per-amount key replays an order that can no longer be paid (paid, closed or expired), the panel says so and the next click
  uses a new key (a new order).
- Return: Alipay returns to `/billing/topup?order=<order id>`; the page shows that order of the session workspace read-only and
  「刷新状态」 calls `POST /{id}/verify`. Nothing in the return URL is ever a credit.
- Client URL rule (contract S2D §10.3 as ruled by the owner 2026-11-12): `buildTopUpUrl(APP_URL origin, suggestedFen?)` and the
  reference check `isOpenableTopUpUrl` — https, port 443, the login host or an exact allow-listed host, no user name or password; **no path check**.

## WeChat Pay adapter and notify entry / 微信支付适配器与充值通知入口（S2-w1）

`lib/billing/topup/wechatpay-topup.ts`, route `POST /api/billing/v1/topup-notify/wechatpay`. Separate from the legacy subscription
notify route (`/api/billing/wechat-pay/notify`, unchanged). The answer policy (which refusals are acknowledged, which are retried) is
shared with Alipay in `notify-entry.ts`; only the wire format differs. 与旧订阅通知入口分开；订阅单号（`helm_wx_`）在开事务前即被拒。

- **Gate**: `HELM_BILLING_TOPUP_WECHATPAY_ENABLED` (capability `billing_topup_wechatpay`, **default enabled**, owner 2026-11-12) and
  `financial_action`; `false` (or an invalid value) answers a plain 404 before reading the body or the database. Enabled but any merchant
  key missing or malformed (a private key in the public key slot included): fail closed, `503`, nothing read or credited; the
  `config_unavailable` alert is logged at most once a minute per process with a `suppressed` count. Deployments that do not collect WeChat Pay set `false`.
- **Config** (environment only): existing `WECHAT_PAY_APP_ID`, `WECHAT_PAY_MERCHANT_ID`, `WECHAT_PAY_MERCHANT_SERIAL_NO`,
  `WECHAT_PAY_PRIVATE_KEY` (confidential), `WECHAT_PAY_PLATFORM_PUBLIC_KEY` (the WeChat Pay public key), `WECHAT_PAY_API_V3_KEY` (confidential, 32 bytes)
  and the new public `HELM_BILLING_TOPUP_WECHATPAY_PUBLIC_KEY_ID` (`PUB_KEY_ID_<digits>`). Missing or malformed: `503`. Only the
  configured mchid + appid pair maps to `merchantRef=wechatpay-mch:<id>` / `appRef=wechatpay-app:<id>`; anything else is `topup_merchant_mismatch`.
- **Notify**: `application/json`, at most 16 KiB, strict UTF-8. `Wechatpay-Timestamp` within 300 s either way (checked first),
  `Wechatpay-Serial` equal to the configured public key id (platform-certificate mode is not supported and fails), SHA256-RSA over
  `timestamp\nnonce\nbody\n`; signature probes are not special-cased. Then `resource_type=encrypt-resource`, `original_type=transaction`,
  `AEAD_AES_256_GCM` decryption with the APIv3 key (16-byte tag appended; `associated_data` absent, `""` or `null` is empty AAD). The decrypted transaction maps with `observeWeChatPayTransaction`
  (`amount.total` is fen); an `event_type` other than `TRANSACTION.SUCCESS` maps to `unknown`, as do `REFUND` and unlisted states.
- **Answer**: 200 with no body when acknowledged (same cases as Alipay `success`); otherwise 4XX/5XX with `{"code":"FAIL","message":"失败"}`
  so WeChat Pay retries. Logs carry a fixed reason code only.
- **Query** (`createWeChatPayTopupAdapter(config).queryOrder`, for `verifyTopupByQuery`): `GET /v3/pay/transactions/out-trade-no/{no}?mchid=`
  signed with the merchant key (`WECHATPAY2-SHA256-RSA2048`), asking for public-key signed answers; 10 s timeout, redirects refused. The
  answer is verified like a notify before it is parsed; `404 ORDER_NOT_EXIST` is `not_paid`; other answers throw (order unchanged).
  Order creation (Native), the session-triggered query route, close order and the legacy-route guard are S2-w2.
- **Before collecting real payments / 真实收款前提**（the notify entry being on does not mean collection is ready）:
  1. The merchant id has **finished the platform-certificate to WeChat Pay public key switch** and signs with the public key only. During
     the switch WeChat Pay mixes both signatures; this entry accepts only the configured public key id, so certificate-signed notifies are
     refused (400) and only an active query can recover them. 商户号须已走完平台证书到微信支付公钥的切换。
  2. The merchant platform has **no coupons or discounts** configured (owner 2026-11-12: no discounts; credit is the order amount). This
     slice compares `amount.total` only. 商户平台不得配置代金券或立减。
  3. **Required before S2-w2 merges** (the slice that can create `tpw_` orders): a paid observation whose `amount.payer_total` differs from
     the order amount is recorded as a reconciliation exception and not credited, with tests. d2 合入前必做：入账前比对 `payer_total`。
- **Verify / rollback**: `wechatpay-topup.test.ts` (per-run RSA keys and APIv3 key, in-process API double) and `wechatpay-topup.mysql.test.ts`
  in `npm run test:billing:mysql` (forged/stale/undecryptable notify, merchant or app mismatch, subscription order number, amount and currency
  mismatch, duplicate notify, concurrent notify and query, refund state before credit, billing off, gate off). Roll back: unset the gate; no migration.

## Verification and rollback / 验证与回滚

- Unit `topup-orders.test.ts`; `npm run test:billing:mysql` (CI `mysql:8.4`) with a synthetic HMAC adapter covers the rules above,
  concurrent callback/query and concurrent txns for one order, refund news, late success, rollback, legacy orders and DB immutability.
- Application rollback: stop calling the service. Schema rollback `prisma/rollback/20261110_rollback_billing_topup_orders.sql` refuses while
  any row exists; roll it back before the funds journal. Not enabled: order creation and query routes (S2-d2); the legacy query helpers drop amount fields and are not used.
