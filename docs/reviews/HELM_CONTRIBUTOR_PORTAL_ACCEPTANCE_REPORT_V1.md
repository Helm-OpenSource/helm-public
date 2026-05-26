---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Contributor Portal Acceptance Report v1

## 1. 范围

本轮 acceptance 只复核：

- invited self-serve onboarding
- self-only earnings portal light
- internal registry / attribution / settlement 与外部门户的边界分离

本轮不复核：

- payout rails
- marketplace
- public portal discovery
- finance console expansion

## 2. phases completed

### Phase 0

- contributor portal rollout plan 已建立

### Phase 1

- participant portal access foundation 已落地
- beneficiary payout profile basics 可由参与方在 invite flow 中补齐
- invited / active / suspended / archived posture 已可见

### Phase 2

- earnings portal light exists
- 参与方可查看自己的 attributed revenue summary
- 参与方可查看自己的 payout-later / pending / approved / exported / paid / reversed posture
- source breakdown 已可见

### Phase 3

- internal admin scope remains separate
- self-only participant scope 已收口
- normal product members 未获得内部 registry / settlement readability

### Phase 4

- baseline / acceptance / docs index / guard packaging 已补齐

## 3. what landed

- self-serve onboarding exists for worker/custom/sales participants
- earnings portal light exists
- participant scope is self-only
- internal admin scope remains separate
- invited access can be issued internally
- payout profile basics can be reviewed and edited
- participant can see attributed revenue and payout status posture

## 4. what remained deferred

- no payout execution
- no payout rails
- no public portal
- no marketplace
- no public finance console
- no KYC / tax engine
- no partner self-serve discovery / ranking
- no full RBAC builder

## 5. preserved boundaries

- no send authority
- no workflow control
- no second app tree
- no shell thinning
- no route/query rewrite
- no broader governance/admin platform
- no overclaim of payout execution readiness
- no overclaim of marketplace readiness

## 6. validation results

本轮 acceptance 以以下结果为准：

- typecheck
- lint
- self-check
- check:boundaries
- build
- test

全部绿后，才视为当前 contributor portal light 可冻结。

## 7. readiness for next layer

当前基线已经为后续更窄的下一层做好准备：

- future payout-rail PR
- future beneficiary verification / tax collection PR
- future marketplace / discovery PR

但当前仍必须继续诚实表达：

- payout remains off-platform/manual
- participant portal is invited + self-only
- no public portal
- no marketplace
