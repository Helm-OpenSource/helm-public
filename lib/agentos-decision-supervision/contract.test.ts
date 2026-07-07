import { describe, expect, it } from "vitest";
import {
  canDecisionAdvance,
  deriveAutomationPromotionCandidate,
  deriveRequiredControlGates,
  deriveSupervisionSignal,
  evaluateDecisionOutcome,
  NEUTRAL_KNOWLEDGE_POSTURE,
  NEUTRAL_RECEIPT_POSTURE,
  routeSupervisionSignal,
  validateDecisionObject,
  type ObservedOperationalObject,
} from "@/lib/agentos-decision-supervision/contract";
import {
  SUPERVISION_ROUTES,
  type ControlGateResult,
  type ControlGateType,
  type DecisionEvaluation,
  type DecisionObject,
} from "@/lib/agentos-decision-supervision/types";

function buildDecision(overrides: Partial<DecisionObject> = {}): DecisionObject {
  return {
    decisionId: "decision-1",
    tenantRef: "tenant-synthetic-1",
    decisionType: "diagnosis",
    businessQuestion: "Which loop should the team review first?",
    problemCategoryRef: "category-synthetic-1",
    contextRefs: ["context-1"],
    knowledgeRefs: ["card-1"],
    evidenceRefs: ["evidence-1"],
    policyRefs: ["policy-1"],
    receiptRefs: ["receipt-1"],
    alternatives: ["option-a", "option-b"],
    recommendedOption: "option-a",
    confidence: "medium",
    riskLevel: "low",
    allowedActionLevel: "recommend",
    ownerGate: "review_required",
    expiryOrReviewAt: null,
    rollbackPath: "revert-recommendation",
    ...overrides,
  };
}

function passAll(gateTypes: readonly ControlGateType[]): ControlGateResult[] {
  return gateTypes.map((gateType) => ({
    gateType,
    passed: true,
    evidenceRefs: [`gate-evidence:${gateType}`],
  }));
}

function buildEvaluation(overrides: Partial<DecisionEvaluation> = {}): DecisionEvaluation {
  return {
    evaluationId: "evaluation-1",
    decisionRef: "decision-1",
    problemCategoryRef: "category-synthetic-1",
    aiRecommendation: "option-a",
    humanDecision: "option-a",
    finalActionRef: "action-1",
    outcomeRef: "outcome-1",
    receiptRefs: ["receipt-1"],
    varianceReason: null,
    learnable: true,
    automationImpact: "promote_candidate",
    ...overrides,
  };
}

describe("validateDecisionObject", () => {
  it("an uncited decision stays at observe / draft", () => {
    for (const missing of [
      { knowledgeRefs: [] as string[] },
      { evidenceRefs: [] as string[] },
    ]) {
      const result = validateDecisionObject(
        buildDecision({ allowedActionLevel: "shadow", ...missing }),
      );
      expect(result.maxActionLevel).toBe("observe");
      expect(result.reasons).toContain("uncited_decision");
    }
  });

  it("high and critical risk require an owner approval gate", () => {
    for (const riskLevel of ["high", "critical"] as const) {
      const result = validateDecisionObject(
        buildDecision({ riskLevel, ownerGate: "none" }),
      );
      expect(result.valid).toBe(false);
      expect(result.maxActionLevel).toBe("observe");
      expect(result.reasons).toContain("owner_gate_insufficient_for_risk");
    }
    const gated = validateDecisionObject(
      buildDecision({ riskLevel: "high", ownerGate: "approval_required" }),
    );
    expect(gated.valid).toBe(true);
  });

  it("an active candidate without rollback path or receipt evidence clamps to shadow", () => {
    const noRollback = validateDecisionObject(
      buildDecision({ allowedActionLevel: "active_candidate", rollbackPath: null }),
    );
    expect(noRollback.maxActionLevel).toBe("shadow");
    expect(noRollback.reasons).toContain("rollback_path_missing");

    const noReceipts = validateDecisionObject(
      buildDecision({ allowedActionLevel: "active_candidate", receiptRefs: [] }),
    );
    expect(noReceipts.maxActionLevel).toBe("shadow");
    expect(noReceipts.reasons).toContain("receipt_evidence_missing");
  });

  it("fails closed when the tenant reference is missing", () => {
    const result = validateDecisionObject(buildDecision({ tenantRef: null }));
    expect(result.valid).toBe(false);
    expect(result.maxActionLevel).toBe("observe");
  });
});

describe("deriveRequiredControlGates", () => {
  it("always requires citation and policy gates", () => {
    const gates = deriveRequiredControlGates(
      buildDecision({ ownerGate: "none" }),
      NEUTRAL_KNOWLEDGE_POSTURE,
      NEUTRAL_RECEIPT_POSTURE,
    );
    const gateTypes = gates.map((gate) => gate.gateType);
    expect(gateTypes).toContain("citation_gate");
    expect(gateTypes).toContain("policy_gate");
  });

  it("requires the full gate chain for an active candidate", () => {
    const gates = deriveRequiredControlGates(
      buildDecision({
        allowedActionLevel: "active_candidate",
        riskLevel: "medium",
        ownerGate: "approval_required",
      }),
      NEUTRAL_KNOWLEDGE_POSTURE,
      NEUTRAL_RECEIPT_POSTURE,
    );
    const gateTypes = gates.map((gate) => gate.gateType);
    for (const expected of [
      "citation_gate",
      "policy_gate",
      "owner_gate",
      "sod_gate",
      "receipt_gate",
      "shadow_gate",
      "rollback_gate",
    ] as const) {
      expect(gateTypes).toContain(expected);
    }
  });

  it("adds an owner gate when cited knowledge is conflicted or stale", () => {
    const gates = deriveRequiredControlGates(
      buildDecision({ ownerGate: "none" }),
      { ...NEUTRAL_KNOWLEDGE_POSTURE, hasConflict: true },
      NEUTRAL_RECEIPT_POSTURE,
    );
    expect(gates.map((gate) => gate.gateType)).toContain("owner_gate");
  });

  it("adds a receipt gate when rejected or failed receipts are unresolved", () => {
    const gates = deriveRequiredControlGates(
      buildDecision({ allowedActionLevel: "recommend" }),
      NEUTRAL_KNOWLEDGE_POSTURE,
      { ...NEUTRAL_RECEIPT_POSTURE, rejectedOrFailedReceiptCount: 1 },
    );
    expect(gates.map((gate) => gate.gateType)).toContain("receipt_gate");
  });
});

describe("canDecisionAdvance", () => {
  const advance = (
    decision: Parameters<typeof canDecisionAdvance>[0],
    gateResults: Parameters<typeof canDecisionAdvance>[1],
    knowledgePosture = NEUTRAL_KNOWLEDGE_POSTURE,
    receiptPosture = NEUTRAL_RECEIPT_POSTURE,
  ) => canDecisionAdvance(decision, gateResults, knowledgePosture, receiptPosture);

  const activeCandidate = buildDecision({
    allowedActionLevel: "active_candidate",
    riskLevel: "medium",
    ownerGate: "approval_required",
  });
  const ALL_GATES: ControlGateType[] = [
    "citation_gate",
    "policy_gate",
    "owner_gate",
    "sod_gate",
    "receipt_gate",
    "shadow_gate",
    "rollback_gate",
  ];

  it("advances only when every required gate passed", () => {
    const verdict = advance(activeCandidate, passAll(ALL_GATES));
    expect(verdict.canAdvance).toBe(true);
    expect(verdict.blockedBy).toEqual([]);
    expect(verdict.missingGates).toEqual([]);
  });

  it("an uncited decision cannot enter shadow or active", () => {
    const uncited = buildDecision({
      allowedActionLevel: "shadow",
      knowledgeRefs: [],
    });
    const verdict = advance(uncited, passAll(ALL_GATES));
    expect(verdict.canAdvance).toBe(false);
    expect(verdict.reasons).toContain("uncited_decision");
  });

  it("critical risk cannot bypass owner approval, even with high confidence", () => {
    const critical = buildDecision({
      riskLevel: "critical",
      ownerGate: "dual_approval_required",
      confidence: "high",
    });
    // Owner gate result missing entirely: fail closed, do not assume a pass.
    const verdict = advance(
      critical,
      passAll(["citation_gate", "policy_gate"]),
    );
    expect(verdict.canAdvance).toBe(false);
    expect(verdict.missingGates).toContain("owner_gate");

    // Owner gate explicitly failed: still blocked.
    const failed = advance(critical, [
      ...passAll(["citation_gate", "policy_gate"]),
      { gateType: "owner_gate", passed: false, evidenceRefs: [] },
    ]);
    expect(failed.canAdvance).toBe(false);
    expect(failed.blockedBy).toContain("owner_gate");

    // Declaring no owner gate at critical risk is structurally invalid.
    const ungated = advance(
      buildDecision({ riskLevel: "critical", ownerGate: "none", confidence: "high" }),
      passAll(ALL_GATES),
    );
    expect(ungated.canAdvance).toBe(false);
    expect(ungated.reasons).toContain("owner_gate_insufficient_for_risk");

    // Owner decision 2026-07-07: critical may never settle for single approval.
    const singleGated = advance(
      buildDecision({
        riskLevel: "critical",
        ownerGate: "approval_required",
        confidence: "high",
      }),
      passAll(ALL_GATES),
    );
    expect(singleGated.canAdvance).toBe(false);
    expect(singleGated.reasons).toContain("critical_risk_requires_dual_approval");
  });

  it("conflicted or stale knowledge posture fail-closes advancement without an owner gate", () => {
    // Regression (2026-07-07 review): postures must reach canDecisionAdvance —
    // a low-risk, ungated decision whose cited knowledge is conflicted must be
    // blocked on the posture-derived owner gate, not silently advanced.
    const ungated = buildDecision({ riskLevel: "low", ownerGate: "none" });
    for (const posture of [
      { ...NEUTRAL_KNOWLEDGE_POSTURE, hasConflict: true },
      { ...NEUTRAL_KNOWLEDGE_POSTURE, hasStaleOrExpired: true },
    ]) {
      const verdict = advance(
        ungated,
        passAll(["citation_gate", "policy_gate"]),
        posture,
      );
      expect(verdict.canAdvance).toBe(false);
      expect(verdict.missingGates).toContain("owner_gate");
    }
  });

  it("rejected or failed receipts fail-close advancement without a receipt gate", () => {
    // Regression (2026-07-07 review): a recommend-level decision (below the
    // shadow threshold) with unresolved rejected/failed receipts must be
    // blocked on the posture-derived receipt gate.
    const recommend = buildDecision({ allowedActionLevel: "recommend" });
    const verdict = advance(
      recommend,
      passAll(["citation_gate", "policy_gate", "owner_gate"]),
      NEUTRAL_KNOWLEDGE_POSTURE,
      { ...NEUTRAL_RECEIPT_POSTURE, rejectedOrFailedReceiptCount: 1 },
    );
    expect(verdict.canAdvance).toBe(false);
    expect(verdict.missingGates).toContain("receipt_gate");
  });

  it("dual approval demands two distinct approver identities on the owner gate", () => {
    const critical = buildDecision({
      riskLevel: "critical",
      ownerGate: "dual_approval_required",
    });
    const gatesWithOwnerApprovers = (approverRefs: readonly string[]) => [
      ...passAll(ALL_GATES.filter((gate) => gate !== "owner_gate")),
      { gateType: "owner_gate" as const, passed: true, evidenceRefs: [], approverRefs },
    ];

    // A passed owner gate without approver identities cannot satisfy dual approval.
    const bare = advance(critical, passAll(ALL_GATES));
    expect(bare.canAdvance).toBe(false);
    expect(bare.reasons).toContain("dual_approval_not_satisfied");

    const single = advance(critical, gatesWithOwnerApprovers(["owner:alpha"]));
    expect(single.canAdvance).toBe(false);
    expect(single.reasons).toContain("dual_approval_not_satisfied");

    const duplicated = advance(
      critical,
      gatesWithOwnerApprovers(["owner:alpha", "owner:alpha"]),
    );
    expect(duplicated.canAdvance).toBe(false);
    expect(duplicated.reasons).toContain("dual_approval_not_satisfied");

    const dual = advance(
      critical,
      gatesWithOwnerApprovers(["owner:alpha", "owner:beta"]),
    );
    expect(dual.canAdvance).toBe(true);
    expect(dual.blockedBy).toEqual([]);
  });

  it("a failed receipt gate blocks an active candidate", () => {
    const verdict = advance(activeCandidate, [
      ...passAll(ALL_GATES.filter((gate) => gate !== "receipt_gate")),
      { gateType: "receipt_gate", passed: false, evidenceRefs: [] },
    ]);
    expect(verdict.canAdvance).toBe(false);
    expect(verdict.blockedBy).toContain("receipt_gate");
  });
});

describe("deriveSupervisionSignal", () => {
  const observed: ObservedOperationalObject = {
    objectRef: "loop-1",
    tenantRef: "tenant-synthetic-1",
    signalType: "receipt_gap",
    ownerRef: "owner-1",
    observedFact: "3 closed tasks have no structured receipt",
  };
  const baseline = { baselineRef: "baseline-1", expectation: "every closure has a receipt" };

  it("a receipt gap yields an open supervision signal routed to owner review", () => {
    const signal = deriveSupervisionSignal(observed, baseline, {
      evidenceRefs: ["evidence-1", "evidence-2"],
      severityHint: "warning",
      interpretation: "receipt discipline may be slipping",
    });
    expect(signal.status).toBe("open");
    expect(signal.signalType).toBe("receipt_gap");
    expect(signal.recommendedRoute).toBe("owner_review");
    expect(signal.observedFact).not.toBe(signal.interpretation);
  });

  it("evidence-free observations are capped at watch and carry no interpretation", () => {
    const signal = deriveSupervisionSignal(observed, null, {
      evidenceRefs: [],
      severityHint: "critical",
      interpretation: "speculation without evidence",
    });
    expect(signal.severity).toBe("watch");
    expect(signal.confidence).toBe("low");
    expect(signal.recommendedRoute).toBe("watch");
    expect(signal.interpretation).toBeNull();
  });

  it("critical policy risk routes to a freeze candidate, not an external action", () => {
    const signal = deriveSupervisionSignal(
      { ...observed, signalType: "policy_risk" },
      baseline,
      { evidenceRefs: ["evidence-1"], severityHint: "critical", interpretation: null },
    );
    expect(signal.recommendedRoute).toBe("freeze");
  });
});

describe("routeSupervisionSignal", () => {
  it("every route resolves to a status update or a proposed intervention draft", () => {
    for (const route of SUPERVISION_ROUTES) {
      const result = routeSupervisionSignal({
        signalId: "signal-1",
        tenantRef: "tenant-synthetic-1",
        signalType: "anomaly",
        observedObjectRef: "loop-1",
        baselineRef: null,
        evidenceRefs: ["evidence-1"],
        severity: "warning",
        confidence: "medium",
        recommendedRoute: route,
        ownerRef: "owner-1",
        deadlineOrSla: null,
        status: "open",
        observedFact: "fact",
        interpretation: null,
      });
      expect(["status_update_only", "intervention_draft"]).toContain(result.kind);
      if (result.kind === "intervention_draft") {
        // Interventions are born proposed and gated; nothing executes here.
        expect(result.intervention.status).toBe("proposed");
        expect(result.intervention.sourceSignalRef).toBe("signal-1");
      }
    }
  });

  it("freeze and rollback drafts require the owner gate and a receipt", () => {
    for (const route of ["freeze", "rollback"] as const) {
      const result = routeSupervisionSignal({
        signalId: "signal-2",
        tenantRef: "tenant-synthetic-1",
        signalType: "policy_risk",
        observedObjectRef: "loop-1",
        baselineRef: null,
        evidenceRefs: ["evidence-1"],
        severity: "critical",
        confidence: "high",
        recommendedRoute: route,
        ownerRef: "owner-1",
        deadlineOrSla: null,
        status: "open",
        observedFact: "fact",
        interpretation: null,
      });
      expect(result.kind).toBe("intervention_draft");
      if (result.kind === "intervention_draft") {
        expect(result.intervention.controlGateRefs).toContain("owner_gate");
        expect(result.intervention.receiptRequired).toBe(true);
      }
    }
  });
});

describe("evaluateDecisionOutcome", () => {
  const decision = buildDecision();
  const finalAction = {
    finalActionRef: "action-1",
    humanDecision: "option-a",
    followedAiRecommendation: true,
  };

  it("a rejected receipt flows back as a learnable downgrade evaluation", () => {
    const evaluation = evaluateDecisionOutcome(
      decision,
      finalAction,
      [{ receiptRef: "receipt-1", outcome: "rejected", reasonCode: "owner_disagreement" }],
      { outcomeRef: "outcome-1", result: "failure" },
    );
    expect(evaluation.learnable).toBe(true);
    expect(evaluation.automationImpact).toBe("downgrade_candidate");
    expect(evaluation.varianceReason).toBe("owner_disagreement");
  });

  it("a failed receipt without a reason code is flagged, not swallowed", () => {
    const evaluation = evaluateDecisionOutcome(
      decision,
      finalAction,
      [{ receiptRef: "receipt-1", outcome: "verified_failure", reasonCode: null }],
      { outcomeRef: "outcome-1", result: "failure" },
    );
    expect(evaluation.automationImpact).toBe("downgrade_candidate");
    expect(evaluation.varianceReason).toBe("unclassified_negative_receipt");
  });

  it("verified success with the recommendation followed yields a promotion candidate", () => {
    const evaluation = evaluateDecisionOutcome(
      decision,
      finalAction,
      [{ receiptRef: "receipt-1", outcome: "verified_success", reasonCode: null }],
      { outcomeRef: "outcome-1", result: "success" },
    );
    expect(evaluation.automationImpact).toBe("promote_candidate");
  });

  it("self-reported receipts and receipt gaps never promote", () => {
    const selfReported = evaluateDecisionOutcome(
      decision,
      finalAction,
      [{ receiptRef: "receipt-1", outcome: "self_reported_only", reasonCode: null }],
      { outcomeRef: "outcome-1", result: "success" },
    );
    expect(selfReported.automationImpact).toBe("none");

    const gap = evaluateDecisionOutcome(decision, finalAction, [], {
      outcomeRef: null,
      result: "unknown",
    });
    expect(gap.automationImpact).toBe("none");
    expect(gap.varianceReason).toBe("receipt_gap");
  });

  it("a human override is recorded as variance, not erased", () => {
    const evaluation = evaluateDecisionOutcome(
      decision,
      { ...finalAction, humanDecision: "option-b", followedAiRecommendation: false },
      [{ receiptRef: "receipt-1", outcome: "verified_success", reasonCode: null }],
      { outcomeRef: "outcome-1", result: "success" },
    );
    expect(evaluation.automationImpact).toBe("none");
    expect(evaluation.varianceReason).toBe("human_overrode_recommendation");
  });
});

describe("deriveAutomationPromotionCandidate", () => {
  const healthyReceipts = {
    verifiedCount: 5,
    rejectedOrFailedCount: 0,
    selfReportedOnlyCount: 0,
  };
  const healthyRollback = { rollbackPathDefined: true, freezeSwitchAvailable: true };

  it("proposes an owner-review candidate when evidence is complete", () => {
    const candidate = deriveAutomationPromotionCandidate(
      [buildEvaluation(), buildEvaluation({ evaluationId: "evaluation-2" })],
      healthyReceipts,
      healthyRollback,
    );
    expect(candidate.eligible).toBe(true);
    expect(candidate.problemCategoryRef).toBe("category-synthetic-1");
    expect(candidate.scope).toBe("problem_category");
    // Even an eligible candidate is only an owner-review input.
    expect(candidate.requiresOwnerApproval).toBe(true);
  });

  it("a receipt gap blocks promotion", () => {
    const candidate = deriveAutomationPromotionCandidate(
      [buildEvaluation()],
      { ...healthyReceipts, verifiedCount: 0 },
      healthyRollback,
    );
    expect(candidate.eligible).toBe(false);
    expect(candidate.blockedBy).toContain("receipt_gap");
  });

  it("negative evaluations and unresolved negative receipts block promotion", () => {
    const negativeEval = deriveAutomationPromotionCandidate(
      [buildEvaluation(), buildEvaluation({ automationImpact: "downgrade_candidate" })],
      healthyReceipts,
      healthyRollback,
    );
    expect(negativeEval.eligible).toBe(false);
    expect(negativeEval.blockedBy).toContain("negative_evaluation_present");

    const negativeReceipts = deriveAutomationPromotionCandidate(
      [buildEvaluation()],
      { ...healthyReceipts, rejectedOrFailedCount: 2 },
      healthyRollback,
    );
    expect(negativeReceipts.eligible).toBe(false);
    expect(negativeReceipts.blockedBy).toContain("unresolved_negative_receipts");
  });

  it("missing rollback or freeze posture blocks promotion", () => {
    const candidate = deriveAutomationPromotionCandidate(
      [buildEvaluation()],
      healthyReceipts,
      { rollbackPathDefined: false, freezeSwitchAvailable: false },
    );
    expect(candidate.eligible).toBe(false);
    expect(candidate.blockedBy).toEqual(
      expect.arrayContaining(["rollback_path_missing", "freeze_switch_missing"]),
    );
  });

  it("promotion is a per problem-category projection, never a global switch", () => {
    const mixed = deriveAutomationPromotionCandidate(
      [
        buildEvaluation({ problemCategoryRef: "category-a" }),
        buildEvaluation({ evaluationId: "evaluation-2", problemCategoryRef: "category-b" }),
      ],
      healthyReceipts,
      healthyRollback,
    );
    expect(mixed.eligible).toBe(false);
    expect(mixed.blockedBy).toContain("mixed_problem_categories");

    const uncategorized = deriveAutomationPromotionCandidate(
      [buildEvaluation({ problemCategoryRef: null })],
      healthyReceipts,
      healthyRollback,
    );
    expect(uncategorized.eligible).toBe(false);
    expect(uncategorized.blockedBy).toContain("problem_category_missing");
  });
});
