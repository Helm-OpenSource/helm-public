import { MemoryStatus, ObjectType } from "@prisma/client";
import { db } from "@/lib/db";
import {
  buildMemoryFactRetrievalPack,
  type MemoryFactForRetrievalPack,
  type MemoryRetrievalPackSurfaceTrace,
} from "@/lib/memory/retrieval-pack-adapter";
import {
  buildMemoryWriteFailureOperatorQueue,
  type MemoryWriteFailureOperatorQueueOverview,
} from "@/lib/memory/write-failure-operator-queue";
import {
  buildMemoryWriteRetryContract,
  type MemoryWriteRetryContractOverview,
} from "@/lib/memory/write-failure-retry-contract";
import {
  buildMemoryWriteRetryReceiptLedger,
  MEMORY_WRITE_RETRY_RECEIPT_AUDIT_ACTION,
  type MemoryWriteRetryOwnerAssignment,
  type MemoryWriteRetryReceiptAudit,
  type MemoryWriteRetryReceiptLedgerOverview,
} from "@/lib/memory/write-retry-receipt-ledger";
import {
  buildMemoryWriteRetryAttemptLedger,
  MEMORY_WRITE_RETRY_ATTEMPT_AUDIT_ACTION,
  type MemoryWriteRetryAttemptAudit,
  type MemoryWriteRetryAttemptLedgerOverview,
} from "@/lib/memory/write-retry-attempt-ledger";
import { safeParseJson } from "@/lib/utils";

const MEMORY_SELECTION_SCORE_THRESHOLD = 120;
const MEMORY_STALE_FRESHNESS_THRESHOLD = 35;
const MEMORY_LOW_CONFIDENCE_THRESHOLD = 45;
const MEMORY_WRITE_FAILURE_AUDIT_SAMPLE_LIMIT = 50;

const BRIEFING_TASK_TYPES = new Set([
  "CONTACT_BRIEFING",
  "COMPANY_BRIEFING",
  "OPPORTUNITY_BRIEFING",
  "MEETING_BRIEFING",
]);

type MemoryLlmCallSummary = {
  totalCalls: number;
  fallbackCount: number;
  averageLatencyMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  fallbackBreakdown: Array<{
    reason: string;
    count: number;
  }>;
};

function summarizeCalls(
  logs: Array<{
    success: boolean;
    latencyMs: number | null;
    tokenUsagePrompt: number | null;
    tokenUsageCompletion: number | null;
    fallbackReason?: string | null;
  }>,
): MemoryLlmCallSummary {
  const successful = logs.filter((item) => item.success);
  const fallbackBreakdown = Array.from(
    logs
      .filter((item) => !item.success)
      .reduce((acc, item) => {
        const reason = item.fallbackReason?.trim() || "unspecified";
        acc.set(reason, (acc.get(reason) ?? 0) + 1);
        return acc;
      }, new Map<string, number>()),
  )
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count);

  return {
    totalCalls: logs.length,
    fallbackCount: logs.length - successful.length,
    averageLatencyMs: successful.length
      ? Math.round(successful.reduce((sum, item) => sum + (item.latencyMs ?? 0), 0) / successful.length)
      : 0,
    totalPromptTokens: logs.reduce((sum, item) => sum + (item.tokenUsagePrompt ?? 0), 0),
    totalCompletionTokens: logs.reduce((sum, item) => sum + (item.tokenUsageCompletion ?? 0), 0),
    fallbackBreakdown,
  };
}

export type MemoryRetrievalBaselineFact = {
  id: string;
  objectType: string;
  objectId: string;
  factType: string;
  title: string;
  content: string;
  normalizedValue: string | null;
  sourceType: string;
  sourceId: string;
  confidence: number;
  importance: number;
  freshnessScore: number;
  status: MemoryStatus | string;
  confirmedByUser: boolean;
  updatedAt: Date;
};

export type MemoryRetrievalBaseline = {
  totalCandidateCount: number;
  selectedCandidateCount: number;
  omittedCandidateCount: number;
  staleSuppressionCandidateCount: number;
  duplicateCandidateCount: number;
  sourceEventCount: number;
  averageFactsPerSourceEvent: number;
  selectedRate: number;
  omittedRate: number;
  staleSuppressionRate: number;
  duplicateRate: number;
  selectedReasons: Array<{ reason: string; count: number }>;
  omittedReasons: Array<{ reason: string; count: number }>;
};

export type MemoryRetrievalSurfaceTraceSource =
  | "briefing_snapshot"
  | "recommendation_payload"
  | "meeting_detail_sample";

export type MemoryRetrievalSurfaceTraceInput = {
  source: MemoryRetrievalSurfaceTraceSource;
  trace: MemoryRetrievalPackSurfaceTrace;
  createdAt?: Date | null;
};

export type MemoryRetrievalSurfaceTraceOverview = {
  traceCount: number;
  totals: {
    candidateCount: number;
    selectedCount: number;
    omittedCount: number;
    fallbackCount: number;
    staleSuppressionCount: number;
    estimatedTokensUsed: number;
  };
  sourceBreakdown: Array<{ source: MemoryRetrievalSurfaceTraceSource; count: number }>;
  surfaceBreakdown: Array<{
    surface: string;
    traceCount: number;
    candidateCount: number;
    selectedCount: number;
    omittedCount: number;
    fallbackCount: number;
    staleSuppressionCount: number;
    estimatedTokensUsed: number;
    averageSelectedCount: number;
    averageOmittedCount: number;
    selectedReasons: Array<{ reason: string; count: number }>;
    omittedReasons: Array<{ reason: string; count: number }>;
  }>;
  recentTraceRefs: Array<{
    source: MemoryRetrievalSurfaceTraceSource;
    surface: string;
    objectType: string;
    objectId: string;
    selectedCount: number;
    omittedCount: number;
    fallbackUsed: boolean;
    createdAt: string | null;
  }>;
  boundaryNote: string;
};

export type MemoryWriteFailureReviewAudit = {
  id: string;
  targetType: string;
  targetId: string;
  summary: string;
  payload: string | null;
  createdAt: Date;
};

export type MemoryWriteFailureReviewOverview = {
  failureEventCount: number;
  sampledFailureEventCount: number;
  sampleLimit: number;
  isSampled: boolean;
  blockedBatchCount: number;
  partialFailedBatchCount: number;
  retryableFailureCount: number;
  nonRetryableFailureCount: number;
  operatorReviewRequiredCount: number;
  duplicateSuppressionCount: number;
  conflictCandidateCount: number;
  failureClassBreakdown: Array<{ failureClass: string; count: number }>;
  failureReasonBreakdown: Array<{ reason: string; count: number }>;
  recentFailures: Array<{
    id: string;
    targetType: string;
    targetId: string;
    meetingId: string | null;
    summary: string;
    createdAt: string;
    batchStatus: string;
    failurePolicy: string;
    attemptedFactCount: number;
    createdFactCount: number;
    failedFactCount: number;
    duplicateSuppressionCount: number;
    conflictCandidateCount: number;
    firstFailureClass: string | null;
    firstFailureReason: string | null;
    firstFailureTitle: string | null;
    firstFailureMessage: string | null;
    retryableFailureCount: number;
    nonRetryableFailureCount: number;
    operatorReviewRequiredCount: number;
    reviewPosture: "manual_retry_candidate" | "operator_review_required" | "blocked_no_auto_action";
  }>;
  operatorQueue: MemoryWriteFailureOperatorQueueOverview;
  retryContract: MemoryWriteRetryContractOverview;
  retryReceiptLedger: MemoryWriteRetryReceiptLedgerOverview;
  retryAttemptLedger: MemoryWriteRetryAttemptLedgerOverview;
  boundaryNote: string;
};

function toRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function normalizeMemoryText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function incrementCounter(counter: Map<string, number>, key: string) {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function incrementCounterBy(counter: Map<string, number>, key: string, count: number) {
  counter.set(key, (counter.get(key) ?? 0) + count);
}

function counterToSortedArray(counter: Map<string, number>) {
  return Array.from(counter)
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function buildDuplicateKey(fact: MemoryRetrievalBaselineFact) {
  const normalizedFact =
    normalizeMemoryText(fact.normalizedValue) ||
    normalizeMemoryText(fact.content) ||
    normalizeMemoryText(fact.title);
  return [
    fact.objectType,
    fact.objectId,
    fact.factType,
    normalizedFact || fact.id,
  ].join(":");
}

function scoreFactForSelection(fact: MemoryRetrievalBaselineFact) {
  const confirmationBoost = fact.confirmedByUser ? 45 : 0;
  const statusPenalty = fact.status === MemoryStatus.ACTIVE ? 0 : 100;
  return fact.confidence + fact.importance + fact.freshnessScore + confirmationBoost - statusPenalty;
}

function resolveSelectedReason(fact: MemoryRetrievalBaselineFact) {
  if (fact.confirmedByUser) return "confirmed_by_user";
  if (fact.importance >= 70) return "high_importance";
  if (fact.confidence >= 70) return "high_confidence";
  if (fact.freshnessScore >= 70) return "fresh_active_fact";
  return "active_context";
}

function resolveOmittedReason(fact: MemoryRetrievalBaselineFact, duplicateIds: Set<string>) {
  if (duplicateIds.has(fact.id)) return "duplicate_candidate";
  if (fact.status !== MemoryStatus.ACTIVE) return "inactive_or_removed";
  if (fact.freshnessScore < MEMORY_STALE_FRESHNESS_THRESHOLD) return "stale_candidate";
  if (!fact.confirmedByUser && fact.confidence < MEMORY_LOW_CONFIDENCE_THRESHOLD) return "low_confidence";
  return "below_selection_budget";
}

export function buildMemoryRetrievalBaseline(facts: MemoryRetrievalBaselineFact[]): MemoryRetrievalBaseline {
  const duplicateIds = new Set<string>();
  const duplicateGroups = facts.reduce((acc, fact) => {
    const key = buildDuplicateKey(fact);
    const group = acc.get(key) ?? [];
    group.push(fact);
    acc.set(key, group);
    return acc;
  }, new Map<string, MemoryRetrievalBaselineFact[]>());

  for (const group of duplicateGroups.values()) {
    if (group.length <= 1) continue;
    const [keeper, ...duplicates] = [...group].sort((left, right) => {
      const scoreDelta = scoreFactForSelection(right) - scoreFactForSelection(left);
      if (scoreDelta !== 0) return scoreDelta;
      return right.updatedAt.getTime() - left.updatedAt.getTime();
    });
    void keeper;
    for (const duplicate of duplicates) {
      duplicateIds.add(duplicate.id);
    }
  }

  const selectedReasons = new Map<string, number>();
  const omittedReasons = new Map<string, number>();
  const sourceEventKeys = new Set<string>();
  let selectedCandidateCount = 0;
  let staleSuppressionCandidateCount = 0;

  for (const fact of facts) {
    sourceEventKeys.add(`${fact.sourceType}:${fact.sourceId}`);
    const isStale = fact.status === MemoryStatus.ACTIVE && fact.freshnessScore < MEMORY_STALE_FRESHNESS_THRESHOLD;
    if (isStale) {
      staleSuppressionCandidateCount += 1;
    }

    const selected =
      fact.status === MemoryStatus.ACTIVE &&
      !duplicateIds.has(fact.id) &&
      fact.freshnessScore >= MEMORY_STALE_FRESHNESS_THRESHOLD &&
      scoreFactForSelection(fact) >= MEMORY_SELECTION_SCORE_THRESHOLD;

    if (selected) {
      selectedCandidateCount += 1;
      incrementCounter(selectedReasons, resolveSelectedReason(fact));
      continue;
    }

    incrementCounter(omittedReasons, resolveOmittedReason(fact, duplicateIds));
  }

  const totalCandidateCount = facts.length;
  const omittedCandidateCount = totalCandidateCount - selectedCandidateCount;
  const duplicateCandidateCount = duplicateIds.size;
  const sourceEventCount = sourceEventKeys.size;

  return {
    totalCandidateCount,
    selectedCandidateCount,
    omittedCandidateCount,
    staleSuppressionCandidateCount,
    duplicateCandidateCount,
    sourceEventCount,
    averageFactsPerSourceEvent: sourceEventCount
      ? Math.round((totalCandidateCount / sourceEventCount) * 10) / 10
      : 0,
    selectedRate: toRate(selectedCandidateCount, totalCandidateCount),
    omittedRate: toRate(omittedCandidateCount, totalCandidateCount),
    staleSuppressionRate: toRate(staleSuppressionCandidateCount, totalCandidateCount),
    duplicateRate: toRate(duplicateCandidateCount, totalCandidateCount),
    selectedReasons: counterToSortedArray(selectedReasons),
    omittedReasons: counterToSortedArray(omittedReasons),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function countFromPayload(primary: unknown, fallbackItems: unknown) {
  const primaryCount = numberValue(primary);
  if (primaryCount > 0) return primaryCount;
  return arrayValue(fallbackItems).length;
}

function resolveReviewPosture(args: {
  retryableFailureCount: number;
  operatorReviewRequiredCount: number;
}): MemoryWriteFailureReviewOverview["recentFailures"][number]["reviewPosture"] {
  if (args.operatorReviewRequiredCount > 0) return "operator_review_required";
  if (args.retryableFailureCount > 0) return "manual_retry_candidate";
  return "blocked_no_auto_action";
}

function maybeMemoryRetrievalPackTrace(value: unknown): MemoryRetrievalPackSurfaceTrace | null {
  if (!isRecord(value) || !isRecord(value.trace) || !isRecord(value.fallback)) {
    return null;
  }

  if (typeof value.surface !== "string" || typeof value.objectId !== "string") {
    return null;
  }

  if (
    typeof value.trace.candidateCount !== "number" ||
    typeof value.trace.selectedCount !== "number" ||
    typeof value.trace.omittedCount !== "number"
  ) {
    return null;
  }

  return value as MemoryRetrievalPackSurfaceTrace;
}

function extractMemoryRetrievalPackTrace(
  rawJson: string | null | undefined,
  key: "retrievalPackTrace" | "memoryRetrievalPack",
) {
  const payload = safeParseJson<Record<string, unknown>>(rawJson, {});
  return maybeMemoryRetrievalPackTrace(payload[key]);
}

function mergeReasons(
  counter: Map<string, number>,
  reasons: Array<{ reason: string; count: number }> | undefined,
) {
  for (const item of reasons ?? []) {
    incrementCounterBy(counter, item.reason, item.count);
  }
}

export function buildMemoryRetrievalSurfaceTraceOverview(
  traces: MemoryRetrievalSurfaceTraceInput[],
): MemoryRetrievalSurfaceTraceOverview {
  const sourceCounts = new Map<MemoryRetrievalSurfaceTraceSource, number>();
  const surfaceCounts = new Map<
    string,
    {
      traceCount: number;
      candidateCount: number;
      selectedCount: number;
      omittedCount: number;
      fallbackCount: number;
      staleSuppressionCount: number;
      estimatedTokensUsed: number;
      selectedReasons: Map<string, number>;
      omittedReasons: Map<string, number>;
    }
  >();

  const totals = {
    candidateCount: 0,
    selectedCount: 0,
    omittedCount: 0,
    fallbackCount: 0,
    staleSuppressionCount: 0,
    estimatedTokensUsed: 0,
  };

  for (const item of traces) {
    const surface = item.trace.surface;
    const surfaceTrace = item.trace.trace;
    const selectedCount = surfaceTrace.selectedCount;
    const omittedCount = surfaceTrace.omittedCount;
    const candidateCount = surfaceTrace.candidateCount;
    const staleSuppressionCount =
      surfaceTrace.staleSuppressionRefs.length ||
      surfaceTrace.omittedReasons.find((reason) => reason.reason === "stale_suppressed")?.count ||
      0;
    const estimatedTokensUsed = surfaceTrace.estimatedTokensUsed;
    const fallbackCount = item.trace.fallback.used ? 1 : 0;

    totals.candidateCount += candidateCount;
    totals.selectedCount += selectedCount;
    totals.omittedCount += omittedCount;
    totals.fallbackCount += fallbackCount;
    totals.staleSuppressionCount += staleSuppressionCount;
    totals.estimatedTokensUsed += estimatedTokensUsed;

    sourceCounts.set(item.source, (sourceCounts.get(item.source) ?? 0) + 1);

    const current =
      surfaceCounts.get(surface) ?? {
        traceCount: 0,
        candidateCount: 0,
        selectedCount: 0,
        omittedCount: 0,
        fallbackCount: 0,
        staleSuppressionCount: 0,
        estimatedTokensUsed: 0,
        selectedReasons: new Map<string, number>(),
        omittedReasons: new Map<string, number>(),
      };

    current.traceCount += 1;
    current.candidateCount += candidateCount;
    current.selectedCount += selectedCount;
    current.omittedCount += omittedCount;
    current.fallbackCount += fallbackCount;
    current.staleSuppressionCount += staleSuppressionCount;
    current.estimatedTokensUsed += estimatedTokensUsed;
    mergeReasons(current.selectedReasons, surfaceTrace.selectedReasons);
    mergeReasons(current.omittedReasons, surfaceTrace.omittedReasons);
    surfaceCounts.set(surface, current);
  }

  return {
    traceCount: traces.length,
    totals,
    sourceBreakdown: Array.from(sourceCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source)),
    surfaceBreakdown: Array.from(surfaceCounts)
      .map(([surface, item]) => ({
        surface,
        traceCount: item.traceCount,
        candidateCount: item.candidateCount,
        selectedCount: item.selectedCount,
        omittedCount: item.omittedCount,
        fallbackCount: item.fallbackCount,
        staleSuppressionCount: item.staleSuppressionCount,
        estimatedTokensUsed: item.estimatedTokensUsed,
        averageSelectedCount: item.traceCount ? Math.round((item.selectedCount / item.traceCount) * 10) / 10 : 0,
        averageOmittedCount: item.traceCount ? Math.round((item.omittedCount / item.traceCount) * 10) / 10 : 0,
        selectedReasons: counterToSortedArray(item.selectedReasons),
        omittedReasons: counterToSortedArray(item.omittedReasons),
      }))
      .sort((left, right) => right.traceCount - left.traceCount || left.surface.localeCompare(right.surface)),
    recentTraceRefs: [...traces]
      .sort((left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0))
      .slice(0, 6)
      .map((item) => ({
        source: item.source,
        surface: item.trace.surface,
        objectType: item.trace.objectType,
        objectId: item.trace.objectId,
        selectedCount: item.trace.trace.selectedCount,
        omittedCount: item.trace.trace.omittedCount,
        fallbackUsed: item.trace.fallback.used,
        createdAt: item.createdAt?.toISOString() ?? null,
      })),
    boundaryNote:
      "Surface retrieval traces are evidence-packaging diagnostics only; they do not change recommendation ranking, approval ownership, commitment authority, or write-back behavior.",
  };
}

export function buildMemoryWriteFailureReviewOverview(
  audits: MemoryWriteFailureReviewAudit[],
  options?: {
    failureEventCount?: number;
    sampleLimit?: number;
    retryReceiptAudits?: MemoryWriteRetryReceiptAudit[];
    retryAttemptAudits?: MemoryWriteRetryAttemptAudit[];
    ownerAssignments?: MemoryWriteRetryOwnerAssignment[];
  },
): MemoryWriteFailureReviewOverview {
  const failureClassCounter = new Map<string, number>();
  const failureReasonCounter = new Map<string, number>();
  let blockedBatchCount = 0;
  let partialFailedBatchCount = 0;
  let retryableFailureCount = 0;
  let nonRetryableFailureCount = 0;
  let operatorReviewRequiredCount = 0;
  let duplicateSuppressionCount = 0;
  let conflictCandidateCount = 0;

  const recentFailures = audits.map((audit) => {
    const payload = safeParseJson<Record<string, unknown>>(audit.payload, {});
    const memoryWriteBatch = recordValue(payload.memoryWriteBatch);
    const memoryWriteGuard = recordValue(payload.memoryWriteGuard);
    const factWriteFailures = arrayValue(payload.factWriteFailures).filter(isRecord);
    const firstFailure = recordValue(factWriteFailures[0]);
    const batchStatus = stringValue(memoryWriteBatch.status) ?? "unknown";
    const failurePolicy = stringValue(memoryWriteBatch.failurePolicy) ?? "unknown";
    const attemptedFactCount = numberValue(memoryWriteBatch.attemptedFactCount);
    const createdFactCount = numberValue(memoryWriteBatch.createdFactCount);
    const failedFactCount = countFromPayload(memoryWriteBatch.failedFactCount, factWriteFailures);
    const batchRetryableFailureCount = countFromPayload(
      memoryWriteBatch.retryableFailureCount,
      factWriteFailures.filter((item) => item.failureClass === "retryable" || item.retryable === true),
    );
    const batchNonRetryableFailureCount = countFromPayload(
      memoryWriteBatch.nonRetryableFailureCount,
      factWriteFailures.filter((item) => item.failureClass === "non_retryable"),
    );
    const batchOperatorReviewRequiredCount = countFromPayload(
      memoryWriteBatch.operatorReviewRequiredCount,
      factWriteFailures.filter((item) => item.operatorReviewRequired === true),
    );
    const batchDuplicateSuppressionCount = countFromPayload(
      memoryWriteGuard.duplicateSuppressedCount,
      payload.duplicateSuppressions,
    );
    const batchConflictCandidateCount = countFromPayload(
      memoryWriteGuard.conflictCandidateCount,
      payload.conflictCandidates,
    );

    if (batchStatus === "blocked") blockedBatchCount += 1;
    if (batchStatus === "partial_failed") partialFailedBatchCount += 1;
    retryableFailureCount += batchRetryableFailureCount;
    nonRetryableFailureCount += batchNonRetryableFailureCount;
    operatorReviewRequiredCount += batchOperatorReviewRequiredCount;
    duplicateSuppressionCount += batchDuplicateSuppressionCount;
    conflictCandidateCount += batchConflictCandidateCount;

    for (const failure of factWriteFailures) {
      const failureClass = stringValue(failure.failureClass) ?? "unknown";
      const reason = stringValue(failure.reason) ?? "unknown_write_failure";
      incrementCounter(failureClassCounter, failureClass);
      incrementCounter(failureReasonCounter, reason);
    }

    return {
      id: audit.id,
      targetType: audit.targetType,
      targetId: audit.targetId,
      meetingId: stringValue(payload.meetingId),
      summary: audit.summary,
      createdAt: audit.createdAt.toISOString(),
      batchStatus,
      failurePolicy,
      attemptedFactCount,
      createdFactCount,
      failedFactCount,
      duplicateSuppressionCount: batchDuplicateSuppressionCount,
      conflictCandidateCount: batchConflictCandidateCount,
      firstFailureClass: stringValue(firstFailure.failureClass),
      firstFailureReason: stringValue(firstFailure.reason),
      firstFailureTitle: stringValue(firstFailure.title),
      firstFailureMessage: stringValue(firstFailure.message),
      retryableFailureCount: batchRetryableFailureCount,
      nonRetryableFailureCount: batchNonRetryableFailureCount,
      operatorReviewRequiredCount: batchOperatorReviewRequiredCount,
      reviewPosture: resolveReviewPosture({
        retryableFailureCount: batchRetryableFailureCount,
        operatorReviewRequiredCount: batchOperatorReviewRequiredCount,
      }),
    };
  });

  const failureEventCount = options?.failureEventCount ?? audits.length;
  const operatorQueue = buildMemoryWriteFailureOperatorQueue(audits);
  const retryContract = buildMemoryWriteRetryContract(operatorQueue.items);
  const retryReceiptLedger = buildMemoryWriteRetryReceiptLedger(
    retryContract,
    options?.retryReceiptAudits ?? [],
    options?.ownerAssignments ?? [],
  );
  const retryAttemptLedger = buildMemoryWriteRetryAttemptLedger(
    retryReceiptLedger,
    options?.retryAttemptAudits ?? [],
  );

  return {
    failureEventCount,
    sampledFailureEventCount: audits.length,
    sampleLimit: options?.sampleLimit ?? audits.length,
    isSampled: failureEventCount > audits.length,
    blockedBatchCount,
    partialFailedBatchCount,
    retryableFailureCount,
    nonRetryableFailureCount,
    operatorReviewRequiredCount,
    duplicateSuppressionCount,
    conflictCandidateCount,
    failureClassBreakdown: counterToSortedArray(failureClassCounter).map(({ reason, count }) => ({
      failureClass: reason,
      count,
    })),
    failureReasonBreakdown: counterToSortedArray(failureReasonCounter),
    recentFailures,
    operatorQueue,
    retryContract,
    retryReceiptLedger,
    retryAttemptLedger,
    boundaryNote:
      "Memory write failure review is read-only diagnostics for operator triage; it does not retry automatically, rewrite canonical facts, change recommendations, create commitments, or send external messages.",
  };
}

async function buildMeetingDetailSampleTraceInputs(args: {
  workspaceId: string;
  since?: Date;
}): Promise<MemoryRetrievalSurfaceTraceInput[]> {
  const recentMeetings = await db.meeting.findMany({
    where: {
      workspaceId: args.workspaceId,
      ...(args.since ? { updatedAt: { gte: args.since } } : {}),
    },
    select: {
      id: true,
      opportunityId: true,
      companyId: true,
      updatedAt: true,
      contacts: {
        select: {
          id: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 6,
  });

  if (!recentMeetings.length) return [];

  const refs = recentMeetings.flatMap((meeting) => [
    { objectType: ObjectType.MEETING, objectId: meeting.id },
    ...(meeting.opportunityId ? [{ objectType: ObjectType.OPPORTUNITY, objectId: meeting.opportunityId }] : []),
    ...(meeting.companyId ? [{ objectType: ObjectType.COMPANY, objectId: meeting.companyId }] : []),
    ...meeting.contacts.map((contact) => ({ objectType: ObjectType.CONTACT, objectId: contact.id })),
  ]);
  const uniqueRefs = Array.from(
    new Map(refs.map((ref) => [`${ref.objectType}:${ref.objectId}`, ref] as const)).values(),
  );

  if (!uniqueRefs.length) return [];

  const facts = await db.memoryFact.findMany({
    where: {
      workspaceId: args.workspaceId,
      OR: uniqueRefs,
      status: {
        in: [MemoryStatus.ACTIVE, MemoryStatus.OBSERVED],
      },
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    take: 200,
  });

  return recentMeetings.flatMap((meeting) => {
    const meetingRefKeys = new Set([
      `${ObjectType.MEETING}:${meeting.id}`,
      ...(meeting.opportunityId ? [`${ObjectType.OPPORTUNITY}:${meeting.opportunityId}`] : []),
      ...(meeting.companyId ? [`${ObjectType.COMPANY}:${meeting.companyId}`] : []),
      ...meeting.contacts.map((contact) => `${ObjectType.CONTACT}:${contact.id}`),
    ]);
    const candidateFacts = facts
      .filter((fact) => meetingRefKeys.has(`${fact.objectType}:${fact.objectId}`))
      .slice(0, 32) as MemoryFactForRetrievalPack[];

    if (!candidateFacts.length) return [];

    const pack = buildMemoryFactRetrievalPack({
      surface: "meeting_detail",
      objectType: ObjectType.MEETING,
      objectId: meeting.id,
      facts: candidateFacts,
    });

    return [{
      source: "meeting_detail_sample" as const,
      trace: pack.trace,
      createdAt: meeting.updatedAt,
    }];
  });
}

export async function getMemoryObservabilityOverview(workspaceId: string, since?: Date) {
  const factFilter = since
    ? {
        createdAt: {
          gte: since,
        },
      }
    : {};

  const llmFilter = since
    ? {
        createdAt: {
          gte: since,
        },
      }
    : {};
  const memoryWriteFailureAuditFilter = {
    workspaceId,
    actionType: "MEETING_MEMORY_FACT_WRITE_FAILED",
    ...(since ? { createdAt: { gte: since } } : {}),
  };
  const memoryWriteRetryReceiptAuditFilter = {
    workspaceId,
    actionType: MEMORY_WRITE_RETRY_RECEIPT_AUDIT_ACTION,
    ...(since ? { createdAt: { gte: since } } : {}),
  };
  const memoryWriteRetryAttemptAuditFilter = {
    workspaceId,
    actionType: MEMORY_WRITE_RETRY_ATTEMPT_AUDIT_ACTION,
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const [
    factsCreatedCount,
    correctionsCount,
    activeFactsCount,
    confirmedActiveFactsCount,
    factTypeBreakdownRaw,
    baselineFacts,
    briefingSnapshots,
    recommendationLogs,
    memoryWriteFailureAuditCount,
    memoryWriteFailureAudits,
    llmLogs,
  ] =
    await Promise.all([
      db.memoryFact.count({
        where: {
          workspaceId,
          ...factFilter,
        },
      }),
      db.memoryCorrection.count({
        where: {
          workspaceId,
          ...factFilter,
        },
      }),
      db.memoryFact.count({
        where: {
          workspaceId,
          status: MemoryStatus.ACTIVE,
        },
      }),
      db.memoryFact.count({
        where: {
          workspaceId,
          status: MemoryStatus.ACTIVE,
          confirmedByUser: true,
        },
      }),
      db.memoryFact.groupBy({
        by: ["factType"],
        where: {
          workspaceId,
          ...factFilter,
        },
        _count: {
          _all: true,
        },
      }),
      db.memoryFact.findMany({
        where: {
          workspaceId,
          ...factFilter,
        },
        select: {
          id: true,
          objectType: true,
          objectId: true,
          factType: true,
          title: true,
          content: true,
          normalizedValue: true,
          sourceType: true,
          sourceId: true,
          confidence: true,
          importance: true,
          freshnessScore: true,
          status: true,
          confirmedByUser: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 500,
      }),
      db.briefingSnapshot.findMany({
        where: {
          workspaceId,
          ...(since ? { generatedAt: { gte: since } } : {}),
        },
        select: {
          content: true,
          generatedAt: true,
        },
        orderBy: {
          generatedAt: "desc",
        },
        take: 50,
      }),
      db.recommendationLog.findMany({
        where: {
          workspaceId,
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        select: {
          recommendationPayload: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      }),
      db.auditLog.count({
        where: memoryWriteFailureAuditFilter,
      }),
      db.auditLog.findMany({
        where: memoryWriteFailureAuditFilter,
        select: {
          id: true,
          targetType: true,
          targetId: true,
          summary: true,
          payload: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: MEMORY_WRITE_FAILURE_AUDIT_SAMPLE_LIMIT,
      }),
      db.lLMCallLog.findMany({
        where: {
          workspaceId,
          taskType: {
            in: ["MEETING_MEMORY_EXTRACTION", ...Array.from(BRIEFING_TASK_TYPES)],
          },
          ...llmFilter,
        },
        select: {
          taskType: true,
          success: true,
          latencyMs: true,
          tokenUsagePrompt: true,
          tokenUsageCompletion: true,
          fallbackReason: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 300,
      }),
    ]);

  const memoryWriteFailureMeetingIds = Array.from(
    new Set(
      memoryWriteFailureAudits
        .filter((audit) => audit.targetType === "Meeting" && audit.targetId)
        .map((audit) => audit.targetId),
    ),
  );
  const [
    memoryWriteRetryReceiptAudits,
    memoryWriteRetryAttemptAudits,
    memoryWriteFailureMeetings,
  ] = await Promise.all([
    db.auditLog.findMany({
      where: memoryWriteRetryReceiptAuditFilter,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        summary: true,
        payload: true,
        userId: true,
        actor: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: MEMORY_WRITE_FAILURE_AUDIT_SAMPLE_LIMIT,
    }),
    db.auditLog.findMany({
      where: memoryWriteRetryAttemptAuditFilter,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        summary: true,
        payload: true,
        userId: true,
        actor: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: MEMORY_WRITE_FAILURE_AUDIT_SAMPLE_LIMIT,
    }),
    memoryWriteFailureMeetingIds.length
      ? db.meeting.findMany({
          where: {
            workspaceId,
            id: {
              in: memoryWriteFailureMeetingIds,
            },
          },
          select: {
            id: true,
            title: true,
            ownerId: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const memoryWriteRetryOwnerAssignments: MemoryWriteRetryOwnerAssignment[] = memoryWriteFailureMeetings.map(
    (meeting) => ({
      targetType: "Meeting",
      targetId: meeting.id,
      objectTitle: meeting.title,
      ownerUserId: meeting.ownerId ?? meeting.owner?.id ?? null,
      ownerName: meeting.owner?.name ?? null,
      ownerEmail: meeting.owner?.email ?? null,
    }),
  );

  const extractionLogs = llmLogs.filter((item) => item.taskType === "MEETING_MEMORY_EXTRACTION");
  const briefingLogs = llmLogs.filter((item) => BRIEFING_TASK_TYPES.has(item.taskType));
  const confirmationRate = activeFactsCount
    ? Math.round((confirmedActiveFactsCount / activeFactsCount) * 100)
    : 0;
  const retrievalBaseline = buildMemoryRetrievalBaseline(baselineFacts);
  const persistedSurfaceTraces: MemoryRetrievalSurfaceTraceInput[] = [
    ...briefingSnapshots.flatMap((snapshot) => {
      const trace = extractMemoryRetrievalPackTrace(snapshot.content, "retrievalPackTrace");
      return trace ? [{ source: "briefing_snapshot" as const, trace, createdAt: snapshot.generatedAt }] : [];
    }),
    ...recommendationLogs.flatMap((recommendation) => {
      const trace = extractMemoryRetrievalPackTrace(recommendation.recommendationPayload, "memoryRetrievalPack");
      return trace ? [{ source: "recommendation_payload" as const, trace, createdAt: recommendation.createdAt }] : [];
    }),
  ];
  const meetingDetailSampleTraces = await buildMeetingDetailSampleTraceInputs({ workspaceId, since });
  const retrievalSurfaceTrace = buildMemoryRetrievalSurfaceTraceOverview([
    ...persistedSurfaceTraces,
    ...meetingDetailSampleTraces,
  ]);
  const memoryWriteFailureReview = buildMemoryWriteFailureReviewOverview(memoryWriteFailureAudits, {
    failureEventCount: memoryWriteFailureAuditCount,
    sampleLimit: MEMORY_WRITE_FAILURE_AUDIT_SAMPLE_LIMIT,
    retryReceiptAudits: memoryWriteRetryReceiptAudits,
    retryAttemptAudits: memoryWriteRetryAttemptAudits,
    ownerAssignments: memoryWriteRetryOwnerAssignments,
  });

  return {
    factsCreatedCount,
    correctionsCount,
    activeFactsCount,
    confirmedActiveFactsCount,
    confirmationRate,
    factTypeBreakdown: factTypeBreakdownRaw
      .map((item) => ({
        factType: item.factType,
        count: item._count._all,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8),
    memoryWriteFailureReview,
    retrievalBaseline,
    retrievalSurfaceTrace,
    extractionLlm: summarizeCalls(extractionLogs),
    briefingLlm: summarizeCalls(briefingLogs),
  };
}
