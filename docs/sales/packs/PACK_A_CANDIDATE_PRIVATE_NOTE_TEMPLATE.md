---
status: active
owner: 创始人 / GTM
created: 2026-04-30
review_after: 2026-05-15
archive_trigger:
  - Pack A 第一个 design partner 完成签约并形成实跑私有记录模板复盘版后 30 天归档
  - 连续 3 个候选验证电话均未使用本文且创始人确认改用新模板后 30 天归档
---

# Pack A 候选私有记录模板

## 1. 使用边界

本模板供创始人私有使用。**不要把已填写版本提交到仓库。**

允许提交到仓库的只有本空模板。真实公司名、联系人、邮箱、电话号码、会议纪要、CRM 截图、客户名单、金额明细不得写入 repo。

建议保存位置：

- 飞书私有表格。
- 本地加密笔记。
- 私有 CRM。
- 仅创始人和必要 GTM 成员可访问的文档。

## 2. 候选记录模板

```markdown
# Pack A Candidate Private Note

## Metadata

- candidate_alias:
- real_company_name_private:
- contact_private:
- interview_date:
- interviewer:
- participant_roles:
- source:
- paper_score_before_call:
- opc_score_after_call:
  - pain_25:
  - owner_20:
  - data_access_20:
  - proof_15:
  - paid_intent_15:
  - boundary_fit_5:
- adjusted_score_after_call:
- decision: Top 1 | Candidate Pool | Nurture | No-Go

## 1. Business Pain

- strongest_pain:
- recent_examples_count:
- affected_roles:
- revenue_or_retention_impact:
- urgency: high | medium | low
- notes:

## 2. Cooperation

- pilot_owner_name_private:
- pilot_owner_role:
- weekly_review_commitment: yes | maybe | no
- founder_day1_support: onsite_ok | remote_only | not_ok
- four_week_interviews: two_onsite_ok | one_onsite_one_video | video_only | not_ok
- default_pack_acceptance: yes | maybe | no
- notes:

## 3. Proof / Public Boundary

- anonymized_case_allowed: yes | maybe | no
- public_channels_allowed:
  - wechat_article: yes | maybe | no
  - zhihu_article: yes | maybe | no
  - sales_conversation_reference: yes | maybe | no
  - cookbook_sample: yes | maybe | no
- required_approvers_private:
- hard_no_public_content:
- notes:

## 4. Data Access

- crm_system:
- crm_customization_level: standard | moderate | heavy | unknown
- meeting_source:
- im_source:
- email_source:
- one_week_access_feasibility: high | medium | low
- likely_connector_mode: manual_export | readonly_connector | sample_pack | blocked
- legal_or_it_blockers:
- notes:

## 5. Commercial Path

- paid_pilot_acceptance: yes | maybe | no
- budget_owner_private:
- expected_fee_path: ¥50,000 paid pilot | diagnostic then paid | discount requested | no budget
- annual_contract_potential: high | medium | low
- timeline_to_start:
- notes:

## 6. Risks

- data_access_risk:
- owner_availability_risk:
- public_case_risk:
- customization_pressure:
- legal_or_cross_border_risk:
- founder_time_risk:

## 7. Decision

- final_recommendation: Top 1 | Backup | Pool | No-Go
- why:
- what_must_be_verified_before_week0:
- next_call_date:
- next_call_attendees:
```

## 3. 私有评分汇总表

```markdown
| Alias | Paper Score | Adjusted Score | Pain | Cooperation | Proof | Data Access | Paid Pilot | Decision | Next Step |
|---|---:|---:|---|---|---|---|---|---|---|
| A |  |  | strong / medium / weak | strong / medium / weak | yes / maybe / no | low / medium / high | yes / maybe / no | Top 1 / Pool / No-Go |  |
| B |  |  | strong / medium / weak | strong / medium / weak | yes / maybe / no | low / medium / high | yes / maybe / no | Top 1 / Pool / No-Go |  |
| C |  |  | strong / medium / weak | strong / medium / weak | yes / maybe / no | low / medium / high | yes / maybe / no | Top 1 / Pool / No-Go |  |
```

OPC 当前 canonical 评分口径见 [PACK_A_OPC_MARKET_VALIDATION_SYSTEM.md](./PACK_A_OPC_MARKET_VALIDATION_SYSTEM.md)：客户痛点 25、业务 owner 20、数据可得性 20、proof 价值 15、付费意愿 15、边界匹配 5。

## 4. 对 Codex / Claude 的脱敏回执格式

给 Codex / Claude 只需要以下信息：

```markdown
Top candidates selected:

- A: Top 1 candidate. Pain strong; owner likely; proof maybe; data access medium.
- B: Backup. Pain strong; proof yes; data access high risk.
- C: Pool. Pain medium; owner unclear; nurture.

Founder decisions:

- Day-1 support: onsite preferred / remote fallback
- Founder interviews: two onsite / one onsite + one video / video only
- Acceptance gate: keep 8/10 / change to 7/10 / change to 9/10
- Implementation owner: internal official team / seed L2 engineer
```

不要发送真实客户名称、联系人、邮箱、电话、交易金额、CRM 截图或会议原文。

## 5. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 草稿 | 新增 Pack A Top 2-3 候选私有记录模板和脱敏回执格式 |
