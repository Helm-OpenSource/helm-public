---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Payment Integration Plan v1

## Purpose

This document freezes the scope for Helm's narrow payment integration program.

The goal is to connect Helm's existing organization-first commercial truth to a narrow, honest live payment rail without turning Helm into a finance console or billing platform.

Dual Payment Rail Foundation Sprint 1 now sits on top of this plan:

- global rail = `Stripe`
- China rails = `Alipay / WeChat Pay`
- one lifecycle truth still hangs off the existing billing foundation
- China rail Sprint 1 does **not** promise Stripe-level portal parity
- China rail Sprint 1 does support narrow checkout + callback / notify + query fallback + lifecycle sync

## Current baseline

This plan assumes Helm's billing foundation is present in current-main for this sprint:

- `Workspace == Organization` for v1
- `Membership` as the user-to-organization seam
- `BillingAccount`
- `TrialState`
- `WorkerEntitlement`
- `UsageLedger`
- active organization runtime
- `trialing / active / grace / read_only / canceled`
- narrow high-cost processing guard
- settings billing overview

## This sprint does only these things

### 1. Narrow checkout

Land a minimal organization checkout flow for Helm Team:

- one product truth only: Helm Team
- organization base fee remains fixed
- seat model remains fixed
- no plan matrix expansion

### 2. Billing portal entry

Land a minimal billing portal entry for organizations that already have a live customer/subscription relationship.

This remains a subscription-management extension of the existing settings billing overview, not a finance backend.

### 3. Minimal status writeback

Land the minimum payment-provider-to-product-state writeback needed for:

- checkout completed
- subscription active
- subscription canceled
- subscription past_due / unpaid
- portal-return refresh

### 4. Dual payment rail foundation

Freeze a narrow provider abstraction so current-main can support:

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
- `billingPortalMode`
  - `STRIPE_PORTAL`
  - `NONE_YET`
- `callbackMode`
  - `STRIPE_WEBHOOK`
  - `ALIPAY_NOTIFY`
  - `WECHAT_PAY_NOTIFY`
- `lifecycleMappingMode`
  - `STRIPE_SUBSCRIPTION_LIFECYCLE`
  - `CHINA_PAYMENT_PERIOD_LIFECYCLE`

This abstraction exists so:

- English / global billing can stay on Stripe
- Chinese payment rails can hang off the same lifecycle truth later
- current-main does not need to pretend Alipay / WeChat Pay already equal Stripe Billing

### 5. Docs / guards / tests / self-check alignment

Keep the code, docs, guards, tests and self-check on the same current-main truth.

## Explicit non-goals

This sprint does **not** do:

- invoice engine
- tax handling
- coupons / discounts
- retry / dunning
- payout rails
- enterprise procurement
- SSO / SCIM
- full RBAC
- multi-workspace
- worker marketplace
- connector marketplace
- finance console
- token / storage / retrieval customer-facing billing

## Preserved pricing and lifecycle truth

This sprint does not change:

- `CNY 199 / month / organization`
- `1` included admin seat
- `CNY 99 / additional active seat / month`
- `30-day` organization trial
- `1 admin + 2 collaborator seats` in trial
- trial and active both keep the full current core product
- core first-party workers remain included

This sprint must continue to serve:

- `trialing`
- `active`
- `grace`
- `read_only`
- `canceled`

Payment provider states may inform lifecycle updates, but they do not replace Helm's product lifecycle semantics.

## Narrow implementation shape

### Product surface

The product surface remains narrow:

- `settings` billing overview is extended
- checkout entry lives there
- billing portal entry lives there
- current status remains visible there

No second app tree and no finance console are introduced.

### Runtime shape

Expected narrow runtime seams:

- `features/settings/actions.ts`
- `features/settings/settings-client.tsx`
- `app/(workspace)/settings/page.tsx`
- `lib/billing/*`
- narrow provider webhook / callback route

### Provider shape

Current live and foundation paths are:

- Stripe:
  - hosted checkout
  - hosted billing portal
  - verified webhook
  - explicit subscription refresh
- Alipay:
  - narrow checkout
  - notify callback
  - query fallback
  - lifecycle sync
  - no portal parity
- WeChat Pay:
  - narrow H5 / Native checkout
  - notify callback
  - query fallback
  - lifecycle sync
  - no portal parity

## Success criteria

This sprint is successful only if all of the following are true:

1. an organization can start checkout for Helm Team
2. a paid organization can reach `active`
3. a user can enter the billing portal when a live customer/subscription exists
4. payment status can minimally write back into the existing lifecycle truth
5. dual payment rails are described honestly without fake parity
6. settings still reads like a product billing overview, not a finance console
7. trial remains full-featured, not crippled
8. token / storage / retrieval stay internal-only accounting

## Failure conditions

This sprint fails if any of the following happen:

- trial becomes a feature-gated toy
- payment integration requires rewriting lifecycle truth
- settings becomes a finance console
- payment integration forces tax / invoice / dunning work just to run
- China rails are overclaimed as full Stripe parity
- docs, tests, guards and code drift apart
- usage ledger starts reading as customer-facing usage billing

## Intentionally deferred

Still deferred after this sprint:

- invoices
- taxes
- coupons
- retries / dunning
- payouts
- SSO / SCIM
- full RBAC
- multi-workspace
- worker marketplace
- connector marketplace
- broader billing platform work
- full China billing portal parity
