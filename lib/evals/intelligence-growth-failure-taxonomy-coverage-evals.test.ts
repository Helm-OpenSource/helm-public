import { describe, expect, it } from "vitest";
import {
  DEFAULT_FAILURE_TAXONOMY_COVERAGE_MAPPING,
  runIntelligenceGrowthFailureTaxonomyCoverageEval,
  type IntelligenceGrowthFailureTaxonomyMappingFixture,
} from "@/lib/evals/intelligence-growth-failure-taxonomy-coverage-evals";

function cloneMappingFixture(): IntelligenceGrowthFailureTaxonomyMappingFixture {
  return JSON.parse(JSON.stringify(DEFAULT_FAILURE_TAXONOMY_COVERAGE_MAPPING));
}

describe("runIntelligenceGrowthFailureTaxonomyCoverageEval", () => {
  it("passes with checked-in IGS failure taxonomy mapping", () => {
    const summary = runIntelligenceGrowthFailureTaxonomyCoverageEval();

    expect(summary.passed).toBe(true);
    expect(summary.dimensionCount).toBe(10);
    expect(summary.expectedDimensionCount).toBe(10);
    expect(summary.taxonomyRowCount).toBe(80);
    expect(summary.expectedTaxonomyRowCount).toBe(80);
    expect(summary.negativeFixtureCount).toBe(30);
    expect(summary.mappedNegativeFixtureCount).toBe(30);
    expect(summary.negativeFixtureCoveragePercent).toBe(100);
    expect(summary.unmappedNegativeFixtureCount).toBe(0);
    expect(summary.orphanMappingCount).toBe(0);
    expect(summary.unknownFailureTypeCount).toBe(0);
    expect(summary.positiveFixtureMappingCount).toBe(0);
    expect(summary.malformedTaxonomyRowCount).toBe(0);
    expect(summary.duplicateFailureTypeCount).toBe(0);
    expect(summary.failureCount).toBe(0);
    expect(summary.failures).toHaveLength(0);
  });

  it("keeps the failure taxonomy coverage gate candidate-only and non-executing", () => {
    const summary = runIntelligenceGrowthFailureTaxonomyCoverageEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("fails when a negative core fixture is missing from the mapping", () => {
    const fixture = withMappings(
      cloneMappingFixture().mappings.filter((entry) => entry.fixtureId !== "act-006"),
    );

    const summary = runIntelligenceGrowthFailureTaxonomyCoverageEval({ mappingFixture: fixture });

    expect(summary.passed).toBe(false);
    expect(summary.unmappedNegativeFixtureCount).toBeGreaterThanOrEqual(1);
    expect(
      summary.failures.some(
        (failure) => failure.reason === "unmapped_negative_fixture" && failure.source === "action_outcome:act-006",
      ),
    ).toBe(true);
  });

  it("fails when a mapping entry references a non-existent fixture id", () => {
    const fixture = withMappings([
      ...cloneMappingFixture().mappings,
      { fixtureId: "act-999", dimension: "action_outcome", failureType: "must_push_missing_evidence" },
    ]);

    const summary = runIntelligenceGrowthFailureTaxonomyCoverageEval({ mappingFixture: fixture });

    expect(summary.passed).toBe(false);
    expect(summary.orphanMappingCount).toBe(1);
    expect(
      summary.failures.some(
        (failure) => failure.reason === "orphan_mapping" && failure.source === "action_outcome:act-999",
      ),
    ).toBe(true);
  });

  it("fails when a mapping references a failure type not in the dimension taxonomy", () => {
    const fixture = withMappings(cloneMappingFixture().mappings.map((entry) =>
      entry.fixtureId === "act-006"
        ? { ...entry, failureType: "ghost_failure_type" }
        : entry,
    ));

    const summary = runIntelligenceGrowthFailureTaxonomyCoverageEval({ mappingFixture: fixture });

    expect(summary.passed).toBe(false);
    expect(summary.unknownFailureTypeCount).toBe(1);
    expect(
      summary.failures.some(
        (failure) => failure.reason === "unknown_failure_type" && failure.source.includes("ghost_failure_type"),
      ),
    ).toBe(true);
  });

  it("fails when a positive (non-negative) fixture is mapped", () => {
    const fixture = withMappings([
      ...cloneMappingFixture().mappings,
      { fixtureId: "act-001", dimension: "action_outcome", failureType: "must_push_missing_evidence" },
    ]);

    const summary = runIntelligenceGrowthFailureTaxonomyCoverageEval({ mappingFixture: fixture });

    expect(summary.passed).toBe(false);
    expect(summary.positiveFixtureMappingCount).toBe(1);
    expect(
      summary.failures.some(
        (failure) => failure.reason === "positive_fixture_mapping" && failure.source === "action_outcome:act-001",
      ),
    ).toBe(true);
  });

  it("fails when a taxonomy row is malformed (missing description column)", () => {
    const malformedTable = [
      "# Stub Taxonomy",
      "",
      "| Failure Type | Description | Expected Handling | Not Allowed |",
      "|---|---|---|---|",
      "| empty_context_packet |  | Escalate to rejected | Allow empty packet |",
      "| token_budget_exceeded | Over the budget | Review required | Auto-trim |",
      "| coverage_below_threshold | Coverage low | Watch_only | Auto-inject context |",
      "| redundancy_critical | Redundancy too high | Reject | Auto-deduplicate |",
      "| relevance_critically_low | Relevance too low | Reject | Auto-filter |",
      "| missing_evidence_refs | Evidence missing | Review required | Treat as valid |",
      "| workspace_id_mismatch | Workspace mismatch | Reject | Auto-remap |",
      "| call_type_unknown | Call type unknown | Review required | Default fallback |",
      "",
    ].join("\n");

    const summary = runIntelligenceGrowthFailureTaxonomyCoverageEval({
      taxonomyTexts: { context: malformedTable },
    });

    expect(summary.passed).toBe(false);
    expect(summary.malformedTaxonomyRowCount).toBeGreaterThanOrEqual(1);
    expect(
      summary.failures.some((failure) => failure.reason === "malformed_taxonomy_row"),
    ).toBe(true);
  });
});

function withMappings(
  mappings: IntelligenceGrowthFailureTaxonomyMappingFixture["mappings"],
): IntelligenceGrowthFailureTaxonomyMappingFixture {
  return {
    ...cloneMappingFixture(),
    mappings,
  };
}
