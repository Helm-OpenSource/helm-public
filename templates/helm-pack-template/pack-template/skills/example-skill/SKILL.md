---
name: helm-<pack-id>-<skill-slug>
description: <≤1024 字符，中英双语描述。What this Skill does, in one paragraph.>
pack: <PACK_ID>
version: 0.1.0
license: proprietary | Apache-2.0
helm:
  level: certified | community
  multi_tenant: true            # 建议默认值
  recommendation_only: true     # 建议默认值
  audit_required: true
  invariant: case-no-drop       # Pack 视情况
  workspace_scope: workspace | manager_only | member
requires:
  models: [anthropic, openai, qwen, deepseek]
  connectors: []
  permissions: []
metadata:
  industry: <ICP id>
  trigger: <event-type>
  pack_skill: <PACK_ID><N>
  emoji: 📋
acceptance:
  pilot_4w:
    <metric_1>: <target>
    <metric_2>: <target>
  steady_6m:
    <metric_1>: <target>
    <metric_2>: <target>
  business_readable:
    <stakeholder>_review: <frequency>
    subjective_score_min: 3.5
---

# Skill <PACK_ID><N>：<中文名>

## 使用场景
- <场景 1>
- <场景 2>
- <场景 3>

## 触发
- <触发事件>

## 输入
- <数据源 1>
- <数据源 2>

## 输出
- <输出形态>
- <复核标记>

## 复核点（强制）
- <对外动作默认建议>
- <什么必须人工确认>

## 不做清单（Skill 级红线）
- <红线 1>
- <红线 2>

## 调用方式
- 自动：<自动触发>
- 主动：<手动触发>
- API：`<endpoint>`

## 三级加载（Skill 内部）
- L1 注入系统 prompt：name + description + pack + level（≤97 tokens）
- L2 模型按需 read：本 SKILL.md 完整内容
- L3 执行时读：seed/playbook.md + seed/templates/* + fixtures/*

## 示例（Day-1 看板预期）
<填入预期客户首日看到的内容>

## 作业质量验收
见 frontmatter `acceptance`。

## 变更记录
| 日期 | 版本 | 变更 |
|---|---|---|
| <YYYY-MM-DD> | 0.1.0 草稿 | 初版 |
