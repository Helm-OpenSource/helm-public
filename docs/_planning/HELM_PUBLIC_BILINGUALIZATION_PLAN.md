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

本计划不声明全仓已经双语化完成。当前状态是：P0 入口、docs entry、P1 product /
operations / roadmap / launch / trial / legal 文档已分批落地；P2 sample pack、review
receipts、templates、report-skill 与 contributor-facing surfaces 正在推进。

This plan does not claim that the whole repository is already bilingual. The
current state is: P0 entry surfaces, docs entry points, and P1 product /
operations / roadmap / launch / trial / legal docs have landed in staged
commits; P2 sample pack, review receipts, templates, report-skill, and
contributor-facing surfaces are underway.

## 3. 双语标准 / Bilingual Standard

| 层级 / Tier | 标准 / Standard | 适用范围 / Applies To |
|---|---|---|
| P0 | 中文主文本 + English reference；必须保留 boundary 与 non-claim；Chinese-first with English reference; boundary and non-claim wording required | README、docs index、status、GitHub issue / PR templates、贡献入口 |
| P1 | 中文主文本 + English reference，或成对 `.md` / `.en.md`；Chinese-first with English reference, or paired `.md` / `.en.md` files | product、operations、roadmap、launch、trial、legal docs |
| P2 | 可读双语摘要 + 英文技术细节；Bilingual summary with English technical detail | sample pack、integration template、report skills、review receipts |
| P3 | 按需双语；Bilingual only when user-facing or contributor-facing | internal test fixture labels、low-level code comments、machine-only files |

## 3.1 交付工程师友好标准 / Delivery-Engineer-Friendly Standard

每个公开入口和可贡献 surface 不只需要双语，还必须让交付工程师快速回答：

Each public entry point and contributor-facing surface must be bilingual and
help a delivery engineer quickly answer:

1. 我应该先检查什么？/ What should I inspect first?
2. 我可以 fork 或复制哪一层？/ What can I fork or copy?
3. 第一处安全改动在哪里？/ Where is the first safe change?
4. 我应该跑哪些命令？/ Which commands should I run?
5. 什么证据可以 public-safe 地提交？/ What evidence can I submit publicly?
6. 哪些行为永远不该自动化或外发？/ Which actions must never be automated or externally sent?

如果一份文档只翻译了术语，但没有说明 first-change proof、verification、evidence route
和 boundary，它只能算“已成形但仍需下一层”，不能算双语化完成。

If a document only translates terms but does not explain the first-change proof,
verification, evidence route, and boundary, it is only "formed but needs the next
layer" and must not be counted as bilingualization complete.

## 3.2 源码 / UI 审计标准 / Source And UI Audit Standard

源码层的双语化不要求翻译变量名、enum、trace key、test fixture 或机器协议字段。
需要检查的是用户可见 UI、API 错误文案、display-copy、公开页面 metadata、表单提示和
contributor-facing templates 是否能在 `zh-CN` 默认语言下可读，并在 `en-US` 下保留
英文 reviewer 可读性。

Source-level bilingualization does not require translating variable names,
enums, trace keys, test fixtures, or machine protocol fields. The audit target is
user-visible UI, API error copy, display-copy, public page metadata, form hints,
and contributor-facing templates: they must be readable under the default
`zh-CN` locale and remain reviewable under `en-US`.

本轮源码审计结果：

This PR's source audit result:

1. `lib/i18n/config.ts` 仍以 `zh-CN` 为默认 UI locale，并保留 `en-US` 切换。
   `lib/i18n/messages.ts` 提供 shell / CRM / settings / diagnostics / capture 的中英文 copy。
2. 首页、登录页、trial 页、programs 页、workspace shell、layout、display-copy
   modules 和主要 API action messages 均使用 locale 分支或 message resolver。
3. 抽查 264 个 `.tsx` 文件后，少量硬编码英文 UI 标签已修正；workspace runtime
   可见面板中的指标标签、加载策略和基准矩阵文案继续收口，直接 JSX 英文标签扫描已降为 0。
   剩余品牌名、语言名、provider 名、trace key 和 runtime enum 列为 P3，不作为中文 UI 缺口。
4. 后续如果新增 public-facing UI，必须优先接入 `resolveUiLocale` / `getUiMessages`
   或对应 feature display-copy，而不是直接写单语长文案。

1. `lib/i18n/config.ts` keeps `zh-CN` as the default UI locale and preserves the
   `en-US` switch.
2. The home, login, trial, programs, workspace shell, layout, display-copy
   modules, and main API action messages use locale branches or message
   resolvers.
3. After sampling 264 `.tsx` files, a small set of hard-coded English UI labels
   was corrected; visible workspace runtime metric labels, loading strategy
   labels, and benchmark matrix copy were further localized, and the direct JSX
   English-label scan now returns 0 hits. Remaining brand names, language
   labels, provider names, trace keys, and runtime enums are P3 rather than
   Chinese UI gaps.
4. New public-facing UI must use `resolveUiLocale` / `getUiMessages` or the
   relevant feature display-copy instead of embedding long single-language copy.

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
| P2-C | 源码 / UI 双语审计 / Source and UI bilingual audit | `lib/i18n/`、public routes、workspace shell、display-copy modules、selected hard-coded UI labels |

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
5. 源码 / UI 可见文案已完成 `zh-CN` 默认与 `en-US` 可切换审计。/ Source / UI visible copy has passed the `zh-CN` default and `en-US` switchable audit.
6. 交付工程师能从入口文档找到 first-change proof、verification commands 和 public-safe evidence route。/ Delivery engineers can find the first-change proof, verification commands, and public-safe evidence route from entry docs.
7. 没有新增客户、私有部署、密钥或商业私有逻辑泄漏。/ No customer, private deployment, secret, or commercial-private leakage is introduced.
8. 没有新增 release-ready、SLA、Cloud / Enterprise ready 或客户承诺 overclaim。/ No release-ready, SLA, Cloud / Enterprise ready, or customer-commitment overclaim is introduced.

## 9. 变更记录 / Change Log

| 日期 / Date | 变更 / Change |
|---|---|
| 2026-06-03 | 继续收口 workspace runtime 可见面板中的指标标签、加载策略和基准矩阵文案，直接 JSX 英文标签扫描降为 0；Further localized visible workspace runtime metric labels, loading strategy labels, and benchmark matrix copy; direct JSX English-label scan now returns 0 hits |
| 2026-06-03 | 增加源码 / UI 审计标准，并记录 `zh-CN` 默认、`en-US` 可切换、display-copy 与少量硬编码 UI 标签修正；Added source / UI audit standard and recorded the `zh-CN` default, `en-US` switch, display-copy posture, and small hard-coded UI label fixes |
| 2026-06-03 | 将“交付工程师友好”加入双语化完成标准：必须说明 inspect / fork / first change / commands / evidence route / boundary；Added delivery-engineer friendliness to the bilingualization completion standard: inspect / fork / first change / commands / evidence route / boundary must be clear |
| 2026-06-03 | P1-B operations / roadmap / launch / trial / legal docs 开始加入中文主文本或 English reference summary；P1-B operations / roadmap / launch / trial / legal docs started adopting Chinese main text or English reference summaries |
| 2026-06-03 | P1-A product / boundary docs 开始加入中文主文本 + English reference；P1-A product / boundary docs started adopting Chinese main text plus English reference |
| 2026-06-03 | 建立 public-safe 双语化计划，并把 P0 intake 与 docs-entry 范围固定为独立 PR；Established the public-safe bilingualization plan and scoped P0 intake plus docs-entry work as a standalone PR |
