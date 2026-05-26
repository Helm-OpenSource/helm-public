import contextFixtureData from "@/evals/intelligence-growth/context/context-growth-cases.json";
import decisionOutcomeFixtureData from "@/evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json";
import learningRequeueFixtureData from "@/evals/intelligence-growth-learning-requeue/learning-requeue-cases.json";
import tenantSignalFixtureData from "@/evals/intelligence-growth-tenant-signals/tenant-signal-cases.json";
import { describe, expect, it } from "vitest";
import {
  runIntelligenceGrowthFixtureLintEval,
  type IntelligenceGrowthCoreFixtureCase,
} from "@/lib/evals/intelligence-growth-fixture-lint-evals";
import type { IntelligenceGrowthDecisionOutcomeFixture } from "@/lib/evals/intelligence-growth-decision-outcome-evals";
import type { IntelligenceGrowthLearningRequeueFixture } from "@/lib/evals/intelligence-growth-learning-requeue-evals";
import type { IntelligenceGrowthTenantSignalFixturePack } from "@/lib/evals/intelligence-growth-tenant-signal-evals";
import type { IntelligenceDimension } from "@/lib/intelligence-growth/types";

type MutableTenantSignalFixturePack = Omit<IntelligenceGrowthTenantSignalFixturePack, "cases"> & {
  cases: IntelligenceGrowthTenantSignalFixturePack["cases"][number][];
};

type MutableDecisionOutcomeFixture = Omit<IntelligenceGrowthDecisionOutcomeFixture, "records"> & {
  records: IntelligenceGrowthDecisionOutcomeFixture["records"][number][];
};

type MutableLearningRequeueFixture = Omit<IntelligenceGrowthLearningRequeueFixture, "candidates"> & {
  candidates: IntelligenceGrowthLearningRequeueFixture["candidates"][number][];
};

function cloneTenantSignals(): MutableTenantSignalFixturePack {
  return structuredClone(tenantSignalFixtureData as IntelligenceGrowthTenantSignalFixturePack) as MutableTenantSignalFixturePack;
}

function cloneDecisionOutcomes(): MutableDecisionOutcomeFixture {
  return structuredClone(decisionOutcomeFixtureData as IntelligenceGrowthDecisionOutcomeFixture) as MutableDecisionOutcomeFixture;
}

function cloneLearningRequeue(): MutableLearningRequeueFixture {
  return structuredClone(learningRequeueFixtureData as IntelligenceGrowthLearningRequeueFixture) as MutableLearningRequeueFixture;
}

function cloneContextCases(): IntelligenceGrowthCoreFixtureCase[] {
  return structuredClone(contextFixtureData as readonly IntelligenceGrowthCoreFixtureCase[]) as IntelligenceGrowthCoreFixtureCase[];
}

describe("runIntelligenceGrowthFixtureLintEval", () => {
  it("passes with checked-in IGS fixture corpus", () => {
    const summary = runIntelligenceGrowthFixtureLintEval();

    expect(summary.passed).toBe(true);
    expect(summary.failures).toHaveLength(0);
    expect(summary.coreFixtureCaseCount).toBe(80);
    expect(summary.expectedCoreFixtureCaseCount).toBe(80);
    expect(summary.coreDimensionCount).toBe(10);
    expect(summary.tenantSignalCaseCount).toBe(10);
    expect(summary.decisionOutcomeRecordCount).toBe(10);
    expect(summary.learningRequeueCandidateCount).toBe(10);
  });

  it("fails when core fixture dimensions drift", () => {
    const contextCases = cloneContextCases();
    contextCases[0] = {
      ...contextCases[0],
      input: {
        ...contextCases[0].input,
        dimension: "memory" as IntelligenceDimension,
      },
    };

    const summary = runIntelligenceGrowthFixtureLintEval({
      coreFixtures: { context: contextCases },
    });

    expect(summary.passed).toBe(false);
    expect(summary.invalidDimensionCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason.startsWith("invalid_dimension"))).toBe(true);
  });

  it("fails when a tenant signal lacks evidence or owner", () => {
    const fixture = cloneTenantSignals();
    fixture.cases[0] = {
      ...fixture.cases[0],
      evidenceRefs: [],
      ownerAlias: null,
    };

    const summary = runIntelligenceGrowthFixtureLintEval({ tenantSignalFixture: fixture });

    expect(summary.passed).toBe(false);
    expect(summary.missingEvidenceCount).toBeGreaterThan(0);
    expect(summary.missingOwnerCount).toBeGreaterThan(0);
  });

  it("fails on duplicate ids across fixture families", () => {
    const fixture = cloneLearningRequeue();
    fixture.candidates[0] = {
      ...fixture.candidates[0],
      candidateId: "IGS-TENANT-CONTEXT-001",
    };

    const summary = runIntelligenceGrowthFixtureLintEval({ learningRequeueFixture: fixture });

    expect(summary.passed).toBe(false);
    expect(summary.duplicateIdCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason.startsWith("duplicate_id"))).toBe(true);
  });

  it("fails when decision outcomes reference unknown review packets", () => {
    const fixture = cloneDecisionOutcomes();
    fixture.records[0] = {
      ...fixture.records[0],
      packetId: "igs-review-packet:context:UNKNOWN",
    };

    const summary = runIntelligenceGrowthFixtureLintEval({ decisionOutcomeFixture: fixture });

    expect(summary.passed).toBe(false);
    expect(summary.orphanReviewPacketReferenceCount).toBeGreaterThan(0);
  });

  it("fails when requeue candidates reference unknown decision packets", () => {
    const fixture = cloneLearningRequeue();
    fixture.candidates[0] = {
      ...fixture.candidates[0],
      sourceDecisionPacketId: "igs-review-packet:context:UNKNOWN",
    };

    const summary = runIntelligenceGrowthFixtureLintEval({ learningRequeueFixture: fixture });

    expect(summary.passed).toBe(false);
    expect(summary.orphanDecisionReferenceCount).toBeGreaterThan(0);
  });

  it("fails when decision outcomes point to missing requeue candidates", () => {
    const fixture = cloneLearningRequeue();
    fixture.candidates = fixture.candidates.slice(1);

    const summary = runIntelligenceGrowthFixtureLintEval({ learningRequeueFixture: fixture });

    expect(summary.passed).toBe(false);
    expect(summary.missingRequeueCandidateCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "missing_requeue_candidate")).toBe(true);
  });

  it("fails on scope and window drift", () => {
    const fixture = cloneLearningRequeue();
    fixture.candidates[0] = {
      ...fixture.candidates[0],
      tenantKey: "customer-tenant-acme",
      nextWindowKey: "2026-W20",
    };

    const summary = runIntelligenceGrowthFixtureLintEval({ learningRequeueFixture: fixture });

    expect(summary.passed).toBe(false);
    expect(summary.scopeMismatchCount).toBeGreaterThan(0);
    expect(summary.windowMismatchCount).toBeGreaterThan(0);
  });

  it("fails on unauthorized authority and raw data flags", () => {
    const fixture = cloneDecisionOutcomes();
    fixture.records[0] = {
      ...fixture.records[0],
      officialWriteRequested: true,
      rawCustomerDataIncluded: true,
    };

    const summary = runIntelligenceGrowthFixtureLintEval({ decisionOutcomeFixture: fixture });

    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedFlagCount).toBeGreaterThan(0);
    expect(summary.rawCustomerDataIncidentCount).toBeGreaterThan(0);
  });
});
