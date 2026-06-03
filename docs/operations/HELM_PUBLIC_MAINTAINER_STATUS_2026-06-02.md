---
status: active
owner: helm-core
created: 2026-06-02
review_after: 2026-06-09
public_safety: Public maintainer operating baseline. Records repository, release, CI, community, and governance status only; no private approval ids, credentials, customer data, or deployment evidence.
---
# Helm Public Maintainer Status / Helm 公开维护者状态 - 2026-06-02

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文是 `helm-public` 在 2026-06-01 公开后的第一份 maintainer operating
baseline。它是 project-health snapshot，不是 release approval、commercial SLA、
customer commitment 或 Cloud / Enterprise readiness statement。

范围只包含公开 GitHub repository surface、release / tag posture、`main` 上的 CI /
guard status、public docs / contribution entry points，以及当前 maintainer risks 和
next operating queue。私有 Pack、Overlay、客户部署、control-plane readiness、私有
owner approval record、credential rotation receipt、legal reviewer record，以及自动
write / send / approval / settlement / customer commitment path 均不在本状态表内。

该 baseline 的运营含义是：public Core repo、docs index、CI / Preflight、branch
protection、prerelease tag、launch announcement 和 issue / PR templates 已成立；
maintainer operating loop、issue triage、community onboarding、Golden Path external
testing、release metadata hygiene、required-check drift monitoring 和 day-7 readout
仍需下一层执行。

## English Reference

This note is the first maintainer operating baseline after `helm-public` became
public on 2026-06-01. It is a project-health snapshot, not a release approval,
commercial SLA, customer commitment, or Cloud / Enterprise readiness statement.

## Scope

In scope:

- Public GitHub repository surface.
- Release and tag posture.
- CI / guard status on `main`.
- Public docs and contribution entry points.
- Current maintainer risks and next operating queue.

Out of scope:

- Helm Cloud / Enterprise delivery readiness.
- Private Pack, Overlay, customer deployment, or control-plane readiness.
- Private owner approval records, credential rotation receipts, and legal
  reviewer records.
- Any automatic write, send, approval, settlement, or customer commitment path.

## Current Evidence Snapshot

| Area | Status | Evidence |
| --- | --- | --- |
| Repository visibility | Public | GitHub repository `Helm-OpenSource/helm-public`, `visibility=PUBLIC`, `isPrivate=false` |
| Default branch | `main` | GitHub default branch metadata |
| License | Apache-2.0 | GitHub license metadata and `LICENSE` |
| Latest GitHub `main` head | Synced | `main@e8994a0cccb379e10423650d84049a5b17d227da` / `origin/main@e8994a0cccb379e10423650d84049a5b17d227da` |
| Latest `main` checks | Green | CI and Preflight succeeded for `e8994a0cccb379e10423650d84049a5b17d227da` on 2026-06-03 |
| Branch protection | Enabled | Strict required checks, PR review required, admin enforcement on, force pushes and deletions disabled |
| Trial release | Published as prerelease | `v0.1.0-trial`, published 2026-06-01 13:54:20 UTC |
| Open PR queue | Clear | `gh pr list --state open` returned `[]` on 2026-06-03 |
| Open issue queue | One public onboarding issue | Issue #39: Golden Path testing, labels `documentation`, `good first issue`, `help wanted` |
| Discussions | Open | Discussion #49 launch announcement and #41 welcome thread |
| Contribution intake | Established | `.github/ISSUE_TEMPLATE/*` and `.github/pull_request_template.md` are present |
| Public docs curation | Established | `docs/public-docs-manifest.json` plus `npm run check:public-docs` |

## Four-Tier Maintainer Readout

| Tier | Items |
| --- | --- |
| Already established | Public Apache-2.0 Core repository; public docs index; CI / Preflight on `main`; branch protection; prerelease tag and launch announcement; issue / PR templates; release train runbook; no open PR backlog |
| Formed but needs next layer | Maintainer operating loop; issue triage; community onboarding; Golden Path external testing; release metadata hygiene; required-check drift monitoring; day-7 growth readout |
| Deliberately not done | Release latest-status changes, Cloud / Enterprise readiness claims, stable release approval |
| Risks | GitHub community profile docs metadata still points to `tree/master/docs`; older `V1.0.0` remains repository Latest while `v0.1.0-trial` is the public Core prerelease; required check names must be kept in sync with workflow job names |

## Maintainer Risk Queue

### P0 - Protect `main` - closed on 2026-06-02

GitHub branch protection is now enabled for `main`.

Current protection:

- Strict required status checks:
  - `Lint + Typecheck + Boundary`
  - `Type Check`
  - `Lint`
  - `Repo Guards`
  - `Validate Environment`
  - `Build`
  - `Test`
  - `Public Guard Regression`
  - `Public Structure Smoke`
- Pull request review required with at least one approving review.
- Stale reviews are dismissed.
- Admin enforcement is enabled.
- Force pushes and branch deletions are disabled.
- Conversation resolution is required.

Operational caution: if workflow job names change, maintainers must update the
required-check context list before merging the workflow rename.

### P1 - Add contribution intake templates - closed on 2026-06-02

Issue templates and the pull request template now give public contributors a
structured place to declare goal, boundary confirmation, verification commands,
and rights-to-contribute status.

### P1 - Establish reusable release train runbook - closed on 2026-06-03

The release train now has a public-safe runbook and parameterized
`release:check` target controls:

- `HELM_RELEASE_CHANNEL=trial|stable`
- `HELM_RELEASE_TARGET_TAG=<tag>`
- `HELM_RELEASE_TARGET_TITLE=<release title>`

The runbook preserves the existing owner gate: `release:check` never creates
tags or GitHub Releases, and private receipt values stay off-repo.

### P1 - Fix repository metadata drift

GitHub Community Profile reports documentation at
`https://github.com/Helm-OpenSource/helm-public/tree/master/docs` while the
default branch is `main`. Repository metadata should point to the current
`main` docs surface.

### P1 - Clarify release latest posture

`v0.1.0-trial` is correctly published as a prerelease with `--latest=false`.
However, GitHub still shows older `V1.0.0` as Latest. This is documented in the
visibility Go/No-Go receipt, but maintainers should decide whether to leave it
as-is, deprecate it, or update release notes to reduce contributor confusion.

### P2 - Close post-launch manual receipt gaps

The visibility Go/No-Go record still lists public-safe follow-ups for the raw
credential-rotation receipt, real reviewer approval id, and rerun with real
recorded values on the release machine. These should remain off-repo unless a
public-safe machine receipt is created.

## Next Operating Queue

1. Decide release latest posture for old `V1.0.0` versus `v0.1.0-trial`.
2. Correct repository documentation metadata from `master/docs` to `main/docs`.
3. Run the day-7 public growth readout on 2026-06-09 using public-safe evidence.
4. Use the release train runbook for the next `v0.2.0-trial` candidate only
   after full gate and owner receipt checks.
5. Keep issue #39 active as the first public Golden Path testing route and
   convert verified feedback into small PRs only after scope review.

## Non-Claims

- No production SLA.
- No complete enterprise SSO / SCIM / immutable audit platform.
- No third-party plugin sandbox.
- No runtime marketplace.
- No automatic external send, approval, settlement, execution, or customer
  commitment.
- No claim that public Core alone proves Helm Cloud / Enterprise readiness.
