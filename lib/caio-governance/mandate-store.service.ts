import "server-only";

import {
  ActorType,
  MembershipStatus,
  Prisma,
  WorkspaceRole,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { assertWorkspacePolicyServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { jsonStringify, safeParseJson } from "@/lib/utils";
import {
  projectEnvelopeValidity,
  validateCaioMandate,
  validateGuardianStop,
  parseInstant,
} from "@/lib/caio-governance/contract";
import type {
  CaioGuardianStop,
  CaioMandate,
  CaioMandateStatus,
  CaioPolicyEnvelope,
} from "@/lib/caio-governance/types";

// ---------------------------------------------------------------------------
// CAIO mandate store — persistence for governance RECORDS only.
//
// Nothing in this module grants, transfers, or evaluates permission: a
// stored mandate is a governance record, never an authorization token, and
// no permission, routing, API, or execution path reads these tables. Every
// state-changing write validates the RESULTING contract state through the
// fail-closed validators in contract.ts inside the same transaction; an
// invalid target state never commits.
//
// Identity: acting as the CEO or as a guardian requires a live
// CaioPrincipalBinding row (workspace-scoped, OWNER-registered, audited)
// linking the AUTHENTICATED user to the principal ref — a caller cannot
// simply declare itself CEO. A binding row is a governance record, not a
// credential: the authoritative private CEO identity binding arrives via
// the private overlay slice, and this seam fails closed until a binding is
// registered.
//
// Concurrency: every status transition is a compare-and-set
// (updateMany ... where status = expected); a lost update aborts the
// transaction instead of overwriting. Activation additionally holds the
// per-workspace unique CaioActiveMandateClaim row and atomically reclaims
// the claim of a naturally-expired incumbent. Emergency stops are judged
// against the COMPLETE ledger: activation refuses while ANY un-resumed
// stop exists, and resuming one stop keeps the mandate stopped while
// others remain in force.
// ---------------------------------------------------------------------------

export class CaioMandateStoreError extends Error {
  readonly reasons: readonly string[];
  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "CaioMandateStoreError";
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

type MandateRow = {
  id: string;
  workspaceId: string;
  caioRef: string;
  ceoRef: string;
  stage: string;
  status: string;
  objectiveRefs: string;
  scopeRefs: string;
  grantBasisRefs: string;
  reservedMatterRefs: string;
  stageDecisionRef: string;
  policyEnvelopeRefs: string;
  humanResponsePolicyRef: string;
  accountabilityAnchorRefs: string;
  guardianStopRefs: string;
  emergencyStopRef: string | null;
  validFrom: Date;
  validUntil: Date;
  supersedesRef: string | null;
  inFlightDisposition: string;
  auditRefs: string;
};

type StopRow = {
  id: string;
  workspaceId: string;
  mandateRecordId: string;
  guardianRef: string;
  reason: string;
  triggeredAt: Date;
  resumedByRef: string | null;
  resumedAt: Date | null;
  auditRefs: string;
};

export function toMandateContract(row: MandateRow): CaioMandate {
  return {
    mandateId: row.id,
    workspaceRef: `workspace:${row.workspaceId}`,
    caioRef: row.caioRef,
    ceoRef: row.ceoRef,
    reportsTo: "CEO",
    objectiveRefs: safeParseJson<string[]>(row.objectiveRefs, []),
    scopeRefs: safeParseJson<string[]>(row.scopeRefs, []),
    grantBasisRefs: safeParseJson<string[]>(row.grantBasisRefs, []),
    reservedMatterRefs: safeParseJson<string[]>(row.reservedMatterRefs, []),
    stage: row.stage as CaioMandate["stage"],
    stageDecisionRef: row.stageDecisionRef,
    policyEnvelopeRefs: safeParseJson<string[]>(row.policyEnvelopeRefs, []),
    dispatchTargetCategories: [],
    humanResponsePolicyRef: row.humanResponsePolicyRef,
    conflictResolution: "pause_and_escalate_ceo",
    accountabilityAnchorRefs: safeParseJson<string[]>(
      row.accountabilityAnchorRefs,
      [],
    ),
    guardianStopRefs: safeParseJson<string[]>(row.guardianStopRefs, []),
    emergencyStopRef: row.emergencyStopRef,
    validFrom: row.validFrom.toISOString(),
    validUntil: row.validUntil.toISOString(),
    status: row.status as CaioMandateStatus,
    supersedesRef: row.supersedesRef,
    auditRefs: safeParseJson<string[]>(row.auditRefs, []),
    revocationPolicy: "envelopes_invalid_immediately",
    inFlightDisposition:
      row.inFlightDisposition as CaioMandate["inFlightDisposition"],
    authorityEffect: "none",
    runtimeAuthorityRef: null,
  };
}

export function toGuardianStopContract(row: StopRow): CaioGuardianStop {
  return {
    stopId: row.id,
    mandateRef: row.mandateRecordId,
    guardianRef: row.guardianRef,
    action: "stop",
    triggeredAt: row.triggeredAt.toISOString(),
    reason: row.reason,
    resumedByRef: row.resumedByRef,
    resumedAt: row.resumedAt === null ? null : row.resumedAt.toISOString(),
    auditRefs: safeParseJson<string[]>(row.auditRefs, []),
  };
}

function assertContractValid(mandate: CaioMandate, action: string): void {
  const validation = validateCaioMandate(mandate);
  if (!validation.valid) {
    throw new CaioMandateStoreError(
      `refusing ${action}: the resulting mandate state is invalid`,
      validation.errors,
    );
  }
}

function parseInstantOrThrow(value: string, field: string): Date {
  const epoch = parseInstant(value);
  if (epoch === null) {
    throw new CaioMandateStoreError(
      `refusing write: ${field} is not a strict RFC 3339 instant`,
    );
  }
  return new Date(epoch);
}

function requireActorUserId(actorUserId: string): string {
  if (!actorUserId || actorUserId.trim() === "") {
    throw new CaioMandateStoreError(
      "an authenticated acting user is required; empty actor identities fail closed",
    );
  }
  return actorUserId;
}

async function assertAccess(input: {
  workspaceId: string;
  actorUserId: string;
  english?: boolean;
}): Promise<void> {
  requireActorUserId(input.actorUserId);
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    english: input.english ?? false,
  });
}

// Binding REGISTRATION is strictly OWNER-only (ADMIN's MANAGE_POLICIES is
// not enough): the identity seam may only be fed by the workspace owner —
// or, later, by the authoritative private overlay slice.
async function assertWorkspaceOwner(
  tx: Tx,
  input: { workspaceId: string; actorUserId: string },
): Promise<void> {
  const membership = await tx.membership.findFirst({
    where: {
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });
  if (!membership) {
    throw new CaioMandateStoreError(
      "principal-binding registration is OWNER-only; MANAGE_POLICIES alone is not sufficient",
    );
  }
}

// Serializes all ledger/pointer work for one mandate: concurrent stop /
// resume / activation transactions queue on the InnoDB row lock instead of
// interleaving and leaving a stale emergency-stop pointer.
//
// LOCK-BEFORE-READ invariant: these locking reads are the FIRST reads of
// their transactions. Under InnoDB REPEATABLE READ the consistent-read
// snapshot is established by the first non-locking read, so acquiring the
// mandate lock first guarantees every subsequent plain read sees all
// ledger state committed before the lock was granted — a resume can never
// recount `remaining` against a stale snapshot that hides a concurrently
// committed stop.
async function lockMandateRow(
  tx: Tx,
  input: { mandateRecordId: string; workspaceId: string },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM CaioMandateRecord
    WHERE id = ${input.mandateRecordId} AND workspaceId = ${input.workspaceId}
    FOR UPDATE`;
  if (rows.length !== 1) {
    throw new CaioMandateStoreError("mandate record not found");
  }
}

// Locking read resolving a stop's mandate BEFORE any consistent read, so
// resume can then lock the mandate row. Lock order (stop row -> mandate
// row) cannot deadlock with the stop-recorder, which locks only the
// mandate row and inserts fresh stop rows.
async function lockStopRowAndGetMandateId(
  tx: Tx,
  input: { stopRecordId: string; workspaceId: string },
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ mandateRecordId: string }>>`
    SELECT mandateRecordId FROM CaioGuardianStopRecord
    WHERE id = ${input.stopRecordId} AND workspaceId = ${input.workspaceId}
    FOR UPDATE`;
  if (rows.length !== 1) {
    throw new CaioMandateStoreError("stop record not found");
  }
  return rows[0].mandateRecordId;
}

// The authenticated user must hold a live principal binding for the ref it
// is acting as. Fails closed when no binding exists.
async function assertPrincipalBinding(
  tx: Tx,
  input: {
    workspaceId: string;
    actorUserId: string;
    principalRef: string;
    principalKind: "ceo" | "guardian";
  },
): Promise<void> {
  const binding = await tx.caioPrincipalBinding.findFirst({
    where: {
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      principalRef: input.principalRef,
      principalKind: input.principalKind,
      revokedAt: null,
    },
  });
  if (!binding) {
    throw new CaioMandateStoreError(
      `no live ${input.principalKind} principal binding links the acting user to ${input.principalRef}; register the binding first (fail closed)`,
    );
  }
}

function inForceStopFilter(mandateRecordId: string) {
  return { mandateRecordId, resumedAt: null };
}

// ---------------------------------------------------------------------------
// Principal bindings (the identity seam).
// ---------------------------------------------------------------------------

export async function registerCaioPrincipalBinding(input: {
  workspaceId: string;
  actorUserId: string;
  userId: string;
  principalRef: string;
  principalKind: "ceo" | "guardian";
  evidenceRef: string;
  english?: boolean;
}) {
  await assertAccess(input);
  if (!input.evidenceRef || input.evidenceRef.trim() === "") {
    throw new CaioMandateStoreError("a binding evidenceRef is required");
  }
  if (input.principalRef.includes(":")) {
    throw new CaioMandateStoreError(
      "principal refs must be colon-free identifiers (grant-basis format constraint)",
    );
  }
  return db.$transaction(async (tx) => {
    await assertWorkspaceOwner(tx, input);
    let binding;
    try {
      binding = await tx.caioPrincipalBinding.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          principalRef: input.principalRef,
          principalKind: input.principalKind,
          evidenceRef: input.evidenceRef,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new CaioMandateStoreError(
          "a binding for this user and principal already exists",
        );
      }
      throw error;
    }
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorUserId,
        actorType: ActorType.USER,
        actionType: "CAIO_PRINCIPAL_BINDING_REGISTERED",
        targetType: "CaioPrincipalBinding",
        targetId: binding.id,
        summary:
          "CAIO principal binding registered (governance record, not a credential; grants nothing)",
        payload: {
          boundUserId: input.userId,
          principalRef: input.principalRef,
          principalKind: input.principalKind,
          evidenceRef: input.evidenceRef,
        },
      },
      { client: tx },
    );
    return binding;
  });
}

export async function revokeCaioPrincipalBinding(input: {
  workspaceId: string;
  actorUserId: string;
  bindingId: string;
  english?: boolean;
}) {
  await assertAccess(input);
  return db.$transaction(async (tx) => {
    await assertWorkspaceOwner(tx, input);
    const updated = await tx.caioPrincipalBinding.updateMany({
      where: {
        id: input.bindingId,
        workspaceId: input.workspaceId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new CaioMandateStoreError(
        "binding not found or already revoked (concurrent change)",
      );
    }
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorUserId,
        actorType: ActorType.USER,
        actionType: "CAIO_PRINCIPAL_BINDING_REVOKED",
        targetType: "CaioPrincipalBinding",
        targetId: input.bindingId,
        summary: "CAIO principal binding revoked",
      },
      { client: tx },
    );
  });
}

// ---------------------------------------------------------------------------
// Drafts.
// ---------------------------------------------------------------------------

export type CaioMandateDraftInput = {
  workspaceId: string;
  actorUserId: string;
  caioRef: string;
  ceoRef: string;
  stage: CaioMandate["stage"];
  stageDecisionRef: string;
  objectiveRefs: readonly string[];
  scopeRefs: readonly string[];
  grantBasisRefs: readonly string[];
  reservedMatterRefs: readonly string[];
  humanResponsePolicyRef: string;
  accountabilityAnchorRefs: readonly string[];
  guardianStopRefs: readonly string[];
  validFrom: string;
  validUntil: string;
  inFlightDisposition: CaioMandate["inFlightDisposition"];
  auditRefs: readonly string[];
  english?: boolean;
};

export async function createCaioMandateDraft(input: CaioMandateDraftInput) {
  await assertAccess(input);
  const candidate: CaioMandate = {
    mandateId: "pending",
    workspaceRef: `workspace:${input.workspaceId}`,
    caioRef: input.caioRef,
    ceoRef: input.ceoRef,
    reportsTo: "CEO",
    objectiveRefs: [...input.objectiveRefs],
    scopeRefs: [...input.scopeRefs],
    grantBasisRefs: [...input.grantBasisRefs],
    reservedMatterRefs: [...input.reservedMatterRefs],
    stage: input.stage,
    stageDecisionRef: input.stageDecisionRef,
    policyEnvelopeRefs: [],
    dispatchTargetCategories: [],
    humanResponsePolicyRef: input.humanResponsePolicyRef,
    conflictResolution: "pause_and_escalate_ceo",
    accountabilityAnchorRefs: [...input.accountabilityAnchorRefs],
    guardianStopRefs: [...input.guardianStopRefs],
    emergencyStopRef: null,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    status: "draft",
    supersedesRef: null,
    auditRefs: [...input.auditRefs],
    revocationPolicy: "envelopes_invalid_immediately",
    inFlightDisposition: input.inFlightDisposition,
    authorityEffect: "none",
    runtimeAuthorityRef: null,
  };
  assertContractValid(candidate, "draft creation");
  // Record and audit commit atomically: an unaudited draft can never exist.
  return db.$transaction(async (tx) => {
    const record = await tx.caioMandateRecord.create({
      data: {
        workspaceId: input.workspaceId,
        caioRef: input.caioRef,
        ceoRef: input.ceoRef,
        stage: input.stage,
        status: "draft",
        objectiveRefs: jsonStringify(input.objectiveRefs),
        scopeRefs: jsonStringify(input.scopeRefs),
        grantBasisRefs: jsonStringify(input.grantBasisRefs),
        reservedMatterRefs: jsonStringify(input.reservedMatterRefs),
        stageDecisionRef: input.stageDecisionRef,
        policyEnvelopeRefs: jsonStringify([]),
        humanResponsePolicyRef: input.humanResponsePolicyRef,
        accountabilityAnchorRefs: jsonStringify(input.accountabilityAnchorRefs),
        guardianStopRefs: jsonStringify(input.guardianStopRefs),
        validFrom: parseInstantOrThrow(input.validFrom, "validFrom"),
        validUntil: parseInstantOrThrow(input.validUntil, "validUntil"),
        inFlightDisposition: input.inFlightDisposition,
        auditRefs: jsonStringify(input.auditRefs),
      },
    });
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorUserId,
        actorType: ActorType.USER,
        actionType: "CAIO_MANDATE_DRAFT_CREATED",
        targetType: "CaioMandateRecord",
        targetId: record.id,
        summary:
          "CAIO mandate draft recorded (governance record only; grants nothing)",
        payload: { ceoRef: input.ceoRef, stage: input.stage },
      },
      { client: tx },
    );
    return toMandateContract(record);
  });
}

// ---------------------------------------------------------------------------
// Activation (CEO-binding-verified, CAS, full-ledger stop check, expired
// incumbent reclaim, optional supersede).
// ---------------------------------------------------------------------------

export async function activateCaioMandate(input: {
  workspaceId: string;
  actorUserId: string;
  actorCeoRef: string;
  mandateRecordId: string;
  supersedesRecordId?: string | null;
  english?: boolean;
}) {
  await assertAccess(input);
  // MariaDB surfaces snapshot conflicts on FOR UPDATE as error 1020; the
  // retry helper re-runs the whole transaction on such conflicts, so
  // concurrent ledger work serializes instead of failing spuriously.
  return runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
    // lock first: the snapshot for every later plain read starts fresh
    await lockMandateRow(tx, {
      mandateRecordId: input.mandateRecordId,
      workspaceId: input.workspaceId,
    });
    const now = Date.now();
    const row = await tx.caioMandateRecord.findFirst({
      where: { id: input.mandateRecordId, workspaceId: input.workspaceId },
    });
    if (!row) throw new CaioMandateStoreError("mandate record not found");
    if (input.actorCeoRef !== row.ceoRef) {
      throw new CaioMandateStoreError(
        "only the issuing CEO can activate a mandate",
      );
    }
    await assertPrincipalBinding(tx, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      principalRef: input.actorCeoRef,
      principalKind: "ceo",
    });
    const previousStatus = row.status;
    if (previousStatus !== "draft" && previousStatus !== "suspended") {
      throw new CaioMandateStoreError(
        `illegal transition: ${previousStatus} -> active`,
      );
    }
    if (row.validUntil.getTime() <= now) {
      throw new CaioMandateStoreError(
        "refusing activation: the mandate validity window has expired",
      );
    }
    if (row.validFrom.getTime() > now) {
      throw new CaioMandateStoreError(
        "refusing activation: the mandate validity window has not started",
      );
    }
    // FULL-ledger emergency-stop check: any un-resumed stop blocks
    // activation, whether or not it is the one referenced on the mandate.
    const inForceStops = await tx.caioGuardianStopRecord.count({
      where: inForceStopFilter(row.id),
    });
    if (inForceStops > 0 || row.emergencyStopRef !== null) {
      throw new CaioMandateStoreError(
        "refusing activation: one or more emergency stops are still in force; the CEO must resume them first",
      );
    }
    const candidate = {
      ...toMandateContract(row),
      status: "active" as const,
      supersedesRef: input.supersedesRecordId ?? row.supersedesRef,
    };
    assertContractValid(candidate, "activation");

    if (input.supersedesRecordId) {
      const superseded = await tx.caioMandateRecord.updateMany({
        where: {
          id: input.supersedesRecordId,
          workspaceId: input.workspaceId,
          status: "active",
        },
        data: { status: "superseded" },
      });
      if (superseded.count !== 1) {
        throw new CaioMandateStoreError(
          "supersedes target is not an active mandate in this workspace (or changed concurrently)",
        );
      }
      const supersededRow = await tx.caioMandateRecord.findUniqueOrThrow({
        where: { id: input.supersedesRecordId },
      });
      assertContractValid(
        toMandateContract(supersededRow),
        "post-supersede state",
      );
      await tx.caioActiveMandateClaim.deleteMany({
        where: { mandateRecordId: input.supersedesRecordId },
      });
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          actor: input.actorCeoRef,
          actorType: ActorType.USER,
          actionType: "CAIO_MANDATE_SUPERSEDED",
          targetType: "CaioMandateRecord",
          targetId: input.supersedesRecordId,
          summary: "CAIO mandate superseded by a successor activation",
          relatedObjectType: "CaioMandateRecord",
          relatedObjectId: row.id,
        },
        { client: tx },
      );
    } else {
      // Atomically reclaim the claim of a naturally-expired incumbent.
      const incumbentClaim = await tx.caioActiveMandateClaim.findFirst({
        where: { workspaceId: input.workspaceId },
        include: { mandateRecord: true },
      });
      if (
        incumbentClaim &&
        incumbentClaim.mandateRecord.validUntil.getTime() <= now
      ) {
        const expired = await tx.caioMandateRecord.updateMany({
          where: {
            id: incumbentClaim.mandateRecordId,
            workspaceId: input.workspaceId,
            status: "active",
          },
          data: { status: "expired" },
        });
        if (expired.count === 1) {
          const expiredRow = await tx.caioMandateRecord.findUniqueOrThrow({
            where: { id: incumbentClaim.mandateRecordId },
          });
          assertContractValid(
            toMandateContract(expiredRow),
            "post-expiry state",
          );
          await tx.caioActiveMandateClaim.deleteMany({
            where: { id: incumbentClaim.id },
          });
          await writeAuditLog(
            {
              workspaceId: input.workspaceId,
              userId: input.actorUserId,
              actor: input.actorCeoRef,
              actorType: ActorType.USER,
              actionType: "CAIO_MANDATE_EXPIRED",
              targetType: "CaioMandateRecord",
              targetId: incumbentClaim.mandateRecordId,
              summary:
                "expired incumbent mandate persisted as expired and its active claim reclaimed",
              relatedObjectType: "CaioMandateRecord",
              relatedObjectId: row.id,
            },
            { client: tx },
          );
        }
      }
    }

    try {
      await tx.caioActiveMandateClaim.create({
        data: { workspaceId: input.workspaceId, mandateRecordId: row.id },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new CaioMandateStoreError(
          "another mandate is already active in this workspace",
        );
      }
      throw error;
    }

    // CAS: only the exact status we inspected may transition.
    const transitioned = await tx.caioMandateRecord.updateMany({
      where: {
        id: row.id,
        workspaceId: input.workspaceId,
        status: previousStatus,
        emergencyStopRef: null,
      },
      data: {
        status: "active",
        supersedesRef: input.supersedesRecordId ?? row.supersedesRef,
      },
    });
    if (transitioned.count !== 1) {
      throw new CaioMandateStoreError(
        "activation lost a concurrent update; retry after inspecting the current state",
      );
    }
    const updated = await tx.caioMandateRecord.findUniqueOrThrow({
      where: { id: row.id },
    });
    assertContractValid(toMandateContract(updated), "post-activation state");
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorCeoRef,
        actorType: ActorType.USER,
        actionType: "CAIO_MANDATE_ACTIVATED",
        targetType: "CaioMandateRecord",
        targetId: row.id,
        summary:
          "CEO activated a CAIO mandate (governance record only; grants nothing)",
        payload: {
          ceoRef: row.ceoRef,
          supersedesRecordId: input.supersedesRecordId ?? null,
        },
      },
      { client: tx },
    );
    return toMandateContract(updated);
  }));
}

// ---------------------------------------------------------------------------
// Suspend / revoke (CEO-binding-verified, CAS, validated final state).
// ---------------------------------------------------------------------------

async function deactivate(input: {
  workspaceId: string;
  actorUserId: string;
  actorCeoRef: string;
  mandateRecordId: string;
  nextStatus: "suspended" | "revoked";
  action: string;
  english?: boolean;
}) {
  await assertAccess(input);
  return db.$transaction(async (tx) => {
    const row = await tx.caioMandateRecord.findFirst({
      where: { id: input.mandateRecordId, workspaceId: input.workspaceId },
    });
    if (!row) throw new CaioMandateStoreError("mandate record not found");
    if (input.actorCeoRef !== row.ceoRef) {
      throw new CaioMandateStoreError(
        `only the issuing CEO can ${input.action} a mandate`,
      );
    }
    await assertPrincipalBinding(tx, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      principalRef: input.actorCeoRef,
      principalKind: "ceo",
    });
    const allowedFrom =
      input.nextStatus === "suspended"
        ? ["active"]
        : ["draft", "active", "suspended"];
    if (!allowedFrom.includes(row.status)) {
      throw new CaioMandateStoreError(
        `illegal transition: ${row.status} -> ${input.nextStatus}`,
      );
    }
    const transitioned = await tx.caioMandateRecord.updateMany({
      where: {
        id: row.id,
        workspaceId: input.workspaceId,
        status: row.status,
      },
      data: { status: input.nextStatus },
    });
    if (transitioned.count !== 1) {
      throw new CaioMandateStoreError(
        `${input.action} lost a concurrent update; retry after inspecting the current state`,
      );
    }
    await tx.caioActiveMandateClaim.deleteMany({
      where: { mandateRecordId: row.id },
    });
    const updated = await tx.caioMandateRecord.findUniqueOrThrow({
      where: { id: row.id },
    });
    assertContractValid(
      toMandateContract(updated),
      `post-${input.action} state`,
    );
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorCeoRef,
        actorType: ActorType.USER,
        actionType: `CAIO_MANDATE_${input.nextStatus.toUpperCase()}`,
        targetType: "CaioMandateRecord",
        targetId: row.id,
        summary: `CEO moved the CAIO mandate to ${input.nextStatus}`,
        payload: { ceoRef: row.ceoRef },
      },
      { client: tx },
    );
    return toMandateContract(updated);
  });
}

export function suspendCaioMandate(input: {
  workspaceId: string;
  actorUserId: string;
  actorCeoRef: string;
  mandateRecordId: string;
  english?: boolean;
}) {
  return deactivate({ ...input, nextStatus: "suspended", action: "suspend" });
}

export function revokeCaioMandate(input: {
  workspaceId: string;
  actorUserId: string;
  actorCeoRef: string;
  mandateRecordId: string;
  english?: boolean;
}) {
  return deactivate({ ...input, nextStatus: "revoked", action: "revoke" });
}

// ---------------------------------------------------------------------------
// Guardian stops (guardian-binding-verified; full-ledger semantics).
// ---------------------------------------------------------------------------

export async function recordCaioGuardianStop(input: {
  workspaceId: string;
  actorUserId: string;
  guardianRef: string;
  mandateRecordId: string;
  reason: string;
  auditRefs: readonly string[];
  english?: boolean;
}) {
  await assertAccess(input);
  return runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
    // lock first: see LOCK-BEFORE-READ invariant
    await lockMandateRow(tx, {
      mandateRecordId: input.mandateRecordId,
      workspaceId: input.workspaceId,
    });
    const row = await tx.caioMandateRecord.findFirst({
      where: { id: input.mandateRecordId, workspaceId: input.workspaceId },
    });
    if (!row) throw new CaioMandateStoreError("mandate record not found");
    const mandate = toMandateContract(row);
    if (!mandate.guardianStopRefs.includes(input.guardianRef)) {
      throw new CaioMandateStoreError(
        "refusing stop: the actor is not a designated guardian of this mandate",
      );
    }
    await assertPrincipalBinding(tx, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      principalRef: input.guardianRef,
      principalKind: "guardian",
    });
    if (row.status !== "active" && row.status !== "suspended") {
      throw new CaioMandateStoreError(
        `refusing stop: mandate status is ${row.status}`,
      );
    }
    const stopRow = await tx.caioGuardianStopRecord.create({
      data: {
        workspaceId: input.workspaceId,
        mandateRecordId: row.id,
        guardianRef: input.guardianRef,
        reason: input.reason,
        triggeredAt: new Date(),
        auditRefs: jsonStringify(input.auditRefs),
      },
    });
    const stopContract = toGuardianStopContract(stopRow);
    const stopValidation = validateGuardianStop(stopContract, mandate);
    if (!stopValidation.valid) {
      throw new CaioMandateStoreError(
        "refusing stop: the stop record is invalid",
        stopValidation.errors,
      );
    }
    await tx.caioActiveMandateClaim.deleteMany({
      where: { mandateRecordId: row.id },
    });
    // CAS from the inspected status; both active and suspended mandates end
    // suspended with the latest stop referenced.
    const transitioned = await tx.caioMandateRecord.updateMany({
      where: { id: row.id, workspaceId: input.workspaceId, status: row.status },
      data: { status: "suspended", emergencyStopRef: stopRow.id },
    });
    if (transitioned.count !== 1) {
      throw new CaioMandateStoreError(
        "stop lost a concurrent update; retry after inspecting the current state",
      );
    }
    const updated = await tx.caioMandateRecord.findUniqueOrThrow({
      where: { id: row.id },
    });
    assertContractValid(toMandateContract(updated), "post-stop state");
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.guardianRef,
        actorType: ActorType.USER,
        actionType: "CAIO_GUARDIAN_STOP_RECORDED",
        targetType: "CaioGuardianStopRecord",
        targetId: stopRow.id,
        summary:
          "A designated guardian emergency-stopped the CAIO mandate; only the CEO can resume",
        payload: { guardianRef: input.guardianRef, mandateRecordId: row.id },
        relatedObjectType: "CaioMandateRecord",
        relatedObjectId: row.id,
      },
      { client: tx },
    );
    return { stop: stopContract, mandate: toMandateContract(updated) };
  }));
}

export async function resumeCaioGuardianStop(input: {
  workspaceId: string;
  actorUserId: string;
  actorCeoRef: string;
  stopRecordId: string;
  english?: boolean;
}) {
  await assertAccess(input);
  return runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
    // locking reads FIRST (stop row, then mandate row): every later plain
    // read runs on a snapshot that postdates the lock grant
    const mandateRecordId = await lockStopRowAndGetMandateId(tx, input);
    await lockMandateRow(tx, {
      mandateRecordId,
      workspaceId: input.workspaceId,
    });
    const stopRow = await tx.caioGuardianStopRecord.findFirst({
      where: { id: input.stopRecordId, workspaceId: input.workspaceId },
      include: { mandateRecord: true },
    });
    if (!stopRow) throw new CaioMandateStoreError("stop record not found");
    if (input.actorCeoRef !== stopRow.mandateRecord.ceoRef) {
      throw new CaioMandateStoreError(
        "resume authority belongs to the issuing CEO alone",
      );
    }
    await assertPrincipalBinding(tx, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      principalRef: input.actorCeoRef,
      principalKind: "ceo",
    });
    const resumedAt = new Date();
    if (resumedAt.getTime() <= stopRow.triggeredAt.getTime()) {
      throw new CaioMandateStoreError("resume must postdate the trigger");
    }
    // CAS on the un-resumed stop row: double resumes lose.
    const resumed = await tx.caioGuardianStopRecord.updateMany({
      where: {
        id: stopRow.id,
        workspaceId: input.workspaceId,
        resumedAt: null,
      },
      data: { resumedByRef: input.actorCeoRef, resumedAt },
    });
    if (resumed.count !== 1) {
      throw new CaioMandateStoreError("the stop is already resumed");
    }
    const updatedStop = await tx.caioGuardianStopRecord.findUniqueOrThrow({
      where: { id: stopRow.id },
    });
    const stopValidation = validateGuardianStop(
      toGuardianStopContract(updatedStop),
      toMandateContract(stopRow.mandateRecord),
    );
    if (!stopValidation.valid) {
      throw new CaioMandateStoreError(
        "refusing resume: the resumed stop record is invalid",
        stopValidation.errors,
      );
    }
    // The mandate's emergency-stop pointer only clears when NO other stop
    // remains in force; otherwise it repoints to a remaining stop.
    const remaining = await tx.caioGuardianStopRecord.findFirst({
      where: inForceStopFilter(stopRow.mandateRecordId),
      orderBy: { triggeredAt: "asc" },
    });
    const mandateAfter = await tx.caioMandateRecord.update({
      where: { id: stopRow.mandateRecordId },
      data: { emergencyStopRef: remaining === null ? null : remaining.id },
    });
    assertContractValid(toMandateContract(mandateAfter), "post-resume state");
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorCeoRef,
        actorType: ActorType.USER,
        actionType: "CAIO_GUARDIAN_STOP_RESUMED",
        targetType: "CaioGuardianStopRecord",
        targetId: stopRow.id,
        summary:
          remaining !== null
            ? "The issuing CEO resumed one guardian stop; other stops remain in force"
            : `The issuing CEO resumed the last in-force guardian stop; the mandate remains ${mandateAfter.status} until an explicit CEO action`,
        payload: {
          resumedByRef: input.actorCeoRef,
          remainingInForceStopId: remaining === null ? null : remaining.id,
        },
        relatedObjectType: "CaioMandateRecord",
        relatedObjectId: stopRow.mandateRecordId,
      },
      { client: tx },
    );
    return {
      stop: toGuardianStopContract(updatedStop),
      mandate: toMandateContract(mandateAfter),
    };
  }));
}

// ---------------------------------------------------------------------------
// Reads.
// ---------------------------------------------------------------------------

// The mandate plus its COMPLETE guardian-stop ledger. `at` (default: now)
// drives BOTH the expiry projection and the ledger view, so historical
// queries stay on one clock: stops triggered after `at` are excluded, and a
// stop resumed after `at` is presented as still in force at `at`.
export async function getCaioMandateWithStops(input: {
  workspaceId: string;
  actorUserId: string;
  mandateRecordId: string;
  at?: string;
  english?: boolean;
}) {
  await assertAccess(input);
  const atEpoch =
    input.at === undefined ? Date.now() : parseInstant(input.at);
  if (atEpoch === null) {
    throw new CaioMandateStoreError(
      "refusing read: `at` is not a strict RFC 3339 instant",
    );
  }
  // A single interactive transaction gives one REPEATABLE READ snapshot
  // for the mandate and its ledger — the two can never come from different
  // commit points.
  const row = await db.$transaction((tx) =>
    tx.caioMandateRecord.findFirst({
      where: { id: input.mandateRecordId, workspaceId: input.workspaceId },
      include: { guardianStops: { orderBy: { createdAt: "asc" } } },
    }),
  );
  if (!row) throw new CaioMandateStoreError("mandate record not found");
  const mandate = toMandateContract(row);
  const projectedStatus: CaioMandateStatus =
    (mandate.status === "active" || mandate.status === "suspended") &&
    row.validUntil.getTime() <= atEpoch
      ? "expired"
      : mandate.status;
  const stops = row.guardianStops
    .filter((stop) => stop.triggeredAt.getTime() <= atEpoch)
    .map((stop) =>
      stop.resumedAt !== null && stop.resumedAt.getTime() > atEpoch
        ? { ...stop, resumedAt: null, resumedByRef: null }
        : stop,
    )
    .map(toGuardianStopContract);
  return { mandate: { ...mandate, status: projectedStatus }, stops };
}

// Envelope projection fed with the complete, `at`-consistent ledger.
export async function projectStoredEnvelopeValidity(input: {
  workspaceId: string;
  actorUserId: string;
  mandateRecordId: string;
  envelope: CaioPolicyEnvelope;
  at: string;
  english?: boolean;
}) {
  const { mandate, stops } = await getCaioMandateWithStops({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    mandateRecordId: input.mandateRecordId,
    at: input.at,
    english: input.english,
  });
  return projectEnvelopeValidity(input.envelope, mandate, stops, input.at);
}
