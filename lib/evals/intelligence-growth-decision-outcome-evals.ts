import fixtureRecords from "@/evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json";
import { runIntelligenceGrowthWeeklyScorecardEval } from "@/lib/evals/intelligence-growth-weekly-scorecard-evals";
import type { IntelligenceGrowthTenantSignalFixturePack } from "@/lib/evals/intelligence-growth-tenant-signal-evals";

const TENANT_KEY = "helm-business-development";
const WORKSPACE_ID = "workspace_helm_business_development";
const SOURCE_WINDOW_KEY = "2026-W18";

export type DecisionOutcomeDecision = "continue" | "revise" | "stop" | "blocked";

export type IntelligenceGrowthDecisionOutcomeRecord = {
  readonly packetId: string;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly sourceWindowKey: string;
  readonly decision: DecisionOutcomeDecision;
  readonly decisionOwnerAlias: string;
  readonly reviewerAliases: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly outcomeMetric: string | null;
  readonly nextLearningCandidateId: string | null;
  readonly boundaryNote: string;
  readonly productionChangeRequested: boolean;
  readonly officialWriteRequested: boolean;
  readonly autoExecutionRequested: boolean;
  readonly canonicalMemoryWriteRequested: boolean;
  readonly promptOrPolicyUpdateRequested: boolean;
  readonly rawCustomerDataIncluded: boolean;
};

export type IntelligenceGrowthDecisionOutcomeFixture = {
  readonly version: string;
  readonly status: string;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly sourceWindowKey: string;
  readonly records: readonly IntelligenceGrowthDecisionOutcomeRecord[];
};

export type IntelligenceGrowthDecisionOutcomeEvalSummary = {
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly sourceWindowKey: string;
  readonly totalDecisionRecords: number;
  readonly founderDecisionQueueCount: number;
  readonly decisionCoveragePercent: number;
  readonly missingDecisionCount: number;
  readonly duplicateDecisionCount: number;
  readonly blockedDecisionCount: number;
  readonly unauthorizedProductionChangeCount: number;
  readonly rawCustomerDataIncidentCount: number;
  readonly evidenceCoveragePercent: number;
  readonly reviewerCoveragePercent: number;
  readonly nextLearningCandidateCount: number;
  readonly invalidDecisionCount: number;
  readonly ownerCoveragePercent: number;
  readonly boundaryNoteCoveragePercent: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly passed: boolean;
  readonly failures: readonly { readonly packetId: string; readonly reason: string }[];
};

function derivedPercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 100);
}

export function runIntelligenceGrowthDecisionOutcomeEval(
  fixture?: IntelligenceGrowthDecisionOutcomeFixture,
  pack?: IntelligenceGrowthTenantSignalFixturePack,
): IntelligenceGrowthDecisionOutcomeEvalSummary {
  const scorecardSummary = pack
    ? runIntelligenceGrowthWeeklyScorecardEval(pack)
    : runIntelligenceGrowthWeeklyScorecardEval();

  const records: readonly IntelligenceGrowthDecisionOutcomeRecord[] = fixture
    ? fixture.records
    : (fixtureRecords.records as IntelligenceGrowthDecisionOutcomeRecord[]);

  const founderDecisionQueue = scorecardSummary.founderDecisionQueue;
  const founderDecisionQueueCount = founderDecisionQueue.length;

  // Count duplicates per packetId
  const packetIdCounts = new Map<string, number>();
  for (const record of records) {
    packetIdCounts.set(record.packetId, (packetIdCounts.get(record.packetId) ?? 0) + 1);
  }

  const missingPacketIds = founderDecisionQueue.filter((id) => !packetIdCounts.has(id));
  const duplicatePacketIds = [...packetIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const missingDecisionCount = missingPacketIds.length;
  const duplicateDecisionCount = duplicatePacketIds.length;
  const decisionCoveragePercent = derivedPercent(
    founderDecisionQueue.filter((id) => packetIdCounts.get(id) === 1).length,
    founderDecisionQueueCount,
  );

  const blockedDecisionCount = records.filter((r) => r.decision === "blocked").length;

  const unauthorizedProductionChangeCount = records.filter(
    (r) =>
      r.productionChangeRequested ||
      r.officialWriteRequested ||
      r.autoExecutionRequested ||
      r.canonicalMemoryWriteRequested ||
      r.promptOrPolicyUpdateRequested,
  ).length;

  const rawCustomerDataIncidentCount = records.filter((r) => r.rawCustomerDataIncluded).length;

  const evidenceCoveragePercent = derivedPercent(
    records.filter((r) => r.evidenceRefs.length >= 2).length,
    records.length,
  );

  const reviewerCoveragePercent = derivedPercent(
    records.filter((r) => r.reviewerAliases.length >= 1).length,
    records.length,
  );

  const nextLearningCandidateCount = records.filter(
    (r) => r.nextLearningCandidateId !== null && r.nextLearningCandidateId !== undefined,
  ).length;

  const validDecisions = new Set(["continue", "revise", "stop", "blocked"]);
  const invalidDecisionCount = records.filter(
    (r) => !validDecisions.has(r.decision as string),
  ).length;

  const ownerCoveragePercent = derivedPercent(
    records.filter((r) => typeof r.decisionOwnerAlias === "string" && r.decisionOwnerAlias.trim() !== "").length,
    records.length,
  );

  const boundaryNoteCoveragePercent = derivedPercent(
    records.filter((r) => typeof r.boundaryNote === "string" && r.boundaryNote.trim() !== "").length,
    records.length,
  );

  const failures: { packetId: string; reason: string }[] = [
    ...scorecardSummary.failures.map((f) => ({ ...f })),
  ];

  const scopeMismatchIds = records.filter(
    (r) => r.tenantKey !== TENANT_KEY || r.workspaceId !== WORKSPACE_ID || r.sourceWindowKey !== SOURCE_WINDOW_KEY,
  ).map((r) => r.packetId);

  for (const id of scopeMismatchIds) {
    failures.push({ packetId: id, reason: "scope_mismatch" });
  }
  for (const id of missingPacketIds) {
    failures.push({ packetId: id, reason: "missing_decision_record" });
  }
  for (const id of duplicatePacketIds) {
    failures.push({ packetId: id, reason: "duplicate_decision_record" });
  }

  pushFailure(failures, decisionCoveragePercent < 100, "__ledger__", `decision_coverage:${decisionCoveragePercent}`);
  pushFailure(failures, unauthorizedProductionChangeCount > 0, "__ledger__", `unauthorized_production_change_count:${unauthorizedProductionChangeCount}`);
  pushFailure(failures, rawCustomerDataIncidentCount > 0, "__ledger__", `raw_customer_data_incident_count:${rawCustomerDataIncidentCount}`);
  pushFailure(failures, evidenceCoveragePercent < 100, "__ledger__", `evidence_coverage:${evidenceCoveragePercent}`);
  pushFailure(failures, reviewerCoveragePercent < 100, "__ledger__", `reviewer_coverage:${reviewerCoveragePercent}`);
  pushFailure(failures, invalidDecisionCount > 0, "__ledger__", `invalid_decision_count:${invalidDecisionCount}`);
  pushFailure(failures, ownerCoveragePercent < 100, "__ledger__", `owner_coverage:${ownerCoveragePercent}`);
  pushFailure(failures, boundaryNoteCoveragePercent < 100, "__ledger__", `boundary_note_coverage:${boundaryNoteCoveragePercent}`);

  const uniqueFailures = deduplicateFailures(failures);

  return {
    tenantKey: TENANT_KEY,
    workspaceId: WORKSPACE_ID,
    sourceWindowKey: SOURCE_WINDOW_KEY,
    totalDecisionRecords: records.length,
    founderDecisionQueueCount,
    decisionCoveragePercent,
    missingDecisionCount,
    duplicateDecisionCount,
    blockedDecisionCount,
    unauthorizedProductionChangeCount,
    rawCustomerDataIncidentCount,
    evidenceCoveragePercent,
    reviewerCoveragePercent,
    nextLearningCandidateCount,
    invalidDecisionCount,
    ownerCoveragePercent,
    boundaryNoteCoveragePercent,
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    passed: uniqueFailures.length === 0,
    failures: uniqueFailures,
  };
}

function pushFailure(
  failures: { packetId: string; reason: string }[],
  failed: boolean,
  packetId: string,
  reason: string,
): void {
  if (failed) {
    failures.push({ packetId, reason });
  }
}

function deduplicateFailures(
  failures: readonly { packetId: string; reason: string }[],
): readonly { packetId: string; reason: string }[] {
  const seen = new Set<string>();
  return failures.filter((f) => {
    const key = `${f.packetId}:${f.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
