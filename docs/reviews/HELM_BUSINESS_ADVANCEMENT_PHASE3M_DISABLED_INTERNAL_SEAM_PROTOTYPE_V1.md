---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3M Disabled Internal Seam Prototype V1

**日期**: 2026-04-26
**阶段**: Phase 3M — Disabled Internal Seam Prototype
**规则版本**: `phase3m-disabled-internal-seam-prototype/v1`
**Seam Prototype 姿态**: Conditional-Go
**Runtime Adoption 姿态**: No-Go
**实际业务数据校准完成**: 否

---

## 执行摘要

Phase 3M 完成。本阶段在 feature-only 文件中实现 TPQR-001 / TPQR-003 / TPQR-004 三条 family 的 disabled-by-default internal seam prototype，验证接缝在可执行代码层面的正确性。Seam prototype 姿态为 **Conditional-Go**，runtime adoption 姿态维持 **No-Go**。

Phase 3M **是** feature-only disabled seam prototype implementation。它仅对注入行（injected rows）执行 source function 逻辑，返回 per-family 状态（disabled / capability_denied / evaluated）及 included/excluded 结果集。

Phase 3M **不是** runtime adapter、不是 DB reader、不是 production query、不是 API route、不是 mobile read-model integration、不是 schema 变更、不是 extractor、不是 event queue、不是 official write、不是 automated execution authority。`productionIntegrationAllowed` 在本阶段维持 `false`。

同阶段还修复了 Phase 3H TPQR-004 中的 dedup 回归缺陷（generic producer 错误排除 CRM-linked 物理行），并补充了回归覆盖。

---

## 为什么这仍然不是实现

| 维度 | Phase 3M 完成了什么 | Phase 3M 没有做什么 |
|------|-------------------|-------------------|
| Seam prototype | 在 feature-only 代码中调用 Phase 3H source functions，验证接缝可执行 | 无任何真实 DB query 执行 |
| 治理边界 | flags 默认 false，capability check 前置，productionIntegrationAllowed=false | 无 productionIntegrationAllowed=true |
| 覆盖范围 | 仅对注入行（injected rows）运行；94 项 vitest tests 全部通过 | 未对任何真实 DB rows 运行 |
| 校准状态 | 引用 Phase 3K 合成 threshold fixture result | 真实业务数据校准未完成 |
| 导入范围 | 仅相对路径 feature-only import（Phase 3H / Phase 3K）；无 DB/prisma/@/ import，无 Date.now，无 fs/network | 未修改 app/、data/queries.ts、prisma schema、lib/ 核心模块 |
| 下一步入口 | 为 Phase 3N internal prototype review 提供 Conditional-Go | 不授权 runtime adoption |

接缝 prototype 通过意味着：接缝在 feature-only 代码层面可执行，但不等于业务校准通过，不等于真实数据安全，不等于可以启用 production integration。

---

## 实现内容

### 总体结构

`features/business-advancement/phase3m-disabled-internal-seam-prototype.ts` 导出：

- `PHASE3M_RULE_VERSION`, `PHASE3M_RUNTIME_ADOPTION_POSTURE` (`"No-Go"`), `PHASE3M_PROTOTYPE_POSTURE` (`"Conditional-Go"`)
- `PHASE3M_DEFAULT_FLAGS`: `{ tpqr001: false, tpqr003: false, tpqr004: false }`
- 三条 capability constant（`CAPABILITY_BLOCKED_DECISION_READ` / `CAPABILITY_OVERDUE_COMMITMENT_READ` / `CAPABILITY_CUSTOMER_WAITING_READ`）
- `runPhase3mDisabledInternalSeamPrototype(input)`: 主入口，接受 `workspaceId`、显式 `referenceClockMs`、flags、capabilities 与 injected source rows
- 输出 `Phase3mOutput`: top-level `productionIntegrationAllowed=false`，以及 per-family `tpqr001` / `tpqr003` / `tpqr004`，每条含 status / capabilitySatisfied / enabled / result

### Per-family 行为

#### TPQR-001 / Blocked Decision

- flag `tpqr001 === false` → status: `disabled`，不执行 source function
- capability `helm.business-advancement.source.blocked-decision.read` 未授权 → status: `capability_denied`
- 否则：调用 Phase 3H `sourceBlockedDecisionCandidates({ workspaceId, referenceClockMs, thresholdMs, enabled: true, rows })`，返回 included / excluded
- `productionIntegrationAllowed: false`

#### TPQR-003 / Overdue Commitment

- flag `tpqr003 === false` → status: `disabled`
- capability `helm.business-advancement.source.overdue-commitment.read` 未授权 → status: `capability_denied`
- 否则：调用 Phase 3H `sourceOverdueCommitmentCandidates({ workspaceId, referenceClockMs, enabled: true, rows })`，返回 included / excluded
- `productionIntegrationAllowed: false`

#### TPQR-004 / Customer Waiting

- flag `tpqr004 === false` → status: `disabled`
- capability `helm.business-advancement.source.customer-waiting.read` 未授权 → status: `capability_denied`
- 否则：调用 Phase 3H `sourceCustomerWaitingCandidates({ workspaceId, enabled: true, rows })`，返回 included / excluded
- `productionIntegrationAllowed: false`

---

## Phase 3H TPQR-004 Dedup Bug 修复

### 缺陷描述

Phase 3H `sourceCustomerWaitingCandidates` 的 generic producer 原本同时将 `opportunityId === null` 与 `opportunityId !== null` 的行（即 CRM-linked 物理行）标记为 `deduped_by_crm_linked` 排除，导致同一 `emailThreadId` 的物理行被错误地同时出现在 included 和 excluded 结果中。

### 修复内容

- generic producer 现在**仅**对 `opportunityId === null` 的行执行逻辑
- CRM-linked 物理行（`opportunityId !== null`）不再被 generic producer 处理，不会被错误标记为 `deduped_by_crm_linked`
- 修复后：同一 `sourceRowId` 不会同时出现在 included 和 excluded 集合中

### 回归覆盖

新增 vitest tests 断言：

- included 与 excluded 集合不存在 `sourceRowId` 交集
- CRM-linked 物理行仅由 CRM-linked producer 处理，generic producer 不重复处理

---

## 状态表

### 已经完整成立

| 项目 | 说明 |
|------|------|
| flags 默认 false | 三条 family 均 default false，flag 未开启时直接返回 disabled，不执行任何逻辑 |
| capability check 前置 | flag 开启后 capability 未授权时返回 capability_denied，不执行 source function |
| productionIntegrationAllowed=false | 三条 family 均在 result 中明确标注，不得在本阶段改为 true |
| feature-only 文件隔离 | 仅导入相对路径 Phase 3H / Phase 3K；无 DB/prisma/@/ import，无 Date.now，无 fs/network |
| per-family included/excluded 结构 | 三条 family 均返回结构化 included / excluded，与 Phase 3H source function 接口对齐 |
| TPQR-004 dedup bug 修复 | generic producer 仅处理 opportunityId === null 行；同一 sourceRowId 不同时出现在 included/excluded |
| 回归覆盖 | 94 项 vitest tests（跨 Phase 3H + Phase 3M）全部通过，含 dedup 回归断言 |
| workspace 范围隔离 | 注入行均含 workspaceId 约束，结构与 Phase 3L seam plan 一致 |

### 已成形但仍需下一层

| 项目 | 缺什么 | 下一层 |
|------|--------|--------|
| function-to-DB seam | 仍为注入行（injected rows），无实际 WHERE clause 执行记录 | Phase 3N internal prototype review + 真实 DB seam |
| threshold 校准 | 引用 Phase 3K 合成保守值（72h / binary_predicate），未经真实业务数据分布验证 | 真实数据校准证据包 |
| binary_predicate_unresolved | TPQR-003 / TPQR-004 threshold 未验证真实分布 | Phase 3N + 真实数据 |
| audit bundle 字段完整性 | 字段结构已通过 feature-only tests，但未在真实 query 中验证返回 | Phase 3N integration test |
| capability grant 来源 | 当前 capability 为测试传入，无 production capability registry 对接 | 运行时 capability 授权体系（Phase 3N+ 范围） |

### 刻意未做

| 项目 | 原因 |
|------|------|
| productionIntegrationAllowed=true | 真实数据校准未完成，多层 blocker 未解除，runtime adoption No-Go 维持 |
| 任何真实 DB query 执行 | feature-only 阶段，注入行隔离；防止误入 production path |
| @/ / data/queries.ts / prisma schema / lib/ 修改 | 受控边界，Phase 3M 仅允许 feature-only 文件 |
| app/ / API route / mobile read-model 修改 | 受控边界，不触碰 runtime 接入点 |
| Date.now() / fs / network 调用 | feature-only 隔离要求；时钟通过 referenceClockMs 显式注入 |
| runtime adoption 授权 | 多层 blocker 未解除（calibration_placeholder / binary_predicate_unresolved / function-to-DB seam） |

### 风险项

| 风险 | 级别 | 缓解 |
|------|------|------|
| 合成 threshold 偏离真实业务分布 | 中 | Phase 3N 前必须完成真实数据校准证据包；blocker 不得被"合成通过"替代 |
| function-to-DB seam 建立后暴露 schema drift | 中 | Phase 3N 需对 ActionItem / Commitment / EmailThread 表结构做独立 schema review |
| dual-producer dedup 在高并发场景失效 | 低-中 | 当前 after-producer dedup 为 in-memory set；production 场景需持久化 dedup 或幂等写入 |
| TPQR-004 dedup 修复后 generic producer 覆盖范围收窄 | 低 | 修复是正确的：CRM-linked 物理行应由 CRM-linked producer 负责；回归测试已覆盖该场景 |
| capability grant 未对接 production capability registry | 中 | 当前 capability 为测试传入，Phase 3N 须明确 capability 授权来源与治理路径 |

---

## 验证结果

### 单元测试

```
npx vitest run features/business-advancement/phase3h-source-function-planning.test.ts features/business-advancement/phase3m-disabled-internal-seam-prototype.test.ts
```

**结果**: 2 files, 94 tests passed, 0 failed

### CLI Evaluator Checks

```
npx tsx scripts/business-advancement-phase3m-disabled-internal-seam-prototype.ts
```

**结果**: 所有 checks passed，exits 0

### ESLint

```
npx eslint features/business-advancement/phase3h-source-function-planning.ts features/business-advancement/phase3h-source-function-planning.test.ts features/business-advancement/phase3m-disabled-internal-seam-prototype.ts features/business-advancement/phase3m-disabled-internal-seam-prototype.test.ts scripts/business-advancement-phase3m-disabled-internal-seam-prototype.ts
```

**结果**: 0 warnings, 0 errors (clean)

### Git Diff Check

```
git diff --check
```

**结果**: clean。文件范围仅含 Phase 3H TPQR-004 dedup 修复、Phase 3M feature/test/script、review 文档和 `docs/README.md` 索引，未触碰 `app/`、`data/queries.ts`、`prisma/`、`lib/` 核心模块。

---

## 结论

Phase 3M 完成。TPQR-001 / TPQR-003 / TPQR-004 三条 family 的 disabled-by-default internal seam prototype 实现通过；flags 默认 false、capability check 前置、productionIntegrationAllowed=false 均得到执行验证。Phase 3H TPQR-004 dedup bug 已修复，回归测试覆盖。Seam prototype 姿态为 **Conditional-Go**，runtime adoption 维持 **No-Go**，多层 blocker 未解除。下一步唯一允许工作为 Phase 3N internal prototype review 或真实数据校准证据包，不允许 production adoption。
