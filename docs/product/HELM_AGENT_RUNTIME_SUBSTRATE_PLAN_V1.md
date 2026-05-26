---
status: active
owner: helm-core
created: 2026-04-11
review_after: 2026-07-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Agent Runtime Substrate Plan v1

状态：In Progress  
Owner：Helm Core  
更新时间：2026-04-12

## 1. 目标

这条线不是继续堆更多 agent，也不是把 Helm 扩成通用 orchestration 平台。

这条线只收 5 类运行时原语：

1. `Run Thread`
2. `Operator Debugger`
3. `Typed Interrupt + Handoff Contract`
4. `Project Skill Library + Environment Contract`
5. `Benchmark Matrix`

当前阶段已经完成前四条里的第一批基础层：

- 不新增新的 persisted parent object
- 不重写现有 `RuntimeSession / SessionCheckpoint` 数据底座
- 只在现有 substrate 之上补一层统一的 `run / thread / checkpoint / resume` app-layer contract

当前进度：

- `Run Thread Layer 1`：Implemented
- `Run Thread Layer 2`：Implemented
- `Run Thread Layer 3`：Implemented
- `Operator Debugger B1`：Implemented
- `Operator Debugger B2`：Implemented
- `Typed Interrupt + Handoff Contract C1`：Implemented
- `Typed Interrupt + Handoff Contract C2`：Implemented
- `Project Skill Library + Environment Contract D1 / D2`：Implemented
- `Benchmark Matrix E1 / E2`：Implemented
- `Benchmark Matrix E3`：Implemented

## 2. 为什么现在做

这轮任务直接接到 Helm 当前已经存在的真实业务闭环：

- `meeting.ended -> human review -> runtime trace`
- `verified coordination -> human execution / official follow-through`
- `continuity failure -> operator remediation -> replay / rollback anchor`

它同时服务：

- 执行：让运行链路有统一身份和恢复锚点
- 审计：让 trace / checkpoint / resume 不再只是局部字段
- 复盘：为后续 debugger / replay / benchmark 提供同一条生命周期骨架

按 [`HELM_PRODUCT_PRIORITY_MAPPING_V1.md`](./HELM_PRODUCT_PRIORITY_MAPPING_V1.md) 评分，这条线当前是 `P0`：

- 闭环价值：`2`
- 角色价值：`2`
- 证据链价值：`2`
- 内部使用价值：`2`
- 复利价值：`2`
- 总分：`10`

原因不是“看起来更完整”，而是当前 runtime 已经有 substrate，却还没有统一 lifecycle semantics；继续往 `operator debugger / interrupt / skill library / benchmark` 推之前，先把基础身份和恢复语义收口，才不会继续在页面文案、局部 helper 和一次性 readout 上漂。

## 3. 当前 truth

当前已经成立：

- `RuntimeSession / SessionCheckpoint / SessionNotebook / PersistedPayload` 已存在
- `resumeRuntimeCheckpoint()` 已成立
- `getRuntimeSessionTrace()` 已成立
- `HandoffPacket / InitiativeRun / CoordinationMetricsDaily` 已成立
- `/api/helm-v2/runtime/*` 已存在窄 API namespace

当前还没有统一收口的地方：

- 还没有完整的 persisted lifecycle control plane
- active takeover request / human input checkpoint request 已进入明确 write path，但仍只是 `RuntimeEvent` 上的 typed request ledger，不是新的 execution plane
- benchmark outcome 已形成 workspace-scoped persisted run-level evidence object，但仍不是 benchmark execution plane 或 outcome acknowledgement workflow

## 4. 第一阶段冻结词汇

第一阶段不引入新表，只冻结现有 substrate 上的 canonical 映射：

- `runId = RuntimeSession.id`
- `threadId = RuntimeSession.sessionKey`
- `checkpointId = SessionCheckpoint.id`
- `resumeToken = SessionCheckpoint.checkpointKey`

这里的 `resumeToken` 不是新 auth token，也不是外部 secret。

它只是当前 persisted checkpoint anchor 的统一对外 contract 名称，用来把：

- `checkpoint resume`
- `resumedFromKey`
- `replay fidelity`
- 后续 `interrupt / handoff / debugger replay`

全部接到同一条稳定语义上。

## 5. 范围与不做

### 5.1 当前阶段范围

- `lib/helm-v2/contracts.ts`
- `lib/helm-v2/run-thread-contract.ts`
- `lib/helm-v2/runtime-upgrade.ts`
- `app/api/helm-v2/runtime/checkpoints/[id]/resume/route.ts`
- `app/api/helm-v2/runtime/sessions/[id]/trace/route.ts`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `PLANS.md`

### 5.2 当前阶段不做

- 新 `RunThread` / `RuntimeThread` 数据表
- 通用 workflow engine
- 通用 multi-agent orchestration platform
- team mode / auto routing / auto send / broad auto write
- sandbox、marketplace、external execution platform 化
- debugger UI 扩面

## 6. 阶段与 PR 拆分

### Phase A. Run Thread

#### PR-A1 `Run Thread Layer 1`

目标：先把现有 `RuntimeSession / SessionCheckpoint` 收成统一 contract，并接进 trace / resume 两条现有主链。

交付：

- 新增 canonical `Run Thread` type contract
- 冻结 `runId / threadId / checkpointId / resumeToken` 语义
- `getRuntimeSessionTrace()` 返回 `runThread`
- `resumeRuntimeCheckpoint()` 返回 `runThread`
- 文档 / 索引 / self-check / tests 同步

完成标准：

- 不靠页面文案即可拿到统一 lifecycle identity
- 不新增存储模型
- 不破坏现有 trace / replay / continuity 读法

当前状态：Implemented

#### PR-A2 `Run Thread Layer 2`

目标：把 workspace operator continuity queue、runtime overview 和历史链路读口也统一到同一份 `runThread` 身份。

交付：

- continuity queue 挂上 canonical run-thread anchor
- run history / checkpoint lineage 进入统一 read model
- 为后续 debugger 留出稳定 API seam

当前状态：Implemented

#### PR-A3 `Run Thread Layer 3`

目标：补 `checkpoint lineage / resume lineage / replay request` 的更完整 read model，但仍不引入新 orchestration plane。

交付：

- typed checkpoint lineage
- replay request / replay summary read model
- human input checkpoint 的骨架位

当前状态：Implemented

### Phase B. Operator Debugger

#### PR-B1

- `run history`
- `trace spine`
- `variable snapshot` read model
- debugger read API，不扩写权限

当前状态：Implemented

#### PR-B2

- `replay`
- `human input checkpoint`
- operator takeover / resume assistance

当前状态：Implemented

### Phase C. Typed Interrupt + Handoff Contract

#### PR-C1

- typed interrupt reason
- typed resume ask
- typed handoff payload skeleton

当前状态：Implemented

#### PR-C2

- interrupt / handoff 进入 runtime surfaces 与 write path
- active takeover request / human input checkpoint request 进入 typed request write seam
- 压掉自由文本式 system narration 对流程的侵入

当前状态：Implemented

### Phase D. Project Skill Library + Environment Contract

#### PR-D1

- 把 `worker / skill / resource` 收成 project-scoped skill library read model
- 定义 environment seam，不扩 execution authority

当前状态：Implemented

#### PR-D2

- connector / browser / official action 进入统一 environment contract
- official action 继续保持 boundary-first 和受控 authority

当前状态：Implemented

### Phase E. Benchmark Matrix

#### PR-E1

- runtime eval
- adapter conformance

当前状态：Implemented

#### PR-E2

- boundary regression
- operator usability

当前状态：Implemented

#### PR-E3

- persisted benchmark run evidence object
- workspace-scoped benchmark outcome recording seam
- latest benchmark outcome projection onto runtime surfaces

当前状态：Implemented

## 7. 接口拆分

### 7.1 Canonical identity interface

第一阶段至少统一：

- `runId`
- `threadId`
- `stageKey`
- `latestCheckpoint`
- `resume.state`
- `resume.resumeToken`
- `resumedFromCheckpointKey`

### 7.2 Read API interface

第一阶段先只改现有返回，不改 route path：

- `GET /api/helm-v2/runtime/sessions/[id]/trace`
- `POST /api/helm-v2/runtime/checkpoints/[id]/resume`

### 7.3 Storage interface

第一阶段只复用现有字段：

- `RuntimeSession.id`
- `RuntimeSession.sessionKey`
- `RuntimeSession.currentStage`
- `RuntimeSession.resumedFromKey`
- `RuntimeSession.replayableEventLog`
- `SessionCheckpoint.id`
- `SessionCheckpoint.checkpointKey`

### 7.4 Future seam

后续 `Operator Debugger / Interrupt / Handoff / Skill Library / Benchmark` 都必须优先复用这份 contract，而不是再各自发明新的 lifecycle id。

## 8. 风险

1. 如果第一阶段把 `threadId` 直接做成新 persisted object，会把当前变更面放大到 schema / migration / backfill，风险过高。
2. 如果第一阶段只写文档不接 API 返回，后续各条链路仍会继续漂。
3. 如果把 `resumeToken` 写成 secret-like 能力，会误导边界；当前它只是 canonical checkpoint anchor。
4. 如果这阶段顺手去做 debugger UI，会把 `Run Thread` 和 `Operator Debugger` 混成一个 PR。

## 9. 验证

仓库标准验证链：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

第一阶段额外验证：

- `vitest` 覆盖 canonical run-thread contract builder
- trace / resume 路径返回统一 `runThread`
- benchmark matrix recorded runs 会持久化为 workspace-scoped runtime evidence，并把 latest outcome 投影回 runtime surfaces
- README / docs index / self-check 与 plan discoverability 对齐

## 10. 当前冻结判断

这条总线当前仍然只能写成：

- `Helm Agent Runtime Substrate`：`已成形但仍需下一层`

原因：

- 五条基础原语的第一层实现现在已经同时落在代码、页面、测试、文档和验证脚本上
- 但这仍然不是完整 workflow engine、不是统一 persisted control plane、不是 debugger auto-takeover，也不是 execution-authority expansion；run-thread write lifecycle、operator debugger 主动接管、environment execution seam 与 benchmark execution / acknowledgement 仍需要下一层
