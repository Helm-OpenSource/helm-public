import "server-only";

import { db } from "@/lib/db";
import { isHelmReservedWorkspace } from "@/lib/workspace-identity";
import { safeParseJson } from "@/lib/utils";
import type {
  OperatingControlLineCandidate as PrismaCandidate,
  Workspace,
} from "@prisma/client";
import type {
  OperatingControlLineCandidateEvidenceNote,
  OperatingControlLineCandidateRecord,
  OperatingControlLineCandidateStatus,
} from "./types";

type ReservedWorkspaceLike = Pick<Workspace, "workspaceClass" | "systemKey"> & {
  status?: Workspace["status"] | null;
};

export class OperatingControlLineCandidateReservedOnlyError extends Error {
  constructor(english = false) {
    super(
      english
        ? "OperatingControlLineCandidate queries are reserved for the Helm internal operating workspace."
        : "OperatingControlLineCandidate 查询只保留给 Helm 自留经营工作区。",
    );
    this.name = "OperatingControlLineCandidateReservedOnlyError";
  }
}

export function assertReservedWorkspaceForControlLineCandidate(
  workspace: ReservedWorkspaceLike | null | undefined,
  english = false,
) {
  if (!isHelmReservedWorkspace(workspace)) {
    throw new OperatingControlLineCandidateReservedOnlyError(english);
  }
  if (workspace?.status === "CANCELED") {
    throw new OperatingControlLineCandidateReservedOnlyError(english);
  }
}

export function mapControlLineCandidateRow(
  row: PrismaCandidate,
): OperatingControlLineCandidateRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    briefId: row.briefId,
    candidateKey: row.candidateKey,
    painTag: row.painTag,
    controlLineTemplate: row.controlLineTemplate,
    targetBusinessObject: row.targetBusinessObject,
    resourceInputs: safeParseJson<string[]>(row.resourceInputsJson, []),
    evidenceReadiness: row.evidenceReadiness,
    status: row.status,
    evidenceNotes: safeParseJson<OperatingControlLineCandidateEvidenceNote[]>(
      row.evidenceNotesJson,
      [],
    ),
    reviewerNotes: row.reviewerNotes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listControlLineCandidatesForReservedWorkspace(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  status?: OperatingControlLineCandidateStatus;
  briefId?: string;
  take?: number;
}): Promise<OperatingControlLineCandidateRecord[]> {
  assertReservedWorkspaceForControlLineCandidate(input.workspace);
  const rows = await db.operatingControlLineCandidate.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: input.status ?? undefined,
      briefId: input.briefId ?? undefined,
    },
    orderBy: { updatedAt: "desc" },
    take: input.take ?? 50,
  });
  return rows.map(mapControlLineCandidateRow);
}

export async function getControlLineCandidateByKey(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  candidateKey: string;
}): Promise<OperatingControlLineCandidateRecord | null> {
  assertReservedWorkspaceForControlLineCandidate(input.workspace);
  const row = await db.operatingControlLineCandidate.findUnique({
    where: {
      workspaceId_candidateKey: {
        workspaceId: input.workspaceId,
        candidateKey: input.candidateKey,
      },
    },
  });
  return row ? mapControlLineCandidateRow(row) : null;
}

export async function countControlLineCandidatesByStatus(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
}): Promise<Record<OperatingControlLineCandidateStatus, number>> {
  assertReservedWorkspaceForControlLineCandidate(input.workspace);
  const grouped = await db.operatingControlLineCandidate.groupBy({
    by: ["status"],
    where: { workspaceId: input.workspaceId },
    _count: { _all: true },
  });
  const counts = {} as Record<OperatingControlLineCandidateStatus, number>;
  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }
  return counts;
}
