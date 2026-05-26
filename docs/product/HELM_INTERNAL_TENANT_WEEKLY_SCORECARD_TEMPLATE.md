---
status: active
owner: Product / Operations
created: 2026-04-30
review_after: 2026-05-14
archive_trigger:
  - 连续 2 周自身租户 dogfood scorecard 完成后，本模板由实跑复盘版替代
  - 内部运营 readout / dashboard contract 落地后，本模板被产品化 contract 替代
  - Founder-led OPC 阶段结束，周度 scorecard 改由正式运营治理文档承接
---

# Helm 自身租户 Weekly Scorecard 模板

## 1. 使用规则

本模板用于 Helm 自身租户周度复盘。它只记录脱敏 ID、证据引用、owner、reviewer、结果指标和边界，不记录真实客户联系人、未授权 transcript、私有邮件正文、凭据或客户原始数据。

目标不是汇报“做了多少事”，而是判断：

1. 本周哪些经营事项真正推进了结果。
2. 哪些事项有 owner、evidence、review、metric 和 next action。
3. 哪些 blocker 需要 founder decision。
4. 哪些 memory / SkillSuggestion / context 改进 candidate 值得进入下一轮。

## 2. 周度元信息

| 字段 | 值 |
|---|---|
| `sourceWindowKey` | `YYYY-WW` |
| `workspaceId` | `helm_internal` |
| `tenantKey` | `helm-internal` |
| `scorecardOwner` | Codex / Product / Operations |
| `founderDecisionDue` | YYYY-MM-DD |
| `reviewPosture` | founder_review_required |
| `rawCustomerDataIncluded` | No |

## 3. Executive Readout

| 问题 | 本周答案 |
|---|---|
| 本周最高 Must Push 是什么？ |  |
| 本周最大 blocker 是什么？ |  |
| 本周最重要 proof 是什么？ |  |
| 本周最大边界风险是什么？ |  |
| 下周必须推进的 3 件事是什么？ |  |

## 4. Work Item 追踪表

| workItemId | domain | severity | owner | reviewer | decisionPosture | evidenceRefs | outcomeMetric | metricValue | nextAction | boundaryNote |
|---|---|---|---|---|---|---|---|---:|---|---|
| `helm-internal:gtm:YYYYMMDD:alias-a-scope` | GTM / Pack A | high | founder | product / data_protection | review_required | `candidate:alias-a`, `scope-call:redacted` | `week0_readiness_completeness_percent` |  |  | proposal != contract |
| `helm-internal:intelligence:YYYYMMDD:context-gap` | Intelligence | normal | Codex | product | continue | `eval:llm-context` | `ctx_score_delta` |  |  | context audit != raw prompt persistence |
| `helm-internal:release:YYYYMMDD:public-guard` | Release | critical | engineering | security | blocked | `check:public-release` | `blocker_count` |  |  | proof != production readiness |

## 5. 指标汇总

| 指标 | 目标 | 本周值 | 结论 |
|---|---:|---:|---|
| Work item owner coverage | 100% |  |  |
| Evidence coverage | ≥95% |  |  |
| Review coverage for high-risk items | 100% |  |  |
| Outcome metric coverage | ≥90% |  |  |
| Must Push orphan rate | 0 |  |  |
| Boundary incident count | 0 |  |  |
| Time-to-first-owner p50 | ≤24h |  |  |
| Time-to-decision for blockers p50 | ≤72h |  |  |
| Memory / Skill candidate review latency p50 | ≤7d |  |  |
| Weekly scorecard completion | 100% |  |  |

## 6. Intelligence / Memory / Skill 改进候选

| candidateId | source | candidateType | evidenceRefs | expectedDelta | reviewer | decision |
|---|---|---|---|---|---|---|
|  | `eval:llm-context` | context_fix_candidate |  |  | product / data_protection | review_required |
|  | `eval:self-improvement` | learning_loop_candidate |  |  | product | review_required |
|  | Pack A pilot / commercial promotion eval | SkillSuggestionCandidate |  |  | founder / product | review_required |

允许输出：

- revise threshold
- add evidence requirement
- add reviewer
- update prompt context contract
- create MemoryCandidate
- create SkillSuggestionCandidate

禁止输出：

- auto-promotion
- canonical fact auto-write
- LLM final ranking
- raw prompt persistence
- external send / publish / official write

## 7. Founder Decision Queue

| decisionId | decisionNeeded | options | recommendedOption | evidenceRefs | riskIfDelayed | founderDecision |
|---|---|---|---|---|---|---|
|  |  | continue / revise / stop / blocked |  |  |  |  |

## 8. Closeout

| 项 | 结果 |
|---|---|
| 本周是否可继续推进？ | Go / Revise / Stop |
| 是否有 public claim 可以说？ | No by default；有则列 claim allowlist 与 reviewer |
| 是否有客户数据合规问题？ |  |
| 是否产生新的 MemoryCandidate？ |  |
| 是否产生新的 SkillSuggestionCandidate？ |  |
| 下周第一项 Must Push |  |

## 9. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-04-30 | 首版：为 Helm 自身租户 dogfood 提供周度 scorecard 模板，只记录脱敏 ID、owner、review、evidence、metric、boundary 和 founder decision |
