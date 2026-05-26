---
status: active
owner: 创始人 / GTM
created: 2026-04-30
review_after: 2026-05-15
archive_trigger:
  - Pack A 第一个 design partner 完成 Week 0 kickoff 且本脚本被实跑 scope call 复盘版替代后 30 天归档
  - 连续 3 个 Top 候选 scope call 均未使用本文且创始人确认改用新脚本后 30 天归档
---

# Pack A Top 候选 Scope Call 脚本（45 分钟）

## 1. 使用边界

本脚本用于 Top 2-3 候选通过 30 分钟验证电话之后的 45 分钟 scope call。目标是判断是否进入 Week 0 启动准备，而不是现场签约或承诺实施。

必须遵守：

1. 不要求客户在 call 中提供真实会议原文、CRM 截图、邮箱原文或客户名单。
2. 不承诺自动外发、自动审批、自动改 CRM、自动成交。
3. 不把口头同意写成合同、DPA、proof 授权或案例授权。
4. 不跳过 Week 0 的数据、法务、IT、owner、review 节奏确认。

## 2. 参会角色

建议参会：

| 角色 | 必须性 | 目的 |
|---|---|---|
| 客户销售 VP / 销售总监 / COO | 必须 | 确认业务 owner、痛点、review 节奏、预算路径 |
| 客户 IT 或数据负责人 | 强建议 | 判断数据接入和一周内样本可得性 |
| 客户法务 / 合规联系人 | 可选但建议 | 判断 DPA、跨境、proof 授权和公开边界 |
| Helm 创始人 | 必须 | 控制边界、拍板是否进入 Week 0 |
| Helm 工程 lead / 实施负责人 | 强建议 | 判断连接器、样本、Day-1 可用性 |

如果只有一线用户或创新部门参加，不进入 scope call；退回候选池。

## 3. 会前输入

会前必须准备：

1. 候选 alias 和 30 分钟验证电话脱敏摘要。
2. OPC 六项评分：痛点、owner、数据、proof、付费、边界。
3. 3 个失败事件假设。
4. 数据接入假设：manual export / readonly connector / sample pack / blocked。
5. proof 姿态假设：anonymized public / semi-public / internal-only / no proof。

## 4. 开场（0-5 分钟）

推荐话术：

> 今天这次 scope call 只决定是否进入 Week 0 启动准备，不是正式项目启动。我们会把范围、数据、review、DPA 和 proof 边界讲清楚。Helm 第一阶段仍然是建议、草稿、复核和 proof，不做自动外发、自动审批或自动改 CRM。

必须确认：

1. 本次是否有业务 owner。
2. 本次是否可以讨论 4 周 paid pilot。
3. 本次是否可以讨论数据样本和 DPA。

任一为否，直接降级为 nurture，不继续讨论 Week 0。

## 5. 失败事件确认（5-12 分钟）

逐个确认上一通电话中提到的失败事件：

| 问题 | 目的 |
|---|---|
| 这个失败事件最近一次发生在什么时候？ | 排除抽象痛点 |
| 当时谁应该跟进？谁发现晚了？ | 确认 owner 和责任链 |
| 业务影响是什么：延迟、丢单、续约风险、客户投诉、handoff 返工？ | 确认付费价值 |
| 现在怎么补救？靠周会、群消息、CRM、人工追问还是个人记忆？ | 确认 Helm 替代的断层 |
| 4 周内能否用脱敏样本复盘这类事件？ | 确认 proof 可得性 |

Go 信号：客户能说清至少 2 个具体事件，且销售负责人认可这是管理问题。

No-Go 信号：仍停在“我们想试 AI / 想提高效率”。

## 6. 4 周范围确认（12-22 分钟）

默认范围：

1. 3-5 场真实或脱敏客户会议。
2. CRM 机会或客户状态样本。
3. 当前跟进记录或 handoff 样例。
4. 每周 1 次 review。
5. 5-15 名试点用户。

必须问：

1. 哪条业务线最适合试点？
2. 试点用户是否包含销售代表、销售主管、CS 或交付角色？
3. Week 1 是否能提供真实或脱敏会议样本？
4. 是否接受先用 Pack A 默认配置，不做深度定制？
5. 哪些内容绝不能进入 Helm？

## 7. 数据与 DPA（22-30 分钟）

确认数据路径：

| 数据 | 最低可接受方式 | No-Go |
|---|---|---|
| 会议 | 脱敏摘要 / 手工样本 / 只读导入 | 只能全量录音但不能脱敏或授权 |
| CRM | 手工导出字段 / 只读连接器 / 样本包 | 自研系统且 4 周内无法导出任何字段 |
| 邮件 / IM | 片段化样本 / 状态摘要 | 必须全量接入但无法授权 |
| Handoff | 现有 handoff 模板 / 项目交接样例 | 无 CS / 交付承接场景 |

DPA 必须确认：

1. 客户是否要求使用自己的 DPA 模板。
2. 是否涉及境外模型 API、境外日志或境外人员访问。
3. 数据保留是否接受 pilot 后最长 90 天。
4. 删除证明是否必须在固定时限内出具。
5. 是否有敏感个人信息、重要数据或不得出域数据。

## 8. Proof 与公开边界（30-36 分钟）

直接确认：

> 如果 4 周 pilot 有效果，哪些内容可以进入 proof pack？哪些内容可以匿名公开？哪些只能内部复盘？

四档输出：

| 姿态 | 可进入第一个 design partner |
|---|---|
| anonymized public | 优先 |
| semi-public reference | 可作为备用 |
| internal-only proof | 可学习，但市场价值弱 |
| no proof | 不适合作为第一个 |

必须避免把 proof 口头同意写成公开授权。正式公开仍需单独书面确认。

## 9. 商业与启动（36-41 分钟）

必须问：

1. 这件事如果解决，从哪个预算付钱？
2. 预算 owner 是谁？
3. 是否接受 ¥50,000 4 周 paid pilot 作为默认锚点？
4. 是否要求 2 周 diagnostic 后再进入 paid pilot？
5. 最快什么时候可以进入 Week 0？

Go 信号：

1. 明确 budget owner。
2. 接受 paid pilot 或提出明确付费结构。
3. 一周内可确认 DPA 和数据样本。

No-Go 信号：

1. 只想无限期免费试用。
2. 无预算 owner。
3. 要求先做大规模集成再付费。

## 10. 收口（41-45 分钟）

推荐话术：

> 我们会把今天内容整理成一个脱敏 Week 0 readiness decision，不会把贵司真实信息写入公开仓库。只有在数据、DPA、owner、review、proof 五项都清楚后，我们才建议进入 4 周 paid pilot。

会后输出：

1. `Go Week 0` / `Backup` / `Nurture` / `No-Go`。
2. Week 0 必须解决的 3 个阻塞。
3. 是否保持 ¥50,000 默认锚点。
4. 是否需要客户 DPA 模板。
5. 是否具备 anonymized proof 可能性。

## 11. Codex / Claude 脱敏回执

```markdown
Scope call result:

- alias:
- opc_score_after_scope:
- decision: Go Week 0 | Backup | Nurture | No-Go
- blockers:
  - data:
  - DPA:
  - owner:
  - proof:
- commercial_path: ¥50k paid pilot | diagnostic then paid | defer | no budget
- founder_decision_needed:
```

不要发送真实客户名称、联系人、邮箱、电话、CRM 截图、会议原文或客户交易金额。

## 12. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 草稿 | 新增 Top 2-3 候选 45 分钟 scope call 脚本，连接 30 分钟验证电话与 Week 0 启动门 |
