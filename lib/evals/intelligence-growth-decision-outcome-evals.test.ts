import { describe, expect, it } from "vitest";
import {
  runIntelligenceGrowthDecisionOutcomeEval,
  type IntelligenceGrowthDecisionOutcomeFixture,
  type IntelligenceGrowthDecisionOutcomeRecord,
} from "@/lib/evals/intelligence-growth-decision-outcome-evals";

const TENANT_KEY = "helm-business-development";
const WORKSPACE_ID = "workspace_helm_business_development";
const SOURCE_WINDOW_KEY = "2026-W18";

const BASE_RECORD: IntelligenceGrowthDecisionOutcomeRecord = {
  packetId: "igs-review-packet:context:IGS-TENANT-CONTEXT-001",
  tenantKey: TENANT_KEY,
  workspaceId: WORKSPACE_ID,
  sourceWindowKey: SOURCE_WINDOW_KEY,
  decision: "continue",
  decisionOwnerAlias: "owner:product",
  reviewerAliases: ["reviewer:founder", "reviewer:product-lead"],
  evidenceRefs: ["ref-a", "ref-b"],
  outcomeMetric: "some_metric",
  nextLearningCandidateId: "candidate-001",
  boundaryNote: "No production change authorized.",
  productionChangeRequested: false,
  officialWriteRequested: false,
  autoExecutionRequested: false,
  canonicalMemoryWriteRequested: false,
  promptOrPolicyUpdateRequested: false,
  rawCustomerDataIncluded: false,
};

function makeFixture(
  records: IntelligenceGrowthDecisionOutcomeRecord[],
): IntelligenceGrowthDecisionOutcomeFixture {
  return {
    version: "test",
    status: "offline_evaluation_fixture",
    tenantKey: TENANT_KEY,
    workspaceId: WORKSPACE_ID,
    sourceWindowKey: SOURCE_WINDOW_KEY,
    records,
  };
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

function makeFullFixture(overrides: Partial<IntelligenceGrowthDecisionOutcomeRecord> = {}): IntelligenceGrowthDecisionOutcomeFixture {
  const records = allPacketIds().map((packetId) => ({ ...BASE_RECORD, packetId, ...overrides }));
  return makeFixture(records);
}

describe("runIntelligenceGrowthDecisionOutcomeEval", () => {
  it("passes with checked-in fixture", () => {
    const summary = runIntelligenceGrowthDecisionOutcomeEval();
    expect(summary.passed).toBe(true);
    expect(summary.failures).toHaveLength(0);
  });

  it("sets candidateOnly true and non-executing flags", () => {
    const summary = runIntelligenceGrowthDecisionOutcomeEval();
    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
  });

  it("reports 100% decision coverage for full fixture", () => {
    const summary = runIntelligenceGrowthDecisionOutcomeEval(makeFullFixture());
    expect(summary.decisionCoveragePercent).toBe(100);
    expect(summary.missingDecisionCount).toBe(0);
  });

  it("fails when a decision record is missing", () => {
    const ids = allPacketIds();
    const records = ids.slice(1).map((packetId) => ({ ...BASE_RECORD, packetId }));
    const summary = runIntelligenceGrowthDecisionOutcomeEval(makeFixture(records));
    expect(summary.passed).toBe(false);
    expect(summary.missingDecisionCount).toBeGreaterThan(0);
    expect(summary.failures.some((f) => f.reason === "missing_decision_record")).toBe(true);
  });

  it("fails when a decision record is duplicated", () => {
    const ids = allPacketIds();
    const records = [
      ...ids.map((packetId) => ({ ...BASE_RECORD, packetId })),
      { ...BASE_RECORD, packetId: ids[0] },
    ];
    const summary = runIntelligenceGrowthDecisionOutcomeEval(makeFixture(records));
    expect(summary.passed).toBe(false);
    expect(summary.duplicateDecisionCount).toBeGreaterThan(0);
    expect(summary.failures.some((f) => f.reason === "duplicate_decision_record")).toBe(true);
  });

  it("fails when a record is in customer tenant scope", () => {
    const summary = runIntelligenceGrowthDecisionOutcomeEval(
      makeFullFixture({ tenantKey: "customer-tenant-acme" }),
    );
    expect(summary.passed).toBe(false);
    expect(summary.failures.some((f) => f.reason === "scope_mismatch")).toBe(true);
  });

  it("fails when a record has productionChangeRequested true", () => {
    const summary = runIntelligenceGrowthDecisionOutcomeEval(
      makeFullFixture({ productionChangeRequested: true }),
    );
    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedProductionChangeCount).toBeGreaterThan(0);
    expect(summary.failures.some((f) => f.reason.startsWith("unauthorized_production_change_count"))).toBe(true);
  });

  it("fails when a record has promptOrPolicyUpdateRequested true", () => {
    const summary = runIntelligenceGrowthDecisionOutcomeEval(
      makeFullFixture({ promptOrPolicyUpdateRequested: true }),
    );
    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedProductionChangeCount).toBeGreaterThan(0);
  });

  it("fails when a record has officialWriteRequested true", () => {
    const summary = runIntelligenceGrowthDecisionOutcomeEval(
      makeFullFixture({ officialWriteRequested: true }),
    );
    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedProductionChangeCount).toBeGreaterThan(0);
  });

  it("fails when a record has rawCustomerDataIncluded true", () => {
    const summary = runIntelligenceGrowthDecisionOutcomeEval(
      makeFullFixture({ rawCustomerDataIncluded: true }),
    );
    expect(summary.passed).toBe(false);
    expect(summary.rawCustomerDataIncidentCount).toBeGreaterThan(0);
    expect(summary.failures.some((f) => f.reason.startsWith("raw_customer_data_incident_count"))).toBe(true);
  });

  it("counts blocked decisions", () => {
    const ids = allPacketIds();
    const records = ids.map((packetId, i) => ({
      ...BASE_RECORD,
      packetId,
      decision: i === 0 ? ("blocked" as const) : ("continue" as const),
    }));
    const summary = runIntelligenceGrowthDecisionOutcomeEval(makeFixture(records));
    expect(summary.blockedDecisionCount).toBe(1);
  });

  it("counts next learning candidates", () => {
    const summary = runIntelligenceGrowthDecisionOutcomeEval(makeFullFixture());
    expect(summary.nextLearningCandidateCount).toBe(allPacketIds().length);
  });

  it("fails when a record has an invalid decision string even when cast through unknown", () => {
    const ids = allPacketIds();
    const records = ids.map((packetId) => ({
      ...BASE_RECORD,
      packetId,
      decision: "approve" as unknown as IntelligenceGrowthDecisionOutcomeRecord["decision"],
    }));
    const badSummary = runIntelligenceGrowthDecisionOutcomeEval(makeFixture(records));

    expect(badSummary.passed).toBe(false);
    expect(badSummary.invalidDecisionCount).toBeGreaterThan(0);
    expect(badSummary.failures.some((f) => f.reason.startsWith("invalid_decision_count:"))).toBe(true);
  });

  it("fails when decisionOwnerAlias is empty", () => {
    const summary = runIntelligenceGrowthDecisionOutcomeEval(makeFullFixture({ decisionOwnerAlias: "" }));
    expect(summary.passed).toBe(false);
    expect(summary.ownerCoveragePercent).toBeLessThan(100);
    expect(summary.failures.some((f) => f.reason.startsWith("owner_coverage:"))).toBe(true);
  });

  it("fails when boundaryNote is empty", () => {
    const summary = runIntelligenceGrowthDecisionOutcomeEval(makeFullFixture({ boundaryNote: "" }));
    expect(summary.passed).toBe(false);
    expect(summary.boundaryNoteCoveragePercent).toBeLessThan(100);
    expect(summary.failures.some((f) => f.reason.startsWith("boundary_note_coverage:"))).toBe(true);
  });
});
