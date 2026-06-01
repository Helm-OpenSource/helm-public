// Phase 2.2 / runtime-readiness gate only: this evaluator reviews a
// checked-in, redacted review bundle. It must not import runtime queries,
// Prisma, Next route handlers, provider SDKs, env secrets, or LLM SDKs.
import { createHash } from "node:crypto";

import fixturePack from "@/evals/operating-signal-flow/runtime-readiness-review-cases.json";
import { findForbiddenAuthorityKeyFragment } from "@/lib/shared/forbidden-authority-keys";
import {
  SENSITIVE_VALUE_PATTERN_CODES,
  SENSITIVE_VALUE_PATTERNS,
} from "@/lib/shared/sensitive-patterns";

export type OperatingSignalFlowRuntimeReadinessDecision = "go" | "defer" | "no_go";

export type OperatingSignalFlowRuntimeReadinessFailureSeverity =
  | "hard"
  | "defer"
  | "assertion";

export type OperatingSignalFlowRuntimeReadinessFailure = {
  code: string;
  path: string;
  message: string;
  severity: OperatingSignalFlowRuntimeReadinessFailureSeverity;
};

export type OperatingSignalFlowRuntimeReadinessReviewStatus =
  | "approved"
  | "missing"
  | "pending"
  | "rejected";

export type OperatingSignalFlowRuntimeReadinessCase = {
  id: string;
  description: string;
  expectedDecision: OperatingSignalFlowRuntimeReadinessDecision;
  expectedFailureCodes: string[];
  reviewBundle: {
    adoptionMode: "review_bundle" | "runtime_implementation";
    issuedAt: string;
    expiresAt: string;
    revokedBy: string | null;
    revokedReason: string | null;
    redactedCalibrationSample: {
      present: boolean;
      createdAt: string;
      sampleWindow: "1h" | "24h" | "7d";
      windowStart: string;
      windowEnd: string;
      workspaceScope: "single_workspace" | "multi_workspace";
      redactionStatus: "redacted" | "alias_only" | "synthetic" | "raw_payload";
      evidenceRefCount: number;
      rawPayloadIncluded: boolean;
      calibrationDeltaDocumented: boolean;
      fixtureParityChecked: boolean;
    };
    redactedSnapshotProjection: {
      present: boolean;
      generatedAt: string;
      workspaceIds: string[];
      shapeChecked: boolean;
      fieldSamples: Record<string, string>;
    };
    reviews: {
      dataProtectionReview: {
        status: OperatingSignalFlowRuntimeReadinessReviewStatus;
        reviewedAt: string | null;
        reviewerRole: string;
      };
      requiredReviewerApproval: {
        status: OperatingSignalFlowRuntimeReadinessReviewStatus;
        approvedAt: string | null;
        reviewerRoles: string[];
        minimumRoleCount: number;
      };
      executiveSponsorApproval: {
        status: OperatingSignalFlowRuntimeReadinessReviewStatus;
        approvedAt: string | null;
        sponsorRole: string;
      };
    };
    productionQueryRolloutPlan: {
      present: boolean;
      status: "planned" | "implemented" | "missing";
      queryName: string;
      sourceTableRefs: string[];
      volumeEstimateRowsPerHour: number | null;
      indexPlan: string;
      performanceBudgetMs: number | null;
      observabilityPlan: string;
      rolloutStages: Array<"shadow" | "canary" | "general_review">;
      usesExistingSourcesOnly: boolean;
      singleWorkspaceSnapshotProjection: boolean;
      schemaChangeProposed: boolean;
      apiRouteProposed: boolean;
      runtimeQueryImplemented: boolean;
      rollbackPlanPresent: boolean;
      blastRadius: "single_workspace" | "multi_workspace" | "global";
    };
    llmPosture: {
      explanationOnly: boolean;
      finalRanking: "disabled" | "enabled" | "shadow";
      stateTransitionByLlm: boolean;
    };
    authority: {
      officialWriteAllowed: boolean;
      autoSendAllowed: boolean;
      autoApproveAllowed: boolean;
      silentWriteAllowed: boolean;
      autoExecuteAllowed: boolean;
    };
    artifacts: {
      docsUpdated: boolean;
      evalUpdated: boolean;
      boundaryGuardUpdated: boolean;
    };
    evidenceRefs: string[];
  };
};

export type OperatingSignalFlowRuntimeReadinessReviewBundle =
  OperatingSignalFlowRuntimeReadinessCase["reviewBundle"];

export type OperatingSignalFlowRuntimeReadinessFixturePack = {
  version: string;
  status: string;
  boundary: string;
  evaluatedAt: string;
  targets: {
    minimumTotalCases: number;
    minimumGoDecisionCount: number;
    minimumDeferDecisionCount: number;
    minimumNoGoDecisionCount: number;
    maximumGoCaseFailureCount: number;
    maximumGoCaseHardFailureCount: number;
  };
  cases: OperatingSignalFlowRuntimeReadinessCase[];
};

export type OperatingSignalFlowRuntimeReadinessCaseResult = {
  caseId: string;
  decision: OperatingSignalFlowRuntimeReadinessDecision;
  expectedDecision: OperatingSignalFlowRuntimeReadinessDecision;
  reviewFailures: OperatingSignalFlowRuntimeReadinessFailure[];
  assertionFailures: OperatingSignalFlowRuntimeReadinessFailure[];
  rawPayloadEchoCount: number;
  runtimeImplementationBypassCount: number;
  crossWorkspaceProjectionCount: number;
  llmFinalRankingCount: number;
  authorityLeakCount: number;
};

export type OperatingSignalFlowRuntimeReadinessEvalSummary = {
  passed: boolean;
  version: string;
  evaluatedAt: string;
  inputDigest: string;
  totalCases: number;
  goDecisionCount: number;
  deferDecisionCount: number;
  noGoDecisionCount: number;
  rawPayloadEchoCount: number;
  runtimeImplementationBypassCount: number;
  crossWorkspaceProjectionCount: number;
  llmFinalRankingCount: number;
  authorityLeakCount: number;
  caseResults: OperatingSignalFlowRuntimeReadinessCaseResult[];
  assertionFailures: Array<{ caseId: string; reason: string; path: string }>;
  failures: OperatingSignalFlowRuntimeReadinessFailure[];
};

const DEFAULT_VERSION = "invalid";
const REQUIRED_ROLLOUT_STAGES = new Set(["shadow", "canary", "general_review"]);
const REVIEW_BUNDLE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const OPERATING_SIGNAL_FLOW_REQUIRED_REVIEWER_ROLES = [
  "engineering_reviewer",
  "product_owner",
  "security_reviewer",
  "operations_reviewer",
  "data_protection_reviewer",
] as const;
export const OPERATING_SIGNAL_FLOW_REQUIRED_REVIEWER_MINIMUM_ROLE_COUNT =
  OPERATING_SIGNAL_FLOW_REQUIRED_REVIEWER_ROLES.length;

export function runOperatingSignalFlowRuntimeReadinessEval(
  pack: unknown = fixturePack,
): OperatingSignalFlowRuntimeReadinessEvalSummary {
  const shapeFailure = validateFixturePackShape(pack);
  if (shapeFailure) {
    return buildInvalidSummary(shapeFailure);
  }

  const typedPack = pack as OperatingSignalFlowRuntimeReadinessFixturePack;
  const caseResults = typedPack.cases.map((item) =>
    evaluateOperatingSignalFlowRuntimeReadinessCase(item, typedPack.evaluatedAt),
  );
  const assertionFailures = caseResults.flatMap((item) =>
    item.assertionFailures.map((failure) => ({
      caseId: item.caseId,
      reason: failure.code,
      path: failure.path,
    })),
  );
  const failures = caseResults.flatMap((item) => item.assertionFailures);
  const goDecisionCount = caseResults.filter((item) => item.decision === "go").length;
  const deferDecisionCount = caseResults.filter((item) => item.decision === "defer").length;
  const noGoDecisionCount = caseResults.filter((item) => item.decision === "no_go").length;
  const goCaseFailureCount = caseResults
    .filter((item) => item.expectedDecision === "go")
    .reduce((count, item) => count + item.reviewFailures.length, 0);
  const goCaseHardFailureCount = caseResults
    .filter((item) => item.expectedDecision === "go")
    .reduce(
      (count, item) =>
        count + item.reviewFailures.filter((failure) => failure.severity === "hard").length,
      0,
    );

  pushSummaryFailure(
    failures,
    typedPack.cases.length < typedPack.targets.minimumTotalCases,
    "minimum_total_cases",
  );
  pushSummaryFailure(
    failures,
    goDecisionCount < typedPack.targets.minimumGoDecisionCount,
    "minimum_go_decision_count",
  );
  pushSummaryFailure(
    failures,
    deferDecisionCount < typedPack.targets.minimumDeferDecisionCount,
    "minimum_defer_decision_count",
  );
  pushSummaryFailure(
    failures,
    noGoDecisionCount < typedPack.targets.minimumNoGoDecisionCount,
    "minimum_no_go_decision_count",
  );
  pushSummaryFailure(
    failures,
    goCaseFailureCount > typedPack.targets.maximumGoCaseFailureCount,
    "maximum_go_case_failure_count",
  );
  pushSummaryFailure(
    failures,
    goCaseHardFailureCount > typedPack.targets.maximumGoCaseHardFailureCount,
    "maximum_go_case_hard_failure_count",
  );

  return {
    passed: assertionFailures.length === 0 && failures.length === 0,
    version: typedPack.version,
    evaluatedAt: typedPack.evaluatedAt,
    inputDigest: digestInput(typedPack),
    totalCases: typedPack.cases.length,
    goDecisionCount,
    deferDecisionCount,
    noGoDecisionCount,
    rawPayloadEchoCount: sum(caseResults, "rawPayloadEchoCount"),
    runtimeImplementationBypassCount: sum(caseResults, "runtimeImplementationBypassCount"),
    crossWorkspaceProjectionCount: sum(caseResults, "crossWorkspaceProjectionCount"),
    llmFinalRankingCount: sum(caseResults, "llmFinalRankingCount"),
    authorityLeakCount: sum(caseResults, "authorityLeakCount"),
    caseResults,
    assertionFailures,
    failures,
  };
}

export function evaluateOperatingSignalFlowRuntimeReadinessJson(
  jsonText: string,
): OperatingSignalFlowRuntimeReadinessEvalSummary {
  try {
    return runOperatingSignalFlowRuntimeReadinessEval(JSON.parse(jsonText));
  } catch {
    return buildInvalidSummary(failure("invalid_json", "$", "Fixture JSON must parse deterministically.", "hard"));
  }
}

export function evaluateOperatingSignalFlowRuntimeReadinessCase(
  evalCase: OperatingSignalFlowRuntimeReadinessCase,
  evaluatedAt = "2026-05-17T16:00:00+08:00",
): OperatingSignalFlowRuntimeReadinessCaseResult {
  const reviewFailures = collectReviewFailures(evalCase, evaluatedAt);
  const decision = classifyDecision(reviewFailures);
  const assertionFailures: OperatingSignalFlowRuntimeReadinessFailure[] = [];
  const reviewFailureCodes = new Set(reviewFailures.map((item) => item.code));

  pushAssertionFailure(
    assertionFailures,
    decision !== evalCase.expectedDecision,
    "decision_mismatch",
    "$.expectedDecision",
  );
  for (const expectedCode of evalCase.expectedFailureCodes) {
    pushAssertionFailure(
      assertionFailures,
      !reviewFailureCodes.has(expectedCode),
      `expected_failure_not_detected:${expectedCode}`,
      "$.expectedFailureCodes",
    );
  }
  pushAssertionFailure(
    assertionFailures,
    evalCase.expectedDecision === "go" && reviewFailures.length > 0,
    "go_case_has_review_failures",
    "$.reviewBundle",
  );

  return buildCaseResult(
    evalCase.id,
    decision,
    evalCase.expectedDecision,
    reviewFailures,
    assertionFailures,
  );
}

export function scoreOperatingSignalFlowRuntimeReadinessBundle(
  reviewBundle: OperatingSignalFlowRuntimeReadinessReviewBundle,
  evaluatedAt = "2026-05-17T16:00:00+08:00",
  caseId = "OSF-RRG-INTAKE",
): OperatingSignalFlowRuntimeReadinessCaseResult {
  const evalCase: OperatingSignalFlowRuntimeReadinessCase = {
    id: caseId,
    description: "Single review bundle intake screen case.",
    expectedDecision: "go",
    expectedFailureCodes: [],
    reviewBundle,
  };
  const reviewFailures = collectReviewFailures(evalCase, evaluatedAt);
  const decision = classifyDecision(reviewFailures);

  return buildCaseResult(caseId, decision, decision, reviewFailures, []);
}

function buildCaseResult(
  caseId: string,
  decision: OperatingSignalFlowRuntimeReadinessDecision,
  expectedDecision: OperatingSignalFlowRuntimeReadinessDecision,
  reviewFailures: OperatingSignalFlowRuntimeReadinessFailure[],
  assertionFailures: OperatingSignalFlowRuntimeReadinessFailure[],
): OperatingSignalFlowRuntimeReadinessCaseResult {
  return {
    caseId,
    decision,
    expectedDecision,
    reviewFailures,
    assertionFailures,
    rawPayloadEchoCount: countCodes(reviewFailures, [
      "raw_payload_included",
      "redaction_status_raw_payload",
      ...SENSITIVE_VALUE_PATTERN_CODES,
    ]),
    runtimeImplementationBypassCount: countCodes(reviewFailures, [
      "runtime_implementation_present",
      "production_query_rollout_already_implemented",
      "schema_change_proposed",
      "api_route_proposed",
      "runtime_query_implemented",
    ]),
    crossWorkspaceProjectionCount: countCodes(reviewFailures, [
      "calibration_workspace_not_single",
      "snapshot_projection_not_single_workspace",
      "rollout_blast_radius_not_single_workspace",
    ]),
    llmFinalRankingCount: countCodes(reviewFailures, ["llm_final_ranking_not_disabled"]),
    authorityLeakCount: countCodes(reviewFailures, [
      "official_write_allowed",
      "auto_send_allowed",
      "auto_approve_allowed",
      "silent_write_allowed",
      "auto_execute_allowed",
      "forbidden_auto_flag_true",
    ]),
  };
}

function collectReviewFailures(
  evalCase: OperatingSignalFlowRuntimeReadinessCase,
  evaluatedAt: string,
) {
  const failures: OperatingSignalFlowRuntimeReadinessFailure[] = [];
  const bundle = evalCase.reviewBundle;
  const sample = bundle.redactedCalibrationSample;
  const snapshot = bundle.redactedSnapshotProjection;
  const rollout = bundle.productionQueryRolloutPlan;
  const dataProtection = bundle.reviews.dataProtectionReview;
  const requiredReviewer = bundle.reviews.requiredReviewerApproval;
  const executiveSponsor = bundle.reviews.executiveSponsorApproval;

  for (const timestamp of [
    ["$.reviewBundle.issuedAt", bundle.issuedAt],
    ["$.reviewBundle.expiresAt", bundle.expiresAt],
    ["$.reviewBundle.redactedCalibrationSample.createdAt", sample.createdAt],
    ["$.reviewBundle.redactedCalibrationSample.windowStart", sample.windowStart],
    ["$.reviewBundle.redactedCalibrationSample.windowEnd", sample.windowEnd],
    ["$.reviewBundle.redactedSnapshotProjection.generatedAt", snapshot.generatedAt],
    ["$.reviewBundle.reviews.dataProtectionReview.reviewedAt", dataProtection.reviewedAt],
    ["$.reviewBundle.reviews.requiredReviewerApproval.approvedAt", requiredReviewer.approvedAt],
    ["$.reviewBundle.reviews.executiveSponsorApproval.approvedAt", executiveSponsor.approvedAt],
  ] as const) {
    pushFailure(
      failures,
      Boolean(timestamp[1] && !isValidTimestamp(timestamp[1])),
      "invalid_timestamp",
      timestamp[0],
      "Readiness bundle timestamps must parse deterministically.",
      "hard",
    );
  }

  pushFailure(
    failures,
    bundle.adoptionMode !== "review_bundle",
    "runtime_implementation_present",
    "$.reviewBundle.adoptionMode",
    "Runtime readiness may only evaluate a review bundle, not implementation code.",
    "hard",
  );
  pushFailure(
    failures,
    Boolean(bundle.revokedBy || bundle.revokedReason),
    "review_bundle_revoked",
    "$.reviewBundle.revokedBy",
    "A revoked bundle cannot proceed.",
    "hard",
  );
  pushFailure(
    failures,
    elapsedMs(bundle.issuedAt, evaluatedAt) > REVIEW_BUNDLE_MAX_AGE_MS || isAfter(evaluatedAt, bundle.expiresAt),
    "review_bundle_expired",
    "$.reviewBundle.expiresAt",
    "Runtime readiness bundles expire after 30 days or at expiresAt, whichever is explicit.",
    "defer",
  );

  pushFailure(
    failures,
    !sample.present,
    "redacted_calibration_sample_missing",
    "$.reviewBundle.redactedCalibrationSample.present",
    "A redacted calibration sample is required.",
    "defer",
  );
  pushFailure(
    failures,
    sample.workspaceScope !== "single_workspace",
    "calibration_workspace_not_single",
    "$.reviewBundle.redactedCalibrationSample.workspaceScope",
    "Calibration must stay single-workspace scoped.",
    "hard",
  );
  pushFailure(
    failures,
    sample.rawPayloadIncluded,
    "raw_payload_included",
    "$.reviewBundle.redactedCalibrationSample.rawPayloadIncluded",
    "Raw payloads are not allowed in the review bundle.",
    "hard",
  );
  pushFailure(
    failures,
    sample.redactionStatus === "raw_payload",
    "redaction_status_raw_payload",
    "$.reviewBundle.redactedCalibrationSample.redactionStatus",
    "The redaction status cannot be raw_payload.",
    "hard",
  );
  pushFailure(
    failures,
    sample.evidenceRefCount < 3,
    "calibration_evidence_refs_insufficient",
    "$.reviewBundle.redactedCalibrationSample.evidenceRefCount",
    "The calibration sample must cite at least three redacted evidence refs.",
    "defer",
  );
  pushFailure(
    failures,
    !sample.calibrationDeltaDocumented,
    "calibration_delta_missing",
    "$.reviewBundle.redactedCalibrationSample.calibrationDeltaDocumented",
    "Fixture-to-calibration differences must be documented.",
    "defer",
  );
  pushFailure(
    failures,
    !sample.fixtureParityChecked,
    "fixture_parity_check_missing",
    "$.reviewBundle.redactedCalibrationSample.fixtureParityChecked",
    "Fixture parity must be checked before runtime readiness.",
    "defer",
  );

  pushFailure(
    failures,
    !snapshot.present,
    "redacted_snapshot_projection_missing",
    "$.reviewBundle.redactedSnapshotProjection.present",
    "A redacted snapshot projection is required before any runtime path.",
    "defer",
  );
  pushFailure(
    failures,
    snapshot.workspaceIds.length !== 1,
    "snapshot_projection_not_single_workspace",
    "$.reviewBundle.redactedSnapshotProjection.workspaceIds",
    "Snapshot projection must contain exactly one workspace id.",
    "hard",
  );
  pushFailure(
    failures,
    !snapshot.shapeChecked,
    "snapshot_redaction_shape_check_missing",
    "$.reviewBundle.redactedSnapshotProjection.shapeChecked",
    "Snapshot projection must pass redaction shape checks.",
    "defer",
  );
  pushFailure(
    failures,
    isBefore(snapshot.generatedAt, sample.windowStart) || isAfter(snapshot.generatedAt, sample.windowEnd),
    "snapshot_outside_calibration_window",
    "$.reviewBundle.redactedSnapshotProjection.generatedAt",
    "Snapshot projection timestamp must fit inside the redacted sample window.",
    "hard",
  );
  for (const rawFailure of findRawFieldFailures(snapshot.fieldSamples, "$.reviewBundle.redactedSnapshotProjection.fieldSamples")) {
    failures.push(rawFailure);
  }

  validateReviewStatus(
    failures,
    dataProtection.status,
    "data_protection_review_missing",
    "$.reviewBundle.reviews.dataProtectionReview.status",
    "Data Protection review evidence is required; this gate does not certify redaction quality.",
  );
  validateReviewStatus(
    failures,
    requiredReviewer.status,
    "required_reviewer_approval_missing",
    "$.reviewBundle.reviews.requiredReviewerApproval.status",
    "Required reviewer approval evidence is required.",
  );
  validateReviewStatus(
    failures,
    executiveSponsor.status,
    "executive_sponsor_approval_missing",
    "$.reviewBundle.reviews.executiveSponsorApproval.status",
    "Executive sponsor approval evidence is required for this review bundle only.",
  );
  pushFailure(
    failures,
    Boolean(dataProtection.reviewedAt && isBefore(dataProtection.reviewedAt, sample.createdAt)),
    "data_protection_review_before_sample",
    "$.reviewBundle.reviews.dataProtectionReview.reviewedAt",
    "Data Protection review cannot predate the redacted calibration sample.",
    "hard",
  );
  pushFailure(
    failures,
    Boolean(requiredReviewer.approvedAt && dataProtection.reviewedAt && isBefore(requiredReviewer.approvedAt, dataProtection.reviewedAt)),
    "required_reviewer_before_data_protection",
    "$.reviewBundle.reviews.requiredReviewerApproval.approvedAt",
    "Required reviewer approval must follow Data Protection review.",
    "hard",
  );
  pushFailure(
    failures,
    Boolean(executiveSponsor.approvedAt && requiredReviewer.approvedAt && isBefore(executiveSponsor.approvedAt, requiredReviewer.approvedAt)),
    "executive_sponsor_before_required_reviewer",
    "$.reviewBundle.reviews.executiveSponsorApproval.approvedAt",
    "Executive sponsor approval must follow required reviewer approval.",
    "hard",
  );
  pushFailure(
    failures,
    requiredReviewer.minimumRoleCount <
      OPERATING_SIGNAL_FLOW_REQUIRED_REVIEWER_MINIMUM_ROLE_COUNT,
    "required_reviewer_minimum_role_count_too_low",
    "$.reviewBundle.reviews.requiredReviewerApproval.minimumRoleCount",
    "Operating Signal Flow runtime readiness requires five canonical Required Reviewer roles.",
    "defer",
  );
  const missingRequiredReviewerRoles =
    OPERATING_SIGNAL_FLOW_REQUIRED_REVIEWER_ROLES.filter(
      (role) => !requiredReviewer.reviewerRoles.includes(role),
    );
  pushFailure(
    failures,
    missingRequiredReviewerRoles.length > 0,
    "required_reviewer_canonical_roles_missing",
    "$.reviewBundle.reviews.requiredReviewerApproval.reviewerRoles",
    `Missing canonical Required Reviewer role(s): ${missingRequiredReviewerRoles.join(", ")}`,
    "defer",
  );
  pushFailure(
    failures,
    requiredReviewer.reviewerRoles.length < requiredReviewer.minimumRoleCount,
    "required_reviewer_role_count_insufficient",
    "$.reviewBundle.reviews.requiredReviewerApproval.reviewerRoles",
    "Required reviewer approvals must satisfy the declared minimum role count.",
    "defer",
  );

  pushFailure(
    failures,
    !rollout.present,
    "production_query_rollout_plan_missing",
    "$.reviewBundle.productionQueryRolloutPlan.present",
    "A production query rollout plan is required.",
    "defer",
  );
  pushFailure(
    failures,
    rollout.status === "implemented",
    "production_query_rollout_already_implemented",
    "$.reviewBundle.productionQueryRolloutPlan.status",
    "The readiness gate cannot include an already implemented production query.",
    "hard",
  );
  pushFailure(
    failures,
    !rollout.queryName.trim(),
    "production_query_rollout_query_name_missing",
    "$.reviewBundle.productionQueryRolloutPlan.queryName",
    "The rollout plan must name the candidate query.",
    "defer",
  );
  pushFailure(
    failures,
    rollout.sourceTableRefs.length === 0,
    "production_query_rollout_source_refs_missing",
    "$.reviewBundle.productionQueryRolloutPlan.sourceTableRefs",
    "The rollout plan must list source tables or read models.",
    "defer",
  );
  pushFailure(
    failures,
    rollout.volumeEstimateRowsPerHour === null || rollout.volumeEstimateRowsPerHour <= 0,
    "production_query_rollout_volume_missing",
    "$.reviewBundle.productionQueryRolloutPlan.volumeEstimateRowsPerHour",
    "The rollout plan must include a positive volume estimate.",
    "defer",
  );
  pushFailure(
    failures,
    !rollout.indexPlan.trim(),
    "production_query_rollout_index_plan_missing",
    "$.reviewBundle.productionQueryRolloutPlan.indexPlan",
    "The rollout plan must state index expectations.",
    "defer",
  );
  pushFailure(
    failures,
    rollout.performanceBudgetMs === null || rollout.performanceBudgetMs <= 0,
    "production_query_rollout_performance_budget_missing",
    "$.reviewBundle.productionQueryRolloutPlan.performanceBudgetMs",
    "The rollout plan must include a positive performance budget.",
    "defer",
  );
  pushFailure(
    failures,
    !rollout.observabilityPlan.trim(),
    "production_query_rollout_observability_missing",
    "$.reviewBundle.productionQueryRolloutPlan.observabilityPlan",
    "The rollout plan must define observability.",
    "defer",
  );
  for (const stage of REQUIRED_ROLLOUT_STAGES) {
    pushFailure(
      failures,
      !rollout.rolloutStages.includes(stage as "shadow" | "canary" | "general_review"),
      `production_query_rollout_stage_missing:${stage}`,
      "$.reviewBundle.productionQueryRolloutPlan.rolloutStages",
      "The rollout plan must cover shadow, canary and general-review stages.",
      "defer",
    );
  }
  for (const stage of rollout.rolloutStages) {
    pushFailure(
      failures,
      !REQUIRED_ROLLOUT_STAGES.has(stage),
      `production_query_rollout_unknown_stage:${stage}`,
      "$.reviewBundle.productionQueryRolloutPlan.rolloutStages",
      "The rollout plan cannot include unknown stages.",
      "hard",
    );
  }
  pushFailure(
    failures,
    !rollout.usesExistingSourcesOnly,
    "production_query_rollout_uses_new_sources",
    "$.reviewBundle.productionQueryRolloutPlan.usesExistingSourcesOnly",
    "Runtime readiness may only plan existing source adoption.",
    "hard",
  );
  pushFailure(
    failures,
    !rollout.singleWorkspaceSnapshotProjection,
    "production_query_rollout_not_single_workspace",
    "$.reviewBundle.productionQueryRolloutPlan.singleWorkspaceSnapshotProjection",
    "The rollout plan must preserve single-workspace projection.",
    "hard",
  );
  pushFailure(
    failures,
    rollout.schemaChangeProposed,
    "schema_change_proposed",
    "$.reviewBundle.productionQueryRolloutPlan.schemaChangeProposed",
    "No schema change is authorized by this gate.",
    "hard",
  );
  pushFailure(
    failures,
    rollout.apiRouteProposed,
    "api_route_proposed",
    "$.reviewBundle.productionQueryRolloutPlan.apiRouteProposed",
    "No API route is authorized by this gate.",
    "hard",
  );
  pushFailure(
    failures,
    rollout.runtimeQueryImplemented,
    "runtime_query_implemented",
    "$.reviewBundle.productionQueryRolloutPlan.runtimeQueryImplemented",
    "No runtime query implementation is authorized by this gate.",
    "hard",
  );
  pushFailure(
    failures,
    !rollout.rollbackPlanPresent,
    "production_query_rollout_rollback_missing",
    "$.reviewBundle.productionQueryRolloutPlan.rollbackPlanPresent",
    "The rollout plan must include rollback.",
    "defer",
  );
  pushFailure(
    failures,
    rollout.blastRadius !== "single_workspace",
    "rollout_blast_radius_not_single_workspace",
    "$.reviewBundle.productionQueryRolloutPlan.blastRadius",
    "The rollout blast radius must stay single-workspace.",
    "hard",
  );

  pushFailure(
    failures,
    !bundle.llmPosture.explanationOnly,
    "llm_posture_not_explanation_only",
    "$.reviewBundle.llmPosture.explanationOnly",
    "LLM use must remain explanation-only.",
    "hard",
  );
  pushFailure(
    failures,
    bundle.llmPosture.finalRanking !== "disabled",
    "llm_final_ranking_not_disabled",
    "$.reviewBundle.llmPosture.finalRanking",
    "LLM final ranking must stay disabled.",
    "hard",
  );
  pushFailure(
    failures,
    bundle.llmPosture.stateTransitionByLlm,
    "llm_state_transition_present",
    "$.reviewBundle.llmPosture.stateTransitionByLlm",
    "LLM must not drive state transitions.",
    "hard",
  );

  pushBooleanBoundary(failures, bundle.authority.officialWriteAllowed, "official_write_allowed", "$.reviewBundle.authority.officialWriteAllowed");
  pushBooleanBoundary(failures, bundle.authority.autoSendAllowed, "auto_send_allowed", "$.reviewBundle.authority.autoSendAllowed");
  pushBooleanBoundary(failures, bundle.authority.autoApproveAllowed, "auto_approve_allowed", "$.reviewBundle.authority.autoApproveAllowed");
  pushBooleanBoundary(failures, bundle.authority.silentWriteAllowed, "silent_write_allowed", "$.reviewBundle.authority.silentWriteAllowed");
  pushBooleanBoundary(failures, bundle.authority.autoExecuteAllowed, "auto_execute_allowed", "$.reviewBundle.authority.autoExecuteAllowed");
  for (const autoFlag of findForbiddenAutoTrueFlags(bundle, "$.reviewBundle")) {
    failures.push(autoFlag);
  }

  pushFailure(
    failures,
    !bundle.artifacts.docsUpdated,
    "readiness_docs_missing",
    "$.reviewBundle.artifacts.docsUpdated",
    "Readiness docs must be updated.",
    "defer",
  );
  pushFailure(
    failures,
    !bundle.artifacts.evalUpdated,
    "readiness_eval_missing",
    "$.reviewBundle.artifacts.evalUpdated",
    "Readiness eval must be updated.",
    "defer",
  );
  pushFailure(
    failures,
    !bundle.artifacts.boundaryGuardUpdated,
    "readiness_boundary_guard_missing",
    "$.reviewBundle.artifacts.boundaryGuardUpdated",
    "Readiness boundary guard must be updated.",
    "defer",
  );
  pushFailure(
    failures,
    bundle.evidenceRefs.length < 4,
    "readiness_evidence_refs_insufficient",
    "$.reviewBundle.evidenceRefs",
    "Readiness bundle must cite calibration, Data Protection, required reviewer and executive sponsor evidence.",
    "defer",
  );

  return failures;
}

function classifyDecision(
  failures: OperatingSignalFlowRuntimeReadinessFailure[],
): OperatingSignalFlowRuntimeReadinessDecision {
  if (failures.some((item) => item.severity === "hard")) {
    return "no_go";
  }
  if (failures.length > 0) {
    return "defer";
  }
  return "go";
}

function validateFixturePackShape(pack: unknown) {
  if (!isRecord(pack)) {
    return failure("invalid_fixture_shape", "$", "Fixture pack must be an object.", "hard");
  }
  if (!Array.isArray(pack.cases)) {
    return failure("invalid_fixture_shape", "$.cases", "Fixture pack must include cases array.", "hard");
  }
  if (!isRecord(pack.targets)) {
    return failure("invalid_fixture_shape", "$.targets", "Fixture pack must include targets.", "hard");
  }
  return null;
}

function buildInvalidSummary(
  invalidFailure: OperatingSignalFlowRuntimeReadinessFailure,
): OperatingSignalFlowRuntimeReadinessEvalSummary {
  return {
    passed: false,
    version: DEFAULT_VERSION,
    evaluatedAt: "n/a",
    inputDigest: "n/a",
    totalCases: 0,
    goDecisionCount: 0,
    deferDecisionCount: 0,
    noGoDecisionCount: 0,
    rawPayloadEchoCount: 0,
    runtimeImplementationBypassCount: 0,
    crossWorkspaceProjectionCount: 0,
    llmFinalRankingCount: 0,
    authorityLeakCount: 0,
    caseResults: [],
    assertionFailures: [{ caseId: "pack", reason: invalidFailure.code, path: invalidFailure.path }],
    failures: [invalidFailure],
  };
}

function validateReviewStatus(
  failures: OperatingSignalFlowRuntimeReadinessFailure[],
  status: OperatingSignalFlowRuntimeReadinessReviewStatus,
  code: string,
  pathName: string,
  message: string,
) {
  pushFailure(failures, status !== "approved", code, pathName, message, status === "rejected" ? "hard" : "defer");
}

function pushBooleanBoundary(
  failures: OperatingSignalFlowRuntimeReadinessFailure[],
  value: boolean,
  code: string,
  pathName: string,
) {
  pushFailure(
    failures,
    value,
    code,
    pathName,
    "Runtime readiness does not authorize external side effects or official writes.",
    "hard",
  );
}

function findRawFieldFailures(
  fieldSamples: Record<string, string>,
  basePath: string,
): OperatingSignalFlowRuntimeReadinessFailure[] {
  return Object.entries(fieldSamples).flatMap(([field, value]) =>
    SENSITIVE_VALUE_PATTERNS.flatMap((pattern) =>
      pattern.regex.test(value)
        ? [
            failure(
              pattern.code,
              `${basePath}.${field}`,
              "Redaction shape check found a raw identifier pattern; value intentionally masked.",
              "hard",
            ),
          ]
        : [],
    ),
  );
}

function findForbiddenAutoTrueFlags(value: unknown, basePath: string) {
  const results: OperatingSignalFlowRuntimeReadinessFailure[] = [];
  walk(value, basePath, (pathName, item) => {
    if (item === true && findForbiddenAuthorityKeyFragment(pathName)) {
      results.push(
        failure(
          "forbidden_auto_flag_true",
          pathName,
          "Forbidden authority flags cannot be true.",
          "hard",
        ),
      );
    }
  });
  return results;
}

function walk(value: unknown, pathName: string, visit: (pathName: string, value: unknown) => void) {
  visit(pathName, value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${pathName}[${index}]`, visit));
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      walk(item, `${pathName}.${key}`, visit);
    }
  }
}

function pushFailure(
  failures: OperatingSignalFlowRuntimeReadinessFailure[],
  condition: boolean,
  code: string,
  pathName: string,
  message: string,
  severity: "hard" | "defer",
) {
  if (condition) {
    failures.push(failure(code, pathName, message, severity));
  }
}

function pushAssertionFailure(
  failures: OperatingSignalFlowRuntimeReadinessFailure[],
  condition: boolean,
  code: string,
  pathName: string,
) {
  if (condition) {
    failures.push(failure(code, pathName, "Eval case expectation was not met.", "assertion"));
  }
}

function pushSummaryFailure(
  failures: OperatingSignalFlowRuntimeReadinessFailure[],
  condition: boolean,
  code: string,
) {
  if (condition) {
    failures.push(failure(code, "$.targets", "Runtime readiness fixture target was not met.", "assertion"));
  }
}

function failure(
  code: string,
  pathName: string,
  message: string,
  severity: OperatingSignalFlowRuntimeReadinessFailureSeverity,
): OperatingSignalFlowRuntimeReadinessFailure {
  return { code, path: pathName, message, severity };
}

function countCodes(
  failures: OperatingSignalFlowRuntimeReadinessFailure[],
  codes: string[],
) {
  const targetCodes = new Set(codes);
  return failures.filter((item) => targetCodes.has(item.code)).length;
}

function sum(
  results: OperatingSignalFlowRuntimeReadinessCaseResult[],
  key:
    | "rawPayloadEchoCount"
    | "runtimeImplementationBypassCount"
    | "crossWorkspaceProjectionCount"
    | "llmFinalRankingCount"
    | "authorityLeakCount",
) {
  return results.reduce((total, item) => total + item[key], 0);
}

function isBefore(left: string, right: string) {
  return Date.parse(left) < Date.parse(right);
}

function isAfter(left: string, right: string) {
  return Date.parse(left) > Date.parse(right);
}

function elapsedMs(start: string, end: string) {
  return Date.parse(end) - Date.parse(start);
}

function isValidTimestamp(value: string) {
  return Number.isFinite(Date.parse(value));
}

function digestInput(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
