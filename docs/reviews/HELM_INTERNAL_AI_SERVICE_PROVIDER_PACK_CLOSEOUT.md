---
status: active
owner: GTM / Product / Engineering
created: 2026-05-03
artifact_type: closeout
runtime_adoption: no-go
review_after: 2026-10-30
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Helm Internal AI Service Provider Pack Closeout

## 1. 结论

本轮把已经跑通的本地需求转成仓库内第一版可执行需求与离线质量门。

当前成立的是：

- requirements
- alias-only fixtures
- deterministic Daily Top 3 evaluator
- targeted Vitest
- CLI eval gate
- docs / evals / STATUS 索引同步
- safe sample / review-first acceptance / review-safe action whitelist / 72h positive and downgrade outcome ledger invariant coverage
- no external side effect / no official commitment authority invariant coverage

当前不成立，也不授权：

- 真实候选池接入
- 内部 board
- runtime / API / UI / schema / connector
- 自动约访、自动外发、自动 CRM 写回、自动报价、自动 public claim
- Pack DSL / marketplace / 行业 Pack 平台框架
- LLM final ranking

## 2. 交付物

| 类型 | 路径 |
|---|---|
| Requirements | [`docs/product/HELM_INTERNAL_AI_SERVICE_PROVIDER_PACK_REQUIREMENTS.md`](../product/HELM_INTERNAL_AI_SERVICE_PROVIDER_PACK_REQUIREMENTS.md) |
| Fixture pack | [`evals/internal-ai-service-providers/ai-service-provider-pack-cases.json`](../../evals/internal-ai-service-providers/ai-service-provider-pack-cases.json) |
| Evaluator | [`lib/evals/internal-ai-service-provider-pack-evals.ts`](../../lib/evals/internal-ai-service-provider-pack-evals.ts) |
| Targeted tests | [`lib/evals/internal-ai-service-provider-pack-evals.test.ts`](../../lib/evals/internal-ai-service-provider-pack-evals.test.ts) |
| CLI gate | [`scripts/internal-ai-service-provider-pack-eval.ts`](../../scripts/internal-ai-service-provider-pack-eval.ts) |
| Package script | `npm run eval:internal-ai-service-providers` |

## 3. Eval Contract

The offline gate verifies:

- exactly 8 candidate fixtures
- exactly 3 Daily Top 3 selected candidates
- fixed fixture / Top 3 / ledger counts are enforced in code, not only trusted from JSON targets
- why-not rationale for every non-selected candidate
- at least 3 positive fixtures and at least 4 negative / downgraded fixtures
- closed review-safe next action enum
- L0 / L1 cannot be displayed as channel candidates
- L2 / L3 can be displayed as channel candidates
- selected Top 3 candidates have owner, reviewer, evidence refs, safe sample, review-first acceptance and 72h outcome ledger row
- outcome ledger includes both prepared-for-review rows and downgrade / rejection rows with `downgradeReason`
- high-score candidates with auto-send, silent CRM write, workflow trigger or Agent build asks are forced to No-Go
- content-only and platform-builder candidates are rejected from `providerType`, even if risk tags are missing
- no raw PII / customer-identifiable fixture keys, why-not rationale text or outcome ledger text
- no external side-effect authority or official commitment authority
- no auto-send, silent CRM write, direct Must Push truth, runtime / API / UI / schema / connector capability, Pack DSL, marketplace or LLM final ranking

## 4. 状态短表

| 类别 | 结论 |
|---|---|
| 已经完整成立 | Requirements、alias-only fixture pack、deterministic evaluator、CLI gate、targeted Vitest、review-safe action whitelist、safe sample / 72h positive and downgrade ledger / authority invariant coverage |
| 已成形但仍需下一层 | 真实候选池导入、连续 5 个工作日 live Daily Top 3、内部 read-only board、真实 Outcome ledger 与 founder scorecard 对接 |
| 刻意未做 | runtime / API / UI / schema / connector、Pack DSL、marketplace、自动外发、自动 CRM 写回、自动报价、自动 public claim、LLM final ranking |
| 风险项 | 过早抽象成平台、内容型对象污染候选池、客户转渠道过早、候选无 outcome 仍持续占用 Top 3、Agent 平台诉求把 Helm 拉偏 |

## 5. 下一步

1. 用真实 alias-only 候选池跑 5 个工作日 Daily Top 3。
2. 将每日 outcome 回填到自身租户 scorecard。
3. 如果 5 天内出现 2 次 validation call 与 1 次 paid pilot intent，再起 read-only internal board PRD。
4. 任何 runtime / API / UI / schema / connector 需求必须另起 PRD 与 owner approval。

## 6. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-03 | 首版：把 Helm 自身经营租户 AI 生态服务商 Pack 从本地需求草案升级为 repo-tracked requirements + offline eval |
| 2026-05-03 | Gate tightening：补 safe sample、candidate-level review-first acceptance、Top 3 72h outcome ledger、每个未入选对象 why-not、no external side effect / no official commitment 校验，并把客户可见动作改为 prepare-for-review 口径 |
| 2026-05-03 | Claude review follow-up：next action 改为 review-safe 白名单、补独立 silent CRM write No-Go fixture、补 downgrade / rejection ledger 负样本与 `downgradeReason` 校验 |
| 2026-05-03 | 二次审计 follow-up：固定 contract counts 不再信任 fixture targets、`providerType` 可直接触发 No-Go、PII 扫描扩到 why-not rationale 与 outcome ledger 文本 |
