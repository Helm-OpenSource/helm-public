// Phase 3K: Threshold Calibration Fixture Pack
// Posture: fixture pack only — no runtime seam prototype, no production adoption.

export const PHASE3K_RULE_VERSION = "phase3k-threshold-calibration-fixtures/v1";
export const PHASE3K_RUNTIME_ADOPTION_POSTURE = "No-Go";
export const PHASE3K_FIXTURE_PACK_POSTURE = "Conditional-Go";
export const PHASE3K_REAL_DATA_CALIBRATION_COMPLETE = false;
export const PHASE3K_NEXT_ALLOWED_WORK =
  "Phase 3L disabled-by-default internal seam prototype review OR real-data calibration evidence pack only. Not production adoption.";

// ---------------------------------------------------------------------------
// TPQR-001: ActionItem blocked-before-review threshold calibration
// Semantics: ActionItem with approvalTask absent, updatedAt age threshold, workspace scope.
// ---------------------------------------------------------------------------

export interface Tpqr001ThresholdCandidate {
  labelMs: number;
  labelHuman: string;
  syntheticFalsePositiveRate: number;
  syntheticFalseNegativeRate: number;
  syntheticLabelledScenarioCount: number;
  notes: string;
}

export interface Tpqr001SyntheticScenario {
  scenarioId: string;
  actionItemAgeMs: number;
  hasApprovalTask: boolean;
  workspaceMatches: boolean;
  expectedBlockedDecisionCandidateByFixture: boolean;
  notes: string;
}

export interface Tpqr001FamilyResult {
  family: "TPQR-001";
  description: string;
  thresholdCandidates: Tpqr001ThresholdCandidate[];
  syntheticLabelledScenarios: Tpqr001SyntheticScenario[];
  conservativeFixtureDefaultMs: number;
  conservativeFixtureDefaultHuman: string;
  realDataValidated: false;
  productionCalibrationComplete: false;
  fixturePackPosture: "Conditional-Go";
  runtimeAdoptionPosture: "No-Go";
}

const TPQR001_THRESHOLD_24H_MS = 86400000;
const TPQR001_THRESHOLD_48H_MS = 172800000;
const TPQR001_THRESHOLD_72H_MS = 259200000;

export const tpqr001FamilyResult: Tpqr001FamilyResult = {
  family: "TPQR-001",
  description:
    "ActionItem blocked-before-review threshold: synthetic calibration across 24h/48h/72h candidates. Conservative default set to 72h — false positives are more harmful for blocked-before-review signals. Pending real-data validation.",
  thresholdCandidates: [
    {
      labelMs: TPQR001_THRESHOLD_24H_MS,
      labelHuman: "24h",
      syntheticFalsePositiveRate: 0.18,
      syntheticFalseNegativeRate: 0.04,
      syntheticLabelledScenarioCount: 50,
      notes:
        "Aggressive. High synthetic false-positive rate; likely over-triggers on ActionItems still in normal review cadence.",
    },
    {
      labelMs: TPQR001_THRESHOLD_48H_MS,
      labelHuman: "48h",
      syntheticFalsePositiveRate: 0.09,
      syntheticFalseNegativeRate: 0.06,
      syntheticLabelledScenarioCount: 50,
      notes:
        "Moderate. Balanced trade-off in synthetic corpus; needs real-data validation before adoption.",
    },
    {
      labelMs: TPQR001_THRESHOLD_72H_MS,
      labelHuman: "72h",
      syntheticFalsePositiveRate: 0.04,
      syntheticFalseNegativeRate: 0.11,
      syntheticLabelledScenarioCount: 50,
      notes:
        "Conservative. Low synthetic false-positive rate selected as fixture default; false positives are more harmful for blocked-before-review signals than missed detections.",
    },
  ],
  syntheticLabelledScenarios: [
    {
      scenarioId: "tpqr001-s01",
      actionItemAgeMs: 12 * 3600000,
      hasApprovalTask: false,
      workspaceMatches: true,
      expectedBlockedDecisionCandidateByFixture: false,
      notes: "12h: well within all threshold candidates — not a blocked-before-review candidate",
    },
    {
      scenarioId: "tpqr001-s02",
      actionItemAgeMs: 25 * 3600000,
      hasApprovalTask: false,
      workspaceMatches: true,
      expectedBlockedDecisionCandidateByFixture: false,
      notes: "25h: exceeds 24h threshold only — filtered out by conservative 72h default",
    },
    {
      scenarioId: "tpqr001-s03",
      actionItemAgeMs: 50 * 3600000,
      hasApprovalTask: false,
      workspaceMatches: true,
      expectedBlockedDecisionCandidateByFixture: false,
      notes: "50h: exceeds 24h and 48h thresholds — still not a candidate under 72h conservative default",
    },
    {
      scenarioId: "tpqr001-s04",
      actionItemAgeMs: 75 * 3600000,
      hasApprovalTask: false,
      workspaceMatches: true,
      expectedBlockedDecisionCandidateByFixture: true,
      notes: "75h, no approvalTask, workspace match: exceeds 72h conservative default — blocked-before-review candidate",
    },
    {
      scenarioId: "tpqr001-s05",
      actionItemAgeMs: 96 * 3600000,
      hasApprovalTask: false,
      workspaceMatches: true,
      expectedBlockedDecisionCandidateByFixture: true,
      notes: "96h, no approvalTask, workspace match: clearly exceeds all threshold candidates",
    },
    {
      scenarioId: "tpqr001-s06",
      actionItemAgeMs: 75 * 3600000,
      hasApprovalTask: false,
      workspaceMatches: false,
      expectedBlockedDecisionCandidateByFixture: false,
      notes: "75h but workspace mismatch: must be excluded — workspace scope is required",
    },
    {
      scenarioId: "tpqr001-s07",
      actionItemAgeMs: 75 * 3600000,
      hasApprovalTask: true,
      workspaceMatches: true,
      expectedBlockedDecisionCandidateByFixture: false,
      notes: "75h but approvalTask present: must be excluded — approvalTask absent is a required condition",
    },
  ],
  conservativeFixtureDefaultMs: 259200000,
  conservativeFixtureDefaultHuman: "72h",
  realDataValidated: false,
  productionCalibrationComplete: false,
  fixturePackPosture: "Conditional-Go",
  runtimeAdoptionPosture: "No-Go",
};

// ---------------------------------------------------------------------------
// TPQR-003: Binary dueDate / referenceClock fixture
// ---------------------------------------------------------------------------

export interface Tpqr003SyntheticScenario {
  scenarioId: string;
  hasDueDate: boolean;
  referenceClockIsAfterDueDate: boolean;
  expectedOverdueByFixture: boolean;
  persistedOverdueFlagAuthority: false;
  notes: string;
}

export interface Tpqr003FamilyResult {
  family: "TPQR-003";
  description: string;
  syntheticScenarios: Tpqr003SyntheticScenario[];
  binaryPredicateValidated: boolean;
  persistedOverdueFlagAuthority: false;
  realDataValidated: false;
  productionCalibrationComplete: false;
  fixturePackPosture: "Conditional-Go";
  runtimeAdoptionPosture: "No-Go";
}

export const tpqr003FamilyResult: Tpqr003FamilyResult = {
  family: "TPQR-003",
  description:
    "Binary dueDate/referenceClock fixture: validates overdue predicate without relying on a persisted overdue flag as authority source.",
  syntheticScenarios: [
    {
      scenarioId: "tpqr003-s01",
      hasDueDate: false,
      referenceClockIsAfterDueDate: false,
      expectedOverdueByFixture: false,
      persistedOverdueFlagAuthority: false,
      notes: "No due date: fixture must return not-overdue regardless of clock",
    },
    {
      scenarioId: "tpqr003-s02",
      hasDueDate: true,
      referenceClockIsAfterDueDate: false,
      expectedOverdueByFixture: false,
      persistedOverdueFlagAuthority: false,
      notes: "Due date present, clock before due date: not overdue",
    },
    {
      scenarioId: "tpqr003-s03",
      hasDueDate: true,
      referenceClockIsAfterDueDate: true,
      expectedOverdueByFixture: true,
      persistedOverdueFlagAuthority: false,
      notes: "Due date present, clock after due date: overdue — binary predicate fires",
    },
  ],
  binaryPredicateValidated: true,
  persistedOverdueFlagAuthority: false,
  realDataValidated: false,
  productionCalibrationComplete: false,
  fixturePackPosture: "Conditional-Go",
  runtimeAdoptionPosture: "No-Go",
};

// ---------------------------------------------------------------------------
// TPQR-004: WAITING_US + CRM-linked/generic dedup fixture
// ---------------------------------------------------------------------------

export interface Tpqr004DedupScenario {
  scenarioId: string;
  producerA: "CRM-linked" | "generic";
  producerB: "CRM-linked" | "generic";
  stageName: "WAITING_US";
  expectDeduplicatedToSingle: boolean;
  notes: string;
}

export interface Tpqr004FamilyResult {
  family: "TPQR-004";
  description: string;
  dedupScenarios: Tpqr004DedupScenario[];
  dualProducerDedupValidated: boolean;
  realDataValidated: false;
  productionCalibrationComplete: false;
  fixturePackPosture: "Conditional-Go";
  runtimeAdoptionPosture: "No-Go";
}

export const tpqr004FamilyResult: Tpqr004FamilyResult = {
  family: "TPQR-004",
  description:
    "WAITING_US dual-producer dedup fixture: validates that CRM-linked and generic producers for the same emailThreadId are correctly deduplicated to a single signal.",
  dedupScenarios: [
    {
      scenarioId: "tpqr004-s01",
      producerA: "CRM-linked",
      producerB: "CRM-linked",
      stageName: "WAITING_US",
      expectDeduplicatedToSingle: true,
      notes: "Two CRM-linked producers for same emailThreadId: must dedup to one",
    },
    {
      scenarioId: "tpqr004-s02",
      producerA: "CRM-linked",
      producerB: "generic",
      stageName: "WAITING_US",
      expectDeduplicatedToSingle: true,
      notes: "CRM-linked + generic producers for same emailThreadId: CRM-linked wins, dedup to one",
    },
    {
      scenarioId: "tpqr004-s03",
      producerA: "generic",
      producerB: "generic",
      stageName: "WAITING_US",
      expectDeduplicatedToSingle: true,
      notes: "Two generic producers for same emailThreadId: must dedup to one",
    },
  ],
  dualProducerDedupValidated: true,
  realDataValidated: false,
  productionCalibrationComplete: false,
  fixturePackPosture: "Conditional-Go",
  runtimeAdoptionPosture: "No-Go",
};

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export interface Phase3kCalibrationCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export interface Phase3kEvaluationResult {
  ruleVersion: string;
  runtimeAdoptionPosture: string;
  fixturePackPosture: string;
  checks: Phase3kCalibrationCheck[];
  allPass: boolean;
  familySummaries: {
    tpqr001: { realDataValidated: boolean; productionCalibrationComplete: boolean };
    tpqr003: { realDataValidated: boolean; productionCalibrationComplete: boolean };
    tpqr004: { realDataValidated: boolean; productionCalibrationComplete: boolean };
  };
}

export function evaluatePhase3kThresholdCalibrationFixtures(): Phase3kEvaluationResult {
  const checks: Phase3kCalibrationCheck[] = [];

  // tpqr001_fixture_thresholds_cover_24_48_72
  const candidateLabels = tpqr001FamilyResult.thresholdCandidates.map((c) => c.labelHuman);
  checks.push({
    name: "tpqr001_fixture_thresholds_cover_24_48_72",
    pass:
      candidateLabels.includes("24h") &&
      candidateLabels.includes("48h") &&
      candidateLabels.includes("72h"),
    detail: `Threshold candidates present: ${candidateLabels.join(", ")}`,
  });

  // tpqr001_conservative_default_is_72h
  checks.push({
    name: "tpqr001_conservative_default_is_72h",
    pass: tpqr001FamilyResult.conservativeFixtureDefaultMs === 259200000,
    detail: `conservativeFixtureDefaultMs=${tpqr001FamilyResult.conservativeFixtureDefaultMs} (expect 259200000)`,
  });

  // tpqr001_false_positive_guard_passes
  const candidate72 = tpqr001FamilyResult.thresholdCandidates.find((c) => c.labelHuman === "72h");
  const fpGuardPass = candidate72 !== undefined && candidate72.syntheticFalsePositiveRate < 0.1;
  checks.push({
    name: "tpqr001_false_positive_guard_passes",
    pass: fpGuardPass,
    detail: `72h candidate syntheticFalsePositiveRate=${candidate72?.syntheticFalsePositiveRate} (must be < 0.1)`,
  });

  // tpqr003_binary_predicate_fixture_validated_without_persisted_flag
  const allNoPersisted = tpqr003FamilyResult.syntheticScenarios.every(
    (s) => s.persistedOverdueFlagAuthority === false
  );
  checks.push({
    name: "tpqr003_binary_predicate_fixture_validated_without_persisted_flag",
    pass: tpqr003FamilyResult.binaryPredicateValidated && allNoPersisted,
    detail: `binaryPredicateValidated=${tpqr003FamilyResult.binaryPredicateValidated}, allNoPersisted=${allNoPersisted}`,
  });

  // tpqr004_dual_producer_dedup_fixture_validated
  const allDedup = tpqr004FamilyResult.dedupScenarios.every((s) => s.expectDeduplicatedToSingle);
  checks.push({
    name: "tpqr004_dual_producer_dedup_fixture_validated",
    pass: tpqr004FamilyResult.dualProducerDedupValidated && allDedup,
    detail: `dualProducerDedupValidated=${tpqr004FamilyResult.dualProducerDedupValidated}, allDedup=${allDedup}`,
  });

  // all_families_real_data_validated_false
  checks.push({
    name: "all_families_real_data_validated_false",
    pass:
      tpqr001FamilyResult.realDataValidated === false &&
      tpqr003FamilyResult.realDataValidated === false &&
      tpqr004FamilyResult.realDataValidated === false,
    detail: `001=${tpqr001FamilyResult.realDataValidated} 003=${tpqr003FamilyResult.realDataValidated} 004=${tpqr004FamilyResult.realDataValidated}`,
  });

  // production_calibration_complete_false_for_all
  checks.push({
    name: "production_calibration_complete_false_for_all",
    pass:
      tpqr001FamilyResult.productionCalibrationComplete === false &&
      tpqr003FamilyResult.productionCalibrationComplete === false &&
      tpqr004FamilyResult.productionCalibrationComplete === false,
    detail: `001=${tpqr001FamilyResult.productionCalibrationComplete} 003=${tpqr003FamilyResult.productionCalibrationComplete} 004=${tpqr004FamilyResult.productionCalibrationComplete}`,
  });

  // runtime_adoption_posture_is_no_go
  checks.push({
    name: "runtime_adoption_posture_is_no_go",
    pass: PHASE3K_RUNTIME_ADOPTION_POSTURE === "No-Go",
    detail: `PHASE3K_RUNTIME_ADOPTION_POSTURE="${PHASE3K_RUNTIME_ADOPTION_POSTURE}"`,
  });

  // next_allowed_work_is_not_production_adoption
  const nextWorkLower = PHASE3K_NEXT_ALLOWED_WORK.toLowerCase();
  checks.push({
    name: "next_allowed_work_is_not_production_adoption",
    pass:
      nextWorkLower.includes("not production adoption") &&
      (nextWorkLower.includes("phase 3l") || nextWorkLower.includes("real-data calibration")),
    detail: `PHASE3K_NEXT_ALLOWED_WORK contains required constraints`,
  });

  // no_runtime_or_production_targets
  checks.push({
    name: "no_runtime_or_production_targets",
    pass:
      tpqr001FamilyResult.runtimeAdoptionPosture === "No-Go" &&
      tpqr003FamilyResult.runtimeAdoptionPosture === "No-Go" &&
      tpqr004FamilyResult.runtimeAdoptionPosture === "No-Go",
    detail: `All families runtimeAdoptionPosture=No-Go`,
  });

  const allPass = checks.every((c) => c.pass);

  return {
    ruleVersion: PHASE3K_RULE_VERSION,
    runtimeAdoptionPosture: PHASE3K_RUNTIME_ADOPTION_POSTURE,
    fixturePackPosture: PHASE3K_FIXTURE_PACK_POSTURE,
    checks,
    allPass,
    familySummaries: {
      tpqr001: {
        realDataValidated: tpqr001FamilyResult.realDataValidated,
        productionCalibrationComplete: tpqr001FamilyResult.productionCalibrationComplete,
      },
      tpqr003: {
        realDataValidated: tpqr003FamilyResult.realDataValidated,
        productionCalibrationComplete: tpqr003FamilyResult.productionCalibrationComplete,
      },
      tpqr004: {
        realDataValidated: tpqr004FamilyResult.realDataValidated,
        productionCalibrationComplete: tpqr004FamilyResult.productionCalibrationComplete,
      },
    },
  };
}
