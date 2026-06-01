import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import fixturePack from "@/evals/pack-a/pilot-readiness-cases.json";

export type PackAMarketSegment =
  | "b2b_saas"
  | "ai_service_provider"
  | "traditional_digital_team";

export type PackAReadinessGate =
  | "week0_ready"
  | "scope_call_ready"
  | "candidate_pool"
  | "nurture"
  | "no_go";

export type PackAOwnerLevel =
  | "founder_or_coo"
  | "sales_vp"
  | "sales_director"
  | "innovation_or_it_only"
  | "none";

export type PackADataAccessTier =
  | "one_week_redacted_samples"
  | "standard_crm_plus_meeting_samples"
  | "self_built_exportable"
  | "long_security_review"
  | "unavailable";

export type PackAProofPosture =
  | "approved_public"
  | "anonymized_public"
  | "semi_public_reference"
  | "internal_only_proof"
  | "no_proof";

export type PackAPaidPilotAnchor = "30000" | "50000" | "80000" | "free_only" | "unknown";

export type PackABoundaryPosture =
  | "review_first"
  | "unclear"
  | "demands_auto_send_or_crm_write";

export interface PackAPilotReadinessTargets {
  readonly scopeCallScore: number;
  readonly minimumPilotScore: number;
  readonly candidatePoolScore: number;
  readonly nurtureScore: number;
  readonly minimumFailureEvents: number;
  readonly requiredSkills: readonly string[];
}

export interface PackAPilotReadinessCase {
  readonly id: string;
  readonly alias: string;
  readonly segment: PackAMarketSegment;
  readonly expectedGate: PackAReadinessGate;
  readonly scorecard: {
    readonly pain: number;
    readonly businessOwner: number;
    readonly dataAvailability: number;
    readonly proofValue: number;
    readonly paidPilotWillingness: number;
    readonly boundaryFit: number;
  };
  readonly signals: {
    readonly failureEventCount: number;
    readonly budgetOwnerKnown: boolean;
    readonly ownerLevel: PackAOwnerLevel;
    readonly dataAccessTier: PackADataAccessTier;
    readonly proofPosture: PackAProofPosture;
    readonly paidPilotAnchor: PackAPaidPilotAnchor;
    readonly boundaryPosture: PackABoundaryPosture;
    readonly phase3RuntimeAdoptionClaimed: boolean;
  };
  readonly week0: {
    readonly contractSigned: boolean;
    readonly dpaSigned: boolean;
    readonly dataChecklistConfirmed: boolean;
    readonly workspaceReady: boolean;
    readonly weeklyReviewScheduled: boolean;
    readonly customerOwnerAssigned: boolean;
    readonly founderDay1Available: boolean;
    readonly gtmOperatorAssigned: boolean;
    readonly implementationLeadAssigned: boolean;
  };
}

export interface PackAPilotReadinessFixturePack {
  readonly version: string;
  readonly status: string;
  readonly boundary: string;
  readonly targets: PackAPilotReadinessTargets;
  readonly cases: readonly PackAPilotReadinessCase[];
}

export interface PackASkillIntegrationRow {
  readonly skillId: string;
  readonly skillMdPresent: boolean;
  readonly fixturePresent: boolean;
  readonly seedPlaybookPresent: boolean;
  readonly seedThresholdsPresent: boolean;
  readonly templateCount: number;
  readonly integrated: boolean;
}

export interface PackARepositoryIntegrationReadout {
  readonly packConfigPresent: boolean;
  readonly packReadmePresent: boolean;
  readonly requiredSkillCount: number;
  readonly integratedSkillCount: number;
  readonly rows: readonly PackASkillIntegrationRow[];
  readonly passed: boolean;
  readonly failures: readonly string[];
}

export interface PackAPilotReadinessCaseResult {
  readonly caseId: string;
  readonly alias: string;
  readonly segment: PackAMarketSegment;
  readonly expectedGate: PackAReadinessGate;
  readonly actualGate: PackAReadinessGate;
  readonly gateMatched: boolean;
  readonly totalScore: number;
  readonly scopeCallEligible: boolean;
  readonly week0StartAllowed: boolean;
  readonly publicProofCandidate: boolean;
  readonly blockedReasons: readonly string[];
  readonly nextAction: string;
  readonly hardSafety: {
    readonly autoOutreachCreated: 0;
    readonly autoSendCreated: 0;
    readonly crmWriteCreated: 0;
    readonly priceCommitmentCreated: 0;
    readonly publicClaimPublished: 0;
    readonly llmFinalRankingUsed: 0;
  };
}

export interface PackAPilotReadinessSummary {
  readonly passed: boolean;
  readonly version: string;
  readonly totalCases: number;
  readonly gateMatches: number;
  readonly week0ReadyCases: number;
  readonly scopeCallReadyCases: number;
  readonly candidatePoolCases: number;
  readonly noGoCases: number;
  readonly averageScore: number;
  readonly repositoryIntegration: PackARepositoryIntegrationReadout;
  readonly caseResults: readonly PackAPilotReadinessCaseResult[];
  readonly failures: readonly string[];
}

const SCORE_LIMITS = {
  pain: 25,
  businessOwner: 20,
  dataAvailability: 20,
  proofValue: 15,
  paidPilotWillingness: 15,
  boundaryFit: 5,
} as const;

export function runPackAPilotReadinessEval(
  pack: PackAPilotReadinessFixturePack =
    fixturePack as PackAPilotReadinessFixturePack,
  repoRoot = process.cwd(),
): PackAPilotReadinessSummary {
  const repositoryIntegration = buildPackARepositoryIntegrationReadout(
    repoRoot,
    pack.targets.requiredSkills,
  );
  const caseResults = pack.cases.map((item) => evaluatePackACase(item, pack.targets));
  const failures = [
    ...caseResults
      .filter((item) => !item.gateMatched)
      .map(
        (item) =>
          `${item.caseId}: expected ${item.expectedGate}, got ${item.actualGate}`,
      ),
    ...caseResults.flatMap((item) =>
      item.blockedReasons
        .filter((reason) => reason.startsWith("invalid_score:"))
        .map((reason) => `${item.caseId}: ${reason}`),
    ),
    ...repositoryIntegration.failures,
  ];

  return {
    passed: failures.length === 0,
    version: pack.version,
    totalCases: caseResults.length,
    gateMatches: caseResults.filter((item) => item.gateMatched).length,
    week0ReadyCases: caseResults.filter((item) => item.actualGate === "week0_ready").length,
    scopeCallReadyCases: caseResults.filter(
      (item) => item.actualGate === "scope_call_ready",
    ).length,
    candidatePoolCases: caseResults.filter(
      (item) => item.actualGate === "candidate_pool",
    ).length,
    noGoCases: caseResults.filter((item) => item.actualGate === "no_go").length,
    averageScore: average(caseResults.map((item) => item.totalScore)),
    repositoryIntegration,
    caseResults,
    failures,
  };
}

export function evaluatePackACase(
  item: PackAPilotReadinessCase,
  targets: PackAPilotReadinessTargets,
): PackAPilotReadinessCaseResult {
  const invalidScoreReasons = validateScorecard(item);
  const totalScore = scorePackACandidate(item);
  const noGoReasons = buildNoGoReasons(item, targets);
  const week0Blockers = buildWeek0Blockers(item, targets);
  const blockedReasons = [...invalidScoreReasons, ...noGoReasons, ...week0Blockers];

  let actualGate: PackAReadinessGate;
  if (noGoReasons.length > 0) {
    actualGate = "no_go";
  } else if (totalScore >= targets.minimumPilotScore && week0Blockers.length === 0) {
    actualGate = "week0_ready";
  } else if (totalScore >= targets.scopeCallScore) {
    actualGate = "scope_call_ready";
  } else if (totalScore >= targets.candidatePoolScore) {
    actualGate = "candidate_pool";
  } else if (totalScore >= targets.nurtureScore) {
    actualGate = "nurture";
  } else {
    actualGate = "no_go";
  }

  return {
    caseId: item.id,
    alias: item.alias,
    segment: item.segment,
    expectedGate: item.expectedGate,
    actualGate,
    gateMatched: actualGate === item.expectedGate,
    totalScore,
    scopeCallEligible: actualGate === "scope_call_ready" || actualGate === "week0_ready",
    week0StartAllowed: actualGate === "week0_ready",
    publicProofCandidate:
      item.signals.proofPosture === "approved_public" ||
      item.signals.proofPosture === "anonymized_public" ||
      item.signals.proofPosture === "semi_public_reference",
    blockedReasons,
    nextAction: nextActionForGate(actualGate),
    hardSafety: {
      autoOutreachCreated: 0,
      autoSendCreated: 0,
      crmWriteCreated: 0,
      priceCommitmentCreated: 0,
      publicClaimPublished: 0,
      llmFinalRankingUsed: 0,
    },
  };
}

export function scorePackACandidate(item: PackAPilotReadinessCase): number {
  return (
    item.scorecard.pain +
    item.scorecard.businessOwner +
    item.scorecard.dataAvailability +
    item.scorecard.proofValue +
    item.scorecard.paidPilotWillingness +
    item.scorecard.boundaryFit
  );
}

export function buildPackARepositoryIntegrationReadout(
  repoRoot = process.cwd(),
  requiredSkills: readonly string[] =
    (fixturePack as PackAPilotReadinessFixturePack).targets.requiredSkills,
): PackARepositoryIntegrationReadout {
  const packRoot = path.join(repoRoot, "docs/sales/packs/pack-a");
  const rows = requiredSkills.map((skillId) => {
    const skillRoot = path.join(packRoot, "skills", skillId);
    const fixtureDir = path.join(skillRoot, "fixtures");
    const templateDir = path.join(skillRoot, "seed", "templates");
    const templateCount = countFiles(templateDir);
    const row: PackASkillIntegrationRow = {
      skillId,
      skillMdPresent: existsSync(path.join(skillRoot, "SKILL.md")),
      fixturePresent: countFiles(fixtureDir) > 0,
      seedPlaybookPresent: existsSync(path.join(skillRoot, "seed", "playbook.md")),
      seedThresholdsPresent: existsSync(path.join(skillRoot, "seed", "thresholds.yaml")),
      templateCount,
      integrated: false,
    };
    return {
      ...row,
      integrated:
        row.skillMdPresent &&
        row.fixturePresent &&
        row.seedPlaybookPresent &&
        row.seedThresholdsPresent &&
        row.templateCount > 0,
    };
  });
  const failures = [
    ...(existsSync(path.join(packRoot, "pack.config.yaml"))
      ? []
      : ["pack-a: missing pack.config.yaml"]),
    ...(existsSync(path.join(packRoot, "PACK.md")) ? [] : ["pack-a: missing PACK.md"]),
    ...rows
      .filter((row) => !row.integrated)
      .map((row) => `pack-a:${row.skillId}: missing skill/fixture/seed/template coverage`),
    ...validatePackConfig(path.join(packRoot, "pack.config.yaml"), requiredSkills),
  ];

  return {
    packConfigPresent: existsSync(path.join(packRoot, "pack.config.yaml")),
    packReadmePresent: existsSync(path.join(packRoot, "PACK.md")),
    requiredSkillCount: requiredSkills.length,
    integratedSkillCount: rows.filter((row) => row.integrated).length,
    rows,
    passed: failures.length === 0,
    failures,
  };
}

function validateScorecard(item: PackAPilotReadinessCase): readonly string[] {
  return (Object.keys(SCORE_LIMITS) as Array<keyof typeof SCORE_LIMITS>).flatMap((key) => {
    const value = item.scorecard[key];
    const max = SCORE_LIMITS[key];
    if (!Number.isInteger(value) || value < 0 || value > max) {
      return [`invalid_score:${key}:${value}:expected_0_${max}`];
    }
    return [];
  });
}

function buildNoGoReasons(
  item: PackAPilotReadinessCase,
  targets: PackAPilotReadinessTargets,
): readonly string[] {
  const reasons: string[] = [];
  if (item.signals.failureEventCount < targets.minimumFailureEvents) {
    reasons.push("no_go:insufficient_failure_events");
  }
  if (!item.signals.budgetOwnerKnown) {
    reasons.push("no_go:budget_owner_unknown");
  }
  if (item.signals.ownerLevel === "innovation_or_it_only" || item.signals.ownerLevel === "none") {
    reasons.push("no_go:business_owner_missing");
  }
  if (
    item.signals.dataAccessTier === "long_security_review" ||
    item.signals.dataAccessTier === "unavailable"
  ) {
    reasons.push("no_go:data_access_not_week0_ready");
  }
  if (item.signals.proofPosture === "no_proof") {
    reasons.push("no_go:proof_unavailable");
  }
  if (item.signals.paidPilotAnchor === "free_only" || item.signals.paidPilotAnchor === "unknown") {
    reasons.push("no_go:paid_pilot_not_validated");
  }
  if (item.signals.boundaryPosture !== "review_first") {
    reasons.push("no_go:boundary_mismatch");
  }
  if (item.signals.phase3RuntimeAdoptionClaimed) {
    reasons.push("no_go:phase3_runtime_overclaim");
  }
  return reasons;
}

function buildWeek0Blockers(
  item: PackAPilotReadinessCase,
  targets: PackAPilotReadinessTargets,
): readonly string[] {
  if (scorePackACandidate(item) < targets.minimumPilotScore) {
    return ["week0_blocker:score_below_minimum_pilot_threshold"];
  }
  const checks: Array<[keyof PackAPilotReadinessCase["week0"], string]> = [
    ["contractSigned", "week0_blocker:contract_not_signed"],
    ["dpaSigned", "week0_blocker:dpa_not_signed"],
    ["dataChecklistConfirmed", "week0_blocker:data_checklist_not_confirmed"],
    ["workspaceReady", "week0_blocker:workspace_not_ready"],
    ["weeklyReviewScheduled", "week0_blocker:weekly_review_not_scheduled"],
    ["customerOwnerAssigned", "week0_blocker:customer_owner_not_assigned"],
    ["founderDay1Available", "week0_blocker:founder_day1_not_available"],
    ["gtmOperatorAssigned", "week0_blocker:gtm_operator_not_assigned"],
    ["implementationLeadAssigned", "week0_blocker:implementation_lead_not_assigned"],
  ];
  return checks.flatMap(([key, reason]) => (item.week0[key] ? [] : [reason]));
}

function nextActionForGate(gate: PackAReadinessGate): string {
  switch (gate) {
    case "week0_ready":
      return "start_week0_only_after founder/legal/data-protection final review";
    case "scope_call_ready":
      return "book_45_min_scope_call_with_sales_owner_it_legal_and_helm_leads";
    case "candidate_pool":
      return "keep_as_backup_and_validate proof_data_or_internal_role_gap";
    case "nurture":
      return "nurture_until owner_budget_data_or_proof_signal_changes";
    case "no_go":
      return "stop_or_downgrade_to_relationship_nurture";
  }
}

function validatePackConfig(
  configPath: string,
  requiredSkills: readonly string[],
): readonly string[] {
  if (!existsSync(configPath)) return [];
  const content = readFileSync(configPath, "utf-8");
  const requiredMarkers = [
    "recommendation_only: true",
    "audit_required: true",
    "meeting_recording_consent: required",
    "crm_write_consent: required",
    "load_fixtures: true",
  ];
  return [
    ...requiredMarkers
      .filter((marker) => !content.includes(marker))
      .map((marker) => `pack-a: pack.config.yaml missing ${marker}`),
    ...requiredSkills
      .filter((skillId) => !content.includes(skillId))
      .map((skillId) => `pack-a: pack.config.yaml missing skill ${skillId}`),
  ];
}

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((entry) => {
    const fullPath = path.join(dir, entry);
    return statSync(fullPath).isFile();
  }).length;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
