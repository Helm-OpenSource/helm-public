---
status: draft / design-direction-approved-by-owner
owner: helm-core
created: 2026-09-15
review_after: 2026-10-15
public_safety: Public-safe, customer-neutral Core specification for running
  Helm CAIO on live tenant data: owner operator entry points, a pull-based
  on-premises inference job queue, operating-context snapshot runtime with
  deterministic detectors, rule-authorized execution with guardian stop and
  release-mutex pause, and scheduler runtime pause/rerun. It contains no
  customer data, private endpoint, credential, production receipt,
  deployment approval, activation, or production-readiness claim.
---

# Helm CAIO 实时经营运行 Core 规格

> English title: Core Specification for Running Helm CAIO on Live Tenant Data

## 1. 目的与边界

本规格把已成形的 CAIO 公共参考实现（Stage 1 Owner Loop、CAIO 治理 mandate、模型准入与出域治理、
访问网关）推进到"在真实租户数据上持续运行"所需的 Core 通用能力。客户专属的数据源、检测器、动作适配与
部署在各自私有 overlay 规格中定义，本文不引用任何客户。

本文是规格，不是实现、部署、激活或经营价值证明。所有新增能力默认关闭。

owner 已批准的设计方向（客户无关部分）：

| 编号 | 决定 |
|---|---|
| D-1 | 部署形态：租户生产应用为唯一记录与执行权威；推理由客户现场设备上的本地模型完成，设备只主动发起连接（拉取式） |
| D-2 | 成熟度目标覆盖到 Authorized Execute，分阶段放行；每阶段独立开关、独立回滚 |
| D-3 | 执行授权方式：CEO 预先签发的限额规则（standing rule），规则边界内自动执行，越界回到 CEO |
| D-4 | 干跑证据门槛由各动作类的 Pack 合同声明；Core 不硬编码门槛，也不放宽任何既有 Pack 合同 |
| D-5 | 签发的规则只是授权证据之一，不直接授予运行时权限；执行仍经既有权限、政策与执行前复核链 |

## 2. 现状基线与缺口

| 能力 | 已成形 | 缺口 |
|---|---|---|
| 数据资产目录与观察运行 | 契约、持久化、阶段回执、并发控制（`lib/stage1-owner-loop/data-asset-catalog.*`、`observation.service.ts`） | 除测试夹具外无任何生产入口 |
| G0 初始化验收门 | 评估记录、CEO 受理、撤销（`caio-initialization-gate-store.service.ts`） | 无生产入口 |
| CAIO mandate 与身份绑定 | `registerCaioPrincipalBinding`、mandate 草稿/激活、guardian 急停与 CEO 恢复（`lib/caio-governance/mandate-store.service.ts`） | 无生产入口；治理 ADR 规定绑定登记为 OWNER 手工、可审计动作 |
| 十题组合与 CEO 选择 | 生成（经 Pack provider）、选择回执、决策记录绑定（`caio-operating-question-store.service.ts`） | 选择仅经 WorkBuddy 网关运行时可达；`/caio` 读出只读；STATUS 记载的执行回执校验并发降级缺陷需确认是否已闭合 |
| 模型准入与出域 | route policy、调用前决策、调用回执、受治理网关（`lib/llm/`）；部署形态已含 `local` 与 `customer_premises` | 无真实 provider adapter；无拉取式现场推理的调度与回写路径 |
| 访问网关 | 双 audience 令牌仅存哈希、来源绑定、限速、吊销（`lib/caio-access-gateway/`） | 无推理任务专用 audience 与操作 |
| 经营上下文快照 | P3a 公共合同（`TemporalOperatingContextSnapshot`） | 无运行时投影、无检测器框架 |
| 调度器 | `lib/signal-collection/scheduler.ts` 按启动时配置运行 | 无运行时暂停、无受控手动补跑 |
| 授权执行 | 治理 ADR 中为 `roadmap_disabled` | 无规则账本、签发、急停、编排与执行前复核框架 |

## 3. OWNER 操作入口（P0 前置）

为 §2 中无生产入口的服务提供受治理入口：

- 形态：服务端动作与受控 CLI 二选一由实现计划决定；两者都必须经服务端 active membership 判定、
  OWNER-only、写审计、幂等键、闭集错误码。
- 覆盖：身份绑定登记与吊销；mandate 草稿、激活、暂停、撤销；guardian 指定；数据资产目录条目与各阶段回执；
  观察程序、观察来源与运行；G0 评估记录、CEO 受理与撤销。
- 不变式：CEO 身份不从 `WorkspaceRole.OWNER` 推导；绑定登记仍是 OWNER 手工动作，入口只提供受治理的
  录入与校验；入口本身不构成任何运行时权限。

## 4. 拉取式现场推理

### 4.1 任务队列

- 新表记录推理任务：`workspaceId`、任务类（快检不入队；小时诊断、日终复盘）、输入快照引用与内容哈希、
  模型路由引用、状态（`queued / claimed / completed / rejected / expired / dead_letter`）、租约、
  尝试次数、调用前 `ModelRouteDecision` 与 `ModelEgressReceipt` 引用。
- 生产侧只有两个操作：领取任务（CAS claim + 租约）、提交判断（校验租约、输入哈希、输出契约）。
- 领取即出域授权截止点（沿用出域治理"dispatch claim 是授权截止点"）；租约到期回收，已提交的判断不重复计入，
  只对账不盲重发。

### 4.2 设备侧 worker

- 位于 `tools/`，与 `caio-admin`、`caio-connect` 同类；只持推理 audience 令牌，不持有任何生产数据库或业务凭据。
- 流程：领取 → 调用本机 OpenAI 兼容本地模型 → 按闭集输出契约组装判断 → 提交。
- 本地模型登记为 `deploymentForm=local`、`jurisdiction=customer_premises` 的 route，并有 adapter readiness 回执。

### 4.3 输出契约与拒收

- 判断包分层：`facts`（每条必须引用输入快照内存在的证据编号）、`inferences`、`risks`、`unknowns`、
  `suggestedActions`（只能是规则草案或干跑请求，不能是执行）。
- 格式错误、引用不存在的证据、越出闭集 → 整包拒收并记闭集原因，不部分采纳。
- 判断正文中的自由文本只作数据，不作指令。

### 4.4 访问网关扩展

新增推理 audience：令牌仅存哈希、来源绑定、期限、限速、即时吊销；只允许 §4.1 的两个操作；
请求大小上限；请求内不做重活。令牌签发与吊销走 §3 的 OWNER 入口。

## 5. 经营上下文快照运行时与检测器框架

- 快照投影器：按租户私有 overlay 注册的"数据域 → 查询模板"生成 P3a `TemporalOperatingContextSnapshot`，
  每个指标带时间窗、分母、来源、查询模板编号、结果摘要、新鲜度、冲突与未知状态；读失败标未知，不当 0。
- 快照只含聚合指标、不透明引用与闭集原因码；不含个人级原始数据。
- 检测器框架：确定性、可测试的检测器由 overlay 注册；输出候选异常（检测器编号、严重度、证据引用、合并键）；
  同一合并键在窗口内合并。
- 节奏：快检（不用模型，默认 10 分钟）、小时诊断与日终复盘（入 §4 队列）由调度器触发。
- 数据域读失败或过期时，依赖该域的检测器与规则停止触发。

## 6. 授权执行（Authorized Execute）

### 6.1 规则账本

- 规则草案字段：动作类、触发检测器、边界（单次上限、每日次数、时间窗、资产范围引用）、回滚方式、
  预期效果与观察指标、所引用的 Pack 合同版本。
- 状态：`draft → dry_run → evidence_ready → signed → active → paused → expired → revoked`；
  `paused` 细分原因（见 §6.4），不同原因的恢复路径不同。
- 签发：CEO 本人经已登记的 principal binding 签发；带有效期（默认最长 7 天）；不从任何既有 owner approval
  或 mandate 继承；CAIO 不能签发。

### 6.2 干跑与证据

- 干跑按真实触发条件计算"本来会做什么"，不写业务状态；记录越界、执行前复核结果与事后指标。
- 证据门槛（窗口、次数、偏差率及其"且/或"组合）由动作类的 Pack 合同声明，Core 只执行 Pack 合同返回的判定；
  既有 Pack 合同（例如限额自动指派）保持原判定，不因本框架放宽。

### 6.3 执行链（D-5）

签发的规则是授权证据之一。每次执行必须依次通过：

1. 规则处于 `active`、未过期、无生效急停；
2. 既有权限链：active membership、角色与 capability、对象归属、entitlement；
3. 既有政策与合规门；
4. 动作类适配器的执行前实时复核（由 overlay 提供）；
5. 执行者 lease 与幂等键；
6. 由既有 Core ingress 写唯一 canonical `ExecutionReceipt`，事后核验效果。

任一环节拒绝 → 不执行；越界、复核拒绝、效果异常 → 规则进入 `paused(auto_health)` 并通知 CEO。
提交结果未知 → 保持未知并对账，不重试放大，未确认前不再对同一目标执行。

### 6.4 暂停、急停与恢复

| 暂停原因 | 谁可触发 | 如何恢复 |
|---|---|---|
| `guardian_stop`（全局 / 动作类 / 单条规则） | CEO 或 CEO 指定的 guardian | 仅 CEO 本人（沿用既有 guardian 急停合同） |
| `auto_health`（越界、复核拒绝、效果异常） | 系统 | 规则健康恢复后由 CEO 确认 |
| `expired` | 系统 | CEO 续签 |
| `release_mutex`（租户发布切换期间） | 发布链 | 切换完成且开关读回正常后**只解除本原因**；同时存在任何其它暂停原因时不得自动恢复 |

急停不停观察与复盘；急停不是技术回滚。

### 6.5 编排

编排只在单条规则内按顺序调用动作适配器，不跨规则组合、不自动生成新规则；跨规则编排仍为路线图。

## 7. 调度器运行时暂停与补跑

- 新增作业运行时覆盖记录：暂停 / 恢复、受控手动补跑（带幂等键、窗口与原因）。
- 仅对登记为"无外部副作用"的作业开放；登记由 overlay 提供并随组合校验。
- 覆盖记录不改变作业的启动配置开关；配置开关关闭时覆盖无效（开关优先）。

## 8. 前置修复与选题入口

- 确认 STATUS 中记载的执行回执校验并发降级缺陷状态；未闭合则修复后才开放任何远程或界面变更入口。
- `/caio` 增加 CEO 选题入口（复用 `selectCaioOperatingQuestions`），硬前置为当前 accepted G0 assessment 与
  CEO acceptance receipt；缺失时入口 fail closed 并说明原因。

## 9. 治理 ADR 修订要点（O-6）

在 `docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md` 增加"规则授权执行治理决定"一节，冻结：

1. 签发的限额规则是授权证据之一，**不是权限令牌**，不直接授予运行时权限；执行仍经既有权限、政策与执行前复核链
   （与"CAIO 角色/授权对象不是权限令牌"不变式一致）。
2. 签发只能由 CEO 显式完成，不从既有 owner approval 或 mandate 继承。
3. guardian 只停不启；恢复权仅属于 CEO。
4. 发布互斥暂停不覆盖急停、到期与健康暂停。
5. 干跑门槛由 Pack 合同声明，Core 不放宽既有合同。
6. 成熟度阶段仍不作为权限轴；`Authorized Execute` 的证据状态在 §6 实现并有证据前保持 `roadmap_disabled`，
   本节只记录设计决定，不改变当前口径。

## 10. 验证

- 纯契约与确定性验证器单测，含关键保证的变异反证。
- 隔离 MySQL 集成测试：任务领取并发与租约回收、规则签发与执行的 CAS 与幂等、暂停原因叠加与恢复规则、
  提交结果未知的对账。
- 合成纵向闭环：快检 → 诊断 → 十题 → 选题 → 待办 → 规则草案 → 干跑 → 签发 → 限额执行 → canonical 回执 →
  guardian 急停 → CEO 恢复 → 发布互斥暂停不覆盖急停。
- `check:caio-terminology` 与 `check:boundaries` 保持通过；`Authorized Execute` 口径在实现证据前不变。

## 11. 分阶段

| 阶段 | Core 交付 | 放行门 |
|---|---|---|
| P0 | §3 OWNER 入口；§5 快照运行时与检测器框架 | 合成数据端到端；影子运行零写入 |
| P1 | §4 拉取式推理；§8 前置修复与选题入口 | accepted G0 + CEO acceptance receipt 存在；推理离线降级验证 |
| P2 | 实施计划到待办的运行化、SLA 与升级 | 一个选中问题走完待办 → 回执 → 验收 |
| P3 | §6 授权执行；§7 调度器暂停补跑；ADR 证据状态随证据更新 | 各动作类按其 Pack 合同门槛单独放行并经 CEO 签发 |
