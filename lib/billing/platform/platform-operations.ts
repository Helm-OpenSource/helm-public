import "server-only";
import { createHash } from "node:crypto";
import { ActorType, Prisma, type PlatformBillingOperation, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { findPlatformFinanceActorInTransaction, type PlatformFinanceRoleName } from "../bank-receipts/bank-receipts";
import { availableCreditFen } from "../credit/credit-facilities";
import { changeSpendGrantInTransaction, createSpendGrantInTransaction, normalizePriceVersion,
  publishPriceVersionInTransaction } from "../grants/price-grants";

/**
 * Billing V1 E1a platform billing operations: a platform finance maker drafts, a different checker approves or rejects; approval
 * applies the change in the same transaction. Authority is the S2-c `PlatformFinanceGrant` (reserved-workspace member); customer
 * OWNER/BILLING_ADMIN and service identities have no path. Evidence is an owner-ruling reference, not a customer action.
 * Lock order: finance grant + reserved Membership (share) -> PayerAccount FOR UPDATE -> PlatformBillingOperation FOR UPDATE ->
 * PayerScopeBinding (share). Switching to `enforce` is not enablement: real charging has separate prerequisites (docs).
 * E1b adds `price_publish` (append a price version; never 0) and `spend_grant` (create -> set_limits -> activate on approval).
 */
export type PlatformBillingMode = "off" | "shadow" | "enforce";
export type PlatformOperationRequest =
  | { kind: "payer_onboard"; workspaceId: string; contractSubjectRef: string }
  | { kind: "billing_mode"; workspaceId: string; fromMode: PlatformBillingMode; toMode: PlatformBillingMode }
  /** Amounts are decimal strings (JSON has no BigInt), times ISO-8601 UTC. `priceLabel` is part of the reviewed content. */
  | { kind: "price_publish"; productCode: string; version: number; billingEventRef: string; meterUnit: string; acceptanceRef: string;
      unitPriceFenNumerator: string; unitPriceDenominator: string; effectiveFrom: string; effectiveUntil: string | null;
      approvalRef: string; priceLabel: PriceLabel }
  | { kind: "spend_grant"; workspaceId: string; productCode: string; priceVersion: number; validFrom: string; validUntil: string;
      perChargeLimitFen: string; dailyLimitFen: string; monthlyLimitFen: string };
/** Closed set. The owner's 11-12 price (0.35 元/分钟) is the live price for the six institutions and a planning estimate. */
export type PriceLabel = "planning_estimate_not_a_quote";
export const PRICE_LABEL_TEXT: Record<PriceLabel, string> = {
  planning_estimate_not_a_quote: "owner 11-12 裁定，六家实扣，规划试算价，不对外报价" };
export type PlatformOperationRefusalCode = "platform_operation_input_invalid" | "platform_operation_forbidden" |
  "platform_operation_self_review_forbidden" | "platform_operation_conflict" | "platform_operation_unavailable" |
  "platform_operation_not_pending" | "platform_enforce_not_confirmed" | "platform_write_conflict" | "billing_mode_conflict" |
  "workspace_unavailable" | "payer_scope_already_bound" | "payer_unresolved" | "enforce_grant_not_ready" | "enforce_headroom_insufficient" |
  "price_zero_refused" | "price_version_unavailable" | "grant_active_exists";

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
const DIGITS = /^(0|[1-9][0-9]{0,15})$/;
function digits(value: unknown): asserts value is string { if (typeof value !== "string" || !DIGITS.test(value)) refuse("platform_operation_input_invalid"); }
function isoTime(value: unknown): asserts value is string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) refuse("platform_operation_input_invalid");
}
function positiveInt(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 2147483647) refuse("platform_operation_input_invalid");
}
/** The publish input this request becomes; `normalizePriceVersion` (S3-a) validates it. */
const priceInput = (request: Extract<PlatformOperationRequest, { kind: "price_publish" }>, actorRef: string) => ({
  actor: { type: "SYSTEM" as const, ref: actorRef }, productCode: request.productCode, version: request.version,
  billingEventRef: request.billingEventRef, meterUnit: request.meterUnit, acceptanceRef: request.acceptanceRef, scopeKind: "workspace" as const,
  unitPriceFenNumerator: BigInt(request.unitPriceFenNumerator), unitPriceDenominator: BigInt(request.unitPriceDenominator),
  effectiveFrom: new Date(request.effectiveFrom), effectiveUntil: request.effectiveUntil === null ? null : new Date(request.effectiveUntil),
  approvalRef: request.approvalRef });

/**
 * Pure validation. The operation key is derived from (evidence, kind, workspace, mode step), so a re-run of the same ruling finds the
 * same row; the content hash also covers the remaining fields, so the same key with other content conflicts.
 */
export function normalizePlatformOperation(evidenceRef: unknown, request: PlatformOperationRequest) {
  reference(evidenceRef);
  if (!request || typeof request !== "object") refuse("platform_operation_input_invalid");
  if (request.kind !== "price_publish") reference(request.workspaceId);
  let canonical: PlatformOperationRequest;
  let identity: Record<string, unknown>;
  if (request.kind === "price_publish") {
    digits(request.unitPriceFenNumerator); digits(request.unitPriceDenominator); isoTime(request.effectiveFrom);
    if (request.effectiveUntil !== null) isoTime(request.effectiveUntil);
    if (!Object.hasOwn(PRICE_LABEL_TEXT, request.priceLabel)) refuse("platform_operation_input_invalid");
    // A zero price can never be used (reserve refuses grant_charge_zero), so it is never published through this path.
    if (request.unitPriceFenNumerator === "0") refuse("price_zero_refused");
    canonical = { kind: request.kind, productCode: request.productCode, version: request.version, billingEventRef: request.billingEventRef,
      meterUnit: request.meterUnit, acceptanceRef: request.acceptanceRef, unitPriceFenNumerator: request.unitPriceFenNumerator,
      unitPriceDenominator: request.unitPriceDenominator, effectiveFrom: request.effectiveFrom, effectiveUntil: request.effectiveUntil,
      approvalRef: request.approvalRef, priceLabel: request.priceLabel };
    try { normalizePriceVersion(priceInput(canonical, "platform-op")); } catch { refuse("platform_operation_input_invalid"); }
    identity = { productCode: canonical.productCode, version: canonical.version };
  } else if (request.kind === "spend_grant") {
    reference(request.productCode); positiveInt(request.priceVersion); isoTime(request.validFrom); isoTime(request.validUntil);
    for (const value of [request.perChargeLimitFen, request.dailyLimitFen, request.monthlyLimitFen]) digits(value);
    canonical = { kind: request.kind, workspaceId: request.workspaceId, productCode: request.productCode, priceVersion: request.priceVersion,
      validFrom: request.validFrom, validUntil: request.validUntil, perChargeLimitFen: request.perChargeLimitFen,
      dailyLimitFen: request.dailyLimitFen, monthlyLimitFen: request.monthlyLimitFen };
    identity = { workspaceId: canonical.workspaceId, productCode: canonical.productCode, priceVersion: canonical.priceVersion };
  } else if (request.kind === "payer_onboard") {
    reference(request.contractSubjectRef);
    canonical = { kind: request.kind, workspaceId: request.workspaceId, contractSubjectRef: request.contractSubjectRef };
    identity = { workspaceId: canonical.workspaceId, step: null };
  } else if (request.kind === "billing_mode") {
    if (!MODES.includes(request.fromMode) || !MODES.includes(request.toMode) || request.fromMode === request.toMode) {
      refuse("platform_operation_input_invalid");
    }
    canonical = { kind: request.kind, workspaceId: request.workspaceId, fromMode: request.fromMode, toMode: request.toMode };
    identity = { workspaceId: canonical.workspaceId, step: `${canonical.fromMode}>${canonical.toMode}` };
  } else refuse("platform_operation_input_invalid");
  const key = sha256({ v: 1, evidenceRef, kind: canonical.kind, ...identity }).slice(0, 40);
  return { evidenceRef, request: canonical, operationKey: `pbo:${canonical.kind}:${key}`,
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
    // A price is platform-wide: its operation is filed under the reserved workspace and checks no customer workspace.
    const workspaceId = request.kind === "price_publish" ? reservedWorkspaceId : request.workspaceId;
    let payerAccountId: string | null = null;
    if (request.kind !== "price_publish") {
      await assertTargetWorkspace(tx, request.workspaceId);
      const binding = await activeBinding(tx, request.workspaceId);
      if (request.kind === "payer_onboard" && binding) refuse("payer_scope_already_bound");
      if (request.kind !== "payer_onboard" && !binding) refuse("payer_unresolved");
      if (request.kind === "billing_mode" && binding!.billingMode !== request.fromMode) refuse("billing_mode_conflict");
      payerAccountId = request.kind === "payer_onboard" ? null : binding!.payerAccountId;
    }
    const operation = await tx.platformBillingOperation.create({ data: { kind: request.kind, operationKey: op.operationKey,
      workspaceId, payerAccountId, request, contentHash: op.contentHash, draftedByUserId: input.actorUserId, evidenceRef: op.evidenceRef } });
    await audit(tx, [reservedWorkspaceId, workspaceId], input.actorUserId, "BILLING_PLATFORM_OPERATION_DRAFTED",
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
  if (request.kind === "price_publish") {
    const { priceVersion } = await publishPriceVersionInTransaction(tx, priceInput(request, `platform-op:${row.id}`));
    return priceVersion.id;
  }
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
  if (request.kind === "spend_grant") return openSpendGrant(tx, request, row, binding.payerAccountId, actorUserId);
  if (request.toMode === "enforce") await assertEnforceReady(tx, binding.payerAccountId);
  // CAS: the expected old mode stays in the UPDATE's own WHERE (the payer row is already locked FOR UPDATE above).
  const changed = await tx.$executeRaw`UPDATE PayerAccount SET billingMode = ${request.toMode}, version = version + 1,
    updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ${binding.payerAccountId} AND billingMode = ${request.fromMode} AND status = 'active'`;
  if (changed !== 1) refuse("billing_mode_conflict");
  await audit(tx, [request.workspaceId], actorUserId, "BILLING_PAYER_MODE_CHANGED", { type: "PayerAccount", id: binding.payerAccountId },
    { from: request.fromMode, to: request.toMode, platformOperationId: row.id, evidenceRef: row.evidenceRef });
  return binding.payerAccountId;
}

/** Enforce must not stop the payer at once: one active grant per event and unit (at least one) and headroom = wallet + undrawn credit
 * - held/unknown enforce reservations > 0, under the payer lock as in reserve. Advisory for the switch; every use re-checks money. */
async function assertEnforceReady(tx: Prisma.TransactionClient, payerAccountId: string) {
  const grants = await tx.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*) AS n FROM SpendGrant g
    JOIN BillingPriceVersion v ON v.id = g.priceVersionId WHERE g.payerAccountId = ${payerAccountId} AND g.state = 'active'
    GROUP BY v.billingEventRef, v.meterUnit`;
  if (grants.length === 0 || grants.some(row => Number(row.n) !== 1)) refuse("enforce_grant_not_ready");
  const [{ held }] = await tx.$queryRaw<Array<{ held: bigint }>>`SELECT CAST(COALESCE(SUM(chargeFen), 0) AS SIGNED) AS held
    FROM BillingReservation WHERE payerAccountId = ${payerAccountId} AND billingMode = 'enforce' AND state IN ('held', 'unknown')`;
  const [wallet] = await tx.$queryRaw<Array<{ balanceFen: bigint }>>`SELECT balanceFen FROM FundsAccountProjection
    WHERE payerAccountId = ${payerAccountId} AND account = 'customer_wallet_available'`;
  const headroom = BigInt(wallet?.balanceFen ?? 0) + await availableCreditFen(tx, payerAccountId) - BigInt(held);
  if (headroom <= BigInt(0)) refuse("enforce_headroom_insufficient");
}

/**
 * Approval of `spend_grant`: create (disabled, limits 0) -> set_limits -> activate through the S3-a service under the platform
 * checker authority, each step audited there. Refuses while the payer already holds a non-terminal grant for the product, since
 * quote needs exactly one active grant per event and unit (replacing a price is a separate, later step).
 */
async function openSpendGrant(tx: Prisma.TransactionClient, request: Extract<PlatformOperationRequest, { kind: "spend_grant" }>,
  row: PlatformBillingOperation, payerAccountId: string, actorUserId: string) {
  const [price] = await tx.$queryRaw<Array<{ id: string; productId: string }>>`SELECT v.id, v.productId FROM BillingPriceVersion v
    JOIN BillingProduct p ON p.id = v.productId WHERE p.code = ${request.productCode} AND v.version = ${request.priceVersion} FOR SHARE`;
  if (!price) refuse("price_version_unavailable");
  const [open] = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM SpendGrant WHERE payerAccountId = ${payerAccountId}
    AND productId = ${price.productId} AND state IN ('disabled', 'active', 'paused') LIMIT 1 FOR SHARE`;
  if (open) refuse("grant_active_exists");
  const common = { actorUserId, evidenceRef: row.evidenceRef };
  const { grant } = await createSpendGrantInTransaction(tx, { ...common, payerAccountId, priceVersionId: price.id,
    operationKey: `platform-op:${row.id}`, validFrom: new Date(request.validFrom), validUntil: new Date(request.validUntil) },
  "platform_checker");
  const limits = { perChargeLimitFen: BigInt(request.perChargeLimitFen), dailyLimitFen: BigInt(request.dailyLimitFen),
    monthlyLimitFen: BigInt(request.monthlyLimitFen) };
  const limited = await changeSpendGrantInTransaction(tx, { ...common, grantId: grant.id, expectedVersion: grant.version,
    action: "set_limits", limits }, "platform_checker");
  await changeSpendGrantInTransaction(tx, { ...common, grantId: grant.id, expectedVersion: limited.version, action: "activate" },
    "platform_checker");
  return grant.id;
}
