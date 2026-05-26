---
status: active
owner: helm-core
created: 2026-04-17
review_after: 2026-07-16
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 SWARM-002 Read-only Worker Fan-out Plan V1

## 结论

`SWARM-002` 是 `SWARM-001` 之后真正进入 read-only worker fan-out 的第一条 contract 主线，但当前已经推进到：

1. read-only worker allowlist
2. artifact-first / no-transcript-merge 边界
3. handoff packet preview / request / lane intent / placeholder seam
4. execution / materialization / result-side / adoption seam
5. operator-visible worker lane readout

这一刀不做：

- 真实多 worker 执行
- nested spawn
- verifier / arbiter merge lane
- operator kill / pause / resume
- candidate consolidation
- authority 扩面

也就是说，这条线当前目标仍然不是“让 swarm 已经跑起来”，而是先把 `search / grep / evidence mining` 三类只读 worker 的 typed lane、bounded record seam 和 result-side truth 收成一份后续可以真实执行的 contract stack。

## 方案

### 1. 目标

这条线当前阶段只做 5 件事：

1. 定义 read-only worker allowlist：`search / grep / evidence_mining`
2. 定义每种 worker 的 handoff goal、required outputs 和 artifact-first / no-transcript-merge 边界
3. 把 `request / intent / placeholder / execution / materialization / adoption` 收成 bounded record seam
4. 把这些 truth 接回现有 `runThread / debugger / /operating / meeting runtime`
5. 让后续真实 fan-out 直接消费同一份 typed contract stack，而不是继续靠 scattered strings

### 2. 当前假设

这条线基于 current-main 已合并的 `SWARM-001` 起步，默认接受以下约束：

1. `leadered + review-first + default-off` 仍然是总边界
2. 所有 swarm 行为继续从现有 `runThread / runtime event / debugger surface` 派生
3. 当前只允许 `read_only_worker`
4. worker 输出继续 `artifact-first`
5. worker 不回灌长 transcript
6. customer-facing send / official write / canonical memory mutation 仍不开放

### 3. 产品原则与优先级映射

显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_PLAN_V1.md`
- `docs/reviews/HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_CHECKLIST_V1.md`

这条线接到的真实业务闭环是：

- `run thread -> swarm spawn request -> read-only worker lane -> artifact / handoff packet -> lead synthesis`

它服务的是：

- 决策
- 执行准备
- 审计
- 复盘

为什么现在做，而不是继续扩面：

1. `SWARM-001` 已把 admission / deny / request record / operator readout 收紧
2. 如果不先把 read-only worker lane typed 化，后续 fan-out 只会把 `task kind / output contract / handoff semantics` 再散回多处 helper
3. 这条线仍然保持 `review-first + artifact-first`，不会提前冲击 authority 边界

### 4. 当前切片

当前建议只落第一刀：

1. `HelmV21RunThreadSwarmReadOnlyWorkerContract`
2. `search / grep / evidence_mining` allowlist
3. handoff preview contract
4. artifact output preview contract
5. request lifecycle / handoff preview readout
6. selected lane / packet consumption intent contract
7. artifact bundle placeholder / handoff consumption contract
8. debugger / `/operating` / meeting runtime 最小读口
9. placeholder materialization intent / handoff consumption record
10. execution preflight contract
11. execution admission guard contract
12. execution admission record
13. execution lifecycle readout contract
14. execution candidate / artifact materialization contract
15. artifact materialization guard contract
16. artifact materialization record / lifecycle contract
17. result-side output contract
18. result-side output guard / lifecycle contract
19. output consumption seam contract
20. result adoption contract
21. output adoption guard contract
22. output adoption lifecycle contract
23. result adoption record seam
24. result adoption lifecycle seam
25. result adoption result-side contract

当前切片刻意不做真实执行写口，只允许记录：

- spawn request
- selected lane intent
- placeholder materialization / handoff consumption record
- execution admission record

但仍不允许：

- 真实 worker fan-out
- transcript merge
- merge lane / verifier lane
- broader execution authority

### 5. 建议 contract 切分

建议先形成两层：

1. `swarmSpawnContract`
   - 继续负责 admission truth
   - 回答：当前是否允许进入 read-only worker lane

2. `swarmReadOnlyWorkerContract`
   - 负责 `SWARM-002` 的 worker lane truth
   - 回答：
     - 允许哪些 worker kind
     - 每种 worker 的 handoff 目标是什么
     - 每种 worker 需要什么 artifact outputs
     - 为什么仍然是 artifact-first / no-transcript-merge

建议第一刀字段至少包含：

- `state`
- `taskClass`
- `allowlistedWorkers`
- `artifactPolicy`
- `transcriptPolicy`
- `handoffPreview`
- `artifactOutputPreview`
- `summary`
- `nextAction`
- `boundaryNote`

### 6. 当前建议状态流

当前建议只保留最小 lane posture：

1. `blocked`
2. `ready`
3. `requested`

其中：

- `blocked` 继承 `SWARM-001` admission deny
- `ready` 表示 allowlist 和 output contract 已成立，但还没有真实 fan-out
- `requested` 表示当前 run thread 已存在 `swarm.spawn.requested` record，后续真实执行切片可以直接消费

故意不做：

- `queued`
- `running`
- `completed`
- `merged`

因为这些属于真正 execution plane。

## 受影响组件

计划阶段预期会进入：

- `lib/helm-v2/contracts.ts`
- `lib/helm-v2/run-thread-contract.ts`
- `lib/helm-v2/operator-debugger-read-model.ts`
- `lib/helm-v2/runtime-upgrade.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`

对应测试：

- `lib/helm-v2/run-thread-contract.test.ts`
- `lib/helm-v2/operator-debugger-read-model.test.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`

## 权衡

### 为什么先做 worker lane contract，不直接做真实 fan-out

因为现在直接进 fan-out，会立刻碰到：

- worker role identity
- packet persistence
- artifact bundle persistence
- merge / rework / verification lane
- operator controls

这样会把 `SWARM-002` 第一刀直接做成半个 orchestration plane，边界会先脏掉。

### 为什么第一刀仍然要碰 handoff / artifact preview

因为如果这条线只再加一层 summary，而不把：

- handoff 目标
- required outputs
- artifact-first posture

显式 contract 化，那后面真实 fan-out 仍然会重新发明一套 worker semantics。

## 风险

1. 如果把 worker lane preview 写成真正执行态，`SWARM-002` 会过早碰到 execution plane
2. 如果 worker kind 继续停留在非类型化字符串，后面 search / grep / evidence mining 会各自分叉
3. 如果 artifact output contract 不先固定，后面 worker 很容易回灌 transcript 而不是 artifact ref
4. 如果 `/operating` 看不到 worker lane truth，后面 fan-out 只会把控制面重新藏回实现细节

## 验证结果

当前这条线已经进入实现，并推进到 freeze-ready contract stack。

当前阶段默认验证至少包括：

```bash
npx vitest run lib/helm-v2/run-thread-contract.test.ts lib/helm-v2/operator-debugger-read-model.test.ts lib/helm-v2/runtime-upgrade.test.ts
npx eslint lib/helm-v2/contracts.ts lib/helm-v2/run-thread-contract.ts lib/helm-v2/operator-debugger-read-model.ts lib/helm-v2/runtime-upgrade.ts lib/helm-v2/run-thread-contract.test.ts lib/helm-v2/operator-debugger-read-model.test.ts lib/helm-v2/runtime-upgrade.test.ts features/internal-operating-workspace/runtime-operator-panel.tsx --max-warnings=0
npm run self-check
npm run check:boundaries
npm run typecheck
git diff --check
```

补充说明：

- `typecheck` 当前仍只剩仓库既有基线问题：
  - `lib/connectors/google.ts`
  - `lib/notifications/system-mail.ts`
- `meeting-v2-runtime-card.tsx` 的单文件 `eslint` 仍有既有慢点，本轮 diff 需人工复核
- 当前 freeze 验证已补充到：
  - `db:reset`
  - 定向 `vitest`
  - `self-check`
  - `check:boundaries`
  - `typecheck`
  - `lint`
  - `test`
  - `build`
  - `e2e`
- 其中 `test / build / e2e` 当前仍被仓库既有页面层级守卫、connector 依赖缺口和 Next/Turbopack build blocker 挡住

## 剩余风险

1. 当前仍然没有真实 read-only worker fan-out 证据
2. 当前还没有真实 artifact bundle persistence，只形成了 placeholder / materialization seam
3. `typecheck` 仍会被仓库既有 connector / mail 基线问题挡住

## 下一步建议

当前不建议继续堆新的派生 summary。更合理的是：

1. 先冻结 `SWARM-002` 当前的 contract stack
2. 明确它仍然只是 read-only worker admission / preview / result-side seam truth
3. 再决定是否进入真实 read-only fan-out execution slice
