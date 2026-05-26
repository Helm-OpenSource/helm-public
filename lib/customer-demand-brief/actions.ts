import "server-only";

import { db } from "@/lib/db";
import {
  CustomerDemandBriefReservedOnlyError,
  assertReservedWorkspaceForCustomerDemandBrief,
  mapCustomerDemandBriefRow,
} from "./queries";
import type {
  CustomerDemandBriefCreateInput,
  CustomerDemandBriefCustomerConfirmationStatus,
  CustomerDemandBriefRecord,
  CustomerDemandBriefReviewStatus,
  CustomerDemandBriefSourceTraceEntry,
  TrialInitializationPayload,
} from "./types";
import {
  emptyRoleMap,
  isValidCustomerDemandBriefCustomerConfirmationTransition,
  isValidCustomerDemandBriefReviewTransition,
  trialInitializationPayloadHasForbiddenKeys,
} from "./types";
import type { Workspace } from "@prisma/client";

type ReservedWorkspaceLike = Pick<Workspace, "workspaceClass" | "systemKey"> & {
  status?: Workspace["status"] | null;
};

export class CustomerDemandBriefReviewTransitionError extends Error {
  constructor(
    public readonly from: CustomerDemandBriefReviewStatus,
    public readonly to: CustomerDemandBriefReviewStatus,
  ) {
    super(`CustomerDemandBrief reviewStatus transition not allowed: ${from} → ${to}`);
    this.name = "CustomerDemandBriefReviewTransitionError";
  }
}

export class CustomerDemandBriefCustomerConfirmationTransitionError extends Error {
  constructor(
    public readonly from: CustomerDemandBriefCustomerConfirmationStatus,
    public readonly to: CustomerDemandBriefCustomerConfirmationStatus,
  ) {
    super(
      `CustomerDemandBrief customerConfirmationStatus transition not allowed: ${from} → ${to}`,
    );
    this.name = "CustomerDemandBriefCustomerConfirmationTransitionError";
  }
}

export class CustomerDemandBriefForbiddenTrialPayloadError extends Error {
  constructor(public readonly violatingKeys: string[]) {
    super(
      `Trial initialization payload contains forbidden keys (V2.3 §10.7 Clean Handoff): ${violatingKeys.join(", ")}`,
    );
    this.name = "CustomerDemandBriefForbiddenTrialPayloadError";
  }
}

function appendSourceTrace(
  existing: CustomerDemandBriefSourceTraceEntry[],
  next: CustomerDemandBriefSourceTraceEntry,
) {
  return [...existing, next];
}

function jsonOr<T>(value: T | null | undefined, fallback: T): string {
  return JSON.stringify(value ?? fallback);
}

export async function createCustomerDemandBrief(input: {
  workspace: ReservedWorkspaceLike;
  data: CustomerDemandBriefCreateInput;
}): Promise<CustomerDemandBriefRecord> {
  assertReservedWorkspaceForCustomerDemandBrief(input.workspace);
  const data = input.data;
  if (!data.workspaceId) throw new Error("workspaceId is required");
  if (!data.leadId) throw new Error("leadId is required");
  if (!data.briefKey?.trim()) throw new Error("briefKey is required");
  if (!data.customerSummary?.trim()) throw new Error("customerSummary is required");
  if (!data.successCriteria?.trim()) throw new Error("successCriteria is required");
  if (!data.customerVisibleSummary?.trim())
    throw new Error("customerVisibleSummary is required");

  const row = await db.customerDemandBrief.create({
    data: {
      workspaceId: data.workspaceId,
      leadId: data.leadId,
      briefKey: data.briefKey.trim(),
      entryMode: data.entryMode,
      prefillSource: data.prefillSource ?? null,
      customerSummary: data.customerSummary.trim(),
      businessPressureTagsJson: jsonOr(data.businessPressureTags, []),
      currentResourceTagsJson: jsonOr(data.currentResourceTags, []),
      resourceEvidenceReadinessJson: jsonOr(data.resourceEvidenceReadiness, []),
      painToControlLineCandidatesJson: jsonOr(data.painToControlLineCandidates, []),
      roleMapJson: jsonOr(data.roleMap, emptyRoleMap()),
      firstLoopCandidatesJson: jsonOr(data.firstLoopCandidates, []),
      successCriteria: data.successCriteria.trim(),
      riskBoundaryTagsJson: jsonOr(data.riskBoundaryTags, []),
      customerVisibleSummary: data.customerVisibleSummary.trim(),
      internalSalesNotes: data.internalSalesNotes?.trim() || null,
      // 创建时绝不允许直接 set trialInitializationPayload；必须 review 通过后由
      // attachTrialInitializationPayload() 写入。
      trialInitializationPayloadJson: null,
      sourceTraceJson: jsonOr(data.initialSourceTrace, []),
      reviewStatus: "DRAFT",
      customerConfirmationStatus: "NOT_INVITED",
    },
  });
  return mapCustomerDemandBriefRow(row);
}

export async function updateCustomerDemandBriefReviewStatus(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  briefKey: string;
  nextStatus: CustomerDemandBriefReviewStatus;
  reviewerActor: string;                  // membershipId or "system"
  reasonNote: string;
}): Promise<CustomerDemandBriefRecord> {
  assertReservedWorkspaceForCustomerDemandBrief(input.workspace);
  if (!input.reasonNote?.trim()) {
    throw new Error("reasonNote is required for reviewStatus transitions (V2.3 §10.10 append-first)");
  }
  const existing = await db.customerDemandBrief.findUnique({
    where: {
      workspaceId_briefKey: {
        workspaceId: input.workspaceId,
        briefKey: input.briefKey,
      },
    },
  });
  if (!existing) throw new Error(`CustomerDemandBrief not found: ${input.briefKey}`);
  if (
    !isValidCustomerDemandBriefReviewTransition(existing.reviewStatus, input.nextStatus)
  ) {
    throw new CustomerDemandBriefReviewTransitionError(
      existing.reviewStatus,
      input.nextStatus,
    );
  }
  const trace = appendSourceTrace(
    safeJsonArray<CustomerDemandBriefSourceTraceEntry>(existing.sourceTraceJson),
    {
      ts: new Date().toISOString(),
      origin: "internal_review",
      actor: input.reviewerActor,
      note: `${existing.reviewStatus} → ${input.nextStatus}: ${input.reasonNote.trim()}`,
    },
  );
  const updated = await db.customerDemandBrief.update({
    where: {
      workspaceId_briefKey: {
        workspaceId: input.workspaceId,
        briefKey: input.briefKey,
      },
    },
    data: {
      reviewStatus: input.nextStatus,
      sourceTraceJson: JSON.stringify(trace),
    },
  });
  return mapCustomerDemandBriefRow(updated);
}

export async function updateCustomerDemandBriefCustomerConfirmation(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  briefKey: string;
  nextStatus: CustomerDemandBriefCustomerConfirmationStatus;
  customerActor: string;                   // customer email or membershipId
  origin: Extract<
    CustomerDemandBriefSourceTraceEntry["origin"],
    "customer_confirmation" | "customer_supplement" | "customer_change_request"
  >;
  reasonNote: string;
}): Promise<CustomerDemandBriefRecord> {
  assertReservedWorkspaceForCustomerDemandBrief(input.workspace);
  if (!input.reasonNote?.trim()) {
    throw new Error("reasonNote is required for customerConfirmation transitions");
  }
  const existing = await db.customerDemandBrief.findUnique({
    where: {
      workspaceId_briefKey: {
        workspaceId: input.workspaceId,
        briefKey: input.briefKey,
      },
    },
  });
  if (!existing) throw new Error(`CustomerDemandBrief not found: ${input.briefKey}`);
  if (
    !isValidCustomerDemandBriefCustomerConfirmationTransition(
      existing.customerConfirmationStatus,
      input.nextStatus,
    )
  ) {
    throw new CustomerDemandBriefCustomerConfirmationTransitionError(
      existing.customerConfirmationStatus,
      input.nextStatus,
    );
  }
  const trace = appendSourceTrace(
    safeJsonArray<CustomerDemandBriefSourceTraceEntry>(existing.sourceTraceJson),
    {
      ts: new Date().toISOString(),
      origin: input.origin,
      actor: input.customerActor,
      note: `${existing.customerConfirmationStatus} → ${input.nextStatus}: ${input.reasonNote.trim()}`,
    },
  );
  // V2.3 §6.3：客户提出 material change → 把 reviewStatus 自动降级为 REVIEW_REQUIRED。
  const shouldDowngrade =
    input.origin === "customer_change_request" &&
    existing.reviewStatus === "APPROVED_FOR_TRIAL_INIT";
  const updated = await db.customerDemandBrief.update({
    where: {
      workspaceId_briefKey: {
        workspaceId: input.workspaceId,
        briefKey: input.briefKey,
      },
    },
    data: {
      customerConfirmationStatus: input.nextStatus,
      sourceTraceJson: JSON.stringify(trace),
      ...(shouldDowngrade ? { reviewStatus: "REVIEW_REQUIRED" } : {}),
    },
  });
  return mapCustomerDemandBriefRow(updated);
}

export async function attachTrialInitializationPayload(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  briefKey: string;
  payload: TrialInitializationPayload;
  reviewerActor: string;
  reasonNote: string;
}): Promise<CustomerDemandBriefRecord> {
  assertReservedWorkspaceForCustomerDemandBrief(input.workspace);
  if (!input.reasonNote?.trim()) {
    throw new Error("reasonNote is required for trial-init payload attachment");
  }
  // 严格 white-list：拒绝任何 referral / settlement / contribution / 内部备注 key。
  const violations = trialInitializationPayloadHasForbiddenKeys(
    input.payload as unknown as Record<string, unknown>,
  );
  if (violations.length > 0) {
    throw new CustomerDemandBriefForbiddenTrialPayloadError(violations);
  }
  const existing = await db.customerDemandBrief.findUnique({
    where: {
      workspaceId_briefKey: {
        workspaceId: input.workspaceId,
        briefKey: input.briefKey,
      },
    },
  });
  if (!existing) throw new Error(`CustomerDemandBrief not found: ${input.briefKey}`);
  if (existing.reviewStatus !== "APPROVED_FOR_TRIAL_INIT") {
    throw new Error(
      `Trial init payload can only be attached when reviewStatus = APPROVED_FOR_TRIAL_INIT (current: ${existing.reviewStatus})`,
    );
  }
  const trace = appendSourceTrace(
    safeJsonArray<CustomerDemandBriefSourceTraceEntry>(existing.sourceTraceJson),
    {
      ts: new Date().toISOString(),
      origin: "internal_review",
      actor: input.reviewerActor,
      note: `attach trial-init payload: ${input.reasonNote.trim()}`,
    },
  );
  const updated = await db.customerDemandBrief.update({
    where: {
      workspaceId_briefKey: {
        workspaceId: input.workspaceId,
        briefKey: input.briefKey,
      },
    },
    data: {
      trialInitializationPayloadJson: JSON.stringify(input.payload),
      sourceTraceJson: JSON.stringify(trace),
    },
  });
  return mapCustomerDemandBriefRow(updated);
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

export { CustomerDemandBriefReservedOnlyError };
