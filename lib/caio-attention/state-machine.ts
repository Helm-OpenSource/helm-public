/**
 * Attention-case lifecycle rules: which operation moves which status, who may perform it, and who may
 * read the case. Pure checks only; the lifecycle service still applies every write as a CAS on
 * (id, status, commandVersion) inside its transaction and re-reads membership there.
 */

export const CAIO_ATTENTION_STATUSES = [
  "SUGGESTED", "DEFERRED", "DISPATCHED", "DISPOSITION_SUBMITTED", "DISMISSED", "CANCELLED", "CLOSED",
] as const;
export type CaioAttentionStatus = (typeof CAIO_ATTENTION_STATUSES)[number];

const TERMINAL: ReadonlySet<CaioAttentionStatus> = new Set(["DISMISSED", "CANCELLED", "CLOSED"]);
/** Entering a terminal status clears `activeKey` in the same transaction. */
export const isCaioAttentionTerminal = (status: CaioAttentionStatus) => TERMINAL.has(status);

export type CaioAttentionOperation =
  | "confirm" | "defer" | "resumeDeferred" | "dismiss" | "cancel" | "reissue" | "assignReviewers"
  | "ack" | "note" | "submitDisposition" | "reviewAccept" | "reviewReturn";

// from-status -> to-status. Operations that keep the status map to the same value.
const TRANSITIONS: Readonly<Record<CaioAttentionOperation, Partial<Record<CaioAttentionStatus, CaioAttentionStatus>>>> = {
  confirm: { SUGGESTED: "DISPATCHED" },
  defer: { SUGGESTED: "DEFERRED" },
  resumeDeferred: { DEFERRED: "SUGGESTED" },
  dismiss: { SUGGESTED: "DISMISSED" },
  cancel: { DISPATCHED: "CANCELLED", DISPOSITION_SUBMITTED: "CANCELLED" },
  // A new command version from either working status returns to DISPATCHED; an unreviewed
  // disposition is marked superseded by an event, the disposition row itself is never changed.
  reissue: { DISPATCHED: "DISPATCHED", DISPOSITION_SUBMITTED: "DISPATCHED" },
  assignReviewers: { DISPATCHED: "DISPATCHED", DISPOSITION_SUBMITTED: "DISPOSITION_SUBMITTED" },
  ack: { DISPATCHED: "DISPATCHED" },
  note: { DISPATCHED: "DISPATCHED", DISPOSITION_SUBMITTED: "DISPOSITION_SUBMITTED" },
  submitDisposition: { DISPATCHED: "DISPOSITION_SUBMITTED" },
  reviewAccept: { DISPOSITION_SUBMITTED: "CLOSED" },
  reviewReturn: { DISPOSITION_SUBMITTED: "DISPATCHED" },
};

export function nextCaioAttentionStatus(status: CaioAttentionStatus, op: CaioAttentionOperation): CaioAttentionStatus | null {
  return TRANSITIONS[op][status] ?? null;
}

/** Only these operations create or keep a non-terminal case, so only they pass the intake gate. */
export const CAIO_ATTENTION_GATED_OPERATIONS: readonly CaioAttentionOperation[] = ["confirm", "resumeDeferred", "reissue"];

export type CaioAttentionCaseParties = Readonly<{
  status: CaioAttentionStatus;
  commandVersion: number;
  /** Null until the OWNER confirms: prefilled people are not participants before that. */
  confirmedByUserId: string | null;
  primaryUserId: string | null;
  ccUserIds: readonly string[];
  escalationUserId: string | null;
  reviewerUserIds: readonly string[];
  reviewerVersion: number;
}>;

export type CaioAttentionActor = Readonly<{
  userId: string;
  sameWorkspace: boolean;
  active: boolean;
  role: "OWNER" | "ADMIN" | "OTHER";
  canReviewGovernedActions: boolean;
}>;

/** Only the current command's primary performing ack, note or submit counts as a response. */
export function isCaioAttentionResponse(op: CaioAttentionOperation, actorUserId: string, parties: CaioAttentionCaseParties): boolean {
  return (op === "ack" || op === "note" || op === "submitDisposition") && actorUserId === parties.primaryUserId;
}

export type CaioAttentionReviewTarget = Readonly<{
  commandVersion: number;
  superseded: boolean;
  isLatestInVersion: boolean;
  submittedByUserId: string;
}>;

export type CaioAttentionAuthorization = { ok: true } | { ok: false; reason: "not_found" | "invalid_status"
  | "stale_command_version" | "forbidden" | "stale_reviewer_version" | "separation_of_duties" | "disposition_not_current" };

const OWNER_ONLY: ReadonlySet<CaioAttentionOperation> = new Set(["confirm", "defer", "dismiss", "cancel", "reissue", "assignReviewers"]);

export function authorizeCaioAttentionOperation(input: Readonly<{
  op: Exclude<CaioAttentionOperation, "resumeDeferred">; // system-only, driven by deferredUntil
  actor: CaioAttentionActor;
  parties: CaioAttentionCaseParties;
  expectedCommandVersion: number;
  reviewerVersion?: number;
  disposition?: CaioAttentionReviewTarget;
}>): CaioAttentionAuthorization {
  const { op, actor, parties } = input;
  // Cross-workspace or inactive callers learn nothing, including whether the case exists.
  if (!actor.sameWorkspace || !actor.active || !canReadCaioAttentionCase(actor, parties).ok) return { ok: false, reason: "not_found" };
  if (!nextCaioAttentionStatus(parties.status, op)) return { ok: false, reason: "invalid_status" };
  if (input.expectedCommandVersion !== parties.commandVersion) return { ok: false, reason: "stale_command_version" };
  if (OWNER_ONLY.has(op)) return actor.role === "OWNER" ? { ok: true } : { ok: false, reason: "forbidden" };
  const isPrimary = actor.userId === parties.primaryUserId;
  if (op === "ack" || op === "submitDisposition") return isPrimary ? { ok: true } : { ok: false, reason: "forbidden" };
  if (op === "note") {
    const allowed = isPrimary || parties.ccUserIds.includes(actor.userId) || actor.userId === parties.escalationUserId || actor.role === "OWNER";
    return allowed ? { ok: true } : { ok: false, reason: "forbidden" };
  }
  // reviewAccept / reviewReturn: bound to this case's reviewer set; OWNER and ADMIN are never implicit reviewers.
  if (!parties.reviewerUserIds.includes(actor.userId) || !actor.canReviewGovernedActions) return { ok: false, reason: "forbidden" };
  if (input.reviewerVersion !== parties.reviewerVersion) return { ok: false, reason: "stale_reviewer_version" };
  const target = input.disposition;
  if (!target || target.superseded || !target.isLatestInVersion || target.commandVersion !== parties.commandVersion) {
    return { ok: false, reason: "disposition_not_current" };
  }
  if (isPrimary || actor.userId === target.submittedByUserId || parties.ccUserIds.includes(actor.userId)) {
    return { ok: false, reason: "separation_of_duties" };
  }
  return { ok: true };
}

/**
 * Before confirmation only OWNER and ADMIN can read a case. After it, the current command's people and
 * reviewer set can too. Every ADMIN read, participant or not, must write a READ audit event.
 * Earlier command versions' participants keep read-only access once the case is terminal.
 */
export function canReadCaioAttentionCase(
  actor: CaioAttentionActor,
  parties: CaioAttentionCaseParties,
  historicalParticipantIds: readonly string[] = [],
): { ok: boolean; auditRead: boolean } {
  if (!actor.sameWorkspace || !actor.active) return { ok: false, auditRead: false };
  if (actor.role === "OWNER") return { ok: true, auditRead: false };
  const participant = parties.confirmedByUserId !== null && (
    actor.userId === parties.primaryUserId || parties.ccUserIds.includes(actor.userId)
    || actor.userId === parties.escalationUserId || parties.reviewerUserIds.includes(actor.userId)
    || (isCaioAttentionTerminal(parties.status) && historicalParticipantIds.includes(actor.userId)));
  if (actor.role === "ADMIN") return { ok: true, auditRead: true };
  return { ok: participant, auditRead: false };
}
