/**
 * Sales Process Signal mappers — pure, structurally typed (no Prisma import).
 *
 * Maps existing extraction products (ConversationInsight rows and meeting
 * memory drafts) into alias-only SalesProcessSignals. Discipline:
 * - statement comes from the short `title` only; LongText `content` never
 *   enters a signal (it stays behind evidenceRefs for human review)
 * - source types that do not clearly fit the closed signal-type set are
 *   SKIPPED with an explicit reason, never force-classified
 * - any hygiene violation suppresses the signal (fail-closed)
 */

import {
  SALES_PROCESS_SIGNAL_CONTRACT_VERSION,
  auditSalesProcessSignalHygiene,
  type SalesProcessSignal,
  type SalesProcessSignalAliases,
  type SalesProcessSignalHygieneViolation,
  type SalesProcessSignalType,
} from "./contract";

export type ConversationInsightTypeLike =
  | "FACT"
  | "COMMITMENT"
  | "BLOCKER"
  | "RISK"
  | "NEXT_ACTION";

export interface ConversationInsightLike {
  readonly id: string;
  readonly insightType: ConversationInsightTypeLike;
  readonly title: string;
  readonly confidence: number;
  readonly sourceSegmentRefs?: string | null;
}

export type MeetingMemoryFactTypeLike =
  | "RELATIONSHIP"
  | "PREFERENCE"
  | "OBJECTION"
  | "BLOCKER"
  | "COMMITMENT"
  | "NEXT_STEP"
  | "STAGE_SIGNAL"
  | "RISK_SIGNAL"
  | "SUMMARY"
  | "POLICY_PATTERN"
  | "ACTION_PATTERN";

export interface MeetingMemoryDraftLike {
  readonly draftId: string;
  readonly factType: MeetingMemoryFactTypeLike;
  readonly title: string;
  readonly confidence: number;
  readonly meetingRef?: string | null;
}

export interface SalesProcessSignalMapContext {
  readonly aliases: SalesProcessSignalAliases;
}

export type SalesProcessSignalSkipReason =
  | "insight_type_not_classifiable"
  | "fact_type_not_classifiable"
  | "hygiene_violation";

export interface SalesProcessSignalMapResult {
  readonly signal: SalesProcessSignal | null;
  readonly skippedReason?: SalesProcessSignalSkipReason;
  readonly hygieneViolations?: readonly SalesProcessSignalHygieneViolation[];
}

const INSIGHT_TYPE_TO_SIGNAL_TYPE: Partial<
  Record<ConversationInsightTypeLike, SalesProcessSignalType>
> = {
  COMMITMENT: "commitment",
  BLOCKER: "risk_signal",
  RISK: "risk_signal",
  NEXT_ACTION: "follow_up_window",
  // FACT is deliberately unmapped: a generic fact is not a sales-process
  // signal; forcing it into the closed set would fabricate classification.
};

const FACT_TYPE_TO_SIGNAL_TYPE: Partial<
  Record<MeetingMemoryFactTypeLike, SalesProcessSignalType>
> = {
  OBJECTION: "objection",
  BLOCKER: "risk_signal",
  COMMITMENT: "commitment",
  NEXT_STEP: "follow_up_window",
  RISK_SIGNAL: "risk_signal",
  STAGE_SIGNAL: "deal_outcome_reason",
  // RELATIONSHIP / PREFERENCE / SUMMARY / POLICY_PATTERN / ACTION_PATTERN are
  // deliberately unmapped for the same fail-closed reason as FACT above.
};

function parseSegmentRefs(raw: string | null | undefined): readonly string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Not JSON — treat the opaque value as a single reference.
  }
  return [raw];
}

function finalize(
  signal: SalesProcessSignal,
): SalesProcessSignalMapResult {
  const hygieneViolations = auditSalesProcessSignalHygiene(signal);
  if (hygieneViolations.length > 0) {
    return { signal: null, skippedReason: "hygiene_violation", hygieneViolations };
  }
  return { signal };
}

export function mapConversationInsightToSalesProcessSignal(
  insight: ConversationInsightLike,
  context: SalesProcessSignalMapContext,
): SalesProcessSignalMapResult {
  const signalType = INSIGHT_TYPE_TO_SIGNAL_TYPE[insight.insightType];
  if (!signalType) {
    return { signal: null, skippedReason: "insight_type_not_classifiable" };
  }

  return finalize({
    contractVersion: SALES_PROCESS_SIGNAL_CONTRACT_VERSION,
    signalId: `sps-ci-${insight.id}`,
    signalType,
    statement: insight.title.trim(),
    sourceKind: "conversation_insight",
    sourceRef: `conversation_insight:${insight.id}`,
    evidenceRefs: parseSegmentRefs(insight.sourceSegmentRefs),
    aliases: context.aliases,
    confidence: insight.confidence,
    reviewPosture: "review_required",
    dataShape: "alias_only",
    rawPayloadIncluded: false,
    transcriptIncluded: false,
    audioIncluded: false,
  });
}

export function mapMeetingMemoryDraftToSalesProcessSignal(
  draft: MeetingMemoryDraftLike,
  context: SalesProcessSignalMapContext,
): SalesProcessSignalMapResult {
  const signalType = FACT_TYPE_TO_SIGNAL_TYPE[draft.factType];
  if (!signalType) {
    return { signal: null, skippedReason: "fact_type_not_classifiable" };
  }

  return finalize({
    contractVersion: SALES_PROCESS_SIGNAL_CONTRACT_VERSION,
    signalId: `sps-mm-${draft.draftId}`,
    signalType,
    statement: draft.title.trim(),
    sourceKind: "meeting_memory_draft",
    sourceRef: `meeting_memory_draft:${draft.draftId}`,
    evidenceRefs: draft.meetingRef ? [draft.meetingRef] : [],
    aliases: context.aliases,
    confidence: draft.confidence,
    reviewPosture: "review_required",
    dataShape: "alias_only",
    rawPayloadIncluded: false,
    transcriptIncluded: false,
    audioIncluded: false,
  });
}
