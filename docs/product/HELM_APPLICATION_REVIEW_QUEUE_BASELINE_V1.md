---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Application Review Queue + Invite Issuance Baseline v1

## 1. 目的

冻结当前 PR17 在 program application 层新增的最小 operational truth：

- application review queue exists
- accepted applications can issue real participant invites from the same internal seam
- `invited` means a real invite was issued
- issued invites stay linked back to the source application

它不代表：

- public marketplace
- automatic portal onboarding
- payout execution
- public partner discovery
- workflow control

## 2. 当前成立对象与关系

PR17 继续沿用并收紧现有对象：

- `ProgramApplication`
- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`
- `ParticipantPortalAccess`

当前新增成立的关系是：

1. application review queue exists inside the current settings / internal admin seam
2. accepted applications can create or reuse a beneficiary record
3. issued invite links the application back to:
   - beneficiary record
   - participant portal access

## 3. 当前 review queue truth

当前 `ProgramApplication` 的最小 operational truth 是：

- `submitted` = 已进入内部审核队列
- `accepted` = 已通过 review，但还未发 invite
- `rejected` = 当前不进入邀请流程
- `waitlisted` = 等待名单
- `invited` = invite 已真实发放

当前 `invited` 的含义已经冻结为：

- internal admin 已执行 invite issuance
- application 已关联对应 beneficiary / portal access
- 但对方仍可能尚未完成 onboarding

## 4. 当前 invite issuance truth

invite issuance 现在是 queue 内的真实下一步，而不是额外分散的隐式动作。

当前已经成立：

1. accepted applications can issue real participant invites
2. issue invite 时会创建或复用对应 beneficiary record
3. application 会回写关联 beneficiary id
4. application 会回写 `participantPortalAccessId`
5. invite link 会在当前 queue 内直接可见

当前仍明确未做：

- public application 自动生成 portal access
- automatic invite issuance
- public self-signup without review

## 5. 当前 admin / participant 边界

当前这层继续保持：

- internal admin queue remains separate
- participant portal remains self-only
- application submission still does not create portal access automatically
- issue invite remains manual / internal
- no marketplace
- no payout execution

## 6. preserved boundaries

以下边界继续冻结：

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route/query rewrite
- no send authority
- no workflow control
- no payout rails
- no public marketplace
- no broader governance/admin platform

## 7. 当前基线一句话

当前 Helm 已经具备：

- controlled application review queue
- accepted -> invited 的真实内部推进动作
- application 与 beneficiary / portal access 的回链

但仍明确停在：

- manual invite issuance
- self-only participant portal
- no marketplace
- no payout execution
