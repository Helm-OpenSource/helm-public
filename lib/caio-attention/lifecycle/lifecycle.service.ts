import type { Prisma } from "@prisma/client";

import type { CaioAttentionSeverity } from "../contracts";
import {
  accepted, appendCaioAttentionEvent, caioAttentionActor, caioAttentionOwnerCommandRecord, casCaioAttentionCase,
  checkGate, lockCaioAttentionCase, normalizeCaioAttentionIds, normalizeCaioAttentionOwnerCommand, rejectCaioAttention,
  runCaioAttentionActorOperation, runCaioAttentionTransaction, serializeCaioAttentionPeople,
  type CaioAttentionActorRequest, type CaioAttentionLifecycleDeps, type CaioAttentionLifecycleResult,
  type CaioAttentionOwnerCommandInput,
} from "./core";
import { diffCaioAttentionPrefill, validateCaioAttentionOwnerCommand, type CaioAttentionOwnerCommandPeople } from "../routing";
import { caioAttentionDispatchFields } from "../schedule";
import { authorizeCaioAttentionOperation } from "../state-machine";

/**
 * OWNER operations of the attention lifecycle (design v4 §3, §7; v5 §2–§3; owner ruling §6.10). Only OWNER may
 * confirm, defer, dismiss, cancel, reissue or assign reviewers; ADMIN never can. confirm / reissue / resumeDeferred
 * pass the intake gate first. Nothing here notifies anyone: dispatch-notice timing is recorded on the event for
 * the reminder scanner.
 */

const MAX_DEFER_MS = 30 * 24 * 60 * 60_000;
const MAX_NOTE_LENGTH = 2000;
type OwnerRequest = CaioAttentionActorRequest & Readonly<{ expectedCommandVersion: number; note?: string }>;

const noteOf = (note: string | undefined) => (note === undefined ? null : note.trim().slice(0, MAX_NOTE_LENGTH) || null);

/** Before confirmation the suggested deadline lives only on the generator's SUGGESTED event (`prefill.suggestedDueAt`). */
async function suggestedDueAt(tx: Prisma.TransactionClient, caseId: string): Promise<Date | null> {
  const suggested = await tx.caioAttentionCaseEvent.findFirst({ where: { caseId, kind: "SUGGESTED" }, select: { payloadJson: true } });
  const value = suggested ? (JSON.parse(suggested.payloadJson) as { prefill?: { suggestedDueAt?: unknown } }).prefill?.suggestedDueAt : null;
  const at = typeof value === "string" ? new Date(value) : null;
  return at && !Number.isNaN(at.getTime()) ? at : null;
}

/** confirm (SUGGESTED -> DISPATCHED) and reissue (new command version). The OWNER may edit every prefilled field. */
function issueCommand(
  deps: CaioAttentionLifecycleDeps, op: "confirm" | "reissue", request: OwnerRequest & Readonly<{ command: CaioAttentionOwnerCommandInput }>,
): Promise<CaioAttentionLifecycleResult> {
  const people = normalizeCaioAttentionOwnerCommand(request.command);
  if (!people) return Promise.resolve(rejectCaioAttention("input_invalid"));
  const involved = [people.primaryUserId, people.escalationUserId, ...people.ccUserIds, ...people.reviewerUserIds]
    .filter((id): id is string => id !== null);
  const eventKind = op === "confirm" ? "CONFIRMED" : "REISSUED";
  return runCaioAttentionActorOperation(deps, request, { eventKind, gated: true, involvedUserIds: involved }, async (ctx) => {
    const { tx, row, parties, actor, members, now } = ctx;
    const auth = authorizeCaioAttentionOperation({ op, actor, parties, expectedCommandVersion: request.expectedCommandVersion });
    if (!auth.ok) return rejectCaioAttention(auth.reason);
    if (people.committedDueAt && people.committedDueAt.getTime() <= now.getTime()) return rejectCaioAttention("input_invalid", ["committed_due_past"]);
    const enterpriseScope = row.enterpriseSlug === null ? "not_applicable"
      : await (deps.resolveEnterpriseScope?.({ workspaceId: row.workspaceId, enterpriseSlug: row.enterpriseSlug }) ?? "unverified");
    const errors = validateCaioAttentionOwnerCommand({
      command: people, confirmerUserId: actor.userId, enterpriseScope,
      isActive: (id) => members.get(id)?.active ?? false,
      canReview: (id) => caioAttentionActor(id, members.get(id)).canReviewGovernedActions,
    });
    if (errors.length > 0) return rejectCaioAttention("command_invalid", errors);

    const previous: CaioAttentionOwnerCommandPeople = {
      primaryUserId: row.primaryUserId, ccUserIds: parties.ccUserIds, escalationUserId: row.escalationUserId,
      reviewerUserIds: parties.reviewerUserIds, committedDueAt: op === "confirm" ? await suggestedDueAt(tx, row.id) : row.committedDueAt,
    };
    let supersededDispositionId: string | null = null;
    if (row.status === "DISPOSITION_SUBMITTED") {
      // The unreviewed disposition of the old command is superseded by an event; the disposition row never changes.
      const latest = await tx.caioAttentionDisposition.findFirst({
        where: { caseId: row.id, commandVersion: row.commandVersion }, orderBy: { sequence: "desc" }, select: { id: true },
      });
      supersededDispositionId = latest?.id ?? null;
      if (latest) {
        await appendCaioAttentionEvent(tx, {
          caseId: row.id, kind: "DISPOSITION_SUPERSEDED", commandVersion: row.commandVersion, actorUserId: actor.userId,
          dedupeKey: latest.id, payload: { dispositionId: latest.id },
        });
      }
    }
    const commandVersion = row.commandVersion + 1;
    const record = caioAttentionOwnerCommandRecord(people, { commandVersion, issuedByUserId: actor.userId, issuedAt: now });
    const { dispatchNoticeAt, ...reminders } = caioAttentionDispatchFields(row.effectiveSeverity as CaioAttentionSeverity, now, deps.policy);
    await casCaioAttentionCase(tx, row, {
      status: "DISPATCHED", commandVersion, ownerCommandJson: record.json, ownerCommandHash: record.hash,
      primaryUserId: people.primaryUserId, ccUserIdsJson: JSON.stringify(people.ccUserIds), escalationUserId: people.escalationUserId,
      reviewerUserIdsJson: JSON.stringify(people.reviewerUserIds), reviewerVersion: row.reviewerVersion + 1,
      confirmedByUserId: actor.userId, committedDueAt: people.committedDueAt, dispatchedAt: now, respondedAt: null, ...reminders,
    });
    await appendCaioAttentionEvent(tx, {
      caseId: row.id, kind: eventKind, commandVersion, actorUserId: actor.userId, clientRequestId: ctx.requestId,
      payload: {
        changedFields: diffCaioAttentionPrefill(previous, people), previous: serializeCaioAttentionPeople(previous),
        command: serializeCaioAttentionPeople(people), ownerCommandHash: record.hash,
        dispatchNoticeAt: dispatchNoticeAt.toISOString(), supersededDispositionId, note: noteOf(request.note),
      },
    });
    return accepted(row.id, "DISPATCHED", commandVersion);
  });
}

export const confirmCaioAttentionCase = (deps: CaioAttentionLifecycleDeps, request: OwnerRequest & Readonly<{ command: CaioAttentionOwnerCommandInput }>) =>
  issueCommand(deps, "confirm", request);

export const reissueCaioAttentionCase = (deps: CaioAttentionLifecycleDeps, request: OwnerRequest & Readonly<{ command: CaioAttentionOwnerCommandInput }>) =>
  issueCommand(deps, "reissue", request);

/** defer (SUGGESTED -> DEFERRED), dismiss (SUGGESTED -> DISMISSED), cancel (DISPATCHED / DISPOSITION_SUBMITTED -> CANCELLED). */
function ownerTransition(
  deps: CaioAttentionLifecycleDeps, op: "defer" | "dismiss" | "cancel", request: OwnerRequest & Readonly<{ deferredUntil?: Date }>,
): Promise<CaioAttentionLifecycleResult> {
  const eventKind = { defer: "DEFERRED", dismiss: "DISMISSED", cancel: "CANCELLED" }[op];
  return runCaioAttentionActorOperation(deps, request, { eventKind, gated: false }, async ({ tx, row, parties, actor, now, requestId }) => {
    const auth = authorizeCaioAttentionOperation({ op, actor, parties, expectedCommandVersion: request.expectedCommandVersion });
    if (!auth.ok) return rejectCaioAttention(auth.reason);
    const payload: Record<string, unknown> = { fromStatus: row.status, note: noteOf(request.note) };
    let status: "DEFERRED" | "DISMISSED" | "CANCELLED";
    if (op === "defer") {
      const until = request.deferredUntil;
      if (!(until instanceof Date) || until.getTime() <= now.getTime() || until.getTime() - now.getTime() > MAX_DEFER_MS) {
        return rejectCaioAttention("input_invalid", ["deferred_until_invalid"]);
      }
      status = "DEFERRED";
      payload.deferredUntil = until.toISOString();
      await casCaioAttentionCase(tx, row, { status, deferredUntil: until });
    } else {
      status = op === "dismiss" ? "DISMISSED" : "CANCELLED";
      if (row.status === "DISPOSITION_SUBMITTED") {
        // Owner ruling §6.10: cancelling between submission and review is allowed and serialises with review on the case lock.
        const pending = await tx.caioAttentionDisposition.findFirst({
          where: { caseId: row.id, commandVersion: row.commandVersion }, orderBy: { sequence: "desc" }, select: { id: true },
        });
        payload.pendingDispositionId = pending?.id ?? null;
      }
      await casCaioAttentionCase(tx, row, { status, activeKey: null, closedAt: now });
    }
    await appendCaioAttentionEvent(tx, {
      caseId: row.id, kind: eventKind, commandVersion: row.commandVersion, actorUserId: actor.userId, clientRequestId: requestId, payload,
    });
    return accepted(row.id, status, row.commandVersion);
  });
}

export const deferCaioAttentionCase = (deps: CaioAttentionLifecycleDeps, request: OwnerRequest & Readonly<{ deferredUntil: Date }>) =>
  ownerTransition(deps, "defer", request);
export const dismissCaioAttentionCase = (deps: CaioAttentionLifecycleDeps, request: OwnerRequest) => ownerTransition(deps, "dismiss", request);
export const cancelCaioAttentionCase = (deps: CaioAttentionLifecycleDeps, request: OwnerRequest) => ownerTransition(deps, "cancel", request);

/** OWNER replaces the reviewer set: bumps reviewerVersion only; the command and any submitted disposition stay valid. */
export function assignCaioAttentionReviewers(
  deps: CaioAttentionLifecycleDeps,
  request: OwnerRequest & Readonly<{ reviewerUserIds: readonly string[]; expectedReviewerVersion: number }>,
): Promise<CaioAttentionLifecycleResult> {
  const reviewers = normalizeCaioAttentionIds(request.reviewerUserIds);
  if (!reviewers || reviewers.length === 0) return Promise.resolve(rejectCaioAttention("input_invalid"));
  return runCaioAttentionActorOperation(deps, request, { eventKind: "REVIEWERS_ASSIGNED", gated: false, involvedUserIds: reviewers },
    async ({ tx, row, parties, actor, members, requestId }) => {
      const auth = authorizeCaioAttentionOperation({ op: "assignReviewers", actor, parties, expectedCommandVersion: request.expectedCommandVersion });
      if (!auth.ok) return rejectCaioAttention(auth.reason);
      if (request.expectedReviewerVersion !== row.reviewerVersion) return rejectCaioAttention("stale_reviewer_version");
      const errors = new Set<string>();
      for (const id of reviewers) {
        const reviewer = caioAttentionActor(id, members.get(id));
        if (!reviewer.active) errors.add("reviewer_inactive");
        if (!reviewer.canReviewGovernedActions) errors.add("reviewer_not_capable");
        if (id === row.primaryUserId || parties.ccUserIds.includes(id)) errors.add("reviewer_conflict");
      }
      if (errors.size > 0) return rejectCaioAttention("command_invalid", [...errors].sort());
      const reviewerVersion = row.reviewerVersion + 1;
      await casCaioAttentionCase(tx, row, { reviewerUserIdsJson: JSON.stringify(reviewers), reviewerVersion });
      await appendCaioAttentionEvent(tx, {
        caseId: row.id, kind: "REVIEWERS_ASSIGNED", commandVersion: row.commandVersion, actorUserId: actor.userId, clientRequestId: requestId,
        payload: { previous: parties.reviewerUserIds, reviewerUserIds: reviewers, reviewerVersion, note: noteOf(request.note) },
      });
      return accepted(row.id, parties.status, row.commandVersion);
    });
}

/**
 * System step once `deferredUntil` has passed (DEFERRED -> SUGGESTED), behind the intake gate. A critical case
 * re-arms the pending-confirmation reminder pair, so the OWNER is told again (S1 review P1-1).
 */
export function resumeDeferredCaioAttentionCase(
  deps: CaioAttentionLifecycleDeps, request: Readonly<{ workspaceId: string; caseId: string }>,
): Promise<CaioAttentionLifecycleResult> {
  return runCaioAttentionTransaction(deps, async (tx) => {
    if (!(await checkGate(deps, tx))) return rejectCaioAttention("intake_closed");
    const row = await lockCaioAttentionCase(tx, request.workspaceId, request.caseId);
    if (!row) return rejectCaioAttention("not_found");
    if (row.status !== "DEFERRED") return rejectCaioAttention("invalid_status");
    const now = deps.now?.() ?? new Date();
    if (!row.deferredUntil || row.deferredUntil.getTime() > now.getTime()) return rejectCaioAttention("not_due");
    const rearm = row.effectiveSeverity === "critical";
    await casCaioAttentionCase(tx, row, {
      status: "SUGGESTED", deferredUntil: null,
      ...(rearm ? { r0aDueAt: now, r0aSentAt: null, r0bDueAt: null, r0bSentAt: null } : {}),
    });
    await appendCaioAttentionEvent(tx, {
      caseId: row.id, kind: "RESUMED", commandVersion: row.commandVersion, dedupeKey: `resume:${row.deferredUntil.toISOString()}`,
      payload: { deferredUntil: row.deferredUntil.toISOString(), rearmedPendingReminder: rearm },
    });
    return accepted(row.id, "SUGGESTED", row.commandVersion);
  });
}
