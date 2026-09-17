/**
 * Reserve-then-settle admission for LLM spend.
 *
 * WHAT THIS FIXES. The budget check used to be a pure read: it computed
 * month-to-date spend, compared it to the budget, and returned. The deduction
 * happened only after the provider answered. So N concurrent callers all read
 * the same total, all passed, and all spent — the check could not refuse a
 * single one of them, because nothing was written between the read and the call.
 *
 * The reservation is the write that makes the check mean something, and it
 * happens BEFORE the provider is contacted.
 *
 * HOW ADMISSION IS ATOMIC. A single conditional update against one
 * per-(workspace, period) counter row, with the pre-state in its own WHERE:
 *
 *   reservedMicros + settledMicros + amount <= budget
 *
 * Exactly one caller wins each unit of budget. This shape is atomic on ANY
 * isolation level, which is deliberate: the MySQL this ships against defaults to
 * READ COMMITTED, and `SELECT SUM(...) FOR UPDATE` would have needed that raised
 * — an RDS parameter change, i.e. an infrastructure dependency for a
 * correctness property. See the LLMSpendPeriodCounter model comment.
 *
 * WHAT THIS MODULE DOES NOT DO. It is not wired into `executeLLMTask`.
 * Enforcement has its own activation conditions (RF-01.8: metering complete,
 * every charged entry point covered, per-workspace approval), and today no
 * workspace has a budget configured at all. Wiring it in here would be an
 * unverifiable behaviour change.
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

/**
 * Store port. Every method is one statement's worth of work so the atomicity
 * lives in the store, not in a sequence the caller has to get right.
 */
export type SpendReservationStore = {
  /**
   * Single conditional update. Returns true only if the counter was actually
   * advanced — a false means the budget would have been exceeded.
   *
   * `budgetMicros === null` means "no ceiling": advance unconditionally.
   */
  tryAdvanceReserved: (input: {
    workspaceId: string;
    periodKey: string;
    periodPolicyVersion: string;
    amountMicros: bigint;
    budgetMicros: bigint | null;
  }) => Promise<boolean>;
  /** Insert the per-attempt row. Must reject a duplicate `attemptRef`. */
  insertReservation: (input: {
    workspaceId: string;
    periodKey: string;
    periodPolicyVersion: string;
    attemptRef: string;
    reservedMicros: bigint;
    provider: string;
    model: string;
    expiresAt: Date;
  }) => Promise<"inserted" | "duplicate">;
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
  /** This attempt already holds a reservation; a retry must not reserve twice. */
  | "attempt_already_reserved";

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

  const advanced = await input.store.tryAdvanceReserved({
    workspaceId: input.workspaceId,
    periodKey: input.periodKey,
    periodPolicyVersion: input.periodPolicyVersion,
    amountMicros,
    budgetMicros,
  });
  if (!advanced) return { admitted: false, reason: "budget_exhausted" };

  const inserted = await input.store.insertReservation({
    workspaceId: input.workspaceId,
    periodKey: input.periodKey,
    periodPolicyVersion: input.periodPolicyVersion,
    attemptRef: input.attemptRef,
    reservedMicros: amountMicros,
    provider: input.provider,
    model: input.model,
    expiresAt: new Date(input.now.getTime() + input.leaseMs),
  });
  if (inserted === "duplicate") {
    // The counter was already advanced for this attempt by the first reservation;
    // give back what this duplicate just took, or the period total drifts up by
    // one estimate per retry and never comes back down.
    await input.store.release({ workspaceId: input.workspaceId, attemptRef: input.attemptRef });
    return { admitted: false, reason: "attempt_already_reserved" };
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
