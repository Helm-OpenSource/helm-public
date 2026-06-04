# Case Management Sample Workers / Case Management Sample Workers

> **语言 / Language**: **中文主文本** + **English reference**

> 纯 rule-based decision functions 的 worker cookbook。public reference 中刻意不启用
> runtime drivers。
>
> Worker cookbook with pure rule-based decision functions. Runtime drivers are
> intentionally not enabled in the public reference.

## 当前内容 / Current Content

- `worker-modes.ts` — observer / shadow / active mode invariants
- `lifecycle-objectives.ts` — simple recovery / effort / speed objective helper
- `case-allocation-driver/` — assignment recommendation cookbook
- `case-stewardship-driver/` — active-case roster and follow-through cookbook

## 边界 / Boundaries (hard invariants per driver)

1. `commitment: "suggestion_only"` — always true; never overridable
2. Executable `propose_*_recommendation` outputs require approval; observer-mode copies are suppressed and never enter an approval queue
3. `proposalKey` deterministic (no UUID / no ms timestamps)
4. Closed cases never appear in worker outputs
5. Inactive workforce never receives proposals
6. Stewardship roster sees every active case

These are enforced by unit tests, not policy comments.

## 不是什么 / What This Is Not

- 不是 production driver framework / Not a production driver framework
- 不是 LLM-as-final-ranker layer（commitment path 禁用 LLM）/ Not an LLM-as-final-ranker layer
- 不是 auto-execute system（每个 proposal 都需要明确人工 approval）/ Not an auto-execute system

## 验证 / Validation

```bash
npx vitest run \
  extensions/case-management-sample/workers/manifest.test.ts \
  extensions/case-management-sample/workers/worker-modes.test.ts \
  extensions/case-management-sample/workers/lifecycle-objectives.test.ts \
  extensions/case-management-sample/workers/case-allocation-driver/decide.test.ts \
  extensions/case-management-sample/workers/case-stewardship-driver/decide.test.ts
```

See / 参见: [`../README.md`](../README.md) · [extraction spec](../../../docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md)
