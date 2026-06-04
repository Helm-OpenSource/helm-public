---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Public launch posture. Private release receipts and customer deployment evidence are excluded.
---
# Helm Open Source And Cloud Trial Launch Posture / Helm 开源与 Cloud Trial 发布姿态

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文记录 Helm Core 与可选 Cloud Trial 路径的公开发布姿态。它不是发布批准，
也不能替代私有发布回执、负责人 Go/No-Go 或人工打标签决策。

可以公开的是 Apache-2.0 Core 源码、本地 Docker 快速启动、公开样板 Pack、
公开贡献 / 安全 / 治理文档，以及无服务等级协议的试用姿态。必须保留在私有侧的是
客户 overlay、客户部署证据、商业 Pack 实现细节、密钥轮换回执、
基础设施证明、控制面授权状态和私有发布负责人批准记录。

`npm run release:check` 只判断维护者是否可以进入人工打标签步骤；它不会创建
标签或 GitHub Release。后续试用版 / 稳定版发布列车必须在发布机器上
显式设置发布通道、目标标签和目标标题。试用版只能按预发布且
`--latest=false` 发布；稳定版必须使用稳定语义化版本标签并推进已有稳定线。

Cloud Trial 是 Apache-2.0 Core 之外的可选路径，默认不产生企业级服务等级协议。

## English Reference

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

When no release target is configured, the default remains the first public-Core
trial tag:

```bash
RELEASE_READINESS_FULL=true npm run release:check
```

For a later trial or stable train, maintainers must set the target explicitly on
the release machine:

```bash
HELM_RELEASE_CHANNEL=trial \
HELM_RELEASE_TARGET_TAG=v0.2.0-trial \
HELM_RELEASE_TARGET_TITLE="Helm v0.2.0-trial" \
RELEASE_READINESS_FULL=true \
npm run release:check
```

Supported release channels:

- `trial`: publishes as a prerelease with `--latest=false`.
- `stable`: requires a stable semver tag such as `v1.0.1` and must advance the
  existing stable line before the gate prints manual tagging commands.

If this repository already has a higher stable release tag, maintainers must not
let a lower trial tag replace the repository's latest stable release. In that
case, publish the trial tag as a prerelease with `--latest=false`, or update the
version strategy and supporting docs before tagging.

The release gate prints suggested manual commands based on the local tag state.
Those commands are guidance for a human maintainer; they are not executed by the
gate.

## Cloud Trial Boundary

Cloud Trial is optional and separate from the Apache-2.0 Core. It does not create
an enterprise SLA by default. Data policy and support posture are documented in:

- [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)
- [ON_CALL_AND_RESPONSE_SLA.md](../operations/ON_CALL_AND_RESPONSE_SLA.md)
- [PUBLIC_TRIAL_RUNBOOK.md](../pilot/PUBLIC_TRIAL_RUNBOOK.md)
