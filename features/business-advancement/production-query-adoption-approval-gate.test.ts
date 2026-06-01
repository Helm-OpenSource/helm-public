import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
  POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
  PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_POSTURE,
  PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION,
  PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RUNTIME_ADOPTION,
  PRODUCTION_QUERY_ADOPTION_FORBIDDEN_WORK,
  PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES,
  evaluateProductionQueryAdoptionApprovalGate,
  type ProductionQueryAdoptionApprovalGateInput,
} from "./production-query-adoption-approval-gate";

function evaluate(
  patch: Partial<ProductionQueryAdoptionApprovalGateInput> = {},
) {
  return evaluateProductionQueryAdoptionApprovalGate({
    ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
    ...patch,
  });
}

describe("production query adoption approval gate constants", () => {
  it("keeps the gate planning-only and runtime adoption no-go", () => {
    expect(PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION).toBe(
      "production-query-adoption-approval-gate/v1",
    );
    expect(PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_POSTURE).toBe(
      "Planning-Only",
    );
    expect(PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RUNTIME_ADOPTION).toBe(
      "No-Go",
    );
  });

  it("uses canonical Phase 3S required reviewer roles", () => {
    expect(PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES).toEqual([
      "Engineering Lead",
      "Product Owner",
      "Security Reviewer",
      "Operations Lead",
      "Data Protection Officer",
    ]);
  });
});

describe("evaluateProductionQueryAdoptionApprovalGate blockers", () => {
  it("default fixture is No-Go and not ready for runtime gate input", () => {
    const result = evaluateProductionQueryAdoptionApprovalGate(
      DEFAULT_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
    );

    expect(result.decision).toBe("No-Go");
    expect(result.productionAdoptionAllowed).toBe(false);
    expect(result.runtimeIntegrationAllowed).toBe(false);
    expect(result.summary.approvedByRequiredReviewers).toBe(false);
    expect(result.blockers.join("\n")).toContain(
      "Production query adoption implementation plan must be versioned and approved",
    );
    expect(result.blockers.join("\n")).toContain(
      "All required reviewer roles must approve",
    );
  });

  it("requires redacted calibration package plus Phase 3R and Phase 3S redacted live evidence", () => {
    const result = evaluate({
      plan: {
        ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.plan,
        sourceEvidence: {
          ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.plan
            .sourceEvidence,
          phase3rPreflightPassed: false,
        },
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain("Phase 3R pass");
  });

  it("does not accept reviewer approval when the redacted calibration package is missing", () => {
    const result = evaluate({
      plan: {
        ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.plan,
        sourceEvidence: {
          ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.plan
            .sourceEvidence,
          redactedCalibrationPackageReady: false,
        },
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain(
      "redacted calibration package",
    );
  });

  it("requires target seams to stay read-only, disabled, and non-writing", () => {
    const result = evaluate({
      plan: {
        ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.plan,
        targetSeams:
          POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.plan.targetSeams.map(
            (seam, index) =>
              index === 0
                ? {
                    ...seam,
                    defaultEnabled: true,
                  }
                : seam,
          ),
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain("target query seam");
  });

  it("requires complete workspace, permission, redaction, ranking, clamp, and audit proof", () => {
    const result = evaluate({
      plan: {
        ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.plan,
        boundaryProof: {
          ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.plan
            .boundaryProof,
          objectReadChecked: false,
        },
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain("object-read");
  });

  it("requires disabled shadow-first rollout with rollback owner", () => {
    const result = evaluate({
      plan: {
        ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.plan,
        rolloutPlan: {
          ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.plan
            .rolloutPlan,
          disabledByDefault: false,
        },
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain("disabled by default");
  });

  it("requires approval record to match the same plan version", () => {
    const result = evaluate({
      approvalRecord: {
        ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.approvalRecord,
        planVersion: "v2.0.0",
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain("match plan id/version");
  });

  it("requires every canonical reviewer role", () => {
    const result = evaluate({
      approvalRecord: {
        ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.approvalRecord,
        approvals:
          POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.approvalRecord.approvals.filter(
            (approval) => approval.role !== "Security Reviewer",
          ),
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.missingReviewerRoles).toContain("Security Reviewer");
    expect(result.blockers.join("\n")).toContain("All required reviewer roles");
  });

  it("rejects conditional approval as not approved", () => {
    const result = evaluate({
      approvalRecord: {
        ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.approvalRecord,
        approvals:
          POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.approvalRecord.approvals.map(
            (approval) =>
              approval.role === "Operations Lead"
                ? {
                    ...approval,
                    decision: "conditional",
                  }
                : approval,
          ),
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.missingReviewerRoles).toContain("Operations Lead");
  });

  it("does not count reviewer roles from incomplete approval records", () => {
    const result = evaluate({
      approvalRecord: {
        ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.approvalRecord,
        approvals:
          POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.approvalRecord.approvals.map(
            (approval) =>
              approval.role === "Security Reviewer"
                ? {
                    ...approval,
                    riskNotes: "",
                  }
                : approval,
          ),
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.approvedReviewerRoles).not.toContain("Security Reviewer");
    expect(result.missingReviewerRoles).toContain("Security Reviewer");
  });

  it("rejects non-ISO approval timestamps", () => {
    const result = evaluate({
      approvalRecord: {
        ...POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.approvalRecord,
        approvals:
          POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT.approvalRecord.approvals.map(
            (approval) =>
              approval.role === "Data Protection Officer"
                ? {
                    ...approval,
                    signedAtIso: "April 27, 2026",
                  }
                : approval,
          ),
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.approvedReviewerRoles).not.toContain(
      "Data Protection Officer",
    );
    expect(result.missingReviewerRoles).toContain("Data Protection Officer");
  });
});

describe("evaluateProductionQueryAdoptionApprovalGate positive fixture", () => {
  it("reaches only Ready-For-Manual-Review and never production Go", () => {
    const result = evaluateProductionQueryAdoptionApprovalGate(
      POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
    );

    expect(result.decision).toBe("Ready-For-Manual-Review");
    expect(result.decision).not.toBe("Go");
    expect(result.blockers).toHaveLength(0);
    expect(result.productionAdoptionAllowed).toBe(false);
    expect(result.runtimeIntegrationAllowed).toBe(false);
    expect(result.runtimeAdoption).toBe("No-Go");
    expect(result.summary).toMatchObject({
      requested: true,
      approvedByRequiredReviewers: true,
      implementationPlanPresent: true,
      approvalGateDecision: "Ready-For-Manual-Review",
    });
  });

  it("keeps forbidden work explicit", () => {
    const forbidden = PRODUCTION_QUERY_ADOPTION_FORBIDDEN_WORK.join("\n").toLowerCase();

    expect(forbidden).toContain("data/queries.ts");
    expect(forbidden).toContain("api route");
    expect(forbidden).toContain("prisma");
    expect(forbidden).toContain("mobile read-model");
    expect(forbidden).toContain("official write");
    expect(forbidden).toContain("auto-execute");
  });

  it("returns deterministic stable output", () => {
    const first = evaluateProductionQueryAdoptionApprovalGate(
      POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
    );
    const second = evaluateProductionQueryAdoptionApprovalGate(
      POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
    );

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
