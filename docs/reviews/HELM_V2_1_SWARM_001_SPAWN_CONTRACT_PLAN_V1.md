---
status: active
owner: helm-core
created: 2026-04-16
review_after: 2026-07-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 SWARM-001 Spawn Contract Plan V1

## 结论

`SWARM-001` 应作为 swarm 线真正进入实现的第一刀，但这条线当前仍然只做 `spawn contract + budget envelope + policy deny readout + request record + operator readout`，不做 fan-out、本体 worker、merge lane、operator kill/pause/resume 控制，也不做任何 authority 扩面。

这一刀的目标不是“让多代理先跑起来”，而是先把未来所有 swarm run 必须共享的基础约束收拢成同一份 contract：

- 什么时候允许 spawn
- spawn 时必须带哪些约束字段
- 超预算或 policy deny 时怎样进入统一的 operator-visible posture
- 怎样在不触碰 customer-facing send / official write 边界的前提下，把 deny/block 结果回写到现有 runtime / debugger / `/operating`

## 方案

### 1. 目标

这条线只做 4 件事：

1. 定义统一的 `spawn contract`
2. 定义统一的 `budget envelope`
3. 定义统一的 `policy deny / budget blocked` readout
4. 把这些 truth 接到现有 `runThread / operator debugger / /operating`
5. 记录最小 `spawn request` event，但不进入真实 worker 执行

这条线不是：

- `SWARM-002` read-only worker fan-out
- verifier / arbiter merge lanes
- operator swarm dashboard
- candidate-only consolidation fan-out
- broad workflow engine
- team-mode / peer messaging
- auto-send / broad auto-write

### 2. 当前假设

这条实现分支基于当前 `main` 起步，默认接受以下约束：

1. `leadered + review-first + default-off` 仍是明确边界
2. 所有 swarm 行为都必须从现有 `runThread` / runtime event / debugger surface 派生
3. workspace flag 是 swarm 行为的总开关
4. deny / blocked 必须 operator 可见，不能 silent fail

### 3. 计划范围

本轮计划阶段预期会先读并可能进入的模块：

- `lib/helm-v2/contracts.ts`
- `lib/helm-v2/run-thread-contract.ts`
- `lib/helm-v2/operator-debugger-read-model.ts`
- `lib/helm-v2/runtime-upgrade.ts`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `features/meetings/meeting-v2-runtime-card.tsx`
- 对应测试：
  - `lib/helm-v2/run-thread-contract.test.ts`
  - `lib/helm-v2/operator-debugger-read-model.test.ts`
  - `lib/helm-v2/runtime-upgrade.test.ts`

### 4. 建议 contract 切分

计划上建议先形成三层最小结构：

1. `spawnRequest`
   - 描述一次 swarm spawn 想做什么
   - 包含：workspace flag、task class、requested role、target object / thread、requested depth、requested budget

2. `spawnContract`
   - 描述一次被允许的 spawn 真正带着什么约束进入 runtime
   - 包含：`spawnContractId / prefixHash / cachePolicyVersion / budgetEnvelope / allowReason / denyReason / recursionDepth / policyVersion`

3. `spawnPosture`
   - 描述这次 spawn 最终是：
     - `requestable`
     - `allowed`
     - `blocked_budget`
     - `blocked_policy`
     - `blocked_flag`
     - `reused`
   - 并投影到 debugger/operator surface

### 5. 状态流建议

当前建议保持最小状态流：

1. `requestable`
2. `allowed`
3. `blocked_budget`
4. `blocked_policy`
5. `blocked_flag`
6. `reused`

故意不做：

- `pending / active / merged` 这类真正执行态
- nested spawn lifecycle
- peer-to-peer worker graph

因为这些属于后续 `SWARM-002+`。

### 6. 当前实现现状

截至 `2026-04-16`，这条线已经落下 3 个最小切片：

1. `spawn admission contract`
   - 固定 `requestable / blocked_flag / blocked_budget / blocked_policy`
   - 固定 workspace flag 与 budget posture 的准入语义
2. `deny readout`
   - 固定 `denyReason / denySummary`
   - 让 debugger、continuity queue 与 operator surface 直接显示阻断原因
3. `request record`
   - 新增最小 runtime event：`swarm.spawn.requested`
   - 只记录请求，不做真实 worker fan-out
   - 把 `requestRecordState / requestEventId / checkpointKey / requestedAt / requestedBy / sourcePage` 接回 contract 和 operator readout
4. `operator readout`
   - 把 `/operating` continuity queue 上的 swarm request 从隐含 meta 串提升为显式状态读口
   - 允许 operator 在 `/operating` 直接记录 `swarm spawn request`
   - 仍然只记录请求，不进入真实 worker 执行

当前仍然刻意不做：

- 真实 spawn 执行
- nested spawn
- verifier merge / arbiter
- pause / resume / kill 控制
- authority 扩面

## 受影响组件

本轮计划阶段主要受影响的是：

- runtime contract
- run-thread read model
- debugger read model
- `/operating` operator readout
- 必要的 tests / docs / self-check discoverability

## 权衡

### 为什么先做 contract，不先做 worker fan-out

因为如果没有统一 `spawn contract`：

- workspace flag 会散落在不同入口
- budget 语义会散落在不同实现
- deny 结果会继续 silent fail
- 后续 `SWARM-002 ~ SWARM-005` 会各自发明一套并行准入逻辑

### 为什么这轮不碰执行态

因为一旦进入真正执行态，就会立刻碰到：

- worker fan-out
- cache reuse
- verification merge
- operator controls

那就不再是 `SWARM-001` 的最小切片。

## 风险

1. 如果 contract 过早设计成完整 swarm state machine，会把 `SWARM-001` 做成平台工程
2. 如果 deny / blocked 不回到现有 operator surface，runtime truth 会再次分叉
3. 如果 budget envelope 只停在内部 helper，不进 contract，就无法验证 review-first 边界是否成立
4. 如果 workspace flag 语义不清，后面实现会把 `default-off` 侵蚀掉

## 验证结果

当前这条线已经进入代码实现，但仍是最小 admission/request-record 切片，不是 execution plane。

当前已通过：

```bash
npx vitest run lib/helm-v2/run-thread-contract.test.ts lib/helm-v2/operator-debugger-read-model.test.ts lib/helm-v2/runtime-upgrade.test.ts
npx eslint lib/helm-v2/contracts.ts lib/helm-v2/run-thread-contract.ts lib/helm-v2/operator-debugger-read-model.ts lib/helm-v2/runtime-upgrade.ts lib/helm-v2/run-thread-contract.test.ts lib/helm-v2/operator-debugger-read-model.test.ts lib/helm-v2/runtime-upgrade.test.ts features/meetings/actions.ts features/meetings/meeting-v2-runtime-card.tsx --max-warnings=0
npm run self-check
npm run check:boundaries
npm run typecheck
```

其中 `typecheck` 当前只剩 current-main 已存在的 connector/mail 基线问题：

- `features/connectors/actions.ts`
- `lib/connectors/google.ts`
- `lib/notifications/system-mail.ts`

没有新增这条切片自己的类型回归。

文档阶段默认验证仍然是：

```bash
npm run self-check
git diff --check
```

一旦进入实现，默认验证链必须升级为：

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

## 剩余风险

1. 当前 `request record` 仍然只是最小写口记录，不是 spawn execution plane
2. 当前全仓 `typecheck` 仍被 connector/mail 基线问题挡住，不能声称标准链全绿
3. 如果后续 PR #98 的文档评审结论变化，这条实现 plan 需要跟着回对
4. 这一步还没有 owner / canary workspace / policy version 的最终命名定稿

## 下一步建议

下一步不要立刻进入 `SWARM-002`。

更合理的顺序是：

1. 先把 `SWARM-001` 当前 admission/request-record 切片收口成独立提交或冻结点
2. 明确 current-main 的 connector/mail 基线问题如何处理，避免后续验证噪音继续污染这条线
3. 如果继续，只进更窄的 `request lifecycle` 下一层，不进入真实 worker fan-out
