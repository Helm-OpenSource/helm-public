import "server-only";

// Member MCP P1b online side: the member's two-step confirmation of a
// response to a CAIO prompt, recorded in MemberPromptResponseInbox for the
// asynchronous processor (scripts/member-prompt-response-worker.ts).
//
// Firewall: reachable from app/api/mcp/member/route.ts, so it must never
// import prompt.ts, prompt-store.service or prompt-response-store.service
// (they reach lib/caio-governance). Prompt rows are read directly.
//
// Protected responses (refuse / pause / appeal) are accepted whenever the
// prompt exists and is addressed to the caller — the online side refuses
// them only for malformed input, authentication or scope. Whether the store
// can record them is the processor's question, and a protected response the
// store cannot record is held for a human, never dropped.

import { MembershipStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { decideMemberReadSurface } from "@/lib/member-gateway/contract";
import {
  MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS,
  hashMemberWorkSignalPayload,
  judgeMemberWorkSignalSubmission,
  type MemberWorkSignalChallenge,
} from "@/lib/member-gateway/signal";
import { MemberSignalStoreError, issueMemberWorkSignalChallenge } from "@/lib/member-gateway/signal-store.service";
import type { MemberToolEnvelope } from "@/lib/member-gateway/types";
import type { MemberMcpAuthContext } from "@/lib/member-mcp/connection-service";
import {
  MEMBER_MCP_RESPONSE_LABELS,
  isProtectedResponseKind,
  memberResponseChallengeObjectRef,
  memberResponseConfirmationPayload,
  memberResponseInboxId,
  type MemberPromptResponseIntent,
} from "@/lib/member-mcp/response-contract";
import {
  buildMemberMcpEnvelope,
  buildSelfRecordDecision,
  type MemberMcpToolCall,
} from "@/lib/member-mcp/tools";
import { memberMcpPrincipal } from "@/lib/member-mcp/write-executor";

const OPEN_PROMPT_STATES = new Set(["pending", "delivered", "snoozed"]);
const WRITE_RETRY_OPTIONS = { maxAttempts: 8, retryDelayMs: 50 } as const;

type ResponseCall = Extract<
  MemberMcpToolCall,
  { toolName: "prepare_prompt_response" | "submit_prompt_response" | "get_prompt_response_status" }
>;

class IntakeRejection extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function executeMemberPromptResponse(input: {
  auth: MemberMcpAuthContext;
  call: ResponseCall;
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
  if (!auth.scopes.includes("member:prompt:respond")) {
    return fail("scope_denied", "This connection lacks member:prompt:respond.");
  }
  const principal = memberMcpPrincipal(auth);

  if (call.toolName === "get_prompt_response_status") {
    const row = await db.memberPromptResponseInbox.findFirst({
      where: { id: call.arguments.inboxRef, workspaceId: auth.workspaceId, memberRef: principal.memberRef },
    });
    if (!row) return fail("inbox_not_found", "No such response for this member.");
    return ok(serializeInboxRow(row));
  }

  try {
    const prompt = await db.memberPrompt.findUnique({
      where: { id_workspaceId: { id: call.arguments.promptRef, workspaceId: auth.workspaceId } },
      select: { id: true, memberRef: true, state: true, version: true, expiresAt: true },
    });
    // A prompt addressed to someone else is indistinguishable from a missing one.
    if (!prompt || prompt.memberRef !== principal.memberRef) {
      throw new IntakeRejection("prompt_not_found", "No such prompt for this member.");
    }
    const protectedKind = isProtectedResponseKind(call.arguments.kind);
    if (!protectedKind && (!OPEN_PROMPT_STATES.has(prompt.state) || prompt.expiresAt.getTime() <= now.getTime())) {
      throw new IntakeRejection("prompt_not_open", "This prompt is no longer open for this kind of response.");
    }

    if (call.toolName === "prepare_prompt_response") {
      const intent: MemberPromptResponseIntent = {
        promptRef: prompt.id,
        promptVersion: prompt.version,
        kind: call.arguments.kind,
        text: call.arguments.text,
      };
      const challenge = await issueMemberWorkSignalChallenge({
        draft: {
          principal,
          objectRef: memberResponseChallengeObjectRef(prompt.id),
          objectVersion: prompt.version,
          payload: memberResponseConfirmationPayload(intent),
        },
        ttlMs: MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS,
      });
      return ok({
        challengeRef: challenge.challengeRef,
        expiresAt: challenge.expiresAt,
        recordedAs: { kind: intent.kind, label: MEMBER_MCP_RESPONSE_LABELS[intent.kind] },
        next: "用同样的内容加上 challengeRef 调用 submit_prompt_response 完成提交。",
      });
    }

    // submit_prompt_response
    const challengeRef = call.arguments.challengeRef;
    const inboxId = memberResponseInboxId(challengeRef);
    const membership = await db.membership.findUnique({
      where: { id: auth.membershipId },
      select: { status: true, workspaceId: true, userId: true },
    });
    const live =
      membership?.status === MembershipStatus.ACTIVE &&
      membership.workspaceId === auth.workspaceId &&
      membership.userId === auth.userId;
    const objectRef = memberResponseChallengeObjectRef(prompt.id);
    // decideMemberReadSurface's tool type only admits the L1 read tools (a
    // frozen Member Gateway literal set); get_my_brief is named because the
    // object is the member's own response intake, not a business object.
    const surface = decideMemberReadSurface({
      workspaceRef: auth.workspaceId,
      memberRef: principal.memberRef,
      objectRef,
      tool: "get_my_brief",
      purpose: "member_prompt_response",
      liveMembershipRef: live ? `membership:${auth.membershipId}` : null,
      toolScopeRef: `member-mcp-connection:${auth.connectionId}#member:prompt:respond`,
      objectRelationshipAuthorizationRef: `prompt-addressee:${prompt.id}`,
      fieldPurposePolicyRef: "member-mcp:prompt-response:v1",
      sourceAuthorizationRef: `member-mcp-connection:${auth.connectionId}`,
      tenantProviderEgressPolicyRef: providerRef,
      classification: { sensitivity: "internal", processingDisposition: "remote_projected", classifiedAt: now.toISOString() },
    });

    const result = await runWithWriteConflictRetry(
      () =>
        db.$transaction(
          async (tx) => {
            const challengeRow = await tx.memberWorkSignalChallenge.findUnique({
              where: { id_workspaceId: { id: challengeRef, workspaceId: auth.workspaceId } },
            });
            if (!challengeRow) throw new IntakeRejection("challenge_not_found", "Unknown challengeRef.");
            const intent: MemberPromptResponseIntent = {
              promptRef: prompt.id,
              promptVersion: challengeRow.objectVersion,
              kind: call.arguments.kind,
              text: call.arguments.text,
            };
            const payload = memberResponseConfirmationPayload(intent);
            const payloadHash = hashMemberWorkSignalPayload(payload);
            // Idempotent replay: the same challenge already produced this inbox row.
            if (challengeRow.consumedAt !== null) {
              if (challengeRow.consumptionReceiptRef === inboxId) {
                const existing = await tx.memberPromptResponseInbox.findUnique({ where: { id: inboxId } });
                if (existing && existing.payloadHash === payloadHash) return { replay: true as const, row: existing };
                throw new IntakeRejection("challenge_payload_hash_mismatch", "The content differs from the prepared response.");
              }
              throw new IntakeRejection("challenge_already_consumed", "This challengeRef was already used.");
            }
            const challenge: MemberWorkSignalChallenge = {
              challengeRef: challengeRow.id,
              workspaceRef: challengeRow.workspaceId,
              memberRef: challengeRow.memberRef,
              objectRef: challengeRow.objectRef,
              objectVersion: challengeRow.objectVersion,
              payloadHash: challengeRow.payloadHash,
              issuedAt: challengeRow.issuedAt.toISOString(),
              expiresAt: challengeRow.expiresAt.toISOString(),
            };
            const judgment = judgeMemberWorkSignalSubmission({
              challenge,
              principal,
              payload,
              surface,
              submittedAt: now.toISOString(),
              priorConsumptionRef: null,
            });
            const reasons = [...judgment.errors];
            if (challengeRow.objectRef !== objectRef) reasons.push("challenge_object_mismatch");
            if (
              challengeRow.deviceRegistrationRef !== principal.deviceRegistrationRef ||
              challengeRow.clientId !== principal.clientId
            ) {
              reasons.push("challenge_device_mismatch");
            }
            if (reasons.length > 0) {
              throw new IntakeRejection(
                reasons.includes("challenge_payload_hash_mismatch") ? "challenge_payload_hash_mismatch" : "challenge_rejected",
                reasons.join(", "),
              );
            }
            const consumed = await tx.memberWorkSignalChallenge.updateMany({
              where: { id: challengeRef, workspaceId: auth.workspaceId, consumedAt: null },
              data: { consumedAt: now, consumptionReceiptRef: inboxId },
            });
            if (consumed.count !== 1) throw new IntakeRejection("challenge_already_consumed", "This challengeRef was already used.");
            const row = await tx.memberPromptResponseInbox.create({
              data: {
                id: inboxId,
                workspaceId: auth.workspaceId,
                connectionId: auth.connectionId,
                memberRef: principal.memberRef,
                deviceRegistrationRef: principal.deviceRegistrationRef,
                clientId: principal.clientId,
                promptRef: prompt.id,
                promptVersion: challengeRow.objectVersion,
                kind: intent.kind,
                payloadJson: payload.detail,
                payloadHash,
                memberChallengeRef: challengeRef,
                status: "received",
                receivedAt: now,
              },
            });
            return { replay: false as const, row };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      WRITE_RETRY_OPTIONS,
    );
    return ok({
      ...serializeInboxRow(result.row),
      replay: result.replay,
      note: "已收到，后台约 1 分钟内正式登记。用 get_prompt_response_status 查看结果。",
    });
  } catch (error) {
    if (error instanceof IntakeRejection) return fail(error.code, error.message);
    if (error instanceof MemberSignalStoreError) return fail("challenge_rejected", error.message);
    throw error;
  }
}

type InboxRow = Prisma.MemberPromptResponseInboxGetPayload<object>;

function serializeInboxRow(row: InboxRow) {
  return {
    inboxRef: row.id,
    promptRef: row.promptRef,
    kind: row.kind,
    status: row.status,
    needsHuman: row.needsHuman,
    outcomeCode: row.lastErrorCode,
    responseReceiptRef: row.responseReceiptRef,
    signalReceiptRef: row.signalReceiptRef,
    candidateBundleRef: row.candidateBundleRef,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
  };
}
