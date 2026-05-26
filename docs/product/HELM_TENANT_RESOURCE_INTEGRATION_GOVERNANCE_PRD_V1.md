---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Tenant Resource Integration Governance PRD V1

更新时间：2026-04-25  
状态：Implementation baseline  
本轮范围：产品需求与治理边界，不进入代码实现、schema migration 或 connector platform 化

## 1. 结论

Helm 的租户资源接入不应被设计成“连接器越多越好”的平台能力，而应被设计成一条可治理的经营闭环：

```text
租户已有资源
  -> 资源目录与连接状态
  -> 业务对象映射与证据归属
  -> trust / promotion / capability 决策
  -> Helm 判断与建议
  -> 人工复核 / 手工执行 / guarded official write
  -> 回执 / follow-through / memory / report
```

核心目标不是“接入一堆系统”，而是让租户已有 CRM、ERP、垂直业务系统、知识库、IM、邮箱、会议、表格、自动化工具和 agent runtime 能被 Helm 看懂、纳入治理、用于判断、推进事情，并形成可复盘闭环。

## 2. 背景

当前 Helm 已有多条可复用基础：

- `imports / connectors / capture` 已能支持 CRM 导入、OAuth connector、meeting/capture ingest 和部分 read-only provider seam。
- Helm v2 已有 richer connector ingestion contract，区分 `source / trust / promotion / evidence / draft payload`。
- 多租户治理已覆盖 connector / import ingress、governed action、workspace ownership、capability-aware read-only posture。
- `Worker / Skill / Resource` 协议已明确资源层不拥有治理权，治理权留在 Helm Control Plane。
- `Solution Extension` 协议已明确 tenant custom extension 是租户定制资源与场景化对象的落点。
- `official write / follow-through` 已有 review-first、acknowledgment、reconciliation 和 `resolved != official success` 边界。

当前缺口是：这些能力仍分散在 connector、import、extension、runtime、settings 和 operating surfaces 中。租户无法一眼看清“我已有资源哪些接入了、哪些可信、哪些可用于 Helm 推进工作、哪些只能读、哪些需要复核、哪些能进入闭环”。

## 3. 目标

### 3.1 产品目标

建立一条“租户资源控制面”，让每个租户能：

1. 盘点自己已有资源。
2. 明确每个资源的连接状态、可用能力、可信度和数据新鲜度。
3. 把外部资源映射到 Helm 的业务对象、证据和动作链。
4. 明确 Helm 对每个资源能做什么、不能做什么、为什么。
5. 让 Helm 使用这些资源生成判断、建议、行动包、handoff 和 follow-through。
6. 在执行后拿到回执，并把结果写回 memory、report、对象状态和下一步动作。

### 3.2 经营目标

资源接入后，Helm 必须能帮助租户推进真实经营事情：

- 识别今天最该处理的客户、订单、案件、项目、代理、线索或风险。
- 基于已有系统证据解释为什么要处理。
- 给出下一步动作、责任人、风险边界和复核要求。
- 让低风险动作走 manual execution 或 draft-only，高风险动作进入 review-first / guarded official write。
- 形成回执、异常、follow-through、复盘和长期记忆。

### 3.3 成功标准

第一版成功不以 connector 数量衡量，而以闭环质量衡量：

- 资源接入后 10 分钟内能展示资源状态、缺口和下一步。
- 每条由资源触发的 Helm 建议都有 evidence ref、source posture 和 freshness。
- 高风险动作 100% 保留 review-first 或 manual execution fallback。
- 资源数据冲突、过期、低可信时，Helm 会降级为 draft-only / ask human / deny，而不是继续推进。
- 至少一条代表性资源链路能完成 `observe -> judge -> govern -> act -> verify -> learn`。

## 4. 非目标

第一版明确不做：

- 通用 connector marketplace
- 完整 workflow / orchestration engine
- broad auto-write
- send authority
- 自动替用户操作外部系统
- 把全部原始数据直接塞进模型或上下文
- schema-per-tenant / database-per-tenant
- full RBAC builder
- enterprise IAM / SSO / SCIM
- external agent runtime 的深耦合
- 把 Helm reserved tenant 商业结算逻辑混进普通客户资源接入

## 5. 用户与使用场景

### 5.1 租户 owner / admin

他们关心：

- 我们已有系统哪些已经接入 Helm？
- 哪些接入质量够用，哪些会影响判断？
- 哪些资源允许 Helm 读，哪些允许生成草稿，哪些允许进入人工执行或 guarded write？
- 权限、token、回执、审计在哪里看？

### 5.2 业务负责人 / operator

他们关心：

- 今天哪些工作应该先处理？
- Helm 的判断来自哪个系统证据？
- 这个建议能不能直接推进，还是必须先人工复核？
- 失败或冲突后下一步去哪里处理？

### 5.3 交付 / 集成顾问

他们关心：

- 租户资源如何快速登记、连通、映射和校验？
- 哪些字段缺失会阻断闭环？
- 哪些资源适合做 tenant custom extension？
- 怎么把行业系统接入后仍保留 Helm 的治理边界？

### 5.4 Helm 内部 operator

他们关心：

- 某个租户资源接入是否健康？
- 哪些 connector/import/extension 产生了异常？
- 哪些 capability decision 被降级或阻断？
- 是否出现跨租户数据、越权写入或证据缺失风险？

## 6. 产品原则

1. `Resource does not govern`：资源只提供数据或执行供给，治理权属于 Helm Control Plane。
2. `Read before write`：所有新资源默认先 read-only，写入能力必须单独评审。
3. `Evidence before action`：没有证据和来源姿态，不生成高风险行动。
4. `Trust is explicit`：可信度、promotion eligibility、freshness 和 sensitivity 必须可见。
5. `Review-first by default`：涉及外部承诺、客户可见、金钱、合同、状态变更、敏感数据的动作默认复核。
6. `Closed loop or no claim`：没有回执与 follow-through，不得宣称执行成功。
7. `Tenant ownership first`：普通租户资源归普通租户，不得落到 Helm reserved host。
8. `Extension before core expansion`：行业或客户专属对象先落 tenant custom extension，稳定后再抽 shared capability。

## 7. 资源分类

第一版资源目录至少支持以下分类：

| 资源类型 | 示例 | 第一版姿态 |
| --- | --- | --- |
| CRM / 客户系统 | HubSpot、Salesforce、自研 CRM | read-only / import-first |
| 垂直业务系统 | 米盾云、不良资产系统、美业 CRM、电商 ERP | tenant custom extension-first |
| 协作与通讯 | 邮箱、IM、会议、日历 | read-only / capture / draft-first |
| 知识库与文档 | Notion、飞书文档、内部制度库、FAQ | retrieval / briefing-first |
| 表格与轻数据库 | Excel、Airtable、飞书表格 | import / mapping-first |
| 数据仓库 / BI | ODPS、报表库、指标表 | report / signal-first |
| 自动化与 agent runtime | OpenClaw、n8n、脚本、RPA | resource binding-first，不直接治理 |
| 人工输入 | 表单、会议纪要、手工校正 | human-confirmed promotion path |

## 8. 状态模型

资源状态不应只有 connected / disconnected。建议统一为：

```text
registered
  -> configured
  -> connected
  -> readable
  -> mapped
  -> governed
  -> actionable
  -> write_intent_enabled
  -> paused / error / revoked
```

含义：

- `registered`：租户声明资源存在。
- `configured`：基础连接参数已填写，但未验证。
- `connected`：认证或连接已成功。
- `readable`：Helm 可读取最小样本。
- `mapped`：外部对象已映射到 Helm 业务对象或 extension object。
- `governed`：已绑定 trust、promotion、capability、review policy。
- `actionable`：可用于生成 judgement / recommendation / draft / action pack。
- `write_intent_enabled`：允许生成 guarded official write intent，但仍不代表自动写入。
- `paused / error / revoked`：资源不可继续用于推进，必须降级。

## 9. 核心对象草案

第一版可以先做 read model，不急于 schema migration。但概念上应收成以下对象：

### 9.1 TenantResource

回答“租户有哪些资源”。

关键字段：

- `resourceId`
- `workspaceId`
- `resourceType`
- `resourceName`
- `provider`
- `extensionKey`
- `ownerMembershipId`
- `status`
- `sensitivity`
- `businessPurpose`

### 9.2 ResourceConnection

回答“资源怎么连、能读写什么”。

关键字段：

- `connectionId`
- `resourceId`
- `authMode`
- `readCapability`
- `writeCapability`
- `callbackCapability`
- `lastSyncAt`
- `lastHealthStatus`
- `tokenPosture`
- `errorSummary`

### 9.3 ResourceMapping

回答“外部对象如何进入 Helm 对象层”。

关键字段：

- `mappingId`
- `resourceId`
- `externalObjectType`
- `helmObjectType`
- `extensionObjectType`
- `requiredFields`
- `mappingCompleteness`
- `conflictPolicy`
- `ownerResolutionPolicy`

### 9.4 ResourceGovernancePolicy

回答“Helm 可以怎么用这个资源”。

关键字段：

- `policyId`
- `resourceId`
- `trustLevel`
- `promotionEligibility`
- `freshnessWindow`
- `allowedEffectModes`
- `reviewRequirement`
- `customerFacingAllowed`
- `writeBackAllowed`
- `fallbackMode`

### 9.5 ResourceSignal

回答“资源产生了什么可用信号”。

关键字段：

- `signalId`
- `resourceId`
- `sourceObjectRef`
- `evidenceRef`
- `signalType`
- `objectRefs`
- `freshness`
- `confidence`
- `draftPayload`
- `extractedFacts`

### 9.6 ResourceLoop

回答“这个资源如何推动一件事形成闭环”。

关键字段：

- `loopId`
- `workspaceId`
- `resourceId`
- `targetObjectRef`
- `judgementRef`
- `actionRef`
- `decisionTraceRef`
- `executionPosture`
- `acknowledgementStatus`
- `followThroughStatus`
- `learnedMemoryRefs`

## 10. Trust / Promotion 规则

第一版沿用 Helm v2 richer ingestion 的方向：

| Trust posture | 可用范围 |
| --- | --- |
| `system_of_record` | 可作为强证据，但写入仍需 policy |
| `connector_trusted` | 可进入 judgement / recommendation |
| `human_confirmed` | 可进入 promotion candidate |
| `draft_only` | 只用于草稿、解释、待复核 |
| `untrusted` | 只作为提示，不进入正式判断 |
| `agent_inference` | 永远不能直接替代 fact |
| `stale` | 默认降级，需 fresh evidence 或人工确认 |

promotion 原则：

- untrusted 输入不能自动进入长期记忆。
- human-confirmed 与 system-of-record 是第一版最强 promotion path。
- agent inference 只能生成 hypothesis / draft / explanation，不能成为 canonical truth。
- 资源冲突未解决时，不得进入 guarded official write。

## 11. Capability 与 effect mode

资源控制面需要统一表达 Helm 对资源的可用能力：

| Effect mode | 含义 |
| --- | --- |
| `read_only` | 只能读取或展示 |
| `draft_only` | 可生成草稿，但不能执行 |
| `internal_write` | 只能写 Helm 内部对象、memory candidate 或 review item |
| `manual_execution` | 给人工执行动作包，等待 proof |
| `guarded_official_write` | 可生成 official write intent，但必须 explicit approval + acknowledgment |
| `limited_auto` | 未来窄场景保留，第一版默认不开放 |
| `deny` | 不允许使用该资源推进动作 |

所有 effect mode 都应能进入 capability decision trace，解释 allow / downgrade / route_to_review / ask_human / deny 的原因。

## 12. 产品界面

### 12.1 Settings - 资源控制面

第一版应在 settings 里提供“租户资源”视图：

- 资源列表：名称、类型、连接状态、可信度、可用能力、最近同步。
- readiness 卡片：哪些资源可用于 Helm 判断，哪些缺字段、缺权限、缺映射。
- 下一步动作：连接、补映射、解决冲突、确认权限、暂停资源。
- 风险提示：token 缺失、同步失败、过期数据、跨租户风险、写入未授权。

### 12.2 Imports / Connectors

导入页继续负责具体导入动作，但应向资源控制面回传：

- preview quality
- mapping completeness
- conflict count
- warmup result
- latest import job posture

### 12.3 Operating / Dashboard

经营面不展示配置细节，只展示：

- 当前哪些资源支撑了今日判断。
- 哪些关键资源不可用会影响推进。
- 哪些动作因资源治理被降级。
- 下一步该由谁补资源、补证据、复核或执行。

### 12.4 Object Detail / Evidence Drawer

对象页应能展示：

- 该判断引用了哪些资源证据。
- 资源是否 fresh。
- 是否存在冲突或低可信信号。
- 为什么只能 draft-only 或需要 review。

### 12.5 Extension Surface

租户专属业务系统优先落到 `extensions/<tenant-key>/<extension-slug>/`：

- extension manifest 声明 resource dependency。
- extension object 映射到 Helm object / action / report。
- extension 不越权获得 send / write / settlement authority。

## 13. 闭环定义

一条资源驱动的 Helm 闭环必须满足：

1. `Observe`：资源信号被读取，带 source / evidence / freshness。
2. `Normalize`：信号映射到 Helm object 或 extension object。
3. `Judge`：Helm 生成 judgement、risk、opportunity、next action。
4. `Govern`：capability / policy / ownership / trust 决定 effect mode。
5. `Act`：进入 draft、review、manual execution 或 guarded official write。
6. `Verify`：记录 proof、acknowledgment、failure、partial、unknown 或 stale。
7. `Learn`：写入 memory candidate、report、handoff、follow-through 或 object summary。

如果缺少 `Verify`，不能宣称事情已经完成。

如果缺少 `Govern`，不能进入高风险执行。

如果缺少 `Evidence`，不能生成可信 judgement。

## 14. 第一条代表性 MVP

建议第一条 MVP 不选“最多 connector”，而选一条能验证闭环的资源：

### 推荐 MVP：CRM / 垂直业务系统只读接入

理由：

- 已有 imports / CRM / extension 基础。
- 能直接映射 Company / Contact / Opportunity / Case / Action。
- 能形成今日重点、风险、跟进、人工执行、回执复盘。
- 可用于美业 CRM、米盾云、跨境 ERP 等后续 vertical extension。

MVP flow：

```text
资源登记
  -> 样本读取
  -> 字段映射
  -> 冲突/缺口提示
  -> 今日重点动作
  -> 人工复核
  -> 手工执行 proof
  -> follow-through
  -> memory/report write-back
```

MVP 不做：

- 自动写回外部 CRM
- 自动发送客户消息
- 自动改外部订单/案件/机会状态
- 通用 connector builder

## 15. 指标

第一版看这些指标：

- `time_to_first_readiness`：资源登记到看到 readiness 的时间。
- `mapping_completeness`：核心字段映射完整度。
- `evidence_coverage`：由资源驱动建议中带 evidence 的比例。
- `downgrade_rate`：因 trust / freshness / capability 被降级的比例。
- `review_completion_rate`：需要复核的资源动作被处理比例。
- `manual_execution_proof_rate`：人工执行后有 proof 的比例。
- `follow_through_close_rate`：异常和回执 follow-through 关闭比例。

不看这些虚荣指标：

- connector 总数量
- raw event 总量
- 导入数据行数
- LLM 调用次数

## 16. 分阶段路线

### Phase 0 - PRD / 评审

- 冻结资源分类、状态模型、核心对象草案、闭环定义和非目标。
- 不开发代码。
- 不做 schema migration。
- 不开 external write。

### Phase 1 - Resource readiness read model

- 汇总现有 connector、import source、extension manifest、capture、runtime resource posture。
- 形成只读资源目录与 readiness readout。
- 不新建通用 connector framework。

### Phase 2 - Mapping / trust / gap surface

- 为已有 CRM/import/extension 样本展示 mapping completeness、trust posture、freshness、conflict/gap。
- 让用户知道下一步补什么。

### Phase 3 - Single governed loop

- 用一条代表性资源完成 `observe -> judge -> govern -> act -> verify -> learn`。
- 默认走 manual execution proof 或 guarded review，不开 broad auto-write。

### Phase 4 - Tenant custom extension adoption

- 对米盾云、美业 CRM、跨境 ERP 等垂直系统，用 extension manifest 声明 resource dependency、object mapping、policy 和 readout。
- 继续防止 tenant custom 直接污染 shared core。

### Phase 5 - Guarded official write evaluation

- 只在 Phase 1-4 证明可控后，评估最窄 official write intent。
- 必须保持 explicit approval、acknowledgment success、failure follow-through 和 force manual fallback。

## 17. No-Go 条件

出现任一情况，不进入实现：

- 无法解释资源接入后具体推动哪类经营闭环。
- 用户只能看到配置项，看不到下一步动作。
- 需要一开始就 schema migration 或通用 connector builder。
- 需要 broad auto-write 才能证明价值。
- 无法区分 tenant custom data 与 Helm reserved first-party data。
- 不能给出 trust / promotion / evidence / capability 的降级路径。

## 18. 当前边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `resource != authority`
- `read before write`
- `review-first`
- `acknowledgment success 才代表 official write 成功`
- `resolved != official success`
- `tenant custom extension != shared core product`
- `reserved workspace commercial logic != customer tenant resource integration`

## 19. Open Questions

1. 第一条代表性资源 MVP 是否优先选 CRM、米盾云、美业 CRM，还是内部表格/知识库？
2. 第一版资源目录是否只读汇总现有数据，还是允许手工登记一个“待接入资源”？
3. 租户 owner 是否需要看到所有 resource policy，还是只显示“可读 / 可建议 / 可执行 / 需复核”的简化状态？
4. 何时允许从 manual execution proof 进入 guarded official write intent？
5. tenant custom extension 的 resource dependency 是否必须进入 manifest validation 才能启用？
