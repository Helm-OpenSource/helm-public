---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Tenant Resource Integration Governance Implementation Plan V1

更新时间：2026-04-25  
对应 PRD：`docs/product/HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_PRD_V1.md`  
状态：Implementation active  
本轮范围：任务拆解与最小可验证实现切片

## 1. 总体方案

用最小可验证路径把租户已有资源纳入 Helm 控制智能：

```text
Phase 1: 只读资源目录
Phase 2: readiness / mapping / trust 缺口
Phase 3: 一条代表性 governed loop
Phase 4: tenant custom extension adoption
Phase 5: guarded official write evaluation
```

第一轮不做 schema migration，优先从现有数据源聚合 read model：

- `Connector`
- `ImportSource`
- `ImportJob`
- CRM import preview / run / conflict
- `WorkspaceSolutionExtension`
- extension manifests
- capture / meeting ingest posture
- runtime resource / official-write posture
- capability decision trace

## 2. 架构决策

### 2.1 先做 read model，不先做 canonical schema

原因：

- 当前资源接入来源分散，直接上 schema 容易过早固化错误抽象。
- 已有 connector/import/extension/runtime 足够合成第一版 resource readiness。
- read model 能快速验证用户是否真的理解“资源 -> 治理 -> 推进闭环”。

### 2.2 资源层不拥有治理权

所有资源能力都必须通过 Helm Control Plane 解释：

- workspace ownership
- membership capability
- trust / promotion
- review requirement
- effect mode downgrade
- audit / replay

### 2.3 tenant custom 先落 extension

行业系统、客户自研系统、垂直业务对象不直接进 shared core。

第一版要求：

- extension manifest 声明 resource dependency。
- extension readout 只能读/解释自己的 domain resource。
- shared capability 只能从稳定、跨客户可复用的部分抽取。

### 2.4 所有写回都后置

Phase 1-3 默认只允许：

- read-only
- draft-only
- internal write
- manual execution proof

`guarded official write` 只能进入 Phase 5 评估。

## 3. 任务列表

### Task 1: 冻结 PRD 与索引

描述：把租户资源接入治理 PRD 与实施计划接入文档索引，作为后续实现入口。

Acceptance：

- `docs/product/HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_PRD_V1.md` 存在。
- `docs/reviews/HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_IMPLEMENTATION_PLAN_V1.md` 存在。
- README / docs index 能找到这两份文档。
- 文档明确不做 connector marketplace、broad auto-write、schema migration、reserved tenant 商业逻辑混入。

Verify：

```bash
npm run self-check
npm run check:boundaries
git diff --check
```

Files likely touched：

- `README.md`
- `docs/README.md`
- `docs/product/HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_PRD_V1.md`
- `docs/reviews/HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_IMPLEMENTATION_PLAN_V1.md`

Estimated scope：S

### Task 2: Resource readiness read model contract

描述：设计并实现只读 `TenantResourceReadiness` contract，把现有 connector/import/extension/capture/runtime 姿态合成统一 read model。

Acceptance：

- read model 能列出资源 name/type/provider/status/source。
- 能表达 `readable / mapped / governed / actionable / paused / error`。
- 不新增 schema migration。
- 不改变现有 connector/import 行为。

Verify：

```bash
npm run test -- lib/tenant-resources/readiness.test.ts
npm run typecheck
```

Files likely touched：

- `lib/tenant-resources/readiness.ts`
- `lib/tenant-resources/readiness.test.ts`
- existing query helpers as needed

Estimated scope：M

### Task 3: Settings resource control surface

描述：在 settings 增加租户资源控制面，展示资源状态、缺口、风险和下一步动作。

状态：已完成第一轮最小切片，见 `HELM_TENANT_RESOURCE_SETTINGS_CONTROL_SURFACE_REPORT_V1.md`。

Acceptance：

- 用户看到的是“资源能不能用于经营推进”，不是 connector 配置堆叠。
- 每个资源显示状态、可信度、最近同步、治理姿态、下一步。
- 无权限用户看到 read-only posture，不看到可执行按钮。
- 不暴露 internal-only reserved host 内容。

Verify：

```bash
npm run test -- features/settings/tenant-resource-readiness-display.test.ts lib/tenant-resources/readiness.test.ts
npm run typecheck
npm run lint
```

Files likely touched：

- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `features/settings/tenant-resource-readiness-display.ts`
- tests under `features/settings/`

Estimated scope：M

### Task 4: Mapping / trust / gap readout

描述：把 imports / CRM / extension 样本的字段映射、冲突、freshness、trust posture 汇总成资源缺口。

状态：已完成第一轮最小切片，见 `HELM_TENANT_RESOURCE_MAPPING_TRUST_GAP_REPORT_V1.md`。

Acceptance：

- CRM/import 资源能显示 mapping completeness。
- conflict count / unresolved gap 能影响 actionable status。
- stale 或低可信资源会降级，不进入 high-risk action。
- extension manifest 缺 resource dependency 时显示 review warning。

Verify：

```bash
npm run test -- features/settings/tenant-resource-readiness-display.test.ts lib/tenant-resources/readiness.test.ts
npm run check:boundaries
```

Files likely touched：

- `lib/tenant-resources/mapping-readiness.ts`
- `features/imports/*`
- `lib/solution-extension-manifests.ts`
- extension sample manifests/tests if needed

Estimated scope：M

### Task 5: Capability decision trace integration

描述：资源使用进入 Helm 判断或动作前，输出 capability decision trace，解释 allow / downgrade / review / deny。

状态：已完成第一轮最小切片，见 `HELM_TENANT_RESOURCE_CAPABILITY_TRACE_REPORT_V1.md`。

Acceptance：

- resource-driven action 能读到 `resourceIdentity`、`effectMode`、`trust posture`、`fallback`。
- 无权限、低可信、freshness 过期时有明确 reason code。
- trace 仍是 read-only adoption，不改变现有 enforcement source。

Verify：

```bash
npm run test -- lib/capability-decision-trace.test.ts lib/tenant-resources/readiness.test.ts features/settings/tenant-resource-readiness-display.test.ts
npm run check:boundaries
```

Files likely touched：

- `lib/capability-decision-trace.ts`
- `lib/tenant-resources/capability-trace.ts`
- tests

Estimated scope：M

### Task 6: 单条代表性 governed loop

描述：选择一个已有资源样本，跑通 `observe -> judge -> govern -> act -> verify -> learn` 的最小闭环。

状态：已完成第一轮最小切片，见 `HELM_TENANT_RESOURCE_GOVERNED_LOOP_REPORT_V1.md`。

推荐候选：

- CRM import resource
- 米盾云 extension resource
- 美业 CRM resource

Acceptance：

- 资源信号能生成一条 judgement / next action。
- next action 带 evidence、source posture、boundary note。
- 动作默认进入 manual execution proof 或 review，不自动写外部系统。
- proof / failure / stale 能进入 follow-through。
- memory/report/handoff 能看到结果摘要。

Verify：

```bash
npm run test -- lib/tenant-resources/governed-loop.test.ts
npm run check:boundaries
npm run typecheck
```

Files likely touched：

- `lib/tenant-resources/governed-loop.ts`
- existing import or extension adapter
- relevant surface readout
- tests

Estimated scope：M/L，需要先选定资源样本

### Task 7: Operating / dashboard resource impact readout

描述：把资源健康度变成经营面判断，而不是配置面噪声。

状态：已完成第一轮最小切片，见 `HELM_TENANT_RESOURCE_OPERATING_IMPACT_READOUT_REPORT_V1.md`。

Acceptance：

- dashboard / operating 只显示对今日推进有影响的资源缺口。
- resource gap 能解释“为什么某条建议被降级或阻断”。
- evidence drill-down 可达，但不压倒 judgement。

Verify：

```bash
npm run test -- features/internal-operating-workspace/resource-impact-display.test.ts
npm run lint
```

Files likely touched：

- `features/internal-operating-workspace/*`
- `features/dashboard/*`
- presentation helpers/tests

Estimated scope：M

### Task 8: Guardrails / docs / regression closeout

描述：把资源接入治理的边界写入 self-check / boundary guard / docs index / acceptance report。

状态：已完成收口，见 `HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_ACCEPTANCE_REPORT_V1.md`。

Acceptance：

- `check:boundaries` 防止把资源接入写成 connector platform 或 broad auto-write。
- `self-check` 能发现核心文档缺失。
- README 和 docs index 与 current-main truth 一致。
- acceptance report 说明已成立、仍需下一层、刻意未做、风险项。

Verify：

```bash
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
```

Files likely touched：

- `scripts/decision-first-boundary-check.ts`
- `scripts/helm-self-check-refactored.ts` or config
- `README.md`
- `docs/README.md`
- `docs/reviews/HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_ACCEPTANCE_REPORT_V1.md`

Estimated scope：M

## 4. Checkpoints

### Checkpoint A - 文档评审

完成 Task 1 后停下评审：

- PRD 是否没有过度抽象？
- 非目标是否足够硬？
- 第一条 MVP 资源是否明确？

### Checkpoint B - Read model 成立

完成 Task 2-3 后验证：

- 用户能否理解资源状态？
- 是否能看到下一步动作？
- 是否无需 connector marketplace 就能产生价值？

### Checkpoint C - Governance 成立

完成 Task 4-5 后验证：

- trust / freshness / mapping / capability 能否解释降级？
- operator 能否知道为什么不能自动推进？

### Checkpoint D - 闭环成立

完成 Task 6-7 后验证：

- 是否真的跑通一条经营事项闭环？
- 是否形成 proof / follow-through / memory / report？
- 是否仍保持 review-first？

## 5. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 把资源接入做成 connector marketplace | 范围失控 | 第一版只做 readiness read model 和单条 loop |
| 过早 schema migration | 抽象固化错误 | Phase 1-2 只读合成，不改 canonical schema |
| 接入后只有配置，没有经营推进 | 用户无感 | 每个资源必须产生 judgement / next action / gap |
| 外部资源写回越权 | 安全和信任风险 | read-before-write，guarded official write 后置 |
| tenant custom 污染 shared core | 长期维护困难 | 垂直系统先走 extension |
| agent inference 污染事实层 | memory/recommendation 失真 | agent inference 永不直接替代 fact |
| reserved tenant 商业逻辑混进客户资源接入 | 租户边界混乱 | reserved commercial 单独保留，不进入本 PRD |

## 6. No-Go

以下任一条件出现，应停止进入实现：

- 不能选出第一条代表性资源闭环。
- 需要 broad auto-write 才能展示价值。
- 没有 evidence / trust / capability 降级路径。
- 前台只能展示技术配置，不能展示经营下一步。
- 无法保证 workspace-first tenant ownership。

## 7. 推荐下一步

进入 Task 8：

> 把资源接入治理的边界写入 self-check / boundary guard / docs index / acceptance report。

Task 8 的范围必须继续收窄：只做守卫、文档索引、验收报告和回归验证，不新增资源类型、不扩 official write、不做 marketplace 或真实 orchestration。
