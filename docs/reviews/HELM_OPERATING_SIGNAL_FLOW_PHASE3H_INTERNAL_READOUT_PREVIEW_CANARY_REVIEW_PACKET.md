---
status: active
owner: helm-core
created: 2026-05-26
review_after: 2026-08-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-29
# rationale: default — no archive/dormant signal in path
---
# Helm Operating Signal Flow Phase 3H Internal Readout Preview Canary Review Packet

## Conclusion

Phase 3H approves a **review packet only** for deciding whether the Phase 3G internal readout component may later enter a non-route, reviewer-only preview harness.

Decision:

- **Go** for reviewer-only canary review preparation.
- **No-Go** for preview harness implementation in this phase.
- **No-Go** for `/operating` route/page adoption, runtime data adoption, API, schema, migration, production default query, official writes, auto-send, auto-approve, auto-execute, fixture banner removal, external side effects, or LLM final ranking.

This packet exists to keep the next decision auditable. It is not a product launch, not a production data unlock, and not permission to show the component on a live route.

## Evidence Basis

Phase 3H depends on the following prior evidence:

| Evidence | Current posture |
| --- | --- |
| Phase 3F internal readout helper | Pure projection helper; accepts sanitized shadow result / diagnostics only |
| Phase 3G internal readout component | Fixture-contract component; not imported by routes or pages |
| Component action surface | No buttons, no links, no write / send / approve / execute affordance |
| Raw field posture | Tests reject raw trace IDs, request IDs, actor emails, source pages, and raw event IDs |
| Boundary-blocked posture | Routes reviewer attention to Security / Data Protection / Founder and keeps stop decision visible |
| Adoption guards | `data-production-truth="false"` and `data-route-page-adoption="false"` remain explicit |

## Canary Review Questions

Reviewers must answer these questions before any preview harness implementation is allowed:

| Question | Required answer before next Go |
| --- | --- |
| Is the component still disconnected from `app/` routes and `/operating` runtime view composition? | Yes |
| Does the rendered surface clearly distinguish fixture-contract / internal shadow readout from production truth? | Yes |
| Are `data-production-truth="false"` and `data-route-page-adoption="false"` present in the DOM evidence? | Yes |
| Are there any buttons, links, form controls, or action verbs that imply write/send/approve/execute? | No |
| Are raw IDs, emails, source pages, trace payloads, or event payloads visible in screenshot or DOM evidence? | No |
| Does `shadow_boundary_blocked` stop the review path and route to Security / Data Protection / Founder? | Yes |
| Does the preview plan avoid Storybook, browser harness, or new tooling assumptions not already proven in the repo? | Yes |
| Does the plan keep `/operating` fixture UI unchanged until a separate adoption review? | Yes |

## Required Evidence For Any Future Preview Harness

Any later Phase 3I implementation proposal must collect evidence before it is accepted:

| Evidence | Requirement |
| --- | --- |
| Route import scan | Prove the component remains unimported by `app/` and the `/operating` route/page owner |
| DOM snapshot | Include the four guard attributes: `data-internal-readout-only`, `data-fixture-contract`, `data-production-truth`, `data-route-page-adoption` |
| Screenshot evidence | Capture Chinese and English reviewer-only states without raw field leakage |
| Interaction scan | Prove no buttons, links, forms, submit controls, or external navigation exist |
| Boundary case evidence | Show `shadow_boundary_blocked` routes to Security / Data Protection / Founder and does not continue execution |
| Guard evidence | `npm run check:public-release` and `npm run check:boundaries` must pass |
| Test evidence | Targeted component/helper tests must pass |
| Rollback evidence | Demonstrate removal path is delete-only for preview artifact and does not require schema or DB rollback |

## Rollback Criteria

If any future preview harness violates this packet, rollback must be limited and reversible:

- remove the preview-only file or import that introduced the violation
- remove related test / docs / boundary allowlist entries from that slice
- keep Phase 3F helper and Phase 3G component contract unless they caused the violation
- do not change `.env`
- do not run destructive database reset against a remote database
- do not toggle production runtime adoption flags as a rollback substitute

## Allowed Next Slice

Allowed Phase 3I:

- A reviewer-only preview harness implementation plan.
- The plan may specify a non-route local preview pattern only after proving the repo already supports the chosen pattern.
- The plan must include route import scan, DOM/screenshot evidence requirements, interaction scan, rollback criteria, and explicit No-Go boundaries.

Forbidden Phase 3I:

- Implementing the preview harness without a prior plan.
- Importing the component into `/operating` or any `app/` route.
- Reading runtime tenant data.
- Adding schema, API, migration, production default query, official write, auto-send, auto-approve, auto-execute, fixture banner removal, external side effect, or LLM final ranking.

## Verification

Validated for this packet:

```bash
npm run self-check
npm run check:public-release
npm run check:boundaries
npm run typecheck
npm run lint
npm run build
git diff --check
curl -fsS -o /tmp/helm-health-phase3h.txt -w '%{http_code}\n' <production-health-url>
```

Result:

- self-check passed
- public-release guard passed
- boundary gate passed
- typecheck passed
- lint passed
- build passed
- `git diff --check` passed
- production health probe returned `200`

Broader runtime verification, destructive database reset, e2e, and quality-regression were intentionally not part of Phase 3H because no code, route, schema, API, or production configuration changes are authorized.
