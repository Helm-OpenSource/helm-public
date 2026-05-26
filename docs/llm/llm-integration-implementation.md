---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# LLM Integration 实施方案

## 文档目的

本文件用于指导“经营分身控制台”LLM Integration 第一阶段到第二阶段的工程实现。

目标有六个：

1. 建立统一的模型接入层，而不是在业务代码里直接接某个 SDK
2. 让大模型能力围绕产品的真实对象和真实流程工作
3. 让 meeting import、briefing、recommendation explanation 先跑起来
4. 让工具调用、审批、审计、记忆、推荐形成一致的控制面
5. 让后续接 OpenAI、阿里云 Qwen、Claude 等不同模型时，业务层改动最小
6. 让失败可回退、行为可观测、质量可评估

本文覆盖：
1. 实现范围
2. 目录结构
3. 数据模型
4. 模型网关实现
5. 上下文构建器实现
6. 工具总线实现
7. 工作流实现
8. API 设计
9. 页面联动
10. 日志与指标
11. Codex 实施指令
12. 验收路径

---

## 一、实现范围

### 第一阶段必须完成

1. 模型网关基础层
2. 一个 provider 先跑通
3. taskType 路由
4. prompt version 机制
5. 上下文构建器
6. meeting import → 结构化提取
7. briefing generation
8. recommendation explanation 增强
9. LLMCallLog
10. 页面最小联动

### 第二阶段建议完成

1. 工具总线最小版
2. 多 provider 适配预留
3. provider fallback
4. 更完整的观测指标
5. 更细的 workspace 级模型配置

### 当前明确不做

1. 多 provider 全量接入
2. 真实外部动作自动执行
3. 复杂 agent 协作编排
4. 模型自动训练
5. 模型直接改写核心业务状态
6. 黑盒自学习决策

---

## 二、建议目录结构

建议新增以下目录：

```text
lib/llm/
  types.ts
  provider-registry.ts
  model-router.ts
  prompt-registry.ts
  openai-adapter.ts
  qwen-adapter.ts
  anthropic-adapter.ts

lib/context/
  build-contact-context.ts
  build-company-context.ts
  build-opportunity-context.ts
  build-meeting-context.ts
  build-approval-context.ts

lib/tools/
  tool-registry.ts
  tool-executor.ts
  read-tools.ts
  write-tools.ts
  draft-tools.ts
  execute-tools.ts

lib/llm-workflows/
  process-meeting-memory.workflow.ts
  generate-briefing.workflow.ts
  enhance-recommendation-explanation.workflow.ts

lib/observability/
  llm-call-log.service.ts
  llm-metrics.service.ts
```

如果项目已经有 `lib/memory`、`lib/recommendations`，则应尽量复用，不要重复造中间层。

---

## 三、数据模型

## 3.1 LLMCallLog

必须新增一张表来记录模型调用。

### 作用
1. 跟踪每次模型调用
2. 统计 token、耗时、成功率
3. 回溯 prompt 版本和任务类型
4. 支撑错误定位和成本分析

### 建议字段

- id
- workspaceId
- userId
- provider
- model
- taskType
- promptVersion
- inputSummary
- outputSummary
- tokenUsagePrompt
- tokenUsageCompletion
- latencyMs
- success
- errorMessage
- createdAt

### Prisma 草稿

```prisma
model LLMCallLog {
  id                   String   @id @default(cuid())
  workspaceId          String
  userId               String?
  provider             String
  model                String
  taskType             String
  promptVersion        String
  inputSummary         String?
  outputSummary        String?
  tokenUsagePrompt     Int?
  tokenUsageCompletion Int?
  latencyMs            Int?
  success              Boolean  @default(true)
  errorMessage         String?
  createdAt            DateTime @default(now())

  workspace            Workspace @relation(fields: [workspaceId], references: [id])
  user                 User?     @relation(fields: [userId], references: [id])

  @@index([workspaceId, taskType])
  @@index([workspaceId, provider, model])
  @@index([workspaceId, createdAt])
}
```

## 3.2 Workspace 模型配置增强

如果已有 workspace settings，可增加字段；如果没有，可新建配置表。

### 建议字段
- defaultLLMProvider
- defaultLLMModel
- extractionModel
- briefingModel
- reasoningModel
- visualModel
- llmBudgetTier
- llmEnabled

这些字段不要求首轮全部在 UI 配置，先在 seed / env / mock config 里跑起来即可。

---

## 四、模型网关实现

## 4.1 `lib/llm/types.ts`

定义统一输入输出。

建议包含：

```ts
export type LLMTaskType =
  | "MEETING_FACT_EXTRACTION"
  | "MEETING_COMMITMENT_EXTRACTION"
  | "MEETING_BLOCKER_EXTRACTION"
  | "CONTACT_BRIEFING"
  | "COMPANY_BRIEFING"
  | "OPPORTUNITY_BRIEFING"
  | "MEETING_BRIEFING"
  | "RECOMMENDATION_EXPLANATION";

export type StructuredTaskInput = {
  taskType: LLMTaskType;
  workspaceId: string;
  userId?: string;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: Record<string, unknown>;
};

export type SummaryTaskInput = {
  taskType: LLMTaskType;
  workspaceId: string;
  userId?: string;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
};

export type LLMCallResult<T = unknown> = {
  provider: string;
  model: string;
  taskType: LLMTaskType;
  promptVersion: string;
  output: T;
  tokenUsagePrompt?: number;
  tokenUsageCompletion?: number;
  latencyMs?: number;
};
```

## 4.2 `lib/llm/openai-adapter.ts`

### 第一阶段要求
1. 先接一个 provider
2. 支持结构化输出
3. 支持普通文本输出
4. 支持记录 token 和 latency
5. 失败时抛出统一错误

建议暴露：
- `generateStructured`
- `summarizeContext`
- `generateExplanation`

不要求首轮就把所有 Responses API 细节封装到很完美，但必须做统一接口。

## 4.3 `lib/llm/provider-registry.ts`

### 作用
维护 provider 实例。

例如：
```ts
export const providerRegistry = {
  get(providerName: string): LLMProvider {
    // return provider adapter
  }
};
```

## 4.4 `lib/llm/model-router.ts`

### 作用
根据 taskType 返回 provider 和 model。

建议第一阶段先写成显式规则：

- MEETING_FACT_EXTRACTION → extraction model
- CONTACT_BRIEFING / COMPANY_BRIEFING / OPPORTUNITY_BRIEFING / MEETING_BRIEFING → briefing model
- RECOMMENDATION_EXPLANATION → reasoning model

不要一开始搞复杂配置中心。

## 4.5 `lib/llm/prompt-registry.ts`

### 作用
统一管理 prompt 版本。

要求：
1. prompt 不能散在页面里
2. 每个 taskType 至少有一个 version
3. log 要能看到 promptVersion

建议结构：
```ts
export const promptRegistry = {
  MEETING_FACT_EXTRACTION: {
    version: "meeting_fact_extraction_v1",
    system: "...",
    userTemplate: "..."
  }
};
```

---

## 五、上下文构建器实现

## 5.1 目标

上下文构建器的作用，是让模型看到“真正重要的上下文”，而不是大量原始数据。

## 5.2 `buildContactContext(contactId)`

最少返回：
- contact 基础信息
- relationshipStage
- relationshipTemperature
- lastInteractionAt
- 关键 MemoryFacts
- open Commitments
- active Blockers
- 最近会议摘要
- 最近邮件摘要
- policyContext
- preferenceContext

## 5.3 `buildCompanyContext(companyId)`

最少返回：
- maturityScore
- 关键联系人
- 当前活跃机会
- 高优先 blocker
- open Commitments
- 最近 30 天关键记忆

## 5.4 `buildOpportunityContext(opportunityId)`

最少返回：
- 当前阶段
- riskLevel
- lastProgressAt
- nextStepSummary
- relevant contacts
- open Commitments
- active Blockers
- recent Meetings
- recent EmailThreads
- policyContext
- preferenceContext

## 5.5 `buildMeetingContext(meetingId)`

最少返回：
- meeting title / time / participants
- related opportunity
- recent facts
- open commitments
- active blockers
- meeting note text
- policyContext

## 5.6 `buildApprovalContext(approvalTaskId)`，可选
如果时间允许，加上：
- recommendation
- supporting facts
- policy result
- target object context

---

## 六、工具总线实现

第一阶段只做最小工具总线，先给模型提供“读”和“内部写”能力，不接真实外部发送。

## 6.1 `tool-registry.ts`
注册工具元信息：
- toolName
- description
- inputSchema
- riskLevel
- requiresPolicyCheck

## 6.2 `tool-executor.ts`
统一执行：
1. 参数校验
2. 策略检查
3. 执行
4. 审计
5. 返回结果

## 6.3 第一阶段工具清单

### 读工具
- get_contact_profile
- get_company_summary
- get_opportunity_context
- get_meeting_context
- get_open_commitments
- get_active_blockers

### 写工具
- create_memory_fact
- create_commitment
- create_blocker
- create_briefing_snapshot
- write_audit_log

### 草稿工具
- draft_followup_email
- draft_internal_summary

第一阶段不做：
- send_email
- write_calendar
- external write actions

---

## 七、工作流实现

## 7.1 meeting import → memory generation

新增：
- `lib/llm-workflows/process-meeting-memory.workflow.ts`

### 输入
- meetingId

### 输出
- extracted facts
- extracted commitments
- extracted blockers
- optional candidate actions

### 流程
1. buildMeetingContext(meetingId)
2. 调用 `generateStructured()` 处理 facts
3. 调用 `generateStructured()` 处理 commitments
4. 调用 `generateStructured()` 处理 blockers
5. 写入 MemoryFact / Commitment / Blocker
6. 写 AuditLog / EventLog
7. 返回摘要结果给页面

### 要求
- 每一步失败要尽量局部回退，不要整条链爆掉
- facts、commitments、blockers 可以分别成功或失败
- 页面能看到处理状态

## 7.2 briefing generation

新增：
- `lib/llm-workflows/generate-briefing.workflow.ts`

### 支持对象
- contact
- company
- opportunity
- meeting

### 流程
1. 调用对应 context builder
2. 调用 `summarizeContext()`
3. 生成结构化 briefing payload
4. 写入 BriefingSnapshot
5. 写 AuditLog / EventLog
6. 返回页面可展示内容

## 7.3 recommendation explanation 增强

新增：
- `lib/llm-workflows/enhance-recommendation-explanation.workflow.ts`

### 输入
- recommendationId 或 recommendation payload
- supporting facts
- commitments
- blockers
- policy result

### 输出
- explanation
- concise explanation for UI
- optional alternative action phrasing

### 关键原则
- 不改 recommendation 的排序结果
- 不改 policyResult
- 只增强 explanation 和表达质量

---

## 八、API 设计

## 8.1 模型工作流接口

### 处理会议记忆
`POST /api/llm/meetings/:meetingId/process-memory`

返回：
- processedFacts
- processedCommitments
- processedBlockers
- warnings

### 生成 briefing
`POST /api/llm/briefings/:objectType/:objectId`

返回：
- summary
- recent facts
- commitments
- blockers
- recommended questions
- recommended next steps

### 生成 recommendation explanation
`POST /api/llm/recommendations/:recommendationId/explain`

返回：
- explanation
- shortExplanation
- generatedAt

## 8.2 可观测接口，可选
如果时间允许，可新增：
`GET /api/llm/logs?days=7`

当前代码已实现只读日志接口，可按时间窗口查看：

- provider
- model / modelVersion
- taskType
- promptKey / promptVersion
- modelRole
- fallbackReason
- latency / token usage

首轮不要求 UI 消费，但数据结构先打通。

---

## 九、页面联动

## 9.1 Meeting 页面
必须增强：
1. 增加“处理会议记忆”入口
2. 展示提取出来的 facts / commitments / blockers
3. 展示处理状态
4. 展示 LLM 增强的 briefing

## 9.2 Contact 页面
增强：
1. 展示 LLM 生成的联系人摘要
2. recommendation explanation 更自然
3. supporting facts 更清楚

## 9.3 Company 页面
增强：
1. 展示公司摘要
2. 显示关键 blocker / commitments 摘要

## 9.4 Opportunity 页面
增强：
1. recommendation explanation 更自然
2. ability to reference LLM briefing / memory summary

## 9.5 首页 today focus
增强：
1. 让 top items 的 explanation 更有经营语言感
2. 不改变排序逻辑，只增强表述

---

## 十、日志与指标

## 10.1 LLMCallLog service
新增：
- `lib/observability/llm-call-log.service.ts`

职责：
1. 写调用日志
2. 统一成功 / 失败记录
3. 封装 latency 和 token usage

## 10.2 需要记录的 taskType
至少包括：
- MEETING_FACT_EXTRACTION
- MEETING_COMMITMENT_EXTRACTION
- MEETING_BLOCKER_EXTRACTION
- CONTACT_BRIEFING
- COMPANY_BRIEFING
- OPPORTUNITY_BRIEFING
- MEETING_BRIEFING
- RECOMMENDATION_EXPLANATION

## 10.3 README 中必须说明
1. 如何配置 provider key
2. 如何启用 LLM integration
3. 哪些 task 已接 LLM
4. 哪些仍是 mock / deterministic

---

## 十一、环境变量建议

第一阶段至少预留：

```bash
OPENAI_API_KEY=
LLM_DEFAULT_PROVIDER=openai
LLM_DEFAULT_MODEL=
LLM_EXTRACTION_MODEL=
LLM_BRIEFING_MODEL=
LLM_REASONING_MODEL=
LLM_ENABLED=true
```

如果后续接阿里云兼容接口，再补：
```bash
LLM_BASE_URL=
```

---

## 十二、Codex 直接实施指令

下面这段可以直接贴给 Codex。

```text
现在开始实现“经营分身控制台”的 LLM Integration 第一阶段。

目标：
构建一个可扩展、可替换、支持多 provider 的 LLM 接入架构，并先打通三条最关键的智能链路：
1. 会议导入 → 结构化提取
2. briefing generation
3. recommendation explanation 增强

先不要直接开工。
请先阅读：
- AGENTS.md
- docs/README.md
- docs/product/product-principles.md
- docs/product/roadmap.md
- docs/memory-system/implementation.md
- docs/recommendation-engine/implementation.md
- docs/recommendation-engine/stage2-design.md
- docs/llm/llm-integration-architecture.md，如果仓库里已有

然后先输出《LLM Integration 第一阶段实施计划》，按 P0、P1、P2 排优先级。
计划里必须写清：
1. 新增哪些目录与模块
2. 新增哪些 Prisma 模型
3. 新增哪些服务
4. 新增哪些 API
5. 哪些页面会增强
6. 哪些能力明确本轮不做
7. 如何验证

输出计划后再开始编码。
编码前创建 Git checkpoint。
编码后创建 Git checkpoint。

本轮必须完成：

一、数据模型
新增 LLMCallLog，并完成 migration 与 seed 兼容。

二、目录与基础模块
新增：
- lib/llm/types.ts
- lib/llm/provider-registry.ts
- lib/llm/model-router.ts
- lib/llm/prompt-registry.ts
- lib/llm/openai-adapter.ts
- lib/context/build-contact-context.ts
- lib/context/build-company-context.ts
- lib/context/build-opportunity-context.ts
- lib/context/build-meeting-context.ts
- lib/tools/tool-registry.ts
- lib/tools/tool-executor.ts
- lib/observability/llm-call-log.service.ts
- lib/llm-workflows/process-meeting-memory.workflow.ts
- lib/llm-workflows/generate-briefing.workflow.ts
- lib/llm-workflows/enhance-recommendation-explanation.workflow.ts

三、工作流
必须打通：
1. meeting import → 结构化提取 → 写入 MemoryFact / Commitment / Blocker
2. briefing generation → 写入 BriefingSnapshot
3. recommendation explanation 增强 → 不改变排序，只增强 explanation

四、API
至少新增：
1. POST /api/llm/meetings/:meetingId/process-memory
2. POST /api/llm/briefings/:objectType/:objectId
3. POST /api/llm/recommendations/:recommendationId/explain

五、页面增强
增强以下页面：
1. Meeting 页面
2. Contact 页面
3. Company 页面
4. Opportunity 页面
5. 首页 today focus 的 explanation 区

六、日志与可观测
必须记录：
1. provider
2. model
3. taskType
4. promptVersion
5. token usage
6. latency
7. success / failure
8. error message

七、约束
1. 业务层不能直接调用具体 provider SDK
2. recommendation 排序逻辑不能被模型接管
3. 高风险动作不能让模型直接执行
4. 失败必须 fallback，不影响主流程
5. 页面不能因为模型失败而空白

八、验收路径
至少验证：
1. 处理一场会议，成功生成结构化记忆
2. 生成联系人 briefing
3. 生成会议 briefing
4. recommendation explanation 增强可见
5. 产生 LLMCallLog
6. 模拟 provider 失败时主流程仍可用
7. README 增加 LLM Integration 说明

如果必须取舍，优先级如下：
1. LLMCallLog
2. provider interface
3. context builders
4. meeting import extraction
5. briefing generation
6. recommendation explanation
7. tool registry skeleton
```

---

## 十三、验收路径

至少手动验证以下 7 条：

### 路径 A
处理一场会议 → 生成 facts / commitments / blockers → 写日志

### 路径 B
打开会议页 → 生成 briefing → 页面可见

### 路径 C
打开联系人页 → 生成联系人摘要 → 页面可见

### 路径 D
打开机会页 → explanation 增强 → 页面可见

### 路径 E
首页 today focus explanation 变得更自然

### 路径 F
查看 LLMCallLog → 能看到 taskType / provider / latency / token

### 路径 G
模拟 provider 异常 → 页面和业务流程仍可用

---

## 十四、README 与 docs 更新

本轮必须更新：
1. 根目录 README
2. docs/README.md，若已存在 llm 文档目录则加索引
3. 说明：
   - LLM Integration 是什么
   - 目前支持哪些 task
   - 环境变量怎么配
   - 失败 fallback 怎么工作
   - 如何演示

---

## 十五、最终判断

这轮做完后，产品就会从“有推荐和记忆的产品”进入“真正开始具备模型增强能力的产品”。

重点不在于：
- 多接几个模型
- 做更多花哨生成

重点在于：
1. 模型能力被放在正确架构位置
2. 会议、briefing、recommendation explanation 三条链真正变强
3. 失败可回退
4. 后续扩展不会推翻已有产品结构
