---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3J Disabled Runtime Source Module Plan V1

更新时间：2026-04-26
状态：Phase 3J complete / Runtime adoption No-Go / Internal disabled module plan Conditional-Go

---

## 结论

**Phase 3J 完成。**

Runtime adoption 继续 No-Go（继承自 Phase 3I）。

面向 TPQR-001、TPQR-003、TPQR-004 三条 family 的内部 disabled-by-default runtime source module plan 被条件批准（Conditional-Go）。

**这是计划（plan），不是实现（implementation）。** 任何 prototype 实现或生产集成均不被批准。

---

## 一、Phase 3J 是什么

Phase 3J 是 Phase 3I 条件批准的唯一后续工作：为 TPQR-001、TPQR-003、TPQR-004 编写一个 disabled-by-default 内部 runtime source module plan artifact。

**Phase 3J 完成了以下工作：**

- 为三条 family 各自定义了内部模块计划（`TPQR001_FAMILY_PLAN`、`TPQR003_FAMILY_PLAN`、`TPQR004_FAMILY_PLAN`），包含：
  - 计划中的 source function 名称、feature flag 名称、DB model、where-shape（文本描述，不是可执行 query）
  - 工作区 scope 要求、capability scope 要求、threshold 状态、blockers
  - `defaultEnabled=false`、`productionIntegrationAllowed=false`、必须的 audit bundle 字段
- 交付具名 evaluator artifact（12 项 checks 全部通过）
- 交付 vitest 测试套件（source file purity 检查 + evaluator 检查全部通过）
- 交付 CLI 脚本（12/12 checks PASS，退出码 0）

**Phase 3J 不是、也没有做：**

- 不是 runtime adapter 实现，不是 DB reader，不是 production query
- 不是 API route，不是 UI 变更，不是 schema 变更
- 不修改 `data/queries.ts`、`features/mobile/lib/mobile-command-read-model.ts`、`app/`、`app/api/`、`prisma/schema.prisma`
- 不做 official write，不做 automated execution，不做 LLM final ranking
- 不做 TPQR-002 / TPQR-005

---

## 二、明确禁止的文件

以下文件/路径在 Phase 3J 中严禁修改：

| 路径 | 原因 |
|------|------|
| `data/queries.ts` | 生产查询聚合层 — 禁止修改 |
| `features/mobile/lib/mobile-command-read-model.ts` | 移动端读模型 — 禁止修改 |
| `app/` | 所有 Next.js 路由 — 禁止修改 |
| `app/api/` | 所有 API 路由 — 禁止修改 |
| `prisma/schema.prisma` | DB schema — 禁止修改 |
| `<official write paths>` | 任何官方写入路径 — 禁止 |
| `<automated execution paths>` | 任何自动执行路径 — 禁止 |
| `<API routes>` | 任何 API 路由 — 禁止 |
| `<UI routes>` | 任何 UI 路由 — 禁止 |
| `<DB migrations>` | 任何 DB 迁移 — 禁止 |

---

## 三、三条 family 的计划内容

### TPQR-001：blocked_decision（ActionItem 阻塞决策）

**计划中的 source function：** `sourceBlockedDecisionCandidates`
**计划中的内部模块名：** `InternalBlockedDecisionSourceModule`（仅内部，非生产）
**Feature flag：** `HELM_INTERNAL_TPQR001_SOURCE_MODULE_ENABLED`（defaultEnabled=false）
**DB model：** `ActionItem`

**计划的 where-shape（文本描述，非可执行 query）：**
```
ActionItem WHERE workspaceId = :workspaceId
  AND approvalTask IS NULL
  AND updatedAt < (:referenceClockMs - :thresholdMs)
```

**Blockers（必须在任何 prototype 前解决）：**
1. 48h staleness threshold 是 `calibration_placeholder` — 需用真实业务数据校准或替换为经验证的保守默认值
2. 无 function-to-DB seam — Phase 3H function 接受 row arrays，不是 db.actionItem.findMany queries；seam 需在 Phase 3K 中设计并复核
3. 无 test-seam 层 — function 从未对真实 DB rows 测试；test seam 必须先于 runtime 激活
4. 无 permission/capability 集成复核 — capability scope 必须明确定义并复核
5. productionIntegrationAllowed=false — 计划阶段，不得集成到 data/queries.ts 或任何生产读模型

---

### TPQR-003：overdue_commitment（Commitment 逾期承诺）

**计划中的 source function：** `sourceOverdueCommitmentCandidates`
**计划中的内部模块名：** `InternalOverdueCommitmentSourceModule`（仅内部，非生产）
**Feature flag：** `HELM_INTERNAL_TPQR003_SOURCE_MODULE_ENABLED`（defaultEnabled=false）
**DB model：** `Commitment`

**计划的 where-shape（文本描述，非可执行 query）：**
```
Commitment WHERE workspaceId = :workspaceId
  AND dueDate IS NOT NULL
  AND dueDate < :referenceClockMs
  AND status NOT IN ('FULFILLED', 'CANCELED')
```
referenceClockMs 必须由调用方显式注入 — 任何点均不允许 Date.now()。
overdueFlag 列不作为 inclusion authority。

**Blockers（必须在任何 prototype 前解决）：**
1. thresholdStatus=binary_predicate_unresolved — 二元 dueDate < referenceClockMs 谓词定义明确，但 audit 惯例（calibration_placeholder）未在 runtime 前解决
2. 无 function-to-DB seam — Phase 3H function 接受 row arrays；seam 需在 Phase 3K 中设计并复核
3. 无 test-seam 层 — function 从未对真实 DB rows 测试
4. 必须在 adapter 层强制 explicit referenceClockMs 注入 — 任何点不允许 Date.now()
5. productionIntegrationAllowed=false — 计划阶段

---

### TPQR-004：customer_waiting（EmailThread 客户等待）

**计划中的 source function：** `sourceCustomerWaitingCandidates`
**计划中的内部模块名：** `InternalCustomerWaitingSourceModule`（仅内部，非生产）
**Feature flag：** `HELM_INTERNAL_TPQR004_SOURCE_MODULE_ENABLED`（defaultEnabled=false）
**DB model：** `EmailThread`

**计划的 where-shape（文本描述，非可执行 query）：**
```
CRM-linked producer:
  EmailThread WHERE workspaceId = :workspaceId
    AND status = 'WAITING_US'
    AND opportunityId IS NOT NULL

Generic producer:
  EmailThread WHERE workspaceId = :workspaceId
    AND status = 'WAITING_US'

After-producer dedup: by emailThreadId — CRM-linked wins
```

**Blockers（必须在任何 prototype 前解决）：**
1. thresholdStatus=binary_predicate_unresolved — 二元 status=WAITING_US 谓词定义明确，但 audit 惯例未解决
2. 无 function-to-DB seam — 双 producer（CRM-linked + generic）adapter 层需在 Phase 3K 中设计并复核
3. 无 test-seam 层 — function 从未对真实 DB rows 测试；CRM-linked producer query 从未对真实 DB 验证
4. after-producer dedup（CRM-linked wins）必须在 adapter 层强制执行 — dedup 逻辑需在真实 rows 上证明
5. productionIntegrationAllowed=false — 计划阶段

---

## 四、为什么这仍然不是实现

| 维度 | 当前状态 |
|------|---------|
| where-shape | 文本描述，非可执行 query |
| function-to-DB seam | 三条 family 均无；Phase 3H function 接受 row arrays |
| threshold 校准 | 三条 family 均未校准（TPQR-001 是 calibration_placeholder，TPQR-003/004 是 binary_predicate_unresolved） |
| test-seam 层 | 三条 family 均无；从未对真实 DB rows 测试 |
| capability 集成复核 | 未完成 |
| 生产集成 | productionIntegrationAllowed=false；forbidden files 未触碰 |
| feature flag | defaultEnabled=false；无 runtime 激活路径 |

这个 plan 编码的是**结构设计意图**，不是可部署的代码路径。任何 prototype 实现都需要通过 Phase 3K 复核，并独立满足以下条件后才能考虑 runtime 激活。

---

## 五、进入任何 runtime 实现前必须证明的条件

1. **Threshold 校准**：TPQR-001 48h staleness threshold 需用真实业务数据校准或替换为经验证的保守默认值。TPQR-003/TPQR-004 的 audit 惯例需明确解决。
2. **Function-to-DB seam 设计与复核**：三条 family 各自的 function-to-DB adapter 需在 Phase 3K 中明确设计，并独立复核其 workspace scope 边界、read-only 约束、capability 检查。
3. **Test-seam 层**：三条 family 的 Phase 3H source function 必须被设计为可对真实 DB rows 测试，且测试套件需覆盖真实数据路径。
4. **Permission/Capability 集成复核**：三条 family 的 capability scope 定义需在 Phase 3K 中明确，并经独立复核。
5. **Phase 3K review**：无论是 seam prototype review 还是 threshold calibration fixture pack，都必须经过 Phase 3K 独立复核，且结论为 Conditional-Go 后才能考虑任何 prototype 实现。

---

## 六、下一步允许的工作

```
Phase 3K: author a disabled-by-default internal seam prototype review
OR a threshold calibration fixture pack for TPQR-001/003/004.
Must not allow production adoption.
Must not write to data/queries.ts, features/mobile/lib/mobile-command-read-model.ts,
app/, app/api/, prisma/schema.prisma, any official write path, or any automated execution path.
Each family seam prototype must remain behind its explicit feature flag with
defaultEnabled=false and productionIntegrationAllowed=false.
Threshold calibration fixture pack must provide validated conservative defaults
before any runtime promotion.
```

---

## 七、工作状态表

| 层 | 状态 |
|----|------|
| Phase 3I runtime source review (schema seam 证明) | 已完成 |
| Phase 3J disabled-by-default module plan (plan artifact) | 已完成 |
| Function-to-DB seam 设计 | 计划已塑形，需 Phase 3K 下一层 |
| Threshold 校准 | 计划已标注，需 Phase 3K 校准 fixture pack |
| Test-seam 层 | 计划已标注，需 Phase 3K prototype review |
| Capability 集成复核 | 计划已标注，需 Phase 3K |
| Runtime DB query 实现 | 刻意不做（No-Go） |
| Production read-model 集成 | 刻意不做（No-Go） |
| data/queries.ts / app/ 修改 | 刻意不做（forbidden） |

---

## 八、Evaluator 结果

- Rule version: `phase3j-disabled-runtime-source-plan/v1`
- Checks: 12/12 PASS
- Runtime adoption posture: **No-Go**
- Module plan posture: **Conditional-Go**
- Vitest tests: all pass
- CLI script: exits 0
