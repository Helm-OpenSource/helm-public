import "server-only";

import {
  ActorType,
  MembershipStatus,
  Prisma,
  type WorkspaceRole,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  WORKSPACE_CAPABILITIES,
  workspaceRoleHasCapability,
} from "@/lib/auth/authorization";
import {
  assertWorkspaceGovernedActionManagementServiceAccess,
  assertWorkspaceInsightServiceAccess,
} from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { jsonStringify, safeParseJson } from "@/lib/utils";
import {
  projectCaioAdviceDecision,
  validateCaioAdvice,
  validateCaioAdviceAgainstMandate,
} from "@/lib/caio-governance/advice";
import type {
  CaioAdvice,
  CaioAdviceDecisionOutcome,
  CaioAdviceDecisionProjection,
  CaioAdviceStatus,
} from "@/lib/caio-governance/advice";
import { parseInstant } from "@/lib/caio-governance/contract";
import { toMandateContract } from "@/lib/caio-governance/mandate-store.service";
import type { CaioMandate } from "@/lib/caio-governance/types";

// ---------------------------------------------------------------------------
// CAIO advice store — the Advise-stage loop as governance RECORDS.
//
// The loop: the CAIO proposes advice under an ACTIVE advise-stage mandate;
// the CEO (live principal binding required) decides accept / reject /
// defer; the decision receipt is a projection of the decided record.
// Nothing here grants, transfers, or evaluates permission, and no
// permission, routing, API, or execution path reads this table: an
// ACCEPTED advice still executes nothing.
//
// Concurrency mirrors the mandate store: LOCK-BEFORE-READ (the advice row
// lock, then the mandate row lock, are the first reads of a decision
// transaction), compare-and-set status transitions, and full-ledger
// emergency-stop checks. The decision lock order is advice row ->
// mandate row -> membership row -> ceo binding row. A proposer (mandate
// lock, then an insert that may wait on the adviceKey unique index) CAN
// form a cycle with a decider — InnoDB detects such deadlocks and
// runWithWriteConflictRetry re-runs the losing transaction, so the
// observable behaviour stays serialized. Every write pairs with its
// audit row in the same transaction.
//
// TOCTOU hardening: the pre-transaction capability gates give fast,
// uniform error surfaces, but a decision's authority (ACTIVE membership
// with the governed-action capability AND a live ceo principal binding)
// is RE-VERIFIED inside the decision transaction with locking reads — a
// concurrently revoked membership or binding can never race a decision
// past its revocation.
// ---------------------------------------------------------------------------

export class CaioAdviceStoreError extends Error {
  readonly reasons: readonly string[];
  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "CaioAdviceStoreError";
    this.reasons = reasons;
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

type Tx = Prisma.TransactionClient;

type AdviceRow = {
  id: string;
  workspaceId: string;
  mandateRecordId: string;
  adviceKey: string;
  caioRef: string;
  subjectRef: string;
  title: string;
  recommendation: string;
  observationRefs: string;
  status: string;
  proposedAt: Date;
  validUntil: Date;
  decidedByRef: string | null;
  decisionOutcome: string | null;
  decisionReason: string | null;
  decidedAt: Date | null;
  withdrawnAt: Date | null;
  auditRefs: string;
};

export function toAdviceContract(row: AdviceRow): CaioAdvice {
  return {
    adviceId: row.id,
    workspaceRef: `workspace:${row.workspaceId}`,
    mandateRef: row.mandateRecordId,
    caioRef: row.caioRef,
    adviceKey: row.adviceKey,
    subjectRef: row.subjectRef,
    title: row.title,
    recommendation: row.recommendation,
    observationRefs: safeParseJson<string[]>(row.observationRefs, []),
    proposedAt: row.proposedAt.toISOString(),
    validUntil: row.validUntil.toISOString(),
    status: row.status as CaioAdviceStatus,
    decidedByRef: row.decidedByRef,
    decisionOutcome: row.decisionOutcome as CaioAdvice["decisionOutcome"],
    decisionReason: row.decisionReason,
    decidedAt: row.decidedAt === null ? null : row.decidedAt.toISOString(),
    withdrawnAt:
      row.withdrawnAt === null ? null : row.withdrawnAt.toISOString(),
    auditRefs: safeParseJson<string[]>(row.auditRefs, []),
    authorityEffect: "none",
    executionRef: null,
  };
}

function assertAdviceValid(
  advice: CaioAdvice,
  mandate: CaioMandate,
  action: string,
): void {
  const own = validateCaioAdvice(advice);
  const against = validateCaioAdviceAgainstMandate(advice, mandate);
  const errors = [...own.errors, ...against.errors];
  if (errors.length > 0) {
    throw new CaioAdviceStoreError(
      `refusing ${action}: the resulting advice state is invalid`,
      errors,
    );
  }
}

function requireActorUserId(actorUserId: string): string {
  if (!actorUserId || actorUserId.trim() === "") {
    throw new CaioAdviceStoreError(
      "an authenticated acting user is required; empty actor identities fail closed",
    );
  }
  return actorUserId;
}

function parseInstantOrThrow(value: string, field: string): Date {
  const epoch = parseInstant(value);
  if (epoch === null) {
    throw new CaioAdviceStoreError(
      `refusing write: ${field} is not a strict RFC 3339 instant`,
    );
  }
  return new Date(epoch);
}

// LOCK-BEFORE-READ: these locking reads are the FIRST reads of their
// transactions, so every subsequent plain read sees all state committed
// before the lock was granted (see the mandate store for the full
// argument).
async function lockMandateRow(
  tx: Tx,
  input: { mandateRecordId: string; workspaceId: string },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM CaioMandateRecord
    WHERE id = ${input.mandateRecordId} AND workspaceId = ${input.workspaceId}
    FOR UPDATE`;
  if (rows.length !== 1) {
    throw new CaioAdviceStoreError("mandate record not found");
  }
}

async function lockAdviceRowAndGetMandateId(
  tx: Tx,
  input: { adviceRecordId: string; workspaceId: string },
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ mandateRecordId: string }>>`
    SELECT mandateRecordId FROM CaioAdviceRecord
    WHERE id = ${input.adviceRecordId} AND workspaceId = ${input.workspaceId}
    FOR UPDATE`;
  if (rows.length !== 1) {
    throw new CaioAdviceStoreError("advice record not found");
  }
  return rows[0].mandateRecordId;
}

// Locking read: the binding row (when it exists) is locked so a
// concurrent revocation serializes against the decision instead of
// landing between the check and the commit.
async function assertCeoPrincipalBindingLocked(
  tx: Tx,
  input: { workspaceId: string; actorUserId: string; ceoRef: string },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM CaioPrincipalBinding
    WHERE workspaceId = ${input.workspaceId}
      AND userId = ${input.actorUserId}
      AND principalRef = ${input.ceoRef}
      AND principalKind = 'ceo'
      AND revokedAt IS NULL
    FOR UPDATE`;
  if (rows.length !== 1) {
    throw new CaioAdviceStoreError(
      `no live ceo principal binding links the acting user to ${input.ceoRef}; register the binding first (fail closed)`,
    );
  }
}

// Locking re-verification of the capability HALF of the decision gate:
// the membership row is locked and re-judged inside the transaction, so
// a membership deactivated after the pre-transaction gate cannot still
// land a decision.
async function assertGovernedActionCapabilityLocked(
  tx: Tx,
  input: { workspaceId: string; actorUserId: string },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ role: string; status: string }>>`
    SELECT role, status FROM Membership
    WHERE workspaceId = ${input.workspaceId} AND userId = ${input.actorUserId}
    FOR UPDATE`;
  const membership = rows.length === 1 ? rows[0] : null;
  if (
    !membership ||
    membership.status !== MembershipStatus.ACTIVE ||
    !workspaceRoleHasCapability(
      membership.role as WorkspaceRole,
      WORKSPACE_CAPABILITIES.MANAGE_GOVERNED_ACTIONS,
    )
  ) {
    throw new CaioAdviceStoreError(
      "the acting user no longer holds an active governed-action membership; the decision fails closed",
    );
  }
}

// The governing mandate must be ACTIVE at stage "advise", inside its
// validity window, with a completely clean emergency-stop ledger. Judged
// against the FULL ledger, same as mandate activation.
async function assertMandateGovernsAdvise(
  tx: Tx,
  row: { id: string; stage: string; status: string; validFrom: Date; validUntil: Date; emergencyStopRef: string | null },
  now: number,
  action: string,
): Promise<void> {
  const reasons: string[] = [];
  if (row.status !== "active") {
    reasons.push(`the governing mandate is ${row.status}, not active`);
  }
  if (row.stage !== "advise") {
    reasons.push(`the governing mandate is at stage "${row.stage}", not "advise"`);
  }
  if (row.validFrom.getTime() > now || row.validUntil.getTime() <= now) {
    reasons.push("the governing mandate is outside its validity window");
  }
  const inForceStops = await tx.caioGuardianStopRecord.count({
    where: { mandateRecordId: row.id, resumedAt: null },
  });
  if (inForceStops > 0 || row.emergencyStopRef !== null) {
    reasons.push(
      "one or more emergency stops are in force; the Advise loop is frozen until the CEO resumes them",
    );
  }
  if (reasons.length > 0) {
    throw new CaioAdviceStoreError(`refusing ${action}`, reasons);
  }
}

// ---------------------------------------------------------------------------
// Propose (CAIO side; AI actor by default; insight-service gate).
// ---------------------------------------------------------------------------

export async function proposeCaioAdvice(input: {
  workspaceId: string;
  mandateRecordId: string;
  adviceKey: string;
  subjectRef: string;
  title: string;
  recommendation: string;
  observationRefs: readonly string[];
  validUntil: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  english?: boolean;
}): Promise<CaioAdvice> {
  await assertWorkspaceInsightServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType ?? ActorType.AI,
    english: input.english ?? false,
  });
  const validUntil = parseInstantOrThrow(input.validUntil, "validUntil");
  const observationRefsJson = jsonStringify([...input.observationRefs]);
  try {
    return await runWithWriteConflictRetry(() =>
      db.$transaction(async (tx) => {
        // lock first: the snapshot for every later plain read starts fresh
        await lockMandateRow(tx, {
          mandateRecordId: input.mandateRecordId,
          workspaceId: input.workspaceId,
        });
        const now = Date.now();
        const mandateRow = await tx.caioMandateRecord.findFirst({
          where: { id: input.mandateRecordId, workspaceId: input.workspaceId },
        });
        if (!mandateRow) throw new CaioAdviceStoreError("mandate record not found");
        await assertMandateGovernsAdvise(tx, mandateRow, now, "advice proposal");
        const mandate = toMandateContract(mandateRow);
        const proposedAtIso = new Date(now).toISOString();
        const candidate: CaioAdvice = {
          adviceId: "pending",
          workspaceRef: `workspace:${input.workspaceId}`,
          mandateRef: input.mandateRecordId,
          caioRef: mandateRow.caioRef,
          adviceKey: input.adviceKey,
          subjectRef: input.subjectRef,
          title: input.title,
          recommendation: input.recommendation,
          observationRefs: [...input.observationRefs],
          proposedAt: proposedAtIso,
          validUntil: input.validUntil,
          status: "proposed",
          decidedByRef: null,
          decisionOutcome: null,
          decisionReason: null,
          decidedAt: null,
          withdrawnAt: null,
          auditRefs: [],
          authorityEffect: "none",
          executionRef: null,
        };
        assertAdviceValid(candidate, mandate, "advice proposal");
        const record = await tx.caioAdviceRecord.create({
          data: {
            workspaceId: input.workspaceId,
            mandateRecordId: input.mandateRecordId,
            adviceKey: input.adviceKey,
            caioRef: mandateRow.caioRef,
            subjectRef: input.subjectRef,
            title: input.title,
            recommendation: input.recommendation,
            observationRefs: observationRefsJson,
            status: "proposed",
            proposedAt: new Date(now),
            validUntil,
            auditRefs: jsonStringify([]),
          },
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId ?? undefined,
            actor: input.actorName,
            actorType: input.actorType ?? ActorType.AI,
            actionType: "CAIO_ADVICE_PROPOSED",
            targetType: "CaioAdviceRecord",
            targetId: record.id,
            summary:
              "CAIO advice proposed for CEO decision (governance record only; executes nothing)",
            payload: {
              adviceKey: input.adviceKey,
              mandateRecordId: input.mandateRecordId,
              subjectRef: input.subjectRef,
            },
            relatedObjectType: "CaioMandateRecord",
            relatedObjectId: input.mandateRecordId,
          },
          { client: tx },
        );
        return toAdviceContract(record);
      }),
    );
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    // Idempotent retry: identical immutable content returns the existing
    // record; divergent content is a conflict, never an overwrite.
    const existing = await db.caioAdviceRecord.findUnique({
      where: {
        workspaceId_adviceKey: {
          workspaceId: input.workspaceId,
          adviceKey: input.adviceKey,
        },
      },
    });
    if (!existing) throw error;
    const matches =
      existing.mandateRecordId === input.mandateRecordId &&
      existing.subjectRef === input.subjectRef &&
      existing.title === input.title &&
      existing.recommendation === input.recommendation &&
      existing.observationRefs === observationRefsJson &&
      existing.validUntil.getTime() === validUntil.getTime();
    if (!matches) {
      throw new CaioAdviceStoreError(
        "adviceKey already exists with different content (idempotency conflict)",
      );
    }
    return toAdviceContract(existing);
  }
}

// ---------------------------------------------------------------------------
// Decide (CEO only: governed-action gate PLUS live ceo principal binding).
// ---------------------------------------------------------------------------

export type CaioAdviceDecisionResult =
  | { kind: "decided"; advice: CaioAdvice; projection: CaioAdviceDecisionProjection }
  | { kind: "idempotent"; advice: CaioAdvice; projection: CaioAdviceDecisionProjection }
  | { kind: "expired"; advice: CaioAdvice };

export async function decideCaioAdvice(input: {
  workspaceId: string;
  adviceRecordId: string;
  outcome: CaioAdviceDecisionOutcome;
  reason: string;
  actorUserId: string;
  actorCeoRef: string;
  english?: boolean;
}): Promise<CaioAdviceDecisionResult> {
  requireActorUserId(input.actorUserId);
  await assertWorkspaceGovernedActionManagementServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
  if (!input.reason || input.reason.trim() === "") {
    throw new CaioAdviceStoreError(
      "a CEO decision must carry a reason; empty reasons fail closed",
    );
  }
  return runWithWriteConflictRetry(() =>
    db.$transaction(async (tx) => {
      // lock order: advice row -> mandate row (see file header)
      const mandateRecordId = await lockAdviceRowAndGetMandateId(tx, {
        adviceRecordId: input.adviceRecordId,
        workspaceId: input.workspaceId,
      });
      await lockMandateRow(tx, {
        mandateRecordId,
        workspaceId: input.workspaceId,
      });
      const now = Date.now();
      const mandateRow = await tx.caioMandateRecord.findFirst({
        where: { id: mandateRecordId, workspaceId: input.workspaceId },
      });
      if (!mandateRow) throw new CaioAdviceStoreError("mandate record not found");
      if (input.actorCeoRef !== mandateRow.ceoRef) {
        throw new CaioAdviceStoreError(
          "only the mandate's CEO can decide advice",
        );
      }
      await assertGovernedActionCapabilityLocked(tx, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
      });
      await assertCeoPrincipalBindingLocked(tx, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        ceoRef: input.actorCeoRef,
      });
      await assertMandateGovernsAdvise(tx, mandateRow, now, "advice decision");
      const row = await tx.caioAdviceRecord.findFirst({
        where: { id: input.adviceRecordId, workspaceId: input.workspaceId },
      });
      if (!row) throw new CaioAdviceStoreError("advice record not found");

      if (row.status !== "proposed") {
        if (row.status === input.outcome) {
          const advice = toAdviceContract(row);
          return {
            kind: "idempotent",
            advice,
            projection: projectCaioAdviceDecision(advice, new Date(now).toISOString()),
          } satisfies CaioAdviceDecisionResult;
        }
        throw new CaioAdviceStoreError(
          `illegal decision: the advice is ${row.status}; a ${row.status} advice cannot become ${input.outcome}`,
        );
      }

      if (row.validUntil.getTime() <= now) {
        // Persist natural expiry so the ledger says what actually happened.
        const expired = await tx.caioAdviceRecord.updateMany({
          where: {
            id: input.adviceRecordId,
            workspaceId: input.workspaceId,
            status: "proposed",
          },
          data: { status: "expired" },
        });
        if (expired.count !== 1) {
          throw new CaioAdviceStoreError(
            "advice state changed concurrently; retry the decision",
          );
        }
        const expiredRow = await tx.caioAdviceRecord.findUniqueOrThrow({
          where: { id: input.adviceRecordId },
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
            actor: input.actorCeoRef,
            actorType: ActorType.USER,
            actionType: "CAIO_ADVICE_EXPIRED",
            targetType: "CaioAdviceRecord",
            targetId: input.adviceRecordId,
            summary: "CAIO advice expired undecided; the decision attempt recorded the expiry",
          },
          { client: tx },
        );
        return {
          kind: "expired",
          advice: toAdviceContract(expiredRow),
        } satisfies CaioAdviceDecisionResult;
      }

      const decidedAt = new Date(now);
      const updated = await tx.caioAdviceRecord.updateMany({
        where: {
          id: input.adviceRecordId,
          workspaceId: input.workspaceId,
          status: "proposed",
        },
        data: {
          status: input.outcome,
          decidedByRef: input.actorCeoRef,
          decisionOutcome: input.outcome,
          decisionReason: input.reason,
          decidedAt,
        },
      });
      if (updated.count !== 1) {
        throw new CaioAdviceStoreError(
          "advice state changed concurrently; retry the decision",
        );
      }
      const decidedRow = await tx.caioAdviceRecord.findUniqueOrThrow({
        where: { id: input.adviceRecordId },
      });
      const advice = toAdviceContract(decidedRow);
      assertAdviceValid(advice, toMandateContract(mandateRow), "advice decision");
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          actor: input.actorCeoRef,
          actorType: ActorType.USER,
          actionType: "CAIO_ADVICE_DECIDED",
          targetType: "CaioAdviceRecord",
          targetId: input.adviceRecordId,
          summary: `CEO decision recorded: advice ${input.outcome} (decision receipt is a projection; executes nothing)`,
          payload: { outcome: input.outcome },
          relatedObjectType: "CaioMandateRecord",
          relatedObjectId: mandateRecordId,
        },
        { client: tx },
      );
      return {
        kind: "decided",
        advice,
        projection: projectCaioAdviceDecision(advice, decidedAt.toISOString()),
      } satisfies CaioAdviceDecisionResult;
    }),
  );
}

// ---------------------------------------------------------------------------
// Withdraw (CAIO side retraction; always safe, allowed in any mandate
// state — retracting advice can never make anything happen).
// ---------------------------------------------------------------------------

export async function withdrawCaioAdvice(input: {
  workspaceId: string;
  adviceRecordId: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  english?: boolean;
}): Promise<CaioAdvice> {
  await assertWorkspaceInsightServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType ?? ActorType.AI,
    english: input.english ?? false,
  });
  return runWithWriteConflictRetry(() =>
    db.$transaction(async (tx) => {
      await lockAdviceRowAndGetMandateId(tx, {
        adviceRecordId: input.adviceRecordId,
        workspaceId: input.workspaceId,
      });
      const updated = await tx.caioAdviceRecord.updateMany({
        where: {
          id: input.adviceRecordId,
          workspaceId: input.workspaceId,
          status: "proposed",
        },
        data: { status: "withdrawn", withdrawnAt: new Date() },
      });
      if (updated.count !== 1) {
        const row = await tx.caioAdviceRecord.findFirst({
          where: { id: input.adviceRecordId, workspaceId: input.workspaceId },
        });
        if (row && row.status === "withdrawn") return toAdviceContract(row);
        throw new CaioAdviceStoreError(
          `only a proposed advice can be withdrawn${row ? ` (advice is ${row.status})` : ""}`,
        );
      }
      const row = await tx.caioAdviceRecord.findUniqueOrThrow({
        where: { id: input.adviceRecordId },
      });
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: input.actorUserId ?? undefined,
          actor: input.actorName,
          actorType: input.actorType ?? ActorType.AI,
          actionType: "CAIO_ADVICE_WITHDRAWN",
          targetType: "CaioAdviceRecord",
          targetId: input.adviceRecordId,
          summary: "CAIO advice withdrawn by its proposer before decision",
        },
        { client: tx },
      );
      return toAdviceContract(row);
    }),
  );
}

// ---------------------------------------------------------------------------
// Ledger read (single consistent snapshot, single projection clock).
// ---------------------------------------------------------------------------

export async function getCaioAdviceLedger(input: {
  workspaceId: string;
  mandateRecordId: string;
  actorUserId: string;
  at?: string;
  english?: boolean;
}): Promise<{
  at: string;
  entries: Array<{ advice: CaioAdvice; projection: CaioAdviceDecisionProjection }>;
}> {
  requireActorUserId(input.actorUserId);
  await assertWorkspaceInsightServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
  const atIso = input.at ?? new Date().toISOString();
  if (parseInstant(atIso) === null) {
    throw new CaioAdviceStoreError(
      "refusing read: 'at' is not a strict RFC 3339 instant",
    );
  }
  // Single $transaction snapshot: the ledger view cannot mix advice states
  // from different instants.
  const rows = await db.$transaction(async (tx) => {
    return tx.caioAdviceRecord.findMany({
      where: {
        workspaceId: input.workspaceId,
        mandateRecordId: input.mandateRecordId,
      },
      orderBy: { createdAt: "asc" },
    });
  });
  return {
    at: atIso,
    entries: rows.map((row) => {
      const advice = toAdviceContract(row);
      return { advice, projection: projectCaioAdviceDecision(advice, atIso) };
    }),
  };
}
