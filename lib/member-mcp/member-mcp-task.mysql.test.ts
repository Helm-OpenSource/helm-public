// lib/member-mcp/member-mcp-task.mysql.test.ts
// Isolated-MySQL coverage for member MCP P2 on top of the Stage 1 dispatch
// chain (PR #426): a member reads exactly the work packets whose owner
// command names them, reports on an approved packet as an untrusted candidate
// anchored to the packet's ActionItem, and nothing here writes an
// ExecutionReceipt or changes the task. Gated on MEMBER_MCP_DATABASE_URL.

import { ActionStatus, ActionType, MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { listMemberWorkSignalCandidateReviews } from "@/lib/member-gateway/signal-candidate-review.service";
import {
  authenticateMemberMcpToken,
  claimMemberAgentConnection,
  decideMemberAgentConnection,
  requestMemberAgentConnection,
  type MemberMcpActor,
  type MemberMcpAuthContext,
} from "@/lib/member-mcp/connection-service";
import { executeMemberMcpTool } from "@/lib/member-mcp/tool-executor";
import { parseMemberMcpToolCall } from "@/lib/member-mcp/tools";

const integrationDatabaseUrl = process.env.MEMBER_MCP_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid.toString(36)}-${Date.now().toString(36)}`;

describeMysql("member MCP P2 tasks with an isolated MySQL database", () => {
  let workspaceId = "";
  const actors: Record<"owner" | "seat" | "other", MemberMcpActor & { membershipId: string }> = {} as never;
  let seatAuth: MemberMcpAuthContext;
  let readOnlyAuth: MemberMcpAuthContext;
  let packetCounter = 0;
  const previousEnv = process.env.HELM_MEMBER_MCP_ENABLED;

  async function connect(key: "seat", includeTasks: boolean) {
    const requested = await requestMemberAgentConnection({
      workspaceId,
      membershipId: actors[key].membershipId,
      actor: actors[key],
      clientType: "claude_code",
      deviceLabel: `p2 ${includeTasks ? "任务" : "只读"}`,
      includeTasks,
    });
    await decideMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.owner, decision: "approve" });
    const claimed = await claimMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors[key] });
    return authenticateMemberMcpToken(claimed.token);
  }

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error("DATABASE_URL must equal MEMBER_MCP_DATABASE_URL for the isolated integration test.");
    }
    process.env.HELM_MEMBER_MCP_ENABLED = "true";
    const workspace = await db.workspace.create({
      data: {
        name: `Member MCP P2 ${suffix}`,
        slug: `member-mcp-p2-${suffix}`,
        featureFlagsJson: JSON.stringify({ memberMcp: true, memberMcpApprovedClients: ["claude_code"] }),
      },
    });
    workspaceId = workspace.id;
    for (const [key, role] of [
      ["owner", WorkspaceRole.OWNER],
      ["seat", WorkspaceRole.OPERATOR],
      ["other", WorkspaceRole.OPERATOR],
    ] as const) {
      const user = await db.user.create({ data: { email: `mmcp-p2-${key}-${suffix}@example.com`, name: `p2 ${key}` } });
      const membership = await db.membership.create({
        data: { workspaceId, userId: user.id, role, status: MembershipStatus.ACTIVE },
      });
      actors[key] = { userId: user.id, name: user.name ?? key, role, membershipActive: true, membershipId: membership.id };
    }
    seatAuth = await connect("seat", true);
    readOnlyAuth = await connect("seat", false);
  });

  afterAll(async () => {
    if (previousEnv === undefined) delete process.env.HELM_MEMBER_MCP_ENABLED;
    else process.env.HELM_MEMBER_MCP_ENABLED = previousEnv;
    await db.$disconnect();
  });

  // A dispatched Stage 1 work packet, shaped as dispatchStage1DecisionWorkPacket
  // leaves it: DecisionRecord DISPATCHED, a governed ActionItem, and the claim
  // carrying the owner command that names the executor.
  async function packet(executorUserId: string, status: ActionStatus) {
    packetCounter += 1;
    const decision = await db.decisionRecord.create({
      data: {
        workspaceId,
        decisionKey: `p2-decision-${suffix}-${packetCounter}`,
        decisionType: "operating",
        businessQuestion: "本周回访优先级怎么排",
        contextRefs: "[]",
        knowledgeRefs: "[]",
        evidenceRefs: "[]",
        policyRefs: "[]",
        receiptRefs: "[]",
        alternatives: "[]",
        confidence: "medium",
        riskLevel: "medium",
        allowedActionLevel: "assist",
        ownerGate: "owner_confirm",
        factsJson: "[]",
        inferencesJson: "[]",
        unknownsJson: "[]",
        risksJson: "[]",
        ownerRef: actors.owner.userId,
        status: "DISPATCHED",
      },
    });
    const action = await db.actionItem.create({
      data: {
        workspaceId,
        actionType: ActionType.CREATE_TASK,
        title: `工作包 ${packetCounter}`,
        description: "按名单回访",
        status,
      },
    });
    await db.decisionWorkPacketClaim.create({
      data: {
        workspaceId,
        decisionRecordId: decision.id,
        actionItemId: action.id,
        ownerCommandJson: JSON.stringify({
          commandId: `command-${suffix}-${packetCounter}`,
          workspaceRef: `workspace:${workspaceId}`,
          decisionRef: decision.id,
          ownerRef: actors.owner.userId,
          executionTargetRef: `user:${executorUserId}`,
          portfolioRef: "portfolio:test",
          goal: "提升本周接通后回款",
          action: "按优先名单回访",
          dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          acceptanceCriteria: ["名单内 80% 已回访"],
          evidenceRequirements: ["回访记录"],
          invalidationConditions: ["名单撤回"],
          escalationOwnerRef: actors.owner.userId,
          automationLevel: "assist",
          allowedToolRefs: [],
          externalSideEffects: [],
          policyEnvelopeRef: null,
          status: "owner_confirmed",
        }),
      },
    });
    return action.id;
  }

  async function call(auth: MemberMcpAuthContext, name: string, args: Record<string, unknown>) {
    const parsed = parseMemberMcpToolCall(name, args);
    if (!parsed.ok) throw new Error(parsed.message);
    return executeMemberMcpTool({ auth, call: parsed.call });
  }

  it("lists exactly the packets dispatched to the member", async () => {
    const mine = await packet(actors.seat.userId, ActionStatus.APPROVED);
    const theirs = await packet(actors.other.userId, ActionStatus.APPROVED);
    const listed = await call(seatAuth, "list_my_tasks", {});
    expect(listed.ok).toBe(true);
    const refs = (listed.data as { items: Array<{ taskRef: string; reportable: boolean }> }).items.map((item) => item.taskRef);
    expect(refs).toContain(mine);
    expect(refs).not.toContain(theirs);
    const foreign = await call(seatAuth, "get_task", { taskRef: theirs });
    expect(foreign.ok).toBe(false);
    expect(foreign.error?.code).toBe("task_not_found");
    const own = await call(seatAuth, "get_task", { taskRef: mine });
    expect(own.data).toMatchObject({ taskRef: mine, reportable: true, goal: "提升本周接通后回款" });
  });

  it("records a report as a candidate on the packet and leaves the task and receipts untouched", async () => {
    const taskRef = await packet(actors.seat.userId, ActionStatus.APPROVED);
    const report = { taskRef, outcome: "blocked", actionTaken: "回访了 12 户", evidenceRefs: ["case:1001"], note: "名单里 3 户号码失效" };
    const prepared = await call(seatAuth, "prepare_task_report", report);
    expect(prepared.ok).toBe(true);
    const challengeRef = (prepared.data as { challengeRef: string }).challengeRef;

    const tampered = await call(seatAuth, "submit_task_report", { ...report, actionTaken: "全部完成", challengeRef });
    expect(tampered.ok).toBe(false);

    const submitted = await call(seatAuth, "submit_task_report", { ...report, challengeRef });
    expect(submitted.ok).toBe(true);
    expect(submitted.data).toMatchObject({ taskRef, candidateMaterialized: true, taint: "untrusted" });
    const replay = await call(seatAuth, "submit_task_report", { ...report, challengeRef });
    expect(replay.ok).toBe(true);
    expect((replay.data as { receiptRef: string }).receiptRef).toBe((submitted.data as { receiptRef: string }).receiptRef);

    const receipt = await db.memberWorkSignalReceipt.findFirstOrThrow({
      where: { workspaceId, id: (submitted.data as { receiptRef: string }).receiptRef },
    });
    expect(receipt.kind).toBe("blocker");
    expect(receipt.objectRef).toBe(`action-item:${taskRef}`);

    const bundle = (submitted.data as { candidateBundleRef: string }).candidateBundleRef;
    expect((await listMemberWorkSignalCandidateReviews(workspaceId)).map((review) => review.artifactBundleId)).toContain(bundle);

    // The Stage 1 chain still owns the outcome: no receipt, no state change.
    expect(await db.executionReceipt.count({ where: { actionItemId: taskRef } })).toBe(0);
    expect((await db.actionItem.findUniqueOrThrow({ where: { id: taskRef } })).status).toBe(ActionStatus.APPROVED);
  });

  it("refuses reports on packets that are not approved or already closed", async () => {
    for (const status of [ActionStatus.PENDING_APPROVAL, ActionStatus.EXECUTED]) {
      const taskRef = await packet(actors.seat.userId, status);
      const prepared = await call(seatAuth, "prepare_task_report", { taskRef, outcome: "done", actionTaken: "做完了" });
      expect(prepared.ok).toBe(false);
      expect(prepared.error?.code).toBe("task_not_reportable");
    }
  });

  it("refuses a connection without the task scopes", async () => {
    const taskRef = await packet(actors.seat.userId, ActionStatus.APPROVED);
    expect(readOnlyAuth.scopes).not.toContain("member:task:read");
    const listed = await call(readOnlyAuth, "list_my_tasks", {});
    expect(listed.ok).toBe(false);
    expect(listed.error?.code).toBe("scope_denied");
    const prepared = await call(readOnlyAuth, "prepare_task_report", { taskRef, outcome: "done", actionTaken: "做完了" });
    expect(prepared.error?.code).toBe("scope_denied");
  });

  it("stops serving tasks to a member who has left", async () => {
    await db.membership.update({ where: { id: actors.seat.membershipId }, data: { status: MembershipStatus.INACTIVE } });
    try {
      const listed = await call(seatAuth, "list_my_tasks", {});
      expect(listed.ok).toBe(false);
      expect(listed.error?.code).toBe("membership_inactive");
    } finally {
      await db.membership.update({ where: { id: actors.seat.membershipId }, data: { status: MembershipStatus.ACTIVE } });
    }
  });
});
