import "server-only";

import { db } from "@/lib/db";
import { isHelmReservedWorkspace } from "@/lib/workspace-identity";
import { safeParseJson } from "@/lib/utils";
import type {
  DiagnosticSession as PrismaDiagnosticSession,
  Workspace,
} from "@prisma/client";
import type {
  DiagnosticSessionRecord,
  DiagnosticSessionRoleReadiness,
  DiagnosticSessionSourceTraceEntry,
  DiagnosticSessionStatus,
} from "./types";
import { emptyRoleReadiness } from "./types";

type ReservedWorkspaceLike = Pick<Workspace, "workspaceClass" | "systemKey"> & {
  status?: Workspace["status"] | null;
};

export class DiagnosticSessionReservedOnlyError extends Error {
  constructor(english = false) {
    super(
      english
        ? "DiagnosticSession queries are reserved for the Helm internal operating workspace."
        : "DiagnosticSession 查询只保留给 Helm 自留经营工作区。",
    );
    this.name = "DiagnosticSessionReservedOnlyError";
  }
}

export function assertReservedWorkspaceForDiagnosticSession(
  workspace: ReservedWorkspaceLike | null | undefined,
  english = false,
) {
  if (!isHelmReservedWorkspace(workspace)) {
    throw new DiagnosticSessionReservedOnlyError(english);
  }
  if (workspace?.status === "CANCELED") {
    throw new DiagnosticSessionReservedOnlyError(english);
  }
}

export function mapDiagnosticSessionRow(
  row: PrismaDiagnosticSession,
): DiagnosticSessionRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    leadId: row.leadId,
    briefId: row.briefId ?? null,
    controlLineCandidateId: row.controlLineCandidateId ?? null,
    diagnosticKey: row.diagnosticKey,
    workspaceCandidate: row.workspaceCandidate ?? null,
    businessGoal: row.businessGoal,
    availableResources: safeParseJson<string[]>(row.availableResourcesJson, []),
    roleReadiness: safeParseJson<DiagnosticSessionRoleReadiness>(
      row.roleReadinessJson,
      emptyRoleReadiness(),
    ),
    firstLoopCandidateType: row.firstLoopCandidateType ?? null,
    firstLoopCandidateNote: row.firstLoopCandidateNote ?? null,
    riskNotes: safeParseJson<string[]>(row.riskNotesJson, []),
    boundaryNotes: safeParseJson<string[]>(row.boundaryNotesJson, []),
    status: row.status,
    reviewerActor: row.reviewerActor ?? null,
    reviewerDecisionNote: row.reviewerDecisionNote ?? null,
    sourceTrace: safeParseJson<DiagnosticSessionSourceTraceEntry[]>(
      row.sourceTraceJson,
      [],
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDiagnosticSessionsForReservedWorkspace(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  status?: DiagnosticSessionStatus;
  leadId?: string;
  take?: number;
}): Promise<DiagnosticSessionRecord[]> {
  assertReservedWorkspaceForDiagnosticSession(input.workspace);
  const rows = await db.diagnosticSession.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: input.status ?? undefined,
      leadId: input.leadId ?? undefined,
    },
    orderBy: { updatedAt: "desc" },
    take: input.take ?? 50,
  });
  return rows.map(mapDiagnosticSessionRow);
}

export async function getDiagnosticSessionByKey(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  diagnosticKey: string;
}): Promise<DiagnosticSessionRecord | null> {
  assertReservedWorkspaceForDiagnosticSession(input.workspace);
  const row = await db.diagnosticSession.findUnique({
    where: {
      workspaceId_diagnosticKey: {
        workspaceId: input.workspaceId,
        diagnosticKey: input.diagnosticKey,
      },
    },
  });
  return row ? mapDiagnosticSessionRow(row) : null;
}
