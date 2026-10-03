import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import type { ModelRouteDecision } from "@/lib/llm/model-egress-contracts";

type Source =
  | { kind: "bi_analysis" | "bi_review"; sourceType: "bi_run"; sourceId: string }
  | { kind: "meeting_extraction"; sourceType: "meeting_note"; sourceId: string }
  | { kind: "recommendation_explanation" | "judgement_review"; sourceType: "recommendation_log"; sourceId: string }
  | { kind: "briefing"; sourceType: "contact" | "company" | "opportunity" | "meeting"; sourceId: string }
  | { kind: "counterfactual_review" | "multi_pass_review";
      sourceType: "bi_run" | "contact" | "company" | "opportunity" | "meeting" | "recommendation_log";
      sourceId: string };

export type OrdinaryPaidOperationRequest = Source & {
  workspaceId: string;
  actorUserId: string | null;
  slot: string;
};

export type OrdinaryReviewObjectType = "bi_run" | "contact" | "company" |
  "opportunity" | "meeting" | "recommendation_log";

/** Only these persisted Core source types may become a paid review request.
 * Free-form objectRef strings are never operation identities. */
export function ordinaryReviewObjectType(value: string): OrdinaryReviewObjectType | null {
  // Review contracts use the public object kind `recommendation`; charging
  // still requires the matching persisted RecommendationLog to resolve below.
  if (value === "recommendation") return "recommendation_log";
  return ["bi_run", "contact", "company", "opportunity", "meeting", "recommendation_log"]
    .includes(value) ? value as OrdinaryReviewObjectType : null;
}

export async function prepareOrdinaryReviewOperation(input: {
  client: PrismaClient | null;
  workspaceId: string;
  actorUserId: string | null | undefined;
  kind: "counterfactual_review" | "multi_pass_review";
  objectType: string;
  objectId: string;
  slot: "counterfactual" | "generator" | "critic" | "adversary";
}) {
  const sourceType = ordinaryReviewObjectType(input.objectType);
  if (!sourceType || !input.actorUserId || !input.client) return null;
  return prepareOrdinaryPaidOperation({ client: input.client,
    workspaceId: input.workspaceId, actorUserId: input.actorUserId,
    kind: input.kind, sourceType, sourceId: input.objectId, slot: input.slot });
}

export class OrdinaryPaidOperationError extends Error {
  constructor(readonly code: string) { super(code); }
}

const SAFE_REF = /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,189}$/u;
const TASK_CLASS: Record<Source["kind"], string> = {
  bi_analysis: "summary_briefing",
  bi_review: "reasoning_counterfactual",
  meeting_extraction: "extraction_classification",
  recommendation_explanation: "summary_briefing",
  briefing: "summary_briefing",
  judgement_review: "reasoning_counterfactual",
  counterfactual_review: "reasoning_counterfactual",
  multi_pass_review: "multi_pass_review",
};
function safe(value: string): string {
  if (typeof value !== "string" || !SAFE_REF.test(value)) throw new OrdinaryPaidOperationError("operation_ref_invalid");
  return value;
}

function assertBoundedSlot(input: Source & { slot: string }) {
  const expected = input.kind === "bi_analysis" ? "analysis"
    : input.kind === "bi_review" ? "review"
      : input.kind === "meeting_extraction" ? "extraction"
        : input.kind === "recommendation_explanation" ? "explanation"
          : input.kind === "judgement_review" ? "critique"
            : input.kind === "counterfactual_review" ? "counterfactual"
              : input.kind === "multi_pass_review" ? input.slot
          : input.sourceType === "meeting" ? "pre_meeting_brief" : "object_brief";
  if (input.kind === "multi_pass_review" &&
      !["generator", "critic", "adversary"].includes(input.slot)) {
    throw new OrdinaryPaidOperationError("operation_slot_invalid");
  }
  if (input.slot !== expected) throw new OrdinaryPaidOperationError("operation_slot_invalid");
}

function checkedStoredSource(row: {
  kind: string; sourceType: string; sourceId: string;
  workspaceId: string; actorUserId: string | null;
}): Source & { workspaceId: string; actorUserId: string | null } {
  if ((row.kind === "bi_analysis" || row.kind === "bi_review") && row.sourceType === "bi_run") {
    return { ...row, kind: row.kind, sourceType: "bi_run" };
  }
  if (row.kind === "meeting_extraction" && row.sourceType === "meeting_note") {
    return { ...row, kind: row.kind, sourceType: "meeting_note" };
  }
  if ((row.kind === "recommendation_explanation" || row.kind === "judgement_review") &&
      row.sourceType === "recommendation_log") {
    return { ...row, kind: row.kind, sourceType: "recommendation_log" };
  }
  if ((row.kind === "counterfactual_review" || row.kind === "multi_pass_review") &&
      ["bi_run", "contact", "company", "opportunity", "meeting", "recommendation_log"].includes(row.sourceType)) {
    return { ...row, kind: row.kind, sourceType: row.sourceType as Extract<Source, { kind: "counterfactual_review" }>['sourceType'] };
  }
  if (row.kind === "briefing" &&
      (row.sourceType === "contact" || row.sourceType === "company" ||
       row.sourceType === "opportunity" || row.sourceType === "meeting")) {
    return { ...row, kind: row.kind, sourceType: row.sourceType };
  }
  throw new OrdinaryPaidOperationError("operation_source_kind_invalid");
}

async function sourceSnapshot(tx: Prisma.TransactionClient, input: Source & {
  workspaceId: string; actorUserId: string | null;
}) {
  if (input.kind === "briefing" ||
      ((input.kind === "counterfactual_review" || input.kind === "multi_pass_review") &&
       ["contact", "company", "opportunity", "meeting"].includes(input.sourceType))) {
    if (!input.actorUserId) throw new OrdinaryPaidOperationError("operation_actor_required");
    if (input.sourceType === "contact") {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Contact WHERE id=${input.sourceId} AND workspaceId=${input.workspaceId} FOR SHARE`;
      const row = locked.length === 1 && locked[0]?.id === input.sourceId ? await tx.contact.findFirst({ where: {
        id: input.sourceId, workspaceId: input.workspaceId,
      }, select: { id: true, workspaceId: true, updatedAt: true,
        name: true, relationshipStage: true } }) : null;
      if (!row || row.id !== input.sourceId || row.workspaceId !== input.workspaceId) throw new OrdinaryPaidOperationError("operation_source_unavailable");
      return { version: row.updatedAt.toISOString(), digest: sha256(canonicalJson(JSON.parse(JSON.stringify(row)))) };
    }
    if (input.sourceType === "company") {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Company WHERE id=${input.sourceId} AND workspaceId=${input.workspaceId} FOR SHARE`;
      const row = locked.length === 1 && locked[0]?.id === input.sourceId ? await tx.company.findFirst({ where: {
        id: input.sourceId, workspaceId: input.workspaceId,
      }, select: { id: true, workspaceId: true, updatedAt: true,
        name: true, cooperationMaturity: true } }) : null;
      if (!row || row.id !== input.sourceId || row.workspaceId !== input.workspaceId) throw new OrdinaryPaidOperationError("operation_source_unavailable");
      return { version: row.updatedAt.toISOString(), digest: sha256(canonicalJson(JSON.parse(JSON.stringify(row)))) };
    }
    if (input.sourceType === "opportunity") {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Opportunity WHERE id=${input.sourceId} AND workspaceId=${input.workspaceId} FOR SHARE`;
      const row = locked.length === 1 && locked[0]?.id === input.sourceId ? await tx.opportunity.findFirst({ where: {
        id: input.sourceId, workspaceId: input.workspaceId,
      }, select: { id: true, workspaceId: true, updatedAt: true,
        title: true, stage: true } }) : null;
      if (!row || row.id !== input.sourceId || row.workspaceId !== input.workspaceId) throw new OrdinaryPaidOperationError("operation_source_unavailable");
      return { version: row.updatedAt.toISOString(), digest: sha256(canonicalJson(JSON.parse(JSON.stringify(row)))) };
    }
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM Meeting WHERE id=${input.sourceId} AND workspaceId=${input.workspaceId} FOR SHARE`;
    const row = locked.length === 1 && locked[0]?.id === input.sourceId ? await tx.meeting.findFirst({ where: {
      id: input.sourceId, workspaceId: input.workspaceId,
    }, select: { id: true, workspaceId: true, updatedAt: true,
      title: true, status: true, opportunityId: true } }) : null;
    if (!row || row.id !== input.sourceId || row.workspaceId !== input.workspaceId) throw new OrdinaryPaidOperationError("operation_source_unavailable");
    return { version: row.updatedAt.toISOString(), digest: sha256(canonicalJson(JSON.parse(JSON.stringify(row)))) };
  }
  if (input.sourceType === "bi_run") {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM BiReportRun WHERE id=${input.sourceId} AND workspaceId=${input.workspaceId} FOR SHARE`;
    if (locked.length !== 1 || locked[0]?.id !== input.sourceId) throw new OrdinaryPaidOperationError("operation_source_unavailable");
    const row = await tx.biReportRun.findFirst({ where: { id: input.sourceId, workspaceId: input.workspaceId },
      select: { id: true, workspaceId: true, updatedAt: true,
        subscriptionId: true, scheduledFor: true, status: true,
        querySummaryJson: true } });
    if (!row || row.id !== input.sourceId || row.workspaceId !== input.workspaceId) throw new OrdinaryPaidOperationError("operation_source_unavailable");
    const subscription = await tx.biReportSubscription.findFirst({ where: {
      id: row.subscriptionId, workspaceId: input.workspaceId,
    }, select: { id: true, workspaceId: true } });
    if (!subscription || subscription.id !== row.subscriptionId ||
        subscription.workspaceId !== input.workspaceId) {
      throw new OrdinaryPaidOperationError("operation_parent_source_unavailable");
    }
    return {
      version: row.updatedAt.toISOString(),
      digest: sha256(canonicalJson({ id: row.id, subscriptionId: row.subscriptionId,
        scheduledFor: row.scheduledFor.toISOString(), status: row.status,
        querySummaryJson: row.querySummaryJson })),
    };
  }
  const actorUserId = input.actorUserId;
  if (!actorUserId) throw new OrdinaryPaidOperationError("operation_actor_required");
  if (input.sourceType === "meeting_note") {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM MeetingNote WHERE id=${input.sourceId} AND workspaceId=${input.workspaceId} FOR SHARE`;
    if (locked.length !== 1 || locked[0]?.id !== input.sourceId) throw new OrdinaryPaidOperationError("operation_source_unavailable");
    const row = await tx.meetingNote.findFirst({ where: { id: input.sourceId, workspaceId: input.workspaceId },
      select: { id: true, workspaceId: true, updatedAt: true,
        meetingId: true, noteKind: true, summary: true,
        liveTranscript: true, keyDecisions: true, confirmations: true } });
    if (!row || row.id !== input.sourceId || row.workspaceId !== input.workspaceId) throw new OrdinaryPaidOperationError("operation_source_unavailable");
    const meeting = await tx.meeting.findFirst({ where: {
      id: row.meetingId, workspaceId: input.workspaceId,
    }, select: { id: true, workspaceId: true } });
    if (!meeting || meeting.id !== row.meetingId || meeting.workspaceId !== input.workspaceId) {
      throw new OrdinaryPaidOperationError("operation_parent_source_unavailable");
    }
    return { version: row.updatedAt.toISOString(), digest: sha256(canonicalJson({ id: row.id,
      meetingId: row.meetingId, noteKind: row.noteKind, summary: row.summary,
      liveTranscript: row.liveTranscript, keyDecisions: row.keyDecisions,
      confirmations: row.confirmations })) };
  }
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM RecommendationLog WHERE id=${input.sourceId} AND workspaceId=${input.workspaceId} FOR SHARE`;
  if (locked.length !== 1 || locked[0]?.id !== input.sourceId) throw new OrdinaryPaidOperationError("operation_source_unavailable");
  const row = await tx.recommendationLog.findFirst({ where: { id: input.sourceId, workspaceId: input.workspaceId },
    select: { id: true, workspaceId: true, updatedAt: true, userId: true,
      objectType: true, objectId: true, actionType: true,
      recommendationPayload: true, explanation: true } });
  if (!row || row.id !== input.sourceId || row.workspaceId !== input.workspaceId) throw new OrdinaryPaidOperationError("operation_source_unavailable");
  if (row.userId && row.userId !== input.actorUserId) {
    throw new OrdinaryPaidOperationError("operation_source_actor_mismatch");
  }
  return { version: row.updatedAt.toISOString(), digest: sha256(canonicalJson({ id: row.id,
    objectType: row.objectType, objectId: row.objectId, actionType: row.actionType,
    recommendationPayload: row.recommendationPayload, explanation: row.explanation })) };
}

/** Create or read a server-bound operation before projection and provider claim.
 * This function never authorizes spending; claim/quote still revalidate in the
 * later serializable dispatch transaction. */
export async function prepareOrdinaryPaidOperation(input: OrdinaryPaidOperationRequest & {
  client: PrismaClient;
}) {
  const actorUserId = input.actorUserId;
  if (!actorUserId) throw new OrdinaryPaidOperationError("operation_actor_required");
  for (const value of [input.workspaceId, input.sourceId, input.slot]) safe(value);
  assertBoundedSlot(input);
  safe(actorUserId);
  return input.client.$transaction(async (tx) => {
    const workspace = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM Workspace WHERE id=${input.workspaceId} FOR UPDATE`;
    if (workspace.length !== 1 || workspace[0]?.id !== input.workspaceId) throw new OrdinaryPaidOperationError("operation_workspace_unavailable");
    const actor = await tx.membership.findFirst({ where: {
      workspaceId: input.workspaceId, userId: actorUserId, status: "ACTIVE",
    } });
    if (!actor || actor.workspaceId !== input.workspaceId || actor.userId !== actorUserId) throw new OrdinaryPaidOperationError("operation_actor_unauthorized");
    const snapshot = await sourceSnapshot(tx, input);
    // The request identity comes from a locked, persisted business source.
    // A caller-supplied request ref or force boolean could mint another paid
    // attempt for the same source, so neither is accepted here. An explicit
    // regeneration needs its own audited source revision before preparation.
    const requestKey = `ordinary:${sha256(canonicalJson({ workspaceId: input.workspaceId,
      sourceType: input.sourceType, sourceId: input.sourceId,
      sourceVersion: snapshot.version, sourceDigest: snapshot.digest,
      kind: input.kind, slot: input.slot }))}`;
    const previousRequest = await tx.lLMWorkflowOperation.findUnique({
      where: { workspaceId_requestKey: { workspaceId: input.workspaceId, requestKey } },
    });
    if (previousRequest) {
      if (previousRequest.kind !== input.kind || previousRequest.sourceType !== input.sourceType ||
          previousRequest.sourceId !== input.sourceId || previousRequest.sourceVersion !== snapshot.version ||
          previousRequest.sourceDigest !== snapshot.digest || previousRequest.actorUserId !== input.actorUserId ||
          previousRequest.slot !== input.slot) throw new OrdinaryPaidOperationError("operation_replay_conflict");
      return previousRequest;
    }
    const latest = await tx.lLMWorkflowOperation.findFirst({ where: {
      workspaceId: input.workspaceId, kind: input.kind, sourceType: input.sourceType,
      sourceId: input.sourceId, slot: input.slot,
    }, orderBy: { generation: "desc" } });
    if (latest && latest.sourceVersion === snapshot.version &&
        latest.sourceDigest === snapshot.digest) {
      if (latest.actorUserId !== input.actorUserId) {
        throw new OrdinaryPaidOperationError("operation_actor_conflict");
      }
      return latest;
    }
    if (latest) {
      // A mutable source row is not a regeneration approval. A paid retry
      // needs a separately persisted, reviewed generation grant, which this
      // public Core slice does not yet possess.
      throw new OrdinaryPaidOperationError("operation_source_revision_unapproved");
    }
    const generation = 1;
    const operationKey = sha256(canonicalJson({ workspaceId: input.workspaceId,
      kind: input.kind, sourceType: input.sourceType, sourceId: input.sourceId,
      sourceVersion: snapshot.version, sourceDigest: snapshot.digest,
      generation, slot: input.slot }));
    return tx.lLMWorkflowOperation.create({ data: {
      workspaceId: input.workspaceId, operationKey, requestKey, kind: input.kind,
      sourceType: input.sourceType, sourceId: input.sourceId,
      sourceVersion: snapshot.version, sourceDigest: snapshot.digest,
      actorUserId: input.actorUserId, generation, slot: input.slot,
    } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** A source revision without a reviewed new generation cannot consume money.
 * Business workflows may still return their existing deterministic output. */
export async function prepareOrdinaryPaidOperationOrFallback(input: OrdinaryPaidOperationRequest & {
  client: PrismaClient | null;
}) {
  if (!input.client) return null;
  try {
    return await prepareOrdinaryPaidOperation({ ...input, client: input.client });
  } catch (error) {
    if (error instanceof OrdinaryPaidOperationError &&
        error.code === "operation_source_revision_unapproved") return null;
    throw error;
  }
}

/** The projection is recorded by the existing authority-checked projection
 * store. This only binds its exact receipt/hash to the previously authenticated
 * operation; it cannot mint a projection receipt or grant a route. */
export async function bindOrdinaryPaidProjection(input: {
  client: PrismaClient; workspaceId: string; operationId: string;
  projectionReceiptRef: string; projectedPayloadHash: string;
}) {
  for (const value of [input.workspaceId, input.operationId, input.projectionReceiptRef]) safe(value);
  if (!/^sha256:[a-f0-9]{64}$/u.test(input.projectedPayloadHash)) {
    throw new OrdinaryPaidOperationError("operation_payload_hash_invalid");
  }
  return input.client.$transaction(async (tx) => {
    const workspace = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM Workspace WHERE id=${input.workspaceId} FOR UPDATE`;
    if (workspace.length !== 1 || workspace[0]?.id !== input.workspaceId) throw new OrdinaryPaidOperationError("operation_workspace_unavailable");
    const projection = await tx.governedModelProjectionReceipt.findFirst({ where: {
      id: input.projectionReceiptRef, workspaceId: input.workspaceId,
    } });
    if (!projection || projection.id !== input.projectionReceiptRef ||
        projection.workspaceId !== input.workspaceId ||
        projection.projectedPayloadHash !== input.projectedPayloadHash ||
        projection.validUntil.getTime() <= Date.now()) {
      throw new OrdinaryPaidOperationError("operation_projection_unavailable");
    }
    const row = await tx.lLMWorkflowOperation.findFirst({ where: {
      id: input.operationId, workspaceId: input.workspaceId,
    } });
    if (!row || row.id !== input.operationId || row.workspaceId !== input.workspaceId ||
        row.status !== "prepared") throw new OrdinaryPaidOperationError("operation_not_prepared");
    assertBoundedSlot({ ...checkedStoredSource(row), slot: row.slot });
    const snapshot = await sourceSnapshot(tx, checkedStoredSource(row));
    if (row.sourceVersion !== snapshot.version || row.sourceDigest !== snapshot.digest) {
      throw new OrdinaryPaidOperationError("operation_source_changed");
    }
    if (!row.actorUserId) throw new OrdinaryPaidOperationError("operation_actor_required");
    const actor = await tx.membership.findFirst({ where: {
      workspaceId: input.workspaceId, userId: row.actorUserId, status: "ACTIVE",
    } });
    if (!actor || actor.workspaceId !== input.workspaceId || actor.userId !== row.actorUserId) throw new OrdinaryPaidOperationError("operation_actor_unauthorized");
    if (row.projectionReceiptRef && (row.projectionReceiptRef !== input.projectionReceiptRef ||
        row.projectedPayloadHash !== input.projectedPayloadHash)) {
      throw new OrdinaryPaidOperationError("operation_projection_conflict");
    }
    return tx.lLMWorkflowOperation.update({ where: { id: row.id }, data: {
      projectionReceiptRef: input.projectionReceiptRef,
      projectedPayloadHash: input.projectedPayloadHash,
    } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Called under the C3 Workspace lock in the same transaction that reserves
 * money and writes the provider dispatch claim. */
export async function verifyOrdinaryPaidOperationInTransaction(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; operationId: string; decision: ModelRouteDecision },
) {
  const row = await tx.lLMWorkflowOperation.findFirst({ where: {
    id: input.operationId, workspaceId: input.workspaceId,
  } });
  if (row) assertBoundedSlot({ ...checkedStoredSource(row), slot: row.slot });
  if (!row || row.id !== input.operationId || row.workspaceId !== input.workspaceId ||
      row.status !== "prepared" || input.decision.taskRef !== `ordinary:${row.id}` ||
      input.decision.workspaceRef !== `workspace:${input.workspaceId}` ||
      input.decision.taskClass !== TASK_CLASS[row.kind as Source["kind"]] ||
      input.decision.projectionReceiptRef !== row.projectionReceiptRef ||
      input.decision.projectedPayloadHash !== row.projectedPayloadHash ||
      (input.decision.attemptOrdinal === 0 && input.decision.requestKey !== row.requestKey)) {
    throw new OrdinaryPaidOperationError("operation_decision_mismatch");
  }
  const snapshot = await sourceSnapshot(tx, checkedStoredSource(row));
  if (snapshot.version !== row.sourceVersion || snapshot.digest !== row.sourceDigest) {
    throw new OrdinaryPaidOperationError("operation_source_changed");
  }
  // The application writer can bind a projection, but persisted row fields
  // are not themselves an authority to mint another charge. Re-derive both
  // identities from the locked source before the dispatch claim is written.
  const expectedRequestKey = `ordinary:${sha256(canonicalJson({
    workspaceId: row.workspaceId, sourceType: row.sourceType,
    sourceId: row.sourceId, sourceVersion: snapshot.version,
    sourceDigest: snapshot.digest, kind: row.kind, slot: row.slot,
  }))}`;
  const expectedOperationKey = sha256(canonicalJson({
    workspaceId: row.workspaceId, kind: row.kind, sourceType: row.sourceType,
    sourceId: row.sourceId, sourceVersion: snapshot.version,
    sourceDigest: snapshot.digest, generation: 1, slot: row.slot,
  }));
  if (row.generation !== 1 || row.requestKey !== expectedRequestKey ||
      row.operationKey !== expectedOperationKey) {
    throw new OrdinaryPaidOperationError("operation_identity_invalid");
  }
  if (!row.actorUserId) throw new OrdinaryPaidOperationError("operation_actor_required");
  const actor = await tx.membership.findFirst({ where: {
    workspaceId: input.workspaceId, userId: row.actorUserId, status: "ACTIVE",
  } });
  if (!actor || actor.workspaceId !== input.workspaceId || actor.userId !== row.actorUserId) throw new OrdinaryPaidOperationError("operation_actor_unauthorized");
  return row;
}
