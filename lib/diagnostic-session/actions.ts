import "server-only";

import { db } from "@/lib/db";
import {
  DiagnosticSessionReservedOnlyError,
  assertReservedWorkspaceForDiagnosticSession,
  mapDiagnosticSessionRow,
} from "./queries";
import type {
  DiagnosticSessionCreateInput,
  DiagnosticSessionRecord,
  DiagnosticSessionRoleReadiness,
  DiagnosticSessionSourceTraceEntry,
  DiagnosticSessionStatus,
  FirstLoopType,
} from "./types";
import {
  canEnterFirstLoopSelected,
  emptyRoleReadiness,
  isValidDiagnosticSessionStatusTransition,
} from "./types";
import type { Workspace } from "@prisma/client";

type ReservedWorkspaceLike = Pick<Workspace, "workspaceClass" | "systemKey"> & {
  status?: Workspace["status"] | null;
};

export class DiagnosticSessionStatusTransitionError extends Error {
  constructor(
    public readonly from: DiagnosticSessionStatus,
    public readonly to: DiagnosticSessionStatus,
  ) {
    super(`DiagnosticSession status transition not allowed: ${from} → ${to}`);
    this.name = "DiagnosticSessionStatusTransitionError";
  }
}

export class DiagnosticSessionFirstLoopGateError extends Error {
  constructor(public readonly missingDimensions: string[]) {
    super(
      `FIRST_LOOP_SELECTED gate not met (V2.3 §6.5). Missing: ${missingDimensions.join(", ")}`,
    );
    this.name = "DiagnosticSessionFirstLoopGateError";
  }
}

function jsonOr<T>(value: T | null | undefined, fallback: T): string {
  return JSON.stringify(value ?? fallback);
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
  existing: DiagnosticSessionSourceTraceEntry[],
  next: DiagnosticSessionSourceTraceEntry,
) {
  return [...existing, next];
}

export async function createDiagnosticSession(input: {
  workspace: ReservedWorkspaceLike;
  data: DiagnosticSessionCreateInput;
}): Promise<DiagnosticSessionRecord> {
  assertReservedWorkspaceForDiagnosticSession(input.workspace);
  const { data } = input;
  if (!data.workspaceId) throw new Error("workspaceId is required");
  if (!data.leadId) throw new Error("leadId is required");
  if (!data.diagnosticKey?.trim()) throw new Error("diagnosticKey is required");
  if (!data.businessGoal?.trim()) throw new Error("businessGoal is required");

  const row = await db.diagnosticSession.create({
    data: {
      workspaceId: data.workspaceId,
      leadId: data.leadId,
      briefId: data.briefId ?? null,
      controlLineCandidateId: data.controlLineCandidateId ?? null,
      diagnosticKey: data.diagnosticKey.trim(),
      workspaceCandidate: data.workspaceCandidate?.trim() || null,
      businessGoal: data.businessGoal.trim(),
      availableResourcesJson: jsonOr(data.availableResources, []),
      roleReadinessJson: jsonOr(data.roleReadiness, emptyRoleReadiness()),
      firstLoopCandidateType: data.firstLoopCandidateType ?? null,
      firstLoopCandidateNote: data.firstLoopCandidateNote?.trim() || null,
      riskNotesJson: jsonOr(data.riskNotes, []),
      boundaryNotesJson: jsonOr(data.boundaryNotes, []),
      status: "DRAFT",
      reviewerActor: null,
      reviewerDecisionNote: null,
      sourceTraceJson: jsonOr(data.initialSourceTrace, []),
    },
  });
  return mapDiagnosticSessionRow(row);
}

export async function updateDiagnosticSessionFindings(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  diagnosticKey: string;
  patch: {
    workspaceCandidate?: string | null;
    availableResources?: readonly string[];
    roleReadiness?: DiagnosticSessionRoleReadiness;
    firstLoopCandidateType?: FirstLoopType | null;
    firstLoopCandidateNote?: string | null;
    riskNotes?: readonly string[];
    boundaryNotes?: readonly string[];
  };
  actor: string;
  note: string;
}): Promise<DiagnosticSessionRecord> {
  assertReservedWorkspaceForDiagnosticSession(input.workspace);
  if (!input.note?.trim()) throw new Error("note is required (V2.3 §10.10 append-first)");
  const existing = await db.diagnosticSession.findUnique({
    where: {
      workspaceId_diagnosticKey: {
        workspaceId: input.workspaceId,
        diagnosticKey: input.diagnosticKey,
      },
    },
  });
  if (!existing) throw new Error(`DiagnosticSession not found: ${input.diagnosticKey}`);

  const data: Record<string, unknown> = {};
  const patch = input.patch;
  if (patch.workspaceCandidate !== undefined)
    data.workspaceCandidate = patch.workspaceCandidate?.trim() || null;
  if (patch.availableResources !== undefined)
    data.availableResourcesJson = JSON.stringify([...patch.availableResources]);
  if (patch.roleReadiness !== undefined)
    data.roleReadinessJson = JSON.stringify(patch.roleReadiness);
  if (patch.firstLoopCandidateType !== undefined)
    data.firstLoopCandidateType = patch.firstLoopCandidateType;
  if (patch.firstLoopCandidateNote !== undefined)
    data.firstLoopCandidateNote = patch.firstLoopCandidateNote?.trim() || null;
  if (patch.riskNotes !== undefined)
    data.riskNotesJson = JSON.stringify([...patch.riskNotes]);
  if (patch.boundaryNotes !== undefined)
    data.boundaryNotesJson = JSON.stringify([...patch.boundaryNotes]);
  if (Object.keys(data).length === 0) {
    return mapDiagnosticSessionRow(existing);
  }

  const trace = appendTrace(
    safeJsonArray<DiagnosticSessionSourceTraceEntry>(existing.sourceTraceJson),
    {
      ts: new Date().toISOString(),
      origin: "intake_sync",
      actor: input.actor,
      note: input.note.trim(),
    },
  );
  data.sourceTraceJson = JSON.stringify(trace);

  const updated = await db.diagnosticSession.update({
    where: {
      workspaceId_diagnosticKey: {
        workspaceId: input.workspaceId,
        diagnosticKey: input.diagnosticKey,
      },
    },
    data,
  });
  return mapDiagnosticSessionRow(updated);
}

export async function updateDiagnosticSessionStatus(input: {
  workspace: ReservedWorkspaceLike;
  workspaceId: string;
  diagnosticKey: string;
  nextStatus: DiagnosticSessionStatus;
  reviewerActor: string;
  reviewerDecisionNote: string;
}): Promise<DiagnosticSessionRecord> {
  assertReservedWorkspaceForDiagnosticSession(input.workspace);
  if (!input.reviewerDecisionNote?.trim()) {
    throw new Error("reviewerDecisionNote is required (V2.3 §10.10 append-first)");
  }
  if (!input.reviewerActor?.trim()) throw new Error("reviewerActor is required");

  const existing = await db.diagnosticSession.findUnique({
    where: {
      workspaceId_diagnosticKey: {
        workspaceId: input.workspaceId,
        diagnosticKey: input.diagnosticKey,
      },
    },
  });
  if (!existing) throw new Error(`DiagnosticSession not found: ${input.diagnosticKey}`);

  if (!isValidDiagnosticSessionStatusTransition(existing.status, input.nextStatus)) {
    throw new DiagnosticSessionStatusTransitionError(existing.status, input.nextStatus);
  }

  // V2.3 §6.5 gate：FIRST_LOOP_SELECTED 必须满足 4 个维度 + firstLoopCandidateType。
  if (input.nextStatus === "FIRST_LOOP_SELECTED") {
    let readiness: DiagnosticSessionRoleReadiness;
    try {
      readiness = JSON.parse(existing.roleReadinessJson) as DiagnosticSessionRoleReadiness;
    } catch {
      readiness = emptyRoleReadiness();
    }
    const gate = canEnterFirstLoopSelected(readiness, existing.firstLoopCandidateType);
    if (!gate.ok) {
      throw new DiagnosticSessionFirstLoopGateError(gate.missing);
    }
  }

  const trace = appendTrace(
    safeJsonArray<DiagnosticSessionSourceTraceEntry>(existing.sourceTraceJson),
    {
      ts: new Date().toISOString(),
      origin: "internal_review",
      actor: input.reviewerActor.trim(),
      note: `${existing.status} → ${input.nextStatus}: ${input.reviewerDecisionNote.trim()}`,
    },
  );

  const updated = await db.diagnosticSession.update({
    where: {
      workspaceId_diagnosticKey: {
        workspaceId: input.workspaceId,
        diagnosticKey: input.diagnosticKey,
      },
    },
    data: {
      status: input.nextStatus,
      reviewerActor: input.reviewerActor.trim(),
      reviewerDecisionNote: input.reviewerDecisionNote.trim(),
      sourceTraceJson: JSON.stringify(trace),
    },
  });
  return mapDiagnosticSessionRow(updated);
}

export { DiagnosticSessionReservedOnlyError };
