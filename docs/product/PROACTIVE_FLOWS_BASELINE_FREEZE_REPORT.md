---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# PROACTIVE_FLOWS_BASELINE_FREEZE_REPORT

## 当前冻结的 3 条代表性主动链路

1. 风险变化 -> Helm 主动汇报 -> founder 决策请求
2. proposal / package 进入新阶段 -> Helm 主动汇报 -> sales / delivery 协作
3. worker 完成 internal draft -> Helm 主动汇报 -> review / approval / next-step request

## 1. 风险变化 -> founder 决策请求

### 触发条件

- 首页风险信号升高
- 待审批动作或经营风险已经值得 founder 级别拍板

### judgement 输出

- 首页今天的第一经营判断
- 为什么这是 founder 现在该看的经营事项

### boundary / worker / evidence

- boundary：高风险和对外动作仍然停在审批、策略和审计边界后面
- worker：recommendation worker、approval worker、conversation worker
- evidence：风险信号、待审批、会议与 memory 下钻

### 决策与动作

- Helm 可以先做：排序、准备上下文、把风险抬上前台
- Helm 只能建议：哪条线应成为今天的第一动作
- 必须人工拍板：是否把 recommendation 变成 founder 级经营承诺
- 必须升级为人工主导：高风险外部动作或信任敏感执行

## 2. proposal / package 新阶段 -> sales / delivery 协作

### 触发条件

- 某条机会进入可成形的 proposal / package shaping window

### judgement 输出

- 这条机会为什么不该再被当成静态 pipeline 行
- 当前应该优先以 follow-up、meeting 还是 internal clarification 继续推进

### boundary / worker / evidence

- boundary：proposal wording、external commitment、stage hardening 仍属于人工 owner
- worker：sales worker、delivery worker
- evidence：blockers、commitments、briefing snapshot、memory / replay / approval 下钻

### 决策与动作

- Helm 可以先做：整理 follow-up frame、scope / dependency note、ranking context
- Helm 只能建议：下一步更适合 follow-up、meeting 还是内部澄清
- 必须人工拍板：当前 framing 是否可以进入外部动作
- 必须升级为人工主导：一旦风险变高或开始硬化外部承诺

## 3. worker internal draft -> review / approval request

### 触发条件

- worker 完成 review-worthy internal draft
- draft 已跨过 review boundary

### judgement 输出

- 哪条 draft 已经成熟到需要 review
- 为什么它还不安全到可以 self-authorize

### boundary / worker / evidence

- boundary：external send、trust-sensitive execution、commitment hardening 仍需要人工 owner
- worker：recommendation worker、approval worker
- evidence：facts、blockers、commitments、source context、replay / audit / memory

### 决策与动作

- Helm 可以先做：整理 draft、why-now explanation、execution preview
- Helm 只能建议：批准、改写、转人工还是继续拦住
- 必须人工拍板：是否让 draft 进入执行
- 必须升级为人工主导：高风险外发、不可逆执行、承诺硬化

## 结论

- 风险链、proposal / package 链、internal draft to review 链已经足够稳定可冻结。
- 当前交付、培训、验收都能复用同一套主动工作表达。
- 不需要再靠口头解释才能说明 Helm 是怎么主动工作的。
