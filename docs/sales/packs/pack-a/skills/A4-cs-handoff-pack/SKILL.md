---
name: helm-a-cs-handoff-pack
description: 销售标记成单后，自动生成 Handoff Pack 给交付/CS——含承诺清单、边界、待复核项、客户性格画像。Generate handoff pack for delivery/CS when a deal closes—commitment list, boundaries, pending items, customer profile.
pack: A
version: 1.0.0
license: proprietary
helm:
  level: certified
  multi_tenant: true
  recommendation_only: true
  audit_required: true
  invariant: case-no-drop
  workspace_scope: workspace
requires:
  models: [anthropic, openai, qwen, deepseek]
  connectors: [feishu, dingtalk, wechat-work, crm-saleseasy, crm-fenxiang, crm-sfdc-cn, imap]
  permissions: [crm:read, meeting:read, im:read, email:read]
metadata:
  industry: ICP-1-b2b-saas
  trigger: deal-closed | manual
  pack_a_skill: A4
  emoji: 📋
acceptance:
  pilot_4w:
    completeness_score: 3.5
    cs_readability_score: 3.5
  steady_6m:
    completeness_score: 4.2
    cs_readability_score: 4.2
  business_readable:
    cs_lead_monthly_review: 3_samples
    subjective_score_min: 3.5
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-07-29
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Skill A4：交付/CS Handoff Pack

## 使用场景
- 销售签单后，交付/CS 接手时不知道客户期望、边界、风险
- 销售期间的承诺、口头答应散落，没有正式交接
- 客户与不同接口人重复问同样的问题（销售→交付→CS 接力丢上下文）

## 触发
- 销售在 CRM 标记"成单"或"进入交付前评估"
- 销售经理或 CS lead 主动启动

## 输入
- 整个销售周期的会议、纪要、跟进清单（A1）
- 历史承诺库
- 方案版本变更记录
- 客户性格画像（基于会议沟通风格）

## 输出
Handoff Pack（结构化 JSON + 可读 Markdown）：
- **承诺清单**：销售期间的全部承诺（口头/书面/隐含）
- **方案边界**：方案明确包含/不包含的项
- **待复核项**：销售期间未敲定、需要交付侧确认的项
- **客户性格画像**：沟通风格、关键关切、决策节奏
- **风险标注**：客户期望与方案的潜在 gap
- **交接联系人**：销售主对接、客户主对接、关键决策人

## 复核点（强制）
- Handoff Pack 默认建议——销售经理 + CS lead 双方确认才算正式交接
- 任何"超出方案"的承诺自动标"待复核"，不算正式交付义务
- 客户性格画像不暴露给客户

## 不做清单
- 不替销售经理决定 Handoff 时机
- 不向客户发送 Handoff Pack
- 不替交付/CS 做"客户分级"评估

## 调用方式
- 自动：CRM 状态变化触发（"成单"或"交付前评估"）
- 主动：销售/经理在 Helm 工作区点击"启动 Handoff"
- API：`POST /api/skills/a-cs-handoff-pack`

## 示例（Day-1 看板预期）
```
📋 交付/CS Handoff Pack · 客户 A · 已成单

【承诺清单】（共 12 项）
✅ 已确认（10 项）
⚠️ 待复核（2 项）
   - 销售口头答应"X 集成应该可以"——超出当前方案，需确认
   - 销售提到"加急交付"——未明确时间承诺

【方案边界】
✅ 包含：[10 个核心模块]
❌ 不包含：[3 个超出项]

【客户性格画像】
- 决策节奏：稳，倾向先小范围试用
- 沟通风格：直接，不喜欢被推销
- 关键关切：稳定性 > 创新

【风险标注】
- 客户期望"3 周完成上线"——方案标准是 4-6 周
- 建议交付主动协调期望

【交接】
- 销售主对接：张某
- 客户主对接：客户 IT 总监李某
- 关键决策人：客户 CEO 王某

[销售经理确认]  [CS lead 确认]
```

## 作业质量验收
见 frontmatter `acceptance`。pilot 4 周后由销售经理 + CS lead 月度复盘 3 个样本。

## 变更记录
| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | 1.0.0 草稿 | Pack A V2 落地 |
