/**
 * Helm Business Advancement — Product Phase 3 / Slice 4
 * Ask Helm Interaction Asset Synthetic Fixtures + Offline Eval.
 *
 * Planning-only artifact. This file combines Slice 1 privacy / retention,
 * Slice 2 dedupe / merge, and Slice 3 threshold / eligibility over synthetic
 * fixtures only.
 *
 * It is NOT a runtime extractor, not an API, not a DB reader, not a queue, not
 * a page adapter, not an official write path, and not an execution authority.
 */

import {
  ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION,
  evaluateAskHelmCaptureEligibility,
  type AskHelmCaptureEligibilityInput,
  type AskHelmCaptureEligibilityResult,
} from "./ask-helm-interaction-capture-thresholds";
import {
  ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION,
  mergeAndRouteAskHelmInteractionAssets,
  type AskHelmInteractionAssetCandidate,
  type AskHelmInteractionAssetType,
  type AskHelmInteractionDedupeMergeResult,
  type AskHelmInteractionPromotionTarget,
  type AskHelmInteractionRetentionPosture,
  type AskHelmInteractionVisibility,
  type ExistingAdvancementSignalPlanningItem,
  type ExistingMustPushPlanningItem,
} from "./ask-helm-interaction-dedupe-merge";
import type { ObjectRef, RiskLevel } from "./contracts";

export const ASK_HELM_INTERACTION_OFFLINE_EVAL_RULE_VERSION =
  "ask-helm-interaction-offline-eval/v1";
export const ASK_HELM_INTERACTION_OFFLINE_EVAL_POSTURE = "Planning-Only";
export const ASK_HELM_INTERACTION_OFFLINE_EVAL_RUNTIME_ADOPTION = "No-Go";

export type AskHelmInteractionOfflineFixtureCategory =
  | "repeated_intent_eligible"
  | "repeated_intent_watch_only"
  | "boundary_hit_eligible"
  | "unsupported_open_domain_watch_only"
  | "abandoned_high_confidence_eligible"
  | "missing_telemetry_watch_only"
  | "weekend_only_silence_watch_only"
  | "plan_generation_eligible"
  | "saved_draft_eligible"
  | "review_packet_eligible"
  | "handoff_eligible"
  | "cross_workspace_aggregation_rejected"
  | "raw_audio_rejected"
  | "unconfirmed_transcript_rejected"
  | "open_domain_active_candidate_rejected"
  | "cross_workspace_active_candidate_rejected";

export type AskHelmInteractionSourceClassification =
  | "workspace_scoped"
  | "unsupported_open_domain"
  | "cross_workspace";

export type AskHelmInteractionTranscriptState =
  | "none"
  | "checked"
  | "unconfirmed";

export type AskHelmInteractionOfflineFixtureExpectedStatus =
  | "eligible_candidate"
  | "watch_only"
  | "rejected";

export interface AskHelmInteractionOfflineFixtureMetadata {
  readonly sourceClassification: AskHelmInteractionSourceClassification;
  readonly transcriptState: AskHelmInteractionTranscriptState;
  readonly rawAudioPresent: boolean;
  readonly rawPromptPresent: boolean;
  readonly rawBodyPresent: boolean;
  readonly activeCandidateRequested: boolean;
  readonly crossWorkspaceAggregationRequested: boolean;
  readonly workspaceReviewVisibleCapabilityGated: boolean;
  readonly requestedVisibility: AskHelmInteractionVisibility;
  readonly expectedStatus: AskHelmInteractionOfflineFixtureExpectedStatus;
  readonly expectedRejectionReason?: AskHelmInteractionOfflineRejectionReason;
}

export interface AskHelmInteractionOfflineFixture {
  readonly fixtureId: string;
  readonly category: AskHelmInteractionOfflineFixtureCategory;
  readonly observation: AskHelmCaptureEligibilityInput;
  readonly metadata: AskHelmInteractionOfflineFixtureMetadata;
  readonly assetType: AskHelmInteractionAssetType;
  readonly captureReason: string;
  readonly candidateId: string;
  readonly sourceTurnRef: string;
  readonly answerSummary: string;
  readonly nextStep: string;
  readonly riskLevel: RiskLevel;
  readonly retentionPosture: AskHelmInteractionRetentionPosture;
}

export type AskHelmInteractionOfflineRejectionReason =
  | "raw_audio_not_allowed"
  | "unconfirmed_transcript_not_allowed"
  | "cross_workspace_aggregation_not_allowed"
  | "unsupported_open_domain_active_candidate_not_allowed"
  | "cross_workspace_active_candidate_not_allowed"
  | "workspace_review_visible_missing_capability_gate";

export interface AskHelmInteractionRedactedExportRecord {
  readonly candidateId: string;
  readonly workspaceId: string;
  readonly capturedAt: string;
  readonly assetType: AskHelmInteractionAssetType;
  readonly intentType: string;
  readonly visibility: AskHelmInteractionVisibility;
  readonly retentionPosture: AskHelmInteractionRetentionPosture;
  readonly objectRefs: readonly ObjectRef[];
  readonly evidenceRefs: readonly string[];
  readonly captureReason: string;
  readonly boundaryNote: string;
  readonly promotionTarget: AskHelmInteractionPromotionTarget;
  readonly status: "captured";
  readonly redactionSummary: string;
}

export interface AskHelmInteractionOfflineFixtureOutcome {
  readonly fixtureId: string;
  readonly category: AskHelmInteractionOfflineFixtureCategory;
  readonly expectedStatus: AskHelmInteractionOfflineFixtureExpectedStatus;
  readonly privacyDecision:
    | "privacy_pass"
    | "privacy_rejected"
    | "boundary_rejected";
  readonly rejectionReason?: AskHelmInteractionOfflineRejectionReason;
  readonly thresholdResult?: AskHelmCaptureEligibilityResult;
  readonly candidate?: AskHelmInteractionAssetCandidate;
  readonly exportRecord?: AskHelmInteractionRedactedExportRecord;
}

export interface AskHelmInteractionOfflineEvalCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface AskHelmInteractionOfflineEvalSummary {
  readonly ruleVersion: string;
  readonly posture: typeof ASK_HELM_INTERACTION_OFFLINE_EVAL_POSTURE;
  readonly runtimeAdoption: typeof ASK_HELM_INTERACTION_OFFLINE_EVAL_RUNTIME_ADOPTION;
  readonly thresholdRuntimeAdoption: typeof ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION;
  readonly dedupeMergeRuntimeAdoption: typeof ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION;
  readonly checks: readonly AskHelmInteractionOfflineEvalCheck[];
  readonly eligibleCandidateCount: number;
  readonly watchOnlyCount: number;
  readonly rejectedCount: number;
  readonly mergedCandidateCount: number;
  readonly signalAttachmentCount: number;
  readonly mustPushAttachmentCount: number;
  readonly privacyViolationCount: number;
  readonly boundaryViolationCount: number;
  readonly allPass: boolean;
}

export interface AskHelmInteractionOfflineEvalResult {
  readonly summary: AskHelmInteractionOfflineEvalSummary;
  readonly outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[];
  readonly dedupeMergeResult: AskHelmInteractionDedupeMergeResult;
  readonly redactedExports: readonly AskHelmInteractionRedactedExportRecord[];
}

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

const defaultFollowThroughTelemetry = {
  trackingAvailable: true,
  openedReviewSurface: false,
  savedPlan: false,
  queuedHandoff: false,
  preparedReviewPacket: false,
  dismissed: false,
  observableNoFollowThrough: true,
  weekendOnlySilence: false,
} as const;

function repeatedOccurrence(
  occurrenceId: string,
  workspaceId: string,
  occurredAt: string,
): {
  readonly occurrenceId: string;
  readonly workspaceId: string;
  readonly actorScope: string;
  readonly intentType: string;
  readonly objectRef: ObjectRef;
  readonly occurredAt: string;
} {
  return {
    occurrenceId,
    workspaceId,
    actorScope: "user:synthetic-operator",
    intentType: "today_priority",
    objectRef: atlasOpportunityRef,
    occurredAt,
  };
}

function fixture(
  input: Omit<AskHelmInteractionOfflineFixture, "metadata"> & {
    readonly metadata: Partial<AskHelmInteractionOfflineFixtureMetadata> &
      Pick<
        AskHelmInteractionOfflineFixtureMetadata,
        "expectedStatus" | "requestedVisibility"
      >;
  },
): AskHelmInteractionOfflineFixture {
  return {
    ...input,
    metadata: {
      sourceClassification: "workspace_scoped",
      transcriptState: "none",
      rawAudioPresent: false,
      rawPromptPresent: false,
      rawBodyPresent: false,
      activeCandidateRequested: input.metadata.expectedStatus === "eligible_candidate",
      crossWorkspaceAggregationRequested: false,
      workspaceReviewVisibleCapabilityGated:
        input.metadata.requestedVisibility !== "workspace_review_visible",
      ...input.metadata,
    },
  };
}

export const ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES: readonly AskHelmInteractionOfflineFixture[] =
  [
    fixture({
      fixtureId: "AHI-OE-001",
      category: "repeated_intent_eligible",
      candidateId: "AHI-OE-CAND-001",
      sourceTurnRef: "turn:offline-eval-001",
      assetType: "repeated_intent_candidate",
      captureReason: "repeated_today_priority",
      answerSummary: "Synthetic repeated priority question for Atlas renewal.",
      nextStep: "Open repeated intent review.",
      riskLevel: "medium",
      retentionPosture: "temporary_review_candidate",
      observation: {
        observationId: "AHI-OE-001",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "repeated_intent",
        intentType: "today_priority",
        objectRef: atlasOpportunityRef,
        observedAt: "2026-04-27T10:00:00.000Z",
        repeatedIntentOccurrences: [
          repeatedOccurrence("occ-alpha-001", "workspace-alpha", "2026-04-21T01:00:00.000Z"),
          repeatedOccurrence("occ-alpha-002", "workspace-alpha", "2026-04-25T01:00:00.000Z"),
          repeatedOccurrence("occ-alpha-003", "workspace-alpha", "2026-04-27T01:00:00.000Z"),
          repeatedOccurrence("occ-beta-001", "workspace-beta", "2026-04-27T02:00:00.000Z"),
        ],
      },
      metadata: {
        expectedStatus: "eligible_candidate",
        requestedVisibility: "user_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-002",
      category: "repeated_intent_eligible",
      candidateId: "AHI-OE-CAND-002",
      sourceTurnRef: "turn:offline-eval-002",
      assetType: "repeated_intent_candidate",
      captureReason: "repeated_today_priority",
      answerSummary: "Synthetic duplicate repeated priority question.",
      nextStep: "Open repeated intent review.",
      riskLevel: "high",
      retentionPosture: "temporary_review_candidate",
      observation: {
        observationId: "AHI-OE-002",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "repeated_intent",
        intentType: "today_priority",
        objectRef: atlasOpportunityRef,
        observedAt: "2026-04-27T12:00:00.000Z",
        repeatedIntentOccurrences: [
          repeatedOccurrence("occ-alpha-004", "workspace-alpha", "2026-04-22T01:00:00.000Z"),
          repeatedOccurrence("occ-alpha-005", "workspace-alpha", "2026-04-26T01:00:00.000Z"),
          repeatedOccurrence("occ-alpha-006", "workspace-alpha", "2026-04-27T11:00:00.000Z"),
        ],
      },
      metadata: {
        expectedStatus: "eligible_candidate",
        requestedVisibility: "user_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-003",
      category: "repeated_intent_watch_only",
      candidateId: "AHI-OE-CAND-003",
      sourceTurnRef: "turn:offline-eval-003",
      assetType: "repeated_intent_candidate",
      captureReason: "repeated_today_priority",
      answerSummary: "Synthetic watch-only repeated priority question.",
      nextStep: "Watch repeated intent metric.",
      riskLevel: "low",
      retentionPosture: "not_persisted",
      observation: {
        observationId: "AHI-OE-003",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "repeated_intent",
        intentType: "today_priority",
        objectRef: atlasOpportunityRef,
        observedAt: "2026-04-27T13:00:00.000Z",
        repeatedIntentOccurrences: [
          repeatedOccurrence("occ-alpha-watch-001", "workspace-alpha", "2026-04-26T01:00:00.000Z"),
          repeatedOccurrence("occ-alpha-watch-002", "workspace-alpha", "2026-04-27T01:00:00.000Z"),
          repeatedOccurrence("occ-beta-watch-001", "workspace-beta", "2026-04-27T02:00:00.000Z"),
        ],
      },
      metadata: {
        activeCandidateRequested: false,
        expectedStatus: "watch_only",
        requestedVisibility: "user_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-004",
      category: "boundary_hit_eligible",
      candidateId: "AHI-OE-CAND-004",
      sourceTurnRef: "turn:offline-eval-004",
      assetType: "boundary_hit_candidate",
      captureReason: "review_required_boundary_hit",
      answerSummary: "Synthetic blocked official-write request for 星河连锁.",
      nextStep: "Open human review packet.",
      riskLevel: "high",
      retentionPosture: "temporary_review_candidate",
      observation: {
        observationId: "AHI-OE-004",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "boundary_hit",
        intentType: "review_required_execution",
        objectRef: xingheCompanyRef,
        observedAt: "2026-04-27T14:00:00.000Z",
        evidenceRefs: ["evidence:xinghe-boundary"],
        boundaryRequestKind: "official_write",
        boundaryBlocked: true,
      },
      metadata: {
        expectedStatus: "eligible_candidate",
        requestedVisibility: "workspace_review_visible",
        workspaceReviewVisibleCapabilityGated: true,
      },
    }),
    fixture({
      fixtureId: "AHI-OE-005",
      category: "unsupported_open_domain_watch_only",
      candidateId: "AHI-OE-CAND-005",
      sourceTurnRef: "turn:offline-eval-005",
      assetType: "boundary_hit_candidate",
      captureReason: "unsupported_open_domain_guard_metric",
      answerSummary: "Synthetic unsupported open-domain guard metric.",
      nextStep: "Keep as guard metric only.",
      riskLevel: "low",
      retentionPosture: "not_persisted",
      observation: {
        observationId: "AHI-OE-005",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "boundary_hit",
        intentType: "unsupported_open_domain",
        observedAt: "2026-04-27T15:00:00.000Z",
        boundaryRequestKind: "unsupported_open_domain",
        boundaryBlocked: true,
      },
      metadata: {
        sourceClassification: "unsupported_open_domain",
        activeCandidateRequested: false,
        expectedStatus: "watch_only",
        requestedVisibility: "user_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-006",
      category: "abandoned_high_confidence_eligible",
      candidateId: "AHI-OE-CAND-006",
      sourceTurnRef: "turn:offline-eval-006",
      assetType: "abandoned_high_confidence_candidate",
      captureReason: "abandoned_high_confidence_answer",
      answerSummary: "Synthetic grounded answer without follow-through.",
      nextStep: "Review whether this should become memory candidate.",
      riskLevel: "medium",
      retentionPosture: "temporary_review_candidate",
      observation: {
        observationId: "AHI-OE-006",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "abandoned_high_confidence_answer",
        intentType: "plan_breakdown",
        objectRef: atlasOpportunityRef,
        evidenceRefs: ["evidence:atlas-answer", "evidence:atlas-next-step"],
        observedAt: "2026-04-27T16:00:00.000Z",
        answerConfidence: 0.9,
        hasActionPlan: true,
        hasNextStep: true,
        boundaryNote: "answer is not official memory; plan is not task truth.",
        followThroughTelemetry: defaultFollowThroughTelemetry,
      },
      metadata: {
        expectedStatus: "eligible_candidate",
        requestedVisibility: "reviewer_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-007",
      category: "missing_telemetry_watch_only",
      candidateId: "AHI-OE-CAND-007",
      sourceTurnRef: "turn:offline-eval-007",
      assetType: "abandoned_high_confidence_candidate",
      captureReason: "missing_telemetry_watch",
      answerSummary: "Synthetic high-confidence answer with missing telemetry.",
      nextStep: "Watch only until telemetry is complete.",
      riskLevel: "low",
      retentionPosture: "not_persisted",
      observation: {
        observationId: "AHI-OE-007",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "abandoned_high_confidence_answer",
        intentType: "plan_breakdown",
        objectRef: atlasOpportunityRef,
        evidenceRefs: ["evidence:atlas-answer-missing-telemetry"],
        observedAt: "2026-04-27T17:00:00.000Z",
        deterministicConfidence: "high",
        hasActionPlan: true,
        hasNextStep: true,
        boundaryNote: "answer is not official memory; plan is not task truth.",
        followThroughTelemetry: {
          ...defaultFollowThroughTelemetry,
          trackingAvailable: false,
        },
      },
      metadata: {
        activeCandidateRequested: false,
        expectedStatus: "watch_only",
        requestedVisibility: "user_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-008",
      category: "weekend_only_silence_watch_only",
      candidateId: "AHI-OE-CAND-008",
      sourceTurnRef: "turn:offline-eval-008",
      assetType: "abandoned_high_confidence_candidate",
      captureReason: "weekend_silence_watch",
      answerSummary: "Synthetic high-confidence answer with weekend-only silence.",
      nextStep: "Watch only until a business-day gap is observable.",
      riskLevel: "low",
      retentionPosture: "not_persisted",
      observation: {
        observationId: "AHI-OE-008",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "abandoned_high_confidence_answer",
        intentType: "plan_breakdown",
        objectRef: atlasOpportunityRef,
        evidenceRefs: ["evidence:atlas-weekend-silence"],
        observedAt: "2026-04-26T17:00:00.000Z",
        deterministicConfidence: "high",
        hasActionPlan: true,
        hasNextStep: true,
        boundaryNote: "answer is not official memory; plan is not task truth.",
        followThroughTelemetry: {
          ...defaultFollowThroughTelemetry,
          weekendOnlySilence: true,
        },
      },
      metadata: {
        activeCandidateRequested: false,
        expectedStatus: "watch_only",
        requestedVisibility: "user_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-009",
      category: "plan_generation_eligible",
      candidateId: "AHI-OE-CAND-009",
      sourceTurnRef: "turn:offline-eval-009",
      assetType: "plan_followthrough_candidate",
      captureReason: "plan_generated_with_steps",
      answerSummary: "Synthetic generated plan with object, DRI, due, evidence.",
      nextStep: "Review generated plan as a memory candidate.",
      riskLevel: "medium",
      retentionPosture: "temporary_review_candidate",
      observation: {
        observationId: "AHI-OE-009",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "plan_follow_through",
        intentType: "plan_breakdown",
        objectRef: northstarMeetingRef,
        evidenceRefs: ["evidence:northstar-plan"],
        observedAt: "2026-04-27T18:00:00.000Z",
        hasActionPlan: true,
        hasSuggestedDri: true,
        hasSuggestedDue: true,
        explicitInteractionRequest: "generate_plan",
      },
      metadata: {
        expectedStatus: "eligible_candidate",
        requestedVisibility: "reviewer_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-010",
      category: "saved_draft_eligible",
      candidateId: "AHI-OE-CAND-010",
      sourceTurnRef: "turn:offline-eval-010",
      assetType: "review_packet_candidate",
      captureReason: "saved_draft_for_review",
      answerSummary: "Synthetic saved draft for review.",
      nextStep: "Review saved draft before any external action.",
      riskLevel: "medium",
      retentionPosture: "temporary_review_candidate",
      observation: {
        observationId: "AHI-OE-010",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "review_packet",
        intentType: "save_draft",
        objectRef: northstarMeetingRef,
        evidenceRefs: ["evidence:xinghe-saved-draft"],
        observedAt: "2026-04-27T19:00:00.000Z",
        hasActionPlan: true,
        hasSuggestedDri: true,
        hasSuggestedDue: true,
        explicitInteractionRequest: "save_draft",
      },
      metadata: {
        expectedStatus: "eligible_candidate",
        requestedVisibility: "reviewer_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-011",
      category: "review_packet_eligible",
      candidateId: "AHI-OE-CAND-011",
      sourceTurnRef: "turn:offline-eval-011",
      assetType: "review_packet_candidate",
      captureReason: "review_packet_prepared",
      answerSummary: "Synthetic prepared review packet.",
      nextStep: "Open review packet.",
      riskLevel: "medium",
      retentionPosture: "temporary_review_candidate",
      observation: {
        observationId: "AHI-OE-011",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "review_packet",
        intentType: "prepare_review_packet",
        objectRef: northstarMeetingRef,
        evidenceRefs: ["evidence:xinghe-review-packet"],
        observedAt: "2026-04-27T20:00:00.000Z",
        hasActionPlan: true,
        hasSuggestedDri: true,
        hasSuggestedDue: true,
        explicitInteractionRequest: "queue_review_packet",
      },
      metadata: {
        expectedStatus: "eligible_candidate",
        requestedVisibility: "reviewer_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-012",
      category: "handoff_eligible",
      candidateId: "AHI-OE-CAND-012",
      sourceTurnRef: "turn:offline-eval-012",
      assetType: "handoff_candidate",
      captureReason: "handoff_requested",
      answerSummary: "Synthetic internal handoff request.",
      nextStep: "Review internal handoff.",
      riskLevel: "medium",
      retentionPosture: "temporary_review_candidate",
      observation: {
        observationId: "AHI-OE-012",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "handoff",
        intentType: "request_handoff",
        objectRef: northstarMeetingRef,
        evidenceRefs: ["evidence:northstar-handoff"],
        observedAt: "2026-04-27T21:00:00.000Z",
        hasActionPlan: true,
        hasSuggestedDri: true,
        hasSuggestedDue: true,
        explicitInteractionRequest: "request_handoff",
      },
      metadata: {
        expectedStatus: "eligible_candidate",
        requestedVisibility: "reviewer_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-013",
      category: "cross_workspace_aggregation_rejected",
      candidateId: "AHI-OE-CAND-013",
      sourceTurnRef: "turn:offline-eval-013",
      assetType: "repeated_intent_candidate",
      captureReason: "cross_workspace_repeated_intent",
      answerSummary: "Synthetic cross-workspace aggregation attempt.",
      nextStep: "Reject cross-workspace aggregation.",
      riskLevel: "high",
      retentionPosture: "not_persisted",
      observation: {
        observationId: "AHI-OE-013",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "repeated_intent",
        intentType: "today_priority",
        objectRef: atlasOpportunityRef,
        observedAt: "2026-04-27T22:00:00.000Z",
        repeatedIntentOccurrences: [
          repeatedOccurrence("occ-cross-001", "workspace-alpha", "2026-04-27T01:00:00.000Z"),
          repeatedOccurrence("occ-cross-002", "workspace-beta", "2026-04-27T02:00:00.000Z"),
          repeatedOccurrence("occ-cross-003", "workspace-gamma", "2026-04-27T03:00:00.000Z"),
        ],
      },
      metadata: {
        crossWorkspaceAggregationRequested: true,
        expectedStatus: "rejected",
        expectedRejectionReason: "cross_workspace_aggregation_not_allowed",
        requestedVisibility: "user_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-014",
      category: "raw_audio_rejected",
      candidateId: "AHI-OE-CAND-014",
      sourceTurnRef: "turn:offline-eval-014",
      assetType: "review_packet_candidate",
      captureReason: "raw_audio_capture_attempt",
      answerSummary: "Synthetic raw audio capture attempt.",
      nextStep: "Reject raw audio.",
      riskLevel: "high",
      retentionPosture: "not_persisted",
      observation: {
        observationId: "AHI-OE-014",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "review_packet",
        intentType: "prepare_review_packet",
        objectRef: xingheCompanyRef,
        evidenceRefs: ["evidence:raw-audio-attempt"],
        observedAt: "2026-04-27T23:00:00.000Z",
        hasActionPlan: true,
        hasSuggestedDri: true,
        hasSuggestedDue: true,
        explicitInteractionRequest: "queue_review_packet",
      },
      metadata: {
        rawAudioPresent: true,
        expectedStatus: "rejected",
        expectedRejectionReason: "raw_audio_not_allowed",
        requestedVisibility: "user_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-015",
      category: "unconfirmed_transcript_rejected",
      candidateId: "AHI-OE-CAND-015",
      sourceTurnRef: "turn:offline-eval-015",
      assetType: "review_packet_candidate",
      captureReason: "unconfirmed_transcript_attempt",
      answerSummary: "Synthetic unconfirmed transcript capture attempt.",
      nextStep: "Reject unconfirmed transcript.",
      riskLevel: "high",
      retentionPosture: "not_persisted",
      observation: {
        observationId: "AHI-OE-015",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "review_packet",
        intentType: "prepare_review_packet",
        objectRef: xingheCompanyRef,
        evidenceRefs: ["evidence:unconfirmed-transcript-attempt"],
        observedAt: "2026-04-28T00:00:00.000Z",
        hasActionPlan: true,
        hasSuggestedDri: true,
        hasSuggestedDue: true,
        explicitInteractionRequest: "queue_review_packet",
      },
      metadata: {
        transcriptState: "unconfirmed",
        expectedStatus: "rejected",
        expectedRejectionReason: "unconfirmed_transcript_not_allowed",
        requestedVisibility: "user_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-016",
      category: "open_domain_active_candidate_rejected",
      candidateId: "AHI-OE-CAND-016",
      sourceTurnRef: "turn:offline-eval-016",
      assetType: "boundary_hit_candidate",
      captureReason: "open_domain_active_candidate_attempt",
      answerSummary: "Synthetic open-domain active candidate attempt.",
      nextStep: "Reject open-domain active candidate.",
      riskLevel: "high",
      retentionPosture: "not_persisted",
      observation: {
        observationId: "AHI-OE-016",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "boundary_hit",
        intentType: "unsupported_open_domain",
        observedAt: "2026-04-28T01:00:00.000Z",
        boundaryRequestKind: "unsupported_open_domain",
        boundaryBlocked: true,
      },
      metadata: {
        sourceClassification: "unsupported_open_domain",
        activeCandidateRequested: true,
        expectedStatus: "rejected",
        expectedRejectionReason:
          "unsupported_open_domain_active_candidate_not_allowed",
        requestedVisibility: "user_only",
      },
    }),
    fixture({
      fixtureId: "AHI-OE-017",
      category: "cross_workspace_active_candidate_rejected",
      candidateId: "AHI-OE-CAND-017",
      sourceTurnRef: "turn:offline-eval-017",
      assetType: "boundary_hit_candidate",
      captureReason: "cross_workspace_active_candidate_attempt",
      answerSummary: "Synthetic cross-workspace active candidate attempt.",
      nextStep: "Reject cross-workspace active candidate.",
      riskLevel: "high",
      retentionPosture: "not_persisted",
      observation: {
        observationId: "AHI-OE-017",
        workspaceId: "workspace-alpha",
        actorScope: "user:synthetic-operator",
        kind: "boundary_hit",
        intentType: "cross_workspace_denied",
        observedAt: "2026-04-28T02:00:00.000Z",
        boundaryRequestKind: "review_required_execution",
        boundaryBlocked: true,
      },
      metadata: {
        sourceClassification: "cross_workspace",
        activeCandidateRequested: true,
        expectedStatus: "rejected",
        expectedRejectionReason: "cross_workspace_active_candidate_not_allowed",
        requestedVisibility: "user_only",
      },
    }),
  ] as const;

const EXISTING_SIGNAL_FIXTURES: readonly ExistingAdvancementSignalPlanningItem[] =
  [
    {
      workspaceId: "workspace-alpha",
      signal: {
        signalId: "signal:atlas-repeated-intent",
        sourceType: "ask_helm",
        signalType: "repeated_intent",
        objectRef: atlasOpportunityRef,
        evidenceRefs: ["evidence:existing-atlas-signal"],
        sourceScenario: "Existing synthetic repeated Ask Helm intent.",
        detectedAt: "2026-04-27T09:00:00.000Z",
      },
    },
  ] as const;

const EXISTING_MUST_PUSH_FIXTURES: readonly ExistingMustPushPlanningItem[] = [
  {
    workspaceId: "workspace-alpha",
    objectRef: xingheCompanyRef,
    linkedSignalType: "boundary_hit",
    item: {
      itemId: "must-push:xinghe-boundary-review",
      title: "星河连锁 blocked request requires review",
      reason: "Existing synthetic Must Push item covers the same boundary hit.",
      evidenceRefs: ["evidence:existing-xinghe-must-push"],
      primaryAction: "Open review surface",
      boundaryNote: "Review required; no external action is authorized.",
      reviewPosture: "review_required",
      sourceSummary: "Synthetic existing boundary review item.",
      riskLevel: "high",
      sortKey: 10,
    },
  },
] as const;

const REQUIRED_FIXTURE_CATEGORIES: readonly AskHelmInteractionOfflineFixtureCategory[] =
  [
    "repeated_intent_eligible",
    "repeated_intent_watch_only",
    "boundary_hit_eligible",
    "unsupported_open_domain_watch_only",
    "abandoned_high_confidence_eligible",
    "missing_telemetry_watch_only",
    "weekend_only_silence_watch_only",
    "plan_generation_eligible",
    "saved_draft_eligible",
    "review_packet_eligible",
    "handoff_eligible",
    "cross_workspace_aggregation_rejected",
    "raw_audio_rejected",
    "unconfirmed_transcript_rejected",
    "open_domain_active_candidate_rejected",
    "cross_workspace_active_candidate_rejected",
  ] as const;

const REVIEW_FIRST_PROMOTION_TARGETS: readonly AskHelmInteractionPromotionTarget[] =
  [
    "AdvancementSignal",
    "MemoryWritebackCandidate",
    "SkillSuggestionCandidate",
    "ReviewRequiredAction",
  ] as const;

const FORBIDDEN_AUTHORITY_GRANT_PATTERNS = [
  "official write allowed",
  "external action authorized",
  "send allowed",
  "approval granted",
  "payment authorized",
  "bypass guard",
  "skip review",
  "formal skill promoted",
] as const;

const FORBIDDEN_EXPORT_FIELD_NAMES = [
  "rawPrompt",
  "rawBody",
  "rawAudio",
  "rawTranscript",
  "unconfirmedTranscript",
  "prompt",
  "body",
  "audio",
  "transcript",
] as const;

export function evaluateAskHelmInteractionOfflineEval(): AskHelmInteractionOfflineEvalResult {
  const outcomes = ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES.map(
    evaluateFixture,
  ).sort((left, right) => left.fixtureId.localeCompare(right.fixtureId));
  const candidates = outcomes.flatMap((outcome) =>
    outcome.candidate ? [outcome.candidate] : [],
  );
  const redactedExports = outcomes.flatMap((outcome) =>
    outcome.exportRecord ? [outcome.exportRecord] : [],
  );
  const dedupeMergeResult = mergeAndRouteAskHelmInteractionAssets({
    candidates,
    existingSignals: EXISTING_SIGNAL_FIXTURES,
    existingMustPushItems: EXISTING_MUST_PUSH_FIXTURES,
  });
  const privacyViolations = privacyViolationDetails(outcomes);
  const boundaryViolations = boundaryViolationDetails(outcomes);
  const checks = buildChecks({
    outcomes,
    dedupeMergeResult,
    redactedExports,
    privacyViolations,
    boundaryViolations,
  });

  return {
    outcomes,
    dedupeMergeResult,
    redactedExports,
    summary: {
      ruleVersion: ASK_HELM_INTERACTION_OFFLINE_EVAL_RULE_VERSION,
      posture: ASK_HELM_INTERACTION_OFFLINE_EVAL_POSTURE,
      runtimeAdoption: ASK_HELM_INTERACTION_OFFLINE_EVAL_RUNTIME_ADOPTION,
      thresholdRuntimeAdoption:
        ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION,
      dedupeMergeRuntimeAdoption:
        ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION,
      checks,
      eligibleCandidateCount: outcomes.filter(
        (outcome) => outcome.thresholdResult?.status === "eligible_candidate",
      ).length,
      watchOnlyCount: outcomes.filter(
        (outcome) => outcome.thresholdResult?.status === "watch_only",
      ).length,
      rejectedCount: outcomes.filter(
        (outcome) =>
          outcome.privacyDecision === "privacy_rejected" ||
          outcome.privacyDecision === "boundary_rejected",
      ).length,
      mergedCandidateCount: dedupeMergeResult.mergedCandidates.length,
      signalAttachmentCount:
        dedupeMergeResult.advancementSignalAttachments.length,
      mustPushAttachmentCount: dedupeMergeResult.mustPushAttachments.length,
      privacyViolationCount: privacyViolations.length,
      boundaryViolationCount: boundaryViolations.length,
      allPass: checks.every((check) => check.pass),
    },
  };
}

function evaluateFixture(
  fixtureInput: AskHelmInteractionOfflineFixture,
): AskHelmInteractionOfflineFixtureOutcome {
  const privacyDecision = classifyPrivacyAndBoundary(fixtureInput);
  if (privacyDecision) {
    return {
      fixtureId: fixtureInput.fixtureId,
      category: fixtureInput.category,
      expectedStatus: fixtureInput.metadata.expectedStatus,
      privacyDecision: privacyDecision.decision,
      rejectionReason: privacyDecision.reason,
    };
  }

  const thresholdResult = evaluateAskHelmCaptureEligibility(
    fixtureInput.observation,
  );
  const candidate =
    thresholdResult.status === "eligible_candidate"
      ? candidateFromFixture(fixtureInput, thresholdResult)
      : undefined;
  const exportRecord = candidate ? redactedExportFromCandidate(candidate) : undefined;

  return {
    fixtureId: fixtureInput.fixtureId,
    category: fixtureInput.category,
    expectedStatus: fixtureInput.metadata.expectedStatus,
    privacyDecision: "privacy_pass",
    thresholdResult,
    candidate,
    exportRecord,
  };
}

function classifyPrivacyAndBoundary(
  input: AskHelmInteractionOfflineFixture,
):
  | {
      readonly decision: "privacy_rejected" | "boundary_rejected";
      readonly reason: AskHelmInteractionOfflineRejectionReason;
    }
  | undefined {
  if (input.metadata.rawAudioPresent) {
    return {
      decision: "privacy_rejected",
      reason: "raw_audio_not_allowed",
    };
  }
  if (input.metadata.transcriptState === "unconfirmed") {
    return {
      decision: "privacy_rejected",
      reason: "unconfirmed_transcript_not_allowed",
    };
  }
  if (input.metadata.crossWorkspaceAggregationRequested) {
    return {
      decision: "boundary_rejected",
      reason: "cross_workspace_aggregation_not_allowed",
    };
  }
  if (
    input.metadata.sourceClassification === "unsupported_open_domain" &&
    input.metadata.activeCandidateRequested
  ) {
    return {
      decision: "boundary_rejected",
      reason: "unsupported_open_domain_active_candidate_not_allowed",
    };
  }
  if (
    input.metadata.sourceClassification === "cross_workspace" &&
    input.metadata.activeCandidateRequested
  ) {
    return {
      decision: "boundary_rejected",
      reason: "cross_workspace_active_candidate_not_allowed",
    };
  }
  if (
    input.metadata.requestedVisibility === "workspace_review_visible" &&
    !input.metadata.workspaceReviewVisibleCapabilityGated
  ) {
    return {
      decision: "privacy_rejected",
      reason: "workspace_review_visible_missing_capability_gate",
    };
  }
  return undefined;
}

function candidateFromFixture(
  input: AskHelmInteractionOfflineFixture,
  thresholdResult: AskHelmCaptureEligibilityResult,
): AskHelmInteractionAssetCandidate {
  return {
    candidateId: input.candidateId,
    workspaceId: input.observation.workspaceId,
    actorScope: input.observation.actorScope,
    sourceTurnRef: input.sourceTurnRef,
    intentType: input.observation.intentType,
    assetType: input.assetType,
    objectRefs: input.observation.objectRef ? [input.observation.objectRef] : [],
    evidenceRefs: input.observation.evidenceRefs ?? [
      `evidence:${input.fixtureId.toLowerCase()}`,
    ],
    answerSummary: input.answerSummary,
    nextStep: input.nextStep,
    boundaryNote: thresholdResult.boundaryNote,
    captureReason: input.captureReason,
    reviewPosture: thresholdResult.reviewPosture,
    visibility: input.metadata.requestedVisibility,
    retentionPosture: input.retentionPosture,
    promotionTarget: thresholdResult.promotionTarget,
    capturedAt: input.observation.observedAt,
    riskLevel: input.riskLevel,
    status: "captured",
  };
}

function redactedExportFromCandidate(
  candidate: AskHelmInteractionAssetCandidate,
): AskHelmInteractionRedactedExportRecord {
  return {
    candidateId: candidate.candidateId,
    workspaceId: candidate.workspaceId,
    capturedAt: candidate.capturedAt,
    assetType: candidate.assetType,
    intentType: candidate.intentType,
    visibility: candidate.visibility,
    retentionPosture: candidate.retentionPosture,
    objectRefs: candidate.objectRefs,
    evidenceRefs: candidate.evidenceRefs,
    captureReason: candidate.captureReason,
    boundaryNote: candidate.boundaryNote,
    promotionTarget: candidate.promotionTarget,
    status: "captured",
    redactionSummary:
      "raw prompts, raw bodies, raw audio, raw transcripts, unconfirmed transcripts, secrets, credentials, payment details, and inaccessible cross-workspace content removed",
  };
}

function buildChecks(input: {
  readonly outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[];
  readonly dedupeMergeResult: AskHelmInteractionDedupeMergeResult;
  readonly redactedExports: readonly AskHelmInteractionRedactedExportRecord[];
  readonly privacyViolations: readonly string[];
  readonly boundaryViolations: readonly string[];
}): readonly AskHelmInteractionOfflineEvalCheck[] {
  return [
    checkRuleVersion(),
    checkRuntimeAdoptionNoGo(),
    checkRequiredFixtureCategoriesCovered(),
    checkExpectedStatuses(input.outcomes),
    checkRawAudioRejected(input.outcomes),
    checkUnconfirmedTranscriptRejected(input.outcomes),
    checkNoCrossWorkspaceAggregation(input.outcomes),
    checkThresholdStatusesMatchSlice3(input.outcomes),
    checkDedupeMergeFoldsRepeatedCandidates(input.dedupeMergeResult),
    checkPromotionTargetsReviewFirst(input.outcomes),
    checkWorkspaceReviewVisibleCapabilityGated(),
    checkRedactedExports(input.redactedExports),
    checkNoForbiddenAuthorityWording(input),
    checkDeterministicReversal(input.dedupeMergeResult),
    checkSignalAttachment(input.dedupeMergeResult),
    checkMustPushAttachment(input.dedupeMergeResult),
    checkNoPrivacyViolations(input.privacyViolations),
    checkNoBoundaryViolations(input.boundaryViolations),
  ];
}

function checkRuleVersion(): AskHelmInteractionOfflineEvalCheck {
  const pass =
    ASK_HELM_INTERACTION_OFFLINE_EVAL_RULE_VERSION ===
    "ask-helm-interaction-offline-eval/v1";
  return {
    name: "rule_version_is_v1",
    pass,
    detail: ASK_HELM_INTERACTION_OFFLINE_EVAL_RULE_VERSION,
  };
}

function checkRuntimeAdoptionNoGo(): AskHelmInteractionOfflineEvalCheck {
  const pass =
    ASK_HELM_INTERACTION_OFFLINE_EVAL_RUNTIME_ADOPTION === "No-Go" &&
    ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION === "No-Go" &&
    ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION === "No-Go";
  return {
    name: "runtime_adoption_is_no_go",
    pass,
    detail: `offline=${ASK_HELM_INTERACTION_OFFLINE_EVAL_RUNTIME_ADOPTION}; thresholds=${ASK_HELM_INTERACTION_CAPTURE_THRESHOLDS_RUNTIME_ADOPTION}; dedupe=${ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION}`,
  };
}

function checkRequiredFixtureCategoriesCovered(): AskHelmInteractionOfflineEvalCheck {
  const categories = new Set(
    ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES.map((item) => item.category),
  );
  const missing = REQUIRED_FIXTURE_CATEGORIES.filter(
    (category) => !categories.has(category),
  );
  return {
    name: "all_required_fixture_categories_covered",
    pass: missing.length === 0,
    detail:
      missing.length === 0
        ? `${categories.size} categories covered`
        : `missing=${missing.join(",")}`,
  };
}

function checkExpectedStatuses(
  outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[],
): AskHelmInteractionOfflineEvalCheck {
  const mismatches = outcomes.filter((outcome) => {
    const actual = outcomeStatus(outcome);
    return actual !== outcome.expectedStatus;
  });
  return {
    name: "fixture_expected_statuses_match",
    pass: mismatches.length === 0,
    detail:
      mismatches.length === 0
        ? "all fixture expected statuses matched"
        : mismatches
            .map((item) => `${item.fixtureId}:${outcomeStatus(item)}`)
            .join(","),
  };
}

function checkRawAudioRejected(
  outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[],
): AskHelmInteractionOfflineEvalCheck {
  const outcome = outcomeByCategory(outcomes, "raw_audio_rejected");
  const pass =
    outcome?.privacyDecision === "privacy_rejected" &&
    outcome.rejectionReason === "raw_audio_not_allowed" &&
    !outcome.candidate;
  return {
    name: "raw_audio_never_becomes_candidate",
    pass,
    detail: outcome
      ? `${outcome.fixtureId}:${outcome.rejectionReason ?? "not_rejected"}`
      : "raw audio fixture missing",
  };
}

function checkUnconfirmedTranscriptRejected(
  outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[],
): AskHelmInteractionOfflineEvalCheck {
  const outcome = outcomeByCategory(outcomes, "unconfirmed_transcript_rejected");
  const pass =
    outcome?.privacyDecision === "privacy_rejected" &&
    outcome.rejectionReason === "unconfirmed_transcript_not_allowed" &&
    !outcome.candidate;
  return {
    name: "unconfirmed_transcript_never_becomes_candidate",
    pass,
    detail: outcome
      ? `${outcome.fixtureId}:${outcome.rejectionReason ?? "not_rejected"}`
      : "unconfirmed transcript fixture missing",
  };
}

function checkNoCrossWorkspaceAggregation(
  outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[],
): AskHelmInteractionOfflineEvalCheck {
  const rejected = outcomeByCategory(
    outcomes,
    "cross_workspace_aggregation_rejected",
  );
  const repeatedEligible = outcomeByCategory(outcomes, "repeated_intent_eligible");
  const countedIds =
    repeatedEligible?.thresholdResult?.countedOccurrenceIds ?? [];
  const pass =
    rejected?.rejectionReason === "cross_workspace_aggregation_not_allowed" &&
    !countedIds.some((id) => id.includes("beta"));
  return {
    name: "cross_workspace_aggregation_rejected",
    pass,
    detail: `rejected=${rejected?.rejectionReason ?? "missing"}; counted=${countedIds.join(",")}`,
  };
}

function checkThresholdStatusesMatchSlice3(
  outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[],
): AskHelmInteractionOfflineEvalCheck {
  const mismatches = outcomes.filter((outcome) => {
    if (outcome.privacyDecision !== "privacy_pass") {
      return false;
    }
    const fixtureInput = ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES.find(
      (fixtureItem) => fixtureItem.fixtureId === outcome.fixtureId,
    );
    if (!fixtureInput || !outcome.thresholdResult) {
      return true;
    }
    return (
      evaluateAskHelmCaptureEligibility(fixtureInput.observation).status !==
      outcome.thresholdResult.status
    );
  });
  return {
    name: "threshold_statuses_match_slice3",
    pass: mismatches.length === 0,
    detail:
      mismatches.length === 0
        ? "all privacy-passed fixtures use Slice 3 threshold statuses"
        : mismatches.map((item) => item.fixtureId).join(","),
  };
}

function checkDedupeMergeFoldsRepeatedCandidates(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionOfflineEvalCheck {
  const folded = result.mergedCandidates.find((candidate) =>
    candidate.foldedCandidateIds.includes("AHI-OE-CAND-001"),
  );
  const pass =
    folded?.occurrenceCount === 2 &&
    folded.foldedCandidateIds.includes("AHI-OE-CAND-002");
  return {
    name: "dedupe_merge_folds_repeated_candidates",
    pass,
    detail: folded
      ? `occurrenceCount=${folded.occurrenceCount}; ids=${folded.foldedCandidateIds.join(",")}`
      : "folded repeated candidate not found",
  };
}

function checkPromotionTargetsReviewFirst(
  outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[],
): AskHelmInteractionOfflineEvalCheck {
  const invalid = outcomes
    .flatMap((outcome) => (outcome.candidate ? [outcome.candidate] : []))
    .filter(
      (candidate) =>
        !REVIEW_FIRST_PROMOTION_TARGETS.includes(candidate.promotionTarget) ||
        candidate.retentionPosture !== "temporary_review_candidate" ||
        candidate.reviewPosture === "read_only",
    );
  return {
    name: "promotion_targets_are_review_first",
    pass: invalid.length === 0,
    detail:
      invalid.length === 0
        ? "all candidates use review-first promotion targets and temporary retention"
        : invalid.map((item) => item.candidateId).join(","),
  };
}

function checkWorkspaceReviewVisibleCapabilityGated(): AskHelmInteractionOfflineEvalCheck {
  const invalid = ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES.filter(
    (item) =>
      item.metadata.requestedVisibility === "workspace_review_visible" &&
      !item.metadata.workspaceReviewVisibleCapabilityGated,
  );
  return {
    name: "workspace_review_visible_capability_gated",
    pass: invalid.length === 0,
    detail:
      invalid.length === 0
        ? "all workspace_review_visible fixtures carry capability gate metadata"
        : invalid.map((item) => item.fixtureId).join(","),
  };
}

function checkRedactedExports(
  exports: readonly AskHelmInteractionRedactedExportRecord[],
): AskHelmInteractionOfflineEvalCheck {
  const invalid = exports.filter((record) => !exportRecordIsRedacted(record));
  return {
    name: "redacted_exports_omit_raw_content",
    pass: invalid.length === 0,
    detail:
      invalid.length === 0
        ? `${exports.length} redacted exports contain only allowed fields`
        : invalid.map((item) => item.candidateId).join(","),
  };
}

function checkNoForbiddenAuthorityWording(input: {
  readonly outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[];
  readonly dedupeMergeResult: AskHelmInteractionDedupeMergeResult;
}): AskHelmInteractionOfflineEvalCheck {
  const strings = [
    ...input.outcomes.flatMap((outcome) => [
      outcome.candidate?.boundaryNote,
      outcome.candidate?.nextStep,
      outcome.exportRecord?.boundaryNote,
      outcome.exportRecord?.redactionSummary,
      ...(outcome.thresholdResult?.reasons ?? []),
    ]),
    ...input.dedupeMergeResult.advancementSignalAttachments.map(
      (item) => item.attachmentReason,
    ),
    ...input.dedupeMergeResult.mustPushAttachments.map(
      (item) => item.attachmentReason,
    ),
  ].filter((value): value is string => Boolean(value));
  const invalid = strings.filter(containsForbiddenAuthorityGrantWording);
  return {
    name: "no_forbidden_authority_wording",
    pass: invalid.length === 0,
    detail:
      invalid.length === 0
        ? "no authority-grant wording emitted"
        : invalid.join(" | "),
  };
}

function checkDeterministicReversal(
  originalResult: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionOfflineEvalCheck {
  const reversedOutcomes = [...ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES]
    .reverse()
    .map(evaluateFixture)
    .sort((left, right) => left.fixtureId.localeCompare(right.fixtureId));
  const reversedCandidates = reversedOutcomes.flatMap((outcome) =>
    outcome.candidate ? [outcome.candidate] : [],
  );
  const reversedResult = mergeAndRouteAskHelmInteractionAssets({
    candidates: reversedCandidates,
    existingSignals: EXISTING_SIGNAL_FIXTURES,
    existingMustPushItems: EXISTING_MUST_PUSH_FIXTURES,
  });
  const originalFingerprints = originalResult.mergedCandidates.map(
    (candidate) => candidate.assetFingerprint,
  );
  const reversedFingerprints = reversedResult.mergedCandidates.map(
    (candidate) => candidate.assetFingerprint,
  );
  const pass =
    JSON.stringify(originalFingerprints) === JSON.stringify(reversedFingerprints);
  return {
    name: "deterministic_output_stable_when_input_reversed",
    pass,
    detail: `fingerprints=${originalFingerprints.join(",")}`,
  };
}

function checkSignalAttachment(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionOfflineEvalCheck {
  const attachment = result.advancementSignalAttachments.find(
    (item) => item.signalId === "signal:atlas-repeated-intent",
  );
  const pass =
    attachment?.occurrenceCount === 2 &&
    attachment.candidateIds.includes("AHI-OE-CAND-001") &&
    attachment.candidateIds.includes("AHI-OE-CAND-002");
  return {
    name: "eligible_repeated_intent_attaches_to_existing_signal",
    pass,
    detail: attachment
      ? `occurrenceCount=${attachment.occurrenceCount}; ids=${attachment.candidateIds.join(",")}`
      : "signal attachment missing",
  };
}

function checkMustPushAttachment(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionOfflineEvalCheck {
  const attachment = result.mustPushAttachments.find(
    (item) => item.itemId === "must-push:xinghe-boundary-review",
  );
  const pass =
    attachment?.occurrenceCount === 1 &&
    attachment.candidateIds.includes("AHI-OE-CAND-004");
  return {
    name: "eligible_boundary_hit_attaches_to_existing_must_push",
    pass,
    detail: attachment
      ? `occurrenceCount=${attachment.occurrenceCount}; ids=${attachment.candidateIds.join(",")}`
      : "must-push attachment missing",
  };
}

function checkNoPrivacyViolations(
  violations: readonly string[],
): AskHelmInteractionOfflineEvalCheck {
  return {
    name: "privacy_violation_count_zero",
    pass: violations.length === 0,
    detail:
      violations.length === 0
        ? "privacy validations passed"
        : violations.join(","),
  };
}

function checkNoBoundaryViolations(
  violations: readonly string[],
): AskHelmInteractionOfflineEvalCheck {
  return {
    name: "boundary_violation_count_zero",
    pass: violations.length === 0,
    detail:
      violations.length === 0
        ? "boundary validations passed"
        : violations.join(","),
  };
}

function outcomeStatus(
  outcome: AskHelmInteractionOfflineFixtureOutcome,
): AskHelmInteractionOfflineFixtureExpectedStatus {
  if (
    outcome.privacyDecision === "privacy_rejected" ||
    outcome.privacyDecision === "boundary_rejected"
  ) {
    return "rejected";
  }
  return outcome.thresholdResult?.status === "eligible_candidate"
    ? "eligible_candidate"
    : "watch_only";
}

function outcomeByCategory(
  outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[],
  category: AskHelmInteractionOfflineFixtureCategory,
): AskHelmInteractionOfflineFixtureOutcome | undefined {
  return outcomes.find((outcome) => outcome.category === category);
}

function exportRecordIsRedacted(
  record: AskHelmInteractionRedactedExportRecord,
): boolean {
  const keys = Object.keys(record);
  return (
    FORBIDDEN_EXPORT_FIELD_NAMES.every((fieldName) => !keys.includes(fieldName)) &&
    record.redactionSummary.includes("removed")
  );
}

function containsForbiddenAuthorityGrantWording(value: string): boolean {
  const normalized = value.toLowerCase();
  return FORBIDDEN_AUTHORITY_GRANT_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

function privacyViolationDetails(
  outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[],
): readonly string[] {
  const violations: string[] = [];
  for (const outcome of outcomes) {
    const fixtureInput = ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES.find(
      (item) => item.fixtureId === outcome.fixtureId,
    );
    if (!fixtureInput) {
      violations.push(`${outcome.fixtureId}:fixture_missing`);
      continue;
    }
    if (
      fixtureInput.metadata.rawAudioPresent &&
      outcome.rejectionReason !== "raw_audio_not_allowed"
    ) {
      violations.push(`${outcome.fixtureId}:raw_audio_not_rejected`);
    }
    if (
      fixtureInput.metadata.transcriptState === "unconfirmed" &&
      outcome.rejectionReason !== "unconfirmed_transcript_not_allowed"
    ) {
      violations.push(`${outcome.fixtureId}:unconfirmed_transcript_not_rejected`);
    }
    if (
      outcome.candidate &&
      outcome.candidate.retentionPosture !== "temporary_review_candidate"
    ) {
      violations.push(`${outcome.fixtureId}:candidate_not_temporary`);
    }
    if (
      fixtureInput.metadata.requestedVisibility === "workspace_review_visible" &&
      !fixtureInput.metadata.workspaceReviewVisibleCapabilityGated
    ) {
      violations.push(`${outcome.fixtureId}:workspace_visibility_not_gated`);
    }
    if (outcome.exportRecord && !exportRecordIsRedacted(outcome.exportRecord)) {
      violations.push(`${outcome.fixtureId}:export_not_redacted`);
    }
  }
  return violations;
}

function boundaryViolationDetails(
  outcomes: readonly AskHelmInteractionOfflineFixtureOutcome[],
): readonly string[] {
  const violations: string[] = [];
  for (const outcome of outcomes) {
    const fixtureInput = ASK_HELM_INTERACTION_OFFLINE_EVAL_FIXTURES.find(
      (item) => item.fixtureId === outcome.fixtureId,
    );
    if (!fixtureInput) {
      continue;
    }
    if (
      fixtureInput.metadata.crossWorkspaceAggregationRequested &&
      outcome.rejectionReason !== "cross_workspace_aggregation_not_allowed"
    ) {
      violations.push(`${outcome.fixtureId}:cross_workspace_aggregation_allowed`);
    }
    if (
      fixtureInput.metadata.sourceClassification === "unsupported_open_domain" &&
      fixtureInput.metadata.activeCandidateRequested &&
      outcome.rejectionReason !==
        "unsupported_open_domain_active_candidate_not_allowed"
    ) {
      violations.push(`${outcome.fixtureId}:open_domain_active_allowed`);
    }
    if (
      fixtureInput.metadata.sourceClassification === "cross_workspace" &&
      fixtureInput.metadata.activeCandidateRequested &&
      outcome.rejectionReason !== "cross_workspace_active_candidate_not_allowed"
    ) {
      violations.push(`${outcome.fixtureId}:cross_workspace_active_allowed`);
    }
    if (
      outcome.candidate &&
      containsForbiddenAuthorityGrantWording(
        `${outcome.candidate.boundaryNote} ${outcome.candidate.nextStep}`,
      )
    ) {
      violations.push(`${outcome.fixtureId}:authority_grant_wording`);
    }
  }
  return violations;
}

// Exported for tests that need exact expected category coverage.
export const ASK_HELM_INTERACTION_OFFLINE_EVAL_REQUIRED_CATEGORIES =
  REQUIRED_FIXTURE_CATEGORIES;
