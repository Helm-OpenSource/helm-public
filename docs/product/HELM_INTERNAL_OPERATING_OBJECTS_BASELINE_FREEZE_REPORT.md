---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Internal Operating Objects Baseline Freeze Report

## 冻结对象层

当前 internal operating objects baseline 冻结为：

- Lead
- Customer / Account
- Candidate
- Partner
- Workstream

## 每类对象固定 truth

### Lead

- 当前判断：是否仍有真实商业推进价值
- 当前阶段：以 `NEW / CONTACTED` 为主
- owner / handoff：默认偏 `Sales`
- next action：follow-up / proposal / clarification
- boundary / risk：对外承诺仍受 sendability / review 约束
- 经营链关系：signup signal -> proposal -> follow-up -> conversion

### Customer / Account

- 当前判断：是否已进入真正的跨角色 follow-through
- 当前阶段：以 `ADVANCING / WAITING_THEM / INTERNAL_SYNC` 为主
- owner / handoff：`Sales / Delivery / Customer Success`
- next action：review、activation、issue follow-through、renew path
- boundary / risk：客户承诺继续受 review / sendability / delivery readiness 共同约束
- 经营链关系：proposal -> offer -> review request -> customer success -> renew

### Candidate

- 当前判断：是否值得继续投入 interview / offer 节奏
- 当前阶段：招聘推进链中的 live stage
- owner / handoff：默认偏 `Recruiting`
- next action：next interview / fit clarification / offer readiness
- boundary / risk：候选人侧节奏不能滑成 uncontrolled outreach
- 经营链关系：role demand -> interview -> next interview -> offer timing

### Partner

- 当前判断：是否真能带来 custom delivery 或客户连接杠杆
- 当前阶段：伙伴接触与合作推进链
- owner / handoff：默认偏 `Partner`
- next action：fit clarification / custom scope / customer matching
- boundary / risk：partner-facing promise 继续受 founder / delivery / dependency 约束
- 经营链关系：partner fit -> custom leverage -> customer connection -> dependency risk

### Workstream

- 当前判断：这条经营 lane 现在为什么重要
- 当前阶段：跨对象、跨角色的 operating rhythm
- owner / handoff：默认偏 `Founder / Sales / Recruiting / Partner`
- next action：推进 lane 内 friction 最大的对象
- boundary / risk：不是 system of record，不是独立平台
- 经营链关系：把 meetings / decisions / tasks / retros 重新挂回经营链

## 冻结结论

当前五类对象已经足够作为 internal operating workspace 的标准对象层。

这轮刻意不做：

- 更大的 canonical schema 扩张
- 独立 CRM / ATS / partner / PM 对象平台
- 多组织 / 多租户 / 多权限对象体系
