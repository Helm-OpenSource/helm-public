// Phase 2.3 / review-bundle intake screen only. This module is intentionally
// pure and offline: no fs, env, DB, network, provider SDK, Next route or LLM import.
import { createHash } from "node:crypto";

import {
  scoreOperatingSignalFlowRuntimeReadinessBundle,
  type OperatingSignalFlowRuntimeReadinessCaseResult,
  type OperatingSignalFlowRuntimeReadinessDecision,
  type OperatingSignalFlowRuntimeReadinessFailure,
  type OperatingSignalFlowRuntimeReadinessFailureSeverity,
  type OperatingSignalFlowRuntimeReadinessFixturePack,
  type OperatingSignalFlowRuntimeReadinessReviewBundle,
} from "@/lib/evals/operating-signal-flow-runtime-readiness-evals";
import { SENSITIVE_VALUE_PATTERNS } from "@/lib/shared/sensitive-patterns";

export const OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_SCHEMA_VERSION =
  "operating-signal-flow-runtime-readiness-intake.v1";
export const OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_BUNDLE_SCHEMA_VERSION =
  "operating-signal-flow-runtime-readiness-bundle.v1";
export const OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_SENSITIVE_RULE_VERSION =
  "operating-signal-flow-sensitive-rules.v1";
export const OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_BYTES =
  1024 * 1024;
export const OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_DEPTH = 24;
export const OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_BOUNDARY =
  "This offline review-bundle intake screen detects unredacted sensitive content and readiness shape only; it does not redact, approve production, or authorize schema, API, runtime query, production query adoption, LLM final ranking, official write, auto-send, auto-approve or auto-execute.";

export type OperatingSignalFlowRuntimeReadinessIntakeExitCode = 0 | 2 | 3 | 64;

export type OperatingSignalFlowRuntimeReadinessIntakeInput = {
  schemaVersion: typeof OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_BUNDLE_SCHEMA_VERSION;
  caseId: string;
  evaluatedAt: string;
  casePurpose: string;
  reviewBundle: OperatingSignalFlowRuntimeReadinessReviewBundle;
};

export type OperatingSignalFlowRuntimeReadinessIntakePreflight =
  | "pass"
  | "fail"
  | "invalid_input";

export type OperatingSignalFlowRuntimeReadinessIntakeReadinessDecision =
  | OperatingSignalFlowRuntimeReadinessDecision
  | "not_evaluated";

export type OperatingSignalFlowRuntimeReadinessIntakeResult = {
  schemaVersion: typeof OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_SCHEMA_VERSION;
  ruleVersion: typeof OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_SENSITIVE_RULE_VERSION;
  boundary: typeof OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_BOUNDARY;
  maxBytes: typeof OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_BYTES;
  maxDepth: typeof OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_DEPTH;
  caseId: string | null;
  evaluatedAt: string | null;
  inputDigest: string;
  preflight: OperatingSignalFlowRuntimeReadinessIntakePreflight;
  readinessDecision: OperatingSignalFlowRuntimeReadinessIntakeReadinessDecision;
  exitCode: OperatingSignalFlowRuntimeReadinessIntakeExitCode;
  findings: OperatingSignalFlowRuntimeReadinessFailure[];
  readinessFailures: OperatingSignalFlowRuntimeReadinessFailure[];
  caseResult: OperatingSignalFlowRuntimeReadinessCaseResult | null;
  wrappedPack: OperatingSignalFlowRuntimeReadinessFixturePack | null;
};

const TOP_LEVEL_KEYS = new Set([
  "schemaVersion",
  "caseId",
  "evaluatedAt",
  "casePurpose",
  "reviewBundle",
]);
const REVIEW_STATUSES = new Set(["approved", "missing", "pending", "rejected"]);
const SAMPLE_WINDOWS = new Set(["1h", "24h", "7d"]);
const WORKSPACE_SCOPES = new Set(["single_workspace", "multi_workspace"]);
const REDACTION_STATUSES = new Set([
  "redacted",
  "alias_only",
  "synthetic",
  "raw_payload",
]);
const ADOPTION_MODES = new Set(["review_bundle", "runtime_implementation"]);
const ROLLOUT_STATUSES = new Set(["planned", "implemented", "missing"]);
const FINAL_RANKING_STATUSES = new Set(["disabled", "enabled", "shadow"]);
const BLAST_RADII = new Set(["single_workspace", "multi_workspace", "global"]);
const SENSITIVE_KEY_RULES = new Set([
  "email",
  "emailaddress",
  "customeremail",
  "contactemail",
  "phone",
  "phonenumber",
  "mobile",
  "mobilenumber",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "password",
  "credential",
  "apikey",
  "rawpayload",
  "payload",
  "body",
  "subject",
  "transcript",
  "participants",
  "counterpart",
  "customername",
  "contactname",
]);
export function runOperatingSignalFlowRuntimeReadinessIntake(
  jsonText: string,
): OperatingSignalFlowRuntimeReadinessIntakeResult {
  if (
    Buffer.byteLength(jsonText, "utf8") >
    OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_BYTES
  ) {
    return buildInputFailure(
      failure(
        "input_too_large",
        "$",
        "Review-bundle intake input exceeds the 1 MiB offline cap.",
        "hard",
      ),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return buildInputFailure(
      failure(
        "invalid_json",
        "$",
        "Review-bundle intake input must be valid JSON.",
        "hard",
      ),
    );
  }

  const depthFailure = findDepthFailure(parsed, "$", 0);
  if (depthFailure) {
    return buildInputFailure(depthFailure, parsed);
  }

  const sensitiveFindings = findSensitiveFindings(parsed);
  if (sensitiveFindings.length > 0) {
    return buildBaseResult({
      parsed,
      caseId: readStringProperty(parsed, "caseId"),
      evaluatedAt: readStringProperty(parsed, "evaluatedAt"),
      preflight: "fail",
      readinessDecision: "not_evaluated",
      exitCode: 2,
      findings: sensitiveFindings,
      readinessFailures: [],
      caseResult: null,
      wrappedPack: null,
      inputDigest: "withheld_sensitive_preflight",
    });
  }

  const shapeFailure = validateIntakeShape(parsed);
  if (shapeFailure) {
    return buildInputFailure(shapeFailure, parsed);
  }

  const input = parsed as OperatingSignalFlowRuntimeReadinessIntakeInput;
  const caseResult = scoreOperatingSignalFlowRuntimeReadinessBundle(
    input.reviewBundle,
    input.evaluatedAt,
    input.caseId,
  );
  const wrappedPack = buildOperatingSignalFlowRuntimeReadinessIntakePack(
    input,
    caseResult,
  );

  return buildBaseResult({
    parsed,
    caseId: input.caseId,
    evaluatedAt: input.evaluatedAt,
    preflight: "pass",
    readinessDecision: caseResult.decision,
    exitCode: caseResult.decision === "go" ? 0 : 3,
    findings: [],
    readinessFailures: caseResult.reviewFailures,
    caseResult,
    wrappedPack,
  });
}

export function buildOperatingSignalFlowRuntimeReadinessIntakePack(
  input: OperatingSignalFlowRuntimeReadinessIntakeInput,
  caseResult: OperatingSignalFlowRuntimeReadinessCaseResult,
): OperatingSignalFlowRuntimeReadinessFixturePack {
  return {
    version: `${input.schemaVersion}.wrapped`,
    status: "offline_intake_screen_only",
    boundary: OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_BOUNDARY,
    evaluatedAt: input.evaluatedAt,
    targets: {
      minimumTotalCases: 1,
      minimumGoDecisionCount: caseResult.decision === "go" ? 1 : 0,
      minimumDeferDecisionCount: caseResult.decision === "defer" ? 1 : 0,
      minimumNoGoDecisionCount: caseResult.decision === "no_go" ? 1 : 0,
      maximumGoCaseFailureCount: 0,
      maximumGoCaseHardFailureCount: 0,
    },
    cases: [
      {
        id: input.caseId,
        description: input.casePurpose,
        expectedDecision: caseResult.decision,
        expectedFailureCodes: caseResult.reviewFailures.map(
          (item) => item.code,
        ),
        reviewBundle: input.reviewBundle,
      },
    ],
  };
}

export function stringifyOperatingSignalFlowRuntimeReadinessIntakeResult(
  result: OperatingSignalFlowRuntimeReadinessIntakeResult,
): string {
  return `${stableStringify(result)}\n`;
}

function validateIntakeShape(
  value: unknown,
): OperatingSignalFlowRuntimeReadinessFailure | null {
  if (!isRecord(value)) {
    return failure(
      "invalid_intake_shape",
      "$",
      "Review-bundle intake input must be an object.",
      "hard",
    );
  }

  const unknownKey = Object.keys(value).find((key) => !TOP_LEVEL_KEYS.has(key));
  if (unknownKey) {
    return failure(
      "unknown_top_level_key",
      `$.${unknownKey}`,
      "Review-bundle intake v1 only accepts schemaVersion, caseId, evaluatedAt, casePurpose and reviewBundle.",
      "hard",
    );
  }

  return (
    expectExact(
      value.schemaVersion,
      OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_BUNDLE_SCHEMA_VERSION,
      "$.schemaVersion",
    ) ||
    expectNonEmptyString(value.caseId, "$.caseId") ||
    expectNonEmptyString(value.evaluatedAt, "$.evaluatedAt") ||
    expectNonEmptyString(value.casePurpose, "$.casePurpose") ||
    validateReviewBundleShape(value.reviewBundle)
  );
}

function validateReviewBundleShape(
  value: unknown,
): OperatingSignalFlowRuntimeReadinessFailure | null {
  if (!isRecord(value)) {
    return failure(
      "invalid_review_bundle_shape",
      "$.reviewBundle",
      "reviewBundle must be an object.",
      "hard",
    );
  }

  const sample = value.redactedCalibrationSample;
  const snapshot = value.redactedSnapshotProjection;
  const reviews = value.reviews;
  const rollout = value.productionQueryRolloutPlan;
  const llmPosture = value.llmPosture;
  const authority = value.authority;
  const artifacts = value.artifacts;

  if (!isRecord(sample)) {
    return failure(
      "invalid_review_bundle_shape",
      "$.reviewBundle.redactedCalibrationSample",
      "redactedCalibrationSample must be an object.",
      "hard",
    );
  }
  if (!isRecord(snapshot)) {
    return failure(
      "invalid_review_bundle_shape",
      "$.reviewBundle.redactedSnapshotProjection",
      "redactedSnapshotProjection must be an object.",
      "hard",
    );
  }
  if (!isRecord(reviews)) {
    return failure(
      "invalid_review_bundle_shape",
      "$.reviewBundle.reviews",
      "reviews must be an object.",
      "hard",
    );
  }
  if (!isRecord(rollout)) {
    return failure(
      "invalid_review_bundle_shape",
      "$.reviewBundle.productionQueryRolloutPlan",
      "productionQueryRolloutPlan must be an object.",
      "hard",
    );
  }
  if (!isRecord(llmPosture)) {
    return failure(
      "invalid_review_bundle_shape",
      "$.reviewBundle.llmPosture",
      "llmPosture must be an object.",
      "hard",
    );
  }
  if (!isRecord(authority)) {
    return failure(
      "invalid_review_bundle_shape",
      "$.reviewBundle.authority",
      "authority must be an object.",
      "hard",
    );
  }
  if (!isRecord(artifacts)) {
    return failure(
      "invalid_review_bundle_shape",
      "$.reviewBundle.artifacts",
      "artifacts must be an object.",
      "hard",
    );
  }

  return (
    expectOneOf(
      value.adoptionMode,
      ADOPTION_MODES,
      "$.reviewBundle.adoptionMode",
    ) ||
    expectNonEmptyString(value.issuedAt, "$.reviewBundle.issuedAt") ||
    expectNonEmptyString(value.expiresAt, "$.reviewBundle.expiresAt") ||
    expectStringOrNull(value.revokedBy, "$.reviewBundle.revokedBy") ||
    expectStringOrNull(value.revokedReason, "$.reviewBundle.revokedReason") ||
    validateRedactedCalibrationSampleShape(sample) ||
    validateRedactedSnapshotProjectionShape(snapshot) ||
    validateReviewsShape(reviews) ||
    validateRolloutShape(rollout) ||
    validateLlmPostureShape(llmPosture) ||
    validateAuthorityShape(authority) ||
    validateArtifactsShape(artifacts) ||
    expectStringArray(value.evidenceRefs, "$.reviewBundle.evidenceRefs")
  );
}

function validateRedactedCalibrationSampleShape(
  value: Record<string, unknown>,
): OperatingSignalFlowRuntimeReadinessFailure | null {
  return (
    expectBoolean(
      value.present,
      "$.reviewBundle.redactedCalibrationSample.present",
    ) ||
    expectNonEmptyString(
      value.createdAt,
      "$.reviewBundle.redactedCalibrationSample.createdAt",
    ) ||
    expectOneOf(
      value.sampleWindow,
      SAMPLE_WINDOWS,
      "$.reviewBundle.redactedCalibrationSample.sampleWindow",
    ) ||
    expectNonEmptyString(
      value.windowStart,
      "$.reviewBundle.redactedCalibrationSample.windowStart",
    ) ||
    expectNonEmptyString(
      value.windowEnd,
      "$.reviewBundle.redactedCalibrationSample.windowEnd",
    ) ||
    expectOneOf(
      value.workspaceScope,
      WORKSPACE_SCOPES,
      "$.reviewBundle.redactedCalibrationSample.workspaceScope",
    ) ||
    expectOneOf(
      value.redactionStatus,
      REDACTION_STATUSES,
      "$.reviewBundle.redactedCalibrationSample.redactionStatus",
    ) ||
    expectNumber(
      value.evidenceRefCount,
      "$.reviewBundle.redactedCalibrationSample.evidenceRefCount",
    ) ||
    expectBoolean(
      value.rawPayloadIncluded,
      "$.reviewBundle.redactedCalibrationSample.rawPayloadIncluded",
    ) ||
    expectBoolean(
      value.calibrationDeltaDocumented,
      "$.reviewBundle.redactedCalibrationSample.calibrationDeltaDocumented",
    ) ||
    expectBoolean(
      value.fixtureParityChecked,
      "$.reviewBundle.redactedCalibrationSample.fixtureParityChecked",
    )
  );
}

function validateRedactedSnapshotProjectionShape(
  value: Record<string, unknown>,
): OperatingSignalFlowRuntimeReadinessFailure | null {
  return (
    expectBoolean(
      value.present,
      "$.reviewBundle.redactedSnapshotProjection.present",
    ) ||
    expectNonEmptyString(
      value.generatedAt,
      "$.reviewBundle.redactedSnapshotProjection.generatedAt",
    ) ||
    expectStringArray(
      value.workspaceIds,
      "$.reviewBundle.redactedSnapshotProjection.workspaceIds",
    ) ||
    expectBoolean(
      value.shapeChecked,
      "$.reviewBundle.redactedSnapshotProjection.shapeChecked",
    ) ||
    expectStringRecord(
      value.fieldSamples,
      "$.reviewBundle.redactedSnapshotProjection.fieldSamples",
    )
  );
}

function validateReviewsShape(
  value: Record<string, unknown>,
): OperatingSignalFlowRuntimeReadinessFailure | null {
  const dataProtection = value.dataProtectionReview;
  const requiredReviewer = value.requiredReviewerApproval;
  const executiveSponsor = value.executiveSponsorApproval;

  if (!isRecord(dataProtection)) {
    return failure(
      "invalid_review_bundle_shape",
      "$.reviewBundle.reviews.dataProtectionReview",
      "dataProtectionReview must be an object.",
      "hard",
    );
  }
  if (!isRecord(requiredReviewer)) {
    return failure(
      "invalid_review_bundle_shape",
      "$.reviewBundle.reviews.requiredReviewerApproval",
      "requiredReviewerApproval must be an object.",
      "hard",
    );
  }
  if (!isRecord(executiveSponsor)) {
    return failure(
      "invalid_review_bundle_shape",
      "$.reviewBundle.reviews.executiveSponsorApproval",
      "executiveSponsorApproval must be an object.",
      "hard",
    );
  }

  return (
    expectOneOf(
      dataProtection.status,
      REVIEW_STATUSES,
      "$.reviewBundle.reviews.dataProtectionReview.status",
    ) ||
    expectStringOrNull(
      dataProtection.reviewedAt,
      "$.reviewBundle.reviews.dataProtectionReview.reviewedAt",
    ) ||
    expectNonEmptyString(
      dataProtection.reviewerRole,
      "$.reviewBundle.reviews.dataProtectionReview.reviewerRole",
    ) ||
    expectOneOf(
      requiredReviewer.status,
      REVIEW_STATUSES,
      "$.reviewBundle.reviews.requiredReviewerApproval.status",
    ) ||
    expectStringOrNull(
      requiredReviewer.approvedAt,
      "$.reviewBundle.reviews.requiredReviewerApproval.approvedAt",
    ) ||
    expectStringArray(
      requiredReviewer.reviewerRoles,
      "$.reviewBundle.reviews.requiredReviewerApproval.reviewerRoles",
    ) ||
    expectNumber(
      requiredReviewer.minimumRoleCount,
      "$.reviewBundle.reviews.requiredReviewerApproval.minimumRoleCount",
    ) ||
    expectOneOf(
      executiveSponsor.status,
      REVIEW_STATUSES,
      "$.reviewBundle.reviews.executiveSponsorApproval.status",
    ) ||
    expectStringOrNull(
      executiveSponsor.approvedAt,
      "$.reviewBundle.reviews.executiveSponsorApproval.approvedAt",
    ) ||
    expectNonEmptyString(
      executiveSponsor.sponsorRole,
      "$.reviewBundle.reviews.executiveSponsorApproval.sponsorRole",
    )
  );
}

function validateRolloutShape(
  value: Record<string, unknown>,
): OperatingSignalFlowRuntimeReadinessFailure | null {
  return (
    expectBoolean(
      value.present,
      "$.reviewBundle.productionQueryRolloutPlan.present",
    ) ||
    expectOneOf(
      value.status,
      ROLLOUT_STATUSES,
      "$.reviewBundle.productionQueryRolloutPlan.status",
    ) ||
    expectNonEmptyString(
      value.queryName,
      "$.reviewBundle.productionQueryRolloutPlan.queryName",
    ) ||
    expectStringArray(
      value.sourceTableRefs,
      "$.reviewBundle.productionQueryRolloutPlan.sourceTableRefs",
    ) ||
    expectNumberOrNull(
      value.volumeEstimateRowsPerHour,
      "$.reviewBundle.productionQueryRolloutPlan.volumeEstimateRowsPerHour",
    ) ||
    expectNonEmptyString(
      value.indexPlan,
      "$.reviewBundle.productionQueryRolloutPlan.indexPlan",
    ) ||
    expectNumberOrNull(
      value.performanceBudgetMs,
      "$.reviewBundle.productionQueryRolloutPlan.performanceBudgetMs",
    ) ||
    expectNonEmptyString(
      value.observabilityPlan,
      "$.reviewBundle.productionQueryRolloutPlan.observabilityPlan",
    ) ||
    expectStringArray(
      value.rolloutStages,
      "$.reviewBundle.productionQueryRolloutPlan.rolloutStages",
    ) ||
    expectBoolean(
      value.usesExistingSourcesOnly,
      "$.reviewBundle.productionQueryRolloutPlan.usesExistingSourcesOnly",
    ) ||
    expectBoolean(
      value.singleWorkspaceSnapshotProjection,
      "$.reviewBundle.productionQueryRolloutPlan.singleWorkspaceSnapshotProjection",
    ) ||
    expectBoolean(
      value.schemaChangeProposed,
      "$.reviewBundle.productionQueryRolloutPlan.schemaChangeProposed",
    ) ||
    expectBoolean(
      value.apiRouteProposed,
      "$.reviewBundle.productionQueryRolloutPlan.apiRouteProposed",
    ) ||
    expectBoolean(
      value.runtimeQueryImplemented,
      "$.reviewBundle.productionQueryRolloutPlan.runtimeQueryImplemented",
    ) ||
    expectBoolean(
      value.rollbackPlanPresent,
      "$.reviewBundle.productionQueryRolloutPlan.rollbackPlanPresent",
    ) ||
    expectOneOf(
      value.blastRadius,
      BLAST_RADII,
      "$.reviewBundle.productionQueryRolloutPlan.blastRadius",
    )
  );
}

function validateLlmPostureShape(
  value: Record<string, unknown>,
): OperatingSignalFlowRuntimeReadinessFailure | null {
  return (
    expectBoolean(
      value.explanationOnly,
      "$.reviewBundle.llmPosture.explanationOnly",
    ) ||
    expectOneOf(
      value.finalRanking,
      FINAL_RANKING_STATUSES,
      "$.reviewBundle.llmPosture.finalRanking",
    ) ||
    expectBoolean(
      value.stateTransitionByLlm,
      "$.reviewBundle.llmPosture.stateTransitionByLlm",
    )
  );
}

function validateAuthorityShape(
  value: Record<string, unknown>,
): OperatingSignalFlowRuntimeReadinessFailure | null {
  return (
    expectBoolean(
      value.officialWriteAllowed,
      "$.reviewBundle.authority.officialWriteAllowed",
    ) ||
    expectBoolean(
      value.autoSendAllowed,
      "$.reviewBundle.authority.autoSendAllowed",
    ) ||
    expectBoolean(
      value.autoApproveAllowed,
      "$.reviewBundle.authority.autoApproveAllowed",
    ) ||
    expectBoolean(
      value.silentWriteAllowed,
      "$.reviewBundle.authority.silentWriteAllowed",
    ) ||
    expectBoolean(
      value.autoExecuteAllowed,
      "$.reviewBundle.authority.autoExecuteAllowed",
    )
  );
}

function validateArtifactsShape(
  value: Record<string, unknown>,
): OperatingSignalFlowRuntimeReadinessFailure | null {
  return (
    expectBoolean(value.docsUpdated, "$.reviewBundle.artifacts.docsUpdated") ||
    expectBoolean(value.evalUpdated, "$.reviewBundle.artifacts.evalUpdated") ||
    expectBoolean(
      value.boundaryGuardUpdated,
      "$.reviewBundle.artifacts.boundaryGuardUpdated",
    )
  );
}

function expectExact(value: unknown, expected: string, pathName: string) {
  return value === expected
    ? null
    : failure(
        "invalid_schema_version",
        pathName,
        `Expected schemaVersion ${expected}.`,
        "hard",
      );
}

function expectOneOf(value: unknown, allowed: Set<string>, pathName: string) {
  return typeof value === "string" && allowed.has(value)
    ? null
    : failure(
        "invalid_enum_value",
        pathName,
        "Review-bundle intake field has an unsupported value.",
        "hard",
      );
}

function expectNonEmptyString(value: unknown, pathName: string) {
  return typeof value === "string" && value.trim().length > 0
    ? null
    : failure(
        "invalid_string",
        pathName,
        "Review-bundle intake field must be a non-empty string.",
        "hard",
      );
}

function expectStringOrNull(value: unknown, pathName: string) {
  return typeof value === "string" || value === null
    ? null
    : failure(
        "invalid_string_or_null",
        pathName,
        "Review-bundle intake field must be a string or null.",
        "hard",
      );
}

function expectBoolean(value: unknown, pathName: string) {
  return typeof value === "boolean"
    ? null
    : failure(
        "invalid_boolean",
        pathName,
        "Review-bundle intake field must be boolean.",
        "hard",
      );
}

function expectNumber(value: unknown, pathName: string) {
  return typeof value === "number" && Number.isFinite(value)
    ? null
    : failure(
        "invalid_number",
        pathName,
        "Review-bundle intake field must be a finite number.",
        "hard",
      );
}

function expectNumberOrNull(value: unknown, pathName: string) {
  return (typeof value === "number" && Number.isFinite(value)) || value === null
    ? null
    : failure(
        "invalid_number_or_null",
        pathName,
        "Review-bundle intake field must be a finite number or null.",
        "hard",
      );
}

function expectStringArray(value: unknown, pathName: string) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? null
    : failure(
        "invalid_string_array",
        pathName,
        "Review-bundle intake field must be an array of strings.",
        "hard",
      );
}

function expectStringRecord(value: unknown, pathName: string) {
  return isRecord(value) &&
    Object.values(value).every((item) => typeof item === "string")
    ? null
    : failure(
        "invalid_string_record",
        pathName,
        "Review-bundle intake field must be an object of strings.",
        "hard",
      );
}

function findDepthFailure(
  value: unknown,
  pathName: string,
  depth: number,
): OperatingSignalFlowRuntimeReadinessFailure | null {
  if (depth > OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_DEPTH) {
    return failure(
      "input_depth_limit_exceeded",
      pathName,
      "Review-bundle intake input exceeds the offline recursive scan depth cap.",
      "hard",
    );
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const itemFailure = findDepthFailure(
        value[index],
        `${pathName}[${index}]`,
        depth + 1,
      );
      if (itemFailure) {
        return itemFailure;
      }
    }
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      const itemFailure = findDepthFailure(
        item,
        `${pathName}.${key}`,
        depth + 1,
      );
      if (itemFailure) {
        return itemFailure;
      }
    }
  }
  return null;
}

function findSensitiveFindings(value: unknown) {
  const findings: OperatingSignalFlowRuntimeReadinessFailure[] = [];

  walk(value, "$", (pathName, item, key) => {
    if (key && SENSITIVE_KEY_RULES.has(normalizeKey(key))) {
      findings.push(
        failure(
          "sensitive_key_detected",
          pathName,
          "Review-bundle intake found a sensitive key; it does not redact or modify input.",
          "hard",
        ),
      );
    }
    if (typeof item === "string") {
      for (const rule of SENSITIVE_VALUE_PATTERNS) {
        if (rule.regex.test(item)) {
          findings.push(
            failure(
              rule.code,
              pathName,
              "Review-bundle intake found an unredacted sensitive value pattern; it does not redact or modify input.",
              "hard",
            ),
          );
        }
      }
    }
  });

  return findings;
}

function walk(
  value: unknown,
  pathName: string,
  visit: (pathName: string, value: unknown, key: string | null) => void,
  key: string | null = null,
) {
  visit(pathName, value, key);
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walk(item, `${pathName}[${index}]`, visit, String(index)),
    );
    return;
  }
  if (isRecord(value)) {
    for (const [childKey, item] of Object.entries(value)) {
      walk(item, `${pathName}.${childKey}`, visit, childKey);
    }
  }
}

function buildInputFailure(
  inputFailure: OperatingSignalFlowRuntimeReadinessFailure,
  parsed?: unknown,
): OperatingSignalFlowRuntimeReadinessIntakeResult {
  return buildBaseResult({
    parsed,
    caseId: readStringProperty(parsed, "caseId"),
    evaluatedAt: readStringProperty(parsed, "evaluatedAt"),
    preflight: "invalid_input",
    readinessDecision: "not_evaluated",
    exitCode: 64,
    findings: [inputFailure],
    readinessFailures: [],
    caseResult: null,
    wrappedPack: null,
  });
}

function buildBaseResult(params: {
  parsed?: unknown;
  caseId: string | null;
  evaluatedAt: string | null;
  preflight: OperatingSignalFlowRuntimeReadinessIntakePreflight;
  readinessDecision: OperatingSignalFlowRuntimeReadinessIntakeReadinessDecision;
  exitCode: OperatingSignalFlowRuntimeReadinessIntakeExitCode;
  findings: OperatingSignalFlowRuntimeReadinessFailure[];
  readinessFailures: OperatingSignalFlowRuntimeReadinessFailure[];
  caseResult: OperatingSignalFlowRuntimeReadinessCaseResult | null;
  wrappedPack: OperatingSignalFlowRuntimeReadinessFixturePack | null;
  inputDigest?: string;
}): OperatingSignalFlowRuntimeReadinessIntakeResult {
  return {
    schemaVersion:
      OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_SCHEMA_VERSION,
    ruleVersion: OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_SENSITIVE_RULE_VERSION,
    boundary: OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_BOUNDARY,
    maxBytes: OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_BYTES,
    maxDepth: OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_DEPTH,
    caseId: params.caseId,
    evaluatedAt: params.evaluatedAt,
    inputDigest:
      params.inputDigest ??
      (typeof params.parsed === "undefined" ? "n/a" : digestInput(params.parsed)),
    preflight: params.preflight,
    readinessDecision: params.readinessDecision,
    exitCode: params.exitCode,
    findings: params.findings,
    readinessFailures: params.readinessFailures,
    caseResult: params.caseResult,
    wrappedPack: params.wrappedPack,
  };
}

function readStringProperty(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : null;
}

function failure(
  code: string,
  pathName: string,
  message: string,
  severity: OperatingSignalFlowRuntimeReadinessFailureSeverity,
): OperatingSignalFlowRuntimeReadinessFailure {
  return { code, path: pathName, message, severity };
}

function normalizeKey(key: string) {
  return key
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .toLowerCase()
    .replace(/[\s_.-]/gu, "");
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
