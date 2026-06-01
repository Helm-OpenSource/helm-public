import companyMemoryFixtures from "@/evals/company-memory/fixtures/redacted-business-events.json";
import objectGraphHealthTargets from "@/evals/company-memory/fixtures/object-graph-health-targets.json";
import productAdoptionCalibration from "@/evals/company-memory/fixtures/product-adoption-calibration.json";
import redactedPayloadPack from "@/evals/company-memory/fixtures/redacted-payload-pack.json";
import { toRate } from "@/lib/evals/shared";

export type CompanyMemoryCaseCategory =
  | "meeting"
  | "email"
  | "crm"
  | "report"
  | "ask_helm"
  | "mixed";

export type CompanyMemorySourceType =
  | "meeting"
  | "email"
  | "crm"
  | "report"
  | "ask_helm";

export type CompanyMemoryAssetType =
  | "fact"
  | "commitment"
  | "blocker"
  | "decision"
  | "boundary"
  | "preference"
  | "operating_gap";

export type CompanyMemoryReviewPosture =
  | "confirmed"
  | "review_required"
  | "watch_only"
  | "reject";

export type CompanyMemoryBenchmarkCase = {
  id: string;
  caseCategory: CompanyMemoryCaseCategory;
  workspaceId: string;
  sourceEvents: Array<{
    sourceType: CompanyMemorySourceType;
    redactedPayloadRef: string;
    occurredAt: string;
  }>;
  expectedMemoryAssets: Array<{
    assetType: CompanyMemoryAssetType;
    objectRef: {
      type: string;
      id: string;
    };
    evidenceRefs: string[];
    reviewPosture: CompanyMemoryReviewPosture;
  }>;
  expectedWorldModelAssertions: string[];
  expectedRetrievalAssertions: string[];
  expectedAdvancementOutcome: {
    mustPushExpected: boolean;
    acceptedPrimaryAction?: string;
    boundaryRequired: boolean;
  };
};

export type CompanyMemoryFixturePack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  distribution: Record<CompanyMemoryCaseCategory | "total", number>;
  cases: CompanyMemoryBenchmarkCase[];
};

export const COMPANY_MEMORY_EXPECTED_DISTRIBUTION: Record<CompanyMemoryCaseCategory, number> = {
  meeting: 12,
  email: 10,
  crm: 8,
  report: 8,
  ask_helm: 8,
  mixed: 4,
};

const LAYER_LABELS = {
  capture_quality: "Capture Quality",
  world_model_health: "World Model Health",
  retrieval_utility: "Retrieval Utility",
  advancement_impact: "Decision / Advancement Impact",
  llm_economics: "LLM Economics Readiness",
  governance_safety: "Governance Safety",
} as const;

export type CompanyMemoryScoreLayerId = keyof typeof LAYER_LABELS;

export type CompanyMemoryCaseFailure = {
  caseId: string;
  layerId: CompanyMemoryScoreLayerId | "distribution";
  reason: string;
};

export type CompanyMemoryScoreLayer = {
  id: CompanyMemoryScoreLayerId;
  label: string;
  passedCases: number;
  totalCases: number;
  passRate: number;
  failedCaseIds: string[];
};

export type CompanyMemoryFixtureEvalSummary = {
  passed: boolean;
  totalCases: number;
  distribution: {
    expected: Record<CompanyMemoryCaseCategory, number>;
    actual: Record<CompanyMemoryCaseCategory, number>;
    passed: boolean;
  };
  layers: CompanyMemoryScoreLayer[];
  failureModes: Array<{
    reason: string;
    count: number;
    caseIds: string[];
  }>;
  failures: CompanyMemoryCaseFailure[];
};

export type CompanyMemoryEvalMode = "fixture" | "four-arm" | "economics" | "world-model" | "adoption";

export type CompanyMemoryArmId =
  | "no_memory"
  | "raw_context"
  | "current_retrieval_pack"
  | "distilled_memory";

export type CompanyMemoryArmTokenEstimate = {
  noMemory: number;
  rawContext: number;
  currentRetrievalPack: number;
  distilledMemory: number;
};

export type CompanyMemoryRedactedPayloadPack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  tokenUnitCost: number;
  tokenEstimatesBySourceType: Record<CompanyMemorySourceType, CompanyMemoryArmTokenEstimate>;
  payloadRefAllowlist: string[];
};

export type CompanyMemoryArmCaseResult = {
  caseId: string;
  armId: CompanyMemoryArmId;
  enabled: boolean;
  promptTokenEstimate: number;
  evidenceCoverageRate: number;
  boundarySafe: boolean;
  qualityPass: boolean;
  usefulJudgement: boolean;
};

export type CompanyMemoryFourArmFailure = {
  caseId: string;
  armId?: CompanyMemoryArmId;
  reason: string;
};

export type CompanyMemoryArmSummary = {
  id: CompanyMemoryArmId;
  label: string;
  enabled: boolean;
  totalCases: number;
  passedCases: number;
  passRate: number;
  totalPromptTokenEstimate: number;
  averageEvidenceCoverageRate: number;
  usefulJudgementCount: number;
  costPerUsefulJudgement: number | null;
  failedCaseIds: string[];
};

export type CompanyMemoryEconomicsSummary = {
  passed: boolean;
  currentRetrievalPackCompressionRatio: number;
  rawContextCostPerUsefulJudgement: number;
  currentRetrievalPackCostPerUsefulJudgement: number;
  smallModelSuccessRate: number;
};

export type CompanyMemoryFourArmEvalSummary = {
  passed: boolean;
  totalCases: number;
  payloadRefs: {
    expected: number;
    allowlisted: number;
    missing: string[];
  };
  arms: CompanyMemoryArmSummary[];
  economics: CompanyMemoryEconomicsSummary;
  failures: CompanyMemoryFourArmFailure[];
};

export type CompanyMemoryObjectPriority = "high" | "medium" | "low";

export type CompanyMemoryObjectGraphTarget = {
  objectRef: {
    type: string;
    id: string;
  };
  priority: CompanyMemoryObjectPriority;
  requiredAssetTypes: CompanyMemoryAssetType[];
  requiresBoundary: boolean;
  expectedMinCases: number;
  expectedMinEvidenceRefs: number;
  maxFreshnessDays: number;
  expectedRelationshipAssertionCount: number;
  expectedContradictionPosture: "none" | "requires_review";
};

export type CompanyMemoryObjectGraphTargetPack = {
  version: string;
  status: string;
  asOf: string;
  redactionPosture: string;
  boundary: string;
  targets: CompanyMemoryObjectGraphTarget[];
};

export type CompanyMemoryObjectGraphMetricId =
  | "coverage"
  | "freshness"
  | "contradiction"
  | "traceability"
  | "boundary_coverage";

export type CompanyMemoryObjectGraphFailure = {
  objectRef: string;
  metricId: CompanyMemoryObjectGraphMetricId;
  reason: string;
};

export type CompanyMemoryObjectGraphMetricSummary = {
  id: CompanyMemoryObjectGraphMetricId;
  label: string;
  passedObjects: number;
  totalObjects: number;
  passRate: number;
  failedObjectRefs: string[];
};

export type CompanyMemoryObjectMemoryGap = {
  objectRef: string;
  priority: CompanyMemoryObjectPriority;
  gapScore: number;
  reasons: string[];
  latestOccurredAt: string | null;
  observedCaseCount: number;
  observedAssetTypes: CompanyMemoryAssetType[];
};

export type CompanyMemoryWorldModelEvalSummary = {
  passed: boolean;
  asOf: string;
  totalTargets: number;
  observedObjects: number;
  metrics: CompanyMemoryObjectGraphMetricSummary[];
  topMemoryGaps: CompanyMemoryObjectMemoryGap[];
  failures: CompanyMemoryObjectGraphFailure[];
};

export type CompanyMemoryAdoptionSurface = "ask_helm" | "must_push" | "briefing";

export type CompanyMemoryAdoptionCalibrationCase = {
  id: string;
  surface: CompanyMemoryAdoptionSurface;
  linkedBenchmarkCaseId: string;
  reviewRequired: boolean;
  reviewCompleted: boolean;
  boundaryIncidentCount: number;
  noMemory: {
    acceptanceScore: number;
    timeToTrustSeconds: number;
  };
  withMemory: {
    acceptanceScore: number;
    timeToTrustSeconds: number;
  };
};

export type CompanyMemoryAdoptionCalibrationPack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  targets: {
    minimumAcceptanceLiftPercent: number;
    minimumTimeToTrustReductionPercent: number;
    minimumReviewCoveragePercent: number;
    maximumBoundaryIncidentCount: number;
  };
  cases: CompanyMemoryAdoptionCalibrationCase[];
};

export type CompanyMemoryAdoptionSurfaceSummary = {
  surface: CompanyMemoryAdoptionSurface;
  totalCases: number;
  averageNoMemoryAcceptanceScore: number;
  averageWithMemoryAcceptanceScore: number;
  acceptanceLiftPercent: number;
  averageNoMemoryTimeToTrustSeconds: number;
  averageWithMemoryTimeToTrustSeconds: number;
  timeToTrustReductionPercent: number;
  reviewCoveragePercent: number;
  boundaryIncidentCount: number;
  passed: boolean;
  failedCaseIds: string[];
};

export type CompanyMemoryAdoptionFailure = {
  caseId: string;
  surface?: CompanyMemoryAdoptionSurface;
  reason: string;
};

export type CompanyMemoryAdoptionEvalSummary = {
  passed: boolean;
  totalCases: number;
  surfaces: CompanyMemoryAdoptionSurfaceSummary[];
  overall: {
    acceptanceLiftPercent: number;
    timeToTrustReductionPercent: number;
    reviewCoveragePercent: number;
    boundaryIncidentCount: number;
  };
  failures: CompanyMemoryAdoptionFailure[];
};

const COMPANY_MEMORY_MIN_CONTEXT_COMPRESSION_RATIO = 5;
const COMPANY_MEMORY_MIN_SMALL_MODEL_SUCCESS_RATE = 70;
const COMPANY_MEMORY_MAX_TOP_MEMORY_GAPS = 10;

const ARM_LABELS: Record<CompanyMemoryArmId, string> = {
  no_memory: "No memory",
  raw_context: "Raw context",
  current_retrieval_pack: "Current retrieval pack",
  distilled_memory: "Distilled memory",
};

const ARM_TOKEN_KEYS: Record<CompanyMemoryArmId, keyof CompanyMemoryArmTokenEstimate> = {
  no_memory: "noMemory",
  raw_context: "rawContext",
  current_retrieval_pack: "currentRetrievalPack",
  distilled_memory: "distilledMemory",
};

const ARM_ENABLED: Record<CompanyMemoryArmId, boolean> = {
  no_memory: true,
  raw_context: true,
  current_retrieval_pack: true,
  distilled_memory: false,
};

const OBJECT_GRAPH_METRIC_LABELS: Record<CompanyMemoryObjectGraphMetricId, string> = {
  coverage: "Object Coverage",
  freshness: "Freshness",
  contradiction: "Contradiction Control",
  traceability: "Traceability",
  boundary_coverage: "Boundary Coverage",
};

function createEmptyDistribution(): Record<CompanyMemoryCaseCategory, number> {
  return {
    meeting: 0,
    email: 0,
    crm: 0,
    report: 0,
    ask_helm: 0,
    mixed: 0,
  };
}

function isValidDate(value: string) {
  return Number.isFinite(Date.parse(value));
}

function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasBoundaryAsset(item: CompanyMemoryBenchmarkCase) {
  return item.expectedMemoryAssets.some((asset) => asset.assetType === "boundary");
}

function hasReviewRequiredAsset(item: CompanyMemoryBenchmarkCase) {
  return item.expectedMemoryAssets.some((asset) => asset.reviewPosture === "review_required");
}

function hasTraceableAssets(item: CompanyMemoryBenchmarkCase) {
  return item.expectedMemoryAssets.every(
    (asset) =>
      hasNonEmptyString(asset.assetType) &&
      hasNonEmptyString(asset.objectRef?.type) &&
      hasNonEmptyString(asset.objectRef?.id) &&
      Array.isArray(asset.evidenceRefs) &&
      asset.evidenceRefs.length > 0 &&
      asset.evidenceRefs.every(hasNonEmptyString) &&
      hasNonEmptyString(asset.reviewPosture),
  );
}

function evaluateCase(item: CompanyMemoryBenchmarkCase): CompanyMemoryCaseFailure[] {
  const failures: CompanyMemoryCaseFailure[] = [];

  if (!Array.isArray(item.sourceEvents) || item.sourceEvents.length === 0) {
    failures.push({ caseId: item.id, layerId: "capture_quality", reason: "missing_source_events" });
  }

  if (item.sourceEvents.some((event) => !hasNonEmptyString(event.redactedPayloadRef) || !isValidDate(event.occurredAt))) {
    failures.push({ caseId: item.id, layerId: "capture_quality", reason: "invalid_source_event_shape" });
  }

  if (!Array.isArray(item.expectedMemoryAssets) || item.expectedMemoryAssets.length === 0) {
    failures.push({ caseId: item.id, layerId: "capture_quality", reason: "missing_expected_memory_assets" });
  } else if (!hasTraceableAssets(item)) {
    failures.push({ caseId: item.id, layerId: "capture_quality", reason: "untraceable_memory_asset" });
  }

  if (!Array.isArray(item.expectedWorldModelAssertions) || item.expectedWorldModelAssertions.length === 0) {
    failures.push({ caseId: item.id, layerId: "world_model_health", reason: "missing_world_model_assertions" });
  }

  if (
    item.expectedWorldModelAssertions?.some((assertion) => !hasNonEmptyString(assertion)) ||
    item.expectedMemoryAssets?.some((asset) => !hasNonEmptyString(asset.objectRef?.type) || !hasNonEmptyString(asset.objectRef?.id))
  ) {
    failures.push({ caseId: item.id, layerId: "world_model_health", reason: "invalid_world_model_reference" });
  }

  if (!Array.isArray(item.expectedRetrievalAssertions) || item.expectedRetrievalAssertions.length === 0) {
    failures.push({ caseId: item.id, layerId: "retrieval_utility", reason: "missing_retrieval_assertions" });
  }

  if (item.expectedRetrievalAssertions?.some((assertion) => !hasNonEmptyString(assertion))) {
    failures.push({ caseId: item.id, layerId: "retrieval_utility", reason: "invalid_retrieval_assertion" });
  }

  if (!item.expectedAdvancementOutcome) {
    failures.push({ caseId: item.id, layerId: "advancement_impact", reason: "missing_advancement_outcome" });
  }

  if (item.expectedAdvancementOutcome?.mustPushExpected && !hasNonEmptyString(item.expectedAdvancementOutcome.acceptedPrimaryAction)) {
    failures.push({ caseId: item.id, layerId: "advancement_impact", reason: "missing_primary_action_for_must_push" });
  }

  if (!item.sourceEvents?.length || !item.expectedRetrievalAssertions?.length || !item.expectedAdvancementOutcome) {
    failures.push({ caseId: item.id, layerId: "llm_economics", reason: "missing_economics_inputs" });
  }

  if (item.expectedAdvancementOutcome?.boundaryRequired && !hasBoundaryAsset(item)) {
    failures.push({ caseId: item.id, layerId: "governance_safety", reason: "missing_boundary_asset" });
  }

  if (item.expectedAdvancementOutcome?.boundaryRequired && !hasReviewRequiredAsset(item)) {
    failures.push({ caseId: item.id, layerId: "governance_safety", reason: "missing_review_required_asset" });
  }

  return failures;
}

function summarizeLayers(cases: CompanyMemoryBenchmarkCase[], failures: CompanyMemoryCaseFailure[]) {
  return (Object.keys(LAYER_LABELS) as CompanyMemoryScoreLayerId[]).map((id) => {
    const failedCaseIds = Array.from(
      new Set(
        failures
          .filter((failure) => failure.layerId === id)
          .map((failure) => failure.caseId),
      ),
    );
    const passedCases = cases.length - failedCaseIds.length;

    return {
      id,
      label: LAYER_LABELS[id],
      passedCases,
      totalCases: cases.length,
      passRate: toRate(passedCases, cases.length),
      failedCaseIds,
    };
  });
}

function summarizeFailureModes(failures: CompanyMemoryCaseFailure[]) {
  const grouped = failures.reduce((acc, failure) => {
    const existing = acc.get(failure.reason) ?? new Set<string>();
    existing.add(failure.caseId);
    acc.set(failure.reason, existing);
    return acc;
  }, new Map<string, Set<string>>());

  return Array.from(grouped.entries())
    .map(([reason, caseIds]) => ({
      reason,
      count: caseIds.size,
      caseIds: Array.from(caseIds).sort(),
    }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function resolveDistribution(cases: CompanyMemoryBenchmarkCase[]) {
  const actual = createEmptyDistribution();
  for (const item of cases) {
    actual[item.caseCategory] += 1;
  }

  const failures: CompanyMemoryCaseFailure[] = [];
  for (const [category, expected] of Object.entries(COMPANY_MEMORY_EXPECTED_DISTRIBUTION) as Array<[CompanyMemoryCaseCategory, number]>) {
    if (actual[category] !== expected) {
      failures.push({
        caseId: "__distribution__",
        layerId: "distribution",
        reason: `distribution_${category}_expected_${expected}_got_${actual[category]}`,
      });
    }
  }

  return {
    actual,
    failures,
  };
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

function roundCost(value: number) {
  return Math.round(value * 1000000) / 1000000;
}

function resolveUniquePayloadRefs(cases: CompanyMemoryBenchmarkCase[]) {
  return Array.from(
    new Set(cases.flatMap((item) => item.sourceEvents.map((event) => event.redactedPayloadRef))),
  ).sort();
}

function resolveArmTokenEstimate(
  item: CompanyMemoryBenchmarkCase,
  armId: CompanyMemoryArmId,
  payloadPack: CompanyMemoryRedactedPayloadPack,
) {
  const tokenKey = ARM_TOKEN_KEYS[armId];

  return item.sourceEvents.reduce((total, event) => {
    const estimate = payloadPack.tokenEstimatesBySourceType[event.sourceType]?.[tokenKey] ?? 0;
    return total + estimate;
  }, 0);
}

function resolveArmCaseResult(
  item: CompanyMemoryBenchmarkCase,
  armId: CompanyMemoryArmId,
  payloadPack: CompanyMemoryRedactedPayloadPack,
): CompanyMemoryArmCaseResult {
  const enabled = ARM_ENABLED[armId];
  const promptTokenEstimate = resolveArmTokenEstimate(item, armId, payloadPack);
  const boundarySafe = !item.expectedAdvancementOutcome.boundaryRequired || hasBoundaryAsset(item);

  if (armId === "no_memory") {
    const qualityPass = !item.expectedAdvancementOutcome.mustPushExpected;
    return {
      caseId: item.id,
      armId,
      enabled,
      promptTokenEstimate,
      evidenceCoverageRate: qualityPass ? 60 : 30,
      boundarySafe: !item.expectedAdvancementOutcome.boundaryRequired,
      qualityPass,
      usefulJudgement: qualityPass,
    };
  }

  if (armId === "raw_context") {
    return {
      caseId: item.id,
      armId,
      enabled,
      promptTokenEstimate,
      evidenceCoverageRate: 85,
      boundarySafe,
      qualityPass: boundarySafe,
      usefulJudgement: boundarySafe,
    };
  }

  if (armId === "distilled_memory") {
    return {
      caseId: item.id,
      armId,
      enabled,
      promptTokenEstimate,
      evidenceCoverageRate: 90,
      boundarySafe,
      qualityPass: boundarySafe,
      usefulJudgement: false,
    };
  }

  return {
    caseId: item.id,
    armId,
    enabled,
    promptTokenEstimate,
    evidenceCoverageRate: 100,
    boundarySafe,
    qualityPass: boundarySafe && item.expectedRetrievalAssertions.length > 0,
    usefulJudgement: boundarySafe && item.expectedRetrievalAssertions.length > 0,
  };
}

function summarizeArm(
  armId: CompanyMemoryArmId,
  results: CompanyMemoryArmCaseResult[],
  tokenUnitCost: number,
): CompanyMemoryArmSummary {
  const armResults = results.filter((item) => item.armId === armId);
  const enabled = ARM_ENABLED[armId];
  const failedCaseIds = enabled
    ? armResults
        .filter((item) => !item.qualityPass || !item.boundarySafe)
        .map((item) => item.caseId)
    : [];
  const totalPromptTokenEstimate = armResults.reduce((total, item) => total + item.promptTokenEstimate, 0);
  const usefulJudgementCount = enabled
    ? armResults.filter((item) => item.usefulJudgement).length
    : 0;
  const costPerUsefulJudgement = usefulJudgementCount > 0
    ? roundCost((totalPromptTokenEstimate * tokenUnitCost) / usefulJudgementCount)
    : null;
  const averageEvidenceCoverageRate = toRate(
    armResults.reduce((total, item) => total + item.evidenceCoverageRate, 0),
    armResults.length * 100,
  );

  return {
    id: armId,
    label: ARM_LABELS[armId],
    enabled,
    totalCases: armResults.length,
    passedCases: enabled ? armResults.length - failedCaseIds.length : 0,
    passRate: enabled ? toRate(armResults.length - failedCaseIds.length, armResults.length) : 0,
    totalPromptTokenEstimate,
    averageEvidenceCoverageRate,
    usefulJudgementCount,
    costPerUsefulJudgement,
    failedCaseIds,
  };
}

function findArmSummary(arms: CompanyMemoryArmSummary[], armId: CompanyMemoryArmId) {
  const summary = arms.find((item) => item.id === armId);
  if (!summary) {
    throw new Error(`Missing company memory arm summary: ${armId}`);
  }

  return summary;
}

function summarizeEconomics(arms: CompanyMemoryArmSummary[]): CompanyMemoryEconomicsSummary {
  const rawContext = findArmSummary(arms, "raw_context");
  const currentRetrievalPack = findArmSummary(arms, "current_retrieval_pack");
  const currentRetrievalPackCompressionRatio = roundMetric(
    rawContext.totalPromptTokenEstimate / currentRetrievalPack.totalPromptTokenEstimate,
  );
  const rawContextCostPerUsefulJudgement = rawContext.costPerUsefulJudgement ?? Number.POSITIVE_INFINITY;
  const currentRetrievalPackCostPerUsefulJudgement = currentRetrievalPack.costPerUsefulJudgement ?? Number.POSITIVE_INFINITY;
  const smallModelSuccessRate = currentRetrievalPack.passRate;

  return {
    passed:
      currentRetrievalPackCompressionRatio >= COMPANY_MEMORY_MIN_CONTEXT_COMPRESSION_RATIO &&
      currentRetrievalPackCostPerUsefulJudgement < rawContextCostPerUsefulJudgement &&
      smallModelSuccessRate >= COMPANY_MEMORY_MIN_SMALL_MODEL_SUCCESS_RATE,
    currentRetrievalPackCompressionRatio,
    rawContextCostPerUsefulJudgement,
    currentRetrievalPackCostPerUsefulJudgement,
    smallModelSuccessRate,
  };
}

function objectRefKey(ref: { type: string; id: string }) {
  return `${ref.type}:${ref.id}`;
}

type CompanyMemoryObjectProfile = {
  objectRef: string;
  objectType: string;
  objectId: string;
  assetTypes: Set<CompanyMemoryAssetType>;
  reviewPostures: Set<CompanyMemoryReviewPosture>;
  caseIds: Set<string>;
  evidenceRefs: string[];
  latestOccurredAt: string | null;
  relationshipAssertions: Set<string>;
};

function buildObjectProfiles(cases: CompanyMemoryBenchmarkCase[]) {
  const profiles = new Map<string, CompanyMemoryObjectProfile>();

  for (const item of cases) {
    const latestEventAt = item.sourceEvents
      .map((event) => event.occurredAt)
      .sort()
      .at(-1) ?? null;
    const assertions = [
      ...item.expectedWorldModelAssertions,
      ...item.expectedRetrievalAssertions,
    ];

    for (const asset of item.expectedMemoryAssets) {
      const key = objectRefKey(asset.objectRef);
      const profile = profiles.get(key) ?? {
        objectRef: key,
        objectType: asset.objectRef.type,
        objectId: asset.objectRef.id,
        assetTypes: new Set<CompanyMemoryAssetType>(),
        reviewPostures: new Set<CompanyMemoryReviewPosture>(),
        caseIds: new Set<string>(),
        evidenceRefs: [],
        latestOccurredAt: null,
        relationshipAssertions: new Set<string>(),
      };

      profile.assetTypes.add(asset.assetType);
      profile.reviewPostures.add(asset.reviewPosture);
      profile.caseIds.add(item.id);
      profile.evidenceRefs.push(...asset.evidenceRefs);
      if (latestEventAt && (!profile.latestOccurredAt || latestEventAt > profile.latestOccurredAt)) {
        profile.latestOccurredAt = latestEventAt;
      }

      for (const assertion of assertions) {
        if (assertion.includes(asset.objectRef.id)) {
          profile.relationshipAssertions.add(assertion);
        }
      }

      profiles.set(key, profile);
    }
  }

  return profiles;
}

function diffDays(from: string | null, to: string) {
  if (!from) {
    return Number.POSITIVE_INFINITY;
  }

  const deltaMs = Date.parse(to) - Date.parse(from);
  return Math.max(0, Math.floor(deltaMs / 86_400_000));
}

function hasTraceableEvidence(profile: CompanyMemoryObjectProfile | undefined) {
  return Boolean(
    profile &&
      profile.evidenceRefs.length > 0 &&
      profile.evidenceRefs.every((ref) => /^CM-[A-Z]+-\d{3}#/.test(ref)),
  );
}

function hasUnreviewedContradiction(profile: CompanyMemoryObjectProfile | undefined) {
  if (!profile) {
    return false;
  }

  return (
    profile.reviewPostures.has("reject") ||
    Array.from(profile.relationshipAssertions).some((assertion) => /contradict|conflict/i.test(assertion))
  );
}

function evaluateObjectGraphTarget(
  target: CompanyMemoryObjectGraphTarget,
  profile: CompanyMemoryObjectProfile | undefined,
  asOf: string,
) {
  const objectRef = objectRefKey(target.objectRef);
  const assetTypes = profile?.assetTypes ?? new Set<CompanyMemoryAssetType>();
  const reviewPostures = profile?.reviewPostures ?? new Set<CompanyMemoryReviewPosture>();
  const missingRequiredAssetTypes = target.requiredAssetTypes.filter((assetType) => !assetTypes.has(assetType));
  const observedCaseCount = profile?.caseIds.size ?? 0;
  const evidenceRefCount = profile?.evidenceRefs.length ?? 0;
  const relationshipAssertionCount = profile?.relationshipAssertions.size ?? 0;
  const ageDays = diffDays(profile?.latestOccurredAt ?? null, asOf);

  const metricPasses: Record<CompanyMemoryObjectGraphMetricId, boolean> = {
    coverage:
      Boolean(profile) &&
      missingRequiredAssetTypes.length === 0 &&
      observedCaseCount >= target.expectedMinCases &&
      evidenceRefCount >= target.expectedMinEvidenceRefs,
    freshness: Boolean(profile?.latestOccurredAt) && ageDays <= target.maxFreshnessDays,
    contradiction:
      target.expectedContradictionPosture === "requires_review"
        ? reviewPostures.has("review_required")
        : !hasUnreviewedContradiction(profile),
    traceability:
      hasTraceableEvidence(profile) &&
      relationshipAssertionCount >= target.expectedRelationshipAssertionCount,
    boundary_coverage:
      !target.requiresBoundary ||
      (assetTypes.has("boundary") && reviewPostures.has("review_required")),
  };

  const failures = (Object.keys(metricPasses) as CompanyMemoryObjectGraphMetricId[])
    .filter((metricId) => !metricPasses[metricId])
    .map((metricId) => ({
      objectRef,
      metricId,
      reason: resolveObjectGraphFailureReason(metricId, {
        missingRequiredAssetTypes,
        observedCaseCount,
        evidenceRefCount,
        relationshipAssertionCount,
        ageDays,
      }),
    }));
  const gapReasons = resolveObjectMemoryGapReasons(target, {
    profile,
    missingRequiredAssetTypes,
    observedCaseCount,
    evidenceRefCount,
    relationshipAssertionCount,
    ageDays,
    boundaryPass: metricPasses.boundary_coverage,
  });

  return {
    objectRef,
    metricPasses,
    failures,
    gap: {
      objectRef,
      priority: target.priority,
      gapScore: resolveObjectMemoryGapScore(target.priority, gapReasons, ageDays),
      reasons: gapReasons,
      latestOccurredAt: profile?.latestOccurredAt ?? null,
      observedCaseCount,
      observedAssetTypes: Array.from(assetTypes).sort(),
    },
  };
}

function resolveObjectGraphFailureReason(
  metricId: CompanyMemoryObjectGraphMetricId,
  details: {
    missingRequiredAssetTypes: CompanyMemoryAssetType[];
    observedCaseCount: number;
    evidenceRefCount: number;
    relationshipAssertionCount: number;
    ageDays: number;
  },
) {
  if (metricId === "coverage") {
    return `coverage_failed:missing=${details.missingRequiredAssetTypes.join("|") || "none"};cases=${details.observedCaseCount};evidence=${details.evidenceRefCount}`;
  }

  if (metricId === "freshness") {
    return `freshness_failed:age_days=${details.ageDays}`;
  }

  if (metricId === "traceability") {
    return `traceability_failed:relationship_assertions=${details.relationshipAssertionCount};evidence=${details.evidenceRefCount}`;
  }

  if (metricId === "boundary_coverage") {
    return "boundary_coverage_failed:missing_boundary_or_review_required_posture";
  }

  return "contradiction_failed:unreviewed_conflict_or_missing_review_required_posture";
}

function resolveObjectMemoryGapReasons(
  target: CompanyMemoryObjectGraphTarget,
  details: {
    profile: CompanyMemoryObjectProfile | undefined;
    missingRequiredAssetTypes: CompanyMemoryAssetType[];
    observedCaseCount: number;
    evidenceRefCount: number;
    relationshipAssertionCount: number;
    ageDays: number;
    boundaryPass: boolean;
  },
) {
  const reasons: string[] = [];

  if (!details.profile) {
    reasons.push("object_missing_from_memory_graph");
  }

  if (details.missingRequiredAssetTypes.length > 0) {
    reasons.push(`missing_required_assets:${details.missingRequiredAssetTypes.join("|")}`);
  }

  if (details.observedCaseCount < 3 && target.priority !== "low") {
    reasons.push(`thin_source_depth:${details.observedCaseCount}`);
  }

  if (details.evidenceRefCount < 5 && target.priority !== "low") {
    reasons.push(`thin_evidence_refs:${details.evidenceRefCount}`);
  }

  if (details.relationshipAssertionCount < target.expectedRelationshipAssertionCount) {
    reasons.push(`relationship_assertions_below_target:${details.relationshipAssertionCount}`);
  }

  if (details.ageDays > 7) {
    reasons.push(`freshness_watch:${details.ageDays}d`);
  }

  if (!details.boundaryPass) {
    reasons.push("boundary_review_gap");
  }

  return reasons.length > 0 ? reasons : ["meets_required_contract_watch_only"];
}

function resolveObjectMemoryGapScore(
  priority: CompanyMemoryObjectPriority,
  reasons: string[],
  ageDays: number,
) {
  const priorityWeight = priority === "high" ? 30 : priority === "medium" ? 20 : 10;
  const reasonWeight = reasons.filter((reason) => reason !== "meets_required_contract_watch_only").length * 12;
  const freshnessWeight = Number.isFinite(ageDays) ? Math.min(ageDays, 21) : 21;

  return priorityWeight + reasonWeight + freshnessWeight;
}

function summarizeObjectGraphMetrics(
  totalObjects: number,
  targetResults: Array<ReturnType<typeof evaluateObjectGraphTarget>>,
) {
  return (Object.keys(OBJECT_GRAPH_METRIC_LABELS) as CompanyMemoryObjectGraphMetricId[]).map((id) => {
    const failedObjectRefs = targetResults
      .filter((result) => !result.metricPasses[id])
      .map((result) => result.objectRef);
    const passedObjects = totalObjects - failedObjectRefs.length;

    return {
      id,
      label: OBJECT_GRAPH_METRIC_LABELS[id],
      passedObjects,
      totalObjects,
      passRate: toRate(passedObjects, totalObjects),
      failedObjectRefs,
    };
  });
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function summarizeAdoptionCases(
  surface: CompanyMemoryAdoptionSurface,
  cases: CompanyMemoryAdoptionCalibrationCase[],
  targets: CompanyMemoryAdoptionCalibrationPack["targets"],
): CompanyMemoryAdoptionSurfaceSummary {
  const averageNoMemoryAcceptanceScore = roundMetric(
    average(cases.map((item) => item.noMemory.acceptanceScore)),
  );
  const averageWithMemoryAcceptanceScore = roundMetric(
    average(cases.map((item) => item.withMemory.acceptanceScore)),
  );
  const averageNoMemoryTimeToTrustSeconds = roundMetric(
    average(cases.map((item) => item.noMemory.timeToTrustSeconds)),
  );
  const averageWithMemoryTimeToTrustSeconds = roundMetric(
    average(cases.map((item) => item.withMemory.timeToTrustSeconds)),
  );
  const acceptanceLiftPercent = toRate(
    averageWithMemoryAcceptanceScore - averageNoMemoryAcceptanceScore,
    averageNoMemoryAcceptanceScore,
  );
  const timeToTrustReductionPercent = toRate(
    averageNoMemoryTimeToTrustSeconds - averageWithMemoryTimeToTrustSeconds,
    averageNoMemoryTimeToTrustSeconds,
  );
  const reviewRequiredCases = cases.filter((item) => item.reviewRequired);
  const reviewCoveragePercent = reviewRequiredCases.length === 0
    ? 100
    : toRate(
        reviewRequiredCases.filter((item) => item.reviewCompleted).length,
        reviewRequiredCases.length,
      );
  const boundaryIncidentCount = cases.reduce((total, item) => total + item.boundaryIncidentCount, 0);
  const failedCaseIds = cases
    .filter((item) => (item.reviewRequired && !item.reviewCompleted) || item.boundaryIncidentCount > 0)
    .map((item) => item.id);
  const passed =
    acceptanceLiftPercent >= targets.minimumAcceptanceLiftPercent &&
    timeToTrustReductionPercent >= targets.minimumTimeToTrustReductionPercent &&
    reviewCoveragePercent >= targets.minimumReviewCoveragePercent &&
    boundaryIncidentCount <= targets.maximumBoundaryIncidentCount &&
    failedCaseIds.length === 0;

  return {
    surface,
    totalCases: cases.length,
    averageNoMemoryAcceptanceScore,
    averageWithMemoryAcceptanceScore,
    acceptanceLiftPercent,
    averageNoMemoryTimeToTrustSeconds,
    averageWithMemoryTimeToTrustSeconds,
    timeToTrustReductionPercent,
    reviewCoveragePercent,
    boundaryIncidentCount,
    passed,
    failedCaseIds,
  };
}

function resolveAdoptionFailures(
  surfaces: CompanyMemoryAdoptionSurfaceSummary[],
  benchmarkCaseIds: Set<string>,
  adoptionCases: CompanyMemoryAdoptionCalibrationCase[],
  targets: CompanyMemoryAdoptionCalibrationPack["targets"],
): CompanyMemoryAdoptionFailure[] {
  const failures: CompanyMemoryAdoptionFailure[] = [];

  for (const item of adoptionCases) {
    if (!benchmarkCaseIds.has(item.linkedBenchmarkCaseId)) {
      failures.push({
        caseId: item.id,
        surface: item.surface,
        reason: `missing_linked_benchmark_case:${item.linkedBenchmarkCaseId}`,
      });
    }

    if (item.reviewRequired && !item.reviewCompleted) {
      failures.push({
        caseId: item.id,
        surface: item.surface,
        reason: "review_required_but_not_completed",
      });
    }

    if (item.boundaryIncidentCount > targets.maximumBoundaryIncidentCount) {
      failures.push({
        caseId: item.id,
        surface: item.surface,
        reason: `boundary_incident_count:${item.boundaryIncidentCount}`,
      });
    }
  }

  for (const surface of surfaces) {
    if (surface.acceptanceLiftPercent < targets.minimumAcceptanceLiftPercent) {
      failures.push({
        caseId: "__surface__",
        surface: surface.surface,
        reason: `acceptance_lift_below_target:${surface.acceptanceLiftPercent}`,
      });
    }

    if (surface.timeToTrustReductionPercent < targets.minimumTimeToTrustReductionPercent) {
      failures.push({
        caseId: "__surface__",
        surface: surface.surface,
        reason: `time_to_trust_reduction_below_target:${surface.timeToTrustReductionPercent}`,
      });
    }

    if (surface.reviewCoveragePercent < targets.minimumReviewCoveragePercent) {
      failures.push({
        caseId: "__surface__",
        surface: surface.surface,
        reason: `review_coverage_below_target:${surface.reviewCoveragePercent}`,
      });
    }
  }

  return failures;
}

export function runCompanyMemoryFixtureEval(
  fixturePack: CompanyMemoryFixturePack = companyMemoryFixtures as CompanyMemoryFixturePack,
): CompanyMemoryFixtureEvalSummary {
  const cases = fixturePack.cases ?? [];
  const distribution = resolveDistribution(cases);
  const caseFailures = cases.flatMap(evaluateCase);
  const failures = [...distribution.failures, ...caseFailures];
  const layers = summarizeLayers(cases, caseFailures);
  const distributionPassed = distribution.failures.length === 0 && cases.length === 50;

  return {
    passed: distributionPassed && layers.every((layer) => layer.failedCaseIds.length === 0),
    totalCases: cases.length,
    distribution: {
      expected: COMPANY_MEMORY_EXPECTED_DISTRIBUTION,
      actual: distribution.actual,
      passed: distributionPassed,
    },
    layers,
    failureModes: summarizeFailureModes(failures),
    failures,
  };
}

export function runCompanyMemoryFourArmEval(
  fixturePack: CompanyMemoryFixturePack = companyMemoryFixtures as CompanyMemoryFixturePack,
  payloadPack: CompanyMemoryRedactedPayloadPack = redactedPayloadPack as CompanyMemoryRedactedPayloadPack,
): CompanyMemoryFourArmEvalSummary {
  const cases = fixturePack.cases ?? [];
  const payloadRefAllowlist = new Set(payloadPack.payloadRefAllowlist);
  const expectedPayloadRefs = resolveUniquePayloadRefs(cases);
  const missingPayloadRefs = expectedPayloadRefs.filter((ref) => !payloadRefAllowlist.has(ref));
  const failures: CompanyMemoryFourArmFailure[] = missingPayloadRefs.map((ref) => ({
    caseId: "__payload_pack__",
    reason: `missing_payload_ref:${ref}`,
  }));

  for (const item of cases) {
    for (const event of item.sourceEvents) {
      if (!payloadPack.tokenEstimatesBySourceType[event.sourceType]) {
        failures.push({
          caseId: item.id,
          reason: `missing_token_estimate_for_source_type:${event.sourceType}`,
        });
      }
    }
  }

  const caseResults = cases.flatMap((item) =>
    (Object.keys(ARM_LABELS) as CompanyMemoryArmId[]).map((armId) =>
      resolveArmCaseResult(item, armId, payloadPack),
    ),
  );
  const arms = (Object.keys(ARM_LABELS) as CompanyMemoryArmId[]).map((armId) =>
    summarizeArm(armId, caseResults, payloadPack.tokenUnitCost),
  );
  const economics = summarizeEconomics(arms);
  const currentRetrievalPack = findArmSummary(arms, "current_retrieval_pack");

  if (currentRetrievalPack.failedCaseIds.length > 0) {
    failures.push(
      ...currentRetrievalPack.failedCaseIds.map((caseId) => ({
        caseId,
        armId: "current_retrieval_pack" as const,
        reason: "current_retrieval_pack_quality_or_boundary_failed",
      })),
    );
  }

  if (!economics.passed) {
    failures.push({
      caseId: "__economics__",
      reason: "economics_baseline_failed",
    });
  }

  return {
    passed: failures.length === 0,
    totalCases: cases.length,
    payloadRefs: {
      expected: expectedPayloadRefs.length,
      allowlisted: payloadPack.payloadRefAllowlist.length,
      missing: missingPayloadRefs,
    },
    arms,
    economics,
    failures,
  };
}

export function runCompanyMemoryWorldModelEval(
  fixturePack: CompanyMemoryFixturePack = companyMemoryFixtures as CompanyMemoryFixturePack,
  targetPack: CompanyMemoryObjectGraphTargetPack = objectGraphHealthTargets as CompanyMemoryObjectGraphTargetPack,
): CompanyMemoryWorldModelEvalSummary {
  const cases = fixturePack.cases ?? [];
  const targets = targetPack.targets ?? [];
  const profiles = buildObjectProfiles(cases);
  const targetResults = targets.map((target) =>
    evaluateObjectGraphTarget(target, profiles.get(objectRefKey(target.objectRef)), targetPack.asOf),
  );
  const metrics = summarizeObjectGraphMetrics(targets.length, targetResults);
  const failures = targetResults.flatMap((result) => result.failures);
  const topMemoryGaps = targetResults
    .map((result) => result.gap)
    .sort((left, right) => right.gapScore - left.gapScore || left.objectRef.localeCompare(right.objectRef))
    .slice(0, COMPANY_MEMORY_MAX_TOP_MEMORY_GAPS);

  return {
    passed: failures.length === 0,
    asOf: targetPack.asOf,
    totalTargets: targets.length,
    observedObjects: profiles.size,
    metrics,
    topMemoryGaps,
    failures,
  };
}

export function runCompanyMemoryAdoptionEval(
  fixturePack: CompanyMemoryFixturePack = companyMemoryFixtures as CompanyMemoryFixturePack,
  adoptionPack: CompanyMemoryAdoptionCalibrationPack = productAdoptionCalibration as CompanyMemoryAdoptionCalibrationPack,
): CompanyMemoryAdoptionEvalSummary {
  const adoptionCases = adoptionPack.cases ?? [];
  const benchmarkCaseIds = new Set((fixturePack.cases ?? []).map((item) => item.id));
  const surfaces = (["ask_helm", "must_push", "briefing"] as CompanyMemoryAdoptionSurface[]).map((surface) =>
    summarizeAdoptionCases(
      surface,
      adoptionCases.filter((item) => item.surface === surface),
      adoptionPack.targets,
    ),
  );
  const overallNoMemoryAcceptanceScore = average(adoptionCases.map((item) => item.noMemory.acceptanceScore));
  const overallWithMemoryAcceptanceScore = average(adoptionCases.map((item) => item.withMemory.acceptanceScore));
  const overallNoMemoryTimeToTrustSeconds = average(adoptionCases.map((item) => item.noMemory.timeToTrustSeconds));
  const overallWithMemoryTimeToTrustSeconds = average(adoptionCases.map((item) => item.withMemory.timeToTrustSeconds));
  const reviewRequiredCases = adoptionCases.filter((item) => item.reviewRequired);
  const reviewCoveragePercent = reviewRequiredCases.length === 0
    ? 100
    : toRate(
        reviewRequiredCases.filter((item) => item.reviewCompleted).length,
        reviewRequiredCases.length,
      );
  const boundaryIncidentCount = adoptionCases.reduce((total, item) => total + item.boundaryIncidentCount, 0);
  const failures = resolveAdoptionFailures(surfaces, benchmarkCaseIds, adoptionCases, adoptionPack.targets);

  return {
    passed: failures.length === 0 && surfaces.every((surface) => surface.passed),
    totalCases: adoptionCases.length,
    surfaces,
    overall: {
      acceptanceLiftPercent: toRate(
        overallWithMemoryAcceptanceScore - overallNoMemoryAcceptanceScore,
        overallNoMemoryAcceptanceScore,
      ),
      timeToTrustReductionPercent: toRate(
        overallNoMemoryTimeToTrustSeconds - overallWithMemoryTimeToTrustSeconds,
        overallNoMemoryTimeToTrustSeconds,
      ),
      reviewCoveragePercent,
      boundaryIncidentCount,
    },
    failures,
  };
}
