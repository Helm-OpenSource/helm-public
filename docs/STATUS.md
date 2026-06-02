---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Public Core status table. This is not a commercial release approval.
---
# Helm Public Status

This table is the public Core status baseline. It deliberately does not track
private Pack, Overlay, or customer deployment readiness.

| Category | Status | Evidence |
|---|---|---|
| Apache-2.0 Core repository | Established for public Core development | `LICENSE`, `NOTICE`, `package.json`, `README.md` |
| Local developer quickstart | Docker fresh-clone smoke verified for public Core; still not commercial release approval | [D2 Docker fresh-clone smoke receipt](reviews/HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-06-01.md), [getting-started.md](getting-started.md), `docker-compose.yml`, `Dockerfile` |
| Delivery engineer Golden Path requirements | Established as public Core requirements; implementation remains staged by evidence gates | [Delivery engineer Golden Path requirements](product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md), `npm run delivery:doctor`, `npm run pack:fixture-check` |
| Public/private boundary guard | Established at HEAD level | `npm run check:public-release`, `npm run check:public-docs` |
| Public docs information architecture | Established by allowlist; visibility is public after owner Go/No-Go, and new public docs still require intentional review | [public-docs-manifest.json](public-docs-manifest.json) |
| Open-source growth operating loop | Formed as a seven-day public-Core activation plan with a first-change walkthrough; activation evidence, community intake templates, and day-7 readout still need next-layer execution | [Open source growth 7-day operating plan](operations/HELM_OPEN_SOURCE_GROWTH_7_DAY_OPERATING_PLAN_2026-06-02.md) |
| Cloud trial / enterprise readiness | Not established by this repository alone | See [release reality alignment](product/HELM_RELEASE_REALITY_ALIGNMENT.md) |

## Deliberately Not Claimed

- No production SLA.
- No complete enterprise SSO / SCIM / immutable audit platform.
- No third-party plugin sandbox.
- No runtime marketplace.
- No automatic external send, approval, settlement, or customer commitment.
