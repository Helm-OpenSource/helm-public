---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Conversation / External Narrative Chain Baseline Freeze Report

## 当前冻结链路

- `package / offer -> conversation`
- `external proposal / reinforcement -> external narrative`
- `conversation <-> external narrative`
- `founder / sales / delivery narrative variants -> conversation detail`

## 链路 1：package / offer -> conversation

- 当前节点 judgement：当前更需要先准备怎么说，而不是继续堆对象字段
- handoff reason：需要把 package / offer judgement 翻译成 founder、sales 或 delivery 可接手的话术
- handoff boundary：仍必须继续保留 prerequisite / dependency / non-commitment
- next action：确认由谁接话，并决定是否继续停在 review-before-send
- worker summary：保留当前 worker cue，但不展示全量 worker 列表
- evidence drawer：保留 replay / audit / memory / worker output / boundary trace / sendability trace

## 链路 2：external proposal / reinforcement -> external narrative

- 当前节点 judgement：当前更需要判断 narrative 应停在哪一层，而不是继续强化成更像承诺的表达
- handoff reason：把 proposal / reinforcement judgement 收成可对外表达的 narrative level
- handoff boundary：sendability、fallback、review-before-send、non-commitment 继续默认可见
- next action：确认是否可以 customer-visible，或必须继续停在 boundary-only / fallback
- worker summary：保留 narrative shaping 相关 worker cue
- evidence drawer：保留 replay / audit / memory / narrative trace / fallback trace / historical changes

## 链路 3：conversation <-> external narrative

- 当前节点 judgement：当前 conversation 与 external narrative 之间的切换，是从场景化表达切到对外 framing，或从 framing 回到具体说法
- handoff reason：需要在 scene / audience / level / fallback 之间切换主叙事焦点
- handoff boundary：切换时会改变 sendability、non-commitment、narrative level 或 fallback mode
- next action：确认现在要继续说什么、由谁说、是否仍要 review-before-send
- worker summary：保留 conversation / narrative 相关 worker cue
- evidence drawer：保留 handoff evidence，不让链路切换重新丢失上下文

## 链路 4：founder / sales / delivery narrative variants -> conversation detail

- 当前节点 judgement：当前 role-based cue 不是独立资产页，而是 conversation detail 的 scene 入口
- handoff reason：让 founder / sales / delivery 使用同一套 judgement / boundary / next action 语义
- handoff boundary：role cue 可以改变节奏和重点，但不能绕过 boundary / prerequisite / non-commitment
- next action：由当前 owner 确认谁接手下一句
- worker summary：保留相关 pack / scenario cue
- evidence drawer：保留 scene trace / scenario trace

## 当前动作边界

- Helm 可以先做：准备 judgement、boundary、worker cue、next-step framing、evidence grouping
- Helm 只能建议：具体该由 founder、sales 还是 delivery 继续推进
- 必须人工拍板：任何可能被理解成 customer-visible commitment 的强化表达
- 必须升级 review / approval / founder intervention：任何仍停在 review-before-send、boundary-only、non-commitment fallback 的高风险表达

## 当前可接受遗留

- 当前仍是第一轮局部 detail chain，不是全站沟通相关详情页统一
- 当前链路仍主要围绕 package / offer / external proposal / reinforcement 的商业上下文

## 下一阶段优先改造遗留

- 更细的 founder / sales / delivery conversation variants
- conversation / external narrative 与更多沟通类 detail 页的 handoff
- 更完整的 worker / packs / scenarios integration 责任视图

## Freeze 结论

当前 conversation / external narrative 关键链路已经足够作为后续 founder / sales / delivery conversation variants、external narrative fallback variants 和更多沟通相关 detail 页接入的模板，但必须继续明确它只是第一轮 local chain baseline。
