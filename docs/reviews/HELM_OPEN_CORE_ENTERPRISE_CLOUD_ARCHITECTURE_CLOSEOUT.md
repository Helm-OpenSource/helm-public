---
status: active
owner: helm-core
created: 2026-05-17
artifact_type: closeout
runtime_adoption: no-go
review_after: 2026-11-13
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Helm Open Core / Enterprise / Cloud Architecture Closeout

## 1. 结论

本轮把 Helm 中文 / 英文、Open Core / Enterprise / Cloud、Tenant Overlay、Deployment Profile、public mirror、release receipt 与 Codex / Claude 协作边界收成了可执行架构基线。

当前状态：**已成形但仍需下一层**。

理由：架构裁决、内部 ADR、Tenant Overlay / Deployment Profile 最小 contract、公开镜像 hygiene、release receipt 证据链、i18n fallback 收口和多代理协作协议均已入库并有本地验证；但 private Enterprise / Cloud repo、Tenant Overlay runtime loader、Cloud isolation gate、正式 secret-history remediation、真实 receipt、Docker smoke、redacted live DB calibration 仍未完成。

## 2. 本轮交付

| 类型 | 路径 |
|---|---|
| Architecture decision | [`docs/product/HELM_OPEN_CORE_ENTERPRISE_CLOUD_ARCHITECTURE.md`](../product/HELM_OPEN_CORE_ENTERPRISE_CLOUD_ARCHITECTURE.md) |
| Internal ADR draft | Internal-only draft exists, but the public closeout intentionally does not link private paths |
| Tenant Overlay contract | [`docs/product/HELM_TENANT_OVERLAY_CONTRACT.md`](../product/HELM_TENANT_OVERLAY_CONTRACT.md) / [`lib/tenant-overlays/contract.ts`](../../lib/tenant-overlays/contract.ts) / [`lib/tenant-overlays/resolver.ts`](../../lib/tenant-overlays/resolver.ts) |
| Deployment Profile contract | [`docs/product/HELM_DEPLOYMENT_PROFILE_CONTRACT.md`](../product/HELM_DEPLOYMENT_PROFILE_CONTRACT.md) / [`lib/deployment-profile/contract.ts`](../../lib/deployment-profile/contract.ts) |
| i18n fallback audit | [`docs/product/HELM_I18N_FALLBACK_AUDIT.md`](../product/HELM_I18N_FALLBACK_AUDIT.md) / [`lib/i18n/config.ts`](../../lib/i18n/config.ts) |
| Public mirror toolchain | `public-mirror:package-json`, `public-mirror:preflight`, `public-mirror:build`, `public-mirror:verify`, `public-mirror:clean-receipt`, `public-mirror:clean-receipt:check` |
| Release receipt checklist | [`docs/operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md`](../operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md) |
| Receipt schema directory | [`docs/operations/release-readiness-receipts/README.md`](../operations/release-readiness-receipts/README.md) |
| Codex / Claude protocol | [`docs/codex/CODEX_CLAUDE_COLLABORATION_PROTOCOL.md`](../codex/CODEX_CLAUDE_COLLABORATION_PROTOCOL.md) |
| Plan and status registry | [`PLANS.md`](../../PLANS.md) / [`docs/STATUS.md`](../STATUS.md) |

## 3. 已经完整成立

- Apache-2.0 license 基线仍成立：Open Core 继续以 `LICENSE` / `NOTICE` / `package.json` 为公开许可边界，`check:public-release` 会拦截缺失 / 非 Apache-2.0 baseline 与 conflicting SPDX header。
- `public-mirror:build` 会从 private worktree 生成 public-safe mirror candidate，并拒绝 repo 内目标、非空目标和隐式覆盖。
- `public-mirror:verify` 要求 package / registry projection 已完成，并要求 tenant-private / internal / commercial-private roots 在 mirror candidate 中物理缺席。
- `public-mirror:clean-receipt` 只在 build / preflight / verify 成功后写 receipt，并在 command evidence 中使用 `<candidate>`，不记录本机绝对路径。
- `public-mirror:clean-receipt:check` 可独立验证 `mirror-clean:<receipt-id>` receipt 文件、schema、matching id 和 public mirror build / verify 证据。
- `check:public-release` 继续扫描 source map、SBOM、Docker context、Dockerfile variant、artifact customer-name、commercial entitlement misuse、license baseline/header conflict 与 brand-runtime-force claim。

## 4. 已成形但仍需下一层

- Open Core / Enterprise / Cloud 发行边界已冻结为文档和 guard，但 private `helm-enterprise` / `helm-cloud` repo 尚未创建。
- Tenant Overlay 已有最小 contract、validator 和 read-only resolver，但 dynamic loader、DB persistence、authoring UI 和 private-ref dereference 尚未实现。
- Deployment Profile 已接入 `validate:env` 并 fail closed，但它只表达部署姿态，不是 license、security、source 或 entitlement 边界。
- i18n fallback 已覆盖 workspace shell、server page-loader 和主要 detail/list pages，但 actions、loading / not-found、query locale contract 与 message bundle 分层仍待下一层。
- Release receipt checklist 已有 7 个 receipt 和 `mirror-clean` 机器可验路径，但真实 release receipt 未齐前仍是 No-Go。
- Codex / Claude 协作协议已入库并有静态测试，但还未接入任务模板强制生成 handoff packet。
- License / trademark guard 已接入低误报自动门禁，但法务 trademark clearance、partner trademark grant 和 per-file missing-header 全量审查仍需人工 release review；不得把自动门禁写成法律意见或完整商标授权。

## 5. 刻意未做

- 不创建 Pack SDK。
- 不创建 marketplace。
- 不把任何 tenant-private implementation 公开成 public Pack。
- 不创建 `enterprise/` 或 `cloud/` runtime 目录。
- 不把 Deployment Profile 当 license / entitlement / security gate。
- 不做 Cloud billing、KMS、audit export、SSO、SAML、OIDC 或 Enterprise entitlement runtime。
- 不自动改写 git history、force-push 或替 owner 轮换云端 RDS 凭据。
- 不自动外发、自动承诺、自动 CRM 写回、自动审批或自动结算。

## 6. 风险项

| 风险 | 当前处理 |
|---|---|
| 历史 RDS root 凭据仍 reachable | `check:secret-history` 保持 FAIL；正式轮换、受控 rewrite / force-push 或 public mirror clean receipt 仍需 owner 操作 |
| Private build artifact 被误发成 public artifact | `check:public-release` 扫 source map / SBOM / Docker context；public release 只能走 mirror candidate |
| Deployment Profile 被误用成授权边界 | `lib/deployment-profile/contract.ts` 固定 `boundaryPosture.licenseBoundary=false` / `securityBoundary=false` / `sourceBoundary=false` / `entitlementBoundary=false` |
| License header / trademark legal clearance 不完整 | 本轮只接入低误报自动门禁：`LICENSE` / `NOTICE` / package license baseline、conflicting SPDX header、Helm registered mark 与 brand-runtime-force claim；per-file missing-header 全量补齐、商标注册 / 法务 clearance / partner grant 仍需人工 release checklist |
| Tenant Overlay 被误解成 Pack / marketplace | Tenant Overlay contract 明确只覆盖 branding / copy / locale / extension enablement / opaque private refs |
| Claude 输出未经吸收直接入库 | 协作协议要求 Codex 对 Claude 输出做 accept / rewrite / reject / defer，并由 Codex 负责最终验证 |
| 中文 / 英文线过早 fork 代码 | 当前裁决为 release / deploy 层分离，代码 repo 暂不 fork；未来 repo split 需另起 ADR |

## 7. 验证

本轮已执行并通过：

```bash
node -e "const s=require('./package.json').scripts; for (const k of ['public-mirror:package-json','public-mirror:preflight','public-mirror:preflight:check','public-mirror:build','public-mirror:verify','public-mirror:clean-receipt','public-mirror:clean-receipt:check']) { if (!s[k]) throw new Error(k); }"
npm run test -- lib/public-mirror-clean-receipt-checker.test.ts lib/public-mirror-clean-receipt-builder.test.ts lib/release-readiness-check.test.ts lib/public-mirror-tree-builder.test.ts lib/public-mirror-tree-verifier.test.ts lib/public-mirror-preflight.test.ts lib/public-mirror-smoke.test.ts lib/public-package-manifest-builder.test.ts lib/public-release-guard.test.ts
npm run public-mirror:clean-receipt:check -- --receipt mirror-clean:<temp-id> --repo-root <temp-receipt-repo-root>
npm run test -- lib/public-release-guard.test.ts lib/tenant-overlays/contract.test.ts lib/deployment-profile/contract.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/operating-signal-flow/projection.test.ts features/internal-operating-workspace/operating-signal-flow-map.test.tsx
npm run typecheck
npm run lint
npm run self-check
npm run check:public-release
npm run check:boundaries
npm run build
npm run quality:regression
npm run public-mirror:build -- --mirror-root <candidate> --force-clean
npm run public-mirror:smoke -- --repo-root <candidate>
git diff --check
```

结果：

- public mirror npm alias presence check：PASS。
- targeted mirror / release Vitest：9 files / 63 tests PASS。
- clean receipt checker CLI smoke：PASS。
- Claude audit remediation targeted tests：6 files / 55 tests PASS。
- `npm run typecheck`：PASS。
- `npm run lint`：PASS。
- `npm run self-check`：PASS（59 / 59）。
- `npm run check:public-release`：PASS（3709 files / 0 blockers），覆盖 license baseline/header conflict 与 brand-runtime-force claim。
- `npm run check:boundaries`：PASS，保留既有 warn-mode spawn inventory。
- `npm run build`：PASS。
- `npm run quality:regression`：PASS（32 files / 127 tests）。
- `npm run public-mirror:build` + `npm run public-mirror:smoke`：PASS；candidate copied 3171 file(s)，semantic scanned 1250 file(s)。
- `git diff --check`：PASS。

已知未通过 / 未执行：

- `npm run check:secret-history`：FAIL，63 reachable findings；3 个已知 2026-04-27 RDS root credential leak commits 仍可从 HEAD / main / origin refs 到达。
- full `npm run test -- --reporter=dot`：6 failed files / 15 failed tests / 664 passed files / 4760 passed tests；剩余失败均为 DB-backed Helm v2 runtime tests 的 MySQL root authentication failure；本轮新增 release/mirror tests 已全绿。
- Docker fresh-clone smoke、真实 Required Reviewer approval、redacted live DB calibration、正式 release receipt：需要 owner / operator 操作，Codex 不能伪造。

## 8. 下一阶段建议

1. Owner 先完成 RDS 凭据轮换，并决定正式 history remediation 还是 public mirror release path。
2. 用 `public-mirror:clean-receipt` 生成真实 `mirror-clean:<receipt-id>`，再用 `public-mirror:clean-receipt:check` 单独校验。
3. 若继续工程化，下一刀只做 Tenant Overlay runtime loader 的只读 resolver，不碰 schema / API / UI。
4. 若进入商业版代码边界，先另起 private repo split ADR，明确 license、entitlement、source boundary、CI 和 mirror sync 责任。
5. 若推进 Cloud，先做 Cloud isolation gate 和 deploy runbook，不提前做 billing / marketplace。

## 9. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-17 | 首版 closeout：收口 Open Core / Enterprise / Cloud 架构、public mirror toolchain、release receipt、Tenant Overlay、Deployment Profile、i18n fallback 与 Codex / Claude collaboration protocol；runtime adoption 继续 No-Go |
