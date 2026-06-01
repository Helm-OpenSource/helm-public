/**
 * Helm Business Advancement — Product Phase 3 / Slice 3
 * Ask Helm Interaction Asset Capture Threshold & Eligibility.
 *
 * Planning-only artifact. This file defines pure, deterministic threshold
 * helpers for deciding whether synthetic Ask Helm interaction observations are
 * candidate-eligible, watch-only, or not eligible.
 *
 * It is NOT a runtime extractor, not an API, not a DB reader, not a queue, not
 * a page adapter, not an official write path, and not an execution authority.
 */

import type { ObjectRef, ReviewPosture } from "./contracts";

export const ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RULE_VERSION =
  "ask-helm-interaction-capture-thresholds/v1";
export const ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_POSTURE = "Planning-Only";
export const ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION = "No-Go";

export const REPEATED_INTENT_ROLLING_NATURAL_DAYS = 7;
export const REPEATED_INTENT_CANDIDATE_OCCURRENCES = 3;
export const REPEATED_INTENT_WATCH_ONLY_OCCURRENCES = 2;
export const ABANDONED_NUMERIC_CONFIDENCE_THRESHOLD = 0.85;

export type AskHelmCaptureCandidateKind =
  | "repeated_intent"
  | "boundary_hit"
  | "abandoned_high_confidence_answer"
  | "plan_follow_through"
  | "review_packet"
  | "handoff";

export type AskHelmCaptureEligibilityStatus =
  | "eligible_candidate"
  | "watch_only"
  | "not_eligible";

export type AskHelmBoundaryRequestKind =
  | "review_required_execution"
  | "official_write"
  | "send"
  | "approve"
  | "pay"
  | "unsupported_open_domain"
  | "ordinary_explanation";

export type AskHelmExplicitInteractionRequest =
  | "none"
  | "generate_plan"
  | "save_draft"
  | "queue_review_packet"
  | "request_handoff";

export type AskHelmDeterministicConfidence = "low" | "medium" | "high";

export interface AskHelmIntentOccurrence {
  readonly occurrenceId: string;
  readonly workspaceId: string;
  readonly actorScope: string;
  readonly intentType: string;
  readonly objectRef: ObjectRef;
  readonly occurredAt: string;
}

export interface AskHelmFollowThroughTelemetry {
  readonly trackingAvailable: boolean;
  readonly openedReviewSurface: boolean;
  readonly savedPlan: boolean;
  readonly queuedHandoff: boolean;
  readonly preparedReviewPacket: boolean;
  readonly dismissed: boolean;
  readonly observableNoFollowThrough: boolean;
  readonly weekendOnlySilence: boolean;
}

export interface AskHelmCaptureEligibilityInput {
  readonly observationId: string;
  readonly workspaceId: string;
  readonly actorScope: string;
  readonly kind: AskHelmCaptureCandidateKind;
  readonly intentType: string;
  readonly observedAt: string;
  readonly objectRef?: ObjectRef;
  readonly evidenceRefs?: readonly string[];
  readonly boundaryNote?: string;
  readonly boundaryRequestKind?: AskHelmBoundaryRequestKind;
  readonly boundaryBlocked?: boolean;
  readonly repeatedIntentOccurrences?: readonly AskHelmIntentOccurrence[];
  readonly answerConfidence?: number;
  readonly deterministicConfidence?: AskHelmDeterministicConfidence;
  readonly hasActionPlan?: boolean;
  readonly hasNextStep?: boolean;
  readonly hasSuggestedDri?: boolean;
  readonly hasSuggestedDue?: boolean;
  readonly followThroughTelemetry?: AskHelmFollowThroughTelemetry;
  readonly explicitInteractionRequest?: AskHelmExplicitInteractionRequest;
}

export interface AskHelmCaptureEligibilityResult {
  readonly observationId: string;
  readonly kind: AskHelmCaptureCandidateKind;
  readonly status: AskHelmCaptureEligibilityStatus;
  readonly reviewPosture: ReviewPosture;
  readonly promotionTarget:
    | "none"
    | "AdvancementSignal"
    | "MemoryWritebackCandidate"
    | "ReviewRequiredAction";
  readonly occurrenceCount: number;
  readonly countedOccurrenceIds: readonly string[];
  readonly reasons: readonly string[];
  readonly boundaryNote: string;
  readonly authorityGuard: "review_reason_only_not_authority";
  readonly runtimeAdoption: typeof ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION;
}

export interface AskHelmCaptureThresholdsEvaluationInput {
  readonly observations: readonly AskHelmCaptureEligibilityInput[];
}

const ELIGIBLE_BOUNDARY_REQUEST_KINDS: readonly AskHelmBoundaryRequestKind[] = [
  "review_required_execution",
  "official_write",
  "send",
  "approve",
  "pay",
] as const;

const FORBIDDEN_AUTHORITY_PATTERNS = [
  "official write allowed",
  "auto execute",
  "auto-execute",
  "auto send",
  "auto-send",
  "auto approve",
  "auto-approve",
  "auto pay",
  "auto-pay",
  "bypass guard",
  "skip review",
  "grant authority",
  "create task automatically",
  "create commitment automatically",
  "assign automatically",
] as const;

export function evaluateAskHelmCaptureEligibility(
  input: AskHelmCaptureEligibilityInput,
): AskHelmCaptureEligibilityResult {
  switch (input.kind) {
    case "repeated_intent":
      return evaluateRepeatedIntent(input);
    case "boundary_hit":
      return evaluateBoundaryHit(input);
    case "abandoned_high_confidence_answer":
      return evaluateAbandonedHighConfidenceAnswer(input);
    case "plan_follow_through":
    case "review_packet":
    case "handoff":
      return evaluateExplicitPlanDraftOrHandoff(input);
  }
}

export function evaluateAskHelmCaptureThresholds(
  input: AskHelmCaptureThresholdsEvaluationInput,
): readonly AskHelmCaptureEligibilityResult[] {
  return input.observations
    .map((observation) => evaluateAskHelmCaptureEligibility(observation))
    .sort((left, right) => left.observationId.localeCompare(right.observationId));
}

export function containsForbiddenCaptureAuthorityWording(value: string): boolean {
  const normalized = value.toLowerCase();
  return FORBIDDEN_AUTHORITY_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

function evaluateRepeatedIntent(
  input: AskHelmCaptureEligibilityInput,
): AskHelmCaptureEligibilityResult {
  const occurrenceWindow = matchingRepeatedIntentOccurrences(input);
  const occurrenceCount = occurrenceWindow.length;

  if (occurrenceCount >= REPEATED_INTENT_CANDIDATE_OCCURRENCES) {
    return result(input, {
      status: "eligible_candidate",
      reviewPosture: "review_required",
      promotionTarget: "AdvancementSignal",
      occurrenceCount,
      countedOccurrenceIds: occurrenceWindow.map((item) => item.occurrenceId),
      reasons: [
        "same workspace/object/intent reached 3 occurrences inside rolling 7 natural days",
        "cross-workspace occurrences are excluded from aggregation",
      ],
      boundaryNote:
        "Review repeated Ask Helm intent as product friction or AdvancementSignal evidence only; no automatic task or commitment is created.",
    });
  }

  if (occurrenceCount === REPEATED_INTENT_WATCH_ONLY_OCCURRENCES) {
    return result(input, {
      status: "watch_only",
      reviewPosture: "read_only",
      promotionTarget: "none",
      occurrenceCount,
      countedOccurrenceIds: occurrenceWindow.map((item) => item.occurrenceId),
      reasons: [
        "same workspace/object/intent has 2 occurrences inside rolling 7 natural days",
        "watch-only threshold does not create an active candidate",
      ],
      boundaryNote:
        "Watch repeated Ask Helm intent without creating a candidate; cross-workspace activity is not counted.",
    });
  }

  return result(input, {
    status: "not_eligible",
    reviewPosture: "read_only",
    promotionTarget: "none",
    occurrenceCount,
    countedOccurrenceIds: occurrenceWindow.map((item) => item.occurrenceId),
    reasons: ["repeated intent threshold not met"],
    boundaryNote:
      "No candidate; repeated intent requires at least 3 same-workspace occurrences in 7 natural days.",
  });
}

function evaluateBoundaryHit(
  input: AskHelmCaptureEligibilityInput,
): AskHelmCaptureEligibilityResult {
  const requestKind = input.boundaryRequestKind ?? "ordinary_explanation";
  const eligibleRequest = ELIGIBLE_BOUNDARY_REQUEST_KINDS.includes(requestKind);

  if (input.boundaryBlocked === true && eligibleRequest) {
    return result(input, {
      status: "eligible_candidate",
      reviewPosture: "review_required",
      promotionTarget: "ReviewRequiredAction",
      occurrenceCount: 1,
      countedOccurrenceIds: [input.observationId],
      reasons: [
        "review-required execution/write/send/approve/pay request was blocked once",
        "boundary hit is product friction evidence and review reason only",
      ],
      boundaryNote:
        "Boundary hit requires human review; it is not authority to send, approve, pay, write, or bypass the guard.",
    });
  }

  if (input.boundaryBlocked === true) {
    return result(input, {
      status: "watch_only",
      reviewPosture: "read_only",
      promotionTarget: "none",
      occurrenceCount: 1,
      countedOccurrenceIds: [input.observationId],
      reasons: [
        "blocked request is unsupported/open-domain or ordinary explanation",
        "ordinary guard metric stays watch-only",
      ],
      boundaryNote:
        "Watch boundary friction only; unsupported/open-domain requests do not become active candidates.",
    });
  }

  return result(input, {
    status: "not_eligible",
    reviewPosture: "read_only",
    promotionTarget: "none",
    occurrenceCount: 0,
    countedOccurrenceIds: [],
    reasons: ["no blocked boundary request observed"],
    boundaryNote:
      "No boundary candidate because no review gate block was observed.",
  });
}

function evaluateAbandonedHighConfidenceAnswer(
  input: AskHelmCaptureEligibilityInput,
): AskHelmCaptureEligibilityResult {
  const telemetry = input.followThroughTelemetry;
  const requiredGroundingPresent =
    Boolean(input.objectRef) &&
    (input.evidenceRefs?.length ?? 0) > 0 &&
    input.hasActionPlan === true &&
    input.hasNextStep === true &&
    Boolean(input.boundaryNote);
  const confidenceHigh = isHighConfidence(input);

  if (!requiredGroundingPresent || !confidenceHigh) {
    return result(input, {
      status: "not_eligible",
      reviewPosture: "read_only",
      promotionTarget: "none",
      occurrenceCount: 0,
      countedOccurrenceIds: [],
      reasons: [
        "abandoned answer requires high confidence plus objectRef, evidenceRefs, action plan, and boundary note",
      ],
      boundaryNote:
        "No abandoned-answer candidate; confidence, next step, and grounding prerequisites are mandatory.",
    });
  }

  if (!telemetry?.trackingAvailable) {
    return result(input, {
      status: "watch_only",
      reviewPosture: "read_only",
      promotionTarget: "none",
      occurrenceCount: 1,
      countedOccurrenceIds: [input.observationId],
      reasons: ["follow-through telemetry is missing or incomplete"],
      boundaryNote:
        "Watch only; missing telemetry cannot be treated as abandoned follow-through.",
    });
  }

  if (telemetry.weekendOnlySilence) {
    return result(input, {
      status: "watch_only",
      reviewPosture: "read_only",
      promotionTarget: "none",
      occurrenceCount: 1,
      countedOccurrenceIds: [input.observationId],
      reasons: ["weekend-only silence is ambiguous"],
      boundaryNote:
        "Watch only; weekend-only silence cannot be treated as abandoned follow-through.",
    });
  }

  const positiveFollowThrough =
    telemetry.openedReviewSurface ||
    telemetry.savedPlan ||
    telemetry.queuedHandoff ||
    telemetry.preparedReviewPacket ||
    telemetry.dismissed;

  if (telemetry.observableNoFollowThrough && !positiveFollowThrough) {
    return result(input, {
      status: "eligible_candidate",
      reviewPosture: "review_required",
      promotionTarget: "MemoryWritebackCandidate",
      occurrenceCount: 1,
      countedOccurrenceIds: [input.observationId],
      reasons: [
        "high-confidence grounded answer had an action plan and observable lack of follow-through",
      ],
      boundaryNote:
        "Review abandoned high-confidence answer as a candidate only; answer is not official memory and plan is not task truth.",
    });
  }

  return result(input, {
    status: "not_eligible",
    reviewPosture: "read_only",
    promotionTarget: "none",
    occurrenceCount: 1,
    countedOccurrenceIds: [input.observationId],
    reasons: ["follow-through or dismiss telemetry exists"],
    boundaryNote:
      "No abandoned-answer candidate because follow-through or dismissal was observed.",
  });
}

function evaluateExplicitPlanDraftOrHandoff(
  input: AskHelmCaptureEligibilityInput,
): AskHelmCaptureEligibilityResult {
  const request = input.explicitInteractionRequest ?? "none";
  const requestMatchesKind =
    (input.kind === "plan_follow_through" && request === "generate_plan") ||
    (input.kind === "review_packet" && request === "queue_review_packet") ||
    (input.kind === "handoff" && request === "request_handoff") ||
    (input.kind === "review_packet" && request === "save_draft");
  const groundedStep =
    Boolean(input.objectRef) &&
    input.hasActionPlan === true &&
    input.hasSuggestedDri === true &&
    input.hasSuggestedDue === true &&
    (input.evidenceRefs?.length ?? 0) > 0;

  if (requestMatchesKind && groundedStep) {
    return result(input, {
      status: "eligible_candidate",
      reviewPosture: "review_required",
      promotionTarget:
        input.kind === "plan_follow_through"
          ? "MemoryWritebackCandidate"
          : "ReviewRequiredAction",
      occurrenceCount: 1,
      countedOccurrenceIds: [input.observationId],
      reasons: [
        "explicit user generation/save/queue/handoff request exists",
        "step includes objectRef, suggested DRI, due date, and evidence",
      ],
      boundaryNote:
        "Review-only candidate; plan, draft, and handoff do not create task, commitment, assignment, send, or official write.",
    });
  }

  if (request !== "none") {
    return result(input, {
      status: "watch_only",
      reviewPosture: "read_only",
      promotionTarget: "none",
      occurrenceCount: 1,
      countedOccurrenceIds: [input.observationId],
      reasons: [
        "explicit request exists but objectRef/DRI/due/evidence grounding is incomplete",
      ],
      boundaryNote:
        "Watch only; explicit request without grounded step fields is not candidate-eligible.",
    });
  }

  return result(input, {
    status: "not_eligible",
    reviewPosture: "read_only",
    promotionTarget: "none",
    occurrenceCount: 0,
    countedOccurrenceIds: [],
    reasons: ["no explicit user generation/save/queue/handoff request"],
    boundaryNote:
      "No candidate; merely viewing an answer or previewing a plan is insufficient.",
  });
}

function matchingRepeatedIntentOccurrences(
  input: AskHelmCaptureEligibilityInput,
): readonly AskHelmIntentOccurrence[] {
  if (!input.objectRef) {
    return [];
  }

  const objectRef = input.objectRef;
  const referenceDay = naturalDayNumber(input.observedAt);
  return (input.repeatedIntentOccurrences ?? [])
    .filter((occurrence) => {
      const occurrenceDay = naturalDayNumber(occurrence.occurredAt);
      return (
        occurrence.workspaceId === input.workspaceId &&
        occurrence.actorScope === input.actorScope &&
        occurrence.intentType === input.intentType &&
        objectRefsMatch(occurrence.objectRef, objectRef) &&
        occurrenceDay <= referenceDay &&
        referenceDay - occurrenceDay < REPEATED_INTENT_ROLLING_NATURAL_DAYS
      );
    })
    .sort((left, right) => {
      return (
        Date.parse(left.occurredAt) - Date.parse(right.occurredAt) ||
        left.occurrenceId.localeCompare(right.occurrenceId)
      );
    });
}

function isHighConfidence(input: AskHelmCaptureEligibilityInput): boolean {
  return (
    (typeof input.answerConfidence === "number" &&
      input.answerConfidence >= ABANDONED_NUMERIC_CONFIDENCE_THRESHOLD) ||
    input.deterministicConfidence === "high"
  );
}

function objectRefsMatch(left: ObjectRef, right: ObjectRef): boolean {
  return left.objectType === right.objectType && left.objectId === right.objectId;
}

function naturalDayNumber(iso: string): number {
  const parsed = Date.parse(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) {
    return Number.NEGATIVE_INFINITY;
  }
  return Math.floor(parsed / 86_400_000);
}

function result(
  input: AskHelmCaptureEligibilityInput,
  outcome: Omit<
    AskHelmCaptureEligibilityResult,
    "observationId" | "kind" | "authorityGuard" | "runtimeAdoption"
  >,
): AskHelmCaptureEligibilityResult {
  return {
    observationId: input.observationId,
    kind: input.kind,
    authorityGuard: "review_reason_only_not_authority",
    runtimeAdoption: ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION,
    ...outcome,
  };
}

// ---------------------------------------------------------------------------
// Synthetic fixtures and evaluator
// ---------------------------------------------------------------------------

const atlasOpportunityRef: ObjectRef = {
  objectType: "opportunity",
  objectId: "synthetic-opportunity-atlas-renewal",
  displayName: "Atlas Renewal",
};

const xingheCompanyRef: ObjectRef = {
  objectType: "company",
  objectId: "synthetic-company-xinghe",
  displayName: "星河连锁",
};

const northstarMeetingRef: ObjectRef = {
  objectType: "meeting",
  objectId: "synthetic-meeting-northstar-review",
  displayName: "Northstar Review",
};

const defaultTelemetry: AskHelmFollowThroughTelemetry = {
  trackingAvailable: true,
  openedReviewSurface: false,
  savedPlan: false,
  queuedHandoff: false,
  preparedReviewPacket: false,
  dismissed: false,
  observableNoFollowThrough: true,
  weekendOnlySilence: false,
};

function occurrence(
  occurrenceId: string,
  workspaceId: string,
  occurredAt: string,
): AskHelmIntentOccurrence {
  return {
    occurrenceId,
    workspaceId,
    actorScope: "user:synthetic-operator",
    intentType: "today_priority",
    objectRef: atlasOpportunityRef,
    occurredAt,
  };
}

export const ASK_HELM_CAPTURE_THRESHOLD_FIXTURES: readonly AskHelmCaptureEligibilityInput[] =
  [
    {
      observationId: "AHI-CT-001",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "repeated_intent",
      intentType: "today_priority",
      objectRef: atlasOpportunityRef,
      observedAt: "2026-04-27T10:00:00.000Z",
      repeatedIntentOccurrences: [
        occurrence("occ-alpha-001", "workspace-alpha", "2026-04-21T01:00:00.000Z"),
        occurrence("occ-alpha-002", "workspace-alpha", "2026-04-25T01:00:00.000Z"),
        occurrence("occ-alpha-003", "workspace-alpha", "2026-04-27T01:00:00.000Z"),
        occurrence("occ-beta-001", "workspace-beta", "2026-04-27T02:00:00.000Z"),
      ],
    },
    {
      observationId: "AHI-CT-002",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "repeated_intent",
      intentType: "today_priority",
      objectRef: atlasOpportunityRef,
      observedAt: "2026-04-27T10:00:00.000Z",
      repeatedIntentOccurrences: [
        occurrence("occ-alpha-watch-001", "workspace-alpha", "2026-04-26T01:00:00.000Z"),
        occurrence("occ-alpha-watch-002", "workspace-alpha", "2026-04-27T01:00:00.000Z"),
        occurrence("occ-beta-watch-001", "workspace-beta", "2026-04-27T02:00:00.000Z"),
      ],
    },
    {
      observationId: "AHI-CT-003",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "boundary_hit",
      intentType: "review_required_execution",
      objectRef: xingheCompanyRef,
      observedAt: "2026-04-27T11:00:00.000Z",
      evidenceRefs: ["evidence:xinghe-boundary"],
      boundaryRequestKind: "official_write",
      boundaryBlocked: true,
    },
    {
      observationId: "AHI-CT-004",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "abandoned_high_confidence_answer",
      intentType: "plan_breakdown",
      objectRef: atlasOpportunityRef,
      evidenceRefs: ["evidence:atlas-answer", "evidence:atlas-next-step"],
      observedAt: "2026-04-27T12:00:00.000Z",
      answerConfidence: 0.85,
      hasActionPlan: true,
      hasNextStep: true,
      boundaryNote: "answer is not official memory; plan is not task truth.",
      followThroughTelemetry: defaultTelemetry,
    },
    {
      observationId: "AHI-CT-005",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "abandoned_high_confidence_answer",
      intentType: "plan_breakdown",
      objectRef: atlasOpportunityRef,
      evidenceRefs: ["evidence:atlas-answer-high"],
      observedAt: "2026-04-27T13:00:00.000Z",
      deterministicConfidence: "high",
      hasActionPlan: true,
      hasNextStep: true,
      boundaryNote: "answer is not official memory; plan is not task truth.",
      followThroughTelemetry: { ...defaultTelemetry, trackingAvailable: false },
    },
    {
      observationId: "AHI-CT-006",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "abandoned_high_confidence_answer",
      intentType: "plan_breakdown",
      objectRef: atlasOpportunityRef,
      evidenceRefs: ["evidence:atlas-weekend"],
      observedAt: "2026-04-26T13:00:00.000Z",
      deterministicConfidence: "high",
      hasActionPlan: true,
      hasNextStep: true,
      boundaryNote: "answer is not official memory; plan is not task truth.",
      followThroughTelemetry: { ...defaultTelemetry, weekendOnlySilence: true },
    },
    {
      observationId: "AHI-CT-007",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "plan_follow_through",
      intentType: "plan_breakdown",
      objectRef: northstarMeetingRef,
      evidenceRefs: ["evidence:northstar-plan"],
      observedAt: "2026-04-27T14:00:00.000Z",
      hasActionPlan: true,
      hasSuggestedDri: true,
      hasSuggestedDue: true,
      explicitInteractionRequest: "generate_plan",
    },
    {
      observationId: "AHI-CT-008",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "review_packet",
      intentType: "prepare_review_packet",
      objectRef: xingheCompanyRef,
      evidenceRefs: ["evidence:xinghe-review-packet"],
      observedAt: "2026-04-27T15:00:00.000Z",
      hasActionPlan: true,
      hasSuggestedDri: true,
      hasSuggestedDue: true,
      explicitInteractionRequest: "queue_review_packet",
    },
    {
      observationId: "AHI-CT-009",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "review_packet",
      intentType: "save_draft",
      objectRef: xingheCompanyRef,
      evidenceRefs: ["evidence:xinghe-saved-draft"],
      observedAt: "2026-04-27T15:30:00.000Z",
      hasActionPlan: true,
      hasSuggestedDri: true,
      hasSuggestedDue: true,
      explicitInteractionRequest: "save_draft",
    },
    {
      observationId: "AHI-CT-010",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "handoff",
      intentType: "request_handoff",
      objectRef: northstarMeetingRef,
      evidenceRefs: ["evidence:northstar-handoff"],
      observedAt: "2026-04-27T16:00:00.000Z",
      hasActionPlan: true,
      hasSuggestedDri: true,
      hasSuggestedDue: true,
      explicitInteractionRequest: "request_handoff",
    },
    {
      observationId: "AHI-CT-011",
      workspaceId: "workspace-alpha",
      actorScope: "user:synthetic-operator",
      kind: "handoff",
      intentType: "request_handoff",
      objectRef: northstarMeetingRef,
      evidenceRefs: ["evidence:northstar-preview"],
      observedAt: "2026-04-27T17:00:00.000Z",
      hasActionPlan: true,
      hasSuggestedDri: true,
      hasSuggestedDue: true,
      explicitInteractionRequest: "none",
    },
  ] as const;

export interface AskHelmCaptureThresholdsCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface AskHelmCaptureThresholdsEvalSummary {
  readonly ruleVersion: string;
  readonly posture: typeof ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_POSTURE;
  readonly runtimeAdoption: typeof ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION;
  readonly checks: readonly AskHelmCaptureThresholdsCheck[];
  readonly eligibleCandidateCount: number;
  readonly watchOnlyCount: number;
  readonly notEligibleCount: number;
  readonly allPass: boolean;
}

export function evaluateAskHelmCaptureThresholdsStrategy(): AskHelmCaptureThresholdsEvalSummary {
  const results = evaluateAskHelmCaptureThresholds({
    observations: ASK_HELM_CAPTURE_THRESHOLD_FIXTURES,
  });

  const checks: AskHelmCaptureThresholdsCheck[] = [
    checkRuleVersion(),
    checkRuntimeAdoptionNoGo(results),
    checkAllCandidateKindsModeled(results),
    checkRepeatedIntentThreshold(results),
    checkRepeatedIntentWatchOnly(results),
    checkCrossWorkspaceExcluded(results),
    checkBoundaryHitReviewReasonOnly(results),
    checkAbandonedHighConfidenceEligible(results),
    checkMissingTelemetryWatchOnly(results),
    checkWeekendSilenceWatchOnly(results),
    checkPlanDraftHandoffExplicitOnly(results),
    checkDeterministicReversal(),
    checkNoForbiddenAuthorityWording(results),
    checkNoAutomaticTaskCommitmentAssignment(results),
  ];

  return {
    ruleVersion: ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RULE_VERSION,
    posture: ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_POSTURE,
    runtimeAdoption: ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION,
    checks,
    eligibleCandidateCount: results.filter(
      (item) => item.status === "eligible_candidate",
    ).length,
    watchOnlyCount: results.filter((item) => item.status === "watch_only").length,
    notEligibleCount: results.filter((item) => item.status === "not_eligible")
      .length,
    allPass: checks.every((check) => check.pass),
  };
}

function checkRuleVersion(): AskHelmCaptureThresholdsCheck {
  const pass =
    ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RULE_VERSION ===
    "ask-helm-interaction-capture-thresholds/v1";
  return {
    name: "rule_version_is_v1",
    pass,
    detail: ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RULE_VERSION,
  };
}

function checkRuntimeAdoptionNoGo(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const pass = results.every((item) => item.runtimeAdoption === "No-Go");
  return {
    name: "runtime_adoption_is_no_go",
    pass,
    detail: `runtimeAdoption=${ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION}`,
  };
}

function checkAllCandidateKindsModeled(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const kinds = new Set(results.map((item) => item.kind));
  const required: readonly AskHelmCaptureCandidateKind[] = [
    "repeated_intent",
    "boundary_hit",
    "abandoned_high_confidence_answer",
    "plan_follow_through",
    "review_packet",
    "handoff",
  ];
  const missing = required.filter((kind) => !kinds.has(kind));
  return {
    name: "all_candidate_kinds_modeled",
    pass: missing.length === 0,
    detail:
      missing.length === 0
        ? `kinds=${[...kinds].sort().join(",")}`
        : `missing=${missing.join(",")}`,
  };
}

function checkRepeatedIntentThreshold(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const repeated = findResult(results, "AHI-CT-001");
  const pass =
    repeated?.status === "eligible_candidate" &&
    repeated.occurrenceCount === 3 &&
    repeated.promotionTarget === "AdvancementSignal";
  return {
    name: "repeated_intent_3_in_7_days_eligible",
    pass,
    detail: repeated
      ? `status=${repeated.status}; occurrenceCount=${repeated.occurrenceCount}`
      : "fixture missing",
  };
}

function checkRepeatedIntentWatchOnly(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const repeated = findResult(results, "AHI-CT-002");
  const pass =
    repeated?.status === "watch_only" && repeated.occurrenceCount === 2;
  return {
    name: "repeated_intent_2_in_7_days_watch_only",
    pass,
    detail: repeated
      ? `status=${repeated.status}; occurrenceCount=${repeated.occurrenceCount}`
      : "fixture missing",
  };
}

function checkCrossWorkspaceExcluded(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const repeated = findResult(results, "AHI-CT-001");
  const pass =
    repeated?.countedOccurrenceIds.includes("occ-beta-001") === false &&
    repeated?.occurrenceCount === 3;
  return {
    name: "cross_workspace_never_aggregates",
    pass,
    detail: repeated
      ? `counted=${repeated.countedOccurrenceIds.join(",")}`
      : "fixture missing",
  };
}

function checkBoundaryHitReviewReasonOnly(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const boundary = findResult(results, "AHI-CT-003");
  const lower = boundary?.boundaryNote.toLowerCase() ?? "";
  const pass =
    boundary?.status === "eligible_candidate" &&
    boundary.reviewPosture === "review_required" &&
    boundary.promotionTarget === "ReviewRequiredAction" &&
    boundary.authorityGuard === "review_reason_only_not_authority" &&
    lower.includes("not authority") &&
    lower.includes("bypass the guard");
  return {
    name: "boundary_hit_review_reason_not_authority",
    pass,
    detail: boundary
      ? `status=${boundary.status}; guard=${boundary.authorityGuard}`
      : "fixture missing",
  };
}

function checkAbandonedHighConfidenceEligible(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const abandoned = findResult(results, "AHI-CT-004");
  const pass =
    abandoned?.status === "eligible_candidate" &&
    abandoned.reviewPosture === "review_required";
  return {
    name: "abandoned_high_confidence_with_followthrough_gap_eligible",
    pass,
    detail: abandoned ? `status=${abandoned.status}` : "fixture missing",
  };
}

function checkMissingTelemetryWatchOnly(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const abandoned = findResult(results, "AHI-CT-005");
  const pass = abandoned?.status === "watch_only";
  return {
    name: "missing_telemetry_degrades_to_watch_only",
    pass,
    detail: abandoned ? `status=${abandoned.status}` : "fixture missing",
  };
}

function checkWeekendSilenceWatchOnly(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const abandoned = findResult(results, "AHI-CT-006");
  const pass = abandoned?.status === "watch_only";
  return {
    name: "weekend_only_silence_degrades_to_watch_only",
    pass,
    detail: abandoned ? `status=${abandoned.status}` : "fixture missing",
  };
}

function checkPlanDraftHandoffExplicitOnly(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const plan = findResult(results, "AHI-CT-007");
  const packet = findResult(results, "AHI-CT-008");
  const savedDraft = findResult(results, "AHI-CT-009");
  const handoff = findResult(results, "AHI-CT-010");
  const preview = findResult(results, "AHI-CT-011");
  const pass =
    plan?.status === "eligible_candidate" &&
    packet?.status === "eligible_candidate" &&
    savedDraft?.status === "eligible_candidate" &&
    handoff?.status === "eligible_candidate" &&
    preview?.status === "not_eligible";
  return {
    name: "plan_draft_handoff_require_explicit_user_request",
    pass,
    detail: `plan=${plan?.status}; packet=${packet?.status}; savedDraft=${savedDraft?.status}; handoff=${handoff?.status}; preview=${preview?.status}`,
  };
}

function checkDeterministicReversal(): AskHelmCaptureThresholdsCheck {
  const forward = evaluateAskHelmCaptureThresholds({
    observations: ASK_HELM_CAPTURE_THRESHOLD_FIXTURES,
  });
  const reversed = evaluateAskHelmCaptureThresholds({
    observations: [...ASK_HELM_CAPTURE_THRESHOLD_FIXTURES].reverse(),
  });
  const pass =
    JSON.stringify(forward.map((item) => item.observationId)) ===
      JSON.stringify(reversed.map((item) => item.observationId)) &&
    JSON.stringify(forward.map((item) => item.status)) ===
      JSON.stringify(reversed.map((item) => item.status));
  return {
    name: "deterministic_ordering_stable_when_input_reversed",
    pass,
    detail: `order=${forward.map((item) => item.observationId).join(",")}`,
  };
}

function checkNoForbiddenAuthorityWording(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const offending = results.filter((item) =>
    containsForbiddenCaptureAuthorityWording(
      [
        item.boundaryNote,
        ...item.reasons,
        item.promotionTarget,
        item.authorityGuard,
      ].join(" "),
    ),
  );
  return {
    name: "no_forbidden_authority_wording",
    pass: offending.length === 0,
    detail:
      offending.length === 0
        ? "no forbidden authority wording found"
        : `offending=${offending.map((item) => item.observationId).join(",")}`,
  };
}

function checkNoAutomaticTaskCommitmentAssignment(
  results: readonly AskHelmCaptureEligibilityResult[],
): AskHelmCaptureThresholdsCheck {
  const eligible = results.filter((item) => item.status === "eligible_candidate");
  const pass = eligible.every((item) =>
    item.boundaryNote.toLowerCase().includes("review"),
  );
  return {
    name: "no_task_commitment_assignment_created_automatically",
    pass,
    detail: `eligible=${eligible.map((item) => item.observationId).join(",")}`,
  };
}

function findResult(
  results: readonly AskHelmCaptureEligibilityResult[],
  observationId: string,
): AskHelmCaptureEligibilityResult | undefined {
  return results.find((item) => item.observationId === observationId);
}
