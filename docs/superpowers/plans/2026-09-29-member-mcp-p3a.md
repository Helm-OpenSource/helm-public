---
status: active / as-built-record
owner: helm-core
created: 2026-09-29
review_after: 2026-10-29
public_safety: As-built record for a counts-only CAIO review supplement over
  member feedback. No customer data, credential, private endpoint, or
  production-readiness claim.
---

# 成员 MCP P3a：CAIO 复盘的成员反馈量补充（只计数）—— as-built

## 做了什么
`lib/member-mcp/feedback-supplement.ts` 提供 `createMemberFeedbackSupplement()`，形状是 `CaioInferenceSupplementPort`，由租户在复盘补充里接入。

- 键名：`member.feedback.summary`。
- 统计窗口内工作信号与现场报告的**数量**，按类型分别计数；另有 `reporting_members`，即提交反馈的人数。

## 边界
成员网关规格 §5.1、§9、§12 规定三条：
- 成员内容不可信，且 `evaluationUseProhibited`；
- 不可信的上行内容不得进入外部模型的上下文；
- 采用情况只做全工作区汇总，不得用于绩效。

因此：
- 这里只输出计数。
  - 不输出摘要、正文，也不输出成员上报的指标值。
  - 计数是全工作区汇总，不按人拆分。
- 拒绝、暂停、申诉不计入。这类回应永远不能变成针对提出者的信号。
- 读失败或窗口被截断时，报 null 而不是 0。
- 更正只计一次：被取代的回执不计。
- 默认关闭：环境变量 `HELM_CAIO_MEMBER_FEEDBACK_SUPPLEMENT_ENABLED` 未开时，本补充不贡献任何条目。

## 待 owner 定
- 成员上报的指标值要不要进 CAIO，进的前提是什么（例如须有系统指标印证，只走本地模型）。
- 按人统计的来源可靠度要不要做（规格要求只用于分析、不用于绩效）。
