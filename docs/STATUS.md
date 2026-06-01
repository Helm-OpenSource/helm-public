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
| Local developer quickstart | Formed, still needs release-candidate smoke on fresh machines | [getting-started.md](getting-started.md), `docker-compose.yml`, `Dockerfile` |
| Public/private boundary guard | Established at HEAD level | `npm run check:public-release`, `npm run check:public-docs` |
| Public docs information architecture | Established by allowlist, still subject to owner review before visibility flip | [public-docs-manifest.json](public-docs-manifest.json) |
| Cloud trial / enterprise readiness | Not established by this repository alone | See [release reality alignment](product/HELM_RELEASE_REALITY_ALIGNMENT.md) |

## Deliberately Not Claimed

- No production SLA.
- No complete enterprise SSO / SCIM / immutable audit platform.
- No third-party plugin sandbox.
- No runtime marketplace.
- No automatic external send, approval, settlement, or customer commitment.
