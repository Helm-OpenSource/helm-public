// lib/member-mcp/member-mcp.mysql.test.ts
// Isolated-MySQL coverage for the member MCP P0 chain: request → approve
// (workspace capability and designated group supervisor) → claim once →
// authenticate → read tools scoped to the caller → revoke; plus the fail-closed
// edges (unapproved client, foreign prompt, inactive membership, expiry).
// Gated on MEMBER_MCP_DATABASE_URL — same pattern as the member gateway suites.

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createMemberPrompt } from "@/lib/member-gateway/prompt-store.service";
import {
  MemberAgentConnectionError,
  authenticateMemberMcpToken,
  claimMemberAgentConnection,
  decideMemberAgentConnection,
  grantMemberApprover,
  listApprovableMemberAgentConnections,
  requestMemberAgentConnection,
  revokeMemberAgentConnection,
  type MemberMcpActor,
} from "@/lib/member-mcp/connection-service";
import { executeMemberMcpTool } from "@/lib/member-mcp/tool-executor";

const integrationDatabaseUrl = process.env.MEMBER_MCP_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid.toString(36)}-${Date.now().toString(36)}`;
const GROUP_A = `组A-${suffix}`;
const GROUP_B = `组B-${suffix}`;

async function expectCode(promise: Promise<unknown>, code: MemberAgentConnectionError["code"]) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(MemberAgentConnectionError);
  expect((error as MemberAgentConnectionError).code).toBe(code);
}

describeMysql("member MCP P0 with an isolated MySQL database", () => {
  let workspaceId = "";
  const actors: Record<"owner" | "supervisor" | "seatA" | "seatB", MemberMcpActor & { membershipId: string }> = {} as never;
  const previousEnv = process.env.HELM_MEMBER_MCP_ENABLED;

  async function setFlags(flags: Record<string, unknown>) {
    await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: JSON.stringify(flags) } });
  }

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error("DATABASE_URL must equal MEMBER_MCP_DATABASE_URL for the isolated integration test.");
    }
    process.env.HELM_MEMBER_MCP_ENABLED = "true";
    const workspace = await db.workspace.create({
      data: { name: `Member MCP integration ${suffix}`, slug: `member-mcp-integration-${suffix}` },
    });
    workspaceId = workspace.id;
    await setFlags({ memberMcp: true, memberMcpApprovedClients: ["claude_code", "codex"] });
    const people: Array<[keyof typeof actors, WorkspaceRole, string | null]> = [
      ["owner", WorkspaceRole.OWNER, null],
      ["supervisor", WorkspaceRole.OPERATOR, null],
      ["seatA", WorkspaceRole.OPERATOR, GROUP_A],
      ["seatB", WorkspaceRole.OPERATOR, GROUP_B],
    ];
    for (const [key, role, groupTag] of people) {
      const user = await db.user.create({ data: { email: `member-mcp-${key}-${suffix}@example.com`, name: `mcp ${key}` } });
      const membership = await db.membership.create({
        data: { workspaceId, userId: user.id, role, status: MembershipStatus.ACTIVE, groupTag },
      });
      actors[key] = { userId: user.id, name: user.name ?? key, role, membershipActive: true, membershipId: membership.id };
    }
  });

  afterAll(async () => {
    if (previousEnv === undefined) delete process.env.HELM_MEMBER_MCP_ENABLED;
    else process.env.HELM_MEMBER_MCP_ENABLED = previousEnv;
    await db.$disconnect();
  });

  const request = (key: keyof typeof actors, clientType: "claude_code" | "codex" | "qwenwork" = "claude_code") =>
    requestMemberAgentConnection({
      workspaceId,
      membershipId: actors[key].membershipId,
      actor: actors[key],
      clientType,
      deviceLabel: `${key} 的电脑`,
    });

  it("refuses a client type that is not on the workspace's approved list", async () => {
    await expectCode(request("seatA", "qwenwork"), "CLIENT_NOT_APPROVED");
  });

  it("runs request → supervisor approval → single claim → read tools → revoke", async () => {
    const requested = await request("seatA");
    expect(requested.status).toBe("requested");
    expect(requested.scopes).toEqual(["member:brief:read", "member:prompt:read"]);

    // No grant yet: an OPERATOR is not a supervisor by role.
    await expectCode(
      decideMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.supervisor, decision: "approve" }),
      "FORBIDDEN",
    );
    expect((await listApprovableMemberAgentConnections(workspaceId, actors.supervisor)).scope).toBe("none");
    // Only owners/admins designate supervisors.
    await expectCode(
      grantMemberApprover({ workspaceId, actor: actors.supervisor, approverUserId: actors.supervisor.userId, groupTag: GROUP_A }),
      "FORBIDDEN",
    );
    await grantMemberApprover({ workspaceId, actor: actors.owner, approverUserId: actors.supervisor.userId, groupTag: GROUP_A });
    const visible = await listApprovableMemberAgentConnections(workspaceId, actors.supervisor);
    expect(visible.scope).toBe("group");
    expect(visible.connections.map((row) => row.id)).toEqual([requested.id]);

    const approved = await decideMemberAgentConnection({
      workspaceId,
      connectionId: requested.id,
      actor: actors.supervisor,
      decision: "approve",
    });
    expect(approved.status).toBe("approved");

    // Only the member claims, and only once.
    await expectCode(claimMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.owner }), "NOT_FOUND");
    const claimed = await claimMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.seatA });
    expect(claimed.token).toMatch(/^hmm_[A-Za-z0-9_-]{43}$/);
    expect(claimed.connection.status).toBe("active");
    await expectCode(claimMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.seatA }), "STATE_CONFLICT");
    const stored = await db.memberAgentConnection.findUniqueOrThrow({ where: { id: requested.id } });
    expect(stored.tokenHash).not.toContain(claimed.token);

    const now = new Date();
    const mine = `prompt-mine-${suffix}`;
    const theirs = `prompt-theirs-${suffix}`;
    const base = {
      workspaceRef: workspaceId,
      severity: "normal" as const,
      severityRuleRef: null,
      subjectObjectRef: `case-${suffix}`,
      projectedSummary: "请确认今天的回访安排",
      evidenceRefs: ["evidence:1"],
      issuedAt: new Date(now.getTime() - 60_000).toISOString(),
      expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
    };
    await createMemberPrompt({ prompt: { ...base, promptRef: mine, memberRef: actors.seatA.userId } });
    await createMemberPrompt({ prompt: { ...base, promptRef: theirs, memberRef: actors.seatB.userId } });

    const auth = await authenticateMemberMcpToken(claimed.token);
    expect(auth.userId).toBe(actors.seatA.userId);

    const brief = await executeMemberMcpTool({ auth, call: { toolName: "get_my_brief", arguments: {} } });
    expect(brief.ok).toBe(true);
    expect(brief.boundary.authorityEffect).toBe("none");
    expect(brief.data).toMatchObject({ me: { groupTag: GROUP_A }, prompts: { openTotal: 1, byState: { pending: 1 } } });

    const list = await executeMemberMcpTool({ auth, call: { toolName: "list_my_pending_prompts", arguments: { limit: 20, cursor: null } } });
    expect((list.data as { items: Array<{ promptRef: string }> }).items.map((item) => item.promptRef)).toEqual([mine]);

    const own = await executeMemberMcpTool({ auth, call: { toolName: "get_my_prompt", arguments: { promptRef: mine } } });
    expect(own.data).toMatchObject({ promptRef: mine, evidenceRefs: ["evidence:1"], state: "pending" });
    // Reading never transitions the prompt.
    expect((await db.memberPrompt.findUniqueOrThrow({ where: { id_workspaceId: { id: mine, workspaceId } } })).version).toBe(1);

    const foreign = await executeMemberMcpTool({ auth, call: { toolName: "get_my_prompt", arguments: { promptRef: theirs } } });
    expect(foreign.ok).toBe(false);
    expect(foreign.error?.code).toBe("prompt_not_found");
    expect(foreign.data).toBeNull();

    // Removing the client from the approved list blocks the data, not just the list.
    await setFlags({ memberMcp: true, memberMcpApprovedClients: ["codex"] });
    const blocked = await executeMemberMcpTool({ auth: await authenticateMemberMcpToken(claimed.token), call: { toolName: "get_my_brief", arguments: {} } });
    expect(blocked.ok).toBe(false);
    expect(blocked.boundary.decision.blockReason).toBe("provider_not_approved");
    expect(blocked.data).toBeNull();
    await setFlags({ memberMcp: true, memberMcpApprovedClients: ["claude_code", "codex"] });

    // Expiry is enforced on every call.
    await expectCode(authenticateMemberMcpToken(claimed.token, new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)), "EXPIRED");

    // Workspace flag off → runtime disabled.
    await setFlags({ memberMcp: false, memberMcpApprovedClients: ["claude_code"] });
    await expectCode(authenticateMemberMcpToken(claimed.token), "RUNTIME_DISABLED");
    await setFlags({ memberMcp: true, memberMcpApprovedClients: ["claude_code", "codex"] });

    await revokeMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.seatA });
    await expectCode(authenticateMemberMcpToken(claimed.token), "UNAUTHENTICATED");

    const audits = await db.auditLog.findMany({
      where: { workspaceId, targetId: requested.id },
      select: { actionType: true },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.map((row) => row.actionType)).toEqual([
      "MEMBER_AGENT_CONNECTION_REQUESTED",
      "MEMBER_AGENT_CONNECTION_APPROVED",
      "MEMBER_AGENT_CONNECTION_CLAIMED",
      "MEMBER_AGENT_CONNECTION_REVOKED",
    ]);
  });

  it("keeps a group supervisor out of other groups", async () => {
    const other = await request("seatB", "codex");
    await expectCode(
      decideMemberAgentConnection({ workspaceId, connectionId: other.id, actor: actors.supervisor, decision: "approve" }),
      "FORBIDDEN",
    );
    await expectCode(
      revokeMemberAgentConnection({ workspaceId, connectionId: other.id, actor: actors.supervisor }),
      "FORBIDDEN",
    );
    const rejected = await decideMemberAgentConnection({
      workspaceId,
      connectionId: other.id,
      actor: actors.owner,
      decision: "reject",
      reason: "先用 Claude Code",
    });
    expect(rejected.status).toBe("rejected");
    await expectCode(claimMemberAgentConnection({ workspaceId, connectionId: other.id, actor: actors.seatB }), "STATE_CONFLICT");
  });

  it("stops serving a member whose membership is no longer active", async () => {
    const requested = await request("seatB");
    await decideMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.owner, decision: "approve" });
    const claimed = await claimMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.seatB });
    await authenticateMemberMcpToken(claimed.token);
    await db.membership.update({ where: { id: actors.seatB.membershipId }, data: { status: MembershipStatus.INACTIVE } });
    await expectCode(authenticateMemberMcpToken(claimed.token), "UNAUTHENTICATED");
    await db.membership.update({ where: { id: actors.seatB.membershipId }, data: { status: MembershipStatus.ACTIVE } });
  });

  it("rate-limits a token beyond 60 calls a minute", async () => {
    const requested = await request("owner", "codex");
    await decideMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.owner, decision: "approve" });
    const claimed = await claimMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.owner });
    const now = new Date();
    for (let index = 0; index < 60; index += 1) await authenticateMemberMcpToken(claimed.token, now);
    await expectCode(authenticateMemberMcpToken(claimed.token, now), "RATE_LIMITED");
  });
});
