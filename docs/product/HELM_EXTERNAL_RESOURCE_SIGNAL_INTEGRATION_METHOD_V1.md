---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm External Resource Signal Integration Method V1

状态：Planning contract
Owner：Helm Core
日期：2026-04-27

> Review gate: 本文件只能作为 method / planning contract 使用。进入 Phase 1 前，必须重新对齐 [HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md](./HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md) §2.2 / §2.4、[HELM_PRIVATE_TENANT_SEPARATION_PLAN_V1.md](../internal/HELM_PRIVATE_TENANT_SEPARATION_PLAN_V1.md) 与 [HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md)。Memory / Skill 命名收口由 [HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_RELEASE_READINESS_CORRECTION_V1.md](./HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_RELEASE_READINESS_CORRECTION_V1.md) §一 #2 = A 锁定为 docs rename：标准名仅使用 `MemoryCandidate / MemoryDistillationCandidate / MemoryItem / SkillSuggestion`；不新建 `MemoryWritebackCandidate / SkillSuggestionCandidate` schema；ActionIntent / ReviewBundle / ExecutionReceipt 仍按 §4.7 的概念-vs-schema 映射处理。

## 1. 目的

这份文档把“外部资源接入 Helm 并转化为企业经营信号”的方法固定下来。

它回答 5 件事：

1. 外部资源进入 Helm 后到底承担什么职责
2. 业务系统、管理报表系统、沟通协作系统、文档知识系统四类资源如何分层接入
3. 一条外部资源如何从 source 变成可复核的经营信号
4. 实施项目应该按什么步骤推进
5. 后续可以沉淀成什么样的实施工具

本文件是 planning contract，不授权 runtime extractor、schema migration、API route、UI 行为、official write、自动发送、自动审批或自动执行。

## 2. 当前产品 truth

Helm 当前仍是：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `proactive-reporting-first`

外部资源接入的目标不是让 Helm 变成第二个 CRM、BI、知识库、聊天系统或 workflow 平台，而是把外部系统里的事实、指标、承诺、阻塞、证据和知识依据压缩成经营推进所需的信号。

默认业务闭环是：

```text
source signal
  -> source contract
  -> normalization / projection
  -> judgement
  -> review packet
  -> Must Push / report / briefing / action intent
  -> receipt / follow-through
  -> memory write-back
```

这条链路服务四类角色：

- 决策：看见风险、缺口、待拍板事项和推荐下一步
- 执行：明确 DRI、动作、截止时间、依赖和阻塞
- 审计：保留来源、证据、复核、执行凭证和失败原因
- 复盘：把确认后的事实、判断和结果写回经营记忆

## 3. 四类外部资源

| 资源类型 | 典型系统 | 进入 Helm 后的主价值 | 当前不做 |
| --- | --- | --- | --- |
| 业务系统 | CRM、ERP、ATS、工单、项目系统、客服系统 | 对象状态、推进阶段、负责人、SLA、履约状态、客户/候选人/订单/工单信号 | 不做第二个 CRM / ERP / ATS / PM |
| 管理报表系统 | QuickBI、ODPS 报表、财务经营报表、运营看板 | 指标、趋势、异常、阈值、经营缺口、复盘依据 | 不做第二个 BI、任意 SQL 平台或 dashboard builder |
| 沟通协作系统 | 邮件、日历、会议、钉钉、企微、Slack、飞书 | 承诺、等待、阻塞、决策、会议结论、交接上下文 | 不做通用聊天中心、自动发信系统或会议平台 |
| 文档知识系统 | Confluence、Notion、飞书文档、Google Drive、合同库、方案库 | 策略依据、制度约束、合同/方案证据、历史复盘、知识 grounding | 不做完整知识库、无限制 RAG 或跨 workspace 搜索 |

四类资源的接入都必须以“经营信号可复核”为目标，而不是以“连接器数量”作为目标。

### 3.1 租户专属接入边界

上表里的 QuickBI、ODPS、钉钉、企微等名称只说明资源类别，不代表这些系统的任意现有实现都可以进入共享主线。

当前 release truth 要求：

- 租户专属 source contract 必须优先落在 `extensions/<tenant-key>/<source-or-extension>/` 或私有租户仓库，不落在共享 `external-resource-kit/` 里。
- `extensions/guangpu/`、`app/api/extensions/guangpu/`、`guangpu / midun / zhaojiling` 专属脚本、配置和文档不随公开仓库同步发布。
- 共享层若需要发现租户扩展，必须通过 `lib/extensions/registry.ts` 这类 registry / manifest seam 解析；不得在 `app/`、`features/`、`lib/` 共享路径里新增 hardcoded tenant slug。
- 通用 source contract 只描述可复用类别、字段、信号规则和 review packet；租户实例的 provider path、tenant credential、真实 source name、客户字段和专属 SQL 不进入通用模板。

如果某个 source 同时存在通用能力与租户专属实现，默认分工是：

| 内容 | 默认 owner |
| --- | --- |
| 通用方法、contract schema、mapping rule schema、review-packet schema | `external-resource-kit/` planning asset |
| 通用 BI 报表 skill 的 `query.sql / schema / metrics / criteria / prompt / template` | `report-skills/` |
| 租户专属 connector、route、SQL、字段映射、凭据说明、客户源系统约定 | `extensions/<tenant-key>/` 或私有租户仓库 |

## 4. 统一方法

### 4.1 Source Contract

每个外部资源接入前，先写清 source contract：

- source category：`business_system / management_report / collaboration_system / document_knowledge`
- source owner：业务 owner 与技术 owner
- workspace scope：数据属于哪个 workspace，是否允许跨 workspace
- authority posture：只读、草稿、复核后写回、完全不写回
- freshness：更新频率、延迟、过期判定
- sensitivity：公开、内部、敏感、受限
- fallback：provider 不可用时的 demo / CSV / sample path
- audit posture：接入、解析、映射、丢弃、复核和写回如何留痕

如果 source contract 答不清 source of truth、权限、时效和复核边界，不进入 runtime。

### 4.2 Normalization / Projection

外部资源不能直接变成 Helm canonical truth。

第一层只做：

- 原始 payload 摘要
- 归一字段
- 对象引用候选
- 证据引用
- 冲突与缺口
- 可解释的 projection

Projection 可以被页面、报告、审批和 Must Push 读取，但不能把外部字段直接升格为 Helm 主对象真值。

### 4.3 Signal Candidate

信号候选必须显式声明：

- signal type
- source type
- object ref
- evidence refs
- confidence
- severity
- freshness
- boundary note
- review requirement
- suggested next move

建议先支持下面这些信号族：

| 信号族 | 来源举例 | 典型输出 |
| --- | --- | --- |
| `blocked_decision` | 会议、邮件、项目系统 | 有待拍板事项超过阈值未进入复核 |
| `customer_waiting` | CRM、邮件、客服系统 | 客户等待回复或下一步动作 |
| `overdue_commitment` | 会议纪要、任务、合同承诺 | 承诺到期且未完成 |
| `metric_anomaly` | QuickBI / ODPS / BI 报表 | 指标异常、下滑、超阈值 |
| `missing_evidence` | 资源状态、合同、交付物 | 关键证据或凭证缺失 |
| `risk_escalation` | 报表、沟通、业务系统组合 | 风险从 watch 升级到需处理 |
| `knowledge_conflict` | 文档、合同、会议结论 | 文档依据与当前说法不一致 |

### 4.4 Judgement

Judgement 层只回答：

- 这个信号是否足够可信
- 是否需要人工复核
- 是否可以进入 Must Push / report / briefing
- 是否只是 watch-only
- 是否因为权限、敏感、冲突或过期而拒绝

LLM 可以解释 deterministic output，但不能替代确定性规则做等级判定。

### 4.5 Review Packet

任何会影响经营动作的信号，都必须能形成 review packet：

- title
- source summary
- object refs
- evidence refs
- deterministic rule result
- LLM explanation if available
- boundary note
- recommended DRI
- suggested due
- allowed next actions
- forbidden next actions
- rollback / fallback path

Review packet 是 Helm 进入行动前的最小治理单元。

### 4.6 Operating Output

信号通过复核后，才可以进入：

- Must Push
- Review Action
- operating brief
- weekly report
- customer / opportunity / company detail evidence
- memory candidate
- action intent draft

当前五月 Phase 3 runtime enablement 只允许 TPQR-001 / TPQR-003 / TPQR-004 三类信号在满足 6 项硬前置与 5 角色 approval 后进入 `/mobile` 第一屏 Must Push production path：

- TPQR-001 / `blocked_decision`（meeting）
- TPQR-003 / `overdue_commitment`（commitment）
- TPQR-004 / `customer_waiting`（emailThread）

`metric_anomaly`、`missing_evidence`、`risk_escalation`、`knowledge_conflict` 等非解禁信号在当前窗口只能进入 review packet、operating brief、weekly report 或 evidence readout；不得直接进入 `/mobile` 第一屏 Must Push，也不得绕过 Phase 3 runtime enablement review。

默认仍是 review-first。Proactive 不等于自动替人决策，recommendation 不等于 commitment。

### 4.7 概念合约与已落库模型映射

本文档使用的部分名称是 control-plane 概念，不等于当前 Prisma schema 已存在同名 model。进入实现前，必须为每个概念写明已落库 model、review surface 或 future ADR。

| 概念名称 | 当前姿态 | 当前可复用落点 / 约束 |
| --- | --- | --- |
| `memory candidate` | 通用概念词；release readiness correction §一 #2 = A 已禁止新建 `MemoryWritebackCandidate` schema | 按链路映射到 `MemoryCandidate`、`MemoryDistillationCandidate` 或 `MemoryItem`；不得自行新增同名 schema |
| `SkillSuggestion` | 已落库 schema model；review-first | candidate 不自动变 formal skill，不获得 execution authority；旧文档若仍写 `SkillSuggestionCandidate` 视为历史命名，按 correction §一 #2 = A 已统一为 `SkillSuggestion` |
| `action intent draft` / `ActionIntent` | 概念层；当前 schema-grep 未发现同名 model | 进入实现前必须映射到既有 governed action / `HumanActionExecution` / `ApprovalRequest` / `OfficialWriteIntent` 之一，或先补 ADR |
| `ReviewBundle` | 概念层 | 当前不能假设有同名 model；应映射到 `ApprovalRequest`、review packet、artifact review surface 或独立 contract |
| `OfficialWriteIntent` | 已有 schema model，但不代表本文件授权使用 | 只有经过独立 official-write review、capability gate、approval 与 receipt contract 后才可使用 |
| `ExecutionReceipt` | 概念层 | 当前应映射到 `HumanActionExecution` proof、`OfficialWriteIntent.writeAcknowledgement*`、`OfficialFollowThrough`、`AuditEvent` / `RuntimeEvent` evidence；不得把 receipt 等同于外部写入成功 |

## 5. 实施工具形态

第一轮实施工具应该是 file-based / dry-run-first，不先做完整 UI 平台。

建议命名：

```text
external-resource-kit/
  README.md
  templates/
    resource-intake.json
    source-contract.json
    mapping.json
    signal-rules.json
    review-packet.json
  examples/
    management-report-metric-anomaly/
      source-contract.json
      sample-payload.json
      mapping.json
      signal-rules.json
      dry-run-result.json
      review-packet.json
```

`external-resource-kit/` 只承载 resource intake、source contract、mapping、signal rules、sample payload、dry-run result 和 review packet。它不承载 BI 查询资产，不放 `query.sql`、`prompt.md`、`message-template.md`、`metrics.json` 或 `result-criteria.json`。

管理报表场景的分工固定为：

- `report-skills/` 负责 BI report skill pack：`query.sql / schema.json / metrics.json / result-criteria.json / prompt.md / message-template.md / subscription.example.json / sample-input.json`
- `external-resource-kit/` 负责把 report-skill 输出或外部 report snapshot 映射成 source contract、signal candidate 与 review packet
- `external-resource-kit/` 可以引用 `reportSkillKey / reportSkillVersion`，但不能复制或分叉 `report-skills/` 的 SQL / prompt / criteria truth

建议后续工具命令：

```bash
helm-resource intake validate
helm-resource source probe
helm-resource mapping dry-run
helm-resource signal eval
helm-resource review-pack generate
```

这些命令在第一轮只应该做本地合同校验、样例数据评估和 review packet 生成，不连接生产 provider，不写 DB，不改外部系统。

### 5.1 `resource-intake.json`

用途：记录业务意图、资源类型、owner、权限和边界。

必填字段：

- `resourceName`
- `resourceCategory`
- `businessOwner`
- `technicalOwner`
- `targetWorkspace`
- `businessLoop`
- `decisionUse`
- `authorityPosture`
- `sensitivity`
- `fallbackPath`
- `nonGoals`

### 5.2 `source-contract.json`

用途：定义 source 的字段、时效、权限和 source-of-truth posture。

必填字段：

- `sourceKey`
- `sourceCategory`
- `sourceOfTruthFor`
- `readScope`
- `writeBackAllowed`
- `freshnessSla`
- `retention`
- `auditEvents`
- `redactionRules`
- `failureModes`

### 5.3 `mapping.json`

用途：把外部字段映射到 Helm projection 与 evidence。

必填字段：

- `externalFields`
- `normalizedFields`
- `objectRefRules`
- `evidenceRefRules`
- `conflictRules`
- `missingFieldPolicy`
- `reviewRequiredFields`

### 5.4 `signal-rules.json`

用途：用 deterministic 规则把 projection 评估成 signal candidate。

必填字段：

- `signalType`
- `sourceTypes`
- `eligibilityRules`
- `thresholdRules`
- `severityResolution`
- `dedupeFingerprint`
- `watchOnlyRules`
- `rejectionRules`
- `boundaryNotes`

每条 `rejectionRules[]` 至少要带：

- `rejectionCategory`: `workspace_boundary | sensitivity | missing_evidence | stale_source | write_authority | other`
- `condition`
- `expectedDisposition`
- `reviewNote`

`other` 只能用于首轮 taxonomy 未覆盖的拒绝原因，并必须补 `categoryRationale`；Phase 1 sign-off 不能只用 `other` 规避五类硬拒绝覆盖。

### 5.5 `review-packet.json`

用途：形成可复核、可审计、可转行动的最小包。

必填字段：

- `packetId`
- `signalType`
- `sourceSummary`
- `objectRefs`
- `evidenceRefs`
- `ruleResult`
- `confidence`
- `recommendedNextMove`
- `suggestedDri`
- `suggestedDue`
- `allowedActions`
- `forbiddenActions`
- `boundaryNote`
- `rollbackPath`

## 6. 分阶段计划

### Phase 0 - Inventory

目标：盘点外部资源，不接线。

产出：

- 四类资源清单
- owner / 权限 / 数据敏感性清单
- 经营闭环映射
- 排除项清单

Go 条件：

- 每个候选资源能说明服务哪个经营闭环
- 每个候选资源有业务 owner
- 每个候选资源有明确 read / write posture
- business owner sign-off 已记录在 intake 中
- sample provenance plan 已定义，包括样例来源、脱敏方式、采样日期、业务 owner 和禁止保留的原始敏感字段
- 候选资源已标注为 generic source 还是 tenant-specific source；tenant-specific source 必须说明是否落 `extensions/<tenant-key>/` 或私有租户仓库

No-Go：

- 只因为“能接”而接
- 无 owner
- 无 fallback
- 数据敏感性不清楚
- 样例来源不可解释
- 租户专属 source 被包装成共享通用 source

### Phase 1 - Contract

目标：固定 source contract、mapping 和 signal rules。

产出：

- `resource-intake.json`
- `source-contract.json`
- `mapping.json`
- `signal-rules.json`
- sample payload

Go 条件：

- 字段、权限、时效、冲突、审计可解释
- 至少 3 条 positive sample、3 条 rejected sample 和 2 条 watch-only sample
- 每条 sample 都有 provenance、redaction note 和 expected rule result
- rejection fixture 覆盖率：当 `rejectionRules` 不超过 5 条时覆盖 100%；超过 5 条时覆盖率至少 80%，且 workspace boundary / sensitivity / missing evidence / stale source / write-authority rejection 必须全部覆盖
- business owner 对 source contract、mapping 和 signal rules 完成 sign-off
- 明确不做 auto-write、auto-send、auto-approval

### Phase 2 - Dry-run

目标：只用样例或脱敏快照生成 signal candidate 与 review packet。

产出：

- dry-run evaluator
- dry-run result
- review packet
- rejection report

Go 条件：

- deterministic rule 可复现
- signal candidate 带 evidence refs
- LLM explanation 不改变等级
- review packet 能被业务 owner 看懂

### Phase 3 - Read-only Pilot

目标：接入一个受控 workspace 的只读数据源。

产出：

- read-only source adapter
- ingestion / projection audit
- limited operating readout
- owner review notes

Go 条件：

- membership / workspace scope 已证明
- source failure 不影响主路径
- provider 缺失时有 fallback
- 不写外部系统

### Phase 4 - Review-first Adoption

目标：让信号进入 reports / approvals / operating brief；只有 Phase 3 runtime enablement 已解禁的 TPQR-001 / TPQR-003 / TPQR-004 信号才可进入 gated Must Push。

产出：

- review packet adoption
- report / operating brief readout
- gated Must Push readout only for eligible TPQR-001 / TPQR-003 / TPQR-004 signals
- memory candidate after human review
- audit / receipt / follow-through path

Go 条件：

- 所有行动都需要人工复核
- 所有 memory write-back 都有证据
- 冲突和误判能被标记、撤回和复盘
- 任何 Must Push 输出都继承 Phase 3 runtime enablement 的 6 项硬前置、5 角色 approval、disabled-by-default rollout、rollback proof 与 audit completeness

### Phase 5 - Guarded Official Write Evaluation

目标：只评估是否值得做窄写回，不默认授权。

产出：

- official write intent proposal
- risk matrix
- explicit approval requirement
- execution receipt contract
- rollback / no-go triggers

Go 条件：

- 有独立 official write review
- 有明确 capability gate
- 有可回放 receipt
- 有失败捕获与人工 fallback

No-Go：

- 任何自动承诺、自动发信、自动审批、自动付款、自动改外部系统状态

## 7. 第一条 POC 建议

建议第一条 POC 选择：

```text
管理报表系统指标异常
  + CRM / opportunity 状态
  + 邮件或会议里的承诺
  -> metric_anomaly / customer_waiting / overdue_commitment
  -> review packet
  -> operating brief / weekly report
  -> TPQR-003 / TPQR-004 gated Must Push candidate only when eligible
```

原因：

- 管理报表负责量化异常
- CRM / opportunity 负责对象归属
- 邮件 / 会议负责承诺与等待语境
- 最终输出能直接服务经营推进，而不是只展示数据

第一条 POC 的完成标准：

1. 至少一个 `metric_anomaly` 被 deterministic rule 命中
2. 至少一个对象引用能连到公司、机会或负责人
3. 至少一个沟通证据能解释为什么这件事需要推进
4. 生成一个 review packet，并由 business owner 人工签字接收
5. 生成一段 operating brief / weekly report 摘要
6. 如果生成 Must Push candidate，只能来自 TPQR-003 / TPQR-004 且必须标注 gated / not-runtime-enabled
7. 不写 DB / 不写外部系统 / 不自动发送

## 8. Current-main 映射

当前优先复用：

- `lib/connectors/*`
- `lib/imports/*`
- `app/api/connectors/*`
- `app/api/imports/*`
- `report-skills/`
- `/imports`
- `/reports`
- `/operating`
- `/approvals`
- `ConnectorIngestionRecord`
- `ImportSource`
- `ImportJob`
- `ImportItem`
- `RuntimeEvent`
- `ApprovalRequest`
- `MemoryItem`

Current-main gap：

- `lib/connectors/` 当前并不是完整通用 connector abstraction；Phase 0 inventory 必须显式标出 provider coverage gap，不得把 DingTalk / OAuth / CRM import seam 误写成所有系统都已可接入。
- `lib/imports/` 当前主要覆盖 CRM import / identity resolution / orchestration governance；Phase 0 inventory 必须显式标出 BI、文档知识与沟通协作 import coverage gap。
- `app/api/connectors/` 当前只覆盖 DingTalk sync-now 与 Google / HubSpot / Salesforce OAuth start / callback seam；Phase 0 inventory 不得把这些 route 写成 generic provider onboarding。
- `app/api/imports/` 当前只覆盖 CRM preview / run / sync、conflict resolve、template 与 warmup route；Phase 0 inventory 必须把非 CRM import route 标为未实现或待单独评审。

当前不新增第一轮 owner：

- `integrations/`
- `features/intelligence/`
- vendor-specific canonical tables
- generic `BusinessObject` table
- arbitrary SQL UI
- workflow builder
- broad notification center

## 9. 验证门槛

任何外部资源接入进入 runtime 前，至少需要通过：

1. source contract review
2. mapping dry-run
3. signal rule deterministic eval
4. evidence / redaction review
5. workspace membership / capability review
6. review packet business-owner acceptance
7. rollback / fallback review

本节是 source-contract review 的额外业务前置，不替代 [AGENTS.md](../../AGENTS.md) §10 的统一验证链。

如果进入代码实现，默认仍按 AGENTS.md §10 顺序运行：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

发布、云端试用、env 分层、Prisma client 或 pilot readiness 相关改动还应按影响面补充：

```bash
npm run db:generate
npm run validate:env
npm run pilot:check
```

不能运行的命令必须说明原因和剩余风险。

## 10. 风险与边界

| 风险 | 处理原则 |
| --- | --- |
| 把接入数量当成进度 | 只看是否形成经营信号和复核动作 |
| 把 projection 当 canonical truth | projection 只能是证据视图或候选，不是主对象真值 |
| 把 BI 解释当决策 | deterministic rules 判级，LLM 只解释 |
| 把沟通信号当授权 | 沟通证据只支持 review，不自动发送或承诺 |
| 把文档检索当知识真值 | 文档只能 grounding，冲突时必须 review |
| 跨 workspace 泄露 | 默认 current workspace only，跨 workspace 必须独立批准 |
| 写回越权 | 任何 official write 都要单独经过 ActionIntent / ReviewBundle / OfficialWriteIntent / ExecutionReceipt |
| 数据过期误导 | 每条 signal 必须带 freshness 和 stale policy |
| 方法论文档被当成 runtime authorization | 立即视为越权；本文档不授权 runtime、schema、API、UI、production query、official write 或自动执行 |
| external-resource-kit 与 report-skills 分叉 | 管理报表查询与 prompt truth 归 `report-skills/`；`external-resource-kit/` 只做 source contract / mapping / signal / review packet |
| 租户专属接入混入共享方法模板 | 租户专属 source contract、SQL、route、credential 和字段映射必须留在 `extensions/<tenant-key>/` 或私有租户仓库 |

## 11. 四类短表

| 分类 | 当前结论 |
| --- | --- |
| 已经完整成立 | 外部资源必须通过 evidence / review / boundary 转成经营信号的方法口径已经明确 |
| 已成形但仍需下一层 | file-based implementation kit、dry-run evaluator、review packet generator、命名 correction 对齐、Phase 3 gated Must Push 接入边界仍待下一层 |
| 刻意未做 | 不做 runtime extractor、schema migration、API、UI、official write、auto-send、auto-approval、auto-execution |
| 风险项 | 首条 POC 若没有真实业务 owner、脱敏样例、watch-only sample 和 rejection fixtures，容易退化成泛连接器或 BI 展示 |

## 12. 下一步

1. 新增 `external-resource-kit/` 的最小模板资产。
2. 选择第一条 POC：建议从 `management-report-metric-anomaly` 开始。
3. 为 POC 补 3 条 positive sample、3 条 rejected sample 和 2 条 watch-only sample。
4. 实现 dry-run evaluator，只输出 signal candidate 与 review packet。
5. 在独立 review 中决定是否进入 read-only pilot。
