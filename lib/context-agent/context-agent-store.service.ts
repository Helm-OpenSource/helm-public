// CAIO Pro P1E: Context Agent consent / revocation / deletion store.
//
// Persistence for the review-first Context Agent participation chain. Every
// invariant enforced by the pure contracts in ./context-agent-contracts is
// re-enforced here fail-closed against database truth:
// - default not-participating (no live consent -> no collection receipt);
// - self-consent, self-narrowing and self-resume (server-side identity,
//   verified against the acting user's own ACTIVE membership in-transaction);
// - scope expansion requires a fresh consent bound to the new scope hash;
// - pause blocks new collection receipts at record time;
// - revocation is terminal and opens exactly one deletion work item;
// - participation state never feeds performance input (frozen literal);
// - receipts carry evidence refs and digest hashes only, and error paths
//   emit stable codes without echoing candidate content;
// - consent state transitions are CAS + row-locked inside SERIALIZABLE
//   transactions, and every write audits in the same transaction.
import "server-only";

import { ActorType, MembershipStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  WORKSPACE_CAPABILITIES,
  workspaceRoleHasCapability,
} from "@/lib/auth/authorization";
import { assertWorkspacePolicyServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { jsonStringify, safeParseJson } from "@/lib/utils";
import {
  classifyContextAgentScopeChange,
  computeContextAgentScopeHash,
  createContextAgentCollectionReceipt,
  createContextAgentConsentReceipt,
  createContextAgentDeletionReceipt,
  createContextAgentInvitation,
  createContextAgentPauseReceipt,
  createContextAgentRevocationReceipt,
  createContextAgentScopeRevision,
  normalizeContextAgentScope,
  validateContextAgentCollectionReceipt,
  validateContextAgentConsentReceipt,
  validateContextAgentDeletionReceipt,
  validateContextAgentInvitation,
  validateContextAgentPauseReceipt,
  validateContextAgentRevocationReceipt,
  validateContextAgentScope,
  type ContextAgentCollectionKind,
  type ContextAgentCollectionReceipt,
  type ContextAgentConsentReceipt,
  type ContextAgentDeletionCounts,
  type ContextAgentDeletionOutcome,
  type ContextAgentDeletionReceipt,
  type ContextAgentInvitation,
  type ContextAgentPauseReceipt,
  type ContextAgentRevocationReceipt,
  type ContextAgentScope,
  type ContextAgentScopeRevision,
} from "./context-agent-contracts";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

const LIVE_PARTICIPATION_STATUSES = ["ACTIVE", "PAUSED"] as const;

export class ContextAgentStoreError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "ContextAgentStoreError";
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

function nonEmpty(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ContextAgentStoreError(reason);
  }
  return normalized;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right));
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    jsonStringify(uniqueSorted(left)) === jsonStringify(uniqueSorted(right))
  );
}

function sameScope(
  left: ContextAgentScope,
  right: ContextAgentScope,
): boolean {
  return (
    classifyContextAgentScopeChange(left, right) === "unchanged"
  );
}

async function assertPolicyAccess(input: {
  workspaceId: string;
  actorUserId: string;
  english?: boolean;
}): Promise<void> {
  nonEmpty(input.actorUserId, "signed_in_human_actor_required");
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
}

// One workspace lock serializes participation transitions; SERIALIZABLE
// isolation makes concurrent consent-state reads/writes conflict instead of
// committing against a mixed before/after snapshot.
async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new ContextAgentStoreError("workspace_not_found");
  }
}

// Row-locks the member's membership and returns its live role/status. Every
// participation-chain write goes through this for the member so a concurrent
// role/status change conflicts instead of racing.
async function lockMembership(
  tx: Tx,
  input: { workspaceId: string; userId: string },
): Promise<{ role: string; status: string } | null> {
  const rows = await tx.$queryRaw<
    Array<{ role: string; status: string }>
  >`
    SELECT role, status FROM Membership
    WHERE workspaceId = ${input.workspaceId} AND userId = ${input.userId}
    FOR UPDATE`;
  return rows[0] ?? null;
}

async function assertActiveMembershipInTransaction(
  tx: Tx,
  input: { workspaceId: string; userId: string },
  reason: string,
): Promise<{ role: string }> {
  const membership = await lockMembership(tx, input);
  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw new ContextAgentStoreError(reason);
  }
  return { role: membership.role };
}

// In-transaction re-verification of the acting admin's policy capability
// (assertPolicyAccessInTransaction pattern).
async function assertPolicyAccessInTransaction(
  tx: Tx,
  input: { workspaceId: string; actorUserId: string },
): Promise<void> {
  const membership = await lockMembership(tx, {
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
  });
  if (
    !membership ||
    membership.status !== MembershipStatus.ACTIVE ||
    !workspaceRoleHasCapability(
      membership.role as Parameters<typeof workspaceRoleHasCapability>[0],
      WORKSPACE_CAPABILITIES.MANAGE_POLICIES,
    )
  ) {
    throw new ContextAgentStoreError("workspace_policy_access_lost");
  }
}

// Member-self actions accept the member themself; protective actions (pause,
// revoke) additionally accept a workspace policy admin. Consent, narrowing
// and resume never take the admin path.
async function assertSelfOrPolicyActor(
  tx: Tx,
  input: {
    workspaceId: string;
    actorUserId: string;
    memberUserId: string;
  },
  selfReason: string,
): Promise<void> {
  if (input.actorUserId === input.memberUserId) {
    await assertActiveMembershipInTransaction(
      tx,
      { workspaceId: input.workspaceId, userId: input.actorUserId },
      selfReason,
    );
    return;
  }
  await assertPolicyAccessInTransaction(tx, input);
}

function parseStrictStringArray(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function parseStoredScope(value: string): ContextAgentScope {
  const scope = safeParseJson<ContextAgentScope | null>(value, null);
  if (!scope || !validateContextAgentScope(scope).valid) {
    throw new ContextAgentStoreError("stored_scope_invalid");
  }
  return normalizeContextAgentScope(scope);
}

type StoredInvitationRow = {
  id: string;
  workspaceId: string;
  memberUserId: string;
  invitedByUserId: string;
  scopeJson: string;
  scopeHash: string;
  status: string;
  idempotencyKey: string;
  evidenceRefs: string;
  invitationJson: string;
  contentHash: string;
  recordedAt: Date;
};

function parseStoredInvitation(
  row: StoredInvitationRow,
): ContextAgentInvitation {
  const invitation = safeParseJson<ContextAgentInvitation | null>(
    row.invitationJson,
    null,
  );
  if (!invitation) {
    throw new ContextAgentStoreError("stored_invitation_invalid");
  }
  const validation = validateContextAgentInvitation(invitation);
  const evidenceRefs = parseStrictStringArray(row.evidenceRefs);
  if (
    !validation.valid ||
    !evidenceRefs ||
    invitation.invitationId !== row.id ||
    invitation.workspaceRef !== `workspace:${row.workspaceId}` ||
    invitation.memberUserRef !== row.memberUserId ||
    invitation.invitedByUserRef !== row.invitedByUserId ||
    invitation.scopeHash !== row.scopeHash ||
    !sameScope(invitation.scope, parseStoredScope(row.scopeJson)) ||
    invitation.idempotencyKey !== row.idempotencyKey ||
    !sameStrings(invitation.evidenceRefs, evidenceRefs) ||
    invitation.contentHash !== row.contentHash ||
    invitation.recordedAt !== row.recordedAt.toISOString()
  ) {
    throw new ContextAgentStoreError(
      "stored_invitation_binding_invalid",
      validation.errors,
    );
  }
  return invitation;
}

type StoredConsentRow = {
  id: string;
  workspaceId: string;
  invitationId: string;
  memberUserId: string;
  actorUserId: string;
  consentVersion: number;
  previousConsentId: string | null;
  scopeJson: string;
  scopeHash: string;
  effectiveScopeJson: string;
  effectiveScopeHash: string;
  participationStatus: string;
  stateVersion: number;
  performanceInputProhibited: boolean;
  idempotencyKey: string;
  evidenceRefs: string;
  receiptJson: string;
  contentHash: string;
  recordedAt: Date;
};

type StoredConsent = {
  receipt: ContextAgentConsentReceipt;
  effectiveScope: ContextAgentScope;
  effectiveScopeHash: string;
  participationStatus: string;
  stateVersion: number;
};

function parseStoredConsent(row: StoredConsentRow): StoredConsent {
  const receipt = safeParseJson<ContextAgentConsentReceipt | null>(
    row.receiptJson,
    null,
  );
  if (!receipt) {
    throw new ContextAgentStoreError("stored_consent_invalid");
  }
  const validation = validateContextAgentConsentReceipt(receipt);
  const evidenceRefs = parseStrictStringArray(row.evidenceRefs);
  const effectiveScope = parseStoredScope(row.effectiveScopeJson);
  if (
    !validation.valid ||
    !evidenceRefs ||
    // Frozen boundary literal must hold in BOTH the row projection and the
    // immutable receipt payload; any drift is refused, never repaired.
    row.performanceInputProhibited !== true ||
    receipt.performanceInputProhibited !== true ||
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.invitationRef !== row.invitationId ||
    receipt.memberUserRef !== row.memberUserId ||
    receipt.actorUserRef !== row.actorUserId ||
    receipt.consentVersion !== row.consentVersion ||
    receipt.previousConsentRef !== row.previousConsentId ||
    receipt.scopeHash !== row.scopeHash ||
    !sameScope(receipt.scope, parseStoredScope(row.scopeJson)) ||
    row.effectiveScopeHash !==
      computeContextAgentScopeHash(effectiveScope) ||
    classifyContextAgentScopeChange(receipt.scope, effectiveScope) ===
      "expansion" ||
    receipt.idempotencyKey !== row.idempotencyKey ||
    !sameStrings(receipt.evidenceRefs, evidenceRefs) ||
    receipt.contentHash !== row.contentHash ||
    receipt.recordedAt !== row.recordedAt.toISOString()
  ) {
    throw new ContextAgentStoreError(
      "stored_consent_binding_invalid",
      validation.errors,
    );
  }
  return {
    receipt,
    effectiveScope,
    effectiveScopeHash: row.effectiveScopeHash,
    participationStatus: row.participationStatus,
    stateVersion: row.stateVersion,
  };
}

async function loadConsentRow(
  tx: Tx,
  input: { workspaceId: string; consentReceiptId: string },
): Promise<StoredConsentRow> {
  const row = await tx.contextAgentConsentReceipt.findFirst({
    where: {
      id: input.consentReceiptId,
      workspaceId: input.workspaceId,
    },
  });
  if (!row) {
    throw new ContextAgentStoreError("consent_not_found");
  }
  return row;
}

// CAS transition of the consent projection. The caller has already read the
// row inside the same locked SERIALIZABLE transaction; the guarded update
// still re-checks status + stateVersion so an interleaved transition loses
// deterministically instead of being silently overwritten.
async function transitionConsentState(
  tx: Tx,
  input: {
    workspaceId: string;
    consentReceiptId: string;
    expectedStatus: string;
    expectedStateVersion: number;
    nextStatus?: string;
    nextEffectiveScope?: ContextAgentScope;
  },
): Promise<void> {
  const updated = await tx.contextAgentConsentReceipt.updateMany({
    where: {
      id: input.consentReceiptId,
      workspaceId: input.workspaceId,
      participationStatus: input.expectedStatus,
      stateVersion: input.expectedStateVersion,
    },
    data: {
      ...(input.nextStatus
        ? { participationStatus: input.nextStatus }
        : {}),
      ...(input.nextEffectiveScope
        ? {
            effectiveScopeJson: jsonStringify(
              normalizeContextAgentScope(input.nextEffectiveScope),
            ),
            effectiveScopeHash: computeContextAgentScopeHash(
              input.nextEffectiveScope,
            ),
          }
        : {}),
      stateVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new ContextAgentStoreError("consent_state_concurrent_update");
  }
}

async function findLiveConsentRow(
  tx: Tx,
  input: { workspaceId: string; memberUserId: string },
): Promise<StoredConsentRow | null> {
  return tx.contextAgentConsentReceipt.findFirst({
    where: {
      workspaceId: input.workspaceId,
      memberUserId: input.memberUserId,
      participationStatus: { in: [...LIVE_PARTICIPATION_STATUSES] },
    },
    orderBy: { consentVersion: "desc" },
  });
}

export async function inviteContextAgentParticipation(input: {
  workspaceId: string;
  actorUserId: string;
  memberUserId: string;
  scope: ContextAgentScope;
  evidenceRefs: string[];
  idempotencyKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{ invitation: ContextAgentInvitation; replayed: boolean }> {
  await assertPolicyAccess(input);
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const memberUserId = nonEmpty(
    input.memberUserId,
    "member_user_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        await assertActiveMembershipInTransaction(
          tx,
          { workspaceId: input.workspaceId, userId: memberUserId },
          "invited_member_active_membership_required",
        );
        const existing = await tx.contextAgentInvitation.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          const invitation = parseStoredInvitation(existing);
          if (
            invitation.memberUserRef !== memberUserId ||
            invitation.invitedByUserRef !== input.actorUserId ||
            invitation.scopeHash !==
              computeContextAgentScopeHash(input.scope) ||
            !sameStrings(invitation.evidenceRefs, input.evidenceRefs)
          ) {
            throw new ContextAgentStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          return { invitation, replayed: true };
        }
        const invitation = createContextAgentInvitation({
          workspaceRef: `workspace:${input.workspaceId}`,
          memberUserRef: memberUserId,
          invitedByUserRef: input.actorUserId,
          scope: input.scope,
          evidenceRefs: input.evidenceRefs,
          idempotencyKey,
          recordedAt: now.toISOString(),
        });
        try {
          await tx.contextAgentInvitation.create({
            data: {
              id: invitation.invitationId,
              workspaceId: input.workspaceId,
              memberUserId,
              invitedByUserId: input.actorUserId,
              scopeJson: jsonStringify(invitation.scope),
              scopeHash: invitation.scopeHash,
              status: "PENDING",
              idempotencyKey,
              evidenceRefs: jsonStringify(invitation.evidenceRefs),
              invitationJson: jsonStringify(invitation),
              contentHash: invitation.contentHash,
              recordedAt: now,
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new ContextAgentStoreError(
              "context_agent_concurrent_conflict",
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
            actionType: "CONTEXT_AGENT_INVITED",
            targetType: "ContextAgentInvitation",
            targetId: invitation.invitationId,
            summary:
              "Context Agent participation invitation recorded (review record only; the member remains not participating until self-consent)",
            payload: {
              memberUserRef: invitation.memberUserRef,
              scopeHash: invitation.scopeHash,
              authorityEffect: invitation.authorityEffect,
            },
          },
          { client: tx },
        );
        return { invitation, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export async function recordContextAgentConsent(input: {
  workspaceId: string;
  actorUserId: string;
  invitationId: string;
  evidenceRefs: string[];
  idempotencyKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{ receipt: ContextAgentConsentReceipt; replayed: boolean }> {
  const actorUserId = nonEmpty(
    input.actorUserId,
    "signed_in_human_actor_required",
  );
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        // Self-consent only: the acting user's own ACTIVE membership is the
        // identity that consents; no capability elevates anyone else.
        await assertActiveMembershipInTransaction(
          tx,
          { workspaceId: input.workspaceId, userId: actorUserId },
          "consenting_member_active_membership_required",
        );
        const invitationRow = await tx.contextAgentInvitation.findFirst({
          where: {
            id: input.invitationId,
            workspaceId: input.workspaceId,
          },
        });
        if (!invitationRow) {
          throw new ContextAgentStoreError("invitation_not_found");
        }
        const invitation = parseStoredInvitation(invitationRow);
        // Server-side identity check: an admin/OWNER consenting on behalf of
        // another user is refused regardless of capability.
        if (invitation.memberUserRef !== actorUserId) {
          throw new ContextAgentStoreError(
            "context_agent_self_consent_required",
          );
        }
        const existing = await tx.contextAgentConsentReceipt.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          const stored = parseStoredConsent(existing);
          if (
            stored.receipt.invitationRef !== invitation.invitationId ||
            stored.receipt.actorUserRef !== actorUserId ||
            !sameStrings(stored.receipt.evidenceRefs, input.evidenceRefs)
          ) {
            throw new ContextAgentStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          return { receipt: stored.receipt, replayed: true };
        }
        if (invitationRow.status !== "PENDING") {
          throw new ContextAgentStoreError("invitation_already_consented");
        }
        const liveRow = await findLiveConsentRow(tx, {
          workspaceId: input.workspaceId,
          memberUserId: actorUserId,
        });
        const live = liveRow ? parseStoredConsent(liveRow) : null;
        const latest = await tx.contextAgentConsentReceipt.findFirst({
          where: {
            workspaceId: input.workspaceId,
            memberUserId: actorUserId,
          },
          orderBy: { consentVersion: "desc" },
          select: { id: true, consentVersion: true },
        });
        const receipt = createContextAgentConsentReceipt({
          workspaceRef: `workspace:${input.workspaceId}`,
          invitationRef: invitation.invitationId,
          memberUserRef: actorUserId,
          actorUserRef: actorUserId,
          consentVersion: (latest?.consentVersion ?? 0) + 1,
          previousConsentRef: latest?.id ?? null,
          scope: invitation.scope,
          evidenceRefs: input.evidenceRefs,
          idempotencyKey,
          recordedAt: now.toISOString(),
        });
        try {
          await tx.contextAgentConsentReceipt.create({
            data: {
              id: receipt.receiptId,
              workspaceId: input.workspaceId,
              invitationId: invitation.invitationId,
              memberUserId: actorUserId,
              actorUserId,
              consentVersion: receipt.consentVersion,
              previousConsentId: receipt.previousConsentRef,
              scopeJson: jsonStringify(receipt.scope),
              scopeHash: receipt.scopeHash,
              effectiveScopeJson: jsonStringify(receipt.scope),
              effectiveScopeHash: receipt.scopeHash,
              participationStatus: "ACTIVE",
              stateVersion: 1,
              performanceInputProhibited:
                receipt.performanceInputProhibited,
              idempotencyKey,
              evidenceRefs: jsonStringify(receipt.evidenceRefs),
              receiptJson: jsonStringify(receipt),
              contentHash: receipt.contentHash,
              recordedAt: now,
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new ContextAgentStoreError(
              "context_agent_concurrent_conflict",
            );
          }
          throw error;
        }
        if (live) {
          // A fresh consent (the only path that can widen scope) supersedes
          // the previous live consent version via CAS.
          await transitionConsentState(tx, {
            workspaceId: input.workspaceId,
            consentReceiptId: live.receipt.receiptId,
            expectedStatus: live.participationStatus,
            expectedStateVersion: live.stateVersion,
            nextStatus: "SUPERSEDED",
          });
        }
        const invitationUpdated =
          await tx.contextAgentInvitation.updateMany({
            where: {
              id: invitation.invitationId,
              workspaceId: input.workspaceId,
              status: "PENDING",
            },
            data: { status: "CONSENTED" },
          });
        if (invitationUpdated.count !== 1) {
          throw new ContextAgentStoreError(
            "context_agent_concurrent_conflict",
          );
        }
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: actorUserId,
            actor: actorUserId,
            actorType: ActorType.USER,
            actionType: "CONTEXT_AGENT_CONSENT_RECORDED",
            targetType: "ContextAgentConsentReceipt",
            targetId: receipt.receiptId,
            summary:
              "Employee self-consented to Context Agent collection scope (governance receipt only; grants nothing and never feeds performance input)",
            relatedObjectType: "ContextAgentInvitation",
            relatedObjectId: invitation.invitationId,
            payload: {
              consentVersion: receipt.consentVersion,
              scopeHash: receipt.scopeHash,
              supersededConsentRef: live?.receipt.receiptId ?? null,
              performanceInputProhibited:
                receipt.performanceInputProhibited,
              authorityEffect: receipt.authorityEffect,
            },
          },
          { client: tx },
        );
        return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export async function reviseContextAgentScope(input: {
  workspaceId: string;
  actorUserId: string;
  consentReceiptId: string;
  newScope: ContextAgentScope;
  idempotencyKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{ revision: ContextAgentScopeRevision; replayed: boolean }> {
  const actorUserId = nonEmpty(
    input.actorUserId,
    "signed_in_human_actor_required",
  );
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        await assertActiveMembershipInTransaction(
          tx,
          { workspaceId: input.workspaceId, userId: actorUserId },
          "revising_member_active_membership_required",
        );
        const row = await loadConsentRow(tx, input);
        const stored = parseStoredConsent(row);
        if (stored.receipt.memberUserRef !== actorUserId) {
          throw new ContextAgentStoreError(
            "context_agent_self_scope_revision_required",
          );
        }
        const existing = await tx.contextAgentScopeRevision.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          const revision = safeParseJson<ContextAgentScopeRevision | null>(
            existing.revisionJson,
            null,
          );
          if (
            !revision ||
            revision.consentRef !== stored.receipt.receiptId ||
            revision.newScopeHash !==
              computeContextAgentScopeHash(input.newScope)
          ) {
            throw new ContextAgentStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          return { revision, replayed: true };
        }
        if (
          !(LIVE_PARTICIPATION_STATUSES as readonly string[]).includes(
            stored.participationStatus,
          )
        ) {
          throw new ContextAgentStoreError(
            "scope_revision_requires_live_consent",
          );
        }
        // Fail-closed in the store as well as the contract: widening any
        // dimension needs a fresh consent bound to the new scope hash.
        const change = classifyContextAgentScopeChange(
          stored.effectiveScope,
          input.newScope,
        );
        if (change === "expansion") {
          throw new ContextAgentStoreError(
            "scope_expansion_requires_new_consent",
          );
        }
        if (change !== "narrowing") {
          throw new ContextAgentStoreError(
            "scope_revision_requires_narrowing",
          );
        }
        const priorRevisions = await tx.contextAgentScopeRevision.count({
          where: {
            consentReceiptId: stored.receipt.receiptId,
            workspaceId: input.workspaceId,
          },
        });
        const revision = createContextAgentScopeRevision({
          workspaceRef: `workspace:${input.workspaceId}`,
          consentRef: stored.receipt.receiptId,
          memberUserRef: stored.receipt.memberUserRef,
          actorUserRef: actorUserId,
          sequence: priorRevisions + 1,
          previousScope: stored.effectiveScope,
          newScope: input.newScope,
          idempotencyKey,
          recordedAt: now.toISOString(),
        });
        try {
          await tx.contextAgentScopeRevision.create({
            data: {
              id: revision.revisionId,
              workspaceId: input.workspaceId,
              consentReceiptId: stored.receipt.receiptId,
              memberUserId: stored.receipt.memberUserRef,
              actorUserId,
              sequence: revision.sequence,
              revisionKind: revision.revisionKind.toUpperCase(),
              previousScopeJson: jsonStringify(revision.previousScope),
              previousScopeHash: revision.previousScopeHash,
              newScopeJson: jsonStringify(revision.newScope),
              newScopeHash: revision.newScopeHash,
              idempotencyKey,
              revisionJson: jsonStringify(revision),
              contentHash: revision.contentHash,
              recordedAt: now,
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new ContextAgentStoreError(
              "context_agent_concurrent_conflict",
            );
          }
          throw error;
        }
        await transitionConsentState(tx, {
          workspaceId: input.workspaceId,
          consentReceiptId: stored.receipt.receiptId,
          expectedStatus: stored.participationStatus,
          expectedStateVersion: stored.stateVersion,
          nextEffectiveScope: revision.newScope,
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: actorUserId,
            actor: actorUserId,
            actorType: ActorType.USER,
            actionType: "CONTEXT_AGENT_SCOPE_NARROWED",
            targetType: "ContextAgentScopeRevision",
            targetId: revision.revisionId,
            summary:
              "Employee narrowed their Context Agent collection scope (no re-consent required for narrowing)",
            relatedObjectType: "ContextAgentConsentReceipt",
            relatedObjectId: stored.receipt.receiptId,
            payload: {
              previousScopeHash: revision.previousScopeHash,
              newScopeHash: revision.newScopeHash,
              authorityEffect: revision.authorityEffect,
            },
          },
          { client: tx },
        );
        return { revision, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export async function recordContextAgentCollection(input: {
  workspaceId: string;
  actorUserId: string;
  consentReceiptId: string;
  collectionKind: ContextAgentCollectionKind;
  consentScopeHash: string;
  itemCount: number;
  digestHashes: string[];
  evidenceRefs: string[];
  collectedAt: Date;
  idempotencyKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{ receipt: ContextAgentCollectionReceipt; replayed: boolean }> {
  await assertPolicyAccess(input);
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        const existing = await tx.contextAgentCollectionReceipt.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          const receipt =
            safeParseJson<ContextAgentCollectionReceipt | null>(
              existing.receiptJson,
              null,
            );
          if (
            !receipt ||
            !validateContextAgentCollectionReceipt(receipt).valid ||
            receipt.consentRef !== input.consentReceiptId ||
            receipt.consentScopeHash !== input.consentScopeHash ||
            !sameStrings(receipt.digestHashes, input.digestHashes)
          ) {
            throw new ContextAgentStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          return { receipt, replayed: true };
        }
        // Default not-participating: without a live consent row there is
        // nothing to bind a collection receipt to, and any non-ACTIVE state
        // (paused, revoked, superseded) refuses new collection immediately.
        const row = await loadConsentRow(tx, input);
        const stored = parseStoredConsent(row);
        if (stored.participationStatus !== "ACTIVE") {
          throw new ContextAgentStoreError(
            "collection_requires_active_consent",
          );
        }
        await assertActiveMembershipInTransaction(
          tx,
          {
            workspaceId: input.workspaceId,
            userId: stored.receipt.memberUserRef,
          },
          "collection_member_active_membership_required",
        );
        // The receipt must bind to the consent's current effective scope
        // hash; a stale hash (e.g. after narrowing) is refused.
        if (input.consentScopeHash !== stored.effectiveScopeHash) {
          throw new ContextAgentStoreError("collection_scope_hash_stale");
        }
        const receipt = createContextAgentCollectionReceipt({
          workspaceRef: `workspace:${input.workspaceId}`,
          consentRef: stored.receipt.receiptId,
          memberUserRef: stored.receipt.memberUserRef,
          collectionKind: input.collectionKind,
          consentScopeHash: input.consentScopeHash,
          itemCount: input.itemCount,
          digestHashes: input.digestHashes,
          evidenceRefs: input.evidenceRefs,
          idempotencyKey,
          collectedAt: input.collectedAt.toISOString(),
          recordedAt: now.toISOString(),
        });
        try {
          await tx.contextAgentCollectionReceipt.create({
            data: {
              id: receipt.receiptId,
              workspaceId: input.workspaceId,
              consentReceiptId: stored.receipt.receiptId,
              memberUserId: stored.receipt.memberUserRef,
              collectionKind: receipt.collectionKind,
              consentScopeHash: receipt.consentScopeHash,
              itemCount: receipt.itemCount,
              digestHashes: jsonStringify(receipt.digestHashes),
              evidenceRefs: jsonStringify(receipt.evidenceRefs),
              performanceInputProhibited:
                receipt.performanceInputProhibited,
              idempotencyKey,
              receiptJson: jsonStringify(receipt),
              contentHash: receipt.contentHash,
              collectedAt: input.collectedAt,
              recordedAt: now,
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new ContextAgentStoreError(
              "context_agent_concurrent_conflict",
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
            actionType: "CONTEXT_AGENT_COLLECTION_RECORDED",
            targetType: "ContextAgentCollectionReceipt",
            targetId: receipt.receiptId,
            summary:
              "Context Agent collection batch recorded (evidence refs and digest hashes only; never raw content, never performance input)",
            relatedObjectType: "ContextAgentConsentReceipt",
            relatedObjectId: stored.receipt.receiptId,
            payload: {
              collectionKind: receipt.collectionKind,
              consentScopeHash: receipt.consentScopeHash,
              itemCount: receipt.itemCount,
              performanceInputProhibited:
                receipt.performanceInputProhibited,
              authorityEffect: receipt.authorityEffect,
            },
          },
          { client: tx },
        );
        return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

async function recordPauseTransition(input: {
  workspaceId: string;
  actorUserId: string;
  consentReceiptId: string;
  action: "pause" | "resume";
  reasonCodes: string[];
  idempotencyKey: string;
  now?: Date;
}): Promise<{ receipt: ContextAgentPauseReceipt; replayed: boolean }> {
  const actorUserId = nonEmpty(
    input.actorUserId,
    "signed_in_human_actor_required",
  );
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        const row = await loadConsentRow(tx, input);
        const stored = parseStoredConsent(row);
        if (input.action === "resume") {
          // Resume requires the employee themself; no admin path exists.
          if (stored.receipt.memberUserRef !== actorUserId) {
            throw new ContextAgentStoreError(
              "context_agent_self_resume_required",
            );
          }
          await assertActiveMembershipInTransaction(
            tx,
            { workspaceId: input.workspaceId, userId: actorUserId },
            "resuming_member_active_membership_required",
          );
        } else {
          await assertSelfOrPolicyActor(
            tx,
            {
              workspaceId: input.workspaceId,
              actorUserId,
              memberUserId: stored.receipt.memberUserRef,
            },
            "pausing_member_active_membership_required",
          );
        }
        const existing = await tx.contextAgentPauseReceipt.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          const receipt = safeParseJson<ContextAgentPauseReceipt | null>(
            existing.receiptJson,
            null,
          );
          if (
            !receipt ||
            !validateContextAgentPauseReceipt(receipt).valid ||
            receipt.consentRef !== stored.receipt.receiptId ||
            receipt.action !== input.action ||
            receipt.actorUserRef !== actorUserId
          ) {
            throw new ContextAgentStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          return { receipt, replayed: true };
        }
        const expectedStatus =
          input.action === "pause" ? "ACTIVE" : "PAUSED";
        if (stored.participationStatus !== expectedStatus) {
          throw new ContextAgentStoreError(
            input.action === "pause"
              ? "pause_requires_active_consent"
              : "resume_requires_paused_consent",
          );
        }
        const priorTransitions = await tx.contextAgentPauseReceipt.count({
          where: {
            consentReceiptId: stored.receipt.receiptId,
            workspaceId: input.workspaceId,
          },
        });
        const receipt = createContextAgentPauseReceipt({
          workspaceRef: `workspace:${input.workspaceId}`,
          consentRef: stored.receipt.receiptId,
          memberUserRef: stored.receipt.memberUserRef,
          actorUserRef: actorUserId,
          action: input.action,
          sequence: priorTransitions + 1,
          reasonCodes: input.reasonCodes,
          idempotencyKey,
          recordedAt: now.toISOString(),
        });
        try {
          await tx.contextAgentPauseReceipt.create({
            data: {
              id: receipt.receiptId,
              workspaceId: input.workspaceId,
              consentReceiptId: stored.receipt.receiptId,
              memberUserId: stored.receipt.memberUserRef,
              actorUserId,
              action: receipt.action.toUpperCase(),
              resultingStatus: receipt.resultingStatus.toUpperCase(),
              sequence: receipt.sequence,
              reasonCodes: jsonStringify(receipt.reasonCodes),
              idempotencyKey,
              receiptJson: jsonStringify(receipt),
              contentHash: receipt.contentHash,
              recordedAt: now,
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new ContextAgentStoreError(
              "context_agent_concurrent_conflict",
            );
          }
          throw error;
        }
        await transitionConsentState(tx, {
          workspaceId: input.workspaceId,
          consentReceiptId: stored.receipt.receiptId,
          expectedStatus,
          expectedStateVersion: stored.stateVersion,
          nextStatus: input.action === "pause" ? "PAUSED" : "ACTIVE",
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: actorUserId,
            actor: actorUserId,
            actorType: ActorType.USER,
            actionType:
              input.action === "pause"
                ? "CONTEXT_AGENT_PAUSED"
                : "CONTEXT_AGENT_RESUMED",
            targetType: "ContextAgentPauseReceipt",
            targetId: receipt.receiptId,
            summary:
              input.action === "pause"
                ? "Context Agent collection paused; new collection receipts are blocked immediately"
                : "Employee resumed their Context Agent collection (self-service only)",
            relatedObjectType: "ContextAgentConsentReceipt",
            relatedObjectId: stored.receipt.receiptId,
            payload: {
              action: receipt.action,
              resultingStatus: receipt.resultingStatus,
              reasonCodes: receipt.reasonCodes,
              authorityEffect: receipt.authorityEffect,
            },
          },
          { client: tx },
        );
        return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export async function pauseContextAgentParticipation(input: {
  workspaceId: string;
  actorUserId: string;
  consentReceiptId: string;
  reasonCodes: string[];
  idempotencyKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{ receipt: ContextAgentPauseReceipt; replayed: boolean }> {
  return recordPauseTransition({ ...input, action: "pause" });
}

export async function resumeContextAgentParticipation(input: {
  workspaceId: string;
  actorUserId: string;
  consentReceiptId: string;
  reasonCodes: string[];
  idempotencyKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{ receipt: ContextAgentPauseReceipt; replayed: boolean }> {
  return recordPauseTransition({ ...input, action: "resume" });
}

export async function revokeContextAgentConsent(input: {
  workspaceId: string;
  actorUserId: string;
  consentReceiptId: string;
  reasonCodes: string[];
  evidenceRefs: string[];
  idempotencyKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{ receipt: ContextAgentRevocationReceipt; replayed: boolean }> {
  const actorUserId = nonEmpty(
    input.actorUserId,
    "signed_in_human_actor_required",
  );
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        const row = await loadConsentRow(tx, input);
        const stored = parseStoredConsent(row);
        await assertSelfOrPolicyActor(
          tx,
          {
            workspaceId: input.workspaceId,
            actorUserId,
            memberUserId: stored.receipt.memberUserRef,
          },
          "revoking_member_active_membership_required",
        );
        const existing = await tx.contextAgentRevocationReceipt.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          const receipt =
            safeParseJson<ContextAgentRevocationReceipt | null>(
              existing.receiptJson,
              null,
            );
          if (
            !receipt ||
            !validateContextAgentRevocationReceipt(receipt).valid ||
            receipt.consentRef !== stored.receipt.receiptId ||
            receipt.actorUserRef !== actorUserId
          ) {
            throw new ContextAgentStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          return { receipt, replayed: true };
        }
        if (
          !(LIVE_PARTICIPATION_STATUSES as readonly string[]).includes(
            stored.participationStatus,
          )
        ) {
          throw new ContextAgentStoreError(
            "revocation_requires_live_consent",
          );
        }
        const receipt = createContextAgentRevocationReceipt({
          workspaceRef: `workspace:${input.workspaceId}`,
          consentRef: stored.receipt.receiptId,
          memberUserRef: stored.receipt.memberUserRef,
          actorUserRef: actorUserId,
          consentScopeHash: stored.effectiveScopeHash,
          reasonCodes: input.reasonCodes,
          evidenceRefs: input.evidenceRefs,
          idempotencyKey,
          recordedAt: now.toISOString(),
        });
        try {
          await tx.contextAgentRevocationReceipt.create({
            data: {
              id: receipt.receiptId,
              workspaceId: input.workspaceId,
              consentReceiptId: stored.receipt.receiptId,
              memberUserId: stored.receipt.memberUserRef,
              actorUserId,
              consentScopeHash: receipt.consentScopeHash,
              deletionWorkItemRef: receipt.deletionWorkItemRef,
              reasonCodes: jsonStringify(receipt.reasonCodes),
              evidenceRefs: jsonStringify(receipt.evidenceRefs),
              idempotencyKey,
              receiptJson: jsonStringify(receipt),
              contentHash: receipt.contentHash,
              recordedAt: now,
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            // The per-consent unique key makes revocation terminal: a second
            // revocation of the same consent version cannot exist.
            throw new ContextAgentStoreError(
              "context_agent_concurrent_conflict",
            );
          }
          throw error;
        }
        await transitionConsentState(tx, {
          workspaceId: input.workspaceId,
          consentReceiptId: stored.receipt.receiptId,
          expectedStatus: stored.participationStatus,
          expectedStateVersion: stored.stateVersion,
          nextStatus: "REVOKED",
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: actorUserId,
            actor: actorUserId,
            actorType: ActorType.USER,
            actionType: "CONTEXT_AGENT_CONSENT_REVOKED",
            targetType: "ContextAgentRevocationReceipt",
            targetId: receipt.receiptId,
            summary:
              "Context Agent consent revoked (terminal for this consent version); a deletion work item is now open and must be closed by deletion receipts",
            relatedObjectType: "ContextAgentConsentReceipt",
            relatedObjectId: stored.receipt.receiptId,
            payload: {
              consentScopeHash: receipt.consentScopeHash,
              deletionWorkItemRef: receipt.deletionWorkItemRef,
              reasonCodes: receipt.reasonCodes,
              authorityEffect: receipt.authorityEffect,
            },
          },
          { client: tx },
        );
        return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export async function recordContextAgentDeletionOutcome(input: {
  workspaceId: string;
  actorUserId: string;
  revocationReceiptId: string;
  outcome: ContextAgentDeletionOutcome;
  counts: ContextAgentDeletionCounts;
  failureCodes: string[];
  evidenceRefs: string[];
  idempotencyKey: string;
  now?: Date;
  english?: boolean;
}): Promise<{ receipt: ContextAgentDeletionReceipt; replayed: boolean }> {
  await assertPolicyAccess(input);
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        await assertPolicyAccessInTransaction(tx, input);
        const revocationRow =
          await tx.contextAgentRevocationReceipt.findFirst({
            where: {
              id: input.revocationReceiptId,
              workspaceId: input.workspaceId,
            },
          });
        if (!revocationRow) {
          throw new ContextAgentStoreError("revocation_not_found");
        }
        const revocation =
          safeParseJson<ContextAgentRevocationReceipt | null>(
            revocationRow.receiptJson,
            null,
          );
        if (
          !revocation ||
          !validateContextAgentRevocationReceipt(revocation).valid ||
          revocation.receiptId !== revocationRow.id ||
          revocation.deletionWorkItemRef !==
            revocationRow.deletionWorkItemRef
        ) {
          throw new ContextAgentStoreError(
            "stored_revocation_binding_invalid",
          );
        }
        const existing = await tx.contextAgentDeletionReceipt.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          const receipt =
            safeParseJson<ContextAgentDeletionReceipt | null>(
              existing.receiptJson,
              null,
            );
          if (
            !receipt ||
            !validateContextAgentDeletionReceipt(receipt).valid ||
            receipt.revocationRef !== revocation.receiptId ||
            receipt.outcome !== input.outcome
          ) {
            throw new ContextAgentStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          return { receipt, replayed: true };
        }
        const priorAttempts = await tx.contextAgentDeletionReceipt.findMany({
          where: {
            revocationReceiptId: revocation.receiptId,
            workspaceId: input.workspaceId,
          },
          select: { outcome: true },
        });
        if (
          priorAttempts.some((attempt) => attempt.outcome === "SUCCESS")
        ) {
          throw new ContextAgentStoreError("deletion_already_succeeded");
        }
        const receipt = createContextAgentDeletionReceipt({
          workspaceRef: `workspace:${input.workspaceId}`,
          revocationRef: revocation.receiptId,
          consentRef: revocation.consentRef,
          memberUserRef: revocation.memberUserRef,
          actorUserRef: input.actorUserId,
          deletionWorkItemRef: revocation.deletionWorkItemRef,
          attempt: priorAttempts.length + 1,
          outcome: input.outcome,
          counts: input.counts,
          failureCodes: input.failureCodes,
          evidenceRefs: input.evidenceRefs,
          idempotencyKey,
          recordedAt: now.toISOString(),
        });
        try {
          await tx.contextAgentDeletionReceipt.create({
            data: {
              id: receipt.receiptId,
              workspaceId: input.workspaceId,
              revocationReceiptId: revocation.receiptId,
              consentReceiptId: revocation.consentRef,
              memberUserId: revocation.memberUserRef,
              actorUserId: input.actorUserId,
              deletionWorkItemRef: receipt.deletionWorkItemRef,
              attempt: receipt.attempt,
              outcome: receipt.outcome.toUpperCase(),
              indicesDeleted: receipt.counts.indicesDeleted,
              cachesDeleted: receipt.counts.cachesDeleted,
              derivedVectorsDeleted: receipt.counts.derivedVectorsDeleted,
              memoryCandidatesDeleted:
                receipt.counts.memoryCandidatesDeleted,
              observedFactsDeleted: receipt.counts.observedFactsDeleted,
              observedFactsEvidenceInvalidated:
                receipt.counts.observedFactsEvidenceInvalidated,
              multiSourceRecomputed: receipt.counts.multiSourceRecomputed,
              failureCodes: jsonStringify(receipt.failureCodes),
              evidenceRefs: jsonStringify(receipt.evidenceRefs),
              idempotencyKey,
              receiptJson: jsonStringify(receipt),
              contentHash: receipt.contentHash,
              recordedAt: now,
            },
          });
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new ContextAgentStoreError(
              "context_agent_concurrent_conflict",
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
            actionType: "CONTEXT_AGENT_DELETION_OUTCOME_RECORDED",
            targetType: "ContextAgentDeletionReceipt",
            targetId: receipt.receiptId,
            summary:
              "Context Agent deletion attempt outcome recorded with structured counts (record of a reviewed deletion, not an executor)",
            relatedObjectType: "ContextAgentRevocationReceipt",
            relatedObjectId: revocation.receiptId,
            payload: {
              outcome: receipt.outcome,
              attempt: receipt.attempt,
              counts: receipt.counts,
              failureCodes: receipt.failureCodes,
              authorityEffect: receipt.authorityEffect,
            },
          },
          { client: tx },
        );
        return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export type ContextAgentParticipationStatusView = {
  participating: boolean;
  participationStatus:
    | "not_participating"
    | "active"
    | "paused"
    | "revoked";
  consentReceipt: ContextAgentConsentReceipt | null;
  effectiveScopeHash: string | null;
  openDeletionWorkItemRef: string | null;
};

// Read projection for the member themself or a policy admin. Invalid stored
// evidence fails closed as an error instead of degrading to participation.
export async function getContextAgentParticipationStatus(input: {
  workspaceId: string;
  actorUserId: string;
  memberUserId: string;
  english?: boolean;
}): Promise<ContextAgentParticipationStatusView> {
  const actorUserId = nonEmpty(
    input.actorUserId,
    "signed_in_human_actor_required",
  );
  if (actorUserId !== input.memberUserId) {
    await assertPolicyAccess(input);
  }
  return db.$transaction(async (tx) => {
    if (actorUserId === input.memberUserId) {
      const membership = await tx.membership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: input.workspaceId,
            userId: actorUserId,
          },
        },
        select: { status: true },
      });
      if (!membership || membership.status !== MembershipStatus.ACTIVE) {
        throw new ContextAgentStoreError(
          "member_active_membership_required",
        );
      }
    }
    const liveRow = await findLiveConsentRow(tx, input);
    if (liveRow) {
      const stored = parseStoredConsent(liveRow);
      return {
        participating: stored.participationStatus === "ACTIVE",
        participationStatus:
          stored.participationStatus === "ACTIVE" ? "active" : "paused",
        consentReceipt: stored.receipt,
        effectiveScopeHash: stored.effectiveScopeHash,
        openDeletionWorkItemRef: null,
      } satisfies ContextAgentParticipationStatusView;
    }
    const revokedRow = await tx.contextAgentConsentReceipt.findFirst({
      where: {
        workspaceId: input.workspaceId,
        memberUserId: input.memberUserId,
        participationStatus: "REVOKED",
      },
      orderBy: { consentVersion: "desc" },
    });
    if (!revokedRow) {
      return {
        participating: false,
        participationStatus: "not_participating",
        consentReceipt: null,
        effectiveScopeHash: null,
        openDeletionWorkItemRef: null,
      } satisfies ContextAgentParticipationStatusView;
    }
    const stored = parseStoredConsent(revokedRow);
    const revocationRow = await tx.contextAgentRevocationReceipt.findFirst({
      where: {
        consentReceiptId: revokedRow.id,
        workspaceId: input.workspaceId,
      },
      select: { id: true, deletionWorkItemRef: true },
    });
    const successCount = revocationRow
      ? await tx.contextAgentDeletionReceipt.count({
          where: {
            revocationReceiptId: revocationRow.id,
            workspaceId: input.workspaceId,
            outcome: "SUCCESS",
          },
        })
      : 0;
    return {
      participating: false,
      participationStatus: "revoked",
      consentReceipt: stored.receipt,
      effectiveScopeHash: stored.effectiveScopeHash,
      openDeletionWorkItemRef:
        revocationRow && successCount === 0
          ? revocationRow.deletionWorkItemRef
          : null,
    } satisfies ContextAgentParticipationStatusView;
  }, TRANSACTION_OPTIONS);
}
