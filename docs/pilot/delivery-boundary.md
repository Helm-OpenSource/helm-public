---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 试点前交付边界说明

## 文档目的

本文件用于明确 Helm 在试点前的正式交付边界。

目标不是描述理想蓝图，而是明确：

1. 当前仓库的真实 Git 边界
2. 当前代码里哪些能力已实现
3. 哪些能力只是部分可用
4. 哪些文档项仍是预留，不应被视为已交付

---

## 一、Git 与仓库边界

### 当前唯一仓库根目录

- Git 根目录：当前 Helm 仓库根目录（可由 `git rev-parse --show-toplevel` 验证）
- 父级工作区目录只作为 sibling projects 容器，不参与 Helm 的版本历史

### 当前分支与基线

- `main`
  - 当前正式交付基线
- 至少一条可审计的 `codex/*` 分支
  - 用于保留迁移、基线或备份回溯路径
  - 具体分支名可随着收口过程调整，但必须保持显式命名且可 checkout

### 当前可交付原则

1. 评审与试点时，以 `main` 和显式命名的 `codex/*` 分支为准
2. 不再依赖临时 checkpoint 口头说明
3. 不再使用父目录旧仓库语境解释 Helm 的代码历史

---

## 二、已实现、部分可用、文档预留

### 已实现且可验收

1. 经营工作台前台主链路
2. 会议 -> action -> approval -> audit 基础闭环
3. 结构化记忆：
   - `MemoryFact`
   - `Commitment`
   - `Blocker`
   - `MemoryCorrection`
   - `BriefingSnapshot`
4. Recommendation Engine 第二阶段：
   - recommendation log
   - evidence
   - explanation
   - feedback
5. LLM 接入最小骨架：
   - provider registry
   - OpenAI adapter
   - model router
   - LLMCallLog
6. Adaptive Evolution 第一阶段与部分第二阶段：
   - `DeltaEvent`
   - `PatternFact`
   - `StrategySuggestion`
   - 策略建议采纳 / 忽略
7. Conversation Capture 第一阶段：
   - capture session
   - transcript
   - insight
   - memory writeback
8. 使用分析、周报、CSV 导入、Gmail 只读连接骨架
9. 试点运营控制与核心双语前台：
   - workspace `defaultLocale / pilotMode / featureFlags / dataRetentionDays / captureConsentRequired`
   - `/settings?tab=pilot`
   - `/diagnostics`
   - 核心产品界面支持 `zh-CN / en-US` 切换，包括 shell、工作台、机会、联系人、公司、会议、审批、收件箱、记忆、CRM-first 导入、capture、设置、诊断、分析与周报
10. Decision-first IA 第一轮模板页：

- 首页、机会页、审批页已经开始按 `Judgement / Action / Boundary / Evidence` 协议重组
- 页头和 reporting panel 会先说明 Helm 当前判断，再把动作和证据出口给出来
- 当前已形成 `Narrative Components Baseline Freeze`，可继续作为 founder demo、training、acceptance 和 delivery 的 Decision-first 页面模板基线
11. 主动汇报 / 主动协作第一轮：

- 首页已经能主动抬出 founder 决策请求
- 机会页已经能主动抬出 sales / delivery 协作窗口
- 审批页已经能主动抬出 worker draft → review request
- 当前仍默认以“建议、准备、升级”为主，不默认拥有高风险自动承诺或高风险自动发送权限
- 当前已形成一版可冻结的 Baseline Freeze，可继续作为 founder demo、training、acceptance 和 delivery 的主动经营中枢起点

### 部分可用

1. Gmail 真实只读连接
   - 依赖 Google OAuth 环境变量
   - 未配置时会回退到本地示例数据
   - 当前已经把“接入后第一眼价值”前置到首页、收件箱和导入结果页，但对象绑定仍以启发式规则为主
2. LLM 增强链路
   - 依赖 `OPENAI_API_KEY`
   - 未配置时回退到规则链
3. Conversation Capture
   - 已有浏览器录音 MVP、非实时转写和会话处理链
   - 已支持单 provider ASR
   - capture 结果页已能展示 transcript 之后真正写回的记忆、动作、审批和 recommendation 影响
   - 已支持外部 transcript ingest，并复用同一条理解与写回链
   - 但不是实时音频录制 / 实时转写产品
   - 当前 speaker 分离仍是启发式，不应被视为真实 diarization
4. Evolution 第二阶段
   - 已有 suggestion 采纳与部分收敛
   - 但 pattern 覆盖仍有限
5. 多语言版本
   - 当前不是“所有业务原始内容都会被自动翻译”的版本
   - 当前已覆盖核心产品前台与主要试点路径：
     - shell 与公共入口
     - `/dashboard`
     - `/opportunities`
     - `/contacts/[id]`
     - `/companies/[id]`
     - `/meetings/[id]`
     - `/approvals`
     - `/inbox`
     - `/memory`
     - `/imports`、`/imports/crm`、`/imports/conflicts`、`/imports/jobs/[id]`
     - `/capture`
     - `/settings`
     - `/diagnostics`
     - `/analytics`
     - `/reports`
6. Decision-first IA
   - 当前已经有统一 reporting protocol 和 3 个代表页模板
   - 但还不是全站完成重构
   - 联系人、公司、会议、收件箱、记忆、报表等页面仍属于下一轮继续收口范围
   - 当前 proposal / package detail 也已经进入第一轮 decision-first 模板化，但仍是基于 existing opportunity commercial context 的 detail 模板，不是 canonical Proposal / Package platform
   - 当前 customer-facing offer / external proposal detail 也已经进入第一轮 decision-first 模板化，但仍是基于 existing opportunity commercial context 的外部表达 detail 模板，不是完整 offer platform、external proposal generator 或 legal / contract engine
   - 当前 `customer-facing package variants / commitment reinforcement variants detail` 也已经进入第一轮 decision-first 模板化，但它仍是基于 existing opportunity commercial context 的 variants judgement 页，不是完整 package engine、offer platform 或 strengthening orchestration 平台
   - 当前 `customer-facing package variants / commitment reinforcement variants detail` 也已经形成一版 `Variants Baseline Freeze`，可继续作为 founder demo、training、acceptance 和 delivery 的复用模板，但这仍不等于完整 variants system
   - 当前 `unified detail navigation / cross-detail handoff` 也已经进入第一轮落地，能把 proposal / package / offer / reinforcement / variants 串成连续 detail chain，但它仍不是 graph navigation platform、workflow engine 或 orchestration 平台
   - 当前 `Unified Detail Navigation Baseline Freeze` 也已经形成，可继续作为 founder demo、training、acceptance、delivery 和下一阶段 detail chain 扩展的复用基线，但这仍不等于完整 orchestration / process engine
   - 当前 `package stage variants / commercial narrative strengthening detail` 也已经进入第一轮 decision-first 模板化，但它仍是基于 existing opportunity commercial context 的 stage / strengthening judgement 页，不是完整 package engine、commercial engine、contract engine 或 legal review 平台
   - 当前 `package stage variants / commercial narrative strengthening detail` 也已经形成一版 `Stage / Strengthening Baseline Freeze`，可继续作为 founder demo、training、acceptance 和 delivery 的复用模板，但这仍不等于完整 stage system、strengthening engine 或 contract engine
   - 当前 `conversation / external narrative detail` 也已经进入第一轮 judgement-first 模板化，并接入现有商业推进 detail chain，但它仍是基于 existing opportunity commercial context 的沟通 / 对外叙事 judgement 页，不是完整 messaging platform、sales enablement 平台或 commercial conversation engine
   - 当前 `Conversation / External Narrative Detail Chain Baseline Freeze` 也已经形成，可继续作为 founder demo、training、acceptance、delivery 和下一阶段沟通相关 detail 页扩展的复用基线，但这仍不等于完整 messaging platform、sales enablement 平台或 commercial conversation engine
   - 当前 `founder / sales / delivery conversation 详情页` 也已经进入第一轮 judgement-first 模板化，并接入现有商业推进 detail chain，但它仍是基于 existing opportunity commercial context 的角色化沟通 judgement 页，不是完整 messaging platform、sales enablement / delivery enablement 平台或 commercial conversation engine
   - 当前 `founder Q&A detail` 也已经进入第一轮 judgement-first 模板化，并接入 proposal / reinforcement / founder conversation / external narrative 链，但它仍是基于 existing opportunity commercial context 的 founder 高价值问答 judgement 页，不是完整 founder enablement 平台、messaging platform 或 commercial conversation engine
   - 当前 `sales objection / follow-up detail` 也已经进入第一轮 judgement-first 模板化，并接入 package / offer / proposal / conversation / external narrative 链，但它仍是基于 existing opportunity commercial context 的 sales 细分沟通 judgement 页，不是完整 sales enablement 平台、CRM 平台或 commercial conversation engine
   - 当前 `delivery walkthrough / review detail` 也已经进入第一轮 judgement-first 模板化，并接入 package / proposal / package stage / delivery conversation / sendability 链，但它仍是基于 existing opportunity commercial context 的 delivery 细分沟通 judgement 页，不是完整 delivery enablement 平台、ops 平台或 commercial conversation engine
   - 当前 `external narrative fallback detail` 也已经进入第一轮 judgement-first 模板化，并接入 external narrative / reinforcement / sendability / conversation 链，但它仍是基于 existing opportunity commercial context 的 narrative 回退 judgement 页，不是完整 messaging platform、sales enablement 平台或 commercial conversation engine
   - 当前 `conversation detail chain extension` 也已经把 contacts / companies / meetings 接入 unified conversation chain，但它仍只是 judgement-first chain frame + 既有对象页组合，不是完整 CRM、communications graph 或 workflow engine
   - 当前 `inbox / follow-up / review request detail chain` 也已经把消息线程、跟进草稿和 review 请求接入 unified conversation chain，但它仍只是 judgement-first chain frame + 既有 list/detail 组合，不是完整 inbox / messaging platform、email client、review workflow engine 或 notifications center
   - 当前 `customer success handoff surface` 也已经把 review request、company detail、success check、expansion review 串成 dedicated success handoff 链，但它仍只是第一轮 judgement-first 接手面，不是完整 customer success platform、CRM / CS ops 平台或 workflow engine
   - 当前 `Customer Success Handoff Surface Baseline Freeze` 也已经形成，并在 v1.1 中继续补上 acceptance-grade source of truth、`issue / escalation` 区分以及 derived `success queue / success inbox` 薄接入；但这仍不等于完整 customer success platform、CRM / CS ops 平台或 workflow engine
   - 当前 customer success 的 delivery / training / acceptance 讲法也必须继续停在 `judgement / reason / evidence summary / boundary / decision posture / decision request / next action / risk / non-commitment` 这一层；其中 `success queue / success inbox` 只是一层 derived operational surface，用于 visibility / triage / routing cue，不是 canonical queue、workflow engine 或 prioritization engine
7. 主动汇报 / 主动协作
   - 当前已经有 active reporting / collaboration 的第一轮代表链路
   - 当前已建立 baseline freeze，但还不是完整 notification center、workflow engine 或自动执行平面
   - 但还不是完整自动执行平面
   - 仍以 internal preparation、decision request、review / escalation 为主

### 文档预留，当前代码未实现

以下接口目前仍应视为“文档预留”：

1. `/api/commitments/overdue`
2. `/api/briefings/contact/:contactId`
3. `/api/briefings/company/:companyId`
4. `/api/briefings/opportunity/:opportunityId`
5. `/api/briefings/snapshots`
6. `/api/recommendations/contact/:contactId`
7. `/api/memory/search`
8. `/api/memory/facts/:id/corrections`

当前实现请以 `app/api/` 目录为准。

---

## 三、环境与运行边界

### 本地最小运行

只需要：

1. `DATABASE_URL`
2. `npm install`
3. `npm run db:migrate`
4. `npm run db:seed`
5. `npm run dev`

### 真实链路附加条件

#### Gmail 只读连接

需要：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APP_URL`
- 可选 `GOOGLE_REDIRECT_URI`
- 可选 `CONNECTOR_TOKEN_SECRET`

#### CRM-first 迁移

需要：

- `HUBSPOT_CLIENT_ID`
- `HUBSPOT_CLIENT_SECRET`
- 可选 `HUBSPOT_REDIRECT_URI`
- `SALESFORCE_CLIENT_ID`
- `SALESFORCE_CLIENT_SECRET`
- 可选 `SALESFORCE_REDIRECT_URI`
- 可选 `SALESFORCE_AUTH_BASE_URL`
- 可选 `SALESFORCE_API_VERSION`
- `CONNECTOR_TOKEN_SECRET`

当前边界：

- 已实现：
  - HubSpot OAuth 入口
  - Salesforce Connected App OAuth 入口
  - 首次导入与增量同步骨架
  - `ImportSource / ImportJob / ImportItem / IdentityMatch`
  - 导入后 warmup
  - 冲突处理页
- 未实现：
  - 双向同步
  - 全对象覆盖
  - 独立 status API
  - 生产级后台任务队列

#### LLM 增强

需要：

- `OPENAI_API_KEY`
- 可选 `LLM_*` 路由配置

当前边界：

- 已实现：
  - `OpenAI compatible` provider
  - `promptKey / promptVersion`
  - `modelRole / budgetTier`
  - `LLMCallLog`
  - `/api/llm/logs`
  - 回退原因记录：
    - `llm_disabled`
    - `provider_not_configured`
    - `provider_error`
- 未实现：
  - 多 provider 生产级切换
  - prompt 在线配置
  - LLM 直接控制 recommendation 排序或审批边界

#### Conversation Capture 真实 ASR

需要：

- `OPENAI_API_KEY`
- 可选 `ASR_ENABLED`
- 可选 `ASR_OPENAI_MODEL`
- 可选 `ASR_LANGUAGE`

### 当前数据库边界

- 本地初始化脚本会创建和使用：`dev.db`
- 因此环境模板里的默认 `DATABASE_URL` 也应指向：`file:./dev.db`

---

## 四、试点前判断

当前项目适合：

1. 小范围设计合作伙伴试点
2. 受控 demo
3. 人工验收与真实数据小样本试跑

当前项目不应被表述为：

1. 已完成生产级 LLM 工作流平台
2. 已完成实时录音转写系统
3. 已完成全量 recommendation 自动学习系统
4. 已完成多租户企业级部署产品

---

## 五、配套材料

继续试点前收口时，请配合阅读：

1. [pre-pilot-checklist.md](pre-pilot-checklist.md)
2. [manual-acceptance-paths.md](manual-acceptance-paths.md)
3. [minimal-evals.md](minimal-evals.md)

补充：

- 当前 `commitment reinforcement / sendability detail` 已经有第一轮 decision-first 页面模板，但它仍然只是 controlled-trial 下的 strengthening / send gate 判断页，不等于 contract engine、legal review 平台或自动外发平面。
