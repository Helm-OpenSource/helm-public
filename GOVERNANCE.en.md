> **Language / 语言**：**English** · [中文](GOVERNANCE.md)

# Helm Governance

Helm is an Apache-2.0 open-source project in controlled-trial stage. This governance file defines how scope, maintainership, contribution review, and release decisions are handled while Helm remains early.

This document does not create a foundation, legal entity, trademark license, paid support contract, or enterprise SLA.

## 1. Project Scope

Helm Core is the open-source adoption layer for the operating-runtime method:

- business objects
- layered memory
- artifact-first workers
- approval and audit contracts
- local controlled-trial runtime
- basic workers and evals
- read-first connector SDK

The open-source project is not the full commercial product. Helm Cloud, Helm Enterprise, official connectors, certified workflow packs, customer-specific goldens, managed evals, and partner delivery are governed separately.

## 2. Maintainer Authority

Maintainers are responsible for:

- preserving the workspace-first, review-first, decision-first boundary
- reviewing pull requests for correctness, safety, scope, and maintainability
- rejecting changes that turn Helm into a CRM, BI platform, workflow engine, marketplace, or auto-execution plane
- deciding release readiness for public source drops and trial releases
- protecting private tenant, customer proof, commercial pack, and credential material from public release

Current maintainer role: `helm-core`.

## 3. Decision Process

Small changes can be accepted by maintainer review when they stay inside existing contracts.

Changes need an issue or planning document first when they touch:

- schema or migration
- authentication, authorization, billing, trial lifecycle, or data retention
- external connectors, callbacks, imports, or official write paths
- customer-visible commitments, pricing, commercial packaging, or public claims
- plugin runtime, sandbox, orchestration, marketplace, or payment rails
- public release, private tenant separation, trademarks, certification, or governance

Maintainers can close proposals that conflict with the current controlled-trial boundary without implementing alternatives.

## 4. Contribution Rights

Contributors must only submit work they have the right to contribute under Apache-2.0.

Until a formal DCO or CLA workflow is automated, maintainers may ask contributors to add a `Signed-off-by` line or other rights confirmation before merging non-trivial contributions.

Do not submit:

- customer data
- private eval goldens
- customer proof packs
- proprietary workflow packs
- private connector credentials or endpoint details
- third-party code without a compatible license

## 5. Review Requirements

Every non-trivial pull request should include:

- goal
- changed files and affected surfaces
- validation commands and results
- boundary confirmation
- rollback note when behavior changes

UI changes must include visual verification. Security-sensitive changes must follow `SECURITY.md` and the repository validation chain.

## 6. Release Governance

Public source releases require:

- `LICENSE`, `NOTICE`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and `CHANGELOG.md` to be present
- `npm run check:public-release` to pass
- no known private tenant, credential, customer proof, commercial workflow pack, or customer-specific eval material in the public mirror
- release notes that state current controlled-trial limits

Cloud trial releases additionally require the data policy, sub-processor posture, retention boundary, and no-SLA posture to remain current.

## 7. Certification Governance

The words `Official`, `Certified`, `Helm Cloud`, and `Helm Enterprise` are reserved for maintainer-approved materials.

A third-party connector, workflow pack, deployment, or partner cannot claim certified status until the matching checklist exists and has passed manual review.

Certification is not a marketplace, payout rail, endorsement of every customer outcome, or automatic right to use Helm marks.

## 8. Conflict Resolution

When maintainers disagree, the safer boundary wins until an owner decision or formal review resolves the conflict.

Default tie-breakers:

1. protect customer and private material
2. preserve recommendation / commitment separation
3. preserve review-first official-write boundaries
4. keep open-source scope narrower than commercial operation
5. document the decision before implementation

## 9. Updating Governance

Governance changes require maintainer review and must update related docs or guards when applicable:

- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `docs/README.md`
- `scripts/public-release-guard.ts`
- relevant product / commercial boundary docs

## 10. Change Log

| Date | Change |
| --- | --- |
| 2026-04-28 | Initial governance file for Apache-2.0 open-source controlled trial |
