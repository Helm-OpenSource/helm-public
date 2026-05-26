---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Contributor Portal Baseline v1

## 1. 目的

冻结当前 contributor / partner self-serve onboarding + earnings portal light 的最小 truth。

这个基线只回答：

- 受邀的外部贡献方如何进入 Helm
- 他们能补哪些基础资料
- 他们能看见哪些自己的归因收益 / 结算姿态
- 内部 admin 视图如何继续保持更强、且与外部门户分离

它不代表：

- payout execution 已存在
- marketplace 已开放
- public portal / discovery 已开放
- Helm 已变成 finance console

## 2. 当前冻结结论

### 2.1 self-serve onboarding exists for worker/custom/sales participants

当前已存在一条受控的 self-serve onboarding 路径，覆盖：

- worker contributors
- custom integration / services partners
- sales referrers

入口方式仍然是：

- internal-admin 发放 invited access
- 外部参与方通过 narrow invite path 进入

当前不存在：

- public signup directory
- public discovery
- marketplace listing

### 2.2 earnings portal light exists

当前已存在一层窄的 earnings portal light。

它允许参与方查看：

- identity / role summary
- attributed revenue summary
- payout-later summary
- pending / approved / exported / paid / reversed posture
- worker / custom implementation / custom maintenance / sales referral source breakdown
- manual settlement timing note

### 2.3 participant scope is self-only

当前 participant portal 继续保持 `self-only`：

- 参与方只能看到自己的 attributed revenue lines
- 参与方只能看到自己的 payout statuses
- 不允许 cross-beneficiary visibility
- 不允许 public ranking / leaderboard

### 2.4 internal admin scope remains separate

当前 internal admin scope 仍与 participant portal 分开。

内部更强视图继续留给：

- `OWNER`
- `BILLING_ADMIN`
- `ADMIN`

这些内部视图仍负责：

- registry
- attribution
- payable-later posture
- manual settlement review

普通成员和外部参与方不会获得这些内部 registry / settlement screens。

## 3. 当前外部门户范围

### 3.1 onboarding fields

当前可由参与方补齐：

- display / legal name
- contact
- payout method label
- payout notes / reference
- invoice-required yes/no
- contribution / partner terms acknowledgement

### 3.2 current participant statuses

当前门户状态只使用：

- invited
- active
- suspended
- archived

### 3.3 current earnings visibility

当前门户会继续说明：

- why this line is attributable
- source type
- payout posture
- settlement remains manual / off-platform in this phase

## 4. 刻意未做

以下能力在当前基线中刻意未做：

- no payout execution
- no payout rails
- no bank / wallet transfer
- no public portal
- no marketplace
- no public finance console
- no partner ranking / discovery
- no KYC / tax engine
- no full RBAC builder

## 5. preserved boundaries

以下边界继续冻结：

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route/query rewrite
- no send authority
- no workflow control
- no broader governance/admin platform
- no overclaim of payout execution readiness
- no overclaim of marketplace readiness

## 6. 当前基线一句话

当前 Helm 已经具备：

- invited self-serve onboarding
- self-only earnings portal light
- internal admin registry / attribution / settlement separation

但仍明确停在：

- manual settlement
- off-platform payout
- no public portal
- no marketplace

## Governance markers (do not remove — `scripts/decision-first-boundary-check.ts`)

These canonical assertions are referenced by the boundary-check script. They live here in the baseline document so the customer-facing UI can stay terse without losing the auditable claim:

- Only owner, billing admin, and admin can read internal contributor registry.
- A contributor portal user sees only their own attributed earnings — you cannot see other beneficiaries.
