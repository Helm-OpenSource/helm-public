---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_CHINA_RENEW_RESTORE_OPS_POLISH_SPRINT_1_REPORT

## Scope

This sprint tightens the China renew / restore / refresh operator path on top of the existing China payment rail.

It does not widen Helm into:

- a finance console
- a billing platform
- full China portal parity

It stays inside:

- settings billing overview
- China checkout entry
- notify / query fallback messaging
- lifecycle mapping readability

## What landed

### 1. China renew / restore path is now state-aware

Settings now reads China operator posture through the current lifecycle state:

- `trialing` -> purchase
- `grace` -> renew
- `read_only` -> restore
- `canceled` -> reactivate
- `active` -> hold and avoid duplicate purchase

### 2. Settings copy and actions are more stable

China billing overview now explains:

- current rail
- current lifecycle state
- current action
- refresh path
- current boundary
- why China still does not promise full portal parity

China checkout button labels now match the actual operator path instead of generic purchase-only wording.

### 3. Refresh / query fallback is more explainable

Manual refresh now gives state-aware product messages:

- if no recent China order exists, it tells the operator whether to purchase, renew, restore, or reactivate first
- if payment is still pending, it explains that Helm lifecycle stays where it is until payment completes
- if payment succeeded, it explains that Helm lifecycle has been refreshed back into active access

Provider state still maps into Helm lifecycle truth instead of replacing it.

### 4. Duplicate purchase is more clearly blocked for active organizations

China rails now use active-state-specific duplicate-purchase messaging instead of generic billing copy.

This keeps the operator path honest:

- active organizations refresh when they only need delayed sync confirmation
- renew / restore paths remain for `grace / read_only / canceled`

## Direct answers

### 1. China renew / restore 路径是否已经清楚

Yes.

The current path is now readable as:

- `grace` = renew
- `read_only` = restore
- `canceled` = reactivate
- `active` = avoid duplicate purchase and prefer refresh for delayed sync

### 2. settings 文案与动作是否已经更稳定

Yes.

Settings now gives state-aware China action labels, a dedicated China renew / restore panel, and clearer lifecycle-return messaging after checkout or cancellation.

### 3. refresh / query fallback 是否已经更可解释

Yes.

Refresh now explains:

- why the operator is refreshing
- what happens when notify is delayed
- what happens when no recent China order exists
- why provider state still only maps back into Helm lifecycle truth

### 4. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

Yes.

This sprint stays inside billing/settings/payment operator seams only. It does not expand recommendation into commitment, workflow control, or send authority.

### 5. 哪些地方刻意未做，为什么

Still intentionally deferred:

- full China portal parity
- invoice / tax / coupon / retry / dunning
- finance console
- new payment providers
- billing-platform orchestration
- enterprise permissions platform

These stay deferred because this sprint only needs a clearer China operator path, not a wider payment surface.

### 6. 下一阶段最该做的 5 件事是什么

1. Add operator-facing env and merchant runbook guidance for real China rollout.
2. Add a narrow reconcile note for cases where notify and query disagree.
3. Add more production-honest edge copy around expired / closed China orders.
4. Add light analytics on refresh usage so delayed-notify cases are measurable.
5. Keep later payment polish separate from finance-console expansion.

## Preserved boundaries

Still true after this sprint:

- no finance console
- no invoice engine
- no tax / coupon / retry / dunning
- no full portal parity for China
- no new payment provider
- no billing-platform expansion
- no workflow control
- no send authority

## Validation

Validated with:

- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `DATABASE_URL='file:./prisma/dev.db' npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`
