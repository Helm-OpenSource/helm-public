---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No real price, deployment approval, payment, credential or customer data.
---

# Billing price versions and spend grants / 价格版本与消费授权

Billing V1 S3-a (Core): immutable price versions and default-off spend grants; no reservation, charge, route, UI or real price.
本片只提供价格版本与授权原语，不预占、不扣费、不开放接口，所有授权默认关闭、额度 0。

## Model / 模型（migration `20261110180000_billing_price_grants`）

- `BillingProduct` (byte-exact `code`) and `BillingPriceVersion` (`(productId, version)` UNIQUE; billing event, meter unit, acceptance,
  scope, unit price `numerator / denominator` fen, `half_up`, CNY, effective window, `approvalRef`, `contentHash`) reject UPDATE/DELETE.
- `SpendGrant`: one payer, one product, **one price version**; `disabled|active|paused|revoked|expired` (default `disabled`); limits
  `perCharge <= daily <= monthly` fen (default 0; active needs non-zero); validity; `operationKey` + `contentHash`; `version`. The update
  trigger fixes payer, product, price version, validity, trigger and creator, requires `version + 1`, makes revoked/expired terminal.

## Service / 服务（`lib/billing/grants/price-grants.ts`）

- `publishPriceVersion`: `SYSTEM` catalog actor + `approvalRef`; version N follows N-1 under the product lock; same content replays, other
  content `price_version_conflict`. Rows carry `createdBy` (AuditLog is workspace-scoped). `chargeFenForQuantity`: one half-up rounding.
- `createSpendGrant`: OWNER/BILLING_ADMIN of the payer's governing workspace (S0 §6), human only, state `disabled`; same key + content
  replays, other content `grant_operation_conflict`; `scheduled` triggers and consumer-scoped prices refuse until enabled later.
- `changeSpendGrant`: `activate|pause|resume|revoke|set_limits` with `expectedVersion` CAS and same-transaction AuditLog. Activation needs
  non-zero limits, validity, an effective price and an active payer; pause/revoke/limits also work on a suspended payer.
- `lockSpendGrantForUseInTransaction` (S3-b gate): `PayerAccount FOR UPDATE` first, grant `FOR SHARE`, `payer_billing_off`, then
  `evaluateSpendGrant` (active, validity, **same price version**, price effective, per-charge, used + charge <= daily/monthly). Returns
  grant version and Asia/Shanghai `periodKeys`; S3-b supplies `usedFen` (settled + held) from its buckets.
- Race safety: writes lock Membership → PayerAccount → grant, so a revoke waits for an in-flight use and binds every later use; of two
  writers on one version one wins (`grant_version_conflict`). No automatic retry.

## Verification and rollback / 验证与回滚

- Unit `price-grants.test.ts`; `npm run test:billing:mysql` (CI `model-egress-mysql`): versions, replay/conflict, default off, roles,
  limits, no widening on price upgrade, revoke behind a held use, concurrent CAS, off/suspended payers, triggers.
- Rollback: stop calling the service. `prisma/rollback/20261110_rollback_billing_price_grants.sql` refuses while any row exists.
- Not here: `BudgetBucket`, reservation/charge (S3-b), price retirement, `expired` sweep, consumer grants, Pack event contract, routes.
