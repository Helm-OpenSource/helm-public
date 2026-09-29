import "server-only";

// Member MCP P1b processor: registers member responses recorded by the online
// intake (MemberPromptResponseInbox) through the Member Gateway response
// store, which validates protected responses with lib/caio-governance.
//
// FIREWALL: this module reaches lib/caio-governance and must only ever be
// used by the controlled CLI scripts/member-prompt-response-worker.ts. No
// app route, server action, job registered in lib/extensions/registry or any
// other restricted surface may import it (scripts/check-caio-terminology.ts
// enforces this on every PR).
//
// Outcomes per row:
// - registered: the store recorded the response (receipt ref written back);
// - rejected:   terminal, closed-set code; only for non-protected kinds;
// - held:       a protected response (refuse / pause / appeal) the store
//               cannot record — kept for a human, never dropped;
// - received:   transient failure or no active CAIO mandate yet — retried on
//               the next run. Non-protected rows give up after
//               MEMBER_RESPONSE_MAX_ATTEMPTS (processor_exhausted); protected
//               rows are flagged needsHuman instead and keep being retried.

import { randomUUID } from "node:crypto";
import { MembershipStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { decideMemberReadSurface } from "@/lib/member-gateway/contract";
import {
  MemberPromptResponseStoreError,
  issueMemberPromptResponseChallenge,
  recordMemberPromptResponse,
  respondWithWorkSignal,
} from "@/lib/member-gateway/prompt-response-store.service";
import { MemberPromptStoreError, transitionMemberPrompt } from "@/lib/member-gateway/prompt-store.service";
import { hashMemberWorkSignalPayload, type MemberWorkSignalPayload } from "@/lib/member-gateway/signal";
import { MemberSignalStoreError, issueMemberWorkSignalChallenge } from "@/lib/member-gateway/signal-store.service";
import type { MemberPrincipal } from "@/lib/member-gateway/types";
import { materializeMemberSignalCandidateSafely } from "@/lib/member-mcp/candidate";
import { readMemberMcpWorkspaceFlags } from "@/lib/member-mcp/contract";
import {
  MEMBER_MCP_RESPONSE_LABELS,
  MEMBER_RESPONSE_MAX_ATTEMPTS,
  isCandidateResponseKind,
  isProtectedResponseKind,
  memberResponseConfirmationPayload,
  memberResponseReceiptId,
  memberResponseSignalReceiptId,
  memberResponseTransitionReceiptId,
  parseStoredResponseIntent,
  type MemberPromptResponseIntent,
  type MemberResponseOutcomeCode,
} from "@/lib/member-mcp/response-contract";

type InboxRow = Prisma.MemberPromptResponseInboxGetPayload<object>;

const WRITE_RETRY_OPTIONS = { maxAttempts: 8, retryDelayMs: 50 } as const;
const CLAIM_LEASE_MS = 5 * 60_000;
const STORE_CHALLENGE_TTL_MS = 60_000;
const TERMINAL_PROMPT_STATES = new Set(["responded", "withdrawn", "expired", "suppressed"]);
// Store reasons that mean "someone else moved the row first" — retry.
const TRANSIENT_STORE_REASONS = new Set([
  "prompt_version_conflict",
  "prompt_transition_conflict",
  "prompt_receipt_conflict_concurrent",
  "challenge_consumption_conflict",
]);

export type ProcessorOutcome =
  | { status: "registered"; responseReceiptRef: string | null; signalReceiptRef: string | null; candidate?: CandidateFields }
  | { status: "rejected" | "held"; code: MemberResponseOutcomeCode; detail: string | null }
  | { status: "retry"; code: MemberResponseOutcomeCode | "transient"; detail: string | null; needsHuman: boolean };

type CandidateFields = { candidateBundleRef: string | null; candidateCode: string | null };

export type ProcessorRunSummary = {
  dryRun: boolean;
  scanned: number;
  claimed: number;
  results: Array<{ inboxRef: string; kind: string; status: string; code: string | null }>;
  skippedWorkspaces: string[];
};

export async function runMemberPromptResponseProcessor(options: {
  workspaceId?: string | null;
  dryRun?: boolean;
  limit?: number;
  now?: () => Date;
  env?: Readonly<Record<string, string | undefined>>;
}): Promise<ProcessorRunSummary> {
  const clock = options.now ?? (() => new Date());
  const env = options.env ?? process.env;
  const dryRun = options.dryRun === true;
  const rows = await db.memberPromptResponseInbox.findMany({
    where: { status: "received", ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}) },
    orderBy: { receivedAt: "asc" },
    take: options.limit ?? 50,
  });
  const summary: ProcessorRunSummary = { dryRun, scanned: rows.length, claimed: 0, results: [], skippedWorkspaces: [] };
  const flagCache = new Map<string, boolean>();
  for (const row of rows) {
    if (!flagCache.has(row.workspaceId)) {
      const workspace = await db.workspace.findUnique({ where: { id: row.workspaceId }, select: { featureFlagsJson: true } });
      const enabled = readMemberMcpWorkspaceFlags(workspace?.featureFlagsJson, env).enabled;
      flagCache.set(row.workspaceId, enabled);
      if (!enabled) summary.skippedWorkspaces.push(row.workspaceId);
    }
    if (!flagCache.get(row.workspaceId)) continue;
    if (dryRun) {
      summary.results.push({ inboxRef: row.id, kind: row.kind, status: "would_process", code: null });
      continue;
    }
    const now = clock();
    const claimToken = randomUUID();
    const claimed = await claimRow(row, claimToken, now);
    if (!claimed) continue;
    summary.claimed += 1;
    let outcome: ProcessorOutcome;
    try {
      outcome = await processRow(claimed, now);
    } catch (error) {
      outcome = {
        status: "retry",
        code: "transient",
        detail: truncate(error instanceof Error ? error.message : String(error)),
        needsHuman: false,
      };
    }
    const status = await finalizeRow(claimed, claimToken, outcome, now);
    summary.results.push({
      inboxRef: row.id,
      kind: row.kind,
      status,
      code: "code" in outcome ? outcome.code : null,
    });
  }
  return summary;
}

// Lease-based claim: a single processor normally runs, but a crashed run's
// claim expires after CLAIM_LEASE_MS so the row is never stuck.
async function claimRow(row: InboxRow, claimToken: string, now: Date): Promise<InboxRow | null> {
  const leaseCutoff = new Date(now.getTime() - CLAIM_LEASE_MS);
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(
        async (tx) => {
          const result = await tx.memberPromptResponseInbox.updateMany({
            where: {
              id: row.id,
              status: "received",
              version: row.version,
              OR: [{ claimedAt: null }, { claimedAt: { lt: leaseCutoff } }],
            },
            data: { claimToken, claimedAt: now, attempts: { increment: 1 }, version: { increment: 1 } },
          });
          if (result.count !== 1) return null;
          return tx.memberPromptResponseInbox.findUnique({ where: { id: row.id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    WRITE_RETRY_OPTIONS,
  );
}

async function finalizeRow(row: InboxRow, claimToken: string, outcome: ProcessorOutcome, now: Date): Promise<string> {
  const protectedKind = isProtectedResponseKind(row.kind);
  let data: Prisma.MemberPromptResponseInboxUpdateManyMutationInput;
  let status: string;
  if (outcome.status === "registered") {
    status = "registered";
    data = {
      status,
      processedAt: now,
      needsHuman: false,
      lastErrorCode: null,
      lastErrorDetail: null,
      responseReceiptRef: outcome.responseReceiptRef,
      signalReceiptRef: outcome.signalReceiptRef,
      ...(outcome.candidate ?? {}),
    };
  } else if (outcome.status === "rejected" || outcome.status === "held") {
    status = outcome.status;
    data = {
      status,
      processedAt: now,
      needsHuman: outcome.status === "held",
      lastErrorCode: outcome.code,
      lastErrorDetail: outcome.detail,
    };
  } else if (outcome.status === "retry" && !protectedKind && row.attempts >= MEMBER_RESPONSE_MAX_ATTEMPTS) {
    // A rejection always writes a terminal state (never left dangling).
    status = "rejected";
    data = {
      status,
      processedAt: now,
      lastErrorCode: "processor_exhausted",
      lastErrorDetail: truncate(`${outcome.code}: ${outcome.detail ?? ""}`),
    };
  } else if (outcome.status === "retry") {
    status = "received";
    data = {
      needsHuman: outcome.needsHuman || (protectedKind && row.attempts >= MEMBER_RESPONSE_MAX_ATTEMPTS),
      lastErrorCode: outcome.code === "transient" ? null : outcome.code,
      lastErrorDetail: outcome.detail,
    };
  } else {
    throw new Error("unreachable processor outcome");
  }
  await runWithWriteConflictRetry(
    () =>
      db.$transaction(
        async (tx) => {
          const result = await tx.memberPromptResponseInbox.updateMany({
            where: { id: row.id, claimToken },
            data: { ...data, claimToken: null, claimedAt: null, version: { increment: 1 } },
          });
          if (result.count !== 1) throw new Error(`member response inbox claim lost for ${row.id}`);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    WRITE_RETRY_OPTIONS,
  );
  return status;
}

function truncate(value: string, max = 500) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// Closed rejection for a non-protected response; a protected one is held.
function refuseOrHold(row: InboxRow, code: MemberResponseOutcomeCode, detail: string | null): ProcessorOutcome {
  return { status: isProtectedResponseKind(row.kind) ? "held" : "rejected", code, detail };
}

async function processRow(row: InboxRow, now: Date): Promise<ProcessorOutcome> {
  const intent = parseStoredResponseIntent(row.payloadJson);
  if (
    !intent ||
    intent.kind !== row.kind ||
    intent.promptRef !== row.promptRef ||
    hashMemberWorkSignalPayload(memberResponseConfirmationPayload(intent)) !== row.payloadHash
  ) {
    return refuseOrHold(row, "payload_corrupt", null);
  }
  const principal: MemberPrincipal = {
    workspaceRef: row.workspaceId,
    memberRef: row.memberRef,
    sessionRef: `member-mcp-connection:${row.connectionId}`,
    deviceRegistrationRef: row.deviceRegistrationRef,
    clientId: row.clientId,
  };

  // Idempotency: an earlier attempt may have written the receipt and then
  // lost its finalize step.
  const receiptId = memberResponseReceiptId(row.id);
  const signalReceiptId = memberResponseSignalReceiptId(row.id);
  if (!isCandidateResponseKind(intent.kind)) {
    const existing = await db.memberPromptResponseReceipt.findUnique({
      where: { id_workspaceId: { id: receiptId, workspaceId: row.workspaceId } },
      select: { id: true },
    });
    if (existing) return { status: "registered", responseReceiptRef: existing.id, signalReceiptRef: null };
  }

  const prompt = await readPrompt(row);
  if (!prompt) return refuseOrHold(row, "prompt_not_found", null);
  if (prompt.memberRef !== row.memberRef) return refuseOrHold(row, "prompt_not_addressed_to_member", null);

  if (isCandidateResponseKind(intent.kind)) {
    return processCandidate(row, intent, principal, signalReceiptId, now);
  }

  const ready = await bringToDelivered(row, now);
  if (ready.status !== "ready") return ready.outcome;

  let protectedInput: Parameters<typeof recordMemberPromptResponse>[0]["protectedInput"];
  if (isProtectedResponseKind(intent.kind)) {
    const mandateRef = await activeMandateRef(row.workspaceId, now);
    if (!mandateRef) {
      // Never dropped: stays received and is retried every run, so it
      // registers as soon as a CAIO mandate is active; a human is flagged.
      return {
        status: "retry",
        code: "mandate_missing",
        detail: "no active CAIO mandate in this workspace",
        needsHuman: true,
      };
    }
    protectedInput = {
      // The member raised it from their own client: that client is the
      // local fallback path; user-presence confirmation is not available
      // through MCP.
      userPresenceAvailable: false,
      localFallbackAvailable: true,
      routePath: "local_fallback",
      mandateRef,
      reason: intent.text,
      auditRefs: [row.id, `member-mcp-connection:${row.connectionId}`, row.memberChallengeRef],
      governanceResponseId: `mmcp-governance:${row.id}`,
    };
  }

  try {
    const challenge = await issueMemberPromptResponseChallenge({
      principal,
      promptRef: row.promptRef,
      promptVersion: ready.version,
      responsePayload: intent,
      ttlMs: STORE_CHALLENGE_TTL_MS,
    });
    const recorded = await recordMemberPromptResponse({
      principal,
      promptRef: row.promptRef,
      expectedVersion: ready.version,
      challengeRef: challenge.challengeRef,
      responsePayload: intent,
      kind: intent.kind,
      receiptId,
      transitionReceiptId: memberResponseTransitionReceiptId(row.id, "respond"),
      now: new Date().toISOString(),
      protectedInput,
    });
    return { status: "registered", responseReceiptRef: recorded.receipt.receiptId, signalReceiptRef: null };
  } catch (error) {
    return mapStoreError(row, error);
  }
}

function mapStoreError(row: InboxRow, error: unknown): ProcessorOutcome {
  if (error instanceof MemberPromptResponseStoreError || error instanceof MemberPromptStoreError) {
    const reasons = error instanceof MemberPromptResponseStoreError ? error.reasons : [];
    const all = [...reasons, error.message];
    if (all.some((reason) => TRANSIENT_STORE_REASONS.has(reason.split(":")[0]))) {
      return { status: "retry", code: "transient", detail: truncate(error.message), needsHuman: false };
    }
    if (all.some((reason) => reason.startsWith("prompt_expired"))) {
      return refuseOrHold(row, "prompt_expired", truncate(error.message));
    }
    if (all.some((reason) => reason.startsWith("prompt_transition_rejected"))) {
      return refuseOrHold(row, "prompt_closed", truncate(error.message));
    }
    return refuseOrHold(row, "store_rejected", truncate(error.message));
  }
  if (error instanceof MemberSignalStoreError) {
    return refuseOrHold(row, "store_rejected", truncate(error.message));
  }
  throw error;
}

async function readPrompt(row: InboxRow) {
  return db.memberPrompt.findUnique({
    where: { id_workspaceId: { id: row.promptRef, workspaceId: row.workspaceId } },
    select: { id: true, memberRef: true, state: true, version: true, expiresAt: true, subjectObjectRef: true },
  });
}

// Responding is only legal from "delivered". The member pulled the prompt
// through their own client (owner ruling 2026-09-29: pending prompts are
// visible to the member), so the processor records that delivery first: a
// member-initiated read is not an interruption, hence no quiet-hours or
// do-not-disturb hold. A snoozed prompt is unsnoozed for the same reason.
async function bringToDelivered(
  row: InboxRow,
  now: Date,
): Promise<{ status: "ready"; version: number } | { status: "stop"; outcome: ProcessorOutcome }> {
  for (let step = 0; step < 3; step += 1) {
    const prompt = await readPrompt(row);
    if (!prompt) return { status: "stop", outcome: refuseOrHold(row, "prompt_not_found", null) };
    if (TERMINAL_PROMPT_STATES.has(prompt.state)) {
      return {
        status: "stop",
        outcome: refuseOrHold(row, prompt.state === "expired" ? "prompt_expired" : "prompt_closed", `prompt state ${prompt.state}`),
      };
    }
    if (prompt.expiresAt.getTime() <= now.getTime()) {
      return { status: "stop", outcome: refuseOrHold(row, "prompt_expired", null) };
    }
    if (prompt.state === "delivered") return { status: "ready", version: prompt.version };
    const cause = prompt.state === "snoozed" ? "unsnooze" : "deliver";
    try {
      await transitionMemberPrompt({
        workspaceRef: row.workspaceId,
        promptRef: row.promptRef,
        cause,
        expectedVersion: prompt.version,
        receiptId: `${memberResponseTransitionReceiptId(row.id, cause)}:v${prompt.version}`,
        now: new Date().toISOString(),
        deliveryContext: { inQuietHours: false, doNotDisturb: false },
      });
    } catch (error) {
      if (!(error instanceof MemberPromptStoreError)) throw error;
      // Re-read and decide again; a concurrent transition is fine.
    }
  }
  return { status: "stop", outcome: { status: "retry", code: "transient", detail: "prompt did not settle to delivered", needsHuman: false } };
}

// The workspace's currently active CAIO mandate (CaioActiveMandateClaim is
// the one-per-workspace pointer); null when none is active and valid now.
async function activeMandateRef(workspaceId: string, now: Date): Promise<string | null> {
  const claim = await db.caioActiveMandateClaim.findUnique({
    where: { workspaceId },
    select: { mandateRecord: { select: { id: true, status: true, validFrom: true, validUntil: true } } },
  });
  const mandate = claim?.mandateRecord;
  if (!mandate || mandate.status !== "active") return null;
  if (mandate.validFrom.getTime() > now.getTime() || mandate.validUntil.getTime() <= now.getTime()) return null;
  return mandate.id;
}

// progress_report / free_text_answer are candidate writes: a work signal on
// the prompt's subject object plus the "respond" transition
// (respondWithWorkSignal), then the reviewable candidate for /approvals.
async function processCandidate(
  row: InboxRow,
  intent: MemberPromptResponseIntent,
  principal: MemberPrincipal,
  signalReceiptId: string,
  now: Date,
): Promise<ProcessorOutcome> {
  const prompt = await readPrompt(row);
  if (!prompt) return refuseOrHold(row, "prompt_not_found", null);
  const existingSignal = await db.memberWorkSignalReceipt.findUnique({
    where: { id_workspaceId: { id: signalReceiptId, workspaceId: row.workspaceId } },
    select: { id: true },
  });
  if (existingSignal) {
    // The signal was recorded by an earlier attempt; finish the transition.
    if (prompt.state !== "responded") {
      const ready = await bringToDelivered(row, now);
      if (ready.status !== "ready") return ready.outcome;
      try {
        await transitionMemberPrompt({
          workspaceRef: row.workspaceId,
          promptRef: row.promptRef,
          cause: "respond",
          expectedVersion: ready.version,
          receiptId: memberResponseTransitionReceiptId(row.id, "respond"),
          now: new Date().toISOString(),
          responseRef: signalReceiptId,
        });
      } catch (error) {
        return mapStoreError(row, error);
      }
    }
    return {
      status: "registered",
      responseReceiptRef: null,
      signalReceiptRef: signalReceiptId,
      candidate: await materialize(row, signalReceiptId, prompt.subjectObjectRef),
    };
  }

  const ready = await bringToDelivered(row, now);
  if (ready.status !== "ready") return ready.outcome;

  const label = MEMBER_MCP_RESPONSE_LABELS[intent.kind];
  const payload: MemberWorkSignalPayload = {
    kind: "progress",
    summary: `回应提问（${label}）：${intent.text.replace(/\s+/g, " ").slice(0, 200)}`,
    detail: intent.text,
    relatedEvidenceRefs: [],
  };
  const membership = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: row.workspaceId, userId: row.memberRef } },
    select: { id: true, status: true },
  });
  const surface = decideMemberReadSurface({
    workspaceRef: row.workspaceId,
    memberRef: row.memberRef,
    objectRef: prompt.subjectObjectRef,
    tool: "get_my_brief",
    purpose: "member_prompt_response",
    liveMembershipRef: membership?.status === MembershipStatus.ACTIVE ? `membership:${membership.id}` : null,
    toolScopeRef: `member-mcp-connection:${row.connectionId}#member:prompt:respond`,
    // The prompt itself addressed this subject object to this member.
    objectRelationshipAuthorizationRef: `prompt-addressee:${row.promptRef}`,
    fieldPurposePolicyRef: "member-mcp:prompt-response:v1",
    sourceAuthorizationRef: `member-mcp-inbox:${row.id}`,
    tenantProviderEgressPolicyRef: `member-mcp-client:${row.clientId}`,
    classification: { sensitivity: "internal", processingDisposition: "remote_projected", classifiedAt: now.toISOString() },
  });
  try {
    const challenge = await issueMemberWorkSignalChallenge({
      draft: { principal, objectRef: prompt.subjectObjectRef, objectVersion: 1, payload },
      ttlMs: STORE_CHALLENGE_TTL_MS,
    });
    const result = await respondWithWorkSignal({
      principal,
      challengeRef: challenge.challengeRef,
      payload,
      surface,
      evidenceSurfaces: new Map(),
      policyRef: "member-mcp:prompt-response",
      policyVersion: 1,
      receiptId: signalReceiptId,
      promptRef: row.promptRef,
      expectedVersion: ready.version,
      transitionReceiptId: memberResponseTransitionReceiptId(row.id, "respond"),
      now: new Date().toISOString(),
    });
    if (!result.transitioned) {
      // The signal stands; the transition is retried on the next run.
      return { status: "retry", code: "transient", detail: truncate(result.transitionError ?? "transition failed"), needsHuman: false };
    }
    return {
      status: "registered",
      responseReceiptRef: null,
      signalReceiptRef: result.receipt.receiptId,
      candidate: await materialize(row, result.receipt.receiptId, prompt.subjectObjectRef),
    };
  } catch (error) {
    return mapStoreError(row, error);
  }
}

async function materialize(row: InboxRow, signalReceiptId: string, subjectObjectRef: string): Promise<CandidateFields> {
  const outcome = await materializeMemberSignalCandidateSafely({
    workspaceId: row.workspaceId,
    signalReceiptId,
    objectAnchor: { resolved: false, objectRef: subjectObjectRef, objectVersion: 1 },
  });
  return { candidateBundleRef: outcome.candidateBundleRef, candidateCode: outcome.candidateCode };
}
