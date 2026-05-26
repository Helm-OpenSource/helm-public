---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Limited Auto Eligibility Report

## 结论

limited auto eligibility policy 已成立，而且是运行时可检查逻辑，不是 prompt 约定。

## 当前 eligibility 检查项

进入 limited auto 前，当前至少检查：

- action type 是否在白名单
- evidence 是否充分
- approval 是否到位
- current boundary 是否允许
- source provenance 是否可信
- current risk review 是否通过
- target system / target object 是否支持 acknowledgement
- rollback / reconciliation 是否有明确路径

## 当前输出状态

当前 runtime 会把 limited auto eligibility 收成以下四档：

- `eligible`
- `eligible_but_manual_only`
- `blocked`
- `deferred`

## 当前 current-main 规则

- `crm.attach_note`
  - 在 evidence、approval、ack posture 都满足时可进入 `eligible`
- `crm.attach_handoff_summary`
  - 仍进入 `eligible_but_manual_only`
  - 原因是 pilot disabled 且 rollback story 仍弱
- `crm.update_official_stage`
- `crm.update_next_action`
- `crm.update_blockers`
  - 本轮不进入 limited auto contract
  - 继续停在 guarded manual path

## 当前边界

- eligibility 不等于 execution
- approved 不等于 actual official write success
- 没有 explicit approval 不执行
- 没有 strong acknowledgment 不视为成功
- no broad auto-write

## 通过标准结果

已经满足：

- limited auto eligibility 已成立
- 不是“想自动就自动”
- 进入 limited auto 的门槛已清楚
