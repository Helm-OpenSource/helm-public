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

本文是 `helm-public` 在 2026-06-01 公开后的第一份维护者运营基线。它是项目健康快照，
不是发布批准、商业服务等级承诺、客户承诺，也不是 Helm Cloud / Helm Enterprise 就绪声明。

范围只包含公开 GitHub 仓库表面、发布与标签姿态、`main` 上的 CI / 守卫状态、
公开文档 / 贡献入口，以及当前维护者风险和下一步运营队列。私有 Pack、Overlay、客户部署、
控制面就绪、私有负责人批准记录、凭据轮换回执、法律复核记录，以及自动写入 / 发送 / 批准 /
结算 / 客户承诺路径均不在本状态表内。

该运营基线的含义是：公开 Core 仓库、文档索引、CI / 预检、分支保护、预发布标签、
发布公告和议题 / PR 模板已成立；维护者运营闭环、议题分诊、社区上手、黄金路径
外部测试、发布元数据卫生、必需检查漂移监控和第 7 日读数仍需下一层执行。

证据摘要：仓库已经是公开 Apache-2.0 Core 仓库；默认分支是 `main`；`main` 头部与
`origin/main` 已同步；最新 `main` 检查为绿；分支保护已开启并要求严格状态检查、PR 复核、
管理员执行、禁止强推 / 删除和会话解决；`v0.1.0-trial` 已作为预发布发布；公开议题队列
保留黄金路径测试入口；Discussions、议题模板、PR 模板和公开文档清单已成立。

四档摘要：已经完整成立的是公开 Core 仓库、文档索引、`main` 上的 CI / 预检、分支保护、
预发布标签、发布公告、议题 / PR 模板、发布列车作业手册和无开放 PR 积压队列。已成形但仍需
下一层的是维护者运营闭环、议题分诊、社区上手、黄金路径外部测试、发布元数据卫生、
必需检查漂移监控和第 7 日增长读数。刻意未做的是更改 GitHub 最新版本标识状态、声明 Cloud /
Enterprise 就绪或给出稳定版发布批准。风险项是 GitHub 社区资料文档元数据仍指向
`tree/master/docs`、旧 `V1.0.0` 仍显示为仓库最新版本，以及必需检查名称需要与工作流任务名称保持同步。

风险队列摘要：`main` 分支保护、贡献入口模板和可复用发布列车作业手册已关闭；仍需处理的是
仓库文档元数据漂移、旧 `V1.0.0` 与 `v0.1.0-trial` 的最新版本标识姿态，以及发布后
人工回执缺口的公开安全表达。

下一步摘要：先决定旧 `V1.0.0` 与 `v0.1.0-trial` 的最新版本标识姿态，再把仓库文档元数据
从 `master/docs` 修到 `main/docs`，随后在 2026-06-09 用公开安全证据跑第 7 日增长读数；
下一次 `v0.2.0-trial` 候选必须先完成完整门禁和负责人回执检查；议题 #39 继续作为首个公开
黄金路径测试路线，反馈必须先做范围复核，再转成小 PR。

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
