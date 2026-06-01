/**
 * Helm Business Advancement — Ask Helm Interaction Asset Redacted Calibration.
 *
 * This is a pure, planning-only evidence evaluator for redacted Ask Helm
 * interaction rows. It is NOT a runtime extractor, NOT a DB reader, NOT an API,
 * NOT a queue, NOT a page adapter, NOT a production query, NOT an official
 * write path, and NOT an execution authority.
 */

import {
  ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION,
  containsForbiddenCaptureAuthorityWording,
  evaluateAskHelmCaptureEligibility,
  type AskHelmBoundaryRequestKind,
  type AskHelmCaptureCandidateKind,
  type AskHelmCaptureEligibilityInput,
  type AskHelmCaptureEligibilityResult,
  type AskHelmDeterministicConfidence,
  type AskHelmExplicitInteractionRequest,
  type AskHelmFollowThroughTelemetry,
  type AskHelmIntentOccurrence,
} from "./ask-helm-interaction-capture-thresholds";
import {
  ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION,
  mergeAndRouteAskHelmInteractionAssets,
  type AskHelmInteractionAssetCandidate,
  type AskHelmInteractionAssetType,
  type AskHelmInteractionCandidateStatus,
  type AskHelmInteractionDedupeMergeResult,
  type AskHelmInteractionPromotionTarget,
  type AskHelmInteractionRetentionPosture,
  type AskHelmInteractionVisibility,
} from "./ask-helm-interaction-dedupe-merge";
import type { ObjectRef, RiskLevel } from "./contracts";

export const ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RULE_VERSION =
  "ask-helm-interaction-redacted-calibration/v1" as const;
export const ASK_HELM_INTERACTION_REDACTED_CALIBRATION_POSTURE =
  "Evidence-Contract-Ready" as const;
export const ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RUNTIME_ADOPTION =
  "No-Go" as const;

export const ASK_HELM_INTERACTION_REDACTED_CALIBRATION_MIN_ROWS = 12;

export const ASK_HELM_INTERACTION_REDACTED_CALIBRATION_NEXT_ALLOWED_WORK =
  "If a redacted real interaction snapshot passes, schedule manual runtime adoption review and draft a separate implementation plan. This is not production adoption." as const;

export type AskHelmInteractionRedactedCalibrationSampleKind =
  | "synthetic_fixture"
  | "local_development_snapshot"
  | "redacted_real_interaction_snapshot";

export type AskHelmInteractionRedactedSourceClassification =
  | "workspace_scoped"
  | "unsupported_open_domain"
  | "cross_workspace";

export type AskHelmInteractionRedactedTranscriptState =
  | "none"
  | "checked_summary"
  | "unconfirmed";

export type AskHelmInteractionRedactedCalibrationPrivacyDecision =
  | "privacy_pass"
  | "privacy_rejected"
  | "boundary_rejected";

export type AskHelmInteractionRedactedCalibrationRejectionReason =
  | "raw_audio_retained"
  | "raw_prompt_or_body_retained"
  | "raw_payload_field_retained"
  | "unconfirmed_transcript_not_allowed"
  | "cross_workspace_aggregation_not_allowed"
  | "unsupported_open_domain_active_candidate_not_allowed"
  | "cross_workspace_active_candidate_not_allowed"
  | "workspace_review_visible_missing_capability_gate";

export interface AskHelmInteractionRedactedCalibrationRow {
  readonly rowId: string;
  readonly workspaceId: string;
  readonly actorScope: string;
  readonly sourceTurnRef: string;
  readonly observedAt: string;
  readonly kind: AskHelmCaptureCandidateKind;
  readonly intentType: string;
  readonly objectRef?: ObjectRef;
  readonly evidenceRefs?: readonly string[];
  readonly assetType: AskHelmInteractionAssetType;
  readonly captureReason: string;
  readonly requestedVisibility: AskHelmInteractionVisibility;
  readonly retentionPosture: AskHelmInteractionRetentionPosture;
  readonly riskLevel: RiskLevel;
  readonly status: AskHelmInteractionCandidateStatus;
  readonly sourceClassification: AskHelmInteractionRedactedSourceClassification;
  readonly transcriptState: AskHelmInteractionRedactedTranscriptState;
  readonly rawAudioRetained: boolean;
  readonly rawPromptRetained: boolean;
  readonly rawBodyRetained: boolean;
  readonly activeCandidateRequested: boolean;
  readonly crossWorkspaceAggregationRequested: boolean;
  readonly workspaceReviewVisibleCapabilityGated: boolean;
  readonly boundaryNotePresent?: boolean;
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

export interface AskHelmInteractionRedactedCalibrationInput {
  readonly sampleKind: AskHelmInteractionRedactedCalibrationSampleKind;
  readonly rows: readonly AskHelmInteractionRedactedCalibrationRow[];
}

export interface AskHelmInteractionRedactedCalibrationOutcome {
  readonly rowId: string;
  readonly kind: AskHelmCaptureCandidateKind;
  readonly intentType: string;
  readonly privacyDecision: AskHelmInteractionRedactedCalibrationPrivacyDecision;
  readonly rejectionReason?: AskHelmInteractionRedactedCalibrationRejectionReason;
  readonly thresholdResult?: AskHelmCaptureEligibilityResult;
  readonly candidate?: AskHelmInteractionAssetCandidate;
}

export interface AskHelmInteractionRedactedCalibrationCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface AskHelmInteractionRedactedCalibrationEvaluationResult {
  readonly ruleVersion: typeof ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RULE_VERSION;
  readonly posture: typeof ASK_HELM_INTERACTION_REDACTED_CALIBRATION_POSTURE;
  readonly runtimeAdoption: typeof ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RUNTIME_ADOPTION;
  readonly thresholdRuntimeAdoption: typeof ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION;
  readonly dedupeMergeRuntimeAdoption: typeof ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION;
  readonly sampleKind: AskHelmInteractionRedactedCalibrationSampleKind;
  readonly realDataValidated: boolean;
  readonly productionCalibrationComplete: boolean;
  readonly nextAllowedWork: typeof ASK_HELM_INTERACTION_REDACTED_CALIBRATION_NEXT_ALLOWED_WORK;
  readonly redactionContract: readonly string[];
  readonly checks: readonly AskHelmInteractionRedactedCalibrationCheck[];
  readonly blockers: readonly string[];
  readonly outcomes: readonly AskHelmInteractionRedactedCalibrationOutcome[];
  readonly dedupeMergeResult: AskHelmInteractionDedupeMergeResult;
  readonly eligibleCandidateCount: number;
  readonly watchOnlyCount: number;
  readonly rejectedCount: number;
  readonly redactionViolationCount: number;
  readonly boundaryRejectionCount: number;
}

export const ASK_HELM_INTERACTION_REDACTED_CALIBRATION_REDACTION_CONTRACT = [
  "Rows must be redacted before entering this evaluator.",
  "No raw prompt, raw answer body, raw audio, full transcript, customer free text, secrets, credentials, payment details, or tokens are allowed.",
  "Object, actor, turn, workspace, and evidence identifiers must be opaque or redacted.",
  "The evaluator accepts only deterministic metadata needed by Slice 2 dedupe and Slice 3 capture thresholds.",
] as const;

const FORBIDDEN_NORMALIZED_RAW_PAYLOAD_KEYS = new Set([
  "accesstoken",
  "answerbody",
  "apikey",
  "audio",
  "audioblob",
  "audiourl",
  "authorization",
  "body",
  "credential",
  "credentials",
  "customerfreetext",
  "fulltranscript",
  "paymentdetails",
  "prompt",
  "prompttext",
  "rawanswer",
  "rawaudio",
  "rawbody",
  "rawprompt",
  "rawtranscript",
  "secret",
  "secretkey",
  "token",
  "transcript",
  "transcripttext",
]);

function normalizeRawPayloadKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isForbiddenRawPayloadKey(key: string): boolean {
  const normalized = normalizeRawPayloadKey(key);

  return (
    FORBIDDEN_NORMALIZED_RAW_PAYLOAD_KEYS.has(normalized) ||
    normalized.endsWith("token") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("secretkey")
  );
}

function rowHasForbiddenRawPayload(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (
      isForbiddenRawPayloadKey(key) &&
      nested !== undefined &&
      nested !== null &&
      nested !== ""
    ) {
      return true;
    }
    if (Array.isArray(nested)) {
      if (nested.some((item) => rowHasForbiddenRawPayload(item))) {
        return true;
      }
      continue;
    }
    if (nested && typeof nested === "object" && rowHasForbiddenRawPayload(nested)) {
      return true;
    }
  }

  return false;
}

function classifyPrivacyAndBoundary(
  row: AskHelmInteractionRedactedCalibrationRow,
):
  | {
      readonly decision: "privacy_rejected" | "boundary_rejected";
      readonly reason: AskHelmInteractionRedactedCalibrationRejectionReason;
    }
  | undefined {
  if (row.rawAudioRetained) {
    return { decision: "privacy_rejected", reason: "raw_audio_retained" };
  }
  if (row.rawPromptRetained || row.rawBodyRetained) {
    return {
      decision: "privacy_rejected",
      reason: "raw_prompt_or_body_retained",
    };
  }
  if (rowHasForbiddenRawPayload(row)) {
    return {
      decision: "privacy_rejected",
      reason: "raw_payload_field_retained",
    };
  }
  if (row.transcriptState === "unconfirmed") {
    return {
      decision: "privacy_rejected",
      reason: "unconfirmed_transcript_not_allowed",
    };
  }
  if (row.crossWorkspaceAggregationRequested) {
    return {
      decision: "boundary_rejected",
      reason: "cross_workspace_aggregation_not_allowed",
    };
  }
  if (
    row.sourceClassification === "unsupported_open_domain" &&
    row.activeCandidateRequested
  ) {
    return {
      decision: "boundary_rejected",
      reason: "unsupported_open_domain_active_candidate_not_allowed",
    };
  }
  if (
    row.sourceClassification === "cross_workspace" &&
    row.activeCandidateRequested
  ) {
    return {
      decision: "boundary_rejected",
      reason: "cross_workspace_active_candidate_not_allowed",
    };
  }
  if (
    row.requestedVisibility === "workspace_review_visible" &&
    !row.workspaceReviewVisibleCapabilityGated
  ) {
    return {
      decision: "privacy_rejected",
      reason: "workspace_review_visible_missing_capability_gate",
    };
  }
  return undefined;
}

function toEligibilityInput(
  row: AskHelmInteractionRedactedCalibrationRow,
): AskHelmCaptureEligibilityInput {
  return {
    observationId: row.rowId,
    workspaceId: row.workspaceId,
    actorScope: row.actorScope,
    kind: row.kind,
    intentType: row.intentType,
    observedAt: row.observedAt,
    objectRef: row.objectRef,
    evidenceRefs: row.evidenceRefs,
    boundaryNote: row.boundaryNotePresent
      ? "Redacted boundary note is present."
      : undefined,
    boundaryRequestKind: row.boundaryRequestKind,
    boundaryBlocked: row.boundaryBlocked,
    repeatedIntentOccurrences: row.repeatedIntentOccurrences,
    answerConfidence: row.answerConfidence,
    deterministicConfidence: row.deterministicConfidence,
    hasActionPlan: row.hasActionPlan,
    hasNextStep: row.hasNextStep,
    hasSuggestedDri: row.hasSuggestedDri,
    hasSuggestedDue: row.hasSuggestedDue,
    followThroughTelemetry: row.followThroughTelemetry,
    explicitInteractionRequest: row.explicitInteractionRequest,
  };
}

function candidateFromRow(
  row: AskHelmInteractionRedactedCalibrationRow,
  thresholdResult: AskHelmCaptureEligibilityResult,
): AskHelmInteractionAssetCandidate {
  return {
    candidateId: `redacted-candidate:${row.rowId}`,
    workspaceId: row.workspaceId,
    actorScope: row.actorScope,
    sourceTurnRef: row.sourceTurnRef,
    intentType: row.intentType,
    assetType: row.assetType,
    objectRefs: row.objectRef ? [row.objectRef] : [],
    evidenceRefs: row.evidenceRefs ?? [`redacted-evidence:${row.rowId}`],
    answerSummary: `Redacted ${row.kind} calibration summary.`,
    nextStep: `Review redacted ${row.kind} calibration candidate.`,
    boundaryNote: thresholdResult.boundaryNote,
    captureReason: row.captureReason,
    reviewPosture: thresholdResult.reviewPosture,
    visibility: row.requestedVisibility,
    retentionPosture: row.retentionPosture,
    promotionTarget: thresholdResult.promotionTarget,
    capturedAt: row.observedAt,
    riskLevel: row.riskLevel,
    status: row.status,
  };
}

function evaluateRow(
  row: AskHelmInteractionRedactedCalibrationRow,
): AskHelmInteractionRedactedCalibrationOutcome {
  const privacyDecision = classifyPrivacyAndBoundary(row);
  if (privacyDecision) {
    return {
      rowId: row.rowId,
      kind: row.kind,
      intentType: row.intentType,
      privacyDecision: privacyDecision.decision,
      rejectionReason: privacyDecision.reason,
    };
  }

  const thresholdResult = evaluateAskHelmCaptureEligibility(
    toEligibilityInput(row),
  );
  const candidate =
    thresholdResult.status === "eligible_candidate"
      ? candidateFromRow(row, thresholdResult)
      : undefined;

  return {
    rowId: row.rowId,
    kind: row.kind,
    intentType: row.intentType,
    privacyDecision: "privacy_pass",
    thresholdResult,
    candidate,
  };
}

export function evaluateAskHelmInteractionRedactedCalibration(
  input: AskHelmInteractionRedactedCalibrationInput =
    DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
): AskHelmInteractionRedactedCalibrationEvaluationResult {
  const outcomes = input.rows.map(evaluateRow).sort((left, right) =>
    left.rowId.localeCompare(right.rowId),
  );
  const candidates = outcomes.flatMap((outcome) =>
    outcome.candidate ? [outcome.candidate] : [],
  );
  const dedupeMergeResult = mergeAndRouteAskHelmInteractionAssets({
    candidates,
  });
  const checks = buildChecks({ input, outcomes, dedupeMergeResult });
  const realDataValidated =
    input.sampleKind === "redacted_real_interaction_snapshot" &&
    checks.every((check) => check.pass);
  const productionCalibrationComplete = realDataValidated;
  const blockers = checks
    .filter((check) => !check.pass)
    .map((check) => check.name);

  return {
    ruleVersion: ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RULE_VERSION,
    posture: ASK_HELM_INTERACTION_REDACTED_CALIBRATION_POSTURE,
    runtimeAdoption: ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RUNTIME_ADOPTION,
    thresholdRuntimeAdoption:
      ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION,
    dedupeMergeRuntimeAdoption:
      ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION,
    sampleKind: input.sampleKind,
    realDataValidated,
    productionCalibrationComplete,
    nextAllowedWork:
      ASK_HELM_INTERACTION_REDACTED_CALIBRATION_NEXT_ALLOWED_WORK,
    redactionContract: [
      ...ASK_HELM_INTERACTION_REDACTED_CALIBRATION_REDACTION_CONTRACT,
    ],
    checks,
    blockers,
    outcomes,
    dedupeMergeResult,
    eligibleCandidateCount: outcomes.filter(
      (outcome) => outcome.thresholdResult?.status === "eligible_candidate",
    ).length,
    watchOnlyCount: outcomes.filter(
      (outcome) => outcome.thresholdResult?.status === "watch_only",
    ).length,
    rejectedCount: outcomes.filter(
      (outcome) => outcome.privacyDecision !== "privacy_pass",
    ).length,
    redactionViolationCount: input.rows.filter(
      (row) =>
        row.rawAudioRetained ||
        row.rawPromptRetained ||
        row.rawBodyRetained ||
        rowHasForbiddenRawPayload(row),
    ).length,
    boundaryRejectionCount: outcomes.filter(
      (outcome) => outcome.privacyDecision === "boundary_rejected",
    ).length,
  };
}

function buildChecks(input: {
  readonly input: AskHelmInteractionRedactedCalibrationInput;
  readonly outcomes: readonly AskHelmInteractionRedactedCalibrationOutcome[];
  readonly dedupeMergeResult: AskHelmInteractionDedupeMergeResult;
}): readonly AskHelmInteractionRedactedCalibrationCheck[] {
  return [
    checkConstants(),
    checkSampleKind(input.input.sampleKind),
    checkMinimumRows(input.input.rows),
    checkNoRawRetained(input.input.rows),
    checkRepeatedIntentCoverage(input.outcomes),
    checkBoundaryHitCoverage(input.outcomes),
    checkAbandonedAnswerCoverage(input.outcomes),
    checkExplicitInteractionCoverage(input.outcomes),
    checkPrivacyBoundaryRejectionCoverage(input.outcomes),
    checkWorkspaceReviewVisibility(input.input.rows),
    checkDedupeFoldsDuplicates(input.outcomes, input.dedupeMergeResult),
    checkNoExecutionAuthority(input.outcomes),
  ];
}

function checkConstants(): AskHelmInteractionRedactedCalibrationCheck {
  const pass =
    ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RULE_VERSION ===
      "ask-helm-interaction-redacted-calibration/v1" &&
    ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RUNTIME_ADOPTION === "No-Go";
  return {
    name: "constants_are_evidence_contract_no_go",
    pass,
    detail: `${ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RULE_VERSION}; runtime=${ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RUNTIME_ADOPTION}`,
  };
}

function checkSampleKind(
  sampleKind: AskHelmInteractionRedactedCalibrationSampleKind,
): AskHelmInteractionRedactedCalibrationCheck {
  const pass = sampleKind === "redacted_real_interaction_snapshot";
  return {
    name: "sample_kind_is_redacted_real_interaction_snapshot",
    pass,
    detail: `sampleKind=${sampleKind}`,
  };
}

function checkMinimumRows(
  rows: readonly AskHelmInteractionRedactedCalibrationRow[],
): AskHelmInteractionRedactedCalibrationCheck {
  return {
    name: "minimum_redacted_row_volume",
    pass: rows.length >= ASK_HELM_INTERACTION_REDACTED_CALIBRATION_MIN_ROWS,
    detail: `rows=${rows.length}; required=${ASK_HELM_INTERACTION_REDACTED_CALIBRATION_MIN_ROWS}`,
  };
}

function checkNoRawRetained(
  rows: readonly AskHelmInteractionRedactedCalibrationRow[],
): AskHelmInteractionRedactedCalibrationCheck {
  const rawRetained = rows.filter(
    (row) =>
      row.rawAudioRetained ||
      row.rawPromptRetained ||
      row.rawBodyRetained ||
      rowHasForbiddenRawPayload(row),
  );
  return {
    name: "redaction_contract_no_raw_content_retained",
    pass: rawRetained.length === 0,
    detail: `rawRetainedRows=${rawRetained.length}`,
  };
}

function checkRepeatedIntentCoverage(
  outcomes: readonly AskHelmInteractionRedactedCalibrationOutcome[],
): AskHelmInteractionRedactedCalibrationCheck {
  const repeated = outcomes.filter((outcome) => outcome.kind === "repeated_intent");
  const eligible = repeated.filter(
    (outcome) => outcome.thresholdResult?.status === "eligible_candidate",
  );
  const watchOnly = repeated.filter(
    (outcome) => outcome.thresholdResult?.status === "watch_only",
  );
  return {
    name: "repeated_intent_eligible_and_watch_only_covered",
    pass: eligible.length >= 1 && watchOnly.length >= 1,
    detail: `eligible=${eligible.length}; watchOnly=${watchOnly.length}`,
  };
}

function checkBoundaryHitCoverage(
  outcomes: readonly AskHelmInteractionRedactedCalibrationOutcome[],
): AskHelmInteractionRedactedCalibrationCheck {
  const boundary = outcomes.filter((outcome) => outcome.kind === "boundary_hit");
  const eligible = boundary.filter(
    (outcome) => outcome.thresholdResult?.status === "eligible_candidate",
  );
  const rejected = boundary.filter(
    (outcome) =>
      outcome.rejectionReason ===
      "unsupported_open_domain_active_candidate_not_allowed",
  );
  return {
    name: "boundary_hit_eligible_and_unsupported_rejection_covered",
    pass: eligible.length >= 1 && rejected.length >= 1,
    detail: `eligible=${eligible.length}; unsupportedRejected=${rejected.length}`,
  };
}

function checkAbandonedAnswerCoverage(
  outcomes: readonly AskHelmInteractionRedactedCalibrationOutcome[],
): AskHelmInteractionRedactedCalibrationCheck {
  const abandoned = outcomes.filter(
    (outcome) => outcome.kind === "abandoned_high_confidence_answer",
  );
  const eligible = abandoned.filter(
    (outcome) => outcome.thresholdResult?.status === "eligible_candidate",
  );
  const watchOnly = abandoned.filter(
    (outcome) => outcome.thresholdResult?.status === "watch_only",
  );
  return {
    name: "abandoned_high_confidence_eligible_and_watch_only_covered",
    pass: eligible.length >= 1 && watchOnly.length >= 2,
    detail: `eligible=${eligible.length}; watchOnly=${watchOnly.length}`,
  };
}

function checkExplicitInteractionCoverage(
  outcomes: readonly AskHelmInteractionRedactedCalibrationOutcome[],
): AskHelmInteractionRedactedCalibrationCheck {
  const eligibleKinds = new Set(
    outcomes
      .filter((outcome) => outcome.thresholdResult?.status === "eligible_candidate")
      .map((outcome) => outcome.kind),
  );
  const pass =
    eligibleKinds.has("plan_follow_through") &&
    eligibleKinds.has("review_packet") &&
    eligibleKinds.has("handoff");
  return {
    name: "explicit_plan_review_packet_handoff_covered",
    pass,
    detail: `eligibleKinds=${[...eligibleKinds].sort().join(",")}`,
  };
}

function checkPrivacyBoundaryRejectionCoverage(
  outcomes: readonly AskHelmInteractionRedactedCalibrationOutcome[],
): AskHelmInteractionRedactedCalibrationCheck {
  const reasons = new Set(
    outcomes.flatMap((outcome) =>
      outcome.rejectionReason ? [outcome.rejectionReason] : [],
    ),
  );
  const pass =
    reasons.has("unconfirmed_transcript_not_allowed") &&
    reasons.has("cross_workspace_active_candidate_not_allowed") &&
    reasons.has("unsupported_open_domain_active_candidate_not_allowed");
  return {
    name: "privacy_and_boundary_rejection_paths_covered",
    pass,
    detail: `reasons=${[...reasons].sort().join(",")}`,
  };
}

function checkWorkspaceReviewVisibility(
  rows: readonly AskHelmInteractionRedactedCalibrationRow[],
): AskHelmInteractionRedactedCalibrationCheck {
  const workspaceVisibleRows = rows.filter(
    (row) => row.requestedVisibility === "workspace_review_visible",
  );
  const ungatedRows = workspaceVisibleRows.filter(
    (row) => !row.workspaceReviewVisibleCapabilityGated,
  );
  return {
    name: "workspace_review_visible_is_capability_gated",
    pass: workspaceVisibleRows.length >= 1 && ungatedRows.length === 0,
    detail: `workspaceVisibleRows=${workspaceVisibleRows.length}; ungated=${ungatedRows.length}`,
  };
}

function checkDedupeFoldsDuplicates(
  outcomes: readonly AskHelmInteractionRedactedCalibrationOutcome[],
  dedupeMergeResult: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionRedactedCalibrationCheck {
  const candidateCount = outcomes.filter((outcome) => outcome.candidate).length;
  const mergedCount = dedupeMergeResult.mergedCandidates.length;
  const folded = dedupeMergeResult.mergedCandidates.some(
    (candidate) => candidate.occurrenceCount > 1,
  );
  return {
    name: "dedupe_merge_folds_duplicate_interaction_assets",
    pass: candidateCount > mergedCount && folded,
    detail: `candidates=${candidateCount}; merged=${mergedCount}; folded=${String(folded)}`,
  };
}

function checkNoExecutionAuthority(
  outcomes: readonly AskHelmInteractionRedactedCalibrationOutcome[],
): AskHelmInteractionRedactedCalibrationCheck {
  const candidates = outcomes.flatMap((outcome) =>
    outcome.candidate ? [outcome.candidate] : [],
  );
  const forbidden = candidates.filter((candidate) =>
    [
      candidate.answerSummary,
      candidate.nextStep,
      candidate.boundaryNote,
      candidate.captureReason,
      candidate.promotionTarget,
    ].some((value) => containsForbiddenCaptureAuthorityWording(value)),
  );
  const promotionTargets = new Set<AskHelmInteractionPromotionTarget>(
    candidates.map((candidate) => candidate.promotionTarget),
  );
  const pass =
    forbidden.length === 0 &&
    !promotionTargets.has("SkillSuggestionCandidate") &&
    candidates.every((candidate) => candidate.status === "captured");
  return {
    name: "no_execution_or_formal_skill_authority_granted",
    pass,
    detail: `forbidden=${forbidden.length}; promotionTargets=${[...promotionTargets].sort().join(",")}`,
  };
}

const WORKSPACE_ID = "redacted-workspace-alpha";
const OTHER_WORKSPACE_ID = "redacted-workspace-other";
const ACTOR_SCOPE = "redacted-actor-operator";

const redactedOpportunityRef: ObjectRef = {
  objectType: "opportunity",
  objectId: "redacted-opportunity-001",
  displayName: "Redacted opportunity",
};

const redactedCompanyRef: ObjectRef = {
  objectType: "company",
  objectId: "redacted-company-001",
  displayName: "Redacted company",
};

const redactedMeetingRef: ObjectRef = {
  objectType: "meeting",
  objectId: "redacted-meeting-001",
  displayName: "Redacted meeting",
};

function defaultTelemetry(
  patch: Partial<AskHelmFollowThroughTelemetry> = {},
): AskHelmFollowThroughTelemetry {
  return {
    trackingAvailable: true,
    openedReviewSurface: false,
    savedPlan: false,
    queuedHandoff: false,
    preparedReviewPacket: false,
    dismissed: false,
    observableNoFollowThrough: true,
    weekendOnlySilence: false,
    ...patch,
  };
}

function occurrence(
  occurrenceId: string,
  objectRef: ObjectRef,
  occurredAt: string,
  patch: Partial<AskHelmIntentOccurrence> = {},
): AskHelmIntentOccurrence {
  return {
    occurrenceId,
    workspaceId: WORKSPACE_ID,
    actorScope: ACTOR_SCOPE,
    intentType: "today_priority",
    objectRef,
    occurredAt,
    ...patch,
  };
}

function baseRow(
  patch: Partial<AskHelmInteractionRedactedCalibrationRow> &
    Pick<
      AskHelmInteractionRedactedCalibrationRow,
      "rowId" | "kind" | "intentType" | "assetType" | "captureReason"
    >,
): AskHelmInteractionRedactedCalibrationRow {
  return {
    workspaceId: WORKSPACE_ID,
    actorScope: ACTOR_SCOPE,
    sourceTurnRef: `redacted-turn:${patch.rowId}`,
    observedAt: "2026-04-27T10:00:00.000Z",
    objectRef: redactedOpportunityRef,
    evidenceRefs: [`redacted-evidence:${patch.rowId}`],
    requestedVisibility: "user_only",
    retentionPosture: "temporary_review_candidate",
    riskLevel: "medium",
    status: "captured",
    sourceClassification: "workspace_scoped",
    transcriptState: "checked_summary",
    rawAudioRetained: false,
    rawPromptRetained: false,
    rawBodyRetained: false,
    activeCandidateRequested: true,
    crossWorkspaceAggregationRequested: false,
    workspaceReviewVisibleCapabilityGated: true,
    ...patch,
  };
}

export const DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_ROWS: readonly AskHelmInteractionRedactedCalibrationRow[] =
  [
    baseRow({
      rowId: "AHI-RC-001",
      kind: "repeated_intent",
      intentType: "today_priority",
      assetType: "repeated_intent_candidate",
      captureReason: "repeated_today_priority",
      repeatedIntentOccurrences: [
        occurrence("AHI-RC-OCC-001", redactedOpportunityRef, "2026-04-21T01:00:00.000Z"),
        occurrence("AHI-RC-OCC-002", redactedOpportunityRef, "2026-04-25T01:00:00.000Z"),
        occurrence("AHI-RC-OCC-003", redactedOpportunityRef, "2026-04-27T01:00:00.000Z"),
        occurrence("AHI-RC-OCC-X", redactedOpportunityRef, "2026-04-27T01:00:00.000Z", {
          workspaceId: OTHER_WORKSPACE_ID,
        }),
      ],
    }),
    baseRow({
      rowId: "AHI-RC-002",
      kind: "repeated_intent",
      intentType: "today_priority",
      assetType: "repeated_intent_candidate",
      captureReason: "repeated_today_priority",
      observedAt: "2026-04-27T12:00:00.000Z",
      repeatedIntentOccurrences: [
        occurrence("AHI-RC-OCC-004", redactedOpportunityRef, "2026-04-22T01:00:00.000Z"),
        occurrence("AHI-RC-OCC-005", redactedOpportunityRef, "2026-04-25T01:00:00.000Z"),
        occurrence("AHI-RC-OCC-006", redactedOpportunityRef, "2026-04-27T01:00:00.000Z"),
      ],
    }),
    baseRow({
      rowId: "AHI-RC-003",
      kind: "repeated_intent",
      intentType: "company_status",
      objectRef: redactedCompanyRef,
      assetType: "repeated_intent_candidate",
      captureReason: "repeated_company_status",
      repeatedIntentOccurrences: [
        occurrence("AHI-RC-OCC-007", redactedCompanyRef, "2026-04-25T01:00:00.000Z", {
          intentType: "company_status",
        }),
        occurrence("AHI-RC-OCC-008", redactedCompanyRef, "2026-04-27T01:00:00.000Z", {
          intentType: "company_status",
        }),
      ],
      activeCandidateRequested: false,
    }),
    baseRow({
      rowId: "AHI-RC-004",
      kind: "boundary_hit",
      intentType: "review_required_execution",
      assetType: "boundary_hit_candidate",
      captureReason: "blocked_review_required_execution",
      boundaryRequestKind: "review_required_execution",
      boundaryBlocked: true,
      requestedVisibility: "workspace_review_visible",
      riskLevel: "high",
    }),
    baseRow({
      rowId: "AHI-RC-005",
      kind: "boundary_hit",
      intentType: "unsupported_open_domain",
      assetType: "boundary_hit_candidate",
      captureReason: "unsupported_open_domain_active_candidate_probe",
      sourceClassification: "unsupported_open_domain",
      boundaryRequestKind: "unsupported_open_domain",
      boundaryBlocked: true,
    }),
    baseRow({
      rowId: "AHI-RC-006",
      kind: "abandoned_high_confidence_answer",
      intentType: "risk_follow_up",
      assetType: "abandoned_high_confidence_candidate",
      captureReason: "abandoned_high_confidence_answer",
      objectRef: redactedOpportunityRef,
      answerConfidence: 0.91,
      hasActionPlan: true,
      hasNextStep: true,
      boundaryNotePresent: true,
      followThroughTelemetry: defaultTelemetry(),
    }),
    baseRow({
      rowId: "AHI-RC-007",
      kind: "abandoned_high_confidence_answer",
      intentType: "risk_follow_up",
      assetType: "abandoned_high_confidence_candidate",
      captureReason: "missing_telemetry_watch_only",
      objectRef: redactedOpportunityRef,
      deterministicConfidence: "high",
      hasActionPlan: true,
      hasNextStep: true,
      boundaryNotePresent: true,
      followThroughTelemetry: defaultTelemetry({ trackingAvailable: false }),
      activeCandidateRequested: false,
    }),
    baseRow({
      rowId: "AHI-RC-008",
      kind: "abandoned_high_confidence_answer",
      intentType: "risk_follow_up",
      assetType: "abandoned_high_confidence_candidate",
      captureReason: "weekend_silence_watch_only",
      objectRef: redactedOpportunityRef,
      deterministicConfidence: "high",
      hasActionPlan: true,
      hasNextStep: true,
      boundaryNotePresent: true,
      followThroughTelemetry: defaultTelemetry({ weekendOnlySilence: true }),
      activeCandidateRequested: false,
    }),
    baseRow({
      rowId: "AHI-RC-009",
      kind: "plan_follow_through",
      intentType: "plan_breakdown",
      assetType: "plan_followthrough_candidate",
      captureReason: "explicit_plan_generation",
      objectRef: redactedOpportunityRef,
      explicitInteractionRequest: "generate_plan",
      hasActionPlan: true,
      hasSuggestedDri: true,
      hasSuggestedDue: true,
    }),
    baseRow({
      rowId: "AHI-RC-010",
      kind: "review_packet",
      intentType: "prepare_review_packet",
      assetType: "review_packet_candidate",
      captureReason: "explicit_review_packet",
      objectRef: redactedOpportunityRef,
      explicitInteractionRequest: "queue_review_packet",
      hasActionPlan: true,
      hasSuggestedDri: true,
      hasSuggestedDue: true,
      riskLevel: "high",
    }),
    baseRow({
      rowId: "AHI-RC-011",
      kind: "handoff",
      intentType: "request_handoff",
      assetType: "handoff_candidate",
      captureReason: "explicit_handoff",
      objectRef: redactedMeetingRef,
      explicitInteractionRequest: "request_handoff",
      hasActionPlan: true,
      hasSuggestedDri: true,
      hasSuggestedDue: true,
    }),
    baseRow({
      rowId: "AHI-RC-012",
      kind: "review_packet",
      intentType: "voice_review_packet",
      assetType: "review_packet_candidate",
      captureReason: "unconfirmed_transcript_rejection_probe",
      transcriptState: "unconfirmed",
      explicitInteractionRequest: "queue_review_packet",
      hasActionPlan: true,
      hasSuggestedDri: true,
      hasSuggestedDue: true,
    }),
    baseRow({
      rowId: "AHI-RC-013",
      kind: "handoff",
      intentType: "cross_workspace_handoff_probe",
      assetType: "handoff_candidate",
      captureReason: "cross_workspace_active_candidate_probe",
      sourceClassification: "cross_workspace",
      workspaceId: OTHER_WORKSPACE_ID,
      explicitInteractionRequest: "request_handoff",
      hasActionPlan: true,
      hasSuggestedDri: true,
      hasSuggestedDue: true,
    }),
  ];

export const DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT: AskHelmInteractionRedactedCalibrationInput =
  {
    sampleKind: "synthetic_fixture",
    rows: DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_ROWS,
  };

export const POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT: AskHelmInteractionRedactedCalibrationInput =
  {
    ...DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
    sampleKind: "redacted_real_interaction_snapshot",
  };

export const LOCAL_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT: AskHelmInteractionRedactedCalibrationInput =
  {
    ...DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
    sampleKind: "local_development_snapshot",
  };

export const DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION =
  evaluateAskHelmInteractionRedactedCalibration(
    DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
  );

export const POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION =
  evaluateAskHelmInteractionRedactedCalibration(
    POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_INPUT,
  );
