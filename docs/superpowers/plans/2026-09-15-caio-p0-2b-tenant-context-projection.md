# CAIO P0-2b 租户自观察 P3a 快照投影 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans（本仓默认内联执行）. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按规格 §5.1（owner 2026-09-15 批准）扩展 P3a 合同，使 P0-2a 快检的已知指标观察与候选异常能投影为可重放、带内容哈希的 `TemporalOperatingContextSnapshot`，并在 `/caio` 显示最近一次投影状态；既有公开离线合同的行为与哈希不变。

**Architecture:** 在来源治理层新增 `tenant_self_observation` 来源类；在 harness 层新增并列的 `tenant_live_shadow` manifest（不改 `harnessManifestSchema`）；在投影器的来源绑定处按来源类分派到新的"观察回执门"，其余分支原样。`lib/caio-operating-context/` 增加纯函数构建器（快检行 → canonical 记录 + 来源绑定）与投影服务（开关默认关闭，失败不影响快检本身），快照与投影输入存新表以便重放。

**Tech Stack:** TypeScript、zod、Prisma/MySQL 8、vitest、既有 P3a eval 脚本。

**Spec:** `docs/superpowers/specs/2026-09-15-caio-live-operating-core-spec.md` §5、§5.1；前置实现 P0-2a（helm-public #389）。

## 核对结论（2026-09-15）

1. **合同强制 `EvidenceRef.contentHash` 等于记录自身内容哈希**（`validators.ts` `validateEvidenceRef`），不能放指标正文哈希。指标观察的内容哈希（覆盖模板、窗口、数值）改放 `sourceSnapshotHash`。规格 §5.1 第 4 条据此修正措辞（Task 9）。
2. **隐私守卫对 sha256 值误报。** `collectUnsafeInputErrors` 对所有字符串跑号码正则；哈希恰以 `1[3-9]` 加 9 位数字结尾时被判为手机号（实测 20000 个哈希命中 4 个；测试样例以运行时拼接构造，避免源码出现形似号码的字面量）。一份快照含上百个哈希，每天 144 轮会反复被拒。Task 1 做窄修复：**完整匹配 `^sha256:[a-f0-9]{64}$` 的值**跳过号码/地址正则，禁用键检查不变。该守卫属于受保护的来源治理组件，**此项需 owner 在计划评审时确认**。
3. 我方生成的引用一律用"十六进制→字母"编码的哈希片段，避免出现数字串；overlay 的 `detectorId`/`mergeKey`/`objectKey` 若触发守卫，整轮投影以闭集原因拒绝，不做部分采纳。
4. `signalFamily`、`objectKind`、`sourceType` 走 `SAFE_TOKEN_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/i`：必须字母开头、不含 `:`。P0-2a 的 `CAIO_REF_PATTERN` 允许数字开头和冒号，构建器需映射（Task 5）。
5. 投影输入要求 `signalEvents`、`evidenceRefs`、`businessObjectAliases` 各至少 1 条：**本轮无命中则不投影**，记 `no_signals`。上限 1000 信号 / 1000 证据 / 100 对象；超限整轮拒绝，记 `context_limit_exceeded`。
6. `computeOperatingContextSourceBindingHash` 对整个绑定对象做 canonicalJson：新字段只能在租户类绑定上**出现**，公开类绑定上必须**不存在该键**（不能是 `undefined`），既有快照哈希才不变。Task 4 用既有 fixture 快照哈希做回归冻结。
7. `validateCaioTemporalContextArtifact`（G0 初始化产物）只校验可重放，扩展后租户快照也能通过。本计划**不写** G0 产物；是否用实时快照做 G0 输入由 P0-3/G0 另行决定。
8. `harnessManifestSchema` 被 evolution、shadow receipt、p3-readiness 复用；保持原样，只在投影器接受两种 manifest，避免租户 manifest 进入评测与晋升链路。

## Global Constraints

- 既有 `synthetic_public / self_dogfood_health / deidentified_promoted_case / fleet_customer_health / oss_governance` 的校验结果与 `public_offline_shadow` manifest 行为逐字节不变；`npm run eval:operating-harness-p2`、`eval:operating-harness-p3a-context`、`eval:operating-harness-p3-readiness` 结果不变。
- `tenant_self_observation`：允许用途只有 `operator_triage`、`advice_only_risk_review`；`improvementLoopEligible=false`；`promotionState="blocked"`；`aliasMode="none"`；`personAttributionMode="none"`；`validateOperatingSignalImprovementGate` 对其 fail closed。
- 快照仍为派生只读：`derivedOnly=true`、`writebackAllowed=false`、`actionAuthority="none"`、`modelCallsUsed=false`。
- 新开关 `HELM_CAIO_CONTEXT_PROJECTION_ENABLED`，只接受精确 `true`，默认关闭；投影失败不改变快检 tick 的状态与结果。
- 只写新表 `CaioOperatingContextSnapshot`；不写 G0 产物、业务表或 ArtifactBundle。
- 不含客户信息；不新增 server action；不依赖 `lib/caio-governance`。

## 文件结构

| 文件 | 职责 |
|---|---|
| `lib/operating-signal-governance/source-governance.ts` | sha256 值豁免号码正则；新增来源类与其信封规则 |
| `lib/operating-harness/tenant-live-contracts.ts` | `TenantLiveHarnessManifest` 类型、常量、`TenantObservationReceipt` 类型与哈希 |
| `lib/operating-harness/tenant-live-validators.ts` | `validateTenantLiveHarnessManifest`、`validateTenantSelfObservationBinding` |
| `lib/operating-harness/context-contracts.ts`、`context-projector.ts` | 输入类型与校验按 manifest scope / 来源类分派 |
| `lib/caio-operating-context/context-harness.ts` | Core 固定的快检 harness manifest 与 seed revision |
| `lib/caio-operating-context/context-builder.ts` | 纯函数：快检行 → 投影输入 |
| `lib/caio-operating-context/context-projection.service.ts` | 读 tick 行、构建、投影、落库；开关 |
| `lib/caio-operating-context/readout.ts`、`features/caio/operating-attention-section.tsx` | 显示最近投影状态 |
| `prisma/migrations/20260916120000_caio_operating_context_snapshot/migration.sql` | 快照表 |
| `docs/product/HELM_ENTERPRISE_OPERATING_CONTEXT_MODEL.md`、`HELM_OPERATING_HARNESS_REQUIREMENTS.md` | 公开合同文档修订 |

---

### Task 1: 隐私守卫对 sha256 值的误报修复（需 owner 确认）

**Files:**
- Modify: `lib/operating-signal-governance/source-governance.ts`（`collectUnsafeInputErrors` 内 `typeof node === "string"` 分支）
- Test: `lib/operating-signal-governance/source-governance.test.ts`（追加）

- [ ] **Step 1: 写失败测试**

```ts
describe("collectUnsafeInputErrors on content digests", () => {
  // Assembled at runtime so the source file carries no mobile-number-shaped literal (public release guard).
  const mobileShapedTail = ["186", "9553", "2476"].join("");
  const trippingDigest = `sha256:dab2e78c8b5b1d04c09908172faba7f5433f4ab79c95bc73dca3d${mobileShapedTail}`;
  const mobileShaped = ["138", "1234", "5678"].join("");

  it("does not treat a complete sha256 digest as a phone number", () => {
    expect(collectUnsafeInputErrors({ contentHash: trippingDigest })).toEqual([]);
  });

  it("still flags a phone number inside any other string, including near-digest strings", () => {
    expect(collectUnsafeInputErrors({ note: `call ${mobileShaped}` })).toEqual(["private_or_contact_pattern_present"]);
    expect(collectUnsafeInputErrors({ ref: `${trippingDigest} ` })).toEqual(["private_or_contact_pattern_present"]);
    expect(collectUnsafeInputErrors({ ref: trippingDigest.replace("sha256:", "sha1:") })).toEqual(["private_or_contact_pattern_present"]);
    expect(collectUnsafeInputErrors({ ref: trippingDigest.toUpperCase() })).toEqual(["private_or_contact_pattern_present"]);
  });

  it("keeps forbidden-key detection for digests", () => {
    expect(collectUnsafeInputErrors({ phone: trippingDigest })).toEqual(["forbidden_key_present:phone"]);
  });
});
```

- [ ] **Step 2:** `npx vitest run lib/operating-signal-governance/source-governance.test.ts` → 第一个用例 FAIL。
- [ ] **Step 3: 实现**

```ts
// A complete lowercase sha256 digest is a content binding, not contact data; its hex tail can
// otherwise match the mobile-number pattern (about 1 in 5000 digests).
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
```

在 `visit` 的字符串分支首行加 `if (SHA256_DIGEST_PATTERN.test(node)) return;`。

- [ ] **Step 4:** 测试通过；`npm run eval:operating-harness-p2`、`npm run eval:operating-harness-p3a-context` 通过且输出与修改前一致（先在修改前各跑一次保存输出，`diff` 比对）。
- [ ] **Step 5: 提交** `fix(operating-signal-governance): sha256 摘要不再被号码正则误判`

---

### Task 2: `tenant_self_observation` 来源类

**Files:**
- Modify: `lib/operating-signal-governance/source-governance.ts`
- Test: `lib/operating-signal-governance/tenant-self-observation.test.ts`

**Interfaces:**
- Produces: `OPERATING_SIGNAL_SOURCE_CLASSES` 增加 `"tenant_self_observation"`；`TENANT_SELF_OBSERVATION_ALLOWED_USES = ["operator_triage","advice_only_risk_review"] as const`；`buildTenantSelfObservationEnvelope(input: { signalId: string; allowedUses: readonly ("operator_triage"|"advice_only_risk_review")[]; auditRefs: string[]; boundaryNote: string }): OperatingSignalSourceEnvelope`

- [ ] **Step 1: 写失败测试**：
  - `buildTenantSelfObservationEnvelope(...)` 通过 `validateOperatingSignalSourceEnvelope`；
  - 逐项翻转后被拒且错误码为：`allowedUses` 含 `public_eval` → `tenant_self_observation_invalid_allowed_use:public_eval`；`improvementLoopEligible=true` → `tenant_self_observation_never_improvement_eligible`；`promotionState!=="blocked"` → `tenant_self_observation_requires_blocked_state`；`aliasMode!=="none"` → `tenant_self_observation_requires_no_alias`；`personAttributionMode!=="none"` → `tenant_self_observation_cannot_carry_person_attribution`；
  - `validateOperatingSignalImprovementGate({ source, promotion: null })` 含 `source_class_forbidden_from_improvement_loop:tenant_self_observation`；
  - 五个既有来源类的既有测试文件全部仍通过（不改既有用例）。
- [ ] **Step 2:** 运行确认失败。
- [ ] **Step 3: 实现**：常量表加类；`SOURCE_CLASS_ALLOWED_USES.tenant_self_observation = new Set(TENANT_SELF_OBSERVATION_ALLOWED_USES)`；在 `validateOperatingSignalSourceEnvelope` 末尾追加独立的 `if (source.sourceClass === "tenant_self_observation") { ... }` 规则块；改进门的 fail-closed 条件由 `fleet_customer_health || oss_governance` 扩为三者（同一返回语句，既有两类行为不变）。`buildTenantSelfObservationEnvelope` 固定 `forbiddenUses` 为全部 `HIGH_RISK_USES` 加 `IMPROVEMENT_USES` 加 `tenant_ingestion`（排序后去重）。
- [ ] **Step 4:** `npx tsc --noEmit -p tsconfig.public.json`；若 `evolution-*`、`p3-readiness.ts` 有按来源类穷举的 `Record`，为新类显式给出 fail-closed 值（不允许进入 evolution / readiness），并在对应测试补一条拒绝用例。
- [ ] **Step 5: 提交** `feat(operating-signal-governance): 租户自观察来源类（仅分诊与建议，永不进改进环）`

---

### Task 3: 租户实时 manifest 与观察回执门

**Files:**
- Create: `lib/operating-harness/tenant-live-contracts.ts`、`lib/operating-harness/tenant-live-validators.ts`
- Test: `lib/operating-harness/tenant-live.test.ts`

**Interfaces:**
- Produces:

```ts
export const TENANT_LIVE_HARNESS_SCOPE = "tenant_live_shadow" as const;
export const TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION = "helm.operating-harness.tenant-observation-receipt.v1" as const;

export type TenantLiveHarnessManifest = Omit<HarnessManifest, "scope" | "allowedSourceClasses" | "intendedUses"> & {
  scope: typeof TENANT_LIVE_HARNESS_SCOPE;
  allowedSourceClasses: ["tenant_self_observation"];
  intendedUses: Array<(typeof TENANT_SELF_OBSERVATION_ALLOWED_USES)[number]>;
};

export type TenantObservationReceipt = {
  schemaVersion: typeof TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION;
  observationRunRef: string;       // "observation-run:<letters>"
  runStatus: "SUCCEEDED" | "PARTIAL";
  windowStart: string;
  windowEnd: string;
  observedAt: string;
  summaryHash: string;             // sha256
  catalogEntryRef: string;
  authorizationReceiptRef: string;
  connectionReceiptRef: string;
  evidenceRefs: string[];          // canonical EvidenceRef ids this run supports
  contentHash: string;
};

export function computeTenantObservationReceiptContentHash(content: Omit<TenantObservationReceipt, "contentHash">): string;
export function validateTenantLiveHarnessManifest(input: unknown): ValidationResult;
export function validateTenantSelfObservationBinding(input: {
  source: unknown;
  observationReceipts: unknown;
  signal: Pick<SignalEvent, "signalId" | "observedAt" | "capturedAt" | "evidenceRefs">;
}): ValidationResult;
```

- `validateTenantLiveHarnessManifest`：与 `validateHarnessManifest` 同样的图限、不安全输入、内容哈希、17 个组件齐全且不重复；`scope` 必须是 `tenant_live_shadow`；`allowedSourceClasses` 必须恰为 `["tenant_self_observation"]`；`intendedUses` 非空且只含两种允许用途；其余 `commitmentClass/actionAuthority/humanReviewRequired/automaticPromotionAllowed/externalSendAllowed/writebackAllowed/memoryPromotionAllowed` 字面量与公开 manifest 相同。
- `validateTenantSelfObservationBinding`：
  - 来源信封通过 `validateOperatingSignalSourceEnvelope`，且 `sourceClass==="tenant_self_observation"`、`source.signalId===signal.signalId`；
  - `observationReceipts` 非空、每条通过 schema 与内容哈希、`runStatus` 为两者之一；
  - 回执 `evidenceRefs` 的并集必须覆盖 `signal.evidenceRefs`（缺一条即 `tenant_observation_evidence_uncovered:<ref>`）；
  - 每条回执 `windowStart <= signal.observedAt`、`observedAt <= signal.capturedAt`。

- [ ] **Step 1: 写失败测试**：一个合法 manifest 与一组合法绑定通过；逐条变异（scope 改公开、类里多一个 `synthetic_public`、用途含 `public_eval`、回执 `runStatus="FAILED"`、回执少覆盖一条证据、回执窗口晚于信号、回执内容哈希被改、信封 `signalId` 不一致）各自得到对应错误码；把合法租户 manifest 喂给 `validateHarnessManifest` 必须被拒（`invalid_harness_manifest:scope:...` 与 `forbidden_manifest_source_class:tenant_self_observation`）。
- [ ] **Step 2–4:** 运行失败 → 实现（复用 `harness-validators.ts` 的 `componentBindingSchema` 需导出；只加 `export`，不改其定义）→ 通过。
- [ ] **Step 5: 提交** `feat(operating-harness): 租户实时 manifest 与观察回执门`

---

### Task 4: 投影器按来源类分派

**Files:**
- Modify: `lib/operating-harness/context-contracts.ts`（输入类型）、`lib/operating-harness/context-projector.ts`（形状 schema 与 `validateTemporalOperatingContextProjectionInput`）
- Test: `lib/operating-harness/context-projector.tenant-live.test.ts`；回归冻结 `lib/operating-harness/context-projector.public-regression.test.ts`

**Interfaces:**
- 输入类型改为：

```ts
export type TemporalOperatingContextSourceBinding =
  | { source: OperatingSignalSourceEnvelope; promotion: EvalCasePromotion | null }
  | { source: OperatingSignalSourceEnvelope; promotion: null; observationReceipts: TenantObservationReceipt[] };

export type TemporalOperatingContextProjectionInput = Omit<..., "manifest"> & {
  manifest: HarnessManifest | TenantLiveHarnessManifest;
};
```

- 形状 schema：`manifest: z.union([harnessManifestSchema, tenantLiveHarnessManifestSchema])`；`sourceBindings` 元素 `z.union([ z.object({ source, promotion }).strict(), z.object({ source, promotion: z.null(), observationReceipts: z.array(z.unknown()).min(1).max(100) }).strict() ])`。
- 校验分派（写进实现）：
  - manifest 按 `scope` 选择 `validateHarnessManifest` 或 `validateTenantLiveHarnessManifest`；
  - 对每个绑定：`sourceClass==="tenant_self_observation"` → 必须带 `observationReceipts`，调用 `validateTenantSelfObservationBinding`，错误前缀 `tenant_source_gate:`；否则 → 必须**不存在** `observationReceipts` 键（存在即 `unexpected_observation_receipts:<signalId>`），走原有 `validateOperatingSignalImprovementGate` 代码路径（原样保留，包括 `synthetic_public` 的 promotion 检查）；
  - manifest 与来源类交叉：`tenant_live_shadow` 下出现非租户类、或 `public_offline_shadow` 下出现租户类，都由既有 `source_class_not_allowed_by_manifest` 规则拒绝（不新增分支）；
  - `sourceReceipts` 投影时 `promotionId` 对租户类为 `null`，快照结构不变。

- [ ] **Step 1: 写回归冻结测试（先于任何修改，先跑通并提交）**：对 `context-fixtures.ts` 导出的每个既有合法输入调用 `projectTemporalOperatingContext`，把 `snapshot.contentHash` 与 `replayRootHash` 写成字面量断言；再对既有全部拒绝用例断言错误数组逐项相等（从当前实现取值后写死）。
- [ ] **Step 2:** 提交 `test(operating-harness): 冻结公开投影快照哈希与拒绝码`。
- [ ] **Step 3: 写失败测试（租户）**：用 Task 3 的合法 manifest/绑定和一组最小合法记录（1 证据、1 对象、1 信号）投影成功，快照 `derivedOnly/writebackAllowed/actionAuthority/modelCallsUsed` 为既定字面量，`validateTemporalOperatingContextSnapshotBinding` 重放通过；变异：租户绑定缺回执、公开绑定多出 `observationReceipts` 键、租户 manifest 混入 `synthetic_public` 绑定、公开 manifest 混入租户绑定，各自被拒。
- [ ] **Step 4:** 实现分派。
- [ ] **Step 5:** 租户用例通过；**回归冻结测试无需任何修改即通过**；`npm run eval:operating-harness-p2`、`eval:operating-harness-p3a-context`、`eval:operating-harness-p3-readiness` 输出与 Task 1 保存的基线 `diff` 为空。
- [ ] **Step 6: 提交** `feat(operating-harness): 投影器接受租户自观察来源（公开合同不变）`

---

### Task 5: 快检 harness 与构建器（纯函数）

**Files:**
- Create: `lib/caio-operating-context/context-harness.ts`、`lib/caio-operating-context/context-builder.ts`
- Test: `lib/caio-operating-context/context-builder.test.ts`

**Interfaces:**
- Consumes: Task 2–4；P0-2a 的 `CaioMetricObservation`、`CaioAnomalyCandidate` 行字段。
- Produces:

```ts
// context-harness.ts
export const CAIO_QUICK_CHECK_HARNESS_CREATED_AT = "2026-09-16T00:00:00.000Z";
export function getCaioQuickCheckHarness(): { manifest: TenantLiveHarnessManifest; revision: HarnessRevision };
// 17 个组件 componentRef = `caio-quick-check/${kind}`、revisionRef = `caio-quick-check/${kind}/v1`、
// contentHash = sha256(canonicalJson({ kind, projector: OPERATING_CONTEXT_PROJECTOR_REVISION, version: 1 }))；
// intendedUses = ["operator_triage"]；revision 为 seed、createdBy "human"（Core 代码经人工评审）。

// context-builder.ts
export function lettersFromDigest(digest: string, length?: number): string; // 0-9a-f → a-p，默认 24 位
export type CaioContextObservationRow = { templateId: string; sourceKey: string; observationRunId: string; windowStart: Date; windowEnd: Date; observedAt: Date; contentHash: string };
export type CaioContextHitRow = { detectorId: string; mergeKey: string; objectKey: string; evidenceTemplateIds: string[] };
export type CaioContextRunRow = { id: string; status: string; windowStart: Date; windowEnd: Date; observedAt: Date; summaryHash: string; catalogEntryId: string; authorizationReceiptId: string; connectionReceiptId: string };
export function buildCaioTenantContextProjectionInput(input: {
  workspaceId: string; tickBucketStart: Date; windowStart: Date; asOf: Date;
  observations: readonly CaioContextObservationRow[];  // status=ok only
  hits: readonly CaioContextHitRow[];                  // this tick's opened + refreshed
  runs: readonly CaioContextRunRow[];
}): { ok: true; input: TemporalOperatingContextProjectionInput } | { ok: false; reason: "no_signals" | "context_limit_exceeded" | "evidence_run_missing" | "token_unmappable" };
```

映射（逐条写进实现注释并测试）：
- `workspaceAlias = "workspace-alias:" + letters(sha256(workspaceId))`，`tenantScopeRef = "tenant-scope:" + 同上`；`windowEnd = asOf`。
- EvidenceRef（每个 ok 观察）：`evidenceRef = "caio-evidence:" + letters(contentHash)`；`sourceType = "caio_metric_observation"`；`sourceSnapshotHash = 观察 contentHash`；`capturedAt = observedAt`；`expiresAt = observedAt + 1 天`；`sensitivity = "confidential"`；`redactionStatus = "alias_only"`；`consentScopeRef = null`；`contentIncluded = false`；`contentHash = computeEvidenceRefContentHash(content)`。
- BusinessObjectAlias（每个不同 `objectKey`）：`aliasRef = "caio-object:" + letters(sha256(objectKey))`；`objectKind` = `objectKey` 冒号前段，不满足 `SAFE_TOKEN_PATTERN` 时用 `"operating_object"`；`sourceObjectAliasRefs = [objectKey]`（不满足安全 ref 则整轮 `token_unmappable`）；`resolutionMethod = "deterministic_key"`；`personAttributionMode = "none"`；`createdAt = asOf`。
- SignalEvent（每个命中）：`signalId = "caio-signal:" + letters(sha256(bucketStart + detectorId + mergeKey))`；`signalKey = detectorId + ":" + mergeKey`；`sourceEnvelopeRef = signalId`；`sourceRef = "caio-quick-check:" + letters(sha256(bucketStart))`；`signalFamily = "caio." + detectorId`（替换非 token 字符为 `_`，仍不满足则 `token_unmappable`）；`observedAt = capturedAt = asOf`；证据按 `evidenceTemplateIds` 取本轮 ok 观察映射；`evidenceRootHash = computeEvidenceBindingRootHash`；`redactionStatus = "alias_only"`；`boundaryNote = "Deterministic quick-check detector hit; advice only, no action authority."`。
- 来源绑定（每个信号）：`buildTenantSelfObservationEnvelope({ signalId, allowedUses: ["operator_triage"], auditRefs: [sourceRef], boundaryNote })`；`promotion: null`；`observationReceipts` = 该信号证据涉及的每个观察运行各一条，`observationRunRef = "observation-run:" + letters(sha256(run.id))`，目录与回执引用同样字母化，`evidenceRefs` 为该运行支持的本信号证据。
- `judgementPackets = []`。

- [ ] **Step 1: 写失败测试**：合成 2 个观察（两个来源）、1 个命中引用两者 → 构建成功且 `projectTemporalOperatingContext(input).ok === true`、`validateTemporalOperatingContextSnapshotBinding` 重放通过；同输入两次构建 `canonicalJson` 相同（确定性）；输出 JSON 不含任何 `workspaceId`、`observationRunId`、`catalogEntryId` 原值；无命中 → `no_signals`；命中引用的模板本轮 unknown（不在 observations）→ 该命中丢弃，若全部丢弃 → `no_signals`；101 个不同对象 → `context_limit_exceeded`；运行行缺失 → `evidence_run_missing`；`lettersFromDigest` 输出不含数字。
- [ ] **Step 2–4:** 运行失败 → 实现 → 通过。
- [ ] **Step 5: 提交** `feat(caio): 快检行到 P3a 投影输入的确定性构建器`

---

### Task 6: 快照表

**Files:**
- Modify: `prisma/schema.prisma`（只追加，不运行 `prisma format`）
- Create: `prisma/migrations/20260916120000_caio_operating_context_snapshot/migration.sql`（"旧 schema 文件 → 新 schema 文件" diff 生成建表，外键按既有格式手写）
- Test: `lib/caio-operating-context/schema.mysql.test.ts`（追加用例）

```prisma
// Replayable P3a snapshot of one quick-check tick. projectionInputJson is kept so the snapshot can be
// re-derived and verified; rejected projections keep only closed error codes.
model CaioOperatingContextSnapshot {
  id                  String             @id @default(cuid())
  workspaceId         String
  tickId              String             @unique
  status              String             // PROJECTED | REJECTED | NO_SIGNALS
  reasonCode          String?
  errorCodesJson      String?            @db.LongText
  snapshotId          String?
  snapshotHash        String?
  replayRootHash      String?
  objectCount         Int                @default(0)
  signalCount         Int                @default(0)
  projectionInputJson String?            @db.LongText
  snapshotJson        String?            @db.LongText
  createdAt           DateTime           @default(now())
  workspace           Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tick                CaioQuickCheckTick @relation(fields: [tickId], references: [id], onDelete: Cascade)

  @@index([workspaceId, createdAt])
}
```

- [ ] **Step 1:** 追加用例：同一 tick 第二条快照 P2002；删除 tick 级联删除快照。运行确认失败。
- [ ] **Step 2:** schema、迁移、应用到隔离库、`prisma generate`；通过；`typecheck`。
- [ ] **Step 3: 提交** `feat(caio): 经营上下文快照表`

---

### Task 7: 投影服务并接入快检

**Files:**
- Create: `lib/caio-operating-context/context-projection.service.ts`
- Modify: `lib/caio-operating-context/quick-check.service.ts`（完成候选事务后调用；`CaioQuickCheckResult` 加 `contextProjection: "disabled" | "projected" | "rejected" | "no_signals" | "failed"`）
- Test: `lib/caio-operating-context/context-projection.service.test.ts`、`lib/caio-operating-context/quick-check.mysql.test.ts`（追加）

**Interfaces:**
- Produces: `CAIO_CONTEXT_PROJECTION_ENABLED_ENV = "HELM_CAIO_CONTEXT_PROJECTION_ENABLED"`；`projectCaioQuickCheckContext(input: { workspaceId: string; tickId: string; tickBucketStart: Date; windowStart: Date; asOf: Date; hits: readonly CaioContextHitRow[] }): Promise<"projected" | "rejected" | "no_signals">`

流程：
1. 读本 tick `status="ok"` 的观察与其 `observationRunId` 对应的 `ObservationSourceRun`（含来源 `catalogEntryId`）及该目录条目最新 AUTHORIZATION / CONNECTION 阶段回执 id。
2. `buildCaioTenantContextProjectionInput`；非 ok → 写 `NO_SIGNALS`（`reasonCode="no_signals"`）或 `REJECTED`（`reasonCode` 为构建失败码）。
3. `projectTemporalOperatingContext`；失败 → `REJECTED`，`errorCodesJson` 存投影器错误数组（均为我方生成的闭集码加字母化引用）。
4. 成功 → 再跑 `validateTemporalOperatingContextSnapshotBinding` 自检；通过写 `PROJECTED`，存输入、快照、哈希与计数。
5. `runCaioQuickCheck` 中：开关非精确 `true` → `contextProjection="disabled"` 且不读不写；调用抛错 → `"failed"`，tick 仍按原逻辑 `COMPLETED`。

- [ ] **Step 1: 写失败单测**：开关关闭不调用；构建拒绝写 `REJECTED` 且不含原始 id；投影器拒绝写 `REJECTED`；成功写 `PROJECTED` 且 `snapshotHash` 与重放一致；服务抛错时 tick 结果仍 `completed`。
- [ ] **Step 2: 追加 MySQL 用例**（沿用 P0-2a 套件的种子）：开关打开后命中一轮 → 快照 `PROJECTED`，取出 `projectionInputJson` 重新 `projectTemporalOperatingContext` 得到相同 `contentHash`；下一轮全部来源门拒绝 → `NO_SIGNALS`；快照 JSON 中搜索 workspace id、run id、目录条目 id 原值均不存在。
- [ ] **Step 3–4:** 运行失败 → 实现 → 通过。
- [ ] **Step 5: 变异反证**：构建器把 `sourceSnapshotHash` 改为固定值 → MySQL 重放用例仍通过但单测"证据内容绑定"用例失败（在 Task 5 补该用例：改一个指标值必须改变 `snapshot.contentHash`）；投影失败时改为抛出 → "tick 仍 completed"用例失败。
- [ ] **Step 6: 提交** `feat(caio): 快检后投影 P3a 经营上下文快照（默认关闭）`

---

### Task 8: `/caio` 显示投影状态

**Files:**
- Modify: `lib/caio-operating-context/readout.ts`（`available:true` 分支加 `lastSnapshot: { status: "PROJECTED" | "REJECTED" | "NO_SIGNALS"; createdAt: string; objectCount: number; signalCount: number } | null`）、`features/caio/operating-attention-section.tsx`
- Test: 两个既有测试文件追加用例

- [ ] **Step 1:** 追加测试：`PROJECTED` 显示"经营上下文快照已生成（对象 N、信号 M）"；`REJECTED` 显示"快照未通过合同校验"，不渲染 `errorCodesJson`；`NO_SIGNALS` 显示"本轮无命中，未生成快照"；`null` 不显示该行；读出不返回 `snapshotJson` 与 `projectionInputJson`。
- [ ] **Step 2–4:** 失败 → 实现 → 通过。
- [ ] **Step 5: 提交** `feat(caio): /caio 显示经营上下文快照状态`

---

### Task 9: 公开合同文档与规格修正

**Files:**
- Modify: `docs/product/HELM_ENTERPRISE_OPERATING_CONTEXT_MODEL.md` §3（在"fleet customer source 或 OSS governance source 都 fail closed"后追加租户自观察段）、`docs/product/HELM_OPERATING_HARNESS_REQUIREMENTS.md` 来源治理段、`docs/STATUS.md`
- Modify（文档分支）: 规格 §5.1 第 4 条改为"`sourceSnapshotHash` 取观察内容哈希（覆盖模板、窗口与数值），`contentHash` 为记录自身哈希"

追加段落要点：`tenant_self_observation` 仅在 `tenant_live_shadow` manifest 下、仅用于本租户分诊与建议；以观察运行回执与目录授权/连接回执代替 `EvalCasePromotion`；永不进入改进环、评测、训练、记忆晋升或跨租户汇总；公开离线合同不变；快照仍为派生只读。

- [ ] 运行 `npm run check:public-docs`、`npm run check:caio-terminology`；提交 `docs(operating-harness): 记录租户自观察来源与 tenant_live_shadow 范围`。

---

### Task 10: 门禁与 PR

- [ ] 运行：`npm run typecheck`、`npm run lint`、`npm run test`、`npm run check:boundaries`、`npm run eval:operating-harness-p2`、`npm run eval:operating-harness-p3a-context`、`npm run eval:operating-harness-p3-readiness`、`npm run test:caio-operating-context:mysql`。
- [ ] 显式列文件提交；开 PR（基于 P0-2a 合并后的 main；若 #389 未合并则以其分支为基并在描述中注明依赖），写明：公开合同哈希冻结测试未改动即通过、隐私守卫修复范围、新增一张表、开关默认关闭、不写 G0 产物、未部署。

## Self-Review

- 规格 §5.1 覆盖：第 1 条来源类 → Task 2；第 2 条 manifest 范围与不混用 → Task 3、4；第 3 条回执门代替晋升且为独立函数 → Task 3、4；第 4 条映射 → Task 5（含措辞修正 Task 9）；第 5 条公开文档 → Task 9；第 6 条既有类不变 → Task 1 基线 diff、Task 4 回归冻结。
- 规格 §5"读失败不产生 EvidenceRef"：构建器只取 `status=ok` 观察，命中引用未知模板即丢弃（Task 5）。
- 类型一致：`TenantLiveHarnessManifest`、`TenantObservationReceipt`、`validateTenantSelfObservationBinding`、`buildCaioTenantContextProjectionInput`、`CaioContextHitRow`、`projectCaioQuickCheckContext` 在定义任务与消费任务中名称一致。
- 待 owner 确认：Task 1 修改受保护的来源治理守卫（窄豁免完整 sha256 摘要）。

## 实施记录（as-built，2026-09-16，helm-public PR #391，基于 #389）

与上文计划的偏差，以代码为准：

1. **形状 schema 不用 `z.union`。** 初版用 union 分派，改变了既有公开拒绝码（`sourceBindings.0.source:invalid_type` 变成 `sourceBindings.0:invalid_union`），被既有测试拦下。改为：公开输入沿用原 schema；租户输入由 `manifest.scope` 选择 `projectionInputShapeSchema.extend({ manifest: tenantLiveHarnessManifestSchema })`；`observationReceipts` 以可选键接入，逐绑定分派处在公开绑定上拒绝、在租户绑定上要求。
2. **快照校验器同步扩展。** `context-validators.ts` 的 `sourceReceipts.sourceClass` 原只接受公开三类，租户快照会被自检拒绝；加入 `tenant_self_observation` 并新增 `context_snapshot_mixes_tenant_and_public_sources`。
3. **evolution weakness 与 P3 readiness 需显式 fail closed。** 两处都用 `z.enum(OPERATING_SIGNAL_SOURCE_CLASSES)`，扩展后会接受新类；已并入 fleet/OSS 的拒绝条件并各补一条测试（`eval:operating-harness-p2` 用例数 77 → 78）。
4. **公开发布守卫扫描源码字面量。** 形似手机号的测试值（包括触发误报的摘要样例）必须运行时拼接，否则 `public-mirror-smoke`（`cn-mobile` 规则）失败；计划文档同样适用。
5. **变异补强。** "指标值改变 → 快照哈希改变"不足以证明 `sourceSnapshotHash` 绑定指标内容（证据 id 也随之变化）；补了直接断言。
6. **投影服务取目录回执的条件**：`receiptType` 为大写 `AUTHORIZATION`/`CONNECTION`，状态 `AUTHORIZED`/`CONNECTED`，`recordedAt <= run.observedAt`；无目录绑定（兼容回执来源）的运行不能支撑证据，整轮 `evidence_run_missing`。
7. 构建器的 `getCaioQuickCheckHarness()` 每次返回深拷贝，防止调用方修改投影输入时污染缓存。
