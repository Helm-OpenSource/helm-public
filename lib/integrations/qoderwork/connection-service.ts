import "server-only";

import { randomUUID } from "node:crypto";
import { WorkspaceRole } from "@prisma/client";
import {
  QODERWORK_CONNECTION_SCOPES,
  type QoderWorkConnectionScope,
} from "@/features/qoderwork-intake/mcp-contract";
import { db } from "@/lib/db";
import {
  createExternalAgentBearerToken,
  hashExternalAgentBearerToken,
  parseStoredConnectionScopes,
  parseStoredStringArray,
  serializeExternalAgentConnection,
} from "./connection-security";
import {
  canManageExternalAgentConnections,
  validateExternalAgentObservationBinding,
  validateExternalAgentScopeClassification,
} from "./connection-policy";

export const QODERWORK_PROVIDER_ID = "qoderwork_cn" as const;
export const QODERWORK_TOKEN_TTL_DAYS = 30;
export const QODERWORK_RATE_LIMIT_PER_MINUTE = 60;

const OBJECT_TYPES = new Set(["opportunity", "meeting", "company", "contact", "commitment", "resource"]);
const CLASSIFICATIONS = new Set(["public", "internal", "confidential", "restricted"]);

export class ExternalAgentConnectionError extends Error {
  readonly code:
    | "MANAGEMENT_FORBIDDEN"
    | "INVALID_CONFIGURATION"
    | "NOT_FOUND"
    | "UNAUTHENTICATED"
    | "EXPIRED"
    | "RATE_LIMITED"
    | "RUNTIME_DISABLED";

  constructor(code: ExternalAgentConnectionError["code"], message: string) {
    super(message);
    this.name = "ExternalAgentConnectionError";
    this.code = code;
  }
}

export async function createQoderWorkConnection(input: {
  workspaceId: string;
  userId: string;
  actorRole: WorkspaceRole;
  displayName: string;
  observationProgramId: string;
  allowedSourceIds: readonly string[];
  allowedObjectTypes: readonly string[];
  scopes: readonly string[];
  maxDataClassification: string;
  now?: Date;
}) {
  assertManager(input.actorRole);
  const now = input.now ?? new Date();
  const policy = normalizeConnectionPolicy(input);
  const [program, sources] = await Promise.all([
    db.enterpriseObservationProgram.findFirst({
      where: { id: input.observationProgramId, workspaceId: input.workspaceId },
      select: { id: true, workspaceId: true, status: true, expiresAt: true },
    }),
    db.observationSource.findMany({
      where: { id: { in: policy.allowedSourceIds }, workspaceId: input.workspaceId },
      select: { id: true, workspaceId: true, programId: true, status: true, accessMode: true },
    }),
  ]);
  const blockers = validateExternalAgentObservationBinding({
    now,
    workspaceId: input.workspaceId,
    program,
    requestedSourceIds: policy.allowedSourceIds,
    sources,
  });
  if (blockers.length > 0) {
    throw new ExternalAgentConnectionError(
      "INVALID_CONFIGURATION",
      `Observation binding rejected: ${blockers.join(", ")}`,
    );
  }

  const secret = createExternalAgentBearerToken();
  const connection = await db.externalAgentConnection.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      observationProgramId: input.observationProgramId,
      providerId: QODERWORK_PROVIDER_ID,
      deviceRef: `device:${randomUUID()}`,
      displayName: input.displayName.trim(),
      tokenHash: secret.tokenHash,
      tokenPrefix: secret.tokenPrefix,
      scopesJson: JSON.stringify(policy.scopes),
      allowedSourceIdsJson: JSON.stringify(policy.allowedSourceIds),
      allowedObjectTypesJson: JSON.stringify(policy.allowedObjectTypes),
      maxDataClassification: policy.maxDataClassification,
      expiresAt: new Date(now.getTime() + QODERWORK_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      rateWindowStartedAt: now,
    },
  });
  return { connection: serializeExternalAgentConnection(connection, now), token: secret.token };
}

export async function listQoderWorkConnections(workspaceId: string, now = new Date()) {
  const connections = await db.externalAgentConnection.findMany({
    where: { workspaceId, providerId: QODERWORK_PROVIDER_ID },
    orderBy: { createdAt: "desc" },
  });
  return connections.map((connection) => serializeExternalAgentConnection(connection, now));
}

export async function rotateQoderWorkConnection(input: {
  workspaceId: string;
  connectionId: string;
  actorRole: WorkspaceRole;
  now?: Date;
}) {
  assertManager(input.actorRole);
  const now = input.now ?? new Date();
  const existing = await db.externalAgentConnection.findFirst({
    where: { id: input.connectionId, workspaceId: input.workspaceId, providerId: QODERWORK_PROVIDER_ID },
  });
  if (!existing || existing.revokedAt) throw new ExternalAgentConnectionError("NOT_FOUND", "Connection not found");
  const secret = createExternalAgentBearerToken();
  const connection = await db.externalAgentConnection.update({
    where: { id: existing.id },
    data: {
      tokenHash: secret.tokenHash,
      tokenPrefix: secret.tokenPrefix,
      expiresAt: new Date(now.getTime() + QODERWORK_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      lastFailureCode: null,
      rateWindowStartedAt: now,
      rateWindowRequestCount: 0,
    },
  });
  return { connection: serializeExternalAgentConnection(connection, now), token: secret.token };
}

export async function revokeQoderWorkConnection(input: {
  workspaceId: string;
  connectionId: string;
  actorUserId: string;
  actorRole: WorkspaceRole;
  now?: Date;
}) {
  assertManager(input.actorRole);
  const now = input.now ?? new Date();
  const updated = await db.externalAgentConnection.updateMany({
    where: {
      id: input.connectionId,
      workspaceId: input.workspaceId,
      providerId: QODERWORK_PROVIDER_ID,
      revokedAt: null,
    },
    data: { revokedAt: now, revokedByUserId: input.actorUserId, lastFailureCode: "REVOKED" },
  });
  if (updated.count !== 1) throw new ExternalAgentConnectionError("NOT_FOUND", "Connection not found");
  return { revokedAt: now.toISOString() };
}

export async function authenticateQoderWorkConnection(rawToken: string, now = new Date()) {
  if (!/^hqw_[A-Za-z0-9_-]{43}$/.test(rawToken)) {
    throw new ExternalAgentConnectionError("UNAUTHENTICATED", "Invalid external agent credential");
  }
  const connection = await db.externalAgentConnection.findUnique({
    where: { tokenHash: hashExternalAgentBearerToken(rawToken) },
    include: {
      workspace: { select: { featureFlagsJson: true } },
      observationProgram: { select: { workspaceId: true, status: true, expiresAt: true } },
    },
  });
  if (!connection || connection.providerId !== QODERWORK_PROVIDER_ID || connection.revokedAt) {
    throw new ExternalAgentConnectionError("UNAUTHENTICATED", "Invalid external agent credential");
  }
  if (connection.expiresAt.getTime() <= now.getTime()) {
    await recordKnownConnectionFailure(connection.id, "EXPIRED");
    throw new ExternalAgentConnectionError("EXPIRED", "External agent credential expired");
  }
  if (
    connection.observationProgram.workspaceId !== connection.workspaceId ||
    connection.observationProgram.status !== "ACTIVE" ||
    connection.observationProgram.expiresAt.getTime() <= now.getTime()
  ) {
    await recordKnownConnectionFailure(connection.id, "OBSERVATION_PROGRAM_INACTIVE");
    throw new ExternalAgentConnectionError("EXPIRED", "Observation authorization is not active");
  }
  if (!isQoderWorkRuntimeEnabled(connection.workspace.featureFlagsJson)) {
    await recordKnownConnectionFailure(connection.id, "RUNTIME_DISABLED");
    throw new ExternalAgentConnectionError("RUNTIME_DISABLED", "External agent runtime is disabled");
  }
  await claimRateLimit(connection.id, now);
  await db.externalAgentConnection.update({
    where: { id: connection.id },
    data: { lastConnectedAt: now, lastFailureCode: null },
  });
  return {
    connectionId: connection.id,
    workspaceId: connection.workspaceId,
    userId: connection.userId,
    deviceRef: connection.deviceRef,
    observationProgramId: connection.observationProgramId,
    scopes: parseStoredConnectionScopes(connection.scopesJson),
    allowedSourceIds: parseStoredStringArray(connection.allowedSourceIdsJson),
    allowedObjectTypes: parseStoredStringArray(connection.allowedObjectTypesJson),
    maxDataClassification: connection.maxDataClassification,
    approvedModelProfileRefs: readApprovedModelProfileRefs(connection.workspace.featureFlagsJson),
  };
}

export function isQoderWorkRuntimeEnabled(featureFlagsJson: string | null | undefined) {
  if (process.env.HELM_QODERWORK_MCP_ENABLED !== "true") return false;
  try {
    const flags = JSON.parse(featureFlagsJson ?? "{}");
    return flags?.qoderworkOwnerLoopMcp === true;
  } catch {
    return false;
  }
}

export async function recordQoderWorkClientInfo(input: {
  connectionId: string;
  clientName: string;
  clientVersion: string;
}) {
  const clientName = normalizeClientInfo(input.clientName);
  const clientVersion = normalizeClientInfo(input.clientVersion);
  if (!clientName || !clientVersion) return;
  await db.externalAgentConnection.update({
    where: { id: input.connectionId },
    data: { lastClientName: clientName, lastClientVersion: clientVersion },
  });
}

function normalizeClientInfo(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 80 && /^[A-Za-z0-9 ._+()/-]+$/.test(normalized)
    ? normalized
    : null;
}

function readApprovedModelProfileRefs(featureFlagsJson: string | null | undefined): string[] {
  try {
    const flags = JSON.parse(featureFlagsJson ?? "{}");
    return Array.isArray(flags?.qoderworkApprovedModelProfileRefs)
      ? flags.qoderworkApprovedModelProfileRefs.filter(
          (value: unknown): value is string => typeof value === "string" && value.length <= 191,
        )
      : [];
  } catch {
    return [];
  }
}

async function claimRateLimit(connectionId: string, now: Date) {
  const cutoff = new Date(now.getTime() - 60_000);
  const reset = await db.externalAgentConnection.updateMany({
    where: { id: connectionId, rateWindowStartedAt: { lte: cutoff } },
    data: { rateWindowStartedAt: now, rateWindowRequestCount: 1 },
  });
  if (reset.count === 1) return;
  const incremented = await db.externalAgentConnection.updateMany({
    where: {
      id: connectionId,
      rateWindowStartedAt: { gt: cutoff },
      rateWindowRequestCount: { lt: QODERWORK_RATE_LIMIT_PER_MINUTE },
    },
    data: { rateWindowRequestCount: { increment: 1 } },
  });
  if (incremented.count !== 1) {
    await recordKnownConnectionFailure(connectionId, "RATE_LIMITED");
    throw new ExternalAgentConnectionError("RATE_LIMITED", "External agent rate limit exceeded");
  }
}

function normalizeConnectionPolicy(input: {
  displayName: string;
  allowedSourceIds: readonly string[];
  allowedObjectTypes: readonly string[];
  scopes: readonly string[];
  maxDataClassification: string;
}) {
  const allowedScopes = new Set<string>(QODERWORK_CONNECTION_SCOPES);
  const scopes = [...new Set(input.scopes)];
  const sourceIds = [...new Set(input.allowedSourceIds)];
  const objectTypes = [...new Set(input.allowedObjectTypes)];
  const invalid =
    input.displayName.trim().length < 2 ||
    input.displayName.trim().length > 80 ||
    scopes.length === 0 ||
    scopes.some((scope) => !allowedScopes.has(scope)) ||
    sourceIds.length === 0 ||
    sourceIds.some((sourceId) => !/^[A-Za-z0-9][A-Za-z0-9:._-]{2,190}$/.test(sourceId)) ||
    objectTypes.length === 0 ||
    objectTypes.some((type) => !OBJECT_TYPES.has(type)) ||
    !CLASSIFICATIONS.has(input.maxDataClassification);
  if (invalid) {
    throw new ExternalAgentConnectionError("INVALID_CONFIGURATION", "Invalid external agent connection policy");
  }
  const scopeClassificationBlockers = validateExternalAgentScopeClassification({
    scopes,
    maxDataClassification: input.maxDataClassification,
  });
  if (scopeClassificationBlockers.length > 0) {
    throw new ExternalAgentConnectionError(
      "INVALID_CONFIGURATION",
      `External agent scope classification rejected: ${scopeClassificationBlockers.join(", ")}`,
    );
  }
  return {
    scopes: scopes as QoderWorkConnectionScope[],
    allowedSourceIds: sourceIds,
    allowedObjectTypes: objectTypes,
    maxDataClassification: input.maxDataClassification,
  };
}

function assertManager(role: WorkspaceRole) {
  if (!canManageExternalAgentConnections(role)) {
    throw new ExternalAgentConnectionError("MANAGEMENT_FORBIDDEN", "Only OWNER or ADMIN may manage external agent connections");
  }
}

async function recordKnownConnectionFailure(connectionId: string, code: string) {
  await db.externalAgentConnection.update({ where: { id: connectionId }, data: { lastFailureCode: code } });
}
