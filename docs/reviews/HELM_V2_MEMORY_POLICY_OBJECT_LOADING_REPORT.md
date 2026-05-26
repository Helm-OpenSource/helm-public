---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Memory Policy Object Loading Report

## 总结

memory / policy / object loading 策略已成立。

Sprint 7 不只是定义 retrieval buckets，还把 loading order、priority 和 conflict rule 收成一版可复用 current-main truth。

## 当前加载规则

### Always-on

- workspace summary
- current meeting / primary opportunity summary
- policy summary

### Stage-triggered

- proposal / approval / official-write stage policy
- 与当前 namespace 更贴近的 object summary

### Event-triggered

- handoff / checkpoint memory
- official-write intent created 相关 approval policy
- meeting / proposal / handoff 事件相关附加记忆

### On-demand

- 历史长尾会议
- 更旧的总结
- 低优先级 learned pattern

## 当前优先级

- policy vs object fact：policy 约束始终优先解释动作边界，但不会替代 object fact
- object fact vs inferred pattern：object fact 优先，inferred 只能作次级参考
- confirmed checkpoint vs stale memory：confirmed checkpoint 优先，stale memory 可被 suppress
- latest timeline vs older summary：latest timeline 优先，older summary 只作补充

## 当前冲突规则

- 新旧事实冲突：优先最新且更高验证级别的事实
- fact 和 inferred 冲突：fact 胜出，inferred 保留为 open question / secondary hint
- system_of_record 和 human_confirmed 冲突时怎么办：
  - 默认 `system_of_record` 作为 object fact 胜出
  - `human_confirmed` 仍可保留为 checkpoint 或 review note

## 已经完整成立

- loading order
- priority posture
- stale suppression
- conflict resolution helper

## 已成形但仍需下一层

- richer conflict visualization
- more nuanced freshness windows
- broader object-type loading policies

## 刻意未做

- 自动把 scratch promotion 成长期记忆
- inferred 覆盖 fact
- history flood loading

## 风险项

- richer connectors 进入后，conflict cases 会显著增加
- loading policy 需要持续防止“越加越多”的上下文膨胀
