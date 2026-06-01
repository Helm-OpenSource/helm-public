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

## Manual Tagging Boundary

`npm run release:check` does not create tags or GitHub Releases. It only decides
whether maintainers may enter the manual tagging step.

The trial release target remains `v0.1.0-trial`. If this repository already has
a higher stable release tag, maintainers must not let a lower trial tag replace
the repository's latest stable release. In that case, publish the trial tag as a
prerelease with `--latest=false`, or update the version strategy and supporting
docs before tagging.

The release gate prints suggested manual commands based on the local tag state.
Those commands are guidance for a human maintainer; they are not executed by the
gate.

## Cloud Trial Boundary

Cloud Trial is optional and separate from the Apache-2.0 Core. It does not create
an enterprise SLA by default. Data policy and support posture are documented in:

- [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)
- [ON_CALL_AND_RESPONSE_SLA.md](../operations/ON_CALL_AND_RESPONSE_SLA.md)
- [PUBLIC_TRIAL_RUNBOOK.md](../pilot/PUBLIC_TRIAL_RUNBOOK.md)
