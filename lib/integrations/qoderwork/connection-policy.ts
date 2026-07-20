import { WorkspaceRole } from "@prisma/client";

const READ_ONLY_ACCESS_MODES = new Set([
  "read_only_api",
  "read_only_replica",
  "scheduled_snapshot",
  "file_snapshot",
]);

const INTERNAL_READ_SCOPES = new Set([
  "context:read",
  "decision:read",
  "work-packet:read",
  "supervision:read",
]);

export function canManageExternalAgentConnections(role: WorkspaceRole | null | undefined) {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}

export function validateExternalAgentScopeClassification(input: {
  scopes: readonly string[];
  maxDataClassification: string;
}) {
  return input.maxDataClassification === "public" &&
    input.scopes.some((scope) => INTERNAL_READ_SCOPES.has(scope))
    ? ["internal_read_projection_not_authorized"]
    : [];
}

type ProgramBinding = {
  id: string;
  workspaceId: string;
  status: string;
  expiresAt: Date;
};

type SourceBinding = {
  id: string;
  workspaceId: string;
  programId: string;
  status: string;
  accessMode: string;
};

export function validateExternalAgentObservationBinding(input: {
  now: Date;
  workspaceId: string;
  program: ProgramBinding | null;
  requestedSourceIds: readonly string[];
  sources: readonly SourceBinding[];
}) {
  const blockers: string[] = [];
  if (!input.program) return ["program_missing"];
  if (input.program.workspaceId !== input.workspaceId) blockers.push("program_workspace_mismatch");
  if (input.program.status !== "ACTIVE") blockers.push("program_not_active");
  if (input.program.expiresAt.getTime() <= input.now.getTime()) blockers.push("program_expired");
  if (input.requestedSourceIds.length === 0) blockers.push("source_scope_empty");

  const sourcesById = new Map(input.sources.map((source) => [source.id, source]));
  for (const sourceId of new Set(input.requestedSourceIds)) {
    const source = sourcesById.get(sourceId);
    if (
      !source ||
      source.workspaceId !== input.workspaceId ||
      source.programId !== input.program.id
    ) {
      blockers.push("source_missing_or_out_of_scope");
      continue;
    }
    if (source.status !== "ACTIVE") blockers.push("source_not_active");
    if (!READ_ONLY_ACCESS_MODES.has(source.accessMode)) {
      blockers.push("source_access_mode_not_read_only");
    }
  }
  return [...new Set(blockers)];
}
