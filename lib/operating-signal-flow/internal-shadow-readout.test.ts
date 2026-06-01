import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  projectOperatingSignalFlowInternalShadowReadout,
  type OperatingSignalFlowInternalShadowDiagnostics,
  type OperatingSignalFlowInternalShadowResult,
} from "@/lib/operating-signal-flow/internal-shadow-readout";

const REVIEWED_AT = "2026-05-21T08:30:00.000Z";
const GENERATED_AT = "2026-05-21T08:00:00.000Z";

const BASE_DIAGNOSTICS: OperatingSignalFlowInternalShadowDiagnostics = {
  actionCount: 15,
  approvalCount: 6,
  auditCount: 26,
  boundaryCounter: 0,
  pendingReviewCount: 2,
  tracePresenceCount: 15,
  workspaceCount: 1,
};

function shadowReady(
  overrides: Partial<OperatingSignalFlowInternalShadowDiagnostics> = {},
): OperatingSignalFlowInternalShadowResult {
  return {
    state: "shadow_ready",
    diagnostics: { ...BASE_DIAGNOSTICS, ...overrides },
    snapshot: {
      dataPosture: "current_window",
      window: "24h",
      generatedAt: GENERATED_AT,
      aiWorkPosture: {
        deterministicCoveragePercent: 100,
        explanationCoveragePercent: 0,
        evidenceCoveragePercent: 72,
        boundaryStoppedCount: overrides.boundaryCounter ?? BASE_DIAGNOSTICS.boundaryCounter,
      },
      events: Array.from({ length: 47 }, (_, index) => ({ id: `raw-event-${index + 1}` })),
    },
  };
}

describe("operating signal flow / internal shadow readout", () => {
  it("keeps the helper pure and detached from runtime-only surfaces", () => {
    const source = readFileSync(new URL("./internal-shadow-readout.ts", import.meta.url), "utf8");

    expect(source).not.toContain("server-only");
    expect(source).not.toContain("@/lib/db");
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("app/");
  });

  it("projects default flag-off as an internal disabled readout", () => {
    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result: { state: "disabled", reason: "flag_off" },
      reviewedAt: REVIEWED_AT,
    });

    expect(readout).toMatchObject({
      state: "shadow_disabled",
      reviewerDecision: "continue",
      sourceReason: "flag_off",
      nextReviewRequired: true,
      adoptionGuards: {
        routePageAdoptionAllowed: false,
        productionQueryDefaultAllowed: false,
        officialWriteAllowed: false,
        externalSendAllowed: false,
        llmFinalRankingAllowed: false,
      },
    });
    expect(readout.ownerRoles).toEqual(["engineering_reviewer", "founder_operator"]);
    expect(readout.volume.eventCount).toBeNull();
  });

  it("stops when the workspace is not allowlisted", () => {
    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result: { state: "disabled", reason: "workspace_not_in_allowlist" },
      reviewedAt: REVIEWED_AT,
    });

    expect(readout.state).toBe("shadow_not_allowed");
    expect(readout.reviewerDecision).toBe("stop");
    expect(readout.ownerRoles).toEqual(["engineering_reviewer", "security_reviewer", "founder_operator"]);
  });

  it("projects a clean single-workspace shadow result without raw tenant details", () => {
    const result = shadowReady() as OperatingSignalFlowInternalShadowResult & {
      rawTraceId: string;
      requestId: string;
      actorEmail: string;
      sourcePage: string;
      richActionDescription: string;
    };
    result.rawTraceId = "trace-raw-secret";
    result.requestId = "request-raw-secret";
    result.actorEmail = "person@example.com";
    result.sourcePage = "/internal/raw-source";
    result.richActionDescription = "call a real customer with an unreviewed commitment";

    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result,
      reviewedAt: REVIEWED_AT,
      shadowGeneratedAt: GENERATED_AT,
      maxShadowAgeMs: 60 * 60 * 1000,
    });

    expect(readout).toMatchObject({
      state: "shadow_ready_clean",
      reviewerDecision: "continue",
      scope: { singleWorkspace: true, workspaceCount: 1 },
      volume: { actionCount: 15, approvalCount: 6, auditCount: 26, eventCount: 47 },
      risk: { boundaryCounter: 0, pendingReviewCount: 2, boundaryPosture: "clear" },
      quality: {
        deterministicCoveragePercent: 100,
        explanationCoveragePercent: 0,
        evidenceCoveragePercent: 72,
        tracePresenceCount: 15,
      },
    });

    const serialized = JSON.stringify(readout);
    expect(serialized).not.toContain("raw-event-");
    expect(serialized).not.toContain("trace-raw-secret");
    expect(serialized).not.toContain("request-raw-secret");
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("/internal/raw-source");
    expect(serialized).not.toContain("real customer");
  });

  it("routes count drift to operations review and keeps it bounded to counters", () => {
    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result: shadowReady({ actionCount: 16, auditCount: 28 }),
      reviewedAt: REVIEWED_AT,
      previousDiagnostics: BASE_DIAGNOSTICS,
    });

    expect(readout.state).toBe("shadow_ready_drift_review");
    expect(readout.reviewerDecision).toBe("revise");
    expect(readout.ownerRoles).toEqual(["operations_reviewer", "product_owner", "founder_operator"]);
    expect(readout.drift).toMatchObject({
      posture: "requires_explanation",
      explanationProvided: false,
      changedCounters: [
        { counter: "actionCount", previous: 15, current: 16, delta: 1 },
        { counter: "auditCount", previous: 26, current: 28, delta: 2 },
      ],
    });
  });

  it("allows explained drift only as an internal readout continuation", () => {
    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result: shadowReady({ actionCount: 16 }),
      reviewedAt: REVIEWED_AT,
      previousDiagnostics: BASE_DIAGNOSTICS,
      driftExplanation: "Phase 3F closed one ActionItem receipt inside Helm.",
    });

    expect(readout.state).toBe("shadow_ready_drift_review");
    expect(readout.reviewerDecision).toBe("continue");
    expect(readout.drift.posture).toBe("explained");
    expect(readout.adoptionGuards.routePageAdoptionAllowed).toBe(false);
  });

  it("stops boundary-blocked shadow results instead of continuing", () => {
    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result: shadowReady({ boundaryCounter: 1 }),
      reviewedAt: REVIEWED_AT,
    });

    expect(readout.state).toBe("shadow_boundary_blocked");
    expect(readout.reviewerDecision).toBe("stop");
    expect(readout.risk.boundaryPosture).toBe("blocked");
    expect(readout.ownerRoles).toEqual(["security_reviewer", "data_protection_reviewer", "founder_operator"]);
  });

  it("treats cross-workspace degraded projection as a boundary stop", () => {
    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result: {
        state: "degraded",
        reason: "cross_workspace_projection",
        diagnostics: { ...BASE_DIAGNOSTICS, workspaceCount: 2 },
      },
      reviewedAt: REVIEWED_AT,
    });

    expect(readout.state).toBe("shadow_boundary_blocked");
    expect(readout.reviewerDecision).toBe("stop");
  });

  it("routes empty safe projections as degraded runtime-readiness blockers", () => {
    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result: {
        state: "degraded",
        reason: "empty_window",
        diagnostics: {
          actionCount: 0,
          approvalCount: 0,
          auditCount: 0,
          boundaryCounter: 0,
          pendingReviewCount: 0,
          tracePresenceCount: 0,
          workspaceCount: 1,
        },
      },
      reviewedAt: REVIEWED_AT,
    });

    expect(readout.state).toBe("shadow_degraded");
    expect(readout.reviewerDecision).toBe("revise");
    expect(readout.ownerRoles).toEqual(["engineering_reviewer", "founder_operator"]);
  });

  it("expires stale shadow probes before founder decisions", () => {
    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result: shadowReady(),
      reviewedAt: "2026-05-21T11:01:00.000Z",
      shadowGeneratedAt: GENERATED_AT,
      maxShadowAgeMs: 3 * 60 * 60 * 1000,
    });

    expect(readout.state).toBe("shadow_expired");
    expect(readout.reviewerDecision).toBe("revise");
    expect(readout.ownerRoles).toEqual(["operations_reviewer", "founder_operator"]);
  });
});
