---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Narrow Payment Integration Sprint 1 Report

## Purpose

This report records the first narrow payment integration for Helm v1.

Its job is to connect the already-accepted billing foundation to a real payment rail without turning Helm into:

- a finance console
- a billing platform
- a feature-gated toy

## Scope completed

This sprint landed only these things:

1. Helm Team hosted checkout
2. hosted billing portal entry
3. minimal Stripe subscription status writeback
4. settings billing overview updates
5. docs / guards / tests / self-check alignment

## Boundaries kept

Still intentionally out of scope:

- invoice engine
- tax handling
- coupons / discounts
- retry / dunning
- payout rails
- SSO / SCIM
- full RBAC
- multi-workspace
- worker marketplace
- connector marketplace
- finance console
- token / storage / retrieval customer-facing billing

## 1. 是否已经把 narrow payment integration 的边界讲清楚

Yes.

The boundary is now explicit in:

- `docs/reviews/HELM_PAYMENT_INTEGRATION_PLAN_V1.md`
- `docs/product/HELM_BILLING_FOUNDATION_BASELINE_V1.md`
- settings billing overview copy
- self-check / boundary guard expectations

Current-main truth is:

- one organization buys Helm Team
- checkout is hosted
- subscription management is hosted
- product lifecycle remains Helm-owned
- payment provider state only maps into lifecycle truth

## 2. checkout flow 是否已经成立

Yes, narrowly.

Organizations can now start a hosted Helm Team checkout from settings when:

- payment env is configured
- the active organization is not already in an active paid subscription posture
- the actor is `OWNER` or `BILLING_ADMIN`

The checkout flow carries:

- organization identity
- current lifecycle context
- Helm Team base plan
- active seat posture

This remains a narrow purchase flow, not a plan matrix or commerce platform.

## 3. billing portal entry 是否已经成立

Yes, narrowly.

Organizations with a live billing customer can now open the hosted billing portal from settings.

This entry is intentionally presented as:

- subscription management
- an extension of the billing overview

It is not presented as:

- finance console
- invoice center
- tax backend

## 4. payment status / subscription status 最小回写是否已经成立

Yes, for the supported path.

Current supported writeback covers:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- manual refresh from settings

The mapped provider states are intentionally minimal:

- `active` and provider `trialing` map to Helm `active`
- `past_due / unpaid / incomplete / paused` map to Helm `grace`
- `canceled` maps to Helm `canceled`, then existing lifecycle logic resolves toward `grace` and later `read_only`

This is mapping, not finance reconciliation.

## 5. 当前 foundation + payment 是否已经足够支撑真实收款

Yes, for a narrow real Helm Team subscription flow.

With valid Stripe env and hosted prices configured, current-main is now sufficient for:

- organization purchase
- subscription management entry
- minimal status sync
- truthful lifecycle display inside the product

It is not yet sufficient for:

- finance operations
- invoice handling
- tax handling
- dunning operations
- enterprise procurement workflows

## 6. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

Yes.

This sprint did not change:

- Meeting OS Wedge semantics
- recommendation logic
- commitment / review semantics
- the narrow high-cost processing guard philosophy

Trial and paid still keep the same current core product surfaces open. The payment layer does not turn Helm into a gated toy.

## 7. 哪些地方刻意未做，为什么

Intentionally not done:

1. invoices
   - would widen Helm toward finance operations
2. tax / coupon / retry / dunning
   - not required for the first narrow hosted subscription path
3. worker marketplace / add-on commerce
   - entitlement model exists, but commerce for add-ons is still later
4. full finance admin UI
   - settings must remain a product billing overview
5. broader usage billing
   - token / storage / retrieval remain internal-only accounting

## 8. 下一阶段最该做的 5 件事

1. Add Stripe checkout / portal smoke guidance and operator runbook for staging / production env setup.
2. Add a narrow subscription-success and portal-return operator checklist so teams can verify status sync without reading raw provider payloads.
3. Add a minimal billing event timeline in settings using existing audit logs, without turning it into a finance console.
4. Add narrowly-scoped payment failure handling copy for `past_due / unpaid` organizations so `grace` and `read_only` transitions stay understandable.
5. Evaluate whether future add-on worker commerce should be the next billing step, while keeping core workers included and avoiding marketplace expansion.

## Validation

Validated in the isolated payment sprint worktree with:

- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `DATABASE_URL='file:./prisma/dev.db' npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`

Result:

- all passed
- `npm run test` finished with `64 passed / 229 passed`

Local note:

- `DATABASE_URL='file:./prisma/dev.db'` was used as a local smoke validation step in the isolated worktree
- this local sqlite preparation is not a product behavior change
