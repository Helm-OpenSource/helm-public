---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ACCEPTANCE_PACK_V1

状态：Planned  
Owner：Helm Core  
日期：2026-04-11

## 1. 目的

这份文档执行 `Track G5`，但仍然只做到 planning，不进入实现。

它回答 5 件事：

1. 单闭环 POC 到底只允许做哪一条最小路径
2. 哪些 current-main seam 必须复用，哪些面一律不碰
3. provider 缺失、receipt 不完整、外部写入不可用时如何 fallback
4. 什么情况下必须 rollback 或直接停在 planning
5. `receipt / follow-through / outcome success` 三者如何明确分开

这份文档不是：

- vendor integration implementation
- 新 connector platform 设计
- 新 workflow builder 设计
- 新 canonical object schema
- authority expansion

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `docs/product/HELM_V2_EVENT_FLOW_API_CONTRACT_V1.md`
- `docs/product/HELM_V2_DATA_MODEL_V1.md`
- `docs/product/HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `docs/product/HELM_MULTITENANCY_MULTIUSER_FOUNDATION_BASELINE_V1.md`
- `docs/product/HELM_MULTITENANCY_ACTION_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_CONTROL_PLANE_CONTRACT_FREEZE_PLAN_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_VENDOR_FIT_AND_SINGLE_LOOP_POC_PLAN_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_CANDIDATE_EVALUATION_MATRIX_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ENTRY_GATE_V1.md`

本轮继续服务同一条真实业务闭环：

- `source-grounded signal -> projection -> judgement -> review -> guarded execution -> receipt -> follow-through -> reconciliation`

## 3. 唯一接受的第一条 POC

在 `G5` 之后，唯一接受的第一条窄 POC 不是泛化的 “任意 source signal loop”，而是：

- `meeting-led governed follow-up loop`

也就是：

1. meeting 结束或 meeting detail 刷新触发 runtime
2. 可选地读取 connector / CRM import 作为 supporting evidence，而不是新的 canonical source
3. Helm 形成 judgement、draft 和 recommended next move
4. 人在 meeting detail 或 approvals surface 中 review
5. 只有在已有 governed path 内才允许 attempt / acknowledge / manual follow-up
6. Helm 记录 receipt / exception
7. Helm 继续写 follow-through / memory，而不是把 receipt 直接写成业务成功

这样收窄的原因：

- current-main 已经在 meeting、approvals、official write、follow-through 上形成最强 seam
- 这条闭环最符合 `judgement-first` 与 `review-before-commitment`
- 它能最大化复用现有代码和现有演示路径
- 它避免把第一条 POC 扩成 CRM front-end 或 broad workflow engine

## 4. 必须复用的 current-main seam

### 4.1 Source / evidence seam

必须优先复用：

- `lib/connectors/google.ts`
- `lib/connectors/hubspot.ts`
- `lib/connectors/salesforce.ts`
- `lib/imports/crm-entry.service.ts`
- `lib/imports/crm-orchestrator.service.ts`
- `lib/imports/crm-source.service.ts`
- `lib/helm-v2/connector-ingestion-retrieval-runtime.ts`
- `app/api/connectors/*`
- `app/api/imports/crm/preview/route.ts`
- `app/api/imports/crm/run/route.ts`
- `app/api/imports/crm/sync/route.ts`

允许的职责只有：

- source-grounded read
- evidence retrieval
- subject matching
- narrow projection input

不允许的职责：

- 复制 source-native schema
- 直接变成 canonical object owner
- 绕过 workspace / membership boundary

### 4.2 Judgement seam

必须优先复用：

- `app/api/runtime/events/meeting-ended/route.ts`
- `features/meetings/queries.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/meetings/meeting-v2-ingestion-retrieval-card.tsx`
- `features/meetings/meeting-v2-opportunity-judge-card.tsx`
- `features/meetings/meeting-v2-draft-comms-card.tsx`
- `lib/helm-v2/opportunity-judge-runtime.ts`
- `lib/helm-v2/draft-comms-handoff-runtime.ts`
- `lib/helm-v2/meeting-action-pack-runtime.ts`
- `lib/operating-system/cognitive-object-contract.ts`

允许的职责只有：

- object-centered projection
- recommendation formation
- draft generation
- evidence-backed readout

不允许的职责：

- judgement 自动变成 commitment
- AI score 自动变成业务真相
- 新开 “智能分析平台 API”

### 4.3 Review / execution / follow-through seam

必须优先复用：

- `features/approvals/queries.ts`
- `features/approvals/actions.ts`
- `features/approvals/approvals-client.tsx`
- `features/meetings/actions.ts`
- `features/meetings/meeting-v2-human-action-execution-card.tsx`
- `features/meetings/meeting-v2-official-write-card.tsx`
- `lib/helm-v2/human-action-execution-runtime.ts`
- `lib/helm-v2/official-system-integration-runtime.ts`

必须继续依赖的当前主表语义：

- `ApprovalRequest`
- `HumanActionExecution`
- `OfficialWriteIntent`
- `LimitedAutoIntent`
- `OfficialFollowThrough`
- `MemoryItem`
- `ConnectorIngestionRecord`

允许的职责只有：

- review gating
- governed attempt
- explicit acknowledgment
- receipt capture
- follow-through update
- memory write-back

不允许的职责：

- auto-send
- broad auto-write
- 新 authority surface
- 让 external engine 代替 Helm 做 review owner

## 5. 允许与禁止的改动面

### 5.1 允许触碰

如果未来从 planning 进入窄实现，允许触碰的面只能是：

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
- 必要时极小范围的 `prisma/schema.prisma`
- 相关 docs / self-check / boundary docs

### 5.2 一律不碰

- `integrations/` 新平台根目录
- vendor-specific canonical model cluster
- `BusinessObject` 新主表
- `api/unified-data`
- `api/intelligence`
- 新 CRM front-end
- 新 workflow builder
- 新 settings / admin / auth platform 扩面
- broad analytics / telemetry platform

## 6. Acceptance Criteria

只有同时满足以下条件，这条单闭环才算通过 acceptance pack：

1. 每个 recommendation 都能追溯到 meeting 或 connector/import evidence，不允许凭空生成高风险动作
2. judgement、draft、review、attempt、acknowledgment、follow-through 仍然是分开的步骤
3. 任何写动作都不能绕过 `ApprovalRequest` 或既有 governed review surface
4. receipt 必须单独记录，不能被写成业务结果成功
5. follow-through 必须继续保留人工升级、人工补录或人工确认入口
6. provider 缺失时仍能退化到 current-main demo / manual fallback path
7. 不引入新 canonical schema、不引入新 authority surface、不引入新平台目录
8. workspace / membership / capability boundary 不被削弱

## 7. Provider-Missing Fallback Checklist

以下 checklist 没有全部回答清楚前，POC 不允许进入实现：

1. connector token 缺失时：
   - 退化为 read-only / local demo / existing artifact path
2. CRM provider 不可用时：
   - 仍可仅基于 meeting artifact 形成 judgement 与 review
3. external write 不可用时：
   - 只允许停在 recommendation / draft / manual follow-up
4. receipt 缺失时：
   - 必须保留 “unknown / pending / needs-manual-check” 语义，不能默认成功
5. source data 不完整时：
   - recommendation 必须显式降级，补 boundary / dependency note
6. runtime 失败时：
   - approval surface 仍能保留人工下一步与 follow-through 记录

## 8. Rollback Triggers

后续任何窄实现只要触发以下任一项，就应停止、回退或退回 planning：

1. 需要新增 platform root 或大块新目录才能把闭环串起来
2. 需要新增 vendor-specific canonical 表才能证明价值
3. review gating 被 shortcut，或出现绕过审批的直写路径
4. receipt 被直接当成 outcome success
5. provider 缺失时 demo path 直接断裂
6. workspace / membership / capability boundary 出现漂移
7. 为了集成顺手把 Helm 拉成 CRM front-end 或 workflow engine

## 9. `Receipt / Follow-through / Outcome Success` Distinction

这 3 个概念必须严格分开：

### 9.1 `ExecutionReceipt`

它只表示：

- 某个 external 或 manual action 已被尝试、已被接收、或已被人工确认

它不表示：

- 客户已经回复
- deal 已推进
- business objective 已完成

### 9.2 `Follow-through`

它表示：

- Helm 在 receipt 之后还需要继续追踪、补充、升级、关闭或复核的内部动作状态

它不表示：

- 外部业务结果已经自然达成

### 9.3 `Outcome Success`

它只能表示：

- 业务结果本身已经通过后续证据成立

它不能由以下任何单一信号直接推出：

- recommendation
- approval
- write attempt
- receipt

## 10. 当前阶段结论

在 `G5` 完成后，这条线的状态仍然是：

- `CONDITIONAL_GO`

原因：

- contract、候选矩阵、entry gate、acceptance pack 现在都已冻结到 planning 层
- 但还没有进入窄实现，也没有形成 runtime 级证据
- 当前主线优先级仍然高于 layered integration discovery

因此这份 acceptance pack 的意义不是“允许现在就接外部系统”，而是：

- 让未来如果真的进入窄实现，不会因为 scope drift 失控

## 11. 本轮刻意未做

- 不选 vendor
- 不新增依赖
- 不改 Prisma 主模型
- 不新增 API 平台层
- 不新增 CRM / workflow UI
- 不改 authority 边界

## 12. 下一步建议

如果继续沿这条线推进，下一步只应做下面 2 件事之一：

1. 维持 `planning-only`，等待 homepage / dashboard / feedback / activation 主线收口
2. 如果必须提前验证，只使用 [HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_IMPLEMENTATION_FREEZE_V1.md](./HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_IMPLEMENTATION_FREEZE_V1.md) 里冻结的 allowlist 和 stop condition，先开 `Batch A` 级别极小实现

当前不建议直接做：

- Twenty / Windmill / Dify 接线
- 新 schema migration
- 新平台目录或新平台 API

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
