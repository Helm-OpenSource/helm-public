---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_CHINA_RENEW_RESTORE_PLAN_V1

## Purpose

Polish the China payment rail operator path without changing the dual-rail foundation truth.

This plan exists to make China renew / restore / refresh easier to explain and safer to operate from settings, while keeping Helm out of finance-console and billing-platform scope.

## Fixed truth carried into this sprint

The sprint does not change:

- `Workspace == Organization`
- `Membership`
- `BillingAccount`
- `TrialState`
- `WorkerEntitlement`
- `UsageLedger`
- one lifecycle truth:
  - `trialing`
  - `active`
  - `grace`
  - `read_only`
  - `canceled`
- China rail = `ALIPAY / WECHAT_PAY`
- trial / paid full-feature truth
- internal-only accounting for token / storage / retrieval

## Renew / restore / refresh path

### Trialing

- primary entry: purchase
- settings action: start China checkout
- refresh role: only after a recent China payment attempt or delayed notify
- current boundary: full core product still open; payment only changes lifecycle and commercial posture

### Active

- primary entry: hold
- settings action: refresh only when delayed notify or recent payment status needs confirmation
- duplicate-purchase posture: avoid duplicate China checkout
- current boundary: keep active access and do not repurchase just to confirm status

### Grace

- primary entry: renew
- settings action: start China renew path through Alipay or WeChat Pay
- refresh role: query fallback if notify has not landed yet after payment
- current boundary: keep view / export / restore-oriented actions open while new high-cost processing stays paused

### Read-only

- primary entry: restore
- settings action: start China restore path through Alipay or WeChat Pay
- refresh role: query fallback if notify is delayed after restore payment
- current boundary: keep sign-in, viewing, export, and restore-oriented settings actions open while new high-cost processing remains blocked

### Canceled

- primary entry: reactivate
- settings action: start the same narrow China purchase path as reactivation
- refresh role: query fallback after checkout return or delayed notify
- current boundary: provider status still maps into Helm lifecycle truth instead of replacing it

## Operator entry points

- China checkout buttons remain visible only when lifecycle posture is:
  - `trialing`
  - `grace`
  - `read_only`
  - `canceled`
- China checkout buttons stay hidden when lifecycle posture is:
  - `active`
- refresh stays visible whenever lifecycle sync is connected
- Stripe-style portal entry is not promised for China in this sprint

## Refresh truth

Refresh must clearly mean:

- ask Helm to query the latest China order if notify is delayed
- map provider status back into Helm lifecycle truth
- not expose raw provider payloads
- not turn settings into a manual reconciliation console

If there is no recent China order to query, refresh should say:

- start purchase first
- or start renew first
- or start restore first
- or start reactivation first

depending on the current lifecycle state.

## Intentionally not done

This sprint does not add:

- invoice engine
- tax / coupon / retry / dunning
- finance console
- full portal parity for China
- new payment providers
- enterprise permissions platform
- billing-platform orchestration

## Success criteria

This sprint passes only if:

1. China renew / restore path is state-aware and readable in settings.
2. `active / grace / read_only / canceled` each show the right action posture.
3. Refresh clearly explains delayed notify and query fallback.
4. Duplicate purchase for active China organizations is explained honestly.
5. Docs, guard, tests, and self-check use the same truth.
