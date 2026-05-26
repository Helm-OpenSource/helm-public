---
name: helm-a-meeting-followup
description: 客户会议结束 5 分钟内自动产出跟进清单。识别该跟什么、谁来跟、措辞建议、不能承诺什么。Generate a meeting follow-up list within 5 minutes of every customer meeting—who follows up, what to do, suggested wording, and what NOT to commit.
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
  connectors: [feishu, dingtalk, wechat-work, tencent-meeting, imap, crm-saleseasy, crm-fenxiang, crm-sfdc-cn]
  permissions: [meeting:read, crm:read, im:read, email:read]
metadata:
  industry: ICP-1-b2b-saas
  trigger: meeting-end
  pack_a_skill: A1
  emoji: 📋
acceptance:
  pilot_4w:
    follow_up_latency_p50_minutes: 30
    list_adoption_rate: 0.60
    boundary_commitment_recall: 0.70
  steady_6m:
    follow_up_latency_p50_minutes: 15
    list_adoption_rate: 0.80
    boundary_commitment_recall: 0.85
  business_readable:
    sales_director_weekly_review: 5_samples
    subjective_score_min: 3.5
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-07-29
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Skill A1：会议跟进清单

## 使用场景
- 客户会议结束（线上/线下/电话）后，销售忙下一个会，跟进任务散落在脑子、IM、CRM 备注
- 销售总监/RevOps 需要一个统一的"会后该做什么"链路
- 销售要避免越界承诺（口头答应"我们能做 X"但交付侧不知情）

## 触发
- 飞书 / 钉钉 / 企业微信 / 腾讯会议的会议结束事件
- 销售在 Helm 工作区主动唤起

## 输入
- 会议录音 / 纪要（来自会议平台原生 API，需客户授权）
- CRM 当前商机上下文（客户、阶段、历史活动）
- 历史会话记忆（与该客户过往的关键节点）
- 行业种子知识库（seed/playbook.md 的 SOP）

## 输出
跟进清单，包含字段：
- **谁**：跟进负责人（默认本次会议销售）
- **做什么**：具体动作（发邮件 / 预约下次 / 同步交付）
- **何时**：建议时间
- **措辞建议**：邮件/IM 草稿（默认建议，待销售确认）
- **不能承诺什么**：识别出的越界承诺与红线提示
- **复核标记**：哪些项需要销售经理或法务复核

## 复核点（强制）
- 跟进措辞**默认建议**，对外发送前必须销售本人在 Helm 工作区点击"确认发送"
- 越界承诺识别项**必须人工裁决**，不自动屏蔽
- 任何被识别的"重大承诺"自动通知销售经理（A3 联动）

## 不做清单（Skill 级红线）
- 不自动发送邮件
- 不自动写入 CRM 字段
- 不替销售做出"承诺类"对外措辞
- 不自动判定会议成败
- 不在客户告知未签署前做录音处理

## 调用方式
- 自动：会议结束事件触发
- 主动：在 Helm 工作区会议详情页点击"生成跟进清单"
- API：`POST /api/skills/a-meeting-followup`（仅认证工程师/Pack 内部调用）

## 三级加载（Skill 内部）
- L1 注入系统 prompt：name + description + pack + level（≤97 tokens）
- L2 模型按需 read：本 SKILL.md 完整内容
- L3 执行时读：seed/playbook.md + seed/templates/* + fixtures/*

## 示例（Day-1 看板预期）
客户安装 Pack A 后**首日打开**应看到：
```
📋 今天的会议
昨日 5 个会议 | 已生成跟进清单 5 份 | 待销售确认 3 份

[展开] 客户 A 续约洽谈会
  - 销售 张某 → 24h 内发确认邮件（草稿已生成，待确认）
  - 越界承诺识别：客户问"能否支持 X 集成"，销售答"应该可以"
    → 该承诺超出当前方案边界，建议复核 / 改口径
  - 待 Handoff：本次会涉及交付时间，建议 7 天内启动 A4 Handoff Pack
```

## 作业质量验收
见 frontmatter `acceptance` 段。pilot 4 周后由销售总监 + Helm 联合复盘评分。

## 不做清单与 commercial 边界
- 本 SKILL.md 是开源摘要 + 完整版（开源版与商业版一致，差别在 worker 实现）
- worker 实现（implementation/worker.ts）属 Pack A 商业版，闭源
- 认证工程师不得 fork worker 实现对外销售（红线）

## 变更记录
| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | 1.0.0 草稿 | Pack A V2 落地 |
