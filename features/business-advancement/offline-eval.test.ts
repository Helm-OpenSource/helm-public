/**
 * Helm Business Advancement — Phase 1A Offline Eval Tests
 *
 * These tests verify the planning contracts and fixture integrity.
 * No external services, no network, no production data.
 */

import { describe, it, expect } from "vitest";
import {
  runOfflineEval,
  getFixtureStats,
} from "./offline-eval";
import {
  ADVANCEMENT_SIGNAL_FIXTURES,
  FIXTURE_COUNT,
} from "./fixtures";
import {
  isGovernanceGated,
  containsForbiddenActionTerm,
  REQUIRED_SOURCE_COVERAGE,
  REQUIRED_BOUNDARY_CATEGORIES,
  type ReviewPosture,
  type SourceType,
  type SignalType,
} from "./contracts";

// ---------------------------------------------------------------------------
// Contract integrity
// ---------------------------------------------------------------------------

describe("planning contracts", () => {
  it("ReviewPosture values are the four allowed variants", () => {
    const allowed: ReviewPosture[] = [
      "read_only",
      "review_required",
      "human_owner_required",
      "blocked",
    ];
    expect(allowed).toHaveLength(4);
  });

  it("isGovernanceGated returns false for read_only only", () => {
    expect(isGovernanceGated("read_only")).toBe(false);
    expect(isGovernanceGated("review_required")).toBe(true);
    expect(isGovernanceGated("human_owner_required")).toBe(true);
    expect(isGovernanceGated("blocked")).toBe(true);
  });

  it("containsForbiddenActionTerm detects forbidden patterns", () => {
    expect(containsForbiddenActionTerm("auto execute this task")).toBe(true);
    expect(containsForbiddenActionTerm("official write to CRM")).toBe(true);
    expect(containsForbiddenActionTerm("auto send email")).toBe(true);
    expect(containsForbiddenActionTerm("auto approve contract")).toBe(true);
    expect(containsForbiddenActionTerm("cross-tenant aggregation")).toBe(true);
    expect(containsForbiddenActionTerm("open details and review")).toBe(false);
    expect(containsForbiddenActionTerm("prepare draft for review")).toBe(false);
    expect(containsForbiddenActionTerm("assign owner")).toBe(false);
  });

  it("REQUIRED_SOURCE_COVERAGE includes the four required types", () => {
    const required: SourceType[] = ["meeting", "crm", "tenant_resource", "ask_helm"];
    for (const src of required) {
      expect(REQUIRED_SOURCE_COVERAGE).toContain(src);
    }
  });

  it("REQUIRED_BOUNDARY_CATEGORIES includes all boundary pairs", () => {
    const expected = ["recommendation", "commitment", "draft", "send", "explanation", "approval", "proof"];
    for (const cat of expected) {
      expect(REQUIRED_BOUNDARY_CATEGORIES).toContain(cat);
    }
  });
});

// ---------------------------------------------------------------------------
// Fixture integrity
// ---------------------------------------------------------------------------

describe("fixtures", () => {
  it("has exactly 20 fixtures", () => {
    expect(FIXTURE_COUNT).toBe(20);
    expect(ADVANCEMENT_SIGNAL_FIXTURES).toHaveLength(20);
  });

  it("all fixtures have unique fixtureIds", () => {
    const ids = ADVANCEMENT_SIGNAL_FIXTURES.map((fx) => fx.fixtureId);
    const unique = new Set(ids);
    expect(unique.size).toBe(20);
  });

  it("all fixture IDs match expected pattern AS-FX-NNN", () => {
    for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
      expect(fx.fixtureId).toMatch(/^AS-FX-\d{3}$/);
    }
  });

  it("all fixtures have non-empty sourceType, signalType, objectRef", () => {
    for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
      expect(fx.sourceType).toBeTruthy();
      expect(fx.signalType).toBeTruthy();
      expect(fx.objectRef.objectId).toBeTruthy();
      expect(fx.objectRef.objectType).toBeTruthy();
      expect(fx.objectRef.displayName).toBeTruthy();
    }
  });

  it("all fixtures have at least one evidenceRef", () => {
    for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
      expect(fx.evidenceRefs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("all fixtures have at least one expectedRejectedBehavior", () => {
    for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
      expect(fx.expectedRejectedBehaviors.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("all fixtures have non-empty boundary notes (>= 10 chars)", () => {
    for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
      expect(fx.expectedBoundaryNote.trim().length).toBeGreaterThanOrEqual(10);
    }
  });

  it("objectIds use synthetic prefix, not real production IDs", () => {
    for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
      expect(fx.objectRef.objectId).toMatch(/^synth-/);
    }
  });

  it("covers all required source types", () => {
    const presentSources = new Set(ADVANCEMENT_SIGNAL_FIXTURES.map((fx) => fx.sourceType));
    for (const src of REQUIRED_SOURCE_COVERAGE) {
      expect(presentSources.has(src)).toBe(true);
    }
  });

  it("has exactly one blocked fixture (AS-FX-015)", () => {
    const blocked = ADVANCEMENT_SIGNAL_FIXTURES.filter(
      (fx) => fx.expectedReviewPosture === "blocked"
    );
    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.fixtureId).toBe("AS-FX-015");
  });

  it("has at least 3 human_owner_required fixtures", () => {
    const humanOwner = ADVANCEMENT_SIGNAL_FIXTURES.filter(
      (fx) => fx.expectedReviewPosture === "human_owner_required"
    );
    expect(humanOwner.length).toBeGreaterThanOrEqual(3);
  });

  it("signal types are valid SignalType values", () => {
    const validTypes: SignalType[] = [
      "overdue_commitment",
      "blocked_decision",
      "stalled_opportunity",
      "stalled_case",
      "resource_evidence_gap",
      "repeated_intent",
      "customer_waiting",
      "kpi_anomaly",
      "boundary_hit",
      "abandoned_high_confidence_answer",
    ];
    for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
      expect(validTypes).toContain(fx.signalType);
    }
  });
});

// ---------------------------------------------------------------------------
// Offline eval checks
// ---------------------------------------------------------------------------

describe("offline eval", () => {
  const summary = runOfflineEval();

  it("overall eval passes", () => {
    if (!summary.overallPassed) {
      const failedChecks = summary.checks
        .filter((c) => !c.passed)
        .map((c) => `[${c.checkName}] ${c.detail}`)
        .join("\n");
      throw new Error(`Offline eval FAILED:\n${failedChecks}`);
    }
    expect(summary.overallPassed).toBe(true);
  });

  it("has exactly 11 checks", () => {
    expect(summary.totalChecks).toBe(11);
  });

  it("fixture_count check passes", () => {
    const check = summary.checks.find((c) => c.checkName === "fixture_count");
    expect(check?.passed).toBe(true);
  });

  it("required_fields check passes", () => {
    const check = summary.checks.find((c) => c.checkName === "required_fields");
    expect(check?.passed).toBe(true);
  });

  it("high_risk_downgrade check passes", () => {
    const check = summary.checks.find((c) => c.checkName === "high_risk_downgrade");
    expect(check?.passed).toBe(true);
  });

  it("boundary_note_coverage check passes", () => {
    const check = summary.checks.find((c) => c.checkName === "boundary_note_coverage");
    expect(check?.passed).toBe(true);
  });

  it("rejected_behaviors_not_allowed check passes", () => {
    const check = summary.checks.find((c) => c.checkName === "rejected_behaviors_not_allowed");
    expect(check?.passed).toBe(true);
  });

  it("no_forbidden_action_grants check passes", () => {
    const check = summary.checks.find((c) => c.checkName === "no_forbidden_action_grants");
    expect(check?.passed).toBe(true);
  });

  it("source_coverage check passes", () => {
    const check = summary.checks.find((c) => c.checkName === "source_coverage");
    expect(check?.passed).toBe(true);
  });

  it("governance_gated_boundary_notes check passes", () => {
    const check = summary.checks.find((c) => c.checkName === "governance_gated_boundary_notes");
    expect(check?.passed).toBe(true);
  });

  it("must_push_titles check passes", () => {
    const check = summary.checks.find((c) => c.checkName === "must_push_titles");
    expect(check?.passed).toBe(true);
  });

  it("must_push_compressibility check passes", () => {
    const check = summary.checks.find((c) => c.checkName === "must_push_compressibility");
    expect(check?.passed).toBe(true);
  });

  it("no_llm_final_ranking check passes", () => {
    const check = summary.checks.find((c) => c.checkName === "no_llm_final_ranking");
    expect(check?.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fixture statistics
// ---------------------------------------------------------------------------

describe("fixture stats", () => {
  const stats = getFixtureStats();

  it("total is 20", () => {
    expect(stats.total).toBe(20);
  });

  it("all posture counts sum to 20", () => {
    const sum =
      stats.byPosture.read_only +
      stats.byPosture.review_required +
      stats.byPosture.human_owner_required +
      stats.byPosture.blocked;
    expect(sum).toBe(20);
  });

  it("governance-gated fixtures are more than read_only", () => {
    expect(stats.governanceGatedCount).toBeGreaterThan(stats.byPosture.read_only);
  });

  it("has exactly 1 blocked fixture", () => {
    expect(stats.blockedCount).toBe(1);
  });

  it("covers at least 6 source types", () => {
    expect(Object.keys(stats.bySource).length).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// Boundary assertions (governance rules)
// ---------------------------------------------------------------------------

describe("governance boundaries", () => {
  it("no fixture primaryAction contains forbidden auto-execution terms", () => {
    const violations: string[] = [];
    for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
      if (containsForbiddenActionTerm(fx.expectedPrimaryAction)) {
        violations.push(`${fx.fixtureId}: "${fx.expectedPrimaryAction}"`);
      }
    }
    expect(violations).toHaveLength(0);
  });

  it("no fixture grants cross-tenant access", () => {
    const crossTenantFixtures = ADVANCEMENT_SIGNAL_FIXTURES.filter(
      (fx) =>
        fx.expectedPrimaryAction.toLowerCase().includes("cross") ||
        fx.expectedPrimaryAction.toLowerCase().includes("跨租户")
    );
    expect(crossTenantFixtures).toHaveLength(0);
  });

  it("no fixture allows LLM final ranking as primary action", () => {
    const llmRankingFixtures = ADVANCEMENT_SIGNAL_FIXTURES.filter(
      (fx) =>
        fx.expectedPrimaryAction.toLowerCase().includes("llm") ||
        fx.expectedPrimaryAction.toLowerCase().includes("ai排序")
    );
    expect(llmRankingFixtures).toHaveLength(0);
  });

  it("boundary notes for recommendation/commitment distinction cover at least 8 fixtures", () => {
    const recCommitment = ADVANCEMENT_SIGNAL_FIXTURES.filter(
      (fx) =>
        fx.expectedBoundaryNote.toLowerCase().includes("recommendation") ||
        fx.expectedBoundaryNote.includes("recommendation != commitment")
    );
    expect(recCommitment.length).toBeGreaterThanOrEqual(8);
  });

  it("boundary notes for draft/send distinction cover at least 3 fixtures", () => {
    const draftSend = ADVANCEMENT_SIGNAL_FIXTURES.filter(
      (fx) =>
        fx.expectedBoundaryNote.toLowerCase().includes("draft") &&
        fx.expectedBoundaryNote.toLowerCase().includes("send")
    );
    expect(draftSend.length).toBeGreaterThanOrEqual(3);
  });

  it("boundary notes for proof/write distinction cover at least 2 fixtures", () => {
    const proofWrite = ADVANCEMENT_SIGNAL_FIXTURES.filter(
      (fx) =>
        fx.expectedBoundaryNote.toLowerCase().includes("proof") ||
        fx.expectedBoundaryNote.includes("proof != external write success")
    );
    expect(proofWrite.length).toBeGreaterThanOrEqual(2);
  });

  it("all governance-gated fixtures have boundary notes mentioning either != or 不能", () => {
    const violations: string[] = [];
    for (const fx of ADVANCEMENT_SIGNAL_FIXTURES) {
      if (isGovernanceGated(fx.expectedReviewPosture)) {
        const note = fx.expectedBoundaryNote;
        if (!note.includes("!=") && !note.includes("不能") && !note.includes("不提升")) {
          violations.push(`${fx.fixtureId}: boundary note lacks explicit boundary marker`);
        }
      }
    }
    expect(violations).toHaveLength(0);
  });
});
