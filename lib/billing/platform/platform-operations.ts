import "server-only";
import { createHash } from "node:crypto";
import { ActorType, Prisma, type PlatformBillingOperation, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { findPlatformFinanceActorInTransaction, type PlatformFinanceRoleName } from "../bank-receipts/bank-receipts";

/**
 * Billing V1 E1a platform billing operations: a platform finance maker drafts, a different checker approves or rejects; approval
 * applies the change in the same transaction. Authority is the S2-c `PlatformFinanceGrant` (reserved-workspace member); customer
 * OWNER/BILLING_ADMIN and service identities have no path. Evidence is an owner-ruling reference, not a customer action.
 * Lock order: finance grant + reserved Membership (share) -> PayerAccount FOR UPDATE -> PlatformBillingOperation FOR UPDATE ->
 * PayerScopeBinding (share). Switching to `enforce` is not enablement: real charging has separate prerequisites (docs).
 */
export type PlatformBillingMode = "off" | "shadow" | "enforce";
export type PlatformOperationRequest =
  | { kind: "payer_onboard"; workspaceId: string; contractSubjectRef: string }
  | { kind: "billing_mode"; workspaceId: string; fromMode: PlatformBillingMode; toMode: PlatformBillingMode };
export type PlatformOperationRefusalCode = "platform_operation_input_invalid" | "platform_operation_forbidden" |
  "platform_operation_self_review_forbidden" | "platform_operation_conflict" | "platform_operation_unavailable" |
  "platform_operation_not_pending" | "platform_enforce_not_confirmed" | "platform_write_conflict" | "billing_mode_conflict" |
  "workspace_unavailable" | "payer_scope_already_bound" | "payer_unresolved";

export class PlatformOperationRefusal extends Error {
  constructor(readonly code: PlatformOperationRefusalCode) { super(code); this.name = "PlatformOperationRefusal"; }
}

const SOURCE_PAGE = "/billing/platform-operations";
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
const MODES: readonly PlatformBillingMode[] = ["off", "shadow", "enforce"];
function refuse(code: PlatformOperationRefusalCode): never { throw new PlatformOperationRefusal(code); }
function reference(value: unknown, code: PlatformOperationRefusalCode = "platform_operation_input_invalid"): asserts value is string {
  if (typeof value !== "string" || !REF.test(value)) refuse(code);
}
const sha256 = (value: object) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/**
 * Pure validation. The operation key is derived from (evidence, kind, workspace, mode step), so a re-run of the same ruling finds the
 * same row; the content hash also covers the remaining fields, so the same key with other content conflicts.
 */
export function normalizePlatformOperation(evidenceRef: unknown, request: PlatformOperationRequest) {
  reference(evidenceRef);
  if (!request || typeof request !== "object") refuse("platform_operation_input_invalid");
  reference(request.workspaceId);
  let canonical: PlatformOperationRequest;
  if (request.kind === "payer_onboard") {
    reference(request.contractSubjectRef);
    canonical = { kind: request.kind, workspaceId: request.workspaceId, contractSubjectRef: request.contractSubjectRef };
  } else if (request.kind === "billing_mode") {
    if (!MODES.includes(request.fromMode) || !MODES.includes(request.toMode) || request.fromMode === request.toMode) {
      refuse("platform_operation_input_invalid");
    }
    canonical = { kind: request.kind, workspaceId: request.workspaceId, fromMode: request.fromMode, toMode: request.toMode };
  } else refuse("platform_operation_input_invalid");
  const identity = { v: 1, evidenceRef, kind: canonical.kind, workspaceId: canonical.workspaceId,
    step: canonical.kind === "billing_mode" ? `${canonical.fromMode}>${canonical.toMode}` : null };
  return { evidenceRef, request: canonical, operationKey: `pbo:${canonical.kind}:${sha256(identity).slice(0, 40)}`,
    contentHash: sha256({ v: 1, evidenceRef, ...canonical }) };
}
const isEnforce = (request: PlatformOperationRequest) => request.kind === "billing_mode" && request.toMode === "enforce";

function run<T>(client: PrismaClient, body: (tx: Prisma.TransactionClient) => Promise<T>) {
  // No automatic retry: a conflicting writer re-reads and decides again (a re-run replays what already committed).
  return client.$transaction(body, { maxWait: 5000, timeout: 10000 }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
      refuse("platform_write_conflict");
    }
    throw error;
  });
}
async function financeActor(tx: Prisma.TransactionClient, userId: string, role: PlatformFinanceRoleName) {
  const workspaceId = await findPlatformFinanceActorInTransaction(tx, userId, [role]);
  if (!workspaceId) refuse("platform_operation_forbidden");
  return workspaceId;
}
/** Target must be an ACTIVE customer workspace (byte-exact id); the reserved platform workspace is never a payer scope. */
async function assertTargetWorkspace(tx: Prisma.TransactionClient, workspaceId: string) {
  const [row] = await tx.$queryRaw<Array<{ status: string; workspaceClass: string }>>`SELECT status, workspaceClass FROM Workspace
    WHERE id = ${workspaceId} AND CAST(id AS BINARY) = CAST(${workspaceId} AS BINARY) FOR SHARE`;
  if (!row || row.status !== "ACTIVE" || row.workspaceClass === "HELM_RESERVED") refuse("workspace_unavailable");
}
async function activeBinding(tx: Prisma.TransactionClient, workspaceId: string) {
  const [row] = await tx.$queryRaw<Array<{ id: string; payerAccountId: string; billingMode: PlatformBillingMode }>>`
    SELECT b.id, b.payerAccountId, a.billingMode FROM PayerScopeBinding b JOIN PayerAccount a ON a.id = b.payerAccountId
    WHERE b.scopeKind = 'workspace' AND b.state = 'active' AND b.activeScopeRef = ${workspaceId} FOR SHARE OF b`;
  return row ?? null;
}
const lockOperation = async (tx: Prisma.TransactionClient, operationKey: string) => (await tx.$queryRaw<PlatformBillingOperation[]>`
  SELECT * FROM PlatformBillingOperation WHERE operationKey = ${operationKey} FOR UPDATE`)[0] ?? null;
async function audit(tx: Prisma.TransactionClient, workspaceIds: string[], actorUserId: string, actionType: string,
  target: { type: string; id: string }, payload: Record<string, unknown>) {
  for (const workspaceId of new Set(workspaceIds)) {
    await writeAuditLog({ workspaceId, userId: actorUserId, actor: actorUserId, actorType: ActorType.USER, actionType,
      targetType: target.type, targetId: target.id, summary: actionType.toLowerCase().replaceAll("_", " "), sourcePage: SOURCE_PAGE,
      payload }, { client: tx });
  }
}

export type DraftPlatformOperationInput = { actorUserId: string; evidenceRef: string; request: PlatformOperationRequest;
  /** Required (true) when the request switches to enforce. */ confirmEnforce?: boolean; batchRef?: string | null };

/** Maker step: records a `drafted` operation; nothing changes until a different checker approves it. Same key + content replays. */
export async function draftPlatformOperation(client: PrismaClient, input: DraftPlatformOperationInput) {
  reference(input?.actorUserId, "platform_operation_forbidden");
  if (input.batchRef != null) reference(input.batchRef);
  const op = normalizePlatformOperation(input.evidenceRef, input.request);
  if (isEnforce(op.request) && input.confirmEnforce !== true) refuse("platform_enforce_not_confirmed");
  return run(client, async tx => {
    const reservedWorkspaceId = await financeActor(tx, input.actorUserId, "maker");
    const existing = await lockOperation(tx, op.operationKey);
    if (existing) {
      if (existing.contentHash !== op.contentHash) refuse("platform_operation_conflict");
      return { operation: existing, replayed: true };
    }
    const { request } = op;
    await assertTargetWorkspace(tx, request.workspaceId);
    const binding = await activeBinding(tx, request.workspaceId);
    if (request.kind === "payer_onboard" && binding) refuse("payer_scope_already_bound");
    if (request.kind === "billing_mode") {
      if (!binding) refuse("payer_unresolved");
      if (binding.billingMode !== request.fromMode) refuse("billing_mode_conflict");
    }
    const operation = await tx.platformBillingOperation.create({ data: { kind: request.kind, operationKey: op.operationKey,
      workspaceId: request.workspaceId, payerAccountId: request.kind === "billing_mode" ? binding!.payerAccountId : null,
      request, contentHash: op.contentHash, draftedByUserId: input.actorUserId, evidenceRef: op.evidenceRef } });
    await audit(tx, [reservedWorkspaceId, request.workspaceId], input.actorUserId, "BILLING_PLATFORM_OPERATION_DRAFTED",
      { type: "PlatformBillingOperation", id: operation.id }, { ...request, evidenceRef: op.evidenceRef, batchRef: input.batchRef ?? null });
    return { operation, replayed: false };
  });
}

export type ReviewPlatformOperationInput = { actorUserId: string; evidenceRef: string; request: PlatformOperationRequest;
  decision: "approve" | "reject"; reviewEvidenceRef: string; confirmEnforce?: boolean; batchRef?: string | null };

/**
 * Checker step. The checker restates the request (from the same list); it must hash to the drafted content. Approve applies it in
 * this transaction: onboard creates an `enterprise_contract` payer (billingMode off) governed by the workspace plus its active
 * binding; billing_mode is a CAS on the expected old mode. The same checker repeating the same decision replays.
 */
export async function reviewPlatformOperation(client: PrismaClient, input: ReviewPlatformOperationInput) {
  reference(input?.actorUserId, "platform_operation_forbidden"); reference(input.reviewEvidenceRef);
  if (input.batchRef != null) reference(input.batchRef);
  if (input.decision !== "approve" && input.decision !== "reject") refuse("platform_operation_input_invalid");
  const op = normalizePlatformOperation(input.evidenceRef, input.request);
  const approve = input.decision === "approve";
  if (approve && isEnforce(op.request) && input.confirmEnforce !== true) refuse("platform_enforce_not_confirmed");
  return run(client, async tx => {
    const reservedWorkspaceId = await financeActor(tx, input.actorUserId, "checker");
    const head = await tx.platformBillingOperation.findUnique({ where: { operationKey: op.operationKey }, select: { payerAccountId: true } });
    if (!head) refuse("platform_operation_unavailable");
    if (head.payerAccountId) await tx.$queryRaw`SELECT id FROM PayerAccount WHERE id = ${head.payerAccountId} FOR UPDATE`;
    const row = await lockOperation(tx, op.operationKey);
    if (!row) refuse("platform_operation_unavailable");
    if (row.contentHash !== op.contentHash) refuse("platform_operation_conflict");
    if (row.state === (approve ? "applied" : "rejected") && row.reviewedByUserId === input.actorUserId) {
      return { operation: row, replayed: true };
    }
    if (row.state !== "drafted") refuse("platform_operation_not_pending");
    if (row.draftedByUserId === input.actorUserId) refuse("platform_operation_self_review_forbidden");
    const resultRef = approve ? await applyInTransaction(tx, op.request, row, input.actorUserId) : null;
    const decided = await tx.$executeRaw`UPDATE PlatformBillingOperation SET state = ${approve ? "applied" : "rejected"},
      reviewedByUserId = ${input.actorUserId}, reviewEvidenceRef = ${input.reviewEvidenceRef}, reviewedAt = UTC_TIMESTAMP(3),
      resultRef = ${resultRef}, version = version + 1, updatedAt = UTC_TIMESTAMP(3)
      WHERE id = ${row.id} AND state = 'drafted' AND version = ${row.version}
        AND CAST(draftedByUserId AS BINARY) <> CAST(${input.actorUserId} AS BINARY)`;
    if (decided !== 1) refuse("platform_write_conflict");
    await audit(tx, [reservedWorkspaceId, row.workspaceId], input.actorUserId,
      approve ? "BILLING_PLATFORM_OPERATION_APPLIED" : "BILLING_PLATFORM_OPERATION_REJECTED",
      { type: "PlatformBillingOperation", id: row.id }, { ...op.request, resultRef, evidenceRef: row.evidenceRef,
        reviewEvidenceRef: input.reviewEvidenceRef, batchRef: input.batchRef ?? null });
    return { operation: await tx.platformBillingOperation.findUniqueOrThrow({ where: { id: row.id } }), replayed: false };
  });
}

async function applyInTransaction(tx: Prisma.TransactionClient, request: PlatformOperationRequest, row: PlatformBillingOperation,
  actorUserId: string) {
  await assertTargetWorkspace(tx, request.workspaceId);
  const binding = await activeBinding(tx, request.workspaceId);
  if (request.kind === "payer_onboard") {
    if (binding) refuse("payer_scope_already_bound");
    const payer = await tx.payerAccount.create({ data: { kind: "enterprise_contract", governingWorkspaceId: request.workspaceId,
      contractSubjectRef: request.contractSubjectRef, currency: "CNY" } });
    const bound = await tx.payerScopeBinding.create({ data: { payerAccountId: payer.id, scopeKind: "workspace",
      scopeRef: request.workspaceId, activeScopeRef: request.workspaceId, authorizedByUserId: actorUserId, evidenceRef: row.evidenceRef } });
    await tx.$executeRaw`UPDATE PayerAccount SET version = version + 1, updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ${payer.id}`;
    await audit(tx, [request.workspaceId], actorUserId, "BILLING_PAYER_SCOPE_BOUND", { type: "PayerScopeBinding", id: bound.id },
      { payerAccountId: payer.id, billingMode: payer.billingMode, platformOperationId: row.id, evidenceRef: row.evidenceRef });
    return payer.id;
  }
  if (!binding || binding.payerAccountId !== row.payerAccountId) refuse("payer_unresolved");
  // CAS: the expected old mode stays in the UPDATE's own WHERE (the payer row is already locked FOR UPDATE above).
  const changed = await tx.$executeRaw`UPDATE PayerAccount SET billingMode = ${request.toMode}, version = version + 1,
    updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ${binding.payerAccountId} AND billingMode = ${request.fromMode} AND status = 'active'`;
  if (changed !== 1) refuse("billing_mode_conflict");
  await audit(tx, [request.workspaceId], actorUserId, "BILLING_PAYER_MODE_CHANGED", { type: "PayerAccount", id: binding.payerAccountId },
    { from: request.fromMode, to: request.toMode, platformOperationId: row.id, evidenceRef: row.evidenceRef });
  return binding.payerAccountId;
}
