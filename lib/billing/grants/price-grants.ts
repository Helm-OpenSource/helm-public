import "server-only";
import { createHash } from "node:crypto";
import { ActorType, Prisma, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { MAX_FEN } from "../funds/money";
import { canManageWorkspaceBilling } from "@/lib/auth/billing-governance";
import { lockBillingAuthority } from "../payer/payer-accounts";
import { findPlatformFinanceActorInTransaction } from "../bank-receipts/bank-receipts";

/**
 * Billing V1 S3-a: immutable price versions and default-off spend grants; no reservation, charge or route. A grant binds one
 * price version for life (DB trigger), so a higher price never widens it. Lock order: Membership -> PayerAccount FOR UPDATE
 * -> SpendGrant (-> BudgetBucket -> BillingReservation on the S3-b money path), so a revoke and a use of one grant serialize.
 * `changeSpendGrantInTransaction` callers must not lock budget buckets or reservations before calling it.
 */
export type SpendGrantRefusalCode = "price_input_invalid" | "price_version_conflict" | "price_version_sequence_invalid" |
  "price_version_unavailable" | "price_version_not_effective" | "price_amount_out_of_range" | "grant_input_invalid" |
  "grant_limits_invalid" | "grant_limits_zero" | "grant_forbidden" | "grant_trigger_not_enabled" | "grant_scope_not_enabled" |
  "grant_operation_conflict" | "grant_unavailable" | "grant_version_conflict" | "grant_transition_invalid" | "grant_not_active" |
  "grant_outside_validity" | "grant_price_version_mismatch" | "grant_per_charge_exceeded" | "grant_daily_limit_exceeded" |
  "grant_monthly_limit_exceeded" | "grant_meter_mismatch" | "grant_charge_zero" | "payer_account_unavailable" | "payer_billing_off" |
  "billing_write_conflict";

export class SpendGrantRefusal extends Error {
  constructor(readonly code: SpendGrantRefusalCode) { super(code); this.name = "SpendGrantRefusal"; }
}

const ZERO = BigInt(0), ONE = BigInt(1), TWO = BigInt(2);
const SOURCE_PAGE = "/billing/grants";
function refuse(code: SpendGrantRefusalCode): never { throw new SpendGrantRefusal(code); }
function reference(value: unknown, code: SpendGrantRefusalCode): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/.test(value)) refuse(code);
}
function date(value: unknown, code: SpendGrantRefusalCode): asserts value is Date { if (!(value instanceof Date) || Number.isNaN(value.getTime())) refuse(code); }
function fen(value: unknown, min: bigint, code: SpendGrantRefusalCode): asserts value is bigint { if (typeof value !== "bigint" || value < min || value > MAX_FEN) refuse(code); }
const hashOf = (value: object) => createHash("sha256")
  .update(JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString() : item))).digest("hex");
function run<T>(client: PrismaClient, body: (tx: Prisma.TransactionClient) => Promise<T>) {
  // No automatic retry: a conflicting writer re-reads the current version and decides again.
  return client.$transaction(body, { maxWait: 5000, timeout: 10000 }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) refuse("billing_write_conflict");
    throw error;
  });
}

export type PublishPriceVersionInput = {
  /** Server-derived catalog service identity; callers prove the pricing approval behind `approvalRef`. */
  actor: { type: "SYSTEM"; ref: string }; productCode: string; version: number; billingEventRef: string; meterUnit: string;
  acceptanceRef: string; scopeKind: "workspace" | "consumer_principal"; unitPriceFenNumerator: bigint;
  unitPriceDenominator: bigint; effectiveFrom: Date; effectiveUntil: Date | null; approvalRef: string;
};
export type BillingPriceRow = { id: string; productId: string; version: number; scopeKind: string; billingEventRef: string;
  meterUnit: string; unitPriceFenNumerator: bigint; unitPriceDenominator: bigint; effectiveFrom: Date; effectiveUntil: Date | null;
  contentHash: string };

/** Pure validation and content hash; the same (product, version) replays only with this exact content. */
export function normalizePriceVersion(input: PublishPriceVersionInput) {
  if (!input || typeof input !== "object" || input.actor?.type !== "SYSTEM") refuse("price_input_invalid");
  reference(input.actor.ref, "price_input_invalid");
  if (typeof input.productCode !== "string" || !/^[a-z][a-z0-9_.-]{0,63}$/.test(input.productCode)) refuse("price_input_invalid");
  if (!Number.isSafeInteger(input.version) || input.version < 1 || input.version > 2147483647) refuse("price_input_invalid");
  for (const value of [input.billingEventRef, input.acceptanceRef, input.approvalRef]) reference(value, "price_input_invalid");
  if (typeof input.meterUnit !== "string" || !/^[a-z][a-z0-9_]{0,31}$/.test(input.meterUnit)) refuse("price_input_invalid");
  if (input.scopeKind !== "workspace" && input.scopeKind !== "consumer_principal") refuse("price_input_invalid");
  fen(input.unitPriceFenNumerator, ZERO, "price_input_invalid");
  fen(input.unitPriceDenominator, ONE, "price_input_invalid");
  date(input.effectiveFrom, "price_input_invalid");
  if (input.effectiveUntil !== null) {
    date(input.effectiveUntil, "price_input_invalid");
    if (input.effectiveUntil <= input.effectiveFrom) refuse("price_input_invalid");
  }
  const content = { productCode: input.productCode, version: input.version, billingEventRef: input.billingEventRef,
    meterUnit: input.meterUnit, acceptanceRef: input.acceptanceRef, scopeKind: input.scopeKind,
    unitPriceFenNumerator: input.unitPriceFenNumerator, unitPriceDenominator: input.unitPriceDenominator,
    rounding: "half_up" as const, effectiveFrom: input.effectiveFrom, effectiveUntil: input.effectiveUntil,
    approvalRef: input.approvalRef };
  return { ...content, contentHash: hashOf({ v: 1, ...content }), createdBy: `SYSTEM:${input.actor.ref}` };
}

/** Appends version N of a product (creating the product at version 1). Versions are never edited (DB trigger). */
export function publishPriceVersion(client: PrismaClient, input: PublishPriceVersionInput) {
  return run(client, tx => publishPriceVersionInTransaction(tx, input));
}
/** Same as publishPriceVersion inside the caller's transaction (E1a/E1b platform maker/checker approval). */
export async function publishPriceVersionInTransaction(tx: Prisma.TransactionClient, input: PublishPriceVersionInput) {
  const { productCode, createdBy, ...price } = normalizePriceVersion(input);
  const [found] = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM BillingProduct WHERE code = ${productCode} FOR UPDATE`;
  let productId = found?.id;
  if (!productId) {
    if (price.version !== 1) refuse("price_version_sequence_invalid");
    productId = (await tx.billingProduct.create({ data: { code: productCode, createdBy } })).id;
  }
  const [existing] = await tx.$queryRaw<BillingPriceRow[]>`SELECT id, contentHash FROM BillingPriceVersion
    WHERE productId = ${productId} AND version = ${price.version} FOR SHARE`;
  if (existing) {
    if (existing.contentHash !== price.contentHash) refuse("price_version_conflict");
    return { priceVersion: await tx.billingPriceVersion.findUniqueOrThrow({ where: { id: existing.id } }), replayed: true };
  }
  const [{ latest }] = await tx.$queryRaw<Array<{ latest: number | bigint }>>`
    SELECT COALESCE(MAX(version), 0) AS latest FROM BillingPriceVersion WHERE productId = ${productId} FOR SHARE`;
  if (price.version !== Number(latest) + 1) refuse("price_version_sequence_invalid");
  const priceVersion = await tx.billingPriceVersion.create({ data: { ...price, productId, createdBy } });
  return { priceVersion, replayed: false };
}

/** Charge for a quantity at a rational unit price: exact BigInt product, one half-up rounding to fen (ADR 3). */
export function chargeFenForQuantity(price: Pick<BillingPriceRow, "unitPriceFenNumerator" | "unitPriceDenominator">, quantity: bigint) {
  if (typeof quantity !== "bigint" || quantity <= ZERO) refuse("price_input_invalid");
  const scaled = BigInt(price.unitPriceFenNumerator) * quantity, denominator = BigInt(price.unitPriceDenominator);
  const quotient = scaled / denominator, remainder = scaled % denominator;
  const charge = remainder * TWO >= denominator ? quotient + ONE : quotient;
  if (charge > MAX_FEN) refuse("price_amount_out_of_range");
  return charge;
}

/** Day and month keys in Asia/Shanghai (fixed UTC+8, no DST); S3-b freezes them on the reservation (ADR 5). */
export function billingPeriodKeys(at: Date) {
  date(at, "grant_input_invalid");
  const local = new Date(at.getTime() + 8 * 3600 * 1000).toISOString();
  return { day: local.slice(0, 10), month: local.slice(0, 7) };
}

export type SpendGrantLimits = { perChargeLimitFen: bigint; dailyLimitFen: bigint; monthlyLimitFen: bigint };
const NO_LIMITS: SpendGrantLimits = { perChargeLimitFen: ZERO, dailyLimitFen: ZERO, monthlyLimitFen: ZERO };
function limits(value: SpendGrantLimits): SpendGrantLimits {
  if (!value || typeof value !== "object") refuse("grant_limits_invalid");
  for (const amount of [value.perChargeLimitFen, value.dailyLimitFen, value.monthlyLimitFen]) fen(amount, ZERO, "grant_limits_invalid");
  if (value.perChargeLimitFen > value.dailyLimitFen || value.dailyLimitFen > value.monthlyLimitFen) refuse("grant_limits_invalid");
  return { perChargeLimitFen: value.perChargeLimitFen, dailyLimitFen: value.dailyLimitFen, monthlyLimitFen: value.monthlyLimitFen };
}
const limitStrings = (value: SpendGrantLimits) => [value.perChargeLimitFen, value.dailyLimitFen, value.monthlyLimitFen].map(String);

type PayerRow = { id: string; kind: string; status: string; billingMode: string; governingWorkspaceId: string | null };
async function lockPayer(tx: Prisma.TransactionClient, payerAccountId: string) {
  const [payer] = await tx.$queryRaw<PayerRow[]>`
    SELECT id, kind, status, billingMode, governingWorkspaceId FROM PayerAccount
    WHERE id = ${payerAccountId} AND CAST(id AS BINARY) = CAST(${payerAccountId} AS BINARY) FOR UPDATE`;
  if (!payer || payer.id !== payerAccountId || payer.kind !== "enterprise_contract" || !payer.governingWorkspaceId) {
    refuse("payer_account_unavailable");
  }
  return payer;
}
const assertPayerActive = (payer: PayerRow) => { if (payer.status !== "active") refuse("payer_account_unavailable"); };
/**
 * Grant writes: OWNER/BILLING_ADMIN of the payer's governing workspace (S0 §6), a human user only, then the payer lock. The
 * `platform_checker` authority (E1b) is instead an active platform finance checker grant, re-checked here in the same transaction.
 */
export type GrantWriteAuthority = "workspace" | "platform_checker";
async function lockPayerForGrantWrite(tx: Prisma.TransactionClient, actorUserId: string, payerAccountId: string,
  authority: GrantWriteAuthority) {
  if (authority === "platform_checker") {
    if (!await findPlatformFinanceActorInTransaction(tx, actorUserId, ["checker"])) refuse("grant_forbidden");
    const payer = await lockPayer(tx, payerAccountId);
    return { ...payer, governingWorkspaceId: payer.governingWorkspaceId! };
  }
  const head = await tx.payerAccount.findUnique({ where: { id: payerAccountId }, select: { governingWorkspaceId: true } });
  if (!head?.governingWorkspaceId) refuse("payer_account_unavailable");
  try { await lockBillingAuthority(tx, actorUserId, [head.governingWorkspaceId], canManageWorkspaceBilling); } catch (error) {
    if (error instanceof Error && error.message === "payer_binding_forbidden") refuse("grant_forbidden");
    throw error;
  }
  const payer = await lockPayer(tx, payerAccountId);
  if (payer.governingWorkspaceId !== head.governingWorkspaceId) refuse("payer_account_unavailable");
  return { ...payer, governingWorkspaceId: head.governingWorkspaceId };
}
const readPrice = async (tx: Prisma.TransactionClient, id: string) => (await tx.$queryRaw<BillingPriceRow[]>`
  SELECT id, productId, version, scopeKind, billingEventRef, meterUnit, unitPriceFenNumerator, unitPriceDenominator,
    effectiveFrom, effectiveUntil, contentHash FROM BillingPriceVersion WHERE id = ${id} FOR SHARE`)[0] ?? null;
export type SpendGrantRow = SpendGrantLimits & { id: string; payerAccountId: string; productId: string; priceVersionId: string;
  state: string; version: number; validFrom: Date; validUntil: Date; contentHash: string };
const readGrant = async (tx: Prisma.TransactionClient, where: Prisma.Sql, lock: Prisma.Sql) => {
  const [row] = await tx.$queryRaw<SpendGrantRow[]>`SELECT id, payerAccountId, productId, priceVersionId, state, version, validFrom,
    validUntil, contentHash, perChargeLimitFen, dailyLimitFen, monthlyLimitFen FROM SpendGrant WHERE ${where} ${lock}`;
  return row ? { ...row, version: Number(row.version), perChargeLimitFen: BigInt(row.perChargeLimitFen),
    dailyLimitFen: BigInt(row.dailyLimitFen), monthlyLimitFen: BigInt(row.monthlyLimitFen) } : null;
};

export type CreateSpendGrantInput = { actorUserId: string; payerAccountId: string; priceVersionId: string; operationKey: string;
  evidenceRef: string; validFrom: Date; validUntil: Date; triggerKind?: "user_initiated" | "scheduled"; limits?: SpendGrantLimits };

/** Creates a grant in state `disabled` (limits default 0). Same key + same content replays; other content conflicts. */
export async function createSpendGrant(client: PrismaClient, input: CreateSpendGrantInput) {
  const prepared = prepareSpendGrant(input); // input errors refuse before a transaction opens
  return run(client, tx => insertSpendGrant(tx, input, prepared, "workspace"));
}
/** Same as createSpendGrant inside the caller's transaction (E1b platform checker approval). */
export function createSpendGrantInTransaction(tx: Prisma.TransactionClient, input: CreateSpendGrantInput, authority: GrantWriteAuthority) {
  return insertSpendGrant(tx, input, prepareSpendGrant(input), authority);
}
function prepareSpendGrant(input: CreateSpendGrantInput) {
  reference(input?.actorUserId, "grant_forbidden");
  for (const ref of [input.payerAccountId, input.priceVersionId, input.operationKey, input.evidenceRef]) reference(ref, "grant_input_invalid");
  date(input.validFrom, "grant_input_invalid"); date(input.validUntil, "grant_input_invalid"); if (input.validUntil <= input.validFrom) refuse("grant_input_invalid");
  const triggerKind = input.triggerKind ?? "user_initiated";
  // Scheduled (recurring) spending needs its own explicit enablement record (R03); fail closed until it exists.
  if (triggerKind !== "user_initiated") refuse("grant_trigger_not_enabled");
  const grantLimits = limits(input.limits ?? NO_LIMITS);
  const contentHash = hashOf({ v: 1, payerAccountId: input.payerAccountId, priceVersionId: input.priceVersionId,
    operationKey: input.operationKey, evidenceRef: input.evidenceRef, validFrom: input.validFrom, validUntil: input.validUntil,
    triggerKind, grantLimits });
  return { triggerKind, grantLimits, contentHash };
}
async function insertSpendGrant(tx: Prisma.TransactionClient, input: CreateSpendGrantInput,
  { triggerKind, grantLimits, contentHash }: ReturnType<typeof prepareSpendGrant>, authority: GrantWriteAuthority) {
  const payer = await lockPayerForGrantWrite(tx, input.actorUserId, input.payerAccountId, authority);
  const existing = await readGrant(tx, Prisma.sql`payerAccountId = ${input.payerAccountId}
    AND operationKey = ${input.operationKey}`, Prisma.sql`FOR UPDATE`);
  if (existing) {
    if (existing.contentHash !== contentHash) refuse("grant_operation_conflict");
    return { grant: await tx.spendGrant.findUniqueOrThrow({ where: { id: existing.id } }), replayed: true };
  }
  assertPayerActive(payer);
  const price = await readPrice(tx, input.priceVersionId);
  if (!price || price.id !== input.priceVersionId) refuse("price_version_unavailable");
  // Enterprise payers only in S3-a (S1-c refuses consumer payers); a consumer-scoped price cannot back this grant.
  if (price.scopeKind !== "workspace") refuse("grant_scope_not_enabled");
  const grant = await tx.spendGrant.create({ data: { payerAccountId: payer.id, productId: price.productId,
    priceVersionId: price.id, triggerKind, ...grantLimits, validFrom: input.validFrom, validUntil: input.validUntil,
    operationKey: input.operationKey, contentHash, createdByUserId: input.actorUserId, evidenceRef: input.evidenceRef } });
  await writeAuditLog({ workspaceId: payer.governingWorkspaceId, userId: input.actorUserId, actor: input.actorUserId,
    actorType: ActorType.USER, actionType: "BILLING_SPEND_GRANT_CREATED", targetType: "SpendGrant", targetId: grant.id,
    summary: "Created spend grant (disabled)", sourcePage: SOURCE_PAGE, relatedObjectType: "PayerAccount",
    relatedObjectId: payer.id, payload: { priceVersionId: price.id, priceVersion: Number(price.version), state: grant.state,
      version: grant.version, limits: limitStrings(grantLimits), evidenceRef: input.evidenceRef } }, { client: tx });
  return { grant, replayed: false };
}

export type SpendGrantAction = "activate" | "pause" | "resume" | "revoke" | "set_limits";
const TRANSITIONS: Record<SpendGrantAction, { from: string[]; to: string | null }> = {
  activate: { from: ["disabled"], to: "active" }, resume: { from: ["paused"], to: "active" },
  pause: { from: ["active"], to: "paused" }, revoke: { from: ["disabled", "active", "paused"], to: "revoked" },
  set_limits: { from: ["disabled", "active", "paused"], to: null },
};
export type ChangeSpendGrantInput = { actorUserId: string; grantId: string; expectedVersion: number; action: SpendGrantAction;
  evidenceRef: string; limits?: SpendGrantLimits };

/** Version-CAS state change on database UTC time. Tightening or revoking binds every later use (it locks the same rows). */
export function changeSpendGrant(client: PrismaClient, input: ChangeSpendGrantInput) {
  return run(client, tx => changeSpendGrantInTransaction(tx, input));
}
export async function changeSpendGrantInTransaction(tx: Prisma.TransactionClient, input: ChangeSpendGrantInput,
  authority: GrantWriteAuthority = "workspace") {
  reference(input?.actorUserId, "grant_forbidden"); reference(input.grantId, "grant_unavailable"); reference(input.evidenceRef, "grant_input_invalid");
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) refuse("grant_input_invalid");
  if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, input.action)) refuse("grant_transition_invalid");
  const rule = TRANSITIONS[input.action];
  if ((input.action === "set_limits") !== (input.limits !== undefined)) refuse("grant_input_invalid");
  const head = await tx.spendGrant.findUnique({ where: { id: input.grantId }, select: { payerAccountId: true } });
  if (!head) refuse("grant_unavailable");
  const payer = await lockPayerForGrantWrite(tx, input.actorUserId, head.payerAccountId, authority);
  const grant = await readGrant(tx, Prisma.sql`id = ${input.grantId}`, Prisma.sql`FOR UPDATE`);
  const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
  if (!grant || grant.id !== input.grantId || grant.payerAccountId !== payer.id) refuse("grant_unavailable");
  if (grant.version !== input.expectedVersion) refuse("grant_version_conflict");
  if (!rule.from.includes(grant.state)) refuse("grant_transition_invalid");
  const next = rule.to ?? grant.state;
  const nextLimits = input.limits ? limits(input.limits) : grant;
  // Pause, revoke and limit changes stay possible on a suspended payer; turning spending on does not.
  if (next === "active" && nextLimits.perChargeLimitFen === ZERO) refuse("grant_limits_zero");
  if (rule.to === "active") {
    assertPayerActive(payer);
    if (now >= grant.validUntil) refuse("grant_outside_validity");
    const price = await readPrice(tx, grant.priceVersionId);
    if (!price || (price.effectiveUntil && now >= price.effectiveUntil)) refuse("price_version_not_effective");
  }
  const revoke = next === "revoked";
  // CAS: the version and pre-state stay in the UPDATE's own WHERE; the trigger also requires version + 1.
  const changed = await tx.$executeRaw`UPDATE SpendGrant SET state = ${next},
    perChargeLimitFen = ${nextLimits.perChargeLimitFen}, dailyLimitFen = ${nextLimits.dailyLimitFen},
    monthlyLimitFen = ${nextLimits.monthlyLimitFen}, version = version + 1, updatedAt = CURRENT_TIMESTAMP(3),
    revokedAt = ${revoke ? now : null}, revokedByUserId = ${revoke ? input.actorUserId : null}
    WHERE id = ${grant.id} AND version = ${grant.version} AND state = ${grant.state}`;
  if (changed !== 1) refuse("grant_version_conflict");
  const row = await tx.spendGrant.findUniqueOrThrow({ where: { id: grant.id } });
  await writeAuditLog({ workspaceId: payer.governingWorkspaceId, userId: input.actorUserId, actor: input.actorUserId,
    actorType: ActorType.USER, actionType: `BILLING_SPEND_GRANT_${input.action.toUpperCase()}`, targetType: "SpendGrant",
    targetId: row.id, summary: `Spend grant ${input.action}`, sourcePage: SOURCE_PAGE, relatedObjectType: "PayerAccount",
    relatedObjectId: payer.id, payload: { from: grant.state, to: row.state, version: row.version,
      limits: limitStrings(nextLimits), evidenceRef: input.evidenceRef } }, { client: tx });
  return row;
}

/** The use names what it meters; the gate prices it from the grant's locked price row, never from a caller amount. */
export type SpendGrantUse = { priceVersionId: string; billingEventRef: string; meterUnit: string; quantity: bigint; at: Date;
  /** Settled plus held/unknown fen in this grant's day/month buckets, read from the locked BudgetBucket rows (S3-b). */
  usedFen: { day: bigint; month: bigint } };

/** Pure admission check against one grant and its bound price version; returns the charge or throws the first violation. */
export function evaluateSpendGrant(grant: SpendGrantRow, price: BillingPriceRow, use: SpendGrantUse) {
  date(use.at, "grant_input_invalid");
  if (typeof use.quantity !== "bigint" || use.quantity <= ZERO) refuse("grant_input_invalid");
  fen(use.usedFen?.day, ZERO, "grant_input_invalid"); fen(use.usedFen.month, ZERO, "grant_input_invalid");
  if (grant.state !== "active") refuse("grant_not_active");
  if (use.at < grant.validFrom || use.at >= grant.validUntil) refuse("grant_outside_validity");
  if (use.priceVersionId !== grant.priceVersionId || price.id !== grant.priceVersionId) refuse("grant_price_version_mismatch");
  if (use.billingEventRef !== price.billingEventRef || use.meterUnit !== price.meterUnit) refuse("grant_meter_mismatch");
  if (use.at < price.effectiveFrom || (price.effectiveUntil && use.at >= price.effectiveUntil)) refuse("price_version_not_effective");
  const chargeFen = chargeFenForQuantity(price, use.quantity);
  // Zero-fen policy (S3-b): a use that prices to 0 fen is refused, never reserved as "free"; free usage needs its own approved
  // product path. (A settle of a smaller quantity may round to 0 fen; that settles at 0, protocol v3.5.)
  if (chargeFen === ZERO) refuse("grant_charge_zero");
  if (chargeFen > grant.perChargeLimitFen) refuse("grant_per_charge_exceeded");
  if (use.usedFen.day + chargeFen > grant.dailyLimitFen) refuse("grant_daily_limit_exceeded");
  if (use.usedFen.month + chargeFen > grant.monthlyLimitFen) refuse("grant_monthly_limit_exceeded");
  return chargeFen;
}

export type SpendGrantUseRequest = Omit<SpendGrantUse, "at" | "usedFen"> & { payerAccountId: string; grantId: string };
export type BillingPeriodKeys = ReturnType<typeof billingPeriodKeys>;

/**
 * Use-path gate, inside the caller's transaction. Lock order: PayerAccount FOR UPDATE -> grant FOR SHARE (a concurrent change
 * waits for the caller's commit) -> the caller's budget buckets via `lockUsedFen` (FOR UPDATE) -> pure check. The use time is
 * the database's UTC_TIMESTAMP(3) read here, never a caller value. Returns the snapshot the reservation freezes.
 */
export async function lockSpendGrantForUseInTransaction(tx: Prisma.TransactionClient, input: SpendGrantUseRequest,
  lockUsedFen: (grant: SpendGrantRow, periodKeys: BillingPeriodKeys, billingMode: "shadow" | "enforce") => Promise<SpendGrantUse["usedFen"]>) {
  reference(input?.payerAccountId, "payer_account_unavailable"); reference(input.grantId, "grant_unavailable");
  const payer = await lockPayer(tx, input.payerAccountId);
  assertPayerActive(payer);
  if (payer.billingMode !== "shadow" && payer.billingMode !== "enforce") refuse("payer_billing_off");
  const grant = await readGrant(tx, Prisma.sql`id = ${input.grantId}`, Prisma.sql`FOR SHARE`);
  if (!grant || grant.id !== input.grantId || grant.payerAccountId !== payer.id) refuse("grant_unavailable");
  const price = await readPrice(tx, grant.priceVersionId);
  if (!price) refuse("price_version_unavailable");
  const [{ at }] = await tx.$queryRaw<Array<{ at: Date }>>`SELECT UTC_TIMESTAMP(3) AS at`;
  const periodKeys = billingPeriodKeys(at), billingMode = payer.billingMode as "shadow" | "enforce";
  const chargeFen = evaluateSpendGrant(grant, price, { ...input, at, usedFen: await lockUsedFen(grant, periodKeys, billingMode) });
  return { grant, priceVersionId: price.id, priceContentHash: price.contentHash, chargeFen, at, periodKeys, billingMode };
}
