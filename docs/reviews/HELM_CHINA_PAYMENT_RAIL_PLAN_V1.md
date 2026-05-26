---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_CHINA_PAYMENT_RAIL_PLAN_V1

## Purpose

Land the first narrow China payment rail for Helm v1 without widening Helm into a billing platform, finance console, or China-specific product fork.

This sprint exists to connect the China commercial rail to the already-established Helm billing foundation.
It is explicitly a narrow rail for checkout + callback + lifecycle sync, not a billing platform:

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

## Fixed Product Truth

This sprint must not change:

- Helm Team = `¥199 / month / organization`
- includes `1` admin seat
- additional active seat = `¥99 / user / month`
- 30-day organization trial
- trial = `1 admin + 2 collaborator seats`
- trial and paid both expose the full current core product
- first-party core workers stay included
- token / storage / retrieval stay internal-only accounting

## China Rail Scope

China payment rail uses:

- `ALIPAY`
- `WECHAT_PAY`

This sprint supports only:

- checkout / pay intent
- provider callback / notify
- minimal status query fallback
- minimal lifecycle sync back into Helm
- payment rail visibility inside settings / billing overview

This sprint does **not** support:

- invoice engine
- tax / coupon / retry / dunning
- payout rails
- full finance console
- full recurring billing suite for China
- full Stripe-level portal parity for China
- worker marketplace
- connector marketplace
- multi-workspace
- SSO / SCIM / full RBAC

## Non-Symmetric Truth With Stripe

Global rail and China rail do not need fake parity.

- Global / English:
  - `STRIPE`
  - hosted checkout
  - hosted portal
  - webhook-driven subscription sync
- China / Chinese:
  - `ALIPAY`
  - `WECHAT_PAY`
  - minimal checkout
  - notify / callback
  - query fallback when notify is delayed
  - lifecycle sync onto the same Helm lifecycle truth
  - no full portal parity in Sprint 1

## Provider Seam

The provider seam is frozen as:

- `paymentProvider`
  - `STRIPE`
  - `ALIPAY`
  - `WECHAT_PAY`
- `paymentRegion`
  - `GLOBAL`
  - `CN`
- `checkoutMode`
  - `STRIPE_HOSTED_CHECKOUT`
  - `ALIPAY_REDIRECT_OR_HOSTED`
  - `WECHAT_NATIVE_OR_H5`
  - `WECHAT_JSAPI_IF_ALREADY_SUPPORTED`
  - `MANUAL_RENEWAL`
- `callbackMode`
  - `STRIPE_WEBHOOK`
  - `ALIPAY_NOTIFY`
  - `WECHAT_PAY_NOTIFY`
- `lifecycleMappingMode`
  - `STRIPE_SUBSCRIPTION_LIFECYCLE`
  - `CHINA_PAYMENT_PERIOD_LIFECYCLE`

## Sprint 1 Runtime Targets

### Alipay

Target shape:

- minimal hosted / redirect checkout
- notify callback
- status query fallback
- success / closed / expired mapping into Helm lifecycle truth

### WeChat Pay

Target shape:

- minimal H5-first or Native fallback checkout
- notify callback
- status query fallback
- success / closed / expired mapping into Helm lifecycle truth

`JSAPI` is not required in this sprint unless the existing repo context already makes it natural.

## Lifecycle Truth

Provider status must map onto Helm lifecycle truth, not replace it.

Rules:

- provider payment success can move the organization into `active`
- provider closed / expired / canceled can preserve an existing `trialing` or still-valid `active` window
- once a paid period ends, Helm may degrade into `grace` and then `read_only`
- provider status does not create a finance-side truth that overrides Helm product state

## Success Criteria

This sprint counts as successful only if all of the following are true:

1. China payment rail boundary is documented honestly.
2. `ALIPAY` and `WECHAT_PAY` provider seams exist in code.
3. China checkout can be started from settings for an organization.
4. China notify / callback routes exist and write back minimal status.
5. Manual status refresh can query provider state if notify is delayed.
6. Settings shows current payment rail and its mode clearly.
7. Trial / paid full-feature truth remains intact.
8. Settings remains a billing overview, not a finance console.

## Follow-on operator path

After Sprint 1 lands, the next narrow ops layer may clarify China renew / restore without changing this rail truth:

- `grace` organizations use renew
- `read_only` organizations use restore
- `canceled` organizations use reactivation
- `active` organizations avoid duplicate purchase and prefer refresh when notify may be delayed
- refresh can query the latest China order and map it back into Helm lifecycle truth

This follow-on layer is still:

- not a billing platform
- not full portal parity
- not finance-console expansion

## Preserved Boundaries

This sprint must preserve:

- no send authority
- no workflow control
- no second app tree
- no shell thinning
- no route-owner changes
- no `data/queries.ts` rewrite
- no broader governance / admin platform
- no customer-visible usage billing for token / storage / retrieval
- no fake China portal parity
- no expansion into a billing platform
