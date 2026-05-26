---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_SEAT_ENTITLEMENT_OPS_POLISH_SPRINT_1_REPORT

## Scope

This report records Seat / Entitlement Ops Polish Sprint 1 for Helm v1.

It sits on top of:

- Helm Billing Foundation Baseline v1
- Narrow Payment Integration Sprint 1
- Dual Payment Rail Foundation Sprint 1
- China Payment Rail Sprint 1

The sprint goal was narrow:

- tighten membership lifecycle readability
- tighten active seat readability
- tighten worker entitlement readability
- tighten settings billing overview readability
- keep all of that honest without expanding into a billing ops platform

## Direct answers

### 1. membership lifecycle 语义是否已经更清楚

Yes.

`INVITED`, `ACTIVE`, and `INACTIVE` now have clearer runtime and billing meaning.

- invited members stay visible but do not count as active seats yet
- active members count as active seats
- inactive members stay visible for history but do not count as active seats

### 2. active seat 模型是否已经更清楚

Yes.

Settings now explains:

- active seats now
- invited but not counted
- inactive but not counted
- trial collaborator allowance
- paid additional active-seat posture

### 3. worker entitlement 运营与展示语义是否已经更清楚

Yes.

Included core workers, reserved commercial add-on paths, effective windows and internal limits now read more coherently as entitlement posture instead of raw fields.

### 4. settings billing overview 是否已经更像产品里的商业总览，而不是字段集合

Yes.

It now reads through stable blocks:

- organization summary
- lifecycle summary
- seat summary
- worker entitlement summary
- internal usage summary

### 5. foundation + payment + seat / entitlement 是否已经足够支撑下一步 payment / ops 扩展

Conditional yes.

The foundation is now strong enough for:

- clearer seat operations
- clearer future add-on worker commercialization
- later payment / portal refinements

But this is still not a full billing ops platform.

### 6. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

Yes.

This sprint stayed inside settings / billing / membership / entitlement seams and did not widen recommendation or commitment semantics.

### 7. 哪些地方刻意未做，为什么

Still intentionally deferred:

- invoice engine
- tax / coupon / retry / dunning
- finance console
- worker marketplace
- connector marketplace
- full RBAC builder
- multi-workspace
- broader seat automation or admin ops platform

They remain deferred because Sprint 1 only needs a clearer product-grade ops layer, not a commercial platform.

### 8. 下一阶段最该做的 5 件事是什么

1. Add a narrow membership reactivation / deactivate flow if ops users need it in real pilots.
2. Tighten paid-seat renewal copy near billing period end for active and grace organizations.
3. Add a small operator runbook for seat and entitlement changes during trial-to-paid conversion.
4. Refine China payment restore messaging so seat posture and payment restore read together more clearly.
5. Prepare a later add-on worker commercialization pass without turning the product into a marketplace.

## Preserved boundaries

Still true after this sprint:

- no invoice engine
- no tax / coupon / retry / dunning
- no payout rails
- no SSO / SCIM / full RBAC
- no multi-workspace
- no worker marketplace
- no connector marketplace
- no finance console
- no broader billing ops platform

## Validation

Validated in the isolated payment worktree with:

- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `DATABASE_URL='file:./prisma/dev.db' npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`
