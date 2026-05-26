---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Recommendation Engine 第二阶段实施方案

## 文档目的

本文件用于指导“经营分身控制台”Recommendation Engine 第二阶段的工程实现。

目标：
1. 把 recommendation 从“规则型建议”推进到“证据型、可解释、可反馈学习”的第二阶段
2. 让工程团队或 Codex 可以按明确顺序落地
3. 让首页、联系人页、机会页、会议页、审批中心都能消费更强的 recommendation 输出

本文覆盖：
1. 本轮实现目标
2. 数据模型与迁移
3. 服务层设计
4. 排序逻辑与打分
5. API 设计
6. 页面联动
7. 审计与反馈
8. Codex 实施指令
9. 验收标准

相关文档：

- [Recommendation Engine 第二阶段设计](stage2-design.md)
- [Recommendation Engine 代码评审标准](../reviews/recommendation-engine-code-review.md)
- [记忆系统第一阶段实施方案](../memory-system/implementation.md)
- [通用代码评审标准](../reviews/code-review.md)

---

## 一、本轮实现目标

第二阶段 recommendation engine 的本轮实现，只做以下 6 件事：

1. 建立 recommendation 的可持久化记录
2. 让每条 recommendation 带 supporting evidence
3. 增加基于 urgency / impact / confidence / policy 的排序
4. 增加 recommendation feedback 闭环
5. 在首页、联系人页、机会页展示 explanation
6. 让 recommendation 结果随着用户批准、拒绝、编辑行为逐步优化

本轮不做：
1. 复杂机器学习训练
2. 黑盒排序模型
3. 真实外部反馈自动学习系统
4. 跨 workspace 联合学习
5. 多代理协同 recommendation

---

## 二、实现范围

### 2.1 受影响页面
本轮至少会影响：

1. 今日工作台
2. 机会详情页或机会详情抽屉
3. 联系人详情页
4. 会议详情页
5. 审批中心
6. 使用分析页，可选
7. 记忆与时间线页，可选增强

### 2.2 受影响服务
本轮至少新增或重构：

1. recommendation.service.ts
2. recommendation-ranking.service.ts
3. recommendation-feedback.service.ts
4. recommendation-explanation.service.ts

### 2.3 受影响数据模型
本轮建议新增：

1. RecommendationLog
2. RecommendationFeedback

建议正式启用或增强：

3. PreferenceSignal
4. MemoryFact
5. Commitment
6. Blocker
7. PolicyRule
8. AuditLog
9. EventLog

---

## 三、数据模型与 Prisma 迁移

## 3.1 RecommendationLog

作用：
记录系统在某个时刻、针对某个对象，生成了什么 recommendation，以及当时的排序、依据和策略结果。

建议字段：

- id
- workspaceId
- userId
- objectType
- objectId
- actionType
- title
- description
- recommendationPayload，Json
- score
- urgencyScore
- impactScore
- confidenceScore
- personalizationScore
- policyFitScore
- riskScore
- policyResult
- supportingFactIds，Json
- blockerIds，Json
- commitmentIds，Json
- explanation
- status
- createdAt
- updatedAt

status 建议枚举：
- ACTIVE
- ACCEPTED
- REJECTED
- IGNORED
- EXPIRED
- EXECUTED

Prisma 草稿：

```prisma
enum RecommendationStatus {
  ACTIVE
  ACCEPTED
  REJECTED
  IGNORED
  EXPIRED
  EXECUTED
}

model RecommendationLog {
  id                    String               @id @default(cuid())
  workspaceId           String
  userId                String?
  objectType            ObjectType
  objectId              String
  actionType            String
  title                 String
  description           String
  recommendationPayload Json?
  score                 Int                  @default(0)
  urgencyScore          Int                  @default(0)
  impactScore           Int                  @default(0)
  confidenceScore       Int                  @default(0)
  personalizationScore  Int                  @default(0)
  policyFitScore        Int                  @default(0)
  riskScore             Int                  @default(0)
  policyResult          String
  supportingFactIds     Json?
  blockerIds            Json?
  commitmentIds         Json?
  explanation           String
  status                RecommendationStatus @default(ACTIVE)
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  workspace             Workspace            @relation(fields: [workspaceId], references: [id])
  user                  User?                @relation(fields: [userId], references: [id])
  feedbacks             RecommendationFeedback[]

  @@index([workspaceId, objectType, objectId])
  @@index([workspaceId, userId])
  @@index([workspaceId, status])
}
```

## 3.2 RecommendationFeedback

作用：
记录用户对某条 recommendation 的反馈行为，并为后续偏好学习提供输入。

建议字段：

- id
- workspaceId
- recommendationLogId
- userId
- feedbackType
- edited
- resultNote
- actionItemId，可选
- approvalTaskId，可选
- createdAt

feedbackType 建议枚举：
- APPROVED
- REJECTED
- EDITED_AND_APPROVED
- IGNORED
- AUTO_EXECUTED
- FAILED

Prisma 草稿：

```prisma
enum RecommendationFeedbackType {
  APPROVED
  REJECTED
  EDITED_AND_APPROVED
  IGNORED
  AUTO_EXECUTED
  FAILED
}

model RecommendationFeedback {
  id                  String                     @id @default(cuid())
  workspaceId         String
  recommendationLogId String
  userId              String?
  feedbackType        RecommendationFeedbackType
  edited              Boolean                    @default(false)
  resultNote          String?
  actionItemId        String?
  approvalTaskId      String?
  createdAt           DateTime                   @default(now())

  workspace           Workspace                  @relation(fields: [workspaceId], references: [id])
  recommendationLog   RecommendationLog          @relation(fields: [recommendationLogId], references: [id])
  user                User?                      @relation(fields: [userId], references: [id])

  @@index([workspaceId, recommendationLogId])
  @@index([workspaceId, feedbackType])
}
```

## 3.3 PreferenceSignal 正式启用

如果仓库里还没落地，建议现在一起落地。

最少字段：
- id
- workspaceId
- userId
- signalType
- signalKey
- signalValue
- sourceActionId
- weight
- createdAt

建议 signalType：
- approval_preference
- communication_style
- risk_tolerance
- followup_preference
- timing_preference
- workflow_pattern

---

## 四、服务层设计

建议新增目录：

```text
lib/recommendations/
  recommendation.service.ts
  recommendation-ranking.service.ts
  recommendation-feedback.service.ts
  recommendation-explanation.service.ts
  recommendation-candidates.service.ts
```

## 4.1 recommendation-candidates.service.ts
职责：
生成候选动作集合。

输入：
- objectType
- objectId
- workspaceId
- 当前对象状态
- MemoryFacts
- Commitments
- Blockers
- 最近会议 / 邮件 / 审批

输出：
候选动作数组，例如：

- FOLLOWUP_EMAIL
- SCHEDULE_MEETING
- UPDATE_OPPORTUNITY_STAGE
- CREATE_INTERNAL_TASK
- ESCALATE_TO_HIGHER_STAKEHOLDER
- SEND_SUMMARY
- RESOLVE_BLOCKER
- WAIT_AND_REMIND

## 4.2 recommendation-ranking.service.ts
职责：
给候选动作打分并排序。

输入：
- candidate actions
- urgency inputs
- impact inputs
- confidence inputs
- preference inputs
- policy inputs
- risk inputs

输出：
排序后的 candidate 列表 + 各维度分数

## 4.3 recommendation-explanation.service.ts
职责：
构造可解释输出。

输出内容至少包括：
- supportingFactIds
- blockerIds
- commitmentIds
- explanation text
- appliedPolicyRules
- why_not_auto_execute，可选

## 4.4 recommendation-feedback.service.ts
职责：
接收用户反馈，并写入：

1. RecommendationFeedback
2. RecommendationLog.status
3. PreferenceSignal
4. AuditLog
5. EventLog

## 4.5 recommendation.service.ts
职责：
做统一 orchestrator。

流程建议：
1. 读取对象
2. 召回相关记忆
3. 召回候选动作
4. 排序
5. 应用策略
6. 生成 explanation
7. 写 RecommendationLog
8. 返回结果

---

## 五、排序逻辑与打分

## 5.1 候选动作召回

先不要让 LLM 自由生成无限动作。
先维护一个有限动作库。

按对象类型召回：

### Contact
- FOLLOWUP_EMAIL
- FOLLOWUP_MESSAGE
- SCHEDULE_MEETING
- SET_REMINDER
- UPGRADE_RELATIONSHIP_STAGE

### Company
- GENERATE_ACCOUNT_BRIEF
- SCHEDULE_ACCOUNT_REVIEW
- ESCALATE_TO_HIGHER_STAKEHOLDER
- CREATE_INTERNAL_TASK

### Opportunity
- UPDATE_STAGE
- SEND_MATERIAL
- CREATE_INTERNAL_ALIGNMENT_TASK
- REQUEST_APPROVAL
- SCHEDULE_NEXT_MEETING
- RESOLVE_BLOCKER

### Meeting
- SEND_MEETING_SUMMARY
- CREATE_ACTION_ITEMS
- CREATE_COMMITMENT
- CREATE_BLOCKER
- SCHEDULE_FOLLOWUP

## 5.2 打分维度

### urgencyScore
由以下因素计算：
1. overdue commitments
2. 距离下一次会议时间
3. 距上次互动时长
4. 是否存在 stalled opportunity
5. blocker 是否在放大

### impactScore
由以下因素计算：
1. opportunity 价值
2. 联系人角色级别
3. 机会阶段关键度
4. 当前 blocker 严重度
5. 是否影响多个对象

### confidenceScore
由以下因素计算：
1. supportingFact 数量
2. supportingFact 平均 confidence
3. facts 是否被用户确认
4. 记忆是否新鲜
5. 是否有冲突记忆

### personalizationScore
由以下因素计算：
1. 用户历史审批习惯
2. 同类动作被编辑频率
3. 用户的 timing / style preference
4. 团队当前规则偏好

### policyFitScore
由以下因素计算：
1. 当前 policy 是否允许
2. 是否需要审批
3. 是否接近自动执行条件
4. 是否被禁止

### riskScore
由以下因素计算：
1. 是否外发
2. 是否包含承诺
3. 是否面向关键联系人
4. 是否容易引发误解

## 5.3 总分公式

建议第一版采用显式加权：

`totalScore = urgency * 0.25 + impact * 0.25 + confidence * 0.2 + personalization * 0.15 + policyFit * 0.1 - riskPenalty * 0.05`

注意：
1. riskScore 不直接否掉动作
2. risk 更多用于决定 policyResult
3. 评分过程必须保留中间结果，便于解释

---

## 六、API 设计

## 6.1 获取对象 recommendation
`GET /api/recommendations/next-actions?objectType=OPPORTUNITY&objectId=:id`

返回示例：
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "recommendationId": "rec_001",
        "actionType": "FOLLOWUP_EMAIL",
        "title": "发送精简版方案结构草稿",
        "description": "建议先发精简版结构，降低客户等待焦虑并推进下一轮确认",
        "score": 84,
        "urgencyScore": 76,
        "impactScore": 88,
        "confidenceScore": 81,
        "personalizationScore": 68,
        "policyFitScore": 90,
        "riskScore": 42,
        "policyResult": "REQUIRES_APPROVAL",
        "supportingFactIds": ["mf_001", "mf_009"],
        "blockerIds": ["blk_001"],
        "commitmentIds": ["com_001"],
        "explanation": "客户已明确希望下周三前收到方案，且当前主要阻碍不是价格而是付款节奏，建议优先发送结构草稿。"
      }
    ]
  },
  "message": "ok"
}
```

## 6.2 获取今日重点
`GET /api/recommendations/today-focus?workspaceId=:id`

返回：
- topPriorities
- highRiskItems
- overdueCommitments
- stalledOpportunities
- suggestedActions

## 6.3 获取联系人 recommendation
`GET /api/recommendations/contact/:contactId`（文档预留，当前代码未实现）

## 6.4 获取 recommendation explanation
`GET /api/recommendations/:id/explanation`

返回：
- supporting facts
- blockers
- commitments
- applied policies
- explanation

## 6.5 提交 recommendation feedback
`POST /api/recommendations/:id/feedback`

请求体示例：
```json
{
  "feedbackType": "EDITED_AND_APPROVED",
  "edited": true,
  "resultNote": "用户缩短了邮件文案后批准"
}
```

---

## 七、页面联动

## 7.1 今日工作台
新增或强化：
1. 今日重点排序依据展示
2. 高优先级项的 explanation 摘要
3. 哪些建议因策略需要审批

## 7.2 联系人详情页
新增：
1. 推荐下一步动作模块
2. “为什么推荐”可展开说明
3. 最近同类动作结果，可选

## 7.3 机会页
新增：
1. 建议推进顺序
2. 当前最大 blocker
3. 逾期承诺提醒
4. 推荐依据抽屉

## 7.4 会议页
新增：
1. 会后推荐动作按优先级排序
2. 引用本次会议形成的 supporting facts
3. recommendation 触发 action item 生成

## 7.5 审批中心
新增：
1. recommendation explanation
2. 用户历史偏好提示，可选
3. 提交反馈入口

---

## 八、反馈闭环

第二阶段一定要做反馈闭环，这是最重要的升级点。

## 8.1 反馈来源
至少捕获：

1. APPROVED
2. REJECTED
3. EDITED_AND_APPROVED
4. IGNORED
5. AUTO_EXECUTED
6. FAILED

## 8.2 反馈后的动作
系统收到 feedback 后要做：

1. 更新 RecommendationLog.status
2. 写 RecommendationFeedback
3. 写 EventLog
4. 写 AuditLog
5. 根据规则写入 PreferenceSignal

例如：
- 某用户连续 3 次批准外发跟进草稿
- 则生成 approval_preference / outbound_message / approval_required or auto_execute_preferred

## 8.3 反馈影响范围
首版只要求影响：
1. 同一用户
2. 同类动作
3. 同一 workspace

不要做跨用户学习。

---

## 九、审计与埋点

必须审计：

1. recommendation_generated
2. recommendation_viewed，可选
3. recommendation_feedback_submitted
4. recommendation_accepted
5. recommendation_rejected
6. recommendation_edited_and_accepted

EventLog 事件建议：
- recommendation_requested
- recommendation_generated
- recommendation_feedback_submitted
- today_focus_generated

AuditLog summary 应该人类可读，例如：
- “系统为机会『星桥科技年度方案合作』生成了 3 条下一步建议”
- “用户批准了 recommendation：发送精简版方案结构草稿”
- “用户拒绝了 recommendation：升级给更高层联系人”

---

## 十、Prisma 迁移清单

本轮新增：

1. RecommendationLog
2. RecommendationFeedback
3. PreferenceSignal，如果还未正式落地

Prisma 草稿：

```prisma
enum RecommendationStatus {
  ACTIVE
  ACCEPTED
  REJECTED
  IGNORED
  EXPIRED
  EXECUTED
}

model RecommendationLog {
  id                    String               @id @default(cuid())
  workspaceId           String
  userId                String?
  objectType            ObjectType
  objectId              String
  actionType            String
  title                 String
  description           String
  recommendationPayload Json?
  score                 Int                  @default(0)
  urgencyScore          Int                  @default(0)
  impactScore           Int                  @default(0)
  confidenceScore       Int                  @default(0)
  personalizationScore  Int                  @default(0)
  policyFitScore        Int                  @default(0)
  riskScore             Int                  @default(0)
  policyResult          String
  supportingFactIds     Json?
  blockerIds            Json?
  commitmentIds         Json?
  explanation           String
  status                RecommendationStatus @default(ACTIVE)
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  workspace             Workspace            @relation(fields: [workspaceId], references: [id])
  user                  User?                @relation(fields: [userId], references: [id])
  feedbacks             RecommendationFeedback[]

  @@index([workspaceId, objectType, objectId])
  @@index([workspaceId, userId])
  @@index([workspaceId, status])
}

enum RecommendationFeedbackType {
  APPROVED
  REJECTED
  EDITED_AND_APPROVED
  IGNORED
  AUTO_EXECUTED
  FAILED
}

model RecommendationFeedback {
  id                  String                     @id @default(cuid())
  workspaceId         String
  recommendationLogId String
  userId              String?
  feedbackType        RecommendationFeedbackType
  edited              Boolean                    @default(false)
  resultNote          String?
  actionItemId        String?
  approvalTaskId      String?
  createdAt           DateTime                   @default(now())

  workspace           Workspace                  @relation(fields: [workspaceId], references: [id])
  recommendationLog   RecommendationLog          @relation(fields: [recommendationLogId], references: [id])
  user                User?                      @relation(fields: [userId], references: [id])

  @@index([workspaceId, recommendationLogId])
  @@index([workspaceId, feedbackType])
}
```

---

## 十一、Seed 数据要求

为了演示 recommendation engine 第二阶段，seed 必须补这些内容：

1. 每条主故事线至少有 2 到 3 条 recommendation
2. 每条 recommendation 都有 supporting facts
3. 至少有 1 条 recommendation 被批准
4. 至少有 1 条 recommendation 被拒绝
5. 至少有 1 条 recommendation 被编辑后批准
6. 首页有 today focus 排序样例
7. 审批中心能展示 recommendation explanation

---

## 十二、Codex 实施指令

下面这段可以直接贴给 Codex。

```text
现在开始实现 Recommendation Engine 第二阶段。

目标：
把 recommendation 从“规则型建议”推进到“证据型、可解释、可反馈学习”的第二阶段。

先不要直接开工。
请先阅读：
- [AGENTS.md](../../AGENTS.md)
- [通用代码评审标准](../reviews/code-review.md)
- [产品原则](../product/product-principles.md)
- [产品路线图](../product/roadmap.md)
- [记忆系统第一阶段实施方案](../memory-system/implementation.md)

然后先输出《Recommendation Engine 第二阶段实施计划》，按 P0、P1、P2 排优先级。
计划里必须写清：
1. 要新增哪些 Prisma 模型
2. 要新增哪些 service
3. 要改哪些 API
4. 要改哪些页面
5. 如何验证

输出计划后再开始编码。
编码前创建 Git checkpoint。
编码后创建 Git checkpoint。

本轮必须完成：

一、Prisma 模型
新增：
1. RecommendationLog
2. RecommendationFeedback
3. PreferenceSignal，如果还没有正式启用

二、服务层
新增：
1. lib/recommendations/recommendation.service.ts
2. lib/recommendations/recommendation-ranking.service.ts
3. lib/recommendations/recommendation-feedback.service.ts
4. lib/recommendations/recommendation-explanation.service.ts
5. lib/recommendations/recommendation-candidates.service.ts

三、API
至少实现：
1. GET /api/recommendations/next-actions
2. GET /api/recommendations/today-focus
3. GET /api/recommendations/contact/:contactId（文档预留，当前代码未实现）
4. GET /api/recommendations/:id/explanation
5. POST /api/recommendations/:id/feedback

四、实现要求
1. recommendation 必须带 supportingFactIds
2. recommendation 必须带 blockerIds 和 commitmentIds
3. recommendation 必须带 policyResult
4. recommendation 必须带 explanation
5. recommendation 必须有排序分数明细
6. 用户反馈后必须写 RecommendationFeedback、AuditLog、EventLog
7. feedback 必须能影响后续同类动作推荐

五、页面增强
请增强：
1. 今日工作台
2. 联系人详情页
3. 机会详情页
4. 会议详情页
5. 审批中心

每个页面都必须能看到 recommendation explanation 或其简化版。

六、Seed 数据
必须补 recommendation 的样例数据：
1. 批准
2. 拒绝
3. 编辑后批准
4. today focus 排序样例

七、验收路径
至少验证：
1. 机会页 recommendation 有解释链
2. 联系人页 recommendation 有 supporting facts
3. 首页 today focus 排序合理
4. 审批后能写 feedback
5. feedback 后 recommendation 记录和日志完整
6. policy 变化后 recommendation 的 policyResult 有变化

如果必须取舍，优先级如下：
1. RecommendationLog / Feedback 数据模型
2. recommendation explanation
3. feedback 闭环
4. 首页和机会页联动
5. personalization
```

---

## 十三、验收标准

本轮完成后，至少满足以下条件：

1. recommendation 有结构化输出
2. recommendation 带 explanation
3. explanation 能引用 supporting facts / blockers / commitments
4. recommendation 可被用户反馈
5. feedback 写入 RecommendationFeedback
6. feedback 写入 AuditLog / EventLog
7. today focus 是排序结果，不是简单列表
8. 页面上能明显感知 recommendation 更强了

---

## 十四、最后提醒

Recommendation Engine 第二阶段不是为了显得更智能。

它真正的价值是：

1. 让 recommendation 更像经营判断
2. 让 recommendation 更值得信任
3. 让 recommendation 更符合用户和团队的真实风格
4. 让 recommendation 的效果可以被验证、被纠正、被持续增强
