import { createHash } from "node:crypto";

import type { CaioAttentionCase } from "@prisma/client";

import { resolveCaioAttentionSystemEvidence as resolveSystemEvidence } from "@/lib/caio-attention-runtime/evidence-resolver";

import { CAIO_ATTENTION_DISPOSITION_OUTCOMES } from "../contracts";
import { evaluateCaioAttentionReviewEvidence, parseCaioAttentionEvidenceRefs } from "../evidence";
import {
  accepted, appendCaioAttentionEvent, casCaioAttentionCase, rejectCaioAttention, runCaioAttentionActorOperation,
  type CaioAttentionActorRequest, type CaioAttentionLifecycleDeps, type CaioAttentionLifecycleResult,
} from "./core";
import { authorizeCaioAttentionOperation, isCaioAttentionResponse } from "../state-machine";

/**
 * Primary and reviewer operations (design v4 §3, §5; v5 §2.2): ack, note, submitting the operating disposition,
 * and the assigned reviewer's accept / return. System evidence refs are looked up in the database inside the
 * transaction at submission and again at review; the review row is written in the same transaction as the close.
 */

type Request = CaioAttentionActorRequest & Readonly<{ expectedCommandVersion: number }>;
const text = (value: unknown, max: number) => (typeof value === "string" && value.trim().length > 0 && value.length <= max ? value.trim() : null);

function evidenceContext(row: CaioAttentionCase, disposedAt: Date) {
  return { workspaceId: row.workspaceId, detectorId: row.detectorId, dispatchedAt: row.dispatchedAt ?? new Date(0), disposedAt };
}

/** ack (DISPATCHED) and note (DISPATCHED / DISPOSITION_SUBMITTED). Only the current primary's action counts as a response. */
function respond(deps: CaioAttentionLifecycleDeps, op: "ack" | "note", request: Request & Readonly<{ note?: string }>) {
  const note = op === "note" ? text(request.note, 2000) : null;
  if (op === "note" && !note) return Promise.resolve(rejectCaioAttention("input_invalid", ["note_required"]));
  const eventKind = op === "ack" ? "ACK" : "NOTE";
  return runCaioAttentionActorOperation(deps, request, { eventKind, gated: false }, async ({ tx, row, parties, actor, now, requestId }) => {
    const auth = authorizeCaioAttentionOperation({ op, actor, parties, expectedCommandVersion: request.expectedCommandVersion });
    if (!auth.ok) return rejectCaioAttention(auth.reason);
    const response = isCaioAttentionResponse(op, actor.userId, parties);
    if (response && !row.respondedAt) await casCaioAttentionCase(tx, row, { respondedAt: now });
    await appendCaioAttentionEvent(tx, {
      caseId: row.id, kind: eventKind, commandVersion: row.commandVersion, actorUserId: actor.userId, clientRequestId: requestId,
      payload: { note, response },
    });
    return accepted(row.id, parties.status, row.commandVersion);
  });
}

export const ackCaioAttentionCase = (deps: CaioAttentionLifecycleDeps, request: Request) => respond(deps, "ack", request);
export const noteCaioAttentionCase = (deps: CaioAttentionLifecycleDeps, request: Request & Readonly<{ note: string }>) => respond(deps, "note", request);

export type CaioAttentionDispositionInput = Readonly<{
  disposedAt: Date; outcome: string; actionTaken: string; note?: string; evidenceRefs: readonly string[];
}>;

/** The current primary submits the operating disposition (DISPATCHED -> DISPOSITION_SUBMITTED). */
export function submitCaioAttentionDisposition(
  deps: CaioAttentionLifecycleDeps, request: Request & Readonly<{ disposition: CaioAttentionDispositionInput }>,
): Promise<CaioAttentionLifecycleResult> {
  const input = request.disposition;
  const actionTaken = text(input.actionTaken, 4000);
  const note = input.note === undefined ? null : text(input.note, 2000);
  const parsed = parseCaioAttentionEvidenceRefs(input.evidenceRefs);
  if (!actionTaken || !(CAIO_ATTENTION_DISPOSITION_OUTCOMES as readonly string[]).includes(input.outcome) || !(input.disposedAt instanceof Date) || Number.isNaN(input.disposedAt.getTime())
    || (input.note !== undefined && !note) || !parsed.ok) {
    return Promise.resolve(rejectCaioAttention("input_invalid", parsed.ok ? undefined : [parsed.errorCode]));
  }
  return runCaioAttentionActorOperation(deps, request, { eventKind: "DISPOSITION_SUBMITTED", gated: false },
    async ({ tx, row, parties, actor, now, requestId }) => {
      const auth = authorizeCaioAttentionOperation({ op: "submitDisposition", actor, parties, expectedCommandVersion: request.expectedCommandVersion });
      if (!auth.ok) return rejectCaioAttention(auth.reason);
      if (input.disposedAt.getTime() > now.getTime()) return rejectCaioAttention("input_invalid", ["disposed_in_future"]);
      // Same evidence rules as review, with every external ref provisionally counted: a submission the reviewer
      // could never accept is refused here, and every system ref must exist in this workspace and be timely.
      const externalRefs = parsed.refs.filter((r) => r.role === "external").map((r) => r.ref);
      const check = evaluateCaioAttentionReviewEvidence({
        evidenceRefs: input.evidenceRefs, resolved: await resolveSystemEvidence(tx, input.evidenceRefs),
        attestedExternalRefs: externalRefs, reviewNote: "submission", context: evidenceContext(row, input.disposedAt),
      });
      if (!check.ok) return rejectCaioAttention("evidence_invalid", check.reasons);
      const last = await tx.caioAttentionDisposition.findFirst({ where: { caseId: row.id }, orderBy: { sequence: "desc" }, select: { sequence: true } });
      const sequence = (last?.sequence ?? 0) + 1;
      const content = {
        commandVersion: row.commandVersion, sequence, submittedByUserId: actor.userId, disposedAt: input.disposedAt.toISOString(),
        outcome: input.outcome, actionTaken, note, evidenceRefs: [...input.evidenceRefs],
      };
      const disposition = await tx.caioAttentionDisposition.create({
        data: {
          workspaceId: row.workspaceId, caseId: row.id, commandVersion: row.commandVersion, sequence, submittedByUserId: actor.userId,
          disposedAt: input.disposedAt, outcome: input.outcome, actionTaken, note, evidenceRefsJson: JSON.stringify(content.evidenceRefs),
          contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
        },
        select: { id: true },
      });
      await casCaioAttentionCase(tx, row, { status: "DISPOSITION_SUBMITTED", respondedAt: row.respondedAt ?? now });
      await appendCaioAttentionEvent(tx, {
        caseId: row.id, kind: "DISPOSITION_SUBMITTED", commandVersion: row.commandVersion, actorUserId: actor.userId, clientRequestId: requestId,
        payload: { dispositionId: disposition.id, sequence },
      });
      return accepted(row.id, "DISPOSITION_SUBMITTED", row.commandVersion);
    });
}

/**
 * Assigned reviewer accepts (-> CLOSED) or returns (-> DISPATCHED) the current disposition. Re-checked under the case
 * lock: reviewer set and version, review capability, separation of duties (never the submitter, the primary or a cc
 * person), and that the disposition is the latest, unsuperseded one of the current command. Accept also re-runs the
 * evidence lookups with the reviewer's attestations. The review row is written in the closing transaction.
 */
export function reviewCaioAttentionDisposition(
  deps: CaioAttentionLifecycleDeps,
  request: Request & Readonly<{
    decision: "ACCEPT" | "RETURN"; dispositionId: string; reviewerVersion: number; attestedExternalRefs: readonly string[]; note: string;
  }>,
): Promise<CaioAttentionLifecycleResult> {
  const note = text(request.note, 2000);
  if (!note || (request.decision !== "ACCEPT" && request.decision !== "RETURN")) {
    return Promise.resolve(rejectCaioAttention("input_invalid", ["review_note_required"]));
  }
  const op = request.decision === "ACCEPT" ? "reviewAccept" : "reviewReturn";
  const eventKind = request.decision === "ACCEPT" ? "REVIEW_ACCEPTED" : "REVIEW_RETURNED";
  return runCaioAttentionActorOperation(deps, request, { eventKind, gated: false }, async ({ tx, row, parties, actor, now, requestId }) => {
    const disposition = await tx.caioAttentionDisposition.findFirst({ where: { id: request.dispositionId, caseId: row.id } });
    const latest = await tx.caioAttentionDisposition.findFirst({ where: { caseId: row.id }, orderBy: { sequence: "desc" }, select: { id: true } });
    const superseded = disposition ? await tx.caioAttentionCaseEvent.count({
      where: { caseId: row.id, kind: "DISPOSITION_SUPERSEDED", dedupeKey: disposition.id },
    }) : 0;
    const auth = authorizeCaioAttentionOperation({
      op, actor, parties, expectedCommandVersion: request.expectedCommandVersion, reviewerVersion: request.reviewerVersion,
      disposition: disposition ? {
        commandVersion: disposition.commandVersion, superseded: superseded > 0, isLatestInVersion: latest?.id === disposition.id,
        submittedByUserId: disposition.submittedByUserId,
      } : undefined,
    });
    if (!auth.ok || !disposition) return rejectCaioAttention(auth.ok ? "disposition_not_current" : auth.reason);
    const attested = [...new Set(request.attestedExternalRefs)];
    const evidenceRefs = JSON.parse(disposition.evidenceRefsJson) as string[];
    if (op === "reviewAccept") {
      const check = evaluateCaioAttentionReviewEvidence({
        evidenceRefs, resolved: await resolveSystemEvidence(tx, evidenceRefs), attestedExternalRefs: attested, reviewNote: note,
        context: evidenceContext(row, disposition.disposedAt),
      });
      if (!check.ok) return rejectCaioAttention("evidence_invalid", check.reasons);
    } else if (attested.some((ref) => !evidenceRefs.includes(ref))) {
      return rejectCaioAttention("evidence_invalid", ["attested_ref_not_submitted"]);
    }
    const review = await tx.caioAttentionReview.create({
      data: {
        caseId: row.id, dispositionId: disposition.id, reviewerUserId: actor.userId, reviewerVersion: row.reviewerVersion,
        decision: request.decision, attestedExternalRefsJson: JSON.stringify(attested), note,
      },
      select: { id: true },
    });
    const status = op === "reviewAccept" ? "CLOSED" : "DISPATCHED";
    await casCaioAttentionCase(tx, row, status === "CLOSED" ? { status, activeKey: null, closedAt: now } : { status });
    await appendCaioAttentionEvent(tx, {
      caseId: row.id, kind: eventKind, commandVersion: row.commandVersion, actorUserId: actor.userId, clientRequestId: requestId,
      payload: { reviewId: review.id, dispositionId: disposition.id, reviewerVersion: row.reviewerVersion },
    });
    return accepted(row.id, status, row.commandVersion);
  });
}
