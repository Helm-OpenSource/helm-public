/**
 * Helm Business Advancement — Redacted Real-Data Calibration Package Gate.
 *
 * Planning-only pure evaluator that combines the two required calibration
 * evidence lines before production query adoption can be reviewed:
 *
 * 1. Ask Helm interaction redacted real interaction snapshot.
 * 2. Production query live DB redacted snapshot Phase 3R/3S readiness.
 *
 * This is NOT a DB reader, NOT an API, NOT a runtime adapter, NOT a production
 * query, NOT a page integration, NOT an official write path, and NOT execution
 * authority.
 */

import {
  DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION,
  POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION,
  type AskHelmInteractionRedactedCalibrationEvaluationResult,
} from "./ask-helm-interaction-redacted-calibration";

export const REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RULE_VERSION =
  "redacted-real-data-calibration-package/v1" as const;

export const REDACTED_REAL_DATA_CALIBRATION_PACKAGE_POSTURE =
  "Planning-Only" as const;

export const REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RUNTIME_ADOPTION =
  "No-Go" as const;

export type RedactedRealDataCalibrationPackageDecision =
  | "No-Go"
  | "Ready-For-Manual-Review";

export interface ProductionQueryLiveDbCalibrationEvidence {
  readonly phase3pSnapshotCollected: boolean;
  readonly phase3qIntakePassed: boolean;
  readonly phase3rPreflightPassed: boolean;
  readonly phase3sReviewPacketReady: boolean;
  readonly sampleKind: "synthetic_fixture" | "local_development_snapshot" | "redacted_live_db_snapshot";
  readonly realDataValidated: boolean;
  readonly productionCalibrationComplete: boolean;
  readonly blockedReasons: readonly string[];
  readonly snapshotRef: string;
  readonly reviewPacketRef: string;
}

export interface RedactedRealDataCalibrationPackageInput {
  readonly askHelmInteractionEvidence: AskHelmInteractionRedactedCalibrationEvaluationResult;
  readonly productionQueryLiveDbEvidence: ProductionQueryLiveDbCalibrationEvidence;
}

export interface RedactedRealDataCalibrationPackageCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly blocker?: string;
}

export interface RedactedRealDataCalibrationPackageSummary {
  readonly packageReady: boolean;
  readonly askHelmInteractionEvidenceReady: boolean;
  readonly productionQueryLiveDbEvidenceReady: boolean;
  readonly ruleVersion: typeof REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RULE_VERSION;
  readonly decision: RedactedRealDataCalibrationPackageDecision;
}

export interface RedactedRealDataCalibrationPackageResult {
  readonly ruleVersion: typeof REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RULE_VERSION;
  readonly posture: typeof REDACTED_REAL_DATA_CALIBRATION_PACKAGE_POSTURE;
  readonly runtimeAdoption: typeof REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RUNTIME_ADOPTION;
  readonly decision: RedactedRealDataCalibrationPackageDecision;
  readonly checks: readonly RedactedRealDataCalibrationPackageCheck[];
  readonly blockers: readonly string[];
  readonly allowedNextStep: string;
  readonly productionAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly summary: RedactedRealDataCalibrationPackageSummary;
}

export const DEFAULT_PRODUCTION_QUERY_LIVE_DB_CALIBRATION_EVIDENCE: ProductionQueryLiveDbCalibrationEvidence =
  {
    phase3pSnapshotCollected: false,
    phase3qIntakePassed: false,
    phase3rPreflightPassed: false,
    phase3sReviewPacketReady: false,
    sampleKind: "synthetic_fixture",
    realDataValidated: false,
    productionCalibrationComplete: false,
    blockedReasons: [
      "Actual redacted_live_db_snapshot has not been collected.",
    ],
    snapshotRef: "",
    reviewPacketRef: "",
  };

export const POSITIVE_PRODUCTION_QUERY_LIVE_DB_CALIBRATION_EVIDENCE: ProductionQueryLiveDbCalibrationEvidence =
  {
    phase3pSnapshotCollected: true,
    phase3qIntakePassed: true,
    phase3rPreflightPassed: true,
    phase3sReviewPacketReady: true,
    sampleKind: "redacted_live_db_snapshot",
    realDataValidated: true,
    productionCalibrationComplete: true,
    blockedReasons: [],
    snapshotRef: "redacted-live-db-snapshot-ba-phase3p-001",
    reviewPacketRef:
      "docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3S_RUNTIME_ADOPTION_REVIEW_PACKET_V1.md",
  };

export const DEFAULT_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT: RedactedRealDataCalibrationPackageInput =
  {
    askHelmInteractionEvidence:
      DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION,
    productionQueryLiveDbEvidence:
      DEFAULT_PRODUCTION_QUERY_LIVE_DB_CALIBRATION_EVIDENCE,
  };

export const POSITIVE_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT: RedactedRealDataCalibrationPackageInput =
  {
    askHelmInteractionEvidence:
      POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION,
    productionQueryLiveDbEvidence:
      POSITIVE_PRODUCTION_QUERY_LIVE_DB_CALIBRATION_EVIDENCE,
  };

const READY_NEXT_STEP =
  "Attach this calibration package summary to production query adoption planning and required reviewer approval. It is not production adoption.";

const NOT_READY_NEXT_STEP =
  "Collect actual redacted interaction evidence and actual redacted_live_db_snapshot evidence, then re-run this planning-only package gate.";

export function evaluateRedactedRealDataCalibrationPackageGate(
  input: RedactedRealDataCalibrationPackageInput =
    DEFAULT_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
): RedactedRealDataCalibrationPackageResult {
  const checks = [
    checkConstants(),
    checkAskHelmInteractionEvidence(input.askHelmInteractionEvidence),
    checkProductionQueryLiveDbEvidence(input.productionQueryLiveDbEvidence),
  ];
  const blockers = checks.flatMap((check) =>
    check.pass || !check.blocker ? [] : [check.blocker],
  );
  const decision: RedactedRealDataCalibrationPackageDecision =
    blockers.length === 0 ? "Ready-For-Manual-Review" : "No-Go";

  const askReady = checks[1]?.pass === true;
  const liveDbReady = checks[2]?.pass === true;

  return {
    ruleVersion: REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RULE_VERSION,
    posture: REDACTED_REAL_DATA_CALIBRATION_PACKAGE_POSTURE,
    runtimeAdoption: REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RUNTIME_ADOPTION,
    decision,
    checks,
    blockers,
    allowedNextStep:
      decision === "Ready-For-Manual-Review"
        ? READY_NEXT_STEP
        : NOT_READY_NEXT_STEP,
    productionAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    summary: {
      packageReady: decision === "Ready-For-Manual-Review",
      askHelmInteractionEvidenceReady: askReady,
      productionQueryLiveDbEvidenceReady: liveDbReady,
      ruleVersion: REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RULE_VERSION,
      decision,
    },
  };
}

function checkConstants(): RedactedRealDataCalibrationPackageCheck {
  const pass =
    REDACTED_REAL_DATA_CALIBRATION_PACKAGE_POSTURE === "Planning-Only" &&
    REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RUNTIME_ADOPTION === "No-Go";
  return {
    name: "package_constants_are_planning_only_no_go",
    pass,
    detail: `${REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RULE_VERSION}; posture=${REDACTED_REAL_DATA_CALIBRATION_PACKAGE_POSTURE}; runtime=${REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RUNTIME_ADOPTION}`,
    blocker:
      "Redacted calibration package gate must stay planning-only and runtime adoption No-Go.",
  };
}

function checkAskHelmInteractionEvidence(
  evidence: AskHelmInteractionRedactedCalibrationEvaluationResult,
): RedactedRealDataCalibrationPackageCheck {
  const pass =
    evidence.sampleKind === "redacted_real_interaction_snapshot" &&
    evidence.realDataValidated &&
    evidence.productionCalibrationComplete &&
    evidence.blockers.length === 0 &&
    evidence.checks.length > 0 &&
    evidence.checks.every((check) => check.pass) &&
    evidence.runtimeAdoption === "No-Go";
  return {
    name: "ask_helm_interaction_redacted_real_evidence_ready",
    pass,
    detail: `sampleKind=${evidence.sampleKind}; realDataValidated=${String(evidence.realDataValidated)}; productionCalibrationComplete=${String(evidence.productionCalibrationComplete)}; blockers=${evidence.blockers.length}; failedChecks=${evidence.checks.filter((check) => !check.pass).length}; runtime=${evidence.runtimeAdoption}`,
    blocker:
      "Ask Helm interaction actual live redacted evidence is missing or failed; synthetic/local fixtures cannot unlock runtime adoption review.",
  };
}

function checkProductionQueryLiveDbEvidence(
  evidence: ProductionQueryLiveDbCalibrationEvidence,
): RedactedRealDataCalibrationPackageCheck {
  const pass =
    evidence.phase3pSnapshotCollected &&
    evidence.phase3qIntakePassed &&
    evidence.phase3rPreflightPassed &&
    evidence.phase3sReviewPacketReady &&
    evidence.sampleKind === "redacted_live_db_snapshot" &&
    evidence.realDataValidated &&
    evidence.productionCalibrationComplete &&
    evidence.blockedReasons.length === 0 &&
    isNonEmpty(evidence.snapshotRef) &&
    isNonEmpty(evidence.reviewPacketRef);
  return {
    name: "production_query_redacted_live_db_evidence_ready",
    pass,
    detail: `phase3p=${String(evidence.phase3pSnapshotCollected)}; phase3q=${String(evidence.phase3qIntakePassed)}; phase3r=${String(evidence.phase3rPreflightPassed)}; phase3s=${String(evidence.phase3sReviewPacketReady)}; sampleKind=${evidence.sampleKind}; realDataValidated=${String(evidence.realDataValidated)}; productionCalibrationComplete=${String(evidence.productionCalibrationComplete)}; blockers=${evidence.blockedReasons.length}; snapshot=${evidence.snapshotRef || "missing"}; packet=${evidence.reviewPacketRef || "missing"}`,
    blocker:
      "Production query actual redacted_live_db_snapshot evidence is missing or failed; local/synthetic snapshots cannot unlock production query adoption review.",
  };
}

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}
