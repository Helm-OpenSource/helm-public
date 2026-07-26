import { ActorType } from "@prisma/client";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  ExternalAgentConnectionError,
  createQoderWorkConnection,
  isQoderWorkRuntimeEnabled,
  listQoderWorkConnections,
  revokeQoderWorkConnection,
  rotateQoderWorkConnection,
} from "@/lib/integrations/qoderwork/connection-service";

const createSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    observationProgramId: z.string().min(3).max(191),
    allowedSourceIds: z.array(z.string().min(3).max(191)).min(1).max(20),
    allowedObjectTypes: z.array(z.enum(["opportunity", "meeting", "company", "contact", "commitment", "resource"])).min(1).max(6),
    scopes: z.array(z.enum([
      "context:read",
      "decision:read",
      "work-packet:read",
      "supervision:read",
      "evidence:propose",
      "draft:propose",
      "receipt:propose",
    ])).min(1).max(7),
    maxDataClassification: z.enum(["public", "internal", "confidential", "restricted"]),
  })
  .strict();

const mutateSchema = z
  .object({
    connectionId: z.string().min(3).max(191),
    action: z.enum(["rotate", "revoke"]),
  })
  .strict();

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET() {
  const { membership, workspace } = await getCurrentWorkspaceSession();
  if (!isManager(membership.role)) return jsonError("MANAGEMENT_FORBIDDEN", 403);
  const now = new Date();
  const [connections, programs] = await Promise.all([
    listQoderWorkConnections(workspace.id, now),
    db.enterpriseObservationProgram.findMany({
      where: { workspaceId: workspace.id, status: "ACTIVE", expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        purpose: true,
        expiresAt: true,
        retentionDays: true,
        sources: {
          where: { status: "ACTIVE" },
          select: { id: true, sourceKey: true, sourceKind: true, accessMode: true, sensitivity: true },
        },
      },
    }),
  ]);
  return Response.json(
    {
      connections,
      programs,
      runtimeEnabled: isQoderWorkRuntimeEnabled(workspace.featureFlagsJson),
      endpointPath: "/api/mcp/qoderwork",
    },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  if (!isManager(membership.role)) return jsonError("MANAGEMENT_FORBIDDEN", 403);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("MALFORMED_REQUEST", 400);
  try {
    const result = await createQoderWorkConnection({
      workspaceId: workspace.id,
      userId: user.id,
      actorRole: membership.role,
      ...parsed.data,
    });
    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "EXTERNAL_AGENT_CONNECTION_CREATED",
      targetType: "ExternalAgentConnection",
      targetId: result.connection.id,
      summary: "Created a device-bound QoderWork draft-only connection",
      payload: {
        providerId: "qoderwork_cn",
        observationProgramId: result.connection.observationProgramId,
        scopes: result.connection.scopes,
        allowedSourceIds: result.connection.allowedSourceIds,
        maxDataClassification: result.connection.maxDataClassification,
        tokenStoredAsHashOnly: true,
        auditRetainUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      },
      sourcePage: "/settings",
    });
    return Response.json(
      { ...result, tokenShownOnce: true },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return connectionError(error);
  }
}

export async function PATCH(request: Request) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  if (!isManager(membership.role)) return jsonError("MANAGEMENT_FORBIDDEN", 403);
  const parsed = mutateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("MALFORMED_REQUEST", 400);
  try {
    if (parsed.data.action === "revoke") {
      const result = await revokeQoderWorkConnection({
        workspaceId: workspace.id,
        connectionId: parsed.data.connectionId,
        actorUserId: user.id,
        actorRole: membership.role,
      });
      await auditMutation({
        workspaceId: workspace.id,
        userId: user.id,
        actorName: user.name,
        connectionId: parsed.data.connectionId,
        actionType: "EXTERNAL_AGENT_CONNECTION_REVOKED",
      });
      return Response.json(result, { headers: NO_STORE_HEADERS });
    }
    const result = await rotateQoderWorkConnection({
      workspaceId: workspace.id,
      connectionId: parsed.data.connectionId,
      actorRole: membership.role,
    });
    await auditMutation({
      workspaceId: workspace.id,
      userId: user.id,
      actorName: user.name,
      connectionId: parsed.data.connectionId,
      actionType: "EXTERNAL_AGENT_CONNECTION_ROTATED",
    });
    return Response.json(
      { ...result, tokenShownOnce: true },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return connectionError(error);
  }
}

function isManager(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

async function auditMutation(input: {
  workspaceId: string;
  userId: string;
  actorName: string;
  connectionId: string;
  actionType: string;
}) {
  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: input.actionType,
    targetType: "ExternalAgentConnection",
    targetId: input.connectionId,
    summary: input.actionType === "EXTERNAL_AGENT_CONNECTION_ROTATED"
      ? "Rotated a QoderWork device credential; the previous token is invalid"
      : "Revoked a QoderWork device credential",
    payload: {
      providerId: "qoderwork_cn",
      tokenValueLogged: false,
      auditRetainUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    },
    sourcePage: "/settings",
  });
}

function connectionError(error: unknown) {
  if (!(error instanceof ExternalAgentConnectionError)) return jsonError("SAFE_INTERNAL_ERROR", 500);
  const status = error.code === "MANAGEMENT_FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 400;
  return jsonError(error.code, status);
}

function jsonError(errorCode: string, status: number) {
  return Response.json(
    { errorCode, message: "The external agent connection request could not be completed." },
    { status, headers: NO_STORE_HEADERS },
  );
}
