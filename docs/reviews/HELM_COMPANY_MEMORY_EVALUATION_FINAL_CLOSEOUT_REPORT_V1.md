---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-27
archive_trigger:
  - Company memory evaluation 进入 production redacted payload cadence 后
  - 2026-10-27 之后，无任何 PR / 文档引用本文件
---

# Helm Company Memory Evaluation Final Closeout Report V1

更新时间：2026-04-27
状态：Requirements complete / implementation closeout
Owner：Helm Core

## 1. 结论

公司记忆评估第一批需求已收口。

本轮把“公司记忆是数字经营资产 / 公司世界模型 / LLM 经济性杠杆”的判断，落成一条可重复运行的离线评估链：

1. `CM-EVAL-1`：50 条 company memory benchmark fixtures。
2. `CM-EVAL-2`：deterministic fixture readiness / six-layer scorecard。
3. `CM-EVAL-3`：four-arm baseline 与 economics proxy。
4. `CM-EVAL-4`：object graph health baseline 与 top memory gaps。
5. `CM-EVAL-5`：Ask Helm / Must Push / briefing adoption calibration proxy。

该链路仍然是 offline deterministic evaluation，不是 runtime adoption，不授权 schema、API、UI、production query、LLM final ranking、auto-promotion、official write 或自动执行。

## 2. 已经完整成立

| Phase | Deliverable | Command / artifact |
| --- | --- | --- |
| CM-EVAL-1 | Fixture pack | `evals/company-memory/fixtures/redacted-business-events.json` |
| CM-EVAL-2 | Fixture readiness evaluator | `npm run eval:company-memory` |
| CM-EVAL-3 | Four-arm / economics baseline | `npm run eval:company-memory -- --mode=four-arm`; `--mode=economics` |
| CM-EVAL-4 | World model health baseline | `npm run eval:company-memory -- --mode=world-model` |
| CM-EVAL-5 | Product adoption calibration | `npm run eval:company-memory -- --mode=adoption` |
| Weekly cadence | Scorecard template | `docs/reviews/HELM_COMPANY_MEMORY_WEEKLY_SCORECARD_TEMPLATE_V1.md` |

## 3. 当前指标快照

| Area | Result |
| --- | --- |
| Fixture count | `50` |
| Payload refs | `57 / 57 allowlisted` |
| Six-layer readiness | `100%` |
| Current retrieval pack compression ratio | `5.72x` |
| Current retrieval pack cost per useful judgement proxy | `0.00022` |
| Object graph targets | `20 / 20 pass` |
| Observed objects | `35` |
| World model metrics | `coverage / freshness / contradiction / traceability / boundary coverage = 100%` |
| Adoption proxy overall acceptance lift | `58.1%` |
| Adoption proxy time-to-trust reduction | `41.5%` |
| Review coverage | `100%` |
| Boundary incidents | `0` |

## 4. 已成形但仍需下一层

- Production redacted payload cadence 尚未接入。
- Human reviewer protocol 尚未实际执行。
- Adoption calibration 仍是 proxy，不是 production analytics。
- Contradiction detection 仍是 deterministic posture guard，不是真实语义冲突检测。
- `distilled_memory` arm 仍是 disabled contract slot。

## 5. 刻意未做

- 不读取 production DB。
- 不接 Ask Helm runtime。
- 不改 Memory runtime。
- 不改 schema / API / UI。
- 不让 distillation candidate 影响 ranking 或 promoted memory。
- 不调用 LLM。
- 不做 runtime adoption gate 放宽。

## 6. 风险项

- 如果没有真实 reviewer scoring，company memory quality 仍可能停留在 fixture-quality。
- 如果没有 production redacted payload cadence，eval 无法发现真实对象图 drift。
- 如果过早启用 distillation 或 runtime adoption，会破坏 review-first 和 boundary-first posture。
- 如果只优化 token 成本而牺牲 evidence coverage，会把“LLM 经济性”变成伪优化。

## 7. 验证命令

收口时必须运行：

```bash
npm run eval:company-memory
npm run eval:company-memory -- --mode=four-arm
npm run eval:company-memory -- --mode=economics
npm run eval:company-memory -- --mode=world-model
npm run eval:company-memory -- --mode=adoption
npx vitest run lib/evals/company-memory-evals.test.ts
npx eslint lib/evals/company-memory-evals.ts lib/evals/company-memory-evals.test.ts scripts/company-memory-evals.ts
npm run typecheck
npm run check:boundaries
```

## 8. 下一阶段最该做的 5 件事

1. 启动每周 company memory scorecard cadence。
2. 把 top memory gaps 转成 extraction / retrieval / distillation / Ask Helm / Must Push 修复任务。
3. 增加 reviewer scoring protocol：product reviewer、domain operator、security / governance reviewer。
4. 设计 production redacted payload cadence 与 privacy posture。
5. 等 reviewer scoring 和 privacy posture 通过后，再评估 runtime adoption gate。
