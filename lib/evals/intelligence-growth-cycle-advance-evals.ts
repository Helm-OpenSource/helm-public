import outcomeFixtureData from "@/evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json";
import fixtureData from "@/evals/intelligence-growth-learning-requeue/learning-requeue-cases.json";
import {
  type IntelligenceGrowthDecisionOutcomeFixture,
  type IntelligenceGrowthDecisionOutcomeRecord,
} from "@/lib/evals/intelligence-growth-decision-outcome-evals";
import {
  runIntelligenceGrowthLearningRequeueEval,
  type IntelligenceGrowthLearningRequeueCandidate,
  type IntelligenceGrowthLearningRequeueFixture,
  type LearningRequeueStatus,
} from "@/lib/evals/intelligence-growth-learning-requeue-evals";

const TENANT_KEY = "helm-business-development";
const WORKSPACE_ID = "workspace_helm_business_development";
const SOURCE_WINDOW_KEY = "2026-W18";
const NEXT_WINDOW_KEY = "2026-W19";

export type IntelligenceGrowthCycleAdvanceIntake = {
  readonly intakeId: string;
  readonly sourceCandidateId: string;
  readonly sourceDecisionPacketId: string;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly previousWindowKey: string;
  readonly cycleWindowKey: string;
  readonly status: LearningRequeueStatus;
  readonly decisionOwnerAlias: string;
  readonly evidenceRefs: readonly string[];
  readonly boundaryNote: string;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly rawCustomerDataIncluded: false;
};

export type IntelligenceGrowthCycleAdvanceEvalSummary = {
  readonly tenantKey: typeof TENANT_KEY;
  readonly workspaceId: typeof WORKSPACE_ID;
  readonly previousWindowKey: typeof SOURCE_WINDOW_KEY;
  readonly cycleWindowKey: typeof NEXT_WINDOW_KEY;
  readonly totalIntakeCandidates: number;
  readonly expectedIntakeCandidateCount: number;
  readonly intakeCoveragePercent: number;
  readonly duplicateIntakeIdCount: number;
  readonly missingIntakeCandidateCount: number;
  readonly unexpectedIntakeCandidateCount: number;
  readonly sourceCandidateMismatchCount: number;
  readonly sourcePacketMismatchCount: number;
  readonly statusMismatchCount: number;
  readonly scopeMismatchCount: number;
  readonly windowMismatchCount: number;
  readonly unauthorizedFlagCount: number;
  readonly rawCustomerDataIncidentCount: number;
  readonly evidenceCoveragePercent: number;
  readonly ownerCoveragePercent: number;
  readonly boundaryNoteCoveragePercent: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly passed: boolean;
  readonly failures: readonly { readonly intakeId: string; readonly reason: string }[];
};

function derivedPercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 100);
}

function expectedStatus(decision: IntelligenceGrowthDecisionOutcomeRecord["decision"]): LearningRequeueStatus {
  switch (decision) {
    case "continue": return "ready_for_founder_review";
    case "revise": return "needs_required_review";
    case "blocked": return "review_required";
    case "stop": return "archived";
  }
}

export function buildCycleAdvanceIntakeCandidate(
  candidate: IntelligenceGrowthLearningRequeueCandidate,
): IntelligenceGrowthCycleAdvanceIntake {
  return {
    intakeId: `igs-cycle:${candidate.nextWindowKey}:${candidate.candidateId}`,
    sourceCandidateId: candidate.candidateId,
    sourceDecisionPacketId: candidate.sourceDecisionPacketId,
    tenantKey: candidate.tenantKey,
    workspaceId: candidate.workspaceId,
    previousWindowKey: candidate.sourceWindowKey,
    cycleWindowKey: candidate.nextWindowKey,
    status: candidate.status,
    decisionOwnerAlias: candidate.decisionOwnerAlias,
    evidenceRefs: [...candidate.evidenceRefs],
    boundaryNote: candidate.boundaryNote,
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    rawCustomerDataIncluded: false,
  };
}

export function runIntelligenceGrowthCycleAdvanceEval(
  fixture?: IntelligenceGrowthLearningRequeueFixture,
  outcomeFixture?: IntelligenceGrowthDecisionOutcomeFixture,
): IntelligenceGrowthCycleAdvanceEvalSummary {
  const requeueSummary = runIntelligenceGrowthLearningRequeueEval(fixture, outcomeFixture);
  const candidates: readonly IntelligenceGrowthLearningRequeueCandidate[] = fixture
    ? fixture.candidates
    : (fixtureData.candidates as IntelligenceGrowthLearningRequeueCandidate[]);
  const outcomeRecords: readonly IntelligenceGrowthDecisionOutcomeRecord[] = outcomeFixture
    ? outcomeFixture.records
    : (outcomeFixtureData.records as IntelligenceGrowthDecisionOutcomeRecord[]);
  const intakeCandidates = candidates.map(buildCycleAdvanceIntakeCandidate);

  const expectedByCandidateId = new Map<string, IntelligenceGrowthDecisionOutcomeRecord>();
  for (const record of outcomeRecords) {
    if (record.nextLearningCandidateId) {
      expectedByCandidateId.set(record.nextLearningCandidateId, record);
    }
  }

  const intakeIdCounts = new Map<string, number>();
  for (const candidate of intakeCandidates) {
    intakeIdCounts.set(candidate.intakeId, (intakeIdCounts.get(candidate.intakeId) ?? 0) + 1);
  }

  const duplicateIntakeIds = [...intakeIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([intakeId]) => intakeId);
  const missingCandidateIds = [...expectedByCandidateId.keys()].filter(
    (candidateId) => !intakeCandidates.some((candidate) => candidate.sourceCandidateId === candidateId),
  );
  const unexpectedCandidates = intakeCandidates.filter(
    (candidate) => !expectedByCandidateId.has(candidate.sourceCandidateId),
  );
  const sourcePacketMismatchCandidates = intakeCandidates.filter((candidate) => {
    const record = expectedByCandidateId.get(candidate.sourceCandidateId);
    return Boolean(record && record.packetId !== candidate.sourceDecisionPacketId);
  });
  const statusMismatchCandidates = intakeCandidates.filter((candidate) => {
    const record = expectedByCandidateId.get(candidate.sourceCandidateId);
    return Boolean(record && expectedStatus(record.decision) !== candidate.status);
  });
  const sourceCandidateMismatchCandidates = intakeCandidates.filter(
    (candidate) => !candidate.intakeId.endsWith(`:${candidate.sourceCandidateId}`),
  );
  const scopeMismatchCandidates = intakeCandidates.filter(
    (candidate) =>
      candidate.tenantKey !== TENANT_KEY ||
      candidate.workspaceId !== WORKSPACE_ID,
  );
  const windowMismatchCandidates = intakeCandidates.filter(
    (candidate) =>
      candidate.previousWindowKey !== SOURCE_WINDOW_KEY ||
      candidate.cycleWindowKey !== NEXT_WINDOW_KEY,
  );
  const unauthorizedFlagCandidates = intakeCandidates.filter(
    (candidate) =>
      candidate.runtimeAllowed ||
      candidate.officialWriteAllowed ||
      candidate.autoExecutionAllowed ||
      candidate.canonicalMemoryWriteAllowed ||
      candidate.promptOrPolicyUpdateAllowed ||
      candidate.skillAutoPromotionAllowed,
  );
  const sourceUnauthorizedFlagCandidates = candidates.filter(
    (candidate) =>
      candidate.productionChangeRequested ||
      candidate.officialWriteRequested ||
      candidate.autoExecutionRequested ||
      candidate.canonicalMemoryWriteRequested ||
      candidate.promptOrPolicyUpdateRequested ||
      candidate.skillAutoPromotionRequested,
  );
  const sourceRawCustomerDataIncidentCount = candidates.filter(
    (candidate) => candidate.rawCustomerDataIncluded,
  ).length;
  const rawCustomerDataIncidentCount =
    intakeCandidates.filter((candidate) => candidate.rawCustomerDataIncluded).length +
    sourceRawCustomerDataIncidentCount;
  const evidenceCoveragePercent = derivedPercent(
    intakeCandidates.filter((candidate) => candidate.evidenceRefs.length >= 2).length,
    intakeCandidates.length,
  );
  const ownerCoveragePercent = derivedPercent(
    intakeCandidates.filter((candidate) => candidate.decisionOwnerAlias.trim() !== "").length,
    intakeCandidates.length,
  );
  const boundaryNoteCoveragePercent = derivedPercent(
    intakeCandidates.filter((candidate) => candidate.boundaryNote.trim() !== "").length,
    intakeCandidates.length,
  );
  const expectedIntakeCandidateCount = expectedByCandidateId.size;
  const intakeCoveragePercent = derivedPercent(
    [...expectedByCandidateId.keys()].filter((candidateId) =>
      intakeCandidates.some((candidate) => candidate.sourceCandidateId === candidateId),
    ).length,
    expectedIntakeCandidateCount,
  );

  const failures: { intakeId: string; reason: string }[] = [
    ...requeueSummary.failures.map((failure) => ({
      intakeId: failure.candidateId,
      reason: `upstream:${failure.reason}`,
    })),
  ];

  for (const intakeId of duplicateIntakeIds) {
    failures.push({ intakeId, reason: "duplicate_intake_id" });
  }
  for (const candidateId of missingCandidateIds) {
    failures.push({ intakeId: `missing:${candidateId}`, reason: "missing_intake_candidate" });
  }
  for (const candidate of unexpectedCandidates) {
    failures.push({ intakeId: candidate.intakeId, reason: "unexpected_intake_candidate" });
  }
  for (const candidate of sourceCandidateMismatchCandidates) {
    failures.push({ intakeId: candidate.intakeId, reason: "source_candidate_mismatch" });
  }
  for (const candidate of sourcePacketMismatchCandidates) {
    failures.push({ intakeId: candidate.intakeId, reason: "source_packet_mismatch" });
  }
  for (const candidate of statusMismatchCandidates) {
    failures.push({ intakeId: candidate.intakeId, reason: "status_mismatch" });
  }
  for (const candidate of scopeMismatchCandidates) {
    failures.push({ intakeId: candidate.intakeId, reason: "scope_mismatch" });
  }
  for (const candidate of windowMismatchCandidates) {
    failures.push({ intakeId: candidate.intakeId, reason: "window_mismatch" });
  }
  for (const candidate of unauthorizedFlagCandidates) {
    failures.push({ intakeId: candidate.intakeId, reason: "unauthorized_flag" });
  }
  for (const candidate of sourceUnauthorizedFlagCandidates) {
    failures.push({
      intakeId: `igs-cycle:${candidate.nextWindowKey}:${candidate.candidateId}`,
      reason: "source_unauthorized_flag",
    });
  }

  pushFailure(failures, intakeCoveragePercent < 100, "__cycle__", `intake_coverage:${intakeCoveragePercent}`);
  pushFailure(failures, rawCustomerDataIncidentCount > 0, "__cycle__", `raw_customer_data_incident_count:${rawCustomerDataIncidentCount}`);
  pushFailure(failures, evidenceCoveragePercent < 100, "__cycle__", `evidence_coverage:${evidenceCoveragePercent}`);
  pushFailure(failures, ownerCoveragePercent < 100, "__cycle__", `owner_coverage:${ownerCoveragePercent}`);
  pushFailure(failures, boundaryNoteCoveragePercent < 100, "__cycle__", `boundary_note_coverage:${boundaryNoteCoveragePercent}`);

  const uniqueFailures = deduplicateFailures(failures);

  return {
    tenantKey: TENANT_KEY,
    workspaceId: WORKSPACE_ID,
    previousWindowKey: SOURCE_WINDOW_KEY,
    cycleWindowKey: NEXT_WINDOW_KEY,
    totalIntakeCandidates: intakeCandidates.length,
    expectedIntakeCandidateCount,
    intakeCoveragePercent,
    duplicateIntakeIdCount: duplicateIntakeIds.length,
    missingIntakeCandidateCount: missingCandidateIds.length,
    unexpectedIntakeCandidateCount: unexpectedCandidates.length,
    sourceCandidateMismatchCount: sourceCandidateMismatchCandidates.length,
    sourcePacketMismatchCount: sourcePacketMismatchCandidates.length,
    statusMismatchCount: statusMismatchCandidates.length,
    scopeMismatchCount: scopeMismatchCandidates.length,
    windowMismatchCount: windowMismatchCandidates.length,
    unauthorizedFlagCount: unauthorizedFlagCandidates.length + sourceUnauthorizedFlagCandidates.length,
    rawCustomerDataIncidentCount,
    evidenceCoveragePercent,
    ownerCoveragePercent,
    boundaryNoteCoveragePercent,
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    passed: uniqueFailures.length === 0,
    failures: uniqueFailures,
  };
}

function pushFailure(
  failures: { intakeId: string; reason: string }[],
  failed: boolean,
  intakeId: string,
  reason: string,
): void {
  if (failed) {
    failures.push({ intakeId, reason });
  }
}

function deduplicateFailures(
  failures: readonly { readonly intakeId: string; readonly reason: string }[],
): readonly { readonly intakeId: string; readonly reason: string }[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.intakeId}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
