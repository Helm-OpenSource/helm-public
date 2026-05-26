---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-27
archive_trigger:
  - Object graph health baseline 被 production redacted object graph cadence 替代
  - 2026-10-27 之后，无任何 PR / 文档引用本文件
---

# Helm Company Memory World Model Health Report V1

更新时间：2026-04-27
状态：CM-EVAL-4 complete / deterministic object graph health baseline
Owner：Helm Core

## 1. 结论

本轮完成 `CM-EVAL-4` 第一层 deterministic object graph health evaluator。

新增：

- `evals/company-memory/fixtures/object-graph-health-targets.json`
- `runCompanyMemoryWorldModelEval`
- `npm run eval:company-memory -- --mode=world-model`

该 evaluator 从 50 条 company memory benchmark cases 推导 object profiles，并对 20 个 high / medium / low priority 目标对象评估 coverage、freshness、contradiction control、traceability 与 boundary coverage。

它不读取 production DB、不接 runtime、不改 schema、不改 Memory 写入、不接 UI、不调用 LLM、不授权 auto-promotion、official write、LLM final ranking 或自动执行。

## 2. 当前输出

`npm run eval:company-memory -- --mode=world-model` 当前输出核心摘要：

```json
{
  "passed": true,
  "asOf": "2026-04-22T00:00:00.000Z",
  "totalTargets": 20,
  "observedObjects": 35,
  "metrics": [
    { "id": "coverage", "passRate": 100 },
    { "id": "freshness", "passRate": 100 },
    { "id": "contradiction", "passRate": 100 },
    { "id": "traceability", "passRate": 100 },
    { "id": "boundary_coverage", "passRate": 100 }
  ],
  "topMemoryGaps": [
    "partner:partner_india",
    "opportunity:opp_mike_expansion",
    "opportunity:opp_gamma_pilot",
    "workstream:delivery_beta_onboarding",
    "resource:resource_lima_capacity",
    "resource:resource_queue_alpha",
    "workspace:redacted_workspace_alpha",
    "opportunity:opp_oscar_archive",
    "campaign:campaign_delta_launch",
    "contact:contact_beta_ops"
  ],
  "failures": []
}
```

Top memory gaps 是改进队列，不等于 failed objects。当前对象均满足 required contract，但部分对象在 source depth、evidence refs、freshness watch 或 relationship assertion density 上仍应优先补强。

## 3. What This Proves

已经证明：

1. Benchmark fixture 可以被投影为 object graph profiles。
2. 20 个目标对象均达到 required asset coverage、freshness、traceability 与 boundary coverage。
3. 高风险对象的 boundary / review-required posture 可被 deterministic guard 覆盖。
4. Evaluator 可以输出 top 10 object memory gaps，支持每周把 memory 改进转成具体对象队列。
5. `world-model` mode 可在本地或 CI 作为 company memory health gate。

## 4. What This Does Not Prove

尚未证明：

1. 真实 production object graph 已达到同样指标。
2. 真实记忆写入链路能持续维持这些对象的 freshness。
3. 真实 contradiction detection 已能处理复杂语义冲突。
4. Human reviewer 已接受 top memory gaps 的业务优先级。
5. 这些对象 gap 修复后能带来真实 Ask Helm / Must Push adoption lift。

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
npm run eval:company-memory -- --mode=world-model
npm run eval:company-memory -- --mode=economics
```

结果：全部通过。

## 7. 当前四类短表

### 已经完整成立

- CM-EVAL-1 fixture pack。
- CM-EVAL-2 deterministic fixture validator。
- CM-EVAL-3 deterministic four-arm / economics baseline。
- CM-EVAL-4 deterministic object graph health baseline。
- Top 10 object memory gaps 输出。

### 已成形但仍需下一层

- Object graph health 仍来自 fixture projection，不是 production DB。
- Contradiction control 仍是 deterministic posture guard，不是真实语义冲突检测。
- Top memory gaps 尚未进入人审和真实修复闭环。
- Weekly scorecard 模板已定义，但尚未形成连续周度 cadence。

### 刻意未做

- 不读取 production DB。
- 不接 Ask Helm runtime。
- 不改 Memory runtime。
- 不改 schema / API / UI。
- 不让 distillation candidate 影响 ranking 或 promoted memory。
- 不调用 LLM。

### 风险项

- 如果 CM-EVAL-4 不进入真实 redacted production cadence，会停留在 fixture graph health。
- 如果 top memory gaps 不被转成具体 extraction / retrieval / distillation 修复任务，公司记忆质量无法形成复利。
- Contradiction detection 需要下一层引入 reviewer-approved conflict taxonomy，不能靠字符串启发长期支撑。

## 8. 下一步

进入 `CM-EVAL-5`：

1. 增加 product adoption calibration fixture。
2. 输出 Ask Helm / Must Push / briefing with-memory uplift proxy。
3. 绑定 acceptance lift、time-to-trust、review coverage 与 boundary incident。
4. 继续保持 offline deterministic，不接 runtime adoption。
