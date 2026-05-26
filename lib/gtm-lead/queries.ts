import "server-only";

import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";
import type {
  GtmLead as PrismaGtmLead,
  Workspace,
} from "@prisma/client";
import { isHelmReservedWorkspace } from "@/lib/workspace-identity";
import type { GtmLeadRecord, GtmLeadStage } from "./types";

// GTMLead 是 reserved-only 对象。任何 query / action 都必须先在 caller 层做
// workspace gating；本 helper 给出一个统一的 throw-if-not-reserved 收敛，
// 让所有 reserved-only callers 用同样的口径。
type ReservedWorkspaceLike = Pick<Workspace, "workspaceClass" | "systemKey"> & {
  status?: Workspace["status"] | null;
};

export class GtmLeadReservedOnlyError extends Error {
  constructor(english = false) {
    super(
      english
        ? "GtmLead queries are reserved for the Helm internal operating workspace."
        : "GtmLead 查询只保留给 Helm 自留经营工作区。",
    );
    this.name = "GtmLeadReservedOnlyError";
  }
}

export function assertReservedWorkspaceForGtmLead(
  workspace: ReservedWorkspaceLike | null | undefined,
  english = false,
) {
  if (!isHelmReservedWorkspace(workspace)) {
    throw new GtmLeadReservedOnlyError(english);
  }
  // CANCELED reserved workspace 不应再接受 GtmLead 写入 / 复核。
  if (workspace?.status === "CANCELED") {
    throw new GtmLeadReservedOnlyError(english);
  }
}

export function mapGtmLeadRow(row: PrismaGtmLead): GtmLeadRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    leadKey: row.leadKey,
    sourceType: row.sourceType,
    sourceRef: row.sourceRef ?? null,
    referrerMembershipId: row.referrerMembershipId ?? null,
    companyName: row.companyName,
    industry: row.industry ?? null,
    icpFit: row.icpFit,
    readinessStage: row.readinessStage,
    ownerMembershipId: row.ownerMembershipId ?? null,
    stage: row.stage,
    nextAction: row.nextAction ?? null,
    blocker: row.blocker ?? null,
    evidenceRefs: safeParseJson<string[]>(row.evidenceRefsJson ?? null, []),
    internalNotes: row.internalNotes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listGtmLeadsForReservedWorkspace(input: {
  workspace: ReservedWorkspaceLike;
  stage?: GtmLeadStage;
  ownerMembershipId?: string | null;
  take?: number;
  workspaceId: string;
}): Promise<GtmLeadRecord[]> {
  assertReservedWorkspaceForGtmLead(input.workspace);
  const rows = await db.gtmLead.findMany({
    where: {
      workspaceId: input.workspaceId,
      stage: input.stage ?? undefined,
      ownerMembershipId: input.ownerMembershipId ?? undefined,
    },
    orderBy: { updatedAt: "desc" },
    take: input.take ?? 50,
  });
  return rows.map(mapGtmLeadRow);
}

export async function getGtmLeadByKey(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  leadKey: string;
}): Promise<GtmLeadRecord | null> {
  assertReservedWorkspaceForGtmLead(input.workspace);
  const row = await db.gtmLead.findUnique({
    where: {
      workspaceId_leadKey: {
        workspaceId: input.workspaceId,
        leadKey: input.leadKey,
      },
    },
  });
  return row ? mapGtmLeadRow(row) : null;
}

export async function countGtmLeadsByStage(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
}): Promise<Record<GtmLeadStage, number>> {
  assertReservedWorkspaceForGtmLead(input.workspace);
  const grouped = await db.gtmLead.groupBy({
    by: ["stage"],
    where: { workspaceId: input.workspaceId },
    _count: { _all: true },
  });
  const counts = {} as Record<GtmLeadStage, number>;
  for (const row of grouped) {
    counts[row.stage] = row._count._all;
  }
  return counts;
}
