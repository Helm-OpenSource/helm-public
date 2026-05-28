---
status: active
owner: 李建乐
created: 2026-05-26
review_after: 2026-05-31
archive_trigger:
  - GitHub Apache-2.0 public release is completed and release closeout supersedes this review
  - The 2026-05-31 public release target is replaced by a new dated plan
---

# Helm Public GitHub Surface Review 2026-05-26

更新时间：2026-05-26
状态：Repo-side public surface review completed; release-chain remains blocked
目标版本：`v0.1.0-trial`

## 1. 结论

截至 `2026-05-26`，公开仓首页与公开治理入口的 repo-side 人工审校已经完成，今天在仓库内能完成的收口项已经补齐：

1. README / CONTRIBUTING / public trial runbook / launch post draft 中的 GitHub 仓库占位符已替换为真实仓库地址 `Helm-OpenSource/helm-public`。
2. `CONTRIBUTING.md` 中对 internal-only docs 的直接引用已移除，避免公开镜像出现死链。
3. 当前 repo-side public hygiene 仍然保持绿灯：
   - `npm run check:public-release`：PASS
   - `HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history`：PASS

但 release 级结论没有变化：**当前仍然是 No-Go**。原因不是公开文案，而是公开发布关键前置仍未满足：

1. 没有 cloud-side secret rotation / revocation receipt。
2. `npm run check:secret-history` 仍然 FAIL。
3. 没有 post-rewrite validation evidence。
4. 没有真实 `mirror-clean:<receipt-id>`。

## 2. 本次审校范围

本次人工审校覆盖以下 public entry docs / release-facing artifacts：

1. [README.md](../../README.md)
2. [docs/README.md](../README.md)
3. [GOVERNANCE.md](../../GOVERNANCE.md)
4. [CONTRIBUTING.md](../../CONTRIBUTING.md)
5. [HELM_PUBLIC_ROADMAP.md](../roadmap/HELM_PUBLIC_ROADMAP.md)
6. [PUBLIC_TRIAL_RUNBOOK.md](../pilot/PUBLIC_TRIAL_RUNBOOK.md)
7. [HELM_V0_1_0_TRIAL_LAUNCH_POST_DRAFT_V1.md](../launch/HELM_V0_1_0_TRIAL_LAUNCH_POST_DRAFT_V1.md)
8. [.env.example](../../.env.example)
9. [.dockerignore](../../.dockerignore)
10. [package.json](../../package.json)

## 3. 今天完成的修复

### 3.1 已修复项

1. README 的 clone URL 从占位符改为真实仓库地址。
2. README 两处 Discussions 链接从占位符改为真实仓库 Discussions。
3. README 中 `partners@helm.<domain>` 占位符已移除，统一收敛到 Discussions / `integration:` issue 入口。
4. public trial runbook 的 GitHub Issues 链接从占位符改为真实仓库 Issues。
5. launch post draft 中仓库地址与短链 CTA 从占位符改为真实仓库地址。
6. `CONTRIBUTING.md` 不再直接引用 internal-only docs，改为公开可访问的边界文档。

### 3.2 本轮没有发现的问题

1. `package.json` 的 `license` 字段仍为 `Apache-2.0`，与公开姿态一致。
2. `.dockerignore` 继续忽略 internal-only docs 目录，与公开镜像边界一致。
3. `GOVERNANCE.md` 继续保持 no-SLA / 非法律实体 / 非商标许可 / 非商业支持合同边界。
4. `HELM_PUBLIC_ROADMAP.md` 与 `PUBLIC_TRIAL_RUNBOOK.md` 继续把 `v0.1.0-trial` 写成计划目标，而不是已发布事实。

## 4. 当前仍未关闭的 blocker

以下问题不是今天 repo-side 文档审校能解决的，因此必须继续保持 `No-Go` 口径：

1. `npm run check:secret-history` 仍然 FAIL，当前已知 compromised commit reachability 仍可达。
2. 云端旧 credential 是否已失效，当前仓库内没有可验证证据。
3. 正式 history rewrite 尚未执行，post-rewrite validation 证据不存在。
4. 真实 public mirror candidate 与真实 `mirror-clean:<receipt-id>` 仍不存在。

## 5. 验证结果

`2026-05-26` 本地验证：

```bash
npm run check:public-release
# PASS — scanned 3824 files; no public-mirror blockers

HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history
# PASS — no new known compromised commits beyond baseline origin/main; 108 baseline-known findings suppressed

npm run check:secret-history
# FAIL — 108 known compromised commit reachability findings
```

## 6. 结论口径

截至今天，**可在仓库内完成的 public GitHub surface review 已完成**，并已修掉确认存在的 public-safe wording / dead-link / placeholder 问题。

但截至今天，**2026-05-31 公开发布目标仍应视为 No-Go in active status**，直到以下四项至少形成完整证据链：

1. secret rotation / revocation receipt
2. post-rewrite `check:secret-history` PASS
3. real `mirror-clean:<receipt-id>`
4. final Go / No-Go decision packet
