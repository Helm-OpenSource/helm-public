---
status: planning / pending-owner-decisions
owner: helm-core
created: 2026-09-16
review_after: 2026-10-16
public_safety: Public-safe implementation plan for a production path to the
  CAIO G0 initialization gate built from live tenant self-observation (quick-check
  runs and a tenant live shadow context snapshot). No customer data, private
  endpoint, credential, production receipt, activation, or production-readiness
  claim.
---

# CAIO P0-3b G0 实时生产路径 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans（本仓默认内联执行）. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让真实租户用实时快检观察与 tenant live shadow 快照生成 G0 所需的四类初始化产物并登记初始化回执，经 `recordCaioInitializationAssessment` 得到 `ready_for_owner_acceptance`、由 CEO 受理；受理后在来源持续健康时不因每 10 分钟的快检运行而失效。

**Architecture:** 两处改动。① G0 评估器 v2：来源基础只记录最新运行的健康分类，不记录运行 id 与该运行的证据引用。② `lib/caio-operating-context/g0-preparation.service.ts` + 受控命令行：按资产取最近一次成功的快检运行，生成证据追踪、schema 映射、公司记忆事实与重建回执、基于实时观察的时间上下文产物，并以 OWNER 身份登记初始化回执。评估与受理仍走既有 `/caio/operator` 动作。

**Tech Stack:** TypeScript、Prisma/MySQL 8、vitest、既有 stage1-owner-loop G0 服务、P0-2b 构建器。

**Spec:** Core 规格 `docs/superpowers/specs/2026-09-15-caio-live-operating-core-spec.md` §5、§5.1、§8、§11；owner 2026-09-16 裁定"G0 用实时快照"。

## 核对结论（2026-09-16）

1. **G0 没有生产写入路径。** 四类初始化产物（时间上下文、schema 映射、证据追踪、记忆重建回执）只有测试夹具 `caio-operating-question.mysql-test-fixtures.ts` 写入；公司记忆事实也只由夹具直接建。
2. **快检会让已受理的 G0 每 10 分钟失效。** 评估基础 `sources[].latestRunRef` 取每个来源的最新运行（`caio-initialization-assessment-projector.ts:627`），来源例外的 `evidenceRefs` 也拼入最新运行证据（:617）；快检每轮新建运行，`basisHash` 随之变化，`getCaioInitializationGateStatus` 判 `stale`。
3. **时间上下文可以用 tenant live shadow 快照。** G0 只要求产物可重放（`validateCaioTemporalContextArtifact`），不假设公开来源类；但快检投影要求至少 1 条命中，健康租户多数轮次为 `NO_SIGNALS`，不能依赖某轮 `PROJECTED` 行。本计划为 G0 单独构建"基线快照"：每个已知模板读数生成一条 `caio.observation_baseline` 信号（见决定 D-3）。
4. **证据追踪可由快检运行直接生成。** 追踪要求所绑运行在初始化回执的 `observationRunRefs` 中、运行 `succeeded`、运行 `evidenceRefs` 含追踪的 `evidenceRef`、`windowStart ≤ capturedAt ≤ observedAt`；快检运行的 `evidenceRefs` 就是 `caio-metric:*`，`capturedAt` 取观察 `observedAt`，全部满足。抽样上限 50 条，覆盖来源、敏感度与输出类型。
5. 初始化回执的 `resultingVersion` 必须等于资产当前版本；任何后续目录变更都会让 G0 失效（既有行为，保留）。

## 需要 owner 决定（执行前确认）

- **D-1 G0 评估器 v2 基础口径（推荐：同意）。** `sources[]` 去掉 `latestRunRef`，来源例外不再并入最新运行 `evidenceRefs`；保留 `latestRunStatus`、`latestRunOutcome`、`freshness`。效果：来源持续健康时受理不失效；失败、过期、授权到期、目录变更、记忆变更仍立即失效。评估器修订号 `v1 → v2`，既有 v1 评估记录按"评估器已变更"判失效需重评（一次性）。
- **D-2 公司记忆事实的来源（推荐：目录元数据生成的系统事实）。** G0 要求每个已初始化资产绑定公司记忆并可重建。拟由准备服务按资产写 1 条 `MemoryFact`（公司级、系统推断），内容只来自数据资产目录与模板注册元数据（域、用途、模板编号、指标键、负责人角色、新鲜度 SLA），不含任何客户记录；随后写记忆重建回执。备选：由 OWNER 在 `/caio/operator` 手工确认后写入（更慢，但事实"经人确认"）。
- **D-3 G0 基线快照的信号口径（推荐：同意）。** 为 G0 构建的快照使用 `signalFamily=caio.observation_baseline`，每个已知模板读数一条信号（对象为 `domain:<域>`），与快检异常信号分开；不写入 `CaioOperatingContextSnapshot` 表，直接包装为 G0 时间上下文产物。

## Global Constraints

- 只写：`ArtifactBundle`（四种 G0 类型，状态 `CONFIRMED`）、`MemoryFact`（D-2 口径）、`DataAssetStageReceipt`（经既有 `recordDataAssetInitializationReceipt`）、`CaioInitialization*`（经既有评估/受理服务）、审计。不写业务表。
- 准备命令默认只校验，`--apply` 才写；治理记录不经 server action。
- 产物内容与引用不含 workspace 以外的客户原始值；证据追踪只引用 `caio-metric:*` 与运行 id。
- 评估器 v2 不改 `CAIO_INITIALIZATION_POLICY` 数值；`policyHash` 不变。
- 公开镜像扫描拦截形似号码的字面量：测试中此类值运行时拼接。

## 文件结构

| 文件 | 职责 |
|---|---|
| `lib/stage1-owner-loop/caio-initialization-gate.ts`、`caio-initialization-assessment-projector.ts` | 评估器 v2 基础口径 |
| `lib/caio-operating-context/context-builder.ts` | 新增 `buildCaioG0BaselineProjectionInput` |
| `lib/caio-operating-context/g0-artifacts.ts` | 纯函数：四类产物内容与哈希 |
| `lib/caio-operating-context/g0-preparation.service.ts` | 读取资产/来源/最近成功运行，生成并写入产物、记忆事实、初始化回执 |
| `scripts/caio-g0-prepare.ts` | 受控命令行（`npm run caio:g0-prepare`） |
| `docs/superpowers/specs/2026-09-15-caio-live-operating-core-spec.md` | §8 补充 G0 实时生产路径 |

---

### Task 1: G0 评估器 v2（D-1）

**Files:** Modify `lib/stage1-owner-loop/caio-initialization-gate.ts`（`CAIO_INITIALIZATION_EVALUATOR_REVISION`、`CaioInitializationAssessmentInput["sources"]` 类型、`normalize` 中 `latestRunRef`）、`lib/stage1-owner-loop/caio-initialization-assessment-projector.ts:600-640`；Test：`caio-initialization-gate.test.ts`、`caio-initialization-gate-store.mysql.test.ts`

- [ ] **Step 1: 写失败测试（纯函数）**：同一资产与来源，只替换最新运行 id 与其证据引用、状态仍 `succeeded/success/fresh` → 两次 `basisHash` 相同；最新运行改为 `failed` → `basisHash` 变化且决策 `not_ready`；来源过期 → 变化。
- [ ] **Step 2: 写失败测试（MySQL）**：在既有受理用例后再为同一来源 begin/complete 一次成功运行 → `getCaioInitializationGateStatus` 仍为 `accepted`；随后写一次失败运行 → `stale`，原因含 `assessment_basis_changed`。
- [ ] **Step 3–4:** 失败 → 实现（修订号 `...v2`；已存 v1 评估回放时判 `stored_assessment_evaluator_revision_changed` 并要求重评）→ 通过；`npm run check:stage1-owner-loop`、`npm run check:caio-pro-v1`、`test:caio-stage1:mysql` 通过。
- [ ] **Step 5:** 检查 CAIO Pro FDE 跨仓合同与 helm-packs 是否钉住初始化评估器修订号（`git grep` 两仓）；若钉住，同步改钉并在 PR 中注明跨仓顺序。
- [ ] **Step 6: 提交** `feat(stage1): G0 评估器 v2——来源基础只记健康分类，不随运行轮换失效`

### Task 2: G0 基线投影输入（D-3）

**Files:** Modify `lib/caio-operating-context/context-builder.ts`；Test `context-builder.test.ts`

**Interfaces:** `buildCaioG0BaselineProjectionInput(input: { workspaceId: string; asOf: Date; windowStart: Date; observations: readonly (CaioContextObservationRow & { domain: string })[]; runs: readonly CaioContextRunRow[] }): CaioContextBuildResult`

- 每个观察一条信号：`signalFamily="caio.observation_baseline"`、`signalKey="baseline:"+templateId`、对象 `domain:<domain>`；证据与回执映射复用快检构建逻辑（抽出共享私有函数，不改快检输出——快检构建器单测与 P0-2b 回归哈希必须不变）。
- [ ] Step 1 失败测试：两域三模板 → 3 信号、2 对象，投影通过并可重放；快检构建器对同一输入的结果 `canonicalJson` 与改动前一致（先把改动前的输出哈希写死为字面量）。
- [ ] Step 2–4 → Step 5 提交 `feat(caio): G0 基线快照投影输入`

### Task 3: 四类产物内容（纯函数）

**Files:** Create `lib/caio-operating-context/g0-artifacts.ts`；Test `g0-artifacts.test.ts`

**Interfaces:**

```ts
export function buildCaioG0TemporalContextArtifact(input: { artifactId: string; workspaceId: string; projectionInput: TemporalOperatingContextProjectionInput }): { ok: true; artifact: CaioTemporalContextArtifact } | { ok: false; errors: string[] };
export function buildCaioG0SchemaMappingArtifact(input: { artifactId: string; assetId: string; templates: readonly { templateId: string; valueKeys: readonly string[] }[]; generatedAt: Date }): CaioSchemaMappingArtifact;
export function buildCaioG0EvidenceTraceArtifacts(input: { assetId: string; sourceId: string; runId: string; authorizationReceiptRef: string; connectionReceiptRef: string; initializationReceiptRef: string; sensitivity: ObservationSensitivity; observations: readonly { evidenceRef: string; observedAt: Date }[]; limit: number }): CaioEvidenceTraceArtifact[];
export function buildCaioG0MemoryRebuildReceiptArtifact(input: { artifactId: string; workspaceId: string; bindings: readonly CaioInitializationMemoryBinding[]; rebuiltAt: Date }): CaioMemoryRebuildReceiptArtifact;
```

- schema 映射：`sourceSchemaHash = sha256(canonicalJson(templateIds 排序))`、`targetSchemaHash = sha256(canonicalJson(每模板 valueKeys 排序))`、`mappingHash = sha256(canonicalJson({templateId: valueKeys}))`。
- 证据追踪：`outputType="supervision_signal"`、`evidenceKind="metric_observation"`、`resolved=true`，`traceHash` 与内容哈希按 `caio-initialization-artifacts.ts` 规则。
- [ ] Step 1 失败测试：每个产物通过对应 `validateCaio*Artifact`；时间上下文产物的 `projectionInputHash/snapshotHash/replayRootHash` 绑定正确，篡改输入后校验失败；追踪条数不超过 `limit`。
- [ ] Step 2–4 → Step 5 提交 `feat(caio): G0 初始化产物内容构建`

### Task 4: 准备服务与命令行（D-2）

**Files:** Create `lib/caio-operating-context/g0-preparation.service.ts`、`scripts/caio-g0-prepare.ts`；Modify `package.json`、`scripts/public-release-guard.ts`（脚本白名单）；Test `g0-preparation.service.test.ts`、`g0-preparation.mysql.test.ts`

**Interfaces:** `prepareCaioG0FromLiveObservation(input: { workspaceId: string; actorUserId: string; actorName: string; apply: boolean; now?: Date }): Promise<{ ok: true; summary: { assets: number; traces: number; memoryFacts: number; temporalContextRef: string | null; initializationReceipts: number; validated: boolean } } | { ok: false; code: "not_owner" | "no_connected_assets" | "no_successful_run" | "context_build_rejected" | "catalog_conflict" | "unavailable"; assetRefs?: string[] }>`

流程：
1. OWNER 预检（有效成员且角色 OWNER）。
2. 取所有 `CONNECTED` 且已授权、绑定观察来源的资产；每个来源取最近一次 `SUCCEEDED` 且 `evidenceRefs` 非空的快检运行（执行键前缀 `caio-quick-check:`）；任一资产没有 → `no_successful_run`（列出资产引用）。
3. 读这些运行的 `CaioMetricObservation(status=ok)`；构建基线投影输入并投影；失败 → `context_build_rejected`。
4. 预先生成每个资产的初始化回执 `receiptId`（该服务作为 `recordDataAssetInitializationReceipt` 的调用方输入），证据追踪先引用它。生成：每资产 schema 映射 1 个（模板元数据来自 Core 注册表中 `sourceKey` 匹配的模板，`valueKeys` 取该运行观察的键）、证据追踪（每运行最多 `ceil(50 / 资产数)` 条，总数不超过 50）、每资产 1 条记忆事实（D-2 内容）、记忆重建回执 1 个、时间上下文 1 个。
5. `apply=false`：返回计数与 `validated=true`，不写。`apply=true`：单事务写全部 `ArtifactBundle`（`CONFIRMED`）与 `MemoryFact`，事务外逐资产调用 `recordDataAssetInitializationReceipt`（`observationRunRefs=[该运行]`、`schemaMappingRefs`、`companyMemoryRefs=["memory-fact:<id>"]`、`temporalContextSnapshotRef="artifact-bundle:<id>"`），版本冲突 → `catalog_conflict`。
6. 命令行：`--workspace-id --actor-user-id [--apply]`，输出一行 JSON。

- [ ] Step 1 失败单测（mock）：非 OWNER 拒绝且无读取；缺成功运行时列出资产；`apply=false` 不调用任何写；追踪总数 ≤ 50。
- [ ] Step 2 MySQL 端到端：沿用 P0-2a 快检种子（两个来源、两个资产）跑两轮快检 → `prepare --apply` → `recordCaioInitializationAssessment` 得 `ready_for_owner_acceptance`（若为 `not_ready`，断言失败码清单为空以便定位）→ `acceptCaioInitializationGate` → 再跑一轮快检 → 状态仍 `accepted`（依赖 Task 1）→ 撤销观察程序后再跑一轮 → `stale`。
- [ ] Step 3–4 → 变异反证：追踪绑定到非回执中的运行，确认评估得 `evidence_traceability_failed`。
- [ ] Step 5 提交 `feat(caio): 由实时快检观察准备 G0 初始化产物（受控命令行）`

### Task 5: 文档、门禁与 PR

- [ ] 规格 §8 补"G0 实时生产路径"；STATUS 行补一句（默认不自动运行，需 OWNER 执行命令行）。
- [ ] 运行 `typecheck`、`lint`、`test`、`check:boundaries`、`check:stage1-owner-loop`、`check:caio-pro-v1`、`test:caio-stage1:mysql`、`test:caio-operating-context:mysql`、新 MySQL 测试。
- [ ] 开 PR，写明评估器 v2 的一次性重评影响、跨仓钉扎核对结果、新写入表清单。

## Self-Review

- owner 裁定"G0 用实时快照"：Task 2（基线快照）+ Task 3（时间上下文产物）+ Task 4（准备与登记）。
- 核对结论 2 的失效问题：Task 1 + Task 4 Step 2 的"再跑一轮仍 accepted"。
- G0 失败码覆盖：`initialized_asset_missing_*` 由 Task 4 回执字段覆盖；`evidence_*_coverage_incomplete` 由追踪覆盖全部来源与敏感度（每运行至少 1 条）；`company_memory_not_rebuildable` 由 D-2；`temporal_context_not_rebuildable` 由 Task 3。
- 类型一致：`buildCaioG0BaselineProjectionInput`、`buildCaioG0*Artifact`、`prepareCaioG0FromLiveObservation` 在定义与消费任务中一致。
