---
status: active
progress: public-reference-present / d2-smoke-and-full-integration-pending
owner: helm-core
created: 2026-05-18
last_reviewed: 2026-06-01
review_after: 2026-06-15
archive_trigger:
  - The public sample pack is replaced by a newer public vertical reference strategy
  - The sample pack no longer participates in the delivery engineer Golden Path
  - This document is misused to claim production readiness or customer deployment readiness
---

# Case Management Sample Extraction Spec

## 1. Purpose

`extensions/case-management-sample/` is Helm's minimum public reference pack. It exists so a delivery engineer can inspect, fork, test, and adapt a complete but synthetic case-management shape without receiving any customer-specific configuration or private implementation logic.

This public projection records the extraction rules that must remain true in `helm-public`.

## 2. Current Status

The public sample currently includes:

1. `tenant.manifest.json`.
2. `hsi-pack.manifest.json`.
3. Synthetic case fixture data.
4. Generic signal types and case mapper.
5. Two review-first worker examples.
6. A BI report cookbook example.
7. HSI and delivery-engineer static checks.

Still pending:

1. D2 fresh-clone smoke receipt.
2. Full Docker onboarding receipt.
3. Browser-level proof that `/operating`, `/approvals`, and `/memory` render from a clean checkout.
4. Optional additional mapper coverage beyond the minimum case mapper.
5. Customer-safe proof-pack generation.

## 3. Public-Safe Rule

The sample pack must never include:

1. Customer names.
2. Real employee names.
3. Real email addresses or phone numbers.
4. Private domains.
5. Intranet IPs.
6. Cloud database hosts.
7. Secrets, tokens, keys, credentials, or prompt replay.
8. Customer deployment details.
9. Customer-specific runtime configuration.
10. Commercial private connector logic.

All checked-in data must be synthetic, redacted, or alias-only.

## 4. Allowed Extraction Inputs

Public sample work may use only public-safe patterns:

| Input pattern | Allowed use |
|---|---|
| Generic manifest shape | Recreate public manifests with generic identifiers |
| Signal family taxonomy | Keep source-agnostic signal names and boundaries |
| Worker driver pattern | Recreate review-first worker examples with synthetic fixtures |
| BI report cookbook pattern | Provide synthetic report skill structure |
| Fixture category coverage | Preserve positive, degraded, boundary, duplicate / conflict, stale, and missing-owner examples |

Any source pattern that depends on a real customer, production connector, customer-specific workflow, private schema, or commercial integration must stay outside `helm-public`.

## 5. Directory Shape

Expected minimum shape:

```text
extensions/case-management-sample/
  README.md
  tenant.manifest.json
  hsi-pack.manifest.json
  hsi-implementation-checklist.md
  fixtures/
    case.sample.json
  signals/
    types.ts
    case/case-mapper.ts
  workers/
    case-allocation-driver/decide.ts
    case-stewardship-driver/decide.ts
  bi-report/
    report-skills/daily-activity-readout/
```

The exact tree may grow, but any growth must remain sample-only and public-safe.

## 6. Validation

Before claiming the sample pack is usable as a public reference, run:

```bash
npm run delivery:doctor
npm run pack:fixture-check
npm run eval:headless-signal-interface
npm run eval:operating-signal-flow
npm run check:public-release
npm run check:boundaries
```

For a release claim, also run a fresh-clone smoke and commit a receipt matching `docs/reviews/HELM_DELIVERY_ENGINEER_D2_SMOKE*.md`.

## 7. Acceptance Criteria

| Requirement | Evidence |
|---|---|
| Public sample files exist | `npm run delivery:doctor` |
| HSI manifest is valid | `npm run pack:fixture-check` |
| Fixtures parse and stay non-empty | `npm run pack:fixture-check` |
| Source-agnostic signal families are covered | `npm run pack:fixture-check` and `npm run eval:headless-signal-interface` |
| Operating signal flow remains review-first | `npm run eval:operating-signal-flow` |
| No public/private leakage | `npm run check:public-release` |
| Public mirror remains buildable | `npm run typecheck` and `npm run build` |

## 8. Stop Conditions

Stop and open a separate review if:

1. A sample requires real customer data.
2. A fixture cannot be expressed with synthetic or redacted values.
3. A worker needs production credentials.
4. A sample implies auto-send, auto-approve, auto-execute, silent CRM write, or official write.
5. A public claim depends on a pilot outcome that has not been customer-authorized.

## 9. Public Core P0 Slice Plan

Goal:

- Show a deterministic chain from public fixture evidence to operating signal,
  memory candidate, and review packet.
- Keep every customer-visible action review-first.
- Preserve China delivery profile defaults for Qwen, local connector posture,
  region / residency, npm registry override, and OpenAI-only ASR.
- Keep public examples free of customer data, credentials, deployment receipts,
  private hosts, and production compliance claims.

Impact:

- `extensions/case-management-sample/`: sample signal contract, CRM fixture
  coverage, memory candidate and review packet preparation helpers.
- `lib/headless-signal-interface/` and `lib/delivery-engineer/`: artifact
  validation and Golden Path doctor checks.
- `README.md`, `docs/STATUS.md`, `CHANGELOG.md`, `.env.example`: public-safe
  documentation and status alignment.

Assumptions:

- Phase 1 remains offline, deterministic, and read-only.
- Memory output is candidate-only and cannot become official memory without a
  separate human review path.
- Review packet output is preparation-only and cannot send, approve, execute,
  write CRM, or promote memory.
- Public China profile settings are configuration posture and accessibility aids,
  not production compliance proof.

Validation:

```bash
npm run test -- extensions/case-management-sample/signals/case/case-mapper.test.ts extensions/case-management-sample/signals/review-packet.test.ts
npm run test -- lib/headless-signal-interface/pack-artifacts.test.ts lib/delivery-engineer/golden-path-doctor.test.ts
npm run delivery:doctor
npm run pack:fixture-check
npm run eval:headless-signal-interface
npm run eval:operating-signal-flow
npm run check:public-release
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

Rollback:

- Revert the sample helper, fixture, doctor, and docs changes. No schema, API
  route, external connector, production credential, or runtime side effect is
  introduced.

## 10. Change Log

| Date | Change |
|---|---|
| 2026-06-03 | Added the public Core P0 evidence -> signal -> memory candidate -> review packet slice plan and public-safe validation scope. |
| 2026-06-01 | Public-safe projection restored in `helm-public`; private extraction context intentionally omitted while preserving Golden Path acceptance and validation rules |
