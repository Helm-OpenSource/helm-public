---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-27
archive_trigger:
  - Four-arm economics baseline 被真实 production token bill 与 reviewer scoring 替代
  - 2026-10-27 之后，无任何 PR / 文档引用本文件
---

# Helm Company Memory Four-Arm / Economics Baseline Report V1

更新时间：2026-04-27
状态：CM-EVAL-3 complete / deterministic baseline
Owner：Helm Core

## 1. 结论

本轮完成 `CM-EVAL-3` 第一层 deterministic four-arm / economics baseline。

新增：

- `evals/company-memory/fixtures/redacted-payload-pack.json`
- `runCompanyMemoryFourArmEval`
- `npm run eval:company-memory -- --mode=four-arm`
- `npm run eval:company-memory -- --mode=economics`

该 baseline 把 50 条 company memory benchmark cases 绑定到 57 个 redacted payload refs，并对 `no_memory / raw_context / current_retrieval_pack / distilled_memory` 四臂输出 token、evidence、boundary、quality 与 useful judgement proxy。

它不调用 LLM、不读取 DB、不接 production query、不改 schema、不改 Memory runtime、不接 UI、不授权 auto-promotion、official write、LLM final ranking 或自动执行。

## 2. 当前输出

`npm run eval:company-memory -- --mode=four-arm` 当前输出核心摘要：

```json
{
  "passed": true,
  "totalCases": 50,
  "payloadRefs": {
    "expected": 57,
    "allowlisted": 57,
    "missing": []
  },
  "arms": [
    { "id": "no_memory", "passRate": 16, "totalPromptTokenEstimate": 12540 },
    { "id": "raw_context", "passRate": 100, "totalPromptTokenEstimate": 63000 },
    { "id": "current_retrieval_pack", "passRate": 100, "totalPromptTokenEstimate": 11020 },
    { "id": "distilled_memory", "enabled": false, "totalPromptTokenEstimate": 6850 }
  ],
  "economics": {
    "passed": true,
    "currentRetrievalPackCompressionRatio": 5.72,
    "rawContextCostPerUsefulJudgement": 0.00126,
    "currentRetrievalPackCostPerUsefulJudgement": 0.00022,
    "smallModelSuccessRate": 100
  },
  "failures": []
}
```

`distilled_memory` 已进入四臂合同，但当前保持 `enabled=false`。原因是 approved distillation candidate / summary layer 尚未进入 retrieval summary 或 promoted memory。该 arm 只作为后续对照位，不参与 Go。

## 3. What This Proves

已经证明：

1. 50 条 benchmark cases 的 57 个 redacted payload refs 均在 payload allowlist 中。
2. 每类 source type 都有 offline token estimate。
3. `current_retrieval_pack` baseline 在 expected evidence / boundary 条件下保持 100% quality pass。
4. `current_retrieval_pack` 相比 `raw_context` 的 compression ratio 为 `5.72x`，超过初始目标 `>= 5x`。
5. `current_retrieval_pack` 的 cost-per-useful-judgement proxy 低于 `raw_context`。
6. economics pass 依赖 current retrieval pack quality pass、compression ratio 与 small-model success proxy，不是只看 token 下降。

## 4. What This Does Not Prove

尚未证明：

1. 真实 LLM 在这些 payload 上会输出同样质量。
2. 真实 production token bill 会等于当前 token estimate。
3. 用户会采纳这些 judgement 或 Must Push。
4. approved distillation summary layer 已可用。
5. company world model 的真实 object graph freshness / contradiction / coverage 已达标。
6. Human reviewer 已完成 product / operator / governance 三方审查。

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
npm run eval:company-memory -- --mode=four-arm
npm run eval:company-memory -- --mode=economics
```

结果：全部通过。

## 7. 当前四类短表

### 已经完整成立

- CM-EVAL-1 fixture pack。
- CM-EVAL-2 deterministic fixture validator。
- CM-EVAL-3 deterministic four-arm / economics baseline。
- `npm run eval:company-memory -- --mode=four-arm`。
- `npm run eval:company-memory -- --mode=economics`。
- Redacted payload allowlist coverage guard。

### 已成形但仍需下一层

- `distilled_memory` arm 仍是 disabled contract slot。
- Cost-per-useful-judgement 仍是 token estimate proxy，不是 production bill。
- Small-model success 仍是 current retrieval pack pass-rate proxy，不是真实小模型输出 eval。
- Human reviewer protocol 尚未执行。

### 刻意未做

- 不读取 production DB。
- 不接 Ask Helm runtime。
- 不改 Memory runtime。
- 不改 schema / API / UI。
- 不让 distillation candidate 影响 ranking 或 promoted memory。
- 不调用 LLM。

### 风险项

- 如果后续不接真实 redacted payload 和 reviewer scoring，该 eval 会停留在 contract readiness。
- 如果为了 token 下降牺牲 evidence coverage，company memory 经济性会变成伪优化。
- `distilled_memory` 必须等 review-safe summary layer 真实成立后再启用。

## 8. 下一步

进入 `CM-EVAL-4`：

1. 增加 object graph health evaluator。
2. 计算 coverage / freshness / contradiction / traceability。
3. 输出最需要修复的 10 个 object memory gaps。
4. 增加 weekly company memory scorecard report 模板。
