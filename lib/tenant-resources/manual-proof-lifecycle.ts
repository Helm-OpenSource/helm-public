import type { TenantResourceEvidenceDetailStatus } from "@/lib/tenant-resources/evidence-detail";

export type TenantResourceManualProofRecordStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "EXPIRED";

export type TenantResourceManualProofLifecycleState =
  | "not_required"
  | "awaiting_submission"
  | "submitted"
  | "under_review"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "expired"
  | "blocked";

export type TenantResourceManualProofRecordInput = {
  proofId: string;
  resourceKey: string;
  actionRef: string;
  status: TenantResourceManualProofRecordStatus;
  submittedBy: string;
  submittedAt: Date | string;
  reviewedBy?: string | null;
  reviewedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  evidenceRefs?: string[];
  failureReason?: string | null;
};

export type TenantResourceManualProofLifecycle = {
  lifecycleKey: string;
  generatedAt: string;
  resourceKey: string;
  actionRef: string;
  required: boolean;
  status: TenantResourceManualProofLifecycleState;
  submitter: {
    expected: "operator" | "none";
    submittedBy: string | null;
    submittedAt: string | null;
  };
  reviewer: {
    expected: "reviewer" | "none";
    reviewedBy: string | null;
    reviewedAt: string | null;
  };
  expiry: {
    expiresAt: string | null;
    expired: boolean;
  };
  proof: {
    proofId: string;
    status: TenantResourceManualProofRecordStatus;
    evidenceRefs: string[];
    failureReason: string | null;
  } | null;
  followThrough: {
    canEnterLearn: boolean;
    nextOwner: "operator" | "reviewer" | "none";
    nextMove: string;
    result:
      | "continue_without_proof"
      | "await_proof"
      | "review_proof"
      | "learn_from_accepted_proof"
      | "repair_or_retry"
      | "stop_blocked";
  };
  boundaryNotes: string[];
};

export function buildTenantResourceManualProofLifecycle(input: {
  now?: Date | string;
  resourceKey: string;
  actionRef: string;
  generatedAt: string;
  proofRequired: boolean;
  proofLifecycleState: "not_required" | "required" | "review_required" | "blocked";
  detailStatus: TenantResourceEvidenceDetailStatus;
  nextOwner: "operator" | "reviewer" | "none";
  failureMode: string | null;
  evidenceRefs?: string[];
  proofRecords?: TenantResourceManualProofRecordInput[];
}): TenantResourceManualProofLifecycle {
  const generatedAt = toIsoString(input.now ?? input.generatedAt);
  const now = new Date(generatedAt);
  const latestProof = pickLatestProofRecord({
    records: input.proofRecords ?? [],
    resourceKey: input.resourceKey,
    actionRef: input.actionRef,
  });
  const normalizedProof = latestProof ? normalizeProofRecord(latestProof, now) : null;
  const status = resolveLifecycleStatus({
    proofRequired: input.proofRequired,
    proofLifecycleState: input.proofLifecycleState,
    detailStatus: input.detailStatus,
    proof: normalizedProof,
  });
  const submittedBy = normalizedProof?.submittedBy ?? null;
  const reviewedBy = normalizedProof?.reviewedBy ?? null;

  return {
    lifecycleKey: buildStableKey(
      "tenant_resource_manual_proof",
      `${input.resourceKey}:${input.actionRef}`,
    ),
    generatedAt,
    resourceKey: input.resourceKey,
    actionRef: input.actionRef,
    required: input.proofRequired,
    status,
    submitter: {
      expected: input.proofRequired && status !== "blocked" ? "operator" : "none",
      submittedBy,
      submittedAt: normalizedProof?.submittedAt ?? null,
    },
    reviewer: {
      expected: proofNeedsReviewer(status) ? "reviewer" : "none",
      reviewedBy,
      reviewedAt: normalizedProof?.reviewedAt ?? null,
    },
    expiry: {
      expiresAt: normalizedProof?.expiresAt ?? null,
      expired: status === "expired",
    },
    proof: normalizedProof
      ? {
          proofId: normalizedProof.proofId,
          status: normalizedProof.status,
          evidenceRefs: normalizedProof.evidenceRefs,
          failureReason: normalizedProof.failureReason,
        }
      : null,
    followThrough: buildFollowThrough({
      status,
      nextOwner: input.nextOwner,
      failureMode: input.failureMode ?? normalizedProof?.failureReason ?? null,
    }),
    boundaryNotes: [
      "manual proof lifecycle readout is read-only and does not submit, approve, reject, withdraw, or expire proof records",
      "accepted manual proof may unlock follow-through learning only after separate persisted proof handling exists",
      "manual proof does not create external write authority or official resource success",
    ],
  };
}

function resolveLifecycleStatus(input: {
  proofRequired: boolean;
  proofLifecycleState: "not_required" | "required" | "review_required" | "blocked";
  detailStatus: TenantResourceEvidenceDetailStatus;
  proof: NormalizedProofRecord | null;
}): TenantResourceManualProofLifecycleState {
  if (input.proofLifecycleState === "blocked" || input.detailStatus === "blocked") {
    return "blocked";
  }
  if (!input.proofRequired) {
    return input.proofLifecycleState === "review_required" ? "under_review" : "not_required";
  }
  if (!input.proof) return "awaiting_submission";
  if (input.proof.expired) return "expired";

  const statusMap: Record<
    TenantResourceManualProofRecordStatus,
    TenantResourceManualProofLifecycleState
  > = {
    SUBMITTED: "submitted",
    UNDER_REVIEW: "under_review",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    WITHDRAWN: "withdrawn",
    EXPIRED: "expired",
  };

  return statusMap[input.proof.status];
}

function buildFollowThrough(input: {
  status: TenantResourceManualProofLifecycleState;
  nextOwner: "operator" | "reviewer" | "none";
  failureMode: string | null;
}): TenantResourceManualProofLifecycle["followThrough"] {
  if (input.status === "not_required") {
    return {
      canEnterLearn: true,
      nextOwner: "none",
      nextMove: "Continue without manual proof; keep evidence attached to the judgement.",
      result: "continue_without_proof",
    };
  }
  if (input.status === "accepted") {
    return {
      canEnterLearn: true,
      nextOwner: "none",
      nextMove: "Use the accepted proof as follow-through evidence before learning.",
      result: "learn_from_accepted_proof",
    };
  }
  if (input.status === "submitted" || input.status === "under_review") {
    return {
      canEnterLearn: false,
      nextOwner: "reviewer",
      nextMove: "Review the submitted proof before closing or learning from the action.",
      result: "review_proof",
    };
  }
  if (input.status === "awaiting_submission") {
    return {
      canEnterLearn: false,
      nextOwner: input.nextOwner === "none" ? "operator" : input.nextOwner,
      nextMove: "Submit manual proof for the action before follow-through can close.",
      result: "await_proof",
    };
  }
  if (input.status === "blocked") {
    return {
      canEnterLearn: false,
      nextOwner: "none",
      nextMove: `Stop proof lifecycle until the blocking reason is cleared${
        input.failureMode ? `: ${input.failureMode}` : ""
      }.`,
      result: "stop_blocked",
    };
  }

  return {
    canEnterLearn: false,
    nextOwner: "operator",
    nextMove: `Repair or retry proof before follow-through can close${
      input.failureMode ? `: ${input.failureMode}` : ""
    }.`,
    result: "repair_or_retry",
  };
}

type NormalizedProofRecord = {
  proofId: string;
  status: TenantResourceManualProofRecordStatus;
  submittedBy: string;
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  evidenceRefs: string[];
  failureReason: string | null;
};

function normalizeProofRecord(
  proof: TenantResourceManualProofRecordInput,
  now: Date,
): NormalizedProofRecord {
  const expiresAt = toNullableIsoString(proof.expiresAt ?? null);
  const expired =
    proof.status === "EXPIRED" || (expiresAt ? new Date(expiresAt).getTime() < now.getTime() : false);

  return {
    proofId: proof.proofId,
    status: proof.status,
    submittedBy: proof.submittedBy,
    submittedAt: toIsoString(proof.submittedAt),
    reviewedBy: proof.reviewedBy ?? null,
    reviewedAt: toNullableIsoString(proof.reviewedAt ?? null),
    expiresAt,
    expired,
    evidenceRefs: uniqueStrings(proof.evidenceRefs ?? []),
    failureReason: proof.failureReason ?? null,
  };
}

function pickLatestProofRecord(input: {
  records: TenantResourceManualProofRecordInput[];
  resourceKey: string;
  actionRef: string;
}) {
  return input.records
    .filter(
      (record) =>
        record.resourceKey === input.resourceKey && record.actionRef === input.actionRef,
    )
    .sort(
      (left, right) =>
        new Date(right.reviewedAt ?? right.submittedAt).getTime() -
        new Date(left.reviewedAt ?? left.submittedAt).getTime(),
    )[0];
}

function proofNeedsReviewer(status: TenantResourceManualProofLifecycleState) {
  return status === "submitted" || status === "under_review";
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNullableIsoString(value: Date | string | null) {
  return value ? toIsoString(value) : null;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildStableKey(prefix: string, seed: string) {
  const normalized =
    seed
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 96) || "unknown";

  return `${prefix}_${normalized}`;
}
