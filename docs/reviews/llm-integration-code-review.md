---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# llm_integration_architecture.md

## 文档目的

本文件用于定义“经营分身控制台”的 LLM 接入架构与实施路径。

目标有五个：

1. 让产品真正接入大模型后变得更智能
2. 让智能能力围绕产品结构化对象和真实工作流展开
3. 让模型接入具备可替换性，不被单一 provider 锁死
4. 让工具调用、审批、审计、记忆、推荐形成统一架构
5. 让后续接阿里云、OpenAI、Qwen、Claude 等不同模型时，业务层基本不动

本文重点不是“选哪个模型更强”，而是“如何把模型能力变成可控、可扩展、可观测的产品能力”。

---

## 一、总原则

### 1. 产品能力优先，模型能力嵌入其中
经营分身控制台的核心价值不是“会聊天”，而是：

1. 理解经营上下文
2. 形成下一步判断
3. 在规则内推动事情
4. 记住并持续优化判断

因此，模型只是能力层，不是产品主角。

### 2. 结构化记忆优先于超长上下文
不要直接把大量原始事件无脑塞给模型。
应该先通过记忆系统把事实、承诺、阻碍、偏好整理好，再按任务构造上下文包。

### 3. 模型接入必须支持多 provider
业务层不能直接依赖某家 SDK。
必须通过统一模型网关来调用不同 provider。

### 4. 工具调用必须走产品自己的工具总线
模型不能直接访问数据库或外部系统。
必须通过明确的工具接口和策略规则执行动作。

### 5. recommendation 以规则排序为主，模型推理为增强
排序、策略、审批、风险判断，应尽量由产品自身逻辑控制。
模型主要负责：
1. 抽取
2. 归纳
3. 解释
4. 备选动作生成

### 6. 所有模型行为必须可观测
模型调用、工具调用、审批、自动执行、失败原因、用户反馈，都必须可追踪。

---

## 二、总体架构

推荐整体分成六层。

### 第一层：应用层
也就是你们现有产品前台，包括：

1. 今日工作台
2. 机会面板
3. 联系人页
4. 公司页
5. 会议页
6. 审批中心
7. 记忆与时间线页
8. 设置与策略中心

应用层只表达用户意图，不直接做复杂模型逻辑。

### 第二层：业务编排层
这一层负责把页面动作转成工作流。

主要职责：
1. 构建任务上下文
2. 决定走哪个智能能力
3. 决定是否调用工具
4. 决定是否需要审批
5. 决定是否写入记忆、审计和反馈

建议模块：
- orchestration/
- workflows/
- use-cases/

### 第三层：模型网关层
这一层统一接模型 provider。

职责：
1. 统一调用接口
2. 按任务路由不同模型
3. 做 provider fallback
4. 控制 prompt 版本
5. 控制结构化输出

建议模块：
- lib/llm/provider-registry.ts
- lib/llm/openai-adapter.ts
- lib/llm/qwen-adapter.ts
- lib/llm/anthropic-adapter.ts
- lib/llm/model-router.ts

### 第四层：工具总线层
这一层是 AI 的真实执行能力。

职责：
1. 暴露可调用工具
2. 控制工具权限
3. 记录工具调用
4. 对接策略与审批

建议模块：
- lib/tools/
- lib/tool-registry.ts
- lib/tool-executor.ts

### 第五层：记忆与推荐层
这一层是你们的护城河。

职责：
1. 召回对象记忆
2. 生成 briefing
3. 生成 recommendation 候选
4. 排序与解释
5. 写入反馈

建议模块：
- lib/memory/
- lib/recommendations/

### 第六层：审计与观测层
职责：
1. AuditLog
2. EventLog
3. 模型调用日志
4. 工具调用日志
5. recommendation 反馈和结果分析

---

## 三、建议拆分的智能能力面

建议把产品中的 LLM 能力分成五个能力面。

## 1. Extraction 面
负责把非结构化输入转成结构化对象。

输入：
- 会议纪要
- 邮件线程
- 导入 CSV
- 审批编辑结果

输出：
- MemoryFacts
- Commitments
- Blockers
- ActionItems
- Briefing inputs

典型任务：
- 提取承诺
- 提取阻碍
- 提取下一步动作
- 提取偏好和风险信号

推荐特点：
- 低延迟
- 强结构化输出
- 可用较便宜模型

## 2. Briefing 面
负责生成会前 briefing、联系人摘要、公司摘要、机会摘要。

输入：
- 对象状态
- 相关 MemoryFacts
- Commitments
- Blockers
- 最近会议和邮件

输出：
- BriefingSnapshot
- 页面可展示摘要

推荐特点：
- 可模板化
- 可缓存
- 要求语言自然、信息高密度

## 3. Reasoning 面
负责判断和 recommendation explanation。

输入：
- 结构化记忆
- 候选动作
- 当前策略
- 用户偏好
- 当前对象状态

输出：
- next best actions
- explanation
- alternative actions
- risk reasoning

推荐特点：
- 推理能力更强
- 不追求全自动
- 必须可解释

## 4. Action 面
负责在工具总线内执行动作。

输入：
- 已批准 recommendation
- 自动执行候选
- Tool schema
- Policy result

输出：
- 实际动作结果
- AuditLog
- RecommendationFeedback
- ActionItem / ApprovalTask 更新

推荐特点：
- 不要求模型自由发挥
- 高度可控
- 必须强审计

## 5. Learning 面
负责把反馈回写成长期优化信号。

输入：
- 批准
- 拒绝
- 编辑后批准
- 自动执行成败
- recommendation 结果

输出：
- PreferenceSignal
- RecommendationLog 更新
- 后续排序参考信号

---

## 四、模型网关设计

## 4.1 设计目标

模型网关要让业务层只关心“我要什么能力”，而不关心“底层用哪个模型”。

建议统一暴露这几类方法：

1. `generateStructured()`
2. `summarizeContext()`
3. `reasonOnCandidates()`
4. `generateExplanation()`
5. `extractFromDocument()`

所有 provider 都通过统一接口实现。

## 4.2 接口建议

```ts
export interface LLMProvider {
  generateStructured<T>(input: StructuredTaskInput): Promise<T>;
  summarizeContext(input: SummaryTaskInput): Promise<SummaryOutput>;
  reasonOnCandidates(input: ReasoningTaskInput): Promise<ReasoningOutput>;
  generateExplanation(input: ExplanationTaskInput): Promise<ExplanationOutput>;
}
```

## 4.3 Provider Registry

建议增加：

- `providerRegistry.get(providerName)`
- `modelRouter.pick(taskType, workspaceConfig, budgetPolicy)`

路由维度建议：
1. task type
2. cost tier
3. latency target
4. modality
5. provider availability

## 4.4 Model Router

建议按任务路由：

### A. Extraction
优先：
- 便宜、稳定、结构化输出强的模型

### B. Briefing
优先：
- 长上下文、摘要密度高的模型

### C. Reasoning / Recommendation explanation
优先：
- 推理能力强、稳定性好的模型

### D. Visual tasks
优先：
- 视觉模型

---

## 五、上下文构建器设计

这一层非常关键。不要把上下文拼接写在页面里或 service 零散逻辑里。

建议新增专门的 context builders：

1. `buildContactContext(contactId)`
2. `buildCompanyContext(companyId)`
3. `buildOpportunityContext(opportunityId)`
4. `buildMeetingContext(meetingId)`
5. `buildApprovalContext(approvalTaskId)`

每个 context builder 至少输出三块：

### A. 当前对象现状
例如：
- 联系人当前关系阶段
- 当前机会阶段
- 当前 blocker
- 当前 commitment

### B. 高价值记忆
只召回最重要的记忆，不要全量塞入。

例如：
- confirmed facts
- active blockers
- open commitments
- 最近关键会议摘要
- 最近关键邮件线程摘要

### C. 治理上下文
例如：
- 当前策略
- 用户偏好
- 审批边界
- 风险等级

建议统一返回：

```ts
type ObjectContext = {
  currentState: Record<string, unknown>;
  keyFacts: MemoryFact[];
  openCommitments: Commitment[];
  activeBlockers: Blocker[];
  recentEvents: TimelineEvent[];
  policyContext: PolicyContext;
  preferenceContext: PreferenceContext;
};
```

---

## 六、工具总线设计

模型不能直接碰数据库和外部系统。
必须通过产品的工具层。

## 6.1 工具分类

### A. 读工具
- get_contact_profile
- get_company_summary
- get_opportunity_context
- get_open_commitments
- get_active_blockers
- get_recent_email_threads
- get_recent_meetings
- get_policy_context

### B. 写工具
- create_memory_fact
- create_commitment
- create_blocker
- create_action_item
- create_approval_task
- update_opportunity_stage
- add_timeline_entry
- write_audit_log

### C. 草稿工具
- draft_followup_email
- draft_candidate_feedback
- draft_internal_summary
- draft_next_meeting_invite

### D. 执行工具
- execute_internal_summary_dispatch
- execute_schedule_creation
- execute_status_update

## 6.2 工具调用规则

1. 高风险写操作必须经过策略检查
2. 对外动作默认不允许直接执行
3. 工具调用必须带 actor、source、reason
4. 所有工具调用都写 AuditLog / EventLog
5. 工具 schema 必须清晰、可版本化

---

## 七、LLM 接入的工作流设计

## 7.1 会议导入工作流

输入：
- Meeting
- MeetingNote

流程：
1. buildMeetingContext
2. generateStructured 提取：
   - key facts
   - commitments
   - blockers
   - candidate actions
3. 写入 MemoryFact / Commitment / Blocker
4. summarizeContext 生成 briefing snapshot
5. 把 candidate actions 交给 recommendation engine

输出：
- 会议页展示
- 联系人 / 机会时间线更新
- recommendation 输入增强

## 7.2 首页 today focus 工作流

输入：
- 当前 workspace
- 所有活跃机会
- overdue commitments
- active blockers
- pending approvals

流程：
1. recommendation engine 做候选事项召回和排序
2. LLM 只做 explanation 和经营语言增强
3. 输出首页“今日最值得推进的 3 件事”

关键原则：
排序由产品逻辑主导，语言表达由模型增强。

## 7.3 审批中心工作流

输入：
- RecommendationLog
- supporting facts
- blockers
- commitments
- policy rules

流程：
1. generateExplanation
2. UI 展示 explanation
3. 用户批准 / 拒绝 / 编辑后批准
4. feedback 回写
5. 形成 PreferenceSignal

## 7.4 联系人页 / 公司页工作流

输入：
- ObjectContext

流程：
1. summarizeContext 生成摘要
2. reasonOnCandidates 生成 next best actions
3. explanation service 构造推荐解释链
4. 页面展示

---

## 八、推荐与大模型的职责边界

这一点要非常明确。

### recommendation engine 自己负责
1. 候选动作召回
2. urgency / impact / confidence / risk / policy scoring
3. today focus 排序
4. policy filtering
5. feedback 记录和闭环

### LLM 负责
1. 从文本中提取结构化信号
2. 生成摘要
3. 生成 explanation
4. 辅助生成 alternative actions
5. 在候选动作已有的情况下补充经营语言和细节

### 不建议让 LLM 直接负责
1. 全排序
2. 是否允许自动执行
3. 审批与策略结果
4. 最终状态变更
5. 真实系统写操作决策

---

## 九、配置与扩展设计

## 9.1 Workspace 级模型配置
建议允许每个 workspace 配：

1. 默认 provider
2. 默认模型
3. extraction 模型
4. reasoning 模型
5. visual 模型
6. 成本级别策略

## 9.2 Prompt 版本化
所有关键 prompt 必须版本化，例如：

- meeting_fact_extraction_v1
- meeting_fact_extraction_v2
- opportunity_briefing_v1
- contact_recommendation_explanation_v1

并记录在模型调用日志中。

## 9.3 工具 schema 版本化
例如：
- draft_followup_email@v1
- create_commitment@v1

后面升级不会破坏旧链路。

---

## 十、观测与日志设计

必须把模型接入后的行为纳入观测。

## 10.1 LLMCallLog
建议新增表：

字段至少包括：
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

## 10.2 必须记录的指标

### 模型调用指标
1. 每类 task 调用次数
2. token 消耗
3. 平均延迟
4. 失败率

### 业务指标
1. recommendation 批准率
2. 编辑后批准率
3. 被忽略率
4. 自动执行成功率
5. 记忆修正率
6. briefing 被查看率

### 质量指标
1. 会议导入后 facts 生成率
2. commitment 命中率
3. blocker 命中率
4. recommendation explanation 完整率

---

## 十一、推荐的工程目录

建议新增：

```text
lib/llm/
  provider-registry.ts
  model-router.ts
  types.ts
  openai-adapter.ts
  qwen-adapter.ts
  anthropic-adapter.ts
  prompt-registry.ts

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

lib/observability/
  llm-call-log.service.ts
  llm-metrics.service.ts
```

---

## 十二、实施顺序建议

我建议 Codex 按四轮推进。

### 第 1 轮
做模型网关基础层：
1. provider registry
2. model router
3. base adapter interface
4. openai-adapter 先跑通

### 第 2 轮
做上下文构建器：
1. contact
2. company
3. opportunity
4. meeting

### 第 3 轮
做智能工作流接入：
1. meeting import → extraction
2. briefing generation
3. recommendation explanation enhancement

### 第 4 轮
做观测与优化：
1. LLMCallLog
2. prompt versioning
3. metrics
4. provider fallback

---

## 十三、第一阶段最值得先接的模型能力

如果你问“最先应该把 LLM 接到哪里”，我建议顺序是：

1. meeting import → structured extraction
2. briefing generation
3. recommendation explanation
4. contact / opportunity summary
5. draft generation
6. 更复杂的 alternative action reasoning

不要一开始就接太多写操作。

---

## 十四、Codex 直接实施指令

下面这段可以直接贴给 Codex。

```text
现在开始为“经营分身控制台”实现 LLM 接入架构第一阶段。

目标：
构建一个可扩展、可替换、多 provider 兼容、支持工具总线与上下文构建器的 LLM integration layer。

先不要直接开工。
请先阅读：
- AGENTS.md
- docs/product/product-principles.md
- docs/product/roadmap.md
- docs/memory-system/implementation.md
- docs/recommendation-engine/implementation.md
- docs/recommendation-engine/stage2-design.md

然后输出《LLM Integration 第一阶段实施计划》，按 P0、P1、P2 排优先级。
计划中必须写清：
1. 新增哪些目录和模块
2. 哪些地方复用现有 memory / recommendation 逻辑
3. 哪些能力先不做
4. 如何验证

输出计划后再开始编码。
编码前创建 Git checkpoint。
编码后创建 Git checkpoint。

本轮必须完成：

一、模型网关层
新增：
- lib/llm/provider-registry.ts
- lib/llm/model-router.ts
- lib/llm/types.ts
- lib/llm/openai-adapter.ts
- lib/llm/prompt-registry.ts

要求：
1. 统一 provider 接口
2. 先支持一个 provider，接口设计支持扩展
3. 支持 taskType 路由
4. 支持 prompt version
5. 支持结构化输出

二、上下文构建器
新增：
- lib/context/build-contact-context.ts
- lib/context/build-company-context.ts
- lib/context/build-opportunity-context.ts
- lib/context/build-meeting-context.ts

要求：
1. 召回 MemoryFacts
2. 召回 Commitments
3. 召回 Blockers
4. 召回最近会议和邮件
5. 召回策略和偏好上下文

三、先接 3 条工作流
1. 会议导入 → 结构化提取
2. 会议 / 联系人 / 公司 / 机会 briefing 生成
3. recommendation explanation 增强

四、工具总线
先做最小版本：
- lib/tools/tool-registry.ts
- lib/tools/tool-executor.ts

只需支持内部读写工具，不接真实外部执行动作。

五、观测
新增：
- LLMCallLog 数据模型
- 模型调用记录服务

六、页面联动
增强：
- Meeting 页面
- Contact 页面
- Opportunity 页面
- 首页 today focus explanation

七、验收
至少验证：
1. meeting import 能调用 LLM 做结构化提取
2. briefing 可通过 LLM 生成
3. recommendation explanation 可通过 LLM 增强
4. 模型调用有日志
5. 失败不影响主流程
6. README 增加 LLM integration 说明

如果必须取舍，优先级如下：
1. provider interface
2. context builders
3. meeting import extraction
4. briefing generation
5. recommendation explanation
6. observability
```

---

## 十五、最终判断

如果你们按这套架构接 LLM，大模型带来的价值会体现在：

1. 结构化提取更准
2. briefing 更像一个真正懂上下文的助理
3. recommendation explanation 更可信
4. 产品扩展到更多模型和更多工具时，业务层改动最小
5. 后面接阿里云或其他 provider 时不会推翻现有产品结构

最关键的是，这样接法会让产品越来越像“经营分身控制层”，而不是“把几个模型能力硬塞进页面里的 SaaS”。
