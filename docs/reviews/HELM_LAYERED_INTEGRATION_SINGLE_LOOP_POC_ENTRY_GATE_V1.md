---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ENTRY_GATE_V1

状态：Planned  
Owner：Helm Core  
日期：2026-04-11

## 1. 目的

这份文档执行 `Track G4`，但只做到 POC 入口闸门，不进入实现。

它只回答一个问题：

- Helm 什么时候值得启动一条单闭环 layered integration POC？

它不做：

- vendor selection
- SDK 接线
- connector runtime implementation
- execution engine integration
- new canonical schema
- workflow builder UI
- execution-authority expansion

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_V2_EVENT_FLOW_API_CONTRACT_V1.md`
- `docs/product/HELM_V2_DATA_MODEL_V1.md`
- `docs/product/HELM_MULTITENANCY_MULTIUSER_FOUNDATION_BASELINE_V1.md`
- `docs/product/HELM_MULTITENANCY_ACTION_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_CONTROL_PLANE_CONTRACT_FREEZE_PLAN_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_VENDOR_FIT_AND_SINGLE_LOOP_POC_PLAN_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_CANDIDATE_EVALUATION_MATRIX_V1.md`

本轮接到的真实业务闭环：

- `source signal -> projection -> judgement -> review -> guarded execution -> receipt -> reconciliation`

本轮为什么现在做：

- `G1 / G2 / G3` 已经把 contract、候选矩阵和 current-main priority 收紧
- 在进入任何外部接线前，必须先冻结什么时候是 `go`、什么时候只能 `conditional-go`、什么时候必须 `no-go`

## 3. 唯一允许的 POC 闭环

如果这条 gate 未来通过，唯一允许的单闭环是：

1. `meeting / email / CRM import signal`
2. `Connector / ImportSource / ConnectorIngestionRecord`
3. `truth reconciliation / object projection`
4. `ApprovalRequest / review surface`
5. `HumanActionExecution` 或 `OfficialWriteIntent`
6. `ExecutionReceipt`
7. `OfficialFollowThrough / MemoryItem write-back`

更具体地说：

- source layer：优先复用 current-main connector / import seam
- judgement layer：优先复用 meeting/runtime / operating-system seam
- review layer：优先复用 approvals / governed-action seam
- execution / receipt：优先复用 `HumanActionExecution / OfficialWriteIntent`
- reconciliation：优先复用 `OfficialFollowThrough / MemoryItem`

## 4. 当前不允许的 POC 方向

以下方向即使看起来“技术上可行”，本 gate 当前也不允许：

- 新建 `integrations/` 平台层
- 新建 vendor-specific canonical 表
- 新建 `BusinessObject` canonical schema
- 新开 `api/unified-data`
- 新开 `api/intelligence`
- 外部系统绕过 `ReviewBundle`
- broad automation / workflow builder
- settings/admin/auth/platform surface 扩面

## 5. Gate Questions

### 5.1 Control-plane readiness

当前单闭环是否仍然清楚回答：

- Helm 保留 judgement / review / policy / reconciliation 主权
- external candidate 只做 source / execution / assist
- `recommendation != commitment`
- `review-before-commitment`

如果不能，这条 gate 直接失败。

### 5.2 Current-main seam readiness

当前 POC 是否可以只复用现有 seam，而不引入新平台层？

必须主要落在：

- `lib/connectors/*`
- `lib/imports/*`
- `lib/helm-v2/*`
- `lib/operating-system/*`
- `features/meetings/*`
- `features/approvals/*`
- `app/api/connectors/*`
- `app/api/imports/*`
- `app/api/runtime/*`
- `app/api/helm-v2/runtime/*`

如果需要新平台目录或新 canonical schema，这条 gate 失败。

### 5.3 Governance readiness

POC 是否能够继续保持：

- workspace-first
- membership-backed
- capability-aware
- review-first
- no auto-send
- no broad auto-write

如果任何候选会削弱这些边界，这条 gate 失败。

### 5.4 Receipt / reconciliation readiness

POC 是否能够在 current-main 上明确保留：

- execution receipt
- exception
- follow-through
- reconciliation
- manual fallback

如果无法形成这条链，只能 `no-go`。

### 5.5 Demo / fallback readiness

POC 是否能在外部系统缺失、token 缺失或 provider 不可用时继续保留：

- current-main demo path
- mock / local fallback
- read-only / manual fallback

如果没有 fallback，这条 gate 只能 `conditional-go` 或 `no-go`。

## 6. Gate Statuses

### `NO_GO`

只要出现以下任一情况，就必须维持 `NO_GO`：

- 仍需要把 Helm 降级成 thin shell
- 仍需要引入新 canonical schema 才能证明闭环
- 仍无法保证 receipt / reconciliation / manual fallback
- 仍需要平台化目录、平台化 API 或平台化 UI
- 仍会模糊 `recommendation != commitment`

### `CONDITIONAL_GO`

只有在以下情况下才使用：

- contract 已冻结
- current-main seam 已清楚
- 唯一闭环已收窄
- fallback、审计、回滚、provider 缺失时的退化路径虽已写入 acceptance pack，但 implementation slice 与 runtime 证据仍未形成

这意味着：

- 可以继续 planning
- 不能进入真正外部集成实现

### `GO`

只有同时满足以下条件，才允许进入后续窄 POC：

1. 唯一闭环已固定
2. 现有 seam 已足够覆盖 source / judgement / review / execution / reconciliation
3. 不需要新 canonical schema
4. receipt / exception / follow-through / manual fallback 已明确
5. workspace / tenant / capability boundary 不会被削弱
6. provider 缺失时仍有 demo / mock / manual fallback

## 7. 当前建议

当前建议：

- `CONDITIONAL_GO`

原因：

- `G1 / G2 / G3` 已经足够证明方向、contract 和候选排序
- current-main seam 已经足够清楚
- `G5` 已经把：
  - rollback trigger
  - provider-missing fallback checklist
  - exact acceptance criteria
  - `receipt / follow-through / outcome success` distinction
 进一步冻结成 acceptance pack
- 但当前仍没有 implementation slice，也没有 runtime 级验证证据

因此现在更适合进入：

- implementation freeze 前的继续收敛

而不是直接进入 vendor integration implementation

## 8. 允许的未来 POC 实现范围

如果未来从 `CONDITIONAL_GO` 进入 `GO`，允许触碰的面只能是：

- `lib/connectors/*`
- `lib/imports/*`
- `lib/helm-v2/*`
- `lib/operating-system/*`
- `features/meetings/*`
- `features/approvals/*`
- 必要时极小范围的 `prisma/schema.prisma`

而且仅限于：

- current-main seam threading
- narrow receipt / reconciliation wiring
- source-grounded read path
- review surface reuse
- fallback / audit / rollback support

## 9. 不允许的未来 POC 实现范围

- `integrations/` platform root
- vendor-specific canonical model cluster
- new CRM front-end
- new workflow builder
- new analytics / telemetry platform
- new admin/settings platform
- auto-send
- broad auto-write
- new authority surface

## 10. 通过 gate 后的下一份文档应该回答什么

进入真正窄实现前，后续 implementation-freeze 文档仍必须明确回答：

1. 哪条唯一闭环要做
2. 哪些 current-main seam 会被复用
3. 外部候选是否只是 optional assist，还是 POC 依赖
4. provider 缺失时如何在具体实现上 fallback
5. rollback 怎样在代码与演示链路里触发
6. receipt、follow-through、outcome success 如何在 runtime 上分开
7. 哪些文件允许改，哪些一律不碰

## 11. 风险

### 11.1 Conditional-go 被误读成 go

这是当前最大风险。

`CONDITIONAL_GO` 只代表：

- 方向可以继续 planning

不代表：

- 可以直接接 Twenty / Windmill / Dify

### 11.2 seam 复用被“顺手重构”替代

如果后续实现为了“更干净”而重开平台层，这条 gate 就失效了。

### 11.3 receipt / outcome 混淆

如果执行回执被直接写成业务结果成功，POC 会产生假阳性。

## 12. 下一步建议

当前下一步不该是外部集成实现，而是：

1. 以 [HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ACCEPTANCE_PACK_V1.md](./HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ACCEPTANCE_PACK_V1.md) 作为后续窄实现前的 acceptance contract
2. 如果主线优先级允许，再起一份 implementation-freeze 文档
3. 继续维持 `planning-only`

## 13. 验证

建议验证仍然是：

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

本轮默认至少运行：

- `npm run self-check`
- `npm run check:boundaries`
