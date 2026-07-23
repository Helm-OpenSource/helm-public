---
status: active / implementation-plan
owner: helm-core
created: 2026-07-23
review_after: 2026-08-23
public_safety: Public-safe CAIO Pro implementation plan. It contains no customer data, credential, private connector configuration, model secret, production endpoint, deployment receipt, commercial commitment, owner approval, or production activation.
---

# Helm CAIO Pro 实施主计划

> **语言 / Language**：中文权威版；English reference follows.

## 1. 计划结论

本计划把 [Helm CAIO Pro 产品与实施需求](../product/HELM_CAIO_PRO_IMPLEMENTATION_REQUIREMENTS.md)
拆成可独立评审、可验证、可回滚的跨仓实施批次。实施目标不是一次性“接管企业”，
而是建立一条证据连续的受治理演进路径：

```text
安装 CAIO Pro
-> 全量盘点企业数据资产
-> 逐资产分级、授权、连接和初始化
-> 通过初始化门 G0
-> CAIO 基于证据生成恰好 10 个经营问题
-> CEO 选择 0-3 个
-> 每题形成定制实施与 30 天验证
-> Observe / Advise / Supervise 闭环
-> 按动作类别评估后续成熟度
```

本计划冻结五项执行规则：

1. `helm-public` 先补通用契约、确定性门禁和 public-safe 合成闭环，不能等待客户
   Overlay 才定义核心语义。
2. `helm-packs` 只提供行业对象、指标、通用映射和 OPC 行业方法；不能承接客户配置。
3. `helm-overlays` 保存客户资产目录、授权引用、连接配置和模型准入；不能反向污染 Core。
4. `helm-control-plane` 记录设备、BOM、版本、健康、部署和回执真值；不能保存业务原文。
5. 每一批只声明自己的证据等级。代码、合成演示、组合包、部署和客户价值结果互不替代。

## 2. 依赖关系

```text
P0 需求、ADR 与仓库真值
 |
 v
P1 公共契约与确定性验证器
 |
 +--------------------+
 |                    |
 v                    v
P2 合成纵向闭环       P3 CAIO Pro 节点与设备治理
 |                    |
 +----------+---------+
            |
            v
P4 客户数据资产盘点与逐源接入
            |
            v
P5 初始化 G0 与 Company Memory / 经营上下文
            |
            v
P6 10 题生成与 CEO 选 0-3 题
            |
            v
P7 每题定制实施与 30 天价值验证
            |
            v
P8 复盘、能力沉淀与下一成熟度评估
```

并行规则：

- P1 完成后，P2 与 P3 可以并行。
- Context Agent、模型路由和移动端可以分支并行，但必须在 P4/P5 集成前通过各自门禁。
- 真实客户接入不得先于 P1/P2 的契约和合成闭环。
- 任何生产激活必须等待 Overlay、Control Plane 与客户侧运行回执，不能由 Public PR 代替。

## 3. 当前基线

### 3.1 已存在并复用

`helm-public` 当前已经具备：

- CAIO 术语、mandate 治理记录与非授权边界；
- `EnterpriseObservationProgram`；
- 通用 `ObservationSource` 和四种只读访问模式；
- 不可静默覆盖的 `ObservationSourceRun`；
- `OwnerQuestionPacket` / `EvidenceAnswerPacket`；
- `DecisionRecord` / `SupervisionSignalRecord`；
- Work Packet、ExecutionReceipt、独立验收和结构化拒绝链；
- Company Memory 候选机制；
- `TemporalOperatingContextSnapshot`；
- `LLMModelCatalog`、provider registry、`ModelCapabilityProfile`；
- rich-local / remote-projected 上下文边界；
- Stage 1 OWNER-only 只读参考面。

### 3.2 明确缺口

需要新增或升级：

- 连接前的 `DataAssetCatalog`；
- 资产分级、授权、连接和初始化的阶段回执；
- 初始化完成门 `G0`；
- 恰好 10 题的候选组合与确定性质量门；
- CEO 选择 0-3 题的不可歧义回执；
- 题目到现有决策督办链的绑定；
- 租户级模型准入、地域、数据处置和 `ModelEgressReceipt`；
- Context Agent 的逐人同意、暂停、撤销和删除回执；
- CAIO Pro 设备身份、备份、恢复和无人值守运行证据；
- CEO 手机应用和最小化通知中继；
- OPC 真实接入 Runbook、客户 Overlay 和 Control Plane 生产真值。

### 3.3 当前不得声明

- 不得声明 Helm 已支持所有企业系统的生产连接器。
- 不得声明模型目录中的每个 provider 已具有可用 adapter 或客户准入。
- 不得声明 Mac Studio SKU 已采购、已交付或已通过无人值守恢复。
- 不得声明 Context Agent 已获得任何员工同意。
- 不得声明已形成完整企业世界模型。
- 不得声明 10 个经营问题、3 个课题或 30 天价值结果已经在客户现场成立。

### 3.4 复用扫描与“不重复造轮子”决策

2026-07-23 在实施 G0 前完成了 Helm 既有能力和主流开源项目的代码级扫描。没有发现
可以直接替代 Helm G0 的现成实现：通用数据目录和数据质量项目不能处理
“客户绑定 CEO 验收、CAIO 治理身份、全源只读边界、Company Memory 和经营上下文重放”
这一组合语义。因此本计划采用“复用现有 Helm 原语、借鉴开源契约、不引入第二个平台”。

| 来源 | 可复用内容 | 本计划采用方式 | 明确不采用 |
|---|---|---|---|
| Helm Operating Harness P3 readiness | 规范化 JSON、证据和政策哈希、确定性评估、可重放检查、`ready` 不等于 owner approval | 直接复用 `canonicalJson`、`sha256` 和报告绑定模式 | 不复制第二套哈希或 readiness 框架 |
| Helm CAIO mandate store | CEO principal binding、owner-only 注册、事务锁、append-only ledger、原子 claim | 直接复用身份验证、事务和审计模式 | 不把 G0 回执当权限令牌 |
| [OpenLineage](https://github.com/OpenLineage/OpenLineage) | Run 状态、Job/Run/Dataset 分离、可扩展 facets | 映射观察批次状态并保留扩展元数据位；不改变 Helm 既有 `ObservationSourceRun` 真值 | 不部署独立 lineage 服务 |
| [Dagster asset checks](https://github.com/dagster-io/dagster/blob/master/python_modules/dagster/dagster/_core/definitions/asset_checks/asset_check_result.py) | 检查结果的 `passed`、severity、description 和 metadata 分离；freshness 的 `PASS/WARN/FAIL/UNKNOWN` | G0 每项检查保留机器结果、严重度、原因和证据；来源健康保留 unknown，而不是折算成成功 | 不引入 Dagster 编排运行时 |
| [Great Expectations Checkpoint](https://docs.greatexpectations.io/docs/reference/api/checkpoint_class/) | 检查定义、运行结果和后续 action 分离 | `CaioInitializationAssessment` 只评估；`CaioInitializationGateReceipt` 单独记录验收/撤销 | 不允许评估器自行生成客户验收 |
| [DataHub assertions](https://github.com/datahub-project/datahub/blob/master/metadata-models/src/main/pegasus/com/linkedin/assertion/AssertionInfo.pdl) | assertion type、source、更新时间、描述和运行事件分离 | 为 G0 检查保留 check code、来源绑定、policy revision 和运行时间 | 不复制 DataHub 元数据图或 Assertion 平台 |
| [OpenMetadata lineage](https://docs.open-metadata.org/latest/how-to-guides/data-lineage/explore) | owner/domain/schema、质量结果和 lineage 同屏解释 | 作为目录投影和证据下钻的展示语义参考 | 不把 Public Core 变成另一套企业数据目录 |
| [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs) | policy revision、input、result、decision id、脱敏和审计 | G0 绑定 policy ref/hash、输入快照 hash、结果和脱敏后的 gap codes；未来可加可选 OPA adapter | V1 不新增 OPA sidecar 或 Rego 依赖 |
| [in-toto Attestation Statement](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md) | subject digest 与 predicate type/payload 分离 | assessment/receipt 绑定不可变主体摘要和类型化结论 | V1 不引入签名供应链工具或把普通回执宣称为密码学签名 |

第二轮扫描覆盖了来源连接、文档抽取、企业图谱、桌面上下文和可靠编排。结论仍是
“可选择性复用 adapter 或算法组件，不引入第二套真值、权限或工作流控制面”。

| 来源 | 可学习或复用内容 | CAIO Pro 决策 | 采用前的硬门 |
|---|---|---|---|
| [Airbyte Connector Builder / CDK](https://docs.airbyte.com/platform/connector-development) | REST、GraphQL 等来源的声明式连接器、增量游标、schema discovery 和连接器测试方法 | 作为长尾 SaaS 只读 adapter 的候选实现方式；输出必须转换成 `ObservationSourceRun` 和来源回执 | 逐连接器核验许可证、只读能力、凭据处理、数据落点和失败隔离；不启用 destination 写入面 |
| [Meltano Singer SDK](https://sdk.meltano.com/en/main/index.html) | Tap/Stream、认证、分页、schema、增量复制和标准化测试 | 当单个来源适合轻量 Python Tap 时，可作为 Airbyte 之外的 adapter 候选 | Tap 只能在逐源授权范围内读取；不得让 Singer state 取代 Helm 来源状态和回执真值 |
| [Apache Tika](https://tika.apache.org/) | 统一检测并流式抽取大量文件类型的文本和元数据 | 作为本地文档基础解析器候选，优先处理通用 Office、PDF、邮件和归档格式 | 必须有文件大小、页数、解压炸弹、超时、沙箱、加密文件和恶意文档隔离门 |
| [Microsoft MarkItDown](https://github.com/microsoft/markitdown) | 将 Office、PDF、图片、音频和结构化文件转换为适合 LLM 的 Markdown；插件默认关闭 | 作为本地轻量格式转换和结构保留候选，不作为高保真或唯一解析器 | 只调用最窄的本地流接口；继承进程权限，故必须在最小权限 worker 中运行并禁用未审插件和网络 URL |
| [Unstructured open source](https://docs.unstructured.io/open-source/introduction/overview) | 文档 partition、element metadata、cleaning 和语义 chunking | 仅用于离线评测或难文档的候选解析后端；先和 Tika/MarkItDown 在固定评测集对拍 | 官方明确开源库不是生产方案，且缺少认证、增量加载、调度和监控；不得把实验通过写成生产可用 |
| [Microsoft GraphRAG](https://microsoft.github.io/graphrag/) | 从文本派生实体、关系、claims、community summaries，并支持全局问题检索 | 作为可重建的 Company Memory / 经营世界模型派生索引候选；原始证据和 Helm 时间化对象仍是真值 | 每条图节点和结论必须保留 evidence ref、时间、冲突和失效状态；图谱不得授予权限或替代原系统事实 |
| [Temporal](https://docs.temporal.io/workflow-execution) | 可恢复的长事务、事件历史、重放、重试、取消和长时间运行 workflow | 暂不引入；只有现有任务/回执链无法满足断点续跑、补偿和规模要求时再做独立 ADR 与对拍 | 不得形成第二套业务状态机；Workflow History 只能承载执行可靠性，Helm 业务对象和回执仍是唯一经营真值 |
| [Screenpipe](https://github.com/screenpipe/screenpipe) | 本地优先、事件触发采集、可访问性树优先/OCR 回退、应用与窗口过滤、时间化搜索 | 只学习桌面 Context Agent 的采集与过滤设计，不直接嵌入当前代码 | 当前主分支为商业许可，未取得商业授权前禁止复制、嵌入或客户部署；持续屏幕/音频采集还必须逐员工授权、可见、可暂停、可删除 |

V1 的依赖决策：

1. 不增加上述项目的 npm、容器或服务依赖；
2. 先把外部成熟语义映射到 Helm 已有对象，保持一套运行真值；
3. 未来连接器若原生输出 OpenLineage、DataHub、OpenMetadata 或 Great Expectations 结果，
   通过 adapter 转成 Helm evidence ref 和 observation receipt，而不是反向改变 Core 模型；
4. 文档解析器必须通过同一份合成与脱敏评测集比较结构保真、表格、OCR、失败隔离、
   资源消耗和证据定位，不能因为“支持格式多”直接成为默认解析器；
5. 桌面 Context Agent 默认不持续采集屏幕、音频或键盘；任何新增采集面都必须独立授权、
   常驻可见、按应用/窗口过滤、可暂停、可删除并生成回执；
6. 新增外部 adapter 必须单独评审许可证、版本、数据出域、故障隔离和客户部署成本。

## 4. 交付对象与总体验收

### 4.1 产品交付对象

V1 只有一个产品 SKU：

```text
Helm CAIO Pro
```

参考硬件是 Apple Mac Studio。具体采购 SKU、供货、税务、维保和商业定价属于
Control Plane / 商业交付决策，不由 Public Core 文档构成承诺。

### 4.2 技术交付对象

完整交付由六类对象组成：

1. Public Core 契约、验证器和 review-first 运行服务；
2. CAIO Pro Node 可恢复软件组合；
3. 行业 Pack 与通用映射；
4. 客户 Overlay、逐源授权和私有配置；
5. Control Plane BOM、版本、健康、部署和回执索引；
6. OPC 现场实施、初始化验收和 30 天价值复盘。

### 4.3 总体验收

只有以下证据同时存在，才可把某个客户标为完成 V1：

- 客户确认的数据资产盘点回执；
- 每个资产的分级、授权、连接或例外状态；
- G0 初始化验收回执；
- 10 题候选回执；
- CEO 0-3 题选择回执；
- 每个已选题的实施计划和基线；
- 至少一条完整决策监督链；
- 30 天结果回执；
- 设备、备份、恢复和安全验收；
- Overlay、BOM、镜像、版本和运行健康真值；
- 无边界事故或已完成事故处置。

## 5. P0：需求、ADR 与仓库真值

### 5.1 目标

冻结产品、治理、阶段、数据和跨仓边界，防止各线程按不同产品理解实施。

### 5.2 任务

| ID | 仓库 | 任务 | 退出标准 |
|---|---|---|---|
| P0-01 | `helm-public` | 发布 CAIO Pro 需求与本实施计划 | 文档进入公开索引和状态真值；public docs gate 通过 |
| P0-02 | `helm-public` | 对齐既有 CAIO ADR、Stage 1 方法和本计划术语 | 无成熟度/权限轴混淆；CAIO mandate 仍非权限令牌 |
| P0-03 | 四仓 | 形成 owner/模块映射表 | 每个新对象只有一个权威仓库 |
| P0-04 | 四仓 | 建立证据等级词汇 | local-only、PR、merged、package、runtime、owner/value truth 分开 |

### 5.3 验证

```bash
npm run check:public-docs
npm run check:caio-terminology
npm run check:stage1-owner-loop
npm run check:boundaries
```

### 5.4 回滚

P0 只改公开文档和状态索引。回滚删除新增索引与文档即可，不改变运行时。

## 6. P1：Public Core 公共契约与持久化

### 6.1 P1A 数据资产目录

新增通用契约：

```text
DataAssetCatalogEntry
DataAssetClassificationReceipt
DataAssetAuthorizationReceipt
DataAssetConnectionReceipt
DataAssetInitializationReceipt
```

核心约束：

- `assetId` 在 workspace 内唯一；
- 每次状态变化采用版本号或 compare-and-set，防止并发覆盖；
- 盘点不等于授权，授权不等于连接，连接不等于初始化；
- `restricted + local_only` 是未分类默认值；
- P1A 合入后的新 `ObservationSource` 注册必须引用一个已授权的资产目录条目；
- 撤销授权后禁止启动新观察，但保留不可变历史回执；
- 连接凭据只保存 secret reference，不保存 secret value。

既有 `ObservationSource` 行早于 `DataAssetCatalog`，不能被新守卫直接误杀。迁移采用
nullable 关联；可确认来源通过受控 backfill 绑定目录条目，无法确认的历史行生成显式兼容
例外回执并禁止扩大能力。只有新注册和完成 backfill 的行适用强制引用门。

建议位置：

- `lib/stage1-owner-loop/data-asset-catalog.types.ts`
- `lib/stage1-owner-loop/data-asset-catalog.contract.ts`
- `lib/stage1-owner-loop/data-asset-catalog.service.ts`
- `prisma/schema.prisma`
- 独立 additive migration

必测场景：

- 跨 workspace 引用失败；
- 未分类资产不能远程投影；
- 未授权资产不能注册 ObservationSource；
- 双重授权/连接并发只产生一个有效版本；
- 撤销后新 run fail-closed；
- 历史回执不可被删除或降级。

### 6.2 P1B 初始化门 G0

新增：

```text
CaioInitializationAssessment
CaioInitializationGateReceipt
```

G0 必须从目录和运行记录确定性派生，不允许调用方直接填写 `passed=true`。评估器至少计算：

- 已知资产盘点覆盖；
- 资产状态完整性；
- 已授权且技术可行资产初始化率；
- 已连接来源健康率；
- 未连接例外完整性；
- 敏感度和处理处置完整性；
- 证据可回溯抽样；
- Company Memory / 经营上下文可重建状态；
- 是否发现写路径；
- 客户验收引用。

`CaioInitializationGateReceipt` 只允许：

- `not_ready`
- `ready_for_owner_acceptance`
- `accepted`
- `revoked`

`ready_for_owner_acceptance` 不等于 `accepted`。只有客户绑定身份完成验收，才能触发 10 题生成。
Gate receipt 采用 append-only 版本；`revoked` 是该版本终态，不能原地恢复。重新初始化和
重新验收必须绑定新的 assessment 并生成新的 gate receipt。

### 6.3 P1C 经营问题候选与 CEO 选择

新增：

```text
CaioOperatingQuestionCandidate
CaioOperatingQuestionPortfolio
CaioOperatingQuestionGenerationReceipt
CaioQuestionSelectionReceipt
CaioOperatingQuestionImplementationPlan
```

确定性验证器必须保证：

- Portfolio 恰好 10 个唯一候选；
- 每个候选有 facts / inferences / unknowns / conflicts 和 evidence refs；
- 不允许把空 evidence、模板占位或无来源金额写成经营价值事实；
- 证据不能诚实支持 10 题时只生成 `insufficient_evidence` generation receipt 和缺口报告，
  不生成不足 10 题或模板填充的 Portfolio；
- G0 未 accepted 时拒绝生成或保存；
- 同一 workspace + accepted G0 receipt version 只有一个当前有效 Portfolio；并发生成通过
  唯一 claim / compare-and-set 收敛，重生成显式 supersede 旧版本；
- CEO 选择数量为 0-3；
- 选择者必须是已绑定 CEO principal；
- 一次选择回执对应一个 portfolio hash；
- 选择修改产生新版本，旧回执不可覆盖；
- 未选择题目只留在观察池；
- 选中题目绑定现有 `DecisionRecord`，不创建第二套决策对象。
- 每个选中题目与 `DecisionRecord` 在同一事务中形成一份
  `CaioOperatingQuestionImplementationPlan`；初始计划只记录实施目标、基线、成功指标、
  适配范围、治理边界和显式缺口，`authorityEffect` 与 `workPacketEffect` 均为 `none`。

### 6.4 P1D 模型准入与出域回执

在既有模型基座上新增：

```text
TenantModelRoutePolicy
ModelEgressReceipt
ModelRouteDecision
```

必须满足：

- 未登记模型、未知版本或未知地域默认 disabled；
- task class、敏感度、处理处置、地域和 provider 条款共同决定 route；
- fallback 的部署形态、地域、允许敏感度、处理处置、留存、训练使用、workflow、费用和
  并发上限必须逐维相同或更严格；不可比较或任一维更宽即 fail-closed；
- 境内 route 不得静默 fallback 到境外；
- 远程调用前必须生成绑定 policy hash 的 route decision；
- 调用后写入成功、失败、部分或未知回执；
- receipt 只含证据引用和摘要哈希，不含原始内容；
- provider adapter 就绪与 model catalog 展示是两个独立状态。

### 6.5 P1E Context Agent 同意与删除

新增公共契约：

```text
ContextAgentInvitation
ContextAgentConsentReceipt
ContextAgentScopeRevision
ContextAgentCollectionReceipt
ContextAgentPauseReceipt
ContextAgentRevocationReceipt
ContextAgentDeletionReceipt
```

必须满足：

- 默认未参与；
- 员工本人确认，不允许管理员代点；
- scope 按设备、目录、企业应用和用途表达；
- scope 扩大必须重新同意；
- 暂停立即阻止新采集；
- 撤销触发索引、缓存和派生向量的删除工作包；
- 删除工作包沿 evidence refs 扫描 Company Memory 候选、`OBSERVED` 事实和经营上下文；
  只依赖被撤销来源的派生内容删除或标记 `evidence_invalidated`，多来源内容重算证据覆盖；
- 删除必须有成功、失败、部分或未知回执；
- 参与状态不得进入绩效或人员排名输入。

### 6.6 P1 提交切片

建议拆为 5 个独立堆叠 PR：

1. P1A contracts + validators；
2. P1A persistence + services；
3. P1B G0 evaluator + receipt；
4. P1C portfolio + selection；
5. P1D/P1E 分别独立 PR，不互相堆叠。

每个迁移 PR 必须：

- additive；
- 新列可空或具备明确 backfill；
- 保持单一 MySQL `prisma/schema.prisma`；
- 用一次性空库执行 `DATABASE_URL=<ephemeral-empty-db> npx tsx prisma/setup-db.ts prepare`；
- migration replay 与 schema diff 对账；
- 不删除未知残留表；
- 有并发和历史兼容测试。

新回执表默认采用 `onDelete: Restrict` 或等价保全策略。若 workspace 退役确实需要删除，
必须先定义独立退役回执和保留例外，不能依赖 cascade 静默抹除历史。

## 7. P2：Public-safe 合成纵向闭环

### 7.1 目标

在不接真实企业数据、真实模型密钥或生产连接器的条件下，证明以下链路可以实际重放：

```text
合成企业资产目录
-> 逐资产分级与授权
-> 合成只读来源运行
-> G0
-> 10 个证据化问题
-> CEO 选择 0-3 个
-> Decision Record
-> Work Packet
-> ExecutionReceipt
-> 独立验收
-> Decision Evaluation
-> OBSERVED Memory candidate
```

### 7.2 合成 fixture

至少覆盖：

- 12 个以上不同 source kind，证明来源不受三类限制；
- 文档、数据库、代码、消息、音频等不同数据形态；
- `public/internal/confidential/restricted` 四级敏感度；
- `prohibited/local_only/remote_projected` 三种处置；
- 至少 1 个未授权资产；
- 至少 1 个技术阻塞资产；
- 至少 1 个 stale 来源；
- 至少 1 组冲突事实；
- 至少 1 个 Context Agent 撤销和删除；
- 至少 1 次模型 route 被 fail-closed 拒绝。

### 7.3 专项完整性门

新增建议命令：

```bash
npm run check:caio-pro-v1
```

实施前先确认当前 public mirror/projector 对 `package.json` 的权威生成路径；若该文件由
投影器管理，应修改权威源并重建投影，不能直接在生成产物上长期维护脚本入口。

命令应验证：

- 需求文档和状态索引存在；
- 新契约的 closed enums 和 mandatory fields；
- G0 不能由 caller 自报；
- 成功 Portfolio 必须等于 10；证据不足只能生成 `insufficient_evidence` 并阻止选题；
- Selection 必须小于等于 3；
- mandate 不进入 auth / permission / runtime route；
- Public 默认不能激活外部副作用；
- synthetic fixture 不含 PII、secret、private endpoint 或客户标识；
- E2E 证据包哈希可重放。

### 7.4 UI 参考面

Stage 1 Console 增加 feature-flagged 只读/复核优先模块：

- 数据资产覆盖漏斗；
- G0 初始化状态与盲区；
- 10 个经营问题候选；
- CEO 选择 0-3 题；
- 每题决策、监督和回执状态；
- 模型 route 和出域摘要；
- Context Agent 参与与撤销状态摘要。

任何选择、确认或治理操作都必须走 server-side 身份和 workspace 校验，不能依赖 UI 隐藏。

### 7.5 P2 退出门

- 合成 E2E 可从空库运行；
- 并发选题/派工只产生一个有效对象；
- 已验证回执不会被后续重执行降级；
- 远程 route 错误时无原文泄露；
- 页面桌面和移动 viewport 无重叠；
- STATUS 只标记“合成参考闭环已成形”，不标记客户或生产成立。

## 8. P3：CAIO Pro 节点、设备与 Control Plane

### 8.1 P3A 设备定义

`helm-control-plane` 建立 CAIO Pro 设备/BOM 契约，至少记录：

- product key 和硬件 reference profile；
- 主机序列号哈希或设备 alias，不公开真实序列号；
- CPU/GPU/内存/磁盘/网络能力；
- UPS 与备份目标状态；
- OS、容器/运行时和 CAIO 软件版本；
- 设备证书引用；
- 客户 workspace / deployment registry 绑定；
- 最近健康、备份和恢复演练回执；
- 激活、暂停、退役和证书吊销状态。

### 8.2 P3B 软件组合

建立可复现 build-time BOM：

- pinned `helm-public`；
- 选定 Packs；
- 客户 Overlay；
- 本地索引和检索组件；
- 批准的本地模型及 runtime；
- 出站通知中继；
- 健康、备份、审计和升级组件。

BOM 不能携带客户凭据或数据。镜像构建成功不等于客户部署成功。

### 8.3 P3C 安装与恢复

交付 Runbook 至少覆盖：

- 开箱与物料核验；
- FileVault / 全盘加密；
- 最小管理员和服务身份；
- 设备证书签发；
- 默认拒绝公网入站；
- 来源与模型 endpoint allowlist；
- UPS 安全关机；
- 断电后启动；
- 无人值守恢复限制；
- 日增量和周完整备份；
- 主机替换；
- 证书吊销和设备退役；
- 恢复点和恢复时间实测。

### 8.4 P3 退出门

- 组合构建可重放；
- 软件物料和校验值有非 secret 回执；
- 断电、服务崩溃、磁盘容量和模型不可达演练通过；
- 备份恢复到替代节点并验证治理真值；
- 没有公网入站依赖；
- Control Plane 状态与实际运行回执一致；
- owner 明确接受 Mac Studio 无 BMC 的残余限制。

## 9. P4：OPC 数据资产盘点与逐源接入

### 9.1 第一周

第一周目标是完成资产目录，不是完成所有连接，也不要求 CEO 预先定义经营问题。

OPC 执行：

1. 与 CEO 确认观察目的、组织边界、期限、可见性和急停；
2. 访谈数据、IT、安全、法务和业务 owner；
3. 扫描系统清单、合同清单、应用目录和数据地图；
4. 登记文档、数据库、代码、SaaS、CRM、ERP、财务、OA、IM、BI、会议、客服等资产；
5. 确认每项业务 owner、技术 owner、数据形态、敏感度和驻留要求；
6. 标记重复、废弃、孤儿和未知系统；
7. 形成授权顺序、连接方式、预计工期和阻塞；
8. 由客户确认本期目录覆盖回执。

第一周交付：

- 数据资产目录；
- owner map；
- 数据分级初判；
- 授权和连接 backlog；
- 高风险/禁止资产清单；
- 盲区和依赖；
- 首批连接器实施计划。

### 9.2 连接优先级

不按“来源越少越快”优化，而按价值、依赖和风险分波次：

- Wave A：经营主数据、财务真值、CRM/ERP、组织和项目事实；
- Wave B：文档、会议、企业 IM、客服、合同和业务流程；
- Wave C：代码、研发、设备、现场音视频和长尾系统；
- Wave D：需新连接器、法律评估或供应商配合的阻塞来源。

波次不构成永久排除。只要客户授权且技术可行，后续必须进入初始化。

### 9.3 每源接入步骤

```text
资产登记
-> 分级
-> purpose / scope
-> owner 授权
-> 创建最小权限只读身份
-> 权限验证
-> 连接 dry-run
-> 首次观察
-> 字段与对象映射
-> 数据质量验收
-> 初始化回执
-> 持续健康监控
```

每个来源必须有独立停止和撤销能力。单来源失败不阻断其他来源，也不能被静默忽略。

### 9.4 OPC 与 Builder 分工

- OPC：盘点、授权协调、现场连接、映射、验收和问题回执；
- FDE：复杂系统适配、性能和数据质量问题；
- Builder：通用连接器、公共契约、Pack 模型和工具；
- 客户 owner：授权、数据定义和例外接受；
- Helm CAIO：不得代替任何人签发授权。

## 10. P5：初始化 G0

### 10.1 初始化流水线

每个已授权来源完成：

- 首次基线运行；
- schema/metadata discovery；
- 字段与企业对象映射；
- 增量策略；
- 去重和实体解析；
- 时间对齐；
- 冲突与未知标记；
- Company Memory 候选；
- 经营上下文重放；
- 证据问答抽样；
- 盲区更新。

### 10.2 G0 前审查

系统生成 `ready_for_owner_acceptance` 后，OPC 只核对：

- 目录是否存在静默遗漏；
- 已授权技术可行项是否全部完成；
- 例外是否有原因、owner 和计划；
- 证据是否可回溯；
- 远程出域是否符合处置；
- 是否存在任何写路径；
- Company Memory 和经营上下文能否重建。

OPC 不能代 CEO 或客户授权人接受 G0。

### 10.3 G0 撤销

若关键来源授权撤销、覆盖显著下降、数据质量失效或发现越权，G0 必须降级。已生成的
10 题保留历史版本，但不能作为当前事实继续派生新实施任务，直到重新验收。

## 11. P6：10 题生成与 CEO 选择

### 11.1 生成方法

CAIO 从企业经营上下文生成候选池，再通过确定性门排序和去重：

```text
经营信号与异常
-> 问题候选
-> 证据/冲突/未知补全
-> 价值与可干预性评估
-> 风险与实施成本评估
-> 跨业务域去重
-> 反证与多轮复核
-> 证据充足：恰好 10 个 Portfolio
-> 证据不足：insufficient_evidence + 缺口报告
```

模型可以提出候选和解释，但以下必须由确定性验证器完成：

- 数量等于 10；
- ID 与标题唯一；
- evidence refs 可解析；
- unsupported 数字声明拒绝；
- 不包含禁止数据；
- 不把建议写成承诺；
- 不把功能列表写成经营问题。

同一 accepted G0 receipt 只能对应一个当前 Portfolio。并发生成通过唯一 claim 收敛；
重生成采用 CAS 并显式 supersede 旧版本，不允许两个 Portfolio 同时作为 CEO 选择真值。

### 11.2 候选组合要求

10 题不预设固定部门配额，但应防止单一来源或单一模型偏置。组合至少显示：

- 题目覆盖的业务域；
- 证据来源分布；
- 经营价值；
- 紧迫度；
- 可干预性；
- 闭环可测量性；
- 风险和实施成本；
- 数据盲区；
- 反证和替代解释。

### 11.3 CEO 选择

CEO 可以：

- 选择 0-3 个；
- 调整题目表述；
- 修改目标和成功指标；
- 指定禁止动作；
- 延后或全部不选；
- 要求 CAIO 在新证据后重生成。

系统不得通过默认勾选、倒计时或“完成 onboarding”压力迫使 CEO 选满 3 个。

### 11.4 选题后物化

每个选中题：

1. 创建 `OperatingQuestionImplementationPlan`；
2. 绑定现有 `DecisionRecord`；
3. 指定 owner、reviewer、基线、指标和时间窗；
4. 配置报告、监督信号和升级条件；
5. 确定 Pack / Overlay / connector 需求；
6. 确定模型 route 和数据处置；
7. 经 CEO 确认后才生成首个 Work Packet。

## 12. P7：每题定制实施与 30 天价值验证

### 12.1 D1-D3：定义与基线

- 冻结题目、目标、指标和禁止动作；
- 建立基线窗口与数据质量说明；
- 确认责任人、验收者和升级对象；
- 配置题目专属 evidence set；
- 明确成功、失败和停止条件。

### 12.2 D4-D10：能力适配

- 完成缺失来源补强；
- 配置行业 Pack；
- 在 Overlay 中保存客户专属规则；
- 形成日报和监督信号；
- 完成模型 route shadow；
- 完成误报、漏报和敏感内容校准。

### 12.3 D11-D20：真实运行

- CAIO 观察并生成建议；
- CEO 接受、拒绝或修改建议；
- 形成 Decision Record；
- 派发受治理 Work Packet；
- 跟踪阻塞和升级；
- 收集 ExecutionReceipt；
- 由非执行者验收高风险事项；
- rejected 原因结构化回流。

### 12.4 D21-D30：复盘

- 对比基线与结果；
- 区分相关与因果；
- 评估证据覆盖和回执质量；
- 复盘 CEO 决策采纳、修改和拒绝；
- 识别可复用 Pack 资产；
- 识别客户专属 Overlay；
- 提出继续、调整、停止或进入 shadow 的建议。

### 12.5 单题价值回执

至少包含：

- 基线和结果窗口；
- 指标定义与数据来源；
- 变化值和置信度；
- CAIO 建议与 CEO 决策；
- 执行和验收回执；
- 反事实与外部因素；
- 直接价值、避免损失、效率或风险降低；
- 未证明部分；
- 后续建议；
- owner 结论。

禁止把模型输出数量、token 使用量、报告篇数或“连接了多少系统”直接当作经营价值。

## 13. P8：沉淀与成熟度演进

### 13.1 沉淀规则

- 通用治理契约和验证器进入 `helm-public`；
- 行业对象、指标、流程和通用连接映射进入 `helm-packs`；
- 客户配置、规则、rich context 和真实授权留在 `helm-overlays`；
- BOM、部署、健康和运行回执索引进入 `helm-control-plane`；
- 真实客户原文、凭据和业务 payload 不进入任何公开仓。

### 13.2 成熟度晋级

V1 默认 Observe / Advise / Supervise。后续只能按动作类别晋级：

```text
Observe
-> Advise
-> Supervise
-> Orchestrate
-> Authorized Execute
```

晋级要求：

- 有稳定、可信回执；
- shadow 对拍持续通过；
- 权限、政策、预算、时段、渠道和模型版本均明确；
- 越界 fail-closed 已实测；
- 有 kill switch、回滚和恢复；
- CEO/owner 逐类别授权；
- 监管要求人工介入的事项保持人工门控。

CAIO mandate、硬件存在或 CEO 直属关系都不能自动提升成熟度。

## 14. 模型实施专项

### 14.1 支持矩阵

对每个 provider/model 分开记录：

- cataloged；
- adapter implemented；
- contract verified；
- customer allowlisted；
- region approved；
- retention/training terms approved；
- shadow evaluated；
- production activated。

只有最后一项为真时，才能描述为该客户生产可用。

### 14.2 基准评测

模型切换前使用同一组：

- 证据问答；
- 冲突识别；
- 经营问题提出；
- 反证；
- 报告摘要；
- 敏感数据投影；
- 拒答；
- 提示注入；
- 中文语音问题理解。

评测输出：

- groundedness；
- evidence precision / recall；
- unsupported claim rate；
- refusal correctness；
- latency；
- cost；
- data route compliance；
- reviewer preference；
- regression。

### 14.3 路由回滚

- 保留上一版本 policy；
- 新模型先 shadow；
- 出现边界事故立即 disable；
- fallback 不得扩大地域或数据权限；
- route 回滚不回写已产生的历史回执。

## 15. Context Agent 实施专项

### 15.1 最小客户端

只需要：

- 邀请与本人同意；
- 目录/应用范围选择；
- 当前采集状态；
- 最近采集、索引和出域摘要；
- 暂停；
- 撤销；
- 删除请求及回执；
- 本地错误与支持入口。

不需要员工聊天、绩效、排名、截屏或键盘监控。

### 15.2 数据路径

```text
授权目录/企业应用
-> 本地发现
-> 排除 secret / personal / prohibited
-> 本地解析与指纹
-> 最小必要快照或索引
-> CAIO Node
-> governed evidence
```

Context Agent 不直接调用远程模型。远程推理仍由 CAIO Node 经过 tenant route policy。

### 15.3 删除验证

撤销后检查：

- 新采集为零；
- 本地队列停止；
- Node 索引删除；
- 缓存删除；
- 派生向量删除；
- 沿 evidence refs 删除或失效仅依赖该 Context Agent 的 Company Memory 候选和
  `OBSERVED` 事实；
- 重算仍有其他有效来源支持的 Company Memory 和经营上下文；
- 不可变治理回执保留但不含原文；
- 备份中的到期删除按政策执行；
- 删除失败项有 owner 和重试。

## 16. CEO 电脑与手机体验

### 16.1 控制塔首页

首屏顺序：

1. 当前经营状态和数据截止时间；
2. 需要 CEO 判断；
3. 关键异常与阻塞；
4. 3 个已选课题的状态；
5. 来源覆盖、盲区和模型 route；
6. 报告与历史证据。

不做营销式 hero，不把所有模块做成卡片墙。

### 16.2 实时问答

每次回答支持：

- 文字或语音输入；
- 回答；
- 事实/推断/未知/冲突分层；
- 证据下钻；
- 数据截止时间；
- 使用模型与 route 摘要；
- 追问；
- 生成建议草案；
- 拒答和原因。

### 16.3 移动端

V1 先保证：

- 安全登录与设备绑定；
- 文字/语音提问；
- 报告；
- 关键预警；
- 建议复核；
- 返回安全控制面的深链；
- push 最小化。

原生 iOS 或响应式/PWA 的最终选择在实施 Gate M1 决定，不影响公共契约。

## 17. 测试矩阵

### 17.1 契约与状态

- closed enum；
- 必填字段；
- cross-workspace；
- stale authorization；
- revoke；
- CAS 并发；
- idempotency；
- immutable receipt；
- unsupported transition；
- historical row compatibility。

### 17.2 安全

- 未分类数据；
- restricted 数据；
- secret/PII scanner；
- prompt injection；
- provider allowlist；
- region fallback；
- Context Agent 代同意；
- 删除失败；
- credential leakage；
- public-safe scan。

### 17.3 业务闭环

- 资产 -> 来源 -> run；
- G0；
- 10 题；
- 选 0、1、2、3 题；
- 选 4 题失败；
- Decision -> Work Packet；
- execution -> receipt -> independent verification；
- rejected/blocked/expired 回流；
- G0 降级后阻止新物化。

### 17.4 设备与恢复

- 断电；
- UPS；
- 服务崩溃；
- 网络隔离；
- provider 不可达；
- 磁盘空间；
- 备份损坏；
- 替代设备恢复；
- 证书吊销；
- 退役擦除。

### 17.5 用户体验

- desktop/mobile viewport；
- keyboard navigation；
- screen reader labels；
- 长文本和中英文；
- loading/empty/error/stale/partial；
- 无重叠和布局漂移；
- 确认与撤销防误触。

## 18. 验证命令

### 18.1 `helm-public`

每个切片按影响面运行：

```bash
npm run typecheck
npm run lint
npm run check:public-docs
npm run check:caio-terminology
npm run check:stage1-owner-loop
npm run check:boundaries
npm run test
npm run build
```

数据库改动增加：

```bash
DATABASE_URL=<ephemeral-empty-db> npx tsx prisma/setup-db.ts prepare
```

不得对共享或生产数据库运行 reset。

### 18.2 `helm-packs`

```bash
npm run validate:pack
npm run audit:staging
npm run release:readiness
```

### 18.3 `helm-overlays`

```bash
npm run validate:overlay
npm run audit:staging
npm run release:readiness
```

### 18.4 `helm-control-plane`

```bash
npm run validate:bom
npm run validate:deployment-registry
npm run validate:env-contract
npm run release:readiness
```

最终发布另需 operator preflight、component readiness、release final report 和 owner gate。

## 19. PR 与评审规则

### 19.1 PR 原则

- 一个 PR 只解决一个可验收问题；
- 堆叠 PR 明确 base；
- PR body 写当前真值、非声明、迁移、验证和回滚；
- 每个行为改动有测试；
- 每个 schema 改动有空库重放；
- 每个 UI 改动有 desktop/mobile 验证；
- 每个外部数据或模型路径有 fail-closed 测试；
- 每个跨仓批次先合下游公共契约，再合消费者。

### 19.2 独立评审

每个高风险批次至少经过：

1. 实施者自查；
2. 独立 Claude / Codex 静态 review；
3. 精确 CI；
4. owner 对边界和商业含义复核；
5. 生产前 operator preflight。

独立评审优先证伪：

- 状态机原子性；
- 并发双写；
- 授权和身份；
- 数据出域；
- 删除和撤销；
- 依赖方向；
- 迁移安全；
- STATUS 诚实性。

## 20. 里程碑

### M0：公共计划成立

- 需求、计划、索引和 STATUS 合入；
- 无运行时声明；
- owner 确认产品冻结项。

### M1：公共契约与合成闭环

- P1/P2 完成；
- `check:caio-pro-v1` 通过；
- 从空库重放；
- 合成 10 题与选 0-3 题；
- 仍无客户生产声明。

### M2：CAIO Pro 节点可交付

- 设备/BOM/镜像/备份/恢复成立；
- 不是客户激活。

### M3：客户初始化完成

- 第一周资产目录完成；
- 所有本期已授权技术可行来源初始化；
- G0 accepted；
- 10 题生成。

### M4：首批 0-3 题启动

- CEO 选择回执；
- 每题基线、指标和实施计划；
- 30 天计时开始。

### M5：价值验证完成

- 至少一条完整闭环；
- 每题价值回执；
- owner 做继续/调整/停止决定；
- 后续成熟度仍按动作类别另行授权。

## 21. 90 天参考节奏

本节是参考排程，不替代实际依赖。若数据资产复杂，T0 可超过 30 天，不能为了日期
跳过来源或伪造 G0。

### 第 1-30 天：公共基座与设备工程

- P0-P2；
- P3A/P3B；
- 合成 E2E；
- OPC 模板和连接器 backlog；
- Context Agent 与模型路由公共契约。

### 第 31-60 天：客户 T0

- 部署 CAIO Pro；
- 第一周资产盘点；
- 逐源授权和接入；
- Context Agent 小范围自愿试点；
- 模型 shadow；
- Company Memory 和经营上下文初始化；
- G0 验收。

### 第 61-90 天：10 题、选题与价值验证

- CAIO 生成 10 题；
- CEO 选择 0-3 题；
- 进入每题 30 天验证；
- 完成至少一轮决策监督闭环；
- 形成价值与后续成熟度建议。

若 G0 在第 60 天后才通过，30 天价值验证顺延，不压缩。

## 22. 关键风险与缓解

| 风险 | 失败表现 | 缓解 |
|---|---|---|
| “全部数据”被理解为超级管理员 | 过度授权、无法审计 | 四阶段目录；逐源 owner；独立只读身份 |
| 初始化无限延长 | 一直不能产生价值 | 波次接入、例外透明、G0 明确、首批课题依赖分析 |
| 10 题变成模板营销 | 无企业证据 | G0 后生成、证据绑定、反证、确定性质量门 |
| CEO 选题成为隐性承诺 | 自动派工或强迫选满 | 0-3、无默认勾选、选择回执、CEO 再确认 |
| 模型切换导致数据越界 | 境外或训练用途扩大 | 租户 route policy、shadow、egress receipt、fail-closed fallback |
| Context Agent 破坏员工信任 | 静默采集、绩效用途 | 本人同意、可见性、撤销删除、不报复约束 |
| Mac Studio 无 BMC | 断电后无人恢复 | UPS、自动启动、恢复演练、残余限制接受 |
| Core/Pack/Overlay 混层 | 客户逻辑进入公开仓 | 四仓 owner 表、PR 边界检查、组合 gate |
| 文档先于产品 | 对外过度宣称 | STATUS 分档；runtime/owner/value truth 分开 |
| 回执质量低 | 飞轮学习错误 | 结构化回执、证据 ref、独立验收、拒绝回流 |

## 23. Owner 决策门

以下决策不阻塞公共契约，但必须在对应里程碑前完成：

| Gate | 最晚时间 | 需决定 |
|---|---|---|
| H1 | M2 前 | 首发采购配置最终采用 4TB 还是更高本地存储；备份目标和维保方式 |
| M1 | 移动端实施前 | 原生 iOS、响应式 Web 或 PWA；强认证和 push 服务 |
| D1 | 客户 T0 前 | 客户观察目的、组织边界、期限、数据驻留和急停角色 |
| D2 | 每个来源前 | 来源 owner、敏感度、处置、保留和只读凭据 |
| L1 | 模型 shadow 前 | provider、地域、留存/训练条款、费用和 fallback |
| E1 | Context Agent 前 | 参与人群、用途、范围、员工告知与合法依据 |
| V1 | G0 后 | CEO 选择 0-3 个经营问题及每题指标 |
| R1 | 30 天后 | 继续、调整、停止或进入下一成熟度 |

## 24. 下一步立即执行清单

1. 合入 P0 文档切片。
2. 为 P1A-P1E 分别建立 issue / task owner。
3. 先实现 `DataAssetCatalog` 与 G0，不先做移动端视觉。
4. 同步建立 CAIO Pro Control Plane 设备/BOM ADR。
5. 用 synthetic fixture 证明 12+ source kind 和 10 题/选 0-3 题。
6. 完成模型 route policy 和 egress receipt 后再接远程模型。
7. 完成员工同意、撤销和删除链后再试点 Context Agent。
8. OPC 在首个客户现场先做一周资产盘点，再进入逐源接入。
9. G0 accepted 后才生成 10 题并启动 30 天验证。
10. 每个里程碑更新 `docs/STATUS.md`，只声明已有证据。

---

## English Reference

This plan turns the Helm CAIO Pro requirements into staged, reviewable,
testable and reversible work across `helm-public`, `helm-packs`,
`helm-overlays` and `helm-control-plane`.

The critical sequence is: install the customer-controlled CAIO Pro node,
inventory the full known data estate, classify and authorize each source,
connect every in-scope authorized and technically feasible source, pass the G0
initialization gate, generate exactly ten evidence-grounded operating
questions, let the CEO select zero to three, and only then start the
question-specific 30-day value validation.

Public Core remains review-first and grants no execution authority. A CAIO
mandate, hardware delivery, model-catalog entry or CEO reporting line never
acts as an authorization token. Customer data, credentials, private policies
and production receipts remain in their proper private and control-plane
boundaries.
