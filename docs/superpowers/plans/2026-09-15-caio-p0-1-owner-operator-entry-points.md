---
status: draft / pending-owner-review
owner: helm-core
created: 2026-09-15
review_after: 2026-10-15
public_safety: Public-safe implementation plan for OWNER-only operator entry
  points to existing CAIO governance, data-asset catalog, observation and G0
  initialization services. No customer data, private endpoint, credential,
  production receipt, activation, or production-readiness claim.
---

# CAIO P0-1 OWNER 操作入口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为已成形但只有测试夹具调用的 CAIO 服务提供 OWNER-only、可审计的生产入口（服务端动作 + `/caio/operator` 操作面板），使租户能在真实工作区完成身份绑定、mandate、数据资产目录、观察来源与 G0 初始化。

**Architecture:** 服务层已在事务内做 OWNER 校验并写审计；本计划只加一层薄的服务端动作：会话 → OWNER 预检 → zod 解析 → 调用既有服务 → 闭集错误码 → revalidate。面板为服务端页面加客户端表单，读出复用既有查询。不新增表、不改服务语义。

**Tech Stack:** Next.js 16 App Router 服务端动作、zod、Prisma、vitest（单测 + 既有隔离 MySQL 测试配置）。

**Spec:** `docs/superpowers/specs/2026-09-15-caio-live-operating-core-spec.md` §3。

## Global Constraints

- CEO 身份不从 `WorkspaceRole.OWNER` 推导：动作只要求调用者为 OWNER；`ceoRef` / `ceoPrincipalRef` / `guardianRef` 由服务按已登记 principal binding 校验。
- 动作本身不构成运行时权限；不新增任何执行、派工、外发入口。
- 错误对外只返回闭集错误码与本地化文案，不回显服务内部消息、SQL 或原始输入。
- 所有 principal ref 无冒号（服务既有约束，schema 同步拒绝）。
- 不新增 Prisma 表或迁移。
- 每个服务端动作都有非 OWNER 拒绝测试与服务错误映射测试。
- `npm run check:caio-terminology`、`npm run check:stage1-owner-loop`、`npm run check:boundaries` 保持通过。
- 显式列文件提交；不使用 `git add -A`。

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `lib/caio-operator/operator-error-codes.ts` | 新 | 服务错误 → 闭集错误码与中英文文案（纯函数） |
| `lib/caio-operator/operator-error-codes.test.ts` | 新 | 映射测试 |
| `features/caio-operator/schemas.ts` | 新 | 各操作的 zod 输入 schema |
| `features/caio-operator/schemas.test.ts` | 新 | schema 边界测试 |
| `features/caio-operator/run-owner-operation.ts` | 新 | 通用执行器：会话、OWNER 预检、解析、调用、映射、revalidate |
| `features/caio-operator/actions.ts` | 新 | `"use server"`，每个操作一个导出动作 |
| `features/caio-operator/actions.test.ts` | 新 | 非 OWNER 拒绝、解析失败、成功路径、错误映射 |
| `features/caio-operator/queries.ts` | 新 | 面板读出（复用既有 getter） |
| `features/caio-operator/operator-console.client.tsx` | 新 | 表单与结果显示 |
| `app/(workspace)/caio/operator/page.tsx` | 新 | OWNER-only 页面 |
| `features/caio-operator/actions.mysql.test.ts` | 新 | 隔离 MySQL：真实服务 + mock 会话，验证审计与拒绝 |
| `docs/STATUS.md` | 改 | 更新 CAIO Pro V1 行：OWNER 入口已成形但仍需下一层 |

---

### Task 1: 闭集错误码映射

**Files:** Create `lib/caio-operator/operator-error-codes.ts`，Test `lib/caio-operator/operator-error-codes.test.ts`

**Interfaces — Produces:**

```ts
export const CAIO_OPERATOR_ERROR_CODES = [
  "not_owner", "input_invalid", "governance_rejected", "initialization_rejected",
  "catalog_rejected", "catalog_conflict", "observation_rejected", "observation_denied", "unavailable",
] as const;
export type CaioOperatorErrorCode = (typeof CAIO_OPERATOR_ERROR_CODES)[number];
export function mapCaioOperatorError(error: unknown): CaioOperatorErrorCode;
export function caioOperatorErrorMessage(code: CaioOperatorErrorCode, english: boolean): string;
```

- [ ] **Step 1: 失败测试**

```ts
import { describe, expect, it } from "vitest";
import { CaioMandateStoreError } from "@/lib/caio-governance/mandate-store.service";
import { CaioInitializationGateStoreError } from "@/lib/stage1-owner-loop/caio-initialization-gate-store.service";
import {
  DataAssetCatalogConflictError, DataAssetCatalogContractError, DataAssetCatalogTransitionError,
} from "@/lib/stage1-owner-loop/data-asset-catalog.service";
import { ObservationAuthorizationDeniedError, ObservationContractError } from "@/lib/stage1-owner-loop/observation.service";
import { CAIO_OPERATOR_ERROR_CODES, caioOperatorErrorMessage, mapCaioOperatorError } from "./operator-error-codes";

describe("mapCaioOperatorError", () => {
  it.each([
    [new CaioMandateStoreError("x"), "governance_rejected"],
    [new CaioInitializationGateStoreError("x"), "initialization_rejected"],
    [new DataAssetCatalogContractError("x"), "catalog_rejected"],
    [new DataAssetCatalogTransitionError("x"), "catalog_rejected"],
    [new DataAssetCatalogConflictError("x"), "catalog_conflict"],
    [new ObservationContractError("x"), "observation_rejected"],
    [new ObservationAuthorizationDeniedError("x"), "observation_denied"],
    [new Error("private sql detail"), "unavailable"],
    ["not an error", "unavailable"],
  ])("maps %s to %s", (error, code) => {
    expect(mapCaioOperatorError(error)).toBe(code);
  });

  it("has a zh and en message for every code without echoing internals", () => {
    for (const code of CAIO_OPERATOR_ERROR_CODES) {
      expect(caioOperatorErrorMessage(code, false)).toMatch(/\S/);
      expect(caioOperatorErrorMessage(code, true)).toMatch(/\S/);
      expect(caioOperatorErrorMessage(code, true)).not.toContain("sql");
    }
  });
});
```

执行前核对五个错误类的构造签名（`data-asset-catalog.service.ts:299-327`、`observation.service.ts:503-520`、`mandate-store.service.ts:55`、`caio-initialization-gate-store.service.ts:80`）；若构造参数不是单个 message，按实际签名改测试夹具，不改服务。

- [ ] **Step 2:** `npx vitest run lib/caio-operator/operator-error-codes.test.ts`，期望 FAIL（模块不存在）。
- [ ] **Step 3: 实现**：按 `instanceof` 顺序映射（冲突类在契约类之前判断）；文案表为 `Record<CaioOperatorErrorCode, {zh: string; en: string}>`。
- [ ] **Step 4:** 运行通过。
- [ ] **Step 5:** 提交 `feat(caio): OWNER 操作入口的闭集错误码映射`。

---

### Task 2: 输入 schema

**Files:** Create `features/caio-operator/schemas.ts`，Test `features/caio-operator/schemas.test.ts`

**Interfaces — Produces**（字段与服务签名一一对应；`workspaceId`、`actorUserId`、`english` 由执行器从会话注入，不在 schema 内）：

| schema | 字段 | 对应服务 |
|---|---|---|
| `registerPrincipalBindingSchema` | `userId`、`principalRef`（无冒号，1-120）、`principalKind`（`ceo`/`guardian`/`fde`）、`evidenceRef`（1-191） | `registerCaioPrincipalBinding` |
| `revokePrincipalBindingSchema` | `bindingId` | `revokeCaioPrincipalBinding` |
| `createMandateDraftSchema` | `caioRef`、`ceoRef`、`stage`、`stageDecisionRef`、`objectiveRefs[]`、`scopeRefs[]`、`grantBasisRefs[]`、`reservedMatterRefs[]`、`humanResponsePolicyRef`、`accountabilityAnchorRefs[]`、`guardianStopRefs[]`、`validFrom`、`validUntil`（ISO 时间）、`inFlightDisposition`、`auditRefs[]` | `createCaioMandateDraft` |
| `mandateTransitionSchema` | `actorCeoRef`、`mandateRecordId`、可选 `supersedesRecordId` | `activateCaioMandate` / `suspendCaioMandate` / `revokeCaioMandate` |
| `guardianStopSchema` | `guardianRef`、`mandateRecordId`、`reason`（1-500）、`auditRefs[]` | `recordCaioGuardianStop` |
| `resumeGuardianStopSchema` | `actorCeoRef`、`stopRecordId` | `resumeCaioGuardianStop` |
| `createCatalogEntrySchema` | 与 `createDataAssetCatalogEntry` 输入除 `workspaceId` 外全部字段一致（执行时从服务签名逐字段复制，含 `nextReviewAt` 之后的字段） | `createDataAssetCatalogEntry` |
| `catalogStageSchemas` | classification / authorization / connection / initialization 四个，字段为各服务 `CommonStageInput & {...}` 除注入字段外的全部字段 | `recordDataAsset*Receipt` |
| `createObservationProgramSchema` | `purpose`、`scopeRefs[]`、`dataCategories[]`、`startsAt`、`expiresAt`、`retentionDays`、`authorizationRef` | `createEnterpriseObservationProgram`（`actorName` 由会话注入） |
| `registerObservationSourceSchema` | `programId`、`catalogEntryId`、`sourceKey`、`sourceKind`、`accessMode`、`ownerRef`、`freshnessSlaMinutes`、`sensitivity`、`authorizationRef`、`secretRef`、`retentionDays` | `registerObservationSource` |
| `recordInitializationAssessmentSchema` | `mandateRecordId`、`evaluationKey` | `recordCaioInitializationAssessment` |
| `acceptInitializationGateSchema` | `assessmentId`、`ceoPrincipalRef`、`idempotencyKey`、`inventoryConfirmationRef`、`customerAcceptanceRef`、`acceptedExceptionRefs[]`、`reasonCodes[]`、`evidenceRefs[]` | `acceptCaioInitializationGate` |
| `revokeInitializationGateSchema` | `ceoPrincipalRef`、`idempotencyKey`、`reasonCodes[]`、`evidenceRefs[]` | `revokeCaioInitializationGate` |

枚举值（`stage`、`inFlightDisposition`、`accessMode`、`sensitivity`、catalog 各阶段状态）必须从既有类型的常量数组派生（`z.enum(EXISTING_CONST)`）；若服务只有 type 没有常量数组，先在对应合同文件导出常量并在该文件原有测试中断言与 type 一致，再引用，不在 schema 中手抄。

- [ ] **Step 1: 失败测试**（每个 schema 至少：合法样例通过；缺必填字段拒绝；principal ref 含冒号拒绝；数组元素空串拒绝；超长拒绝；ISO 时间非法拒绝；未知键被 `.strict()` 拒绝）。示例：

```ts
import { describe, expect, it } from "vitest";
import { acceptInitializationGateSchema, registerPrincipalBindingSchema } from "./schemas";

describe("registerPrincipalBindingSchema", () => {
  const valid = { userId: "user_1", principalRef: "ceo-primary", principalKind: "ceo", evidenceRef: "evidence:board-minute-1" };
  it("accepts a colon-free principal ref", () => {
    expect(registerPrincipalBindingSchema.parse(valid)).toEqual(valid);
  });
  it.each([
    [{ ...valid, principalRef: "ceo:primary" }],
    [{ ...valid, principalKind: "owner" }],
    [{ ...valid, evidenceRef: "" }],
    [{ ...valid, extra: true }],
  ])("rejects %j", (input) => {
    expect(registerPrincipalBindingSchema.safeParse(input).success).toBe(false);
  });
});

describe("acceptInitializationGateSchema", () => {
  it("requires every reference array to hold non-empty strings", () => {
    const base = { assessmentId: "a1", ceoPrincipalRef: "ceo-primary", idempotencyKey: "k1", inventoryConfirmationRef: "inv:1",
      customerAcceptanceRef: "acc:1", acceptedExceptionRefs: [], reasonCodes: ["ready"], evidenceRefs: ["ev:1"] };
    expect(acceptInitializationGateSchema.safeParse(base).success).toBe(true);
    expect(acceptInitializationGateSchema.safeParse({ ...base, evidenceRefs: [""] }).success).toBe(false);
  });
});
```

- [ ] **Step 2:** 运行确认失败。
- [ ] **Step 3:** 实现 schema（全部 `.strict()`；ref 统一 `z.string().trim().min(1).max(191)`；principal ref 追加 `.refine(v => !v.includes(":"))`）。
- [ ] **Step 4:** 通过。
- [ ] **Step 5:** 提交 `feat(caio): OWNER 操作入口输入 schema`。

---

### Task 3: 通用执行器与治理类动作

**Files:** Create `features/caio-operator/run-owner-operation.ts`、`features/caio-operator/actions.ts`，Test `features/caio-operator/actions.test.ts`

**Interfaces — Produces:**

```ts
export type CaioOperatorResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: CaioOperatorErrorCode; message: string };

export async function runOwnerOperation<S extends z.ZodTypeAny, T>(args: {
  schema: S;
  rawInput: unknown;
  invoke: (ctx: { workspaceId: string; actorUserId: string; actorName: string; english: boolean }, input: z.infer<S>) => Promise<T>;
  revalidate?: readonly string[];
}): Promise<CaioOperatorResult<T>>;
```

执行器实现：

```ts
import { WorkspaceRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  caioOperatorErrorMessage, mapCaioOperatorError, type CaioOperatorErrorCode,
} from "@/lib/caio-operator/operator-error-codes";

export type CaioOperatorResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: CaioOperatorErrorCode; message: string };

export async function runOwnerOperation<S extends z.ZodTypeAny, T>(args: {
  schema: S;
  rawInput: unknown;
  invoke: (ctx: { workspaceId: string; actorUserId: string; actorName: string; english: boolean }, input: z.infer<S>) => Promise<T>;
  revalidate?: readonly string[];
}): Promise<CaioOperatorResult<T>> {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";
  const fail = (code: CaioOperatorErrorCode): CaioOperatorResult<T> =>
    ({ ok: false, code, message: caioOperatorErrorMessage(code, english) });
  // Pre-check only; the services re-check OWNER inside their transaction.
  if (membership.role !== WorkspaceRole.OWNER) return fail("not_owner");
  const parsed = args.schema.safeParse(args.rawInput);
  if (!parsed.success) return fail("input_invalid");
  try {
    const value = await args.invoke(
      { workspaceId: workspace.id, actorUserId: user.id, actorName: user.name, english },
      parsed.data,
    );
    for (const path of args.revalidate ?? ["/caio", "/caio/operator"]) revalidatePath(path);
    return { ok: true, value };
  } catch (error) {
    return fail(mapCaioOperatorError(error));
  }
}
```

治理类动作（本任务）：`registerPrincipalBindingAction`、`revokePrincipalBindingAction`、`createMandateDraftAction`、`activateMandateAction`、`suspendMandateAction`、`revokeMandateAction`、`recordGuardianStopAction`、`resumeGuardianStopAction`。每个动作形如：

```ts
export async function registerPrincipalBindingAction(rawInput: unknown) {
  return runOwnerOperation({
    schema: registerPrincipalBindingSchema,
    rawInput,
    invoke: (ctx, input) => registerCaioPrincipalBinding({ ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english })
      .then((binding) => ({ bindingId: binding.id })),
  });
}
```

返回值只含记录 id 与状态，不回传整行。

- [ ] **Step 1: 失败测试**（mock `@/lib/auth/session`、`next/cache`、`@/lib/caio-governance/mandate-store.service`）：
  - 非 OWNER（`WorkspaceRole.ADMIN`、`MEMBER`）→ `{ ok:false, code:"not_owner" }`，服务未调用。
  - 解析失败 → `input_invalid`，服务未调用。
  - 成功 → 服务收到注入的 `workspaceId`/`actorUserId`/`english`，返回 `{ ok:true, value:{ bindingId } }`，`revalidatePath` 调用 `/caio` 与 `/caio/operator`。
  - 服务抛 `CaioMandateStoreError("private detail")` → `governance_rejected`，`message` 不含 `private detail`。
  - 服务抛普通 Error → `unavailable`。
  - 对 8 个动作各做一次"成功路径参数注入"断言。
- [ ] **Step 2:** 运行确认失败。
- [ ] **Step 3:** 实现。
- [ ] **Step 4:** 通过。
- [ ] **Step 5:** 提交 `feat(caio): OWNER 治理类服务端动作（身份绑定、mandate、guardian 急停/CEO 恢复）`。

---

### Task 4: 数据资产目录与观察来源动作

**Files:** Modify `features/caio-operator/actions.ts`，Test `features/caio-operator/actions.test.ts`

动作：`createCatalogEntryAction`、`recordCatalogClassificationAction`、`recordCatalogAuthorizationAction`、`recordCatalogConnectionAction`、`recordCatalogInitializationAction`、`createObservationProgramAction`、`registerObservationSourceAction`。观察运行（`begin/completeObservationSourceRun`）**不开放**给操作面板，由 P0-2 快照运行时调用。

- [ ] **Step 1: 失败测试**：同 Task 3 的五类断言，服务 mock 改为 `data-asset-catalog.service` 与 `observation.service`；`DataAssetCatalogConflictError` → `catalog_conflict`；`ObservationAuthorizationDeniedError` → `observation_denied`；`createObservationProgramAction` 与 `registerObservationSourceAction` 断言 `actorName` 来自会话。
- [ ] **Step 2-4:** 失败 → 实现 → 通过。
- [ ] **Step 5:** 提交 `feat(caio): OWNER 数据资产目录与观察来源服务端动作`。

---

### Task 5: G0 初始化动作与状态读出

**Files:** Modify `features/caio-operator/actions.ts`；Create `features/caio-operator/queries.ts`；Test 同上

动作：`recordInitializationAssessmentAction`、`acceptInitializationGateAction`、`revokeInitializationGateAction`。读出：`getCaioOperatorReadout({ workspaceId, actorUserId, english })` 组合 `getCaioInitializationGateStatus`、当前 mandate（`getCaioMandateWithStops`，按执行时核对的入参）与目录条目列表（复用 `features/dashboard/stage1-owner-loop-query.ts` 已有读取，不新写 SQL）。

- [ ] **Step 1: 失败测试**：五类断言；`acceptInitializationGateAction` 断言 `idempotencyKey` 原样透传且同一 key 重复调用时服务返回的幂等结果原样返回；`CaioInitializationGateStoreError` → `initialization_rejected`。
- [ ] **Step 2-4:** 失败 → 实现 → 通过。
- [ ] **Step 5:** 提交 `feat(caio): OWNER G0 初始化服务端动作与操作读出`。

---

### Task 6: `/caio/operator` 操作面板

**Files:** Create `app/(workspace)/caio/operator/page.tsx`、`features/caio-operator/operator-console.client.tsx`

- 页面：`getCurrentWorkspaceSession()`；非 OWNER `notFound()`（与 `/caio` 同一边界写法）；读出 `getCaioOperatorReadout`；渲染 `PageHeader`（沿用 `/caio` 的 CAIO 品牌文案，不新增术语）与 `OperatorConsole`。
- 面板分五区：身份绑定、mandate 与急停、数据资产目录、观察来源、G0 初始化。每区显示当前状态（只读）与对应表单；提交后显示闭集结果文案。
- 页面顶部固定边界说明："本页只登记治理记录与初始化证据，不授予任何运行时权限，不触发执行或外发。"
- 设计遵循 `DESIGN.md`：判断优先、浅色、克制；不做仪表盘装饰。

- [ ] **Step 1:** 用 `npm run lint` 的 react-hooks 规则约束客户端组件（不在 effect 内同步 setState；表单状态用 `useActionState`）。
- [ ] **Step 2:** `npm run typecheck`、`npm run lint`。
- [ ] **Step 3:** 本地 `npm run dev` 以 seed OWNER 账户打开 `/caio/operator`，以非 OWNER 账户确认 404；截图留档。
- [ ] **Step 4:** 提交 `feat(caio): /caio/operator OWNER 操作面板`。

---

### Task 7: 隔离 MySQL 端到端

**Files:** Create `features/caio-operator/actions.mysql.test.ts`（纳入既有 `test:caio-pro-v1:mysql` 或同类隔离配置，按执行时 `package.json` 实际脚本选择）

- mock 会话为种子 OWNER；真实调用服务：登记 CEO 与 guardian 绑定 → 创建并激活 mandate → 创建目录条目并走完四阶段回执 → 创建观察程序与来源 → 记录 G0 评估。
- 断言：每步 `AuditLog` 有对应 `actionType`；非 OWNER 会话（同库另一成员）每个动作返回 `not_owner` 且无新增审计行；guardian 急停后以 guardian 身份恢复被服务拒绝（`governance_rejected`），以 CEO 恢复成功。

- [ ] **Step 1-4:** 写测试 → 运行 → 修正实现 → 通过（`HELM_*` 隔离库环境变量按既有 mysql 测试说明设置）。
- [ ] **Step 5:** 提交 `test(caio): OWNER 操作入口隔离 MySQL 端到端`。

---

### Task 8: 文档、门禁与 PR

**Files:** Modify `docs/STATUS.md`（CAIO Pro V1 行补一句"OWNER 操作入口已成形但仍需下一层，未部署未激活"）

- [ ] 运行：`npm run typecheck`、`npm run lint`、`npm run test`、`npm run check:boundaries`、`npm run check:caio-terminology`、`npm run check:stage1-owner-loop`、隔离 MySQL 测试。
- [ ] 显式列文件提交；开 PR，描述写明：无新表、无运行时权限、无执行入口、未部署。

## Self-Review

- 规格 §3 覆盖：身份绑定登记与吊销（Task 3）、mandate 草稿/激活/暂停/撤销（Task 3）、guardian 指定（CEO 以 `principalKind=guardian` 登记绑定，Task 3）、目录与各阶段回执（Task 4）、观察程序与来源（Task 4；运行留给 P0-2）、G0 评估/受理/撤销（Task 5）。
- guardian 只停不启由服务既有合同保证，Task 7 端到端验证。
- 类型一致：`CaioOperatorResult`、`CaioOperatorErrorCode`、`runOwnerOperation` 在 Task 1/3 定义，Task 4/5/6 消费。
