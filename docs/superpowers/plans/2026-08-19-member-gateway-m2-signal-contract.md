# Member Gateway M2a (信号上行契约) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `helm-public` 落地 `submit_work_signal` 的公共契约:信号载荷与限额、prepare/submit 一次性 challenge 判定、candidate 回执形状(冻结 candidate/taint 标记)、superseding 更正判定,并扩展 member-gateway 门禁。

**Architecture:** 纯契约切片,继续 M1 模式——新文件 `lib/member-gateway/signal.ts`(+ 同址测试),只依赖纯函数(`parseInstant`、`canonicalJson`/`sha256`)与 M1 类型;无 IO、无 zod、无存储。challenge 语义(一次性、TTL 上限 5 分钟、绑定 hash)镜像 CEO 环路 `lib/caio-collaboration/governed-mutation.service.ts` 的既有决策,但不引入其 CEO 专属契约;运行时入库(Prisma store、迁移)是 M2b 独立切片。设计真值:spec §5/§6.2/§9(`docs/superpowers/specs/2026-08-19-member-workbuddy-caio-gateway-design.md`)。

**Tech Stack:** 同 M1。husky pre-commit 全量 `check:boundaries`(现含 `check:member-gateway`),每 commit 必须全绿。

**分支:** `feat/member-gateway-m2`(基于 `feat/member-gateway-m1`)。

**复用(不要重新定义):** `ContractValidation`、`validateMemberPrincipal`、`MemberPrincipal`、`MemberReadSurfaceDecision` 来自 `@/lib/member-gateway/contract|types`;`parseInstant` 来自 `@/lib/caio-governance/contract`;`canonicalJson`/`sha256`(同步,string→string)来自 `@/lib/expert-capability/hashing`。

---

### Task 1: 信号类型与冻结字面量 `lib/member-gateway/signal.ts`

**Files:** Create `lib/member-gateway/signal.ts`, `lib/member-gateway/signal.test.ts`

- [ ] Step 1: 失败测试(冻结字面量与回执形状):

```ts
// lib/member-gateway/signal.test.ts
import { describe, expect, it } from "vitest";

import {
  MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS,
  MEMBER_SIGNAL_DETAIL_MAX_CHARS,
  MEMBER_SIGNAL_MAX_EVIDENCE_REFS,
  MEMBER_SIGNAL_MAX_LINKS,
  MEMBER_SIGNAL_SUMMARY_MAX_CHARS,
  MEMBER_SIGNAL_TAINT,
  MEMBER_WORK_SIGNAL_KINDS,
} from "@/lib/member-gateway/signal";
import type { MemberWorkSignalReceipt } from "@/lib/member-gateway/signal";

describe("member work signal frozen literals", () => {
  it("freezes the three signal kinds", () => {
    expect(MEMBER_WORK_SIGNAL_KINDS).toEqual([
      "progress",
      "blocker",
      "customer_signal",
    ]);
  });

  it("freezes taint and limits", () => {
    expect(MEMBER_SIGNAL_TAINT).toBe("untrusted");
    expect(MEMBER_SIGNAL_SUMMARY_MAX_CHARS).toBe(500);
    expect(MEMBER_SIGNAL_DETAIL_MAX_CHARS).toBe(4000);
    expect(MEMBER_SIGNAL_MAX_LINKS).toBe(3);
    expect(MEMBER_SIGNAL_MAX_EVIDENCE_REFS).toBe(10);
    expect(MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS).toBe(5 * 60_000);
  });

  it("a receipt is structurally candidate and untrusted", () => {
    const receipt: MemberWorkSignalReceipt = {
      receiptId: "receipt-1",
      workspaceRef: "workspace-1",
      memberRef: "member-1",
      deviceRegistrationRef: "device-1",
      clientId: "workbuddy-desktop",
      objectRef: "case-42",
      objectVersion: 3,
      kind: "progress",
      payloadHash: "hash-1",
      policyRef: "signal-policy-1",
      policyVersion: 1,
      submittedAt: "2026-08-19T00:00:00Z",
      candidate: true,
      taint: "untrusted",
      supersedesReceiptRef: null,
    };
    expect(receipt.candidate).toBe(true);
    expect(receipt.taint).toBe("untrusted");
  });
});
```

- [ ] Step 2: 运行确认失败(模块不存在)
- [ ] Step 3: 实现:

```ts
// lib/member-gateway/signal.ts
// Member work-signal contract (spec §5 candidate_write, §6.2, §9). Pure
// judgment only: no IO, no store, no clock — callers supply instants. A
// work signal is ALWAYS candidate evidence with an untrusted taint; nothing
// in this module can promote it to fact, and dispatch stays inexpressible.

import type { ContractValidation } from "@/lib/member-gateway/contract";
import type {
  MemberPrincipal,
  MemberReadSurfaceDecision,
} from "@/lib/member-gateway/types";

export const MEMBER_WORK_SIGNAL_KINDS = [
  "progress",
  "blocker",
  "customer_signal",
] as const;

export type MemberWorkSignalKind = (typeof MEMBER_WORK_SIGNAL_KINDS)[number];

// Frozen taint marking (spec §9): member upstream content is always
// untrusted input to any reasoning context and the marking must survive
// every layer.
export const MEMBER_SIGNAL_TAINT = "untrusted" as const;

// §9 limits: field length, link count, and reference count are contract
// values, not runtime configuration.
export const MEMBER_SIGNAL_SUMMARY_MAX_CHARS = 500;
export const MEMBER_SIGNAL_DETAIL_MAX_CHARS = 4000;
export const MEMBER_SIGNAL_MAX_LINKS = 3;
export const MEMBER_SIGNAL_MAX_EVIDENCE_REFS = 10;

// Mirrors the CEO-loop governed-mutation MAX_CHALLENGE_TTL_MS: a member
// signal challenge may never live longer than five minutes.
export const MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS = 5 * 60_000;

export type MemberWorkSignalPayload = {
  kind: MemberWorkSignalKind;
  summary: string;
  detail: string;
  relatedEvidenceRefs: readonly string[];
};

export type MemberWorkSignalDraft = {
  principal: MemberPrincipal;
  objectRef: string;
  objectVersion: number;
  payload: MemberWorkSignalPayload;
};

// One-time prepare/submit challenge (spec §6.2): bound to workspace,
// member, object, version, payload hash, and an expiry window.
export type MemberWorkSignalChallenge = {
  challengeRef: string;
  workspaceRef: string;
  memberRef: string;
  objectRef: string;
  objectVersion: number;
  payloadHash: string;
  issuedAt: string;
  expiresAt: string;
};

export type MemberWorkSignalSubmission = {
  challenge: MemberWorkSignalChallenge;
  principal: MemberPrincipal;
  payload: MemberWorkSignalPayload;
  // The member's read-surface decision for the target object: a signal may
  // only reference an object the member is authorized to read (§9
  // over-privilege reference check).
  surface: MemberReadSurfaceDecision;
  submittedAt: string;
  // Non-null when the store already recorded a consumption for this
  // challenge; the judgment rejects reuse.
  priorConsumptionRef: string | null;
};

// Append-only candidate receipt (spec §5/§6.2). candidate/taint are frozen
// literal types: a well-typed receipt cannot claim to be fact or trusted.
export type MemberWorkSignalReceipt = {
  receiptId: string;
  workspaceRef: string;
  memberRef: string;
  deviceRegistrationRef: string;
  clientId: string;
  objectRef: string;
  objectVersion: number;
  kind: MemberWorkSignalKind;
  payloadHash: string;
  policyRef: string;
  policyVersion: number;
  submittedAt: string;
  candidate: true;
  taint: typeof MEMBER_SIGNAL_TAINT;
  // Superseding correction chain (spec §6.2): a correction is a NEW receipt
  // referencing the one it replaces; history is never rewritten.
  supersedesReceiptRef: string | null;
};
```

- [ ] Step 4: 3/3 PASS;Step 5: commit `feat(member-gateway): add work signal contract types with frozen candidate and taint markings`

### Task 2: 草稿校验与载荷哈希

**Files:** Modify `signal.ts` / `signal.test.ts`

- [ ] Step 1: 失败测试:

```ts
import {
  hashMemberWorkSignalPayload,
  validateMemberWorkSignalDraft,
} from "@/lib/member-gateway/signal";
import type {
  MemberWorkSignalDraft,
  MemberWorkSignalPayload,
} from "@/lib/member-gateway/signal";

function makePayload(
  overrides: Partial<MemberWorkSignalPayload> = {},
): MemberWorkSignalPayload {
  return {
    kind: "progress",
    summary: "客户已确认还款意向",
    detail: "电话沟通 20 分钟,确认周五前处理。",
    relatedEvidenceRefs: ["evidence-1"],
    ...overrides,
  };
}

function makeDraft(
  overrides: Partial<MemberWorkSignalDraft> = {},
): MemberWorkSignalDraft {
  return {
    principal: {
      workspaceRef: "workspace-1",
      memberRef: "member-1",
      sessionRef: "session-1",
      deviceRegistrationRef: "device-1",
      clientId: "workbuddy-desktop",
    },
    objectRef: "case-42",
    objectVersion: 3,
    payload: makePayload(),
    ...overrides,
  };
}

describe("validateMemberWorkSignalDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateMemberWorkSignalDraft(makeDraft())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects principal gaps with the principal error codes", () => {
    const draft = makeDraft();
    draft.principal = { ...draft.principal, sessionRef: "" };
    expect(validateMemberWorkSignalDraft(draft).errors).toContain(
      "session_ref_missing",
    );
  });

  it("rejects unknown kind, missing summary, and bad object binding", () => {
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({
          payload: makePayload({ kind: "gossip" as never, summary: " " }),
          objectRef: "",
          objectVersion: 0,
        }),
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        "signal_kind_unknown",
        "signal_summary_missing",
        "signal_object_ref_missing",
        "signal_object_version_invalid",
      ]),
    );
  });

  it("enforces length, link, and evidence-ref limits", () => {
    const longSummary = "x".repeat(501);
    const longDetail = "y".repeat(4001);
    const linky = "见 https://a.example https://b.example";
    const linkyDetail = "https://c.example 与 https://d.example";
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({ payload: makePayload({ summary: longSummary }) }),
      ).errors,
    ).toContain("signal_summary_too_long");
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({ payload: makePayload({ detail: longDetail }) }),
      ).errors,
    ).toContain("signal_detail_too_long");
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({
          payload: makePayload({ summary: linky, detail: linkyDetail }),
        }),
      ).errors,
    ).toContain("signal_links_exceeded");
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({
          payload: makePayload({
            relatedEvidenceRefs: Array.from({ length: 11 }, (_, i) => `e-${i}`),
          }),
        }),
      ).errors,
    ).toContain("signal_evidence_refs_exceeded");
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({ payload: makePayload({ relatedEvidenceRefs: [" "] }) }),
      ).errors,
    ).toContain("signal_evidence_ref_invalid");
  });
});

describe("hashMemberWorkSignalPayload", () => {
  it("is deterministic and content-sensitive", () => {
    expect(hashMemberWorkSignalPayload(makePayload())).toBe(
      hashMemberWorkSignalPayload(makePayload()),
    );
    expect(hashMemberWorkSignalPayload(makePayload())).not.toBe(
      hashMemberWorkSignalPayload(makePayload({ summary: "changed" })),
    );
  });
});
```

- [ ] Step 2: 确认失败;Step 3: 实现(追加到 signal.ts;import 合并到顶部:`validateMemberPrincipal` 来自 contract,`canonicalJson`/`sha256` 来自 hashing):

```ts
function hasRef(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function countLinks(text: string): number {
  return (text.match(/https?:\/\//g) ?? []).length;
}

export function hashMemberWorkSignalPayload(
  payload: MemberWorkSignalPayload,
): string {
  return sha256(canonicalJson(payload));
}

export function validateMemberWorkSignalDraft(
  draft: MemberWorkSignalDraft,
): ContractValidation {
  const errors = [...validateMemberPrincipal(draft.principal).errors];
  if (!hasRef(draft.objectRef)) {
    errors.push("signal_object_ref_missing");
  }
  if (!Number.isInteger(draft.objectVersion) || draft.objectVersion < 1) {
    errors.push("signal_object_version_invalid");
  }
  const { payload } = draft;
  if (!MEMBER_WORK_SIGNAL_KINDS.includes(payload.kind)) {
    errors.push("signal_kind_unknown");
  }
  if (!hasRef(payload.summary)) {
    errors.push("signal_summary_missing");
  } else if (payload.summary.length > MEMBER_SIGNAL_SUMMARY_MAX_CHARS) {
    errors.push("signal_summary_too_long");
  }
  if (payload.detail.length > MEMBER_SIGNAL_DETAIL_MAX_CHARS) {
    errors.push("signal_detail_too_long");
  }
  if (
    countLinks(payload.summary) + countLinks(payload.detail) >
    MEMBER_SIGNAL_MAX_LINKS
  ) {
    errors.push("signal_links_exceeded");
  }
  if (payload.relatedEvidenceRefs.length > MEMBER_SIGNAL_MAX_EVIDENCE_REFS) {
    errors.push("signal_evidence_refs_exceeded");
  }
  if (!payload.relatedEvidenceRefs.every((ref) => hasRef(ref))) {
    errors.push("signal_evidence_ref_invalid");
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] Step 4: 8/8 PASS;Step 5: commit `feat(member-gateway): validate work signal drafts against frozen content limits`

### Task 3: challenge 与提交判定

**Files:** Modify `signal.ts` / `signal.test.ts`

- [ ] Step 1: 失败测试:

```ts
import {
  judgeMemberWorkSignalChallenge,
  judgeMemberWorkSignalSubmission,
} from "@/lib/member-gateway/signal";
import type {
  MemberWorkSignalChallenge,
  MemberWorkSignalSubmission,
} from "@/lib/member-gateway/signal";

function makeChallenge(
  overrides: Partial<MemberWorkSignalChallenge> = {},
): MemberWorkSignalChallenge {
  return {
    challengeRef: "challenge-1",
    workspaceRef: "workspace-1",
    memberRef: "member-1",
    objectRef: "case-42",
    objectVersion: 3,
    payloadHash: hashMemberWorkSignalPayload(makePayload()),
    issuedAt: "2026-08-19T00:00:00Z",
    expiresAt: "2026-08-19T00:04:00Z",
    ...overrides,
  };
}

function makeSubmission(
  overrides: Partial<MemberWorkSignalSubmission> = {},
): MemberWorkSignalSubmission {
  return {
    challenge: makeChallenge(),
    principal: makeDraft().principal,
    payload: makePayload(),
    surface: { allowed: true, deniedDimensions: [] },
    submittedAt: "2026-08-19T00:01:00Z",
    priorConsumptionRef: null,
    ...overrides,
  };
}

describe("judgeMemberWorkSignalChallenge", () => {
  it("accepts a well-formed challenge", () => {
    expect(judgeMemberWorkSignalChallenge(makeChallenge())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects lax instants, inverted windows, and over-cap TTL", () => {
    expect(
      judgeMemberWorkSignalChallenge(makeChallenge({ issuedAt: "2026" }))
        .errors,
    ).toContain("challenge_instant_invalid");
    expect(
      judgeMemberWorkSignalChallenge(
        makeChallenge({ expiresAt: "2026-08-18T23:59:00Z" }),
      ).errors,
    ).toContain("challenge_window_invalid");
    expect(
      judgeMemberWorkSignalChallenge(
        makeChallenge({ expiresAt: "2026-08-19T00:06:00Z" }),
      ).errors,
    ).toContain("challenge_ttl_exceeds_cap");
  });

  it("rejects missing binding refs", () => {
    expect(
      judgeMemberWorkSignalChallenge(
        makeChallenge({ challengeRef: "", payloadHash: " " }),
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        "challenge_ref_missing",
        "challenge_payload_hash_missing",
      ]),
    );
  });
});

describe("judgeMemberWorkSignalSubmission", () => {
  it("accepts a bound, in-window, unconsumed, authorized submission", () => {
    expect(judgeMemberWorkSignalSubmission(makeSubmission())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects binding mismatches", () => {
    const sub = makeSubmission();
    sub.principal = { ...sub.principal, memberRef: "member-2" };
    expect(judgeMemberWorkSignalSubmission(sub).errors).toContain(
      "challenge_binding_mismatch",
    );
  });

  it("rejects payload drift after prepare", () => {
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({ payload: makePayload({ summary: "改过了" }) }),
      ).errors,
    ).toContain("challenge_payload_hash_mismatch");
  });

  it("rejects expiry, pre-issue submission, and reuse", () => {
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({ submittedAt: "2026-08-19T00:05:00Z" }),
      ).errors,
    ).toContain("challenge_expired");
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({ submittedAt: "2026-08-18T23:59:59Z" }),
      ).errors,
    ).toContain("submission_before_issue");
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({ priorConsumptionRef: "consumption-1" }),
      ).errors,
    ).toContain("challenge_already_consumed");
  });

  it("rejects signals about objects outside the member read surface", () => {
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({
          surface: { allowed: false, deniedDimensions: ["tool_scope"] },
        }),
      ).errors,
    ).toContain("signal_object_not_authorized");
  });

  it("merges draft content violations", () => {
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({
          payload: makePayload({ summary: "" }),
        }),
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        "signal_summary_missing",
        "challenge_payload_hash_mismatch",
      ]),
    );
  });
});
```

- [ ] Step 2: 确认失败;Step 3: 实现(import `parseInstant`;注意 expiry 判定用毫秒比较):

```ts
export function judgeMemberWorkSignalChallenge(
  challenge: MemberWorkSignalChallenge,
): ContractValidation {
  const errors: string[] = [];
  if (!hasRef(challenge.challengeRef)) {
    errors.push("challenge_ref_missing");
  }
  if (!hasRef(challenge.workspaceRef) || !hasRef(challenge.memberRef)) {
    errors.push("challenge_principal_binding_missing");
  }
  if (!hasRef(challenge.objectRef)) {
    errors.push("challenge_object_binding_missing");
  }
  if (
    !Number.isInteger(challenge.objectVersion) ||
    challenge.objectVersion < 1
  ) {
    errors.push("challenge_object_version_invalid");
  }
  if (!hasRef(challenge.payloadHash)) {
    errors.push("challenge_payload_hash_missing");
  }
  const issuedAtMs = parseInstant(challenge.issuedAt);
  const expiresAtMs = parseInstant(challenge.expiresAt);
  if (issuedAtMs === null || expiresAtMs === null) {
    errors.push("challenge_instant_invalid");
  } else {
    if (expiresAtMs <= issuedAtMs) {
      errors.push("challenge_window_invalid");
    } else if (expiresAtMs - issuedAtMs > MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS) {
      errors.push("challenge_ttl_exceeds_cap");
    }
  }
  return { valid: errors.length === 0, errors };
}

// Submission judgment (spec §6.2/§9). Fail-closed: the challenge is
// one-time (any recorded prior consumption rejects), the payload must hash
// to the prepared payloadHash, and the target object must be inside the
// member's authorized read surface. This judges only what it is given —
// the store layer owns actually recording consumption atomically.
export function judgeMemberWorkSignalSubmission(
  submission: MemberWorkSignalSubmission,
): ContractValidation {
  const errors = [
    ...judgeMemberWorkSignalChallenge(submission.challenge).errors,
  ];
  const { challenge, principal } = submission;
  if (
    principal.workspaceRef !== challenge.workspaceRef ||
    principal.memberRef !== challenge.memberRef
  ) {
    errors.push("challenge_binding_mismatch");
  }
  errors.push(
    ...validateMemberWorkSignalDraft({
      principal,
      objectRef: challenge.objectRef,
      objectVersion: challenge.objectVersion,
      payload: submission.payload,
    }).errors,
  );
  if (
    hashMemberWorkSignalPayload(submission.payload) !== challenge.payloadHash
  ) {
    errors.push("challenge_payload_hash_mismatch");
  }
  const submittedAtMs = parseInstant(submission.submittedAt);
  const issuedAtMs = parseInstant(challenge.issuedAt);
  const expiresAtMs = parseInstant(challenge.expiresAt);
  if (submittedAtMs === null) {
    errors.push("submission_instant_invalid");
  } else if (issuedAtMs !== null && expiresAtMs !== null) {
    if (submittedAtMs < issuedAtMs) {
      errors.push("submission_before_issue");
    } else if (submittedAtMs >= expiresAtMs) {
      errors.push("challenge_expired");
    }
  }
  if (submission.priorConsumptionRef !== null) {
    errors.push("challenge_already_consumed");
  }
  if (!submission.surface.allowed) {
    errors.push("signal_object_not_authorized");
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] Step 4: 17/17 PASS;Step 5: commit `feat(member-gateway): judge one-time signal challenges and fail-closed submissions`

### Task 4: superseding 更正判定

**Files:** Modify `signal.ts` / `signal.test.ts`

- [ ] Step 1: 失败测试:

```ts
import { judgeSupersedingSignalReceipt } from "@/lib/member-gateway/signal";

function makeReceipt(
  overrides: Partial<MemberWorkSignalReceipt> = {},
): MemberWorkSignalReceipt {
  return {
    receiptId: "receipt-1",
    workspaceRef: "workspace-1",
    memberRef: "member-1",
    deviceRegistrationRef: "device-1",
    clientId: "workbuddy-desktop",
    objectRef: "case-42",
    objectVersion: 3,
    kind: "progress",
    payloadHash: "hash-1",
    policyRef: "signal-policy-1",
    policyVersion: 1,
    submittedAt: "2026-08-19T00:01:00Z",
    candidate: true,
    taint: "untrusted",
    supersedesReceiptRef: null,
  };
}

describe("judgeSupersedingSignalReceipt", () => {
  const prior = makeReceipt();
  const next = makeReceipt({
    receiptId: "receipt-2",
    supersedesReceiptRef: "receipt-1",
    submittedAt: "2026-08-19T00:10:00Z",
  });

  it("accepts a well-formed correction", () => {
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next,
        priorAlreadySupersededBy: null,
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects ref mismatch, scope mismatch, and double supersede", () => {
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next: { ...next, supersedesReceiptRef: "receipt-9" },
        priorAlreadySupersededBy: null,
      }).errors,
    ).toContain("supersedes_ref_mismatch");
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next: { ...next, memberRef: "member-2" },
        priorAlreadySupersededBy: null,
      }).errors,
    ).toContain("supersedes_scope_mismatch");
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next,
        priorAlreadySupersededBy: "receipt-8",
      }).errors,
    ).toContain("receipt_already_superseded");
  });

  it("rejects corrections that do not move forward in time", () => {
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next: { ...next, submittedAt: "2026-08-19T00:01:00Z" },
        priorAlreadySupersededBy: null,
      }).errors,
    ).toContain("supersedes_order_invalid");
  });

  it("rejects self-supersede", () => {
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next: { ...prior, supersedesReceiptRef: "receipt-1" },
        priorAlreadySupersededBy: null,
      }).errors,
    ).toContain("supersedes_self_reference");
  });
});
```

- [ ] Step 2: 确认失败;Step 3: 实现:

```ts
export type SupersedingSignalJudgmentInput = {
  prior: MemberWorkSignalReceipt;
  next: MemberWorkSignalReceipt;
  // Non-null when the store already recorded a correction for `prior`;
  // a receipt can be superseded at most once (corrections chain linearly).
  priorAlreadySupersededBy: string | null;
};

// Correction judgment (spec §6.2): a correction is a NEW receipt that
// references and supersedes the old one. History is append-only — nothing
// here mutates or deletes the prior receipt.
export function judgeSupersedingSignalReceipt(
  input: SupersedingSignalJudgmentInput,
): ContractValidation {
  const errors: string[] = [];
  const { prior, next } = input;
  if (next.receiptId === prior.receiptId) {
    errors.push("supersedes_self_reference");
  }
  if (next.supersedesReceiptRef !== prior.receiptId) {
    errors.push("supersedes_ref_mismatch");
  }
  if (
    next.workspaceRef !== prior.workspaceRef ||
    next.memberRef !== prior.memberRef ||
    next.objectRef !== prior.objectRef
  ) {
    errors.push("supersedes_scope_mismatch");
  }
  if (input.priorAlreadySupersededBy !== null) {
    errors.push("receipt_already_superseded");
  }
  const priorMs = parseInstant(prior.submittedAt);
  const nextMs = parseInstant(next.submittedAt);
  if (priorMs === null || nextMs === null || nextMs <= priorMs) {
    errors.push("supersedes_order_invalid");
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] Step 4: 21/21 PASS;Step 5: commit `feat(member-gateway): judge superseding signal corrections append-only`

### Task 5: barrel、门禁扩展与收尾

**Files:** Modify `lib/member-gateway/index.ts`, `scripts/check-member-gateway.ts`, plan doc

- [ ] Step 1: `index.ts` 增加 `export * from "@/lib/member-gateway/signal";`
- [ ] Step 2: `check-member-gateway.ts`:
  - `frozenMarkers` 检查扩展到 `signal.ts`(新增数组 `signalFrozenMarkers`,对 `lib/member-gateway/signal.ts` 内容断言):`'"progress"'`, `'"blocker"'`, `'"customer_signal"'`, `'"untrusted"'`, `"candidate: true"`, `"supersedesReceiptRef"`;
  - WorkPacket 扫描文件列表加入 `"signal.ts"`。
- [ ] Step 3: `npm run check:member-gateway` PASS(61 测试:40 + 21);负向验证:临时删除 signal.ts 中 `"customer_signal",` 行 → 门禁 FAIL 指名 → 恢复。
- [ ] Step 4: commit `feat(member-gateway): extend frozen-contract gate to work signal slice`
- [ ] Step 5: 全量验证(`check:member-gateway`、`typecheck`、`lint`),plan 文档追加 as-built 记录,最终整体 review,汇报。

---

## 边界声明(执行者必读)

- 本切片只交付**契约与确定性判定**。challenge 发放、消费的原子记录、回执入库(Prisma schema/迁移)是 M2b;信号进入经营记忆与提升链路对接是 M2c。
- candidate/taint 是冻结字面量类型:合法类型的回执不可能声称自己是事实或可信内容。
- 不引入 CEO 环路的 `governed-mutation` zod 契约;语义对齐(一次性、5 分钟 TTL 上限、hash 绑定)但类型独立,运行时切片再决定是否共用存储。
- 每 commit 过全量 `check:boundaries`(含 member-gateway 门禁)。

---

## As-built 记录(2026-08-19 执行完毕)

分支 `feat/member-gateway-m2`,7 个实现 commit(`ec1c4dcb` … `c253997b`),
最终 64/64 模块测试、`check:member-gateway`(含 signal 冻结 marker 与负向
验证)与全量 `check:boundaries` 绿。

相对本计划的偏离(review 驱动):

1. `countLinks` 改为大小写不敏感(`/https?:\/\//gi`)——计划原 regex 可被
   `HTTP://` 绕过 §9 链接上限;并注明 protocol-less 链接由运行时恶意内容
   检查层负责。
2. 过期边界为**排他**(`submittedAt >= expiresAt` 拒绝),比 CEO 环路
   governed-mutation 的包含边界严一拍,系有意为之(成员上行是更低信任面),
   已在代码注释与本记录中声明,不视为"镜像"偏差。
3. 补齐计划遗漏的错误码测试(challenge 主体/对象绑定、版本、提交瞬间)与
   窗口边界钉死测试(issuedAt 含、expiresAt 排他、TTL 恰好 5 分钟允许)。
4. `judgeSupersedingSignalReceipt` 注释明确:两张回执假定为 store 层
   合法行,判定只裁更正关系;objectVersion 允许跨链变化。
5. `ContractValidation` import 因 no-unused-vars 从 Task 1 提交挪至
   Task 2 提交;最终代码形状与计划一致。
6. 文中测试计数为撰写时估计,最终为 64(计划各步计数存在 ±1 偏差,以
   代码为准)。

7. **移交 M2b 的成文义务**:`relatedEvidenceRefs` 的逐引用越权校验不在本
   纯契约切片内(判定层看不到逐引用授权数据),由 M2b store/运行时层实现;
   `signal.ts` 注释已把 surface 判定明确限定为"目标对象"。M2b 计划必须
   包含该项。另:M2b 新增文件需同步加入门禁的 WorkPacket 扫描列表(当前
   为显式枚举)。
