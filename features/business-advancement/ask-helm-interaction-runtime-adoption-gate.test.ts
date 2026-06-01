import { describe, expect, it } from "vitest";

import {
  ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_FORBIDDEN_WORK,
  ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_POSTURE,
  ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RULE_VERSION,
  ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RUNTIME_ADOPTION,
  DEFAULT_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
  POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
  evaluateAskHelmInteractionRuntimeAdoptionGate,
  type AskHelmInteractionRuntimeAdoptionGateInput,
} from "./ask-helm-interaction-runtime-adoption-gate";

function evaluate(
  patch: Partial<AskHelmInteractionRuntimeAdoptionGateInput> = {},
) {
  return evaluateAskHelmInteractionRuntimeAdoptionGate({
    ...POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
    ...patch,
  });
}

describe("Ask Helm interaction runtime adoption gate constants", () => {
  it("keeps Slice 5 planning-only with runtime adoption no-go", () => {
    expect(ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RULE_VERSION).toBe(
      "ask-helm-interaction-runtime-adoption-gate/v1",
    );
    expect(ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_POSTURE).toBe(
      "Planning-Only",
    );
    expect(ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RUNTIME_ADOPTION).toBe(
      "No-Go",
    );
  });
});

describe("evaluateAskHelmInteractionRuntimeAdoptionGate blockers", () => {
  it("returns default No-Go because calibration is missing and production query adoption is not approved", () => {
    const result = evaluateAskHelmInteractionRuntimeAdoptionGate(
      DEFAULT_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
    );

    expect(result.decision).toBe("No-Go");
    expect(result.blockers).toContain(
      "Redacted real-data calibration evidence is missing or failed; synthetic/local fixtures cannot unlock runtime adoption review.",
    );
    expect(result.blockers.join("\n")).toContain(
      "Production query adoption request is not approved by required reviewers with a separate implementation plan",
    );
  });

  it("missing calibration blocks", () => {
    const result = evaluate({
      redactedRealDataCalibration:
        DEFAULT_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT
          .redactedRealDataCalibration,
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain(
      "Redacted real-data calibration evidence is missing or failed",
    );
  });

  it("does not accept forged synthetic calibration flags", () => {
    const result = evaluate({
      redactedRealDataCalibration: {
        ...POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT
          .redactedRealDataCalibration,
        sampleKind: "synthetic_fixture",
        realDataValidated: true,
        productionCalibrationComplete: true,
        blockers: [],
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain(
      "Redacted real-data calibration evidence is missing or failed",
    );
  });

  it("does not accept calibration when individual checks failed", () => {
    const result = evaluate({
      redactedRealDataCalibration: {
        ...POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT
          .redactedRealDataCalibration,
        checks: [
          ...POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT
            .redactedRealDataCalibration.checks,
          {
            name: "forced_failure",
            pass: false,
            detail: "test failure",
          },
        ],
        blockers: [],
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain(
      "Redacted real-data calibration evidence is missing or failed",
    );
  });

  it("offline eval failures block", () => {
    const result = evaluate({
      offlineEvalSummary: {
        ...POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT
          .offlineEvalSummary,
        allPass: false,
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain("Slice 4 offline eval");
  });

  it("missing rollback, disable, or audit posture blocks", () => {
    const result = evaluate({
      rollbackDisableAuditPosture: {
        rollbackPlanPresent: true,
        disableSwitchPresent: false,
        auditTrailPlanPresent: true,
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain(
      "Rollback plan, disable switch, and audit posture",
    );
  });

  it("missing membership or capability proof blocks", () => {
    const result = evaluate({
      membershipCapabilityProof: {
        workspaceScoped: true,
        membershipChecked: true,
        reviewerCapabilityChecked: false,
        noWorkspaceWideVisibilityByDefault: true,
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain(
      "Membership, workspace scope, reviewer capability",
    );
  });

  it("missing actionability proof blocks", () => {
    const result = evaluate({
      topListActionabilityProof: {
        topListLimitEnforced: true,
        actionLabelsReviewOnly: true,
        foldedHighRiskSummaryPresent: false,
        noExecutionLanguage: true,
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain("Top-list proof");
  });

  it("missing high-risk review coverage blocks", () => {
    const result = evaluate({
      highRiskReviewCoverage: {
        allHighRiskCandidatesReviewRequired: true,
        ownerOrAssignedReviewerRequired: false,
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain("High-risk candidates");
  });

  it("production query request without review blocks", () => {
    const result = evaluate({
      productionQueryAdoptionRequest: {
        requested: true,
        approvedByRequiredReviewers: false,
        implementationPlanPresent: true,
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain(
      "Production query adoption request is not approved",
    );
  });

  it("does not accept thin boolean approval without approval gate evidence", () => {
    const result = evaluate({
      productionQueryAdoptionRequest: {
        requested: true,
        approvedByRequiredReviewers: true,
        implementationPlanPresent: true,
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain("passing approval gate");
  });

  it("does not accept a forged approval gate decision with the wrong rule version", () => {
    const result = evaluate({
      productionQueryAdoptionRequest: {
        ...POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT
          .productionQueryAdoptionRequest,
        approvalGateRuleVersion: "production-query-adoption-approval-gate/v0",
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.blockers.join("\n")).toContain("passing approval gate");
  });
});

describe("evaluateAskHelmInteractionRuntimeAdoptionGate positive fixture", () => {
  it("only reaches Ready-For-Manual-Review and never Go", () => {
    const result = evaluateAskHelmInteractionRuntimeAdoptionGate(
      POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
    );

    expect(result.decision).toBe("Ready-For-Manual-Review");
    expect(result.decision).not.toBe("Go");
    expect(
      POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT
        .redactedRealDataCalibration.productionCalibrationComplete,
    ).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.allowedNextStep).toContain("manual runtime adoption review");
  });

  it("no output grants runtime integration or production adoption", () => {
    const defaultResult = evaluateAskHelmInteractionRuntimeAdoptionGate(
      DEFAULT_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
    );
    const positiveResult = evaluateAskHelmInteractionRuntimeAdoptionGate(
      POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
    );

    for (const result of [defaultResult, positiveResult]) {
      expect(result.runtimeIntegrationAllowed).toBe(false);
      expect(result.productionAdoptionAllowed).toBe(false);
      expect(result.runtimeAdoption).toBe("No-Go");
    }
  });

  it("forbidden work includes schema, API, page, runtime, official write, and auto execution", () => {
    const forbidden = ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_FORBIDDEN_WORK.join(
      "\n",
    ).toLowerCase();

    expect(forbidden).toContain("schema");
    expect(forbidden).toContain("api");
    expect(forbidden).toContain("page");
    expect(forbidden).toContain("runtime");
    expect(forbidden).toContain("official write");
    expect(forbidden).toContain("auto-execute");
  });

  it("returns deterministic stable output", () => {
    const first = evaluateAskHelmInteractionRuntimeAdoptionGate(
      POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
    );
    const second = evaluateAskHelmInteractionRuntimeAdoptionGate(
      POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
    );

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("emits required reviewer roles and mandatory checklist", () => {
    const result = evaluateAskHelmInteractionRuntimeAdoptionGate(
      POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
    );

    expect(result.requiredReviewerRoles).toEqual([
      "Engineering Lead",
      "Product Owner",
      "Security Reviewer",
      "Operations Lead",
      "Data Protection Officer",
    ]);
    expect(result.mandatoryChecklist.length).toBeGreaterThanOrEqual(8);
  });
});
