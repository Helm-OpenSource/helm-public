---
status: active
owner: helm-core
created: 2026-07-12
review_after: 2026-08-12
public_safety: Public-safe requirements and rollout gates only. No real context bundle, customer signal, source text, schema dump, prompt run receipt, credential, tenant URL, execution lease, overlay draft, or deployment evidence.
---
# Helm Governed Intelligence Runtime v4

> 语言 / Language：中文（权威版） · English reference follows.

## 结论

v4 不建设新的通用 Agent 平台。它把现有 LLM v3、受监督 agent loop、
`AgentRunStore`、`ArtifactBundle` / `ArtifactReview`、治理动作审批链、官方写入意图和
Pack / Overlay 执行治理连接成一条可恢复、可审计、复核优先的受控运行链：

`私有只读上下文 -> 多角色判断 -> 候选产物 -> 人工复核 -> 受治理动作 -> 独立执行器 -> 回执 / 对账`

本文件是 public-safe 需求冻结，不是生产多智能体平台、客户部署证明、写入授权、
商业发布批准或生产 SLA。

## 已有基础与本轮缺口

已经成立的基础：

- v3 strict model profile、dual-context projection、multi-pass reviewer、trajectory receipt
  和 adaptive reasoning budget。
- 有界监督循环、工具注册表、append-only `AgentRunStore`、MySQL durable store 和运行只读面。
- `ArtifactBundle` / `ArtifactReview`、`ActionItem` / `ApprovalTask` / `ExecutionReceipt`。
- Helm v2 `HumanActionExecution`、`OfficialWriteIntent`、`LimitedAutoIntent`。
- PermissionPolicy、workspace capabilities、NPA intent gateway、autonomy ladder、kill switch、
  governed write envelope、reconciliation 和 retraction 机制。

仍需实现的缺口：

- 真实但本地私有的 read-only context adapter 与 egress receipt。
- crash-safe step persistence、lease fencing、heartbeat、cancel、checkpoint 和 bounded retry。
- 模型进程与数据读取 / side-effect executor 的运行时隔离。
- LLM 候选到现有 Artifact review，再到人工晋级 governed action 的显式桥。
- metadata-only entitlement 与客户私有执行 lease 的分离。
- 一个可逆 native writeback 的 controlled-trial 证明。

## 架构边界

### Public Core

`helm-public` 只承接：

- strict public contracts、validators、guards、synthetic fixtures 和 eval；
- generic recoverable-run interfaces；
- reference-only runtime observability；
- candidate Artifact materializer 和人类晋级入口；
- 不依赖 Pack / Overlay 的通用复核面。

Public Core 不保存真实 rich context、客户源码 / schema / rows、连接凭据、租户 URL、
execution lease、客户 adapter 或生产回执。

### Private Overlay / Local Runtime

`helm-overlays` 或客户本地环境负责：

- 只读读取客户侧派生上下文；
- 构建 `RichLocalContextBundle` 并把本地材料保存在 gitignored `.helm-runtime/`；
- 运行隔离的 multi-pass worker；
- 管理短期 execution lease 和目标系统 adapter；
- 生成脱敏、reference-only receipt。

### Pack

Pack 只声明行业 action class、风险、veto、幂等、回滚、对账和升级阈值，
不得持有客户凭据或客户专属 adapter。

### Control Plane

Control plane 只保存 adapter registration、entitlement、revocation、kill-switch、
reconciliation 和 rollout metadata。它不保存业务上下文、原始数据、凭据、raw prompt，
也不承担运行时编排。

## Public Contract Requirements

### Private Context Adapter

新增 strict contract：

- `PrivateContextAdapterManifest`：adapter key / version、source classes、read posture、
  isolation profile、output contract、policy version，以及字面量
  `rawEgressAllowed:false` / `sideEffectAllowed:false`。
- `PrivateContextBuildReceipt`：bundle、adapter、source snapshot refs / hashes、
  redaction / injection-scan 结果和字面量 no-raw assertions。
- `ContextEgressDecisionReceipt`：projection receipt、model profile、consent、prompt preview hash、
  audit ref、allow / block 与 closed failure reason。

Unknown fields、unknown source class、缺失 hash、未通过 redaction / injection scan、
raw-content assertion 不为 false 时必须 fail closed。

### Runtime Isolation And Capability

新增 `RuntimeIsolationProfile` 与 `CapabilityGrant`：

- profile 区分 `read_adapter`、`review_worker`、`side_effect_executor`；
- grant 绑定 principal、capability、scope、effect mode、policy version、expiry、
  entitlement ref、kill-switch ref；
- unknown capability、过期 grant、scope mismatch 或缺少 receipt 一律 deny；
- model-facing packet 只能携带 opaque `capabilityRef`，不能携带 tool / connector handle。

### Recoverable Agent Run

在现有 store 上新增兼容接口，不破坏 `AgentRunStore`：

- 60 秒 lease、20 秒 heartbeat、单调 fencing epoch；
- request-cancel 与 checkpoint；
- 每个进度转换把 lifecycle、可选 step 与 checkpoint 在一个 store transaction 中原子持久化，
  成功后才进入下一步；
- 最多三次幂等 retry，只覆盖 model / read tool；
- side-effect step 不进入该 retry loop；
- stale lease holder 的 append / checkpoint 必须拒绝。

### Governed Action Candidate

`GovernedActionCandidatePayload` 只能表达：

- source Artifact / trajectory / evidence refs；
- target object ref；
- redacted title / summary；
- risk class、content hash、candidate review state；
- 初始 closed action type 仅 `CREATE_TASK`；
- forbidden capability declarations。

LLM 输出只可物化为 `ArtifactBundle(DRAFT)` + `ArtifactReview(PENDING)`。
只有真实用户显式执行“晋级为受治理任务”后，才可进入现有 action policy engine。

Policy ceiling：

- `FORBIDDEN` 保持 blocked；
- `SUGGEST_ONLY` 保持 suggestion，不创建审批执行路径；
- `AUTO_WITHIN_THRESHOLD` 降为 `REQUIRES_APPROVAL`；
- `REQUIRES_APPROVAL` 保持不变。

## Runtime Isolation Requirements

真实数据 / 真实 provider 的 review worker 必须在独立 rootless OCI container 中运行：

- non-root、read-only rootfs、drop all capabilities、no-new-privileges；
- tmpfs scratch、CPU / memory / PID / wall-clock 限制；
- local model 默认无网络，remote model 只可访问受控 egress proxy；
- 模型 worker 不挂载 DB、connector、SMTP 或 target-system credentials；
- read adapter 与 side-effect executor 是独立进程；
- side-effect executor 不链接 model SDK，只消费不可变、已审批、可验 hash 的 intent。

该 isolation 是可信 Helm code 的生产约束，不是第三方 plugin sandbox。
Source Profiler 继续只做静态解析，绝不执行客户代码。未来若执行不受信代码，必须另立
microVM 级 sandbox 项目。

## Rollout

1. Public requirements and contracts。
2. Helm-self local read-only context adapter。
3. Helm-self isolated shadow multi-pass worker。
4. Candidate Artifact + human review。
5. Human-promoted internal `CREATE_TASK`。
6. One lighthouse customer read-only controlled trial。
7. NPA `assign_by_rule` dry-run。
8. NPA native-system human one-click write。
9. Conditional limited-auto only after its evidence gate passes。

有限自动写入只覆盖可逆 `assign_by_rule`，要求同一 action class：

- 连续 14 天；
- 至少 50 次 clean execution；
- divergence <= 0.30；
- 零 compliance、QC、boundary incident；
- owner 真实身份人工晋级；
- entitlement、lease、kill-switch、reconciliation、idempotency receipt 全部有效。

任一条件缺失立即降级为 review-required 或 blocked。

## Permanently Human-Gated In v4

- 客户对外消息：LLM 只准备 draft；发送要求固定收件人和 content hash、DLP、频控、
  dedupe 与显式人工点击。v4 不自动发送客户消息。
- Connector activation：LLM 只生成 scope / risk 候选；OAuth、凭据录入和 `CONNECTED`
  状态只能由拥有 `MANAGE_CONNECTORS` 的用户执行。
- Official memory：已确认 Artifact 可确定性生成 `MemoryCandidate(PENDING_VERIFICATION)`；
  `MemoryPromotion` 与 canonical `MemoryFact` 仍由人工复核路径控制，禁止 self-promotion。

## Acceptance Gates

- Contract / guard：unknown / unsafe / raw / cross-tenant / missing-receipt 输入拒绝率 100%。
- Runtime：双 worker 抢 lease、crash resume、expired lease、cancel、duplicate delivery、
  provider timeout 和 checkpoint replay 全部 fail closed；重复 step / side effect 为 0。
- Isolation：验证 read-only filesystem、network default deny、no host credentials、
  target allowlist 与 resource limits。
- Intelligence：hallucinated evidence ref = 0、boundary incident = 0、gap recall >= 0.75、
  overclaim false-positive <= 0.20，LLM disabled snapshot 不变。
- Action：0 auto-approve、0 automatic feedback、0 external-send、0 connector activation、
  0 memory promotion；每次执行都有 approval、entitlement、idempotency 和 execution receipt。

## 当前参考实现状态

- 已成立：public-safe requirements freeze；strict `PrivateContextAdapterManifest`、
  `PrivateContextBuildReceipt`、`ContextEgressDecisionReceipt`、`RuntimeIsolationProfile`、
  `CapabilityGrant`；private-context conformance validator；receipt-to-prompt static guard；兼容既有
  `runAgentLoop` 的单步状态转换 primitive；带 60 秒 lease、20 秒 heartbeat、单调 fencing、
  cancel、checkpoint 和三次 model / read-tool 重试上限的 generic recoverable runner；以及
  lifecycle / optional-step / checkpoint 原子 progress commit、InMemory / MySQL store parity、
  fresh schema、one-time migration 和并发 / 恢复回归测试。
- 已成形但仍需下一层：public Core 的 recoverable runtime 可以逐步持久化并在 lease 过期后
  从一致 checkpoint 恢复，但 MySQL migration 尚未被声明为已应用到任何生产环境；真实
  Helm-self context adapter 属于独立私有 Overlay 证据，isolated OCI worker、candidate
  materialization、人工晋级和 side-effect executor 仍未接线。MySQL contract parity 当前由
  transactional fake 覆盖；真实 InnoDB 双连接并发与 row-lock 集成测试仍是下一层证据。
- 刻意未做：真实 context、provider runtime、execution lease、side-effect adapter、客户外发、
  connector activation、official memory promotion 和生产部署声明。

`scripts/check-recoverable-agent-runtime.ts` 只提供词法层 defense-in-depth：它锁定 read-only
tool policy、原子 progress commit、重试 / lease 常量、MySQL transaction + `FOR UPDATE` +
fencing marker，以及 fresh schema / migration 的恢复字段。它不等同于进程隔离或 sandbox；
生产隔离仍必须由后续 rootless OCI worker、最小权限凭据、egress proxy 与独立
side-effect executor 证明。

## PR Order

1. Requirements freeze。
2. Context / isolation / capability contracts and guards。
3. Helm-self real read-only adapter。
4. Recoverable supervised runtime。
5. Isolated Helm-self dogfood worker。
6. Candidate Artifact materialization。
7. Human review and governed-action promotion。
8. Control-plane entitlement metadata。
9. NPA live-ready Pack contract。
10. NPA private side-effect executor。
11. Conditional limited-auto gate。
12. External-send / connector / memory review-only closeout。

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-07-12 | 增加可持久化单步 primitive、fenced recoverable store / runner、原子 lifecycle / step / checkpoint progress commit、MySQL schema + migration、恢复回归测试与静态 drift guard；不声明生产 worker 或迁移已部署。 |
| 2026-07-12 | 增加 private-context / isolation / capability strict contracts、conformance validator 与 receipt-to-prompt guard。 |
| 2026-07-12 | 冻结 v4 public-safe architecture、contracts、runtime isolation、rollout 和 acceptance gates。 |

---

## English Reference

v4 connects Helm's existing v3 intelligence, supervised loop, durable run store,
artifact review, governed actions, official-write intents, and private Pack /
Overlay execution seams. It adds recoverability and runtime isolation without
granting models approval, connector activation, customer-send, official-memory,
or unrestricted writeback authority. Real context and executors remain private;
Public Core contains only reusable contracts, guards, synthetic evaluation, and
generic review surfaces.
