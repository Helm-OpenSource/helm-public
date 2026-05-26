---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Dual Payment Rail Foundation Sprint 1 Report

## Scope

This sprint establishes Helm's dual payment rail foundation without widening Helm into a billing platform or finance console.

It does only these things:

- defines a shared payment provider abstraction
- freezes provider truth for `Stripe / Alipay / WeChat Pay`
- defines one checkout / callback / lifecycle mapping seam
- shows the current payment rail inside settings billing overview
- keeps docs, guards, tests and self-check aligned

It does **not** claim:

- full China payment rail runtime parity
- full invoice / tax / coupon / retry / dunning
- finance console behavior
- multi-region commercial platform behavior

## What landed

### 1. Provider abstraction

Current-main now has a narrow provider abstraction for:

- `paymentProvider`
  - `STRIPE`
  - `ALIPAY`
  - `WECHAT_PAY`
- `paymentRegion`
  - `GLOBAL`
  - `CN`
- `checkoutMode`
  - `HOSTED_CHECKOUT`
  - `NATIVE_QR`
  - `H5_REDIRECT`
  - `PORTAL_MANAGED`
  - `MANUAL_RENEWAL`
- `billingPortalMode`
  - `STRIPE_PORTAL`
  - `NONE_YET`

### 2. Provider truth

The product truth is now explicit:

- English / global rail uses `Stripe`
- China rail foundation uses `Alipay / WeChat Pay`
- one lifecycle truth still governs all rails:
  - `trialing`
  - `active`
  - `grace`
  - `read_only`
  - `canceled`

### 3. Unified lifecycle seam

Current-main now has one lifecycle mapping seam for:

- Stripe subscription states
- Alipay callback statuses
- WeChat Pay callback statuses

This keeps product truth primary:

- payment provider status informs product lifecycle
- it does not replace product lifecycle

### 4. Settings billing visibility

Settings billing overview now shows:

- current payment rail
- payment region
- checkout mode
- portal mode
- lifecycle source
- whether lifecycle sync is currently connected
- whether the current rail is live or foundation-only

This remains a product billing overview, not a finance console.

## Required answers

### 1. 双支付轨 provider abstraction 是否已经清楚

`Yes`

The repo now has a dedicated abstraction layer for provider, region, checkout mode, billing portal mode, checkout intent, callback event, and lifecycle mapping.

### 2. Stripe / Alipay / WeChat Pay provider truth 是否已经清楚

`Yes`

Provider truth is explicit and honest:

- Stripe = global live rail
- Alipay = China rail foundation
- WeChat Pay = China rail foundation

China rails are **not** overclaimed as Stripe-equivalent billing platforms.

### 3. 统一 checkout / callback / lifecycle seam 是否已经清楚

`Yes`

Current-main now has:

- a provider resolver
- a shared lifecycle mapper
- a shared callback event shape

Stripe webhook runtime now goes through that shared seam.

### 4. settings 是否已经能展示当前 payment rail

`Yes`

The billing overview now makes the current rail visible without turning settings into a finance console.

### 5. 当前 foundation 是否已经足够支撑下一步分别接 Stripe 和 China rails

`Yes, conditionally`

It is sufficient for:

- continuing Stripe runtime work
- adding a narrow Alipay runtime PR
- adding a narrow WeChat Pay runtime PR

It is not yet a full billing platform, and should not be treated as one.

### 6. 哪些地方刻意未做，为什么

Still deferred on purpose:

- China live checkout runtime
- China callback routes
- China portal parity
- invoice / tax / coupon / retry / dunning
- payout rails
- finance console

They remain deferred because Sprint 1 is about freezing the dual rail foundation, not expanding Helm into a billing product.

### 7. 下一阶段最该做的 5 件事是什么

1. Land a narrow Stripe cleanup pass so checkout / portal / webhook copy and tests fully use the new shared rail abstraction.
2. Land an Alipay runtime PR with one honest checkout path and one callback path mapped onto existing lifecycle truth.
3. Land a WeChat Pay runtime PR with one narrow QR/H5 path and one callback path mapped onto existing lifecycle truth.
4. Add a tiny payment rail ops checklist so settings, env, self-check and webhook assumptions stay aligned across regions.
5. Re-run billing acceptance as a product walkthrough once one China rail becomes live.

## Recommendation / commitment stability

The recommendation and commitment A-minus lines remain stable in this sprint.

Reason:

- this sprint only extends billing/payment foundation truth
- it does not change meeting wedge semantics
- it does not widen send authority or workflow control
- it does not change recommendation / commitment operating surfaces

## Preserved boundaries

- no invoice engine
- no tax / coupon / retry / dunning
- no payout rails
- no SSO / SCIM / full RBAC
- no multi-workspace
- no worker marketplace
- no connector marketplace
- no finance console
- no send authority
- no workflow control
- plugin runtime still has no real sandbox
- current payment integration remains narrow, not a full billing platform
