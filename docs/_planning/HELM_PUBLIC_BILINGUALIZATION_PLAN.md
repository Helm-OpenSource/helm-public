---
status: active
owner: helm-core
created: 2026-06-03
review_after: 2026-06-17
public_safety: Public-safe bilingualization plan for helm-public. Do not include customer names, private handoff evidence, private deployment details, commercial Pack or Overlay implementation details, credentials, or release approval claims.
---

# Helm Public Bilingualization Plan / Helm 公开双语化计划

> **语言 / Language**: **中文主文本** + **English reference**

## 1. 目标 / Objective

把 `helm-public` 的公开入口、贡献入口、开发者上手路径和核心边界文档逐步做成
中英文双语，默认服务中国市场读者，同时保留英文社区、贡献者和外部 reviewer 的
可读性。

Make the public entry points, contribution surfaces, developer onboarding path,
and core boundary documents in `helm-public` bilingual. The default reader is
China-market delivery engineers, while English-speaking contributors and
reviewers must still be able to understand the public Core contract.

## 2. 当前结论 / Current Conclusion

本计划不声明全仓已经双语化完成。当前状态是：P0 入口正在落地，P1/P2 文档与
sample pack 仍需分批 PR 推进。

This plan does not claim that the whole repository is already bilingual. The
current state is: P0 entry surfaces are being implemented, while P1/P2 docs and
sample-pack surfaces still need staged PRs.

## 3. 双语标准 / Bilingual Standard

| 层级 / Tier | 标准 / Standard | 适用范围 / Applies To |
|---|---|---|
| P0 | 中文主文本 + English reference；必须保留 boundary 与 non-claim；Chinese-first with English reference; boundary and non-claim wording required | README、docs index、status、GitHub issue / PR templates、贡献入口 |
| P1 | 中文主文本 + English reference，或成对 `.md` / `.en.md`；Chinese-first with English reference, or paired `.md` / `.en.md` files | product、operations、roadmap、launch、trial、legal docs |
| P2 | 可读双语摘要 + 英文技术细节；Bilingual summary with English technical detail | sample pack、integration template、report skills、review receipts |
| P3 | 按需双语；Bilingual only when user-facing or contributor-facing | internal test fixture labels、low-level code comments、machine-only files |

## 4. 本轮 P0 范围 / Current P0 Scope

本轮只处理 public-facing intake 和文档入口：

This PR only handles public-facing intake and docs-entry surfaces:

1. `.github/pull_request_template.md`
2. `.github/ISSUE_TEMPLATE/*.yml`
3. `docs/README.md`
4. `docs/STATUS.md`
5. `docs/public-docs-manifest.json`
6. `CHANGELOG.md`
7. `CHANGELOG.en.md`

## 5. 刻意不做 / Deliberately Not In Scope

本计划不授权以下事项：

This plan does not authorize:

1. 把 P0 完成写成全仓双语完成。/ Treating P0 completion as full-repo bilingual completion.
2. 修改 runtime 行为。/ Runtime behavior changes.
3. 新增 Cloud、Enterprise、SLA 或客户部署 ready 声明。/ New Cloud, Enterprise, SLA, or customer deployment readiness claims.
4. 把 recommendation 写成 commitment。/ Turning recommendation into commitment.
5. 自动对外发送、自动写入、自动审批、执行或结算。/ Automatic external send, broad auto-write, automatic approval, execution, or settlement.
6. 把私有 WeChat / QR / community handoff 当作公开 activation proof。/ Treating private WeChat / QR / community handoff as public activation proof.

## 6. 后续批次 / Follow-Up Batches

| 批次 / Batch | 目标 / Goal | 交付物 / Deliverables |
|---|---|---|
| P1-A | product docs 双语化 / Bilingualize product docs | Open-source boundary、release reality、Golden Path、extension protocol |
| P1-B | operations docs 双语化 / Bilingualize operations docs | release train、open-source operating model、China accessibility packet、weekly packet |
| P1-C | roadmap、launch、trial、legal 双语化 / Bilingualize roadmap, launch, trial, and legal docs | roadmap、launch announcement、trial runbook、trial data policy |
| P2-A | sample pack 与 integration docs 双语化 / Bilingualize sample-pack and integration docs | `extensions/case-management-sample/`、`docs/integrations/INTEGRATION_TEMPLATE.md` |
| P2-B | review receipts 与 report-skill docs 双语摘要 / Add bilingual summaries to review receipts and report-skill docs | selected receipts、`external-resource-kit/` docs |

## 7. 验证 / Verification

每个批次至少运行：

Each batch should run at minimum:

```bash
git diff --check
npm run check:public-docs
npm run check:public-release
npm run check:boundaries
```

如果批次修改 runtime、类型、UI 或测试入口，还必须按仓库规则补跑：

If a batch changes runtime, types, UI, or test entry points, it must also run the
repository-required commands:

```bash
npm run self-check
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

## 8. 完成定义 / Definition Of Done

全工程双语化只有在以下条件同时成立时才可声明：

Full-project bilingualization may only be claimed when all of the following are
true:

1. P0、P1、P2 文件均已通过 PR 合并。/ P0, P1, and P2 files are merged through PRs.
2. `docs/STATUS.md` 已更新对应状态。/ `docs/STATUS.md` reflects the final status.
3. `docs/public-docs-manifest.json` 仍与文档树一致。/ `docs/public-docs-manifest.json` still matches the docs tree.
4. public guards 通过。/ Public guards pass.
5. 没有新增客户、私有部署、密钥或商业私有逻辑泄漏。/ No customer, private deployment, secret, or commercial-private leakage is introduced.
6. 没有新增 release-ready、SLA、Cloud / Enterprise ready 或客户承诺 overclaim。/ No release-ready, SLA, Cloud / Enterprise ready, or customer-commitment overclaim is introduced.

## 9. 变更记录 / Change Log

| 日期 / Date | 变更 / Change |
|---|---|
| 2026-06-03 | P1-B operations / roadmap / launch / trial / legal docs 开始加入中文主文本或 English reference summary；P1-B operations / roadmap / launch / trial / legal docs started adopting Chinese main text or English reference summaries |
| 2026-06-03 | P1-A product / boundary docs 开始加入中文主文本 + English reference；P1-A product / boundary docs started adopting Chinese main text plus English reference |
| 2026-06-03 | 建立 public-safe 双语化计划，并把 P0 intake 与 docs-entry 范围固定为独立 PR；Established the public-safe bilingualization plan and scoped P0 intake plus docs-entry work as a standalone PR |
