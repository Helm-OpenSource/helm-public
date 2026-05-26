import "server-only";

import { db } from "@/lib/db";
import { isHelmReservedWorkspace } from "@/lib/workspace-identity";
import { safeParseJson } from "@/lib/utils";
import type {
  CustomerContextUpdateRequest as PrismaUpdateRequest,
  Workspace,
} from "@prisma/client";
import type {
  CustomerContextUpdateRequestRecord,
  CustomerContextUpdateRequestReviewStatus,
  CustomerContextUpdateRequestSourceTraceEntry,
} from "./types";

type ReservedWorkspaceLike = Pick<Workspace, "workspaceClass" | "systemKey"> & {
  status?: Workspace["status"] | null;
};

export class CustomerContextUpdateRequestReservedOnlyError extends Error {
  constructor(english = false) {
    super(
      english
        ? "CustomerContextUpdateRequest queries are reserved for the Helm internal operating workspace."
        : "CustomerContextUpdateRequest 查询只保留给 Helm 自留经营工作区。",
    );
    this.name = "CustomerContextUpdateRequestReservedOnlyError";
  }
}

export function assertReservedWorkspaceForCustomerContextUpdateRequest(
  workspace: ReservedWorkspaceLike | null | undefined,
  english = false,
) {
  if (!isHelmReservedWorkspace(workspace)) {
    throw new CustomerContextUpdateRequestReservedOnlyError(english);
  }
  if (workspace?.status === "CANCELED") {
    throw new CustomerContextUpdateRequestReservedOnlyError(english);
  }
}

export function mapCustomerContextUpdateRequestRow(
  row: PrismaUpdateRequest,
): CustomerContextUpdateRequestRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    leadId: row.leadId,
    briefId: row.briefId ?? null,
    controlLineCandidateId: row.controlLineCandidateId ?? null,
    requestKey: row.requestKey,
    origin: row.origin,
    scope: row.scope,
    proposedChanges: safeParseJson<Record<string, unknown>>(
      row.proposedChangesJson,
      {},
    ),
    materiality: row.materiality,
    reviewStatus: row.reviewStatus,
    reviewerActor: row.reviewerActor ?? null,
    reviewerDecisionNote: row.reviewerDecisionNote ?? null,
    appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
    supersededByRequestId: row.supersededByRequestId ?? null,
    sourceTrace: safeParseJson<CustomerContextUpdateRequestSourceTraceEntry[]>(
      row.sourceTraceJson,
      [],
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCustomerContextUpdateRequestsForReservedWorkspace(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  reviewStatus?: CustomerContextUpdateRequestReviewStatus;
  briefId?: string;
  leadId?: string;
  take?: number;
}): Promise<CustomerContextUpdateRequestRecord[]> {
  assertReservedWorkspaceForCustomerContextUpdateRequest(input.workspace);
  const rows = await db.customerContextUpdateRequest.findMany({
    where: {
      workspaceId: input.workspaceId,
      reviewStatus: input.reviewStatus ?? undefined,
      briefId: input.briefId ?? undefined,
      leadId: input.leadId ?? undefined,
    },
    orderBy: { updatedAt: "desc" },
    take: input.take ?? 50,
  });
  return rows.map(mapCustomerContextUpdateRequestRow);
}

export async function getCustomerContextUpdateRequestByKey(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  requestKey: string;
}): Promise<CustomerContextUpdateRequestRecord | null> {
  assertReservedWorkspaceForCustomerContextUpdateRequest(input.workspace);
  const row = await db.customerContextUpdateRequest.findUnique({
    where: {
      workspaceId_requestKey: {
        workspaceId: input.workspaceId,
        requestKey: input.requestKey,
      },
    },
  });
  return row ? mapCustomerContextUpdateRequestRow(row) : null;
}
