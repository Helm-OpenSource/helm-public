---
status: active
owner: 创始人 / GTM
created: 2026-04-30
review_after: 2026-05-14
archive_trigger:
  - Pack A 第一个 design partner 已签署 pilot SOW，且本协议被实际 pilot runbook 替代后 30 天归档
  - Pack A 不再作为首批商业化 Pack 时归档
---

# Pack A Design Partner 候选验证访谈协议

## 1. 目的

本协议用于执行 Pack A 第一个 design partner 的第二轮候选验证电话。它承接 [PACK_A_DESIGN_PARTNER_EVALUATION_V1.md](./PACK_A_DESIGN_PARTNER_EVALUATION_V1.md) 的纸面评分结果，把 Top 2-3 候选进一步验证到可决策状态。

本协议回答三个问题：

1. 该候选是否真的有 B2B SaaS 销售推进断层。
2. 该候选是否能在 4 周内配合 Helm 做出可信 proof。
3. 该候选是否适合作为 Pack A 第一个 design partner，而不是仅进入候选池。

## 2. 非目标

- 不做完整产品 demo。
- 不承诺任何功能交付、上线时间、SLA 或定制开发。
- 不签署 pilot SOW。
- 不收集真实客户名单、联系人隐私、邮件正文、会议原文或 CRM 明细到公开仓库。
- 不把候选评分写成创始人最终决策。

## 3. 输入材料

访谈前必须准备：

| 输入 | 来源 | 说明 |
|---|---|---|
| 候选纸面评分 | `PACK_A_DESIGN_PARTNER_EVALUATION_V1.md` | 至少完成行业代表性、配合度、可公开案例性三项初评 |
| 候选背景 | 创始人私有线索 | 公司名、联系人、业务背景只留在私有笔记，不写入公开 repo |
| Pack A 定位 | `PACK_A_B2B_SAAS_REVENUE_PUSH_RESEARCH_V2.md` | B2B SaaS 销售推进 / Must Push / review-first 边界 |
| 4 周试点边界 | `HELM_CHINA_FOUR_WEEK_PILOT_PACKAGE.md` | 时间、投入、成功指标与 proof pack 口径 |

## 4. 访谈结构

建议单次 30 分钟。创始人主持；Codex / Claude Code 只负责会前材料、会后结构化整理，不直接代表 Helm 对外承诺。

| 时间 | 阶段 | 目标 |
|---:|---|---|
| 0-3 分钟 | 边界开场 | 明确这是候选验证，不是采购承诺或项目启动 |
| 3-10 分钟 | 销售推进痛点 | 验证是否存在高频、真实、业务关键的推进断层 |
| 10-16 分钟 | 当前工作流 | 确认 CRM / IM / 邮箱 / 会议 / CS handoff 的真实连接方式 |
| 16-22 分钟 | 试点配合度 | 验证 owner、每周 review、样本数据、使用团队是否可到位 |
| 22-26 分钟 | proof 与公开边界 | 验证是否可能产出脱敏案例、销售对话引用或 cookbook 样例 |
| 26-30 分钟 | 下一步 | 判断进入 Top 1、候选池、nurture 或 No-Go |

## 5. 开场话术

建议使用以下边界话术：

> 这次不是正式销售或实施启动。我们正在选择 Pack A 第一个 design partner，目标是判断 Helm 是否能在 4 周内帮贵团队减少销售推进断层，并形成可复核的 proof。今天不会要求你提供敏感客户数据，也不会承诺任何定制功能。

必须避免：

- "我们可以自动帮你推进销售。"
- "4 周一定能提升成交。"
- "你把 CRM / 邮件接进来就能自动跑。"
- "这是免费 PoC，先随便试。"

## 6. 必问问题

### 6.1 业务推进强度

1. 过去 30 天里，最常见的销售推进断层是什么？
2. 断层通常发生在会议后、邮件后、报价后、试用后，还是 CS handoff 后？
3. 如果今天只让系统提示 3 件必须推进的事，你希望是哪三类？
4. 这些事现在由谁盯？销售本人、销售主管、CS，还是创始人？

### 6.2 工具与数据可得性

1. 当前 CRM 是否稳定记录机会阶段、下一步、金额和 owner？
2. 会议纪要、邮件、IM 是否能在试点期以只读方式提供样本？
3. 是否存在不能出域、不能接入、不能脱敏的敏感数据限制？
4. 4 周内最现实的接入方式是什么：手工导出、只读连接器、还是会议/CRM 样本包？

### 6.3 配合度

1. 谁是试点 owner？是否能每周参加 30 分钟 review？
2. 试点团队规模是多少？建议 5-15 人，不建议全公司铺开。
3. 是否能接受第一阶段只做建议、草稿、复核，不做自动发送或自动改 CRM？
4. 是否能接受 Helm 先用默认 Pack A 配置，而不是先做深度客户化？

### 6.4 proof 与公开边界

1. 如果试点有效，是否愿意允许 Helm 使用脱敏案例？
2. 是否允许引用销售推进前后的匿名指标，例如 follow-up 延迟、漏跟进数量、handoff 完整度？
3. 是否允许把部分脱敏样例写入 cookbook？
4. 哪些内容绝不能公开？

### 6.5 商业与启动

1. 如果 4 周试点成立，内部预算 owner 是谁？
2. 试点更适合免费诊断 + 付费 pilot，还是直接 paid pilot？
3. 最快什么时候可以启动？
4. 哪个条件不满足时，你们会停止试点？

## 7. 判断规则

访谈后更新候选评分，但不要机械按分数拍板。

| 结论 | 条件 | 下一步 |
|---|---|---|
| Top 1 候选 | 业务痛点强、owner 明确、4 周可启动、可产出脱敏 proof | 进入 Pack A pilot runbook 起草 |
| 候选池 | 痛点成立，但 owner、数据或公开边界未完全清楚 | 保留为第二/第三 design partner |
| Nurture | 有兴趣，但当前没有试点窗口或预算路径 | 进入 founder 跟进列表 |
| No-Go | 没有真实销售推进断层，或只想免费试用且不提供 owner / proof | 不进入 Pack A 首批 |

## 8. 红线信号

出现以下情况，默认不选为第一个 design partner：

1. 客户只想免费试用，不愿提供 owner、每周 review 或结果复盘。
2. 客户要求 Helm 第一阶段自动外发、自动改 CRM、自动承诺成交结果。
3. 客户无法提供任何会议、CRM、邮件或 handoff 样本。
4. 客户完全拒绝脱敏 proof，且也不允许内部指标复盘。
5. 客户核心问题不是销售推进，而是纯项目管理、客服工单或 BI 报表。

## 9. 会后输出

会后只产出脱敏结构化记录。真实客户名称、联系人、邮箱、会议原文、CRM 明细不得写入公开仓库。

建议私有记录模板：

```markdown
# Pack A Candidate Interview Note

- candidate_alias:
- interview_date:
- interviewer:
- participant_roles:
- paper_score:
- adjusted_score:
- decision: Top 1 | Candidate Pool | Nurture | No-Go

## Evidence
- strongest_pain:
- workflow_break:
- available_data:
- pilot_owner:
- proof_permission:

## Risks
- data_access:
- owner_availability:
- public_case_boundary:
- customization_pressure:

## Founder Decision Needed
- proceed_to_pilot_runbook: yes | no
- commercial_path: free_diagnostic_then_paid_pilot | paid_pilot | defer
- next_call_date:
```

## 10. 与下一份交付物的关系

本协议完成后，只有在 Top 1 候选明确时，才启动 Pack A 4 周 pilot runbook。Pilot runbook 必须再单独定义：

1. 试点范围和参与角色。
2. 数据接入边界。
3. 每周节奏。
4. 成功指标。
5. proof pack 输出。
6. recommendation != commitment / draft != send / explanation != approval 边界。

## 11. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 草稿 | 承接 Pack A 候选评估表，落地第二轮候选验证电话协议 |
