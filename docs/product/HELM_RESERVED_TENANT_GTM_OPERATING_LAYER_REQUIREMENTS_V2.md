---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Reserved Tenant GTM Operating Layer Requirements V2

更新时间：2026-04-25
状态：Requirements Draft V2（V1 评审后修订，expert-review-before-implementation）
本轮范围：Helm reserved tenant 自营 GTM 运营层需求，不进入代码实现、schema 设计、自动结算或外部发送能力

**V2 修订说明**：
- 简化 OperatingControlLineCandidate 对象（15 字段 → 7 字段，其余延后至 Phase 4/5）
- 合并 Phase 2 和 Phase 3（Sales Intake + Control Line Mapping）
- 补充可测试的验收标准（量化指标：首次录入 ≤ 3 分钟、自由文本 ≤ 30% 等）
- 明确 "pain != evidence" 执行机制（evidence validation 状态机 + 降级机制）
- 补充 Phase 间依赖关系图

**评审记录**：
- V1 Review: `docs/reviews/HELM_RESERVED_TENANT_GTM_OPERATING_LAYER_REQUIREMENTS_REVIEW_V1.md`
- V1 结论：Conditional-Go（需完成 Must Change 1-5）

## 1. 结论

Helm 需要把 GTM 变成产品的一部分，但这部分首先只属于 Helm 自己的 reserved tenant。

这条线的目标不是给所有客户增加一个 CRM、营销自动化或销售管理模块，而是在 Helm reserved workspace 内建立一条自营增长闭环：

```text
市场信号
  -> 线索与来源
  -> 销售需求收集
  -> Customer Demand Brief
  -> 现有资源与证据盘点
  -> 第一条经营改善控制线候选
  -> AI readiness 诊断
  -> 第一条业务闭环
  -> 试用 workspace 初始化
  -> 结果证据包
  -> 可复用 GTM 资产
  -> 推荐 / 伙伴 / 贡献记录
  -> 应计候选 / 结算提案
  -> 人工复核与治理沉淀
```

这条线服务 Helm 自己的 GTM 能力建设：让 Helm 能持续发现客户、验证场景、沉淀证据、复用案例、管理贡献者，并把增长动作纳入 governance，而不是靠分散表格、聊天记录和个人记忆推进。

## 2. 租户归属

GTM Operating Layer 必须默认锚定 Helm reserved workspace：

- reserved workspace identity：`Workspace.workspaceClass = HELM_RESERVED`
- reserved system key：`Workspace.systemKey = "helm_reserved_primary"`
- 主账号锚点：`helm@zhaojiling.com`

关键边界：

1. 普通客户租户默认不可见 Helm GTM pipeline、贡献记录、应计候选、结算复核和内部 GTM 资产库。
2. `ALIYUN_MAIL_SYSTEM_EMAIL=helm@zhaojiling.com` 只代表系统发信账号，不代表当前请求属于 Helm reserved workspace。
3. public program catalog 可以读取 Helm reserved host 的公开 program 信息，但这不等于客户租户能访问内部 GTM、结算或贡献治理面。
4. 任何未来垂直行业版本都应先通过 tenant custom extension 或独立 productization 决策进入，不得把 Helm 自营 GTM 数据泄露给普通客户租户。

## 3. 范围与非目标

### 3.1 范围内

- Helm 自营线索、渠道、推荐和合作机会管理。
- 销售收集 leads 时的模板化客户资料与需求收集。
- Customer Demand Brief 到试用 workspace 初始化的 handoff。
- 客户现有资源、系统、数据和证据 readiness 的轻量收集。
- 用户痛点到第一条经营改善控制线的映射与复核。
- 客户 AI readiness 诊断和第一条可落地经营闭环设计。
- first loop 的推进、证据收集、结果复盘和可复用资产生成。
- referral、partner、content、delivery、case contributor 的贡献记录。
- 与既有 SalesReferral、Program Catalog、Participant Portal、Manual Settlement、Value Attribution Phase 0 的边界衔接。
- reserved-only 后台 readout、review queue 和运营报告。

### 3.2 非目标

- 不做普通客户可见的通用 CRM。
- 不做 marketplace。
- 不做自动打款、自动提现、自动税务处理。
- 不做股权应计、股权授予或分红承诺。
- 不做自动对外发送销售材料。
- 不做 broad auto-write 到客户外部系统。
- 不把 GTM 贡献记录写成确定债权。
- 不把诊断建议写成收益承诺。
- 不把 proof pack 默认发布成公开案例。

## 4. 产品目标

1. **把 GTM 工作变成可治理闭环**：每条增长动作都能说明来源、目标、责任人、下一步、证据和状态。
2. **把客户学习过程变成产品体验**：客户第一次使用 Helm 时，空白状态不是问题；诊断、第一条闭环和结果复盘本身就是 onboarding。
3. **把市场叙事建立在证据上**：案例、话术、行业 playbook 和 proposal 必须来自真实 proof pack，而不是泛泛宣传。
4. **把痛点转成第一条控制线**：销售收集的客户痛点必须能落到已有资源、可用证据、判断规则、人工复核和验证标准上。
5. **把贡献者预期稳定下来**：推荐人、伙伴和内容贡献者能看到自己的贡献、应计候选和结算状态，但不能把它误解成即时打款或股权。
6. **让 Helm 自己 dogfood Helm**：Helm 的 GTM、交付、贡献、复盘和结算应尽可能在 Helm 内闭环运行。

## 5. 用户角色

| 角色 | 关注点 | 第一版权限姿态 |
| --- | --- | --- |
| Helm founder / GTM owner | 增长判断、重点线索、第一条闭环、贡献复核 | reserved admin / owner |
| Sales referrer | 推荐是否被接受、是否产生应计候选、何时进入结算窗口 | portal/self-only 或 internal readout |
| Channel / community partner | 线索来源、合作项目、活动或内容带来的机会 | reviewed contributor |
| AI implementation partner | 诊断、first loop 设计、交付结果、可复用资产 | reviewed partner |
| Case / content contributor | proof pack、案例、话术、行业资产贡献 | contribution readout |
| Finance / ops reviewer | 应计候选、结算提案、reversal、异常、证据完整性 | reserved reviewer |
| External prospect / customer | 只接触公开 program、诊断入口、proposal 或 proof pack 摘要 | no internal GTM visibility |

## 6. 核心模块

### 6.1 GTM Pipeline

回答“现在 Helm 应该推进谁，为什么”。

第一版覆盖：

- lead source
- referrer / channel
- ICP fit
- AI readiness stage
- owner
- next action
- blocker
- outcome posture

GTM Pipeline 不替代 CRM。它只承载 Helm 自营 GTM 判断、证据和下一步动作。

### 6.2 Sales Lead Intake Template

回答“销售人员如何用最少负担收集足够好的客户资料和需求，并把它无缝交给试用初始化”。

这不是传统 CRM 表单，也不是让销售写长篇客户访谈纪要。第一版必须采用模板化、多选择、步步推进的 guided intake：

```text
Lead captured
  -> guided intake
  -> Customer Demand Brief
  -> resource-aware control line candidate
  -> readiness diagnostic
  -> trial initialization handoff
```

设计要求：

1. 首次录入目标耗时应控制在 3 分钟以内。
2. 初始表单只允许收集试用初始化所需的最小信息。
3. 70% 以上字段应是单选、多选、标签、评分或模板选择。
4. 自由文本只用于补充上下文，不得成为必填主路径。
5. 每一步最多展示 3-5 个核心问题，避免一屏大表单。
6. 支持先保存 draft，后续在客户沟通、诊断或试用前逐步补全。
7. 销售内部备注、客户可见摘要、试用初始化资料必须分层保存和展示。
8. 所有模板都必须保持行业克制，第一版只做通用经营问题、资源、角色和 first loop 类型，不做 vertical object 过度具像化。

建议步进：

| Step | 目标 | 输入方式 |
| --- | --- | --- |
| 1. 来源与客户身份 | 明确 lead 从哪里来、客户是谁 | source 单选、referrer 选择、公司名、联系人 |
| 2. 经营压力 | 明确客户为什么现在需要 Helm | 多选 pain tags、紧急度、影响范围 |
| 3. 现有资源与证据 | 明确客户已有系统、数据、资料和人工记录能否支持试用 | 多选 resource tags、证据 readiness、资料可得性 |
| 4. 关键角色 | 明确谁决策、谁使用、谁执行、谁复核 | 角色模板、多选参与人、owner 候选 |
| 5. 经营改善控制线候选 | 把痛点转成第一条可验证、可复核的改善线 | control-line template 多选、成功标准、风险提示 |
| 6. 下一步 | 生成诊断、试用初始化或继续补资料 | next action 单选、review gate、handoff summary |

字段模板示例：

- 经营压力：增长停滞、线索转化低、交付不稳定、客户跟进混乱、数据分散、团队执行不透明、复盘困难。
- 现有资源：CRM、自研系统、表格、企业微信、飞书、邮箱、会议记录、知识库、财务/订单系统。
- 资源证据状态：可直接导出、需客户授权、只有人工记录、字段不完整、数据过期、来源冲突、暂不可接入。
- 经营改善控制线类型：线索跟进、客户复盘、销售机会判断、交付风险预警、续费/扩容机会、内部任务推进。
- 成功标准：节省时间、减少遗漏、提升跟进质量、形成可复盘证据、推动一次明确决策。
- 风险边界：数据不足、角色未确认、客户未授权、外部系统不可接入、结果不可量化、涉及高风险承诺。

输出必须是 `CustomerDemandBrief`，而不是松散销售备注。

### 6.3 Resource-Aware Pain-to-Control-Line Mapping

回答“客户说出的痛点，如何结合已有资源与证据，转成第一条经营改善控制线”。

这一步是 GTM 到试用的关键转译层。销售不能只记录“客户觉得痛”，系统也不能直接把口头痛点当成事实。第一版必须把痛点、现有资源和可验证动作连起来：

```text
Pain tag
  -> resource inventory
  -> evidence readiness
  -> control-line template
  -> first operating improvement candidate
  -> diagnostic review
```

第一条经营改善控制线必须最少回答：

1. 要改善的经营问题是什么。
2. 依赖哪些已有资源、系统、表格、聊天记录或人工输入。
3. 当前证据是否足够，不足时缺什么。
4. Helm 可以做出什么判断。
5. 哪些判断必须人工复核。
6. 下一步动作是什么，谁执行。
7. 如何验证改善结果。
8. 哪些内容不能承诺。

控制线模板要求：

| 控制线模板 | 适用痛点 | 资源输入 | Helm 判断 | 人工动作 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| Lead follow-up control line | 线索跟进混乱 / 转化低 | CRM、表格、企微、销售记录 | 哪些线索优先处理 | 销售复核并手工触达 | 跟进完成率、下一步明确率 |
| Customer review control line | 客户复盘缺失 / 流失风险 | CRM、会议、邮件、服务记录 | 哪些客户需要复盘 | CSM 复核并安排沟通 | 风险是否确认、行动是否落地 |
| Delivery risk control line | 交付不稳定 / 责任不清 | 项目表、工单、聊天记录 | 哪些交付项阻塞 | 交付负责人复核并更新计划 | 阻塞是否解除、责任人是否明确 |
| Opportunity judgement control line | 销售机会判断不准 | 商机、沟通记录、报价材料 | 哪些机会值得推进 | AE 复核并调整推进计划 | 阶段是否更新、下一步是否明确 |
| Renewal / expansion control line | 续费扩容机会被遗漏 | 合同、使用记录、客户反馈 | 哪些客户有续费或扩容信号 | Owner 复核并准备方案 | 是否生成复核结论或方案草案 |

**Evidence Validation 状态机**：

```text
pain captured (hypothesis)
  → evidence_declared (销售/客户声明有资源)
  → evidence_partial (有部分样本/截图，但不足)
  → evidence_ready (有导出数据、会议记录、表格等)
  → evidence_verified (人工复核确认)
```

**Evidence 不足时的降级机制**：

| 状态 | 定义 | 控制线处理 | 用户体验 |
|------|------|-----------|---------|
| `evidence_partial` | 有部分样本/截图，但不足 | 状态设为 `evidence_needed`，提示"缺什么才能跑第一条控制线" | 不阻止进入 diagnostic，但标记为 high-risk |
| `evidence_declared` | 只有客户声明，无样本 | 状态设为 `ask_human`，要求人工复核后才能进入 diagnostic | 阻止自动推进，要求补充证据 |
| `无任何资源信息` | 未收集到资源信息 | 状态设为 `blocked`，建议先收集资源信息 | 阻止推进，给出收集指导 |

**谁来确认 evidence**：

- `evidence_ready` → `evidence_verified`: 由 Helm 内部 reviewer 复核
- 复核可以通过：系统样本、导出数据、会议记录、表格、截图、文档或人工会议
- 复核结果必须记录在 `OperatingControlLineCandidate.evidenceReadiness` 中

**边界**：

1. 资源收集第一版只做 readiness 与 evidence mapping，不自动连接所有系统。
2. 客户痛点默认是 hypothesis（`pain captured`），只有客户确认或资源证据支持后才能升级为 trial premise。
3. 控制线候选不是承诺改善结果，只是可验证试用闭环候选。
4. 行业专属控制线可以作为 future vertical version 或 tenant custom extension，第一版不强行写入通用核心。
5. 进入试用后，resource inventory 只能成为 tenant resource candidate，不能自动升级为 connected / governed resource。
6. 真正的资源接入、mapping、trust、capability 和 governed loop 仍由租户资源接入治理主线承接。

### 6.4 AI Readiness Diagnostic

回答“这个客户从哪里开始用 Helm 最可能出结果”。

诊断维度：

- 业务目标是否明确
- 现有资源是否可接入
- 关键角色是否愿意参与
- 是否存在高频、可验证、低风险的 first loop
- 是否具备 proof collection 条件
- 哪些承诺必须降级为前置条件或依赖项

输出不是“保证成功方案”，而是 review-first 的 first loop candidate。

### 6.5 First Loop Launcher

回答“第一条闭环怎么跑起来”。

第一版只支持窄闭环：

```text
observe -> judge -> prepare -> human review -> manual action -> verify -> learn
```

每条 first loop 必须定义：

- 目标业务对象
- 需要的资源和证据
- 判断标准
- 人工复核点
- 手工执行方式
- 成功 / 失败 / 阻断定义
- proof pack 要求

### 6.6 Outcome Proof Pack

回答“这次推进到底产生了什么可复盘结果”。

proof pack 最少包含：

- before / after 状态
- 关键证据
- 客户确认或内部复核
- 指标变化或定性结果
- 可公开内容与不可公开内容
- boundary note / prerequisite note / dependency note / non-commitment note
- 可复用 GTM 资产候选

没有 proof pack，不得把试点包装成公开案例或强承诺销售材料。

### 6.7 GTM Asset Library

回答“哪些证据可以复用为销售和市场资产”。

资产类型：

- case study
- proposal snippet
- demo script
- diagnostic checklist
- first loop template
- industry playbook
- objection handling
- partner enablement material

每个资产必须能追溯到 proof pack 或明确标记为 hypothesis / draft。

### 6.8 Contributor / Referral / Partner Intake

回答“谁把价值推进出来”。

第一版只做记录与复核，不做自动分钱：

- referral accepted
- customer meeting introduced
- diagnostic supported
- first loop designed
- first loop delivered
- proof pack contributed
- reusable GTM asset created
- renewal / expansion influenced

贡献记录可以成为 `ValueAccrual` 或 `SettlementProposal` 的候选依据，但贡献记录本身不等于 payable、债权、工资、佣金或股权。

### 6.9 Contribution Accrual Readout

回答“贡献是否进入应计候选和结算复核”。

第一版前台只允许暴露三个概念：

- 我的贡献
- 我的应计
- 我的结算

内部治理可见：

- evidence
- reviewer
- rule version
- maturity window
- reversal posture
- dispute / freeze

文案必须使用“应计候选 / 结算提案 / 人工复核”，避免“即时分配”“自动到账”“已授予”等误导表达。

## 7. 概念对象草案

以下是产品对象草案，不代表本轮要落 Prisma schema。

### 7.1 GTMLead

回答“这个机会从哪里来，当前推进到哪一步”。

关键字段：

- `leadId`
- `sourceType`
- `sourceRef`
- `referrerId`
- `companyName`
- `industry`
- `icpFit`
- `readinessStage`
- `ownerMembershipId`
- `stage`
- `nextAction`
- `blocker`
- `evidenceRefs`

### 7.2 CustomerDemandBrief

回答“销售已收集的信息如何变成试用初始化可用的结构化上下文”。

`CustomerDemandBrief` 是 `GTMLead` 与 `DiagnosticSession / Trial Workspace Initialization` 之间的交接对象。

关键字段：

- `briefId`
- `leadId`
- `customerSummary`
- `businessPressureTags`
- `currentResourceTags`
- `resourceEvidenceReadiness`
- `painToControlLineCandidates`
- `roleMap`
- `firstLoopCandidates`
- `successCriteria`
- `riskBoundaryTags`
- `customerVisibleSummary`
- `internalSalesNotes`
- `trialInitializationPayload`
- `reviewStatus`

可见性要求：

1. `internalSalesNotes` 只能在 Helm reserved tenant 内部可见。
2. `customerVisibleSummary` 必须经过人工复核后才可进入客户沟通或 proposal。
3. `trialInitializationPayload` 只能包含试用启动所需的结构化资料，不得夹带 referral、settlement、贡献归因或内部评价。
4. 从 `CustomerDemandBrief` 初始化试用 workspace 前必须有 review gate。

### 7.3 OperatingControlLineCandidate

回答”某个客户痛点是否已经被转成一条可验证、可复核、可初始化试用的经营改善控制线”。

**第一阶段字段（Phase 2/3）**：

回答”能否做”——核心字段最小化。

- `controlLineCandidateId`
- `briefId`
- `painTag`
- `controlLineTemplate`              // 从预定义模板选择
- `targetBusinessObject`             // 简化：如 “销售线索”、”客户复盘”
- `resourceInputs`                   // 简化：如 “CRM”、”表格”
- `evidenceReadiness`                // 枚举：ready | partial | missing
- `status`                           // draft | evidence_needed | trial_premise | rejected

**第二阶段字段（Phase 4/5 延后）**：

回答”怎么做、怎么验证”——在 diagnostic 和 first loop 执行时补充。

- `missingEvidence`                  // Phase 4 补充
- `helmJudgementScope`               // Phase 4 补充
- `humanReviewRequirement`           // Phase 4 补充
- `manualActionPlan`                 // Phase 4 补充
- `verificationSignal`               // Phase 5 补充
- `nonCommitmentNotes`               // Phase 5 补充

**状态含义**：

- `draft`：由销售 intake 或模板推荐生成，尚未复核。
- `evidence_needed`：痛点成立但资源或证据不足，需明确缺什么。
- `trial_premise`：已被复核为试用前提，可进入 trial plan。
- `rejected`：不适合作为 first loop，需保留原因。

**设计理由**：

第一阶段重点是”能否做”，第二阶段才是”怎么做、怎么验证”。避免销售在 guided intake 时填写过多形式化字段。

### 7.4 DiagnosticSession

回答“客户适合从哪个 first loop 开始”。

关键字段：

- `diagnosticId`
- `leadId`
- `workspaceCandidate`
- `businessGoal`
- `availableResources`
- `roleReadiness`
- `firstLoopCandidate`
- `riskNotes`
- `boundaryNotes`
- `reviewStatus`

### 7.5 PilotLoop

回答“第一条闭环的执行设计和状态”。

关键字段：

- `pilotLoopId`
- `leadId`
- `diagnosticId`
- `loopType`
- `targetObject`
- `requiredResources`
- `reviewGate`
- `manualActionPlan`
- `verificationPlan`
- `status`
- `proofPackId`

### 7.6 OutcomeProofPack

回答“结果证据是否足够复盘和复用”。

关键字段：

- `proofPackId`
- `pilotLoopId`
- `beforeState`
- `afterState`
- `evidenceRefs`
- `metricClaims`
- `customerConfirmation`
- `publicUseStatus`
- `boundaryNotes`
- `assetCandidates`

### 7.7 GTMAsset

回答“哪些 GTM 材料可以复用，以及依据是什么”。

关键字段：

- `assetId`
- `assetType`
- `sourceProofPackId`
- `audience`
- `claimLevel`
- `approvalStatus`
- `reuseGuidance`
- `nonCommitmentNotes`

### 7.8 GTMContribution

回答“谁贡献了什么，以及证据是否成立”。

关键字段：

- `contributionId`
- `contributorId`
- `contributionType`
- `targetType`
- `targetId`
- `evidenceRefs`
- `reviewStatus`
- `acceptedAt`
- `accrualCandidateStatus`

### 7.9 GTMAccrualCandidate

回答“这个贡献是否可能进入应计和结算复核”。

关键字段：

- `candidateId`
- `contributionId`
- `revenueRef`
- `ruleVersion`
- `maturityStatus`
- `reversalStatus`
- `settlementProposalRef`
- `reviewStatus`

`GTMAccrualCandidate` 没有付款执行含义。

## 8. 状态流

### 8.1 Lead Flow

```text
captured
  -> qualified
  -> guided_intake
  -> demand_brief_ready
  -> resource_evidence_mapped
  -> control_line_candidate_ready
  -> diagnostic_scheduled
  -> diagnostic_completed
  -> trial_initialization_ready
  -> first_loop_proposed
  -> first_loop_active
  -> proof_ready
  -> converted / nurtured / lost / disqualified
```

### 8.2 Lead-to-Trial Initialization Flow

```text
lead accepted
  -> sales guided intake draft
  -> customer demand brief reviewed
  -> diagnostic session created
  -> trial plan approved
  -> trial workspace initialization payload prepared
  -> trial workspace initialized
  -> first loop ready
```

约束：

1. `CustomerDemandBrief` 可以触发 trial initialization candidate，但不得自动创建正式客户 workspace。
2. 只有经过 review gate 的 `trialInitializationPayload` 才能进入试用 workspace 初始化。
3. referral、contribution、settlement、internal scoring 和内部销售备注不得复制进客户试用 workspace。
4. 试用 workspace 初始化后必须保留 source trace，说明哪些初始上下文来自销售 intake、哪些来自客户确认、哪些仍待补证。

### 8.3 Pain-to-Control-Line Flow

```text
pain captured (hypothesis)
  -> evidence_declared (客户声明有资源)
  -> evidence_partial | evidence_ready (收集样本/数据)
  -> evidence_verified (人工复核确认)
  -> control-line template selected
  -> control-line candidate reviewed
  -> trial premise accepted / evidence needed / ask_human / rejected
```

**状态说明**：

- `pain captured`: 初始状态，客户口头描述的痛点，默认为 hypothesis
- `evidence_declared`: 客户或销售声明有某种资源/系统，但无样本
- `evidence_partial`: 有部分样本/截图，但不足以验证控制线
- `evidence_ready`: 有导出数据、会议记录、表格等可验证证据
- `evidence_verified`: Helm 内部 reviewer 复核确认

**约束**：

1. `pain captured` 不能直接进入 trial premise，必须经过 evidence 验证路径。
2. `resource inventory collected` 只代表客户声明或销售收集（`evidence_declared`），不代表系统已经连接成功。
3. `evidence readiness assessed` 必须说明证据来源、可得性、新鲜度和缺口，并映射到 `evidence_partial` | `evidence_ready` | `evidence_verified`。
4. `evidence_partial` 状态下的控制线可以进入 diagnostic，但必须标记为 high-risk。
5. `evidence_declared` 或 `evidence_partial` 状态下的控制线不能直接进入 `trial_premise`，必须先升级为 `evidence_verified` 或经过人工复核降级接受。
6. `trial premise accepted` 只代表可以进入试用计划，不代表 Helm 承诺经营结果。

### 8.4 Diagnostic Flow

```text
draft
  -> reviewed
  -> first_loop_selected
  -> blocked
  -> superseded
```

### 8.5 Pilot Loop Flow

```text
proposed
  -> approved
  -> active
  -> verification_pending
  -> proof_ready
  -> completed / blocked / canceled
```

### 8.6 Proof Pack Flow

```text
collecting
  -> internally_reviewed
  -> customer_confirmed
  -> reusable_internal
  -> approved_public
  -> rejected_public / archived
```

### 8.7 Contribution Flow

```text
claimed
  -> evidence_attached
  -> accepted
  -> accrual_candidate
  -> settlement_review
  -> settled / reversed / disputed / expired
```

## 9. 体验原则

登录 Helm reserved tenant 后，GTM Operating Layer 第一屏不应教育用户“Helm 是什么”，而应直接回到最重要的工作：

- 今天最该推进的 3 个机会
- 等待诊断复核的客户
- 正在跑的 first loop
- 需要补证据的 proof pack
- 可以复用但未审批的 GTM asset
- 需要复核的 referral / contribution / accrual candidate

信息分层：

1. 第一层只显示对象、状态、阻塞、下一步。
2. 第二层显示证据、解释、风险和边界。
3. 第三层显示规则版本、审计、贡献归因和结算候选。

销售 intake 体验要求：

1. 默认从模板开始，不从空白表单开始。
2. 默认使用选择、标签、评分和建议项，少用自由文本。
3. 每一步必须告诉销售“为什么问这个问题”和“会用于哪个后续动作”。
4. 不完整也可以保存，但必须明确缺哪些字段会阻断 diagnostic、trial plan 或 first loop。
5. 每次客户沟通后应能继续补充，而不是要求一次填完。
6. 系统应能生成一页 `Customer Demand Brief`，用于内部复核和试用 handoff。
7. 客户可见版本必须与内部销售备注分离，且默认需要人工确认。

资源与控制线体验要求：

1. 资源收集必须作为销售 intake 的自然步骤，而不是另开复杂配置向导。
2. 资源问题应以“你们现在这些信息在哪里”为表达方式，避免一开始要求客户理解 connector、mapping 或权限模型。
3. 每个痛点都应给出 1-3 个推荐控制线模板，销售只需选择、确认或标记不适用。
4. 如果资源证据不足，系统应给出“缺什么才能跑第一条控制线”，而不是直接终止试用。
5. 控制线详情应默认展示业务语言：要改善什么、用什么证据、谁复核、做什么动作、怎么验证。
6. connector、字段映射、trust、capability trace 等治理细节默认下沉到二级解释层。

普通客户租户不得看到这套内部 GTM 控制面。

## 10. 治理规则

### 10.1 Reserved-only

所有内部 GTM pipeline、contribution、accrual candidate、settlement review 和 private asset library 必须通过 reserved workspace gating。

### 10.2 Recommendation != Commitment

诊断、first loop、proposal、case asset、收益测算和增长建议都不得被写成承诺。

### 10.3 Evidence before Claim

没有 proof pack 的内容只能标记为 draft / hypothesis，不能进入 approved public asset。

### 10.4 Contribution != Payable

贡献记录只是证据化记录，不是债权、佣金、工资、分红或股权。

### 10.5 Accrual Candidate != Settlement

应计候选只代表进入治理复核，不代表已到期、可提现或已付款。

### 10.6 Human Review before External Use

任何客户可见 case、proposal、public claim 或 partner payout 都必须经过人工复核。

### 10.7 Clean Handoff into Trial

销售 intake 可以成为试用初始化来源，但必须先做清洗和复核。

禁止进入客户试用 workspace 的内容：

- 销售内部判断
- 客户敏感或未经确认的推测
- referral / partner / contribution 数据
- settlement / accrual 数据
- 佣金、股权、分成或 payout 相关内容
- 未确认的收益承诺或效果测算

允许进入客户试用 workspace 的内容：

- 客户确认的业务目标
- 客户确认的角色和参与人
- 客户确认的已有资源
- first loop candidate
- 试用成功标准
- 风险、前置条件和待补证据

### 10.8 Pain is not Evidence

客户痛点不能直接作为 Helm 判断事实。

要求：

1. 客户口头痛点默认是 hypothesis。
2. 销售收集的现有资源默认是 declared resource，不代表 connected resource。
3. 只有客户确认、系统样本、导出数据、会议记录、表格、截图、文档或人工复核能成为 evidence。
4. 没有 evidence 的控制线只能进入 draft / evidence_needed，不能进入 trial premise。
5. 资源证据存在冲突或过期时，控制线必须降级为 ask-human 或 blocked。

## 11. MVP 顺序

### Phase 0：需求与评审

目标：冻结 reserved tenant GTM Operating Layer 的边界和评审问题。

交付：

- 本需求文档
- 专家评审意见
- No-Go 条件

No-Go 条件：

- 无法坚持 reserved-only 边界
- 无法接受 `contribution != payable`
- 无法接受 proof-before-claim
- 需要一开始就做普通客户 CRM 或自动结算

### Phase 1：Reserved GTM Read Model

目标：先把已有 program、referral、application、participant、settlement、proof、tenant resource loop 的信息收成只读 GTM readout。

不做：

- schema migration
- 外部写回
- 自动结算
- 普通租户可见 UI

验收：

- Helm reserved tenant 能看到 lead / referral / application / proof / next action 的统一读面。
- 非 reserved tenant 看不到内部 GTM readout。

### Phase 2：Sales Intake + Control Line Mapping

**目标**：让销售以模板化、多选择、步步推进的方式收集客户资料、需求，并把痛点转成控制线候选。

**为什么要合并**：

原 Phase 2（Sales Lead Intake + Customer Demand Brief）和 Phase 3（Resource-Aware Pain-to-Control-Line Mapping）在实际销售流程中高度耦合——"收集痛点"和"映射控制线"是同一个对话。强行分开会导致：
- 销售跨两个阶段/界面完成同一个客户的一次沟通记录
- `painToControlLineCandidates` 在 Phase 2 是 draft，到 Phase 3 又要重新 review，状态冗余

**验收**：

- 销售能从模板创建 lead intake draft。
- 首次录入只要求最小字段（来源、客户身份、经营压力），且以选择项为主。
- 每个核心 pain tag 能关联 resource inventory 和 evidence readiness。
- 系统能推荐 1-3 个 control-line template，而不是直接要求销售自由设计。
- `CustomerDemandBrief` 能区分 internal notes、customer-visible summary 和 trial initialization payload。
- 未经 review 的 payload 不得进入试用 workspace 初始化。

### Phase 3：Diagnostic + First Loop Template

目标：把客户 onboarding 变成诊断与第一条闭环，不让用户面对空白系统。

验收：

- 每个 diagnostic 都能输出 first loop candidate。
- 每个 first loop 都有 review gate、manual action plan 和 verification plan。
- high-risk action 默认不能自动执行。

### Phase 4：Outcome Proof Pack

目标：把试点结果变成可复盘、可复核、可复用资产。

验收：

- proof pack 能解释 before / after、evidence、metric claim 和 public-use boundary。
- 没有 approval 的 asset 不能被标记为 public reusable。

### Phase 5：Contribution / Accrual Bridge

目标：把 referral、partner 和 case contribution 接到现有 value attribution / manual settlement 姿态。

验收：

- 前台只暴露”我的贡献 / 我的应计 / 我的结算”。
- 内部可见 evidence、reviewer、maturity、reversal 和 dispute posture。
- 不产生自动 payout、自动 debt 或 equity claim。

---

### Phase 间依赖关系

```text
Phase 1 (Read Model)
  ├─ 输出：统一 readout（lead / referral / application / proof / next action）
  └─ 为 Phase 2 提供历史上下文

Phase 2 (Intake + Mapping)
  ├─ 输出：CustomerDemandBrief + OperatingControlLineCandidate (简化版)
  └─ 为 Phase 3 提供结构化输入

Phase 3 (Diagnostic + First Loop)
  ├─ 输出：DiagnosticSession + PilotLoop
  └─ 为 Phase 4 提供执行上下文

Phase 4 (Proof Pack)
  ├─ 输出：OutcomeProofPack + GTMAsset
  └─ 为 Phase 5 提供证据基础

Phase 5 (Contribution/Accrual)
  ├─ 输出：GTMContribution + GTMAccrualCandidate
  └─ 接到 existing settlement 系统
```

## 12. 验收标准

### 12.1 产品验收

**Reserved-only 边界**：

1. GTM Operating Layer 只在 Helm reserved workspace 可见。
2. 普通客户租户不可见内部 GTM、贡献和结算治理面。

**首屏体验验收**（量化指标）：

3. 第一屏显示可推进工作，而不是概念教育。
   - 首屏加载时间 ≤ 1 秒
   - "今天最该推进的机会" 数量 = 3 个
   - 每个机会显示：对象、状态、阻塞、下一步（4 个要素）
   - 点击任意机会可在 ≤ 2 次点击内到达详情

**Sales Lead Intake 体验验收**（量化指标）：

4. 销售 lead intake 必须模板化、多选择、步步推进，不能退化成长表单或自由文本纪要。
   - 首次录入时间 ≤ 3 分钟
   - 自由文本字段占比 ≤ 30%
   - 首次录入必填字段 ≤ 5 个
   - 每步展示问题数 ≤ 5 个
   - 选择项（单选/多选/标签/评分）占比 ≥ 70%
   - Draft 保存成功率 ≥ 95%

**资源与控制线验收**：

5. 现有资源接入收集必须作为 guided intake 的自然步骤，不得要求销售先理解 connector 或 mapping 术语。
6. 每个核心痛点必须能转成一个 `OperatingControlLineCandidate`，或明确说明为什么不能转。
7. `CustomerDemandBrief` 必须能无缝交给 diagnostic、trial plan 和 trial workspace initialization。
   - `internalSalesNotes`、`customerVisibleSummary`、`trialInitializationPayload` 三层内容必须物理分离
   - 从 `CustomerDemandBrief` 初始化试用 workspace 前必须有显式 review gate
   - review gate 必须显示 "哪些内容会进入客户 workspace" 的预览

**First Loop 与 Proof Pack 验收**：

8. 销售内部备注、客户可见摘要、试用初始化 payload 必须分离。
9. 每条 first loop 都有证据、复核、手工执行和验证计划。
10. 每个 public GTM asset 都能追溯到 proof pack 或被标记为 draft / hypothesis。
11. 每个 contribution / accrual readout 都清楚表达非自动结算边界。

### 12.2 文档验收

1. `README.md` 和 `docs/README.md` 能索引到本需求。
2. 后续实现 PR 必须引用本需求和对应 plan / report。
3. 每个实现阶段必须显式说明：
   - 已经完整成立
   - 已成形但仍需下一层
   - 刻意未做
   - 风险项

### 12.3 验证命令

文档阶段至少运行：

```bash
npm run self-check
npm run check:boundaries
git diff --check
```

如果进入代码实现，还必须按仓库标准验证链补跑：

```bash
npm run db:reset
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

## 13. 风险与控制

| 风险 | 控制 |
| --- | --- |
| GTM Operating Layer 被误做成普通客户 CRM | reserved-only gating；文档与 guardrail 明确普通租户不可见 |
| 贡献记录被误解为确定付款 | 使用“应计候选 / 结算提案 / 人工复核”文案 |
| proof pack 变成过度宣传 | proof-before-claim；public asset 审批 |
| 诊断被误解为结果承诺 | 强制 boundary / prerequisite / dependency / non-commitment notes |
| 与 existing commercial / settlement 模块重复 | Phase 1 只做 read model，复用 existing program / referral / portal / settlement truth |
| 过早行业化 | 垂直行业对象后置到 Vertical version 或 tenant custom extension |

## 14. 当前边界

- 这不是普通客户租户功能。
- 这不是 CRM replacement。
- 这不是 AI 培训平台。
- 这不是自动营销系统。
- 这不是自动结算系统。
- 这不是股权或分红系统。
- 这不是承诺客户结果的 sales machine。
- 它是 Helm reserved tenant 的自营 GTM 操作层，用 Helm 的 judgement-first、decision-first、proof-backed 和 review-before-commitment 方式把增长、交付、证据、贡献和结算治理收进同一条闭环。
