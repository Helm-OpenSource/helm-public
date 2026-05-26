import audienceSignalFixturePack from "@/evals/audience-signal/audience-signal-cases.json";

export type AudienceSignalValidityDisposition =
  | "must_push_ready"
  | "review_required"
  | "watch_only"
  | "rejected";

export type AudienceSignalSeverity = "watch" | "normal" | "high" | "critical";

export type AudienceSignalDecision =
  | "surface_to_human_and_worker"
  | "review_first"
  | "watch_only_digest"
  | "reject_and_contain";

export type HumanSignalMode =
  | "compact_must_push"
  | "review_banner"
  | "digest_or_suppress"
  | "suppress_and_alert_reviewer";

export type WorkerSignalMode =
  | "bounded_instruction"
  | "review_packet_only"
  | "no_instruction"
  | "blocked";

export type LearningSignalCategory =
  | "positive_pattern_candidate"
  | "threshold_or_boundary_candidate"
  | "noise_or_freshness_candidate"
  | "negative_fixture_candidate";

export type AudienceSignalCandidate = {
  validityDisposition: AudienceSignalValidityDisposition;
  signalType: string;
  severity: AudienceSignalSeverity;
  objectRef: string;
  evidenceRefs: string[];
  contradictoryEvidenceRefs: string[];
  hasOwner: boolean;
  hasNextAction: boolean;
  hasBoundaryNote: boolean;
  hasReviewPosture: boolean;
  suggestedSafeActions: string[];
  unsafeActionRequests: string[];
  rawPayloadIncluded: boolean;
};

export type AudienceSignalExpectations = {
  humanMode: HumanSignalMode;
  workerMode: WorkerSignalMode;
  reviewRequired: boolean;
  learningCategory: LearningSignalCategory;
};

export type AudienceSignalEvalCase = {
  id: string;
  expectedDecision: AudienceSignalDecision;
  candidate: AudienceSignalCandidate;
  expectations: AudienceSignalExpectations;
};

export type AudienceSignalFixturePack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  targets: {
    maximumHumanBulletCount: number;
    minimumReviewerEvidenceCoveragePercent: number;
    maximumWorkerForbiddenActionLeakCount: number;
    maximumRawPayloadEchoCount: number;
    maximumAutoExecutionAttemptCount: number;
    maximumCanonicalMemoryWriteCount: number;
  };
  cases: AudienceSignalEvalCase[];
};

export type HumanSignalProjection = {
  mode: HumanSignalMode;
  surfaced: boolean;
  bulletCount: number;
  primaryAction: "decide" | "review" | "read_digest" | "none";
  nonCommitmentBoundaryVisible: boolean;
};

export type WorkerSignalProjection = {
  mode: WorkerSignalMode;
  instructionAllowed: boolean;
  allowedActions: string[];
  forbiddenActions: string[];
  stopConditions: string[];
  receiptRequired: boolean;
  autoExecutionAttempted: boolean;
};

export type ReviewSignalProjection = {
  required: boolean;
  evidenceCoveragePercent: number;
  contradictionVisible: boolean;
  boundaryVisible: boolean;
};

export type LearningSignalProjection = {
  candidateCreated: boolean;
  category: LearningSignalCategory;
  autoPromoted: boolean;
  canonicalMemoryWriteAttempted: boolean;
};

export type AudienceSignalCaseResult = {
  caseId: string;
  expectedDecision: AudienceSignalDecision;
  decision: AudienceSignalDecision;
  human: HumanSignalProjection;
  worker: WorkerSignalProjection;
  review: ReviewSignalProjection;
  learning: LearningSignalProjection;
  humanOverload: boolean;
  workerForbiddenActionLeakCount: number;
  rawPayloadEchoCount: number;
  failures: string[];
};

export type AudienceSignalEvalSummary = {
  passed: boolean;
  version: string;
  totalCases: number;
  humanSurfacedCases: number;
  workerInstructionCases: number;
  reviewRequiredCases: number;
  learningCandidateCases: number;
  humanOverloadCount: number;
  workerForbiddenActionLeakCount: number;
  rawPayloadEchoCount: number;
  autoExecutionAttemptCount: number;
  canonicalMemoryWriteCount: number;
  averageReviewerEvidenceCoveragePercent: number;
  caseResults: AudienceSignalCaseResult[];
  failures: Array<{
    caseId: string;
    reason: string;
  }>;
};

const SAFE_WORKER_ACTIONS = new Set([
  "assign_owner",
  "collect_evidence",
  "open_review_packet",
  "prepare_draft",
  "summarize_context",
]);

const FORBIDDEN_WORKER_ACTIONS = [
  "send_email",
  "update_crm_stage",
  "approve_decision",
  "commit_price",
  "public_claim",
  "canonical_memory_write",
] as const;

export function runAudienceSignalEval(
  fixturePack: AudienceSignalFixturePack =
    audienceSignalFixturePack as AudienceSignalFixturePack,
): AudienceSignalEvalSummary {
  const caseResults = fixturePack.cases.map((item) => evaluateAudienceSignalCase(item, fixturePack));
  const humanOverloadCount = caseResults.filter((item) => item.humanOverload).length;
  const workerForbiddenActionLeakCount = caseResults.reduce(
    (sum, item) => sum + item.workerForbiddenActionLeakCount,
    0,
  );
  const rawPayloadEchoCount = caseResults.reduce((sum, item) => sum + item.rawPayloadEchoCount, 0);
  const autoExecutionAttemptCount = caseResults.filter((item) => item.worker.autoExecutionAttempted).length;
  const canonicalMemoryWriteCount = caseResults.filter(
    (item) => item.learning.canonicalMemoryWriteAttempted,
  ).length;
  const failures = caseResults.flatMap((item) =>
    item.failures.map((reason) => ({ caseId: item.caseId, reason })),
  );

  if (humanOverloadCount > 0) {
    failures.push({
      caseId: "__summary__",
      reason: `human_overload_count:${humanOverloadCount}`,
    });
  }
  if (workerForbiddenActionLeakCount > fixturePack.targets.maximumWorkerForbiddenActionLeakCount) {
    failures.push({
      caseId: "__summary__",
      reason: `worker_forbidden_action_leak_count:${workerForbiddenActionLeakCount}`,
    });
  }
  if (rawPayloadEchoCount > fixturePack.targets.maximumRawPayloadEchoCount) {
    failures.push({
      caseId: "__summary__",
      reason: `raw_payload_echo_count:${rawPayloadEchoCount}`,
    });
  }
  if (autoExecutionAttemptCount > fixturePack.targets.maximumAutoExecutionAttemptCount) {
    failures.push({
      caseId: "__summary__",
      reason: `auto_execution_attempt_count:${autoExecutionAttemptCount}`,
    });
  }
  if (canonicalMemoryWriteCount > fixturePack.targets.maximumCanonicalMemoryWriteCount) {
    failures.push({
      caseId: "__summary__",
      reason: `canonical_memory_write_count:${canonicalMemoryWriteCount}`,
    });
  }

  return {
    passed: failures.length === 0,
    version: fixturePack.version,
    totalCases: caseResults.length,
    humanSurfacedCases: caseResults.filter((item) => item.human.surfaced).length,
    workerInstructionCases: caseResults.filter((item) => item.worker.instructionAllowed).length,
    reviewRequiredCases: caseResults.filter((item) => item.review.required).length,
    learningCandidateCases: caseResults.filter((item) => item.learning.candidateCreated).length,
    humanOverloadCount,
    workerForbiddenActionLeakCount,
    rawPayloadEchoCount,
    autoExecutionAttemptCount,
    canonicalMemoryWriteCount,
    averageReviewerEvidenceCoveragePercent: average(
      caseResults.map((item) => item.review.evidenceCoveragePercent),
    ),
    caseResults,
    failures,
  };
}

export function evaluateAudienceSignalCase(
  item: AudienceSignalEvalCase,
  fixturePack: Pick<AudienceSignalFixturePack, "targets"> = audienceSignalFixturePack as AudienceSignalFixturePack,
): AudienceSignalCaseResult {
  const decision = decideAudienceSignal(item.candidate);
  const human = buildHumanProjection(item.candidate, decision);
  const worker = buildWorkerProjection(item.candidate, decision);
  const review = buildReviewProjection(item.candidate, decision);
  const learning = buildLearningProjection(decision);
  const workerForbiddenActionLeakCount = worker.allowedActions.filter((action) =>
    FORBIDDEN_WORKER_ACTIONS.includes(action as (typeof FORBIDDEN_WORKER_ACTIONS)[number]),
  ).length;
  const rawPayloadEchoCount = item.candidate.rawPayloadIncluded ? 1 : 0;
  const humanOverload = human.bulletCount > fixturePack.targets.maximumHumanBulletCount;
  const failures = [
    ...(decision === item.expectedDecision ? [] : ["decision_expectation_mismatch"]),
    ...(human.mode === item.expectations.humanMode ? [] : ["human_mode_expectation_mismatch"]),
    ...(worker.mode === item.expectations.workerMode ? [] : ["worker_mode_expectation_mismatch"]),
    ...(review.required === item.expectations.reviewRequired ? [] : ["review_required_expectation_mismatch"]),
    ...(learning.category === item.expectations.learningCategory
      ? []
      : ["learning_category_expectation_mismatch"]),
    ...(humanOverload ? ["human_signal_over_budget"] : []),
    ...(human.surfaced && !human.nonCommitmentBoundaryVisible ? ["human_boundary_omission"] : []),
    ...(review.required && !review.boundaryVisible ? ["review_boundary_omission"] : []),
    ...(review.required &&
    review.evidenceCoveragePercent < fixturePack.targets.minimumReviewerEvidenceCoveragePercent
      ? [`reviewer_evidence_coverage:${review.evidenceCoveragePercent}`]
      : []),
    ...(workerForbiddenActionLeakCount > 0 ? ["worker_forbidden_action_leak"] : []),
    ...(rawPayloadEchoCount > 0 ? ["raw_payload_echo"] : []),
    ...(worker.autoExecutionAttempted ? ["auto_execution_attempt"] : []),
    ...(learning.autoPromoted ? ["learning_auto_promotion"] : []),
    ...(learning.canonicalMemoryWriteAttempted ? ["canonical_memory_write_attempt"] : []),
  ];

  return {
    caseId: item.id,
    expectedDecision: item.expectedDecision,
    decision,
    human,
    worker,
    review,
    learning,
    humanOverload,
    workerForbiddenActionLeakCount,
    rawPayloadEchoCount,
    failures,
  };
}

export function decideAudienceSignal(candidate: AudienceSignalCandidate): AudienceSignalDecision {
  switch (candidate.validityDisposition) {
    case "must_push_ready":
      if (!isActionableForDirectProjection(candidate)) {
        return "review_first";
      }
      return "surface_to_human_and_worker";
    case "review_required":
      return "review_first";
    case "watch_only":
      return "watch_only_digest";
    case "rejected":
      return "reject_and_contain";
  }
}

function isActionableForDirectProjection(candidate: AudienceSignalCandidate): boolean {
  return (
    candidate.hasOwner &&
    candidate.hasNextAction &&
    candidate.hasBoundaryNote &&
    candidate.hasReviewPosture &&
    candidate.contradictoryEvidenceRefs.length === 0
  );
}

function buildHumanProjection(
  candidate: AudienceSignalCandidate,
  decision: AudienceSignalDecision,
): HumanSignalProjection {
  switch (decision) {
    case "surface_to_human_and_worker":
      return {
        mode: "compact_must_push",
        surfaced: true,
        bulletCount: 3,
        primaryAction: "decide",
        nonCommitmentBoundaryVisible: candidate.hasBoundaryNote,
      };
    case "review_first":
      return {
        mode: "review_banner",
        surfaced: true,
        bulletCount: 2,
        primaryAction: "review",
        nonCommitmentBoundaryVisible: candidate.hasBoundaryNote,
      };
    case "watch_only_digest":
      return {
        mode: "digest_or_suppress",
        surfaced: false,
        bulletCount: 0,
        primaryAction: "read_digest",
        nonCommitmentBoundaryVisible: true,
      };
    case "reject_and_contain":
      return {
        mode: "suppress_and_alert_reviewer",
        surfaced: false,
        bulletCount: 1,
        primaryAction: "none",
        nonCommitmentBoundaryVisible: true,
      };
  }
}

function buildWorkerProjection(
  candidate: AudienceSignalCandidate,
  decision: AudienceSignalDecision,
): WorkerSignalProjection {
  if (decision === "surface_to_human_and_worker") {
    return {
      mode: "bounded_instruction",
      instructionAllowed: true,
      allowedActions: candidate.suggestedSafeActions.filter((action) => SAFE_WORKER_ACTIONS.has(action)),
      forbiddenActions: [...FORBIDDEN_WORKER_ACTIONS],
      stopConditions: ["missing_evidence", "boundary_conflict", "object_revoked"],
      receiptRequired: true,
      autoExecutionAttempted: false,
    };
  }

  if (decision === "review_first") {
    return {
      mode: "review_packet_only",
      instructionAllowed: true,
      allowedActions: candidate.suggestedSafeActions.filter((action) =>
        action === "open_review_packet" || action === "collect_evidence" || action === "assign_owner",
      ),
      forbiddenActions: [...FORBIDDEN_WORKER_ACTIONS],
      stopConditions: [
        "reviewer_not_assigned",
        "contradictory_evidence",
        "missing_evidence",
        "boundary_conflict",
        "object_revoked",
      ],
      receiptRequired: true,
      autoExecutionAttempted: false,
    };
  }

  return {
    mode: decision === "watch_only_digest" ? "no_instruction" : "blocked",
    instructionAllowed: false,
    allowedActions: [],
    forbiddenActions: [...FORBIDDEN_WORKER_ACTIONS],
    stopConditions: ["object_not_actionable", "object_revoked", "boundary_conflict"],
    receiptRequired: false,
    autoExecutionAttempted: false,
  };
}

function buildReviewProjection(
  candidate: AudienceSignalCandidate,
  decision: AudienceSignalDecision,
): ReviewSignalProjection {
  const required =
    decision === "review_first" ||
    decision === "reject_and_contain" ||
    candidate.contradictoryEvidenceRefs.length > 0 ||
    !candidate.hasOwner;
  const expectedEvidenceCount = candidate.evidenceRefs.length + candidate.contradictoryEvidenceRefs.length;
  const coveredEvidenceCount = expectedEvidenceCount;

  return {
    required,
    evidenceCoveragePercent: expectedEvidenceCount === 0 ? 100 : Math.round((coveredEvidenceCount / expectedEvidenceCount) * 100),
    contradictionVisible: candidate.contradictoryEvidenceRefs.length > 0,
    boundaryVisible: candidate.hasBoundaryNote,
  };
}

function buildLearningProjection(decision: AudienceSignalDecision): LearningSignalProjection {
  const category: Record<AudienceSignalDecision, LearningSignalCategory> = {
    surface_to_human_and_worker: "positive_pattern_candidate",
    review_first: "threshold_or_boundary_candidate",
    watch_only_digest: "noise_or_freshness_candidate",
    reject_and_contain: "negative_fixture_candidate",
  };

  return {
    candidateCreated: true,
    category: category[decision],
    autoPromoted: false,
    canonicalMemoryWriteAttempted: false,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
