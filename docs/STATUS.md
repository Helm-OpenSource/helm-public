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
| Open-source maintainer operating loop | First post-public baseline established; branch protection is enabled; contribution templates, metadata cleanup, required-check drift monitoring, and release-latest posture still need next-layer action | [Public maintainer status baseline](operations/HELM_PUBLIC_MAINTAINER_STATUS_2026-06-02.md) |
| Open-source operating model and OKR/KPI loop | Formed as a public Core operating model; first weekly packet and activation evidence still need next-layer execution | [Open source operating model](operations/HELM_PUBLIC_OPEN_SOURCE_OPERATING_MODEL_2026-06-02.md) |
| Open-source growth operating loop | Formed as a seven-day public-Core activation plan with a first-change walkthrough; activation evidence, community intake templates, and day-7 readout still need next-layer execution | [Open source growth 7-day operating plan](operations/HELM_OPEN_SOURCE_GROWTH_7_DAY_OPERATING_PLAN_2026-06-02.md) |
| OPC intake and packet loop | Public issue templates, PR template, weekly OPC packet template, and owner-gated China access receipt fields established as repo files; first real template-submitted issue / PR still needs dry-run review | [OPC weekly packet template](operations/HELM_OPC_WEEKLY_PACKET_TEMPLATE.md), `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md` |
| China accessibility and evidence routing | Formed as a two-tier reachability and evidence model; GitHub public-safe evidence remains primary proof while WeChat / QR / community handoffs are assisted signals only | [China accessibility and evidence routing packet](operations/HELM_CHINA_ACCESSIBILITY_AND_EVIDENCE_ROUTING_2026-06-02.md) |
| Cloud trial / enterprise readiness | Not established by this repository alone | See [release reality alignment](product/HELM_RELEASE_REALITY_ALIGNMENT.md) |

## Deliberately Not Claimed

- No production SLA.
- No complete enterprise SSO / SCIM / immutable audit platform.
- No third-party plugin sandbox.
- No runtime marketplace.
- No automatic external send, approval, settlement, or customer commitment.
