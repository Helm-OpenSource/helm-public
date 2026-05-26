---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_2_REPORT

## 总结

本轮在 Sprint 1 contract skeleton 的基础上，继续把 `worker / skill / resource binding` 往下一层扩成一版更可用的 catalog：

- 扩了 skill catalog
- 扩了 representative flows
- 补了 `optionalSkills / applicableRoles / requiresApproval / fallbackBindings`
- 补了 browser research / review queue / risk signal 三类资源
- 把 contract 真正接进 `approvals / dashboard / opportunities` 的 `worker summary / worker assignment / evidence drawer`
- 把 grouped evidence 继续接到真实 `replay / audit / memory / handoff payload`
- 继续把 controlled-trial 边界钉在 guard / self-check / regression 里

## 问题逐条回答

### 1. Sprint 2 主要比 Sprint 1 多了什么

主要多了两类东西：

1. 更细的 skill / flow catalog
2. 更强的 contract 约束

新增 skill：

- `objection_handling`
- `proposal_shaping`
- `review_note`
- `risk_clarification`

新增 flow：

1. `sales_objection_response`
2. `proposal_shaping_window`
3. `review_request_preparation`
4. `risk_clarification`

### 2. schema 这一轮具体长了哪些字段

这一轮新增的关键字段包括：

- `worker.optionalSkills`
- `skill.applicableRoles`
- `skill.blockedRoles`
- `skill.requiresApproval`
- `skill.fallbackBindings`

这些字段让 contract 不再只是一组对象目录，而开始具备：

- 哪个角色可以用什么 skill
- 哪个 skill 需要 review 还是 approval
- 某条 binding 不可用时如何退回受控路径

### 3. 这一轮代表性 catalog 是否已经更接近真实岗位

是。

当前 Sprint 2 已经从 Sprint 1 的 4 个代表 skill，扩到一版更像真实岗位工作面的 catalog：

- sales：follow-up、objection handling、proposal shaping
- delivery：activation checklist、review note
- founder：risk clarification、proposal shaping optional path
- customer success：expansion review、risk clarification、objection handling optional path

### 4. controlled-trial 边界是否仍保持稳定

是，而且比 Sprint 1 更硬。

当前 contract 已明确要求：

- customer-facing skill 仍必须 review-first
- approval-required skill 必须同时 requires review
- review note / boundary clarification / risk clarification 仍必须 internal-only
- proposal shaping 仍是 non-commitment draft，不是 contract generation
- customer-visible send 仍不作为自主执行能力开放

### 5. recommendation / commitment 两条 A-minus 主线是否仍保持稳定

是。

这轮虽然扩了 objection handling、proposal shaping 等更贴近外部表达的 skill，但它们全部被继续压在：

- review
- approval
- non-commitment
- external-safe wording

这几条边界后面，没有越权滑成自动承诺或自动外发。

### 6. 哪些地方刻意未做，为什么

- 没有做真实 runtime orchestration
  - 因为这轮仍是 contract catalog，不是完整执行平面。
- 没有做完整 worker console
  - 因为当前只把 representative page 的 `worker summary / evidence` 接上，还没有做全站 worker 前台。
- 没有做完整 resource directory UI
  - 因为这轮只把共享 contract presentation 接到了 representative page，不去扩成完整资源目录。
- 没有把 review queue 接成完整业务写路径
  - 因为当前只做 contract skeleton，不去越权改执行主链。

### 7. 这一轮页面接线具体补了什么

当前 Sprint 2 已经把 shared contract presentation 真正接到了：

- `dashboard`
- `opportunities`
- `approvals`

接线范围不是整页重写，而是先把这三页里最容易 drift 的几层先接到 shared contract：

- `worker summary`
- `worker assignment`
- `evidence summary / evidence links`
- `grouped evidence drawer`

这样这些页面就不再只靠局部静态文案描述 worker 和 evidence，而是直接从 Sprint 2 contract 里的：

- representative flows
- worker / skill 组合
- resource binding
- control plane checks

派生首屏说明、worker assignment 细项，以及 evidence drilldown 分组入口。

### 9. 这轮真实 payload 映射具体补了什么

这轮不再只停在 contract-derived group 文案，而是把 grouped evidence 继续往真实 payload 下钻：

- `approvals`
  - 现在会把 `contextSnapshot / reasoning / resultPreview / editableContent` 映射成 replay 组
  - 把 `recommendationFacts / blockers / commitments` 映射成 memory 组
  - 把 `recommendationPayload` 和同类已执行历史映射成 handoff / audit 组
  - 这些组项现在已经不是纯摘要句子，而是能直接跳到 `approval preview / source context / result preview`，并继续落到具体 `fact / blocker / commitment / outcome` 卡片
- `opportunities`
  - 现在会把 `briefingSnapshot / recommendedNextSteps` 映射成 handoff 组
  - 把 `memoryFacts / blockers / commitments` 映射成 memory 组
  - 把真实 `auditLogs` 映射成 audit 组
  - 每条 evidence 都能继续跳到 `opportunity briefing / action workspace / judgement workspace`，并继续落到具体 `briefing step / recommendation / memory fact / blocker / commitment / audit` 项
- `dashboard`
  - 现在会把 `todayMeetings / recentExecutedActions` 映射成 replay 组
  - 把 `recentMemoryFacts / recentAuditLogs` 映射成 memory / audit 组
  - 把 `pendingApprovals / postMeetingItems` 映射成 handoff 组
  - 首页 drawer 里的 evidence 现在可以直接点进 meeting、approval section、memory audit item 或对象详情里的具体对象锚点，而不只是读摘要

所以 representative page 的 grouped evidence，已经开始同时包含：

- real payload groups
- contract-derived fallback groups

### 8. 下一阶段最该做的 5 件事是什么

1. 把 Sprint 2 catalog 继续接到更真实的 runtime handoff。
2. 把这些真实 payload group 继续往更细的 runtime handoff / replay drawer 下钻，而不只停在摘要层。
3. 把 proposal shaping / objection handling 接到更真实的 sales response assets。
4. 把 review note / risk clarification 接进 approvals 和 founder risk escalation 视图。
5. 把 low-risk internal follow-up 白名单继续做薄做稳，但仍不进入 customer-visible send。

## 短表

| 项目 | 分类 | 说明 |
| --- | --- | --- |
| Skill catalog expansion | 已经完整成立 | objection handling / proposal shaping / review note / risk clarification 已进入 contract。 |
| Representative flow expansion | 已经完整成立 | 新增 4 条代表链路并继续留在 controlled-trial 边界内。 |
| Role-to-skill applicability contract | 已经完整成立 | `optionalSkills / applicableRoles / blockedRoles` 已固定。 |
| Approval-aware contract | 已经完整成立 | `requiresApproval` 已进入 schema 和验证逻辑。 |
| Fallback-aware binding contract | 已经完整成立 | `fallbackBindings` 已进入 schema 和验证逻辑。 |
| Representative page worker summary / assignment / evidence wiring | 已经完整成立 | `dashboard / opportunities / approvals` 已经改为从 shared contract presentation 派生 worker 摘要、assignment 细项，以及 real payload + contract fallback 两层 grouped evidence。 |
| Runtime handoff integration | 已成形但仍需下一层 | 仍停在 contract 层，没有接成完整执行主链。 |
| Worker console / resource directory UI | 已成形但仍需下一层 | 语义已经清楚，但还没有完整前台界面。 |
| Orchestration engine / auto-execution plane | 刻意未做 | 当前阶段不进入完整平台化执行。 |
| Contract drift when more runtime paths arrive | 风险项 | Sprint 2 之后更容易把 proposal / objection 类 skill 写过头。 |

## 已经完整成立

- 更细的 skill catalog
- 更细的 representative flows
- role-to-skill applicability 约束
- requiresApproval / fallbackBindings 约束
- approvals / dashboard / opportunities 的 worker summary / assignment / evidence 接线
- README / docs / self-check / boundary-check / regression 对齐

## 已成形但仍需下一层

- runtime handoff integration
- worker console / resource directory UI
- 更完整的 customer success / founder / delivery role maps

## 刻意未做

- orchestration engine
- workflow platform
- resource marketplace
- sandbox runtime
- 高风险自动承诺
- 高风险自动发送

## 风险项

- objection handling 和 proposal shaping 已经更贴近 customer-facing wording，后续最容易越过 non-commitment 边界。
- review queue resource 目前只是 contract presence，还没有接成完整业务写路径。
- 若后续把 browser research 误写成不受控外部执行，会破坏 current workspace boundary。

## 边界保留

1. 当前 contract 仍是 Helm contract，不是 ClawHub 平台 contract。
2. review / approval / replay / audit / memory 仍归 Helm Control Plane。
3. proposal shaping 不等于 contract generation。
4. objection handling 不等于自动对外回复。
5. risk clarification / review note 仍是 internal-only。
