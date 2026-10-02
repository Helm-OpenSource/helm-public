/**
 * Candidate reserve-then-settle admission for LLM spend.
 *
 * The store must atomically create the per-attempt ledger entry AND advance the
 * period counter. Separate writes plus compensating release are unsafe: on a
 * duplicate, release(attemptRef) would release the original reservation.
 *
 * A separate candidate Prisma/MySQL store implements this port, but no provider
 * integration is supplied. In-memory tests alone do not establish database
 * isolation, crash recovery, or production budget enforcement.
 */

export type SpendPeriodTotals = {
  reservedMicros: bigint;
  settledMicros: bigint;
  unknownBoundMicros: bigint;
  unknownCalls: number;
};

export type SpendBudgetPolicy =
  | { mode: "unconfigured" }
  | { mode: "unlimited" }
  | { mode: "limited"; budgetMicros: bigint };

export type ReserveSpendRecord = {
  workspaceId: string;
  periodKey: string;
  periodPolicyVersion: string;
  attemptRef: string;
  reservedMicros: bigint;
  budgetMicros: bigint | null;
  provider: string;
  model: string;
  expiresAt: Date;
};

export type AtomicReservationResult =
  | "reserved"
  | "duplicate"
  | "conflict"
  | "period_policy_conflict"
  | "budget_exhausted";

export type SpendReservationStore = {
  /**
   * One atomic transaction, never independently committed counter/ledger writes.
   * A unique (workspaceId, attemptRef) covers ALL states, including terminal ones.
   * Check that key before budget admission: matching period, policy version,
   * amount, provider and model returns duplicate without any mutation; different
   * identity returns conflict. A retry's expiresAt/budget does not rewrite the
   * original row. Duplicate does NOT grant permission to call the provider again.
   *
   * For a new attempt, reject an existing counter's mismatched policy version.
   * Include reserved + settled + unknownBound + requested in the budget predicate.
   * Null budget means explicitly unlimited, still tracked. Commit counter and
   * ledger together; refusal/definite failure commits neither. Unique-key races
   * must roll back this transaction, never release somebody else's reservation.
   * A lost commit acknowledgement must throw/stop; retry the SAME immutable key
   * to discover its state, rather than releasing or claiming it was not charged.
   */
  reserve: (input: ReserveSpendRecord) => Promise<AtomicReservationResult>;
  /** reserved → settled, moving the amount on the counter. */
  settle: (input: {
    workspaceId: string;
    attemptRef: string;
    settledMicros: bigint;
  }) => Promise<"settled" | "not_reserved">;
  /** reserved → unknown, moving the reservation to the unknown bound. */
  markUnknown: (input: {
    workspaceId: string;
    attemptRef: string;
  }) => Promise<"unknown" | "not_reserved">;
  /** reserved → released, giving the amount back (nothing was consumed). */
  release: (input: {
    workspaceId: string;
    attemptRef: string;
  }) => Promise<"released" | "not_reserved">;
  readTotals: (input: { workspaceId: string; periodKey: string }) => Promise<SpendPeriodTotals>;
  /** Reservations past their expiry, oldest first. */
  listExpiredReservations: (input: {
    now: Date;
    limit: number;
  }) => Promise<Array<{ workspaceId: string; attemptRef: string }>>;
};

export type ReservationOutcome =
  | { admitted: true; attemptRef: string; reservedMicros: bigint }
  | { admitted: false; reason: ReservationRefusalReason };

/** Closed set; each value names a different decision, not a different message. */
export type ReservationRefusalReason =
  /** No policy declared for this workspace. Absence is never read as unlimited. */
  | "budget_unconfigured"
  /** The reservation would exceed the declared ceiling. */
  | "budget_exhausted"
  /** This attempt already exists in any state; never authorize a second call. */
  | "attempt_already_reserved"
  | "attempt_conflict"
  | "period_policy_conflict";

export async function reserveSpend(input: {
  store: SpendReservationStore;
  policy: SpendBudgetPolicy;
  workspaceId: string;
  periodKey: string;
  periodPolicyVersion: string;
  attemptRef: string;
  estimatedMicros: bigint;
  provider: string;
  model: string;
  leaseMs: number;
  now: Date;
}): Promise<ReservationOutcome> {
  // A missing policy is refused, never defaulted. "Nobody configured this" and
  // "deliberately unlimited" must not produce the same behaviour — that is how a
  // workspace ends up with no ceiling because a migration had not run yet.
  if (input.policy.mode === "unconfigured") {
    return { admitted: false, reason: "budget_unconfigured" };
  }
  const amountMicros = input.estimatedMicros < BigInt(0) ? BigInt(0) : input.estimatedMicros;
  const budgetMicros = input.policy.mode === "limited" ? input.policy.budgetMicros : null;

  const result = await input.store.reserve({
    workspaceId: input.workspaceId,
    periodKey: input.periodKey,
    periodPolicyVersion: input.periodPolicyVersion,
    attemptRef: input.attemptRef,
    reservedMicros: amountMicros,
    budgetMicros,
    provider: input.provider,
    model: input.model,
    expiresAt: new Date(input.now.getTime() + input.leaseMs),
  });
  if (result !== "reserved") {
    const reasons = {
      duplicate: "attempt_already_reserved",
      conflict: "attempt_conflict",
      period_policy_conflict: "period_policy_conflict",
      budget_exhausted: "budget_exhausted",
    } as const;
    return { admitted: false, reason: reasons[result] };
  }
  return { admitted: true, attemptRef: input.attemptRef, reservedMicros: amountMicros };
}

export type SettlementOutcome = "settled" | "unknown" | "released" | "not_reserved";

/**
 * Settle a reservation against what the call actually consumed.
 *
 * `known` settles the measured amount. `unknown` keeps the reservation as a
 * conservative bound — it is NOT released, because we do not know that nothing
 * was charged, and releasing would under-count in exactly the direction that
 * hides money. `not_consumed` releases: the provider was never contacted.
 */
export async function settleReservation(input: {
  store: SpendReservationStore;
  workspaceId: string;
  attemptRef: string;
  usage:
    | { kind: "known"; measuredMicros: bigint }
    | { kind: "unknown" }
    | { kind: "not_consumed" };
}): Promise<SettlementOutcome> {
  if (input.usage.kind === "known") {
    const measured = input.usage.measuredMicros < BigInt(0) ? BigInt(0) : input.usage.measuredMicros;
    return await input.store.settle({
      workspaceId: input.workspaceId,
      attemptRef: input.attemptRef,
      settledMicros: measured,
    });
  }
  if (input.usage.kind === "unknown") {
    return await input.store.markUnknown({
      workspaceId: input.workspaceId,
      attemptRef: input.attemptRef,
    });
  }
  return await input.store.release({
    workspaceId: input.workspaceId,
    attemptRef: input.attemptRef,
  });
}

/**
 * Sweep reservations whose call never reported back.
 *
 * They become `unknown`, NOT `released`. A reservation expires because we lost
 * track of the call, not because we learned it was free: the provider may well
 * have charged for it. Releasing would give the budget back for money that was
 * possibly spent — the one direction that makes a ceiling stop being a ceiling.
 *
 * Returns how many were converted, so a caller can tell "nothing expired" from
 * "the sweep did not run".
 */
export async function recoverExpiredReservations(input: {
  store: SpendReservationStore;
  now: Date;
  limit: number;
}): Promise<{ converted: number; scanned: number }> {
  const expired = await input.store.listExpiredReservations({ now: input.now, limit: input.limit });
  let converted = 0;
  for (const row of expired) {
    const outcome = await input.store.markUnknown({
      workspaceId: row.workspaceId,
      attemptRef: row.attemptRef,
    });
    if (outcome === "unknown") converted += 1;
  }
  return { converted, scanned: expired.length };
}
