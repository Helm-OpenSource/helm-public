---
name: helm-a-manager-attention
description: 给销售主管的"今天该看的几个会"——只对主管角色可见，不替主管做决策。Manager-only attention panel: 2-3 meetings to look at today (with reasoning), without replacing manager's judgment.
pack: A
version: 1.0.0
license: proprietary
helm:
  level: certified
  multi_tenant: true
  recommendation_only: true
  audit_required: true
  invariant: case-no-drop
  workspace_scope: manager_only
requires:
  models: [anthropic, openai, qwen, deepseek]
  connectors: [feishu, dingtalk, wechat-work, tencent-meeting, crm-saleseasy, crm-fenxiang, crm-sfdc-cn]
  permissions: [meeting:read, crm:read, manager:role]
metadata:
  industry: ICP-1-b2b-saas
  trigger: daily | manager-open
  pack_a_skill: A3
  emoji: 👁
acceptance:
  pilot_4w:
    intervention_effectiveness: 0.40
    timing_accuracy: 0.50
  steady_6m:
    intervention_effectiveness: 0.60
    timing_accuracy: 0.70
  business_readable:
    manager_weekly_review: 5_samples
    subjective_score_min: 3.5
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-07-29
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Skill A3：销售主管的会议风险面板

## 使用场景
- 销售主管/销售 VP 一天面对 50+ 团队会议，无法 1:1 跟踪
- 主管希望"主动介入"风险大但销售自己未升级的会议
- 销售希望"私密会议"（如离职面谈、客诉处理）不被主管自动看到

## 触发
- 每日 09:30（A2 推送后 30 分钟）
- 主管在 Helm 工作区主动打开"主管面板"

## 输入
- 全部销售当日的会议（除标记"私密"的）
- A1 越界承诺识别记录
- 历史承诺库
- 客户健康度 + 客户健康度变化
- 销售管线异常事件

## 输出
2-3 个会议建议主管介入：
- 会议：客户 + 时间 + 销售
- 介入原因：[越界承诺 / 客户即将流失 / 关键决策点 / 主管历史标记]
- 建议介入时机：会前协助 / 同会旁听 / 会后复盘
- 建议介入方式：1:1 沟通销售 / 主动加入会议 / 不介入但跟踪

## 复核点（强制）
- 介入建议是**建议**——主管自主决定是否介入、何时、何方式
- 销售可标记"私密会议"，A3 永不显示该会议（治理可配）
- 主管介入后系统记录介入决定（用于复盘）

## 不做清单
- 不替主管自动给销售评分
- 不替主管"自动加入"会议
- 不向销售发送"主管在监控你"的通知

## 私密会议机制
销售在 Helm 工作区可标记会议为"私密"——A3 永不显示。
- 标记理由记录在 audit chain（不暴露给主管）
- 创始人级别可审计标记滥用

## 调用方式
- 自动：每日 09:30
- 主动：主管点击"主管面板"
- API：`GET /api/skills/a-manager-attention/today`（仅主管角色可调）

## 示例（Day-1 看板预期）
```
👁 主管关注 · 销售总监李某专属

【今日 2 个会议建议介入】

1. [11:00] 销售张某 × 客户 A 续约洽谈
   原因：A1 识别越界承诺 1 处（"X 集成应该可以"）
   建议时机：会前 1:1 与张某澄清边界
   建议方式：建议张某改口径"我会在 48h 内确认"
   [详情] [标记已处理]

2. [15:30] 销售王某 × 客户 F 方案洽谈
   原因：客户健康度近 7 天降 30%，本次会议为关键决策点
   建议时机：旁听
   建议方式：默听，会后与王某 1:1
   [详情] [标记已处理]
```

## 作业质量验收
见 frontmatter `acceptance`。pilot 4 周后由主管复盘"介入命中率 + 介入时机准确率"。

## 变更记录
| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | 1.0.0 草稿 | Pack A V2 落地 |
