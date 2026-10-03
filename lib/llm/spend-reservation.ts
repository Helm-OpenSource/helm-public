/** Candidate reserve-then-settle admission for LLM spend.
 *
 * This module records a v2 maximum-charge quote and its provenance. It does not
 * authenticate a price book, FX source, policy approval or provider, and it
 * never authorizes provider execution. C1 remains fail-closed until a later
 * composition verifies those authorities and atomically joins dispatch claim
 * with this reservation.
 */

const MAX_MICROS = BigInt("9223372036854775807");
const MAX_CONFIG_VERSION = 2147483647;
const SHA256_REF = /^sha256:[0-9a-f]{64}$/u;

export type SpendPeriodAdmissionState = "open" | "legacy_unknown" | "invariant_breach";

export type SpendPeriodTotals = {
  reservedMicros: bigint;
  settledMicros: bigint;
  unknownBoundMicros: bigint;
  unknownCalls: number;
  invariantBreachBoundMicros: bigint;
  invariantBreachCalls: number;
  admissionState: SpendPeriodAdmissionState;
};

export type SpendBudgetPolicy =
  | { mode: "unconfigured" }
  | { mode: "unlimited"; configVersion: number; approvalRef: string }
  | { mode: "limited"; budgetMicros: bigint; configVersion: number; approvalRef: string };

/** Immutable quote evidence recorded with one attempt.
 *
 * Provenance references are evidence, not proof that their issuers are trusted.
 * A later gateway composition must verify them before calling reserve.
 */
export type SpendChargeQuote = {
  contractVersion: 2;
  operationRef: string;
  quoteRef: string;
  quoteHash: string;
  maximumChargeMicros: bigint;
  budgetCurrency: "USD";
  providerCurrency: "USD" | "CNY";
  priceBookRef: string;
  priceBookVersion: string;
  priceBookHash: string;
  fxSnapshotRef: string | null;
  fxSnapshotHash: string | null;
  policyApprovalRef: string;
};

export type ReserveSpendRecord = SpendChargeQuote & {
  workspaceId: string;
  periodKey: string;
  periodPolicyVersion: string;
  budgetConfigVersion: number;
  attemptRef: string;
  budgetMode: "limited" | "unlimited";
  budgetLimitMicros: bigint | null;
  provider: string;
  model: string;
  expiresAt: Date;
  provenanceState: "complete";
};

export type AtomicReservationResult =
  | "reserved" | "duplicate" | "conflict" | "period_policy_conflict"
  | "budget_config_conflict" | "legacy_period_requires_reconciliation"
  | "spend_invariant_breach" | "budget_exhausted";

export type SpendReservationStore = {
  reserve: (input: ReserveSpendRecord) => Promise<AtomicReservationResult>;
  settle: (input: { workspaceId: string; attemptRef: string; settledMicros: bigint }) =>
    Promise<"settled" | "invariant_breach" | "not_reserved">;
  markUnknown: (input: { workspaceId: string; attemptRef: string }) => Promise<"unknown" | "not_reserved">;
  release: (input: { workspaceId: string; attemptRef: string }) => Promise<"released" | "not_reserved">;
  readTotals: (input: { workspaceId: string; periodKey: string }) => Promise<SpendPeriodTotals>;
  listExpiredReservations: (input: { now: Date; limit: number }) =>
    Promise<Array<{ workspaceId: string; attemptRef: string }>>;
};

export type ReservationOutcome =
  | { admitted: true; attemptRef: string; maximumChargeMicros: bigint }
  | { admitted: false; reason: ReservationRefusalReason };

export type ReservationRefusalReason =
  | "budget_unconfigured" | "maximum_charge_invalid" | "charge_quote_invalid"
  | "budget_policy_invalid" | "budget_exhausted" | "attempt_already_reserved"
  | "attempt_conflict" | "period_policy_conflict" | "budget_config_conflict"
  | "legacy_period_requires_reconciliation" | "spend_invariant_breach";

function nonblank(value: string, maxLength = 191): boolean {
  return value.length > 0 && value.length <= maxLength && value.trim() === value &&
    !/[\x00-\x1f\x7f]/u.test(value);
}

function isValidPolicy(policy: Exclude<SpendBudgetPolicy, { mode: "unconfigured" }>): boolean {
  return Number.isSafeInteger(policy.configVersion) && policy.configVersion > 0 &&
    policy.configVersion <= MAX_CONFIG_VERSION && nonblank(policy.approvalRef) &&
    (policy.mode !== "limited" || (policy.budgetMicros >= BigInt(0) && policy.budgetMicros <= MAX_MICROS));
}

function quoteInvalidReason(
  quote: SpendChargeQuote,
  policy: Exclude<SpendBudgetPolicy, { mode: "unconfigured" }>,
): "maximum_charge_invalid" | "charge_quote_invalid" | null {
  if (quote.maximumChargeMicros < BigInt(0) || quote.maximumChargeMicros > MAX_MICROS) {
    return "maximum_charge_invalid";
  }
  if (quote.contractVersion !== 2 || quote.budgetCurrency !== "USD" ||
      !nonblank(quote.operationRef) || !nonblank(quote.quoteRef) || !SHA256_REF.test(quote.quoteHash) ||
      !nonblank(quote.priceBookRef) || !nonblank(quote.priceBookVersion, 64) ||
      !SHA256_REF.test(quote.priceBookHash) || quote.policyApprovalRef !== policy.approvalRef) {
    return "charge_quote_invalid";
  }
  const hasFx = nonblank(quote.fxSnapshotRef ?? "") && SHA256_REF.test(quote.fxSnapshotHash ?? "");
  if (quote.providerCurrency === "USD") {
    if (quote.fxSnapshotRef !== null || quote.fxSnapshotHash !== null) return "charge_quote_invalid";
  } else if (quote.providerCurrency === "CNY") {
    if (!hasFx) return "charge_quote_invalid";
  } else {
    return "charge_quote_invalid";
  }
  return null;
}

export async function reserveSpend(input: {
  store: SpendReservationStore;
  policy: SpendBudgetPolicy;
  workspaceId: string;
  periodKey: string;
  periodPolicyVersion: string;
  attemptRef: string;
  quote: SpendChargeQuote;
  provider: string;
  model: string;
  leaseMs: number;
  now: Date;
}): Promise<ReservationOutcome> {
  if (input.policy.mode === "unconfigured") return { admitted: false, reason: "budget_unconfigured" };
  if (!isValidPolicy(input.policy)) return { admitted: false, reason: "budget_policy_invalid" };
  const invalidQuote = quoteInvalidReason(input.quote, input.policy);
  if (invalidQuote) return { admitted: false, reason: invalidQuote };
  const result = await input.store.reserve({
    ...input.quote,
    workspaceId: input.workspaceId,
    periodKey: input.periodKey,
    periodPolicyVersion: input.periodPolicyVersion,
    budgetConfigVersion: input.policy.configVersion,
    attemptRef: input.attemptRef,
    budgetMode: input.policy.mode,
    budgetLimitMicros: input.policy.mode === "limited" ? input.policy.budgetMicros : null,
    provider: input.provider,
    model: input.model,
    expiresAt: new Date(input.now.getTime() + input.leaseMs),
    provenanceState: "complete",
  });
  if (result !== "reserved") {
    const reasons = {
      duplicate: "attempt_already_reserved",
      conflict: "attempt_conflict",
      period_policy_conflict: "period_policy_conflict",
      budget_config_conflict: "budget_config_conflict",
      legacy_period_requires_reconciliation: "legacy_period_requires_reconciliation",
      spend_invariant_breach: "spend_invariant_breach",
      budget_exhausted: "budget_exhausted",
    } as const;
    return { admitted: false, reason: reasons[result] };
  }
  return { admitted: true, attemptRef: input.attemptRef,
    maximumChargeMicros: input.quote.maximumChargeMicros };
}

export type SettlementOutcome = "settled" | "invariant_breach" | "unknown" | "released" |
  "measurement_invalid" | "not_reserved";

export async function settleReservation(input: {
  store: SpendReservationStore;
  workspaceId: string;
  attemptRef: string;
  usage: { kind: "known"; measuredMicros: bigint } | { kind: "unknown" } | { kind: "not_consumed" };
}): Promise<SettlementOutcome> {
  if (input.usage.kind === "known") {
    if (input.usage.measuredMicros < BigInt(0) || input.usage.measuredMicros > MAX_MICROS) {
      return "measurement_invalid";
    }
    return await input.store.settle({ workspaceId: input.workspaceId, attemptRef: input.attemptRef,
      settledMicros: input.usage.measuredMicros });
  }
  if (input.usage.kind === "unknown") {
    return await input.store.markUnknown({ workspaceId: input.workspaceId, attemptRef: input.attemptRef });
  }
  return await input.store.release({ workspaceId: input.workspaceId, attemptRef: input.attemptRef });
}

export async function recoverExpiredReservations(input: {
  store: SpendReservationStore;
  now: Date;
  limit: number;
}): Promise<{ converted: number; scanned: number }> {
  const expired = await input.store.listExpiredReservations({ now: input.now, limit: input.limit });
  let converted = 0;
  for (const row of expired) {
    const outcome = await input.store.markUnknown({ workspaceId: row.workspaceId, attemptRef: row.attemptRef });
    if (outcome === "unknown") converted += 1;
  }
  return { converted, scanned: expired.length };
}
