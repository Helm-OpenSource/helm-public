---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
public_safety: Public Core roadmap. This is gate-relative planning, not a release-date commitment.
---
# Helm Public Roadmap

This roadmap describes the public Core path for delivery engineers. It is not a
commercial release approval, production SLA, customer deployment commitment, or
repository visibility approval.

Helm's public Core north star is:

> Help AI delivery engineers turn the judgement, evidence, review, boundary, and
> delivery package work inside customer business implementation into a forkable
> engineering structure.

## Roadmap Principles

1. Recommendation is not commitment.
2. Review packet is not approval, send, write-back, settlement, or execution.
3. Public Core must stay Apache-2.0, independently buildable, and public-safe.
4. Core must not depend on Pack or Overlay code.
5. Public wording uses evidence gates and Now / Next / Later, not launch-date
   promises.

## Now

These items are in the public Core baseline or are the current public-Core
working surface:

- Apache-2.0 Core repository posture: `LICENSE`, `NOTICE`, `package.json`, and
  curated public docs.
- Docker quickstart: `Dockerfile`, `docker-compose.yml`, and fresh-clone review
  receipts under `docs/reviews/`.
- Delivery engineer Golden Path requirements:
  [HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](../product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md).
- Headless Signal Interface requirements:
  [HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md](../product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md).
- Public sample pack: `extensions/case-management-sample/`, labeled as a
  synthetic public sample pack with provenance under review until the synthetic
  evidence gate is signed off.
- Local checks:

```bash
npm run delivery:doctor
npm run pack:fixture-check
npm run eval:headless-signal-interface
npm run eval:operating-signal-flow
npm run check:public-release
```

Repository visibility remains gated until public-release checks, history-level
checks, and owner Go/No-Go are complete.

## Next

These are the next gate-relative public-Core improvements. They are not date
commitments.

- Finish R1/R2 cleanup from the Golden Path requirements: remove frozen legacy
  repository links, placeholder contact values, date-style launch promises, and
  customer-delivery time promises from public entry points.
- Make README's first path the delivery-engineer Golden Path, including a
  concrete "change this line -> run this command -> observe this change"
  walkthrough.
- Complete the synthetic provenance gate for `case-management-sample`, or keep
  the public label at "provenance under review".
- Add fork-and-rename guidance, a standalone "what Helm does not do" page, and a
  forker upgrade story.
- Keep public docs curated through `docs/public-docs-manifest.json` and
  `npm run check:public-docs`.
- Coordinate a read-only split doctor in `helm-control-plane`; do not add
  Pack, Overlay, or control-plane metadata to `helm-public`.

## Later

These directions require separate gates, repository routing, and owner approval:

- Helm Cloud or Enterprise delivery readiness.
- Industry Pack hardening in `helm-packs`.
- Customer Overlay delivery in `helm-overlays`.
- BOM, authorization, deployment registry, health heartbeat, and usage metadata
  in `helm-control-plane`.
- Additional connector readiness after read-first / review-first evidence exists.

## Out Of Scope

The following are not public Core roadmap items:

- Complete workflow, orchestration, or agent platform.
- Runtime marketplace, app store, plugin sandbox, or hosted MCP runtime.
- Complete BI platform.
- Automatic approval, external send, settlement, execution, CRM write-back, or
  customer commitment.
- LLM final ranking on commitment paths.
- Real customer data, private deployment details, credentials, customer tenant
  slugs, private domains, or internal IPs in public paths.
- Core dependencies on Pack or Overlay code.

## Contribution Direction

Good public Core contributions:

- Bug fixes and tests.
- Documentation corrections.
- Public sample pack fixture and mapper improvements that stay synthetic and
  review-first.
- Read-only connector fixtures or dry-run examples.
- Accessibility and local developer experience improvements.

Discuss first:

- Schema changes.
- New runtime surfaces.
- Any write, send, approval, execution, settlement, or external commitment path.
- Anything that might belong in `helm-packs`, `helm-overlays`, or
  `helm-control-plane`.

See [CONTRIBUTING.md](../../CONTRIBUTING.md) and
[AGENTS.md](../../AGENTS.md) before opening a PR.
