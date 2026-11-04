import { createHash } from "node:crypto";

import { Prisma, type CaioAttentionCase, type PrismaClient, type WorkspaceRole } from "@prisma/client";

import { WORKSPACE_CAPABILITIES, workspaceRoleHasCapability } from "@/lib/auth/authorization";
import { isWriteConflictError, runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";

import { parseCaioAttentionUserRef } from "../contracts";
import { readCaioAttentionIntakeGate } from "../intake-gate.service";
import type { CaioAttentionEnterpriseScope, CaioAttentionOwnerCommandPeople } from "../routing";
import type { CaioAttentionPolicy } from "../schedule";
import {
  canReadCaioAttentionCase, type CaioAttentionActor, type CaioAttentionAuthorization, type CaioAttentionCaseParties,
  type CaioAttentionStatus,
} from "../state-machine";

/**
 * Shared plumbing of the attention lifecycle service (design v4 §3.1, v5 §2, v6 §1.4). Every write runs in one
 * READ COMMITTED transaction with a fixed lock order:
 *
 *   Control (FOR SHARE, gated operations only) -> Case (FOR UPDATE) -> Membership rows (FOR SHARE)
 *     -> reads of Disposition / Review / Event -> CAS UPDATE of Case -> INSERT Disposition / Review / Event.
 *
 * Status, command version and membership are re-read under those locks; identities are compared as canonical bare
 * user ids only. The Case write is one raw UPDATE whose own WHERE carries the expected status and command version
 * (Prisma `updateMany` is not an atomic compare-and-swap on MySQL).
 */

export type CaioAttentionLifecycleDeps = Readonly<{
  /** Client of the web identity (lifecycle writes). */
  db: PrismaClient;
  /** Tenant reminder policy registered by the overlay; used for the dispatch deadlines. */
  policy: CaioAttentionPolicy;
  now?: () => Date;
  /** Entry gate (`readCaioAttentionIntakeGate` signature); defaults to it. Must be the transaction's first statement. */
  gate?: (tx: Prisma.TransactionClient) => Promise<{ open: boolean }>;
  /** Overlay enterprise-scope hook. Absent means any enterprise suffix is unverified (fail closed). */
  resolveEnterpriseScope?: (input: { workspaceId: string; enterpriseSlug: string }) => Promise<CaioAttentionEnterpriseScope>;
}>;

/**
 * Every event kind written to CaioAttentionCaseEvent: generator (SUGGESTED, RECURRED, SEVERITY_RAISED), lifecycle,
 * loader (READ) and reminder scanner (REMINDED, ESCALATED, R3_SENT).
 */
export const CAIO_ATTENTION_EVENT_KINDS = [
  "SUGGESTED", "RECURRED", "SEVERITY_RAISED", "CONFIRMED", "REISSUED", "DEFERRED", "RESUMED", "DISMISSED", "CANCELLED",
  "REVIEWERS_ASSIGNED", "DISPOSITION_SUPERSEDED", "SEVERITY_APPLIED", "ACK", "NOTE", "DISPOSITION_SUBMITTED",
  "REVIEW_ACCEPTED", "REVIEW_RETURNED", "READ", "REMINDED", "ESCALATED", "R3_SENT",
] as const;
export type CaioAttentionEventKind = (typeof CAIO_ATTENTION_EVENT_KINDS)[number];

export type CaioAttentionRejection = Extract<CaioAttentionAuthorization, { ok: false }>["reason"]
  | "intake_closed" | "input_invalid" | "command_invalid" | "not_due" | "client_request_conflict" | "evidence_invalid";

export type CaioAttentionLifecycleResult =
  | { ok: true; caseId: string; status: CaioAttentionStatus; commandVersion: number; replayed: boolean }
  | { ok: false; reason: CaioAttentionRejection; details?: string[] };

export const rejectCaioAttention = (reason: CaioAttentionRejection, details?: string[]): CaioAttentionLifecycleResult =>
  (details?.length ? { ok: false, reason, details } : { ok: false, reason });

export const accepted = (caseId: string, status: CaioAttentionStatus, commandVersion: number): CaioAttentionLifecycleResult =>
  ({ ok: true, caseId, status, commandVersion, replayed: false });

const BARE_USER_ID = /^[A-Za-z0-9_-]{1,191}$/u;
const CLIENT_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/u;

/** Accepts `user:<id>` or a bare id and returns the canonical bare id, or null. */
export function canonicalCaioAttentionUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.startsWith("user:") ? parseCaioAttentionUserRef(value) : BARE_USER_ID.test(value) ? value : null;
}

export function parseCaioAttentionIdList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function caioAttentionParties(row: CaioAttentionCase): CaioAttentionCaseParties {
  return {
    status: row.status as CaioAttentionStatus,
    commandVersion: row.commandVersion,
    confirmedByUserId: row.confirmedByUserId,
    primaryUserId: row.primaryUserId,
    ccUserIds: parseCaioAttentionIdList(row.ccUserIdsJson),
    escalationUserId: row.escalationUserId,
    reviewerUserIds: parseCaioAttentionIdList(row.reviewerUserIdsJson),
    reviewerVersion: row.reviewerVersion,
  };
}

export type CaioAttentionMember = Readonly<{ role: WorkspaceRole; active: boolean }>;

/**
 * Workspace membership of the given users, read with FOR SHARE so a concurrent revocation waits for this transaction.
 * Externally scoped members are never treated as active participants.
 */
export async function lockCaioAttentionMembers(
  tx: Prisma.TransactionClient, workspaceId: string, userIds: readonly string[],
): Promise<Map<string, CaioAttentionMember>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const rows = await tx.$queryRaw<Array<{ userId: string; role: WorkspaceRole; status: string; accessScope: string | null }>>`
    SELECT userId, role, status, accessScope FROM Membership
    WHERE workspaceId = ${workspaceId} AND userId IN (${Prisma.join(ids)}) ORDER BY userId FOR SHARE`;
  return new Map(rows.map((row) => [row.userId, { role: row.role, active: row.status === "ACTIVE" && row.accessScope === null }]));
}

export function caioAttentionActor(userId: string, member: CaioAttentionMember | undefined): CaioAttentionActor {
  return {
    userId,
    sameWorkspace: member !== undefined,
    active: member?.active ?? false,
    role: member?.role === "OWNER" ? "OWNER" : member?.role === "ADMIN" ? "ADMIN" : "OTHER",
    canReviewGovernedActions: member ? workspaceRoleHasCapability(member.role, WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS) : false,
  };
}

const TRANSACTION_OPTIONS = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5_000, timeout: 15_000 };

export function runCaioAttentionTransaction<T>(deps: CaioAttentionLifecycleDeps, body: (tx: Prisma.TransactionClient) => Promise<T>) {
  return runWithWriteConflictRetry(() => deps.db.$transaction(body, TRANSACTION_OPTIONS), {
    maxAttempts: 4,
    retryDelayMs: 50,
    isConflict: (error) => isWriteConflictError(error)
      || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"),
  });
}

export async function lockCaioAttentionCase(tx: Prisma.TransactionClient, workspaceId: string, caseId: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM CaioAttentionCase WHERE id = ${caseId} AND workspaceId = ${workspaceId} FOR UPDATE`;
  return locked.length === 1 ? tx.caioAttentionCase.findUnique({ where: { id: caseId } }) : null;
}

/** Atomic compare-and-swap on (id, status, commandVersion); the caller already holds the row lock. */
export async function casCaioAttentionCase(
  tx: Prisma.TransactionClient, row: Pick<CaioAttentionCase, "id" | "status" | "commandVersion">,
  data: Readonly<Record<string, string | number | boolean | Date | null>>,
) {
  const sets = Object.entries(data).map(([column, value]) => {
    if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(column)) throw new Error(`caio_attention_unsafe_column:${column}`);
    return Prisma.sql`${Prisma.raw(`\`${column}\``)} = ${value}`;
  });
  const count = await tx.$executeRaw`UPDATE CaioAttentionCase SET ${Prisma.join(sets)}, updatedAt = NOW(3)
    WHERE id = ${row.id} AND status = ${row.status} AND commandVersion = ${row.commandVersion}`;
  if (count !== 1) throw new Error("caio_attention_case_cas_lost");
}

export function appendCaioAttentionEvent(tx: Prisma.TransactionClient, event: Readonly<{
  caseId: string; kind: CaioAttentionEventKind; commandVersion?: number | null; actorUserId?: string | null;
  clientRequestId?: string | null; dedupeKey?: string | null; payload: Record<string, unknown>;
}>) {
  return tx.caioAttentionCaseEvent.create({
    data: {
      caseId: event.caseId, kind: event.kind, commandVersion: event.commandVersion ?? null, actorUserId: event.actorUserId ?? null,
      clientRequestId: event.clientRequestId ?? null, dedupeKey: event.dedupeKey ?? null, payloadJson: JSON.stringify(event.payload),
    },
    select: { id: true },
  });
}

export type CaioAttentionActorRequest = Readonly<{
  workspaceId: string; caseId: string; actorUserId: string; clientRequestId: string;
}>;

export type CaioAttentionActorContext = Readonly<{
  tx: Prisma.TransactionClient; row: CaioAttentionCase; parties: CaioAttentionCaseParties; actor: CaioAttentionActor;
  members: Map<string, CaioAttentionMember>; now: Date; requestId: string;
}>;

/**
 * Runs one human operation: optional gate, case lock, membership re-read, readability (anything else answers
 * `not_found`, so callers cannot probe existence) and request idempotency, then the operation body. A replayed
 * clientRequestId returns the current state without writing again.
 */
export async function checkGate(deps: CaioAttentionLifecycleDeps, tx: Prisma.TransactionClient): Promise<boolean> {
  return (await (deps.gate ?? readCaioAttentionIntakeGate)(tx)).open;
}

export function runCaioAttentionActorOperation(
  deps: CaioAttentionLifecycleDeps,
  request: CaioAttentionActorRequest,
  options: Readonly<{ eventKind: CaioAttentionEventKind; gated: boolean; involvedUserIds?: readonly string[] }>,
  body: (context: CaioAttentionActorContext) => Promise<CaioAttentionLifecycleResult>,
): Promise<CaioAttentionLifecycleResult> {
  const actorUserId = canonicalCaioAttentionUserId(request.actorUserId);
  if (!actorUserId || !CLIENT_REQUEST_ID.test(request.clientRequestId)) return Promise.resolve(rejectCaioAttention("input_invalid"));
  return runCaioAttentionTransaction(deps, async (tx) => {
    if (options.gated && !(await checkGate(deps, tx))) return rejectCaioAttention("intake_closed");
    const row = await lockCaioAttentionCase(tx, request.workspaceId, request.caseId);
    if (!row) return rejectCaioAttention("not_found");
    const parties = caioAttentionParties(row);
    const members = await lockCaioAttentionMembers(tx, row.workspaceId, [actorUserId, ...(options.involvedUserIds ?? [])]);
    const actor = caioAttentionActor(actorUserId, members.get(actorUserId));
    if (!canReadCaioAttentionCase(actor, parties).ok) return rejectCaioAttention("not_found");
    const prior = await tx.caioAttentionCaseEvent.findFirst({
      where: { caseId: row.id, clientRequestId: request.clientRequestId }, select: { kind: true, actorUserId: true },
    });
    if (prior) {
      return prior.kind === options.eventKind && prior.actorUserId === actorUserId
        ? { ok: true, caseId: row.id, status: parties.status, commandVersion: row.commandVersion, replayed: true }
        : rejectCaioAttention("client_request_conflict");
    }
    return body({ tx, row, parties, actor, members, now: deps.now?.() ?? new Date(), requestId: request.clientRequestId });
  });
}

/** OWNER command as entered; ids may be `user:<id>` or bare. Returns canonical people or null when malformed. */
export type CaioAttentionOwnerCommandInput = Readonly<{
  primaryUserId: string | null; ccUserIds: readonly string[]; escalationUserId: string | null;
  reviewerUserIds: readonly string[]; committedDueAt: Date | null;
}>;

export function normalizeCaioAttentionIds(ids: readonly unknown[]): string[] | null {
  if (!Array.isArray(ids) || ids.length > 20) return null;
  const canonical = ids.map(canonicalCaioAttentionUserId);
  if (canonical.some((id) => id === null)) return null;
  return [...new Set(canonical as string[])];
}

export function normalizeCaioAttentionOwnerCommand(input: CaioAttentionOwnerCommandInput): CaioAttentionOwnerCommandPeople | null {
  const single = (value: string | null) => (value === null ? null : canonicalCaioAttentionUserId(value) ?? undefined);
  const primaryUserId = single(input.primaryUserId);
  const escalationUserId = single(input.escalationUserId);
  const ccUserIds = normalizeCaioAttentionIds(input.ccUserIds);
  const reviewerUserIds = normalizeCaioAttentionIds(input.reviewerUserIds);
  const due = input.committedDueAt;
  if (primaryUserId === undefined || escalationUserId === undefined || !ccUserIds || !reviewerUserIds) return null;
  if (due !== null && (!(due instanceof Date) || Number.isNaN(due.getTime()))) return null;
  return { primaryUserId, ccUserIds, escalationUserId, reviewerUserIds, committedDueAt: due };
}

export function serializeCaioAttentionPeople(people: CaioAttentionOwnerCommandPeople) {
  return { ...people, committedDueAt: people.committedDueAt?.toISOString() ?? null };
}

/** The stored owner command and its hash; field order is fixed, so the hash is stable. */
export function caioAttentionOwnerCommandRecord(
  people: CaioAttentionOwnerCommandPeople, meta: Readonly<{ commandVersion: number; issuedByUserId: string; issuedAt: Date }>,
) {
  const json = JSON.stringify({
    commandVersion: meta.commandVersion, issuedByUserId: meta.issuedByUserId, issuedAt: meta.issuedAt.toISOString(),
    ...serializeCaioAttentionPeople(people),
  });
  return { json, hash: createHash("sha256").update(json).digest("hex") };
}
