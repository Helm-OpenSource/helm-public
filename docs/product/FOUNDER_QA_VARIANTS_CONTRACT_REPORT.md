---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Founder Q&A Variants Contract Report

## 目标

把 `founder conversation` 继续细分成一组可复用的 founder 高价值问答 detail contract，用来承接战略问题、客户价值问题、范围问题、边界问题、为什么是现在以及下一步问题。

## 当前冻结的核心语义

- `founderQAJudgement`
- `founderQAReason`
- `founderQABoundary`
- `founderQANextAction`
- `founderQAEvidence`
- `founderQAScene`
- `founderQAAudience`
- `founderQASendability`
- `founderQAFallback`
- `founderQAReviewMode`

本轮也同步固定了辅助语义：

- `founderQAActionSummary`
- `founderQADecisionRequest`
- `founderQAWorkerSummary`
- `founderQARiskSignal`
- `founderQAIntent`
- `founderQAEvidenceGroups`

## 最小 scene 集

当前版本已经正式收住：

- `investor-style-strategic-question`
- `customer-value-question`
- `scope-question`
- `boundary-question`
- `why-now-question`
- `next-step-question`
- `objection-style-founder-question`
- `review-before-send-founder-answer`
- `internal-only-founder-prep`

## 放置规则

首屏必须保留：

- `founderQAJudgement`
- `founderQAReason`
- `founderQAScene`
- `founderQASendability`
- `founderQAFallback`
- `founderQAReviewMode`
- 主边界句
- 当前 `next action`

Secondary summary 可以承接：

- audience mode
- owner
- due date
- risk signal

`EvidenceDrawer` 只承接：

- replay
- audit
- memory
- worker output
- boundary trace
- sendability trace
- `qa_trace`
- `review_trace`
- historical changes

只适合 internal-only 的内容：

- `internal-only-founder-prep`
- review note
- founder 内部校准 cue
- 尚未 customer-safe 的 objection framing

必须降级到 boundary / prerequisite / dependency / non-commitment note 的内容：

- 任何可能被误听成承诺的 founder answer
- 范围未定、依赖未定或 prerequisite 未满足的回答
- 需要 founder 先 internal review 的高压 Q&A

## 当前成立程度

已经完整成立：

- Founder Q&A detail contract 本身
- scene / sendability / fallback / review mode 的最小词汇表
- evidence 分组要求

已成形但仍需下一层：

- 更细 founder Q&A tree
- founder objection / escalation 子变体
- 更细 founder oral pack 绑定

刻意未做：

- 不把它扩成完整 founder enablement 平台
- 不把它扩成完整 messaging platform
- 不把 Q&A 生成器写成自动承诺引擎

风险项：

- founder wording 天生更容易被误读成 commitment，所以 fallback 和 boundary 仍必须前置
