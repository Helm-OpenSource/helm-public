---
status: planning / master-plan-pending-owner-review
owner: helm-core
created: 2026-09-16
review_after: 2026-10-16
public_safety: Public-safe master implementation plan for CAIO live operating
  P1 in Core (pull-based on-premises inference job queue, inference access
  audience, device-side worker, scheduled review enqueue, scheduler run ledger,
  execution-receipt defect closure and CEO question selection entry). No
  customer data, private endpoint, credential, production receipt, activation,
  or production-readiness claim.
---

# CAIO 实时经营 P1 Core 总计划

> **For agentic workers:** 本文是总计划，负责拆分切片、固定接口和设计决定。每个切片开工前，先按 superpowers:writing-plans 写出逐步计划，再按 superpowers:executing-plans 执行。

**Goal:** 让已受理 G0 的租户进入下一阶段：
- 系统按小时和按日把经营上下文快照交给客户现场的本地模型，做诊断与复盘；
- 判断按闭集契约回写，拒收时整包拒收；
- CEO 可以在 OWNER 操作面板上完成十题选题；
- 调度作业的成败落库，供复盘使用。

**Architecture:**
- 生产应用是唯一的记录权威和出域授权权威。
- 设备侧 worker 只主动发起连接，只持有推理 audience 令牌。
- 任务队列复用既有出域治理链：`ModelRouteDecision` 管调用前决策，领取即 dispatch claim，提交时写 terminal receipt。
- 判断落为既有 P3a `JudgementPacket`，不新增第二套判断模型。
- 所有新能力默认关闭，每个切片单独开关、单独回滚。

**Tech Stack:** Prisma（MySQL）、zod、既有 `lib/llm` 出域治理、`lib/caio-access-gateway`、`lib/operating-harness`、vitest（单测，加隔离 MySQL 集成测试）。

**Spec:** `docs/superpowers/specs/2026-09-15-caio-live-operating-core-spec.md` §4、§8、§11 的 P1 行。

## Global Constraints

- 所有新增运行能力默认关闭。开关只认精确的字符串 `"true"`。
- 生产应用不主动连接设备；设备不持有任何生产数据库或业务凭据。
- 推理输入只包含经营上下文快照和汇总计数，不包含任何客户记录、联系方式或个案正文。
- 判断只是建议：`commitmentClass=advice`，`humanReviewerRequired=true`。建议只允许两类，即规则草案和干跑请求，不能是执行。
- 判断引用的证据必须全部来自输入快照。格式错误、证据越界、越出闭集时整包拒收，不部分采纳。
- 判断里的自由文本只当数据，不当指令。
- 领取任务就是出域授权截止点。租约到期只对账，不盲目重发；已提交的判断不重复计入。
- 读 `updateMany` 计数的 CAS 必须放在 Serializable 事务里，或者改用单语句 `$executeRaw`，这是 `check:conditional-update-cas` 的要求。
- 治理记录不设 server action，这是冻结的 ADR：推理令牌的签发和吊销走受控 CLI。
- `check:caio-terminology`、`check:boundaries`、`check:conditional-update-cas`、`check:stage1-owner-loop` 保持通过。
- 公开仓库的内容不出现任何客户名、私有端点或凭据。测试里的号码形字面量要在运行时拼出来。

## 设计决定（总计划冻结，切片计划不得改动）

| 编号 | 决定 |
|---|---|
| P1-A1 | 新表 `CaioInferenceJob`，任务类闭集为 `hourly_diagnosis` 和 `daily_review`（快检不入队）。状态闭集：`queued / claimed / completed / rejected / expired / dead_letter`。唯一键是 `(workspaceId, taskClass, windowStart)`，保证同一窗口只入队一次 |
| P1-A2 | 入队时冻结输入：取窗口内的 `CaioOperatingContextSnapshot` 引用和汇总补充项，`inputHash = sha256(canonicalJson(input))`。任务类映射到路由任务类：`hourly_diagnosis → reasoning_counterfactual`，`daily_review → summary_briefing`。出域准备（投影回执与调用前 `ModelRouteDecision`）由 A15 的受治理网关延迟派发接口完成，队列模块不直接调用出域存储 |
| P1-A3 | 领取分两步：先在 Serializable 事务里对任务行做 CAS，写入 `claimToken` 和 `leaseExpiresAt`，`attempt` 加 1；然后经 A15 的延迟派发领取接口完成 dispatch claim（授权截止点）。被拒时任务转 `rejected`，记录闭集原因 |
| P1-A4 | 租约到期由回收作业处理：经 A15 接口给旧决策写 terminal receipt，`outcome=unknown`、`resolutionSource=reconcile`。如果尝试次数小于上限（默认 3），为同一输入准备新决策（`attemptOrdinal+1`）并回到 `queued`，否则转 `dead_letter`。窗口过期（小时任务 2 小时，日终任务 24 小时）后转 `expired` |
| P1-A5 | 提交时要校验 `claimToken`、租约未到期、`inputHash`、输出契约，然后写 `JudgementPacket` 私有存储、经 A15 接口写 terminal receipt（`success`）、任务转 `completed`。同一个 `claimToken` 重复提交时返回首次的结果，不重复计入 |
| P1-A6 | 分层内容用闭集结构 `CaioLayeredJudgement`，包含 `facts`、`inferences`、`risks`、`unknowns`、`suggestions`。其中 `facts` 每条至少引用一个输入快照内的 `EvidenceRef`；`suggestions[].kind` 只能是 `rule_draft` 或 `dry_run_request`。正文放私有列；`JudgementPacket.disposition` 只写结构版本和内容哈希，格式为 `caio.layered-judgement.v1:sha256:<hex>` |
| P1-A7 | 访问网关新增 audience `inference`，前缀 `hcaio_inf_`，clientType 新增 `inference_worker`。只开放两个路由：`POST /v1/inference-jobs/claim` 和 `POST /v1/inference-jobs/submit`。请求体上限 256 KiB，默认每分钟 30 次 |
| P1-A8 | 推理令牌单独签发（单 audience），不复用 `issueCaioTokenPair`。签发、吊销、列表走受控 CLI `npm run caio:inference-token`，要求 OWNER 身份并写审计 |
| P1-A9 | 设备侧 worker 放在 `tools/caio-inference-worker/`，依赖全部做成端口。每轮先探测本机 OpenAI 兼容端点：探测失败就不领取，只记录离线心跳；探测成功才领取。模型输出必须是 JSON，本地先用闭集契约校验一次，失败就提交 `malformed_output`，不自行修补 |
| P1-A10 | 调度作业成败落到新表 `SignalCollectionJobRun`（通用，不限于 CAIO），开关 `HELM_SIGNAL_COLLECTION_RUN_LEDGER_ENABLED`。只记录作业键、来源、起止时间、耗时、结果闭集（`succeeded / failed / crashed / skipped`）、目标数、失败目标数和错误码，不记录错误正文。保留 30 天 |
| P1-A11 | 执行回执并发降级缺陷：代码已由 `f7c13a0c`（2026-07-25，锁后写 CAS）修复，但 STATUS 和 P1C 入口图没有更新。P1-0 负责重跑隔离 MySQL 并发测试取证、更新文档。**文档更新之前，不开放任何远程或界面变更入口** |
| P1-A12 | CEO 选题入口放在 `/caio/operator`（OWNER 服务端动作），复用 `selectCaioOperatingQuestions` 和 `bindCurrentCaioQuestionSelectionToDecisionRecords`。硬前置是 `getCaioInitializationGateStatus` 返回 `accepted`，否则 fail closed 并显示原因。`Stage1OwnerLoopConsole` 保持只读，它的可访问性守卫不改 |
| P1-A13 | 小时和日终入队由 Core 的通用作业工厂 `createCaioInferenceEnqueueJob` 提供，开关 `HELM_CAIO_HOURLY_REVIEW_ENABLED` 和 `HELM_CAIO_DAILY_REVIEW_ENABLED`。汇总补充项由 overlay 注入一个只返回计数的端口 |
| P1-A14 | `/caio` 读出增加复盘区块：显示最近的判断（分层内容）、拒收原因和推理离线状态。没有判断时直说“无判断”，不用空白代替 |
| P1-A15 | **出域权威只有一个组合者（2026-09-16 实现核查后补充）。** `check:model-egress-governance` 规定，`GOVERNED_GATEWAY_AUTHORITY`、`prepareModelRouteDecision`、`claimModelRouteDispatch`、`recordModelEgressTerminalReceipt` 只允许出域存储和 `governed-model-gateway.service.ts` 引用；投影权威只允许投影服务引用。现有网关是同步的“准备 → 领取 → 调用 → 终态”，放不下拉取式推理。**默认做法（owner 可以否决）：** 在 `lib/llm/governed-model-gateway.service.ts` 内新增延迟派发三步：`prepareDeferredGovernedModelRequest`（投影回执加调用前决策）、`claimDeferredGovernedModelDispatch`（由设备 worker 已登记的适配器运行描述符和 readiness 回执完成 dispatch claim）、`completeDeferredGovernedModelDispatch`（终态回执，可以是 success、failure 或 unknown 对账）。守卫的允许文件清单不变，出域权威仍然只有网关一个组合者。这一项是对 P1D 出域治理的扩展，列为 P1-3a。**owner 2026-09-16 同意。** 实现细节：设计与投影回执的 TTL 都只有 5 分钟，所以投影与决策放在 worker 领取时才做，不在入队时做；lease 到期后以 reconcile 追加 failure 终态，释放路由并发 |
| P1-A16 | **网关宿主在安小信部署内不存在（2026-09-16 装配后核查补充）。** 四个仓库里宿主 CAIO 访问网关的只有 `overlays/helm-self/lib/workbuddy-lan/access-gateway-deployment.ts`，而它本就因为没有任何 `project_resolver` 实现而拒绝挂载；控制面里 `caio-access-gateway` 只出现在 **caio-pro 交付包**，`anson-cn-enterprise` 的 BOM 与 env 契约都没有它。所以 A7 的两条推理路由在安小信这边无处可挂（Core 已把推理端口设为可选，没有端口时路由无人认领），`CAIO_INFERENCE_JOBS_ENABLED` 也不登记进安小信 env 契约。**由此留下的阻塞**：复盘开关打开后作业能入队，但没有 worker 能认领——闭环要先定网关与推理工作机在安小信怎么落位（独立进程？随 caio-pro 包发？）。**需要 owner 决定**，在此之前不要打开 `HELM_CAIO_HOURLY_REVIEW_ENABLED` |


## 切片与顺序

每个切片单独一个 PR，单独一份逐步计划。依赖关系用“←”标出。

| 切片 | 内容 | 依赖 | 主要文件 | 开关 / 迁移 |
|---|---|---|---|---|
| P1-0 | 执行回执缺陷闭合取证与文档（A11） | — | `docs/STATUS.md`、`docs/superpowers/specs/2026-07-23-caio-pro-p1c-entry-map.md` | 无 |
| P1-1 | 调度作业运行账本（A10） | — | `lib/signal-collection/run-ledger.service.ts`、`scheduler.ts`、`registry.tsx` 接线、迁移 | `HELM_SIGNAL_COLLECTION_RUN_LEDGER_ENABLED`，1 个迁移 |
| P1-2 | CEO 选题入口（A12） | ← P1-0 | `features/caio-operator/{schemas,actions,queries}.ts`、`operator-console.client.tsx` | 无（OWNER 手动操作） |
| P1-3a | 受治理网关延迟派发接口（A15），出域治理扩展，owner 已同意 | — | `lib/llm/governed-model-gateway.service.ts`(+test、+mysql test)、`docs/product/` 出域治理说明 | 无开关（只有队列调用它）；无迁移 |
| P1-3 | 推理任务队列与输出契约（A1–A6） | ← P1-3a | `lib/caio-inference/{contracts,layered-judgement,job-store.service,job-reclaim.service}.ts`、迁移 | 队列本身不跑，由 P1-6 的开关驱动；1 个迁移 |
| P1-4 | 推理 audience、路由与令牌 CLI（A7、A8） | ← P1-3 | `lib/caio-access-gateway/{token-contracts,gateway-http-core}.ts`、`lib/caio-operator/inference-token-operator.ts`、`scripts/caio-inference-token.ts`、`tools/caio-access-gateway/server.ts` | 网关 feature flag `inferenceJobsEnabled`（默认 false） |
| P1-5 | 设备侧 worker（A9） | ← P1-4 | `tools/caio-inference-worker/{bin,contracts,local-model-port,gateway-client,loop}.ts` | 设备侧配置 |
| P1-6 | 入队作业、回收作业与 `/caio` 复盘读出（A13、A14） | ← P1-3 | `lib/caio-inference/enqueue-job.ts`、`reclaim-job.ts`、`readout.ts`、`features/caio/review-section.tsx` | `HELM_CAIO_HOURLY_REVIEW_ENABLED`、`HELM_CAIO_DAILY_REVIEW_ENABLED` |

建议顺序：P1-0 → P1-1 → P1-2 → P1-3a → P1-3 → P1-4 → P1-6 → P1-5。其中 P1-1 和 P1-2 已开 PR；P1-3a 等 owner 复核延迟派发的设计，P1-3 里的纯契约部分（A6 分层判断校验器）可以先做。

## 接口（切片之间只靠这些名字互通）

```ts
// lib/caio-inference/contracts.ts（P1-3 产出）
export const CAIO_INFERENCE_TASK_CLASSES = ["hourly_diagnosis", "daily_review"] as const;
export const CAIO_INFERENCE_JOB_STATUSES = ["queued", "claimed", "completed", "rejected", "expired", "dead_letter"] as const;
export const CAIO_INFERENCE_REJECTION_CODES = [
  "dispatch_claim_denied", "lease_expired", "claim_token_mismatch", "input_hash_mismatch",
  "malformed_output", "evidence_outside_input", "suggestion_kind_not_allowed",
  "action_disposition_present", "payload_too_large",
] as const;
export type CaioInferenceInput = {
  schemaVersion: "helm.caio.inference-input.v1";
  workspaceId: string; taskClass: CaioInferenceTaskClass;
  windowStart: string; windowEnd: string;
  snapshotRefs: Array<{ snapshotId: string; snapshotHash: string }>;
  evidenceRefs: string[];            // 输入快照内全部 EvidenceRef 的并集
  supplements: Array<{ key: string; counts: Record<string, number | null> }>;
};

// lib/caio-inference/layered-judgement.ts（P1-3 产出）
export type CaioLayeredJudgement = {
  schemaVersion: "helm.caio.layered-judgement.v1";
  facts: Array<{ statement: string; evidenceRefs: string[] }>;
  inferences: Array<{ statement: string; evidenceRefs: string[] }>;
  risks: Array<{ statement: string; severity: "low" | "medium" | "high"; evidenceRefs: string[] }>;
  unknowns: Array<{ statement: string }>;
  suggestions: Array<{ kind: "rule_draft" | "dry_run_request"; summary: string; evidenceRefs: string[] }>;
  confidence: { band: "high" | "medium" | "low" | "mixed" | "unknown"; score: number | null };
};
export function validateCaioLayeredJudgement(input: unknown, allowedEvidenceRefs: ReadonlySet<string>):
  { ok: true; value: CaioLayeredJudgement; contentHash: string } | { ok: false; code: CaioInferenceRejectionCode };

// lib/caio-inference/job-store.service.ts（P1-3 产出）
export function enqueueCaioInferenceJob(input: { workspaceId: string; taskClass: CaioInferenceTaskClass;
  windowStart: Date; windowEnd: Date; routePolicyRef: string; now?: Date }):
  Promise<{ status: "enqueued" | "already_enqueued" | "no_input"; jobId: string | null }>;
export function claimCaioInferenceJob(input: { workspaceId: string; workerTokenId: string; now?: Date }):
  Promise<{ status: "claimed"; jobId: string; claimToken: string; leaseExpiresAt: Date; input: CaioInferenceInput; inputHash: string }
        | { status: "none" } | { status: "rejected"; jobId: string; code: CaioInferenceRejectionCode }>;
export function submitCaioInferenceJudgement(input: { workspaceId: string; jobId: string; claimToken: string;
  inputHash: string; output: unknown; now?: Date }):
  Promise<{ status: "completed" | "replayed"; judgementPacketId: string } | { status: "rejected"; code: CaioInferenceRejectionCode }>;
export function reclaimExpiredCaioInferenceJobs(input: { now?: Date; maxAttempts?: number }):
  Promise<{ requeued: number; deadLettered: number; expired: number }>;

// lib/signal-collection/run-ledger.service.ts（P1-1 产出）
export function recordSignalCollectionJobRun(input: { jobKey: string; tenantKey: string; source: "scheduled" | "manual";
  startedAt: Date; finishedAt: Date; outcome: "succeeded" | "failed" | "crashed" | "skipped";
  targetCount: number; failedTargetCount: number; errorCode: string | null }): Promise<void>;   // 开关关闭时直接返回
export function readSignalCollectionJobRunSummary(input: { tenantKey: string; since: Date }):
  Promise<Array<{ jobKey: string; runs: number; failed: number; crashed: number; lastOutcome: string | null; lastFinishedAt: Date | null }>>;

// lib/caio-inference/enqueue-job.ts（P1-6 产出）
export type CaioInferenceSupplementPort = (input: { workspaceId: string; windowStart: Date; windowEnd: Date }) =>
  Promise<Array<{ key: string; counts: Record<string, number | null> }>>;
export function createCaioInferenceEnqueueJob(input: { key: string; tenantKey: string; extensionKey: string;
  taskClass: CaioInferenceTaskClass; resolveWorkspaceIds: () => Promise<string[]>;
  supplements?: CaioInferenceSupplementPort; routePolicyRef: () => Promise<string | null> }): SignalCollectionJob;
```

## 放行门

| 门 | 判据 |
|---|---|
| 切片合并 | 单测覆盖闭集拒收和关键保证，且每个关键保证都有变异反证；隔离 MySQL 集成测试覆盖并发领取、租约回收、重复提交、dispatch claim 被拒；上面列出的门禁全部通过 |
| 合成纵向闭环（P1-6 合并前） | 快检 → 快照 → 小时入队 → worker（用假的本地模型端口）领取 → 提交 → `/caio` 显示判断；再覆盖拒收路径、离线路径（探测失败时不领取，任务过期后显示“推理离线”）、租约到期回收 |
| 生产启用（租户 overlay 与发布会话负责） | 当前 G0 为 accepted，且有 CEO 受理回执；P0 影子期不少于 3 个工作日，零写入异常；推理离线降级在生产上实际验证过一次；推理路由策略已由 OWNER 激活，适配器 readiness 回执有效 |

## 不做（留给 P2、P3）

- 选中问题到待办的运行化、SLA 与升级：P2。
- 规则签发、干跑、授权执行、调度器暂停与补跑：P3。
- 推理结果不触发任何通知、派工或规则变更，只进入读出。

## 自检

- 规格 §4.1 到 §4.4 分别由 A1–A5 与 A15、A9、A6、A7–A8 覆盖；§8 由 A11、A12 覆盖；§11 P1 行的放行门见“放行门”一节。
- 接口里用到的名字都在本节定义过，切片计划必须照此命名。
