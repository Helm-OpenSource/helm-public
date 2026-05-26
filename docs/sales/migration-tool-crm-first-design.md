---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# migration-tool-crm-first-design.md

> 当前代码实际路由与本设计稿有一处调整：
> - OAuth 入口实际在 `/api/connectors/hubspot/*` 与 `/api/connectors/salesforce/*`
> - CRM 导入执行实际统一走 `/api/imports/crm/preview`、`/api/imports/crm/run`、`/api/imports/crm/sync`
> - `status` 类接口当前未单独实现，状态展示以 `/imports/crm`、`/imports/jobs/[id]` 和 `ImportSource / ImportJob` 数据为准

## 文档目的

本文件用于定义“经营推进控制台”的 CRM-first 迁移工具设计。

目标有六个：

1. 让迁移工具优先服务最有预算和付费意愿的存量客户
2. 把迁移优先级从 Gmail / CSV 调整为 HubSpot / Salesforce 优先
3. 让 Helm 在不替换客户原有 CRM 的情况下，快速长出一层经营分身控制面
4. 让导入后的对象、关系、活动、笔记能直接进入记忆、推荐、审批和周报闭环
5. 让客户在导入后 10 分钟内感知到价值
6. 让这套迁移能力可直接交给 Codex 开发

---

## 一、产品定位

迁移工具不是一个“导入器”。

它的正确定位是：

**把主流 CRM 中已有的对象层、关系层和活动层，快速转化为 Helm 的经营分身输入层。**

一句话表达：

**不替换你的 CRM，先在其之上长出经营分身控制面。**

这意味着：

1. 客户现有 HubSpot / Salesforce 继续充当 system of record
2. Helm 充当 system of intelligence and action
3. 首先解决“会后断链、推进断链、判断断链”的问题
4. 不强推一开始做复杂双向同步

---

## 二、为什么必须 CRM-first

当前如果你们的目标客户是“最有付费能力和意愿”的那一层，那么 Gmail / CSV 只是辅助入口，不能再是主入口。

原因有四个：

### 1. HubSpot / Salesforce 客户已经有成熟存量数据
他们通常已经沉淀了：
- 联系人
- 公司
- 机会
- 活动
- 笔记
- 负责人
- 阶段信息

这些是形成 Helm recommendation、memory、approval、briefing 的理想底层。

### 2. 这类客户最容易进入付费 PoC
因为他们更容易认可：
- recommendation
- 会后推进
- 经营局势前台
- 审批与治理
这些价值，而不是只把系统看成“另一个记录工具”。

### 3. Helm 的优势不是替代 CRM，而是增加 intelligence layer
如果一上来要求客户替换 CRM，阻力会很大。  
如果先叠加一层“经营分身控制面”，阻力会小得多。

### 4. 导入后价值会更快显现
HubSpot / Salesforce 中的对象层和关系层一旦接进来，today focus、blocker、commitment、briefing、recommendation 的质量会立刻上升。

---

## 三、优先级重排

## 原优先级
1. Gmail
2. Google Calendar
3. CSV
4. HubSpot
5. Salesforce

## 新优先级
1. HubSpot
2. Salesforce
3. Gmail
4. Google Calendar
5. CSV
6. Meeting notes / transcript ingest

### 原则
CRM-first，不是抛弃 Gmail / Calendar / CSV，而是：
- CRM 负责对象层和关系层
- Gmail / Calendar 负责行为层和增量上下文
- CSV 负责冷启动补充和低系统化客户

---

## 四、第一阶段范围

## A. HubSpot 第一阶段

### 必须支持的对象
1. Contacts
2. Companies
3. Deals
4. Notes
5. Owners
6. Associations

### 第一阶段不做
1. Tickets
2. Quotes
3. Marketing assets
4. 全 engagement 覆盖
5. 复杂双向同步

### 第一阶段目标
至少做到：
1. 联系人导入
2. 公司导入
3. 机会导入
4. notes 进入记忆入口
5. associations 转成对象关系
6. 导入后触发 warmup

---

## B. Salesforce 第一阶段

### 必须支持的对象
1. Account
2. Contact
3. Opportunity
4. Task
5. Event
6. Lead，可选
7. Owner / User
8. Notes / Activity history，按现有数据结构适配

### 第一阶段不做
1. Case
2. CPQ
3. 全 metadata 同步
4. 复杂 workflow 迁移
5. 深双向同步

### 第一阶段目标
至少做到：
1. Account → Company
2. Contact → Contact
3. Opportunity → Opportunity
4. Event → Meeting
5. Task → Timeline / Action input
6. 导入后 warmup

---

## 五、整体架构

建议把 CRM-first 迁移工具拆成 7 层。

## 1. Connector Layer
负责接入来源。

优先支持：
1. HubSpot connector
2. Salesforce connector
3. Gmail connector
4. Calendar connector
5. CSV import
6. Transcript ingest

## 2. Normalizer Layer
把外部对象映射成统一中间结构：

- ExternalPerson
- ExternalCompany
- ExternalOpportunity
- ExternalMeeting
- ExternalActivity
- ExternalNote
- ExternalOwner
- ExternalAssociation

## 3. Mapping Layer
负责字段映射。

例如：
- HubSpot Contact -> Helm Contact
- Salesforce Account -> Helm Company

## 4. Identity Resolution Layer
负责：
1. 去重
2. 归并
3. 对象绑定
4. 关系建立
5. 低置信度冲突提示

## 5. Import Orchestration Layer
负责：
1. 首次导入
2. 增量同步
3. 预览
4. 冲突处理
5. 错误记录
6. warmup

## 6. Warmup Layer
负责在导入完成后触发：
1. Memory generation
2. Recommendation generation
3. Dashboard refresh
4. Blocker / commitment detection
5. Briefing cache

## 7. Governance & Observability Layer
负责：
1. Connector 配置
2. 权限控制
3. 同步日志
4. 成本和性能观测
5. 手动重跑和诊断

---

## 六、数据模型设计

建议新增以下模型。

## 1. ImportSource
作用：
表示一个外部数据来源。

字段建议：
- id
- workspaceId
- sourceType
- sourceName
- status
- authMode
- externalAccountId
- externalAccountLabel
- lastSyncedAt
- configJson
- createdAt
- updatedAt

sourceType 示例：
- HUBSPOT
- SALESFORCE
- GMAIL
- GOOGLE_CALENDAR
- CSV
- TRANSCRIPT_INGEST

---

## 2. ImportJob
作用：
表示一次导入或同步任务。

字段建议：
- id
- workspaceId
- sourceId
- jobType
- status
- totalRecords
- successRecords
- failedRecords
- warningRecords
- startedAt
- finishedAt
- errorSummary
- createdAt

jobType 示例：
- INITIAL_SYNC
- INCREMENTAL_SYNC
- CSV_IMPORT
- WARMUP

status 示例：
- PENDING
- RUNNING
- COMPLETED
- FAILED
- PARTIAL_SUCCESS

---

## 3. ImportItem
作用：
表示导入任务中的单条对象记录。

字段建议：
- id
- importJobId
- externalType
- externalId
- mappedObjectType
- mappedObjectId
- matchStatus
- conflictStatus
- payload
- normalizedPayload
- errorMessage
- createdAt

matchStatus 示例：
- MATCHED
- CREATED
- NEEDS_REVIEW

conflictStatus 示例：
- NONE
- DUPLICATE
- AMBIGUOUS
- INVALID

---

## 4. IdentityMatch
作用：
表示某条外部对象与 Helm 内部对象的匹配结果。

字段建议：
- id
- workspaceId
- externalType
- externalId
- internalObjectType
- internalObjectId
- matchScore
- matchReason
- status
- createdAt

status 示例：
- CONFIRMED
- AUTO_MATCHED
- NEEDS_REVIEW
- REJECTED

---

## 5. ImportTemplate，可选
作用：
保存字段映射模板。

字段建议：
- id
- workspaceId
- sourceType
- templateName
- mappingConfig
- createdAt

---

## 七、内部对象增强字段

为了支持后续增量同步，建议给核心对象补外部映射字段。

### Contact
增加：
- externalSource
- externalObjectType
- externalObjectId
- externalOwnerId
- externalSyncedAt

### Company
增加：
- externalSource
- externalObjectType
- externalObjectId
- externalOwnerId
- externalSyncedAt

### Opportunity
增加：
- externalSource
- externalObjectType
- externalObjectId
- externalOwnerId
- externalSyncedAt

### Meeting
增加：
- externalSource
- externalObjectType
- externalObjectId
- externalSyncedAt

---

## 八、对象映射规则

## A. HubSpot 映射

### Contact → Contact
优先字段：
- firstname / lastname
- email
- phone
- jobtitle
- company
- owner

### Company → Company
优先字段：
- name
- domain
- industry
- owner

### Deal → Opportunity
优先字段：
- dealname
- amount
- dealstage
- pipeline
- owner
- associated company
- associated contacts

### Note → MeetingNote / Memory input
优先字段：
- timestamp
- body
- association targets

### Associations
转成：
- Contact ↔ Company
- Deal ↔ Company
- Deal ↔ Contact

---

## B. Salesforce 映射

### Account → Company
优先字段：
- Name
- Website / Domain
- Industry
- OwnerId

### Contact → Contact
优先字段：
- FirstName
- LastName
- Email
- Phone
- Title
- AccountId

### Opportunity → Opportunity
优先字段：
- Name
- Amount
- StageName
- CloseDate
- AccountId
- OwnerId

### Event → Meeting
优先字段：
- Subject
- StartDateTime
- EndDateTime
- Description
- WhoId / WhatId
- OwnerId

### Task → Timeline / Action input
优先字段：
- Subject
- Status
- ActivityDate
- Description
- Related object

---

## 九、身份解析与去重规则

这是迁移工具最关键的部分。

## 1. Contact 去重
优先级：
1. externalObjectId 命中
2. email 完全匹配
3. phone 完全匹配
4. name + company 高相似
5. 仅 name 相似 -> 进入人工确认

## 2. Company 归并
优先级：
1. externalObjectId 命中
2. domain 命中
3. 标准化公司名完全匹配
4. 公司名高相似 -> 人工确认

## 3. Opportunity 绑定
优先级：
1. externalObjectId 命中
2. 标题 + 关联公司 + owner
3. 标题 + 最近会议 / note 上下文

## 4. Meeting / Activity 绑定
优先级：
1. externalObjectId 命中
2. 标题 + 时间 + 参与人
3. note / transcript 里的对象引用

---

## 十、页面与交互设计

## 1. Imports / Connectors 页改造

必须把 HubSpot / Salesforce 放在最前面。

推荐卡片顺序：
1. HubSpot
2. Salesforce
3. Gmail
4. Google Calendar
5. CSV
6. Meeting notes / transcript ingest

每张卡片展示：
- 适合什么客户
- 可导入什么对象
- 当前状态
- 最近同步时间
- 导入后可能产生什么价值

---

## 2. CRM 导入向导

HubSpot 和 Salesforce 都采用四步导入向导：

### Step 1 连接认证
- 连接账户
- 显示当前连接身份

### Step 2 选择对象
可选：
- contacts / companies / deals / notes
- account / contact / opportunity / event / task

### Step 3 映射与预览
显示：
- 将导入多少对象
- 哪些映射成功
- 哪些对象存在冲突
- 哪些关系无法确定

### Step 4 执行与 warmup
导入后自动触发：
- Memory generation
- Recommendation generation
- Dashboard refresh

---

## 3. 导入结果页

必须显示：
1. 成功导入多少 contacts / companies / opportunities
2. 建立了多少对象关系
3. 有多少冲突需要确认
4. 生成了多少 MemoryFacts / Commitments / Blockers
5. 生成了多少 recommendation
6. 首页 / briefing / 周报被增强了哪些对象

这一步不是“技术结果页”，而是“价值结果页”。

---

## 十一、Warmup 价值预热逻辑

导入完成后必须自动执行：

## 1. 对联系人 / 公司
触发：
- 联系人摘要
- 公司摘要
- 初步 recommendation

## 2. 对机会
触发：
- risk 初始化
- today focus 排序参与
- blocker / commitment 检测
- recommendation 生成

## 3. 对 notes / events
触发：
- MemoryFact
- Commitment
- Blocker
- Meeting / Timeline
- Briefing input

## 4. 对首页
触发：
- 今日重点
- 高风险事项
- 待审批事项
- 系统已推进事项更新

---

## 十二、API 设计

## HubSpot
### 开始连接
`GET /api/connectors/hubspot/start`

### OAuth 回调
`GET /api/connectors/hubspot/callback`

### 首次同步
`POST /api/imports/crm/sync`

### 查询同步状态
状态展示以 `/imports/crm` 与 `ImportSource / ImportJob` 数据为准

## Salesforce
### 开始连接
`GET /api/connectors/salesforce/start`

### OAuth 回调
`GET /api/connectors/salesforce/callback`

### 首次同步
`POST /api/imports/crm/sync`

### 查询同步状态
状态展示以 `/imports/crm` 与 `ImportSource / ImportJob` 数据为准

## 通用导入任务
### 创建任务
`POST /api/imports/jobs`

### 查询任务
`GET /api/imports/jobs/:jobId`

### 查询冲突
`GET /api/imports/jobs/:jobId/conflicts`

### 解决冲突
`POST /api/imports/jobs/:jobId/resolve-conflicts`

### 触发 warmup
`POST /api/imports/jobs/:jobId/warmup`

---

## 十三、后台任务设计

以下任务必须后台执行：

1. HubSpot 首次同步
2. Salesforce 首次同步
3. 大批量 CSV 导入
4. warmup
5. recommendation re-run
6. memory re-run

每个任务必须支持：
1. job status
2. retry
3. timeout
4. progress
5. failed items
6. rerun

---

## 十四、与现有系统的集成点

## 与 memory system
导入 notes / events / meetings 后，必须进入：
- MemoryFact
- Commitment
- Blocker

## 与 recommendation engine
导入对象关系和活动后，必须增强：
- today focus
- contact recommendation
- opportunity recommendation
- explanation

## 与 analytics
必须埋点：
- import_started
- import_completed
- import_failed
- import_conflict_resolved
- import_warmup_completed

## 与 weekly report
导入后新识别的：
- blocker
- commitment
- stalled opportunity
要进入周报统计

---

## 十五、失败与回滚策略

必须支持：
1. dry run
2. preview
3. import
4. warmup

规则：
1. 单条记录失败不拖垮整批导入
2. 冲突项支持人工确认
3. warmup 失败不影响基础对象导入
4. 同一对象重复同步不产生脏数据
5. 导入结果支持重跑

---

## 十六、给 Codex 的直接实施指令

下面这段可以直接贴给 Codex。

```text
现在开始实现 Helm 的 CRM-first 迁移工具第一阶段。

目标：
优先拿下 HubSpot 和 Salesforce，让存量 CRM 客户能快速接入 Helm，并在导入后迅速形成经营记忆、today focus、blocker / commitment 和 recommendation。

先不要直接编码。
请先阅读：
- AGENTS.md
- docs/README.md
- docs/product/intelligence-roadmap.md
- docs/product/phase-f-trial-operations-and-production-readiness.md
- docs/sales/migration_and_gtm_strategy.md
- docs/memory-system/implementation.md
- docs/recommendation-engine/implementation.md

然后输出《CRM-first Migration Tool 实施计划》，按 P0、P1、P2 排优先级。

计划中必须写清：
1. 如何优先支持 HubSpot
2. 如何优先支持 Salesforce
3. 新增哪些数据模型
4. 新增哪些 connector 服务
5. 新增哪些页面与 API
6. 如何做对象映射和关系绑定
7. 如何在导入后自动生成 today focus / blocker / commitment / recommendation
8. 如何验证

输出计划后再开始编码。
编码前创建 Git checkpoint。
编码后创建 Git checkpoint。

本轮必须完成：

一、数据模型
新增或增强：
1. ImportSource
2. ImportJob
3. ImportItem
4. IdentityMatch
5. 给 Contact / Company / Opportunity / Meeting 增加 externalSource / externalObjectId / externalSyncedAt

二、HubSpot 连接器
必须支持：
1. 连接认证
2. 导入 contacts
3. 导入 companies
4. 导入 deals
5. 导入 notes
6. 导入 associations
7. 首次导入
8. 增量同步

三、Salesforce 连接器
必须支持：
1. Connected App OAuth
2. 导入 Accounts
3. 导入 Contacts
4. 导入 Opportunities
5. 导入 Tasks / Events
6. 首次导入
7. 增量同步

四、对象映射
必须完成：
1. HubSpot Contact -> Helm Contact
2. HubSpot Company -> Helm Company
3. HubSpot Deal -> Helm Opportunity
4. Salesforce Account -> Helm Company
5. Salesforce Contact -> Helm Contact
6. Salesforce Opportunity -> Helm Opportunity
7. Salesforce Event -> Helm Meeting
8. Salesforce Task -> Helm Timeline / Action input

五、页面
必须增强：
1. Imports / Connectors 页
2. CRM 连接向导
3. 导入结果页
4. 冲突处理页

六、导入后 warmup
必须自动触发：
1. today focus 重算
2. recommendation 生成
3. blocker / commitment 识别
4. dashboard refresh

七、约束
1. 第一阶段不要求替换客户 CRM
2. 你做的是 intelligence layer
3. 不做复杂双向同步
4. 不做全对象覆盖
5. 先把对象层和关系层接好

八、验收路径
至少验证：
1. HubSpot 导入 contacts / companies / deals 成功
2. Salesforce 导入 accounts / contacts / opportunities / events 成功
3. 导入后对象关系成立
4. 首页 today focus 变得有内容
5. recommendation 能消费 CRM 数据
6. blocker / commitment 能从 notes / events 中形成
7. 导入结果页能讲清价值
```

---

## 十七、验收标准

CRM-first 迁移工具第一阶段完成后，至少满足：

1. 能接入 HubSpot
2. 能接入 Salesforce
3. 能把 contacts / companies / opportunities / notes / events 转成 Helm 对象
4. 能建立对象关系
5. 导入后能触发 warmup
6. 首页能出现 today focus
7. recommendation 能消费 CRM 数据
8. 导入结果页能向客户展示实际价值

---

## 十八、最终结论

如果你们要优先打最有预算和最有意愿的客户，迁移工具就必须先拿下 HubSpot / Salesforce。

而且不能只是“能导一点数据”，而必须做到：

1. 对象层导入
2. 关系层绑定
3. notes / events 进入记忆和推荐链
4. 导入后 10 分钟内让客户感受到 Helm 比原系统多出来的 intelligence layer

这就是 CRM-first 迁移工具设计的核心目标。
