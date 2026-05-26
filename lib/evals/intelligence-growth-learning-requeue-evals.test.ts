import { describe, expect, it } from "vitest";
import {
  runIntelligenceGrowthLearningRequeueEval,
  type IntelligenceGrowthLearningRequeueFixture,
  type IntelligenceGrowthLearningRequeueCandidate,
} from "@/lib/evals/intelligence-growth-learning-requeue-evals";
import type {
  IntelligenceGrowthDecisionOutcomeFixture,
  IntelligenceGrowthDecisionOutcomeRecord,
} from "@/lib/evals/intelligence-growth-decision-outcome-evals";

const TENANT_KEY = "helm-business-development";
const WORKSPACE_ID = "workspace_helm_business_development";
const SOURCE_WINDOW_KEY = "2026-W18";
const NEXT_WINDOW_KEY = "2026-W19";

const BASE_CANDIDATE: IntelligenceGrowthLearningRequeueCandidate = {
  candidateId: "IGS-TENANT-CONTEXT-001-v2",
  sourceDecisionPacketId: "igs-review-packet:context:IGS-TENANT-CONTEXT-001",
  tenantKey: TENANT_KEY,
  workspaceId: WORKSPACE_ID,
  sourceWindowKey: SOURCE_WINDOW_KEY,
  nextWindowKey: NEXT_WINDOW_KEY,
  status: "needs_required_review",
  decisionOwnerAlias: "owner:product",
  evidenceRefs: ["ref-a", "ref-b"],
  boundaryNote: "No production change authorized.",
  productionChangeRequested: false,
  officialWriteRequested: false,
  autoExecutionRequested: false,
  canonicalMemoryWriteRequested: false,
  promptOrPolicyUpdateRequested: false,
  skillAutoPromotionRequested: false,
  rawCustomerDataIncluded: false,
};

const BASE_OUTCOME_RECORD: IntelligenceGrowthDecisionOutcomeRecord = {
  packetId: "igs-review-packet:context:IGS-TENANT-CONTEXT-001",
  tenantKey: TENANT_KEY,
  workspaceId: WORKSPACE_ID,
  sourceWindowKey: SOURCE_WINDOW_KEY,
  decision: "revise",
  decisionOwnerAlias: "owner:product",
  reviewerAliases: ["reviewer:founder", "reviewer:product-lead"],
  evidenceRefs: ["ref-a", "ref-b"],
  outcomeMetric: "some_metric",
  nextLearningCandidateId: "IGS-TENANT-CONTEXT-001-v2",
  boundaryNote: "No production change authorized.",
  productionChangeRequested: false,
  officialWriteRequested: false,
  autoExecutionRequested: false,
  canonicalMemoryWriteRequested: false,
  promptOrPolicyUpdateRequested: false,
  rawCustomerDataIncluded: false,
};

function allCandidateIds(): string[] {
  return [
    "IGS-TENANT-CONTEXT-001-v2",
    "IGS-TENANT-OBJECT-SIGNAL-002-v2",
    "IGS-TENANT-MEMORY-003-v2",
    "IGS-TENANT-ROUTING-004-v2",
    "IGS-TENANT-ACTION-OUTCOME-005-v2",
    "IGS-TENANT-WORKER-SKILL-006-v2",
    "IGS-TENANT-PROMPT-POLICY-007-v2",
    "IGS-TENANT-EVAL-REPLAY-008-v2",
    "IGS-TENANT-PERSONALIZATION-009-v2",
    "IGS-TENANT-COST-MODEL-010-v2",
  ];
}

function allPacketIds(): string[] {
  return [
    "igs-review-packet:context:IGS-TENANT-CONTEXT-001",
    "igs-review-packet:object_signal:IGS-TENANT-OBJECT-SIGNAL-002",
    "igs-review-packet:memory:IGS-TENANT-MEMORY-003",
    "igs-review-packet:routing:IGS-TENANT-ROUTING-004",
    "igs-review-packet:action_outcome:IGS-TENANT-ACTION-OUTCOME-005",
    "igs-review-packet:worker_skill:IGS-TENANT-WORKER-SKILL-006",
    "igs-review-packet:prompt_policy:IGS-TENANT-PROMPT-POLICY-007",
    "igs-review-packet:eval_replay:IGS-TENANT-EVAL-REPLAY-008",
    "igs-review-packet:tenant_personalization:IGS-TENANT-PERSONALIZATION-009",
    "igs-review-packet:cost_model_tool:IGS-TENANT-COST-MODEL-010",
  ];
}

type DecisionType = IntelligenceGrowthDecisionOutcomeRecord["decision"];

const DECISION_STATUS_MAP: Record<DecisionType, IntelligenceGrowthLearningRequeueCandidate["status"]> = {
  continue: "ready_for_founder_review",
  revise: "needs_required_review",
  blocked: "review_required",
  stop: "archived",
};

function makeOutcomeFixture(
  overrides: Partial<IntelligenceGrowthDecisionOutcomeRecord> = {},
): IntelligenceGrowthDecisionOutcomeFixture {
  const records = allPacketIds().map((packetId, i) => ({
    ...BASE_OUTCOME_RECORD,
    packetId,
    nextLearningCandidateId: allCandidateIds()[i],
    ...overrides,
  }));
  return {
    version: "test",
    status: "offline_evaluation_fixture",
    tenantKey: TENANT_KEY,
    workspaceId: WORKSPACE_ID,
    sourceWindowKey: SOURCE_WINDOW_KEY,
    records,
  };
}

function makeRequeueFixture(
  candidates: IntelligenceGrowthLearningRequeueCandidate[],
): IntelligenceGrowthLearningRequeueFixture {
  return {
    version: "test",
    status: "offline_evaluation_fixture",
    tenantKey: TENANT_KEY,
    workspaceId: WORKSPACE_ID,
    sourceWindowKey: SOURCE_WINDOW_KEY,
    nextWindowKey: NEXT_WINDOW_KEY,
    candidates,
  };
}

function makeFullRequeueFixture(
  decision: DecisionType = "revise",
  candidateOverrides: Partial<IntelligenceGrowthLearningRequeueCandidate> = {},
): IntelligenceGrowthLearningRequeueFixture {
  const candidates = allCandidateIds().map((candidateId, i) => ({
    ...BASE_CANDIDATE,
    candidateId,
    sourceDecisionPacketId: allPacketIds()[i],
    status: DECISION_STATUS_MAP[decision],
    ...candidateOverrides,
  }));
  return makeRequeueFixture(candidates);
}

describe("runIntelligenceGrowthLearningRequeueEval", () => {
  it("passes with checked-in fixture", () => {
    const summary = runIntelligenceGrowthLearningRequeueEval();
    expect(summary.passed).toBe(true);
    expect(summary.failures).toHaveLength(0);
  });

  it("sets candidateOnly true and non-executing flags", () => {
    const summary = runIntelligenceGrowthLearningRequeueEval();
    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("reports 100% candidate coverage for full fixture", () => {
    const outcomeFix = makeOutcomeFixture();
    const requeueFix = makeFullRequeueFixture();
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.candidateCoveragePercent).toBe(100);
    expect(summary.missingCandidateCount).toBe(0);
  });

  it("fails when a candidate is missing", () => {
    const outcomeFix = makeOutcomeFixture();
    const candidates = allCandidateIds().slice(1).map((candidateId, i) => ({
      ...BASE_CANDIDATE,
      candidateId,
      sourceDecisionPacketId: allPacketIds()[i + 1],
    }));
    const requeueFix = makeRequeueFixture(candidates);
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.missingCandidateCount).toBeGreaterThan(0);
    expect(summary.failures.some((f) => f.reason === "missing_candidate")).toBe(true);
  });

  it("fails when a candidate is duplicated", () => {
    const outcomeFix = makeOutcomeFixture();
    const candidates = [
      ...allCandidateIds().map((candidateId, i) => ({
        ...BASE_CANDIDATE,
        candidateId,
        sourceDecisionPacketId: allPacketIds()[i],
      })),
      { ...BASE_CANDIDATE, candidateId: allCandidateIds()[0], sourceDecisionPacketId: allPacketIds()[0] },
    ];
    const requeueFix = makeRequeueFixture(candidates);
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.duplicateCandidateCount).toBeGreaterThan(0);
    expect(summary.failures.some((f) => f.reason === "duplicate_candidate")).toBe(true);
  });

  it("fails when a candidate is in customer tenant scope", () => {
    const outcomeFix = makeOutcomeFixture();
    const requeueFix = makeFullRequeueFixture("revise", { tenantKey: "customer-tenant-acme" });
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.failures.some((f) => f.reason === "scope_mismatch")).toBe(true);
  });

  it("fails when a candidate has productionChangeRequested true", () => {
    const outcomeFix = makeOutcomeFixture();
    const requeueFix = makeFullRequeueFixture("revise", { productionChangeRequested: true });
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedFlagCount).toBeGreaterThan(0);
    expect(summary.failures.some((f) => f.reason.startsWith("unauthorized_flag_count"))).toBe(true);
  });

  it("fails when a candidate has promptOrPolicyUpdateRequested true", () => {
    const outcomeFix = makeOutcomeFixture();
    const requeueFix = makeFullRequeueFixture("revise", { promptOrPolicyUpdateRequested: true });
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedFlagCount).toBeGreaterThan(0);
  });

  it("fails when a candidate has skillAutoPromotionRequested true", () => {
    const outcomeFix = makeOutcomeFixture();
    const requeueFix = makeFullRequeueFixture("revise", { skillAutoPromotionRequested: true });
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedFlagCount).toBeGreaterThan(0);
    expect(summary.failures.some((f) => f.reason.startsWith("unauthorized_flag_count"))).toBe(true);
  });

  it("fails when a candidate has officialWriteRequested true", () => {
    const outcomeFix = makeOutcomeFixture();
    const requeueFix = makeFullRequeueFixture("revise", { officialWriteRequested: true });
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedFlagCount).toBeGreaterThan(0);
  });

  it("fails when a candidate has rawCustomerDataIncluded true", () => {
    const outcomeFix = makeOutcomeFixture();
    const requeueFix = makeFullRequeueFixture("revise", {
      rawCustomerDataIncluded: true as unknown as false,
    });
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.rawCustomerDataIncidentCount).toBeGreaterThan(0);
    expect(summary.failures.some((f) => f.reason.startsWith("raw_customer_data_incident_count"))).toBe(true);
  });

  it("fails when decisionOwnerAlias is empty", () => {
    const outcomeFix = makeOutcomeFixture();
    const requeueFix = makeFullRequeueFixture("revise", { decisionOwnerAlias: "" });
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.ownerCoveragePercent).toBeLessThan(100);
    expect(summary.failures.some((f) => f.reason.startsWith("owner_coverage:"))).toBe(true);
  });

  it("fails when boundaryNote is empty", () => {
    const outcomeFix = makeOutcomeFixture();
    const requeueFix = makeFullRequeueFixture("revise", { boundaryNote: "" });
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.boundaryNoteCoveragePercent).toBeLessThan(100);
    expect(summary.failures.some((f) => f.reason.startsWith("boundary_note_coverage:"))).toBe(true);
  });

  it("assigns review_required status to blocked decisions", () => {
    const outcomeFix = makeOutcomeFixture({ decision: "blocked" });
    const requeueFix = makeFullRequeueFixture("blocked");
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.blockedDecisionCandidateCount).toBe(allCandidateIds().length);
    expect(summary.statusMismatchCount).toBe(0);
  });

  it("fails when blocked decision candidate does not have review_required status", () => {
    const outcomeFix = makeOutcomeFixture({ decision: "blocked" });
    // Assign wrong status for blocked decision
    const requeueFix = makeFullRequeueFixture("blocked", {
      status: "ready_for_founder_review" as unknown as IntelligenceGrowthLearningRequeueCandidate["status"],
    });
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.statusMismatchCount).toBeGreaterThan(0);
    expect(summary.failures.some((f) => f.reason.startsWith("status_mismatch:"))).toBe(true);
  });

  it("assigns ready_for_founder_review to continue decisions", () => {
    const outcomeFix = makeOutcomeFixture({ decision: "continue" });
    const requeueFix = makeFullRequeueFixture("continue");
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.statusMismatchCount).toBe(0);
    expect(summary.passed).toBe(true);
  });

  it("assigns needs_required_review to revise decisions", () => {
    const outcomeFix = makeOutcomeFixture({ decision: "revise" });
    const requeueFix = makeFullRequeueFixture("revise");
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.statusMismatchCount).toBe(0);
    expect(summary.passed).toBe(true);
  });

  it("assigns archived to stop decisions", () => {
    const outcomeFix = makeOutcomeFixture({ decision: "stop" });
    const requeueFix = makeFullRequeueFixture("stop");
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.statusMismatchCount).toBe(0);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.passed).toBe(true);
  });

  it("fails when a candidate is an orphan (not expected by upstream)", () => {
    const outcomeFix = makeOutcomeFixture();
    const candidates = allCandidateIds().map((candidateId, i) => ({
      ...BASE_CANDIDATE,
      candidateId,
      sourceDecisionPacketId: allPacketIds()[i],
      status: DECISION_STATUS_MAP["revise"] as IntelligenceGrowthLearningRequeueCandidate["status"],
    }));
    // Inject a candidate whose id is not produced by any upstream record
    candidates.push({
      ...BASE_CANDIDATE,
      candidateId: "IGS-ORPHAN-CANDIDATE-999-v2",
      sourceDecisionPacketId: "igs-review-packet:orphan:IGS-ORPHAN-999",
      status: "needs_required_review",
    });
    const requeueFix = makeRequeueFixture(candidates);
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.unexpectedCandidateCount).toBe(1);
    expect(summary.failures.some((f) => f.candidateId === "IGS-ORPHAN-CANDIDATE-999-v2" && f.reason === "unexpected_candidate")).toBe(true);
  });

  it("fails when sourceDecisionPacketId does not match upstream packetId", () => {
    const outcomeFix = makeOutcomeFixture();
    const candidates = allCandidateIds().map((candidateId, i) => ({
      ...BASE_CANDIDATE,
      candidateId,
      sourceDecisionPacketId: i === 0 ? "igs-review-packet:WRONG:packetId" : allPacketIds()[i],
      status: DECISION_STATUS_MAP["revise"] as IntelligenceGrowthLearningRequeueCandidate["status"],
    }));
    const requeueFix = makeRequeueFixture(candidates);
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.sourcePacketMismatchCount).toBe(1);
    expect(summary.failures.some((f) => f.reason.startsWith("source_packet_mismatch:"))).toBe(true);
  });

  it("fails when status is an invalid string even if cast through unknown", () => {
    const outcomeFix = makeOutcomeFixture({ decision: "revise" });
    const candidates = allCandidateIds().map((candidateId, i) => ({
      ...BASE_CANDIDATE,
      candidateId,
      sourceDecisionPacketId: allPacketIds()[i],
      status: (i === 0 ? "not_a_real_status" : "needs_required_review") as unknown as IntelligenceGrowthLearningRequeueCandidate["status"],
    }));
    const requeueFix = makeRequeueFixture(candidates);
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, outcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.invalidStatusCount).toBe(1);
    expect(summary.failures.some((f) => f.reason.startsWith("invalid_status:"))).toBe(true);
  });

  it("fails when upstream decision-outcome eval fails", () => {
    // Upstream fails due to scope mismatch on outcome records
    const badOutcomeFix: IntelligenceGrowthDecisionOutcomeFixture = {
      version: "test",
      status: "offline_evaluation_fixture",
      tenantKey: TENANT_KEY,
      workspaceId: WORKSPACE_ID,
      sourceWindowKey: SOURCE_WINDOW_KEY,
      records: allPacketIds().map((packetId, i) => ({
        ...BASE_OUTCOME_RECORD,
        packetId,
        nextLearningCandidateId: allCandidateIds()[i],
        tenantKey: "wrong-tenant",
      })),
    };
    const requeueFix = makeFullRequeueFixture("revise");
    const summary = runIntelligenceGrowthLearningRequeueEval(requeueFix, badOutcomeFix);
    expect(summary.passed).toBe(false);
    expect(summary.failures.some((f) => f.reason.startsWith("upstream:"))).toBe(true);
  });
});
