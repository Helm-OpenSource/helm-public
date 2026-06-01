export type MemoryWriteFailureOperatorQueueAudit = {
  id: string;
  targetType: string;
  targetId: string;
  summary: string;
  payload: string | null;
  createdAt: Date;
};

export type MemoryWriteFailureOperatorQueueItem = {
  id: string;
  auditId: string;
  targetType: string;
  targetId: string;
  meetingId: string | null;
  createdAt: string;
  title: string | null;
  objectType: string | null;
  objectId: string | null;
  factType: string | null;
  sourceType: string | null;
  sourceId: string | null;
  payloadStatus: "valid" | "empty" | "malformed";
  failureClass: string;
  reason: string;
  batchStatus: string;
  reviewPosture:
    | "retry_manual_confirm"
    | "merge_conflict_review"
    | "source_data_repair"
    | "inspect_audit_payload";
  nextAction:
    | "rebuild_from_source_then_retry"
    | "review_conflict_candidate"
    | "repair_source_or_object"
    | "inspect_failure_payload";
  retryReadiness:
    | "candidate_requires_operator_confirmation"
    | "not_retryable"
    | "requires_payload_or_conflict_review";
  canAutoRetry: false;
  boundaryNote: string;
};

export type MemoryWriteFailureOperatorQueueOverview = {
  queueItemCount: number;
  visibleQueueItemCount: number;
  omittedQueueItemCount: number;
  itemLimit: number;
  hasMoreItems: boolean;
  retryCandidateCount: number;
  conflictReviewCount: number;
  sourceRepairCount: number;
  payloadReviewCount: number;
  items: MemoryWriteFailureOperatorQueueItem[];
  boundaryNote: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function parseAuditPayload(payload: string | null): {
  payload: Record<string, unknown>;
  payloadStatus: MemoryWriteFailureOperatorQueueItem["payloadStatus"];
} {
  if (!payload || !payload.trim()) {
    return { payload: {}, payloadStatus: "empty" };
  }

  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!isRecord(parsed)) {
      return { payload: {}, payloadStatus: "malformed" };
    }

    return { payload: parsed, payloadStatus: "valid" };
  } catch {
    return { payload: {}, payloadStatus: "malformed" };
  }
}

function resolveQueuePosture(input: {
  failureClass: string;
  reason: string;
}): Pick<
  MemoryWriteFailureOperatorQueueItem,
  "reviewPosture" | "nextAction" | "retryReadiness"
> {
  if (input.failureClass === "retryable") {
    return {
      reviewPosture: "retry_manual_confirm",
      nextAction: "rebuild_from_source_then_retry",
      retryReadiness: "candidate_requires_operator_confirmation",
    };
  }

  if (input.failureClass === "operator_review_required" || input.reason === "db_unique_conflict") {
    return {
      reviewPosture: "merge_conflict_review",
      nextAction: "review_conflict_candidate",
      retryReadiness: "requires_payload_or_conflict_review",
    };
  }

  if (input.failureClass === "non_retryable") {
    return {
      reviewPosture: "source_data_repair",
      nextAction: "repair_source_or_object",
      retryReadiness: "not_retryable",
    };
  }

  return {
    reviewPosture: "inspect_audit_payload",
    nextAction: "inspect_failure_payload",
    retryReadiness: "requires_payload_or_conflict_review",
  };
}

function buildQueueItem(args: {
  audit: MemoryWriteFailureOperatorQueueAudit;
  payload: Record<string, unknown>;
  payloadStatus: MemoryWriteFailureOperatorQueueItem["payloadStatus"];
  failure: Record<string, unknown>;
  index: number;
}): MemoryWriteFailureOperatorQueueItem {
  const memoryWriteBatch = recordValue(args.payload.memoryWriteBatch);
  const failureClass = stringValue(args.failure.failureClass) ?? "unknown";
  const reason = stringValue(args.failure.reason) ?? "unknown_write_failure";
  const posture = resolveQueuePosture({ failureClass, reason });

  return {
    id: `${args.audit.id}:${args.index}`,
    auditId: args.audit.id,
    targetType: args.audit.targetType,
    targetId: args.audit.targetId,
    meetingId: stringValue(args.payload.meetingId),
    createdAt: args.audit.createdAt.toISOString(),
    title: stringValue(args.failure.title),
    objectType: stringValue(args.failure.objectType),
    objectId: stringValue(args.failure.objectId),
    factType: stringValue(args.failure.factType),
    sourceType: stringValue(args.failure.sourceType),
    sourceId: stringValue(args.failure.sourceId),
    payloadStatus: args.payloadStatus,
    failureClass,
    reason,
    batchStatus: stringValue(memoryWriteBatch.status) ?? "unknown",
    ...posture,
    canAutoRetry: false,
    boundaryNote:
      "Operator queue items are review-first retry candidates only; Helm does not auto retry, rewrite canonical facts, change recommendations, create commitments, or send external messages.",
  };
}

export function buildMemoryWriteFailureOperatorQueue(
  audits: MemoryWriteFailureOperatorQueueAudit[],
  options?: {
    itemLimit?: number;
  },
): MemoryWriteFailureOperatorQueueOverview {
  const items: MemoryWriteFailureOperatorQueueItem[] = [];
  const itemLimit = options?.itemLimit ?? 12;

  for (const audit of audits) {
    const { payload, payloadStatus } = parseAuditPayload(audit.payload);
    const failures = arrayValue(payload.factWriteFailures).filter(isRecord);

    if (!failures.length) {
      const fallbackReason =
        payloadStatus === "malformed"
          ? "malformed_audit_payload"
          : payloadStatus === "empty"
            ? "empty_audit_payload"
            : "missing_fact_write_failures";
      items.push(
        buildQueueItem({
          audit,
          payload,
          payloadStatus,
          failure: {
            failureClass: "unknown",
            reason: fallbackReason,
            title: audit.summary,
          },
          index: 0,
        }),
      );
      continue;
    }

    failures.forEach((failure, index) => {
      items.push(buildQueueItem({ audit, payload, payloadStatus, failure, index }));
    });
  }

  const boundedItems = items.slice(0, itemLimit);
  const totalQueueItemCount = items.length;
  const omittedQueueItemCount = Math.max(totalQueueItemCount - boundedItems.length, 0);

  return {
    queueItemCount: totalQueueItemCount,
    visibleQueueItemCount: boundedItems.length,
    omittedQueueItemCount,
    itemLimit,
    hasMoreItems: omittedQueueItemCount > 0,
    retryCandidateCount: items.filter((item) => item.reviewPosture === "retry_manual_confirm").length,
    conflictReviewCount: items.filter((item) => item.reviewPosture === "merge_conflict_review").length,
    sourceRepairCount: items.filter((item) => item.reviewPosture === "source_data_repair").length,
    payloadReviewCount: items.filter((item) => item.reviewPosture === "inspect_audit_payload").length,
    items: boundedItems,
    boundaryNote:
      "Memory write failure operator queue is a read-only triage queue; retry execution still requires a later explicit review-first executor and must not expand recommendation or commitment authority.",
  };
}
