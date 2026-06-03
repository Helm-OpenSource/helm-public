---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-09-01
public_safety: Public-safe decision record. Captures the Go decision, gate evidence sources, and follow-up obligations only. No credentials, no raw approval evidence; the authoritative reviewer-approval record lives off-repo.
---
# Helm Public Core Visibility Go/No-Go Decision / Helm Public Core 可见性 Go/No-Go 决策 (2026-06-01)

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文件记录 2026-06-01 owner（founder identity）给出的 visibility **GO** 决策。
repository visibility 已由 owner 作为最终 manual action flip 为 public。随后 owner 批准
创建 `v0.1.0-trial` tag、GitHub prerelease（`--latest=false`）和 GitHub Discussions
announcement。

release gate 在 tagging 前以 FULL mode 重新运行并显示 ALL CLEAR：15/15 automated
steps 与 7/7 manual receipts 均满足。历史安全证据由 clean-history receipt 记录。

仍需跟进的 audit gaps：ops 保存 RDS credential-rotation receipt；用 legal document
中的真实 reviewer approval id 替换 placeholder；在 release machine 上用真实 recorded
values 重新运行 full release gate。

该 GO 决策不改变 Helm 硬边界：recommendation 不等于 commitment，review-first，
不 auto-write / send / approve / settle，Core 不依赖 Pack 或 Overlay，也不声明
`100% synthetic` provenance。

## English Reference

## Decision

**GO** — recorded by the owner (founder identity). Repository visibility was
flipped to **public** by the owner as the final manual action (gate step 7).

## Release and announcement record

Owner approval to create the tag, GitHub Release, and external announcement was
given on 2026-06-01 after the visibility Go decision.

Actions completed:

- Tag `v0.1.0-trial` was created and pushed for
  `main@420b8e3140dc8241cb75f721ea70c80fcde719c7`.
- GitHub Release
  [`Helm v0.1.0-trial`](https://github.com/Helm-OpenSource/helm-public/releases/tag/v0.1.0-trial)
  was published as a **pre-release** with `--latest=false`.
- Existing release `V1.0.0` remains the repository **Latest** release.
- External announcement was posted in GitHub Discussions:
  [#49 Helm Public Core is now open source (Apache-2.0)](https://github.com/Helm-OpenSource/helm-public/discussions/49).

The release gate was rerun in FULL mode immediately before tagging:

```bash
RELEASE_READINESS_FULL=true npm run release:check
```

Result: **ALL CLEAR** — 15/15 automated steps and 7/7 manual receipts satisfied.

## Gate evidence

`RELEASE_READINESS_FULL=true npm run release:check` → **ALL CLEAR**
(15/15 automated steps + 7/7 manual receipts).

Automated steps green: validate:env, delivery:doctor, pack:fixture-check,
eval:headless-signal-interface, eval:operating-signal-flow, check:public-release,
check:secret-history, check:boundaries, self-check, typecheck, lint, test, build,
quality:regression, e2e.

History safety (gate steps 3–4) is recorded in
[HELM_PUBLIC_CLEAN_HISTORY_RECEIPT_V1.md](HELM_PUBLIC_CLEAN_HISTORY_RECEIPT_V1.md):
sanitized 2026-05-26 snapshot, known-compromised commits absent, full-history
gitleaks scan clean.

## Manual receipt sources

| Receipt | Value source | Evidence strength |
| --- | --- | --- |
| docker_smoke_passed | 2026-06-01 | [D2 smoke receipt](HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-06-01.md) in repo |
| audit_trace_public_posture | claim_withdrawn | recorded in the calibration receipt |
| calibration_report | path in repo | [calibration receipt](HELM_BUSINESS_ADVANCEMENT_PHASE3_REDACTED_LIVE_CALIBRATION_REPORT_V1.md) present |
| secret_history_remediated | 2026-06-01 | check:secret-history PASS + clean-history receipt in repo |
| credential_rotated | 2026-06-01 | **owner-attested; no machine receipt yet** |
| reviewer_approval_record_id | owner-attested | **5-role review passed per owner; authoritative record on off-repo legal document; env used a placeholder id pending the real record id** |

## Follow-up obligations (close the audit gaps post-launch)

1. Ops files the RDS credential-rotation receipt (console record, secret-store
   update, access-log review).
2. Replace the placeholder reviewer approval id with the real record id from the
   legal document and file a machine-readable approval receipt.
3. Re-run `RELEASE_READINESS_FULL=true npm run release:check` on the release
   machine with the real recorded values.

## Boundaries

This Go decision does not alter Helm's hard boundaries: recommendation ≠
commitment, review-first, no auto-write / send / approve / settle, no Core
dependency on Pack or Overlay. It does not assert `100% synthetic` provenance
(see the synthetic provenance gate).
