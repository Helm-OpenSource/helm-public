# CAIO P0-2 经营观察运行时与检测器框架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans（本仓默认内联执行）. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Core 提供租户可注册的指标查询模板与确定性检测器接缝，按 10 分钟快检经数据资产目录门控的观察运行采集聚合指标、产出并合并候选异常，在 `/caio`"待关注"只读展示；全程只写 CAIO 自有表。

**Architecture:** 分两段。**P0-2a（本计划）**：纯合同与校验（`lib/caio-operating-context/`）→ 三张 CAIO 自有表 → 观察周期服务（tick 抢占、按来源 `beginObservationSourceRun`/`completeObservationSourceRun`、指标落库、检测器运行与候选合并）→ 快检作业工厂（经既有 `signalCollectionJobs` 贡献）→ `/caio` 读出。**P0-2b（另立计划，等合同修订获批合入后）**：把指标观察与候选异常投影为 P3a canonical 记录并经 `projectTemporalOperatingContext` 生成快照。P0-2a 的表字段已为 P0-2b 预留确定性映射所需的全部输入。

**Tech Stack:** TypeScript、zod、Prisma/MySQL 8、vitest（单测 + `vitest.public.config.ts` 隔离 MySQL）、既有 signal-collection 调度器。

**Spec:** `docs/superpowers/specs/2026-09-15-caio-live-operating-core-spec.md` §5、§11 P0。

## 核对结论（2026-09-15，决定了本计划的拆分）

- `projectTemporalOperatingContext`（`lib/operating-harness/context-projector.ts:759`）的输入门只接受 `HarnessManifest.scope="public_offline_shadow"`、来源类 `synthetic_public / self_dogfood_health / deidentified_promoted_case`、用途 `fixture_validation / public_eval / heldout_eval`（`harness-contracts.ts:49-85`）；`HELM_ENTERPRISE_OPERATING_CONTEXT_MODEL.md` §3 写明客户来源 fail closed。租户实时数据按现合同**不能**进入 P3a 投影。
- owner 2026-09-15 裁定：扩展合同（新增窄口径的租户自观察来源类与 manifest 范围，以数据资产目录与观察运行回执代替 `EvalCasePromotion`），拆两段实施。合同修订草案见 Task 8，代码见 P0-2b。
- harness 的 `SignalEvent / EvidenceRef / BusinessObjectAlias / JudgementPacket` 无任何持久化表；既有 Prisma `SignalEvent`（`schema.prisma:2599`）是另一套运行时会话模型，不复用。
- 调度器（`lib/signal-collection/scheduler.ts`）无数据库锁，多实例各跑一遍；本计划以 `(workspaceId, bucketStart)` 唯一行抢占，保证每 10 分钟桶只跑一次。
- `beginObservationSourceRun`（`observation.service.ts:910`）已含目录门（授权、连接回执、授权窗口）与程序原子占位，按 `(sourceId, executionKey)` 幂等；`completeObservationSourceRun`（`:1070`）一次性终态。二者目前无非测试调用者，本计划是第一个。
- 本仓不存在通用检测器框架；`SupervisionSignalRecord` 的写入要求洞察服务权限与判断字段，语义不同，不复用。

## Global Constraints

- P0 零业务写入：只写 `CaioQuickCheckTick`、`CaioMetricObservation`、`CaioAnomalyCandidate` 与既有 `ObservationSourceRun`（及其审计）；不写案件、拨号、催记、分案、配额、同意、停催。
- 新开关默认关闭，只接受精确字符串 `true`：`HELM_CAIO_QUICK_CHECK_ENABLED`。
- 指标值只允许有限数字或 `null`，键为 ref 格式；不允许字符串、数组、对象，从类型上排除个人级原始数据；另跑 `collectUnsafeInputErrors` 作第二道。
- 读失败标"未知"，不当 0：模板抛错或来源门拒绝 → 该模板观察 `status=unknown`、`valuesJson=null`、闭集 `errorCode`；依赖它的检测器本轮跳过，不触发也不清除候选。
- Core 不含任何客户信息；模板、检测器与标题由 overlay 注册。
- 不新增 server action、不依赖 `lib/caio-governance`（权限防火墙，见 `check:caio-terminology`）。
- 新表迁移单独一个目录；P0-0 核实显示生产 `_prisma_migrations` 未登记 Core f05ca2dc 之后的 5 个迁移，发布前由运营发布会话确认 Core 迁移执行方式（本计划不改发布链）。
- 每个任务先写失败测试；变异反证覆盖：未知不当 0、跳过不清除、抢占唯一、合并不重复。

## 文件结构

| 文件 | 职责 |
|---|---|
| `lib/caio-operating-context/contracts.ts` | 模板、指标值、检测器、命中、候选的类型与 zod 校验；ref 格式；严重度闭集 |
| `lib/caio-operating-context/metric-evidence.ts` | 纯函数：指标观察内容哈希、evidenceRef 生成、来源回执摘要 |
| `lib/caio-operating-context/detector-runner.ts` | 纯函数：按观察状态门控检测器、校验命中、按合并键归并、计算开/清除 |
| `lib/caio-operating-context/registry.ts` | 进程内注册表：`registerCaioOperatingContextPack({ packId, templates, detectors })`，重复 id 拒绝 |
| `lib/caio-operating-context/quick-check.service.ts` | DB：tick 抢占 → 观察运行 → 指标落库 → 检测器 → 候选 upsert → tick 终态 |
| `lib/caio-operating-context/quick-check-job.ts` | `createCaioQuickCheckJob(...)` 返回 `SignalCollectionJob` |
| `lib/caio-operating-context/readout.ts` | OWNER-only 读出：开放候选、各模板最近状态、最近 tick |
| `features/caio/operating-attention-section.tsx` | `/caio`"待关注"区块（服务端组件） |
| `prisma/migrations/20260916090000_caio_operating_context_runtime/migration.sql` | 三张表 |

---

### Task 1: 合同与校验

**Files:**
- Create: `lib/caio-operating-context/contracts.ts`
- Test: `lib/caio-operating-context/contracts.test.ts`

**Interfaces:**
- Produces:
  - `CAIO_ANOMALY_SEVERITIES = ["info","warning","critical"] as const`
  - `type CaioMetricValues = Readonly<Record<string, number | null>>`
  - `type CaioMetricQueryTemplate = { templateId: string; domain: string; sourceKey: string; run(ctx: CaioMetricQueryContext): Promise<{ values: CaioMetricValues; denominator: number | null }> }`
  - `type CaioMetricQueryContext = Readonly<{ workspaceId: string; windowStart: Date; windowEnd: Date; now: Date }>`
  - `type CaioMetricObservationView = Readonly<{ templateId: string; domain: string; status: "ok" | "unknown"; values: CaioMetricValues | null; denominator: number | null; evidenceRef: string | null }>`
  - `type CaioDetector = { detectorId: string; title: { zh: string; en: string }; requiredTemplateIds: readonly string[]; evaluate(input: { observations: ReadonlyMap<string, CaioMetricObservationView>; now: Date }): readonly CaioDetectorHit[] }`
  - `type CaioDetectorHit = { mergeKey: string; objectKey: string; severity: CaioAnomalySeverity; reasonCode: string; evidenceTemplateIds: readonly string[] }`
  - `parseCaioMetricResult(raw: unknown): { ok: true; values; denominator } | { ok: false; errorCode: "metric_result_invalid" | "metric_result_unsafe" }`
  - `parseCaioDetectorHit(raw: unknown, requiredTemplateIds: readonly string[]): { ok: true; hit } | { ok: false; errorCode: "detector_hit_invalid" | "detector_evidence_outside_inputs" }`
  - `assertCaioOperatingContextPack({ templates, detectors }): void`（抛 `CaioOperatingContextContractError(reasons: string[])`）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";

import {
  assertCaioOperatingContextPack,
  CaioOperatingContextContractError,
  parseCaioDetectorHit,
  parseCaioMetricResult,
} from "./contracts";

const template = (templateId: string, sourceKey = "source-a") => ({
  templateId, domain: "operations", sourceKey, run: async () => ({ values: {}, denominator: null }),
});
const detector = (detectorId: string, requiredTemplateIds: string[]) => ({
  detectorId, title: { zh: "标题", en: "Title" }, requiredTemplateIds, evaluate: () => [],
});

describe("parseCaioMetricResult", () => {
  it("accepts finite numbers and null keyed by refs", () => {
    expect(parseCaioMetricResult({ values: { dead_letters: 3, ratio: 0.25, unknown_slot: null }, denominator: 12 }))
      .toEqual({ ok: true, values: { dead_letters: 3, ratio: 0.25, unknown_slot: null }, denominator: 12 });
  });

  it.each([
    [{ values: { name: "张三" }, denominator: null }],
    [{ values: { n: Number.NaN }, denominator: null }],
    [{ values: { n: Number.POSITIVE_INFINITY }, denominator: null }],
    [{ values: { n: [1] }, denominator: null }],
    [{ values: { "bad key": 1 }, denominator: null }],
    [{ values: {}, denominator: -1 }],
    [{ values: {}, denominator: null, extra: true }],
    [null],
  ])("rejects %j as invalid", (raw) => {
    expect(parseCaioMetricResult(raw)).toEqual({ ok: false, errorCode: "metric_result_invalid" });
  });

  it("rejects keys that the source-governance guard treats as unsafe", () => {
    expect(parseCaioMetricResult({ values: { customerName: 1 }, denominator: null }))
      .toEqual({ ok: false, errorCode: "metric_result_unsafe" });
  });
});

describe("parseCaioDetectorHit", () => {
  const hit = { mergeKey: "dead-letter-surge", objectKey: "job:closure", severity: "critical", reasonCode: "dead_letter_rate_high", evidenceTemplateIds: ["dead-letters"] };

  it("accepts a hit whose evidence is inside the detector inputs", () => {
    expect(parseCaioDetectorHit(hit, ["dead-letters", "attempts"])).toEqual({ ok: true, hit });
  });

  it("rejects evidence outside the declared inputs", () => {
    expect(parseCaioDetectorHit({ ...hit, evidenceTemplateIds: ["other"] }, ["dead-letters"]))
      .toEqual({ ok: false, errorCode: "detector_evidence_outside_inputs" });
  });

  it.each([{ ...hit, severity: "fatal" }, { ...hit, evidenceTemplateIds: [] }, { ...hit, mergeKey: "" }, { ...hit, note: "x" }])(
    "rejects malformed hit %j", (raw) => {
      expect(parseCaioDetectorHit(raw, ["dead-letters"])).toEqual({ ok: false, errorCode: "detector_hit_invalid" });
    });
});

describe("assertCaioOperatingContextPack", () => {
  it("accepts unique templates and detectors that reference known templates", () => {
    expect(() => assertCaioOperatingContextPack({ templates: [template("a"), template("b")], detectors: [detector("d", ["a", "b"])] })).not.toThrow();
  });

  it.each([
    [{ templates: [template("a"), template("a")], detectors: [] }, "duplicate_template_id"],
    [{ templates: [template("a")], detectors: [detector("d", ["a"]), detector("d", ["a"])] }, "duplicate_detector_id"],
    [{ templates: [template("a")], detectors: [detector("d", ["missing"])] }, "detector_unknown_template"],
    [{ templates: [template("a")], detectors: [detector("d", [])] }, "detector_requires_inputs"],
    [{ templates: [template("Bad Id")], detectors: [] }, "template_id_invalid"],
  ] as const)("rejects %#: %s", (pack, reason) => {
    try {
      assertCaioOperatingContextPack(pack as never);
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(CaioOperatingContextContractError);
      expect((error as CaioOperatingContextContractError).reasons).toContain(reason);
    }
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/caio-operating-context/contracts.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

```ts
import { z } from "zod";

import { collectUnsafeInputErrors } from "@/lib/operating-signal-governance/source-governance";

/**
 * Tenant-registered metric query templates and deterministic detectors for the CAIO quick check.
 * Metric values are finite numbers or null only, so a template cannot carry names, phone numbers,
 * free text or per-person rows. Contracts here are customer-neutral; overlays supply the content.
 */

export const CAIO_ANOMALY_SEVERITIES = ["info", "warning", "critical"] as const;
export type CaioAnomalySeverity = (typeof CAIO_ANOMALY_SEVERITIES)[number];

// Case-insensitive like the harness ref pattern, so camelCase keys reach the unsafe-key guard.
export const CAIO_REF_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,190}$/iu;
const refSchema = z.string().regex(CAIO_REF_PATTERN);

export type CaioMetricValues = Readonly<Record<string, number | null>>;
export type CaioMetricQueryContext = Readonly<{ workspaceId: string; windowStart: Date; windowEnd: Date; now: Date }>;

export type CaioMetricQueryTemplate = Readonly<{
  templateId: string;
  domain: string;
  sourceKey: string;
  run: (ctx: CaioMetricQueryContext) => Promise<unknown>;
}>;

export type CaioMetricObservationView = Readonly<{
  templateId: string;
  domain: string;
  status: "ok" | "unknown";
  values: CaioMetricValues | null;
  denominator: number | null;
  evidenceRef: string | null;
}>;

export type CaioDetectorHit = Readonly<{
  mergeKey: string;
  objectKey: string;
  severity: CaioAnomalySeverity;
  reasonCode: string;
  evidenceTemplateIds: readonly string[];
}>;

export type CaioDetector = Readonly<{
  detectorId: string;
  title: Readonly<{ zh: string; en: string }>;
  requiredTemplateIds: readonly string[];
  evaluate: (input: { observations: ReadonlyMap<string, CaioMetricObservationView>; now: Date }) => readonly unknown[];
}>;

export class CaioOperatingContextContractError extends Error {
  constructor(readonly reasons: string[]) {
    super(`caio_operating_context_contract:${reasons.join(",")}`);
    this.name = "CaioOperatingContextContractError";
  }
}

const finite = z.number().refine(Number.isFinite);
const metricResultSchema = z.object({
  values: z.record(refSchema, finite.nullable()),
  denominator: finite.min(0).nullable(),
}).strict();

export function parseCaioMetricResult(raw: unknown):
  | { ok: true; values: CaioMetricValues; denominator: number | null }
  | { ok: false; errorCode: "metric_result_invalid" | "metric_result_unsafe" } {
  const parsed = metricResultSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errorCode: "metric_result_invalid" };
  if (collectUnsafeInputErrors(parsed.data).length > 0) return { ok: false, errorCode: "metric_result_unsafe" };
  return { ok: true, values: parsed.data.values, denominator: parsed.data.denominator };
}

const hitSchema = z.object({
  mergeKey: refSchema,
  objectKey: refSchema,
  severity: z.enum(CAIO_ANOMALY_SEVERITIES),
  reasonCode: refSchema,
  evidenceTemplateIds: z.array(refSchema).min(1).max(20),
}).strict();

export function parseCaioDetectorHit(raw: unknown, requiredTemplateIds: readonly string[]):
  | { ok: true; hit: CaioDetectorHit }
  | { ok: false; errorCode: "detector_hit_invalid" | "detector_evidence_outside_inputs" } {
  const parsed = hitSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errorCode: "detector_hit_invalid" };
  if (parsed.data.evidenceTemplateIds.some((id) => !requiredTemplateIds.includes(id))) {
    return { ok: false, errorCode: "detector_evidence_outside_inputs" };
  }
  return { ok: true, hit: parsed.data };
}

export function assertCaioOperatingContextPack(pack: {
  templates: readonly CaioMetricQueryTemplate[];
  detectors: readonly CaioDetector[];
}): void {
  const reasons = new Set<string>();
  const templateIds = new Set<string>();
  for (const template of pack.templates) {
    if (!CAIO_REF_PATTERN.test(template.templateId)) reasons.add("template_id_invalid");
    if (!CAIO_REF_PATTERN.test(template.domain)) reasons.add("template_domain_invalid");
    if (!template.sourceKey.trim()) reasons.add("template_source_required");
    if (templateIds.has(template.templateId)) reasons.add("duplicate_template_id");
    templateIds.add(template.templateId);
  }
  const detectorIds = new Set<string>();
  for (const detector of pack.detectors) {
    if (!CAIO_REF_PATTERN.test(detector.detectorId)) reasons.add("detector_id_invalid");
    if (detectorIds.has(detector.detectorId)) reasons.add("duplicate_detector_id");
    detectorIds.add(detector.detectorId);
    if (detector.requiredTemplateIds.length === 0) reasons.add("detector_requires_inputs");
    if (detector.requiredTemplateIds.some((id) => !templateIds.has(id))) reasons.add("detector_unknown_template");
    if (!detector.title.zh.trim() || !detector.title.en.trim()) reasons.add("detector_title_required");
  }
  if (reasons.size > 0) throw new CaioOperatingContextContractError([...reasons].sort());
}
```

- [ ] **Step 4: 运行通过**；若 `customerName` 用例未被 `collectUnsafeInputErrors` 判为不安全，读 `source-governance.ts:145` 的禁用键表，改用表中实际存在的键（不改守卫本身）。
- [ ] **Step 5: 提交** `feat(caio): 经营观察模板与检测器合同`

---

### Task 2: 指标证据与检测器运行（纯函数）

**Files:**
- Create: `lib/caio-operating-context/metric-evidence.ts`、`lib/caio-operating-context/detector-runner.ts`
- Test: `lib/caio-operating-context/metric-evidence.test.ts`、`lib/caio-operating-context/detector-runner.test.ts`

**Interfaces:**
- Consumes: Task 1 全部类型与 `parseCaioDetectorHit`。
- Produces:
  - `buildCaioMetricObservationContent(input: { templateId; domain; sourceKey; windowStart: Date; windowEnd: Date; values: CaioMetricValues; denominator: number | null }): { contentHash: string; evidenceRef: string }`（`evidenceRef = "caio-metric:" + templateId + ":" + contentHash.slice(7, 23)`）
  - `summarizeCaioSourceRun(observations: readonly { status: "ok" | "unknown"; contentHash: string | null; evidenceRef: string | null }[]): { outcome: "success" | "partial_success" | "failure"; freshness: "fresh" | "unknown"; completenessPercent: number; summaryHash: string | null; evidenceRefs: string[]; errorCodes: string[] }`
  - `runCaioDetectors(input: { detectors: readonly CaioDetector[]; observations: ReadonlyMap<string, CaioMetricObservationView>; now: Date }): CaioDetectorRunResult`
  - `type CaioDetectorRunResult = { evaluated: { detectorId: string; hits: CaioDetectorHit[] }[]; skipped: { detectorId: string; reason: "input_unknown" | "input_missing" }[]; failed: { detectorId: string; reason: "detector_threw" | CaioDetectorHitErrorCode }[] }`
  - `planCaioCandidateTransitions(input: { run: CaioDetectorRunResult; openCandidates: readonly { detectorId: string; mergeKey: string }[] }): { upserts: { detectorId: string; hit: CaioDetectorHit }[]; clears: { detectorId: string; mergeKey: string }[] }`

- [ ] **Step 1: 写失败测试（关键保证）**

```ts
// detector-runner.test.ts
import { describe, expect, it } from "vitest";

import type { CaioDetector, CaioMetricObservationView } from "./contracts";
import { planCaioCandidateTransitions, runCaioDetectors } from "./detector-runner";

const now = new Date("2026-09-16T02:00:00Z");
const ok = (templateId: string, values: Record<string, number | null>): CaioMetricObservationView =>
  ({ templateId, domain: "operations", status: "ok", values, denominator: null, evidenceRef: `caio-metric:${templateId}:x` });
const unknown = (templateId: string): CaioMetricObservationView =>
  ({ templateId, domain: "operations", status: "unknown", values: null, denominator: null, evidenceRef: null });

const deadLetters: CaioDetector = {
  detectorId: "dead-letter-surge", title: { zh: "死信激增", en: "Dead-letter surge" }, requiredTemplateIds: ["dead-letters"],
  evaluate: ({ observations }) => {
    const count = observations.get("dead-letters")?.values?.count ?? 0;
    return count >= 10
      ? [{ mergeKey: "closure", objectKey: "job:closure", severity: "critical", reasonCode: "dead_letters_over_threshold", evidenceTemplateIds: ["dead-letters"] }]
      : [];
  },
};

describe("runCaioDetectors", () => {
  it("evaluates detectors whose inputs are all known", () => {
    const result = runCaioDetectors({ detectors: [deadLetters], observations: new Map([["dead-letters", ok("dead-letters", { count: 12 })]]), now });
    expect(result.evaluated).toEqual([{ detectorId: "dead-letter-surge", hits: [expect.objectContaining({ mergeKey: "closure" })] }]);
  });

  it("skips (never evaluates as zero) when an input is unknown or missing", () => {
    const evaluate = vi.fn(() => []);
    const detector = { ...deadLetters, evaluate };
    expect(runCaioDetectors({ detectors: [detector], observations: new Map([["dead-letters", unknown("dead-letters")]]), now }).skipped)
      .toEqual([{ detectorId: "dead-letter-surge", reason: "input_unknown" }]);
    expect(runCaioDetectors({ detectors: [detector], observations: new Map(), now }).skipped)
      .toEqual([{ detectorId: "dead-letter-surge", reason: "input_missing" }]);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("isolates a throwing detector and rejects hits citing evidence outside its inputs", () => {
    const throwing = { ...deadLetters, detectorId: "throws", evaluate: () => { throw new Error("private detail"); } };
    const outside = { ...deadLetters, detectorId: "outside", evaluate: () => [{ mergeKey: "m", objectKey: "o", severity: "info", reasonCode: "r", evidenceTemplateIds: ["other"] }] };
    const result = runCaioDetectors({ detectors: [throwing, outside, deadLetters], observations: new Map([["dead-letters", ok("dead-letters", { count: 12 })]]), now });
    expect(result.failed).toEqual([{ detectorId: "throws", reason: "detector_threw" }, { detectorId: "outside", reason: "detector_evidence_outside_inputs" }]);
    expect(result.evaluated.map((e) => e.detectorId)).toEqual(["dead-letter-surge"]);
  });

  it("merges duplicate merge keys from one detector into a single hit (highest severity wins)", () => {
    const dup = { ...deadLetters, evaluate: () => [
      { mergeKey: "m", objectKey: "o", severity: "warning", reasonCode: "r", evidenceTemplateIds: ["dead-letters"] },
      { mergeKey: "m", objectKey: "o", severity: "critical", reasonCode: "r", evidenceTemplateIds: ["dead-letters"] },
    ] };
    const result = runCaioDetectors({ detectors: [dup], observations: new Map([["dead-letters", ok("dead-letters", {})]]), now });
    expect(result.evaluated[0].hits).toEqual([expect.objectContaining({ mergeKey: "m", severity: "critical" })]);
  });
});

describe("planCaioCandidateTransitions", () => {
  it("clears open candidates only for detectors that were evaluated this tick and did not hit", () => {
    const plan = planCaioCandidateTransitions({
      run: { evaluated: [{ detectorId: "a", hits: [] }], skipped: [{ detectorId: "b", reason: "input_unknown" }], failed: [{ detectorId: "c", reason: "detector_threw" }] },
      openCandidates: [{ detectorId: "a", mergeKey: "m1" }, { detectorId: "b", mergeKey: "m2" }, { detectorId: "c", mergeKey: "m3" }],
    });
    expect(plan.clears).toEqual([{ detectorId: "a", mergeKey: "m1" }]);
    expect(plan.upserts).toEqual([]);
  });
});
```

在文件头补 `import { vi } from "vitest";`。`metric-evidence.test.ts` 断言：同内容不同键序哈希相同；`values` 改一个数哈希不同；`summarizeCaioSourceRun` 全 ok → `success/fresh/100`，一半 unknown → `partial_success/fresh/50` 且 `errorCodes=["metric_unknown"]`，全 unknown → `failure/unknown/0/summaryHash=null/evidenceRefs=[]`。

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/caio-operating-context/detector-runner.test.ts lib/caio-operating-context/metric-evidence.test.ts`

- [ ] **Step 3: 实现**

```ts
// metric-evidence.ts
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import type { CaioMetricValues } from "./contracts";

export function buildCaioMetricObservationContent(input: {
  templateId: string; domain: string; sourceKey: string;
  windowStart: Date; windowEnd: Date; values: CaioMetricValues; denominator: number | null;
}): { contentHash: string; evidenceRef: string } {
  const contentHash = sha256(canonicalJson({
    templateId: input.templateId, domain: input.domain, sourceKey: input.sourceKey,
    windowStart: input.windowStart.toISOString(), windowEnd: input.windowEnd.toISOString(),
    values: input.values, denominator: input.denominator,
  }));
  return { contentHash, evidenceRef: `caio-metric:${input.templateId}:${contentHash.slice(7, 23)}` };
}

export function summarizeCaioSourceRun(observations: readonly { status: "ok" | "unknown"; contentHash: string | null; evidenceRef: string | null }[]) {
  const known = observations.filter((o) => o.status === "ok" && o.contentHash && o.evidenceRef);
  const completenessPercent = observations.length === 0 ? 0 : Math.round((known.length / observations.length) * 100);
  if (known.length === 0) {
    return { outcome: "failure" as const, freshness: "unknown" as const, completenessPercent: 0, summaryHash: null, evidenceRefs: [], errorCodes: ["metric_unknown"] };
  }
  return {
    outcome: known.length === observations.length ? ("success" as const) : ("partial_success" as const),
    freshness: "fresh" as const,
    completenessPercent,
    summaryHash: sha256(canonicalJson(known.map((o) => o.contentHash).sort())),
    evidenceRefs: known.map((o) => o.evidenceRef as string).sort(),
    errorCodes: known.length === observations.length ? [] : ["metric_unknown"],
  };
}
```

```ts
// detector-runner.ts
import { type CaioAnomalySeverity, type CaioDetector, type CaioDetectorHit, type CaioMetricObservationView, parseCaioDetectorHit } from "./contracts";

export type CaioDetectorHitErrorCode = "detector_hit_invalid" | "detector_evidence_outside_inputs";
export type CaioDetectorRunResult = {
  evaluated: { detectorId: string; hits: CaioDetectorHit[] }[];
  skipped: { detectorId: string; reason: "input_unknown" | "input_missing" }[];
  failed: { detectorId: string; reason: "detector_threw" | CaioDetectorHitErrorCode }[];
};

const RANK: Record<CaioAnomalySeverity, number> = { info: 0, warning: 1, critical: 2 };

export function runCaioDetectors(input: {
  detectors: readonly CaioDetector[];
  observations: ReadonlyMap<string, CaioMetricObservationView>;
  now: Date;
}): CaioDetectorRunResult {
  const result: CaioDetectorRunResult = { evaluated: [], skipped: [], failed: [] };
  for (const detector of input.detectors) {
    const inputs = detector.requiredTemplateIds.map((id) => input.observations.get(id));
    if (inputs.some((o) => o === undefined)) { result.skipped.push({ detectorId: detector.detectorId, reason: "input_missing" }); continue; }
    if (inputs.some((o) => o?.status !== "ok")) { result.skipped.push({ detectorId: detector.detectorId, reason: "input_unknown" }); continue; }
    let raw: readonly unknown[];
    try {
      raw = detector.evaluate({ observations: input.observations, now: input.now });
    } catch {
      result.failed.push({ detectorId: detector.detectorId, reason: "detector_threw" });
      continue;
    }
    const merged = new Map<string, CaioDetectorHit>();
    let failure: CaioDetectorHitErrorCode | null = null;
    for (const item of Array.isArray(raw) ? raw : [null]) {
      const parsed = parseCaioDetectorHit(item, detector.requiredTemplateIds);
      if (!parsed.ok) { failure = parsed.errorCode; break; }
      const existing = merged.get(parsed.hit.mergeKey);
      if (!existing || RANK[parsed.hit.severity] > RANK[existing.severity]) merged.set(parsed.hit.mergeKey, parsed.hit);
    }
    // A detector that emits any malformed hit is failed as a whole: no partial adoption.
    if (failure) { result.failed.push({ detectorId: detector.detectorId, reason: failure }); continue; }
    result.evaluated.push({ detectorId: detector.detectorId, hits: [...merged.values()].sort((a, b) => a.mergeKey.localeCompare(b.mergeKey)) });
  }
  return result;
}

export function planCaioCandidateTransitions(input: {
  run: CaioDetectorRunResult;
  openCandidates: readonly { detectorId: string; mergeKey: string }[];
}) {
  const upserts = input.run.evaluated.flatMap(({ detectorId, hits }) => hits.map((hit) => ({ detectorId, hit })));
  const hitKeys = new Set(upserts.map(({ detectorId, hit }) => `${detectorId}|${hit.mergeKey}`));
  const evaluatedIds = new Set(input.run.evaluated.map((e) => e.detectorId));
  // Skipped and failed detectors never clear: unknown is not "resolved".
  const clears = input.openCandidates.filter((c) => evaluatedIds.has(c.detectorId) && !hitKeys.has(`${c.detectorId}|${c.mergeKey}`));
  return { upserts, clears };
}
```

- [ ] **Step 4: 运行通过。** 变异反证：把 `input_unknown` 分支删掉，确认"skips (never evaluates as zero)"失败；把 `evaluatedIds.has` 条件删掉，确认 clears 用例失败；各自恢复。
- [ ] **Step 5: 提交** `feat(caio): 指标证据哈希与确定性检测器运行`

---

### Task 3: 注册表

**Files:**
- Create: `lib/caio-operating-context/registry.ts`
- Test: `lib/caio-operating-context/registry.test.ts`

**Interfaces:**
- Consumes: `assertCaioOperatingContextPack`、`CaioMetricQueryTemplate`、`CaioDetector`
- Produces: `registerCaioOperatingContextPack(input: { packId: string; templates: readonly CaioMetricQueryTemplate[]; detectors: readonly CaioDetector[] }): void`；`getRegisteredCaioOperatingContext(): { templates: readonly CaioMetricQueryTemplate[]; detectors: readonly CaioDetector[] }`；`resetCaioOperatingContextRegistryForTests(): void`

- [ ] **Step 1: 写失败测试**：同 packId 重复注册抛错（不静默忽略，不同于 `registerPackContributions`，因为重复注册会让检测器双跑）；两个 pack 的模板 id 冲突抛 `CaioOperatingContextContractError` 且 `reasons` 含 `duplicate_template_id`；合并后跨 pack 的检测器可引用另一 pack 的模板；未注册时返回空数组。
- [ ] **Step 2: 运行确认失败。**
- [ ] **Step 3: 实现**

```ts
import {
  assertCaioOperatingContextPack,
  type CaioDetector,
  type CaioMetricQueryTemplate,
} from "./contracts";

type Registry = { packIds: Set<string>; templates: CaioMetricQueryTemplate[]; detectors: CaioDetector[] };

declare global {
  // Shared across Next.js entry bundles, same reason as the pack contribution registry.
  var __helmCaioOperatingContextRegistry: Registry | undefined;
}

function registry(): Registry {
  globalThis.__helmCaioOperatingContextRegistry ??= { packIds: new Set(), templates: [], detectors: [] };
  return globalThis.__helmCaioOperatingContextRegistry;
}

export function registerCaioOperatingContextPack(input: {
  packId: string;
  templates: readonly CaioMetricQueryTemplate[];
  detectors: readonly CaioDetector[];
}): void {
  const current = registry();
  // Unlike registerPackContributions, a repeat is an error: silently keeping one copy hides a
  // double bootstrap, and re-adding would run every detector twice.
  if (current.packIds.has(input.packId)) throw new Error(`caio_operating_context_pack_already_registered:${input.packId}`);
  const templates = [...current.templates, ...input.templates];
  const detectors = [...current.detectors, ...input.detectors];
  assertCaioOperatingContextPack({ templates, detectors });
  current.packIds.add(input.packId);
  current.templates = templates;
  current.detectors = detectors;
}

export function getRegisteredCaioOperatingContext(): { templates: readonly CaioMetricQueryTemplate[]; detectors: readonly CaioDetector[] } {
  const { templates, detectors } = registry();
  return { templates, detectors };
}

export function resetCaioOperatingContextRegistryForTests(): void {
  globalThis.__helmCaioOperatingContextRegistry = undefined;
}
```
- [ ] **Step 4: 运行通过。**
- [ ] **Step 5: 提交** `feat(caio): 经营观察注册接缝`

---

### Task 4: 三张表与迁移

**Files:**
- Modify: `prisma/schema.prisma`（在 `ObservationSourceRun` 模型之后追加；`Workspace` 模型追加三条反向关系）
- Create: `prisma/migrations/20260916090000_caio_operating_context_runtime/migration.sql`
- Test: `lib/caio-operating-context/schema.mysql.test.ts`

**Interfaces:**
- Produces: Prisma 模型 `CaioQuickCheckTick`、`CaioMetricObservation`、`CaioAnomalyCandidate`（字段如下，后续任务按此名使用）

```prisma
// CAIO quick-check tick. One row per workspace per 10-minute bucket: the unique key is the
// cross-instance claim, because the signal-collection scheduler has no database lock.
model CaioQuickCheckTick {
  id           String    @id @default(cuid())
  workspaceId  String
  bucketStart  DateTime
  status       String    @default("RUNNING") // RUNNING | COMPLETED | FAILED
  startedAt    DateTime  @default(now())
  completedAt  DateTime?
  summaryJson  String?   @db.LongText
  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  observations CaioMetricObservation[]

  @@unique([workspaceId, bucketStart])
  @@index([workspaceId, startedAt])
}

// Tenant-private aggregate metric body. valuesJson holds finite numbers or null only; a failed
// read is stored as status=unknown with valuesJson=null and never as zero.
model CaioMetricObservation {
  id                 String             @id @default(cuid())
  workspaceId        String
  tickId             String
  observationRunId   String?
  sourceKey          String
  templateId         String
  domain             String
  windowStart        DateTime
  windowEnd          DateTime
  observedAt         DateTime
  status             String             // ok | unknown
  valuesJson         String?            @db.LongText
  denominator        Float?
  errorCode          String?
  contentHash        String?
  evidenceRef        String?
  workspace          Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tick               CaioQuickCheckTick @relation(fields: [tickId], references: [id], onDelete: Cascade)

  @@unique([tickId, templateId])
  @@index([workspaceId, templateId, observedAt])
}

// Candidate anomaly merged by (detectorId, mergeKey). openKey is set while OPEN and null once
// CLEARED, so the unique index allows one open candidate per merge key and any number of cleared ones.
model CaioAnomalyCandidate {
  id               String    @id @default(cuid())
  workspaceId      String
  detectorId       String
  mergeKey         String
  openKey          String?
  objectKey        String
  severity         String
  reasonCode       String
  titleZh          String
  titleEn          String
  status           String    @default("OPEN") // OPEN | CLEARED
  hitCount         Int       @default(1)
  firstSeenAt      DateTime
  lastSeenAt       DateTime
  clearedAt        DateTime?
  lastTickId       String
  evidenceRefsJson String    @db.LongText
  workspace        Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, openKey])
  @@index([workspaceId, status, lastSeenAt])
}
```

- [ ] **Step 1: 写失败测试**（隔离库，`CAIO_OPERATING_CONTEXT_DATABASE_URL === DATABASE_URL` 且库名前缀 `helm_caio_operating_context_`，不删行）：同一 `(workspaceId, bucketStart)` 第二次 `create` 抛 P2002；同一 `(workspaceId, openKey)` 两条 OPEN 抛 P2002；两条 `openKey=null` 的 CLEARED 可共存；删除 workspace 级联删除三表行。
- [ ] **Step 2:** 在隔离库上运行，确认因表不存在失败。
- [ ] **Step 3:** 写 schema；`npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` 生成 SQL 放入迁移目录，文件头注释写明三表用途与"只写 CAIO 自有表"；`npx prisma migrate deploy` 应用到隔离库；`npm run db:generate`。
- [ ] **Step 4:** 运行通过；`npm run typecheck`。
- [ ] **Step 5: 提交** `feat(caio): 快检 tick、指标观察与候选异常表`

---

### Task 5: 快检服务

**Files:**
- Create: `lib/caio-operating-context/quick-check.service.ts`
- Test: `lib/caio-operating-context/quick-check.service.test.ts`（mock db 与 observation service）、`lib/caio-operating-context/quick-check.mysql.test.ts`

**Interfaces:**
- Consumes: Task 1–4；`beginObservationSourceRun`、`completeObservationSourceRun`、`ObservationContractError`（`lib/stage1-owner-loop/observation.service.ts`）
- Produces:
  - `CAIO_QUICK_CHECK_BUCKET_MINUTES = 10`
  - `caioQuickCheckBucketStart(now: Date): Date`（向下取整到 10 分钟 UTC）
  - `runCaioQuickCheck(input: { workspaceId: string; now?: Date; templates?: readonly CaioMetricQueryTemplate[]; detectors?: readonly CaioDetector[] }): Promise<CaioQuickCheckResult>`（缺省取注册表）
  - `type CaioQuickCheckResult = { status: "claimed_elsewhere" } | { status: "completed" | "failed"; tickId: string; known: number; unknown: number; opened: number; refreshed: number; cleared: number; skippedDetectors: number; failedDetectors: number }`

流程（写进实现注释）：

1. `bucketStart = caioQuickCheckBucketStart(now)`；`windowEnd = bucketStart + 10min`，`windowStart = windowEnd - 10min`。
2. `db.caioQuickCheckTick.create({ workspaceId, bucketStart })`；P2002 → `{ status: "claimed_elsewhere" }`，不做任何其它读写。
3. 按 `sourceKey` 分组模板。对每组：`beginObservationSourceRun({ workspaceId, sourceKey, executionKey: "caio-quick-check:" + bucketStart.toISOString(), windowStart, windowEnd, now })`。
   - 抛任何错误 → 该组全部模板写 `status=unknown, errorCode="observation_gate_rejected"`，不调用模板 `run`（门未过不读数据）。
   - 通过 → 逐个 `run`（每个模板 `Promise.race` 超时 20 秒）→ `parseCaioMetricResult`；抛错/超时/解析失败 → `unknown` + `errorCode` ∈ `metric_query_failed | metric_query_timeout | metric_result_invalid | metric_result_unsafe`；成功 → `buildCaioMetricObservationContent` 写 `ok`。
   - 写完该组 → `summarizeCaioSourceRun` → `completeObservationSourceRun({ ..., outcome, freshness, completenessPercent, summaryHash, evidenceRefs, errorCodes, actorName: "caio-quick-check" })`。
4. 组装 `observations: Map<templateId, CaioMetricObservationView>` → `runCaioDetectors`。
5. 在一个事务里读当前 OPEN 候选 → `planCaioCandidateTransitions` →
   - upsert：存在 OPEN（`openKey = detectorId + ":" + mergeKey`）→ `hitCount+1, lastSeenAt=now, severity/reasonCode/objectKey/evidenceRefsJson/lastTickId` 更新；不存在 → create `OPEN`，标题取自检测器。`evidenceRefsJson` 为该命中 `evidenceTemplateIds` 对应观察的 `evidenceRef`（排序）。
   - clear：`status=CLEARED, openKey=null, clearedAt=now`。
6. tick 置 `COMPLETED`，`summaryJson` 只含计数与 `skipped/failed` 的 `{detectorId, reason}`；任一步未捕获异常 → tick 置 `FAILED`（summary 只记 `errorCode="quick_check_failed"`），返回 `failed`，不向调用方抛出细节。

- [ ] **Step 1: 写失败单测（mock）**，至少覆盖：
  - 抢占失败时不调用 `beginObservationSourceRun`、不写观察；
  - 来源门拒绝时该来源模板 `run` 未被调用、观察为 `unknown/observation_gate_rejected`、依赖它的检测器进入 `skipped`，且已存在的 OPEN 候选**不被清除**；
  - 模板返回 `{ values: { name: "x" } }` 记 `metric_result_invalid`，不落 `valuesJson`；
  - 两次同桶调用第二次返回 `claimed_elsewhere`；
  - 检测器连续两 tick 命中同合并键 → 第二次 `hitCount=2` 而不是第二行。
- [ ] **Step 2: 写隔离 MySQL 测试**（环境变量同 Task 4；种子：workspace + OWNER；经真实服务建目录条目并走完分级/授权/连接回执、观察程序与绑定目录的来源，使 `beginObservationSourceRun` 真实通过；再建一个未授权来源），断言：
  - 通过门的来源生成 `ObservationSourceRun`，全部模板 ok 时 `status="SUCCEEDED"`（部分 ok 为 `"PARTIAL"`，全 unknown 为 `"FAILED"`，见 `observation.service.ts:1104`），并有对应审计行，未授权来源没有 run 行、其模板观察为 `unknown`；
  - 合成模板 `count=12` 触发候选 OPEN；下一桶 `count=0` 清除；再下一桶来源门拒绝（撤销程序）时候选保持原状态；
  - 全过程中除 `CaioQuickCheckTick / CaioMetricObservation / CaioAnomalyCandidate / ObservationSourceRun / ObservationSource.lastObservedAt / EnterpriseObservationProgram.runSequence / AuditLog` 外，`information_schema.tables` 的 `table_rows` 与各业务表 `COUNT(*)` 前后一致（取 `Decision*`、`Supervision*`、`Signal*` 表各一张作抽样）。
- [ ] **Step 3: 运行确认失败。**
- [ ] **Step 4: 实现。** 注意 `beginObservationSourceRun` 同一 `executionKey` 幂等返回既有 run：若返回的 run 已是终态（本桶已由崩溃前的实例完成），跳过 `completeObservationSourceRun` 并把该组模板记为 `unknown/observation_run_already_terminal`。
- [ ] **Step 5: 运行通过；变异反证**：把"门拒绝不调用 run"改为照常调用，确认单测失败；把 clear 条件放宽为"未命中即清除"，确认 MySQL 用例"来源门拒绝时候选保持"失败；恢复。
- [ ] **Step 6:** `package.json` 增加 `"test:caio-operating-context:mysql": "vitest run lib/caio-operating-context/schema.mysql.test.ts lib/caio-operating-context/quick-check.mysql.test.ts --config vitest.public.config.ts --fileParallelism=false"`，并登记到 `scripts/public-release-guard.ts` 的 `PUBLIC_PACKAGE_SCRIPT_ALLOW_LIST`。
- [ ] **Step 7: 提交** `feat(caio): 目录门控的 10 分钟快检服务`

---

### Task 6: 快检作业工厂

**Files:**
- Create: `lib/caio-operating-context/quick-check-job.ts`
- Test: `lib/caio-operating-context/quick-check-job.test.ts`

**Interfaces:**
- Consumes: `runCaioQuickCheck`；`SignalCollectionJob`（`lib/signal-collection/types.ts:46`）
- Produces: `CAIO_QUICK_CHECK_ENABLED_ENV = "HELM_CAIO_QUICK_CHECK_ENABLED"`；`createCaioQuickCheckJob(input: { key: string; tenantKey: string; extensionKey: string; resolveWorkspaceIds: () => Promise<readonly string[]> }): SignalCollectionJob`

```ts
export function createCaioQuickCheckJob(input: {
  key: string; tenantKey: string; extensionKey: string;
  resolveWorkspaceIds: () => Promise<readonly string[]>;
}): SignalCollectionJob {
  return {
    key: input.key,
    tenantKey: input.tenantKey,
    extensionKey: input.extensionKey,
    label: "CAIO quick check",
    kind: "signal_collection",
    // Exact "true" only; any other value, including "1" or "TRUE", keeps the job off.
    enabled: () => process.env[CAIO_QUICK_CHECK_ENABLED_ENV] === "true",
    schedule: { timeEnvKey: "HELM_CAIO_QUICK_CHECK_CRON", defaultCron: "*/10 * * * *", defaultTimezone: "Asia/Shanghai" },
    allowedEffects: ["external_read", "internal_signal_write"],
    resolveTargets: async () => (await input.resolveWorkspaceIds()).map((workspaceId) => ({ key: `workspace:${workspaceId}`, workspaceId })),
    runTarget: async (target) => {
      if (!target.workspaceId) return { status: "skipped", message: "workspace_required" };
      const result = await runCaioQuickCheck({ workspaceId: target.workspaceId });
      if (result.status === "claimed_elsewhere") return { status: "skipped", message: "claimed_elsewhere" };
      return {
        status: result.status === "completed" ? "success" : "failed",
        signalCount: result.opened + result.refreshed,
        failureCount: result.failedDetectors,
        details: { known: result.known, unknown: result.unknown, cleared: result.cleared, skippedDetectors: result.skippedDetectors },
      };
    },
  };
}
```

- [ ] **Step 1: 写失败测试**：`enabled()` 仅在 `"true"` 时为真（`"TRUE"`、`"1"`、`" true"`、未设置均为假）；`parseMinuteHourCronSchedule("*/10 * * * *")` 非空；`runTarget` 对 `claimed_elsewhere` 返回 `skipped`；缺 `workspaceId` 不调用服务；`details` 不含模板值或检测器细节。
- [ ] **Step 2–4:** 运行失败 → 实现 → 通过。
- [ ] **Step 5: 提交** `feat(caio): 快检作业工厂（默认关闭）`

---

### Task 7: `/caio`"待关注"读出

**Files:**
- Create: `lib/caio-operating-context/readout.ts`、`features/caio/operating-attention-section.tsx`
- Modify: `app/(workspace)/caio/page.tsx`（在 `Stage1OwnerLoopConsole` 之前渲染区块）
- Test: `lib/caio-operating-context/readout.test.ts`、`features/caio/operating-attention-section.test.tsx`

**Interfaces:**
- Produces: `getCaioOperatingAttentionReadout(input: { workspaceId: string; membershipRole: WorkspaceRole; now?: Date }): Promise<CaioOperatingAttentionReadout | null>`

```ts
export type CaioOperatingAttentionReadout =
  | { available: false }
  | {
      available: true;
      lastTick: { bucketStart: string; status: "RUNNING" | "COMPLETED" | "FAILED"; stale: boolean } | null;
      openCandidates: { detectorId: string; titleZh: string; titleEn: string; severity: CaioAnomalySeverity; reasonCode: string; hitCount: number; firstSeenAt: string; lastSeenAt: string }[];
      unknownTemplates: { templateId: string; domain: string; errorCode: string | null }[];
    };
```

- 非 OWNER → `null` 且不读库；表不存在（P2021）或读失败 → `{ available: false }`，页面显示"暂不可读（读取失败，不按空状态显示）"。
- `lastTick.stale = now - bucketStart > 30 分钟`；页面对 stale 显示"快检未在运行或已停滞"，不显示为"无异常"。
- 候选按严重度降序、`lastSeenAt` 降序，最多 20 条；只渲染标题、严重度、闭集原因码、次数与时间；不渲染证据引用与指标值。
- 未知模板取最近一个 COMPLETED/FAILED tick 下 `status=unknown` 的观察。

- [ ] **Step 1: 写失败测试**：非 OWNER 不读库；P2021 → `available:false`；空候选且 tick 新鲜时区块文案为"本轮快检未发现待关注项"，tick 过期时文案不得出现"未发现"；未知模板非空时列出"读取未知"而不是 0；渲染输出不含 `caio-metric:` 前缀。
- [ ] **Step 2–4:** 运行失败 → 实现 → 通过。
- [ ] **Step 5:** 本地 dev（APFS 克隆 node_modules，端口 3217）以 `/demo` OWNER 打开 `/caio`，确认区块渲染"暂不可读"或空态文案；REVIEWER 仍 `notFound`。
- [ ] **Step 6: 提交** `feat(caio): /caio 待关注读出`

---

### Task 8: P3a 合同修订草案（仅文档，待 owner 批准）

**Files:**
- Modify: `docs/superpowers/specs/2026-09-15-caio-live-operating-core-spec.md`（新增 §5.1"P3a 合同扩展（待批准）"）

内容要点（逐条写入，供 owner 审）：

1. 新来源类 `tenant_self_observation`：租户在自身部署内观察自身经营；单租户。允许用途只有 `operator_triage` 与 `advice_only_risk_review`；其余用途一律拒绝，特别是 `public_eval`、`heldout_eval`、`model_improvement`、`training`、`memory_promotion`、`automatic_customer_action`、`external_send`、`writeback`，也不得进入任何 fleet 聚合。
2. 新 manifest 范围 `tenant_live_shadow`，与 `public_offline_shadow` 并列；`allowedSourceClasses` 仅 `tenant_self_observation`；两个范围的记录不得出现在同一投影输入。
3. 晋升门替代：`tenant_self_observation` 不走 `EvalCasePromotion`，改为要求每个 source binding 引用终态 `ObservationSourceRun`（成功或部分成功）与其目录条目的授权/连接回执；门逻辑在 `validateOperatingSignalImprovementGate` 旁新增独立函数，不修改既有分支。
4. 映射（沿用规格 §5 表）：`CaioMetricObservation(status=ok)` → `EvidenceRef`（`contentIncluded=false`、`contentHash=CaioMetricObservation.contentHash`、`sourceSnapshotHash=sha256(templateId+window)`、`redactionStatus=alias_only`）；`objectKey` → `BusinessObjectAlias`（`deterministic_key`、`personAttributionMode=none`）；每 tick 的 OPEN/新命中候选 → `SignalEvent`（`signalFamily=detectorId`）。
5. 需同步修订的公开文档：`HELM_ENTERPRISE_OPERATING_CONTEXT_MODEL.md` §3、`HELM_OPERATING_HARNESS_REQUIREMENTS.md` 来源治理段；快照仍为可丢弃 read model，不获得任何写、发、执行权限。
6. 不改变 `fleet_customer_health` 与 `oss_governance` 的 fail closed。

- [ ] **Step 1:** 写入 §5.1；`npm run check:public-docs`、`npm run check:caio-terminology`。
- [ ] **Step 2: 提交** `docs(caio): P3a 合同扩展草案（租户自观察，待批准）`；P0-2b 计划在该节获批合入后编写。

---

### Task 9: 文档、门禁与 PR

**Files:** Modify `docs/STATUS.md`（CAIO Pro V1 行补："Public Core 另有经营观察运行时（模板/检测器注册、目录门控 10 分钟快检、候选异常合并、`/caio` 待关注只读读出），开关 `HELM_CAIO_QUICK_CHECK_ENABLED` 默认关闭，未部署未激活；P3a 快照投影待合同扩展获批"；中英两处）。

- [ ] 运行：`npm run typecheck`、`npm run lint`、`npm run test`、`npm run check:boundaries`、`npm run test:caio-operating-context:mysql`、`npm run test:caio-operator:mysql`。
- [ ] 显式列文件提交；开 PR，写明：新增三张 CAIO 自有表与一个迁移、不写业务表、开关默认关闭、未部署、P3a 投影不在本 PR。

## Self-Review

- 规格 §5 覆盖：指标查询注册接缝（Task 1、3）、读失败标未知（Task 1、5、7）、检测器确定性与合并（Task 2、5）、依赖域未知停止触发（Task 2、5）、快检 10 分钟节奏（Task 6）、不含个人级原始数据（Task 1 数值型约束 + 守卫、Task 7 不渲染值）；P3a 映射与快照投影→ Task 8 草案 + P0-2b；小时/日终入队 → P1（规格 §4），不在本计划。
- 规格 §11 P0 放行门"合成数据端到端、影子运行零写入"：Task 5 MySQL 用例含零写入抽样核对。
- 类型一致：`CaioMetricObservationView`、`CaioDetectorHit`、`CaioDetectorRunResult`、`runCaioQuickCheck`、`CaioQuickCheckResult` 在 Task 1/2/5 定义，Task 5/6/7 消费，名称一致。
