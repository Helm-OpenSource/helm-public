import {
  ActorType,
  CaptureAgentCredentialStatus,
  type CaptureTranscriptRetentionMode,
} from "@prisma/client";
import { safeWriteAuditLog } from "@/lib/audit";
import { assertWorkspaceCaptureServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import {
  issueCaptureAgentToken,
  parseCaptureAgentToken,
  verifyCaptureAgentToken,
} from "@/lib/integrations/agora-field-capture/capture-agent-token";

export class CaptureAgentAuthorizationError extends Error {
  readonly code = "CAPTURE_AGENT_UNAUTHORIZED";

  constructor() {
    super("Capture agent credential is invalid, expired, or revoked");
    this.name = "CaptureAgentAuthorizationError";
  }
}

export function isCaptureAgentAuthorizationError(
  error: unknown,
): error is CaptureAgentAuthorizationError {
  return error instanceof CaptureAgentAuthorizationError;
}

export async function issueCaptureAgentCredential(input: {
  workspaceId: string;
  name: string;
  actorUserId: string;
  actorName: string;
  transcriptRetention: CaptureTranscriptRetentionMode;
  expiresAt?: Date | null;
}) {
  await assertWorkspaceCaptureServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: ActorType.USER,
    english: false,
  });
  const name = input.name.trim();
  if (!name || name.length > 80) {
    throw new Error("Capture agent name must be 1-80 characters");
  }
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
    throw new Error("Capture agent expiry must be in the future");
  }

  const issued = issueCaptureAgentToken();
  const credential = await db.captureAgentCredential.create({
    data: {
      workspaceId: input.workspaceId,
      name,
      tokenPrefix: issued.tokenPrefix,
      tokenHash: issued.tokenHash,
      transcriptRetention: input.transcriptRetention,
      createdByUserId: input.actorUserId,
      expiresAt: input.expiresAt ?? undefined,
    },
  });

  await safeWriteAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "CAPTURE_AGENT_CREDENTIAL_ISSUED",
    targetType: "CaptureAgentCredential",
    targetId: credential.id,
    summary: "Issued a scoped field-capture agent credential",
    payload: {
      tokenPrefix: credential.tokenPrefix,
      transcriptRetention: credential.transcriptRetention,
      expiresAt: credential.expiresAt?.toISOString() ?? null,
    },
    sourcePage: "/api/capture-agents/credentials",
  });

  return {
    token: issued.token,
    credential: {
      id: credential.id,
      workspaceId: credential.workspaceId,
      name: credential.name,
      tokenPrefix: credential.tokenPrefix,
      status: credential.status,
      transcriptRetention: credential.transcriptRetention,
      expiresAt: credential.expiresAt,
      createdAt: credential.createdAt,
    },
  };
}

function extractBearerToken(authorizationHeader: string | null | undefined) {
  if (!authorizationHeader) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match?.[1]?.trim() || null;
}

export async function authenticateCaptureAgentAuthorization(
  authorizationHeader: string | null | undefined,
  options: { now?: Date; touch?: boolean } = {},
) {
  const now = options.now ?? new Date();
  const rawToken = extractBearerToken(authorizationHeader);
  const parsed = parseCaptureAgentToken(rawToken);
  if (!parsed) {
    throw new CaptureAgentAuthorizationError();
  }

  const credential = await db.captureAgentCredential.findUnique({
    where: { tokenPrefix: parsed.tokenPrefix },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      tokenPrefix: true,
      tokenHash: true,
      status: true,
      transcriptRetention: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  const valid =
    credential?.status === CaptureAgentCredentialStatus.ACTIVE &&
    !credential.revokedAt &&
    (!credential.expiresAt || credential.expiresAt.getTime() > now.getTime()) &&
    verifyCaptureAgentToken(parsed.token, credential.tokenHash);
  if (!credential || !valid) {
    throw new CaptureAgentAuthorizationError();
  }

  if (options.touch) {
    const touched = await db.captureAgentCredential.updateMany({
      where: {
        id: credential.id,
        status: CaptureAgentCredentialStatus.ACTIVE,
        revokedAt: null,
      },
      data: { lastSeenAt: now },
    });
    if (touched.count !== 1) {
      throw new CaptureAgentAuthorizationError();
    }
  }

  return {
    id: credential.id,
    workspaceId: credential.workspaceId,
    name: credential.name,
    tokenPrefix: credential.tokenPrefix,
    transcriptRetention: credential.transcriptRetention,
  };
}

export async function revokeCaptureAgentCredential(input: {
  workspaceId: string;
  credentialId: string;
  actorUserId: string;
  actorName: string;
}) {
  await assertWorkspaceCaptureServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: ActorType.USER,
    english: false,
  });
  const activeSession = await db.captureProviderSession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      agentCredentialId: input.credentialId,
      activeAgentSlot: input.credentialId,
    },
    select: { id: true },
  });
  if (activeSession) {
    throw new Error("Stop the active capture session before revoking this agent");
  }

  const revokedAt = new Date();
  const revoked = await db.captureAgentCredential.updateMany({
    where: {
      id: input.credentialId,
      workspaceId: input.workspaceId,
      status: CaptureAgentCredentialStatus.ACTIVE,
      revokedAt: null,
    },
    data: {
      status: CaptureAgentCredentialStatus.REVOKED,
      revokedAt,
    },
  });
  if (revoked.count === 0) {
    throw new Error("Capture agent credential was not found or is already revoked");
  }

  await safeWriteAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "CAPTURE_AGENT_CREDENTIAL_REVOKED",
    targetType: "CaptureAgentCredential",
    targetId: input.credentialId,
    summary: "Revoked a field-capture agent credential",
    payload: { revokedAt: revokedAt.toISOString() },
    sourcePage: `/api/capture-agents/credentials/${input.credentialId}`,
  });

  return { id: input.credentialId, status: CaptureAgentCredentialStatus.REVOKED, revokedAt };
}
