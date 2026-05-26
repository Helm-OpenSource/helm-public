---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 主动进化系统实施方案

## 文档目的

本文件用于指导“经营分身控制台”主动进化系统（Adaptive Evolution System）的工程实现。

目标：
1. 把系统中的增量变化标准化
2. 把这些变化沉淀成可消费的模式信号
3. 让 recommendation、today focus、风险识别和策略建议能被持续优化
4. 保持整个过程可解释、可审计、可回退

---

## 一、实现范围

第一阶段只实现下面五件事：

1. 建立 DeltaEvent 数据层
2. 建立 PatternFact 和 StrategySuggestion 数据层
3. 建立增量模式检测服务
4. 让 recommendation engine 能消费 PreferenceSignal / PatternFact
5. 在首页、策略中心、周报里做最小可见化

第一阶段不做：
1. 自动改高风险策略
2. 全自动自学习排序
3. 复杂 ML 模型
4. 跨 workspace 联合学习

---

## 二、建议新增的数据模型

## 1. DeltaEvent
作用：
把系统中的增量变化统一记录。

字段建议：
- id
- workspaceId
- actorType
- actorId
- eventType
- objectType
- objectId
- sourceType
- sourceId
- payload
- importance
- createdAt

eventType 示例：
- recommendation_approved
- recommendation_rejected
- recommendation_edited_and_approved
- recommendation_ignored
- action_auto_executed
- opportunity_stage_changed
- blocker_created
- blocker_resolved
- commitment_overdue
- commitment_fulfilled
- memory_corrected
- policy_changed
- contact_cooling_detected

Prisma 草稿：
```prisma
model DeltaEvent {
  id         String   @id @default(cuid())
  workspaceId String
  actorType  String
  actorId    String?
  eventType  String
  objectType String
  objectId   String
  sourceType String?
  sourceId   String?
  payload    Json?
  importance Int      @default(50)
  createdAt  DateTime @default(now())

  workspace  Workspace @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId, eventType, createdAt])
  @@index([workspaceId, objectType, objectId])
}
```

## 2. PatternFact
作用：
记录系统识别出的稳定模式。

字段建议：
- id
- workspaceId
- scopeType，USER / TEAM / OBJECT_TYPE / WORKSPACE
- scopeId
- patternType
- patternKey
- patternValue
- confidence
- evidenceCount
- status
- firstDetectedAt
- lastDetectedAt
- createdAt
- updatedAt

patternType 示例：
- approval_pattern
- blocker_pattern
- followup_timing_pattern
- relationship_cooling_pattern
- stalled_opportunity_pattern
- communication_style_pattern

Prisma 草稿：
```prisma
model PatternFact {
  id              String   @id @default(cuid())
  workspaceId     String
  scopeType       String
  scopeId         String?
  patternType     String
  patternKey      String
  patternValue    String
  confidence      Int      @default(50)
  evidenceCount   Int      @default(1)
  status          String   @default("ACTIVE")
  firstDetectedAt DateTime @default(now())
  lastDetectedAt  DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace       Workspace @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId, scopeType, scopeId])
  @@index([workspaceId, patternType, patternKey])
}
```

## 3. StrategySuggestion
作用：
把“系统建议调整策略”的结果记录下来。

字段建议：
- id
- workspaceId
- suggestionType
- targetPolicyKey
- currentValue
- suggestedValue
- reason
- confidence
- status
- createdAt
- updatedAt
- confirmedByUserId，可选
- confirmedAt，可选

status 示例：
- OPEN
- ACCEPTED
- DISMISSED
- EXPIRED

Prisma 草稿：
```prisma
model StrategySuggestion {
  id                String   @id @default(cuid())
  workspaceId       String
  suggestionType    String
  targetPolicyKey   String
  currentValue      String?
  suggestedValue    String?
  reason            String
  confidence        Int      @default(50)
  status            String   @default("OPEN")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  confirmedByUserId String?
  confirmedAt       DateTime?

  workspace         Workspace @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId, status, createdAt])
}
```

---

## 三、服务层设计

建议新增目录：

```text
lib/evolution/
  delta-event.service.ts
  pattern-detection.service.ts
  preference-updater.service.ts
  strategy-suggestion.service.ts
  evolution-insights.service.ts
```

## 1. delta-event.service.ts
职责：
把 RecommendationFeedback、AuditLog、EventLog、状态变化统一转换成 DeltaEvent。

输入来源：
- recommendation feedback
- opportunity stage changes
- blocker changes
- commitment changes
- memory corrections
- policy changes

输出：
- DeltaEvent 入库

## 2. pattern-detection.service.ts
职责：
扫描 DeltaEvent，识别模式。

第一阶段只做规则型模式检测。

建议识别以下模式：
1. 连续编辑后批准某类 recommendation
2. 连续拒绝某类 recommendation
3. 某类 blocker 高频出现
4. 某类承诺反复逾期
5. 某类机会常在相同阶段 stalled
6. 某类联系人的冷却风险模式

输出：
- PatternFact
- PreferenceSignal 更新候选
- StrategySuggestion 候选

## 3. preference-updater.service.ts
职责：
把某些模式写回 PreferenceSignal。

例如：
- outbound_message → concise_draft_preferred
- followup_timing → within_24h_preferred
- approval_preference → external_promises_require_approval

## 4. strategy-suggestion.service.ts
职责：
生成需要人工确认的策略建议。

例如：
- 建议外发承诺类动作默认逐条审批
- 建议提高 budget blocker 的风险权重
- 建议把 follow-up 窗口从 72 小时提前到 48 小时

## 5. evolution-insights.service.ts
职责：
给首页、策略中心、周报生成“系统最近学到了什么”的内容。

---

## 四、增量事件来源设计

第一阶段只从以下来源生成 DeltaEvent：

1. RecommendationFeedback
2. ApprovalTask 状态变化
3. Opportunity 阶段变化
4. Commitment 状态变化
5. Blocker 创建 / 解决
6. MemoryCorrection
7. PolicyRule 修改

映射示例：

### RecommendationFeedback → DeltaEvent
- APPROVED → recommendation_approved
- REJECTED → recommendation_rejected
- EDITED_AND_APPROVED → recommendation_edited_and_approved
- IGNORED → recommendation_ignored

### Opportunity 阶段变化
- stage change → opportunity_stage_changed

### Commitment
- overdue → commitment_overdue
- fulfilled → commitment_fulfilled

### Blocker
- create → blocker_created
- resolve → blocker_resolved

### Memory
- correction → memory_corrected

### Policy
- change → policy_changed

---

## 五、Pattern Detection 第一阶段规则

第一阶段不要上复杂模型，只做规则检测。

## 1. Approval Pattern
条件：
- 同一用户对同一 actionType 在最近 14 天内连续 5 次 APPROVED 或 EDITED_AND_APPROVED

输出：
- PatternFact：approval_pattern
- PreferenceSignal：approval_preference

## 2. Edit Pattern
条件：
- 同一用户对同一 actionType 在最近 14 天内有 3 次以上 EDITED_AND_APPROVED

输出：
- PatternFact：communication_style_pattern
- 可提示 recommendation draft 风格需要调整

## 3. Blocker Pattern
条件：
- 同一 blockerType 在最近 14 天内出现 4 次以上

输出：
- PatternFact：blocker_pattern
- 供 recommendation engine 增强 risk 计算

## 4. Stalled Pattern
条件：
- 某类机会在某阶段超过阈值时间停滞的比例明显升高

输出：
- PatternFact：stalled_opportunity_pattern

## 5. Follow-up Timing Pattern
条件：
- 某类 follow-up 在 24 小时内批准率显著高于 48 小时后

输出：
- PatternFact：followup_timing_pattern
- PreferenceSignal：within_24h_preferred

---

## 六、与 Recommendation Engine 的集成

主动进化系统不要自己重新做 recommendation。
它应该影响 recommendation engine 的输入。

## 6.1 影响维度

### personalization
引入：
- PreferenceSignal
- PatternFact

### urgency
引入：
- stalled_opportunity_pattern
- commitment_overdue pattern

### risk
引入：
- blocker_pattern
- repeated failure pattern

### explanation
引入：
- “系统最近学到的规律”作为 explanation 的附加层

## 6.2 recommendation service 改造点

建议增强以下输入：

1. PreferenceSignal
2. PatternFact
3. StrategySuggestion 状态，可选
4. 最近 14 天相关 DeltaEvent 概览，可选

### 输出增强
recommendation explanation 可增加：
- learnedPatternSummary，可选

例如：
“基于你最近一周对外发消息通常会缩短文案，系统优先给出精简版草稿。”

---

## 七、页面联动

## 7.1 首页
新增一个轻量模块：

### 系统最近学到了什么
展示最近 3 条 evolution insight。

例如：
1. 你最近更倾向先审批外发承诺类动作
2. 本周预算 blocker 出现频率上升
3. 你的团队会后 24 小时内的跟进采纳率最高

## 7.2 审批中心
在 explanation 区可增加：
- “这条建议还参考了你最近的处理习惯”

## 7.3 设置与策略页
新增一个 tab 或模块：

### 策略建议
展示：
- 建议改什么
- 为什么建议
- 当前值
- 建议值
- 接受 / 忽略

## 7.4 管理者周报
新增一节：

### 系统观察到的新规律
例如：
- 本周 stalled opportunities 中，budget blocker 占比最高
- 本周外发消息类 recommendation 编辑后批准率明显升高
- 本周招聘流程中，反馈延迟是最主要掉温原因

---

## 八、API 设计

## 8.1 DeltaEvent
`GET /api/evolution/delta-events?workspaceId=:id`

先做内部调试用途即可。

## 8.2 PatternFacts
`GET /api/evolution/patterns?workspaceId=:id`

返回：
- active patterns
- by patternType

## 8.3 StrategySuggestions
`GET /api/evolution/strategy-suggestions?workspaceId=:id`

`POST /api/evolution/strategy-suggestions/:id/accept`
`POST /api/evolution/strategy-suggestions/:id/dismiss`

## 8.4 Evolution Insights
`GET /api/evolution/insights?workspaceId=:id`

用于首页和周报。

---

## 九、审计与埋点

以下行为必须写 AuditLog：

1. PatternFact 创建
2. StrategySuggestion 创建
3. StrategySuggestion 被接受
4. StrategySuggestion 被忽略
5. PreferenceSignal 因模式检测被更新

以下行为建议写 EventLog：

1. delta_event_created
2. pattern_detected
3. strategy_suggestion_created
4. strategy_suggestion_accepted
5. strategy_suggestion_dismissed
6. evolution_insight_viewed

---

## 十、Codex 实施指令

下面这段可以直接贴给 Codex。

```text
现在开始实现“经营分身控制台”的主动进化系统第一阶段。

目标：
让系统能够根据增量变化，逐步形成偏好信号、模式事实和策略建议，并将这些结果反馈给 recommendation、首页、策略中心和周报。

先不要直接开工。
请先阅读：
- AGENTS.md
- docs/product/product-principles.md
- docs/product/roadmap.md
- docs/memory-system/implementation.md
- docs/recommendation-engine/implementation.md
- docs/reviews/recommendation-engine-code-review.md
- docs/llm/llm-integration-architecture.md，如果已有

然后输出《Adaptive Evolution System 第一阶段实施计划》，按 P0、P1、P2 排优先级。
计划中必须写清：
1. 新增哪些数据模型
2. 新增哪些服务
3. 新增哪些 API
4. 哪些地方增强 recommendation 输入
5. 哪些页面会新增可见化模块
6. 如何验证

输出计划后再开始编码。
编码前创建 Git checkpoint。
编码后创建 Git checkpoint。

本轮必须完成：

一、数据模型
新增：
1. DeltaEvent
2. PatternFact
3. StrategySuggestion

如果 PreferenceSignal 还未正式启用，补齐它。

二、服务层
新增：
1. lib/evolution/delta-event.service.ts
2. lib/evolution/pattern-detection.service.ts
3. lib/evolution/preference-updater.service.ts
4. lib/evolution/strategy-suggestion.service.ts
5. lib/evolution/evolution-insights.service.ts

三、事件映射
至少接以下来源：
1. RecommendationFeedback
2. ApprovalTask 状态变化
3. Opportunity 阶段变化
4. Commitment 状态变化
5. Blocker 创建 / 解决
6. MemoryCorrection
7. PolicyRule 修改

四、第一阶段模式检测
至少实现：
1. approval_pattern
2. communication_style_pattern
3. blocker_pattern
4. stalled_opportunity_pattern
5. followup_timing_pattern

五、页面增强
增强：
1. 首页，加“系统最近学到了什么”
2. 设置与策略页，加“策略建议”
3. 管理者周报，加“系统观察到的新规律”
4. 审批中心 explanation 区，加入个性化提示

六、API
至少新增：
1. GET /api/evolution/patterns
2. GET /api/evolution/strategy-suggestions
3. POST /api/evolution/strategy-suggestions/:id/accept
4. POST /api/evolution/strategy-suggestions/:id/dismiss
5. GET /api/evolution/insights

七、集成
推荐引擎至少要消费：
1. PreferenceSignal
2. PatternFact
并能在 explanation 中体现 learnedPatternSummary

八、验收路径
至少验证：
1. recommendation feedback 能生成 DeltaEvent
2. 连续事件能生成 PatternFact
3. PatternFact 能影响 recommendation explanation
4. 首页能看到 evolution insights
5. 策略建议可被接受或忽略
6. 接受后会写 AuditLog
7. README 更新主动进化系统说明

如果必须取舍，优先级如下：
1. DeltaEvent
2. PatternFact
3. recommendation 集成
4. 首页 insights
5. 策略建议
6. 周报增强
```

---

## 十一、验收标准

本阶段完成后，至少满足以下条件：

1. 增量变化能统一进入 DeltaEvent
2. 系统能识别至少 3 类模式
3. recommendation explanation 能引用学习结果
4. 首页能展示“系统最近学到了什么”
5. 策略建议能展示、接受和忽略
6. 全过程可审计
7. README 已补主动进化说明

---

## 十二、最终判断

第一阶段主动进化系统成立的标志，不是系统自动改了很多东西。

真正成立的标志是：

1. 系统开始能识别稳定模式
2. 系统开始能把这些模式转成 recommendation 的增强信号
3. 用户开始能看到“系统在学”
4. 但系统的学习仍在用户可控范围内

这才是“像 OpenClaw 那样会持续进化”，但更适合经营分身控制台的正确方向。
