---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-27
archive_trigger:
  - Weekly scorecard 模板被正式 scorecard automation 或新版模板替代
  - 2026-10-27 之后，无任何 PR / 文档引用本文件
---

# Helm Company Memory Weekly Scorecard Template V1

更新时间：2026-04-27
状态：Template / CM-EVAL weekly review
Owner：Helm Core

> 该模板用于每周复核公司记忆是否作为数字经营资产持续变好。它不授权 production query、schema、runtime、auto-promotion、official write、LLM final ranking 或自动执行。

## 1. 本周结论

| 项目 | 结论 |
| --- | --- |
| Review week | `YYYY-MM-DD ~ YYYY-MM-DD` |
| Overall posture | `Go / Conditional-Go / No-Go` |
| Boundary incident count | `0` |
| Highest risk gap | `TBD` |
| Highest leverage fix | `TBD` |

## 2. 六层 Scorecard

| Layer | Metric | Current | Target | Status | Notes |
| --- | --- | ---: | ---: | --- | --- |
| Capture Quality | golden pass rate | `TBD` | `>= 75%` | `TBD` | `TBD` |
| World Model Health | object graph pass rate | `TBD` | `>= 70% coverage / 100% boundary` | `TBD` | `TBD` |
| Retrieval Utility | evidence hit at 5 | `TBD` | `>= 70%` | `TBD` | `TBD` |
| Advancement Impact | accepted Must Push / useful judgement proxy | `TBD` | `>= +20% lift` | `TBD` | `TBD` |
| LLM Economics | cost per useful judgement | `TBD` | decreasing or flat without quality loss | `TBD` | `TBD` |
| Governance Safety | boundary incidents | `TBD` | `0` | `TBD` | `TBD` |

## 3. Required Commands

```bash
npm run eval:company-memory
npm run eval:company-memory -- --mode=four-arm
npm run eval:company-memory -- --mode=economics
npm run eval:company-memory -- --mode=world-model
npm run eval:company-memory -- --mode=adoption
```

If any command fails, the week is at most `Conditional-Go` until reviewed.

## 4. Top Memory Gaps

| Rank | Object | Priority | Gap reasons | Owner | Fix path |
| ---: | --- | --- | --- | --- | --- |
| 1 | `TBD` | `TBD` | `TBD` | `TBD` | `extraction / retrieval / distillation / Ask Helm / Must Push` |
| 2 | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |
| 3 | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |
| 4 | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |
| 5 | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |
| 6 | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |
| 7 | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |
| 8 | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |
| 9 | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |
| 10 | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |

## 5. Reviewer Signoff

| Reviewer | Required focus | Decision | Notes |
| --- | --- | --- | --- |
| Product reviewer | business semantics / usefulness | `TBD` | `TBD` |
| Domain operator | real advancement value | `TBD` | `TBD` |
| Security / governance reviewer | tenant, capability, commitment, approval, send boundaries | `TBD` | `TBD` |

## 6. Go / No-Go Rule

Go requires:

1. Boundary incident count is `0`.
2. High-risk objects have boundary coverage `100%`.
3. Top memory gaps have owners and fix paths.
4. Token or cost reduction does not reduce evidence coverage.
5. Reviewer signoff has no unresolved blocker.

No-Go if:

1. Any cross-workspace memory leak appears.
2. Suggestion is written as commitment.
3. Explanation is written as approval.
4. Draft is written as sent.
5. Unreviewed distillation changes promoted memory, ranking, or execution.
