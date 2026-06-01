---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Public boundary statement. Does not disclose private Pack, Overlay, or customer deployment details.
---
# Helm Open Source And Commercial Boundary

Helm Core is Apache-2.0. The public repository is intended to be useful on its
own for delivery engineers who want a forkable, review-first business operations
reference implementation.

Commercial offerings do not replace the open source Core. They add operated
services, certified Packs, enterprise governance, and customer-specific delivery
where a private contract is needed.

## Public Core

`helm-public` contains:

- Core app/runtime surfaces
- Base SDK and extension seams
- Public sample Pack material
- Public docs and tests
- Docker quickstart and local development assets

It must not contain:

- Customer overlays
- Private customer names, domains, contacts, or deployment evidence
- Commercial Pack implementation details
- Private control-plane registry or entitlement state
- Credentials, secrets, or production infrastructure details

## Commercial / Private Repositories

Commercial industry Packs, customer overlays, and deployment-control metadata
belong outside `helm-public`.

The dependency direction is:

```text
Overlay -> Pack SDK -> Core SDK
```

Core must not import or depend on commercial Packs or customer Overlays.

## Certification And Brand

Official / Certified wording requires maintainer review. Certification is not a
marketplace, payout rail, SLA, customer-outcome guarantee, or trademark license.
The first public checklist is [HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md](HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md).

## Current Non-Goals

- Runtime marketplace
- Third-party plugin sandbox
- Automatic external send / approval / settlement
- Complete enterprise multi-org platform
- Customer-specific private delivery inside the public repository
