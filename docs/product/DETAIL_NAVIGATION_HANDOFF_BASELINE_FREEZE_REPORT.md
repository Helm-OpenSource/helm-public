---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Detail Navigation / Handoff Baseline Freeze Report

## 当前冻结的关键链路

当前 baseline 冻结以下 3 条关键 detail 链路：

1. `proposal -> package -> customer-facing offer`
2. `customer-facing offer -> external proposal -> reinforcement`
3. `package variants <-> reinforcement variants`

## 链路 1：proposal -> package -> customer-facing offer

### 当前链路 judgement

- `proposal` 用来判断当前是否值得先进入 shaping / review
- `package` 用来判断当前是否已经收成更结构化的对外准备窗口
- `customer-facing offer` 用来判断当前是否已经进入 customer-safe 表达窗口

### handoff reason / boundary / next action

- `proposal -> package`
  - handoff reason：从较早的商业判断切到更结构化的 package shaping
  - handoff boundary：当前仍不是 commitment，仍需要 prerequisite / dependency / non-commitment note
  - next action：确认 package 结构、边界和当前 decision request
- `package -> customer-facing offer`
  - handoff reason：当前需要判断是否进入 customer-visible expression
  - handoff boundary：切页可能改变 sendability，所以必须带 boundary / audience / review cue
  - next action：确认当前是否 customer-safe、是否需要 review-before-send

### worker / evidence / decision request

- worker summary：sales / delivery 相关 worker 会随 handoff 带过去
- evidence：replay / audit / memory / boundary trace 仍保持在附注层
- decision request：当 sendability 或 audience 会变化时，必须保留 decision request

### Helm 能做什么

- Helm 可以先整理 judgement、boundary、worker cue 和 evidence cue
- Helm 可以建议切到下一页
- Helm 不能替人把 recommendation 写成 commitment
- Helm 不能绕过 review / approval 去对外发出高风险表达

## 链路 2：customer-facing offer -> external proposal -> reinforcement

### 当前链路 judgement

- `customer-facing offer` 用来判断当前外部表达是否 safe-to-send 或 safe-with-boundary
- `external proposal` 用来判断当前是否进入更正式的 external-safe 组织窗口
- `reinforcement` 用来判断当前还能否加强表达而不越界

### handoff reason / boundary / next action

- `customer-facing offer -> external proposal`
  - reason：需要更完整地组织 external-safe 说法
  - boundary：current sendability 仍可能受 prerequisite / dependency / risk note 影响
  - next action：确认 external-safe cue、review gate 和 next-step wording
- `external proposal -> reinforcement`
  - reason：当前要决定是否把表达增强到更强层级
  - boundary：strengthening 不等于 commitment，必须保留 non-commitment / review-before-send
  - next action：确认当前强化是否只停在 recommendation-only、customer-visible-light 或 review-before-send

### worker / evidence / decision request

- worker summary：sales worker / founder review cue 会随页切换一起保留
- evidence：boundary trace、sendability trace、historical changes 保持在 evidence drawer
- decision request：当前一旦强化会改变客户预期时，必须请求人工拍板

### Helm 能做什么

- Helm 可以先准备 stronger-but-safe 的 wording
- Helm 可以建议切到 reinforcement detail
- Helm 不能直接把 strengthening 提升成 customer-visible commitment
- Helm 必须在风险升高时停手并请求 review / approval / founder intervention

## 链路 3：package variants <-> reinforcement variants

### 当前链路 judgement

- `package variants` 用来判断当前更适合哪个 variant intent / stage / audience
- `reinforcement variants` 用来判断当前 strengthening level 应停在哪一层，或是否必须 fallback

### handoff reason / boundary / next action

- `package variants -> reinforcement variants`
  - reason：当前需要判断 variant 是否还能 customer-visible strengthening
  - boundary：当前 variant 仍可能 only internal-prep、review-before-send、boundary-only
  - next action：确认 strengthening level、fallback 和当前 visibility
- `reinforcement variants -> package variants`
  - reason：当前 strengthening 结果需要回流到 variant 选择
  - boundary：如果 strengthening 被降级，variant 也必须跟着降级
  - next action：确认当前应回到哪个 variant stage / audience / intent

### worker / evidence / decision request

- worker summary：worker 会说明当前哪些 variant cue 已准备、哪些 strengthening cue 仍在 review
- evidence：reinforcement trace、sendability trace、boundary trace 仍保持在附注层
- decision request：当 variant / strengthening 会改变 customer-visible 预期时，需要 decision request

### Helm 能做什么

- Helm 可以先整理 variant / strengthening recommendation
- Helm 可以建议 fallback
- Helm 不能把 exploratory / discussion-only / boundary-only 写成 commitment
- Helm 不能让 internal-only variant 混入 customer-facing 语义

## 当前可接受的遗留

- 当前链路仍建立在既有 commercial detail context 上
- 当前还没有全站统一 detail shell
- 当前还没有更细的 package stage variants / commercial narrative strengthening variants

这些遗留当前可接受，但下一阶段优先级较高。

## Freeze 结论

当前 3 条关键 detail 链路已经足够作为下一阶段扩 proposal / package / offer / reinforcement / variants 之外更多 detail chain 的模板。
