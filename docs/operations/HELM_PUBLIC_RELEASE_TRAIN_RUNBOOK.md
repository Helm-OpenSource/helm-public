---
status: active
owner: helm-core
created: 2026-06-03
review_after: 2026-07-03
public_safety: Public release train runbook. Lists public-safe cadence, gates, commands, and owner boundaries only; private receipts, credentials, customer evidence, and approval ids stay off-repo.
---
# Helm Public Release Train Runbook / Helm 公开 Release Train Runbook

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本 runbook 定义 `Helm-OpenSource/helm-public` 在第一轮 public-Core launch 之后
如何发布。它不是 release approval、commercial launch statement、production SLA、
customer deployment proof 或 Cloud / Enterprise readiness claim。

发布原则：public Core 通过小而可 review 的 PR 发布，不能直接 push 到 `main`；
green checks 是必要条件但不等于 release approval；trial release 保持 prerelease 且
非 latest，除非 owner 修改 version strategy；stable release 必须推进 stable semver line
并需要 owner gate；所有 private receipt、credential、customer evidence 和 approval id
都留在 repo 外。

`npm run release:check` 打印的 release command 只是给人工 maintainer 的 guidance；
命令本身不会创建 tag 或 GitHub Release。任何 release tag 前都必须重新跑 public safety
gates、activation / quality gates，并在 release machine 上设置必要的 manual receipt
变量。

## English Reference

This runbook defines how `Helm-OpenSource/helm-public` ships after the first
public-Core launch. It is not a release approval, commercial launch statement,
production SLA, customer deployment proof, or Cloud / Enterprise readiness
claim.

## Release Principles

- Public Core ships through small reviewed PRs, not direct pushes to `main`.
- Green checks are required but do not equal release approval.
- Trial releases stay prerelease and non-latest unless owner updates the version
  strategy.
- Stable releases must advance the stable semver line and require owner gate.
- All private receipts, credentials, customer evidence, and approval ids stay
  off-repo.
- Release commands printed by `npm run release:check` are guidance only; the
  command never creates tags or GitHub Releases.

## Cadence

| Cadence | Purpose | Trigger | Output | Gate |
| --- | --- | --- | --- | --- |
| Daily PR merge | Keep `main` current and reviewable | Small public-safe fix, docs update, guard, or DX improvement | Reviewed PR merged to `main` | Required checks, 1 approval, conversation resolution |
| Launch-week watch | Catch public activation friction | Public launch week or after a prerelease | Short maintainer / growth readout | GitHub Issues, Discussions, CI, quickstart feedback |
| Weekly operating packet | Decide next public-Core queue | Weekly maintainer review | OPC packet or maintainer status update | Public-safe evidence only |
| Trial prerelease | Ship activation or DX progress without stable claims | Material Golden Path, sample pack, docs, guard, or quickstart progress | `vX.Y.Z-trial` GitHub prerelease | Full release gate plus owner receipts |
| Stable candidate | Promote a stable public-Core baseline | Owner-approved stable scope and clean release metadata | `vX.Y.Z` GitHub Release | Full release gate, stable semver advance, owner Go/No-Go |
| Emergency patch | Fix safety, security posture, or blocking quickstart issue | Public-safe urgent fix | Patch PR and optional prerelease / stable patch | Minimal targeted gate plus required full gate before tag |

## Daily PR Merge Flow

1. Start from current `origin/main`.
2. Keep scope small: one behavior, docs, guard, or release governance change.
3. Run targeted local checks for the touched area.
4. Open a PR with scope, boundary, verification, and residual risk.
5. Wait for required GitHub checks and at least one approving review.
6. Merge through the PR path only.
7. Confirm post-merge CI / Preflight on `main`.

Required `main` protections:

- `Lint + Typecheck + Boundary`
- `Type Check`
- `Lint`
- `Repo Guards`
- `Validate Environment`
- `Build`
- `Test`
- `Public Guard Regression`
- `Public Structure Smoke`
- one approving review
- conversation resolution

## Release Candidate Flow

1. Select the release channel:
   - `trial` for `vX.Y.Z-trial`
   - `stable` for `vX.Y.Z`
2. Select a candidate `main` SHA after post-merge CI is green.
3. Move `CHANGELOG.md` / `CHANGELOG.en.md` entries from `Unreleased` into the
   candidate release section when the release is real, not during exploratory
   checks.
4. Run the configured release gate:

```bash
HELM_RELEASE_CHANNEL=trial \
HELM_RELEASE_TARGET_TAG=v0.2.0-trial \
HELM_RELEASE_TARGET_TITLE="Helm v0.2.0-trial" \
RELEASE_READINESS_FULL=true \
npm run release:check
```

5. Set the seven `RELEASE_READINESS_*` manual receipt variables only on the
   release machine.
6. Confirm the manual tagging strategy has no blockers.
7. Owner performs the manual tag / GitHub Release commands printed by the gate.
8. Watch post-release CI, Issues, Discussions, and quickstart feedback.

## Required Local Gates

FAST release rehearsal:

```bash
npm run release:check
```

Full release gate before tag:

```bash
RELEASE_READINESS_FULL=true npm run release:check
```

Public safety gates:

```bash
npm run check:public-docs
npm run check:public-release
npm run check:secret-history
npm run check:public-commit-metadata
npm run check:boundaries
```

Activation and quality gates:

```bash
npm run delivery:doctor
npm run pack:fixture-check
npm run eval:headless-signal-interface
npm run eval:operating-signal-flow
npm run test
npm run build
npm run quality:regression
npm run e2e
```

Docker smoke should be rerun on a Docker-enabled host before a release tag:

```bash
npm run smoke:docker:d2
```

## Manual Receipt Boundary

The release machine must set:

- `RELEASE_READINESS_CREDENTIAL_ROTATED`
- `RELEASE_READINESS_SECRET_HISTORY_REMEDIATED`
- `RELEASE_READINESS_DOCKER_SMOKE_PASSED`
- `RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY`
- `RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE`
- `RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID`
- `RELEASE_READINESS_CALIBRATION_REPORT`

Do not commit the raw values. Do not paste private approval ids, credential
rotation records, customer evidence, or deployment receipts into public docs,
issues, PRs, release notes, or discussions.

## Version Policy

Trial release:

```bash
HELM_RELEASE_CHANNEL=trial
HELM_RELEASE_TARGET_TAG=v0.2.0-trial
HELM_RELEASE_TARGET_TITLE="Helm v0.2.0-trial"
```

The gate prints prerelease commands with `--latest=false`.

Stable release:

```bash
HELM_RELEASE_CHANNEL=stable
HELM_RELEASE_TARGET_TAG=v1.0.1
HELM_RELEASE_TARGET_TITLE="Helm v1.0.1"
```

The gate blocks stable tags that do not advance the existing stable line. This
prevents duplicate `Latest` posture and keeps the older `V1.0.0` release from
silently confusing a lower or duplicate stable candidate.

## Post-Release Watch

Within the first 24 hours after a tag:

- confirm `main` CI and Preflight are green;
- confirm the release is draft / prerelease / latest exactly as intended;
- check open PRs, Issues, and Discussions;
- capture activation blockers from quickstart or Golden Path reports;
- route private-security or customer-specific reports out of the public repo;
- update the maintainer status or weekly packet with public-safe evidence.

## Hold Or Roll Back

Hold the next release train when:

- any required check fails;
- `release:check` reports a manual receipt gap;
- stable release strategy reports a version blocker;
- public-release guard or secret-history guard reports a blocker;
- Docker quickstart cannot be reproduced;
- owner Go/No-Go is missing;
- release wording would imply Cloud, Enterprise, SLA, customer deployment,
  certified partner, marketplace, sandbox, or automatic external action.

Rollback is a new PR or a follow-up release. Do not rewrite public tags or
release history unless owner explicitly approves a remediation plan and records
the public-safe reason.

## Non-Claims

- No production SLA.
- No complete enterprise SSO / SCIM / immutable audit platform.
- No third-party plugin sandbox.
- No runtime marketplace.
- No automatic external send, approval, settlement, execution, or customer
  commitment.
- No claim that public Core alone proves Helm Cloud / Enterprise readiness.

## Change Log

- 2026-06-03: Established the reusable public-Core release train runbook after
  the first `v0.1.0-trial` prerelease.
