---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Cross-detail Handoff Baseline Freeze Report

## 当前冻结的核心语义

当前 cross-detail handoff baseline 冻结为：

- `handoffSource`
- `handoffTarget`
- `handoffReason`
- `handoffBoundary`
- `handoffPrerequisite`
- `handoffDependency`
- `handoffRisk`
- `handoffDecisionRequest`
- `handoffNextAction`
- `handoffWorkerSummary`
- `handoffEvidenceSummary`
- `handoffVisibilityMode`

## 当前明确成立的 handoff

当前 baseline 已明确冻结：

- `proposal -> package`
- `package -> customer-facing offer`
- `customer-facing offer -> external proposal`
- `external proposal -> reinforcement`
- `reinforcement -> sendability`
- `package variants <-> reinforcement variants`

## 允许 handoff 的当前规则

### 当前允许 handoff

- 当前页 judgement 已经形成
- 当前页 boundary 已经可解释
- 下一页的用途比当前页更清楚
- 当前切页能带来更明确的 next action / decision request / collaboration request

### 当前只能 internal-only handoff

- 当前还没有 customer-safe cue
- 当前仍停留在 review / shaping / strengthening 的内部窗口
- 当前一旦切到下一页就可能放大外部预期

### 当前必须 review-before-send

- 当前 handoff 会改变 sendability
- 当前 handoff 会把 wording 从 internal-only 推向 customer-visible
- 当前 handoff 会让 strengthening 更容易被误解成 commitment

### 当前必须停在 boundary-only / non-commitment

- prerequisite 未满足
- dependency 未满足
- risk reduction 还没完成
- 当前 discussion-only 仍不能升级成 customer-visible commitment

### 当前会触发谁介入

- founder：当 boundary、sendability 或 strengthening level 会改变经营承诺风险
- sales：当需要继续推进 customer-visible narrative、next-step 或 follow-up
- delivery：当需要澄清 delivery scope、prerequisite、dependency
- customer success：当前仍不是主落地点，只是下一层候选

## 当前刻意未做

- 自动 handoff routing
- workflow engine
- orchestration engine
- process engine
- 全站统一 handoff inbox

原因是本轮只冻结“为什么切页、切页时边界怎么变、谁接手、接下来做什么”的最小 handoff baseline。

## Freeze 结论

当前 cross-detail handoff model 已经清楚。它已经足够让 commercial detail 页切换不再只是导航动作，而是带着：

- 交接原因
- 当前边界
- 当前风险
- 下一步动作
- 相关 worker cue
- 相关 evidence cue

一起移动。

这仍然不等于完整 workflow / orchestration / process engine。
