import "server-only";
import { ActorType, Prisma, type PrismaClient, type WorkspaceRole } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { canManageWorkspaceBilling } from "@/lib/auth/billing-governance";

/**
 * Billing V1 S1-c payer identity. No balance, charge, payment or provider call happens here; every account starts
 * with billingMode "off". The caller never supplies a payer id at use time: it is resolved from the workspace.
 */
export type PayerSnapshot = {
  payerAccountId: string; bindingId: string; bindingVersion: number;
  scopeKind: "workspace"; scopeRef: string; billingMode: "off" | "shadow" | "enforce"; currency: "CNY";
};
export type CreatePayerAccountInput = {
  actorUserId: string; workspaceId: string; kind: "consumer" | "enterprise_contract";
  contractSubjectRef: string; collectionSubjectRef?: string | null; currency?: string;
};
export type BindScopeInput = {
  actorUserId: string; payerAccountId: string; expectedPayerVersion: number;
  scopeKind: "workspace" | "consumer_principal"; scopeRef: string; evidenceRef: string;
};
export type RevokeBindingInput = { actorUserId: string; bindingId: string; expectedVersion: number; evidenceRef: string };

const SOURCE_PAGE = "/billing/payer";
function fail(code: string): never { throw new Error(code); }
function reference(value: unknown, code: string): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/.test(value)) fail(code);
}
function version(value: unknown, code: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) fail(code);
}

/**
 * Locks the actor's own Membership rows (FOR UPDATE OF m: not the shared Workspace rows) in sorted order and refuses
 * unless every one is ACTIVE, unscoped, in an ACTIVE workspace and passes `allowed`. Payer creation uses the billing
 * capability (OWNER/BILLING_ADMIN); binding and revocation commit or withdraw money authority and require OWNER (S0 §7).
 * Lock order for this module: Membership -> PayerAccount -> PayerScopeBinding.
 */
export const ownerOnly = (role: WorkspaceRole) => role === "OWNER";
/** `allowed` is required: every caller names its role rule (ownerOnly or canManageWorkspaceBilling) explicitly. */
export async function lockBillingAuthority(tx: Prisma.TransactionClient, actorUserId: string, workspaceIds: string[],
  allowed: (role: WorkspaceRole) => boolean) {
  const ids = [...new Set(workspaceIds)].sort();
  const rows = await tx.$queryRaw<Array<{ workspaceId: string; userId: string; role: WorkspaceRole;
    status: string; accessScope: string | null; workspaceStatus: string }>>`
    SELECT m.workspaceId, m.userId, m.role, m.status, m.accessScope, w.status AS workspaceStatus
    FROM Workspace w JOIN Membership m ON m.workspaceId = w.id
    WHERE m.userId = ${actorUserId} AND w.id IN (${Prisma.join(ids)})
      AND CAST(m.userId AS BINARY) = CAST(${actorUserId} AS BINARY)
    ORDER BY m.workspaceId FOR UPDATE OF m`;
  for (const id of ids) {
    const member = rows.find(row => row.workspaceId === id && row.userId === actorUserId);
    if (!member || member.status !== "ACTIVE" || member.workspaceStatus !== "ACTIVE" ||
        (member.accessScope !== null && member.accessScope !== "") || !allowed(member.role)) {
      fail("payer_binding_forbidden");
    }
  }
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
function transaction<T>(client: PrismaClient, run: (tx: Prisma.TransactionClient) => Promise<T>) {
  // No automatic retry: a conflicting writer must re-read the current version and decide again.
  return client.$transaction(run, { maxWait: 5000, timeout: 10000 }).catch((error: unknown) => {
    if (isUniqueViolation(error)) fail("payer_scope_already_bound");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") fail("payer_write_conflict");
    throw error;
  });
}

export async function createPayerAccount(client: PrismaClient, input: CreatePayerAccountInput) {
  reference(input.actorUserId, "payer_binding_forbidden");
  reference(input.workspaceId, "payer_workspace_invalid");
  // Consumer payers need a trusted consumer-service identity (later slice); fail closed until it exists.
  if (input.kind === "consumer") fail("payer_kind_not_enabled");
  if (input.kind !== "enterprise_contract") fail("payer_kind_invalid");
  reference(input.contractSubjectRef, "payer_contract_subject_invalid");
  if (input.collectionSubjectRef != null) reference(input.collectionSubjectRef, "payer_collection_subject_invalid");
  if ((input.currency ?? "CNY") !== "CNY") fail("payer_currency_not_supported");
  return transaction(client, async tx => {
    await lockBillingAuthority(tx, input.actorUserId, [input.workspaceId], canManageWorkspaceBilling);
    const account = await tx.payerAccount.create({ data: {
      kind: "enterprise_contract", governingWorkspaceId: input.workspaceId, contractSubjectRef: input.contractSubjectRef,
      collectionSubjectRef: input.collectionSubjectRef ?? null, currency: "CNY",
    } });
    await writeAuditLog({ workspaceId: input.workspaceId, userId: input.actorUserId, actor: input.actorUserId,
      actorType: ActorType.USER, actionType: "BILLING_PAYER_ACCOUNT_CREATED", targetType: "PayerAccount",
      targetId: account.id, summary: "Created payer account (billingMode off)", sourcePage: SOURCE_PAGE,
      payload: { kind: account.kind, billingMode: account.billingMode, version: account.version } }, { client: tx });
    return account;
  });
}

/** Explicit binding: the actor must be OWNER of both the payer's governing workspace and the target (BILLING_ADMIN refused). */
export async function bindScope(client: PrismaClient, input: BindScopeInput) {
  reference(input.actorUserId, "payer_binding_forbidden");
  reference(input.payerAccountId, "payer_account_unavailable");
  version(input.expectedPayerVersion, "payer_version_invalid");
  if (input.scopeKind === "consumer_principal") fail("payer_scope_kind_not_enabled");
  if (input.scopeKind !== "workspace") fail("payer_scope_kind_invalid");
  reference(input.scopeRef, "payer_workspace_invalid");
  reference(input.evidenceRef, "payer_evidence_invalid");
  return transaction(client, async tx => {
    const governing = await tx.payerAccount.findUnique({ where: { id: input.payerAccountId },
      select: { id: true, governingWorkspaceId: true } });
    if (!governing || governing.id !== input.payerAccountId || !governing.governingWorkspaceId) fail("payer_account_unavailable");
    await lockBillingAuthority(tx, input.actorUserId, [governing.governingWorkspaceId, input.scopeRef], ownerOnly);
    const [payer] = await tx.$queryRaw<Array<{ id: string; kind: string; status: string; version: number;
      governingWorkspaceId: string | null }>>`
      SELECT id, kind, status, version, governingWorkspaceId FROM PayerAccount
      WHERE id = ${input.payerAccountId} FOR UPDATE`;
    if (!payer || payer.id !== input.payerAccountId || payer.status !== "active" || payer.kind !== "enterprise_contract" ||
        payer.governingWorkspaceId !== governing.governingWorkspaceId) fail("payer_account_unavailable");
    if (Number(payer.version) !== input.expectedPayerVersion) fail("payer_version_conflict");
    const existing = await tx.payerScopeBinding.findFirst({ where: { scopeKind: "workspace", activeScopeRef: input.scopeRef } });
    if (existing) fail("payer_scope_already_bound");
    // Atomic compare-and-swap: the pre-state stays in the UPDATE's own WHERE (Prisma updateMany drops it on MySQL).
    const bumped = await tx.$executeRaw`UPDATE PayerAccount SET version = version + 1, updatedAt = CURRENT_TIMESTAMP(3)
      WHERE id = ${payer.id} AND version = ${input.expectedPayerVersion}`;
    if (bumped !== 1) fail("payer_version_conflict");
    const binding = await tx.payerScopeBinding.create({ data: {
      payerAccountId: payer.id, scopeKind: "workspace", scopeRef: input.scopeRef, activeScopeRef: input.scopeRef,
      authorizedByUserId: input.actorUserId, evidenceRef: input.evidenceRef,
    } });
    const audit = { userId: input.actorUserId, actor: input.actorUserId, actorType: ActorType.USER,
      actionType: "BILLING_PAYER_SCOPE_BOUND", targetType: "PayerScopeBinding", targetId: binding.id,
      summary: "Bound workspace to payer account", sourcePage: SOURCE_PAGE, relatedObjectType: "PayerAccount",
      relatedObjectId: payer.id, payload: { scopeKind: binding.scopeKind, bindingVersion: binding.version,
        payerVersion: input.expectedPayerVersion + 1, evidenceRef: binding.evidenceRef } };
    for (const workspaceId of new Set([input.scopeRef, governing.governingWorkspaceId])) {
      await writeAuditLog({ ...audit, workspaceId }, { client: tx });
    }
    return binding;
  });
}

/** Revocation retains the row (payer history); only the active key is released, so the scope can be rebound. */
export async function revokeBinding(client: PrismaClient, input: RevokeBindingInput) {
  reference(input.actorUserId, "payer_binding_forbidden");
  reference(input.bindingId, "payer_binding_unavailable");
  version(input.expectedVersion, "payer_version_invalid");
  reference(input.evidenceRef, "payer_evidence_invalid");
  return transaction(client, async tx => {
    const binding = await tx.payerScopeBinding.findUnique({ where: { id: input.bindingId } });
    if (!binding || binding.id !== input.bindingId || binding.scopeKind !== "workspace") fail("payer_binding_unavailable");
    // OWNER of either side may withdraw: the payer's governing OWNER stops paying; the bound workspace's OWNER
    // declines this payer for its own workspace. BILLING_ADMIN is refused on both sides.
    const payer = await tx.payerAccount.findUnique({ where: { id: binding.payerAccountId }, select: { governingWorkspaceId: true } });
    const authorityCandidates = [binding.scopeRef, payer?.governingWorkspaceId].filter((id): id is string => !!id);
    let authorized: string | null = null;
    for (const workspaceId of authorityCandidates) {
      try { await lockBillingAuthority(tx, input.actorUserId, [workspaceId], ownerOnly); authorized = workspaceId; break; }
      catch (error) { if (!(error instanceof Error) || error.message !== "payer_binding_forbidden") throw error; }
    }
    if (!authorized) fail("payer_binding_forbidden");
    if (binding.state !== "active") fail("payer_binding_not_active");
    const revoked = await tx.$executeRaw`UPDATE PayerScopeBinding SET state = 'revoked', activeScopeRef = NULL,
      revokedAt = CURRENT_TIMESTAMP(3), revokedByUserId = ${input.actorUserId}, version = version + 1,
      updatedAt = CURRENT_TIMESTAMP(3)
      WHERE id = ${binding.id} AND version = ${input.expectedVersion} AND state = 'active'`;
    if (revoked !== 1) fail("payer_version_conflict");
    const row = await tx.payerScopeBinding.findUniqueOrThrow({ where: { id: binding.id } });
    for (const workspaceId of new Set(authorityCandidates)) {
      await writeAuditLog({ workspaceId, userId: input.actorUserId, actor: input.actorUserId,
        actorType: ActorType.USER, actionType: "BILLING_PAYER_SCOPE_REVOKED", targetType: "PayerScopeBinding",
        targetId: row.id, summary: "Revoked workspace payer binding", sourcePage: SOURCE_PAGE,
        relatedObjectType: "PayerAccount", relatedObjectId: row.payerAccountId,
        payload: { bindingVersion: row.version, authorizedVia: authorized === binding.scopeRef ? "scope" : "payer",
          evidenceRef: input.evidenceRef } }, { client: tx });
    }
    return row;
  });
}

/**
 * Resolves the payer for a workspace inside the caller's transaction and share-locks only the binding row
 * (FOR SHARE OF b), so a concurrent revoke waits for the caller to commit. PayerAccount is read, not locked.
 * Lock order for money paths (S2/S3): lock PayerAccount FOR UPDATE first, then call this resolver, then any budget or
 * reservation rows. A caller that does not yet know the payer id may resolve once to learn it, lock PayerAccount
 * FOR UPDATE, then resolve again and refuse unless both snapshots match.
 * Store the returned snapshot with the operation: history keeps the payerAccountId/bindingId/bindingVersion it ran
 * under even after a later revoke or rebind. Fails closed.
 */
export async function resolvePayerForWorkspaceInTransaction(tx: Prisma.TransactionClient, workspaceId: string): Promise<PayerSnapshot> {
  reference(workspaceId, "payer_unresolved");
  const rows = await tx.$queryRaw<Array<{ bindingId: string; bindingVersion: number; scopeRef: string;
    payerAccountId: string; status: string; billingMode: PayerSnapshot["billingMode"]; currency: string }>>`
    SELECT b.id AS bindingId, b.version AS bindingVersion, b.scopeRef, a.id AS payerAccountId, a.status,
      a.billingMode, a.currency
    FROM PayerScopeBinding b JOIN PayerAccount a ON a.id = b.payerAccountId
    WHERE b.scopeKind = 'workspace' AND b.state = 'active' AND b.activeScopeRef = ${workspaceId}
    FOR SHARE OF b`;
  if (rows.length !== 1 || rows[0].scopeRef !== workspaceId) fail("payer_unresolved");
  const [row] = rows;
  if (row.status !== "active" || row.currency !== "CNY") fail("payer_account_unavailable");
  return { payerAccountId: row.payerAccountId, bindingId: row.bindingId, bindingVersion: Number(row.bindingVersion),
    scopeKind: "workspace", scopeRef: row.scopeRef, billingMode: row.billingMode, currency: "CNY" };
}
