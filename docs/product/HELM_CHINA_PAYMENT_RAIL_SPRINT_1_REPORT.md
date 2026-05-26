---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_CHINA_PAYMENT_RAIL_SPRINT_1_REPORT

## Scope

This report records China Payment Rail Sprint 1 for Helm v1.

The sprint goal was narrow and specific:

- land a real China payment rail
- keep one Helm lifecycle truth
- avoid widening Helm into a finance console or billing platform

This sprint sits on top of:

- Helm Billing Foundation Baseline v1
- Narrow Payment Integration Sprint 1
- Dual Payment Rail Foundation Sprint 1

Later follow-on ops polish may tighten China renew / restore / refresh messaging in settings without changing the Sprint 1 rail truth recorded here.

## What landed

### 1. China payment rail boundary is now frozen

New plan document:

- `docs/reviews/HELM_CHINA_PAYMENT_RAIL_PLAN_V1.md`

It freezes:

- China rail = `ALIPAY / WECHAT_PAY`
- one lifecycle truth across global and China rails
- narrow checkout + notify + query fallback + lifecycle sync only
- no full portal parity for China in Sprint 1
- no invoice / tax / coupon / retry / dunning
- no finance console

### 2. Alipay / WeChat Pay provider seam is now real

Runtime provider files:

- `lib/billing/alipay.ts`
- `lib/billing/wechat-pay.ts`
- `lib/billing/china-payment.ts`

They now support:

- provider config resolution
- provider-specific checkout creation
- provider-specific notify verification
- provider-specific status query fallback
- provider-specific payment-to-lifecycle mapping inputs

### 3. China checkout flow now exists

Settings billing overview now supports China purchase entry.

Current shape:

- `Alipay`
  - redirect / hosted pay path
- `WeChat Pay`
  - narrow H5-first or Native fallback path

This is still product-scoped and organization-first:

- organization identity
- plan truth
- seat posture
- current lifecycle state

No invoice engine or finance console was added.

### 4. China callback / status sync now exists

New notify routes:

- `app/api/billing/alipay/notify/route.ts`
- `app/api/billing/wechat-pay/notify/route.ts`

Current supported writeback:

- payment success
- payment closed / canceled
- payment expired / unresolved path
- manual refresh from settings
- query fallback when notify is delayed

Provider state still does not replace Helm lifecycle truth.

### 5. Settings billing overview now shows payment rail truth more honestly

Billing overview now shows:

- current payment rail
- region
- checkout mode
- callback mode
- lifecycle mapping mode
- lifecycle source
- rail stage
- checkout / portal / refresh readiness

China rail still reads as a narrow payment surface, not a finance console.

## Direct answers

### 1. China payment rail 的边界是否已经清楚

Yes.

It is now explicitly frozen as:

- China-specific payment rail
- narrow checkout + notify/query sync + lifecycle sync
- no full portal parity
- no invoice/tax/coupon/dunning
- no finance console

### 2. Alipay / WeChat Pay provider seam 是否已经成立

Yes.

Helm now has real provider adapters for:

- `Alipay`
- `WeChat Pay`

They are both attached to the shared provider resolver and shared lifecycle truth.

### 3. China checkout flow 是否已经成立

Yes, narrowly.

Current settings billing overview can now start:

- Alipay checkout
- WeChat Pay checkout

The flow remains organization-first and seat-aware.

### 4. China callback / status sync 是否已经成立

Yes, narrowly.

Current runtime supports:

- provider notify handling
- signature verification
- query fallback
- minimal lifecycle writeback to `BillingAccount / TrialState`

### 5. 当前 dual payment rail 是否已经足够支撑英文区与中文区真实收款

Conditional yes.

It is sufficient for:

- Global / English real collection through Stripe
- China narrow collection through Alipay / WeChat Pay when env and merchant material are configured

It is **not** a full billing platform and does **not** provide China portal parity yet.

### 6. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

Yes.

This sprint stays inside billing/settings/payment seams and does not expand:

- recommendation into commitment
- internal-only into send authority
- narrow lifecycle guard into workflow control

### 7. 哪些地方刻意未做，为什么

Still intentionally deferred:

- full China portal parity
- invoice engine
- tax / coupon / retry / dunning
- payout rails
- finance console
- multi-workspace
- worker marketplace
- connector marketplace
- SSO / SCIM / full RBAC
- JSAPI-first WeChat flow as a required baseline

These are deferred because Sprint 1 only needs to prove narrow collection, not commercial-platform completeness.

### 8. 下一阶段最该做的 5 件事是什么

1. Add operator runbook and env validation guidance for real Alipay / WeChat merchant deployments.
2. Add a narrow China payment reconciliation pass for edge cases where notify and query disagree.
3. Keep China renew / restore copy aligned with the current operator path near billing period end, especially for `grace`, `read_only`, `canceled`, and delayed notify refresh.
4. Add a production-honest WeChat checkout refinement pass if Native vs H5 behavior needs clearer UX.
5. Prepare a separate payment operations PR for staged rollout / smoke scripts without expanding into a finance console.

## Preserved boundaries

Still true after this sprint:

- no send authority
- no workflow control
- no second app tree
- no shell thinning
- no route-owner rewrite
- no `data/queries.ts` rewrite
- no finance console
- no invoice engine
- no tax / coupon / retry / dunning
- no worker marketplace
- no connector marketplace
- no full China portal parity

## Validation

Validated in the isolated payment worktree with:

- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `DATABASE_URL='file:./prisma/dev.db' npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`
