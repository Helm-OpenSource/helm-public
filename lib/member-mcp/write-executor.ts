import "server-only";

// Member MCP P1a candidate writes: work signals and field reports, recorded
// through the Member Gateway work-signal store as append-only, untrusted
// candidate receipts (spec §5 candidate_write, §6.2 prepare/submit). Nothing
// here grants authority, dispatches work or feeds CAIO reasoning directly.
//
// Target object: the member's own record (`member-self:<userId>`). P1a
// signals are self-reports, so the read-surface evidence for that object is
// the member's own live membership and this connection; signals about other
// people's or business objects need the full intersection and are not
// expressible here. relatedEvidenceRefs are always empty for the same reason:
// the per-ref authorization the store demands is not available to P1a.
//
// Firewall: signal-store.service does not reach lib/caio-governance, so this
// module is safe to reach from app/api/mcp/member/route.ts.

import { MembershipStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { decideMemberReadSurface } from "@/lib/member-gateway/contract";
import {
  MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS,
  type MemberWorkSignalPayload,
} from "@/lib/member-gateway/signal";
import {
  MemberSignalStoreError,
  issueMemberWorkSignalChallenge,
  submitMemberWorkSignal,
} from "@/lib/member-gateway/signal-store.service";
import { materializeMemberSignalCandidateSafely } from "@/lib/member-mcp/candidate";
import type { MemberPrincipal, MemberToolEnvelope } from "@/lib/member-gateway/types";
import type { MemberMcpAuthContext } from "@/lib/member-mcp/connection-service";
import { memberRefForUser } from "@/lib/member-mcp/contract";
import {
  buildFieldReportPayload,
  buildMemberMcpEnvelope,
  buildSelfRecordDecision,
  type MemberMcpToolCall,
} from "@/lib/member-mcp/tools";

export const MEMBER_MCP_SIGNAL_POLICY_REF = "member-mcp:self-signal";
// Field reports are recorded under their own policy: downstream readers tell a
// field report from a work signal by this ref alone, never by parsing the
// member-authored detail.
export const MEMBER_MCP_FIELD_REPORT_POLICY_REF = "member-mcp:self-field-report";
export const MEMBER_MCP_SIGNAL_POLICY_VERSION = 1;
const CHALLENGE_TTL_MS = MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS;

type WriteCall = Extract<
  MemberMcpToolCall,
  { toolName: "prepare_work_signal" | "submit_work_signal" | "prepare_field_report" | "submit_field_report" }
>;

export function memberSelfObjectRef(userId: string) {
  return `member-self:${userId}`;
}

// Deterministic per challenge, so a retried submit of the same challenge and
// payload is recognized by the store as a replay and returns the same receipt.
export function memberSignalReceiptId(challengeRef: string) {
  return `mmcp-signal:${challengeRef}`;
}

export function memberMcpPrincipal(auth: MemberMcpAuthContext): MemberPrincipal {
  return {
    workspaceRef: auth.workspaceId,
    memberRef: memberRefForUser(auth.userId),
    sessionRef: `member-mcp-connection:${auth.connectionId}`,
    deviceRegistrationRef: auth.deviceRef,
    clientId: auth.clientType,
  };
}

export async function executeMemberMcpWrite(input: {
  auth: MemberMcpAuthContext;
  call: WriteCall;
  providerRef: string;
  requestId: string;
  now: Date;
}): Promise<MemberToolEnvelope<unknown>> {
  const { auth, call, providerRef, requestId, now } = input;
  const decision = buildSelfRecordDecision({ providerRef, classifiedAt: now, now });
  const fail = (code: string, message: string) =>
    buildMemberMcpEnvelope({ requestId, now, decision, data: null, error: { code, message, retryable: false } });

  // Defense in depth: the protocol layer already refuses a call outside the
  // connection's scopes; the executor refuses it again rather than trusting
  // every caller to have gone through that layer.
  const isReport = call.toolName === "prepare_field_report" || call.toolName === "submit_field_report";
  const requiredScope = isReport ? "member:report:write" : "member:signal:write";
  if (!auth.scopes.includes(requiredScope)) return fail("scope_denied", `This connection lacks ${requiredScope}.`);

  let payload: MemberWorkSignalPayload;
  if (call.toolName === "prepare_field_report" || call.toolName === "submit_field_report") {
    const built = buildFieldReportPayload(call.arguments, auth.fieldReportMetricKeys);
    if (!built.ok) return fail("field_report_invalid", built.message);
    payload = built.payload;
  } else {
    payload = {
      kind: call.arguments.kind,
      summary: call.arguments.summary,
      detail: call.arguments.detail,
      relatedEvidenceRefs: [],
    };
  }

  const principal = memberMcpPrincipal(auth);
  const objectRef = memberSelfObjectRef(auth.userId);
  try {
    if (call.toolName === "prepare_work_signal" || call.toolName === "prepare_field_report") {
      const challenge = await issueMemberWorkSignalChallenge({
        draft: { principal, objectRef, objectVersion: 1, payload },
        ttlMs: CHALLENGE_TTL_MS,
      });
      return buildMemberMcpEnvelope({
        requestId,
        now,
        decision,
        data: {
          challengeRef: challenge.challengeRef,
          expiresAt: challenge.expiresAt,
          payloadHash: challenge.payloadHash,
          recordedAs: { kind: payload.kind, summary: payload.summary },
          next: "用同样的内容加上 challengeRef 调用对应的 submit 工具完成提交。",
        },
        error: null,
      });
    }

    // The challenge must have been issued to this very device and client: a
    // member holding several connections cannot prepare on one and submit on
    // another, which would split the receipt's provenance.
    const challengeRow = await db.memberWorkSignalChallenge.findUnique({
      where: { id_workspaceId: { id: call.arguments.challengeRef, workspaceId: auth.workspaceId } },
      select: { deviceRegistrationRef: true, clientId: true, objectRef: true },
    });
    if (
      challengeRow &&
      (challengeRow.deviceRegistrationRef !== principal.deviceRegistrationRef || challengeRow.clientId !== principal.clientId)
    ) {
      return fail("challenge_device_mismatch", "This challenge was issued to a different device or client.");
    }
    // A challenge issued for another object (e.g. a prompt response) is never
    // redeemed as a self signal or field report.
    if (challengeRow && challengeRow.objectRef !== objectRef) {
      return fail("challenge_not_for_this_tool", "This challenge belongs to a different kind of submission.");
    }

    // Live membership is re-read at submit time; the surface evidence below
    // is only asserted when the member is still ACTIVE.
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
    // named because the target object is the member's own record; the write
    // itself is authorized by the scope in toolScopeRef, not by this label.
    const surface = decideMemberReadSurface({
      workspaceRef: auth.workspaceId,
      memberRef: principal.memberRef,
      objectRef,
      tool: "get_my_brief",
      purpose: "member_self_signal",
      liveMembershipRef: live ? `membership:${auth.membershipId}` : null,
      toolScopeRef: `member-mcp-connection:${auth.connectionId}#${requiredScope}`,
      objectRelationshipAuthorizationRef: `self:${auth.userId}`,
      fieldPurposePolicyRef: `${isReport ? MEMBER_MCP_FIELD_REPORT_POLICY_REF : MEMBER_MCP_SIGNAL_POLICY_REF}:v${MEMBER_MCP_SIGNAL_POLICY_VERSION}`,
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
      policyRef: isReport ? MEMBER_MCP_FIELD_REPORT_POLICY_REF : MEMBER_MCP_SIGNAL_POLICY_REF,
      policyVersion: MEMBER_MCP_SIGNAL_POLICY_VERSION,
      receiptId: memberSignalReceiptId(call.arguments.challengeRef),
    });
    // The receipt stands on its own; the reviewable candidate in /approvals
    // is materialized from it (idempotent, also on a replayed submit).
    const candidate = await materializeMemberSignalCandidateSafely({
      workspaceId: auth.workspaceId,
      signalReceiptId: result.receipt.receiptId,
      objectAnchor: { resolved: false, objectRef, objectVersion: 1 },
    });
    return buildMemberMcpEnvelope({
      requestId,
      now,
      decision,
      data: {
        ...candidate,
        receiptRef: result.receipt.receiptId,
        outcome: result.outcome,
        kind: result.receipt.kind,
        submittedAt: result.receipt.submittedAt,
        candidate: result.receipt.candidate,
        taint: result.receipt.taint,
        note: "已记录为待审阅的候选信号，不代表任何决定或授权。",
      },
      error: null,
    });
  } catch (error) {
    if (error instanceof MemberSignalStoreError) {
      return fail("signal_rejected", error.message);
    }
    throw error;
  }
}
