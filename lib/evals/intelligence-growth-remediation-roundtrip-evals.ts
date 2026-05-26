import outcomeFixtureData from "@/evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json";
import requeueFixtureData from "@/evals/intelligence-growth-learning-requeue/learning-requeue-cases.json";
import {
  buildCycleAdvanceIntakeCandidate,
  runIntelligenceGrowthCycleAdvanceEval,
} from "@/lib/evals/intelligence-growth-cycle-advance-evals";
import {
  runIntelligenceGrowthDecisionOutcomeEval,
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

type RemediationFailure = {
  readonly packetId: string;
  readonly candidateId: string;
  readonly reason: string;
};

export type IntelligenceGrowthRemediationRoundtripEvalSummary = {
  readonly tenantKey: typeof TENANT_KEY;
  readonly workspaceId: typeof WORKSPACE_ID;
  readonly sourceWindowKey: typeof SOURCE_WINDOW_KEY;
  readonly nextWindowKey: typeof NEXT_WINDOW_KEY;
  readonly totalDecisionRecords: number;
  readonly continueDecisionCount: number;
  readonly reviseDecisionCount: number;
  readonly blockedDecisionCount: number;
  readonly stopDecisionCount: number;
  readonly readyForFounderReviewCount: number;
  readonly needsRequiredReviewCount: number;
  readonly reviewRequiredCount: number;
  readonly archivedCount: number;
  readonly statusRoundtripMismatchCount: number;
  readonly blockedResurrectionCount: number;
  readonly stoppedResurrectionCount: number;
  readonly missingCandidateCount: number;
  readonly missingIntakeCandidateCount: number;
  readonly sourcePacketMismatchCount: number;
  readonly evidenceContinuityMismatchCount: number;
  readonly ownerContinuityMismatchCount: number;
  readonly missingBoundaryNoteCount: number;
  readonly scopeMismatchCount: number;
  readonly windowMismatchCount: number;
  readonly unauthorizedFlagCount: number;
  readonly rawCustomerDataIncidentCount: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly passed: boolean;
  readonly failures: readonly RemediationFailure[];
};

function expectedStatus(decision: IntelligenceGrowthDecisionOutcomeRecord["decision"]): LearningRequeueStatus {
  switch (decision) {
    case "continue": return "ready_for_founder_review";
    case "revise": return "needs_required_review";
    case "blocked": return "review_required";
    case "stop": return "archived";
  }
}

function isActiveResurrectionStatus(status: LearningRequeueStatus): boolean {
  return status === "ready_for_founder_review" || status === "needs_required_review";
}

export function runIntelligenceGrowthRemediationRoundtripEval(
  requeueFixture?: IntelligenceGrowthLearningRequeueFixture,
  outcomeFixture?: IntelligenceGrowthDecisionOutcomeFixture,
): IntelligenceGrowthRemediationRoundtripEvalSummary {
  const outcomeSummary = runIntelligenceGrowthDecisionOutcomeEval(outcomeFixture);
  const requeueSummary = runIntelligenceGrowthLearningRequeueEval(requeueFixture, outcomeFixture);
  const cycleSummary = runIntelligenceGrowthCycleAdvanceEval(requeueFixture, outcomeFixture);

  const records: readonly IntelligenceGrowthDecisionOutcomeRecord[] = outcomeFixture
    ? outcomeFixture.records
    : (outcomeFixtureData.records as IntelligenceGrowthDecisionOutcomeRecord[]);
  const candidates: readonly IntelligenceGrowthLearningRequeueCandidate[] = requeueFixture
    ? requeueFixture.candidates
    : (requeueFixtureData.candidates as IntelligenceGrowthLearningRequeueCandidate[]);
  const intakeCandidates = candidates.map(buildCycleAdvanceIntakeCandidate);

  const candidatesById = new Map<string, IntelligenceGrowthLearningRequeueCandidate>();
  for (const candidate of candidates) {
    candidatesById.set(candidate.candidateId, candidate);
  }
  const intakeBySourceCandidateId = new Map(
    intakeCandidates.map((candidate) => [candidate.sourceCandidateId, candidate]),
  );

  const failures: RemediationFailure[] = [
    ...outcomeSummary.failures.map((failure) => ({
      packetId: failure.packetId,
      candidateId: "__upstream_decision__",
      reason: `upstream_decision:${failure.reason}`,
    })),
    ...requeueSummary.failures.map((failure) => ({
      packetId: "__upstream_requeue__",
      candidateId: failure.candidateId,
      reason: `upstream_requeue:${failure.reason}`,
    })),
    ...cycleSummary.failures.map((failure) => ({
      packetId: "__upstream_cycle__",
      candidateId: failure.intakeId,
      reason: `upstream_cycle:${failure.reason}`,
    })),
  ];

  for (const record of records) {
    const candidateId = record.nextLearningCandidateId;
    if (!candidateId) {
      failures.push({
        packetId: record.packetId,
        candidateId: "__missing__",
        reason: "missing_next_learning_candidate_id",
      });
      continue;
    }

    const candidate = candidatesById.get(candidateId);
    if (!candidate) {
      failures.push({
        packetId: record.packetId,
        candidateId,
        reason: "missing_requeue_candidate",
      });
      continue;
    }

    const expected = expectedStatus(record.decision);
    pushFailure(
      failures,
      candidate.sourceDecisionPacketId !== record.packetId,
      record.packetId,
      candidate.candidateId,
      "source_packet_mismatch",
    );
    pushFailure(
      failures,
      candidate.status !== expected,
      record.packetId,
      candidate.candidateId,
      `status_roundtrip_mismatch:expected_${expected}_got_${candidate.status}`,
    );
    pushFailure(
      failures,
      record.decision === "blocked" && isActiveResurrectionStatus(candidate.status),
      record.packetId,
      candidate.candidateId,
      "blocked_resurrection",
    );
    pushFailure(
      failures,
      record.decision === "stop" && candidate.status !== "archived",
      record.packetId,
      candidate.candidateId,
      "stopped_resurrection",
    );
    pushFailure(
      failures,
      !record.evidenceRefs.every((ref) => candidate.evidenceRefs.includes(ref)),
      record.packetId,
      candidate.candidateId,
      "evidence_continuity_mismatch",
    );
    pushFailure(
      failures,
      candidate.decisionOwnerAlias !== record.decisionOwnerAlias,
      record.packetId,
      candidate.candidateId,
      "owner_continuity_mismatch",
    );
    pushFailure(
      failures,
      candidate.boundaryNote.trim() === "",
      record.packetId,
      candidate.candidateId,
      "missing_boundary_note",
    );
    pushFailure(
      failures,
      candidate.tenantKey !== TENANT_KEY ||
        candidate.workspaceId !== WORKSPACE_ID,
      record.packetId,
      candidate.candidateId,
      "scope_mismatch",
    );
    pushFailure(
      failures,
      candidate.sourceWindowKey !== SOURCE_WINDOW_KEY ||
        candidate.nextWindowKey !== NEXT_WINDOW_KEY,
      record.packetId,
      candidate.candidateId,
      "window_mismatch",
    );
    pushFailure(
      failures,
      candidate.productionChangeRequested ||
        candidate.officialWriteRequested ||
        candidate.autoExecutionRequested ||
        candidate.canonicalMemoryWriteRequested ||
        candidate.promptOrPolicyUpdateRequested ||
        candidate.skillAutoPromotionRequested,
      record.packetId,
      candidate.candidateId,
      "unauthorized_flag",
    );
    pushFailure(
      failures,
      candidate.rawCustomerDataIncluded,
      record.packetId,
      candidate.candidateId,
      "raw_customer_data_incident",
    );

    const intakeCandidate = intakeBySourceCandidateId.get(candidate.candidateId);
    if (!intakeCandidate) {
      failures.push({
        packetId: record.packetId,
        candidateId: candidate.candidateId,
        reason: "missing_next_cycle_intake",
      });
      continue;
    }

    pushFailure(
      failures,
      intakeCandidate.status !== candidate.status,
      record.packetId,
      candidate.candidateId,
      "intake_status_drift",
    );
    pushFailure(
      failures,
      intakeCandidate.boundaryNote !== candidate.boundaryNote ||
        intakeCandidate.decisionOwnerAlias !== candidate.decisionOwnerAlias ||
        !candidate.evidenceRefs.every((ref) => intakeCandidate.evidenceRefs.includes(ref)),
      record.packetId,
      candidate.candidateId,
      "intake_context_drift",
    );
    pushFailure(
      failures,
      intakeCandidate.runtimeAllowed ||
        intakeCandidate.officialWriteAllowed ||
        intakeCandidate.autoExecutionAllowed ||
        intakeCandidate.canonicalMemoryWriteAllowed ||
        intakeCandidate.promptOrPolicyUpdateAllowed ||
        intakeCandidate.skillAutoPromotionAllowed,
      record.packetId,
      candidate.candidateId,
      "intake_unauthorized_flag",
    );
    pushFailure(
      failures,
      intakeCandidate.rawCustomerDataIncluded,
      record.packetId,
      candidate.candidateId,
      "intake_raw_customer_data_incident",
    );
  }

  const uniqueFailures = deduplicateFailures(failures);

  return {
    tenantKey: TENANT_KEY,
    workspaceId: WORKSPACE_ID,
    sourceWindowKey: SOURCE_WINDOW_KEY,
    nextWindowKey: NEXT_WINDOW_KEY,
    totalDecisionRecords: records.length,
    continueDecisionCount: records.filter((record) => record.decision === "continue").length,
    reviseDecisionCount: records.filter((record) => record.decision === "revise").length,
    blockedDecisionCount: records.filter((record) => record.decision === "blocked").length,
    stopDecisionCount: records.filter((record) => record.decision === "stop").length,
    readyForFounderReviewCount: candidates.filter((candidate) => candidate.status === "ready_for_founder_review").length,
    needsRequiredReviewCount: candidates.filter((candidate) => candidate.status === "needs_required_review").length,
    reviewRequiredCount: candidates.filter((candidate) => candidate.status === "review_required").length,
    archivedCount: candidates.filter((candidate) => candidate.status === "archived").length,
    statusRoundtripMismatchCount: uniqueFailures.filter((failure) =>
      failure.reason.startsWith("status_roundtrip_mismatch"),
    ).length,
    blockedResurrectionCount: uniqueFailures.filter((failure) =>
      failure.reason === "blocked_resurrection",
    ).length,
    stoppedResurrectionCount: uniqueFailures.filter((failure) =>
      failure.reason === "stopped_resurrection",
    ).length,
    missingCandidateCount: uniqueFailures.filter((failure) =>
      failure.reason === "missing_requeue_candidate" ||
        failure.reason === "missing_next_learning_candidate_id",
    ).length,
    missingIntakeCandidateCount: uniqueFailures.filter((failure) =>
      failure.reason === "missing_next_cycle_intake",
    ).length,
    sourcePacketMismatchCount: uniqueFailures.filter((failure) =>
      failure.reason === "source_packet_mismatch",
    ).length,
    evidenceContinuityMismatchCount: uniqueFailures.filter((failure) =>
      failure.reason === "evidence_continuity_mismatch",
    ).length,
    ownerContinuityMismatchCount: uniqueFailures.filter((failure) =>
      failure.reason === "owner_continuity_mismatch",
    ).length,
    missingBoundaryNoteCount: uniqueFailures.filter((failure) =>
      failure.reason === "missing_boundary_note",
    ).length,
    scopeMismatchCount: uniqueFailures.filter((failure) => failure.reason === "scope_mismatch").length,
    windowMismatchCount: uniqueFailures.filter((failure) => failure.reason === "window_mismatch").length,
    unauthorizedFlagCount: uniqueFailures.filter((failure) =>
      failure.reason === "unauthorized_flag" ||
        failure.reason === "intake_unauthorized_flag" ||
        failure.reason.startsWith("upstream_decision:unauthorized") ||
        failure.reason.startsWith("upstream_requeue:unauthorized") ||
        failure.reason.startsWith("upstream_cycle:unauthorized"),
    ).length,
    rawCustomerDataIncidentCount: uniqueFailures.filter((failure) =>
      failure.reason === "raw_customer_data_incident" ||
        failure.reason === "intake_raw_customer_data_incident" ||
        failure.reason.startsWith("upstream_decision:raw_customer_data") ||
        failure.reason.startsWith("upstream_requeue:raw_customer_data") ||
        failure.reason.startsWith("upstream_cycle:raw_customer_data"),
    ).length,
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
  failures: RemediationFailure[],
  failed: boolean,
  packetId: string,
  candidateId: string,
  reason: string,
): void {
  if (failed) {
    failures.push({ packetId, candidateId, reason });
  }
}

function deduplicateFailures(failures: readonly RemediationFailure[]): readonly RemediationFailure[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.packetId}:${failure.candidateId}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
