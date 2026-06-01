/**
 * Helm Business Advancement — thin read-model adapter (scaffold)
 *
 * Status: SCAFFOLD ONLY (no production query path activation).
 *
 * Per `docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md`
 * §三 Week 2 #14, this adapter is the single seam that maps the planning
 * artifacts in `features/business-advancement/phase3h-source-function-planning.ts`
 * into runtime-eligible candidates surfaced through `data/queries.ts` and
 * the `/mobile` Must Push compression.
 *
 * Today this file ships as a **gated stub**:
 *
 *   1. Always invokes `isBusinessAdvancementRuntimeEnabledForWorkspace`
 *   2. Returns `null` when gated off (the default)
 *   3. When gated on, the implementation throws
 *      `BusinessAdvancementRuntimeNotImplementedError`, signalling that
 *      the production query path has NOT been wired and the caller must
 *      fall back to read-first compression
 *
 * Wiring the actual deterministic ranking (Phase 3H planning artefacts
 * applied against `data/queries.ts`) is intentionally NOT done in this
 * commit — it requires:
 *
 *   - 6 hard prerequisites (incl. redacted live DB calibration)
 *   - 5-role Required Reviewer approval for the plan version
 *
 * Both are tracked outside this file. See:
 *
 *   - docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md
 *   - docs/reviews/HELM_PHASE3_REQUIRED_REVIEWER_CANDIDATE_FRAMEWORK_V1.md
 */

import "server-only";

import { isBusinessAdvancementRuntimeEnabledForWorkspace } from "@/lib/feature-flags";
import {
  assertSingleWorkspaceScope,
  assertTpqrIdInScope,
  assertRankingSourceIsDeterministic,
  BusinessAdvancementInvariantViolationError,
} from "@/lib/business-advancement/invariant-guards";

export class BusinessAdvancementRuntimeNotImplementedError extends Error {
  constructor() {
    super(
      "BUSINESS_ADVANCEMENT_RUNTIME: thin-read-model-adapter scaffold is gated on but the production query path is not wired yet; caller must fall back to read-first compression.",
    );
    this.name = "BusinessAdvancementRuntimeNotImplementedError";
  }
}

export type ThinReadModelAdvancementCandidate = {
  readonly tpqrId: "TPQR-001" | "TPQR-003" | "TPQR-004";
  readonly workspaceId: string;
  readonly subjectObjectType: string;
  readonly subjectObjectId: string;
  readonly rankingSource: string;
  readonly thresholdStatus: string;
};

export type ThinReadModelAdvancementResult =
  | {
      readonly state: "disabled";
      readonly reason: "flag_off" | "workspace_not_in_allowlist";
    }
  | {
      readonly state: "active";
      readonly candidates: readonly ThinReadModelAdvancementCandidate[];
    };

/**
 * Resolve thin-read-model advancement candidates for a workspace.
 *
 * Returns `state: "disabled"` whenever the runtime adoption gate is off.
 * Throws `BusinessAdvancementRuntimeNotImplementedError` if the gate is
 * somehow on but the implementation is still a scaffold (default in `main`).
 *
 * Once the production query path is wired, this function will:
 *   1. Call `data/queries.ts` aggregations for TPQR-001 / 003 / 004 inputs
 *      (workspace-scoped only)
 *   2. Apply Phase 3H planning shapes deterministically (no LLM in the
 *      ranking critical path)
 *   3. Run the invariant guards on every candidate before returning
 *   4. Persist `AdvancementJudgement.evidenceChain` to AuditLog before any
 *      candidate is consumed downstream
 */
export async function resolveThinReadModelAdvancementCandidates(input: {
  workspaceId: string;
}): Promise<ThinReadModelAdvancementResult> {
  if (!isBusinessAdvancementRuntimeEnabledForWorkspace(input.workspaceId)) {
    return {
      state: "disabled",
      reason: process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED
        ? "workspace_not_in_allowlist"
        : "flag_off",
    };
  }

  // ------------------------------------------------------------------
  // SCAFFOLD short-circuit. The block below documents the intended call
  // sequence; replace `throw` with the deterministic implementation only
  // after Required Reviewer approval and 6 hard prerequisites land.
  // ------------------------------------------------------------------

  // 1. Defensive guards (no-op on empty input; preserved for the wired path).
  for (const tpqrId of ["TPQR-001", "TPQR-003", "TPQR-004"] as const) {
    assertTpqrIdInScope(tpqrId);
  }
  assertRankingSourceIsDeterministic("deterministic_thin_read_model");
  assertSingleWorkspaceScope({
    requestedWorkspaceId: input.workspaceId,
    observedWorkspaceIds: [input.workspaceId],
  });

  throw new BusinessAdvancementRuntimeNotImplementedError();
}

/**
 * Caller-side fallback helper. Wraps `resolveThinReadModelAdvancementCandidates`
 * with the failure modes the launch plan demands:
 *
 *   - Gate off    → return null, caller continues with read-first
 *   - Scaffold    → return null, caller continues with read-first;
 *                   the underlying error is logged but does NOT propagate
 *                   to the user surface
 *   - Invariant violation → propagate error so oncall flips the flag
 *
 * This is the function shared layer should call (e.g. `/mobile`'s Must
 * Push wiring), not the raw `resolveThinReadModelAdvancementCandidates`.
 */
export async function resolveThinReadModelAdvancementCandidatesWithFallback(input: {
  workspaceId: string;
}): Promise<readonly ThinReadModelAdvancementCandidate[] | null> {
  try {
    const result = await resolveThinReadModelAdvancementCandidates(input);
    if (result.state === "disabled") return null;
    return result.candidates;
  } catch (error) {
    if (error instanceof BusinessAdvancementRuntimeNotImplementedError) {
      return null;
    }
    if (error instanceof BusinessAdvancementInvariantViolationError) {
      // Re-throw so oncall observability + flag flip can react.
      throw error;
    }
    throw error;
  }
}
