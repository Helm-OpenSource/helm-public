import { createHash, randomBytes } from "node:crypto";
import {
  QODERWORK_CONNECTION_SCOPES,
  type QoderWorkConnectionScope,
} from "@/features/qoderwork-intake/mcp-contract";

const TOKEN_PREFIX = "hqw_";
const TOKEN_BYTES = 32;
const TOKEN_VISIBLE_PREFIX_LENGTH = 12;

export function createExternalAgentBearerToken() {
  const token = `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
  return {
    token,
    tokenHash: hashExternalAgentBearerToken(token),
    tokenPrefix: token.slice(0, TOKEN_VISIBLE_PREFIX_LENGTH),
  } as const;
}

export function hashExternalAgentBearerToken(token: string) {
  return `sha256:${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

export function parseStoredConnectionScopes(value: string): QoderWorkConnectionScope[] {
  const parsed = safeJsonArray(value);
  const allowed = new Set<string>(QODERWORK_CONNECTION_SCOPES);
  return [...new Set(parsed.filter((item): item is QoderWorkConnectionScope => allowed.has(item)))];
}

export function parseStoredStringArray(value: string): string[] {
  return [...new Set(safeJsonArray(value))];
}

function safeJsonArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

type StoredExternalAgentConnection = {
  id: string;
  providerId: string;
  deviceRef: string;
  displayName: string;
  tokenHash: string;
  tokenPrefix: string;
  scopesJson: string;
  allowedSourceIdsJson: string;
  allowedObjectTypesJson: string;
  maxDataClassification: string;
  observationProgramId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastConnectedAt: Date | null;
  lastClientName?: string | null;
  lastClientVersion?: string | null;
  lastFailureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeExternalAgentConnection(
  connection: StoredExternalAgentConnection,
  now = new Date(),
) {
  return {
    id: connection.id,
    providerId: connection.providerId,
    deviceRef: connection.deviceRef,
    displayName: connection.displayName,
    tokenPrefix: connection.tokenPrefix,
    scopes: parseStoredConnectionScopes(connection.scopesJson),
    allowedSourceIds: parseStoredStringArray(connection.allowedSourceIdsJson),
    allowedObjectTypes: parseStoredStringArray(connection.allowedObjectTypesJson),
    maxDataClassification: connection.maxDataClassification,
    observationProgramId: connection.observationProgramId,
    status: connection.revokedAt
      ? ("revoked" as const)
      : connection.expiresAt.getTime() <= now.getTime()
        ? ("expired" as const)
        : ("active" as const),
    expiresAt: connection.expiresAt.toISOString(),
    revokedAt: connection.revokedAt?.toISOString() ?? null,
    lastConnectedAt: connection.lastConnectedAt?.toISOString() ?? null,
    lastClientName: connection.lastClientName ?? null,
    lastClientVersion: connection.lastClientVersion ?? null,
    lastFailureCode: connection.lastFailureCode,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}
