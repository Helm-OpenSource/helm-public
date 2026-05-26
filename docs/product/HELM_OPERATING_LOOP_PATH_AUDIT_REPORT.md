---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Operating Loop Path Audit Report

## Scope

本轮只审计并压缩 Helm 当前最重要的 4 条 operating loop 主路径，不扩成 workflow / orchestration engine。

## Path 1

### 首页 judgement -> role handoff -> next action

- 当前入口：`/dashboard`
- judgement 形成处：goal-driven home 的 `Current Campaign`、`Top 3 Operating Judgements`
- next action 触发处：新增 `Top 3 immediate actions`
- handoff 发生处：`Role-specific Handoffs`
- evidence / memory 解释处：`Evidence / Trace entry` 与新增 `Retro -> memory / goal / campaign`
- 当前摩擦点：过去需要先看 judgement，再跳 role surface，之后再自己拼 next action

Before / After

- Before：约 4 步
  1. 读 judgement
  2. 打开 role handoff
  3. 再次理解 why-now
  4. 才决定下一步动作
- After：约 2 步
  1. 在首页直接看 `Top 3 immediate actions`
  2. 进入对应 role / object 页面执行
- 仍不可避免的步骤：真正高风险动作仍需 review / approval

## Path 2

### lead / opportunity judgement -> follow-up / proposal / offer move

- 当前入口：`/operating`、`/operating/roles/sales`
- judgement 形成处：operating home 的 `Top judgements` 与 Sales role handoff 的 `Current judgements`
- next action 触发处：新增 `Top 3 immediate actions`、`High-frequency action templates`
- handoff 发生处：Sales role surface 和 object card `handoffRole`
- evidence / memory 解释处：object card 的 meetings / decisions / retros，以及 role surface evidence
- 当前摩擦点：过去接手后还要自己决定到底是 follow-up、proposal 还是 review request

Before / After

- Before：约 5 步
  1. 打开 operating home
  2. 打开 Sales 接手面
  3. 找对象
  4. 拼 next action wording
  5. 再跳进具体页面
- After：约 3 步
  1. 打开 Sales 接手面
  2. 直接从 `Top 3 immediate actions` 或 action template pack 进入
  3. 在具体 detail 页面执行
- 仍不可避免的步骤：对外 sendable move 仍要显式过 boundary / review-before-send

## Path 3

### customer success judgement -> issue / escalation / expansion next action

- 当前入口：`/customer-success` 与 `/operating/roles/customer-success`
- judgement 形成处：customer success queue judgement 与 role handoff judgement
- next action 触发处：新增 queue surface fast path：`Top 3 immediate actions`
- handoff 发生处：`review request -> customer success`、`customer success -> founder / sales / delivery`
- evidence / memory 解释处：queue evidence drawer、success memory、review trace
- 当前摩擦点：过去 queue / inbox 已可见，但从看见 issue 到决定谁接、现在先做什么仍有一层整理成本

Before / After

- Before：约 5 步
  1. 读 queue judgement
  2. 打开 detail
  3. 再判断 issue / escalation 子变体
  4. 回看 evidence
  5. 再决定下一步
- After：约 3 步
  1. 在 queue 直接看 `Top 3 immediate actions / Top 3 decisions waiting / Top 3 blockers to clear`
  2. 进入 success check / expansion review / detail
  3. 执行动作并回挂结果
- 仍不可避免的步骤：外发、升级承诺、renewal certainty 仍不能跳过 non-commitment

## Path 4

### meeting / review / decision -> task / follow-through / memory write-back

- 当前入口：meeting detail、review request、customer success queue、operating workspace object card
- judgement 形成处：meeting / review 的当前 judgement 与 object current judgement
- next action 触发处：新增 `Retro -> memory / goal / campaign`
- handoff 发生处：meeting -> follow-through owner、review -> next owner、customer success -> founder / sales / delivery
- evidence / memory 解释处：memory timeline、object retros、decision trace、boundary trace
- 当前摩擦点：过去复盘结果可查，但“要回挂到哪里”没有一层快路径说明

Before / After

- Before：约 4 步
  1. 读结果
  2. 找 memory
  3. 找 campaign / object summary
  4. 再自己决定如何回挂
- After：约 2 步
  1. 直接从 `Retro -> memory / goal / campaign` 入口判断回挂目的地
  2. 回到 memory / operating / campaign surface 引用
- 仍不可避免的步骤：需要保留 boundary trace 的事项仍要保留在 evidence / replay 层

## Conclusion

- 当前 operating loop 主路径已经清楚
- 本轮提速不是“自动化更多”，而是明确最短可执行路径
- recommendation / commitment 继续分离：快路径只缩短进入动作的时间，不会把 discussion-only / boundary-only 写成 commitment
