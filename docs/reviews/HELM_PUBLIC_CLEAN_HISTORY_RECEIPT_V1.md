---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-09-01
public_safety: Public-safe history-scan receipt. Records scan evidence and classification only. Contains no real credentials; all referenced strings are checked-in placeholders or test fixtures already present in the public tree.
---
# Helm Public Clean History Receipt V1 / Helm 公开 Clean History 回执 V1

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文件是仓库可见性门禁中历史级步骤的公开安全回执：公开 Core 历史不包含真实密钥，
完整历史扫描已确认。它不轮换凭据、不批准发布，也不切换仓库可见性；这些仍是负责人动作。

公开 Core 历史是清洗后的快照，不是完整私有单体仓库历史。已知的私有源仓受损提交不在本仓，
且从任何引用都不可达。`gitleaks` 报告的 6 个发现均已被分类为非密钥或刻意构造的假夹具，
用于测试密钥检测器；没有真实凭据。

未来如果历史被重写，或新提交增加形似凭据的内容，必须重新扫描。

## English Reference

## Purpose

This is the public-safe receipt for the **history-level** steps of the
repository visibility gate (see
[HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](../product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)
§6, steps 3–4): the public Core history is free of real secrets, and a
full-history scan confirms it.

It does **not** rotate credentials, approve a release, or flip repository
visibility. Those remain owner actions (gate steps 1, 6, 7).

## History Shape

- Public Core history is a sanitized snapshot, not the full private-monorepo
  history.
- Root commit: `e8c5e9a` (2026-05-26) — "Import public snapshot".
- Commit count on `main` at receipt time: 63.
- The three known-compromised commits (2026-04-27 RDS root credential leak,
  tracked in `scripts/secret-history-check.ts`) are **not present** in this
  repository, so they are unreachable from any ref.

## Scan Evidence

| Check | Tool / command | Result |
| --- | --- | --- |
| Known-compromised commit reachability | `npm run check:secret-history` | PASS — no known compromised commits reachable in 31 ref(s) |
| Working-tree secret / tenant-private guard | `npm run check:public-release` | PASS — 0 public-mirror blockers |
| Full-history secret scan | `gitleaks git --log-opts="origin/main"` (gitleaks 8.30.1) | 6 findings, all classified non-secret (see below); 0 real secrets |

## Full-History Scan Finding Classification

`gitleaks` reported 6 findings across the scanned commits. Each was inspected and
classified as a non-secret. None is a real credential.

| # | Rule | Location | Classification |
| --- | --- | --- | --- |
| 1 | vault-service-token | `lib/extensions/registry-contract.ts` | False positive — the `s.<name>` token regex matched a local-variable dereference (`s.<field>`), not a Vault token. |
| 2 | private-key | `lib/billing/payment-provider-resolver.test.ts` | Test placeholder — a PEM block whose key body is the literal three-letter string `abc`. |
| 3 | private-key | `lib/billing/payment-provider-resolver.test.ts` | Test placeholder — same three-letter-body PEM block in a second payment test case. |
| 4 | generic-api-key | `lib/billing/payment-provider-resolver.test.ts` | Test placeholder — a repeating 16-char dummy hex value assigned to `WECHAT_PAY_API_V3_KEY`. |
| 5 | jwt | `lib/delivery-engineer/pack-fixture-check.test.ts` | Deliberately fake fixture — a synthetic JWT fed to the fixture-check test to verify the secret detector flags it. |
| 6 | generic-api-key | `lib/delivery-engineer/pack-fixture-check.test.ts` | Deliberately fake fixture — synthetic `slackToken` / `ghToken` strings used to test secret detection. |

Findings 5 and 6 are inputs to a test whose purpose is to confirm that the pack
fixture check rejects secret-shaped values; they must remain in the tree for that
test to be meaningful.

## Reproduction

```bash
npm run check:secret-history
npm run check:public-release
gitleaks git --log-opts="origin/main" --redact --no-banner
```

## Non-Claims

This receipt does not claim:

- that exposed credentials in the private source repository have been rotated
  (gate step 1, owner action);
- release approval or a Go/No-Go decision (gate steps 5–6, owner actions);
- permission to flip repository visibility (gate step 7, owner action);
- `100% synthetic` provenance for sample fixtures (see the separate synthetic
  provenance gate).

A future scan must be re-run if history is rewritten or new commits add
credential-shaped content.
