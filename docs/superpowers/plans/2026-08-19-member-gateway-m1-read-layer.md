---
status: archived / executed-with-as-built-record
owner: helm-core
created: 2026-08-19
review_after: 2026-09-19
public_safety: Implementation plan for the public member-gateway contract
  slice, with as-built deviation record. No customer data, credential,
  private endpoint, or production-readiness claim.
---

# Member Gateway M1 (读层契约) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `helm-public` 落地 Member Gateway M1 读层的公共契约:成员主体、七元读取面判定、投影决定(含判定依据)、统一 envelope 校验,以及冻结门禁脚本。

**Architecture:** 纯契约切片,与 `lib/caio-governance` 同构——`lib/member-gateway/` 下 `types.ts`(冻结字面量与类型)+ `contract.ts`(确定性判定,无 IO)+ 同址 vitest 测试 + `index.ts`。不实现 MCP 服务器、存储或真实运行时;不新增任何权限;Work Packet 在 schema 上不可表达。设计真值:`docs/superpowers/specs/2026-08-19-member-workbuddy-caio-gateway-design.md`。

**Tech Stack:** TypeScript 严格模式、vitest(`vitest.public.config.ts`,`@/` 路径别名)、tsx 检查脚本、husky pre-commit(会全量跑 `check:boundaries`,每次 commit 必须保持全仓绿)。

**分支:** 在 `helm-public` 仓库内从 `docs/member-workbuddy-caio-gateway-design` 分支继续,或新建 `feat/member-gateway-m1`。

**复用的既有类型(不要重新定义):**
- `ObservationSensitivity` = `"public" | "internal" | "confidential" | "restricted"`,来自 `@/lib/stage1-owner-loop/types`
- `DataAssetProcessingDisposition` = `"prohibited" | "local_only" | "remote_projected"`,来自 `@/lib/stage1-owner-loop/data-asset-catalog.types`

---

### Task 1: 冻结类型模块 `lib/member-gateway/types.ts`

**Files:**
- Create: `lib/member-gateway/types.ts`
- Test: `lib/member-gateway/types.test.ts`

- [ ] **Step 1: 写失败测试(冻结字面量)**

```ts
// lib/member-gateway/types.test.ts
import { describe, expect, it } from "vitest";

import {
  MEMBER_GATEWAY_L1_TOOLS,
  MEMBER_GATEWAY_PROJECTIONS,
  MEMBER_PROJECTION_BLOCK_REASONS,
  MEMBER_READ_SURFACE_DIMENSIONS,
  METADATA_ONLY_FIELD_WHITELIST,
} from "@/lib/member-gateway/types";

describe("member-gateway frozen literals", () => {
  it("freezes the projection ladder to exactly two levels", () => {
    expect(MEMBER_GATEWAY_PROJECTIONS).toEqual([
      "remote_projected",
      "metadata_only",
    ]);
  });

  it("freezes the seven read-surface dimensions in spec order", () => {
    expect(MEMBER_READ_SURFACE_DIMENSIONS).toEqual([
      "live_membership",
      "tool_scope",
      "object_relationship_authorization",
      "field_purpose_policy",
      "source_authorization",
      "tenant_provider_egress_policy",
      "current_classification",
    ]);
  });

  it("freezes the six L1 tools", () => {
    expect(MEMBER_GATEWAY_L1_TOOLS).toEqual([
      "get_my_brief",
      "ask_caio",
      "get_caio_answer",
      "continue_caio_question",
      "query_evidence",
      "get_context_pack",
    ]);
  });

  it("metadata_only is a whitelist and never includes content fields", () => {
    expect(METADATA_ONLY_FIELD_WHITELIST).toEqual([
      "objectKind",
      "evidenceRef",
      "classifiedAt",
      "freshness",
      "requiresLocalView",
    ]);
    for (const banned of ["title", "body", "customerName", "personName"]) {
      expect(METADATA_ONLY_FIELD_WHITELIST).not.toContain(banned);
    }
  });

  it("freezes the block reasons including LOCAL_VIEW_REQUIRED", () => {
    expect(MEMBER_PROJECTION_BLOCK_REASONS).toContain("LOCAL_VIEW_REQUIRED");
    expect(MEMBER_PROJECTION_BLOCK_REASONS).toContain("read_surface_denied");
    expect(MEMBER_PROJECTION_BLOCK_REASONS).toContain("classification_unknown");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/member-gateway/types.test.ts --config vitest.public.config.ts`
Expected: FAIL — `Cannot find module '@/lib/member-gateway/types'`

- [ ] **Step 3: 写类型模块**

```ts
// lib/member-gateway/types.ts
// Member Gateway contract types — the client-neutral tool surface between
// employee agent clients (Tencent WorkBuddy is the first reference client)
// and Helm CAIO.
// Design truth: docs/superpowers/specs/2026-08-19-member-workbuddy-caio-gateway-design.md
//
// Frozen boundary: this module defines contracts and deterministic judgment
// inputs only. It grants no permission, performs no IO, and — like
// dispatchTargetCategories in lib/caio-governance — keeps Work Packet
// dispatch schema-inexpressible: no object kind, payload field, or submit
// action for dispatch exists here.

import type { DataAssetProcessingDisposition } from "@/lib/stage1-owner-loop/data-asset-catalog.types";
import type { ObservationSensitivity } from "@/lib/stage1-owner-loop/types";

export const MEMBER_GATEWAY_PROJECTIONS = [
  "remote_projected",
  "metadata_only",
] as const;

export type MemberGatewayProjection =
  (typeof MEMBER_GATEWAY_PROJECTIONS)[number];

export const MEMBER_GATEWAY_L1_TOOLS = [
  "get_my_brief",
  "ask_caio",
  "get_caio_answer",
  "continue_caio_question",
  "query_evidence",
  "get_context_pack",
] as const;

export type MemberGatewayL1Tool = (typeof MEMBER_GATEWAY_L1_TOOLS)[number];

// The member principal. A workspace member session plus a registered device
// and clientId. WorkspaceRole.OWNER can never prove CEO identity; the CEO
// principal binding is a private-overlay concern and is not expressible in
// this contract.
export type MemberPrincipal = {
  workspaceRef: string;
  memberRef: string;
  sessionRef: string;
  deviceRegistrationRef: string;
  clientId: string;
};

// Seven-way effective read surface (spec §8.1, frozen intersection). Every
// dimension must present explicit evidence per object per call; a missing
// dimension is a denial, never a default-allow. "Related to me" is a display
// concept, not an authorization basis.
export const MEMBER_READ_SURFACE_DIMENSIONS = [
  "live_membership",
  "tool_scope",
  "object_relationship_authorization",
  "field_purpose_policy",
  "source_authorization",
  "tenant_provider_egress_policy",
  "current_classification",
] as const;

export type MemberReadSurfaceDimension =
  (typeof MEMBER_READ_SURFACE_DIMENSIONS)[number];

export type MemberObjectClassification = {
  sensitivity: ObservationSensitivity;
  processingDisposition: DataAssetProcessingDisposition;
  classifiedAt: string;
};

export type MemberReadSurfaceInput = {
  workspaceRef: string;
  memberRef: string;
  objectRef: string;
  tool: MemberGatewayL1Tool;
  purpose: string;
  // Evidence per dimension: an authorization ref, or null when absent.
  liveMembershipRef: string | null;
  toolScopeRef: string | null;
  objectRelationshipAuthorizationRef: string | null;
  fieldPurposePolicyRef: string | null;
  sourceAuthorizationRef: string | null;
  tenantProviderEgressPolicyRef: string | null;
  // null means unclassified; judgment treats it as restricted + local_only
  // and blocks (spec §8.1).
  classification: MemberObjectClassification | null;
};

export type MemberReadSurfaceDecision =
  | { allowed: true; deniedDimensions: readonly [] }
  | { allowed: false; deniedDimensions: readonly MemberReadSurfaceDimension[] };

// metadata_only is a field WHITELIST, not "everything except the body":
// object existence, customer/project names, and person relationships leak.
export const METADATA_ONLY_FIELD_WHITELIST = [
  "objectKind",
  "evidenceRef",
  "classifiedAt",
  "freshness",
  "requiresLocalView",
] as const;

export type MetadataOnlyField = (typeof METADATA_ONLY_FIELD_WHITELIST)[number];

export const MEMBER_PROJECTION_BLOCK_REASONS = [
  "LOCAL_VIEW_REQUIRED",
  "read_surface_denied",
  "classification_unknown",
  "provider_not_approved",
  "purpose_missing",
] as const;

export type MemberProjectionBlockReason =
  (typeof MEMBER_PROJECTION_BLOCK_REASONS)[number];

// Projection decision evidence carried on every envelope (spec §8.2).
export type MemberProjectionDecision = {
  projection: MemberGatewayProjection | null;
  projectionPolicyRef: string;
  projectionPolicyVersion: number;
  providerRef: string;
  purpose: string;
  classifiedAt: string | null;
  deniedFields: readonly string[];
  blockReason: MemberProjectionBlockReason | null;
};

export type MemberToolBoundary = {
  authorityEffect: "none";
  externalExecutionAllowed: false;
  decision: MemberProjectionDecision;
};

export type MemberToolEnvelope<T> = {
  ok: boolean;
  requestId: string;
  serverTime: string;
  data: T | null;
  error: null | { code: string; message: string; retryable: boolean };
  boundary: MemberToolBoundary;
};
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/member-gateway/types.test.ts --config vitest.public.config.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/member-gateway/types.ts lib/member-gateway/types.test.ts
git commit -m "feat(member-gateway): add frozen contract types for M1 read layer"
```

注意:pre-commit 会全量跑 `check:boundaries`,预计数分钟;新文件是纯增量,不应触发既有门禁。

---

### Task 2: 主体校验与七元读取面判定

**Files:**
- Create: `lib/member-gateway/contract.ts`
- Test: `lib/member-gateway/contract.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// lib/member-gateway/contract.test.ts
import { describe, expect, it } from "vitest";

import {
  decideMemberReadSurface,
  validateMemberPrincipal,
} from "@/lib/member-gateway/contract";
import type {
  MemberPrincipal,
  MemberReadSurfaceInput,
} from "@/lib/member-gateway/types";

function makePrincipal(
  overrides: Partial<MemberPrincipal> = {},
): MemberPrincipal {
  return {
    workspaceRef: "workspace-1",
    memberRef: "member-1",
    sessionRef: "session-1",
    deviceRegistrationRef: "device-1",
    clientId: "workbuddy-desktop",
    ...overrides,
  };
}

function makeSurfaceInput(
  overrides: Partial<MemberReadSurfaceInput> = {},
): MemberReadSurfaceInput {
  return {
    workspaceRef: "workspace-1",
    memberRef: "member-1",
    objectRef: "case-42",
    tool: "query_evidence",
    purpose: "call_preparation",
    liveMembershipRef: "membership-1",
    toolScopeRef: "tool-scope-1",
    objectRelationshipAuthorizationRef: "object-auth-1",
    fieldPurposePolicyRef: "field-policy-1",
    sourceAuthorizationRef: "source-auth-1",
    tenantProviderEgressPolicyRef: "egress-policy-1",
    classification: {
      sensitivity: "internal",
      processingDisposition: "remote_projected",
      classifiedAt: "2026-08-19T00:00:00Z",
    },
    ...overrides,
  };
}

describe("validateMemberPrincipal", () => {
  it("accepts a complete principal", () => {
    expect(validateMemberPrincipal(makePrincipal())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects each missing binding with a named error", () => {
    expect(
      validateMemberPrincipal(makePrincipal({ sessionRef: "" })).errors,
    ).toContain("session_ref_missing");
    expect(
      validateMemberPrincipal(makePrincipal({ deviceRegistrationRef: " " }))
        .errors,
    ).toContain("device_registration_missing");
    expect(
      validateMemberPrincipal(makePrincipal({ clientId: "" })).errors,
    ).toContain("client_id_missing");
  });
});

describe("decideMemberReadSurface", () => {
  it("allows only when all seven dimensions carry explicit evidence", () => {
    expect(decideMemberReadSurface(makeSurfaceInput())).toEqual({
      allowed: true,
      deniedDimensions: [],
    });
  });

  it("denies per missing dimension and names every gap", () => {
    const decision = decideMemberReadSurface(
      makeSurfaceInput({
        toolScopeRef: null,
        tenantProviderEgressPolicyRef: null,
      }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.deniedDimensions).toEqual([
      "tool_scope",
      "tenant_provider_egress_policy",
    ]);
  });

  it("treats unclassified objects as a denial, never a default-allow", () => {
    const decision = decideMemberReadSurface(
      makeSurfaceInput({ classification: null }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.deniedDimensions).toEqual(["current_classification"]);
  });

  it("whitespace-only refs count as missing", () => {
    const decision = decideMemberReadSurface(
      makeSurfaceInput({ liveMembershipRef: "  " }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.deniedDimensions).toEqual(["live_membership"]);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/member-gateway/contract.test.ts --config vitest.public.config.ts`
Expected: FAIL — `Cannot find module '@/lib/member-gateway/contract'`

- [ ] **Step 3: 写实现**

```ts
// lib/member-gateway/contract.ts
// Deterministic judgment for the Member Gateway read layer. Pure functions,
// no IO. Fail-closed: missing evidence is always a denial.

import type {
  MemberPrincipal,
  MemberReadSurfaceDecision,
  MemberReadSurfaceDimension,
  MemberReadSurfaceInput,
} from "@/lib/member-gateway/types";

export type ContractValidation = { valid: boolean; errors: string[] };

function hasRef(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateMemberPrincipal(
  principal: MemberPrincipal,
): ContractValidation {
  const errors: string[] = [];
  if (!hasRef(principal.workspaceRef)) {
    errors.push("workspace_ref_missing");
  }
  if (!hasRef(principal.memberRef)) {
    errors.push("member_ref_missing");
  }
  if (!hasRef(principal.sessionRef)) {
    errors.push("session_ref_missing");
  }
  if (!hasRef(principal.deviceRegistrationRef)) {
    errors.push("device_registration_missing");
  }
  if (!hasRef(principal.clientId)) {
    errors.push("client_id_missing");
  }
  return { valid: errors.length === 0, errors };
}

// Seven-way intersection (spec §8.1). Every dimension must present explicit
// evidence per object per call; the decision names every denied dimension so
// callers can log a machine-readable block reason.
export function decideMemberReadSurface(
  input: MemberReadSurfaceInput,
): MemberReadSurfaceDecision {
  const denied: MemberReadSurfaceDimension[] = [];
  if (!hasRef(input.liveMembershipRef)) {
    denied.push("live_membership");
  }
  if (!hasRef(input.toolScopeRef)) {
    denied.push("tool_scope");
  }
  if (!hasRef(input.objectRelationshipAuthorizationRef)) {
    denied.push("object_relationship_authorization");
  }
  if (!hasRef(input.fieldPurposePolicyRef)) {
    denied.push("field_purpose_policy");
  }
  if (!hasRef(input.sourceAuthorizationRef)) {
    denied.push("source_authorization");
  }
  if (!hasRef(input.tenantProviderEgressPolicyRef)) {
    denied.push("tenant_provider_egress_policy");
  }
  if (input.classification === null) {
    denied.push("current_classification");
  }
  if (denied.length > 0) {
    return { allowed: false, deniedDimensions: denied };
  }
  return { allowed: true, deniedDimensions: [] };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/member-gateway/contract.test.ts --config vitest.public.config.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/member-gateway/contract.ts lib/member-gateway/contract.test.ts
git commit -m "feat(member-gateway): add principal validation and seven-way read surface judgment"
```

---

### Task 3: 投影决定 `decideMemberProjection`

**Files:**
- Modify: `lib/member-gateway/contract.ts`(追加)
- Modify: `lib/member-gateway/contract.test.ts`(追加)

- [ ] **Step 1: 追加失败测试**

在 `contract.test.ts` 末尾追加(import 处增加 `decideMemberProjection` 与类型 `MemberProjectionInput`):

```ts
import { decideMemberProjection } from "@/lib/member-gateway/contract";
import type { MemberProjectionInput } from "@/lib/member-gateway/contract";

function makeProjectionInput(
  overrides: Partial<MemberProjectionInput> = {},
): MemberProjectionInput {
  return {
    surface: { allowed: true, deniedDimensions: [] },
    classification: {
      sensitivity: "internal",
      processingDisposition: "remote_projected",
      classifiedAt: "2026-08-19T00:00:00Z",
    },
    providerRef: "provider-profile-1",
    purpose: "call_preparation",
    projectionPolicyRef: "projection-policy-1",
    projectionPolicyVersion: 3,
    requestedFields: ["objectKind", "evidenceRef", "summary"],
    ...overrides,
  };
}

describe("decideMemberProjection", () => {
  it("projects remote_projected with full decision evidence", () => {
    const decision = decideMemberProjection(makeProjectionInput());
    expect(decision.projection).toBe("remote_projected");
    expect(decision.blockReason).toBeNull();
    expect(decision.projectionPolicyRef).toBe("projection-policy-1");
    expect(decision.projectionPolicyVersion).toBe(3);
    expect(decision.providerRef).toBe("provider-profile-1");
    expect(decision.purpose).toBe("call_preparation");
    expect(decision.classifiedAt).toBe("2026-08-19T00:00:00Z");
  });

  it("denied surface blocks with read_surface_denied", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({
        surface: { allowed: false, deniedDimensions: ["tool_scope"] },
      }),
    );
    expect(decision.projection).toBeNull();
    expect(decision.blockReason).toBe("read_surface_denied");
  });

  it("unknown classification blocks as classification_unknown", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({ classification: null }),
    );
    expect(decision.projection).toBeNull();
    expect(decision.blockReason).toBe("classification_unknown");
  });

  it("unapproved provider blocks as provider_not_approved", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({ providerRef: null }),
    );
    expect(decision.projection).toBeNull();
    expect(decision.blockReason).toBe("provider_not_approved");
  });

  it("missing purpose blocks as purpose_missing", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({ purpose: " " }),
    );
    expect(decision.projection).toBeNull();
    expect(decision.blockReason).toBe("purpose_missing");
  });

  it("prohibited disposition returns LOCAL_VIEW_REQUIRED", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({
        classification: {
          sensitivity: "restricted",
          processingDisposition: "prohibited",
          classifiedAt: "2026-08-19T00:00:00Z",
        },
      }),
    );
    expect(decision.projection).toBeNull();
    expect(decision.blockReason).toBe("LOCAL_VIEW_REQUIRED");
  });

  it("local_only downgrades to metadata_only and names denied fields", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({
        classification: {
          sensitivity: "confidential",
          processingDisposition: "local_only",
          classifiedAt: "2026-08-19T00:00:00Z",
        },
        requestedFields: ["objectKind", "summary", "customerName"],
      }),
    );
    expect(decision.projection).toBe("metadata_only");
    expect(decision.deniedFields).toEqual(["summary", "customerName"]);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/member-gateway/contract.test.ts --config vitest.public.config.ts`
Expected: FAIL — `decideMemberProjection is not a function` / 找不到导出

- [ ] **Step 3: 追加实现**

在 `contract.ts` 末尾追加(import 处增加 `METADATA_ONLY_FIELD_WHITELIST`、`MemberObjectClassification`、`MemberProjectionDecision`):

```ts
import {
  METADATA_ONLY_FIELD_WHITELIST,
  type MemberObjectClassification,
  type MemberProjectionDecision,
} from "@/lib/member-gateway/types";

export type MemberProjectionInput = {
  surface: MemberReadSurfaceDecision;
  classification: MemberObjectClassification | null;
  // The tenant-approved provider profile for this client; null when the
  // client's provider is not on the tenant egress allowlist.
  providerRef: string | null;
  purpose: string;
  projectionPolicyRef: string;
  projectionPolicyVersion: number;
  requestedFields: readonly string[];
};

// Projection judgment (spec §8.2). Order matters and is fail-closed:
// surface → purpose → provider → classification → disposition ladder.
export function decideMemberProjection(
  input: MemberProjectionInput,
): MemberProjectionDecision {
  const base = {
    projectionPolicyRef: input.projectionPolicyRef,
    projectionPolicyVersion: input.projectionPolicyVersion,
    providerRef: input.providerRef ?? "",
    purpose: input.purpose,
    classifiedAt: input.classification?.classifiedAt ?? null,
    deniedFields: [] as readonly string[],
  };
  if (!input.surface.allowed) {
    return { ...base, projection: null, blockReason: "read_surface_denied" };
  }
  if (!hasRef(input.purpose)) {
    return { ...base, projection: null, blockReason: "purpose_missing" };
  }
  if (!hasRef(input.providerRef)) {
    return { ...base, projection: null, blockReason: "provider_not_approved" };
  }
  if (input.classification === null) {
    // Unknown classification defaults to restricted + local_only (spec §8.1)
    // and is never projectable remotely.
    return {
      ...base,
      projection: null,
      blockReason: "classification_unknown",
    };
  }
  if (input.classification.processingDisposition === "prohibited") {
    return { ...base, projection: null, blockReason: "LOCAL_VIEW_REQUIRED" };
  }
  if (input.classification.processingDisposition === "local_only") {
    const whitelist = new Set<string>(METADATA_ONLY_FIELD_WHITELIST);
    const deniedFields = input.requestedFields.filter(
      (field) => !whitelist.has(field),
    );
    return {
      ...base,
      projection: "metadata_only",
      deniedFields,
      blockReason: null,
    };
  }
  return { ...base, projection: "remote_projected", blockReason: null };
}
```

注意:实际提交时把新增 import 合并进文件顶部既有 import 块(ESLint 不允许 import 出现在文件中部)。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/member-gateway/contract.test.ts --config vitest.public.config.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/member-gateway/contract.ts lib/member-gateway/contract.test.ts
git commit -m "feat(member-gateway): add fail-closed projection judgment with decision evidence"
```

---

### Task 4: envelope 校验 `validateMemberToolEnvelope`

**Files:**
- Modify: `lib/member-gateway/contract.ts`(追加)
- Modify: `lib/member-gateway/contract.test.ts`(追加)

- [ ] **Step 1: 追加失败测试**

```ts
import { validateMemberToolEnvelope } from "@/lib/member-gateway/contract";
import type { MemberToolEnvelope } from "@/lib/member-gateway/types";

function makeEnvelope(
  overrides: Partial<MemberToolEnvelope<unknown>> = {},
): MemberToolEnvelope<unknown> {
  return {
    ok: true,
    requestId: "req-1",
    serverTime: "2026-08-19T00:00:00Z",
    data: { objectKind: "case" },
    error: null,
    boundary: {
      authorityEffect: "none",
      externalExecutionAllowed: false,
      decision: {
        projection: "remote_projected",
        projectionPolicyRef: "projection-policy-1",
        projectionPolicyVersion: 3,
        providerRef: "provider-profile-1",
        purpose: "call_preparation",
        classifiedAt: "2026-08-19T00:00:00Z",
        deniedFields: [],
        blockReason: null,
      },
    },
    ...overrides,
  };
}

describe("validateMemberToolEnvelope", () => {
  it("accepts a complete projected envelope", () => {
    expect(validateMemberToolEnvelope(makeEnvelope())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects data released without a projection decision", () => {
    const envelope = makeEnvelope();
    envelope.boundary.decision.projection = null;
    envelope.boundary.decision.blockReason = "read_surface_denied";
    expect(validateMemberToolEnvelope(envelope).errors).toContain(
      "data_released_without_projection",
    );
  });

  it("rejects a blocked decision without a reason", () => {
    const envelope = makeEnvelope({ data: null });
    envelope.boundary.decision.projection = null;
    envelope.boundary.decision.blockReason = null;
    expect(validateMemberToolEnvelope(envelope).errors).toContain(
      "blocked_without_reason",
    );
  });

  it("rejects projection decision evidence gaps", () => {
    const envelope = makeEnvelope();
    envelope.boundary.decision.projectionPolicyRef = "";
    envelope.boundary.decision.projectionPolicyVersion = 0;
    envelope.boundary.decision.purpose = "";
    const errors = validateMemberToolEnvelope(envelope).errors;
    expect(errors).toContain("projection_policy_ref_missing");
    expect(errors).toContain("projection_policy_version_invalid");
    expect(errors).toContain("purpose_missing");
  });

  it("rejects ok-with-error and error-with-data shapes", () => {
    expect(
      validateMemberToolEnvelope(
        makeEnvelope({
          error: { code: "X", message: "boom", retryable: false },
        }),
      ).errors,
    ).toContain("ok_with_error");
    const failed = makeEnvelope({
      ok: false,
      error: { code: "X", message: "boom", retryable: false },
    });
    expect(validateMemberToolEnvelope(failed).errors).toContain(
      "error_with_data",
    );
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/member-gateway/contract.test.ts --config vitest.public.config.ts`
Expected: FAIL — `validateMemberToolEnvelope` 未导出

- [ ] **Step 3: 追加实现**

在 `contract.ts` 追加(import 增加 `MemberToolEnvelope`):

```ts
import type { MemberToolEnvelope } from "@/lib/member-gateway/types";

// Envelope validation (spec §6 / §8.2). The envelope is the only shape a
// client ever sees; authorityEffect is structurally "none" and data can only
// be released under an affirmative projection decision.
export function validateMemberToolEnvelope(
  envelope: MemberToolEnvelope<unknown>,
): ContractValidation {
  const errors: string[] = [];
  if (envelope.boundary.authorityEffect !== "none") {
    errors.push("authority_effect_must_be_none");
  }
  if (envelope.boundary.externalExecutionAllowed !== false) {
    errors.push("external_execution_must_be_false");
  }
  if (!hasRef(envelope.requestId)) {
    errors.push("request_id_missing");
  }
  if (envelope.ok && envelope.error !== null) {
    errors.push("ok_with_error");
  }
  if (!envelope.ok && envelope.data !== null) {
    errors.push("error_with_data");
  }
  const decision = envelope.boundary.decision;
  if (!hasRef(decision.projectionPolicyRef)) {
    errors.push("projection_policy_ref_missing");
  }
  if (
    !Number.isInteger(decision.projectionPolicyVersion) ||
    decision.projectionPolicyVersion < 1
  ) {
    errors.push("projection_policy_version_invalid");
  }
  if (!hasRef(decision.purpose)) {
    errors.push("purpose_missing");
  }
  if (decision.projection === null && decision.blockReason === null) {
    errors.push("blocked_without_reason");
  }
  if (decision.projection !== null && decision.blockReason !== null) {
    errors.push("projected_with_block_reason");
  }
  if (envelope.data !== null && decision.projection === null) {
    errors.push("data_released_without_projection");
  }
  return { valid: errors.length === 0, errors };
}
```

同样注意把 import 合并到文件顶部。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run lib/member-gateway/contract.test.ts --config vitest.public.config.ts`
Expected: PASS (18 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/member-gateway/contract.ts lib/member-gateway/contract.test.ts
git commit -m "feat(member-gateway): add envelope validation binding data release to projection decisions"
```

---

### Task 5: barrel 导出与模块级验证

**Files:**
- Create: `lib/member-gateway/index.ts`

- [ ] **Step 1: 写 barrel**

```ts
// lib/member-gateway/index.ts
export * from "@/lib/member-gateway/contract";
export * from "@/lib/member-gateway/types";
```

- [ ] **Step 2: 全模块测试 + 类型检查**

Run: `npx vitest run lib/member-gateway --config vitest.public.config.ts && npm run typecheck`
Expected: 全部 PASS,typecheck 无错误

- [ ] **Step 3: Commit**

```bash
git add lib/member-gateway/index.ts
git commit -m "feat(member-gateway): export member gateway contract barrel"
```

---

### Task 6: 冻结门禁脚本与 npm 接线

**Files:**
- Create: `scripts/check-member-gateway.ts`
- Modify: `package.json`(scripts 增加 `check:member-gateway`,并追加到 `check:boundaries` 链尾)

- [ ] **Step 1: 写门禁脚本**

```ts
#!/usr/bin/env tsx
// check-member-gateway — static gate for the Member Gateway contract slice
// (docs/superpowers/specs/2026-08-19-member-workbuddy-caio-gateway-design.md).
//
// Fail-closed assertions:
//   1. The frozen literals stay present in lib/member-gateway/types.ts:
//      the two-level projection ladder, the seven read-surface dimensions,
//      the metadata_only field whitelist, and the structural boundary
//      (authorityEffect "none", externalExecutionAllowed false).
//   2. Dispatch stays schema-inexpressible: no `WorkPacket` identifier may
//      appear anywhere in the module.
//   3. package.json keeps this gate wired.
// This is a contract statement, not production readiness.

import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations: string[] = [];

const typesPath = path.join(root, "lib/member-gateway/types.ts");
const typesSource = readFileSync(typesPath, "utf8");

const frozenMarkers = [
  '"remote_projected"',
  '"metadata_only"',
  '"live_membership"',
  '"tool_scope"',
  '"object_relationship_authorization"',
  '"field_purpose_policy"',
  '"source_authorization"',
  '"tenant_provider_egress_policy"',
  '"current_classification"',
  '"LOCAL_VIEW_REQUIRED"',
  'authorityEffect: "none"',
  "externalExecutionAllowed: false",
];
for (const marker of frozenMarkers) {
  if (!typesSource.includes(marker)) {
    violations.push(`lib/member-gateway/types.ts missing frozen marker: ${marker}`);
  }
}

for (const file of ["types.ts", "contract.ts", "index.ts"]) {
  const source = readFileSync(
    path.join(root, "lib/member-gateway", file),
    "utf8",
  );
  if (/WorkPacket/.test(source)) {
    violations.push(
      `lib/member-gateway/${file}: WorkPacket identifier must stay inexpressible`,
    );
  }
}

const pkg = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
) as { scripts?: Record<string, string> };
if (!pkg.scripts?.["check:member-gateway"]?.includes("check-member-gateway")) {
  violations.push("package.json missing check:member-gateway wiring");
}
if (!pkg.scripts?.["check:boundaries"]?.includes("check:member-gateway")) {
  violations.push("check:boundaries does not include check:member-gateway");
}

if (violations.length > 0) {
  console.error(`member-gateway: FAIL — ${violations.length} violation(s).`);
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}
console.log(
  "member-gateway: PASS - contract literals frozen and dispatch remains schema-inexpressible; this is a contract statement, not production readiness",
);
```

- [ ] **Step 2: package.json 接线**

在 `scripts` 中(参照 `check:stage1-owner-loop` 一行的位置附近)增加:

```json
"check:member-gateway": "node --import tsx scripts/check-member-gateway.ts && vitest run lib/member-gateway --config vitest.public.config.ts",
```

并把 `check:boundaries` 的命令串尾部追加 ` && npm run check:member-gateway`。

- [ ] **Step 3: 运行门禁确认通过**

Run: `npm run check:member-gateway`
Expected: `member-gateway: PASS ...` 后接 vitest 18+5 tests 全绿

- [ ] **Step 4: 负向验证(门禁真的 fail-closed)**

临时把 `types.ts` 里 `"tenant_provider_egress_policy",` 一行删除,运行 `npm run check:member-gateway`,Expected: FAIL 且指名缺失 marker;然后 `git checkout -- lib/member-gateway/types.ts` 恢复。

- [ ] **Step 5: Commit(pre-commit 将全量验证包括新门禁)**

```bash
git add scripts/check-member-gateway.ts package.json
git commit -m "feat(member-gateway): add frozen-contract gate and wire into check:boundaries"
```

---

### Task 7: 收尾验证

- [ ] **Step 1: 全量门禁**

Run: `npm run typecheck && npm run lint && npm run check:boundaries`
Expected: 全绿(check:boundaries 现在包含 member-gateway 门禁)

- [ ] **Step 2: 对照 spec 自查**

逐条核对 spec §8.1(七元交集)、§8.2(判定依据字段)、§3(Work Packet 不可表达)、§4(principal 不含 OWNER/CEO 语义)在代码中均有对应测试;缺项回到对应 Task 补齐。

- [ ] **Step 3: 汇报**

向 owner 汇报分支名、commit 列表与门禁输出,等待 review;不合并、不推送到 main。

---

## 边界声明(执行者必读)

- 本计划只交付**契约与确定性判定**。不实现 MCP 服务器、HTTP 端点、存储、真实成员认证或任何运行时;那些属于 M1 的后续切片或私有层。
- 不得在本模块引入 Work Packet 的 object kind、payload 字段或 submit action;门禁脚本会拒绝 `WorkPacket` 标识符。
- 不得把 `WorkspaceRole.OWNER` 或 CEO 语义引入 `MemberPrincipal`。
- 每次 commit 都会触发全量 `check:boundaries`(husky),保持全绿是硬要求。

---

## As-built 记录(2026-08-19 执行完毕)

执行分支 `feat/member-gateway-m1`,12 个实现 commit(`11369d7a` … `719584e1`),
最终 39/39 测试、`check:member-gateway` 与全量 `check:boundaries` 绿,
`npm run db:generate` 后全仓 typecheck 0 错误。

相对本计划的偏离(全部由两段式 review 驱动,设计 spec 为真值):

1. `MemberProjectionDecision` 增加 `freshnessMinutes`(spec §8.2 要求判定依据
   携带 freshness);生产者输入相应携带,信封校验要求投影决定 freshness 完整。
2. `MemberReadSurfaceDecision` 拒绝分支收紧为非空元组,"无证据的拒绝"在类型上
   不可表达;实现以解构收窄,不用断言。
3. `classifiedAt` 改用 `caio-governance` 的严格 `parseInstant`(拒绝
   `Date.parse` 宽松形态);freshness 证据缺失/非法与之同路,按
   `classification_unknown` 阻断。
4. 信封校验:purpose/classifiedAt/freshness/providerRef 完整性只约束投影
   决定,阻断决定豁免(错误码 `*_for_projection`);新增 `error_missing`、
   `freshness_invalid_for_projection`;并以"生产者全部决定形状包入合规信封
   必须通过校验"的交叉测试钉死生产者/校验器一致性。
5. 门禁 marker 列表增加 `"requiresLocalView"`;`check:boundaries` 接线需同步
   更新 `check:frozen-duplicates` 监管的 5 处冻结副本(public-release-guard
   白名单与 override、caio-terminology 期望命令、两个测试 fixture)。
6. 文中各步的测试计数为撰写时快照,最终为 39。
