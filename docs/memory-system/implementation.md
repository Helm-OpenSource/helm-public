---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 记忆系统第一阶段实施方案

## 文档目的

本文件用于指导“经营分身控制台”记忆系统第一阶段的数据库、服务层、API、页面联动与实现顺序。

目标是让工程团队或 Codex 可以直接依据本文开始开发，不再停留在概念层。

本文覆盖三部分：

1. Prisma 迁移清单
2. 接口清单
3. Codex 实施指令

相关文档：

- [记忆系统 API 示例](api-examples.md)
- [记忆系统 Seed 故事线](seed-storylines.md)
- [记忆系统代码评审标准](../reviews/memory-system-code-review.md)

---

## 一、设计目标

记忆系统要解决的核心问题有四个：

1. 把原始业务事件沉淀成可复用的结构化记忆
2. 让联系人、公司、机会、会议、承诺、阻碍、动作之间形成关系网络
3. 支撑会前 briefing、会后 action、风险提醒、下一步建议
4. 让用户可以确认、修正、删除，避免系统长期“记错”

数据库和 API 设计必须支持三种能力：

1. **事实记录能力**  
   保留真实事件来源

2. **结构化记忆能力**  
   把事实提炼成业务对象上的记忆

3. **行为反馈学习能力**  
   用户批准、拒绝、编辑、修正后，系统能持续更新记忆质量

---

## 二、Prisma 迁移清单

### 2.1 本轮迁移目标

本轮只做 P0 和一部分 P1，优先保证这 6 件事：

1. 会议导入后能生成结构化记忆
2. 联系人、公司、机会页能读取关键记忆
3. 承诺和阻碍能独立存储
4. 用户修正记忆后有记录
5. briefing 和 recommendation 能拿到结构化输入
6. 所有关键变化可审计

### 2.2 本轮新增模型

本轮新增 6 张表：

1. `MemoryFact`
2. `MemoryLink`
3. `MemoryCorrection`
4. `Commitment`
5. `Blocker`
6. `BriefingSnapshot`

建议暂时不急着落：
- `PreferenceSignal`
- 更复杂的归因表
- 更完整的记忆生命周期调度表

### 2.3 现有表需要补的字段

#### Contact
建议补：
- `relationshipStage String?`
- `relationshipTemperature Int @default(50)`
- `lastInteractionAt DateTime?`

#### Company
建议补：
- `maturityScore Int @default(50)`
- `lastInteractionAt DateTime?`

#### Opportunity
建议补：
- `riskLevel Int @default(50)`
- `lastProgressAt DateTime?`
- `nextStepSummary String?`

#### Meeting
建议补：
- `briefingSnapshotId String?`
- `postMeetingSummary String?`

#### ActionItem
建议补：
- `sourceType String?`
- `sourceId String?`
- `executionStatus String @default("pending")`

#### AuditLog
如果现有字段不够，补：
- `summary String`
- `payload Json?`
- `targetType String?`
- `targetId String?`

### 2.4 关系补充要求

#### MemoryFact
必须能挂到：
- Contact
- Company
- Opportunity
- Meeting
- ActionItem
- ApprovalTask
- PolicyRule
- EmailThread

建议通过：
- `objectType`
- `objectId`

来做统一挂载，不要一开始建 8 套外键。

#### Commitment
建议可关联：
- Contact
- Company
- Opportunity
- Meeting / MeetingNote 来源
- ownerUser

#### Blocker
建议可关联：
- Contact
- Company
- Opportunity
- 来源对象

#### BriefingSnapshot
先做成通用快照：
- `objectType`
- `objectId`
- `snapshotType`

后面再扩展。

### 2.5 Prisma 迁移顺序

建议按下面顺序迁移。

#### 迁移 1
新增枚举：
- `ObjectType`
- `SourceType`
- `MemoryFactType`
- `MemoryStatus`
- `MemoryRelationType`
- `MemoryCorrectionType`
- `CommitmentStatus`
- `BlockerStatus`

#### 迁移 2
新增表：
- `MemoryFact`
- `MemoryLink`
- `MemoryCorrection`

#### 迁移 3
新增表：
- `Commitment`
- `Blocker`
- `BriefingSnapshot`

#### 迁移 4
给现有表补字段：
- `Contact`
- `Company`
- `Opportunity`
- `Meeting`
- `ActionItem`
- `AuditLog`

#### 迁移 5
更新 seed 数据，补三条故事线对应的记忆对象。

### 2.6 索引建议

至少要加这些索引。

#### MemoryFact
- `(workspaceId, objectType, objectId)`
- `(workspaceId, factType)`
- `(workspaceId, sourceType, sourceId)`
- `(workspaceId, status)`

#### Commitment
- `(workspaceId, status)`
- `(workspaceId, relatedOpportunityId)`
- `(workspaceId, dueDate)`
- `(workspaceId, ownerUserId)`

#### Blocker
- `(workspaceId, status)`
- `(workspaceId, relatedOpportunityId)`
- `(workspaceId, severity)`

#### BriefingSnapshot
- `(workspaceId, objectType, objectId, snapshotType)`

### 2.7 Seed 数据新增要求

Codex 必须补 seed，让系统一启动就有记忆相关对象可演示。

至少补这些：

#### 销售故事线
- 1 个机会有 2 条 blocker
- 1 个机会有 2 条 commitment
- 1 个联系人有“偏好”和“关系阶段”类 fact
- 1 条 briefing snapshot

#### 招聘故事线
- 1 个候选人有 1 条 blocker
- 1 个职位机会有 1 条 overdue commitment
- 1 场面试会议有会前 briefing 和会后行动

#### 创始人故事线
- 1 个合作机会有“内部优先级冲突” blocker
- 1 条需要审批的对外动作
- 1 条已修正的记忆 correction

---

## 三、重点数据模型与 Prisma 草稿

下面给一版可继续细化的 Prisma 草稿。

```prisma
enum ObjectType {
  CONTACT
  COMPANY
  OPPORTUNITY
  MEETING
  ACTION_ITEM
  APPROVAL_TASK
  POLICY_RULE
  EMAIL_THREAD
}

enum SourceType {
  EMAIL_MESSAGE
  EMAIL_THREAD
  MEETING_NOTE
  MEETING
  ACTION_ITEM
  APPROVAL_TASK
  POLICY_RULE
  CSV_IMPORT
  USER_EDIT
  SYSTEM_INFERENCE
}

enum MemoryFactType {
  RELATIONSHIP
  PREFERENCE
  OBJECTION
  BLOCKER
  COMMITMENT
  NEXT_STEP
  STAGE_SIGNAL
  RISK_SIGNAL
  SUMMARY
  POLICY_PATTERN
  ACTION_PATTERN
}

enum MemoryStatus {
  ACTIVE
  OBSERVED
  ARCHIVED
  INVALID
}

model MemoryFact {
  id              String         @id @default(cuid())
  workspaceId     String
  objectType      ObjectType
  objectId        String
  factType        MemoryFactType
  title           String
  content         String
  normalizedValue Json?
  sourceType      SourceType
  sourceId        String
  confidence      Int            @default(50)
  importance      Int            @default(50)
  freshnessScore  Int            @default(50)
  status          MemoryStatus   @default(ACTIVE)
  confirmedByUser Boolean        @default(false)
  createdBySystem Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  workspace       Workspace      @relation(fields: [workspaceId], references: [id])
  linksFrom       MemoryLink[]   @relation("FromFact")
  linksTo         MemoryLink[]   @relation("ToFact")
  corrections     MemoryCorrection[]

  @@index([workspaceId, objectType, objectId])
  @@index([workspaceId, factType])
  @@index([workspaceId, sourceType, sourceId])
}

enum MemoryRelationType {
  SUPPORTS
  DERIVED_FROM
  CONTRADICTS
  LINKED_TO
  INFLUENCES
  RESOLVED_BY
}

model MemoryLink {
  id           String              @id @default(cuid())
  workspaceId  String
  fromFactId   String
  toFactId     String
  relationType MemoryRelationType
  weight       Int                 @default(50)
  createdAt    DateTime            @default(now())

  workspace    Workspace           @relation(fields: [workspaceId], references: [id])
  fromFact     MemoryFact          @relation("FromFact", fields: [fromFactId], references: [id])
  toFact       MemoryFact          @relation("ToFact", fields: [toFactId], references: [id])

  @@index([workspaceId, fromFactId])
  @@index([workspaceId, toFactId])
}

enum MemoryCorrectionType {
  CONTENT_UPDATE
  SOURCE_REBIND
  OBJECT_REBIND
  INVALIDATE
  DELETE
  CONFIDENCE_ADJUST
  STATUS_CHANGE
}

model MemoryCorrection {
  id                String               @id @default(cuid())
  workspaceId       String
  memoryFactId      String
  correctionType    MemoryCorrectionType
  beforeValue       Json?
  afterValue        Json?
  correctedByUserId String
  reason            String?
  createdAt         DateTime             @default(now())

  workspace         Workspace            @relation(fields: [workspaceId], references: [id])
  memoryFact        MemoryFact           @relation(fields: [memoryFactId], references: [id])
  correctedByUser   User                 @relation(fields: [correctedByUserId], references: [id])

  @@index([workspaceId, memoryFactId])
}

enum CommitmentStatus {
  OPEN
  IN_PROGRESS
  FULFILLED
  CANCELED
  OVERDUE
}

model Commitment {
  id                   String            @id @default(cuid())
  workspaceId          String
  title                String
  commitmentText       String
  sourceType           SourceType
  sourceId             String
  relatedContactId     String?
  relatedCompanyId     String?
  relatedOpportunityId String?
  ownerUserId          String?
  dueDate              DateTime?
  status               CommitmentStatus  @default(OPEN)
  priority             Int               @default(50)
  overdueFlag          Boolean           @default(false)
  fulfilledAt          DateTime?
  confidence           Int               @default(60)
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  workspace            Workspace         @relation(fields: [workspaceId], references: [id])
  relatedContact       Contact?          @relation(fields: [relatedContactId], references: [id])
  relatedCompany       Company?          @relation(fields: [relatedCompanyId], references: [id])
  relatedOpportunity   Opportunity?      @relation(fields: [relatedOpportunityId], references: [id])
  ownerUser            User?             @relation(fields: [ownerUserId], references: [id])

  @@index([workspaceId, status])
  @@index([workspaceId, relatedOpportunityId])
  @@index([workspaceId, dueDate])
}

enum BlockerStatus {
  OPEN
  MONITORING
  RESOLVED
  IGNORED
}

model Blocker {
  id                   String         @id @default(cuid())
  workspaceId          String
  title                String
  blockerType          String
  blockerText          String
  severity             Int            @default(50)
  sourceType           SourceType
  sourceId             String
  relatedContactId     String?
  relatedCompanyId     String?
  relatedOpportunityId String?
  status               BlockerStatus  @default(OPEN)
  firstSeenAt          DateTime       @default(now())
  resolvedAt           DateTime?
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt

  workspace            Workspace      @relation(fields: [workspaceId], references: [id])
  relatedContact       Contact?       @relation(fields: [relatedContactId], references: [id])
  relatedCompany       Company?       @relation(fields: [relatedCompanyId], references: [id])
  relatedOpportunity   Opportunity?   @relation(fields: [relatedOpportunityId], references: [id])

  @@index([workspaceId, status])
  @@index([workspaceId, relatedOpportunityId])
}

model BriefingSnapshot {
  id            String     @id @default(cuid())
  workspaceId   String
  objectType    ObjectType
  objectId      String
  snapshotType  String
  content       String
  sourceFactIds Json?
  generatedAt   DateTime   @default(now())
  expiresAt     DateTime?
  version       Int        @default(1)

  workspace     Workspace  @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId, objectType, objectId, snapshotType])
}
```

---

## 四、接口清单

### A. Memory Facts

#### 1. 获取对象记忆列表
`GET /api/memory/facts?objectType=CONTACT&objectId=:id`

返回：
- activeFacts
- observedFacts
- archivedFacts

支持参数：
- `factType`
- `status`
- `limit`

#### 2. 创建记忆事实
`POST /api/memory/facts`

请求体：
```json
{
  "objectType": "OPPORTUNITY",
  "objectId": "opp_123",
  "factType": "NEXT_STEP",
  "title": "下周发送方案",
  "content": "客户希望下周三前收到方案初稿",
  "sourceType": "MEETING_NOTE",
  "sourceId": "note_123",
  "confidence": 80,
  "importance": 90
}
```

#### 3. 确认记忆
`POST /api/memory/facts/:id/confirm`

#### 4. 修正记忆
`POST /api/memory/facts/:id/correct`

请求体：
```json
{
  "correctionType": "CONTENT_UPDATE",
  "afterValue": {
    "content": "客户更关心付款周期，不是总价"
  },
  "reason": "会后电话确认"
}
```

#### 5. 失效记忆
`POST /api/memory/facts/:id/invalidate`

#### 6. 删除记忆
`POST /api/memory/facts/:id/delete`

首版如果你担心真删除，先做软删除或设为 `INVALID`。

### B. Commitments

#### 1. 获取对象承诺列表
`GET /api/commitments?relatedOpportunityId=:id`

#### 2. 创建承诺
`POST /api/commitments`

#### 3. 更新承诺状态
`POST /api/commitments/:id/status`

请求体：
```json
{
  "status": "FULFILLED"
}
```

#### 4. 获取逾期承诺
`GET /api/commitments/overdue?workspaceId=:id`（文档预留，当前代码未实现）

#### 5. 获取联系人相关承诺
`GET /api/commitments?relatedContactId=:id`

### C. Blockers

#### 1. 获取阻碍列表
`GET /api/blockers?relatedOpportunityId=:id`

#### 2. 创建阻碍
`POST /api/blockers`

#### 3. 更新阻碍状态
`POST /api/blockers/:id/status`

#### 4. 解决阻碍
`POST /api/blockers/:id/resolve`

### D. Briefings

#### 1. 生成联系人摘要
`POST /api/briefings/contact/:contactId`（文档预留，当前代码未实现）

#### 2. 生成公司摘要
`POST /api/briefings/company/:companyId`（文档预留，当前代码未实现）

#### 3. 生成机会摘要
`POST /api/briefings/opportunity/:opportunityId`（文档预留，当前代码未实现）

#### 4. 生成会前 briefing
`POST /api/briefings/meeting/:meetingId`

返回结构建议：
```json
{
  "summary": "本次会议建议聚焦方案范围和交付时间。",
  "recentFacts": [],
  "openCommitments": [],
  "activeBlockers": [],
  "recommendedQuestions": [],
  "recommendedNextSteps": []
}
```

#### 5. 获取缓存快照
`GET /api/briefings/snapshots?objectType=MEETING&objectId=:id&snapshotType=pre_meeting_brief`（文档预留，当前代码未实现）

### E. Recommendations

#### 1. 获取对象下一步动作建议
`GET /api/recommendations/next-actions?objectType=OPPORTUNITY&objectId=:id`

返回：
- recommendations
- supportingFactIds
- blockerIds
- commitmentIds
- policyResult

#### 2. 获取今日重点
`GET /api/recommendations/today-focus?workspaceId=:id`

返回：
- topPriorities
- highRiskItems
- overdueCommitments
- stalledOpportunities
- suggestedActions

#### 3. 获取联系人下一步建议
`GET /api/recommendations/contact/:contactId`（文档预留，当前代码未实现）

### F. Memory Timeline

#### 1. 获取对象记忆时间线
`GET /api/memory/timeline?objectType=CONTACT&objectId=:id`

返回时间线中的混合事件：
- emails
- meetings
- approvals
- actions
- memory facts
- commitments
- blockers

#### 2. 搜索记忆
`GET /api/memory/search?q=预算&objectType=COMPANY`（文档预留，当前代码未实现）

#### 3. 获取修正历史
`GET /api/memory/facts/:id/corrections`（文档预留，当前代码未实现）

---

## 五、服务层拆分建议

建议新增 `features/memory/` 和 `lib/memory/`，并按下面拆服务。

### 1. `lib/memory/memory-fact.service.ts`
负责：
- 创建 fact
- 更新 fact
- 失效 fact
- 查询对象 facts
- 计算 confidence / freshness

### 2. `lib/memory/commitment.service.ts`
负责：
- 从会议和邮件中提取 commitment
- 更新承诺状态
- 识别逾期

### 3. `lib/memory/blocker.service.ts`
负责：
- 创建 blocker
- 更新 blocker
- 查询当前活跃阻碍

### 4. `lib/memory/briefing.service.ts`
负责：
- 召回对象相关记忆
- 生成 briefing payload
- 写入 snapshot

### 5. `lib/memory/recommendation.service.ts`
负责：
- 召回相关 facts / commitments / blockers
- 排序
- 输出 next actions
- 应用 policy

### 6. `lib/memory/correction.service.ts`
负责：
- 写入 correction
- 更新 fact
- 触发 snapshot 失效

### 7. `lib/memory/memory-link.service.ts`
负责：
- 建立 fact 关系
- 获取 supporting chain

---

## 六、记忆生成链路

建议只先打通 3 条链路。

### 链路 1：会议导入 → 记忆生成
输入：
- Meeting
- MeetingNote
- Participants
- Related Opportunity

输出：
- MemoryFacts
- Commitments
- Blockers
- ActionItems
- BriefingSnapshot

处理步骤：
1. 读取会议纪要正文
2. 提取关键结论
3. 提取 action items
4. 提取承诺
5. 提取阻碍
6. 写入库
7. 更新联系人 / 机会 / 公司时间线

### 链路 2：审批结果 → 偏好信号和动作记忆
输入：
- ApprovalTask
- ActionItem
- PolicyRule
- User decision

输出：
- MemoryFact，动作模式或偏好模式
- AuditLog
- EventLog
- 相关对象状态变化

处理步骤：
1. 用户批准或拒绝
2. 更新 ApprovalTask / ActionItem
3. 生成 action pattern fact
4. 后续再扩到 PreferenceSignal

### 链路 3：Gmail / CSV 导入 → 联系人 / 公司 / 机会记忆
输入：
- EmailThread
- CSV rows

输出：
- Contact / Company link
- Opportunity associations
- MemoryFacts
- 时间线更新

---

## 七、页面联动清单

### 联系人详情页
新增模块：
1. 关键记忆
2. 未完成承诺
3. 当前阻碍
4. 推荐下一步动作

### 公司详情页
新增模块：
1. 合作成熟度
2. 最近 30 天关键记忆摘要
3. 高风险阻碍
4. 当前承诺

### 机会详情抽屉
新增模块：
1. 当前 blocker 列表
2. 当前 commitment 列表
3. 最近形成的 memory facts
4. 系统下一步推荐
5. 推荐依据

### 会议详情页
新增模块：
1. 本次会议形成的承诺
2. 本次会议形成的阻碍
3. supporting facts 预览
4. 会后 action 与记忆写入状态

### 记忆与时间线页
新增 tab：
1. 事实
2. 承诺
3. 阻碍
4. 修正历史

---

## 八、审计和事件埋点要求

### AuditLog 记录：
1. 创建 MemoryFact
2. 修正 MemoryFact
3. 失效 MemoryFact
4. 创建 Commitment
5. 更新 Commitment
6. 创建 Blocker
7. 解决 Blocker
8. 生成 BriefingSnapshot

### EventLog 记录：
1. memory_fact_created
2. memory_fact_corrected
3. commitment_created
4. commitment_fulfilled
5. blocker_created
6. blocker_resolved
7. briefing_generated
8. recommendation_requested

---

## 九、Codex 实施顺序

建议严格按这个顺序工作。

### 第 1 阶段
1. Prisma schema 迁移
2. migration 跑通
3. seed 补数据

### 第 2 阶段
1. memory-fact service
2. commitment service
3. blocker service
4. correction service

### 第 3 阶段
1. meeting import → memory generation 链路
2. API 路由
3. 页面最小展示

### 第 4 阶段
1. briefing service
2. recommendation service，先做简单版
3. 记忆页和对象页增强

### 第 5 阶段
1. 审计和埋点补全
2. README 更新
3. 验证路径

---

## 十、给 Codex 的直接实施指令

下面这段可以直接贴给 Codex。

```text
现在开始实现“经营分身控制台”的记忆系统第一阶段。

目标：
把当前产品从“对象和动作管理”推进到“对象级工作记忆系统”。

先不要做过多抽象，请严格按下面顺序实现：

第一步，先阅读现有仓库和已有文档：
- [AGENTS.md](../../AGENTS.md)
- [通用代码评审标准](../reviews/code-review.md)
- [产品原则](../product/product-principles.md)
- [标准演示脚本](../product/demo-script.md)
- [产品路线图](../product/roadmap.md)

第二步，先输出《记忆系统第一阶段实施计划》，按 P0、P1、P2 排优先级。
计划里必须明确：
1. 本轮会新增哪些 Prisma 模型
2. 本轮会新增哪些 API
3. 本轮会增强哪些页面
4. 本轮会如何验证

第三步，再开始编码。
编码前创建 Git checkpoint。
编码后创建 Git checkpoint。

本轮只做第一阶段，不要扩散做无关 polish。
本轮必须完成以下内容：

一、Prisma 模型
新增并迁移：
1. MemoryFact
2. MemoryLink
3. MemoryCorrection
4. Commitment
5. Blocker
6. BriefingSnapshot

同时给现有模型补必要字段：
- Contact
- Company
- Opportunity
- Meeting
- ActionItem
- AuditLog

二、服务层
请新增：
1. lib/memory/memory-fact.service.ts
2. lib/memory/commitment.service.ts
3. lib/memory/blocker.service.ts
4. lib/memory/correction.service.ts
5. lib/memory/briefing.service.ts
6. lib/memory/recommendation.service.ts

三、API
请至少实现以下接口：
1. GET /api/memory/facts
2. POST /api/memory/facts
3. POST /api/memory/facts/:id/confirm
4. POST /api/memory/facts/:id/correct
5. POST /api/memory/facts/:id/invalidate
6. GET /api/commitments
7. POST /api/commitments
8. POST /api/commitments/:id/status
9. GET /api/blockers
10. POST /api/blockers
11. POST /api/blockers/:id/resolve
12. POST /api/briefings/meeting/:meetingId
13. GET /api/recommendations/next-actions
14. GET /api/memory/timeline

四、记忆生成链路
必须先打通：
1. 会议纪要导入后生成 MemoryFacts
2. 会议纪要导入后生成 Commitments
3. 会议纪要导入后生成 Blockers
4. 会议详情页可看到这些结果
5. 联系人页和机会页可看到对应记忆

五、页面增强
请增强以下页面：
1. Contact 详情页
   - 增加关键记忆
   - 增加未完成承诺
   - 增加当前阻碍
2. Company 详情页
   - 增加合作成熟度摘要
   - 增加关键记忆摘要
3. Opportunity 详情抽屉或详情页
   - 增加 blocker
   - 增加 commitment
   - 增加下一步推荐
4. Meeting 详情页
   - 增加本次会议形成的 commitment
   - 增加 blocker
   - 增加 supporting facts
5. 记忆与时间线页
   - 增加 Facts / Commitments / Blockers / Corrections 四个 tab

六、Seed 数据
必须补充：
1. 销售故事线中的 blocker 和 commitment
2. 招聘故事线中的 blocker 和 overdue commitment
3. 创始人故事线中的 correction 样例
4. briefing snapshot 样例

七、审计
以下动作必须写 AuditLog：
1. 创建 MemoryFact
2. 修正 MemoryFact
3. 创建 Commitment
4. 更新 Commitment 状态
5. 创建 Blocker
6. 解决 Blocker
7. 生成 BriefingSnapshot

八、验收路径
本轮完成后必须至少验证：
1. 导入一场会议后能看到生成的 facts
2. 会议页能看到 commitment 和 blocker
3. 联系人页能看到关键记忆
4. 机会页能看到 blocker 和下一步推荐
5. 修正一条记忆后，时间线和 audit log 都更新
6. README 更新成可演示和可开发版本

如果必须取舍，优先级如下：
1. Prisma 模型和迁移
2. 会议 → 记忆生成链
3. Contact / Opportunity / Meeting 页面展示
4. 修正与审计
5. Recommendation 和 snapshot
```

---

## 十一、验收标准

本阶段完成后，至少满足以下条件：

1. 会议导入后，系统能生成结构化记忆
2. 会议页能展示本次会议形成的承诺和阻碍
3. 联系人页能展示关键记忆与未完成承诺
4. 机会页能展示 blocker 和下一步推荐
5. 用户修正记忆后，相关摘要会更新
6. recommendation 接口能返回 supportingFactIds
7. 所有关键修改都能在 AuditLog 中看到
8. README 已补充记忆系统实现说明

---

## 十二、实施建议

建议分两轮完成：

### 第一轮
先落地：
- MemoryFact
- Commitment
- Blocker
- MemoryCorrection
- 会议导入到记忆生成链
- 联系人页 / 机会页最小展示

### 第二轮
再补：
- MemoryLink
- BriefingSnapshot
- recommendation service
- 首页今日重点记忆驱动

这样推进最稳，也最容易在现有产品上快速看到效果。
