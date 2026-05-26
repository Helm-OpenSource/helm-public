/**
 * Helm Business Advancement - Phase 3B / TPQR-004 / PF3A-004
 * Customer-waiting planning artifact (planning-only, no runtime adoption).
 *
 * This is the third Phase 3B planning artifact authorized by
 * docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md.
 * Phase 3A closeout granted PF3-004 / TPQR-004 a Conditional Planning Go: any
 * future thin read-model planning that surfaces customer_waiting items must
 * preserve the PF3A-004 ownership rule
 *   merge_and_dedup_by_email_thread_id_after_producers
 * with the deterministic tie-break order
 *   [tpqr004_crm_linked, loadWaitingEmailThreads_generic]
 * (TPQR-004 first, generic loadWaitingEmailThreads second). Any modification
 * to features/mobile/lib/mobile-command-read-model.ts (including
 * loadWaitingEmailThreads, the Promise.all aggregator, and the rendered id
 * shape) is out of Phase 3B scope and would require a separate surface review.
 *
 * Upstream gate (verbatim re-statement):
 *   - PF3A-004 selected merge_and_dedup_by_email_thread_id_after_producers
 *     with tie-break [tpqr004_crm_linked, loadWaitingEmailThreads_generic].
 *   - Phase 3A closeout decision: Phase 3B = conditional partial Go for
 *     PLANNING ONLY. Runtime / schema / API / UI / official write /
 *     automated execution / LLM final ranking / production query path = No-Go.
 *   - Any future thin read-model planning that surfaces TPQR-004 must dedup
 *     by emailThread.id AFTER both producer candidates are built; a single
 *     emailThread.id MUST NOT surface twice.
 *   - The 24h waiting threshold here is a PLANNING CANDIDATE only. It is NOT
 *     a production threshold. Real-data calibration must happen in a separate
 *     review before any runtime adoption.
 *
 * Hard non-goals (preserved):
 *   - No Prisma schema change.
 *   - No modification to features/mobile/lib/mobile-command-read-model.ts
 *     (including loadWaitingEmailThreads, its where clause, the Promise.all
 *     aggregator, or the rendered id shape).
 *   - No modification to data/queries.ts, app/, app/api/, or any lib/* runtime
 *     code path.
 *   - No runtime extractor, no event queue, no background job, no production
 *     query path adoption.
 *   - No LLM final ranking; ordering is deterministic.
 *   - No outbound-system mutation, no automated execution, no auto-send, no
 *     auto-approval.
 *   - No TPQR-002 / TPQR-005 work surface; both remain No-Go in Phase 3B.
 *
 * Planning candidate shape: MustPushItem from ./contracts. Candidates carry
 * planning-only metadata (planningOnly: true, tpqrId, preflightId, signalType,
 * sourceType, ownershipRule, producerId, producerRank, emailThreadId,
 * opportunityIdPresent, lastCustomerMessageAtMs, waitedMs, evaluatedAtMs,
 * sourceRowId, thresholdMs). They are NOT runtime items, NOT commitments, NOT
 * approved actions, and NOT auto-executed.
 */

import type {
  AllowedActionVerb,
  MustPushItem,
  ReviewPosture,
  RiskLevel,
  SignalType,
  SourceType,
} from "./contracts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** TPQR identifier for this planning artifact. */
export const CUSTOMER_WAITING_PLANNING_TPQR_ID = "TPQR-004" as const;

/** Phase 3A preflight identifier this artifact is anchored to. */
export const CUSTOMER_WAITING_PLANNING_PREFLIGHT_ID = "PF3A-004" as const;

/** Source / signal anchor for this artifact. */
export const CUSTOMER_WAITING_PLANNING_SIGNAL_TYPE =
  "customer_waiting" as const satisfies SignalType;

/**
 * SourceType is `combined` because the customer_waiting planning candidate is
 * the merge result of two producers (loadWaitingEmailThreads_generic and
 * tpqr004_crm_linked) deduped by emailThread.id. The contract vocabulary in
 * ./contracts is preserved unchanged.
 */
export const CUSTOMER_WAITING_PLANNING_SOURCE_TYPE = "combined" as const satisfies SourceType;

/**
 * PF3A-004 ownership rule (planning-only). Any future thin read-model
 * planning that surfaces customer_waiting MUST preserve this rule.
 */
export const CUSTOMER_WAITING_PLANNING_OWNERSHIP_RULE =
  "merge_and_dedup_by_email_thread_id_after_producers" as const;

/**
 * Producers carried forward from PF3A-004. Lower producerRank wins on
 * emailThread.id collision; this encodes the deterministic tie-break order.
 */
export type CustomerWaitingProducerId =
  | "tpqr004_crm_linked"
  | "loadWaitingEmailThreads_generic";

/**
 * Deterministic tie-break order:
 *   [tpqr004_crm_linked, loadWaitingEmailThreads_generic]
 * (TPQR-004 first, generic second).
 */
export const CUSTOMER_WAITING_PLANNING_TIE_BREAK_ORDER: readonly CustomerWaitingProducerId[] =
  ["tpqr004_crm_linked", "loadWaitingEmailThreads_generic"];

/**
 * Producer rank: lower wins. tpqr004_crm_linked = 0 ensures the CRM-linked
 * candidate beats the generic loadWaitingEmailThreads candidate when both
 * surface the same emailThread.id.
 */
export const CUSTOMER_WAITING_PLANNING_PRODUCER_RANK: Readonly<
  Record<CustomerWaitingProducerId, number>
> = {
  tpqr004_crm_linked: 0,
  loadWaitingEmailThreads_generic: 1,
};

/**
 * 24 hours in milliseconds. PLANNING CANDIDATE only - never a production
 * threshold and never a green-light to adopt this rule in runtime queries.
 */
export const CUSTOMER_WAITING_PLANNING_THRESHOLD_MS: number =
  24 * 60 * 60 * 1000;

/**
 * Deterministic reference clock used by the bundled fixture set and the CLI
 * script. Callers MUST pass an explicit referenceClockMs into the helpers;
 * this constant is exposed only so the bundled fixture has a stable anchor.
 *
 * Pure: Date.UTC is a stateless arithmetic on its arguments.
 */
export const CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS: number = Date.UTC(
  2026,
  3,
  26,
  0,
  0,
  0,
  0,
);

// ---------------------------------------------------------------------------
// Source-row types (planning-only fixture, NOT runtime data)
// ---------------------------------------------------------------------------

/**
 * One synthetic customer-waiting planning source row. These rows are NOT
 * runtime data. They model the SHAPE of a producer-emitted email-thread row
 * (either the TPQR-004 CRM-linked producer or the existing generic
 * loadWaitingEmailThreads producer) that a future thin read-model planning
 * step MIGHT consider, without any schema or runtime change today.
 */
export interface CustomerWaitingPlanningSourceRow {
  /** Stable identifier for this fixture row. */
  readonly rowId: string;
  /** Workspace scope (synthetic). */
  readonly workspaceId: string;
  /** Whether workspace membership has been confirmed for this row. */
  readonly workspaceMembershipConfirmed: boolean;
  /** Which producer emitted this row. */
  readonly producerId: CustomerWaitingProducerId;
  /** Underlying EmailThread.id - the dedup key. */
  readonly emailThreadId: string;
  /** Whether the underlying EmailThread.opportunityId is set in the fixture. */
  readonly opportunityIdPresent: boolean;
  /** Short human-readable title for the waiting thread. */
  readonly title: string;
  /**
   * Synthetic timestamp (epoch ms) of the last customer message on this
   * thread. waitedMs is derived as referenceClockMs - lastCustomerMessageAtMs.
   */
  readonly lastCustomerMessageAtMs: number;
  /** Planning-only evidence references (NOT runtime evidence). */
  readonly evidenceRefs: readonly string[];
  /** Source scenario summary used to seed candidate.sourceSummary. */
  readonly sourceScenario: string;
}

// ---------------------------------------------------------------------------
// Exclusion reasons
// ---------------------------------------------------------------------------

/**
 * Deterministic exclusion reasons. Per-row evaluation reasons are evaluated in
 * the priority order:
 *   workspace_boundary_not_confirmed > threshold_not_met
 * The dedup step adds a separate reason
 *   deduped_by_email_thread_id_after_producers
 * for any candidate that lost the PF3A-004 emailThread.id tie-break.
 */
export type CustomerWaitingExclusionReason =
  | "threshold_not_met"
  | "workspace_boundary_not_confirmed"
  | "deduped_by_email_thread_id_after_producers";

// ---------------------------------------------------------------------------
// Planning candidate shape (MustPushItem-shaped, PLANNING-ONLY)
// ---------------------------------------------------------------------------

/**
 * CustomerWaitingPlanningCandidate - MustPushItem-shaped planning candidate.
 *
 * The base shape (itemId / title / reason / evidenceRefs / primaryAction /
 * boundaryNote / reviewPosture / sourceSummary / riskLevel / sortKey) conforms
 * to MustPushItem from ./contracts so a downstream thin read-model planning
 * step can align without re-defining the contract.
 *
 * Extra metadata (planningOnly / tpqrId / preflightId / signalType / sourceType /
 * ownershipRule / producerId / producerRank / emailThreadId /
 * opportunityIdPresent / lastCustomerMessageAtMs / waitedMs / evaluatedAtMs /
 * sourceRowId / thresholdMs) is PLANNING-ONLY and explicitly marks the
 * candidate as not a runtime item, not an approved action, and not an
 * auto-executed item.
 */
export interface CustomerWaitingPlanningCandidate extends MustPushItem {
  readonly planningOnly: true;
  readonly tpqrId: typeof CUSTOMER_WAITING_PLANNING_TPQR_ID;
  readonly preflightId: typeof CUSTOMER_WAITING_PLANNING_PREFLIGHT_ID;
  readonly signalType: typeof CUSTOMER_WAITING_PLANNING_SIGNAL_TYPE;
  readonly sourceType: typeof CUSTOMER_WAITING_PLANNING_SOURCE_TYPE;
  readonly ownershipRule: typeof CUSTOMER_WAITING_PLANNING_OWNERSHIP_RULE;
  readonly producerId: CustomerWaitingProducerId;
  readonly producerRank: number;
  readonly emailThreadId: string;
  readonly opportunityIdPresent: boolean;
  readonly lastCustomerMessageAtMs: number;
  readonly waitedMs: number;
  readonly evaluatedAtMs: number;
  readonly sourceRowId: string;
  readonly thresholdMs: number;
}

// ---------------------------------------------------------------------------
// Excluded row record
// ---------------------------------------------------------------------------

export interface CustomerWaitingExcludedRow {
  readonly sourceRowId: string;
  readonly reason: CustomerWaitingExclusionReason;
  readonly detail: string;
}

// ---------------------------------------------------------------------------
// Per-row evaluation result (pure)
// ---------------------------------------------------------------------------

export type CustomerWaitingRowEvaluation =
  | {
      readonly included: true;
      readonly candidate: CustomerWaitingPlanningCandidate;
    }
  | {
      readonly included: false;
      readonly excluded: CustomerWaitingExcludedRow;
    };

// ---------------------------------------------------------------------------
// Eval check / summary types
// ---------------------------------------------------------------------------

export interface CustomerWaitingPlanningCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface CustomerWaitingPlanningSummary {
  readonly tpqrId: typeof CUSTOMER_WAITING_PLANNING_TPQR_ID;
  readonly preflightId: typeof CUSTOMER_WAITING_PLANNING_PREFLIGHT_ID;
  readonly ownershipRule: typeof CUSTOMER_WAITING_PLANNING_OWNERSHIP_RULE;
  readonly tieBreakOrder: readonly CustomerWaitingProducerId[];
  readonly thresholdMs: number;
  readonly referenceClockMs: number;
  readonly totalSourceRows: number;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly candidates: readonly CustomerWaitingPlanningCandidate[];
  readonly excluded: readonly CustomerWaitingExcludedRow[];
  readonly checks: readonly CustomerWaitingPlanningCheckResult[];
  readonly allPassed: boolean;
}

// ---------------------------------------------------------------------------
// Boundary notes (carry recommendation / explanation / draft / proof distinctions)
// ---------------------------------------------------------------------------

const SHARED_BOUNDARY_NOTE_PARTS: readonly string[] = [
  "recommendation != commitment - planning candidate only, never an external commitment.",
  "explanation != approval - citing email-thread evidence does not approve a customer reply or assign an owner.",
  "draft != send - any drafted reply must be reviewed before send.",
  "proof != external write success - verifying the planning shape does not authorize outbound-system mutation or automated execution.",
  "PF3A-004 / TPQR-004 Phase 3B planning-only - merge_and_dedup_by_email_thread_id_after_producers ownership only with TPQR-004-first tie-break, no runtime extractor, no schema change, no API route, no page behavior change, no production query path, deterministic ordering only, no modification to features/mobile/lib/mobile-command-read-model.ts.",
];

const SHARED_BOUNDARY_NOTE = SHARED_BOUNDARY_NOTE_PARTS.join(" ");

// ---------------------------------------------------------------------------
// Planning fixture rows (TPQR-004 only; deterministic; non-runtime)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS: readonly CustomerWaitingPlanningSourceRow[] =
  [
    // -----------------------------------------------------------------------
    // CW-PLAN-001 - TPQR-004 CRM-linked, 4d wait, workspace confirmed.
    // Pairs with CW-PLAN-002 on the same emailThreadId.
    // Expected: included (wins dedup tie-break against generic).
    // -----------------------------------------------------------------------
    {
      rowId: "CW-PLAN-001",
      workspaceId: "ws-synth-tpqr004-a",
      workspaceMembershipConfirmed: true,
      producerId: "tpqr004_crm_linked",
      emailThreadId: "em-thread-shared",
      opportunityIdPresent: true,
      title: "CRM-linked waiting thread for renewal pricing (planning candidate)",
      lastCustomerMessageAtMs:
        CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS - 4 * DAY_MS,
      evidenceRefs: [
        "synthetic email thread: customer asked about renewal pricing 4 days ago, no reply yet",
        "synthetic CRM linkage: opportunityId set, opportunity stage non-terminal",
      ],
      sourceScenario:
        "Customer is waiting on a renewal pricing reply on a CRM-linked email thread; the TPQR-004 producer surfaces this with stronger CRM context.",
    },

    // -----------------------------------------------------------------------
    // CW-PLAN-002 - generic loadWaitingEmailThreads, SAME emailThreadId as 001.
    // 4d wait, workspace confirmed.
    // Expected: excluded with reason deduped_by_email_thread_id_after_producers
    // (loses to CW-PLAN-001 under TPQR-004-first tie-break).
    // -----------------------------------------------------------------------
    {
      rowId: "CW-PLAN-002",
      workspaceId: "ws-synth-tpqr004-a",
      workspaceMembershipConfirmed: true,
      producerId: "loadWaitingEmailThreads_generic",
      emailThreadId: "em-thread-shared",
      opportunityIdPresent: true,
      title:
        "Generic waiting thread (same emailThreadId as CRM-linked) (planning candidate)",
      lastCustomerMessageAtMs:
        CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS - 4 * DAY_MS,
      evidenceRefs: [
        "synthetic email thread: same emailThreadId as the CRM-linked CW-PLAN-001 row",
      ],
      sourceScenario:
        "The generic loadWaitingEmailThreads producer also surfaces the same emailThreadId; the PF3A-004 ownership rule requires this duplicate be deduped after producers in favor of the TPQR-004 CRM-linked row.",
    },

    // -----------------------------------------------------------------------
    // CW-PLAN-003 - generic loadWaitingEmailThreads only (no CRM linkage),
    // distinct emailThreadId, 3d wait, workspace confirmed.
    // Expected: included (no TPQR-004 row exists for this emailThreadId).
    // -----------------------------------------------------------------------
    {
      rowId: "CW-PLAN-003",
      workspaceId: "ws-synth-tpqr004-a",
      workspaceMembershipConfirmed: true,
      producerId: "loadWaitingEmailThreads_generic",
      emailThreadId: "em-thread-generic-only",
      opportunityIdPresent: false,
      title: "Generic waiting thread without CRM linkage (planning candidate)",
      lastCustomerMessageAtMs:
        CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS - 3 * DAY_MS,
      evidenceRefs: [
        "synthetic email thread: no opportunity linkage, customer waiting 3 days",
      ],
      sourceScenario:
        "The generic loadWaitingEmailThreads producer surfaces a non-CRM-linked thread; no TPQR-004 row exists for this emailThreadId, so the generic row remains.",
    },

    // -----------------------------------------------------------------------
    // CW-PLAN-004 - generic loadWaitingEmailThreads, fresh (6h wait < 24h),
    // workspace confirmed.
    // Expected: excluded with reason threshold_not_met.
    // -----------------------------------------------------------------------
    {
      rowId: "CW-PLAN-004",
      workspaceId: "ws-synth-tpqr004-a",
      workspaceMembershipConfirmed: true,
      producerId: "loadWaitingEmailThreads_generic",
      emailThreadId: "em-thread-fresh",
      opportunityIdPresent: false,
      title:
        "Fresh waiting thread under planning threshold (planning candidate)",
      lastCustomerMessageAtMs:
        CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS - 6 * HOUR_MS,
      evidenceRefs: [
        "synthetic email thread: customer message arrived 6 hours ago",
      ],
      sourceScenario:
        "Customer message arrived 6 hours ago; the 24h planning threshold has not been crossed yet.",
    },

    // -----------------------------------------------------------------------
    // CW-PLAN-005 - TPQR-004 CRM-linked, 5d wait, workspace NOT confirmed.
    // Expected: excluded with reason workspace_boundary_not_confirmed.
    // -----------------------------------------------------------------------
    {
      rowId: "CW-PLAN-005",
      workspaceId: "ws-synth-tpqr004-b",
      workspaceMembershipConfirmed: false,
      producerId: "tpqr004_crm_linked",
      emailThreadId: "em-thread-cross-workspace",
      opportunityIdPresent: true,
      title: "Cross-workspace waiting thread (planning candidate)",
      lastCustomerMessageAtMs:
        CUSTOMER_WAITING_PLANNING_REFERENCE_CLOCK_MS - 5 * DAY_MS,
      evidenceRefs: [
        "synthetic email thread: workspace membership not confirmed for the requesting principal",
      ],
      sourceScenario:
        "Workspace membership boundary is not confirmed for this row; cross-workspace exposure would violate the workspace-first isolation contract.",
    },
  ] as const;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const REVIEW_POSTURE_FOR_CUSTOMER_WAITING: ReviewPosture =
  "human_owner_required";
const RISK_LEVEL_FOR_CUSTOMER_WAITING: RiskLevel = "high";
const PRIMARY_ACTION_VERB: AllowedActionVerb = "review";

/**
 * Compute waitedMs in milliseconds for a row at a given reference clock.
 *
 * Returns 0 when lastCustomerMessageAtMs is in the future or equals the
 * reference clock. Pure.
 */
export function computeCustomerWaitingWaitedMs(
  row: CustomerWaitingPlanningSourceRow,
  referenceClockMs: number,
): number {
  const raw = referenceClockMs - row.lastCustomerMessageAtMs;
  return raw > 0 ? raw : 0;
}

/**
 * Look up the deterministic producer rank for a producer id. Lower wins.
 * Pure stateless lookup.
 */
export function customerWaitingProducerRank(
  producerId: CustomerWaitingProducerId,
): number {
  return CUSTOMER_WAITING_PLANNING_PRODUCER_RANK[producerId];
}

/**
 * Evaluate one source row deterministically.
 *
 * Priority order (highest first):
 *   1. workspace_boundary_not_confirmed (any row with unconfirmed membership)
 *   2. threshold_not_met (waitedMs <= thresholdMs)
 *   3. otherwise emit a producer-level candidate.
 *
 * The dedup step in buildCustomerWaitingPlanningCandidates runs AFTER this
 * function emits per-producer candidates; per-row evaluation does NOT see
 * other rows.
 *
 * Pure: no DB / network / Date.now side effect.
 */
export function evaluateCustomerWaitingRow(
  row: CustomerWaitingPlanningSourceRow,
  referenceClockMs: number,
): CustomerWaitingRowEvaluation {
  if (!row.workspaceMembershipConfirmed) {
    return {
      included: false,
      excluded: {
        sourceRowId: row.rowId,
        reason: "workspace_boundary_not_confirmed",
        detail:
          "workspaceMembershipConfirmed is false; the workspace-first isolation boundary blocks this row from becoming a planning candidate.",
      },
    };
  }
  const waitedMs = computeCustomerWaitingWaitedMs(row, referenceClockMs);
  if (waitedMs <= CUSTOMER_WAITING_PLANNING_THRESHOLD_MS) {
    return {
      included: false,
      excluded: {
        sourceRowId: row.rowId,
        reason: "threshold_not_met",
        detail: `waitedMs (${waitedMs}) does not exceed the 24h customer-waiting planning threshold (${CUSTOMER_WAITING_PLANNING_THRESHOLD_MS}).`,
      },
    };
  }

  const producerRank = customerWaitingProducerRank(row.producerId);
  const primaryAction = `${PRIMARY_ACTION_VERB}: email thread ${row.emailThreadId} (review required; planning candidate)`;
  const candidate: CustomerWaitingPlanningCandidate = {
    itemId: `${row.rowId}-candidate`,
    title: row.title,
    reason: `Customer waiting beyond the 24h planning threshold (waitedMs=${waitedMs}, producer=${row.producerId}); planning candidate only.`,
    evidenceRefs: row.evidenceRefs,
    primaryAction,
    boundaryNote: SHARED_BOUNDARY_NOTE,
    reviewPosture: REVIEW_POSTURE_FOR_CUSTOMER_WAITING,
    sourceSummary: row.sourceScenario,
    riskLevel: RISK_LEVEL_FOR_CUSTOMER_WAITING,
    // Placeholder; replaced by deterministic ranker below.
    sortKey: 0,
    planningOnly: true,
    tpqrId: CUSTOMER_WAITING_PLANNING_TPQR_ID,
    preflightId: CUSTOMER_WAITING_PLANNING_PREFLIGHT_ID,
    signalType: CUSTOMER_WAITING_PLANNING_SIGNAL_TYPE,
    sourceType: CUSTOMER_WAITING_PLANNING_SOURCE_TYPE,
    ownershipRule: CUSTOMER_WAITING_PLANNING_OWNERSHIP_RULE,
    producerId: row.producerId,
    producerRank,
    emailThreadId: row.emailThreadId,
    opportunityIdPresent: row.opportunityIdPresent,
    lastCustomerMessageAtMs: row.lastCustomerMessageAtMs,
    waitedMs,
    evaluatedAtMs: referenceClockMs,
    sourceRowId: row.rowId,
    thresholdMs: CUSTOMER_WAITING_PLANNING_THRESHOLD_MS,
  };
  return { included: true, candidate };
}

/**
 * Pick the winner for a single emailThread.id collision under PF3A-004
 * tie-break: lower producerRank wins (TPQR-004 first); on equal rank, lower
 * sourceRowId (lexicographic) wins. Pure.
 */
function pickEmailThreadDedupWinner(
  peers: readonly CustomerWaitingPlanningCandidate[],
): CustomerWaitingPlanningCandidate {
  let winner = peers[0];
  for (let i = 1; i < peers.length; i += 1) {
    const peer = peers[i];
    if (peer.producerRank < winner.producerRank) {
      winner = peer;
    } else if (
      peer.producerRank === winner.producerRank &&
      peer.sourceRowId < winner.sourceRowId
    ) {
      winner = peer;
    }
  }
  return winner;
}

/**
 * Dedup pre-built per-producer candidates by emailThread.id AFTER both
 * producers have run. Returns the winners (one per emailThread.id) and the
 * losers (the candidates that were deduped away). Pure.
 *
 * This step is the deterministic enforcement of the PF3A-004 ownership rule
 * `merge_and_dedup_by_email_thread_id_after_producers`.
 */
export function dedupCustomerWaitingByEmailThreadIdAfterProducers(
  candidates: readonly CustomerWaitingPlanningCandidate[],
): {
  readonly winners: readonly CustomerWaitingPlanningCandidate[];
  readonly losers: readonly CustomerWaitingPlanningCandidate[];
} {
  const groups = new Map<string, CustomerWaitingPlanningCandidate[]>();
  for (const candidate of candidates) {
    const arr = groups.get(candidate.emailThreadId);
    if (arr) {
      arr.push(candidate);
    } else {
      groups.set(candidate.emailThreadId, [candidate]);
    }
  }
  const winners: CustomerWaitingPlanningCandidate[] = [];
  const losers: CustomerWaitingPlanningCandidate[] = [];
  for (const peers of groups.values()) {
    const winner = pickEmailThreadDedupWinner(peers);
    winners.push(winner);
    for (const peer of peers) {
      if (peer.sourceRowId !== winner.sourceRowId) {
        losers.push(peer);
      }
    }
  }
  return { winners, losers };
}

/**
 * Compare two candidates deterministically.
 *
 * Order:
 *   1. larger waitedMs first (most-waited first).
 *   2. lower producerRank (TPQR-004 first).
 *   3. lexicographically smaller emailThreadId.
 *   4. lexicographically smaller sourceRowId.
 *
 * Pure / total / antisymmetric.
 */
export function compareCustomerWaitingCandidates(
  a: CustomerWaitingPlanningCandidate,
  b: CustomerWaitingPlanningCandidate,
): number {
  if (a.waitedMs !== b.waitedMs) {
    return b.waitedMs - a.waitedMs;
  }
  if (a.producerRank !== b.producerRank) {
    return a.producerRank - b.producerRank;
  }
  if (a.emailThreadId < b.emailThreadId) {
    return -1;
  }
  if (a.emailThreadId > b.emailThreadId) {
    return 1;
  }
  if (a.sourceRowId < b.sourceRowId) {
    return -1;
  }
  if (a.sourceRowId > b.sourceRowId) {
    return 1;
  }
  return 0;
}

/**
 * Build the deterministic candidate set for a given row collection and clock.
 * Returns a fresh array (input rows are not mutated). Pure.
 *
 * Pipeline:
 *   1. Per-row evaluation (workspace boundary > threshold).
 *   2. Dedup by emailThread.id AFTER producers (PF3A-004 ownership rule with
 *      TPQR-004-first tie-break).
 *   3. Deterministic ordering and zero-based contiguous sortKey assignment.
 */
export function buildCustomerWaitingPlanningCandidates(
  rows: readonly CustomerWaitingPlanningSourceRow[],
  referenceClockMs: number,
): {
  readonly candidates: readonly CustomerWaitingPlanningCandidate[];
  readonly excluded: readonly CustomerWaitingExcludedRow[];
} {
  const perProducerCandidates: CustomerWaitingPlanningCandidate[] = [];
  const excluded: CustomerWaitingExcludedRow[] = [];
  for (const row of rows) {
    const result = evaluateCustomerWaitingRow(row, referenceClockMs);
    if (result.included) {
      perProducerCandidates.push(result.candidate);
    } else {
      excluded.push(result.excluded);
    }
  }

  const { winners, losers } = dedupCustomerWaitingByEmailThreadIdAfterProducers(
    perProducerCandidates,
  );

  for (const loser of losers) {
    const winner = winners.find(
      (w) => w.emailThreadId === loser.emailThreadId,
    );
    const winnerSummary = winner
      ? `winner: producer="${winner.producerId}", sourceRowId="${winner.sourceRowId}"`
      : "winner: none";
    excluded.push({
      sourceRowId: loser.sourceRowId,
      reason: "deduped_by_email_thread_id_after_producers",
      detail: `emailThreadId="${loser.emailThreadId}" already surfaced by another producer; PF3A-004 ownership rule merge_and_dedup_by_email_thread_id_after_producers with TPQR-004-first tie-break removed this duplicate (${winnerSummary}).`,
    });
  }

  const ordered = [...winners].sort(compareCustomerWaitingCandidates);
  const candidates: CustomerWaitingPlanningCandidate[] = ordered.map(
    (candidate, index) => ({ ...candidate, sortKey: index }),
  );
  excluded.sort((a, b) => {
    if (a.sourceRowId < b.sourceRowId) {
      return -1;
    }
    if (a.sourceRowId > b.sourceRowId) {
      return 1;
    }
    return 0;
  });
  return { candidates, excluded };
}

// ---------------------------------------------------------------------------
// Forbidden authorization wording (must not appear in any planning text)
// ---------------------------------------------------------------------------

const FORBIDDEN_AUTHORIZATION_PATTERNS = [
  "auto_execute",
  "auto execute",
  "auto-execute",
  "auto-execution",
  "official_write",
  "official write",
  "auto_send",
  "auto send",
  "auto-send",
  "auto_approve",
  "auto approve",
  "auto-approve",
  "auto-approval",
  "auto_settlement",
  "auto settlement",
  "cross_tenant",
  "cross-tenant",
  "llm_rank",
  "llm rank",
  "llm final ranking",
  "llm may determine",
  "llm may rank",
  "production query adoption",
  "approves runtime adoption",
  "approves production query adoption",
  "may add a schema",
  "may add schema",
  "may add runtime extractor",
  "may add a runtime extractor",
  "may create extractor",
  "may add event queue",
  "may create event queue",
  "may auto-write",
  "may auto write",
  "grants execution authority",
  "may change page behavior",
  "may add api route",
  "may add a api route",
  "may add an api route",
] as const;

const REQUIRED_BOUNDARY_PHRASES = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

// ---------------------------------------------------------------------------
// Evaluator (pure, no side effects)
// ---------------------------------------------------------------------------

function checkOnlyTpqr004Rows(
  candidates: readonly CustomerWaitingPlanningCandidate[],
): CustomerWaitingPlanningCheckResult {
  const violations: string[] = [];
  for (const candidate of candidates) {
    if (candidate.tpqrId !== CUSTOMER_WAITING_PLANNING_TPQR_ID) {
      violations.push(`${candidate.itemId}: tpqrId="${candidate.tpqrId}"`);
    }
    if (candidate.preflightId !== CUSTOMER_WAITING_PLANNING_PREFLIGHT_ID) {
      violations.push(
        `${candidate.itemId}: preflightId="${candidate.preflightId}"`,
      );
    }
    if (candidate.signalType !== CUSTOMER_WAITING_PLANNING_SIGNAL_TYPE) {
      violations.push(
        `${candidate.itemId}: signalType="${candidate.signalType}"`,
      );
    }
    if (candidate.sourceType !== CUSTOMER_WAITING_PLANNING_SOURCE_TYPE) {
      violations.push(
        `${candidate.itemId}: sourceType="${candidate.sourceType}"`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "only_tpqr004_customer_waiting_rows",
    passed,
    detail: passed
      ? "All candidates carry tpqrId=TPQR-004 / preflightId=PF3A-004 / signalType=customer_waiting / sourceType=combined."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkDedupOwnershipRule(
  rows: readonly CustomerWaitingPlanningSourceRow[],
  referenceClockMs: number,
  candidates: readonly CustomerWaitingPlanningCandidate[],
  excluded: readonly CustomerWaitingExcludedRow[],
): CustomerWaitingPlanningCheckResult {
  const violations: string[] = [];

  // Every candidate must carry the ownership rule constant.
  for (const candidate of candidates) {
    if (candidate.ownershipRule !== CUSTOMER_WAITING_PLANNING_OWNERSHIP_RULE) {
      violations.push(
        `${candidate.itemId}: ownershipRule="${candidate.ownershipRule}"`,
      );
    }
    if (
      candidate.producerRank !==
      CUSTOMER_WAITING_PLANNING_PRODUCER_RANK[candidate.producerId]
    ) {
      violations.push(
        `${candidate.itemId}: producerRank (${candidate.producerRank}) does not match the canonical rank for producer "${candidate.producerId}"`,
      );
    }
  }

  // Tie-break order must be [tpqr004_crm_linked, loadWaitingEmailThreads_generic].
  const tieBreak = CUSTOMER_WAITING_PLANNING_TIE_BREAK_ORDER;
  if (
    tieBreak.length !== 2 ||
    tieBreak[0] !== "tpqr004_crm_linked" ||
    tieBreak[1] !== "loadWaitingEmailThreads_generic"
  ) {
    violations.push(
      `tie-break order is not [tpqr004_crm_linked, loadWaitingEmailThreads_generic]: got [${tieBreak.join(", ")}]`,
    );
  }

  // Producer ranks must encode the same order: tpqr004 < generic.
  if (
    !(
      CUSTOMER_WAITING_PLANNING_PRODUCER_RANK.tpqr004_crm_linked <
      CUSTOMER_WAITING_PLANNING_PRODUCER_RANK.loadWaitingEmailThreads_generic
    )
  ) {
    violations.push(
      "producerRank does not encode TPQR-004 first (tpqr004_crm_linked must have a lower rank than loadWaitingEmailThreads_generic).",
    );
  }

  // Deterministic dedup proof: when both producers emit the same emailThreadId,
  // the TPQR-004 candidate must win regardless of input order.
  const referenceTimestamp = referenceClockMs - 5 * DAY_MS;
  const overlapping: readonly CustomerWaitingPlanningSourceRow[] = [
    {
      rowId: "DEDUP-PROOF-A",
      workspaceId: "ws-dedup",
      workspaceMembershipConfirmed: true,
      producerId: "loadWaitingEmailThreads_generic",
      emailThreadId: "em-dedup-shared",
      opportunityIdPresent: true,
      title: "dedup proof generic",
      lastCustomerMessageAtMs: referenceTimestamp,
      evidenceRefs: ["dedup proof generic evidence"],
      sourceScenario: "dedup proof generic scenario",
    },
    {
      rowId: "DEDUP-PROOF-B",
      workspaceId: "ws-dedup",
      workspaceMembershipConfirmed: true,
      producerId: "tpqr004_crm_linked",
      emailThreadId: "em-dedup-shared",
      opportunityIdPresent: true,
      title: "dedup proof tpqr004",
      lastCustomerMessageAtMs: referenceTimestamp,
      evidenceRefs: ["dedup proof tpqr004 evidence"],
      sourceScenario: "dedup proof tpqr004 scenario",
    },
  ];
  for (const inputOrder of [overlapping, [...overlapping].reverse()]) {
    const built = buildCustomerWaitingPlanningCandidates(
      inputOrder,
      referenceClockMs,
    );
    if (built.candidates.length !== 1) {
      violations.push(
        `dedup proof produced ${built.candidates.length} candidate(s); expected exactly 1 winner per emailThreadId.`,
      );
      continue;
    }
    if (built.candidates[0].producerId !== "tpqr004_crm_linked") {
      violations.push(
        `dedup proof did not honor TPQR-004-first tie-break: winner producer="${built.candidates[0].producerId}".`,
      );
    }
    const dedupedRow = built.excluded.find(
      (row) => row.reason === "deduped_by_email_thread_id_after_producers",
    );
    if (!dedupedRow) {
      violations.push(
        "dedup proof did not emit a deduped_by_email_thread_id_after_producers exclusion for the loser.",
      );
    }
  }

  // The bundled fixture must record at least one dedup-loser exclusion when
  // both producers overlap on the same emailThreadId.
  const overlapInRows = new Map<string, Set<CustomerWaitingProducerId>>();
  for (const row of rows) {
    const existing = overlapInRows.get(row.emailThreadId) ?? new Set();
    existing.add(row.producerId);
    overlapInRows.set(row.emailThreadId, existing);
  }
  const hasOverlap = [...overlapInRows.values()].some((set) => set.size >= 2);
  const recordedDedupLosers = excluded.filter(
    (row) => row.reason === "deduped_by_email_thread_id_after_producers",
  );
  if (hasOverlap && recordedDedupLosers.length === 0) {
    violations.push(
      "fixture contains overlapping emailThreadId across producers but no deduped_by_email_thread_id_after_producers exclusion was emitted.",
    );
  }

  const passed = violations.length === 0;
  return {
    checkName:
      "dedup_ownership_rule_is_merge_and_dedup_after_producers_with_tpqr004_first",
    passed,
    detail: passed
      ? "All candidates carry ownershipRule=merge_and_dedup_by_email_thread_id_after_producers; tie-break is [tpqr004_crm_linked, loadWaitingEmailThreads_generic]; deterministic dedup proof confirms TPQR-004-first regardless of input order."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkNoDuplicateEmailThreadIdInFinalCandidates(
  candidates: readonly CustomerWaitingPlanningCandidate[],
): CustomerWaitingPlanningCheckResult {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.emailThreadId)) {
      duplicates.push(candidate.emailThreadId);
    } else {
      seen.add(candidate.emailThreadId);
    }
  }
  const passed = duplicates.length === 0;
  return {
    checkName: "no_duplicate_email_thread_id_in_final_candidates",
    passed,
    detail: passed
      ? "Final candidate set has no duplicate emailThreadId."
      : `Duplicate emailThreadId values: ${duplicates.join(", ")}`,
  };
}

function checkNoRuntimeOrSchemaOrWriteAuthority(
  candidates: readonly CustomerWaitingPlanningCandidate[],
  excluded: readonly CustomerWaitingExcludedRow[],
): CustomerWaitingPlanningCheckResult {
  const violations: string[] = [];
  for (const candidate of candidates) {
    const fields: string[] = [
      candidate.title,
      candidate.reason,
      candidate.primaryAction,
      candidate.boundaryNote,
      candidate.sourceSummary,
      ...candidate.evidenceRefs,
    ];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(
            `${candidate.itemId}: forbidden authorization wording "${pattern}"`,
          );
        }
      }
    }
    if (candidate.planningOnly !== true) {
      violations.push(`${candidate.itemId}: planningOnly is not true`);
    }
  }
  for (const row of excluded) {
    const lower = row.detail.toLowerCase();
    for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
      if (lower.includes(pattern)) {
        violations.push(
          `${row.sourceRowId}: forbidden authorization wording in excluded reason "${pattern}"`,
        );
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "no_runtime_schema_or_write_authority",
    passed,
    detail: passed
      ? "No candidate or excluded reason carries runtime / schema / write / automated-execution / LLM-ranking authority."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkMembershipBoundaryPresent(
  rows: readonly CustomerWaitingPlanningSourceRow[],
  candidates: readonly CustomerWaitingPlanningCandidate[],
): CustomerWaitingPlanningCheckResult {
  const violations: string[] = [];
  for (const row of rows) {
    if (typeof row.workspaceMembershipConfirmed !== "boolean") {
      violations.push(`${row.rowId}: workspaceMembershipConfirmed missing`);
    }
    if (row.workspaceId.trim() === "") {
      violations.push(`${row.rowId}: workspaceId is empty`);
    }
  }
  for (const candidate of candidates) {
    const sourceRow = rows.find((r) => r.rowId === candidate.sourceRowId);
    if (!sourceRow) {
      violations.push(
        `${candidate.itemId}: candidate has no matching source row`,
      );
      continue;
    }
    if (sourceRow.workspaceMembershipConfirmed !== true) {
      violations.push(
        `${candidate.itemId}: included candidate sourced from row with workspaceMembershipConfirmed=false`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "workspace_membership_boundary_present",
    passed,
    detail: passed
      ? "Every source row carries workspaceId / workspaceMembershipConfirmed; only confirmed-membership rows can be included."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkExcludedRowsHaveReasons(
  excluded: readonly CustomerWaitingExcludedRow[],
): CustomerWaitingPlanningCheckResult {
  const allowed = new Set<CustomerWaitingExclusionReason>([
    "threshold_not_met",
    "workspace_boundary_not_confirmed",
    "deduped_by_email_thread_id_after_producers",
  ]);
  const violations: string[] = [];
  for (const row of excluded) {
    if (!allowed.has(row.reason)) {
      violations.push(`${row.sourceRowId}: invalid reason="${row.reason}"`);
    }
    if (row.detail.trim() === "") {
      violations.push(`${row.sourceRowId}: empty exclusion detail`);
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "excluded_rows_have_reasons",
    passed,
    detail: passed
      ? `All ${excluded.length} excluded row(s) carry a deterministic reason from the allowed vocabulary.`
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkDeterministicOrdering(
  rows: readonly CustomerWaitingPlanningSourceRow[],
  referenceClockMs: number,
  candidates: readonly CustomerWaitingPlanningCandidate[],
): CustomerWaitingPlanningCheckResult {
  const reversed = [...rows].reverse();
  const rebuilt = buildCustomerWaitingPlanningCandidates(
    reversed,
    referenceClockMs,
  ).candidates;
  if (rebuilt.length !== candidates.length) {
    return {
      checkName: "deterministic_ordering",
      passed: false,
      detail: `Re-ordered input produced ${rebuilt.length} candidates vs ${candidates.length}.`,
    };
  }
  for (let i = 0; i < candidates.length; i += 1) {
    if (rebuilt[i].itemId !== candidates[i].itemId) {
      return {
        checkName: "deterministic_ordering",
        passed: false,
        detail: `Candidate at position ${i} differs after input reorder: original=${candidates[i].itemId} rebuilt=${rebuilt[i].itemId}.`,
      };
    }
    if (rebuilt[i].sortKey !== candidates[i].sortKey) {
      return {
        checkName: "deterministic_ordering",
        passed: false,
        detail: `sortKey at position ${i} differs after input reorder: original=${candidates[i].sortKey} rebuilt=${rebuilt[i].sortKey}.`,
      };
    }
  }
  for (let i = 0; i < candidates.length; i += 1) {
    if (candidates[i].sortKey !== i) {
      return {
        checkName: "deterministic_ordering",
        passed: false,
        detail: `sortKey is not zero-based contiguous at position ${i}: got ${candidates[i].sortKey}.`,
      };
    }
  }
  for (let i = 0; i + 1 < candidates.length; i += 1) {
    const cmp = compareCustomerWaitingCandidates(
      candidates[i],
      candidates[i + 1],
    );
    if (cmp > 0) {
      return {
        checkName: "deterministic_ordering",
        passed: false,
        detail: `Candidate ${candidates[i].itemId} should not come before ${candidates[i + 1].itemId}.`,
      };
    }
  }
  return {
    checkName: "deterministic_ordering",
    passed: true,
    detail:
      "Re-ordering inputs yields the same candidate sequence; sortKey is zero-based contiguous; ordering follows waitedMs DESC, producerRank ASC, emailThreadId ASC, sourceRowId ASC.",
  };
}

function checkBoundaryDistinctions(
  candidates: readonly CustomerWaitingPlanningCandidate[],
): CustomerWaitingPlanningCheckResult {
  const violations: string[] = [];
  for (const candidate of candidates) {
    const lower = candidate.boundaryNote.toLowerCase();
    for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
      if (!lower.includes(phrase)) {
        violations.push(
          `${candidate.itemId}: boundaryNote missing "${phrase}"`,
        );
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName:
      "boundary_notes_preserve_recommendation_explanation_draft_proof",
    passed,
    detail: passed
      ? "All candidates preserve recommendation/explanation/draft/proof distinctions in boundaryNote."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkCandidateShape(
  rows: readonly CustomerWaitingPlanningSourceRow[],
  candidates: readonly CustomerWaitingPlanningCandidate[],
): CustomerWaitingPlanningCheckResult {
  const violations: string[] = [];
  const allowedReviewPostures = new Set<ReviewPosture>([
    "review_required",
    "human_owner_required",
  ]);
  for (const candidate of candidates) {
    if (candidate.evidenceRefs.length === 0) {
      violations.push(`${candidate.itemId}: evidenceRefs is empty`);
    }
    if (!allowedReviewPostures.has(candidate.reviewPosture)) {
      violations.push(
        `${candidate.itemId}: reviewPosture must be review_required or human_owner_required, got "${candidate.reviewPosture}"`,
      );
    }
    if (candidate.riskLevel !== "high") {
      violations.push(
        `${candidate.itemId}: riskLevel must be "high", got "${candidate.riskLevel}"`,
      );
    }
    const primaryLower = candidate.primaryAction.toLowerCase();
    if (
      !primaryLower.startsWith("review") &&
      !primaryLower.startsWith("open")
    ) {
      violations.push(
        `${candidate.itemId}: primaryAction must use a review-required planning verb (review/open), got "${candidate.primaryAction}"`,
      );
    }
    if (!candidate.primaryAction.includes(candidate.emailThreadId)) {
      violations.push(
        `${candidate.itemId}: primaryAction must reference the synthetic emailThreadId "${candidate.emailThreadId}"`,
      );
    }
    const sourceRow = rows.find((r) => r.rowId === candidate.sourceRowId);
    if (!sourceRow) {
      violations.push(
        `${candidate.itemId}: candidate has no matching source row for shape check`,
      );
      continue;
    }
    if (candidate.producerId !== sourceRow.producerId) {
      violations.push(
        `${candidate.itemId}: producerId (${candidate.producerId}) does not match source row (${sourceRow.producerId})`,
      );
    }
    if (candidate.emailThreadId !== sourceRow.emailThreadId) {
      violations.push(
        `${candidate.itemId}: emailThreadId (${candidate.emailThreadId}) does not match source row (${sourceRow.emailThreadId})`,
      );
    }
    if (candidate.opportunityIdPresent !== sourceRow.opportunityIdPresent) {
      violations.push(
        `${candidate.itemId}: opportunityIdPresent (${candidate.opportunityIdPresent}) does not match source row (${sourceRow.opportunityIdPresent})`,
      );
    }
    if (candidate.lastCustomerMessageAtMs !== sourceRow.lastCustomerMessageAtMs) {
      violations.push(
        `${candidate.itemId}: lastCustomerMessageAtMs does not match source row`,
      );
    }
    if (candidate.thresholdMs !== CUSTOMER_WAITING_PLANNING_THRESHOLD_MS) {
      violations.push(
        `${candidate.itemId}: thresholdMs (${candidate.thresholdMs}) does not match the 24h planning candidate constant`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "candidate_shape_is_planning_only_review_required",
    passed,
    detail: passed
      ? "All candidates carry evidenceRefs, review-required posture, riskLevel=high, a review/open primaryAction referencing the synthetic emailThreadId, and producerId/emailThreadId/opportunityIdPresent/lastCustomerMessageAtMs mirroring the source row."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkFixtureCoversAllCases(
  rows: readonly CustomerWaitingPlanningSourceRow[],
  candidates: readonly CustomerWaitingPlanningCandidate[],
  excluded: readonly CustomerWaitingExcludedRow[],
): CustomerWaitingPlanningCheckResult {
  const violations: string[] = [];

  // At least one TPQR-004 CRM-linked candidate that wins dedup.
  const tpqr004Winner = candidates.find(
    (c) => c.producerId === "tpqr004_crm_linked" && c.opportunityIdPresent,
  );
  if (!tpqr004Winner) {
    violations.push(
      "fixture must include a TPQR-004 CRM-linked candidate that wins dedup",
    );
  }

  // At least one generic-only candidate that survives because no TPQR-004 row
  // exists for that emailThreadId.
  const genericOnlyWinner = candidates.find(
    (c) => c.producerId === "loadWaitingEmailThreads_generic",
  );
  if (!genericOnlyWinner) {
    violations.push(
      "fixture must include a generic loadWaitingEmailThreads candidate that remains because no TPQR-004 row covers its emailThreadId",
    );
  }

  // At least one deduped-loser exclusion (overlap across producers).
  const reasons = new Set(excluded.map((row) => row.reason));
  if (!reasons.has("deduped_by_email_thread_id_after_producers")) {
    violations.push(
      "fixture must include a deduped_by_email_thread_id_after_producers exclusion (generic loser when TPQR-004 wins on the same emailThreadId)",
    );
  }
  if (!reasons.has("threshold_not_met")) {
    violations.push(
      "fixture must include a threshold_not_met exclusion (fresh / not-waiting row)",
    );
  }
  if (!reasons.has("workspace_boundary_not_confirmed")) {
    violations.push(
      "fixture must include a workspace_boundary_not_confirmed exclusion",
    );
  }

  // Producer coverage: every fixture must exercise both producers.
  const producers = new Set(rows.map((r) => r.producerId));
  if (!producers.has("tpqr004_crm_linked")) {
    violations.push(
      "fixture must include at least one tpqr004_crm_linked source row",
    );
  }
  if (!producers.has("loadWaitingEmailThreads_generic")) {
    violations.push(
      "fixture must include at least one loadWaitingEmailThreads_generic source row",
    );
  }

  // Overlap demonstration: at least two rows must share an emailThreadId
  // across different producers.
  const byThread = new Map<string, Set<CustomerWaitingProducerId>>();
  for (const row of rows) {
    const set = byThread.get(row.emailThreadId) ?? new Set();
    set.add(row.producerId);
    byThread.set(row.emailThreadId, set);
  }
  const hasOverlap = [...byThread.values()].some((set) => set.size >= 2);
  if (!hasOverlap) {
    violations.push(
      "fixture must include at least one emailThreadId surfaced by both tpqr004_crm_linked and loadWaitingEmailThreads_generic",
    );
  }

  const passed = violations.length === 0;
  return {
    checkName:
      "fixture_covers_inclusion_dedup_threshold_and_membership",
    passed,
    detail: passed
      ? "Fixture covers TPQR-004 dedup winner, generic-only winner, dedup-loser exclusion, threshold_not_met exclusion, workspace_boundary_not_confirmed exclusion, both producers, and an overlapping emailThreadId across producers."
      : `Violations: ${violations.join("; ")}`,
  };
}

/**
 * Evaluate the planning artifact against a row set and a reference clock.
 * Pure: caller supplies referenceClockMs explicitly; no Date.now is called.
 */
export function evaluateCustomerWaitingPlanning(
  rows: readonly CustomerWaitingPlanningSourceRow[],
  referenceClockMs: number,
): CustomerWaitingPlanningSummary {
  const built = buildCustomerWaitingPlanningCandidates(rows, referenceClockMs);
  const checks: CustomerWaitingPlanningCheckResult[] = [
    checkOnlyTpqr004Rows(built.candidates),
    checkDedupOwnershipRule(
      rows,
      referenceClockMs,
      built.candidates,
      built.excluded,
    ),
    checkNoDuplicateEmailThreadIdInFinalCandidates(built.candidates),
    checkNoRuntimeOrSchemaOrWriteAuthority(built.candidates, built.excluded),
    checkMembershipBoundaryPresent(rows, built.candidates),
    checkExcludedRowsHaveReasons(built.excluded),
    checkDeterministicOrdering(rows, referenceClockMs, built.candidates),
    checkBoundaryDistinctions(built.candidates),
    checkCandidateShape(rows, built.candidates),
    checkFixtureCoversAllCases(rows, built.candidates, built.excluded),
  ];
  return {
    tpqrId: CUSTOMER_WAITING_PLANNING_TPQR_ID,
    preflightId: CUSTOMER_WAITING_PLANNING_PREFLIGHT_ID,
    ownershipRule: CUSTOMER_WAITING_PLANNING_OWNERSHIP_RULE,
    tieBreakOrder: CUSTOMER_WAITING_PLANNING_TIE_BREAK_ORDER,
    thresholdMs: CUSTOMER_WAITING_PLANNING_THRESHOLD_MS,
    referenceClockMs,
    totalSourceRows: rows.length,
    includedCount: built.candidates.length,
    excludedCount: built.excluded.length,
    candidates: built.candidates,
    excluded: built.excluded,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
