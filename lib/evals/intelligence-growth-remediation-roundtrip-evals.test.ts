import decisionFixtureData from "@/evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json";
import requeueFixtureData from "@/evals/intelligence-growth-learning-requeue/learning-requeue-cases.json";
import { describe, expect, it } from "vitest";
import { runIntelligenceGrowthRemediationRoundtripEval } from "@/lib/evals/intelligence-growth-remediation-roundtrip-evals";
import type {
  IntelligenceGrowthDecisionOutcomeFixture,
  IntelligenceGrowthDecisionOutcomeRecord,
} from "@/lib/evals/intelligence-growth-decision-outcome-evals";
import type {
  IntelligenceGrowthLearningRequeueCandidate,
  IntelligenceGrowthLearningRequeueFixture,
} from "@/lib/evals/intelligence-growth-learning-requeue-evals";

type MutableDecisionFixture = Omit<IntelligenceGrowthDecisionOutcomeFixture, "records"> & {
  records: IntelligenceGrowthDecisionOutcomeRecord[];
};

type MutableRequeueFixture = Omit<IntelligenceGrowthLearningRequeueFixture, "candidates"> & {
  candidates: IntelligenceGrowthLearningRequeueCandidate[];
};

function cloneDecisionFixture(): MutableDecisionFixture {
  return structuredClone(decisionFixtureData as IntelligenceGrowthDecisionOutcomeFixture) as MutableDecisionFixture;
}

function cloneRequeueFixture(): MutableRequeueFixture {
  return structuredClone(requeueFixtureData as IntelligenceGrowthLearningRequeueFixture) as MutableRequeueFixture;
}

describe("runIntelligenceGrowthRemediationRoundtripEval", () => {
  it("passes with checked-in remediation chain", () => {
    const summary = runIntelligenceGrowthRemediationRoundtripEval();

    expect(summary.passed).toBe(true);
    expect(summary.failures).toHaveLength(0);
    expect(summary.totalDecisionRecords).toBe(10);
    expect(summary.continueDecisionCount).toBe(4);
    expect(summary.reviseDecisionCount).toBe(3);
    expect(summary.blockedDecisionCount).toBe(3);
    expect(summary.stopDecisionCount).toBe(0);
    expect(summary.readyForFounderReviewCount).toBe(4);
    expect(summary.needsRequiredReviewCount).toBe(3);
    expect(summary.reviewRequiredCount).toBe(3);
    expect(summary.archivedCount).toBe(0);
  });

  it("keeps remediation candidate-only and non-executing", () => {
    const summary = runIntelligenceGrowthRemediationRoundtripEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("fails when a blocked decision is resurrected as founder-ready work", () => {
    const requeueFixture = cloneRequeueFixture();
    requeueFixture.candidates[2] = {
      ...requeueFixture.candidates[2],
      status: "ready_for_founder_review",
    };

    const summary = runIntelligenceGrowthRemediationRoundtripEval(requeueFixture);

    expect(summary.passed).toBe(false);
    expect(summary.blockedResurrectionCount).toBe(1);
    expect(summary.statusRoundtripMismatchCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "blocked_resurrection")).toBe(true);
  });

  it("passes when a stopped decision remains archived through requeue", () => {
    const decisionFixture = cloneDecisionFixture();
    const requeueFixture = cloneRequeueFixture();
    decisionFixture.records[0] = {
      ...decisionFixture.records[0],
      decision: "stop",
      boundaryNote: "Stop this improvement candidate and keep it archived until a founder reopens it.",
    };
    requeueFixture.candidates[0] = {
      ...requeueFixture.candidates[0],
      status: "archived",
      boundaryNote: "Stop this improvement candidate and keep it archived until a founder reopens it.",
    };

    const summary = runIntelligenceGrowthRemediationRoundtripEval(requeueFixture, decisionFixture);

    expect(summary.passed).toBe(true);
    expect(summary.stopDecisionCount).toBe(1);
    expect(summary.archivedCount).toBe(1);
    expect(summary.stoppedResurrectionCount).toBe(0);
  });

  it("fails when a stopped decision is not archived", () => {
    const decisionFixture = cloneDecisionFixture();
    decisionFixture.records[0] = {
      ...decisionFixture.records[0],
      decision: "stop",
      boundaryNote: "Stop this improvement candidate and keep it archived until a founder reopens it.",
    };

    const summary = runIntelligenceGrowthRemediationRoundtripEval(undefined, decisionFixture);

    expect(summary.passed).toBe(false);
    expect(summary.stoppedResurrectionCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "stopped_resurrection")).toBe(true);
  });

  it("fails when a decision loses its requeue candidate", () => {
    const requeueFixture = cloneRequeueFixture();
    requeueFixture.candidates = requeueFixture.candidates.slice(1);

    const summary = runIntelligenceGrowthRemediationRoundtripEval(requeueFixture);

    expect(summary.passed).toBe(false);
    expect(summary.missingCandidateCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "missing_requeue_candidate")).toBe(true);
  });

  it("fails when evidence continuity is broken", () => {
    const requeueFixture = cloneRequeueFixture();
    requeueFixture.candidates[0] = {
      ...requeueFixture.candidates[0],
      evidenceRefs: ["igs-report:context:coverage"],
    };

    const summary = runIntelligenceGrowthRemediationRoundtripEval(requeueFixture);

    expect(summary.passed).toBe(false);
    expect(summary.evidenceContinuityMismatchCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "evidence_continuity_mismatch")).toBe(true);
  });

  it("fails when owner continuity is broken", () => {
    const requeueFixture = cloneRequeueFixture();
    requeueFixture.candidates[0] = {
      ...requeueFixture.candidates[0],
      decisionOwnerAlias: "owner:wrong",
    };

    const summary = runIntelligenceGrowthRemediationRoundtripEval(requeueFixture);

    expect(summary.passed).toBe(false);
    expect(summary.ownerContinuityMismatchCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "owner_continuity_mismatch")).toBe(true);
  });

  it("fails when boundary note is dropped", () => {
    const requeueFixture = cloneRequeueFixture();
    requeueFixture.candidates[0] = {
      ...requeueFixture.candidates[0],
      boundaryNote: "",
    };

    const summary = runIntelligenceGrowthRemediationRoundtripEval(requeueFixture);

    expect(summary.passed).toBe(false);
    expect(summary.missingBoundaryNoteCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "missing_boundary_note")).toBe(true);
  });

  it("fails when a remediation candidate requests production authority", () => {
    const requeueFixture = cloneRequeueFixture();
    requeueFixture.candidates[0] = {
      ...requeueFixture.candidates[0],
      promptOrPolicyUpdateRequested: true,
    };

    const summary = runIntelligenceGrowthRemediationRoundtripEval(requeueFixture);

    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedFlagCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "unauthorized_flag")).toBe(true);
  });
});
