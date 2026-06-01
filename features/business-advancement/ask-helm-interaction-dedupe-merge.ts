/**
 * Helm Business Advancement — Product Phase 3 / Slice 2
 * Ask Helm Interaction Asset Dedupe / Merge Strategy.
 *
 * Planning-only artifact. This file defines pure, deterministic helpers for
 * folding Ask Helm interaction asset candidates and attaching them to existing
 * AdvancementSignal / MustPushItem planning objects when they already cover the
 * same object and posture.
 *
 * It is NOT a runtime extractor, not an API, not a DB reader, not a queue, not
 * a page adapter, and not an execution authority.
 */

import type {
  AdvancementSignal,
  MustPushItem,
  ObjectRef,
  ReviewPosture,
  RiskLevel,
  SignalType,
} from "./contracts";

export const ASK_HELM_INTERACTION_DEDUPE_MERGE_RULE_VERSION =
  "ask-helm-interaction-dedupe-merge/v1";
export const ASK_HELM_INTERACTION_DEDUPE_MERGE_POSTURE = "Planning-Only";
export const ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION = "No-Go";

export type AskHelmInteractionAssetType =
  | "repeated_intent_candidate"
  | "boundary_hit_candidate"
  | "abandoned_high_confidence_candidate"
  | "plan_followthrough_candidate"
  | "review_packet_candidate"
  | "handoff_candidate";

export type AskHelmInteractionVisibility =
  | "user_only"
  | "reviewer_only"
  | "workspace_review_visible";

export type AskHelmInteractionRetentionPosture =
  | "not_persisted"
  | "temporary_review_candidate"
  | "promoted_after_review_only";

export type AskHelmInteractionPromotionTarget =
  | "none"
  | "AdvancementSignal"
  | "MemoryWritebackCandidate"
  | "SkillSuggestionCandidate"
  | "ReviewRequiredAction";

export type AskHelmInteractionCandidateStatus =
  | "captured"
  | "reviewer_queued"
  | "dismissed"
  | "expired"
  | "promoted";

export interface AskHelmInteractionAssetCandidate {
  readonly candidateId: string;
  readonly workspaceId: string;
  readonly actorScope: string;
  readonly sourceTurnRef: string;
  readonly intentType: string;
  readonly assetType: AskHelmInteractionAssetType;
  readonly objectRefs: readonly ObjectRef[];
  readonly evidenceRefs: readonly string[];
  readonly answerSummary: string;
  readonly nextStep: string;
  readonly boundaryNote: string;
  readonly captureReason: string;
  readonly reviewPosture: ReviewPosture;
  readonly visibility: AskHelmInteractionVisibility;
  readonly retentionPosture: AskHelmInteractionRetentionPosture;
  readonly promotionTarget: AskHelmInteractionPromotionTarget;
  readonly capturedAt: string;
  readonly riskLevel: RiskLevel;
  readonly status: AskHelmInteractionCandidateStatus;
}

export interface InteractionAssetSupportingInteraction {
  readonly candidateId: string;
  readonly sourceTurnRef: string;
  readonly capturedAt: string;
  readonly evidenceRefs: readonly string[];
  readonly boundaryNote: string;
}

export interface MergedAskHelmInteractionAssetCandidate
  extends AskHelmInteractionAssetCandidate {
  readonly assetFingerprint: string;
  readonly occurrenceCount: number;
  readonly firstCapturedAt: string;
  readonly lastSeenAt: string;
  readonly foldedCandidateIds: readonly string[];
  readonly supportingInteractions: readonly InteractionAssetSupportingInteraction[];
}

export interface ExistingMustPushPlanningItem {
  readonly item: MustPushItem;
  readonly workspaceId: string;
  readonly objectRef: ObjectRef;
  readonly linkedSignalType?: SignalType;
}

export interface ExistingAdvancementSignalPlanningItem {
  readonly workspaceId: string;
  readonly signal: AdvancementSignal;
}

export interface AdvancementSignalEvidenceAttachment {
  readonly assetFingerprint: string;
  readonly signalId: string;
  readonly candidateIds: readonly string[];
  readonly occurrenceCount: number;
  readonly evidenceRefs: readonly string[];
  readonly boundaryNote: string;
  readonly attachmentReason: string;
}

export interface MustPushEvidenceAttachment {
  readonly assetFingerprint: string;
  readonly itemId: string;
  readonly candidateIds: readonly string[];
  readonly occurrenceCount: number;
  readonly evidenceRefs: readonly string[];
  readonly boundaryNote: string;
  readonly attachmentReason: string;
}

export interface AskHelmInteractionDedupeMergeResult {
  readonly ruleVersion: string;
  readonly runtimeAdoption: typeof ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION;
  readonly mergedCandidates: readonly MergedAskHelmInteractionAssetCandidate[];
  readonly newReviewableCandidates: readonly MergedAskHelmInteractionAssetCandidate[];
  readonly advancementSignalAttachments: readonly AdvancementSignalEvidenceAttachment[];
  readonly mustPushAttachments: readonly MustPushEvidenceAttachment[];
}

export interface AskHelmInteractionDedupeMergeInput {
  readonly candidates: readonly AskHelmInteractionAssetCandidate[];
  readonly existingSignals?: readonly ExistingAdvancementSignalPlanningItem[];
  readonly existingMustPushItems?: readonly ExistingMustPushPlanningItem[];
}

const SIGNAL_TYPE_BY_ASSET_TYPE: Partial<
  Record<AskHelmInteractionAssetType, SignalType>
> = {
  repeated_intent_candidate: "repeated_intent",
  boundary_hit_candidate: "boundary_hit",
  abandoned_high_confidence_candidate: "abandoned_high_confidence_answer",
};

const RISK_STRICTNESS: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const REVIEW_POSTURE_STRICTNESS: Record<ReviewPosture, number> = {
  read_only: 0,
  review_required: 1,
  human_owner_required: 2,
  blocked: 3,
};

const FORBIDDEN_AUTHORITY_PATTERNS = [
  "official write allowed",
  "auto execute",
  "auto-execute",
  "auto send",
  "auto-send",
  "auto approve",
  "auto-approve",
  "bypass guard",
  "skip review",
  "grant authority",
  "formal skill promoted",
] as const;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeObjectRefs(objectRefs: readonly ObjectRef[]): string {
  if (objectRefs.length === 0) {
    return "object:none";
  }

  return [...objectRefs]
    .map((ref) => `${normalizeToken(ref.objectType)}:${normalizeToken(ref.objectId)}`)
    .sort()
    .join(",");
}

function dayBucketFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "day:invalid";
  }
  return date.toISOString().slice(0, 10);
}

export function buildAskHelmInteractionAssetFingerprint(
  candidate: AskHelmInteractionAssetCandidate,
): string {
  return [
    `workspace:${normalizeToken(candidate.workspaceId)}`,
    `actor:${normalizeToken(candidate.actorScope)}`,
    `intent:${normalizeToken(candidate.intentType)}`,
    normalizeObjectRefs(candidate.objectRefs),
    `reason:${normalizeToken(candidate.captureReason)}`,
    `day:${dayBucketFromIso(candidate.capturedAt)}`,
  ].join("|");
}

export function mergeAskHelmInteractionAssetCandidates(
  candidates: readonly AskHelmInteractionAssetCandidate[],
): readonly MergedAskHelmInteractionAssetCandidate[] {
  const groups = new Map<string, AskHelmInteractionAssetCandidate[]>();

  for (const candidate of candidates) {
    const fingerprint = buildAskHelmInteractionAssetFingerprint(candidate);
    const existing = groups.get(fingerprint);
    if (existing) {
      existing.push(candidate);
    } else {
      groups.set(fingerprint, [candidate]);
    }
  }

  return [...groups.entries()]
    .map(([assetFingerprint, grouped]) =>
      mergeCandidateGroup(assetFingerprint, grouped),
    )
    .sort((left, right) => left.assetFingerprint.localeCompare(right.assetFingerprint));
}

export function mergeAndRouteAskHelmInteractionAssets(
  input: AskHelmInteractionDedupeMergeInput,
): AskHelmInteractionDedupeMergeResult {
  const mergedCandidates = mergeAskHelmInteractionAssetCandidates(input.candidates);
  const advancementSignalAttachments: AdvancementSignalEvidenceAttachment[] = [];
  const mustPushAttachments: MustPushEvidenceAttachment[] = [];
  const newReviewableCandidates: MergedAskHelmInteractionAssetCandidate[] = [];

  for (const candidate of mergedCandidates) {
    const signal = findMatchingAdvancementSignal(
      candidate,
      input.existingSignals ?? [],
    );
    const mustPushItem = findMatchingMustPushItem(
      candidate,
      input.existingMustPushItems ?? [],
    );

    if (signal) {
      advancementSignalAttachments.push({
        assetFingerprint: candidate.assetFingerprint,
        signalId: signal.signal.signalId,
        candidateIds: candidate.foldedCandidateIds,
        occurrenceCount: candidate.occurrenceCount,
        evidenceRefs: candidate.evidenceRefs,
        boundaryNote: candidate.boundaryNote,
        attachmentReason:
          "Ask Helm candidate maps to an existing AdvancementSignal and must attach as evidence instead of creating a duplicate active signal.",
      });
    }

    if (mustPushItem) {
      mustPushAttachments.push({
        assetFingerprint: candidate.assetFingerprint,
        itemId: mustPushItem.item.itemId,
        candidateIds: candidate.foldedCandidateIds,
        occurrenceCount: candidate.occurrenceCount,
        evidenceRefs: candidate.evidenceRefs,
        boundaryNote: candidate.boundaryNote,
        attachmentReason:
          "Ask Helm candidate is already covered by an existing MustPushItem and must attach as supporting evidence without changing active/deferred status.",
      });
    }

    if (!signal && !mustPushItem && candidate.retentionPosture !== "not_persisted") {
      newReviewableCandidates.push(candidate);
    }
  }

  return {
    ruleVersion: ASK_HELM_INTERACTION_DEDUPE_MERGE_RULE_VERSION,
    runtimeAdoption: ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION,
    mergedCandidates,
    newReviewableCandidates,
    advancementSignalAttachments,
    mustPushAttachments,
  };
}

function mergeCandidateGroup(
  assetFingerprint: string,
  candidates: readonly AskHelmInteractionAssetCandidate[],
): MergedAskHelmInteractionAssetCandidate {
  const sorted = [...candidates].sort(compareCandidateChronology);
  const strictest = [...candidates].sort(compareCandidateStrictness)[0] ?? sorted[0];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return {
    ...strictest,
    assetFingerprint,
    occurrenceCount: candidates.length,
    firstCapturedAt: first.capturedAt,
    lastSeenAt: last.capturedAt,
    foldedCandidateIds: sorted.map((candidate) => candidate.candidateId),
    evidenceRefs: uniqueStable(candidates.flatMap((candidate) => candidate.evidenceRefs)),
    objectRefs: mergeObjectRefs(candidates.flatMap((candidate) => candidate.objectRefs)),
    supportingInteractions: sorted.map((candidate) => ({
      candidateId: candidate.candidateId,
      sourceTurnRef: candidate.sourceTurnRef,
      capturedAt: candidate.capturedAt,
      evidenceRefs: candidate.evidenceRefs,
      boundaryNote: candidate.boundaryNote,
    })),
  };
}

function compareCandidateChronology(
  left: AskHelmInteractionAssetCandidate,
  right: AskHelmInteractionAssetCandidate,
): number {
  return (
    Date.parse(left.capturedAt) - Date.parse(right.capturedAt) ||
    left.candidateId.localeCompare(right.candidateId)
  );
}

function compareCandidateStrictness(
  left: AskHelmInteractionAssetCandidate,
  right: AskHelmInteractionAssetCandidate,
): number {
  return (
    REVIEW_POSTURE_STRICTNESS[right.reviewPosture] -
      REVIEW_POSTURE_STRICTNESS[left.reviewPosture] ||
    RISK_STRICTNESS[right.riskLevel] - RISK_STRICTNESS[left.riskLevel] ||
    right.boundaryNote.length - left.boundaryNote.length ||
    left.candidateId.localeCompare(right.candidateId)
  );
}

function uniqueStable(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function mergeObjectRefs(objectRefs: readonly ObjectRef[]): readonly ObjectRef[] {
  const byKey = new Map<string, ObjectRef>();
  for (const ref of objectRefs) {
    const key = `${normalizeToken(ref.objectType)}:${normalizeToken(ref.objectId)}`;
    if (!byKey.has(key)) {
      byKey.set(key, ref);
    }
  }
  return [...byKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, ref]) => ref);
}

function findMatchingAdvancementSignal(
  candidate: MergedAskHelmInteractionAssetCandidate,
  signals: readonly ExistingAdvancementSignalPlanningItem[],
): ExistingAdvancementSignalPlanningItem | undefined {
  const mappedSignalType = SIGNAL_TYPE_BY_ASSET_TYPE[candidate.assetType];
  if (!mappedSignalType) {
    return undefined;
  }

  return signals.find((entry) => {
    return (
      normalizeToken(entry.workspaceId) === normalizeToken(candidate.workspaceId) &&
      entry.signal.signalType === mappedSignalType &&
      candidate.objectRefs.some((ref) =>
        objectRefsMatch(ref, entry.signal.objectRef),
      )
    );
  });
}

function findMatchingMustPushItem(
  candidate: MergedAskHelmInteractionAssetCandidate,
  items: readonly ExistingMustPushPlanningItem[],
): ExistingMustPushPlanningItem | undefined {
  const mappedSignalType = SIGNAL_TYPE_BY_ASSET_TYPE[candidate.assetType];

  return items.find((entry) => {
    const signalMatches =
      !entry.linkedSignalType ||
      !mappedSignalType ||
      entry.linkedSignalType === mappedSignalType;
    return (
      normalizeToken(entry.workspaceId) === normalizeToken(candidate.workspaceId) &&
      signalMatches &&
      entry.item.reviewPosture === candidate.reviewPosture &&
      candidate.objectRefs.some((ref) => objectRefsMatch(ref, entry.objectRef))
    );
  });
}

function objectRefsMatch(left: ObjectRef, right: ObjectRef): boolean {
  return (
    normalizeToken(left.objectType) === normalizeToken(right.objectType) &&
    normalizeToken(left.objectId) === normalizeToken(right.objectId)
  );
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

function candidate(
  input: Partial<AskHelmInteractionAssetCandidate> &
    Pick<
      AskHelmInteractionAssetCandidate,
      | "candidateId"
      | "workspaceId"
      | "sourceTurnRef"
      | "intentType"
      | "assetType"
      | "objectRefs"
      | "captureReason"
      | "reviewPosture"
      | "capturedAt"
      | "riskLevel"
    >,
): AskHelmInteractionAssetCandidate {
  return {
    actorScope: "user:synthetic-operator",
    evidenceRefs: [`evidence:${input.candidateId}`],
    answerSummary: "Synthetic Ask Helm answer summary.",
    nextStep: "Open review surface.",
    boundaryNote: "review required; no official write; no auto execution.",
    visibility: "user_only",
    retentionPosture: "temporary_review_candidate",
    promotionTarget: "ReviewRequiredAction",
    status: "captured",
    ...input,
  };
}

export const ASK_HELM_INTERACTION_DEDUPE_FIXTURES: readonly AskHelmInteractionAssetCandidate[] =
  [
    candidate({
      candidateId: "AHI-DM-001",
      workspaceId: "workspace-alpha",
      sourceTurnRef: "turn-001",
      intentType: "today_priority",
      assetType: "repeated_intent_candidate",
      objectRefs: [atlasOpportunityRef],
      captureReason: "repeated_today_priority",
      reviewPosture: "review_required",
      capturedAt: "2026-04-27T02:00:00.000Z",
      riskLevel: "medium",
      promotionTarget: "AdvancementSignal",
    }),
    candidate({
      candidateId: "AHI-DM-002",
      workspaceId: "workspace-alpha",
      sourceTurnRef: "turn-002",
      intentType: "today_priority",
      assetType: "repeated_intent_candidate",
      objectRefs: [atlasOpportunityRef],
      captureReason: "repeated_today_priority",
      reviewPosture: "review_required",
      capturedAt: "2026-04-27T05:00:00.000Z",
      riskLevel: "high",
      promotionTarget: "AdvancementSignal",
      boundaryNote:
        "review required; no official write; repeated intent must attach as evidence, not create duplicate Must Push.",
    }),
    candidate({
      candidateId: "AHI-DM-003",
      workspaceId: "workspace-beta",
      sourceTurnRef: "turn-003",
      intentType: "today_priority",
      assetType: "repeated_intent_candidate",
      objectRefs: [atlasOpportunityRef],
      captureReason: "repeated_today_priority",
      reviewPosture: "review_required",
      capturedAt: "2026-04-27T05:30:00.000Z",
      riskLevel: "medium",
      promotionTarget: "AdvancementSignal",
    }),
    candidate({
      candidateId: "AHI-DM-004",
      workspaceId: "workspace-alpha",
      sourceTurnRef: "turn-004",
      intentType: "review_required_execution",
      assetType: "boundary_hit_candidate",
      objectRefs: [xingheCompanyRef],
      captureReason: "review_required_boundary_hit",
      reviewPosture: "human_owner_required",
      capturedAt: "2026-04-27T06:00:00.000Z",
      riskLevel: "high",
      promotionTarget: "ReviewRequiredAction",
      boundaryNote:
        "boundary hit requires human review; no send, no approval, no payment, no official write, no guard bypass.",
    }),
    candidate({
      candidateId: "AHI-DM-005",
      workspaceId: "workspace-alpha",
      sourceTurnRef: "turn-005",
      intentType: "review_required_execution",
      assetType: "boundary_hit_candidate",
      objectRefs: [xingheCompanyRef],
      captureReason: "review_required_boundary_hit",
      reviewPosture: "human_owner_required",
      capturedAt: "2026-04-27T06:20:00.000Z",
      riskLevel: "high",
      promotionTarget: "ReviewRequiredAction",
      boundaryNote:
        "boundary hit requires human review; product friction evidence only; no guard bypass.",
    }),
    candidate({
      candidateId: "AHI-DM-006",
      workspaceId: "workspace-alpha",
      sourceTurnRef: "turn-006",
      intentType: "plan_breakdown",
      assetType: "plan_followthrough_candidate",
      objectRefs: [northstarMeetingRef],
      captureReason: "plan_generated_with_steps",
      reviewPosture: "review_required",
      capturedAt: "2026-04-28T02:00:00.000Z",
      riskLevel: "medium",
      promotionTarget: "MemoryWritebackCandidate",
    }),
  ] as const;

export const EXISTING_ADVANCEMENT_SIGNAL_DEDUPE_FIXTURES: readonly ExistingAdvancementSignalPlanningItem[] =
  [
    {
      workspaceId: "workspace-alpha",
      signal: {
        signalId: "signal-existing-atlas-repeated-intent",
        sourceType: "ask_helm",
        signalType: "repeated_intent",
        objectRef: atlasOpportunityRef,
        evidenceRefs: ["existing-evidence:atlas"],
        sourceScenario: "Synthetic Atlas renewal repeated Ask Helm intent.",
        detectedAt: "2026-04-27T01:00:00.000Z",
      },
    },
  ] as const;

export const EXISTING_MUST_PUSH_DEDUPE_FIXTURES: readonly ExistingMustPushPlanningItem[] =
  [
    {
      workspaceId: "workspace-alpha",
      objectRef: xingheCompanyRef,
      linkedSignalType: "boundary_hit",
      item: {
        itemId: "must-push:existing-xinghe-boundary-hit",
        title: "星河连锁 execution request needs review",
        reason: "Synthetic boundary hit already covered by an active item.",
        evidenceRefs: ["existing-evidence:xinghe"],
        primaryAction: "Open review surface",
        boundaryNote: "Review required; no official write.",
        reviewPosture: "human_owner_required",
        sourceSummary: "Synthetic existing Must Push item.",
        riskLevel: "high",
        sortKey: 10,
      },
    },
  ] as const;

export interface AskHelmInteractionDedupeMergeCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface AskHelmInteractionDedupeMergeEvalSummary {
  readonly ruleVersion: string;
  readonly runtimeAdoption: typeof ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION;
  readonly checks: readonly AskHelmInteractionDedupeMergeCheck[];
  readonly mergedCandidateCount: number;
  readonly newReviewableCandidateCount: number;
  readonly signalAttachmentCount: number;
  readonly mustPushAttachmentCount: number;
  readonly allPass: boolean;
}

export function evaluateAskHelmInteractionDedupeMergeStrategy(): AskHelmInteractionDedupeMergeEvalSummary {
  const result = mergeAndRouteAskHelmInteractionAssets({
    candidates: ASK_HELM_INTERACTION_DEDUPE_FIXTURES,
    existingSignals: EXISTING_ADVANCEMENT_SIGNAL_DEDUPE_FIXTURES,
    existingMustPushItems: EXISTING_MUST_PUSH_DEDUPE_FIXTURES,
  });

  const checks: AskHelmInteractionDedupeMergeCheck[] = [
    checkRuleVersion(),
    checkRuntimeAdoptionNoGo(result),
    checkDuplicateRepeatedIntentFolded(result),
    checkCrossWorkspaceNotMerged(result),
    checkExistingSignalAttachment(result),
    checkExistingMustPushAttachment(result),
    checkBoundaryHitNoAuthority(result),
    checkStrictestRiskAndBoundaryPreserved(result),
    checkPlanCandidateRemainsReviewable(result),
    checkDeterministicReversal(),
    checkNoForbiddenAuthorityWording(result),
    checkAllMergedCandidatesRemainReviewFirst(result),
  ];

  return {
    ruleVersion: ASK_HELM_INTERACTION_DEDUPE_MERGE_RULE_VERSION,
    runtimeAdoption: ASK_HELM_INTERACTION_DEDUPE_MERGE_RUNTIME_ADOPTION,
    checks,
    mergedCandidateCount: result.mergedCandidates.length,
    newReviewableCandidateCount: result.newReviewableCandidates.length,
    signalAttachmentCount: result.advancementSignalAttachments.length,
    mustPushAttachmentCount: result.mustPushAttachments.length,
    allPass: checks.every((check) => check.pass),
  };
}

function checkRuleVersion(): AskHelmInteractionDedupeMergeCheck {
  const pass =
    ASK_HELM_INTERACTION_DEDUPE_MERGE_RULE_VERSION ===
    "ask-helm-interaction-dedupe-merge/v1";
  return {
    name: "rule_version_is_v1",
    pass,
    detail: ASK_HELM_INTERACTION_DEDUPE_MERGE_RULE_VERSION,
  };
}

function checkRuntimeAdoptionNoGo(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionDedupeMergeCheck {
  const pass = result.runtimeAdoption === "No-Go";
  return {
    name: "runtime_adoption_is_no_go",
    pass,
    detail: `runtimeAdoption=${result.runtimeAdoption}`,
  };
}

function checkDuplicateRepeatedIntentFolded(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionDedupeMergeCheck {
  const folded = result.mergedCandidates.find((candidate) =>
    candidate.foldedCandidateIds.includes("AHI-DM-001"),
  );
  const pass =
    folded?.occurrenceCount === 2 &&
    folded.foldedCandidateIds.includes("AHI-DM-002");
  return {
    name: "duplicate_repeated_intent_folded_by_fingerprint",
    pass,
    detail: folded
      ? `occurrenceCount=${folded.occurrenceCount}; ids=${folded.foldedCandidateIds.join(",")}`
      : "folded repeated intent candidate not found",
  };
}

function checkCrossWorkspaceNotMerged(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionDedupeMergeCheck {
  const beta = result.mergedCandidates.find((candidate) =>
    candidate.foldedCandidateIds.includes("AHI-DM-003"),
  );
  const pass =
    beta?.workspaceId === "workspace-beta" && beta.occurrenceCount === 1;
  return {
    name: "cross_workspace_candidate_not_merged",
    pass,
    detail: beta
      ? `workspaceId=${beta.workspaceId}; occurrenceCount=${beta.occurrenceCount}`
      : "workspace-beta candidate not found",
  };
}

function checkExistingSignalAttachment(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionDedupeMergeCheck {
  const attachment = result.advancementSignalAttachments.find(
    (item) => item.signalId === "signal-existing-atlas-repeated-intent",
  );
  const pass =
    Boolean(attachment) &&
    attachment?.candidateIds.includes("AHI-DM-001") === true &&
    attachment?.candidateIds.includes("AHI-DM-002") === true &&
    !result.newReviewableCandidates.some((candidate) =>
      candidate.foldedCandidateIds.includes("AHI-DM-001"),
    );
  return {
    name: "existing_advancement_signal_receives_evidence_attachment",
    pass,
    detail: attachment
      ? `signalId=${attachment.signalId}; candidateIds=${attachment.candidateIds.join(",")}`
      : "signal attachment not found",
  };
}

function checkExistingMustPushAttachment(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionDedupeMergeCheck {
  const attachment = result.mustPushAttachments.find(
    (item) => item.itemId === "must-push:existing-xinghe-boundary-hit",
  );
  const pass =
    Boolean(attachment) &&
    attachment?.candidateIds.includes("AHI-DM-004") === true &&
    attachment?.candidateIds.includes("AHI-DM-005") === true &&
    !result.newReviewableCandidates.some((candidate) =>
      candidate.foldedCandidateIds.includes("AHI-DM-004"),
    );
  return {
    name: "existing_must_push_receives_supporting_evidence",
    pass,
    detail: attachment
      ? `itemId=${attachment.itemId}; candidateIds=${attachment.candidateIds.join(",")}`
      : "must-push attachment not found",
  };
}

function checkBoundaryHitNoAuthority(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionDedupeMergeCheck {
  const boundary = result.mergedCandidates.find((candidate) =>
    candidate.foldedCandidateIds.includes("AHI-DM-004"),
  );
  const lower = boundary?.boundaryNote.toLowerCase() ?? "";
  const pass =
    boundary?.assetType === "boundary_hit_candidate" &&
    lower.includes("no official write") &&
    lower.includes("no guard bypass");
  return {
    name: "boundary_hit_stays_review_reason_not_authority",
    pass,
    detail: boundary?.boundaryNote ?? "boundary candidate not found",
  };
}

function checkStrictestRiskAndBoundaryPreserved(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionDedupeMergeCheck {
  const folded = result.mergedCandidates.find((candidate) =>
    candidate.foldedCandidateIds.includes("AHI-DM-001"),
  );
  const pass =
    folded?.riskLevel === "high" &&
    folded.boundaryNote.includes("not create duplicate Must Push") &&
    folded.firstCapturedAt === "2026-04-27T02:00:00.000Z" &&
    folded.lastSeenAt === "2026-04-27T05:00:00.000Z";
  return {
    name: "strictest_risk_boundary_and_seen_timestamps_preserved",
    pass,
    detail: folded
      ? `risk=${folded.riskLevel}; first=${folded.firstCapturedAt}; last=${folded.lastSeenAt}`
      : "folded candidate not found",
  };
}

function checkPlanCandidateRemainsReviewable(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionDedupeMergeCheck {
  const plan = result.newReviewableCandidates.find((candidate) =>
    candidate.foldedCandidateIds.includes("AHI-DM-006"),
  );
  const pass =
    plan?.assetType === "plan_followthrough_candidate" &&
    plan.promotionTarget === "MemoryWritebackCandidate" &&
    plan.retentionPosture === "temporary_review_candidate";
  return {
    name: "unmatched_plan_candidate_remains_reviewable",
    pass,
    detail: plan
      ? `promotionTarget=${plan.promotionTarget}; retention=${plan.retentionPosture}`
      : "plan candidate not found in newReviewableCandidates",
  };
}

function checkDeterministicReversal(): AskHelmInteractionDedupeMergeCheck {
  const forward = mergeAndRouteAskHelmInteractionAssets({
    candidates: ASK_HELM_INTERACTION_DEDUPE_FIXTURES,
    existingSignals: EXISTING_ADVANCEMENT_SIGNAL_DEDUPE_FIXTURES,
    existingMustPushItems: EXISTING_MUST_PUSH_DEDUPE_FIXTURES,
  });
  const reversed = mergeAndRouteAskHelmInteractionAssets({
    candidates: [...ASK_HELM_INTERACTION_DEDUPE_FIXTURES].reverse(),
    existingSignals: EXISTING_ADVANCEMENT_SIGNAL_DEDUPE_FIXTURES,
    existingMustPushItems: EXISTING_MUST_PUSH_DEDUPE_FIXTURES,
  });
  const forwardFingerprints = forward.mergedCandidates
    .map((candidate) => candidate.assetFingerprint)
    .join("\n");
  const reversedFingerprints = reversed.mergedCandidates
    .map((candidate) => candidate.assetFingerprint)
    .join("\n");
  const pass = forwardFingerprints === reversedFingerprints;
  return {
    name: "fingerprint_output_stable_when_input_reversed",
    pass,
    detail: pass ? "fingerprints stable" : "fingerprints differ when reversed",
  };
}

function checkNoForbiddenAuthorityWording(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionDedupeMergeCheck {
  const violations: string[] = [];
  for (const candidate of result.mergedCandidates) {
    const fields = [
      candidate.boundaryNote,
      candidate.answerSummary,
      candidate.nextStep,
      ...candidate.supportingInteractions.map((item) => item.boundaryNote),
    ];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORITY_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(`${candidate.candidateId}: ${pattern}`);
        }
      }
    }
  }

  return {
    name: "no_forbidden_authority_wording",
    pass: violations.length === 0,
    detail:
      violations.length === 0
        ? "No merged candidate grants authority or bypasses review."
        : violations.join("; "),
  };
}

function checkAllMergedCandidatesRemainReviewFirst(
  result: AskHelmInteractionDedupeMergeResult,
): AskHelmInteractionDedupeMergeCheck {
  const violations = result.mergedCandidates.filter(
    (candidate) =>
      candidate.promotionTarget === "none" ||
      candidate.status === "promoted" ||
      candidate.retentionPosture === "promoted_after_review_only",
  );
  return {
    name: "merged_candidates_remain_review_first_candidates",
    pass: violations.length === 0,
    detail:
      violations.length === 0
        ? "All merged fixture candidates remain temporary review candidates with explicit promotion target."
        : `Unexpected non-review-first candidates: ${violations
            .map((candidate) => candidate.candidateId)
            .join(", ")}`,
  };
}
