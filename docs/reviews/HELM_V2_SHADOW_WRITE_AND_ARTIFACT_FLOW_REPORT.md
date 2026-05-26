---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_V2_SHADOW_WRITE_AND_ARTIFACT_FLOW_REPORT

## 当前落地范围

本轮已经把 `confirmed meeting facts -> downstream opportunity judgement handoff` 接起来了。

对应实现：

- [meeting runtime service](../../lib/helm-v2/meeting-action-pack-runtime.ts)

## 当前支持的 downstream outputs

确认后的 meeting facts 现在至少可以驱动：

- `meeting.facts_created` runtime event
- downstream `Opportunity Judge` trigger
- reviewable opportunity judgement artifact creation
- `checkpoint memory`

## artifact review execution flow

当前 artifact flow 已经形成最小闭环：

1. artifact created
2. artifact reviewed
3. artifact confirmed / rejected / kept draft
4. confirmed artifact consumed by next worker / next surface

在 Sprint 2 里，`meeting_facts.json` 与 `action_pack.md` 会在进入 downstream judgement handoff 后进入 `consumed` posture。

## shadow / official 边界

本轮继续冻结：

- Sprint 2 当前只负责把 confirmed facts 交给 downstream judgement
- 真正的 `shadow consume` 现在由 Sprint 4 的 review path 单独负责
- 不写 `official` stage / risk / next action
- 不写 external CRM system-of-record

这条边界现在已经不只在文档里，而是落在实际 write path 上。

## 当前结论

Sprint 2 已经跑通了 action pack -> downstream opportunity judgement handoff 的真实 execution flow。  
但这仍然只是 internal-only judgement layer，不是 official CRM automation。
