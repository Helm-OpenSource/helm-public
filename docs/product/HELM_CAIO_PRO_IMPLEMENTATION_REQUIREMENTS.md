---
status: active / requirements-only
owner: helm-core
created: 2026-07-23
review_after: 2026-08-23
public_safety: Public-safe CAIO Pro product and implementation requirements. This document contains no customer data, credential, private connector configuration, model secret, deployment receipt, production activation, commercial commitment, or legal conclusion.
---

# Helm CAIO Pro V1 产品与实施需求

> **语言 / Language**：中文权威版；English reference follows.

## 1. 结论

Helm CAIO Pro V1 是部署在客户控制环境内、直属并只向 CEO 汇报的一号位 AI
经营中枢。它通过 OPC 现场实施，先盘点并逐源接入企业全部可授权数据资产，完成
Company Memory 与时间化经营上下文初始化，再由 CAIO 基于证据主动提出 10 个经营
问题候选，交 CEO 选择不超过 3 个进入定制实施和 30 天价值验证。

本需求冻结以下产品决定：

1. V1 只发布一款 `Helm CAIO Pro`，硬件载体为 Apple Mac Studio。
2. 数据资产目录追求全覆盖，实际连接不设来源数量上限。
3. CEO 治理授权不替代来源 owner 的技术授权；所有来源逐源、只读、最小权限接入。
4. 原始数据优先留在源系统；CAIO 保存索引、摘要、证据引用、必要缓存和治理回执。
5. 本地完成索引、脱敏、检索、初筛和可承载的推理；复杂推理可调用客户批准的模型。
6. 模型供应商不绑定，可按客户要求切换，但切换不能扩大数据权限或绕过地域门禁。
7. 少量员工 Context Agent 只在逐人明确参与、逐范围授权和可随时撤销的条件下启用。
8. 初始化完成前不要求 CEO 预先定义经营问题；初始化完成后由 CAIO 主动提出 10 个。
9. CEO 最多选择 3 个首批经营课题，并可修改目标、边界、指标和优先级。
10. V1 默认停留在 Observe / Advise / Supervise，不因硬件交付获得自动执行权限。

本文件是需求与实施边界，不证明 CAIO Pro 硬件包、客户连接器、移动端、Context
Agent、模型网关、真实企业初始化或 30 天价值结果已经成立。

## 2. 产品目标

### 2.1 用户与责任关系

核心用户是企业 CEO。CAIO 的目标不是为所有员工增加一个聊天入口，而是帮助 CEO：

- 看清企业当前发生了什么；
- 区分事实、推断、未知和冲突；
- 发现跨系统、跨部门和跨时间的经营问题；
- 获得有证据、有时效、有风险说明的决策建议；
- 监督选定经营课题的执行、回执、验收和结果；
- 持续扩展可观察、可判断和可治理的企业 AI 边界。

CAIO 是产品角色，不是法定高管身份。CEO 仍承担最终经营和法律责任；来源 owner、
合规责任人和员工的法定权利不因 CAIO 存在而消失。

### 2.2 V1 成功定义

V1 成功必须同时满足：

1. 本期企业数据资产目录经客户确认达到 100% 盘点覆盖。
2. 所有本期已授权且技术可行的来源完成初始化，例外项均有 owner、原因和处置计划。
3. CEO 可以从回答、日报、周报和经营问题候选中下钻到证据、时效、冲突和盲区。
4. CAIO 生成恰好 10 个非模板化经营问题候选，每个都有证据和价值假设。
5. CEO 可选择 0 至 3 个问题，未选择不产生实施任务或隐性承诺。
6. 每个已选课题形成至少一条“观察 -> 建议 -> CEO 决策 -> 督办 -> 回执 -> 复盘”链。
7. 没有未授权读取、源系统写入、隐性员工采集、未分类数据出域或无回执完成宣称。

### 2.3 非目标

V1 不建设：

- 通用 ERP、CRM、OA、BI 或企业即时通信替代品；
- 一次性集中复制所有企业原始数据的数据湖；
- 以超级管理员账号换取“全量接入”的捷径；
- 面向全员的强制桌面监控软件；
- 自动外发、自动承诺、自动资金或法律动作；
- 无证据的“完整企业世界模型”；
- 绑定单一模型供应商的封闭产品。

## 3. 角色与职责

| 角色 | 负责 | 不负责 |
|---|---|---|
| CEO | 签发 CAIO 治理 mandate、选择经营课题、确认关键建议、持有恢复权 | 以总授权替代来源授权、绕过法律/政策/人员同意 |
| 来源 owner | 确认来源范围、只读权限、时效、保留和撤销 | 提供个人账号、写权限或无边界管理员权限 |
| 监护角色 | 紧急停止 CAIO、升级重大风险 | 恢复 CAIO、代 CEO 选择经营课题 |
| OPC | 现场盘点、分级建议、连接实施、数据映射、初始化和验收 | 代客户授权、读取无关数据、保管明文凭据 |
| FDE / Builder | 补通用连接器、契约、评测、Pack 和复杂问题能力 | 把客户专属配置写入 Public Core |
| 员工参与者 | 自愿启用 Context Agent、选择范围、暂停、撤销和查阅记录 | 替第三方授权、被管理员静默扩权 |
| CAIO | 观察、证据化回答、诊断、建议、监督和候选记忆 | 把建议当承诺、把 mandate 当权限令牌 |
| 系统管理员 | 网络、设备、备份、证书和运行健康 | 查看不在其运维职责内的业务原文 |

## 4. 物理与逻辑架构

```text
企业源系统与员工授权终端
        |
        | 独立只读凭据 / 受控快照 / Context Agent
        v
Helm CAIO Pro Node（客户控制环境）
  - 数据资产目录与授权索引
  - 本地索引、脱敏、检索与初筛
  - Company Memory
  - 时间化经营上下文
  - 决策、监督与回执链
  - 模型路由与出域门禁
        |
        | 仅出站、最小化、可审计投影
        v
客户批准的本地 / 私有部署 / 境内云 / 境外云模型

CEO 电脑控制面 <-> CAIO Pro Node -> 出站通知中继 -> CEO 手机应用
```

### 4.1 CAIO Pro Node

首发参考硬件为：

- Apple Mac Studio（2025）；
- M3 Ultra；
- 256GB 统一内存；
- 4TB 内置 SSD；
- 10Gb Ethernet。

Apple 当前公开规格支持 M3 Ultra 配置 256GB 统一内存、2TB 至 16TB SSD 和
10Gb Ethernet。采购时必须再次核对可售 SKU，不能把本文件当供应可用性承诺。
参考：[Apple Mac Studio (2025) 技术规格](https://support.apple.com/en-us/122211)。

CAIO Pro 交付不是一台裸机，最低物料包括：

- Mac Studio 主机；
- 满足主机与备份设备安全关机窗口的 UPS；
- 客户控制的加密备份介质或加密 NAS 目标；
- 唯一设备身份与证书；
- 首次配置和恢复工具包；
- 设备清单、版本清单和校验回执；
- 不开放公网入站端口的出站管理与健康上报路径。

### 4.2 CEO 控制面

CEO 电脑上的控制面至少提供：

- CAIO 当前阶段、mandate、来源覆盖和盲区；
- 实时问答；
- 日报、周报、月报；
- 10 个经营问题候选和最多 3 个选择入口；
- 建议的接受、拒绝、延期和原因回执；
- 监督信号、阻塞、超时和回执状态；
- 急停、暂停和恢复请求的治理入口；
- 证据、时效、冲突、未知和模型路由下钻。

控制面不是源系统权限入口。它不得展示或缓存明文连接器凭据。

### 4.3 CEO 手机应用

手机应用至少提供：

- 文字和语音提问；
- 日报、周报、月报阅读；
- 关键异常、阻塞和建议提醒；
- 建议决策和治理操作的强认证入口；
- 证据摘要与返回安全控制面的深链。

锁屏推送只携带低敏元数据，不携带客户原文、金额明细、人员隐私或完整建议。
移动端通过 CAIO Node 主动建立的出站通道获取内容；V1 不要求向企业内网开放公网
入站端口。

## 5. 数据资产全覆盖

### 5.1 “全覆盖”的准确含义

全覆盖分为四层：

```text
已盘点
-> 已分级
-> 已授权
-> 已连接并初始化
```

- **目录覆盖必须尽可能完整**：W1 盘点企业已知文档、数据库、代码库、SaaS、CRM、
  ERP、财务、OA、企业即时通信、BI、客服、项目、合同和其他经营系统。
- **技术连接逐源推进**：只连接已经分级、获得来源 owner 授权且具备最小权限读路径的来源。
- **未连接不是隐身**：未授权、技术阻塞、质量不足和明确排除的资产都必须显示为盲区。
- **不设来源数量上限**：来源数量只用于容量规划，不作为价值验收指标。

### 5.2 `DataAssetCatalog` 要求

`DataAssetCatalog` 是观察来源之前的企业资产目录，不替代现有
`ObservationSource`。每个目录条目至少包含：

- `assetId`、`workspaceRef`、`sourceSystemRef`；
- 资产名称、来源类别、业务域和业务 owner；
- 数据形态：结构化、半结构化、文档、代码、消息、音频或其他；
- 敏感等级：`public | internal | confidential | restricted`；
- 处理处置：`prohibited | local_only | remote_projected`；
- 盘点、分级、授权、连接和初始化状态；
- 目的、scope、授权与人员同意引用；
- 推荐访问模式和连接器引用；
- retention、freshness SLA 和数据驻留要求；
- 当前盲区、阻塞原因、风险 owner 和下一复核时间；
- 与 `ObservationSource`、运行批次和证据引用的关联。

目录登记不需要连接器凭据。资产被盘点不代表被授权或已接入。

### 5.3 来源访问模式

继续复用 Public Core 已存在的四种只读模式：

- `read_only_api`
- `read_only_replica`
- `scheduled_snapshot`
- `file_snapshot`

员工 Context Agent 是 `file_snapshot` / `scheduled_snapshot` 的受治理采集适配器，
不因运行在员工设备上获得新的权限语义。

### 5.4 每源独立授权

每个实际连接来源必须同时具备：

1. 有效 `EnterpriseObservationProgram`；
2. 来源 owner 的技术授权引用；
3. 独立、最小权限、只读的 service account 或 scoped token；
4. 明确的目的、范围、期限、敏感等级和保留规则；
5. 可执行的暂停、撤销和删除路径；
6. 连接前凭据权限验证和连接后抽样验收。

禁止：

- 使用 CEO 的全局权限自动生成全部来源凭据；
- 使用个人账号、共享管理员账号或无边界 domain-admin 凭据；
- 为方便检索而增加源系统写权限；
- 把原始凭据存入 Public Core、日志、回执或聊天记录。

### 5.5 来源运行与健康

每次观察继续产生不可静默覆盖的 `ObservationSourceRun`。来源健康至少包括：

- 上次成功时间；
- 观察窗口；
- completeness；
- freshness；
- success / partial / failure / unknown；
- 证据引用和结构化错误码；
- 当前授权版本；
- 同步延迟和连续失败次数。

一个来源成功连接过一次不等于健康。来源 stale、partial 或 unknown 时，CAIO 必须
降低相关回答和诊断的置信度。

## 6. 初始化与企业理解

### 6.1 初始化阶段

初始化是 30 天价值验证前的独立前置阶段，包括：

1. 企业数据资产目录盘点；
2. 分级确认、逐源授权和连接；
3. 首次完整或基线快照；
4. schema、字段和业务对象映射；
5. 本地索引、去重、实体解析和时间对齐；
6. 来源血缘、时效、冲突和未知标记；
7. Company Memory 候选构建；
8. `TemporalOperatingContextSnapshot` 初始生成；
9. 证据化问答抽样；
10. 盲区和剩余风险确认。

### 6.2 初始化完成门 `G0`

只有以下条件同时满足，才进入 10 题生成：

- 客户确认目录盘点覆盖本期已知数据资产；
- 每个资产都有明确状态，不存在静默遗漏；
- 所有本期已授权且技术可行的资产已连接并完成首次运行；
- 未连接资产有原因、owner、风险和后续计划；
- 已连接来源健康率达到 95%，或例外已由客户确认；
- 证据引用抽查可回溯到来源、授权版本和观察批次；
- 四级敏感度和处理处置已确认；
- 未分类数据按 `restricted + local_only` 处理；
- Company Memory 和经营上下文可重建；
- 未发现源系统写入路径；
- 客户签署初始化验收回执。

“全部接入”指本期已授权、技术可行资产完成初始化，不允许通过隐藏阻塞项制造
完成结论。

### 6.3 Company Memory

Company Memory 继续复用 `MemoryFact`、`ArtifactBundle` 和候选晋升机制。它至少包含：

- 经证据支持的企业事实；
- 生效和失效时间；
- 规则、政策和流程；
- 决策、原因和结果；
- Work Packet、执行回执和验收；
- 事实冲突、未知和待确认项；
- 每条内容的来源、授权、敏感度和可见范围。

系统推断默认进入 `OBSERVED` 候选，不能自动晋升为正式事实。

### 6.4 时间化经营上下文

V1 继续使用 `TemporalOperatingContextSnapshot`，不另建第二套世界模型。上下文至少覆盖：

- 客户、渠道和商机；
- 产品、订单、合同和收入；
- 项目、交付、验收和回款；
- 人员、角色、任务和协作关系；
- 资产、成本、现金和经营风险；
- 规则、流程、承诺和结果。

任何关系必须携带时间和证据。无法确认的关系保持未知；对外只表述为“经营上下文”
或“企业理解基线”，不提前宣称完整企业世界模型。

## 7. 数据分级与处理处置

### 7.1 四级敏感度

Public Core 已定义：

- `public`
- `internal`
- `confidential`
- `restricted`

OPC 可提出分级建议，最终由客户逐资产确认。未确认资产默认 `restricted`。

### 7.2 三种处理处置

敏感度和处理处置是两个不同维度：

- `prohibited`：不索引、不检索、不进入模型或报告；
- `local_only`：仅在 CAIO Pro Node 内处理，永不发送到远程模型；
- `remote_projected`：仅允许经过本地最小化、脱敏和投影后的内容调用批准的远程模型。

字段级处置只能比来源默认值更严格，不能更宽松。

### 7.3 Fail-closed

- 未盘点或未分类：`restricted + local_only`；
- 脱敏或投影失败：降为 `local_only` 或拒答；
- 模型路由策略缺失：不调用模型；
- 远程模型不可达：本地降级或明确失败，不发送原文；
- 策略引擎异常：停止所有远程出域，本地只读能力可以继续；
- 发现提示注入或异常上下文选择：隔离该证据，不进入远程 prompt。

## 8. 模型可切换与路由治理

### 8.1 复用现有基座

Public Core 已有：

- `LLMModelCatalog`；
- `provider-registry`；
- `ModelCapabilityProfile`；
- `RichLocalContextBundle`；
- `ContextProjectionReceipt`；
- remote projected / local rich private 边界。

CAIO Pro 不新建平行模型系统，而是在这些契约之上补齐租户级准入、部署地域、
数据处置、供应商条款和调用回执。

模型目录中出现供应商名称不代表对应 adapter、合同、部署或客户准入已经成立。

### 8.2 `TenantModelRoutePolicy`

每个客户必须显式配置：

- 允许的模型和 provider；
- 模型版本或版本范围；
- 部署形态：`local | private_deployment | domestic_cloud | foreign_cloud`；
- 部署地域；
- 允许的 workflow / task class；
- 允许处理的敏感度和处理处置；
- 留存期限、训练使用和删除条款引用；
- token、费用、时延和并发上限；
- 失败回退链；
- 生效、失效、撤销和审批引用。

未知模型或缺少 policy 的模型默认 disabled。

### 8.3 任务级路由

模型不是一个全局下拉框。至少按以下任务角色路由：

- embedding / index；
- extraction / classification；
- redaction / projection；
- retrieval rerank；
- summary / briefing；
- reasoning / counterfactual；
- multi-pass review；
- voice input understanding。

脱敏、数据处置和权限判断必须由确定性策略或已冻结的本地安全模型承担，不得因切换
推理模型改变合规结果。

### 8.4 远程调用回执

每次远程调用产生 `ModelEgressReceipt`，至少记录：

- workspace、task 和 question / decision 引用；
- 模型、provider、版本、部署形态和地域；
- policy snapshot hash；
- 输入敏感度和处理处置；
- 选中与丢弃的 evidence refs；
- 脱敏 / 投影状态和摘要哈希；
- 是否包含原始内容，必须为 `false`；
- 调用时间、结果、时延、费用区间和错误；
- fallback 目标与原因；
- 审计引用。

远程调用不得把本地占位符映射表、原始附件或原始员工文件发送给 provider。

### 8.5 切换规则

客户可以切换模型，但必须：

1. 新模型先进入租户 allowlist；
2. 完成能力、地域、留存和训练条款登记；
3. 通过同一批基准问题的 shadow 对拍；
4. 验证远程投影与回执；
5. 由客户确认切换；
6. 保留可回滚的旧 route policy。

fallback 只能转向权限不更宽的模型。“不更宽”必须逐维比较部署形态、地域、允许敏感度、
处理处置、留存、训练使用、workflow、费用和并发上限；每一维都只能相同或更严格。
任一维不可比较、未知或更宽时，该 fallback 不成立并 fail-closed。境内云失败不得自动
回退到境外云。

## 9. 员工 Context Agent

### 9.1 V1 范围

V1 只允许少量明确参与的员工，在企业管理设备上启用。默认零采集；参与人数和范围
由客户与员工逐人确认。

### 9.2 同意与可见性链

至少包含：

1. 邀请：说明目的、范围、保留、可见人和退出方式；
2. 本人接受：管理员不能代接受；
3. 范围选择：按目录或企业应用逐项授权；
4. 可见采集：员工能查看索引、出域和删除记录；
5. 一键暂停：立即停止新采集；
6. 撤销和删除：按政策清除索引、缓存和派生向量并出具回执；
7. 范围扩大重新确认：新目录、新应用和新用途都产生新的同意事件；
8. 不报复：参与状态不得进入绩效、排名或负面评价。

撤销和删除还必须沿 evidence refs 扫描 Company Memory 候选、`OBSERVED` 事实和下游
经营上下文。只依赖被撤销来源的派生内容必须删除或标记为 `evidence_invalidated` 并停止
参与后续回答；同时有其他有效证据的内容必须重算证据覆盖和置信度。不可变治理回执可以
保留，但不能保留被撤销的原始内容。

### 9.3 默认排除

V1 默认不采集：

- 个人目录；
- 浏览器历史和密码；
- 未经明确范围确认的即时通信内容；
- 私人邮箱；
- 密钥、证书、钱包和密码管理器；
- 医疗、薪酬等未单独批准的高敏数据。

员工本人不能替客户、同事或其他第三方完成个人信息授权。客户仍需根据适用法律和内部
制度确定合法处理依据；本文件不构成法律意见。

## 10. CAIO 首次经营诊断

### 10.1 触发条件

只有 `G0` 通过后，CAIO 才生成首批经营问题。CEO 不需要在初始化前定义 10 至 15
个问题。

### 10.2 `CaioOperatingQuestionPortfolio`

成功的 `CaioOperatingQuestionPortfolio` 必须包含恰好 10 个候选。每个候选至少包含：

- `questionId`、标题和清晰的问题陈述；
- 为什么现在提出；
- 业务域和影响对象；
- facts、inferences、unknowns 和 conflicts；
- evidence refs、freshness 和 confidence；
- 潜在价值及其证据；无法量化时明确未知，禁止编造金额；
- 紧迫度、可干预性和可形成闭环程度；
- 建议的验证指标和基线窗口；
- 建议的首个窄闭环；
- 所需补充数据、实施依赖和风险；
- 不行动的可能后果；
- 生成模型、策略版本和审计引用。

10 个问题按以下维度排序：

- 经营价值；
- 紧迫度；
- 证据强度；
- 可干预性；
- 闭环可测量性；
- 风险和实施成本。

不得使用通用行业模板凑满 10 个，不得隐藏证据不足，也不得把产品功能写成经营问题。
如果证据只能诚实支持少于 10 个候选，系统不得输出一个不足 10 个或被填充的 Portfolio，
而应生成 `insufficient_evidence` 结果和缺口报告，列出缺少的来源、覆盖、时效或冲突处置。
该结果不能进入 CEO 选题，补齐证据并重新通过当前 G0 评估后才能重试。

同一 workspace、同一已验收 G0 回执版本只能有一个当前有效 Portfolio。并发生成必须通过
唯一约束或 compare-and-set 收敛；重生成产生新版本并显式 supersede 旧版本，G0 撤销后
旧 Portfolio 只保留历史审计用途，不能继续生成新实施任务。

### 10.3 CEO 选择

CEO 可以选择 0 至 3 个候选，并可修改：

- 问题表述；
- 目标和成功指标；
- 优先级；
- 实施边界；
- 责任人和复核人；
- 时间窗口；
- 禁止动作。

选择产生 `CaioQuestionSelectionReceipt`。未选择问题进入观察池，不生成 Work Packet，
不计为拒绝，也不影响后续重新排序。

## 11. 三个首批经营课题的定制实施

每个已选问题形成独立 `OperatingQuestionImplementationPlan`：

- 选题和选择回执引用；
- 当前基线；
- 目标与指标；
- 所需来源与当前证据覆盖；
- Pack / Overlay / connector 适配；
- 日报、周报和异常信号；
- Decision Record 和 Supervision Signal 规则；
- Work Packet、回执和验收要求；
- 模型路由和数据处置；
- 人工角色与升级路径；
- 成功、失败、停止和回滚条件；
- 30 天复盘方法。

OPC 负责现场映射和配置；通用能力缺口交 Builder 沉淀到 Core 或 Pack；客户专属规则
留在 Overlay。任何定制不得把客户名称、数据、私有域名、凭据或策略正文带入
`helm-public`。

## 12. CEO 问答、报告与预警

### 12.1 实时问答

回答复用 `OwnerQuestionPacket` / `EvidenceAnswerPacket`，必须分开：

- facts；
- inferences；
- unknowns；
- conflicts；
- evidence refs；
- freshness；
- confidence；
- reviewRequired；
- refusalReason。

来源过期、冲突、越权或证据不足时必须降级或拒答。模型语言流畅度不能提高证据置信度。

### 12.2 报告

- 日报：昨日事实、今日风险、关键阻塞、待 CEO 判断；
- 周报：趋势、偏差、选定课题进展、回执质量、盲区变化；
- 月报：经营主题、决策结果、课题价值、Company Memory 变化和下一阶段建议。

每份报告必须显示数据截止时间、来源覆盖、盲区、模型路由和证据入口。

### 12.3 预警

只有满足客户定义的严重度、持续时间和升级条件时才推送。预警必须包含：

- 发生了什么；
- 为什么重要；
- 事实和推断；
- 证据与时效；
- 影响范围；
- 建议动作；
- CEO 可选择的响应；
- 未知和误报风险。

预警是建议，不是自动指令。

## 13. 安全、运维与恢复

### 13.1 设备安全

- 全盘加密；
- 最小本地管理员；
- 独立服务身份；
- 设备证书和双向认证；
- 凭据只存系统密钥链或客户批准的密钥管理器；
- 禁止凭据进入命令参数、日志、回执和模型上下文；
- 生产服务与人工桌面会话隔离；
- USB、屏幕共享和远程管理策略由客户确认。

### 13.2 网络

- 默认拒绝公网入站；
- 来源连接按目标、端口和用途建立出站或内网 allowlist；
- 远程模型调用只走批准 endpoint；
- DNS、证书和 endpoint 变更可审计；
- 网络不可用时本地只读能力继续，远程调用明确失败。

### 13.3 备份与恢复

至少覆盖：

- 配置、策略、Company Memory、经营上下文、回执和审计；
- 加密、版本化和客户控制的备份目标；
- 日增量、周完整或等效恢复点；
- 恢复演练；
- 主机更换和重新签发设备身份；
- 退役时证书吊销和加密擦除。

索引可从源系统重建，但回执、决策和 Company Memory 不能只依赖重建。

### 13.4 电源与无人值守风险

Mac Studio 不是带 BMC 的机架服务器。V1 必须通过 UPS、自动启动、服务自恢复、健康
上报和现场联系人降低风险，并真实验证：

- 突然断电；
- UPS 低电量安全关机；
- 恢复供电后的启动；
- 磁盘加密解锁与无人值守恢复策略；
- 服务重启和数据一致性；
- 备份恢复。

无法满足客户无人值守要求时，必须记录为部署限制，不能靠文案忽略。

## 14. 非功能需求

### 14.1 可用性

- 已连接来源健康率目标 >=95%；
- CAIO 本地控制面月度可用性目标由商业服务条款另行约定；
- 单来源故障不阻断其他来源；
- 单模型故障不产生越权 fallback；
- 失败必须可见、可定位、可重试或可隔离。

### 14.2 性能

- CEO 常见证据查询 P95 目标 <=5 秒；
- 需要远程深度推理的问题显示进度和来源截止时间；
- 报告生成不阻塞实时预警；
- 大来源必须支持增量同步、断点续传和背压；
- 性能目标以客户数据规模压测结果校准，不作无条件承诺。

### 14.3 可观测性

至少提供：

- 设备和服务健康；
- 来源健康和积压；
- 索引与初始化进度；
- 问答、报告和预警的证据覆盖；
- 模型调用、出域、费用和错误；
- 撤销、删除和权限验证；
- 决策、回执和独立验收；
- 版本、配置和策略变更。

可观测日志不得包含未经治理的原始业务内容。

### 14.4 可恢复性

- 每次发布可回滚；
- schema 迁移可从空库重放；
- 设备替换可恢复治理真值；
- 授权撤销立即阻止新观察；
- 已签名、已哈希和已验收历史回执不可改写。

## 15. 试点阶段与验收

### 15.1 前置初始化期 `T0`

T0 从设备安装开始，到 `G0` 初始化验收通过结束。T0 不计入 30 天价值验证。

第一周必须完成：

- 全部已知数据资产目录盘点；
- 逐资产 owner 和敏感度初判；
- 授权与连接计划；
- 首批连接器实施。

之后持续接入，直到本期已授权且技术可行来源全部完成初始化，或例外项由客户确认。

### 15.2 10 题与选 3 题

`G0` 后：

1. CAIO 生成 10 个经营问题候选，或在证据不足时 fail-closed 并返回缺口报告；
2. OPC 只做证据与边界检查，不代 CAIO 或 CEO 选题；
3. 只有成功的 10 题 Portfolio 才进入 CEO 选择；
4. CEO 选择不超过 3 个并完成定制要求；
5. 选择回执冻结 30 天价值验证的课题范围。

### 15.3 30 天价值验证

- D1-D3：选题确认、基线、指标和实施计划；
- D4-D10：数据补强、Pack / Overlay 适配、日报和监督规则；
- D11-D20：真实 Observe / Advise / Supervise 运行，校准误报和证据；
- D21-D30：至少完成一轮决策监督闭环并形成价值复盘。

### 15.4 量化成功指标

- 数据资产目录确认覆盖率：100%；
- 本期已授权且技术可行来源初始化率：100%；
- 已连接来源健康率：>=95%；
- CEO 问答与报告证据引用抽样可追溯率：100%；
- 成功 Portfolio 的 10 个候选证据覆盖率：100%；
- CEO 选择数量：0-3，系统不得强迫选满；
- 每个已选课题至少形成 1 条有效 Decision Record；
- 30 天内至少形成 2 条有结构化回执的监督闭环；
- 未分类数据出域：0；
- 越权源系统写入：0；
- 未授权模型或跨境调用：0；
- Context Agent 静默采集：0；
- 无外部成功回执却宣称完成：0。

证据抽样采用绑定 G0 assessment hash 的确定性样本：总记录不超过 50 条时全量检查；
超过 50 条时最少检查 50 条，并覆盖每个已连接来源、每个实际存在的敏感等级和每类
CEO 输出。上面的 100% 指样本内所有 evidence ref 均可解析到来源、授权版本和观察批次，
不表示未经检查的全量记录已经逐条人工验真。

### 15.5 立即停止条件

任一条件触发即暂停受影响能力：

- 发生源系统写入；
- 未授权或未分类数据出域；
- 模型调用绕过租户 route policy；
- 员工撤销后仍继续采集；
- 来源 owner 撤销后仍启动新观察；
- 设备证书或凭据疑似泄露；
- 回执链被覆盖、伪造或无法追溯；
- 客户要求急停。

## 16. 四仓所有权

| 仓库 | 本计划中的所有权 |
|---|---|
| `helm-public` | 公共契约、验证器、review-first 服务、合成样板、CAIO/Stage 1 文档和公开评测 |
| `helm-packs` | 行业对象、指标、Pack、通用来源映射和 OPC 行业实施方法 |
| `helm-overlays` | 客户资产目录、真实连接器配置、授权/同意引用、rich local context、模型 allowlist 和私有策略 |
| `helm-control-plane` | 设备/BOM、证书、版本 pin、部署、健康、激活、回滚和生产回执真值 |

`helm-public` 不保存真实客户资产目录、凭据、客户原始内容、模型密钥、私有 endpoint
或生产运行回执。

## 17. 当前 Repo Truth 与差距

截至本文件创建时，Public Core 已有：

- CAIO 术语和治理 ADR；
- `CaioMandate` 与 Advise 决策回执的非权限契约；
- `EnterpriseObservationProgram`；
- 通用 `ObservationSource.sourceKind`，没有三来源数量限制；
- 四种只读访问模式；
- 四级来源敏感度；
- `ObservationSourceRun`；
- `OwnerQuestionPacket` / `EvidenceAnswerPacket`；
- `DecisionRecord` / `SupervisionSignalRecord`；
- Work Packet、ExecutionReceipt 和独立验收链；
- `ModelCapabilityProfile`、provider registry、rich-local / remote-projected 契约；
- Stage 1 只读参考 Console 和 public-safe Runbook。

仍需下一层：

- `DataAssetCatalog` 资产盘点与连接前状态；
- Context Agent 同意、采集和删除回执；
- CAIO Pro Node 镜像、设备身份、备份和恢复；
- 租户级模型地域/条款/数据门禁和 `ModelEgressReceipt`；
- `CaioOperatingQuestionPortfolio` 与 CEO 选题回执；
- 初始化 `G0` 运行门；
- CEO 手机应用和安全通知中继；
- 真实连接器、客户 Overlay、OPC 现场回执和 30 天结果。

因此本文件只能在 `docs/STATUS.md` 标记为“已成形但仍需下一层”。

## 18. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-07-23 | 冻结单一 CAIO Pro 硬件、全资产目录与逐源接入、初始化后生成 10 题、CEO 选择最多 3 题、模型供应商可切换及 Context Agent 自愿参与要求。 |

---

## English Reference

Helm CAIO Pro V1 is a customer-controlled operating-intelligence node that
reports only to the CEO. An OPC inventories the enterprise data estate, then
connects every in-scope, source-owner-authorized and technically feasible source
through independent least-privilege read-only access. Raw data remains
source-resident where possible; the node stores governed indexes, summaries,
evidence references, required caches and immutable receipts.

After initialization gate G0, CAIO proposes exactly ten evidence-grounded
operating questions. The CEO may select zero to three for customer-specific
implementation and a 30-day Observe / Advise / Supervise validation. Model
providers remain replaceable, but every route is constrained by tenant
allowlists, data treatment, deployment region, retention/training terms,
redacted projection and an egress receipt. The document defines requirements
only; it proves neither customer connectivity nor production activation.
