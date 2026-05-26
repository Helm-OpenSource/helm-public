---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# migration-tool-crm-first-execution.md

> 当前代码实际路由与本执行稿有一处调整：
> - OAuth 入口实际在 `/api/connectors/hubspot/*` 与 `/api/connectors/salesforce/*`
> - CRM 导入执行实际统一走 `/api/imports/crm/preview`、`/api/imports/crm/run`、`/api/imports/crm/sync`
> - `status` 类接口当前未单独实现，状态展示以 `/imports/crm`、`/imports/jobs/[id]` 和 `ImportSource / ImportJob` 数据为准

## 文档目的

本文件用于把《CRM-first 迁移工具设计》压缩成可直接交给 Codex 开发的执行文档。

目标有四个：

1. 让 Codex 先支持 HubSpot / Salesforce，再支持 Gmail / Calendar / CSV
2. 让迁移工具能服务最有预算和付费意愿的存量 CRM 客户
3. 让导入后 10 分钟内能形成 today focus、blocker、commitment、recommendation 等价值输出
4. 让迁移工具成为 Helm 的 intelligence layer 入口，而不是普通导入器

---

## 一、Codex 工作方式要求

开始前请先阅读：

1. `/AGENTS.md`
2. `/README.md`
3. `/docs/README.md`
4. `/docs/product/intelligence-roadmap.md`
5. `/docs/product/phase-f-trial-operations-and-production-readiness.md`
6. `/docs/sales/migration_and_gtm_strategy.md`
7. `/docs/sales/migration-tool-crm-first-design.md`
8. `/docs/memory-system/implementation.md`
9. `/docs/recommendation-engine/implementation.md`
10. `/docs/reviews/code-review.md`

开始编码前必须：
1. 先输出《CRM-first 迁移工具实施计划》
2. 按 P0、P1、P2 排优先级
3. 说明每项改动影响哪些模型、服务、API、页面
4. 说明每项如何验证
5. 创建 Git checkpoint

编码完成后必须：
1. 输出改动清单
2. 输出数据模型变化
3. 输出 connector 与 API 清单
4. 输出导入后 warmup 结果
5. 输出验证结果
6. 更新 README 与 docs
7. 再创建 Git checkpoint

---

## 二、总目标

本轮迁移工具开发的总目标是：

**优先拿下 HubSpot / Salesforce 客户，不替换他们的 CRM，而是在其之上快速长出 Helm 的经营分身控制面。**

本轮不是做一个“万能导入器”，而是做：

1. CRM-first connector
2. 对象与关系映射
3. 冲突与去重
4. 导入后价值预热
5. warmup 驱动的 memory / recommendation 增强

---

## 三、总优先级

## P0 必做
1. HubSpot connector
2. Salesforce connector
3. ImportSource / ImportJob / ImportItem / IdentityMatch 数据模型
4. Contact / Company / Opportunity / Meeting 的 external 映射字段
5. Imports / Connectors 页面改造
6. CRM 连接向导
7. 导入预览与执行
8. 冲突处理最小版
9. 导入后 warmup
10. 首页 / recommendation / memory 的导入后价值显现

## P1 尽快做
11. 增量同步
12. Gmail / Calendar 与 CRM 叠加增强
13. 更细的对象归属与去重
14. 导入诊断与观测
15. recommendation / weekly report 对 CRM 数据的利用增强

## P2 后续做
16. HubSpot / Salesforce 更广对象覆盖
17. 更复杂双向同步
18. 更细后台任务和重跑能力
19. enterprise admin controls
20. 更复杂的迁移模板和批量治理

---

## 四、第一阶段范围锁定

本轮只做第一阶段，锁定下面这些能力。

## A. HubSpot
必须支持：
1. 连接认证
2. 导入 contacts
3. 导入 companies
4. 导入 deals
5. 导入 notes
6. 导入 associations
7. 首次导入
8. 增量同步基础骨架

## B. Salesforce
必须支持：
1. Connected App OAuth
2. 导入 Accounts
3. 导入 Contacts
4. 导入 Opportunities
5. 导入 Tasks
6. 导入 Events
7. 首次导入
8. 增量同步基础骨架

## C. 价值预热
导入完成后必须自动触发：
1. Memory generation
2. Blocker / commitment detection
3. today focus 重算
4. recommendation 重算
5. dashboard refresh

---

## 五、数据模型要求

本轮必须新增以下模型：

### 1. ImportSource
字段至少包括：
- workspaceId
- sourceType
- sourceName
- status
- authMode
- externalAccountId
- externalAccountLabel
- lastSyncedAt
- configJson

### 2. ImportJob
字段至少包括：
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

### 3. ImportItem
字段至少包括：
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

### 4. IdentityMatch
字段至少包括：
- workspaceId
- externalType
- externalId
- internalObjectType
- internalObjectId
- matchScore
- matchReason
- status

### 5. 核心对象外部映射字段
给以下对象增加：
- externalSource
- externalObjectType
- externalObjectId
- externalOwnerId，可选
- externalSyncedAt

对象包括：
1. Contact
2. Company
3. Opportunity
4. Meeting

---

## 六、对象映射要求

## HubSpot → Helm

### Contact → Contact
至少映射：
- firstname / lastname
- email
- phone
- title
- owner

### Company → Company
至少映射：
- name
- domain
- industry
- owner

### Deal → Opportunity
至少映射：
- dealname
- amount
- dealstage
- pipeline
- owner
- associated company
- associated contacts

### Note → MeetingNote / Memory input
至少映射：
- timestamp
- body
- association targets

### Associations
必须建立：
- Contact ↔ Company
- Deal ↔ Company
- Deal ↔ Contact

---

## Salesforce → Helm

### Account → Company
至少映射：
- Name
- Website / Domain
- Industry
- OwnerId

### Contact → Contact
至少映射：
- FirstName
- LastName
- Email
- Phone
- Title
- AccountId

### Opportunity → Opportunity
至少映射：
- Name
- Amount
- StageName
- CloseDate
- AccountId
- OwnerId

### Event → Meeting
至少映射：
- Subject
- StartDateTime
- EndDateTime
- Description
- WhoId / WhatId
- OwnerId

### Task → Timeline / Action input
至少映射：
- Subject
- Status
- ActivityDate
- Description
- Related object

---

## 七、去重与对象归属要求

第一阶段必须实现以下规则：

## Contact 去重
优先级：
1. externalObjectId
2. email
3. phone
4. name + company 高相似
5. 低置信度则进入人工确认

## Company 归并
优先级：
1. externalObjectId
2. domain
3. 标准化公司名
4. 高相似名称进入人工确认

## Opportunity 绑定
优先级：
1. externalObjectId
2. 标题 + 关联公司 + owner
3. 标题 + notes / meetings 上下文

## Meeting / Activity 绑定
优先级：
1. externalObjectId
2. 标题 + 时间 + 参与人
3. note / transcript 中的对象引用

第一阶段至少要把低置信度对象列出来，不允许静默乱绑。

---

## 八、页面要求

## 1. Imports / Connectors 页面
必须把 HubSpot / Salesforce 放在最前面。

顺序建议：
1. HubSpot
2. Salesforce
3. Gmail
4. Google Calendar
5. CSV
6. Transcript / meeting notes

每张卡片必须显示：
- 来源名称
- 适合哪类客户
- 能导入哪些对象
- 当前连接状态
- 最近同步时间
- 导入后会带来什么价值

## 2. CRM 连接向导
HubSpot 和 Salesforce 都必须有最小连接向导，四步如下：

### Step 1：连接认证
- 连接账户
- 显示当前连接对象

### Step 2：选择对象
可选：
- contacts / companies / deals / notes
- accounts / contacts / opportunities / tasks / events

### Step 3：映射与预览
必须显示：
- 将导入多少对象
- 哪些已匹配
- 哪些会创建新对象
- 哪些存在冲突
- 哪些关系不确定

### Step 4：执行与 warmup
导入完成后自动进入 warmup。

## 3. 导入结果页
必须显示：
1. 成功导入多少 contacts / companies / opportunities
2. 建立多少关系
3. 有多少冲突待确认
4. 生成了多少 MemoryFacts / Commitments / Blockers
5. 生成了多少 recommendation
6. 哪些首页 / briefing / 周报内容被增强

结果页要强调价值，不是只强调技术任务成功。

---

## 九、Warmup 价值预热要求

导入完成后必须自动执行：

## 1. 联系人与公司
触发：
- contact summary
- company summary
- 初步 recommendation

## 2. 机会
触发：
- risk 初始化
- blocker / commitment 检测
- today focus 排序参与
- recommendation 生成

## 3. notes / tasks / events
触发：
- MemoryFact
- Commitment
- Blocker
- Meeting / Timeline
- Briefing input

## 4. 首页
触发：
- 今日重点
- 高风险事项
- 待审批事项
- 系统已推进事项刷新

---

## 十、API 要求

## HubSpot
必须实现：
1. `GET /api/connectors/hubspot/start`
2. `GET /api/connectors/hubspot/callback`
3. `POST /api/imports/crm/sync`
4. 状态展示以 `/imports/crm` 与 `ImportSource / ImportJob` 数据为准

## Salesforce
必须实现：
1. `GET /api/connectors/salesforce/start`
2. `GET /api/connectors/salesforce/callback`
3. `POST /api/imports/crm/sync`
4. 状态展示以 `/imports/crm` 与 `ImportSource / ImportJob` 数据为准

## 通用导入任务
必须实现：
1. `POST /api/imports/jobs`
2. `GET /api/imports/jobs`
3. `GET /api/imports/jobs/:jobId`
4. `GET /api/imports/jobs/:jobId/conflicts`
5. `POST /api/imports/jobs/:jobId/resolve-conflicts`
6. `POST /api/imports/jobs/:jobId/warmup`

---

## 十一、后台任务要求

以下都必须走后台任务，不要全部放在同步请求里：

1. HubSpot 首次同步
2. Salesforce 首次同步
3. warmup
4. recommendation re-run
5. memory re-run
6. 大批量冲突处理后重算

每个任务必须支持：
1. job status
2. retry
3. timeout
4. progress
5. failed items
6. rerun

---

## 十二、与现有系统的集成要求

## 与 memory system
导入 notes / events / tasks 后，必须能形成：
- MemoryFact
- Commitment
- Blocker

## 与 recommendation engine
导入对象与活动后，必须能增强：
- today focus
- contact recommendation
- opportunity recommendation
- explanation

## 与 analytics
至少埋点：
- import_started
- import_completed
- import_failed
- import_conflict_resolved
- import_warmup_completed

## 与 weekly report
导入后识别出的：
- blocker
- commitment
- stalled opportunity
必须能进入周报统计

---

## 十三、约束

第一阶段明确约束如下：

1. 不要求替换客户 CRM
2. 只做 intelligence layer
3. 不做复杂双向同步
4. 不做全对象覆盖
5. 不做营销、票据、case 等外围对象
6. 不做深企业治理
7. 先把对象层、关系层、价值预热打通

---

## 十四、验收路径

至少验证以下 8 条路径：

### 路径 1
连接 HubSpot 成功

### 路径 2
导入 HubSpot contacts / companies / deals / notes 成功

### 路径 3
连接 Salesforce 成功

### 路径 4
导入 Salesforce accounts / contacts / opportunities / events / tasks 成功

### 路径 5
导入后对象关系成立

### 路径 6
导入后首页 today focus 变得有内容

### 路径 7
recommendation 能消费 CRM 数据

### 路径 8
导入结果页能向客户解释 Helm 多出来的 intelligence value

---

## 十五、最终交付要求

本轮结束后必须输出：

1. 数据模型变化清单
2. HubSpot connector 文件清单
3. Salesforce connector 文件清单
4. Imports / Connectors 页面变化
5. 对象映射与去重规则
6. warmup 逻辑说明
7. 验证结果
8. README / docs 更新说明
9. 未完成项

---

## 十六、最终目标

这一轮的最终目标不是“支持更多来源”。

这一轮真正的目标是：

**让最有预算和最有意愿的 CRM 存量客户，在不替换原系统的前提下，快速感知 Helm 作为经营分身控制面的价值。**
