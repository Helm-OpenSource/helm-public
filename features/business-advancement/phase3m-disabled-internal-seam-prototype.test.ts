import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  CAPABILITY_BLOCKED_DECISION_READ,
  CAPABILITY_CUSTOMER_WAITING_READ,
  CAPABILITY_OVERDUE_COMMITMENT_READ,
  PHASE3M_DEFAULT_FLAGS,
  PHASE3M_NEXT_ALLOWED_WORK,
  PHASE3M_PROTOTYPE_POSTURE,
  PHASE3M_RULE_VERSION,
  PHASE3M_RUNTIME_ADOPTION_POSTURE,
  runPhase3mDisabledInternalSeamPrototype,
} from "./phase3m-disabled-internal-seam-prototype";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WS = "ws-phase3m-test";
const REF_CLOCK_MS = 1777161600000; // 2026-04-24T00:00:00.000Z

// TPQR-001 rows
const TPQR001_STALE_NO_REVIEW = {
  rowId: "m-ai-stale-no-review",
  workspaceId: WS,
  updatedAtMs: REF_CLOCK_MS - 4 * 24 * 60 * 60 * 1000, // 4 days ago (> 72h)
  hasApprovalTask: false,
};
const TPQR001_IN_REVIEW = {
  rowId: "m-ai-in-review",
  workspaceId: WS,
  updatedAtMs: REF_CLOCK_MS - 5 * 24 * 60 * 60 * 1000,
  hasApprovalTask: true,
};
const TPQR001_FRESH = {
  rowId: "m-ai-fresh",
  workspaceId: WS,
  updatedAtMs: REF_CLOCK_MS - 24 * 60 * 60 * 1000, // 1 day (< 72h)
  hasApprovalTask: false,
};
const TPQR001_WRONG_WS = {
  rowId: "m-ai-wrong-ws",
  workspaceId: "ws-other",
  updatedAtMs: REF_CLOCK_MS - 4 * 24 * 60 * 60 * 1000,
  hasApprovalTask: false,
};

// TPQR-003 rows
const TPQR003_PAST_DUE_FLAG_FALSE = {
  rowId: "m-c-past-flag-false",
  workspaceId: WS,
  commitmentId: "cmmt-m-001",
  dueDateMs: REF_CLOCK_MS - 3 * 24 * 60 * 60 * 1000,
  status: "ACTIVE",
  persistedOverdueFlag: false,
};
const TPQR003_FUTURE_DUE_FLAG_TRUE = {
  rowId: "m-c-future-flag-true",
  workspaceId: WS,
  commitmentId: "cmmt-m-002",
  dueDateMs: REF_CLOCK_MS + 2 * 24 * 60 * 60 * 1000,
  status: "ACTIVE",
  persistedOverdueFlag: true,
};

// TPQR-004 rows
const TPQR004_CRM_LINKED = {
  rowId: "m-et-crm",
  workspaceId: WS,
  emailThreadId: "thread-crm",
  threadStatus: "WAITING_US",
  opportunityId: "opp-m-001",
};
const TPQR004_GENERIC_ONLY = {
  rowId: "m-et-generic",
  workspaceId: WS,
  emailThreadId: "thread-generic-only",
  threadStatus: "WAITING_US",
  opportunityId: null,
};
const TPQR004_GENERIC_DUP = {
  rowId: "m-et-generic-dup",
  workspaceId: WS,
  emailThreadId: "thread-crm", // same as CRM-linked → should be deduped
  threadStatus: "WAITING_US",
  opportunityId: null,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Phase 3M constants", () => {
  it("PHASE3M_RULE_VERSION is correct", () => {
    expect(PHASE3M_RULE_VERSION).toBe(
      "phase3m-disabled-internal-seam-prototype/v1",
    );
  });

  it("PHASE3M_RUNTIME_ADOPTION_POSTURE is No-Go", () => {
    expect(PHASE3M_RUNTIME_ADOPTION_POSTURE).toBe("No-Go");
  });

  it("PHASE3M_PROTOTYPE_POSTURE is Conditional-Go", () => {
    expect(PHASE3M_PROTOTYPE_POSTURE).toBe("Conditional-Go");
  });

  it("PHASE3M_DEFAULT_FLAGS all false", () => {
    expect(PHASE3M_DEFAULT_FLAGS.tpqr001).toBe(false);
    expect(PHASE3M_DEFAULT_FLAGS.tpqr003).toBe(false);
    expect(PHASE3M_DEFAULT_FLAGS.tpqr004).toBe(false);
  });

  it("PHASE3M_NEXT_ALLOWED_WORK mentions Phase 3N and not production adoption", () => {
    const lower = PHASE3M_NEXT_ALLOWED_WORK.toLowerCase();
    expect(lower).toMatch(/phase 3n/);
    expect(lower).toMatch(/not production adoption/);
  });

  it("capability constants have correct values", () => {
    expect(CAPABILITY_BLOCKED_DECISION_READ).toBe(
      "helm.business-advancement.source.blocked-decision.read",
    );
    expect(CAPABILITY_OVERDUE_COMMITMENT_READ).toBe(
      "helm.business-advancement.source.overdue-commitment.read",
    );
    expect(CAPABILITY_CUSTOMER_WAITING_READ).toBe(
      "helm.business-advancement.source.customer-waiting.read",
    );
  });
});

// ---------------------------------------------------------------------------
// Default flags (all false) → disabled for all families
// ---------------------------------------------------------------------------

describe("Phase 3M — default flags (all false)", () => {
  const out = runPhase3mDisabledInternalSeamPrototype({
    workspaceId: WS,
    referenceClockMs: REF_CLOCK_MS,
    rows: {
      tpqr001: [TPQR001_STALE_NO_REVIEW, TPQR001_FRESH],
      tpqr003: [TPQR003_PAST_DUE_FLAG_FALSE],
      tpqr004: [TPQR004_CRM_LINKED],
    },
  });

  it("tpqr001 status is disabled", () => {
    expect(out.tpqr001.status).toBe("disabled");
  });

  it("tpqr001 has no included candidates", () => {
    expect(out.tpqr001.result.included).toHaveLength(0);
  });

  it("tpqr001 capabilitySatisfied is false", () => {
    expect(out.tpqr001.capabilitySatisfied).toBe(false);
  });

  it("tpqr003 status is disabled", () => {
    expect(out.tpqr003.status).toBe("disabled");
  });

  it("tpqr003 has no included candidates", () => {
    expect(out.tpqr003.result.included).toHaveLength(0);
  });

  it("tpqr004 status is disabled", () => {
    expect(out.tpqr004.status).toBe("disabled");
  });

  it("tpqr004 has no included candidates", () => {
    expect(out.tpqr004.result.included).toHaveLength(0);
  });

  it("productionIntegrationAllowed is false", () => {
    expect(out.productionIntegrationAllowed).toBe(false);
  });

  it("runtimeAdoptionPosture is No-Go", () => {
    expect(out.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("prototypePosture is Conditional-Go", () => {
    expect(out.prototypePosture).toBe("Conditional-Go");
  });
});

// ---------------------------------------------------------------------------
// Flag true but capability missing → capability_denied
// ---------------------------------------------------------------------------

describe("Phase 3M — flag enabled but capability missing", () => {
  it("tpqr001 flag=true without capability returns capability_denied with no included", () => {
    const out = runPhase3mDisabledInternalSeamPrototype({
      workspaceId: WS,
      referenceClockMs: REF_CLOCK_MS,
      flags: { tpqr001: true },
      capabilities: [],
      rows: { tpqr001: [TPQR001_STALE_NO_REVIEW] },
    });
    expect(out.tpqr001.status).toBe("capability_denied");
    expect(out.tpqr001.capabilitySatisfied).toBe(false);
    expect(out.tpqr001.result.included).toHaveLength(0);
  });

  it("tpqr003 flag=true without capability returns capability_denied with no included", () => {
    const out = runPhase3mDisabledInternalSeamPrototype({
      workspaceId: WS,
      referenceClockMs: REF_CLOCK_MS,
      flags: { tpqr003: true },
      capabilities: [],
      rows: { tpqr003: [TPQR003_PAST_DUE_FLAG_FALSE] },
    });
    expect(out.tpqr003.status).toBe("capability_denied");
    expect(out.tpqr003.capabilitySatisfied).toBe(false);
    expect(out.tpqr003.result.included).toHaveLength(0);
  });

  it("tpqr004 flag=true without capability returns capability_denied with no included", () => {
    const out = runPhase3mDisabledInternalSeamPrototype({
      workspaceId: WS,
      referenceClockMs: REF_CLOCK_MS,
      flags: { tpqr004: true },
      capabilities: [],
      rows: { tpqr004: [TPQR004_CRM_LINKED] },
    });
    expect(out.tpqr004.status).toBe("capability_denied");
    expect(out.tpqr004.capabilitySatisfied).toBe(false);
    expect(out.tpqr004.result.included).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TPQR-001: flag + capability → evaluated
// ---------------------------------------------------------------------------

describe("Phase 3M — TPQR-001 evaluated", () => {
  const out = runPhase3mDisabledInternalSeamPrototype({
    workspaceId: WS,
    referenceClockMs: REF_CLOCK_MS,
    flags: { tpqr001: true },
    capabilities: [CAPABILITY_BLOCKED_DECISION_READ],
    rows: {
      tpqr001: [
        TPQR001_STALE_NO_REVIEW,
        TPQR001_IN_REVIEW,
        TPQR001_FRESH,
        TPQR001_WRONG_WS,
      ],
    },
  });

  it("status is evaluated", () => {
    expect(out.tpqr001.status).toBe("evaluated");
  });

  it("capabilitySatisfied is true", () => {
    expect(out.tpqr001.capabilitySatisfied).toBe(true);
  });

  it("includes the stale no-approvalTask row", () => {
    const included = out.tpqr001.result.included;
    const found = included.find((c) => c.sourceRowId === "m-ai-stale-no-review");
    expect(found).toBeDefined();
  });

  it("excludes wrong-workspace row", () => {
    const exc = out.tpqr001.result.excluded;
    const found = exc.find(
      (e) =>
        e.sourceRowId === "m-ai-wrong-ws" &&
        e.exclusionReason === "workspace_mismatch",
    );
    expect(found).toBeDefined();
  });

  it("excludes row with approvalTask present", () => {
    const exc = out.tpqr001.result.excluded;
    const found = exc.find(
      (e) =>
        e.sourceRowId === "m-ai-in-review" &&
        e.exclusionReason === "already_in_review",
    );
    expect(found).toBeDefined();
  });

  it("excludes fresh row (within 72h threshold)", () => {
    const exc = out.tpqr001.result.excluded;
    const found = exc.find(
      (e) =>
        e.sourceRowId === "m-ai-fresh" &&
        e.exclusionReason === "threshold_not_met",
    );
    expect(found).toBeDefined();
  });

  it("productionIntegrationAllowed is still false", () => {
    expect(out.productionIntegrationAllowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TPQR-003: flag + capability → evaluated
// ---------------------------------------------------------------------------

describe("Phase 3M — TPQR-003 evaluated", () => {
  const out = runPhase3mDisabledInternalSeamPrototype({
    workspaceId: WS,
    referenceClockMs: REF_CLOCK_MS,
    flags: { tpqr003: true },
    capabilities: [CAPABILITY_OVERDUE_COMMITMENT_READ],
    rows: {
      tpqr003: [TPQR003_PAST_DUE_FLAG_FALSE, TPQR003_FUTURE_DUE_FLAG_TRUE],
    },
  });

  it("status is evaluated", () => {
    expect(out.tpqr003.status).toBe("evaluated");
  });

  it("includes past-due row even when persistedOverdueFlag=false", () => {
    const found = out.tpqr003.result.included.find(
      (c) => c.sourceRowId === "m-c-past-flag-false",
    );
    expect(found).toBeDefined();
  });

  it("excludes future-due row even when persistedOverdueFlag=true", () => {
    const found = out.tpqr003.result.excluded.find(
      (e) =>
        e.sourceRowId === "m-c-future-flag-true" &&
        e.exclusionReason === "threshold_not_met",
    );
    expect(found).toBeDefined();
  });

  it("productionIntegrationAllowed is still false", () => {
    expect(out.productionIntegrationAllowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TPQR-004: flag + capability → evaluated
// ---------------------------------------------------------------------------

describe("Phase 3M — TPQR-004 evaluated", () => {
  const out = runPhase3mDisabledInternalSeamPrototype({
    workspaceId: WS,
    referenceClockMs: REF_CLOCK_MS,
    flags: { tpqr004: true },
    capabilities: [CAPABILITY_CUSTOMER_WAITING_READ],
    rows: {
      tpqr004: [TPQR004_CRM_LINKED, TPQR004_GENERIC_ONLY, TPQR004_GENERIC_DUP],
    },
  });

  it("status is evaluated", () => {
    expect(out.tpqr004.status).toBe("evaluated");
  });

  it("includes CRM-linked candidate", () => {
    const found = out.tpqr004.result.included.find(
      (c) => c.producerKind === "crm_linked" && c.sourceRowId === "m-et-crm",
    );
    expect(found).toBeDefined();
  });

  it("includes generic-only candidate", () => {
    const found = out.tpqr004.result.included.find(
      (c) =>
        c.producerKind === "generic" && c.sourceRowId === "m-et-generic",
    );
    expect(found).toBeDefined();
  });

  it("deduplicates generic duplicate by emailThreadId (CRM wins)", () => {
    const dupExcluded = out.tpqr004.result.excluded.find(
      (e) =>
        e.sourceRowId === "m-et-generic-dup" &&
        e.exclusionReason === "deduped_by_crm_linked",
    );
    expect(dupExcluded).toBeDefined();
  });

  it("no duplicate emailThreadIds in included candidates", () => {
    const ids = out.tpqr004.result.included.map((c) => c.emailThreadId);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  it("productionIntegrationAllowed is still false", () => {
    expect(out.productionIntegrationAllowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// productionIntegrationAllowed is never true across all combinations
// ---------------------------------------------------------------------------

describe("Phase 3M — productionIntegrationAllowed invariant", () => {
  const allCapabilities = [
    CAPABILITY_BLOCKED_DECISION_READ,
    CAPABILITY_OVERDUE_COMMITMENT_READ,
    CAPABILITY_CUSTOMER_WAITING_READ,
  ];

  it("is false when all flags disabled", () => {
    const out = runPhase3mDisabledInternalSeamPrototype({
      workspaceId: WS,
      referenceClockMs: REF_CLOCK_MS,
      rows: {},
    });
    expect(out.productionIntegrationAllowed).toBe(false);
  });

  it("is false when all flags enabled and all capabilities present", () => {
    const out = runPhase3mDisabledInternalSeamPrototype({
      workspaceId: WS,
      referenceClockMs: REF_CLOCK_MS,
      flags: { tpqr001: true, tpqr003: true, tpqr004: true },
      capabilities: allCapabilities,
      rows: {},
    });
    expect(out.productionIntegrationAllowed).toBe(false);
  });

  it("is false when flags enabled but capabilities missing", () => {
    const out = runPhase3mDisabledInternalSeamPrototype({
      workspaceId: WS,
      referenceClockMs: REF_CLOCK_MS,
      flags: { tpqr001: true, tpqr003: true, tpqr004: true },
      capabilities: [],
      rows: {},
    });
    expect(out.productionIntegrationAllowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Source file purity checks
// ---------------------------------------------------------------------------

describe("Phase 3M source file purity", () => {
  const src = readFileSync(
    new URL(
      "./phase3m-disabled-internal-seam-prototype.ts",
      import.meta.url,
    ),
    "utf-8",
  );

  it("has no @/ import", () => {
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/import\s+["']@\//);
  });

  it("has no db import", () => {
    expect(src).not.toMatch(/from\s+["']db["']/);
    expect(src).not.toMatch(/require\s*\(\s*["']db["']\s*\)/);
  });

  it("has no prisma import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*prisma[^"']*["']/i);
  });

  it("has no Date.now() call", () => {
    expect(src).not.toMatch(/Date\.now\s*\(/);
  });

  it("has no fs import", () => {
    expect(src).not.toMatch(/from\s+["']fs["']/);
    expect(src).not.toMatch(/from\s+["']node:fs["']/);
  });

  it("has no network import (http/https/fetch/axios)", () => {
    expect(src).not.toMatch(/from\s+["'](https?|axios|node-fetch|got)["']/);
  });

  it("has no app/ import", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*\/app\//);
  });

  it("has no data/queries import", () => {
    expect(src).not.toMatch(/data\/queries/);
  });

  it("has no mobile read-model import", () => {
    expect(src).not.toMatch(/mobile-command-read-model/);
  });
});
