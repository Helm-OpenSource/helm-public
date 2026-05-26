---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-27
archive_trigger:
  - CM-EVAL deterministic validator 被 production redacted payload cadence 替代
  - 2026-10-27 之后，无任何 PR / 文档引用本文件
---

# Helm Company Memory Deterministic Eval Report V1

更新时间：2026-04-27
状态：CM-EVAL-2 complete / deterministic fixture validator
Owner：Helm Core

## 1. 结论

本轮完成 `CM-EVAL-2` 第一层 deterministic evaluator。

新增：

- `lib/evals/company-memory-evals.ts`
- `lib/evals/company-memory-evals.test.ts`
- `scripts/company-memory-evals.ts`
- `package.json` script：`npm run eval:company-memory`

该 evaluator 当前只验证 fixture pack readiness：50 条样本分布、case shape、traceability、world model assertions、retrieval assertions、advancement outcome、LLM economics readiness inputs 与 governance boundary coverage。

它不调用 LLM、不读取 DB、不接 runtime、不评估真实答案质量，也不授权 schema、API、UI、auto-promotion、official write、LLM final ranking 或自动执行。

## 2. 当前输出

`npm run eval:company-memory` 输出：

```json
{
  "passed": true,
  "totalCases": 50,
  "distribution": {
    "expected": {
      "meeting": 12,
      "email": 10,
      "crm": 8,
      "report": 8,
      "ask_helm": 8,
      "mixed": 4
    },
    "actual": {
      "meeting": 12,
      "email": 10,
      "crm": 8,
      "report": 8,
      "ask_helm": 8,
      "mixed": 4
    },
    "passed": true
  },
  "layers": [
    { "id": "capture_quality", "passRate": 100 },
    { "id": "world_model_health", "passRate": 100 },
    { "id": "retrieval_utility", "passRate": 100 },
    { "id": "advancement_impact", "passRate": 100 },
    { "id": "llm_economics", "passRate": 100 },
    { "id": "governance_safety", "passRate": 100 }
  ],
  "failureModes": [],
  "failures": []
}
```

## 3. What This Proves

已经证明：

1. Fixture pack 达到 `50` 条规模。
2. 来源分布符合 `meeting 12 / email 10 / crm 8 / report 8 / ask_helm 8 / mixed 4`。
3. 每条 case 都有 source event、expected memory assets、world model assertions、retrieval assertions 和 advancement outcome。
4. 每条 expected asset 都有 object ref、evidence refs 和 review posture。
5. 每条 `boundaryRequired=true` 的 case 都有 boundary asset 和 review-required asset。
6. CLI 可以在 CI / 本地用作 deterministic readiness gate。

## 4. What This Does Not Prove

尚未证明：

1. Helm 能从真实 payload 中抽出这些 expected memory assets。
2. Retrieval pack 能真的选中 expected evidence。
3. Ask Helm / Must Push / briefing 的 with-memory uplift。
4. LLM economics 是否真实改善。
5. object graph health 是否在真实 workspace 中成立。
6. human reviewer 是否接受这些 case 的经营语义。

## 5. 边界

继续保持：

- workspace-first
- review-first
- recommendation != commitment
- explanation != approval
- draft != send
- proof != external write success
- no cross-workspace aggregation
- no auto-promotion
- no official write
- no LLM final ranking

## 6. 验证结果

已运行：

```bash
npx vitest run lib/evals/company-memory-evals.test.ts
npm run eval:company-memory
npx eslint lib/evals/company-memory-evals.ts lib/evals/company-memory-evals.test.ts scripts/company-memory-evals.ts
```

结果：全部通过。

## 7. 当前四类短表

### 已经完整成立

- CM-EVAL-1 fixture pack。
- CM-EVAL-2 deterministic fixture validator。
- `npm run eval:company-memory` CLI。
- 六层 scorecard readiness 输出。
- governance boundary coverage 的 deterministic guard。

### 已成形但仍需下一层

- Four-arm evaluator 尚未实现。
- Raw payload pack 尚未补齐。
- LLM economics baseline 尚未真实计算。
- World model health 尚未读取真实 object graph。
- Human reviewer protocol 尚未执行。

### 刻意未做

- 不读取生产 DB。
- 不接 Ask Helm runtime。
- 不改 Memory runtime。
- 不改 schema / API / UI。
- 不让 distillation candidate 影响 ranking 或 promoted memory。

### 风险项

- 当前 passRate 是 fixture readiness，不是生产质量。
- 如果后续只保持字段校验，会无法改进真实 memory quality。
- 需要尽快进入 CM-EVAL-3 的 four-arm / economics / world-model 实测，否则该线会停留在结构化样本层。

## 8. 下一步

`CM-EVAL-3` 已在 `docs/reviews/HELM_COMPANY_MEMORY_FOUR_ARM_ECONOMICS_BASELINE_REPORT_V1.md` 收口，新增 redacted payload allowlist、four-arm baseline 与 economics proxy。

后续进入 `CM-EVAL-4`：

1. 增加 object graph health evaluator。
2. 计算 coverage / freshness / contradiction / traceability。
3. 输出最需要修复的 10 个 object memory gaps。
4. 增加 weekly company memory scorecard report 模板。
