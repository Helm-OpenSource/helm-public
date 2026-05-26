import pipelineFixturePack from "@/evals/business-advancement-signal-pipeline/pipeline-cases.json";
import {
  evaluateAudienceSignalCase,
  type AudienceSignalCaseResult,
  type AudienceSignalDecision,
  type AudienceSignalEvalCase,
} from "@/lib/evals/audience-signal-evals";
import {
  runObjectSignalRemediationEval,
  runObjectSignalValidityEval,
  type ObjectSignalContainment,
  type ObjectSignalDisposition,
  type ObjectSignalIdentity,
  type ObjectSignalCandidate,
  type ObjectSignalRemediationCaseResult,
  type ObjectSignalRemediationEvalCase,
  type ObjectSignalValidityCaseResult,
  type ObjectSignalValidityFixturePack,
  type ObjectSignalRemediationFixturePack,
  type ObjectSignalPostAdmissionFindings,
  type ObjectSignalCurrentExposures,
} from "@/lib/evals/object-signal-validity-evals";

export type BusinessAdvancementPipelineSourceKind =
  | "meeting"
  | "crm"
  | "email_im"
  | "tenant_resource"
  | "ask_helm"
  | "external_agent"
  | "report";

export type BusinessAdvancementPipelineRedactionStatus =
  | "synthetic"
  | "redacted"
  | "unredacted";

export type BusinessAdvancementPipelineSource = {
  kind: BusinessAdvancementPipelineSourceKind;
  ref: string;
  redactionStatus: BusinessAdvancementPipelineRedactionStatus;
  rawPayloadIncluded: boolean;
  provider?: string;
};

export type BusinessAdvancementPipelinePostAdmission = {
  currentExposures: ObjectSignalCurrentExposures;
  postAdmissionFindings: ObjectSignalPostAdmissionFindings;
  operatorCorrection: string;
  expectedContainment: ObjectSignalContainment;
  expectedActions: string[];
};

export type BusinessAdvancementPipelineExpectedOutputs = {
  mustPushItem: boolean;
  reviewRequiredAction: boolean;
  workerInstruction: boolean;
  learningCandidate: boolean;
  remediationContainment: ObjectSignalContainment | "not_required";
};

export type BusinessAdvancementPipelineCase = {
  id: string;
  source: BusinessAdvancementPipelineSource;
  object: ObjectSignalIdentity;
  signal: ObjectSignalCandidate;
  safeActionRequests: string[];
  unsafeActionRequests: string[];
  postAdmission?: BusinessAdvancementPipelinePostAdmission;
  expectedValidityDisposition: ObjectSignalDisposition;
  expectedFinalDisposition: ObjectSignalDisposition;
  expectedAudienceDecision: AudienceSignalDecision;
  expectedOutputs: BusinessAdvancementPipelineExpectedOutputs;
};

export type BusinessAdvancementPipelineFixturePack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  targets: {
    minimumTotalCases: number;
    minimumSourceKindCount: number;
    minimumMustPushItemCount: number;
    maximumMustPushItemCount: number;
    maximumInvalidMustPushItemCount: number;
    maximumRawPayloadEchoCount: number;
    maximumAutoExecutionAttemptCount: number;
    maximumOfficialWriteAttemptCount: number;
    maximumCanonicalMemoryWriteCount: number;
    minimumLearningCandidateCount: number;
    minimumReviewerEvidenceCoveragePercent: number;
    minimumRemediationCoveragePercent: number;
  };
  cases: BusinessAdvancementPipelineCase[];
};

export type BusinessAdvancementPipelineOutputs = BusinessAdvancementPipelineExpectedOutputs & {
  sourcePreflightBlocked: boolean;
};

export type BusinessAdvancementPipelineCaseResult = {
  caseId: string;
  sourceKind: BusinessAdvancementPipelineSourceKind;
  validity: ObjectSignalValidityCaseResult;
  remediation?: ObjectSignalRemediationCaseResult;
  audience: AudienceSignalCaseResult;
  finalDisposition: ObjectSignalDisposition;
  outputs: BusinessAdvancementPipelineOutputs;
  invalidMustPushItem: boolean;
  rawPayloadEchoCount: number;
  officialWriteAttemptCount: number;
  failures: string[];
};

export type BusinessAdvancementPipelineEvalSummary = {
  passed: boolean;
  version: string;
  totalCases: number;
  sourceKindCount: number;
  mustPushItemCount: number;
  reviewRequiredActionCount: number;
  workerInstructionCount: number;
  learningCandidateCount: number;
  remediationCaseCount: number;
  invalidMustPushItemCount: number;
  rawPayloadEchoCount: number;
  autoExecutionAttemptCount: number;
  officialWriteAttemptCount: number;
  canonicalMemoryWriteCount: number;
  averageReviewerEvidenceCoveragePercent: number;
  averageRemediationCoveragePercent: number;
  caseResults: BusinessAdvancementPipelineCaseResult[];
  failures: Array<{
    caseId: string;
    reason: string;
  }>;
};

const VALIDITY_TARGETS: ObjectSignalValidityFixturePack["targets"] = {
  minimumReadyScore: 85,
  minimumEvidenceRefCount: 2,
  maximumFreshnessHours: 168,
  maximumInvalidMustPushCount: 0,
  maximumMustPushBoundaryIncidentCount: 0,
};

const REMEDIATION_TARGETS: ObjectSignalRemediationFixturePack["targets"] = {
  maximumUncontainedCount: 0,
  maximumCanonicalMemoryWrites: 0,
  maximumOfficialWrites: 0,
  minimumBlastRadiusCoveragePercent: 100,
  minimumLearningCandidateCount: 1,
};

const AUDIENCE_TARGETS = {
  maximumHumanBulletCount: 3,
  minimumReviewerEvidenceCoveragePercent: 100,
  maximumWorkerForbiddenActionLeakCount: 0,
  maximumRawPayloadEchoCount: 0,
  maximumAutoExecutionAttemptCount: 0,
  maximumCanonicalMemoryWriteCount: 0,
};

export function runBusinessAdvancementSignalPipelineEval(
  fixturePack: BusinessAdvancementPipelineFixturePack =
    pipelineFixturePack as BusinessAdvancementPipelineFixturePack,
): BusinessAdvancementPipelineEvalSummary {
  const caseResults = fixturePack.cases.map((item) => evaluateBusinessAdvancementPipelineCase(item));
  const sourceKindCount = new Set(caseResults.map((item) => item.sourceKind)).size;
  const mustPushItemCount = caseResults.filter((item) => item.outputs.mustPushItem).length;
  const reviewRequiredActionCount = caseResults.filter((item) => item.outputs.reviewRequiredAction).length;
  const workerInstructionCount = caseResults.filter((item) => item.outputs.workerInstruction).length;
  const learningCandidateCount = caseResults.filter((item) => item.outputs.learningCandidate).length;
  const remediationCases = caseResults.filter((item) => item.remediation);
  const invalidMustPushItemCount = caseResults.filter((item) => item.invalidMustPushItem).length;
  const rawPayloadEchoCount = caseResults.reduce((sum, item) => sum + item.rawPayloadEchoCount, 0);
  const autoExecutionAttemptCount = caseResults.filter((item) => item.audience.worker.autoExecutionAttempted).length;
  const officialWriteAttemptCount = caseResults.reduce((sum, item) => sum + item.officialWriteAttemptCount, 0);
  const canonicalMemoryWriteCount = caseResults.filter(
    (item) => item.audience.learning.canonicalMemoryWriteAttempted,
  ).length;
  const averageReviewerEvidenceCoveragePercent = average(
    caseResults.map((item) => item.audience.review.evidenceCoveragePercent),
  );
  const averageRemediationCoveragePercent = average(
    remediationCases.map((item) => item.remediation?.blastRadiusCoveragePercent ?? 100),
  );
  const failures = caseResults.flatMap((item) =>
    item.failures.map((reason) => ({ caseId: item.caseId, reason })),
  );

  pushSummaryFailure(
    failures,
    fixturePack.cases.length < fixturePack.targets.minimumTotalCases,
    `total_cases:${fixturePack.cases.length}`,
  );
  pushSummaryFailure(
    failures,
    sourceKindCount < fixturePack.targets.minimumSourceKindCount,
    `source_kind_count:${sourceKindCount}`,
  );
  pushSummaryFailure(
    failures,
    mustPushItemCount < fixturePack.targets.minimumMustPushItemCount ||
      mustPushItemCount > fixturePack.targets.maximumMustPushItemCount,
    `must_push_item_count:${mustPushItemCount}`,
  );
  pushSummaryFailure(
    failures,
    invalidMustPushItemCount > fixturePack.targets.maximumInvalidMustPushItemCount,
    `invalid_must_push_item_count:${invalidMustPushItemCount}`,
  );
  pushSummaryFailure(
    failures,
    rawPayloadEchoCount > fixturePack.targets.maximumRawPayloadEchoCount,
    `raw_payload_echo_count:${rawPayloadEchoCount}`,
  );
  pushSummaryFailure(
    failures,
    autoExecutionAttemptCount > fixturePack.targets.maximumAutoExecutionAttemptCount,
    `auto_execution_attempt_count:${autoExecutionAttemptCount}`,
  );
  pushSummaryFailure(
    failures,
    officialWriteAttemptCount > fixturePack.targets.maximumOfficialWriteAttemptCount,
    `official_write_attempt_count:${officialWriteAttemptCount}`,
  );
  pushSummaryFailure(
    failures,
    canonicalMemoryWriteCount > fixturePack.targets.maximumCanonicalMemoryWriteCount,
    `canonical_memory_write_count:${canonicalMemoryWriteCount}`,
  );
  pushSummaryFailure(
    failures,
    learningCandidateCount < fixturePack.targets.minimumLearningCandidateCount,
    `learning_candidate_count:${learningCandidateCount}`,
  );
  pushSummaryFailure(
    failures,
    averageReviewerEvidenceCoveragePercent < fixturePack.targets.minimumReviewerEvidenceCoveragePercent,
    `reviewer_evidence_coverage:${averageReviewerEvidenceCoveragePercent}`,
  );
  pushSummaryFailure(
    failures,
    remediationCases.length > 0 &&
      averageRemediationCoveragePercent < fixturePack.targets.minimumRemediationCoveragePercent,
    `remediation_coverage:${averageRemediationCoveragePercent}`,
  );

  return {
    passed: failures.length === 0,
    version: fixturePack.version,
    totalCases: fixturePack.cases.length,
    sourceKindCount,
    mustPushItemCount,
    reviewRequiredActionCount,
    workerInstructionCount,
    learningCandidateCount,
    remediationCaseCount: remediationCases.length,
    invalidMustPushItemCount,
    rawPayloadEchoCount,
    autoExecutionAttemptCount,
    officialWriteAttemptCount,
    canonicalMemoryWriteCount,
    averageReviewerEvidenceCoveragePercent,
    averageRemediationCoveragePercent,
    caseResults,
    failures,
  };
}

export function evaluateBusinessAdvancementPipelineCase(
  item: BusinessAdvancementPipelineCase,
): BusinessAdvancementPipelineCaseResult {
  const validity = evaluateValidity(item);
  const sourcePreflightBlocked = shouldBlockSourcePreflight(item.source);
  const remediation = sourcePreflightBlocked ? undefined : evaluateRemediation(item, validity.disposition);
  const finalDisposition = sourcePreflightBlocked
    ? "rejected"
    : remediation?.finalDisposition ?? validity.disposition;
  const audience = evaluateAudience(item, finalDisposition, sourcePreflightBlocked);
  const outputs = buildOutputs(audience, remediation, sourcePreflightBlocked);
  const invalidMustPushItem = outputs.mustPushItem && finalDisposition !== "must_push_ready";
  const rawPayloadEchoCount = audience.rawPayloadEchoCount;
  const officialWriteAttemptCount = outputs.mustPushItem && item.signal.officialWriteIntent ? 1 : 0;
  const failures = collectPipelineFailures({
    item,
    validity,
    remediation,
    audience,
    finalDisposition,
    outputs,
    invalidMustPushItem,
    rawPayloadEchoCount,
    officialWriteAttemptCount,
    sourcePreflightBlocked,
  });

  return {
    caseId: item.id,
    sourceKind: item.source.kind,
    validity,
    remediation,
    audience,
    finalDisposition,
    outputs,
    invalidMustPushItem,
    rawPayloadEchoCount,
    officialWriteAttemptCount,
    failures,
  };
}

function evaluateValidity(item: BusinessAdvancementPipelineCase): ObjectSignalValidityCaseResult {
  const summary = runObjectSignalValidityEval({
    version: `pipeline-validity:${item.id}`,
    status: "offline_evaluation_fixture",
    redactionPosture: "synthetic_and_alias_only",
    boundary: "pipeline_validity_subgate",
    targets: VALIDITY_TARGETS,
    cases: [
      {
        id: item.id,
        expectedDisposition: item.expectedValidityDisposition,
        object: item.object,
        signal: item.signal,
      },
    ],
  });

  return summary.caseResults[0] as ObjectSignalValidityCaseResult;
}

function evaluateRemediation(
  item: BusinessAdvancementPipelineCase,
  initialDisposition: ObjectSignalDisposition,
): ObjectSignalRemediationCaseResult | undefined {
  if (!item.postAdmission) {
    return undefined;
  }

  const remediationCase: ObjectSignalRemediationEvalCase = {
    id: item.id,
    initialDisposition,
    expectedFinalDisposition: item.expectedFinalDisposition,
    expectedContainment: item.postAdmission.expectedContainment,
    currentExposures: item.postAdmission.currentExposures,
    postAdmissionFindings: item.postAdmission.postAdmissionFindings,
    operatorCorrection: item.postAdmission.operatorCorrection,
    expectedActions: item.postAdmission.expectedActions,
  };
  const summary = runObjectSignalRemediationEval({
    version: `pipeline-remediation:${item.id}`,
    status: "offline_evaluation_fixture",
    redactionPosture: "synthetic_and_alias_only",
    boundary: "pipeline_remediation_subgate",
    targets: REMEDIATION_TARGETS,
    cases: [remediationCase],
  });

  return summary.caseResults[0] as ObjectSignalRemediationCaseResult;
}

function evaluateAudience(
  item: BusinessAdvancementPipelineCase,
  finalDisposition: ObjectSignalDisposition,
  sourcePreflightBlocked: boolean,
): AudienceSignalCaseResult {
  const audienceCase: AudienceSignalEvalCase = {
    id: item.id,
    expectedDecision: item.expectedAudienceDecision,
    candidate: {
      validityDisposition: finalDisposition,
      signalType: item.signal.signalType,
      severity: item.signal.severity,
      objectRef: item.object.canonicalObjectRef,
      evidenceRefs: item.signal.evidenceRefs,
      contradictoryEvidenceRefs: item.signal.contradictoryEvidenceRefs,
      hasOwner: item.signal.hasOwner,
      hasNextAction: item.signal.hasNextAction,
      hasBoundaryNote: item.signal.hasBoundaryNote,
      hasReviewPosture: item.signal.hasReviewPosture,
      suggestedSafeActions: item.safeActionRequests,
      unsafeActionRequests: item.unsafeActionRequests,
      rawPayloadIncluded: sourcePreflightBlocked ? false : item.source.rawPayloadIncluded,
    },
    expectations: {
      humanMode: expectedHumanMode(item.expectedAudienceDecision),
      workerMode: expectedWorkerMode(item.expectedAudienceDecision),
      reviewRequired:
        item.expectedOutputs.reviewRequiredAction || item.expectedAudienceDecision === "reject_and_contain",
      learningCategory: expectedLearningCategory(item.expectedAudienceDecision),
    },
  };

  return evaluateAudienceSignalCase(audienceCase, { targets: AUDIENCE_TARGETS });
}

function buildOutputs(
  audience: AudienceSignalCaseResult,
  remediation: ObjectSignalRemediationCaseResult | undefined,
  sourcePreflightBlocked: boolean,
): BusinessAdvancementPipelineOutputs {
  return {
    mustPushItem: audience.decision === "surface_to_human_and_worker" && audience.human.surfaced,
    reviewRequiredAction: audience.review.required,
    workerInstruction: audience.worker.instructionAllowed,
    learningCandidate: audience.learning.candidateCreated,
    remediationContainment: remediation?.containment ?? "not_required",
    sourcePreflightBlocked,
  };
}

function collectPipelineFailures(input: {
  item: BusinessAdvancementPipelineCase;
  validity: ObjectSignalValidityCaseResult;
  remediation?: ObjectSignalRemediationCaseResult;
  audience: AudienceSignalCaseResult;
  finalDisposition: ObjectSignalDisposition;
  outputs: BusinessAdvancementPipelineOutputs;
  invalidMustPushItem: boolean;
  rawPayloadEchoCount: number;
  officialWriteAttemptCount: number;
  sourcePreflightBlocked: boolean;
}) {
  const {
    item,
    validity,
    remediation,
    audience,
    finalDisposition,
    outputs,
    invalidMustPushItem,
    rawPayloadEchoCount,
    officialWriteAttemptCount,
    sourcePreflightBlocked,
  } = input;
  const failures = [
    ...(validity.disposition === item.expectedValidityDisposition ? [] : ["validity_disposition_mismatch"]),
    ...(finalDisposition === item.expectedFinalDisposition ? [] : ["final_disposition_mismatch"]),
    ...(audience.decision === item.expectedAudienceDecision ? [] : ["audience_decision_mismatch"]),
    ...(outputs.mustPushItem === item.expectedOutputs.mustPushItem ? [] : ["must_push_output_mismatch"]),
    ...(outputs.reviewRequiredAction === item.expectedOutputs.reviewRequiredAction
      ? []
      : ["review_required_action_output_mismatch"]),
    ...(outputs.workerInstruction === item.expectedOutputs.workerInstruction
      ? []
      : ["worker_instruction_output_mismatch"]),
    ...(outputs.learningCandidate === item.expectedOutputs.learningCandidate
      ? []
      : ["learning_candidate_output_mismatch"]),
    ...(outputs.remediationContainment === item.expectedOutputs.remediationContainment
      ? []
      : ["remediation_containment_output_mismatch"]),
    ...(invalidMustPushItem ? ["invalid_must_push_item"] : []),
    ...(rawPayloadEchoCount > 0 ? ["raw_payload_echo"] : []),
    ...(audience.worker.autoExecutionAttempted ? ["auto_execution_attempt"] : []),
    ...(officialWriteAttemptCount > 0 ? ["official_write_attempt"] : []),
    ...(audience.learning.canonicalMemoryWriteAttempted ? ["canonical_memory_write_attempt"] : []),
    ...audience.failures.map((reason) => `audience:${reason}`),
  ];

  if (item.postAdmission && !remediation) {
    failures.push("remediation_expected_but_missing");
  }
  if (remediation?.uncontained) {
    failures.push("remediation_uncontained");
  }
  if (sourcePreflightBlocked && finalDisposition !== "rejected") {
    failures.push("source_preflight_not_rejected");
  }

  return failures;
}

function shouldBlockSourcePreflight(source: BusinessAdvancementPipelineSource): boolean {
  return source.redactionStatus === "unredacted" || source.rawPayloadIncluded;
}

function expectedHumanMode(decision: AudienceSignalDecision): AudienceSignalEvalCase["expectations"]["humanMode"] {
  const map = {
    surface_to_human_and_worker: "compact_must_push",
    review_first: "review_banner",
    watch_only_digest: "digest_or_suppress",
    reject_and_contain: "suppress_and_alert_reviewer",
  } as const;
  return map[decision];
}

function expectedWorkerMode(decision: AudienceSignalDecision): AudienceSignalEvalCase["expectations"]["workerMode"] {
  const map = {
    surface_to_human_and_worker: "bounded_instruction",
    review_first: "review_packet_only",
    watch_only_digest: "no_instruction",
    reject_and_contain: "blocked",
  } as const;
  return map[decision];
}

function expectedLearningCategory(
  decision: AudienceSignalDecision,
): AudienceSignalEvalCase["expectations"]["learningCategory"] {
  const map = {
    surface_to_human_and_worker: "positive_pattern_candidate",
    review_first: "threshold_or_boundary_candidate",
    watch_only_digest: "noise_or_freshness_candidate",
    reject_and_contain: "negative_fixture_candidate",
  } as const;
  return map[decision];
}

function pushSummaryFailure(
  failures: BusinessAdvancementPipelineEvalSummary["failures"],
  failed: boolean,
  reason: string,
) {
  if (failed) {
    failures.push({ caseId: "__summary__", reason });
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 100;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
