---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Program Catalog + Terms + Application Intake Baseline v1

## 1. 目标

这份 baseline 冻结 Helm 当前第一层对外参与入口：

- program catalog exists
- versioned terms exist
- controlled application intake exists
- internal admin review exists

它回答的是：

- 外部的人现在能看到哪些参与项目
- 当前规则版本是什么
- 如何提交申请
- 申请进入内部 review 之后会怎样

它不回答：

- payout rails
- public marketplace
- partner ranking / discovery
- automatic portal access
- workflow control

## 2. 当前成立对象

当前 v1 对外参与层新增 3 个对象：

1. `PartnerProgram`
2. `ProgramTermsVersion`
3. `ProgramApplication`

它们建立在已经存在的对象之上：

- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`
- `RevenueRule`
- `RevenueAttributionLedger`
- `PayoutLedger`
- `ParticipantPortalAccess`

## 3. 当前开放的 programs

当前 program catalog 冻结为 3 条收益线：

1. `Worker Publisher Program`
2. `Custom Partner Program`
3. `Sales Referral Program`

每条 program 当前都必须讲清：

- 适合谁
- 能做什么
- 收入来自哪里
- 结算节奏
- 当前不是 marketplace
- 当前不是自动打款

## 4. ProgramTermsVersion truth

每条 program 当前都必须挂一条 `ProgramTermsVersion`。

当前 versioned terms 至少冻结以下内容：

1. 收益线定义
2. split logic summary
3. reversal / refund summary
4. review / approval boundary
5. payout 仍然是 manual / off-platform
6. 平台保留审核、暂停、等待名单、停用与不发 invite 的权利

这一步是 rules surface，不是 legal automation engine。

## 5. Application intake truth

当前 application intake 是：

- public-readable
- controlled
- admin-reviewable

当前申请状态冻结为：

- `submitted`
- `accepted`
- `rejected`
- `waitlisted`
- `invited`

关键 truth：

- `accepted` 不等于已经进入 contributor portal
- application 不自动创建 portal access
- `invited` 表示 internal admin 已经从 review queue 发出了真实 invite，并且 application 已经挂到对应的 participant portal access
- 但 `invited` 仍然不等于对方已经完成 onboarding、也不等于 payout 已执行
- 真正的 portal access issuance 仍然要走 internal admin 的独立 invite issuance 动作，而不是 public application 自动触发

## 6. 内部 review truth

当前内部 review 仍然停在现有 `settings / internal admin seam` 中。

内部当前至少可以看：

- 谁申请了
- 申请的是哪条 program
- terms version 是什么
- 当前状态是什么
- 推荐 beneficiary type 是什么
- 是否已经到 invite posture

这一步是 internal admin review，不是 partner platform。

## 7. 可见性边界

当前 program catalog / application layer 的边界固定如下：

1. public pages 只负责 program + terms + application intake
2. internal admin scope remains separate
3. participant portal 仍是 self-only
4. no public marketplace
5. no public partner discovery or ranking
6. no payout execution
7. no public finance console
8. no automatic invite issuance

## 8. preserved boundaries

当前这层必须继续诚实保留：

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route/query rewrite
- no send authority
- no workflow control
- no payout rails
- no marketplace
- no broader governance/admin platform

## 9. 当前成立结论

当前 v1 可以诚实表达为：

- public program catalog exists
- versioned terms exist
- controlled application intake exists
- internal admin review exists

当前还不能表达为：

- public marketplace
- partner self-serve discovery platform
- automatic portal onboarding
- payout execution readiness
