import "server-only";

// Member MCP P2: the Stage 1 work packets an owner dispatched to the member
// (PR #426) and the member's reports on them. See task-contract.ts for the
// boundary: reads serve exactly listWorkPacketsAssignedToMember's set; a
// report is an untrusted candidate signal anchored to the packet's
// ActionItem and never writes an ExecutionReceipt or changes task state.
//
// Firewall: reachable from app/api/mcp/member/route.ts. The packet query and
// the signal store do not reach lib/caio-governance (check-caio-terminology).

import { ActionStatus, MembershipStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { decideMemberReadSurface } from "@/lib/member-gateway/contract";
import { MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS } from "@/lib/member-gateway/signal";
import {
  MemberSignalStoreError,
  issueMemberWorkSignalChallenge,
  submitMemberWorkSignal,
} from "@/lib/member-gateway/signal-store.service";
import type { MemberProjectionDecision, MemberToolEnvelope } from "@/lib/member-gateway/types";
import { memberRefForUser } from "@/lib/member-mcp/contract";
import { materializeMemberSignalCandidateSafely } from "@/lib/member-mcp/candidate";
import type { MemberMcpAuthContext } from "@/lib/member-mcp/connection-service";
import {
  buildMemberTaskReportPayload,
  memberTaskObjectRef,
  type MemberTaskReportInput,
} from "@/lib/member-mcp/task-contract";
import {
  buildMemberMcpEnvelope,
  MEMBER_MCP_BLOCK_MESSAGES,
  buildContentDecision,
  buildSelfRecordDecision,
  type MemberMcpToolCall,
} from "@/lib/member-mcp/tools";
import { memberMcpPrincipal } from "@/lib/member-mcp/write-executor";
import {
  MemberWorkPacketAccessError,
  listWorkPacketsAssignedToMember,
  type MemberWorkPacket,
} from "@/lib/stage1-owner-loop/member-work-packet-queries.service";

export const MEMBER_MCP_TASK_REPORT_POLICY_REF = "member-mcp:task-report";
export const MEMBER_MCP_TASK_REPORT_POLICY_VERSION = 1;

// Reports are accepted while the owner-approved packet awaits its result.
// Before approval there is nothing to work on; after closure the Stage 1
// chain owns the outcome.
const REPORTABLE_STATUSES = new Set<string>([ActionStatus.APPROVED]);

type TaskCall = Extract<
  MemberMcpToolCall,
  { toolName: "list_my_tasks" | "get_task" | "prepare_task_report" | "submit_task_report" }
>;

export function memberTaskReportReceiptId(challengeRef: string) {
  return `mmcp-task-report:${challengeRef}`;
}

const PACKET_FIELDS = [
  "taskRef",
  "decisionRef",
  "title",
  "status",
  "reportable",
  "goal",
  "action",
  "dueAt",
  "acceptanceCriteria",
  "dispatchedAt",
] as const;

function projectPacket(packet: MemberWorkPacket) {
  return {
    taskRef: packet.actionItemRef,
    decisionRef: packet.decisionRef,
    title: packet.title,
    status: packet.status,
    reportable: REPORTABLE_STATUSES.has(packet.status),
    goal: packet.goal,
    action: packet.action,
    dueAt: packet.dueAt,
    acceptanceCriteria: packet.acceptanceCriteria,
    dispatchedAt: packet.dispatchedAt,
  };
}

export async function executeMemberTaskTool(input: {
  auth: MemberMcpAuthContext;
  call: TaskCall;
  providerRef: string;
  requestId: string;
  now: Date;
}): Promise<MemberToolEnvelope<unknown>> {
  const { auth, call, providerRef, requestId, now } = input;
  const decision = buildSelfRecordDecision({ providerRef, classifiedAt: now, now });
  const fail = (code: string, message: string) =>
    buildMemberMcpEnvelope({ requestId, now, decision, data: null, error: { code, message, retryable: false } });
  const ok = (data: unknown) => buildMemberMcpEnvelope({ requestId, now, decision, data, error: null });

  // Defense in depth: the protocol layer already filtered by scope.
  const requiredScope =
    call.toolName === "prepare_task_report" || call.toolName === "submit_task_report"
      ? "member:task:receipt"
      : "member:task:read";
  if (!auth.scopes.includes(requiredScope)) return fail("scope_denied", `This connection lacks ${requiredScope}.`);

  let packets: MemberWorkPacket[];
  try {
    packets = await listWorkPacketsAssignedToMember({ workspaceId: auth.workspaceId, userId: auth.userId });
  } catch (error) {
    if (error instanceof MemberWorkPacketAccessError) return fail("membership_inactive", "Membership is not active.");
    throw error;
  }

  // Work packets describe business work, so their content goes through the
  // same projection ladder as CAIO prompts, with the owner's tenant
  // classification: unclassified never projects, local_only serves the
  // metadata whitelist, prohibited stays inside Helm.
  const content = (objectRef: string) =>
    buildContentDecision({
      workspaceId: auth.workspaceId,
      memberRef: memberRefForUser(auth.userId),
      objectRef,
      connectionRef: `member-mcp-connection:${auth.connectionId}`,
      scope: requiredScope,
      providerRef,
      classification: auth.contentClassification,
      requestedFields: PACKET_FIELDS,
      now,
    });
  const blocked = (projection: MemberProjectionDecision) => {
    const code = auth.contentClassification === null ? "classification_unknown" : (projection.blockReason ?? "blocked");
    return buildMemberMcpEnvelope({
      requestId,
      now,
      decision: projection,
      data: null,
      error: { code, message: MEMBER_MCP_BLOCK_MESSAGES[code] ?? "Content is not projectable.", retryable: false },
    });
  };
  const metadata = (packetRef: string, projection: MemberProjectionDecision) => ({
    objectKind: "work_packet",
    evidenceRef: packetRef,
    classifiedAt: projection.classifiedAt,
    freshness: projection.freshnessMinutes,
    requiresLocalView: true,
  });

  if (call.toolName === "list_my_tasks") {
    const projection = content("member-work-packets");
    if (projection.projection === null) return blocked(projection);
    const items = projection.projection === "metadata_only"
      ? packets.map((packet) => metadata(packet.actionItemRef, projection))
      : packets.map(projectPacket);
    return buildMemberMcpEnvelope({
      requestId,
      now,
      decision: projection,
      data: { items, note: "一把手确认并派给你的工作包；本工具只读。" },
      error: null,
    });
  }

  // A packet dispatched to someone else is indistinguishable from a missing one.
  const packet = packets.find((entry) => entry.actionItemRef === call.arguments.taskRef);
  if (!packet) return fail("task_not_found", "No such task dispatched to this member.");
  const packetProjection = content(packet.actionItemRef);
  if (call.toolName === "get_task") {
    if (packetProjection.projection === null) return blocked(packetProjection);
    return buildMemberMcpEnvelope({
      requestId,
      now,
      decision: packetProjection,
      data: packetProjection.projection === "metadata_only" ? metadata(packet.actionItemRef, packetProjection) : projectPacket(packet),
      error: null,
    });
  }

  if (!REPORTABLE_STATUSES.has(packet.status)) {
    return fail("task_not_reportable", "This task is not open for reports (not yet approved, or already closed).");
  }
  const report: MemberTaskReportInput = {
    taskRef: call.arguments.taskRef,
    outcome: call.arguments.outcome,
    actionTaken: call.arguments.actionTaken,
    evidenceRefs: call.arguments.evidenceRefs,
    note: call.arguments.note,
  };
  const payload = buildMemberTaskReportPayload({ report, taskTitle: packet.title, decisionRef: packet.decisionRef });
  const principal = memberMcpPrincipal(auth);
  const objectRef = memberTaskObjectRef(packet.actionItemRef);

  try {
    if (call.toolName === "prepare_task_report") {
      const challenge = await issueMemberWorkSignalChallenge({
        draft: { principal, objectRef, objectVersion: 1, payload },
        ttlMs: MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS,
      });
      return ok({
        challengeRef: challenge.challengeRef,
        expiresAt: challenge.expiresAt,
        // The summary quotes the task title, so it is echoed only when task
        // content may leave Helm at all.
        recordedAs: packetProjection.projection === "remote_projected"
          ? { kind: payload.kind, summary: payload.summary }
          : { kind: payload.kind },
        next: "用同样的内容加上 challengeRef 调用 submit_task_report 完成提交。",
      });
    }

    const membership = await db.membership.findUnique({
      where: { id: auth.membershipId },
      select: { status: true, workspaceId: true, userId: true },
    });
    const live =
      membership?.status === MembershipStatus.ACTIVE &&
      membership.workspaceId === auth.workspaceId &&
      membership.userId === auth.userId;
    // decideMemberReadSurface's tool type only admits the L1 read tools (a
    // frozen Member Gateway literal set, not edited here). get_my_brief is
    // named because the evidence is the member's own executor grant; the
    // write itself is authorized by the scope in toolScopeRef.
    const surface = decideMemberReadSurface({
      workspaceRef: auth.workspaceId,
      memberRef: principal.memberRef,
      objectRef,
      tool: "get_my_brief",
      purpose: "member_task_report",
      liveMembershipRef: live ? `membership:${auth.membershipId}` : null,
      toolScopeRef: `member-mcp-connection:${auth.connectionId}#member:task:receipt`,
      objectRelationshipAuthorizationRef: `executor-grant:decision-record:${packet.decisionRef}`,
      fieldPurposePolicyRef: `${MEMBER_MCP_TASK_REPORT_POLICY_REF}:v${MEMBER_MCP_TASK_REPORT_POLICY_VERSION}`,
      sourceAuthorizationRef: `member-mcp-connection:${auth.connectionId}`,
      tenantProviderEgressPolicyRef: providerRef,
      classification: { sensitivity: "internal", processingDisposition: "remote_projected", classifiedAt: now.toISOString() },
    });
    const result = await submitMemberWorkSignal({
      principal,
      challengeRef: call.arguments.challengeRef,
      payload,
      surface,
      evidenceSurfaces: new Map(),
      policyRef: MEMBER_MCP_TASK_REPORT_POLICY_REF,
      policyVersion: MEMBER_MCP_TASK_REPORT_POLICY_VERSION,
      receiptId: memberTaskReportReceiptId(call.arguments.challengeRef),
    });
    // The candidate is anchored to the packet's ActionItem so reviewers see
    // the report next to the packet in /approvals.
    const candidate = await materializeMemberSignalCandidateSafely({
      workspaceId: auth.workspaceId,
      signalReceiptId: result.receipt.receiptId,
      objectAnchor: { resolved: true, objectType: "ActionItem", objectId: packet.actionItemRef },
    });
    return ok({
      ...candidate,
      receiptRef: result.receipt.receiptId,
      outcome: result.outcome,
      taskRef: packet.actionItemRef,
      submittedAt: result.receipt.submittedAt,
      taint: result.receipt.taint,
      note: "已记录为待审阅的候选回报，不会关闭任务；任务由一把手侧的验收流程关闭。",
    });
  } catch (error) {
    if (error instanceof MemberSignalStoreError) return fail("task_report_rejected", error.message);
    throw error;
  }
}
