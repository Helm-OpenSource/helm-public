---
status: active
owner: helm-core
created: 2026-05-21
review_after: 2026-08-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-26
# rationale: default — no archive/dormant signal in path
---
# Helm Operating Signal Flow Phase 3L Browser Preview Mechanism Decision Packet

## Conclusion

Phase 3L decides whether Helm should introduce a non-route browser component preview mechanism for the internal readout component.

Decision:

- **No-Go** for introducing Storybook, a hidden app route, a custom browser preview runtime, or Playwright screenshot coverage for the internal readout component now.
- **Keep** Phase 3J test-only DOM evidence as the sufficient reviewer evidence level for the current route-disconnected component contract.
- **Go** for returning the operating loop to runtime adoption evidence inventory: confirm owner-stated 5-role signoff evidence, DPO evidence, redacted calibration bundle freshness, production query rollout plan, rollback plan, and remaining No-Go blockers before any runtime adoption decision.

This is a product and operating decision: Helm should not add a new preview subsystem unless it directly unlocks a specific approved route or reviewer-visible surface. The current bottleneck is not browser preview. The current bottleneck is auditable runtime adoption evidence.

## Decision Basis

| Question | Finding | Decision |
| --- | --- | --- |
| Does the current component need browser visual proof before any route adoption exists? | No. The component remains route-disconnected and fixture-contract only. | Do not add browser preview now |
| Does the repo already have a non-route browser component preview mechanism? | No. Existing browser tests are app-route based. | Do not invent one in this slice |
| Would Storybook reduce risk right now? | No. It would introduce a new subsystem and public-release / boundary burden. | No-Go |
| Would a hidden app route be safe? | No. It is route adoption by another name. | No-Go |
| Would Playwright screenshot evidence be valid without a route or preview runtime? | No. It would require creating an unauthorized surface. | No-Go |
| Is jsdom DOM evidence enough for the present contract? | Yes, for route-disconnected component regression only. | Keep Phase 3J as current evidence level |
| What should Helm do next? | Shift back from preview-chain work to runtime adoption evidence inventory. | Start Phase 3M inventory |

## Explicit No-Go Options

| Option | Decision | Reason |
| --- | --- | --- |
| Storybook | No-Go | Not present in repo; adds new framework and maintenance / release surface |
| Hidden `app/` route | No-Go | Creates route adoption while pretending to be a preview |
| `/operating` import | No-Go | Would remove the fixture-only barrier and confuse production truth |
| Playwright screenshot against a new route | No-Go | Depends on unauthorized route or preview runtime |
| Custom static preview server | No-Go | Adds another runtime surface with unclear boundary ownership |
| Runtime tenant data preview | No-Go | Requires separate runtime adoption evidence and approval chain |

## Kept Evidence Level

The accepted current evidence level is:

- Phase 3F pure internal readout projection helper
- Phase 3G route-disconnected fixture-only component contract
- Phase 3J test-only DOM evidence harness
- Phase 3K DOM evidence review packet

This evidence level proves component contract safety, not product adoption readiness.

## Runtime Adoption Evidence Inventory Required Next

Phase 3M should be a docs-only evidence inventory and blocker classification packet. It must not implement runtime adoption.

Required inventory:

| Evidence item | Required handling |
| --- | --- |
| 5-role Required Reviewer signoff | Record evidence location, roles, timestamps, scope, expiry / revocation, and exact unlock boundary |
| Data Protection / DPO review | Confirm evidence link and whether it covers runtime shadow only or route adoption |
| Redacted calibration bundle | Run or reference Phase 2.3 intake screen result; confirm no raw identifiers or sensitive values |
| Production query rollout plan | Confirm shadow, canary, general-review, observability, and rollback plan exist |
| Single-workspace scope | Confirm no cross-workspace projection or aggregation |
| Runtime flag posture | Confirm default-off, allowlist-only, process-local probe posture before any persistent UI use |
| `/operating` fixture banner | Confirm it remains visible until a separate route adoption review |
| Official write and external side effects | Confirm still false |

Owner has stated that the 5-role signoff is complete. Phase 3M must convert that statement into repo / system evidence before any runtime or route change is considered.

## Allowed Phase 3M

Allowed:

- docs-only evidence inventory
- DB/system task review
- Phase 2.3 intake result review if an existing redacted bundle is present
- blocker classification: satisfied / stale / missing / insufficient / out-of-scope
- next-action recommendation

Forbidden:

- route/page adoption
- browser preview implementation
- runtime tenant data display on `/operating`
- schema, API, migration, production default query
- official write
- auto-send / auto-approve / auto-execute
- fixture banner removal
- external side effects
- LLM final ranking

## Verification

Validated for this decision packet:

```bash
npm run self-check
npm run check:public-release
npm run check:boundaries
npm run typecheck
npm run lint
npm run build
git diff --check
curl -fsS -o /tmp/helm-health-phase3l.txt -w '%{http_code}\n' <production-health-url>
```

Result:

- self-check passes
- public-release guard passes
- boundary gate passes
- typecheck passes
- lint passes
- build passes
- `git diff --check` passes
- production health probe returns `200`

Destructive database reset, e2e, and quality-regression are intentionally not part of Phase 3L because this slice is docs-only and does not change code, routes, schema, API, runtime, or production configuration.
