---
status: formed-needs-next-layer
owner: helm-core
created: 2026-07-23
public_safety: Public Core contract and reference-runtime design. No customer policy, credential, payload, provider entitlement, or production receipt.
---

# Helm CAIO 模型准入与数据出域治理

> English title: Helm CAIO Model Admission and Data Egress Governance

## 1. 目的

Helm CAIO 可以按客户需要使用不同模型，但“模型可见”不等于“模型可用”，
“一把手授权”也不自动授予任何远程数据出域权限。本切片把每次模型调用约束为：

```text
数据资产分类与授权
→ 租户模型路由策略
→ provider / adapter 就绪回执
→ 最小化上下文投影
→ 调用前路由决定
→ 单次派发 claim
→ provider 调用
→ 终态回执
→ OWNER-only 脱敏读模型
```

任何步骤缺失、过期、冲突或不可验证时均 fail closed。Public Core 默认没有真实
provider adapter，也不能激活生产调用。

## 2. 范围与非目标

本切片负责：

- 工作区级模型准入策略及不可变版本；
- provider adapter 与精确模型版本的就绪回执；
- task class、数据敏感度、处理处置、地域与供应商条款的确定性路由；
- 调用前不可变 `ModelRouteDecision`；
- 单次派发 claim、并发容量和幂等边界；
- 调用前 UNKNOWN 证据与成功、失败或部分成功的数据库级 append-only 终态
  `ModelEgressReceipt`；
- fallback 逐维“不更宽”比较；
- OWNER-only、无原文和无凭据的治理读模型。

本切片不负责：

- 模型目录展示、合同签署、采购或转售授权；
- 凭据保管和 secret value；
- 原始附件、员工文件、占位符映射表或完整检索上下文的远程传输；
- 客户 Overlay 策略、Control Plane 授权或生产部署；
- WorkBuddy、移动端或其他客户端的运行接线；
- 自动批准、自动承诺、自动外发或源系统写入。

## 3. 公共对象

### 3.1 `ProviderAdapterReadinessReceipt`

不可变证明一个工作区内的精确组合已经被检查：

- provider、model id、model version；
- adapter key、adapter version；
- deployment form、jurisdiction、region；
- endpoint fingerprint 和 credential reference；
- model probe、能力引用、检查时间与失效时间；
- evidence refs 和内容哈希；
- `rawCredentialIncluded=false`。

该回执只证明技术就绪，不证明模型已获租户准入，也不证明 provider 合同、生产
SLA 或客户部署成立。

### 3.2 `TenantModelRoutePolicy`

每次策略语义变化都创建新 revision，策略正文和 hash 不可原地修改。策略至少绑定：

- 生效和失效时间；
- 审批引用及批准主体引用；
- 允许的 route；
- task class、敏感度和处理处置；
- 部署形态、地域、留存、训练用途、供应商/删除条款及其哈希；
- owner 批准的 projector、scanner 和 pricing trust root；
- token、费用、时延和并发上限；
- 显式 fallback 链。

`TenantModelRoutePolicyHead` 只是当前 active revision 的并发指针，不是授权令牌。
撤销会推进 revocation epoch，使旧决定不能被后续派发。

策略激活还必须绑定由当前工作区真人 OWNER 产生的不可变批准回执。策略正文里的
`approvedByRef` 只是被批准内容的一部分，不能自行证明批准已经发生。

### 3.3 `ModelRouteDecision`

任何 provider 调用前必须先写入不可变路由决定。它绑定：

- policy id、policy hash、head version 和 revocation epoch；
- readiness receipt 及 hash；
- task class、数据分类和处理处置；
- 候选、选中和丢弃的 evidence refs；
- context projection receipt 和 projected payload hash；
- prompt injection scan 状态；
- 本次请求的最大输出 token 和是否允许 fallback；
- route snapshot、有效期和拒绝原因；
- parent / fallback 关系。

未找到 active policy、资产未授权、分类未知、处置不允许、投影不完整、就绪过期、
模型或地域不匹配时，仍可留下 blocked decision，但不得 claim 或调用 provider。

### 3.4 `ModelEgressReceipt`

回执链固定为：

```text
sequence 1: pre_dispatch / unknown
sequence 2: terminal / success | failure | partial
```

sequence 1 在任何外部调用前写入。sequence 2 必须绑定同一 decision、claim hash、
gateway、runtime 和前序回执。缺少 sequence 2 时，系统只能表达 `in_doubt`，
不能把调用描述为成功或安全重试。

终态的 provider 受理状态只能是明确的 `accepted` 或 `not_accepted`。`unknown`
永远停留在 `in_doubt`，不得写成 sequence 2，也不得释放并发容量。`accepted`
必须携带脱敏后的 provider request reference hash；`not_accepted` 必须没有该引用
且实际费用为零。

回执只保存 evidence refs、投影 hash 和 provider request reference hash，不保存原始
业务内容。终态还必须保存实际美元微单位成本、`USD` 币种及与 owner 批准 route
完全一致的 pricing version；超预算、缺失或不一致时不得写入终态。数据库约束强制
`rawContentIncluded=false`，并以 UPDATE/DELETE trigger 阻止
`ModelEgressReceipt` 被原地修改或删除。

## 4. 确定性路由

路由判定必须同时检查：

1. 数据资产在同一 workspace；
2. 资产有有效分类和授权回执；
3. 数据的 effective sensitivity 和 processing disposition 可被 route 接受；
4. task class 在 allowlist；
5. 精确 model / adapter / endpoint readiness 未过期；
6. policy 仍 active，且 head version、revocation epoch 未变化；
7. context projection receipt 与选中 evidence 完整绑定，projector/scanner
   registration、hash 和 version 与 route 精确一致；
8. prompt injection scan 已通过；
9. token、投影大小、预估成本和 owner 批准的 pricing contract 未越界。

未知分类默认按 `restricted + local_only` 处理。模型 catalog visibility 单独展示，
不能替代 adapter readiness。

## 5. 派发与并发

`claimModelRouteDispatch` 是唯一允许的 decision mutation：

- 在 serializable transaction 内锁定 workspace policy head；
- 重读 policy、readiness、runtime descriptor 和决定有效期；
- 对 `dispatchClaimedAt=null` 使用条件更新；
- 将 claim 绑定 gateway ref、完整 runtime descriptor、runtime hash、claim hash、
  provider idempotency key 和 lease expiry；
- 同一 route 的未终态 claim 数不得达到 `maxConcurrency`；
- 相同 gateway/runtime 的重放返回原 claim；
- 不同 gateway 或 runtime 的第二次 claim 被拒绝。

dispatch claim 是本次调用的授权截止点：policy 撤销会阻止尚未 claim 的请求，
但不能撤回或“取消发送”已经 claim 并可能抵达 provider 的请求。已 claim 请求必须
作为在途事实保留，沿原 provider idempotency key 对账；撤销绝不构成重新派发许可。

lease 只定义何时可以向 provider 查询既有请求，不是重新派发许可。已有 claim 但无
终态回执时，网关返回 `in_doubt`，不得自行重新派发；lease 到期后也必须先用原
provider idempotency key 对账。

## 6. 受限 fallback

fallback 必须在 policy 中显式声明，并且只在 provider 明确“不接受该请求”的失败后
考虑。异常、超时、连接断开或回执不完整都保持 `unknown`，不自动 fallback。

候选 route 在以下每一维都必须相同或更严格：

- task class / workflow；
- maximum sensitivity；
- processing disposition；
- deployment form；
- jurisdiction 与 region；
- retention；
- training use；
- provider / deletion / pricing terms、projection trust root 与 governance profile；
- input / output token；
- cost、latency 和 concurrency。

任一维未知、不可比较或更宽即拒绝。境内 route 不能静默转向境外 route。一次请求
最多使用一个已声明 fallback，不允许形成开放递归链。

## 7. 受治理网关

`governed-model-gateway.service.ts` 是 provider adapter 的唯一公共运行接缝：

1. 准备路由决定；
2. 读取已投影的 JSON payload；
3. 通过不可变 adapter registry 取得与 readiness 完全一致的 adapter，并执行
   preflight；
4. claim 派发；
5. 用 claim 派生的 provider idempotency key 在超时边界内调用 adapter；
6. 先持久化终态回执，再向调用方释放输出。

若终态回执落库失败，输出必须被扣留。Public Core 不注册生产 adapter，默认调用结果为
不可用；客户 adapter、credential resolver 和 entitlement 只能由受控私有层提供。

进程若在 provider 接受请求后、终态回执落库前崩溃，恢复规则是：

1. lease 未到期时只返回 `in_doubt`；
2. lease 到期后只允许精确 adapter 用原 provider idempotency key 查询；
3. provider 返回可核验终态时，以 `resolutionSource=reconcile` 追加 sequence 2，
   但不释放崩溃前的输出；
4. provider 返回 unknown、adapter 不支持 reconciliation 或精确注册不匹配时，
   继续保持 `in_doubt`，绝不把“没查到”泛化为可安全重发。

请求 token 预算是 decision hash 的一部分。preflight 预估输入、provider 实际报告的
prompt token 和 completion token 分别受 route 与请求预算约束；任一越界时，结果降为
`unknown`、输出被扣留，终态成功回执也会被拒绝。adapter 输出还必须是有限深度、
无循环引用的 JSON 值，不能把类实例、函数或其他进程内对象穿过治理边界。
所有落入 MySQL `INT` 列的 token、费用、时延、版本和容量数字还必须在 signed
MySQL `INT` 上限 `2,147,483,647` 内；JavaScript safe integer 不能替代持久化边界。

费用预算同样分为事前和事后两道门：preflight 的
`estimatedMaxCostUsdMicros` 不能超过 route 上限；provider 终态必须报告
`actualCostUsdMicros + USD + pricingVersion`，且 pricing version 必须等于策略中
owner 批准的精确版本。实际费用超限、证据缺失或版本不匹配时保持 `in_doubt`，
不追加 sequence 2，也不释放输出。provider 明确 `not_accepted` 时，实际费用必须为
零，否则不能作为安全 fallback 依据。

## 8. OWNER-only 治理读模型

`getWorkspaceModelEgressOwnerReadout` 只接受服务端查询得到的 active
`WorkspaceRole.OWNER` 成员关系。它提供：

- 当前 policy / readiness 数量和姿态；
- allowed / blocked route decision 计数；
- claimed、terminal 和 `in_doubt` 计数；
- terminal outcome 分布；
-最近 10 条策略、就绪和决定的脱敏摘要。

该读模型不选择或返回：

- credential ref 或 secret value；
- policy JSON、decision JSON 或 receipt JSON；
- projected payload hash、原始内容或 evidence 内容；
- provider request reference；
- dispatch runtime hash、claim hash 或审计内部 hash。

它没有 dispatch、approve、retry、fallback 或任何其他 mutation 能力，且当前未接入
产品页面。

## 9. 仓库边界

| 层 | 责任 |
|---|---|
| `helm-public` | 公共契约、确定性判断、数据库级 append-only egress receipt、默认关闭网关、合成验证 |
| `helm-packs` | 行业 task class、评测集和行业级路由要求，不持有客户策略 |
| `helm-overlays` | 客户准入策略引用、adapter binding、受管凭据引用和客户数据边界 |
| `helm-control-plane` | entitlement、BOM、部署登记、版本和生产回执 |

Core 不得反向依赖 Pack 或 Overlay。Public Core 中出现 provider 名称不等于商业或生产
准入成立。

## 10. 当前事实

截至本文件版本，Public Core 已形成契约、持久化、迁移、受治理 gateway、合成 adapter
测试、隔离 MySQL 测试、静态边界门、MySQL 8.4 CI job 配置和 OWNER-only 读模型。
本地已经完成 51 个迁移的空库重放和隔离 MySQL 行为验证；远端 CI 尚未产生回执。
以下仍未成立：

- 真实 provider adapter 或生产 credential；
- 客户级 active route policy；
- 客户数据或生产调用；
- WorkBuddy / Gateway 跨设备接线；
- 远端 CI 回执或 MySQL 8.4 生产等价回执；
- 页面操作面、Control Plane 激活或客户部署。

因此本能力状态是“已成形但仍需下一层”，不是生产 ready。

## English Summary

Helm CAIO treats model visibility, tenant admission, adapter readiness, route
selection, dispatch, and outcome evidence as separate facts. Every remote call
requires an immutable pre-dispatch decision, a single compare-and-set dispatch
claim, a provider idempotency key, and a database-enforced append-only terminal
receipt before output is released. Local timeout, invalid adapter output, and
provider `not_found` remain in doubt without a terminal receipt. Every terminal
receipt carries actual USD-micros cost and an exact owner-approved pricing
version. Terminal acceptance must be explicitly `accepted` or `not_accepted`;
unknown acceptance remains in doubt. The dispatch claim is the authorization
cutoff: revocation blocks unclaimed dispatches but cannot unsend a claimed
request, which remains in flight until reconciled. A lease expiry permits
reconciliation only; it never permits a blind resend. Unknown classification
defaults to restricted and local-only. Fallback is explicit and must be no
broader in every governed dimension. Public Core ships no production adapter,
credential, tenant policy, or runtime activation.
