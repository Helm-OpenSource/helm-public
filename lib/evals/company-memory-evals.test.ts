import { describe, expect, it } from "vitest";
import companyMemoryFixtures from "@/evals/company-memory/fixtures/redacted-business-events.json";
import {
  COMPANY_MEMORY_EXPECTED_DISTRIBUTION,
  runCompanyMemoryAdoptionEval,
  runCompanyMemoryFixtureEval,
  runCompanyMemoryFourArmEval,
  runCompanyMemoryWorldModelEval,
  type CompanyMemoryAdoptionCalibrationPack,
  type CompanyMemoryBenchmarkCase,
  type CompanyMemoryFixturePack,
  type CompanyMemoryObjectGraphTargetPack,
  type CompanyMemoryRedactedPayloadPack,
} from "@/lib/evals/company-memory-evals";

describe("company memory fixture eval", () => {
  it("validates the first benchmark pack distribution", () => {
    const summary = runCompanyMemoryFixtureEval();

    expect(summary.totalCases).toBe(50);
    expect(summary.distribution.actual).toEqual(COMPANY_MEMORY_EXPECTED_DISTRIBUTION);
    expect(summary.distribution.passed).toBe(true);
  });

  it("passes all six scorecard layers for the checked-in fixture pack", () => {
    const summary = runCompanyMemoryFixtureEval();

    expect(summary.passed).toBe(true);
    expect(summary.layers.map((layer) => layer.id)).toEqual([
      "capture_quality",
      "world_model_health",
      "retrieval_utility",
      "advancement_impact",
      "llm_economics",
      "governance_safety",
    ]);
    expect(summary.layers.every((layer) => layer.passRate === 100)).toBe(true);
  });

  it("reports missing governance boundary coverage", () => {
    const fixture = {
      ...(companyMemoryFixtures as unknown as CompanyMemoryFixturePack),
      cases: [
        {
          ...companyMemoryFixtures.cases[0],
          id: "missing-boundary",
          expectedMemoryAssets: companyMemoryFixtures.cases[0].expectedMemoryAssets.filter(
            (asset) => asset.assetType !== "boundary",
          ),
          expectedAdvancementOutcome: {
            mustPushExpected: true,
            acceptedPrimaryAction: "prepare_review_packet",
            boundaryRequired: true,
          },
        } as CompanyMemoryBenchmarkCase,
      ],
    };

    const summary = runCompanyMemoryFixtureEval(fixture);
    const governance = summary.layers.find((layer) => layer.id === "governance_safety");

    expect(summary.passed).toBe(false);
    expect(governance?.failedCaseIds).toEqual(["missing-boundary"]);
    expect(summary.failureModes.some((item) => item.reason === "missing_boundary_asset")).toBe(true);
  });

  it("validates the four-arm payload and economics baseline contract", () => {
    const summary = runCompanyMemoryFourArmEval();

    expect(summary.passed).toBe(true);
    expect(summary.payloadRefs.expected).toBe(57);
    expect(summary.payloadRefs.missing).toEqual([]);
    expect(summary.arms.map((arm) => arm.id)).toEqual([
      "no_memory",
      "raw_context",
      "current_retrieval_pack",
      "distilled_memory",
    ]);
    expect(summary.arms.find((arm) => arm.id === "distilled_memory")?.enabled).toBe(false);
    expect(summary.arms.find((arm) => arm.id === "current_retrieval_pack")?.passRate).toBe(100);
    expect(summary.economics.passed).toBe(true);
    expect(summary.economics.currentRetrievalPackCompressionRatio).toBeGreaterThanOrEqual(5);
  });

  it("reports missing redacted payload references before economics passes", () => {
    const fixture = companyMemoryFixtures as unknown as CompanyMemoryFixturePack;
    const summary = runCompanyMemoryFourArmEval(fixture, {
      version: "broken",
      status: "offline_evaluation_fixture",
      redactionPosture: "synthetic",
      boundary: "test-only",
      tokenUnitCost: 0.000001,
      tokenEstimatesBySourceType: {
        meeting: { noMemory: 1, rawContext: 10, currentRetrievalPack: 1, distilledMemory: 1 },
        email: { noMemory: 1, rawContext: 10, currentRetrievalPack: 1, distilledMemory: 1 },
        crm: { noMemory: 1, rawContext: 10, currentRetrievalPack: 1, distilledMemory: 1 },
        report: { noMemory: 1, rawContext: 10, currentRetrievalPack: 1, distilledMemory: 1 },
        ask_helm: { noMemory: 1, rawContext: 10, currentRetrievalPack: 1, distilledMemory: 1 },
      },
      payloadRefAllowlist: [],
    } satisfies CompanyMemoryRedactedPayloadPack);

    expect(summary.passed).toBe(false);
    expect(summary.payloadRefs.missing).toContain("payloads/meeting/CM-MTG-001.md");
    expect(summary.failures.some((failure) => failure.reason.startsWith("missing_payload_ref:"))).toBe(true);
  });

  it("validates the object graph health baseline", () => {
    const summary = runCompanyMemoryWorldModelEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalTargets).toBe(20);
    expect(summary.observedObjects).toBeGreaterThanOrEqual(20);
    expect(summary.metrics.map((metric) => metric.id)).toEqual([
      "coverage",
      "freshness",
      "contradiction",
      "traceability",
      "boundary_coverage",
    ]);
    expect(summary.metrics.every((metric) => metric.passRate === 100)).toBe(true);
    expect(summary.topMemoryGaps).toHaveLength(10);
  });

  it("reports missing required asset types in the object graph target pack", () => {
    const targetPack = {
      version: "broken",
      status: "offline_evaluation_fixture",
      asOf: "2026-04-22T00:00:00.000Z",
      redactionPosture: "synthetic",
      boundary: "test-only",
      targets: [
        {
          objectRef: { type: "opportunity", id: "opp_alpha_renewal" },
          priority: "high",
          requiredAssetTypes: ["boundary"],
          requiresBoundary: true,
          expectedMinCases: 1,
          expectedMinEvidenceRefs: 1,
          maxFreshnessDays: 21,
          expectedRelationshipAssertionCount: 1,
          expectedContradictionPosture: "none",
        },
      ],
    } satisfies CompanyMemoryObjectGraphTargetPack;

    const summary = runCompanyMemoryWorldModelEval(undefined, targetPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toContainEqual({
      objectRef: "opportunity:opp_alpha_renewal",
      metricId: "coverage",
      reason: "coverage_failed:missing=boundary;cases=4;evidence=6",
    });
    expect(summary.failures).toContainEqual({
      objectRef: "opportunity:opp_alpha_renewal",
      metricId: "boundary_coverage",
      reason: "boundary_coverage_failed:missing_boundary_or_review_required_posture",
    });
  });

  it("validates the product adoption calibration baseline", () => {
    const summary = runCompanyMemoryAdoptionEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(12);
    expect(summary.surfaces.map((surface) => surface.surface)).toEqual([
      "ask_helm",
      "must_push",
      "briefing",
    ]);
    expect(summary.surfaces.every((surface) => surface.acceptanceLiftPercent >= 20)).toBe(true);
    expect(summary.surfaces.every((surface) => surface.timeToTrustReductionPercent >= 20)).toBe(true);
    expect(summary.overall.reviewCoveragePercent).toBe(100);
    expect(summary.overall.boundaryIncidentCount).toBe(0);
  });

  it("reports adoption boundary and review coverage failures", () => {
    const adoptionPack = {
      version: "broken",
      status: "offline_evaluation_fixture",
      redactionPosture: "synthetic",
      boundary: "test-only",
      targets: {
        minimumAcceptanceLiftPercent: 20,
        minimumTimeToTrustReductionPercent: 20,
        minimumReviewCoveragePercent: 100,
        maximumBoundaryIncidentCount: 0,
      },
      cases: [
        {
          id: "CM-ADOPT-BROKEN-001",
          surface: "must_push",
          linkedBenchmarkCaseId: "CM-MTG-001",
          reviewRequired: true,
          reviewCompleted: false,
          boundaryIncidentCount: 1,
          noMemory: { acceptanceScore: 50, timeToTrustSeconds: 100 },
          withMemory: { acceptanceScore: 55, timeToTrustSeconds: 90 },
        },
      ],
    } satisfies CompanyMemoryAdoptionCalibrationPack;

    const summary = runCompanyMemoryAdoptionEval(undefined, adoptionPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toContainEqual({
      caseId: "CM-ADOPT-BROKEN-001",
      surface: "must_push",
      reason: "review_required_but_not_completed",
    });
    expect(summary.failures).toContainEqual({
      caseId: "CM-ADOPT-BROKEN-001",
      surface: "must_push",
      reason: "boundary_incident_count:1",
    });
  });
});
