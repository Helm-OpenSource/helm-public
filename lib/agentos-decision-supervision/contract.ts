import {
  DECISION_ACTION_LEVELS,
  type ControlGate,
  type ControlGateResult,
  type ControlGateType,
  type DecisionActionLevel,
  type DecisionEvaluation,
  type DecisionObject,
  type DecisionReceiptEvidence,
  type Intervention,
  type SupervisionRoute,
  type SupervisionSeverity,
  type SupervisionSignal,
  type SupervisionSignalType,
} from "@/lib/agentos-decision-supervision/types";

// ---------------------------------------------------------------------------
// Decision / Supervision contract — pure, deterministic, fail-closed rules.
//
// The functions here decide how far a judgement may go, which control gates
// stand in its way, and how outcomes flow back as evaluations. They fail
// closed everywhere: an uncited decision stays at observe, high/critical risk
// cannot skip the owner gate, a missing gate result blocks (it never passes
// by default), and rejected / failed receipts always come back as learnable
// evaluations instead of disappearing into a terminal state. Confidence is
// never consulted for authorization. Automation promotion is a per
// problem-category projection that only ever produces an owner-review
// candidate — the contract cannot express an auto-approved promotion.
// ---------------------------------------------------------------------------

export function actionLevelIndex(level: DecisionActionLevel): number {
  return DECISION_ACTION_LEVELS.indexOf(level);
}

export function compareActionLevels(
  a: DecisionActionLevel,
  b: DecisionActionLevel,
): number {
  return actionLevelIndex(a) - actionLevelIndex(b);
}

export function minActionLevel(
  a: DecisionActionLevel,
  b: DecisionActionLevel,
): DecisionActionLevel {
  return compareActionLevels(a, b) <= 0 ? a : b;
}

export type DecisionValidation = {
  valid: boolean;
  // The highest action level this decision object can hold RIGHT NOW, after
  // fail-closed clamping. Invalid decisions clamp to observe.
  maxActionLevel: DecisionActionLevel;
  reasons: string[];
};

// Validates the structural integrity of a decision object and clamps its
// action level. Key rules: a decision without knowledgeRefs AND evidenceRefs
// stays at observe (draft), high / critical risk requires an owner approval
// gate, and an active candidate must carry a rollback path and receipt
// evidence before it may even be SUBMITTED for promotion evaluation.
export function validateDecisionObject(decision: DecisionObject): DecisionValidation {
  const hardErrors: string[] = [];
  const reasons: string[] = [];
  let maxActionLevel = decision.allowedActionLevel;

  if (!decision.tenantRef || decision.tenantRef.trim() === "") {
    hardErrors.push("tenant_missing");
  }
  if (decision.businessQuestion.trim() === "") {
    hardErrors.push("business_question_missing");
  }
  if (
    (decision.riskLevel === "high" || decision.riskLevel === "critical") &&
    decision.ownerGate !== "approval_required" &&
    decision.ownerGate !== "dual_approval_required"
  ) {
    hardErrors.push("owner_gate_insufficient_for_risk");
  }
  // Owner decision 2026-07-07 (requirements §19 Q3): dual approval is enabled —
  // critical risk may never settle for a single approval.
  if (decision.riskLevel === "critical" && decision.ownerGate !== "dual_approval_required") {
    hardErrors.push("critical_risk_requires_dual_approval");
  }

  if (decision.knowledgeRefs.length === 0 || decision.evidenceRefs.length === 0) {
    reasons.push("uncited_decision");
    maxActionLevel = minActionLevel(maxActionLevel, "observe");
  }
  if (compareActionLevels(decision.allowedActionLevel, "active_candidate") >= 0) {
    if (decision.rollbackPath === null || decision.rollbackPath.trim() === "") {
      reasons.push("rollback_path_missing");
      maxActionLevel = minActionLevel(maxActionLevel, "shadow");
    }
    if (decision.receiptRefs.length === 0) {
      reasons.push("receipt_evidence_missing");
      maxActionLevel = minActionLevel(maxActionLevel, "shadow");
    }
  }

  if (hardErrors.length > 0) {
    return {
      valid: false,
      maxActionLevel: "observe",
      reasons: [...hardErrors, ...reasons],
    };
  }
  return { valid: true, maxActionLevel, reasons };
}

export type DecisionKnowledgePosture = {
  // Lowest usable level across all cited knowledge cards (company-memory
  // L0-L5 semantics).
  minCitedUsableLevel: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
  hasConflict: boolean;
  hasStaleOrExpired: boolean;
};

export type DecisionReceiptPosture = {
  verifiedReceiptCount: number;
  rejectedOrFailedReceiptCount: number;
  hasSelfReportedOnly: boolean;
};

export const NEUTRAL_KNOWLEDGE_POSTURE: DecisionKnowledgePosture = {
  minCitedUsableLevel: "L0",
  hasConflict: false,
  hasStaleOrExpired: false,
};

export const NEUTRAL_RECEIPT_POSTURE: DecisionReceiptPosture = {
  verifiedReceiptCount: 0,
  rejectedOrFailedReceiptCount: 0,
  hasSelfReportedOnly: false,
};

// Derives which control gates a decision must pass before it can advance.
// Citation and policy gates always apply; the rest scale with risk, action
// level, and posture. Gate order is deterministic for auditability.
export function deriveRequiredControlGates(
  decision: DecisionObject,
  knowledgePosture: DecisionKnowledgePosture,
  receiptPosture: DecisionReceiptPosture,
): ControlGate[] {
  const gates: ControlGate[] = [
    {
      gateType: "citation_gate",
      reason: "every formal decision must cite knowledge and evidence",
    },
    {
      gateType: "policy_gate",
      reason: "every formal decision must pass the applicable policy rules",
    },
  ];

  const ownerGateReasons: string[] = [];
  if (decision.riskLevel === "high" || decision.riskLevel === "critical") {
    ownerGateReasons.push(`risk level ${decision.riskLevel} requires owner approval`);
  }
  if (decision.ownerGate !== "none") {
    ownerGateReasons.push(`decision declares owner gate ${decision.ownerGate}`);
  }
  if (knowledgePosture.hasConflict) {
    ownerGateReasons.push("cited knowledge has an unresolved conflict");
  }
  if (knowledgePosture.hasStaleOrExpired) {
    ownerGateReasons.push("cited knowledge is stale or expired");
  }
  if (ownerGateReasons.length > 0) {
    gates.push({ gateType: "owner_gate", reason: ownerGateReasons.join("; ") });
  }

  if (compareActionLevels(decision.allowedActionLevel, "draft_task") >= 0) {
    gates.push({
      gateType: "sod_gate",
      reason: "task drafts require executor / acceptor separation",
    });
  }
  if (
    compareActionLevels(decision.allowedActionLevel, "shadow") >= 0 ||
    receiptPosture.rejectedOrFailedReceiptCount > 0
  ) {
    gates.push({
      gateType: "receipt_gate",
      reason:
        receiptPosture.rejectedOrFailedReceiptCount > 0
          ? "rejected or failed receipts must be resolved with verified evidence"
          : "shadow and above require verified receipt evidence",
    });
  }
  if (decision.allowedActionLevel === "active_candidate") {
    gates.push({
      gateType: "shadow_gate",
      reason: "active candidates require a passed shadow comparison",
    });
    gates.push({
      gateType: "rollback_gate",
      reason: "active candidates require a pause / downgrade / rollback path",
    });
  }

  return gates;
}

export type DecisionAdvanceVerdict = {
  canAdvance: boolean;
  // Gates that were evaluated and failed.
  blockedBy: ControlGateType[];
  // Required gates with no result at all — these block too (fail closed).
  missingGates: ControlGateType[];
  reasons: string[];
};

// Decides whether a decision may advance to its allowed action level given
// the gate results at hand. Fail closed: structural invalidity blocks, a
// failed gate blocks, and a required gate with NO result blocks — absence of
// evidence is never treated as a pass. confidence=high changes nothing.
export function canDecisionAdvance(
  decision: DecisionObject,
  gateResults: readonly ControlGateResult[],
  // The postures MUST be supplied by the caller: re-deriving with neutral
  // postures here would silently drop the conflict / staleness / failed-receipt
  // gates that deriveRequiredControlGates adds, letting a decision advance past
  // exactly the risks the postures exist to surface (fail-closed regression
  // fixed 2026-07-07).
  knowledgePosture: DecisionKnowledgePosture,
  receiptPosture: DecisionReceiptPosture,
): DecisionAdvanceVerdict {
  const validation = validateDecisionObject(decision);
  const required = deriveRequiredControlGates(decision, knowledgePosture, receiptPosture);

  const requiresDualApproval =
    decision.ownerGate === "dual_approval_required" || decision.riskLevel === "critical";

  const blockedBy: ControlGateType[] = [];
  const missingGates: ControlGateType[] = [];
  let dualApprovalUnsatisfied = false;
  for (const gate of required) {
    const result = gateResults.find((entry) => entry.gateType === gate.gateType);
    if (!result) {
      missingGates.push(gate.gateType);
    } else if (!result.passed) {
      blockedBy.push(gate.gateType);
    } else if (gate.gateType === "owner_gate" && requiresDualApproval) {
      // Dual approval demands two DISTINCT approver identities on the passed
      // owner gate; a bare passed=true can never satisfy it (fail-closed).
      const distinctApprovers = new Set(
        (result.approverRefs ?? []).map((ref) => ref.trim()).filter((ref) => ref !== ""),
      );
      if (distinctApprovers.size < 2) {
        blockedBy.push(gate.gateType);
        dualApprovalUnsatisfied = true;
      }
    }
  }

  const reasons = [...validation.reasons];
  if (dualApprovalUnsatisfied) {
    reasons.push("dual_approval_not_satisfied");
  }
  if (!validation.valid) {
    reasons.push("decision_invalid");
  }
  if (
    validation.valid &&
    compareActionLevels(validation.maxActionLevel, decision.allowedActionLevel) < 0
  ) {
    reasons.push("action_level_clamped");
  }

  const canAdvance =
    validation.valid &&
    compareActionLevels(validation.maxActionLevel, decision.allowedActionLevel) >= 0 &&
    blockedBy.length === 0 &&
    missingGates.length === 0;

  return { canAdvance, blockedBy, missingGates, reasons };
}

export type ObservedOperationalObject = {
  objectRef: string;
  tenantRef: string | null;
  signalType: SupervisionSignalType;
  ownerRef: string | null;
  observedFact: string;
};

export type SupervisionBaseline = {
  baselineRef: string;
  expectation: string | null;
};

export type SupervisionEvidenceInput = {
  evidenceRefs: readonly string[];
  severityHint: SupervisionSeverity | null;
  interpretation: string | null;
};

const SEVERITY_ORDER: readonly SupervisionSeverity[] = [
  "info",
  "watch",
  "warning",
  "critical",
];

function severityAtLeast(a: SupervisionSeverity, b: SupervisionSeverity): boolean {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b);
}

function routeForSignal(
  signalType: SupervisionSignalType,
  severity: SupervisionSeverity,
  hasEvidence: boolean,
): SupervisionRoute {
  if (!hasEvidence) {
    // Unevidenced observations may only be watched; they cannot trigger
    // review load or interventions.
    return "watch";
  }
  switch (signalType) {
    case "policy_risk":
    case "compliance_risk":
      return severity === "critical" ? "freeze" : "owner_review";
    case "receipt_gap":
    case "stale_knowledge":
      return "owner_review";
    case "stuck_work":
    case "opportunity":
      return "work_packet";
    case "anomaly":
    case "drift":
    case "conversion_drop":
      return severityAtLeast(severity, "warning") ? "owner_review" : "watch";
  }
}

// Builds a supervision signal from an observation, a baseline, and evidence.
// Deterministic: the same inputs always produce the same signal. Facts stay
// separated from interpretation, evidence-free observations are capped at
// watch severity and route, and the recommended route can only ever be a
// suggestion / task draft / review gate / downgrade-freeze candidate.
export function deriveSupervisionSignal(
  observedObject: ObservedOperationalObject,
  baseline: SupervisionBaseline | null,
  evidence: SupervisionEvidenceInput,
): SupervisionSignal {
  const hasEvidence = evidence.evidenceRefs.length > 0;
  const confidence = !hasEvidence
    ? "low"
    : evidence.evidenceRefs.length >= 2
      ? "high"
      : "medium";
  const severity: SupervisionSeverity = !hasEvidence
    ? "watch"
    : (evidence.severityHint ?? "warning");

  return {
    signalId: `signal:${observedObject.objectRef}:${observedObject.signalType}`,
    tenantRef: observedObject.tenantRef,
    signalType: observedObject.signalType,
    observedObjectRef: observedObject.objectRef,
    baselineRef: baseline?.baselineRef ?? null,
    evidenceRefs: evidence.evidenceRefs,
    severity,
    confidence,
    recommendedRoute: routeForSignal(observedObject.signalType, severity, hasEvidence),
    ownerRef: observedObject.ownerRef,
    deadlineOrSla: null,
    status: "open",
    observedFact: observedObject.observedFact,
    interpretation: hasEvidence ? evidence.interpretation : null,
  };
}

export type SupervisionRoutingResult =
  | {
      kind: "status_update_only";
      nextStatus: "acknowledged" | "dismissed";
    }
  | {
      kind: "intervention_draft";
      intervention: Intervention;
    };

// Routes a supervision signal. The closed result type is the boundary: a
// route resolves to a signal status update or to a PROPOSED intervention
// draft that still has to clear its control gates — never to an external
// action, an outbound message, or a state write.
export function routeSupervisionSignal(signal: SupervisionSignal): SupervisionRoutingResult {
  const draft = (
    interventionType: Intervention["interventionType"],
    controlGateRefs: readonly ControlGateType[],
    receiptRequired: boolean,
  ): SupervisionRoutingResult => ({
    kind: "intervention_draft",
    intervention: {
      interventionId: `intervention:${signal.signalId}:${interventionType}`,
      tenantRef: signal.tenantRef,
      interventionType,
      sourceSignalRef: signal.signalId,
      decisionRef: null,
      ownerRef: signal.ownerRef,
      status: "proposed",
      controlGateRefs,
      receiptRequired,
    },
  });

  switch (signal.recommendedRoute) {
    case "ignore":
      return { kind: "status_update_only", nextStatus: "dismissed" };
    case "watch":
      return { kind: "status_update_only", nextStatus: "acknowledged" };
    case "owner_review":
      return draft("owner_review", ["owner_gate"], true);
    case "work_packet":
      return draft("work_packet_draft", ["citation_gate", "sod_gate"], true);
    case "freeze":
      return draft("freeze", ["owner_gate"], true);
    case "rollback":
      return draft("rollback", ["owner_gate", "rollback_gate"], true);
    case "pack_candidate":
      return draft("pack_candidate", ["owner_gate"], false);
  }
}

export type FinalActionRecord = {
  finalActionRef: string | null;
  humanDecision: string | null;
  followedAiRecommendation: boolean | null;
};

export type DecisionOutcomeRecord = {
  outcomeRef: string | null;
  result: "success" | "failure" | "unknown";
};

// Evaluates how a decision actually played out. Rejected / failed / blocked
// receipts always flow back as a learnable evaluation with a structured
// variance reason — they are NEVER swallowed as a normal terminal state.
// Promotion evidence requires verified success; self-reported outcomes and
// receipt gaps cannot promote anything.
export function evaluateDecisionOutcome(
  decision: DecisionObject,
  finalAction: FinalActionRecord,
  receipts: readonly DecisionReceiptEvidence[],
  outcome: DecisionOutcomeRecord,
): DecisionEvaluation {
  const base = {
    evaluationId: `evaluation:${decision.decisionId}`,
    decisionRef: decision.decisionId,
    problemCategoryRef: decision.problemCategoryRef,
    aiRecommendation: decision.recommendedOption,
    humanDecision: finalAction.humanDecision,
    finalActionRef: finalAction.finalActionRef,
    outcomeRef: outcome.outcomeRef,
    receiptRefs: receipts.map((receipt) => receipt.receiptRef),
  };

  if (receipts.length === 0) {
    return {
      ...base,
      varianceReason: "receipt_gap",
      learnable: false,
      automationImpact: "none",
    };
  }

  const rejectedOrFailed = receipts.filter(
    (receipt) =>
      receipt.outcome === "rejected" || receipt.outcome === "verified_failure",
  );
  if (rejectedOrFailed.length > 0) {
    const unclassified = rejectedOrFailed.some((receipt) => receipt.reasonCode === null);
    return {
      ...base,
      varianceReason: unclassified
        ? "unclassified_negative_receipt"
        : (rejectedOrFailed[0].reasonCode ?? "negative_receipt"),
      learnable: true,
      automationImpact: "downgrade_candidate",
    };
  }

  if (receipts.some((receipt) => receipt.outcome === "blocked")) {
    return {
      ...base,
      varianceReason: "blocked_execution",
      learnable: true,
      automationImpact: "none",
    };
  }

  const allVerifiedSuccess = receipts.every(
    (receipt) => receipt.outcome === "verified_success",
  );
  if (
    allVerifiedSuccess &&
    outcome.result === "success" &&
    finalAction.followedAiRecommendation !== false
  ) {
    return {
      ...base,
      varianceReason: null,
      learnable: true,
      automationImpact: "promote_candidate",
    };
  }

  return {
    ...base,
    varianceReason:
      finalAction.followedAiRecommendation === false
        ? "human_overrode_recommendation"
        : allVerifiedSuccess
          ? "outcome_not_verified_successful"
          : "self_reported_only",
    learnable: true,
    automationImpact: "none",
  };
}

export type ReceiptQualityPosture = {
  verifiedCount: number;
  rejectedOrFailedCount: number;
  selfReportedOnlyCount: number;
};

export type RollbackPosture = {
  rollbackPathDefined: boolean;
  freezeSwitchAvailable: boolean;
};

export type AutomationPromotionCandidate = {
  problemCategoryRef: string | null;
  // The automation governor is a per problem-category / scene projection,
  // never a global switch — the scope literal makes that unrepresentable.
  scope: "problem_category";
  eligible: boolean;
  blockedBy: string[];
  // Literal true: the contract cannot express an auto-approved promotion.
  // An eligible candidate is an owner-review input, nothing more.
  requiresOwnerApproval: true;
};

// Derives whether a problem category has enough evidence to be PROPOSED for
// automation promotion. Fail closed: mixed or missing categories, negative
// evaluations, receipt gaps, unresolved negative receipts, and missing
// rollback / freeze posture all block.
export function deriveAutomationPromotionCandidate(
  evaluations: readonly DecisionEvaluation[],
  receiptQuality: ReceiptQualityPosture,
  rollbackPosture: RollbackPosture,
): AutomationPromotionCandidate {
  const blockedBy: string[] = [];
  const categories = new Set(
    evaluations
      .map((evaluation) => evaluation.problemCategoryRef)
      .filter((ref): ref is string => ref !== null),
  );
  const problemCategoryRef = categories.size === 1 ? [...categories][0] : null;

  if (evaluations.length === 0) {
    blockedBy.push("no_evaluations");
  } else if (categories.size === 0) {
    blockedBy.push("problem_category_missing");
  } else if (
    categories.size > 1 ||
    evaluations.some((evaluation) => evaluation.problemCategoryRef === null)
  ) {
    blockedBy.push("mixed_problem_categories");
  }

  if (
    evaluations.some(
      (evaluation) =>
        evaluation.automationImpact === "downgrade_candidate" ||
        evaluation.automationImpact === "freeze_candidate",
    )
  ) {
    blockedBy.push("negative_evaluation_present");
  }
  if (
    !evaluations.some((evaluation) => evaluation.automationImpact === "promote_candidate")
  ) {
    blockedBy.push("no_promotion_evidence");
  }
  if (receiptQuality.verifiedCount === 0) {
    blockedBy.push("receipt_gap");
  }
  if (receiptQuality.rejectedOrFailedCount > 0) {
    blockedBy.push("unresolved_negative_receipts");
  }
  if (!rollbackPosture.rollbackPathDefined) {
    blockedBy.push("rollback_path_missing");
  }
  if (!rollbackPosture.freezeSwitchAvailable) {
    blockedBy.push("freeze_switch_missing");
  }

  return {
    problemCategoryRef,
    scope: "problem_category",
    eligible: blockedBy.length === 0,
    blockedBy,
    requiresOwnerApproval: true,
  };
}
