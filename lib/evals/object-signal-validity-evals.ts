import objectSignalFixturePack from "@/evals/object-signal-validity/object-signal-cases.json";
import objectSignalRemediationFixturePack from "@/evals/object-signal-validity/object-signal-remediation-cases.json";

export type ObjectSignalDisposition =
  | "must_push_ready"
  | "review_required"
  | "watch_only"
  | "rejected";

export type ObjectSignalSeverity = "watch" | "normal" | "high" | "critical";

export type ObjectSignalPermissionPosture =
  | "sufficient"
  | "review_required"
  | "insufficient"
  | "unknown";

export type ObjectSignalIdentity = {
  workspaceId: string;
  tenantKey: string;
  sourceWindowKey: string;
  objectType: string;
  objectId: string;
  canonicalObjectRef: string;
  identityStable: boolean;
  tenantMismatch: boolean;
  crossWorkspaceConflict: boolean;
  permissionPosture?: ObjectSignalPermissionPosture;
};

export type ObjectSignalCandidate = {
  signalKey: string;
  signalType: string;
  severity: ObjectSignalSeverity;
  evidenceRefs: string[];
  evidenceFreshnessHours: number;
  sourceCount: number;
  hasOwner: boolean;
  hasNextAction: boolean;
  hasBoundaryNote: boolean;
  hasReviewPosture: boolean;
  hasOutcomeMetric: boolean;
  contradictoryEvidenceRefs: string[];
  duplicateSignal: boolean;
  unsafeBoundary: boolean;
  llmFinalRanking: boolean;
  autoPromotion: boolean;
  officialWriteIntent: boolean;
  hallucinatedEvidenceRefs?: string[];
};

export type ObjectSignalValidityEvalCase = {
  id: string;
  expectedDisposition: ObjectSignalDisposition;
  object: ObjectSignalIdentity;
  signal: ObjectSignalCandidate;
};

export type ObjectSignalValidityFixturePack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  targets: {
    minimumReadyScore: number;
    minimumEvidenceRefCount: number;
    maximumFreshnessHours: number;
    maximumInvalidMustPushCount: number;
    maximumMustPushBoundaryIncidentCount: number;
  };
  cases: ObjectSignalValidityEvalCase[];
};

export type ObjectSignalValidityCaseResult = {
  caseId: string;
  expectedDisposition: ObjectSignalDisposition;
  disposition: ObjectSignalDisposition;
  readyScore: number;
  evidenceCoveragePercent: number;
  identityValid: boolean;
  freshnessValid: boolean;
  hasContradiction: boolean;
  boundaryIncidentCount: number;
  invalidMustPush: boolean;
  reasons: string[];
};

export type ObjectSignalValidityEvalSummary = {
  passed: boolean;
  version: string;
  totalCases: number;
  mustPushReadyCases: number;
  reviewRequiredCases: number;
  watchOnlyCases: number;
  rejectedCases: number;
  invalidMustPushCount: number;
  totalBoundaryIncidentCount: number;
  mustPushBoundaryIncidentCount: number;
  averageReadyScore: number;
  caseResults: ObjectSignalValidityCaseResult[];
  failures: Array<{
    caseId: string;
    reason: string;
  }>;
};

export type ObjectSignalContainment = "unchanged" | "downgraded" | "revoked" | "quarantined";

export type ObjectSignalPostAdmissionFindings = {
  staleEvidence: boolean;
  contradictoryEvidence: boolean;
  duplicateSignal: boolean;
  wrongObjectBinding: boolean;
  tenantMismatch: boolean;
  unsafeBoundary: boolean;
  officialWriteIntent: boolean;
  canonicalMemoryWrite: boolean;
};

export type ObjectSignalCurrentExposures = {
  mustPushItemIds: string[];
  reviewPacketIds: string[];
  draftIds: string[];
  memoryCandidateIds: string[];
  canonicalMemoryIds: string[];
  skillSuggestionIds: string[];
  officialWriteIds: string[];
};

export type ObjectSignalRemediationEvalCase = {
  id: string;
  initialDisposition: ObjectSignalDisposition;
  expectedFinalDisposition: ObjectSignalDisposition;
  expectedContainment: ObjectSignalContainment;
  currentExposures: ObjectSignalCurrentExposures;
  postAdmissionFindings: ObjectSignalPostAdmissionFindings;
  operatorCorrection: string;
  expectedActions: string[];
};

export type ObjectSignalRemediationFixturePack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  targets: {
    maximumUncontainedCount: number;
    maximumCanonicalMemoryWrites: number;
    maximumOfficialWrites: number;
    minimumBlastRadiusCoveragePercent: number;
    minimumLearningCandidateCount: number;
  };
  cases: ObjectSignalRemediationEvalCase[];
};

export type ObjectSignalRemediationCaseResult = {
  caseId: string;
  expectedFinalDisposition: ObjectSignalDisposition;
  finalDisposition: ObjectSignalDisposition;
  expectedContainment: ObjectSignalContainment;
  containment: ObjectSignalContainment;
  blastRadiusExposureCount: number;
  blastRadiusCoveredCount: number;
  blastRadiusCoveragePercent: number;
  memoryContaminationContained: boolean;
  officialWriteContained: boolean;
  learningCandidateCreated: boolean;
  uncontained: boolean;
  actions: string[];
  reasons: string[];
};

export type ObjectSignalRemediationEvalSummary = {
  passed: boolean;
  version: string;
  totalCases: number;
  revokedCases: number;
  downgradedCases: number;
  quarantinedCases: number;
  uncontainedCount: number;
  canonicalMemoryWriteCount: number;
  officialWriteCount: number;
  learningCandidateCount: number;
  averageBlastRadiusCoveragePercent: number;
  caseResults: ObjectSignalRemediationCaseResult[];
  failures: Array<{
    caseId: string;
    reason: string;
  }>;
};

const MISSING_FIELD_REASONS: Array<[keyof ObjectSignalCandidate, string]> = [
  ["hasOwner", "missing_owner"],
  ["hasNextAction", "missing_next_action"],
  ["hasBoundaryNote", "missing_boundary_note"],
  ["hasReviewPosture", "missing_review_posture"],
  ["hasOutcomeMetric", "missing_outcome_metric"],
];

export function runObjectSignalValidityEval(
  fixturePack: ObjectSignalValidityFixturePack =
    objectSignalFixturePack as ObjectSignalValidityFixturePack,
): ObjectSignalValidityEvalSummary {
  const caseResults = fixturePack.cases.map((item) => evaluateCase(item, fixturePack));
  const invalidMustPushCount = caseResults.filter((item) => item.invalidMustPush).length;
  const totalBoundaryIncidentCount = caseResults.reduce((sum, item) => sum + item.boundaryIncidentCount, 0);
  const mustPushBoundaryIncidentCount = caseResults
    .filter((item) => item.disposition === "must_push_ready")
    .reduce((sum, item) => sum + item.boundaryIncidentCount, 0);
  const failures = caseResults.flatMap((item) => [
    ...(item.disposition === item.expectedDisposition
      ? []
      : [{ caseId: item.caseId, reason: "disposition_expectation_mismatch" }]),
    ...(item.invalidMustPush ? [{ caseId: item.caseId, reason: "invalid_must_push" }] : []),
  ]);

  if (invalidMustPushCount > fixturePack.targets.maximumInvalidMustPushCount) {
    failures.push({
      caseId: "__summary__",
      reason: `invalid_must_push_count:${invalidMustPushCount}`,
    });
  }

  if (mustPushBoundaryIncidentCount > fixturePack.targets.maximumMustPushBoundaryIncidentCount) {
    failures.push({
      caseId: "__summary__",
      reason: `must_push_boundary_incident_count:${mustPushBoundaryIncidentCount}`,
    });
  }

  return {
    passed: failures.length === 0,
    version: fixturePack.version,
    totalCases: caseResults.length,
    mustPushReadyCases: caseResults.filter((item) => item.disposition === "must_push_ready").length,
    reviewRequiredCases: caseResults.filter((item) => item.disposition === "review_required").length,
    watchOnlyCases: caseResults.filter((item) => item.disposition === "watch_only").length,
    rejectedCases: caseResults.filter((item) => item.disposition === "rejected").length,
    invalidMustPushCount,
    totalBoundaryIncidentCount,
    mustPushBoundaryIncidentCount,
    averageReadyScore: average(caseResults.map((item) => item.readyScore)),
    caseResults,
    failures,
  };
}

export function runObjectSignalRemediationEval(
  fixturePack: ObjectSignalRemediationFixturePack =
    objectSignalRemediationFixturePack as ObjectSignalRemediationFixturePack,
): ObjectSignalRemediationEvalSummary {
  const caseResults = fixturePack.cases.map((item) => evaluateRemediationCase(item));
  const uncontainedCount = caseResults.filter((item) => item.uncontained).length;
  const canonicalMemoryWriteCount = caseResults.filter((item) => !item.memoryContaminationContained).length;
  const officialWriteCount = caseResults.filter((item) => !item.officialWriteContained).length;
  const learningCandidateCount = caseResults.filter((item) => item.learningCandidateCreated).length;
  const failures = caseResults.flatMap((item) => [
    ...(item.finalDisposition === item.expectedFinalDisposition
      ? []
      : [{ caseId: item.caseId, reason: "final_disposition_expectation_mismatch" }]),
    ...(item.containment === item.expectedContainment
      ? []
      : [{ caseId: item.caseId, reason: "containment_expectation_mismatch" }]),
    ...(item.blastRadiusCoveragePercent >= fixturePack.targets.minimumBlastRadiusCoveragePercent
      ? []
      : [{ caseId: item.caseId, reason: `blast_radius_coverage:${item.blastRadiusCoveragePercent}` }]),
    ...(item.memoryContaminationContained
      ? []
      : [{ caseId: item.caseId, reason: "canonical_memory_not_tombstoned" }]),
    ...(item.officialWriteContained ? [] : [{ caseId: item.caseId, reason: "official_write_not_blocked" }]),
    ...(item.learningCandidateCreated ? [] : [{ caseId: item.caseId, reason: "learning_candidate_missing" }]),
  ]);

  if (uncontainedCount > fixturePack.targets.maximumUncontainedCount) {
    failures.push({
      caseId: "__summary__",
      reason: `uncontained_count:${uncontainedCount}`,
    });
  }
  if (canonicalMemoryWriteCount > fixturePack.targets.maximumCanonicalMemoryWrites) {
    failures.push({
      caseId: "__summary__",
      reason: `canonical_memory_write_count:${canonicalMemoryWriteCount}`,
    });
  }
  if (officialWriteCount > fixturePack.targets.maximumOfficialWrites) {
    failures.push({
      caseId: "__summary__",
      reason: `official_write_count:${officialWriteCount}`,
    });
  }
  if (learningCandidateCount < fixturePack.targets.minimumLearningCandidateCount) {
    failures.push({
      caseId: "__summary__",
      reason: `learning_candidate_count:${learningCandidateCount}`,
    });
  }

  return {
    passed: failures.length === 0,
    version: fixturePack.version,
    totalCases: caseResults.length,
    revokedCases: caseResults.filter((item) => item.containment === "revoked").length,
    downgradedCases: caseResults.filter((item) => item.containment === "downgraded").length,
    quarantinedCases: caseResults.filter((item) => item.containment === "quarantined").length,
    uncontainedCount,
    canonicalMemoryWriteCount,
    officialWriteCount,
    learningCandidateCount,
    averageBlastRadiusCoveragePercent: average(caseResults.map((item) => item.blastRadiusCoveragePercent)),
    caseResults,
    failures,
  };
}

function evaluateRemediationCase(item: ObjectSignalRemediationEvalCase): ObjectSignalRemediationCaseResult {
  const reasons = collectRemediationReasons(item);
  const finalDisposition = classifyRemediationDisposition(item);
  const containment = classifyContainment(finalDisposition, item.initialDisposition);
  const blastRadius = measureBlastRadiusCoverage(item.currentExposures, item.expectedActions);
  const memoryContaminationContained =
    !hasCanonicalMemoryContamination(item) || item.expectedActions.includes("tombstone_canonical_memory");
  const officialWriteContained =
    !hasOfficialWriteExposure(item) || item.expectedActions.includes("block_official_write");
  const learningCandidateCreated = item.expectedActions.includes("create_learning_candidate");
  const uncontained =
    finalDisposition !== item.expectedFinalDisposition ||
    containment !== item.expectedContainment ||
    blastRadius.coveragePercent < 100 ||
    !memoryContaminationContained ||
    !officialWriteContained ||
    !learningCandidateCreated;

  return {
    caseId: item.id,
    expectedFinalDisposition: item.expectedFinalDisposition,
    finalDisposition,
    expectedContainment: item.expectedContainment,
    containment,
    blastRadiusExposureCount: blastRadius.exposureCount,
    blastRadiusCoveredCount: blastRadius.coveredCount,
    blastRadiusCoveragePercent: blastRadius.coveragePercent,
    memoryContaminationContained,
    officialWriteContained,
    learningCandidateCreated,
    uncontained,
    actions: item.expectedActions,
    reasons,
  };
}

function evaluateCase(
  item: ObjectSignalValidityEvalCase,
  fixturePack: ObjectSignalValidityFixturePack,
): ObjectSignalValidityCaseResult {
  const reasons = collectReasons(item, fixturePack);
  const boundaryIncidentCount = reasons.filter((reason) =>
    [
      "missing_boundary_note",
      "unsafe_boundary",
      "llm_final_ranking_forbidden",
      "auto_promotion_forbidden",
      "official_write_intent_forbidden",
      "permission_insufficient",
      "hallucinated_evidence",
    ].includes(reason),
  ).length;
  const identityValid = !reasons.some((reason) =>
    ["identity_unstable", "tenant_mismatch", "cross_workspace_conflict", "missing_identity"].includes(reason),
  );
  const freshnessValid = !reasons.includes("evidence_stale");
  const hasContradiction = reasons.includes("contradictory_evidence");
  const disposition = classifyDisposition(item, reasons);
  const readyScore = scoreCase({
    reasons,
    evidenceCount: item.signal.evidenceRefs.length,
    minimumEvidenceRefCount: fixturePack.targets.minimumEvidenceRefCount,
  });
  const evidenceCoveragePercent = Math.min(
    100,
    Math.round((item.signal.evidenceRefs.length / fixturePack.targets.minimumEvidenceRefCount) * 100),
  );
  const invalidMustPush = item.expectedDisposition === "must_push_ready" && disposition !== "must_push_ready";

  return {
    caseId: item.id,
    expectedDisposition: item.expectedDisposition,
    disposition,
    readyScore,
    evidenceCoveragePercent,
    identityValid,
    freshnessValid,
    hasContradiction,
    boundaryIncidentCount,
    invalidMustPush,
    reasons,
  };
}

function collectReasons(
  item: ObjectSignalValidityEvalCase,
  fixturePack: ObjectSignalValidityFixturePack,
) {
  const reasons: string[] = [];
  const identityValues = [
    item.object.workspaceId,
    item.object.tenantKey,
    item.object.sourceWindowKey,
    item.object.objectType,
    item.object.objectId,
    item.object.canonicalObjectRef,
    item.signal.signalKey,
  ];

  if (identityValues.some((value) => value.trim().length === 0)) {
    reasons.push("missing_identity");
  }
  if (!item.object.identityStable) {
    reasons.push("identity_unstable");
  }
  if (item.object.tenantMismatch) {
    reasons.push("tenant_mismatch");
  }
  if (item.object.crossWorkspaceConflict) {
    reasons.push("cross_workspace_conflict");
  }
  if (item.signal.evidenceRefs.length < fixturePack.targets.minimumEvidenceRefCount) {
    reasons.push(`evidence_ref_count_below_target:${item.signal.evidenceRefs.length}`);
  }
  if (item.signal.sourceCount < fixturePack.targets.minimumEvidenceRefCount) {
    reasons.push(`source_count_below_target:${item.signal.sourceCount}`);
  }
  if (item.signal.evidenceFreshnessHours > fixturePack.targets.maximumFreshnessHours) {
    reasons.push("evidence_stale");
  }
  if (item.signal.contradictoryEvidenceRefs.length > 0) {
    reasons.push("contradictory_evidence");
  }
  if (item.signal.duplicateSignal) {
    reasons.push("duplicate_signal");
  }
  if (item.signal.unsafeBoundary) {
    reasons.push("unsafe_boundary");
  }
  if (item.signal.llmFinalRanking) {
    reasons.push("llm_final_ranking_forbidden");
  }
  if (item.signal.autoPromotion) {
    reasons.push("auto_promotion_forbidden");
  }
  if (item.signal.officialWriteIntent) {
    reasons.push("official_write_intent_forbidden");
  }
  if (item.object.permissionPosture === "insufficient") {
    reasons.push("permission_insufficient");
  }
  if (item.object.permissionPosture === "review_required") {
    reasons.push("permission_review_required");
  }
  if (item.signal.hallucinatedEvidenceRefs && item.signal.hallucinatedEvidenceRefs.length > 0) {
    reasons.push("hallucinated_evidence");
  }

  for (const [field, reason] of MISSING_FIELD_REASONS) {
    if (!item.signal[field]) {
      reasons.push(reason);
    }
  }

  return reasons;
}

function classifyDisposition(
  item: ObjectSignalValidityEvalCase,
  reasons: string[],
): ObjectSignalDisposition {
  if (
    reasons.some((reason) =>
      [
        "missing_identity",
        "identity_unstable",
        "tenant_mismatch",
        "cross_workspace_conflict",
        "unsafe_boundary",
        "llm_final_ranking_forbidden",
        "auto_promotion_forbidden",
        "official_write_intent_forbidden",
        "permission_insufficient",
        "hallucinated_evidence",
      ].includes(reason),
    )
  ) {
    return "rejected";
  }

  if (reasons.includes("duplicate_signal") || reasons.includes("evidence_stale")) {
    return "watch_only";
  }

  if (
    reasons.includes("contradictory_evidence") ||
    reasons.includes("permission_review_required") ||
    reasons.includes("missing_owner") ||
    reasons.includes("missing_next_action") ||
    reasons.includes("missing_boundary_note") ||
    reasons.includes("missing_review_posture") ||
    reasons.includes("missing_outcome_metric") ||
    reasons.some((reason) => reason.startsWith("evidence_ref_count_below_target")) ||
    reasons.some((reason) => reason.startsWith("source_count_below_target"))
  ) {
    return "review_required";
  }

  if (item.signal.severity === "watch") {
    return "watch_only";
  }

  return "must_push_ready";
}

function collectRemediationReasons(item: ObjectSignalRemediationEvalCase) {
  const reasons: string[] = [];
  const findings = item.postAdmissionFindings;

  if (findings.staleEvidence) {
    reasons.push("post_admission_stale_evidence");
  }
  if (findings.contradictoryEvidence) {
    reasons.push("post_admission_contradictory_evidence");
  }
  if (findings.duplicateSignal) {
    reasons.push("post_admission_duplicate_signal");
  }
  if (findings.wrongObjectBinding) {
    reasons.push("post_admission_wrong_object_binding");
  }
  if (findings.tenantMismatch) {
    reasons.push("post_admission_tenant_mismatch");
  }
  if (findings.unsafeBoundary) {
    reasons.push("post_admission_unsafe_boundary");
  }
  if (findings.officialWriteIntent) {
    reasons.push("post_admission_official_write_intent");
  }
  if (findings.canonicalMemoryWrite) {
    reasons.push("post_admission_canonical_memory_write");
  }
  if (item.operatorCorrection.trim().length > 0) {
    reasons.push(`operator_correction:${item.operatorCorrection}`);
  }

  return reasons;
}

function classifyRemediationDisposition(item: ObjectSignalRemediationEvalCase): ObjectSignalDisposition {
  const findings = item.postAdmissionFindings;

  if (
    findings.wrongObjectBinding ||
    findings.tenantMismatch ||
    findings.unsafeBoundary ||
    findings.officialWriteIntent
  ) {
    return "rejected";
  }
  if (findings.contradictoryEvidence) {
    return "review_required";
  }
  if (findings.staleEvidence || findings.duplicateSignal) {
    return "watch_only";
  }

  return item.initialDisposition;
}

function classifyContainment(
  finalDisposition: ObjectSignalDisposition,
  initialDisposition: ObjectSignalDisposition,
): ObjectSignalContainment {
  if (finalDisposition === "rejected") {
    return "quarantined";
  }
  if (initialDisposition === "must_push_ready" && finalDisposition === "review_required") {
    return "downgraded";
  }
  if (initialDisposition === "must_push_ready" && finalDisposition === "watch_only") {
    return "revoked";
  }

  return "unchanged";
}

function measureBlastRadiusCoverage(
  exposures: ObjectSignalCurrentExposures,
  actions: string[],
) {
  const coverageChecks: Array<{ count: number; covered: boolean }> = [
    {
      count: exposures.mustPushItemIds.length,
      covered: actions.includes("remove_must_push") || actions.includes("downgrade_to_review_required"),
    },
    {
      count: exposures.reviewPacketIds.length,
      covered: actions.includes("quarantine_review_packet") || actions.includes("attach_blast_radius_report"),
    },
    {
      count: exposures.draftIds.length,
      covered: actions.includes("quarantine_draft") || actions.includes("freeze_draft"),
    },
    {
      count: exposures.memoryCandidateIds.length,
      covered: actions.includes("quarantine_memory_candidate"),
    },
    {
      count: exposures.canonicalMemoryIds.length,
      covered: actions.includes("tombstone_canonical_memory"),
    },
    {
      count: exposures.skillSuggestionIds.length,
      covered: actions.includes("quarantine_skill_suggestion"),
    },
    {
      count: exposures.officialWriteIds.length,
      covered: actions.includes("block_official_write"),
    },
  ];
  const exposureCount = coverageChecks.reduce((sum, item) => sum + item.count, 0);
  const coveredCount = coverageChecks.reduce((sum, item) => sum + (item.covered ? item.count : 0), 0);
  const coveragePercent = exposureCount === 0 ? 100 : Math.round((coveredCount / exposureCount) * 100);

  return {
    exposureCount,
    coveredCount,
    coveragePercent,
  };
}

function hasCanonicalMemoryContamination(item: ObjectSignalRemediationEvalCase) {
  return item.postAdmissionFindings.canonicalMemoryWrite || item.currentExposures.canonicalMemoryIds.length > 0;
}

function hasOfficialWriteExposure(item: ObjectSignalRemediationEvalCase) {
  return item.postAdmissionFindings.officialWriteIntent || item.currentExposures.officialWriteIds.length > 0;
}

function scoreCase(input: {
  reasons: string[];
  evidenceCount: number;
  minimumEvidenceRefCount: number;
}) {
  let score = 100;
  score -= input.reasons.filter((reason) =>
    ["missing_identity", "identity_unstable", "tenant_mismatch", "cross_workspace_conflict"].includes(reason),
  ).length * 30;
  score -= input.reasons.filter((reason) =>
    ["unsafe_boundary", "llm_final_ranking_forbidden", "auto_promotion_forbidden", "official_write_intent_forbidden", "permission_insufficient", "hallucinated_evidence"].includes(
      reason,
    ),
  ).length * 25;
  score -= input.reasons.filter((reason) => reason === "permission_review_required").length * 15;
  score -= input.reasons.filter((reason) =>
    ["contradictory_evidence", "evidence_stale", "duplicate_signal"].includes(reason),
  ).length * 18;
  score -= input.reasons.filter((reason) => reason.startsWith("evidence_ref_count_below_target")).length * 12;
  score -= input.reasons.filter((reason) => reason.startsWith("source_count_below_target")).length * 12;
  score -= input.reasons.filter((reason) =>
    ["missing_owner", "missing_next_action", "missing_boundary_note", "missing_review_posture", "missing_outcome_metric"].includes(
      reason,
    ),
  ).length * 10;
  score -= Math.max(0, input.minimumEvidenceRefCount - input.evidenceCount) * 6;
  return Math.max(0, Math.round(score));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
