---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No real price, deployment approval, payment, credential or customer data.
---

# Billing price versions and spend grants / 价格版本与消费授权

Billing V1 S3-a (Core), migration `20261110180000_billing_price_grants`, `lib/billing/grants/price-grants.ts`. No reservation, charge,
route, UI or real price. 只提供价格版本与授权原语，所有授权默认关闭、额度 0。

- **Price versions**: `BillingProduct` and `BillingPriceVersion` (event, meter unit, acceptance, scope, `numerator/denominator` fen,
  `half_up`, effective window, `approvalRef`, `contentHash`) reject UPDATE/DELETE. `publishPriceVersion` (`SYSTEM` actor) appends
  version N after N-1 under the product lock; same content replays, other content `price_version_conflict`. No AuditLog (workspace-scoped).
- **Grants**: one payer, product and **price version** for life; created `disabled` with limits 0 (`perCharge <= daily <= monthly`) by
  OWNER/BILLING_ADMIN (S0 §6), human only; same key + content replays. `changeSpendGrant` (activate/pause/resume/revoke/set_limits) is
  `expectedVersion` CAS on database UTC time with AuditLog. The update trigger freezes binding, validity, evidence and creator, requires
  `version + 1`, allows only the service transitions and makes revoked/expired terminal. Scheduled triggers and consumer prices refuse.
- **Use gate** `lockSpendGrantForUseInTransaction` (S3-b): `PayerAccount FOR UPDATE`, grant `FOR SHARE`, refuses `payer_billing_off`; the
  use names price version, billing event, meter unit and quantity, and the gate **computes `chargeFen` from the bound price row** (a caller
  amount is never trusted). The use time is `UTC_TIMESTAMP(3)` read in the transaction (never a caller value); `usedFen` comes from the
  caller's locked BudgetBucket rows (`lockUsedFen`), then validity and per-charge/daily/monthly are checked. A charge that rounds to 0
  refuses `grant_charge_zero` (S3-b policy: never reserved as free). Returns the grant row, `chargeFen`, price `contentHash`, `at` and
  Asia/Shanghai `periodKeys`; see [reservations](BILLING_RESERVATIONS.md) for the full lock order.
- **Races**: writes and uses both lock PayerAccount first, so a revoke waits for an in-flight use (and a use behind a revoke sees it);
  of two writers on one version one wins (`grant_version_conflict`). No automatic retry.
- **Verify / rollback**: unit `price-grants.test.ts`; `npm run test:billing:mysql` (CI `model-egress-mysql`). Rollback: stop calling the
  service; `prisma/rollback/20261110_rollback_billing_price_grants.sql` refuses while any row exists.
- **Not here**: charge posting (S3-b2), price retirement, `expired` sweep, consumer grants, Pack event contract, routes.
  Before any route exposes price publishing, the `SYSTEM` actor must be authenticated by `BillingServiceGrant` (S0 §5). Two concurrent
  first-version publishes of one product may fail once with `billing_write_conflict`; retrying is safe (replay).
