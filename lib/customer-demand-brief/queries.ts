import "server-only";

import { db } from "@/lib/db";
import { isHelmReservedWorkspace } from "@/lib/workspace-identity";
import { safeParseJson } from "@/lib/utils";
import type {
  CustomerDemandBrief as PrismaCustomerDemandBrief,
  Workspace,
} from "@prisma/client";
import type {
  CustomerDemandBriefRecord,
  CustomerDemandBriefReviewStatus,
  CustomerDemandBriefRoleMap,
  CustomerDemandBriefSourceTraceEntry,
  ResourceEvidenceReadinessEntry,
  TrialInitializationPayload,
} from "./types";
import { emptyRoleMap } from "./types";

type ReservedWorkspaceLike = Pick<Workspace, "workspaceClass" | "systemKey"> & {
  status?: Workspace["status"] | null;
};

export class CustomerDemandBriefReservedOnlyError extends Error {
  constructor(english = false) {
    super(
      english
        ? "CustomerDemandBrief queries are reserved for the Helm internal operating workspace."
        : "CustomerDemandBrief 查询只保留给 Helm 自留经营工作区。",
    );
    this.name = "CustomerDemandBriefReservedOnlyError";
  }
}

export function assertReservedWorkspaceForCustomerDemandBrief(
  workspace: ReservedWorkspaceLike | null | undefined,
  english = false,
) {
  if (!isHelmReservedWorkspace(workspace)) {
    throw new CustomerDemandBriefReservedOnlyError(english);
  }
  if (workspace?.status === "CANCELED") {
    throw new CustomerDemandBriefReservedOnlyError(english);
  }
}

export function mapCustomerDemandBriefRow(
  row: PrismaCustomerDemandBrief,
): CustomerDemandBriefRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    leadId: row.leadId,
    briefKey: row.briefKey,
    entryMode: row.entryMode,
    prefillSource: row.prefillSource ?? null,
    customerSummary: row.customerSummary,
    businessPressureTags: safeParseJson<string[]>(row.businessPressureTagsJson, []),
    currentResourceTags: safeParseJson<string[]>(row.currentResourceTagsJson, []),
    resourceEvidenceReadiness: safeParseJson<ResourceEvidenceReadinessEntry[]>(
      row.resourceEvidenceReadinessJson,
      [],
    ),
    painToControlLineCandidates: safeParseJson<string[]>(
      row.painToControlLineCandidatesJson,
      [],
    ),
    roleMap: safeParseJson<CustomerDemandBriefRoleMap>(row.roleMapJson, emptyRoleMap()),
    firstLoopCandidates: safeParseJson<string[]>(row.firstLoopCandidatesJson, []),
    successCriteria: row.successCriteria,
    riskBoundaryTags: safeParseJson<string[]>(row.riskBoundaryTagsJson, []),
    customerVisibleSummary: row.customerVisibleSummary,
    internalSalesNotes: row.internalSalesNotes ?? null,
    trialInitializationPayload: row.trialInitializationPayloadJson
      ? safeParseJson<TrialInitializationPayload | null>(
          row.trialInitializationPayloadJson,
          null,
        )
      : null,
    sourceTrace: safeParseJson<CustomerDemandBriefSourceTraceEntry[]>(
      row.sourceTraceJson,
      [],
    ),
    reviewStatus: row.reviewStatus,
    customerConfirmationStatus: row.customerConfirmationStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCustomerDemandBriefsForReservedWorkspace(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  reviewStatus?: CustomerDemandBriefReviewStatus;
  leadId?: string;
  take?: number;
}): Promise<CustomerDemandBriefRecord[]> {
  assertReservedWorkspaceForCustomerDemandBrief(input.workspace);
  const rows = await db.customerDemandBrief.findMany({
    where: {
      workspaceId: input.workspaceId,
      reviewStatus: input.reviewStatus ?? undefined,
      leadId: input.leadId ?? undefined,
    },
    orderBy: { updatedAt: "desc" },
    take: input.take ?? 50,
  });
  return rows.map(mapCustomerDemandBriefRow);
}

export async function getCustomerDemandBriefByKey(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  briefKey: string;
}): Promise<CustomerDemandBriefRecord | null> {
  assertReservedWorkspaceForCustomerDemandBrief(input.workspace);
  const row = await db.customerDemandBrief.findUnique({
    where: {
      workspaceId_briefKey: {
        workspaceId: input.workspaceId,
        briefKey: input.briefKey,
      },
    },
  });
  return row ? mapCustomerDemandBriefRow(row) : null;
}
