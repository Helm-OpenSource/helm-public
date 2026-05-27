---
status: archived
owner: helm-core
created: 2026-04-12
review_after: 2026-10-09
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_IMPLEMENTATION_FREEZE_V1

状态：Planned  
Owner：Helm Core  
日期：2026-04-11

## 1. 目的

这份文档执行 `Track G6`，但仍然不进入真正实现。

它只冻结 4 件事：

1. 如果未来真的要做第一条窄实现，第一批只允许动哪些文件
2. 哪些测试、守卫和文档入口必须跟着一起动
3. 哪些全局 runtime / schema / platform 面在第一批一律禁止触碰
4. 哪些 stop condition 一旦触发，就必须停手或回退

这份文档不是：

- implementation PR
- runtime substrate refactor
- vendor integration sprint
- schema migration proposal
- authority expansion plan

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `docs/product/HELM_V2_EVENT_FLOW_API_CONTRACT_V1.md`
- `docs/product/HELM_V2_DATA_MODEL_V1.md`
- `docs/product/HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ENTRY_GATE_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ACCEPTANCE_PACK_V1.md`

本轮继续沿同一条唯一闭环：

- `meeting-led governed follow-up loop`

也就是：

- meeting runtime 触发
- source / import 只提供 evidence
- judgement 保持 reviewable
- execution 走已有 governed path
- receipt、follow-through、outcome success 严格分开

## 3. 第一批实现只允许证明什么

如果未来进入第一批窄实现，唯一允许证明的是：

- current-main 能把已有 meeting/runtime、connector/import evidence、approval review、official write、follow-through 串成一条更清楚的 governed loop

第一批不允许证明：

- 新 vendor 已接通
- 新系统 of record 已建立
- 新 workflow engine 已可用
- 新 canonical object 层已成立
- 新 authority surface 已扩大

## 4. 第一批允许触碰的文件

### 4.1 Batch A: Evidence -> judgement threading

第一批第一步只允许先碰这些文件：

- `app/api/runtime/events/meeting-ended/route.ts`
- `features/meetings/queries.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/meetings/meeting-v2-ingestion-retrieval-card.tsx`
- `features/meetings/meeting-v2-opportunity-judge-card.tsx`
- `features/meetings/meeting-v2-draft-comms-card.tsx`
- `lib/helm-v2/connector-ingestion-retrieval-runtime.ts`
- `lib/helm-v2/opportunity-judge-runtime.ts`
- `lib/helm-v2/draft-comms-handoff-runtime.ts`
- `lib/helm-v2/meeting-action-pack-runtime.ts`

这一批只允许解决：

- meeting-led evidence readout 更清楚
- recommendation / draft / evidence linkage 更清楚
- 不新增 schema 的情况下让 read path 更一致

这一批不允许顺手解决：

- global runtime substrate 重构
- imports 平台扩写
- approvals surface redesign

### 4.2 Batch B: Review -> execution -> receipt threading

只有在 Batch A 不触发 stop condition 时，下一批才允许碰：

- `features/meetings/actions.ts`
- `features/meetings/meeting-v2-human-action-execution-card.tsx`
- `features/meetings/meeting-v2-official-write-card.tsx`
- `features/approvals/actions.ts`
- `features/approvals/queries.ts`
- `features/approvals/approvals-client.tsx`
- `lib/helm-v2/human-action-execution-runtime.ts`
- `lib/helm-v2/official-system-integration-runtime.ts`

这一批只允许解决：

- review gating 更明确
- attempt / acknowledge / manual follow-up 路径更清楚
- receipt 与 follow-through 的状态展示更不易混淆

这一批不允许顺手解决：

- auto-send
- broad auto-write
- 新审批体系
- 新 operator surface

### 4.3 Batch C: Optional source-evidence assist only

只有在 Batch A / B 都成立，且确有必要时，才允许碰：

- `lib/imports/crm-entry.service.ts`
- `lib/imports/crm-orchestrator.service.ts`
- `lib/imports/crm-source.service.ts`
- `app/api/imports/crm/preview/route.ts`
- `app/api/imports/crm/run/route.ts`
- `app/api/imports/crm/sync/route.ts`
- `lib/connectors/google.ts`
- `lib/connectors/hubspot.ts`
- `lib/connectors/salesforce.ts`

这一批只允许解决：

- source-grounded evidence retrieval
- subject matching
- provider available / unavailable 时的 read-path fallback

这一批不允许顺手解决：

- OAuth / callback platform 扩面
- provider-specific writeback
- connector admin surface 扩面

## 5. 第一批一律禁止触碰的文件和区域

即使未来进入窄实现，第一批也一律不允许碰：

- `lib/helm-v2/contracts.ts`
- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `integrations/`
- `features/intelligence/`
- `app/api/unified-data/*`
- `app/api/intelligence/*`
- 新增任何 vendor-specific model 文件簇
- 任何新的 CRM front-end / workflow builder / settings platform

原因：

- 这些面会把窄实现直接推成 runtime substrate、platform 或 schema 级扩张
- 它们也更容易与当前主线里的并行改动发生冲突

## 6. Schema Freeze

第一批默认：

- `prisma/schema.prisma` 不动

只有出现以下 3 个条件同时满足时，才允许讨论极小范围的 additive schema 变更：

1. 没有新表
2. 没有新 canonical object
3. 只是为了把既有 receipt / follow-through / audit 字段接到现有模型

如果需要：

- 新表
- vendor-specific 表
- cross-object canonical schema

则直接停止，回到 planning。

## 7. 测试与守卫 Allowlist

未来第一批窄实现，优先只允许先更新和运行这些测试：

### 7.1 Runtime / logic tests

- `lib/helm-v2/connector-ingestion-retrieval-runtime.test.ts`
- `lib/helm-v2/opportunity-judge-runtime.test.ts`
- `lib/helm-v2/draft-comms-handoff-runtime.test.ts`
- `lib/helm-v2/meeting-action-pack-runtime.test.ts`
- `lib/helm-v2/human-action-execution-runtime.test.ts`
- `lib/helm-v2/official-system-integration-runtime.test.ts`

### 7.2 Import governance tests

- `lib/imports/crm-orchestrator-governance.test.ts`
- `lib/imports/import-service-governance.test.ts`
- `lib/imports/identity-resolution-governance.test.ts`

### 7.3 Mandatory guards

- `scripts/helm-self-check.ts`
- `scripts/helm-self-check-refactored.ts`
- `scripts/decision-first-boundary-check.ts`

### 7.4 Companion docs

- `README.md`
- `PLANS.md`
- `docs/README.md`
- 当前 `G4 / G5 / G6` 文档

## 8. 第一批实现的 Stop Conditions

只要出现以下任一情况，第一批实现就必须暂停、拆小或回退：

1. Batch A 需要改 `prisma/schema.prisma`
2. Batch A 需要碰 `lib/helm-v2/contracts.ts` 或 `runtime-upgrade.ts`
3. 任何一步需要新建平台目录或平台 API
4. review gating 被 shortcut
5. receipt 被直接提升成 outcome success
6. provider 缺失时 current-main demo path 失效
7. implementation 需要跨出 allowlist 才能成立

## 9. Concurrency / Dirty Worktree Note

未来真正进入实现前，还必须额外检查：

- allowlist 文件当前是否已有并行改动
- 当前主线 batch 是否正在改同一批 meeting / runtime / approvals 文件

如果有并行改动，默认做法不是扩大范围，而是：

1. 先等待主线落地或换到更窄子批次
2. 避免在全局 runtime / contract 文件上叠加局部 POC 需求
3. 不回滚、不覆盖、不顺手清理他人改动

## 10. 第一批实现的最小完成定义

未来如果真的进入第一批窄实现，完成定义只看这些：

1. meeting-led loop 在现有页面上更清楚地展示 evidence -> judgement -> review -> receipt -> follow-through
2. recommendation、attempt、acknowledgment、follow-through 仍然是分开的
3. provider 缺失时仍可退化到 manual / read-only path
4. 没有引入新表、新平台目录、新 authority surface
5. targeted tests 与 boundary/self-check 均通过

## 11. 当前阶段结论

在 `G6` 完成后，这条线仍然是：

- `CONDITIONAL_GO`

原因：

- implementation allowlist、test allowlist 和 stop condition 现在都被冻结了
- 但还没有任何 runtime 级实现证据
- 当前主线优先级仍然高于这条 discovery 线

因此 `G6` 的意义只是：

- 防止未来第一批窄实现失控

而不是：

- 允许现在就开始 vendor integration 或 platform refactor

## 12. 下一步建议

如果继续沿这条线推进，下一步只应该是二选一：

1. 继续停在 planning-only，等待主线 batch 收口
2. 如果必须前移验证，只按 [HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_BATCH_A_EXECUTION_CHECKLIST_V1.md](./HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_BATCH_A_EXECUTION_CHECKLIST_V1.md) 的 preflight、顺序和 targeted validation 开 `Batch A`

当前不建议直接做：

- Batch B + Batch C 一起开
- schema 变更
- runtime substrate 改造
- external provider writeback

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
