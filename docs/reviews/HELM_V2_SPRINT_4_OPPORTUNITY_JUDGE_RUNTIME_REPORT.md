---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Sprint 4 Opportunity Judge Runtime Report

## Short Table

| Topic | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Runtime tables | 复用 Sprint 2 持久化 runtime tables 即可支撑 Sprint 4 | 更细粒度 judgement history 表仍可后续再补 | 没有新增 broader runtime platform | 长期会需要更多 opportunity timeline 样本 |
| Opportunity Judge runtime | `runOpportunityJudgeRuntime(...)` 已真实运行 | 更深的 CRM / pipeline context 仍待后续接入 | 不做 official CRM writeback | 复杂 multi-thread deal judgement 仍需更多真实数据 |
| Opportunity delta artifacts | `opportunity_delta.json` 已统一 | 更丰富的 probability / champion modelling 仍可继续做 | 不做完整 CRM engine | judgement 规则仍需继续压真实 case |
| Manager attention / next-step brief | 已成为独立产物 | 后续还可接 operating home / handoff surfaces | 不做 manager auto-decision | 高噪声 case 仍可能需要更细的 escalation policy |
| Opportunity judgement review surface | 已在 meeting detail 落地 | 后续可再补 opportunity-native surface | 不做 second app tree | review ergonomics 仍有继续打磨空间 |
| Shadow consume path | confirmed review 后已进入 shadow summary | 更细的 checkpoint / memory routing 仍待后续补 | 不做 official CRM writeback | shadow summary 质量仍依赖 review discipline |
| Eval harness | Sprint 4 eval 已可独立运行 | goldens 数量仍可继续扩 | 不做 subjective-only launch | fixture 覆盖面仍有限 |
| Documentation / guard / test alignment | README / docs / self-check / boundary / tests 已同步 | 更细的 future-stage checks 可继续补 | 不做夸大完成度叙事 | 文档要持续跟 runtime 一起更新 |
| Recommendation / commitment boundary | 当前仍稳定 | 更细粒度 commitment taxonomy 仍待后续补 | 不做 customer commitment automation | wording 漂移仍需长期 guard |
| Official vs shadow separation | 当前仍清楚 | 后续 official path 若开启需单独 sprint | 不做 official write path | 后续只要接 CRM official path，风险会显著上升 |
| Runtime sandbox / team mode | 当前仍未打开 | 若未来做更复杂任务可再评估 | 不做 sandbox，不做 default team mode | 复杂任务扩张时容易误开 scope |

## Questions

### 1. Opportunity Judge 是否已经真实运行

是。`confirmed meeting facts` 现在已经能真实触发 `Opportunity Judge`，并在 runtime tables 中记录 event / worker run / artifacts / review posture。

### 2. shadow delta / blocker / next best action 产物是否已经统一

是。`opportunity_delta.json` 现在已经统一承载 stage shadow delta、blockers、risk flags、next best action、decision criteria、champion posture 和 boundary notes。

### 3. manager attention flags 与 next-step brief 是否已经成立

是。`manager_attention_flags.json` 与 `next_step_brief.md` 已经成为独立 runtime 产物，而不是页面临时拼接。

### 4. opportunity judgement review surface 是否已经成立

是。meeting detail 现在已经有专门的 Sprint 4 review surface，支持 confirm / edit_confirm / reject / keep_draft / block_boundary / insufficient_evidence。

### 5. shadow consume path 是否已经成立

是。review confirm 后，judgement 会进入 `shadowStage`、`shadowNextAction`、`shadowBlockersSummary`、`shadowManagerAttentionFlag`、`nextStepSummary` 等 shadow-only summary 字段，并补 checkpoint / audit trace。

### 6. 第三批 eval harness 是否已经成立

是。Sprint 4 eval 现在已经覆盖：

- stage judgement correctness
- blocker ranking
- next best action usefulness
- manager attention usefulness
- shadow / official boundary
- evidence sufficiency

### 7. 当前 Helm v2 是否已经跑通第三条真实运行闭环

是。当前第三条真实运行闭环已经成立：

`confirmed meeting facts -> Opportunity Judge -> opportunity_delta / next_step_brief / manager_attention_flags -> human review -> shadow consume`

### 8. 哪些地方刻意未做，为什么

刻意未做：

- official CRM writeback
- send authority
- workflow control
- default team mode
- second app tree

原因是 Sprint 4 的目标是先把会后判断层做成 `shadow-only、review-first、可审计` 的真实闭环，而不是把 Helm 过早扩成 CRM engine 或自动执行平台。

### 9. 下一阶段最该做的 5 件事是什么

1. 把 Sprint 4 judgement 结果接进 opportunity-native summary / operating home 的可读层。
2. 增加更多真实 golden cases，尤其是 ambiguous stage / multi-thread blocker 场景。
3. 把 handoff / checkpoint memory 的 consume 规则再细化。
4. 补更强的 operator / manager review ergonomics，而不是扩 worker 数量。
5. 在仍然保持 draft-only / shadow-only 边界下，准备 Sprint 5 的 handoff runtime。
