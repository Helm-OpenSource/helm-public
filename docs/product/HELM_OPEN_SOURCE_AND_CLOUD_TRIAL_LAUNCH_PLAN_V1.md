---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Public launch posture. Private release receipts and customer deployment evidence are excluded.
---
# Helm Open Source And Cloud Trial Launch Posture

This public note records the release posture for Helm Core and the optional cloud
trial path. It is not a release approval and does not replace private release
receipts.

## What Can Be Public

- Apache-2.0 Core source
- Local Docker quickstart
- Public sample Pack material
- Public contribution, security, and governance docs
- Trial posture and no-SLA boundary

## What Must Stay Private

- Customer-specific overlays and deployment evidence
- Commercial Pack implementation details
- Secret rotation receipts and infrastructure proofs
- Control-plane entitlement state
- Owner approval records for private releases

## Launch Gates

Before a repository visibility flip or public release, maintainers should have
current evidence for:

- `npm run check:public-docs`
- `npm run check:public-release`
- `npm run check:secret-history`
- `npm run release:check`
- public CI / test / typecheck
- clean public history or fresh sanitized snapshot
- owner Go/No-Go

## Cloud Trial Boundary

Cloud Trial is optional and separate from the Apache-2.0 Core. It does not create
an enterprise SLA by default. Data policy and support posture are documented in:

- [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)
- [ON_CALL_AND_RESPONSE_SLA.md](../operations/ON_CALL_AND_RESPONSE_SLA.md)
- [PUBLIC_TRIAL_RUNBOOK.md](../pilot/PUBLIC_TRIAL_RUNBOOK.md)
