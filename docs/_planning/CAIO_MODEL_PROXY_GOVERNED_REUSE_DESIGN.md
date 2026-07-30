---
status: active / design-and-implementation-plan
owner: helm-core
created: 2026-07-30
review_after: 2026-08-30
public_safety: Public-safe design document. It contains no customer data, credential, private connector configuration, model secret, production endpoint, deployment receipt, commercial commitment, owner approval, or production activation. All file:line references are to public-core source in this repository.
---

# CAIO 模型代理复用既有治理入口 — 设计与可行性判定

> **语言 / Language**：中文权威版；文末附 English executive summary。
> **分支 / Branch**：`feat/caio-access-gateway-v1`，HEAD `c505b32`。本文档为唯一新增文件，未修改任何源文件。

---

## 0. 先行结论（不加修饰）

**选项 (a) 在不为 LAN 流量预置 route policy 的前提下不可行；而且即使预置了 route policy 仍然不可行，因为它同时还要求为每一个 LAN 请求预置一条 `GovernedModelProjectionReceipt`，而该回执又要求工作区里至少存在一条 `inventoryStatus=CONFIRMED / classificationStatus=CLASSIFIED / authorizationStatus=AUTHORIZED` 且带有 CLASSIFICATION + AUTHORIZATION 阶段回执的 `DataAssetCatalogEntry`。**证据：`lib/llm/model-egress-store.service.ts:760-764` 在 `sourceAssetRefs` 为空时无条件产出 `source_asset_ref_required`；`lib/llm/model-egress-store.service.ts:1020-1025` 在任何 source-authority reasonCode 存在时直接抛错拒绝创建投影回执；`lib/llm/model-egress-store.service.ts:872-921` 枚举了每条资产必须满足的六项条件。一个 Codex / WorkBuddy 开发者在 LAN 上发出的 prompt 不是企业数据资产，没有目录条目，也不该被伪造成一条。

除此之外，选项 (a) 与 (b) 还共同触碰三条硬边界，任何一条单独就足以否决"逐请求跑完整治理链"：

1. **task class 是封闭枚举，没有 LAN 直通这一类。** `lib/llm/model-route-contracts.ts:12-21` 的八个值全部是 Helm 自己的分析型任务（embedding_index / extraction_classification / redaction_projection / retrieval_rerank / summary_briefing / reasoning_counterfactual / multi_pass_review / voice_input_understanding）。把"开发者的任意 agent 请求"塞进其中任何一个都是错误标注，且 taskClass 参与 `requestHash`（`model-egress-store.service.ts:1724-1745`）与 route 准入（`routeAllowsClassification`），不是可以随便填的自由文本。
2. **投影回执的 `redactionStatus` 只有 `synthetic | redacted | alias_only` 三个取值**（`lib/llm/model-egress-store.service.ts:156-159`、`lib/llm/governed-model-projection.service.ts:45`），没有"原样直通"这一档。LAN 直通把客户端原始 body 原样转发（`lib/caio-model-proxy/proxy-engine.ts:444-447`，只替换 `model` 字段）。为它签发一张投影回执 = 出具一份虚假证明。
3. **治理链的 adapter 契约是非流式、JSON 进 JSON 出**（`lib/llm/governed-model-adapter-registry.service.ts:109-121`：`invoke(...) => Promise<GovernedModelAdapterResult<TOutput>>`，无 chunk 回调、无 stream 语义）。CAIO 代理引擎支持流式转发（`proxy-engine.ts:448-457`）。虽然当前 HTTP 桥接层显式拒绝 `stream: true`（`lib/caio-access-gateway/model-dispatch-bridge.ts:219-223`），流式能力仍是 proxy 引擎已实现并被测试覆盖的能力（`proxy-engine.test.ts:903, 1089, 1137`），走 (a)/(b) 等于删除它。

**最关键的一条，且它不是工程问题而是产品问题：** CAIO 审计门在主库不可用时，会把回执写进本地加密应急队列并**放行**（`lib/caio-audit-state/audit-gate.service.ts:301-302` → `queueReceipt` :254-267 → `claimCore` :343-350 返回 `allowed:true, persistedVia:"emergency_queue"`）。治理链的 `claimModelRouteDispatch` 则整体运行在一个 `Serializable` 事务里（`lib/llm/model-egress-store.service.ts:2226-2229`、`TRANSACTION_OPTIONS` :60-64），**没有任何降级路径**。因此：

> 让 LAN 请求走治理链 = 让 LAN 出站在中心数据库不可达时全量停摆。
> 这是可用性姿态的改变，是 owner 的产品决定，不是重构细节。

---

## 1. 治理链对调用方的完整要求（逐条来自代码，非文档）

### 1.1 调用顺序（硬性）

`lib/llm/governed-model-gateway.service.ts:773-1197` 的 `executeAttempt` 定义了唯一合法顺序：

| 序 | 步骤 | 位置 | 失败即终止 |
| --- | --- | --- | --- |
| 1 | `readProjectionReceipt` | `:788-792` | `projection_receipt_not_found` |
| 2 | 投影回执合法性校验 | `:798-806` | `projection_receipt_invalid` |
| 3 | payload hash / bytes 绑定校验 | `:807-816` | `projection_payload_binding_mismatch` |
| 4 | 输出预算 ≤ 投影预算 | `:817-824` | `projection_output_token_budget_exceeded` |
| 5 | `prepareDecision` | `:832-859` | 返回 `blocked` |
| 6 | `readDecision`（claim 前重读） | `:878-888` | `prepared_model_route_decision_missing` |
| 7 | 已有终态回执 → 只重放不重发 | `:889-904` | — |
| 8 | `registry.resolve(routeSnapshot)` | `:905-907` | `adapter_not_registered` `:918-930` |
| 9 | 已有 dispatch → 只对账不重发 | `:908-917` | `reconcileClaimedAttempt` |
| 10 | `adapter.preflight` + `validatePreflight` | `:932-985` | `adapter_preflight_failed` / 预算类拒绝 |
| 11 | `claimDispatch`（一次性 CAS） | `:987-994` | 抛 `ModelEgressStoreError` |
| 12 | `adapter.invoke`（带超时） | `:1039-1056` | `in_doubt`（不重发） |
| 13 | `recordTerminal`（**先落终态回执**） | `:1120-1147` | `terminal_receipt_persistence_failed_output_withheld` `:1148-1153` |
| 14 | 才释放 output | `:1181-1196` | — |

第 13 步是硬约束：**终态回执落库失败则输出被扣留**，不返回给调用方。

### 1.2 `prepareModelRouteDecision` 的输入要求

签名 `lib/llm/model-egress-store.service.ts:1676`，输入类型 `:120-141`：

- `authority: GOVERNED_GATEWAY_AUTHORITY` — 一个 `unique symbol`（`:75-77`），**只在 `model-egress-store.service.ts` 内定义、只允许 `governed-model-gateway.service.ts` 引用**（守卫 `scripts/check-model-egress-governance.ts:141-150`）。外部模块拿不到它，这就是"不能绕过"的机制本身。
- `policyKey`、`requestKey`、`taskClass`、`taskRef`、`requestedMaxOutputTokens`（正整数）、`allowFallback`（必须是 boolean）。
- `sourceAssetRefs` / `candidateEvidenceRefs` / `selectedEvidenceRefs` / `droppedEvidenceRefs`。
- `projectionReceiptRef`、`projectedPayloadHash`（必须匹配 `/^sha256:[a-f0-9]{64}$/`，`:235-240`）。
- `promptInjectionScanStatus`。

事务上下文：整个函数体在 `db.$transaction(..., TRANSACTION_OPTIONS)` 里（`:1707-2100`），隔离级别 SERIALIZABLE，首行即 `await lockModelEgressWorkspace(tx, input.workspaceId)`（`:1708`），外面再包一层 `runWithWriteConflictRetry`（最多 8 次，`:66-69`）。

拒绝理由（写入 decision 的 `reasonCodes`，不是抛错，因此产出一条 `decision: "blocked"` 的**不可变记录**）：
`no_active_model_route_policy` `:1826/1848`、`active_model_route_policy_expired` `:1853`、`model_route_policy_owner_approval_missing_or_invalid` `:1866-1868`、`prompt_injection_scan_not_passed` `:1875`、`projection_receipt_missing` `:630`、`model_route_not_resolved` `:1895`、`remote_route_requires_remote_safe_projection` `:1918-1920`、`adapter_readiness_receipt_missing` `:1958`、各类 token 预算超限 `:1927/1938/1946`。

抛错（不产出记录）：`idempotency_key_payload_conflict` `:1757`、`allowed_decision_started_receipt_missing` `:1771`、`computed_model_route_decision_invalid` `:2017`。

副作用：写一条不可变 `ModelRouteDecision`（`persistDecision` `:2022`）+ 一条 auditLog（`:2028-2051`）；若 decision 为 `allowed`，再写一条 `sequence=1` 的 UNKNOWN 起始回执（`:2053-2094`）。

### 1.3 `claimModelRouteDispatch` 的要求

签名 `:2212-2219`：`{authority, workspaceId, decisionId, gatewayRef, runtime, now?}`。

同样 SERIALIZABLE 事务 + `lockModelEgressWorkspace`（`:2228-2229`）。在真正 CAS 之前它**重新验证**了 12 项：

1. decision 存在且属于该 workspace `:2230-2238`
2. `decision === "allowed"` 且有 routeSnapshot `:2240-2244`
3. decision 未过期 `:2245-2249`
4. policy head 的 `activePolicyId / version / revocationEpoch` 与 decision 记录一致 `:2250-2269`
5. policy 行仍 ACTIVE 且在有效期内 `:2270-2286`
6. policyHash 未变 `:2288-2292`
7. **真人 OWNER 批准回执仍然存在且匹配** `:2293-2308` → `requireModelRoutePolicyOwnerApproval`（`lib/llm/model-route-policy-store.service.ts:627-661`，比对 policyHash / policyKey / revision / approvedByUserRef）
8. source asset 分级与授权绑定未变 `:2309-2341`
9. 投影回执关系与 hash 未变、投影—route 信任绑定仍成立 `:2342-2384`
10. readiness 回执仍存在且匹配 route `:2385-2414`
11. **runtime descriptor 与 route + readiness 完全一致**（`assertRuntimeDescriptorMatches` `:2105`，含 `observedAt` 新鲜度上限 5 分钟 `:72`）
12. `sequence=1` 起始回执存在 `:2421-2434`

然后才是 CAS：`tx.modelRouteDecision.updateMany` 的 where 里同时要求七个 dispatch 字段全为 null 且 `validUntil > now`（`:2531-2555`），`claimed.count !== 1` 即 `model_route_dispatch_claim_lost`（`:2556-2560`）。并发容量门在 CAS 前：`activeRouteDispatches >= routeSnapshot.maxConcurrency` → `model_route_concurrency_limit_reached`（`:2487-2507`）。

返回 `{decision, startedReceipt, runtimeHash, claimHash, providerIdempotencyKey, claimedAt, leaseExpiresAt, replayed}`。

### 1.4 `recordModelEgressTerminalReceipt` 的必填字段

签名 `:2652-2680`。**必填且无默认值**的字段中，LAN 直通今天一个都没有：

| 字段 | 校验位置 | LAN 直通是否有 |
| --- | --- | --- |
| `outcome`（success/failure/partial，不能 unknown） | `:2682-2686` | 可推导 |
| `resolutionSource`（invoke/reconcile） | `:2695-2702` | 可填 invoke |
| `requestDisposition`（accepted/not_accepted） | `:2687-2694` | 需上游明确回执，直通拿不到 |
| `providerRequestRefHash`（accepted 时必填） | `:2747-2754` | **没有**（直通不解析上游 body） |
| `actualCostUsdMicros`（整数，≥0，≤INT_MAX） | `:2703-2712` | **没有** |
| `costCurrency` 必须是 `"USD"` | `:2713-2715` | **没有** |
| `pricingVersion`（安全标识符） | `:2716-2720` | **没有** |
| `costBand` | 类型约束 | **没有** |
| `dispatchClaimHash` | `:2740` | 只有治理链能产出 |

`not_accepted` 时成本必须为 0（`:2721-2728`），`not_accepted` 时不得带 providerRequestRefHash（`:2755-2762`）。

数据库层再加一层：append-only trigger `ModelEgressReceipt_append_only_update` / `_delete`，以及 `ModelEgressReceipt_no_raw_content_chk`、`_phase_shape_chk`、`_request_ref_disposition_chk` 等 CHECK 约束（`scripts/check-model-egress-governance.ts:101-121` 冻结了这些字面量在 `prisma/migrations/20260723230000_caio_model_egress_governance/migration.sql` 中的存在）。

### 1.5 守卫的实际约束面

`scripts/check-model-egress-governance.ts:141-176` 的 `INTERNAL_AUTHORITY_BOUNDARIES`（扫描 `app/ components/ features/ lib/ scripts/ prisma/`，跳过 `.test.ts`）：

| token | 只允许出现在 |
| --- | --- |
| `GOVERNED_GATEWAY_AUTHORITY` / `prepareModelRouteDecision` / `claimModelRouteDispatch` / `recordModelEgressTerminalReceipt` | `lib/llm/model-egress-store.service.ts`、`lib/llm/governed-model-gateway.service.ts` |
| `GOVERNED_MODEL_PROJECTION_AUTHORITY` / `recordGovernedModelProjectionReceipt` | `model-egress-store.service.ts`、`governed-model-projection.service.ts` |
| `GOVERNED_MODEL_READINESS_AUTHORITY` / `recordProviderAdapterReadinessReceipt` | `model-route-policy-store.service.ts`、`governed-model-adapter-registry.service.ts` |
| `GovernedModelProviderAdapter` | `governed-model-adapter-registry.service.ts`、`governed-model-gateway.service.ts` |

**未被守卫禁止**（这点很重要，决定了可行的接缝）：
`createGovernedModelGateway`、`executeGovernedModelRequest`、`createGovernedModelAdapterRegistry`、`requireModelRoutePolicyOwnerApproval`、`parseStoredTenantModelRoutePolicy`、`lockModelEgressWorkspace`、`readModelRouteDecision`、`readGovernedModelProjectionReceipt`。

**必须明说的一个守卫弱点：** 该守卫是 token 文本扫描，不是语义分析。一个新文件完全可以写出一个结构上满足 `GovernedModelProviderAdapter` 的对象字面量、直接传给 `createGovernedModelGateway({adapters:[...]})`，而**永远不写出那个类型名**，从而不触发 `MEG-GATEWAY-BYPASS`。这在技术上"不需要放宽守卫"，但它是规避而非遵守 —— 守卫的注释（`:166-172`）写得很清楚，禁止引用该类型是"防止调用方把 dispatch 绕过 decision/claim/receipt 链"的纵深防御。**本文档拒绝把这条路径当作"无需 owner 签字"的方案。** 任何真正要在 public core 里注册 adapter 的方案，都应当老老实实把新文件加进 `allowedFiles`，并按 §7 走 owner 签字。

---

## 2. LAN 直通请求能否满足这些要求

### 2.1 逐项判定

| 治理链要求 | LAN 直通现状 | 判定 |
| --- | --- | --- |
| `projectionReceiptRef` | 不存在。代理只有 `body`（`proxy-engine.ts:163`）和 `sha256(canonicalJson(body))`（`:578`） | **必须逐请求新建** |
| 投影回执前置：≥1 条已确认/已分级/已授权的 `DataAssetCatalogEntry` | 不存在，且概念上不存在 —— 开发者 prompt 不是企业数据资产 | **阻断** |
| 投影回执的 `redactionStatus` | 只有 synthetic/redacted/alias_only；直通是原样转发 | **阻断（诚实性）** |
| `TenantModelRoutePolicy` + head + 真人 OWNER 批准回执 | 不存在。CAIO 只有进程内静态 `CaioModelAliasBinding[]`（`alias-contracts.ts:87-119`），由 `deps.bindings` 注入（`proxy-engine.ts:141`） | **必须由 owner 预置** |
| `ProviderAdapterReadinessReceipt` | 不存在。CAIO 只有 `endpointBaseUrl` + `credentialRef` | **必须由运维预置（探针写入）** |
| `taskClass ∈` 八值枚举 | 没有匹配项 | **阻断（除非扩枚举）** |
| `GovernedModelProviderAdapter` 实现 | 不存在。CAIO 用的是 `CaioProxyUpstreamClientPort`（`proxy-engine.ts:143-146`），语义完全不同 | **必须新建，且触碰守卫** |
| 终态回执的 cost / pricingVersion / providerRequestRefHash | 直通不解析上游 body，全都拿不到 | **阻断（除非改成解析上游响应）** |
| 活的中心数据库 | CAIO 明确设计为主库挂掉时靠本地加密队列继续服务 | **产品决定** |

### 2.2 若强行让 (a)/(b) 成立，每个请求需要预先存在什么、由谁创建

| 需要存在 | 粒度 | 谁创建 | 何时 |
| --- | --- | --- | --- |
| `DataAssetCatalogEntry`（CONFIRMED + CLASSIFIED + AUTHORIZED + 两张阶段回执） | 每工作区至少 1 条（"LAN 开发者会话"这一虚构资产） | owner / OPC 盘点流程 | 部署初始化时 |
| `TenantModelRoutePolicy` 草案 + 真人 OWNER 批准回执 + head 激活 | 每工作区每 policyKey 一份 | owner 本人（`requireModelRoutePolicyOwnerApproval` 比对 `approvedByUserRef`） | 部署初始化时 |
| `ProviderAdapterReadinessReceipt` | 每 route 一张，带 `expiresAt` | 运维跑 `probeAndRecordRegisteredAdapterReadiness`（`governed-model-adapter-registry.service.ts:304`） | 部署时 + 到期前续签 |
| 注册的 `GovernedModelProviderAdapter` | 每 provider 一个 | 工程 | 编译期 |
| `GovernedModelProjectionReceipt` | **每请求一条** | 只能由 `createGovernedModelProjectionService` 的一个注册 projection engine 产出（`governed-model-projection.service.ts:230-302`），且 `executionBoundary` 必须是 `"local_only"`（`:220`） | 请求处理中，同步，写库 |
| `ModelRouteDecision` | **每请求一条**（不可变） | `prepareModelRouteDecision` | 请求处理中，写库 |
| `ModelEgressReceipt` sequence 1 + 2 | **每请求两条**（append-only） | 治理链 | 请求处理中，写库 |

**净效果：每一个 LAN 直通请求要产生 4 次以上跨表写入、2 次 SERIALIZABLE 事务 + 工作区行锁**，而当前是 1 次单表 insert。`lockModelEgressWorkspace` 是工作区级串行点，`maxConcurrency` 门（`:2500-2507`）会把同一 route 的在途请求数卡死在 policy 声明值上 —— 对一个给 Codex agent 用的编码助手网关，这是一个数量级的行为改变。

---

## 3. 三个选项

### 选项 (a) — 把 CAIO dispatch 搬进 `lib/llm`，逐请求跑完整治理链

**迁移路径**（若强行做）
1. 新建 `lib/llm/caio-lan-projection-engine.ts`，实现一个 `GovernedProjectionEngine`，把客户端 body 当"投影产物"；给它伪造 `projectorRegistrationRef` / `scannerRegistrationRef`。
2. 扩 `MODEL_ROUTE_TASK_CLASSES` 增加 `lan_passthrough`（改 `model-route-contracts.ts:12-21`，波及 policy hash、已有测试、`routeAllowsClassification`）。
3. 把 `proxy-engine.ts` 的 dispatch 段搬进 `lib/llm`，改写为 `GovernedModelProviderAdapter`。
4. 删除流式路径（adapter 契约不支持）。
5. 为每工作区预置资产目录条目 + route policy + owner 批准 + readiness 回执。

**爆炸半径**
- `lib/caio-model-proxy/proxy-engine.ts`（721 行）几乎整体重写；`proxy-engine.test.ts`（1238 行、~55 用例）几乎整体作废。
- `lib/caio-access-gateway/model-dispatch-bridge.ts` 的整套状态映射（`:102-166`）作废。
- `lib/caio-access-gateway/gateway-model-dispatch-e2e.test.ts`、`gateway-audit-integration.test.ts` 作废。
- `MODEL_ROUTE_TASK_CLASSES` 改动会改变 `computeModelRouteRequestHash` 的输入域与 policy 契约 hash → `lib/llm/model-route-contracts.test.ts`、`model-egress-contracts.test.ts`、`governed-model-gateway.service.test.ts`、`lib/llm/model-egress-store.mysql.test.ts` 全部要改，而这四个正是 `check:model-egress-governance` 门里跑的测试。
- `lib/caio-model-proxy/` 与 `lib/llm/` 的目录边界被打穿：一个 LAN HTTP 传输层的实现细节进入模型治理核心。

**会坏掉什么**：流式（三个测试直接删除）；应急队列语义（见下）；`lib/caio-access-gateway/gateway-audit-integration.test.ts:278` "keeps serving through the encrypted emergency queue while the primary store fails" 必然失败。

**应急队列的下场**：删除或降级为"只记录、不放行"。治理链没有等价物，`claimModelRouteDispatch` 必须有活的数据库。

**四状态机的下场**：`NORMAL / PRIMARY_DEGRADED / AUDIT_UNAVAILABLE / RECOVERING` 中，`PRIMARY_DEGRADED` 与 `RECOVERING` 失去意义（它们的全部内容就是"主库挂了但仍在服务"）。剩下二值：能写就服务，不能写就 503。`getReadiness()`（`audit-gate.service.ts:471-480`）的四→三映射与 `caioGatewayReadinessFromAuditGate`（`gateway-audit-gate-adapter.ts:196-213`）一并作废。

---

### 选项 (b) — CAIO 代理成为 `createGovernedModelGateway` 的薄调用方，CAIO 审计门降级为传输层关注点

**迁移路径**
1. 新建 `lib/llm/caio-upstream-adapter.ts`，实现 `GovernedModelProviderAdapter`：`preflight` 返回 endpointFingerprint + 估算 token/成本；`invoke` 调用现有 `CaioProxyUpstreamClientPort`，**并解析上游响应**以取得 `providerRequestRef`、`promptTokens`、`completionTokens`、`actualCostUsdMicros`、`pricingVersion`（今天完全不做）。
2. `proxy-engine.ts` 的 `execute` 改为：alias grant → rate limit → 组装 `GovernedModelGatewayInput` → `executeGovernedModelRequest(...)`。
3. 逐请求先跑 projection service 拿 `projectionReceiptRef`（同 (a) 的全部前置）。
4. CAIO 审计门保留，但降级为"传输层可观测记录"，不再是放行门。

**爆炸半径**：小于 (a)（不动 `lib/llm` 既有文件的内部），但仍然：
- `CaioModelProxyDependencies`（`proxy-engine.ts:140-156`）形变 → 所有构造点改。
- `CaioProxyExecuteStatus`（`:180-194`）与 `GovernedModelGatewayResult["status"]`（`governed-model-gateway.service.ts:66-70`：`blocked | not_dispatched | in_doubt | success | failure | partial | unknown`）语义不重合。`model-dispatch-bridge.ts:161-165` 的 `const unexpected: never = result.status` 会编译失败（这是好事：它强制你处理）。
- 新增的 `in_doubt` 状态在 HTTP 上没有对应码。`gateway-error-contract.ts:22-65` 的封闭码集里没有"我们不知道上游有没有收到"这一档 → 需要新增 wire 码 = 对外契约变更。
- 守卫：`lib/llm/caio-upstream-adapter.ts` 若引用 `GovernedModelProviderAdapter` 类型名 → `MEG-GATEWAY-BYPASS` 违规。**必须把该文件加入 `INTERNAL_AUTHORITY_BOUNDARIES[3].allowedFiles`** → 见 §7 放宽声明。

**应急队列的下场**：与 (a) 相同 —— 失效。治理链的 claim 在库不可用时抛错，没有队列旁路。
**四状态机的下场**：与 (a) 相同 —— 退化为二值；若保留为"传输层记录"，它就变成一个记录了"我们试图 dispatch"但对放行毫无权力的日志表，`persist-then-allow` 这条被反复测试的不变式（`audit-gate.service.ts:119-130`）不再成立，而这正是那一整套代码存在的理由。

---

### 选项 (c) — 保留两套，但让 CAIO 那套可证明地从属

目标不是"跑完整治理链"，而是**消灭"独立"**：让 CAIO 路径在结构上不可能出站到治理策略未准入的上游，并让它的回执指向治理链的策略身份。分两个阶段，阶段边界严格对齐"是否需要 owner 产品决定"。

#### C-1（可立即实施，不改变可用性姿态，不需要产品决定）

**接缝**：新增 `lib/llm/caio-governed-lan-admission.service.ts`，导出一个**只读**解析器，从 ACTIVE + 真人 OWNER 已批准的 `TenantModelRoutePolicy` 中解析出一份**冻结快照**（routeId → provider / credentialRef / region / deploymentForm / jurisdiction / retentionDays / trainingUse / pricingVersion / maxOutputTokens，以及 policyId / policyHash / headVersion / revocationEpoch / validUntil）。它复用 `parseStoredTenantModelRoutePolicy`（`model-route-policy-store.service.ts:276`）与 `requireModelRoutePolicyOwnerApproval`（`:627`），**不触碰任何被守卫禁止的 token**。

**关键性质**：快照在网关**启动/装载时**解析一次，不是逐请求查库。运行期请求只与内存快照比对，因此主库中断期间的行为与今天完全一致 —— 应急队列继续工作。

CAIO 侧：
- `CaioModelAliasBinding` 增加必填 `governedPolicyKey` + `governedRouteRef`。
- `createCaioModelProxy` 增加必填依赖 `governedAdmission`（快照端口）。构造时校验每条 binding 与 fallback 候选：其 `governedRouteRef` 必须在快照中，且 provider / credentialRef / region / deploymentForm / jurisdiction / retentionDays / trainingUse 与治理 route 逐字段一致；不一致即构造失败（fail-fast，与既有 `CaioModelProxyConfigError` `:226-231` 同风格）。
- 运行期：快照过期（`policy.validUntil <= now`）→ 所有 alias 拒绝 `route_not_admitted`（403 类），在 grant 检查之后、audit claim 之前。
- 新增内容边界门：出站前对 `canonicalJson(body)` 跑 `detectHardBoundaryHits`（`lib/caio-context-broker/broker-contracts.ts:590-608`，纯函数、无 IO）；命中不可脱敏类别（`isNonRedactableHardBoundaryCategory` `:356-360`）→ 拒绝 `content_boundary_denied`，映射到既有 wire 码 `external_release_denied`（422，`gateway-error-contract.ts:56, 100`）。这直接回应评审意见里"没有经过 Context Broker"那一半。

#### C-2（需要 owner 确认，但代价极小）

CAIO 回执增加治理链接字段 `governedPolicyId` / `governedPolicyHash` / `governedRouteRef`（六字段 → 九字段），Prisma 表 `CaioAuditDispatchReceipt` 加三列 NOT NULL。**没有历史数据需要回填**：`createCaioAuditGate` / `createPrismaCaioAuditReceiptStore` 在整个仓库中除测试外零调用点（本轮实测），`CaioAuditDispatchReceipt` 在任何生产环境都不存在数据。这仍然改变了"一张回执断言了什么"，因此按本文档自己的规则（§8）需要 owner 点头，但不涉及历史重解释。

#### C-3（owner 产品决定，本轮不做）

逐请求治理决定（= (b) 的全部前置）。只有 owner 回答"LAN 出站是否可以在中心库不可达时继续"为**否**之后才谈得上。

**爆炸半径**：见 §9 的逐文件清单。核心是 `alias-contracts.ts` 与 `proxy-engine.ts` 两个导出符号形变，以及随之而来的测试 fixture 更新。**不动 `lib/llm` 任何既有文件，不动治理链任何逻辑，不放宽任何守卫。**

**应急队列的下场**：**完整保留，语义不变。** C-1 不引入逐请求库依赖。
**四状态机的下场**：**完整保留，语义不变。**
**唯一诚实的可用性回退**：进程在主库中断期间**冷启动**时无法解析快照 → 拒绝服务。今天它可以启动并靠队列服务。缓解方案（把签名快照落到本地 0600 文件）会在 LAN 机器上复制一份策略状态，等于又造了一个小的独立治理副本 —— **建议不做，宁可拒绝启动**。这一点必须写进运维手册。

---

## 4. 建议

**建议采用选项 (c)，本轮实施 C-1 + C-2，把 C-3 作为独立的 owner 决策项上报。**

理由，直说：

1. **(a) 是我明确不选的方案。** 它把一个 LAN HTTP 传输的实现细节搬进模型治理核心，为了让它编译通过要扩 `MODEL_ROUTE_TASK_CLASSES`，而那个枚举参与 policy 契约 hash 和 route 准入判定 —— 为了迁移一个未接线的参考实现去改动一个已冻结、已被静态守卫和 26 个 MySQL 行为测试锚定的治理契约，收益与风险完全倒挂。它同时删除流式能力和整个应急队列语义。
2. **(b) 在概念上是"正确"的复用方式（它就是官方接缝），但它的前置条件不是工程可以自己满足的**：逐请求投影回执 → 需要企业数据资产目录条目；route policy → 需要真人 owner 批准；readiness 回执 → 需要运维探针；终态回执的 cost/pricingVersion/providerRequestRef → 需要 adapter 解析上游响应体（今天的直通刻意不解析）。任何一项缺失，结果都不是"降级运行"，而是每个请求产出一条 `blocked` 决定并 503。把它当本轮任务实施 = 交付一个必然全量拒绝的网关。
3. **(c) 是唯一能在本轮真正落地、且落地后确实消灭了"独立"这个性质的方案。** C-1 之后，"CAIO 有自己的一套模型出站策略"这句话不再成立：能出站到哪里，由治理链的 owner 批准策略单方面决定；CAIO 侧只剩传输与本地审计。剩下的"两条回执链"问题由 C-2 用一条链接字段收口。
4. **(c) 不需要放宽任何治理守卫。** 这是它相对 (b) 的决定性优势 —— (b) 必须把新 adapter 文件加进 `MEG-GATEWAY-BYPASS` 的白名单。

**我不选 (a)。** 理由如上：改动面最大、收益最小、且要求修改一个被守卫冻结的治理契约枚举。

---

## 5. 测试与守卫变更（按选项）

### 5.1 选项 (a)

| 变更 | 文件 |
| --- | --- |
| 重写 | `lib/caio-model-proxy/proxy-engine.test.ts`（~55 用例） |
| 重写 | `lib/caio-access-gateway/model-dispatch-bridge.test.ts` |
| 重写 | `lib/caio-access-gateway/gateway-model-dispatch-e2e.test.ts` |
| 删除 | `gateway-audit-integration.test.ts:278`（应急队列服务用例） |
| 更新（枚举变更波及） | `lib/llm/model-route-contracts.test.ts`、`model-egress-contracts.test.ts`、`governed-model-gateway.service.test.ts`、`model-egress-store.mysql.test.ts` |
| 守卫 | `check:model-egress-governance` **必须改**（task class 枚举字面量、可能的 store token） |

### 5.2 选项 (b)

| 变更 | 文件 |
| --- | --- |
| 重写 dispatch 段 | `lib/caio-model-proxy/proxy-engine.test.ts` |
| 更新状态映射 | `lib/caio-access-gateway/model-dispatch-bridge.test.ts` |
| 删除 | `gateway-audit-integration.test.ts:278` |
| 新增 | adapter 单测（上游响应解析 → cost/pricingVersion/providerRequestRef） |
| 守卫 | `check:model-egress-governance` **必须改**：`INTERNAL_AUTHORITY_BOUNDARIES[3].allowedFiles` 增加新 adapter 文件 |

### 5.3 选项 (c)（建议方案）

| 变更 | 文件 |
| --- | --- |
| 更新 fixture（binding 加两字段） | `lib/caio-model-proxy/alias-contracts.test.ts`、`proxy-engine.test.ts`、`lib/caio-access-gateway/gateway-model-dispatch-e2e.test.ts`、`model-dispatch-bridge.test.ts` |
| 更新 deps（加 `governedAdmission`） | 上述四个文件里的 `createCaioModelProxy` 构造点（`proxy-engine.test.ts:190, 768, 1159`；`gateway-model-dispatch-e2e.test.ts:165`） |
| 新增状态映射 | `model-dispatch-bridge.test.ts`（`route_not_admitted`、`content_boundary_denied`） |
| 新增 | `lib/llm/caio-governed-lan-admission.service.test.ts` |
| 新增 | `lib/caio-model-proxy/governed-admission-gate.test.ts` |
| 保持不变 | `lib/caio-audit-state/**` 全部（C-1）；`gateway-audit-integration.test.ts:278` **继续通过** |
| 守卫 | `check:model-egress-governance` **不需要改**（见 §7） |

---

## 6. 守卫是否需要变更

| 选项 | `check:model-egress-governance` | 说明 |
| --- | --- | --- |
| (a) | **需要放宽/改动** | 扩 task class 枚举会改动 `model-route-contracts.ts` 的封闭集；把 dispatch 搬进 `lib/llm` 后，新文件可能需要引用受限 token |
| (b) | **需要放宽** | 新 adapter 文件必须加入 `GovernedModelProviderAdapter` 的 `allowedFiles` |
| (c) C-1/C-2 | **不需要改动** | 新文件只引用 `parseStoredTenantModelRoutePolicy`、`requireModelRoutePolicyOwnerApproval`、`lockModelEgressWorkspace` —— 三者均不在禁止 token 列表内 |

**另一条与守卫无关但同样是"冻结面"的东西**：`package.json` 的 script 字符串被 `scripts/public-release-guard.ts:923` 逐字冻结，并被 `lib/public-release-guard.test.ts:752, 924` 与 `lib/public-mirror-tree-builder.test.ts:201, 365` 断言。**因此新测试文件不要加进 `check:model-egress-governance` 的命令串**，让它们跑在默认 `test` 里，可以完全避开这四处联动。

---

## 7. ⚠️ 放宽治理守卫的声明（需要 owner 签字，不是重构细节）

**在建议方案 (c) C-1 + C-2 下，本节为空 —— 不需要放宽任何守卫。**

以下内容仅在 owner 选择 (b) 时适用，届时必须单独立项：

> **拟放宽规则**：`scripts/check-model-egress-governance.ts:173-175`，`MEG-GATEWAY-BYPASS` 规则中 `GovernedModelProviderAdapter` 的 `allowedFiles`，由
> `[ADAPTER_REGISTRY, GOVERNED_GATEWAY]`
> 扩为
> `[ADAPTER_REGISTRY, GOVERNED_GATEWAY, "lib/llm/caio-upstream-adapter.ts"]`。
>
> **该规则原本防的是什么**（守卫自己的注释 `:166-172`）："adapter.invoke() 接受 claim hash 作为普通字符串、自己无法验证它们，因此唯一合法调用点是受治理 gateway。在 public core 的其他任何地方引用 adapter 类型一律拒绝 —— 这是防止调用方把 dispatch 绕过 decision/claim/receipt 链的纵深防御。"
>
> **放宽后的残余风险**：新文件持有一个可以直接被调用的 `invoke()`。守卫将不再阻止该文件内部（或误用该文件的第三方）在没有 claim 的情况下调用它。补偿措施只能是行为测试（§10 的对抗性测试），静态保证会永久性地弱一档。
>
> **明确立场**：为了让一次重构装得下而放宽治理守卫是一个危险信号。如果 owner 选择 (b)，这一条应当作为独立 PR、独立评审、独立签字，绝不与实现代码同 PR 合入。

**同样必须明说的规避路径**：不写出类型名就能绕过 token 扫描（§1.5）。本文档明确拒绝该做法，并建议在评审清单里增加一条："任何新的、传给 `createGovernedModelGateway({adapters})` 的对象字面量，必须显式标注 `GovernedModelProviderAdapter` 类型" —— 让守卫能看见它。

---

## 8. 没有 owner 就不能决定的事

以下三项**不是重构，是产品决定**，工程侧不应替 owner 作答：

### D-1（阻断性）LAN 模型请求在中心治理库不可达时是否允许继续？

- 今天的答案是**允许**：`audit-gate.service.ts:301-302` → `:254-267` → `:343-350`，回执落本地 AES-256-GCM 加密队列（`emergency-queue.ts`，0700 目录 / 0600 条目 / entryId 作为 GCM AAD），网关状态 `PRIMARY_DEGRADED`，readiness `degraded`，继续服务。
- 治理链的答案是**结构性不允许**：`claimModelRouteDispatch` 全程在 SERIALIZABLE 事务里，无降级分支。
- 选 (a) 或 (b) = 把答案改成"不允许"。这是可用性 SLO 的改变，会直接影响 LAN 上 Codex/WorkBuddy 的可用性承诺。**必须由 owner 回答。**

### D-2 一张 CAIO 审计回执断言的是什么？

- 今天：六字段封闭集，含义是"这次 dispatch 在发生前被持久记录过"（`audit-state-contracts.ts:42-60`）。
- C-2 之后：额外断言"这次 dispatch 由治理策略 P / route R 准入"。
- 属于回执语义变更。虽然无历史数据需回填（零生产调用点，实测），仍需 owner 确认这是他要的语义。

### D-3 开发者在 LAN 上发给编码助手的 prompt，是不是一项"企业数据资产"？

- 若是：需要为它建目录条目、分级、授权、签发阶段回执，然后 (b) 才在语义上诚实。
- 若否：治理链的投影回执模型对 LAN 直通根本不适用，(a)/(b) 永远只能靠伪造前置条件成立。
- 这是数据治理口径问题，不是工程判断。**必须由 owner 回答。**

---

## 9. 实施计划（选项 (c)，C-1 + C-2）

> 以下按依赖顺序排列。标注：**[新建]** / **[修改]** / **[形变]**（= 已导出符号的形状改变，任何现有消费者都是潜在断点）。

### 9.1 逐文件变更清单

| # | 文件 | 类型 | 内容 |
| --- | --- | --- | --- |
| 1 | `lib/caio-model-proxy/governed-admission-contracts.ts` | **[新建]** | 纯类型 + zod：`CaioGovernedRouteAdmission`（routeRef, policyKey, policyId, policyHash, policyHeadVersion, policyRevocationEpoch, provider, credentialRef, region, deploymentForm, jurisdiction, retentionDays, trainingUse, pricingVersion, maxOutputTokens, validUntil）、`CaioGovernedAdmissionSnapshot`（`{policyKey, policyId, policyHash, validUntil, routes: ReadonlyMap<string, CaioGovernedRouteAdmission>}`）、端口 `CaioGovernedAdmissionPort { snapshot(): CaioGovernedAdmissionSnapshot }`。**不 import `lib/llm`**（保持 caio → llm 的单向依赖只在组合根发生） |
| 2 | `lib/llm/caio-governed-lan-admission.service.ts` | **[新建]** | `resolveGovernedLanAdmissionSnapshot({workspaceId, policyKey, now?}): Promise<CaioGovernedAdmissionSnapshot>`。在一个 `db.$transaction` 内：读 `tenantModelRoutePolicyHead` → 读 `tenantModelRoutePolicy`（须 `status==="ACTIVE"` 且在有效期内）→ `parseStoredTenantModelRoutePolicy` → `requireModelRoutePolicyOwnerApproval` → 投影成快照。任何一步失败即抛 `CaioGovernedLanAdmissionError`（fail-closed，绝不返回空快照）。**不引用任何受守卫限制的 token。** |
| 3 | `lib/caio-model-proxy/alias-contracts.ts` | **[形变]** | `bindingCoreShape`（`:87-100`）增加 `governedPolicyKey: policyKeySchema`、`governedRouteRef: z.string().min(1).max(200)`。影响导出符号：`caioModelAliasFallbackCandidateSchema`、`caioModelAliasBindingSchema`、`CaioModelAliasFallbackCandidate`、`CaioModelAliasBinding`。**这是最大的风险面：所有 binding fixture 必须补两字段，否则 `.strict()` 直接 parse 失败。** `isFallbackAllowed` 的等价规则**不**加入这两个字段（fallback 本来就去另一条 route） |
| 4 | `lib/caio-model-proxy/governed-admission-gate.ts` | **[新建]** | `assertBindingAdmitted(binding, snapshot): void`（构造期，抛 `CaioModelProxyConfigError`）与 `isRouteAdmittedNow(routeRef, snapshot, now): boolean`（运行期）。逐字段比对：provider ↔ providerKey、credentialRef、region、deploymentForm、jurisdiction、retentionDays、trainingUse |
| 5 | `lib/caio-model-proxy/outbound-content-gate.ts` | **[新建]** | `assessCaioOutboundContent(body): {denied: boolean; categories: readonly string[]}`，内部调用 `detectHardBoundaryHits`（`lib/caio-context-broker/broker-contracts.ts:590`）+ `isNonRedactableHardBoundaryCategory`（`:356`）。**只返回类别码，绝不返回命中内容或偏移**，避免把敏感片段带进结果对象 |
| 6 | `lib/caio-model-proxy/proxy-engine.ts` | **[形变]** | 见 §9.2 |
| 7 | `lib/caio-access-gateway/gateway-error-contract.ts` | **[形变]** | `CaioAccessGatewayErrorCode`（`:22-65`）增加 403 类 `route_not_governed`；`WIRE_STATUS_BY_CODE`（`:80-106`）增加对应项。`content_boundary_denied` **复用既有** `external_release_denied`（422），不新增码 |
| 8 | `lib/caio-access-gateway/model-dispatch-bridge.ts` | **[修改]** | `caioModelDispatchOutcomeFromProxyResult` 的 switch（`:102-166`）增加两个 case。注意：不加这两个 case，`:162` 的 `const unexpected: never = result.status` 会**编译失败** —— 这是设计好的强制点，不要用 `as never` 绕过 |
| 9 | `lib/caio-model-proxy/index.ts` | **[修改]** | 导出新增符号 |
| 10 | `prisma/schema.prisma` | **[修改]** | `CaioAuditDispatchReceipt`（`:6802-6816`）增加 `governedPolicyId String @db.VarChar(191)`、`governedPolicyHash String @db.VarChar(191)`、`governedRouteRef String @db.VarChar(191)`，均 NOT NULL；索引 `[workspaceId, governedRouteRef]` |
| 11 | `prisma/migrations/<ts>_caio_audit_governed_linkage/migration.sql` | **[新建]** | 三列 ADD COLUMN NOT NULL（无 DEFAULT，表为空） |
| 12 | `lib/caio-audit-state/audit-state-contracts.ts` | **[形变]** | `caioMinimalAuditReceiptSchema`（`:51-60`）六字段 → 九字段；`canonicalCaioReceiptPayload`（`:74-85`）位置编码追加三项（**注意：这会改变 `caioReceiptDigest` 的取值，应急队列里已有的旧条目会被判为 content conflict —— 因表为空且无生产部署，可接受；必须写进 runbook**） |
| 13 | `lib/caio-audit-state/gateway-audit-gate-adapter.ts` | **[形变]** | `CaioCanonicalAuditClaim`（`:51-58`）与 `caioCanonicalAuditClaimSchema`（`:66-75`）同步加三字段；`CAIO_CANONICAL_AUDIT_CLAIM_FIELD_MAP`（`:78-85`）加三条恒等映射；`toCaioMinimalAuditReceipt`（`:88-100`）透传 |
| 14 | `lib/caio-audit-state/prisma-audit-receipt-store.ts` | **[修改]** | `create` 的 data（`:23-31`）加三列；`sameContent` 比对（`:53-57`）加三项 |
| 15 | `lib/caio-access-gateway/gateway-http-core.ts` | **[修改]** | MCP 面的 audit claim（`:713`）也要提供三个新字段。MCP 工具调用不是模型出站，**建议用保留常量**（如 `CAIO_GATEWAY_MCP_GOVERNED_ROUTE_REF = "not-model-egress"`）而非伪造一个 route ref，并在常量旁写清理由 |

### 9.2 `proxy-engine.ts` 的精确改动

依赖类型 `CaioModelProxyDependencies`（`:140-156`）增加**必填**：
```
governedAdmission: CaioGovernedAdmissionPort;
```

`CaioProxyExecuteStatus`（`:180-194`）增加两个成员：`"route_not_admitted"`、`"content_boundary_denied"`。

`createCaioModelProxy` 的构造循环（`:417-426`）在 `bindingsByAlias.set` 之前追加 `assertBindingAdmitted(binding, snapshot)`，并对每个 `binding.fallbackCandidates` 同样校验。

`execute` 的新顺序（在既有 `:536-601` 基础上插入两步）：

```
1  alias 查找                        (:536-537)   不变
2  alias grant 检查                  (:546-547)   不变
3  route 准入检查   ← 新增           isRouteAdmittedNow(binding.governedRouteRef, snapshot, now)
                                     失败 → route_not_admitted (403)，无回执、无凭据、无出站
4  status / protocol 检查            (:549-552)   不变
5  rate limit                        (:554-576)   不变
6  出站内容边界门 ← 新增             assessCaioOutboundContent(input.body)
                                     命中不可脱敏类别 → content_boundary_denied (422)
7  inputHash                         (:578)       不变
8  audit claim                       (:587-601)   claim 增加三个治理链接字段
9  credential load                   (:603-623)   不变
10 upstream invoke                   (:625)       不变
11 fallback：候选必须同时满足 grant + isRouteAdmittedNow  ← 新增第二个条件 (:654-656)
```

步骤 3 与 6 都在 audit claim 之前，与既有 `alias_not_granted` 同风格：**拒绝不消耗回执、不加载凭据、不产生任何出站**。步骤 3 放在 status/protocol 之前，是为了让"未被治理策略准入"的 alias 不泄露其后端状态。

### 9.3 精确接缝

**CAIO 侧会调用的 `lib/llm` 函数：只有一个，且只在组合根（网关装载代码）调用一次。**

```ts
// lib/llm/caio-governed-lan-admission.service.ts  [新建]
export async function resolveGovernedLanAdmissionSnapshot(input: {
  workspaceId: string;
  policyKey: string;
  now?: Date;
}): Promise<CaioGovernedAdmissionSnapshot>;
```

它内部复用的既有函数与当前签名：

| 函数 | 位置 | 当前签名 |
| --- | --- | --- |
| `parseStoredTenantModelRoutePolicy` | `lib/llm/model-route-policy-store.service.ts:276` | `(row) => TenantModelRoutePolicy` |
| `requireModelRoutePolicyOwnerApproval` | `lib/llm/model-route-policy-store.service.ts:627` | `(tx, {workspaceId, policy}) => Promise<ModelRoutePolicyApprovalReceipt>` |
| `lockModelEgressWorkspace` | `lib/llm/model-route-policy-store.service.ts:166` | `(tx, workspaceId) => Promise<...>` |

**CAIO 侧今天没有、必须新提供的东西**：

| 项 | 粒度 | 谁创建 | 何时 |
| --- | --- | --- | --- |
| `governedPolicyKey` / `governedRouteRef`（写在 alias binding 里） | 每 binding 一次 | 运维（网关配置） | 安装/配置时 |
| ACTIVE + 真人 OWNER 批准的 `TenantModelRoutePolicy` | 每工作区一份 | **owner 本人**（`approvedByUserRef` 被逐字比对） | 首次装载前 |
| 快照实例 | 每进程一次 | 网关装载代码 | 进程启动时；策略变更后需重启或显式重载 |

**逐请求需要新建的东西：无。** 这正是 C-1 与 (a)/(b) 的分界线。

### 9.4 `lib/caio-audit-state` 的去向

**保留，不降级，不删除。** 明确回答问题中的矛盾点：

- **四状态机保留且语义不变。** `NORMAL / PRIMARY_DEGRADED / AUDIT_UNAVAILABLE / RECOVERING` 全部继续有意义，因为 C-1 不引入逐请求库依赖。
- **加密应急队列保留且语义不变。** 主库挂掉 → 回执落队列 → **继续放行**。这与治理链没有冲突，因为 C-1 里治理链**不参与逐请求放行决定** —— 它只在进程启动时决定"这个网关被允许出站到哪些 route"。这两件事在时间维度上是分开的，因此不存在"需要活库的 claim"与"为没有活库而生的队列"之间的矛盾。
- **唯一诚实的缺口**：进程在主库中断期间冷启动 → 无法解析快照 → 拒绝启动/拒绝服务。今天它可以。这是 C-1 引入的**唯一**可用性回退，必须写进 runbook，且**不应**用本地缓存快照去掩盖（那等于在 LAN 机器上复制一份策略权威，重新制造一个独立治理副本）。
- 如果 owner 后来选择 C-3（逐请求治理决定），**那时** 应急队列与四状态机才真正与治理链矛盾，届时应当**删除**它们而不是保留一个无放行权力的空壳 —— 保留一个不再是门的"门"，比删掉它更危险。

### 9.5 测试计划

**必须修改的现有测试**（fixture 与 deps 形变所致）：

| 文件 | 原因 |
| --- | --- |
| `lib/caio-model-proxy/alias-contracts.test.ts`（311 行） | binding fixture 加两字段 |
| `lib/caio-model-proxy/proxy-engine.test.ts`（1238 行） | 同上 + `createCaioModelProxy` 三处构造（`:190, :768, :1159`）加 `governedAdmission` |
| `lib/caio-access-gateway/gateway-model-dispatch-e2e.test.ts` | 构造点 `:165` + binding fixture |
| `lib/caio-access-gateway/model-dispatch-bridge.test.ts` | 构造点 `:344` + 两个新状态的映射断言 |
| `lib/caio-audit-state/audit-gate.service.test.ts`（725 行） | 最小回执 fixture 六字段 → 九字段 |
| `lib/caio-audit-state/emergency-queue.test.ts`（278 行） | 同上 |
| `lib/caio-audit-state/gateway-audit-gate-adapter.test.ts` | canonical claim fixture + 字段映射断言 |
| `lib/caio-audit-state/audit-state-contracts.test.ts` | 六字段封闭集断言 |
| `lib/caio-audit-state/audit-state.mysql.test.ts` | 新增三列 |
| `lib/caio-access-gateway/gateway-http-core.test.ts` | MCP claim 的新字段 |

**必须保持通过、不得修改**（它们是"没有破坏既有治理"的证据）：

- `lib/caio-access-gateway/gateway-audit-integration.test.ts:278` — "keeps serving through the encrypted emergency queue while the primary store fails"。**这条通过 = C-1 没有把 LAN 出站绑死在活库上。** 若它变红，说明实现走偏成了 (b)。
- `lib/llm/**` 全部既有测试 —— C-1 不修改 `lib/llm` 任何既有文件。
- `scripts/check-model-egress-governance.test.ts`。

**证明"复用是真的、不是名义上的"的新测试**：

1. `lib/llm/caio-governed-lan-admission.service.test.ts`
   - 无 head / 无 ACTIVE policy / policy 过期 / 缺 OWNER 批准回执 / 批准回执 policyHash 不匹配 → 各自抛错，**绝不返回空快照**。
   - 快照的每个 route 字段逐字来自 policy 行，不是默认值。
2. `lib/caio-model-proxy/governed-admission-gate.test.ts`
   - binding 的 `credentialRef` 与治理 route 不一致 → 构造失败。
   - binding 的 `region` / `deploymentForm` / `jurisdiction` / `retentionDays` / `trainingUse` 任一不一致 → 构造失败（逐维各一条用例）。
   - `governedRouteRef` 不在快照中 → 构造失败。
   - fallback 候选未被准入 → 构造失败。
3. `lib/caio-model-proxy/proxy-engine.test.ts` 新增
   - 快照过期后，此前可用的 alias 返回 `route_not_admitted`，且 `auditGate.claimDispatch` **零调用**、`credentialLoader.load` **零调用**、upstream client **零调用**（用 spy 断言调用序，与既有 `:478` "spy order" 用例同风格）。
   - 出站 body 含不可脱敏硬边界（如私钥片段）→ `content_boundary_denied`，同样零 claim / 零凭据 / 零出站。
   - fallback 候选在运行期失去准入 → 不发起 fallback，且不为它 claim 第二张回执。
4. `lib/caio-audit-state/audit-gate.service.test.ts` 新增
   - 缺任一治理链接字段的 claim 被 `.strict()` schema 拒绝（fail-closed，而非填默认值）。

**对抗性测试（若 CAIO 路径仍能在没有治理准入的情况下触达上游，它必须失败）**：

> `lib/caio-model-proxy/proxy-engine.governed-subordination.test.ts` — **`refuses every dispatch when the governed admission snapshot contains no route`**
>
> 构造一个**完全正常**的 proxy：binding active、协议匹配、alias 在 grant 内、rate limiter 放行、audit gate 永远返回 `allowed`（带真实 receiptId）、credentialLoader 返回一个 key、两个 upstream client 都返回 200。**唯一的偏差**：`governedAdmission.snapshot()` 返回 `routes` 为空的快照。
>
> 断言：`execute()` 返回 `status === "route_not_admitted"`；且 `auditGate.claimDispatch` 调用次数 === 0；且 `credentialLoader.load` 调用次数 === 0；且两个 upstream client 的 `invoke` 与 `invokeStreaming` 调用次数均 === 0；且 `result.body === null`、`result.receiptId === null`。
>
> 这条测试在今天的代码上**必然失败**（今天没有 `governedAdmission` 这个概念，请求会一路跑到 upstream 并返回 200）。它变绿即证明从属关系是真实的执行路径，而不是文档里的一句话。

**注意**：新测试文件**不要**加入 `check:model-egress-governance` 的命令串（§6），让它们跑在默认 `npm test` 里。

### 9.6 回滚故事

按依赖倒序，三个独立可回滚层：

| 层 | 内容 | 最小回滚 |
| --- | --- | --- |
| L3（最外） | C-2 回执链接字段 | `git revert` 变更 #10-#15 + 一条 DROP COLUMN 迁移。表为空 → 无数据损失。回滚后 L2 仍完整有效（准入门不依赖回执字段） |
| L2 | 准入门 + 内容门（变更 #1-#9） | `git revert`。CAIO 回到今天的行为：静态 binding、无治理绑定 |
| L1 | 无 | C-1/C-2 **不修改 `lib/llm` 任何既有文件**，因此治理链侧没有需要回滚的东西 |

**最小回滚 = 单个 `git revert <merge-commit>` + 一条 DROP COLUMN 迁移。** 前提是三层放在**同一个 PR 的三个提交**里而不是三个 PR（三个 PR 会让 L3 依赖 L2 的分支状态）。若只想撤销准入门而保留回执字段，回滚变更 #3-#6 + #8 即可，#10-#15 可独立存活（新字段变为由配置直接提供的常量）。

**部署侧回滚**：C-1 的行为差异对客户端可见的只有两个新的拒绝码。若准入门误伤（binding 与 policy 有字段漂移），最快的现场止血是修正 policy 或 binding 使二者一致，**而不是**把准入门改成警告 —— 一个只警告的准入门就不是门。

---

## 10. 剩余风险

1. **`alias-contracts.ts` 的 schema 形变是本方案最大的破坏面**。它被 `.strict()` 保护，任何遗漏的 fixture 都会在 parse 时炸而不是静默通过 —— 这是好事，但意味着改动必须一次性覆盖全部 fixture。
2. **C-2 改变 `caioReceiptDigest` 的取值**，因此任何已存在于本地应急队列目录里的旧条目都会被判为 content conflict（409）。因无生产部署，实际影响为零；但必须写进 runbook，并在升级步骤里要求先 `recover()` 排空队列再升级。
3. **快照的新鲜度是弱的**：策略被 owner 撤销后，已启动的进程要到重启或显式重载才会感知。治理链自己的 `claimModelRouteDispatch` 是逐请求重验 policy head 与 revocationEpoch 的（`:2250-2269`）——C-1 换来的可用性，代价就是撤销的生效延迟。**这一点必须诚实地写进产品文档，不能声称"撤销即时生效"。** 缓解：给快照一个短 TTL（如 5 分钟）并允许后台异步刷新，刷新失败**不**使快照失效（否则又把可用性绑回活库），只在 `validUntil` 到达时硬过期。
4. **内容边界门是正则检测**，会有漏检与误报。它是纵深防御的一层，不能被描述为"保证 prompt 里没有密钥"。

---

## 11. English executive summary

**Verdict.** Option (a) is infeasible: driving the governed chain per request requires a `GovernedModelProjectionReceipt`, which requires at least one confirmed / classified / authorized `DataAssetCatalogEntry` (`lib/llm/model-egress-store.service.ts:760-764`, `:1020-1025`, `:872-921`). A developer's LAN prompt is not an enterprise data asset. Additionally the task-class enum is closed and has no LAN passthrough member (`lib/llm/model-route-contracts.ts:12-21`), the projection receipt's `redactionStatus` has no "verbatim" value (`:156-159`), and the adapter contract is non-streaming JSON-in/JSON-out (`lib/llm/governed-model-adapter-registry.service.ts:109-121`).

Option (b) is the sanctioned seam but inherits every one of those prerequisites, needs a new adapter that parses upstream responses for cost / pricing version / provider request ref (which passthrough deliberately does not do), and requires relaxing `MEG-GATEWAY-BYPASS` to let the adapter file exist. Both (a) and (b) delete the encrypted emergency queue's reason for existing, because `claimModelRouteDispatch` runs entirely inside a SERIALIZABLE transaction with no degraded path.

**Recommendation: option (c)**, staged. C-1 (implementable now, no owner decision, no guard relaxation): resolve a frozen admission snapshot from the ACTIVE owner-approved `TenantModelRoutePolicy` once at gateway load, make every alias binding name a governed route, refuse any dispatch whose route is not admitted, and run the Context Broker's hard-boundary content detector over the outbound body. C-2 (cheap, owner acknowledgement): link CAIO receipts to the governed policy identity. C-3 (owner product decision): per-request governed decisions.

**The four-state audit machine and the encrypted emergency queue survive C-1 and C-2 unchanged**, because C-1 introduces no per-request database dependency. The one honest availability regression is a cold start during a database outage. Do not paper over it with a locally cached snapshot — that would recreate the second independent stack this work exists to remove.

**Owner decisions required**: (D-1) may a LAN model request proceed when the central governance database is unreachable? (D-2) what does a CAIO audit receipt assert? (D-3) is a developer's LAN prompt an enterprise data asset?
