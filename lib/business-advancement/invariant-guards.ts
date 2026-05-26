/**
 * Helm Business Advancement runtime invariant guards
 *
 * Defensive functions enforcing the no-go list from
 * `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md`.
 *
 * Each guard:
 *   - throws BusinessAdvancementInvariantViolationError on violation
 *   - never silently swallows a violation
 *   - never auto-corrects
 *
 * Callers (the thin read-model adapter, the `/mobile` Must Push wiring) are
 * required to invoke the relevant guards before producing any output that
 * could surface to the user. A guard violation MUST trigger:
 *   1. flag flip to `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED=false` (oncall)
 *   2. independent Required Reviewer re-approval before re-enable
 */

import "server-only";

export class BusinessAdvancementInvariantViolationError extends Error {
  readonly invariant: string;
  readonly auditPayload: Record<string, unknown>;

  constructor(input: {
    invariant: string;
    message: string;
    auditPayload: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "BusinessAdvancementInvariantViolationError";
    this.invariant = input.invariant;
    this.auditPayload = input.auditPayload;
  }
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

/**
 * Persisted column `Commitment.overdueFlag` is allowed to be **read** as
 * candidate input for TPQR-003 ranking, but the runtime adapter must not
 * write to it. This guard reaffirms the read-only contract for any caller
 * that constructs a write payload referencing `overdueFlag`.
 */
export function assertCommitmentOverdueFlagIsCandidateOnly(
  payload: Record<string, unknown>,
): void {
  if ("overdueFlag" in payload) {
    throw new BusinessAdvancementInvariantViolationError({
      invariant: "commitment_overdue_flag_read_only",
      message:
        "BUSINESS_ADVANCEMENT_RUNTIME: Commitment.overdueFlag is candidate-input only and must not appear in a write payload from the thin read-model adapter.",
      auditPayload: { keysSeen: Object.keys(payload) },
    });
  }
}

/**
 * The Phase 3 receipt-driven runtime adopts deterministic ranking. Any
 * caller that hands a "ranking source" string must pass a deterministic
 * tag; LLM-final-ranking is explicitly forbidden by Phase 3 §2.
 */
const ALLOWED_RANKING_SOURCES = new Set<string>([
  "deterministic_thin_read_model",
  "deterministic_thin_read_model_with_calibration",
]);

export function assertRankingSourceIsDeterministic(rankingSource: string): void {
  if (!ALLOWED_RANKING_SOURCES.has(rankingSource)) {
    throw new BusinessAdvancementInvariantViolationError({
      invariant: "ranking_source_not_deterministic",
      message: `BUSINESS_ADVANCEMENT_RUNTIME: rankingSource '${rankingSource}' is not on the deterministic allow-list.`,
      auditPayload: { rankingSource },
    });
  }
}

/**
 * Cross-workspace aggregation is forbidden. The adapter must operate within
 * a single workspace scope; any input shape that contains workspaces beyond
 * the requested scope is a violation.
 */
export function assertSingleWorkspaceScope(input: {
  requestedWorkspaceId: string;
  observedWorkspaceIds: readonly string[];
}): void {
  const offenders = input.observedWorkspaceIds.filter(
    (id) => id !== input.requestedWorkspaceId,
  );
  if (offenders.length > 0) {
    throw new BusinessAdvancementInvariantViolationError({
      invariant: "cross_workspace_aggregation",
      message: `BUSINESS_ADVANCEMENT_RUNTIME: cross-workspace observation detected; expected workspace ${input.requestedWorkspaceId} only.`,
      auditPayload: {
        requestedWorkspaceId: input.requestedWorkspaceId,
        offendingWorkspaceCount: offenders.length,
      },
    });
  }
}

/**
 * The thin read-model adapter ships with three TPQR ids only
 * (TPQR-001 / 003 / 004). TPQR-002 / 005 remain No-Go in this window.
 */
const ALLOWED_TPQR_IDS = new Set<string>([
  "TPQR-001",
  "TPQR-003",
  "TPQR-004",
]);

export function assertTpqrIdInScope(tpqrId: string): void {
  if (!ALLOWED_TPQR_IDS.has(tpqrId)) {
    throw new BusinessAdvancementInvariantViolationError({
      invariant: "tpqr_id_out_of_scope",
      message: `BUSINESS_ADVANCEMENT_RUNTIME: TPQR id '${tpqrId}' is not in the May limited-enablement scope.`,
      auditPayload: { tpqrId },
    });
  }
}

/**
 * The adapter must not produce official-write side effects. This guard
 * inspects a "decision" shape that the caller intends to apply and rejects
 * any field that would persist beyond a candidate-level read-model.
 */
const FORBIDDEN_DECISION_KEYS = new Set<string>([
  "officialWrite",
  "execute",
  "autoCommit",
  "autoApprove",
  "autoSend",
  "scheduleSend",
  "promoteToCommitment",
  "writeAcrossWorkspace",
]);

export function assertNoOfficialWriteIntent(payload: Record<string, unknown>): void {
  const offenders = Object.keys(payload).filter((key) =>
    FORBIDDEN_DECISION_KEYS.has(key),
  );
  if (offenders.length > 0) {
    throw new BusinessAdvancementInvariantViolationError({
      invariant: "official_write_intent",
      message:
        "BUSINESS_ADVANCEMENT_RUNTIME: payload contains forbidden official-write-intent keys.",
      auditPayload: { offendingKeys: offenders },
    });
  }
}
