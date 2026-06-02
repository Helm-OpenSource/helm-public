---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Curated public Core docs index. Do not add broad mirror carry-over docs without updating docs/public-docs-manifest.json and passing check:public-docs.
---
# Helm Public Docs

This directory is the curated documentation surface for `helm-public`.

It is intentionally small. The private source repository contains many planning,
review, commercial, customer-delivery, and migration documents that do not belong
in the Apache-2.0 Core repository. Public docs must be explicitly listed in
[public-docs-manifest.json](public-docs-manifest.json), and `npm run
check:public-docs` fails when a new doc appears without that review.

## Start Here

- [README](../README.md) / [README English](../README.en.md)
- [Developer quickstart](getting-started.md) / [English](getting-started.en.md)
- [Helm for delivery engineers](positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md) / [English](positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md)
- [Delivery engineer Golden Path requirements](product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)
- [Public roadmap](roadmap/HELM_PUBLIC_ROADMAP.md)

## Public Contracts

- [Open source and commercial boundary](product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md)
- [Open source and cloud trial launch posture](product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md)
- [Release reality alignment](product/HELM_RELEASE_REALITY_ALIGNMENT.md)
- [Certified ecosystem checklist](product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md)
- [Delivery engineer Golden Path requirements](product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)
- [Solution extension protocol](product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md)
- [Extension directory and naming protocol](product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md)
- [Operating signal flow map requirements](product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md)

## Contribution And Operations

- [Integration template](integrations/INTEGRATION_TEMPLATE.md)
- [Open source operating model](operations/HELM_PUBLIC_OPEN_SOURCE_OPERATING_MODEL_2026-06-02.md)
- [Public trial runbook](pilot/PUBLIC_TRIAL_RUNBOOK.md)
- [Public trial data policy](legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)
- [Trial response and on-call posture](operations/ON_CALL_AND_RESPONSE_SLA.md)
- [Agent working entry](codex/README.md)
- [Status truth table](STATUS.md)

## Selected Public Validation Receipts

- [AI-native enterprise AI artifact templates closeout](reviews/HELM_AI_NATIVE_B2B_ARTIFACT_TEMPLATES_CLOSEOUT.md)
- [D2 Docker fresh-clone smoke receipt](reviews/HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-06-01.md)
- [Node fresh-clone smoke receipt](reviews/HELM_DELIVERY_ENGINEER_NODE_FRESH_CLONE_SMOKE_2026-06-01.md)

## Not In This Public Docs Surface

- Customer-specific overlays
- Commercial Pack implementation details
- Private review packets and broad source-repo closeout reports
- Investor, sales, and private GTM materials
- Secret remediation receipts and private deployment evidence

Those materials belong in private repositories or private issue/PR records, not
in `helm-public`.
