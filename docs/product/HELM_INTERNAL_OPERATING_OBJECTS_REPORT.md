---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Internal Operating Objects Report

## 本轮结论

当前 Helm 已经把以下 5 类对象收成第一轮统一经营对象层：

- Lead
- Customer / Account
- Candidate
- Partner
- Workstream

这轮没有新增 schema，而是基于当前主对象 truth，把这些经营对象从现有 `Opportunity + Meeting + ActionItem + ApprovalTask + MemoryEntry + AuditLog` 中收出来。

## 统一 truth

### Lead

- 当前来源：`CLIENT` 类型机会中的 `NEW / CONTACTED` 阶段
- 当前判断：这是潜在收入链，不只是联系人列表
- 当前 owner / 接手角色：默认 `Sales`
- 当前下一步：proposal、follow-up、conversion 前的最小商业推进
- 当前风险 / 边界：对外承诺仍受 sendability / review request 约束
- 当前与经营链关系：连接 signup signal、proposal、follow-up、conversion

说明：

- 当前 v1 仍以 workspace 内的客户机会作为 lead 主表达层。
- “注册用户 / trial 组织 / paid 组织会成为 Helm lead 输入”这件事在产品 truth 上已明确，但本轮没有把它扩成完整多组织 lead admin 平台。

### Customer / Account

- 当前来源：`CLIENT` 类型机会中的 `ADVANCING / WAITING_THEM / INTERNAL_SYNC`
- 当前判断：已经进入销售、交付、customer success 共同接力阶段
- 当前 owner / 接手角色：`Sales / Delivery / Customer Success`
- 当前下一步：follow-through、review、activation、renew / restore
- 当前风险 / 边界：客户承诺仍受 review、sendability、delivery readiness 约束
- 当前与经营链关系：连接 proposal、offer、review request、customer success、payment rail

### Candidate

- 当前来源：`RECRUITING` 类型机会
- 当前判断：候选人链的关键是时序与 role fit，而不只是状态更新
- 当前 owner / 接手角色：`Recruiting`
- 当前下一步：next interview、panel、offer timing
- 当前风险 / 边界：候选人体验和节奏不能失控
- 当前与经营链关系：连接 role demand、meeting、interview、offer

### Partner

- 当前来源：`PARTNERSHIP` 类型机会
- 当前判断：伙伴不是资源名录，而是 capability / custom / customer connection 的经营链
- 当前 owner / 接手角色：`Partner / Founder`
- 当前下一步：scope、dependency、共同对外表达、交付边界
- 当前风险 / 边界：不能滑成 marketplace 叙事
- 当前与经营链关系：连接 custom 服务、客户连接、联合推进

### Workstream

- 当前来源：从现有对象导出的 lane，不是新 schema：
  - 收入推进工作流
  - 产品与交付工作流
  - 招聘推进工作流
  - 伙伴与 custom 工作流
- 当前判断：workstream 是把会议、决策、任务、复盘重新挂回经营链的节奏层
- 当前 owner / 接手角色：`Founder / Sales / Recruiting / Partner / Delivery`
- 当前下一步：推进该 lane 中 friction 最大的对象
- 当前风险 / 边界：不是 PM / task platform，也不是独立 system of record
- 当前与经营链关系：把对象、动作、风险、证据重新收回同一张 operating picture

## 关系说明

### Leads 与注册用户 / trial / paid 的关系

- 业务 truth：所有注册 Helm 的人都是 Helm 的 customer lead 输入
- 当前页面 truth：本轮内部经营 workspace 先以当前 workspace 内的 `CLIENT` 机会作为 lead 主表现层
- 刻意未做：不扩成完整多组织 lead admin 平台

### Candidates 与招聘流程 / 内部 role 需求的关系

- 当前通过 `RECRUITING` 机会表达
- role fit、面试、offer、流失原因都挂在同一条候选人推进链上

### Partners 与 custom 服务 / 客户连接 / 资源接入的关系

- 当前通过 `PARTNERSHIP` 机会表达
- 强调 capability、custom scope、dependency 和 customer connection

### Workstreams 与内部经营节奏的关系

- 当前把产品 / 销售 / 交付 / 招聘 / 伙伴节奏压成 lane
- 刻意未扩成 PM / task / org chart 平台

## 边界

本轮刻意未做：

- 完整 CRM 平台
- 完整 ATS / 招聘平台
- 完整 partner marketplace
- 完整 PM / task management 平台
- 完整多组织 lead admin 平台

当前这层是 internal operating objects foundation，不是完整 operating system 平台。
