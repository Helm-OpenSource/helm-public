---
name: helm-a-priority-customers
description: 每日给销售一张"今天该跟的 5 个客户"清单，含风险标注与建议动作。Daily priority list of 5 customers each sales rep should follow up today, with risk tags and suggested actions.
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
  connectors: [crm-saleseasy, crm-fenxiang, crm-sfdc-cn, feishu, dingtalk, wechat-work, imap]
  permissions: [crm:read, im:read, email:read]
metadata:
  industry: ICP-1-b2b-saas
  trigger: daily-09 | sales-open
  pack_a_skill: A2
  emoji: 🎯
acceptance:
  pilot_4w:
    sort_overlap_with_manager: 0.60
    miss_rate_max: 0.20
  steady_6m:
    sort_overlap_with_manager: 0.80
    miss_rate_max: 0.10
  business_readable:
    daily_sales_subjective_score_min: 3.5
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-07-29
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Skill A2：今天该跟的 5 个客户

## 使用场景
- 销售一天面对 30+ 商机，不知道"今天先跟谁"
- 销售主管希望团队不漏跟"应跟"商机
- 跨班次/跨日交接时优先级不丢

## 触发
- 每日 09:00 自动推送（工作区配置可调）
- 销售在 Helm 工作区主动唤起

## 输入
- 该销售名下全部活跃商机
- 最近 7 天活动（会议、邮件、IM、CRM 更新）
- A1 跟进清单未完成项
- 客户健康度（来自工作区聚合，含 CS 反馈）

## 输出
当日 5 个优先客户清单：
- 客户名 + 商机阶段
- 风险标签：承诺即将到期 / 48h 未响应 / 客户健康度下降 / Handoff 待处理 / 主管标记
- 建议动作：发确认邮件 / 电话跟进 / 升级主管 / 等待
- 优先级权重（透明可见，可调）

## 复核点（强制）
- 排序结果是**建议**，销售可手工调整
- 优先级算法（权重）在 worker 配置中可见可改
- 销售调整后系统记录原因（用于优化）

## 不做清单
- 不自动联系客户
- 不替销售判定"放弃跟进"
- 不替主管给销售评分

## 调用方式
- 自动：每日 09:00（工作区配置）
- 主动：销售在 Helm 工作区点击"今天该跟谁"
- API：`GET /api/skills/a-priority-customers/today`

## 示例（Day-1 看板预期）
```
🎯 今天该跟的 5 个客户

1. 客户 A · 风险:承诺即将到期 · 建议:发确认邮件（A1 草稿待发送）
2. 客户 B · 风险:48h 未响应 · 建议:电话跟进
3. 客户 C · 风险:客户健康度 ↓ · 建议:CS 协同
4. 客户 D · 风险:Handoff 待处理 · 建议:启动 A4
5. 客户 E · 风险:主管标记 · 建议:与主管同步
```

## 作业质量验收
见 frontmatter `acceptance`。pilot 4 周后由销售总监对比"系统排序 vs 主管手工排序"重合度。

## 变更记录
| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | 1.0.0 草稿 | Pack A V2 落地 |
