---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-27
archive_trigger:
  - Product adoption proxy 被真实 pilot cohort reviewer scoring 替代
  - 2026-10-27 之后，无任何 PR / 文档引用本文件
---

# Helm Company Memory Product Adoption Calibration Report V1

更新时间：2026-04-27
状态：CM-EVAL-5 complete / deterministic product adoption proxy
Owner：Helm Core

## 1. 结论

本轮完成 `CM-EVAL-5` 第一层 deterministic product adoption calibration。

新增：

- `evals/company-memory/fixtures/product-adoption-calibration.json`
- `runCompanyMemoryAdoptionEval`
- `npm run eval:company-memory -- --mode=adoption`

该 evaluator 用 12 条 redacted adoption proxy cases 覆盖 Ask Helm、Must Push 和 briefing 三个产品承接面，比较 `noMemory` 与 `withMemory` 的 acceptance score、time-to-trust、review coverage 与 boundary incidents。

它不读取 production analytics、不接 runtime、不改 schema、不改 Memory 写入、不接 UI、不调用 LLM、不授权 auto-promotion、official write、LLM final ranking 或自动执行。

## 2. 当前输出

`npm run eval:company-memory -- --mode=adoption` 当前输出核心摘要：

```json
{
  "passed": true,
  "totalCases": 12,
  "surfaces": [
    {
      "surface": "ask_helm",
      "acceptanceLiftPercent": 61.6,
      "timeToTrustReductionPercent": 41.6,
      "reviewCoveragePercent": 100,
      "boundaryIncidentCount": 0
    },
    {
      "surface": "must_push",
      "acceptanceLiftPercent": 70.7,
      "timeToTrustReductionPercent": 42.5,
      "reviewCoveragePercent": 100,
      "boundaryIncidentCount": 0
    },
    {
      "surface": "briefing",
      "acceptanceLiftPercent": 44.3,
      "timeToTrustReductionPercent": 39.7,
      "reviewCoveragePercent": 100,
      "boundaryIncidentCount": 0
    }
  ],
  "overall": {
    "acceptanceLiftPercent": 58.1,
    "timeToTrustReductionPercent": 41.5,
    "reviewCoveragePercent": 100,
    "boundaryIncidentCount": 0
  },
  "failures": []
}
```

## 3. What This Proves

已经证明：

1. 公司记忆评估现在能覆盖 Ask Helm、Must Push 和 briefing 三个产品承接面。
2. Adoption calibration 不只看 token 或 extraction，而是绑定 acceptance lift、time-to-trust、review coverage 与 boundary incidents。
3. 三个承接面的 proxy acceptance lift 均超过 `>= 20%`。
4. 三个承接面的 proxy time-to-trust reduction 均超过 `>= 20%`。
5. 高风险 case review coverage 为 `100%`，boundary incident 为 `0`。

## 4. What This Does Not Prove

尚未证明：

1. 真实用户会达到同样 acceptance lift。
2. 真实产品埋点、analytics 或 reviewer scoring 已接入。
3. 真实 Ask Helm / Must Push / briefing runtime 已被该 eval 驱动。
4. Production memory 对真实 LLM 输出质量已有同等提升。
5. 该 eval 可以替代 pilot cohort 的 human review。

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
npm run eval:company-memory -- --mode=adoption
```

结果：全部通过。

## 7. 当前四类短表

### 已经完整成立

- CM-EVAL-1 fixture pack。
- CM-EVAL-2 deterministic fixture validator。
- CM-EVAL-3 deterministic four-arm / economics baseline。
- CM-EVAL-4 deterministic object graph health baseline。
- CM-EVAL-5 deterministic product adoption proxy。
- 公司记忆评估的第一条完整离线闭环：fixture -> four-arm -> economics -> world-model -> adoption。

### 已成形但仍需下一层

- Adoption calibration 仍是 proxy，不是 production analytics。
- Human reviewer protocol 尚未实际执行。
- Weekly scorecard 尚未形成连续 cadence。
- Production redacted payload cadence 尚未接入。

### 刻意未做

- 不读取 production DB 或 analytics。
- 不接 Ask Helm runtime。
- 不改 Memory runtime。
- 不改 schema / API / UI。
- 不让 distillation candidate 影响 ranking 或 promoted memory。
- 不调用 LLM。

### 风险项

- 如果 adoption proxy 不进入真实 pilot cohort reviewer scoring，会停留在演示用指标。
- 如果只追求 acceptance lift 而不维持 review coverage 和 boundary incident = 0，会破坏 Helm 的企业可信边界。
- 真实用户行为需要补 telemetry posture 和 privacy posture 后再进入 production adoption eval。

## 8. 下一步

公司记忆评估第一批需求可以收口。下一阶段不是继续扩大离线指标，而是：

1. 启动每周 company memory scorecard cadence。
2. 用 top memory gaps 反向创建 extraction / retrieval / distillation / Ask Helm / Must Push 修复任务。
3. 准备 production redacted payload cadence 与 reviewer scoring protocol。
4. 保持 runtime adoption 为后置 gate，直到 human review 和 privacy posture 通过。
