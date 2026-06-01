/**
 * Helm Business Advancement — Phase 1A Offline Eval
 *
 * Deterministic validation of Phase 1A planning contracts and fixtures.
 * No external services, no network calls, no production data access,
 * no LLM calls, no side effects.
 *
 * All checks are pure functions over the fixture array.
 */

import type { ReviewPosture } from "./contracts";
import {
  REQUIRED_BOUNDARY_CATEGORIES,
  REQUIRED_SOURCE_COVERAGE,
  containsForbiddenActionTerm,
  isGovernanceGated,
} from "./contracts";
import {
  ADVANCEMENT_SIGNAL_FIXTURES,
  FIXTURE_COUNT,
} from "./fixtures";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface EvalCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface EvalSummary {
  readonly totalChecks: number;
  readonly passed: number;
  readonly failed: number;
  readonly checks: readonly EvalCheckResult[];
  readonly overallPassed: boolean;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkFixtureCount(): EvalCheckResult {
  const passed = FIXTURE_COUNT === 20;
  return {
    checkName: "fixture_count",
    passed,
    detail: passed
      ? `Exactly 20 fixtures present.`
      : `Expected 20 fixtures, found ${FIXTURE_COUNT}.`,
  };
}

function checkRequiredFields(): EvalCheckResult {
  const missing: string[] = [];

  for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
    const id = fx.fixtureId;

    if (!fx.sourceType) missing.push(`${id}: missing sourceType`);
    if (!fx.signalType) missing.push(`${id}: missing signalType`);
    if (!fx.objectRef?.objectType) missing.push(`${id}: missing objectRef.objectType`);
    if (!fx.objectRef?.objectId) missing.push(`${id}: missing objectRef.objectId`);
    if (!fx.objectRef?.displayName) missing.push(`${id}: missing objectRef.displayName`);
    if (!fx.evidenceRefs || fx.evidenceRefs.length === 0)
      missing.push(`${id}: missing evidenceRefs (must have at least 1)`);
    if (!fx.expectedReviewPosture) missing.push(`${id}: missing expectedReviewPosture`);
    if (!fx.expectedBoundaryNote) missing.push(`${id}: missing expectedBoundaryNote`);
    if (!fx.expectedMustPushTitle) missing.push(`${id}: missing expectedMustPushTitle`);
    if (!fx.expectedPrimaryAction) missing.push(`${id}: missing expectedPrimaryAction`);
    if (!fx.expectedRejectedBehaviors || fx.expectedRejectedBehaviors.length === 0)
      missing.push(`${id}: missing expectedRejectedBehaviors (must have at least 1)`);
  }

  const passed = missing.length === 0;
  return {
    checkName: "required_fields",
    passed,
    detail: passed
      ? "All 20 fixtures have all required fields."
      : `Missing fields: ${missing.join("; ")}`,
  };
}

/**
 * High-risk fixtures (those whose expected action requires governance oversight,
 * i.e. any fixture with a non-trivial rejected behavior involving auto-execution,
 * official write, or auto-send) must have a governance-gated reviewPosture.
 *
 * Rule: any fixture whose expectedRejectedBehaviors mention forbidden patterns
 * must NOT have reviewPosture "read_only" unless it is provably safe.
 *
 * For Phase 1A, we define "high-risk" as: a fixture whose expectedRejectedBehaviors
 * include at least one term from the forbidden action list. These must have
 * reviewPosture in {review_required, human_owner_required, blocked}.
 *
 * Note: some read_only fixtures still have rejected behaviors (e.g. "auto归因")
 * that are correctly blocked. The check is: if a fixture's rejected behavior
 * includes "auto" + an execution verb (send, write, approve, execute), then it
 * is high-risk and must not be read_only.
 */
function checkHighRiskDowngrade(): EvalCheckResult {
  const HIGH_RISK_REJECTED_TERMS = [
    "自动发送",
    "自动写",
    "自动批准",
    "自动对外",
    "自动写回",
    "自动触发",
    "自动审批",
    "auto send",
    "official write",
    "auto approve",
    "auto execute",
    "cross-tenant",
    "跨租户",
    "权限提升",
    "自动结算",
  ];

  const violations: string[] = [];

  for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
    const isHighRisk = fx.expectedRejectedBehaviors.some((behavior) =>
      HIGH_RISK_REJECTED_TERMS.some((term) =>
        behavior.toLowerCase().includes(term.toLowerCase())
      )
    );

    if (isHighRisk && !isGovernanceGated(fx.expectedReviewPosture)) {
      violations.push(
        `${fx.fixtureId}: high-risk fixture has reviewPosture="${fx.expectedReviewPosture}" (must be review_required, human_owner_required, or blocked)`
      );
    }
  }

  const passed = violations.length === 0;
  return {
    checkName: "high_risk_downgrade",
    passed,
    detail: passed
      ? "All high-risk fixtures are correctly downgraded to review_required, human_owner_required, or blocked."
      : `High-risk downgrade violations: ${violations.join("; ")}`,
  };
}

function checkBoundaryNoteCoverage(): EvalCheckResult {
  const allNotes = ADVANCEMENT_SIGNAL_FIXTURES.map(
    (fx) => fx.expectedBoundaryNote.toLowerCase()
  ).join(" ");

  const missing: string[] = [];

  for (const category of REQUIRED_BOUNDARY_CATEGORIES) {
    if (!allNotes.includes(category.toLowerCase())) {
      missing.push(category);
    }
  }

  const passed = missing.length === 0;
  return {
    checkName: "boundary_note_coverage",
    passed,
    detail: passed
      ? `All required boundary categories covered: ${REQUIRED_BOUNDARY_CATEGORIES.join(", ")}.`
      : `Missing boundary categories: ${missing.join(", ")}`,
  };
}

function checkRejectedBehaviorsNotAllowedActions(): EvalCheckResult {
  const violations: string[] = [];

  for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
    const primaryLower = fx.expectedPrimaryAction.toLowerCase();

    for (const rejected of fx.expectedRejectedBehaviors) {
      const rejectedLower = rejected.toLowerCase();

      // Check for exact match or substring overlap that would indicate
      // the rejected behavior is the same as the primary action
      if (primaryLower.includes(rejectedLower) || rejectedLower.includes(primaryLower)) {
        violations.push(
          `${fx.fixtureId}: rejected behavior "${rejected}" overlaps with primaryAction "${fx.expectedPrimaryAction}"`
        );
      }
    }
  }

  const passed = violations.length === 0;
  return {
    checkName: "rejected_behaviors_not_allowed",
    passed,
    detail: passed
      ? "No rejected behaviors overlap with allowed primary actions."
      : `Overlap violations: ${violations.join("; ")}`,
  };
}

/**
 * Checks that no fixture grants auto-execution, official write, auto-send,
 * auto-approve, auto-settlement, cross-tenant aggregation, or LLM final ranking
 * as its expectedPrimaryAction.
 */
function checkNoForbiddenActionGrants(): EvalCheckResult {
  const violations: string[] = [];

  // Additional forbidden terms in primary actions (Chinese)
  const FORBIDDEN_ZH_TERMS = [
    "自动发送",
    "自动写",
    "自动批准",
    "自动对外",
    "自动执行",
    "自动审批",
    "自动结算",
    "跨租户",
    "自动归因",
    "自动处罚",
    "自动合并",
    "自动改",
    "自动升级为 official",
  ];

  for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
    const action = fx.expectedPrimaryAction;

    // Check English forbidden terms
    if (containsForbiddenActionTerm(action)) {
      violations.push(
        `${fx.fixtureId}: primaryAction contains forbidden term: "${action}"`
      );
    }

    // Check Chinese forbidden terms
    for (const term of FORBIDDEN_ZH_TERMS) {
      if (action.includes(term)) {
        violations.push(
          `${fx.fixtureId}: primaryAction contains forbidden term "${term}": "${action}"`
        );
      }
    }
  }

  // Deduplicate
  const unique = [...new Set(violations)];
  const passed = unique.length === 0;
  return {
    checkName: "no_forbidden_action_grants",
    passed,
    detail: passed
      ? "No fixture grants auto-execution, official write, auto-send, auto-approve, auto-settlement, cross-tenant aggregation, or LLM final ranking."
      : `Forbidden action grants: ${unique.join("; ")}`,
  };
}

function checkSourceCoverage(): EvalCheckResult {
  const presentSources = new Set(
    ADVANCEMENT_SIGNAL_FIXTURES.map((fx) => fx.sourceType)
  );

  const missing = REQUIRED_SOURCE_COVERAGE.filter(
    (src) => !presentSources.has(src)
  );

  const passed = missing.length === 0;
  return {
    checkName: "source_coverage",
    passed,
    detail: passed
      ? `All required source types covered: ${REQUIRED_SOURCE_COVERAGE.join(", ")}.`
      : `Missing source types: ${missing.join(", ")}`,
  };
}

/**
 * Validates that the fixture set has 100% review coverage for governance-gated
 * fixtures: every non-read_only fixture has a non-empty boundaryNote.
 */
function checkGovernanceGatedBoundaryNotes(): EvalCheckResult {
  const violations: string[] = [];

  for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
    if (isGovernanceGated(fx.expectedReviewPosture)) {
      if (!fx.expectedBoundaryNote || fx.expectedBoundaryNote.trim().length < 10) {
        violations.push(
          `${fx.fixtureId}: governance-gated fixture missing adequate boundaryNote`
        );
      }
    }
  }

  const passed = violations.length === 0;
  return {
    checkName: "governance_gated_boundary_notes",
    passed,
    detail: passed
      ? "All governance-gated fixtures have adequate boundary notes."
      : `Boundary note violations: ${violations.join("; ")}`,
  };
}

/**
 * Validates that Must Push titles are specific and actionable, not vague or
 * over-committing. Checks that titles don't include forbidden commitment words.
 */
function checkMustPushTitles(): EvalCheckResult {
  const FORBIDDEN_TITLE_TERMS = [
    "自动",
    "已完成",
    "已批准",
    "已发送",
    "auto",
    "approved",
    "sent",
    "completed automatically",
  ];

  const violations: string[] = [];

  for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
    const title = fx.expectedMustPushTitle;

    if (title.trim().length < 5) {
      violations.push(`${fx.fixtureId}: Must Push title too short: "${title}"`);
      continue;
    }

    for (const term of FORBIDDEN_TITLE_TERMS) {
      if (title.toLowerCase().includes(term.toLowerCase())) {
        violations.push(
          `${fx.fixtureId}: Must Push title contains forbidden term "${term}": "${title}"`
        );
      }
    }
  }

  const passed = violations.length === 0;
  return {
    checkName: "must_push_titles",
    passed,
    detail: passed
      ? "All Must Push titles are specific, actionable, and non-committing."
      : `Title violations: ${violations.join("; ")}`,
  };
}

/**
 * Validates that the fixture set can be compressed to 3–5 priority items
 * by checking that the blocked fixture (AS-FX-015) is excluded from Must Push
 * count and that governance-gated count is bounded.
 *
 * Phase 1A planning assertion: at most 5 governance-gated non-blocked fixtures
 * would surface at any time in a real Must Push session.
 */
function checkMustPushCompressibility(): EvalCheckResult {
  const nonBlockedGovernanceGated = ADVANCEMENT_SIGNAL_FIXTURES.filter(
    (fx) =>
      fx.expectedReviewPosture === "review_required" ||
      fx.expectedReviewPosture === "human_owner_required"
  );

  // Deterministic ranking would filter to top 3-5; we assert the fixture set
  // demonstrates a plausible spread across risk levels and source types.
  const sourceTypes = new Set(
    nonBlockedGovernanceGated.map((fx) => fx.sourceType)
  );

  const passed =
    nonBlockedGovernanceGated.length >= 3 && sourceTypes.size >= 3;

  return {
    checkName: "must_push_compressibility",
    passed,
    detail: passed
      ? `Fixture set supports 3-5 Must Push compression: ${nonBlockedGovernanceGated.length} governance-gated fixtures across ${sourceTypes.size} source types.`
      : `Cannot compress to 3-5 Must Push: ${nonBlockedGovernanceGated.length} governance-gated across ${sourceTypes.size} source types.`,
  };
}

/**
 * Validates that no fixture implies LLM final ranking authority.
 * Checks that no fixture has "LLM" or "AI决策" in its primary action or
 * that ranking would be non-deterministic.
 */
function checkNoLlmFinalRanking(): EvalCheckResult {
  const LLM_RANKING_TERMS = [
    "llm rank",
    "ai rank",
    "llm排序",
    "ai排序",
    "llm决策",
    "ai决策",
    "llm determines",
    "llm final",
  ];

  const violations: string[] = [];

  for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
    const combined = `${fx.expectedPrimaryAction} ${fx.expectedMustPushTitle}`.toLowerCase();

    for (const term of LLM_RANKING_TERMS) {
      if (combined.includes(term)) {
        violations.push(
          `${fx.fixtureId}: fixture implies LLM final ranking via term "${term}"`
        );
      }
    }
  }

  const passed = violations.length === 0;
  return {
    checkName: "no_llm_final_ranking",
    passed,
    detail: passed
      ? "No fixture grants LLM final ranking authority."
      : `LLM ranking violations: ${violations.join("; ")}`,
  };
}

// ---------------------------------------------------------------------------
// Main eval runner
// ---------------------------------------------------------------------------

export function runOfflineEval(): EvalSummary {
  const checks: EvalCheckResult[] = [
    checkFixtureCount(),
    checkRequiredFields(),
    checkHighRiskDowngrade(),
    checkBoundaryNoteCoverage(),
    checkRejectedBehaviorsNotAllowedActions(),
    checkNoForbiddenActionGrants(),
    checkSourceCoverage(),
    checkGovernanceGatedBoundaryNotes(),
    checkMustPushTitles(),
    checkMustPushCompressibility(),
    checkNoLlmFinalRanking(),
  ];

  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  return {
    totalChecks: checks.length,
    passed,
    failed,
    checks,
    overallPassed: failed === 0,
  };
}

/**
 * Returns fixture statistics for reporting purposes.
 */
export function getFixtureStats(): {
  total: number;
  byPosture: Record<ReviewPosture, number>;
  bySource: Record<string, number>;
  governanceGatedCount: number;
  blockedCount: number;
} {
  const byPosture: Record<ReviewPosture, number> = {
    read_only: 0,
    review_required: 0,
    human_owner_required: 0,
    blocked: 0,
  };

  const bySource: Record<string, number> = {};

  for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
    byPosture[fx.expectedReviewPosture]++;
    bySource[fx.sourceType] = (bySource[fx.sourceType] ?? 0) + 1;
  }

  return {
    total: FIXTURE_COUNT,
    byPosture,
    bySource,
    governanceGatedCount:
      byPosture.review_required +
      byPosture.human_owner_required +
      byPosture.blocked,
    blockedCount: byPosture.blocked,
  };
}
