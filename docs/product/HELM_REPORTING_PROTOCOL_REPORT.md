---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_REPORTING_PROTOCOL_REPORT

## 目标

把 Helm 页面从“系统先自述自己做了什么”收口到“用户先完成判断和动作，再决定要不要看系统解释”。

当前页面组件与信息层级的正式规范稿见：

- [`HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md`](HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md)

## 当前协议

当前 current-main 已固定为三层页面合同：

1. `frontstage`
2. `midstage`
3. `backstage`

规则只有一句：

**用户先完成判断和动作，再决定要不要看系统解释。**

## 三层语义

### frontstage

首屏只允许 4 个主模块：

1. `Current summary`
2. `Pending decision`
3. `Next action`
4. `Boundary`

这里不再直接前置：

- `Why it matters`
- `What Helm already prepared`
- `Worker summary`
- 长段系统解释

### midstage

中间层承载：

- `Review snapshot`
- prepared draft / prepared context
- 协作分工 / coordination handoff
- secondary summary

中间层默认也不展开系统解释块。

### backstage

后台层承载：

- `WhyItMattersBlock`
- evidence / replay / audit
- worker reasoning
- prepared / reviewed / approved / executed / official 的状态语义说明

## 页面与组件映射

当前页面合同已经收口到：

- [`reporting-protocol.ts`](../../lib/presentation/reporting-protocol.ts)
  - 定义 `frontstage / midstage / backstage` 合同和首屏预算
- [`narrative-components.tsx`](../../components/shared/narrative-components.tsx)
  - 提供 `ReviewSnapshotBlock`、`WhyItMattersBlock`、`BoundaryNote`、`EvidenceDrawer`
- [`detail-shell.tsx`](../../features/role-conversation-variants/detail-shell.tsx)
  - 负责 role/detail variants 的共享 detail 骨架
- legacy detail views under `features/*/detail-view.tsx`
  - 已统一改成 `Current summary -> Pending decision -> Next action -> Boundary -> Review snapshot -> Evidence`

本轮继续扩到：

- [`reporting-protocol-panel.tsx`](../../components/shared/reporting-protocol-panel.tsx)
  - shared reporting panel 也改成相同的 `frontstage / midstage / backstage / evidence` 合同
- [`proactive-mechanism-panel.tsx`](../../components/shared/proactive-mechanism-panel.tsx)
  - shared proactive panel 也改成对象优先骨架，不再让系统解释块占据首屏主位
- [`queue-view.tsx`](../../features/customer-success-handoff/queue-view.tsx)
  - customer success queue 已切到同一套 `Current summary -> Decision request -> Next action -> Boundary` 首屏预算

## 状态语义

当前页面统一使用以下五个状态语义：

1. `Prepared`
2. `Reviewed`
3. `Approved`
4. `Executed`
5. `Official`

当前默认解释为：

- `Prepared` = 待复核结果，不代表已批准、已执行或已成为官方真值
- `Reviewed` = 已人工复核，不代表已批准、已执行或已成为官方真值
- `Approved` = 已批准下一步，不代表已执行或已成为官方真值
- `Executed` = 动作已执行，不代表已成为官方真值
- `Official` = 外部系统或对外真值已被显式确认

## 当前通过标准结论

- 高复用 detail 页已经开始从系统自述骨架切到对象优先骨架。
- `ReviewSnapshotBlock` 已取代首屏 `What Helm already prepared` 叙事。
- `WhyItMattersBlock`、evidence、audit、replay 继续保留，但默认下沉到后台层。
- 首屏预算已经进入共享 guard，而不是只靠人工记忆。
- 第三轮已经把剩余 detail families 的 `detail-model.ts` / `detail-view.tsx` 和 meeting detail 也纳入同一份 de-systemspeak governance。
- 第四轮已经把 broader queue / workspace / panel surfaces 一并纳入 no-Helm copy audit，高频 operating surface 不再默认用系统主语开场。
- 第五轮已经把 meeting / onboarding / settings / detail hint 等运行面继续纳入 project-level systemspeak audit，并明确后台 explanation 不是前台 systemspeak 的豁免理由。

## 诚实边界

- 这次改的是页面合同、层级和 copy governance，不是全站 redesign。
- evidence、audit、trace 没有被删除，只是不再抢主位。
- review-first、boundary-first 继续保留。
- 这不是 execution authority 扩张，也不是 broad auto-write 或 send authority 扩张。
