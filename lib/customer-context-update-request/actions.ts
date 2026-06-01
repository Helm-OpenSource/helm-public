import "server-only";

import { db } from "@/lib/db";
import {
  CustomerContextUpdateRequestReservedOnlyError,
  assertReservedWorkspaceForCustomerContextUpdateRequest,
  mapCustomerContextUpdateRequestRow,
} from "./queries";
import type {
  CustomerContextUpdateAcceptanceCascade,
  CustomerContextUpdateRequestCreateInput,
  CustomerContextUpdateRequestRecord,
  CustomerContextUpdateRequestReviewStatus,
  CustomerContextUpdateRequestSourceTraceEntry,
} from "./types";
import {
  inferAcceptanceCascade,
  inferMateriality,
  isValidReviewStatusTransition,
  proposedChangesHaveForbiddenKeys,
} from "./types";
import type { Workspace } from "@prisma/client";

type ReservedWorkspaceLike = Pick<Workspace, "workspaceClass" | "systemKey"> & {
  status?: Workspace["status"] | null;
};

export class CustomerContextUpdateRequestForbiddenChangeError extends Error {
  constructor(public readonly violatingKeys: string[]) {
    super(
      `CustomerContextUpdateRequest.proposedChanges contains forbidden keys (V2.3 §10.9): ${violatingKeys.join(", ")}`,
    );
    this.name = "CustomerContextUpdateRequestForbiddenChangeError";
  }
}

export class CustomerContextUpdateRequestReviewTransitionError extends Error {
  constructor(
    public readonly from: CustomerContextUpdateRequestReviewStatus,
    public readonly to: CustomerContextUpdateRequestReviewStatus,
  ) {
    super(
      `CustomerContextUpdateRequest reviewStatus transition not allowed: ${from} → ${to}`,
    );
    this.name = "CustomerContextUpdateRequestReviewTransitionError";
  }
}

function safeJsonArray<T>(json: string | null | undefined): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function appendTrace(
  existing: CustomerContextUpdateRequestSourceTraceEntry[],
  next: CustomerContextUpdateRequestSourceTraceEntry,
) {
  return [...existing, next];
}

export type CreateCustomerContextUpdateRequestResult = {
  record: CustomerContextUpdateRequestRecord;
  // 给 caller 一份 cascade 提示：accepted 后应 downgrade 哪些上游对象。
  // 注意：这是 hint，不会自动执行下游 update。caller（例如 brief actions /
  // control line actions）拿到 hint 后自己用各自的 update API 推进。
  acceptanceCascadeHint: CustomerContextUpdateAcceptanceCascade;
};

export async function createCustomerContextUpdateRequest(input: {
  workspace: ReservedWorkspaceLike;
  data: CustomerContextUpdateRequestCreateInput;
}): Promise<CreateCustomerContextUpdateRequestResult> {
  assertReservedWorkspaceForCustomerContextUpdateRequest(input.workspace);
  const { data } = input;
  if (!data.workspaceId) throw new Error("workspaceId is required");
  if (!data.leadId) throw new Error("leadId is required");
  if (!data.requestKey?.trim()) throw new Error("requestKey is required");
  if (!data.proposedChanges || typeof data.proposedChanges !== "object") {
    throw new Error("proposedChanges must be a non-empty object");
  }
  if (Object.keys(data.proposedChanges).length === 0) {
    throw new Error("proposedChanges must contain at least one key");
  }
  // V2.3 §10.9 forbidden-keys 守卫。
  const violations = proposedChangesHaveForbiddenKeys(data.proposedChanges);
  if (violations.length > 0) {
    throw new CustomerContextUpdateRequestForbiddenChangeError(violations);
  }

  const materiality =
    data.explicitMaterialityOverride ?? inferMateriality(data.scope);
  // V2.3 §10.9：MINOR → DIRECT_APPLY；MATERIAL → REVIEW_REQUIRED。
  const initialReviewStatus: CustomerContextUpdateRequestReviewStatus =
    materiality === "MINOR" ? "DIRECT_APPLY" : "REVIEW_REQUIRED";
  // MINOR + DIRECT_APPLY 时立即给 appliedAt；material 等到 ACCEPTED 才 set。
  const appliedAt = materiality === "MINOR" ? new Date() : null;

  const trace: CustomerContextUpdateRequestSourceTraceEntry[] = [
    ...(data.initialSourceTrace ?? []),
    {
      ts: new Date().toISOString(),
      origin:
        data.origin === "CUSTOMER"
          ? "customer_in_usage_supplement"
          : "internal_review",
      actor: data.origin === "CUSTOMER" ? "customer" : "internal",
      note: `created · scope=${data.scope} · materiality=${materiality}`,
    },
  ];

  const row = await db.customerContextUpdateRequest.create({
    data: {
      workspaceId: data.workspaceId,
      leadId: data.leadId,
      briefId: data.briefId ?? null,
      controlLineCandidateId: data.controlLineCandidateId ?? null,
      requestKey: data.requestKey.trim(),
      origin: data.origin,
      scope: data.scope,
      proposedChangesJson: JSON.stringify(data.proposedChanges),
      materiality,
      reviewStatus: initialReviewStatus,
      reviewerActor: null,
      reviewerDecisionNote: null,
      appliedAt,
      supersededByRequestId: null,
      sourceTraceJson: JSON.stringify(trace),
    },
  });

  return {
    record: mapCustomerContextUpdateRequestRow(row),
    acceptanceCascadeHint: inferAcceptanceCascade({
      scope: data.scope,
      materiality,
      hasBriefRef: Boolean(data.briefId),
      hasControlLineRef: Boolean(data.controlLineCandidateId),
    }),
  };
}

export type ResolveReviewResult = {
  record: CustomerContextUpdateRequestRecord;
  acceptanceCascadeHint: CustomerContextUpdateAcceptanceCascade;
};

export async function resolveCustomerContextUpdateRequestReview(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  requestKey: string;
  decision: Extract<
    CustomerContextUpdateRequestReviewStatus,
    "ACCEPTED" | "REJECTED"
  >;
  reviewerActor: string;
  reviewerDecisionNote: string;
}): Promise<ResolveReviewResult> {
  assertReservedWorkspaceForCustomerContextUpdateRequest(input.workspace);
  if (!input.reviewerDecisionNote?.trim()) {
    throw new Error("reviewerDecisionNote is required (V2.3 §10.10 append-first)");
  }
  if (!input.reviewerActor?.trim()) {
    throw new Error("reviewerActor is required");
  }
  const existing = await db.customerContextUpdateRequest.findUnique({
    where: {
      workspaceId_requestKey: {
        workspaceId: input.workspaceId,
        requestKey: input.requestKey,
      },
    },
  });
  if (!existing) {
    throw new Error(
      `CustomerContextUpdateRequest not found: ${input.requestKey}`,
    );
  }
  if (
    !isValidReviewStatusTransition(existing.reviewStatus, input.decision)
  ) {
    throw new CustomerContextUpdateRequestReviewTransitionError(
      existing.reviewStatus,
      input.decision,
    );
  }

  const trace = appendTrace(
    safeJsonArray<CustomerContextUpdateRequestSourceTraceEntry>(
      existing.sourceTraceJson,
    ),
    {
      ts: new Date().toISOString(),
      origin: "internal_review",
      actor: input.reviewerActor.trim(),
      note: `${existing.reviewStatus} → ${input.decision}: ${input.reviewerDecisionNote.trim()}`,
    },
  );

  const updated = await db.customerContextUpdateRequest.update({
    where: {
      workspaceId_requestKey: {
        workspaceId: input.workspaceId,
        requestKey: input.requestKey,
      },
    },
    data: {
      reviewStatus: input.decision,
      reviewerActor: input.reviewerActor.trim(),
      reviewerDecisionNote: input.reviewerDecisionNote.trim(),
      sourceTraceJson: JSON.stringify(trace),
      appliedAt: input.decision === "ACCEPTED" ? new Date() : existing.appliedAt,
    },
  });

  return {
    record: mapCustomerContextUpdateRequestRow(updated),
    acceptanceCascadeHint:
      input.decision === "ACCEPTED"
        ? inferAcceptanceCascade({
            scope: existing.scope,
            materiality: existing.materiality,
            hasBriefRef: Boolean(existing.briefId),
            hasControlLineRef: Boolean(existing.controlLineCandidateId),
          })
        : { shouldDowngradeBrief: false, shouldDowngradeControlLine: false },
  };
}

export async function supersedeCustomerContextUpdateRequest(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  requestKey: string;
  supersededByRequestId: string;
  reasonNote: string;
  reviewerActor: string;
}): Promise<CustomerContextUpdateRequestRecord> {
  assertReservedWorkspaceForCustomerContextUpdateRequest(input.workspace);
  if (!input.reasonNote?.trim()) {
    throw new Error("reasonNote is required");
  }
  const existing = await db.customerContextUpdateRequest.findUnique({
    where: {
      workspaceId_requestKey: {
        workspaceId: input.workspaceId,
        requestKey: input.requestKey,
      },
    },
  });
  if (!existing) {
    throw new Error(
      `CustomerContextUpdateRequest not found: ${input.requestKey}`,
    );
  }
  if (!isValidReviewStatusTransition(existing.reviewStatus, "SUPERSEDED")) {
    throw new CustomerContextUpdateRequestReviewTransitionError(
      existing.reviewStatus,
      "SUPERSEDED",
    );
  }
  const trace = appendTrace(
    safeJsonArray<CustomerContextUpdateRequestSourceTraceEntry>(
      existing.sourceTraceJson,
    ),
    {
      ts: new Date().toISOString(),
      origin: "internal_review",
      actor: input.reviewerActor.trim(),
      note: `${existing.reviewStatus} → SUPERSEDED by ${input.supersededByRequestId}: ${input.reasonNote.trim()}`,
    },
  );
  const updated = await db.customerContextUpdateRequest.update({
    where: {
      workspaceId_requestKey: {
        workspaceId: input.workspaceId,
        requestKey: input.requestKey,
      },
    },
    data: {
      reviewStatus: "SUPERSEDED",
      supersededByRequestId: input.supersededByRequestId,
      sourceTraceJson: JSON.stringify(trace),
    },
  });
  return mapCustomerContextUpdateRequestRow(updated);
}

export { CustomerContextUpdateRequestReservedOnlyError };
