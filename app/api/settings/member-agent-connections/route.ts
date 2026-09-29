import { MembershipStatus } from "@prisma/client";
import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  MemberAgentConnectionError,
  claimMemberAgentConnection,
  decideMemberAgentConnection,
  grantMemberApprover,
  listApprovableMemberAgentConnections,
  listMemberApproverGrants,
  listMyMemberAgentConnections,
  requestMemberAgentConnection,
  revokeMemberAgentConnection,
  revokeMemberApproverGrant,
  type MemberMcpActor,
} from "@/lib/member-mcp/connection-service";
import {
  MEMBER_MCP_CLIENT_TYPES,
  MEMBER_MCP_ENDPOINT_PATH,
  canManageMemberApproverGrants,
  readMemberMcpWorkspaceFlags,
} from "@/lib/member-mcp/contract";

const id = z.string().min(3).max(191);

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    clientType: z.enum(MEMBER_MCP_CLIENT_TYPES),
    deviceLabel: z.string().min(2).max(80),
  }).strict(),
  z.object({ action: z.literal("approve"), connectionId: id, reason: z.string().max(200).optional() }).strict(),
  z.object({ action: z.literal("reject"), connectionId: id, reason: z.string().max(200).optional() }).strict(),
  z.object({ action: z.literal("claim"), connectionId: id }).strict(),
  z.object({ action: z.literal("revoke"), connectionId: id }).strict(),
  z.object({ action: z.literal("grant_approver"), approverUserId: id, groupTag: z.string().min(1).max(60) }).strict(),
  z.object({ action: z.literal("revoke_approver"), grantId: id }).strict(),
]);

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

async function currentActor() {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const actor: MemberMcpActor = {
    userId: user.id,
    name: user.name,
    role: membership.role,
    membershipActive: membership.status === MembershipStatus.ACTIVE,
  };
  return { actor, membership, workspace };
}

// The whole management API is absent while the deployment switch is off, the
// same as the page and the MCP route.
function runtimeOff() {
  return process.env.HELM_MEMBER_MCP_ENABLED !== "true";
}

export async function GET() {
  if (runtimeOff()) return jsonError("RUNTIME_DISABLED", 404);
  const { actor, workspace } = await currentActor();
  const now = new Date();
  const flags = readMemberMcpWorkspaceFlags(workspace.featureFlagsJson);
  const manager = actor.membershipActive && canManageMemberApproverGrants(actor.role);
  const [mine, approvable, grants, groupTags, members] = await Promise.all([
    listMyMemberAgentConnections(workspace.id, actor.userId, now),
    listApprovableMemberAgentConnections(workspace.id, actor, now),
    manager ? listMemberApproverGrants(workspace.id) : Promise.resolve(null),
    manager ? listGroupTags(workspace.id) : Promise.resolve(null),
    manager ? listActiveMembers(workspace.id) : Promise.resolve(null),
  ]);
  return Response.json(
    {
      runtimeEnabled: flags.enabled,
      approvedClients: flags.approvedClients,
      endpointPath: MEMBER_MCP_ENDPOINT_PATH,
      mine,
      approvable,
      canManageApprovers: manager,
      grants,
      groupTags,
      members,
    },
    { headers: NO_STORE_HEADERS },
  );
}

async function listActiveMembers(workspaceId: string) {
  const rows = await db.membership.findMany({
    where: { workspaceId, status: MembershipStatus.ACTIVE },
    select: { userId: true, title: true, user: { select: { name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
    take: 500,
  });
  return rows.map((row) => ({ userId: row.userId, name: row.user.name, email: row.user.email, title: row.title }));
}

async function listGroupTags(workspaceId: string) {
  const rows = await db.membership.groupBy({
    by: ["groupTag"],
    where: { workspaceId, status: MembershipStatus.ACTIVE, groupTag: { not: null } },
    _count: { _all: true },
  });
  return rows
    .filter((row): row is typeof row & { groupTag: string } => Boolean(row.groupTag?.trim()))
    .map((row) => ({ groupTag: row.groupTag, members: row._count._all }));
}

export async function POST(request: Request) {
  if (runtimeOff()) return jsonError("RUNTIME_DISABLED", 404);
  const { actor, membership, workspace } = await currentActor();
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const body = parsed.data;
  try {
    switch (body.action) {
      case "request":
        return ok(await requestMemberAgentConnection({
          workspaceId: workspace.id,
          membershipId: membership.id,
          actor,
          clientType: body.clientType,
          deviceLabel: body.deviceLabel,
        }), 201);
      case "approve":
      case "reject":
        return ok(await decideMemberAgentConnection({
          workspaceId: workspace.id,
          connectionId: body.connectionId,
          actor,
          decision: body.action,
          reason: body.reason ?? null,
        }));
      case "claim": {
        const result = await claimMemberAgentConnection({ workspaceId: workspace.id, connectionId: body.connectionId, actor });
        return ok({ ...result, tokenShownOnce: true, endpointPath: MEMBER_MCP_ENDPOINT_PATH });
      }
      case "revoke":
        return ok(await revokeMemberAgentConnection({ workspaceId: workspace.id, connectionId: body.connectionId, actor }));
      case "grant_approver":
        return ok(await grantMemberApprover({
          workspaceId: workspace.id,
          actor,
          approverUserId: body.approverUserId,
          groupTag: body.groupTag,
        }), 201);
      case "revoke_approver":
        return ok(await revokeMemberApproverGrant({ workspaceId: workspace.id, actor, grantId: body.grantId }));
    }
  } catch (error) {
    if (error instanceof MemberAgentConnectionError) {
      const status =
        error.code === "NOT_FOUND" ? 404
          : error.code === "FORBIDDEN" ? 403
            : error.code === "STATE_CONFLICT" || error.code === "TOO_MANY_OPEN" ? 409
              : error.code === "RUNTIME_DISABLED" ? 404
                : 400;
      return jsonError(error.code, status);
    }
    throw error;
  }
}

function ok(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_STORE_HEADERS });
}

function jsonError(code: string, status: number) {
  return Response.json({ error: code }, { status, headers: NO_STORE_HEADERS });
}
