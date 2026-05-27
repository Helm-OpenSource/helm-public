---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_LAYERED_INTEGRATION_CANDIDATE_EVALUATION_MATRIX_V1

状态：Planned  
Owner：Helm Core  
日期：2026-04-11

## 1. 目的

这份文档执行 `Track G3`，但只到评估矩阵，不到正式选型。

它回答 5 件事：

1. Helm 当前应该如何评估外部对象层、执行层、AI workflow 层、治理层候选
2. 哪些候选只是“外部邻近物”，哪些可以进入下一轮 POC 候选池
3. 哪些候选当前应该被一票否决
4. current-main 应该优先复用哪些已有 seam
5. 如果坚持 `Helm-first`，当前每层最合理的排序是什么

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

本轮接到的真实业务闭环：

- `source signal -> projection -> judgement -> review -> guarded execution -> receipt -> reconciliation`

本轮为什么现在做：

- `G1 / G2` 已经冻结 contract
- `G3` 需要把“谁能进入下一轮”写成 matrix，而不是继续抽象讨论
- 这一步必须先于任何 vendor 试接

## 3. 评估总原则

所有候选先过 4 条硬门槛，再看功能相似度。

### 3.1 Helm-first Hard Gates

候选只要触发以下任意一条，就不能进入下一轮：

1. 需要 Helm 交出 `judgement / review / policy / reconciliation` 主权
2. 无法保证 workspace / tenant-scoped boundary
3. 无法形成 receipt / reconciliation / manual fallback
4. 会把 current-main 直接推成 connector platform、workflow platform 或 CRM front-end

### 3.2 排序优先级

排序默认按这个顺序：

1. control-plane fit
2. review / governance fit
3. receipt / reconciliation fit
4. workspace / tenant isolation fit
5. current-main seam reuse
6. self-host / deploy control
7. implementation distance

“市场上像不像” 只排在后面，不能反过来压过 Helm 核心边界。

## 4. 评估维度

每个候选都按以下 7 个维度判断：

1. `Layer likeness`
   - 它像不像该层的典型外部产品
2. `Control-plane fit`
   - 是否允许 Helm 保留 judgement / review / policy control
3. `Governance fit`
   - 是否容易绕过 review、approval、boundary note
4. `Receipt / reconciliation fit`
   - 是否天然支持回执、异常、回流和 follow-through
5. `Tenant / workspace fit`
   - 是否容易保持 workspace-first / membership-backed
6. `Current-main reuse`
   - 是否能复用现有 seam，而不是重开新平台
7. `Implementation distance`
   - 距离可验证 POC 的实现距离是否可控

评分方式：

- `High`
- `Medium`
- `Low`

说明：

- `Layer likeness` 允许高，但 `Control-plane fit` 或 `Current-main reuse` 低时，仍然不能优先

## 5. 对象层 / Source Layer 候选

### 5.1 `Current-main connectors + imports`

候选内容：

- `Connector`
- `ImportSource`
- `ImportJob`
- `ImportItem`
- `lib/connectors/*`
- `lib/imports/*`

评估：

- Layer likeness：`Medium`
- Control-plane fit：`High`
- Governance fit：`High`
- Receipt / reconciliation fit：`Medium`
- Tenant / workspace fit：`High`
- Current-main reuse：`High`
- Implementation distance：`High`

结论：

- 这是对象层 POC 的默认第一优先，不是因为“它最像 CRM”，而是因为它最符合 Helm-first 和 current-main reuse

### 5.2 `Twenty`

基于 Twenty 官方文档，Twenty 是开源 CRM，支持 API、Webhooks、自托管，以及 custom objects / import / workflows 邻近能力。[Twenty getting started](https://docs.twenty.com/user-guide/getting-started) [Twenty API](https://docs.twenty.com/developers/api-and-webhooks/api) [Twenty self-host](https://docs.twenty.com/developers/self-hosting)

评估：

- Layer likeness：`High`
- Control-plane fit：`Medium`
- Governance fit：`Medium`
- Receipt / reconciliation fit：`Medium`
- Tenant / workspace fit：`Medium`
- Current-main reuse：`Low`
- Implementation distance：`Medium`

结论：

- 这是当前最像外部对象层的邻近物
- 但不是当前 POC 第一落点

### 5.3 `Corteza`

基于 Corteza 文档，Corteza 提供 modules / records / workflows / revisions / permissions / self-host 邻近能力，更偏 low-code record platform。[Corteza modules](https://docs.cortezaproject.org/corteza-docs/2020.6/admin/compose/administration/modules.html) [record revisions](https://docs.cortezaproject.org/corteza-docs/2024.9/integrator-guide/compose-configuration/record-revisions.html) [automation/manual workflows](https://docs.cortezaproject.org/corteza-docs/2024.9/integrator-guide/compose-configuration/page-blocks.html)

评估：

- Layer likeness：`High`
- Control-plane fit：`Medium`
- Governance fit：`Medium`
- Receipt / reconciliation fit：`Low`
- Tenant / workspace fit：`Medium`
- Current-main reuse：`Low`
- Implementation distance：`Low`

结论：

- 作为中国 / self-hosted / module-heavy 邻近物有参考价值
- 但比 `Twenty` 离 Helm 当前 POC 更远

### 5.4 对象层结论

当前排序：

1. `Current-main connectors + imports`
2. `Twenty`
3. `Corteza`

## 6. 执行层 / Execution Layer 候选

### 6.1 `Current-main guarded execution seam`

候选内容：

- `HumanActionExecution`
- `OfficialWriteIntent`
- `LimitedAutoIntent`
- `OfficialFollowThrough`
- approvals / meeting detail review surfaces

评估：

- Layer likeness：`Medium`
- Control-plane fit：`High`
- Governance fit：`High`
- Receipt / reconciliation fit：`High`
- Tenant / workspace fit：`High`
- Current-main reuse：`High`
- Implementation distance：`High`

结论：

- 这是执行层 POC 的默认第一优先

### 6.2 `Windmill`

基于 Windmill 官方文档，Windmill 提供自托管执行引擎、server/worker/Postgres 架构、作业审计日志、运行日志、webhooks 和 full API。[Windmill self-host](https://www.windmill.dev/docs/advanced/self_host) [Windmill audit logs](https://www.windmill.dev/docs/core_concepts/audit_logs) [Windmill observability](https://www.windmill.dev/platform/observability-content)

评估：

- Layer likeness：`High`
- Control-plane fit：`Medium`
- Governance fit：`Medium`
- Receipt / reconciliation fit：`High`
- Tenant / workspace fit：`Medium`
- Current-main reuse：`Low`
- Implementation distance：`Medium`

结论：

- 这是当前最像外部执行层的邻近物
- 它的长处是 run logs / audit / worker separation
- 但 Helm 仍然必须保留 review / approval / reconciliation owner 身份

### 6.3 `n8n`

基于 n8n 官方文档，n8n 具备 AI workflows、API keys、human fallback、log streaming 和安全审计等能力，但它本质仍偏通用自动化与 workflow builder。[n8n human fallback](https://docs.n8n.io/advanced-ai/examples/human-fallback/) [n8n log streaming](https://docs.n8n.io/log-streaming/) [n8n security audit](https://docs.n8n.io/hosting/securing/security-audit/) [n8n API auth](https://docs.n8n.io/api/authentication/)

评估：

- Layer likeness：`High`
- Control-plane fit：`Low`
- Governance fit：`Low`
- Receipt / reconciliation fit：`Medium`
- Tenant / workspace fit：`Low`
- Current-main reuse：`Low`
- Implementation distance：`Medium`

结论：

- 它更适合作为“通用自动化邻近物”参考
- 不适合作为 Helm 当前执行层 POC 的第一外部候选
- 这里对治理 fit 的判断有推断成分：基于其产品重心更偏 workflow automation，而不是 judgement-first review boundary

### 6.4 执行层结论

当前排序：

1. `Current-main guarded execution seam`
2. `Windmill`
3. `n8n`

## 7. AI Workflow Assist Layer 候选

### 7.1 `Current-main meeting/runtime seam`

候选内容：

- `meeting-ended.ingest`
- opportunity judge
- draft comms / handoff runtime
- memory pipeline
- meeting detail runtime cards

评估：

- Layer likeness：`Medium`
- Control-plane fit：`High`
- Governance fit：`High`
- Receipt / reconciliation fit：`High`
- Tenant / workspace fit：`High`
- Current-main reuse：`High`
- Implementation distance：`High`

结论：

- 这是 AI workflow assist 的默认第一优先

### 7.2 `Dify`

基于 Dify 官方文档，Dify 提供 workflow / agent 节点、运行历史、日志、工作流日志 API、plugin trigger 和 HTTP request 节点等能力。[Dify run history](https://docs.dify.ai/en/use-dify/debug/history-and-logs) [Dify logs](https://docs.dify.ai/en/use-dify/monitor/logs) [workflow logs API](https://docs.dify.ai/api-reference/workflow-execution/get-workflow-logs) [Agent node](https://docs.dify.ai/versions/3-0-x/en/user-guide/workflow/node/agent) [Plugin trigger](https://docs.dify.ai/en/use-dify/nodes/trigger/plugin-trigger)

评估：

- Layer likeness：`High`
- Control-plane fit：`Medium`
- Governance fit：`Medium`
- Receipt / reconciliation fit：`Low`
- Tenant / workspace fit：`Medium`
- Current-main reuse：`Low`
- Implementation distance：`Medium`

结论：

- 这是当前最像外部 AI workflow 邻近物
- 更适合作为 model assist / workflow assist 参考，不适合替代 Helm judgement runtime

### 7.3 `Plane`

Plane 没有被纳入当前第一轮矩阵主候选。

原因：

- 它更像协作 / project operating surface 邻近物
- 不像 AI workflow assist 主邻近物
- 也不像 Helm 的治理主层

结论：

- 保留为场景邻近物，不进入当前矩阵主候选池

### 7.4 AI Workflow 层结论

当前排序：

1. `Current-main meeting/runtime seam`
2. `Dify`
3. `Plane` 仅作场景邻近参考，不进当前主候选池

## 8. 治理层 / Governance Layer 候选

### 8.1 `Helm first-party governance`

候选内容：

- `ApprovalRequest`
- governed action review posture
- `OfficialWriteIntent`
- `LimitedAutoIntent`
- `OfficialFollowThrough`
- policy / boundary / audit / replay / reconciliation

评估：

- Layer likeness：`High`
- Control-plane fit：`High`
- Governance fit：`High`
- Receipt / reconciliation fit：`High`
- Tenant / workspace fit：`High`
- Current-main reuse：`High`
- Implementation distance：`High`

结论：

- 治理层不外包
- 当前没有可替代 Helm 的正式候选

### 8.2 邻近物说明

以下产品只提供局部邻近信号，不进入治理层接管候选：

- Windmill：audit / run logs 邻近
- Dify：workflow logs / tracing 邻近
- Corteza：record revisions / permissions 邻近
- n8n：security audit / logging / sharing 邻近

结论：

- 治理层只有 adjacency，没有 replacement

## 9. 当前总排序

### 9.1 当前最适合进入 POC 的层级起点

1. 对象层：`Current-main connectors + imports`
2. 执行层：`Current-main guarded execution seam`
3. AI workflow assist：`Current-main meeting/runtime seam`
4. 治理层：`Helm first-party governance`

### 9.2 当前最像外部邻近物

1. 对象层：`Twenty`
2. 执行层：`Windmill`
3. AI workflow assist：`Dify`
4. 治理层：`无直接等价竞品`

## 10. 一票否决规则

以下情况直接否决：

1. 候选要求 Helm 降级成 thin shell
2. 候选天然绕过 `ReviewBundle`
3. 候选无法形成 receipt / reconciliation / manual fallback
4. 候选要求引入 vendor-specific canonical object schema 才能成立
5. 候选会逼出新的 connector platform / workflow platform / CRM front-end

## 11. 下一步建议

如果继续执行，下一步不是接 SDK，而是：

1. 按这份 matrix 固定 `single-loop POC candidate set`
2. 只用 current-main seam 写 `G4 entry gate`
3. 外部候选只保留为对照与第二序备选，不进入第一轮实现

当前 `G4` 文档见：

- [HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ENTRY_GATE_V1.md](./HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ENTRY_GATE_V1.md)

## 12. 验证

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
