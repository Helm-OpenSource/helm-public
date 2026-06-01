import actionOutcomeCases from "@/evals/intelligence-growth/action-outcome/action-outcome-cases.json";
import contextCases from "@/evals/intelligence-growth/context/context-growth-cases.json";
import costModelToolCases from "@/evals/intelligence-growth/cost-model-tool/cost-model-tool-cases.json";
import evalReplayCases from "@/evals/intelligence-growth/eval-replay/eval-replay-growth-cases.json";
import memoryCases from "@/evals/intelligence-growth/memory/memory-growth-cases.json";
import objectSignalCases from "@/evals/intelligence-growth/object-signal/object-signal-growth-cases.json";
import promptPolicyCases from "@/evals/intelligence-growth/prompt-policy/prompt-policy-growth-cases.json";
import routingCases from "@/evals/intelligence-growth/routing/routing-growth-cases.json";
import tenantPersonalizationCases from "@/evals/intelligence-growth/tenant-personalization/tenant-personalization-cases.json";
import workerSkillCases from "@/evals/intelligence-growth/worker-skill/worker-skill-growth-cases.json";
import decisionOutcomeFixtureData from "@/evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json";
import learningRequeueFixtureData from "@/evals/intelligence-growth-learning-requeue/learning-requeue-cases.json";
import tenantSignalFixtureData from "@/evals/intelligence-growth-tenant-signals/tenant-signal-cases.json";
import type {
  IntelligenceGrowthDecisionOutcomeFixture,
  IntelligenceGrowthDecisionOutcomeRecord,
} from "@/lib/evals/intelligence-growth-decision-outcome-evals";
import type {
  IntelligenceGrowthLearningRequeueCandidate,
  IntelligenceGrowthLearningRequeueFixture,
} from "@/lib/evals/intelligence-growth-learning-requeue-evals";
import type {
  IntelligenceGrowthTenantSignalCase,
  IntelligenceGrowthTenantSignalFixturePack,
} from "@/lib/evals/intelligence-growth-tenant-signal-evals";
import type {
  GrowthDecision,
  IntelligenceDimension,
  NoGoBoundary,
} from "@/lib/intelligence-growth/types";

const TENANT_KEY = "helm-business-development";
const WORKSPACE_ID = "workspace_helm_business_development";
const SOURCE_WINDOW_KEY = "2026-W18";
const NEXT_WINDOW_KEY = "2026-W19";

const INTELLIGENCE_DIMENSIONS: readonly IntelligenceDimension[] = [
  "context",
  "object_signal",
  "memory",
  "routing",
  "action_outcome",
  "worker_skill",
  "prompt_policy",
  "eval_replay",
  "tenant_personalization",
  "cost_model_tool",
];

const VALID_GROWTH_DECISIONS: ReadonlySet<GrowthDecision> = new Set([
  "learning_candidate",
  "watch_only",
  "review_required",
  "rejected",
]);

const VALID_NO_GO_BOUNDARIES: ReadonlySet<NoGoBoundary> = new Set([
  "no_db_schema",
  "no_api",
  "no_ui",
  "no_production_prompt_change",
  "no_runtime_self_learning",
]);

export type IntelligenceGrowthCoreFixtureCase = {
  readonly id: string;
  readonly dimension: IntelligenceDimension;
  readonly description: string;
  readonly input: {
    readonly dimension: IntelligenceDimension;
    readonly evalRunId: string;
    readonly workspaceId: string;
    readonly evidenceRefs: readonly {
      readonly type: string;
      readonly id: string;
      readonly timestamp?: string;
    }[];
    readonly contextSnapshot?: { readonly workspaceId: string };
    readonly objectRef?: { readonly workspaceId: string };
    readonly workerRef?: { readonly workspaceId: string };
  };
  readonly expected: {
    readonly decision: GrowthDecision;
    readonly boundaryViolations: readonly NoGoBoundary[];
  };
  readonly isNegativeBoundary: boolean;
};

export type IntelligenceGrowthFixtureLintInput = {
  readonly coreFixtures?: Partial<Record<IntelligenceDimension, readonly IntelligenceGrowthCoreFixtureCase[]>>;
  readonly tenantSignalFixture?: IntelligenceGrowthTenantSignalFixturePack;
  readonly decisionOutcomeFixture?: IntelligenceGrowthDecisionOutcomeFixture;
  readonly learningRequeueFixture?: IntelligenceGrowthLearningRequeueFixture;
};

export type IntelligenceGrowthFixtureLintSummary = {
  readonly passed: boolean;
  readonly coreFixtureCaseCount: number;
  readonly expectedCoreFixtureCaseCount: number;
  readonly coreDimensionCount: number;
  readonly tenantSignalCaseCount: number;
  readonly decisionOutcomeRecordCount: number;
  readonly learningRequeueCandidateCount: number;
  readonly duplicateIdCount: number;
  readonly missingIdCount: number;
  readonly invalidDimensionCount: number;
  readonly invalidDecisionCount: number;
  readonly invalidBoundaryViolationCount: number;
  readonly missingEvidenceCount: number;
  readonly missingOwnerCount: number;
  readonly missingBoundaryNoteCount: number;
  readonly scopeMismatchCount: number;
  readonly windowMismatchCount: number;
  readonly orphanReviewPacketReferenceCount: number;
  readonly orphanDecisionReferenceCount: number;
  readonly orphanRequeueReferenceCount: number;
  readonly missingRequeueCandidateCount: number;
  readonly unauthorizedFlagCount: number;
  readonly rawCustomerDataIncidentCount: number;
  readonly failures: readonly { readonly fixtureId: string; readonly reason: string }[];
};

const DEFAULT_CORE_FIXTURES: Record<IntelligenceDimension, readonly IntelligenceGrowthCoreFixtureCase[]> = {
  context: contextCases as readonly IntelligenceGrowthCoreFixtureCase[],
  object_signal: objectSignalCases as readonly IntelligenceGrowthCoreFixtureCase[],
  memory: memoryCases as readonly IntelligenceGrowthCoreFixtureCase[],
  routing: routingCases as readonly IntelligenceGrowthCoreFixtureCase[],
  action_outcome: actionOutcomeCases as readonly IntelligenceGrowthCoreFixtureCase[],
  worker_skill: workerSkillCases as readonly IntelligenceGrowthCoreFixtureCase[],
  prompt_policy: promptPolicyCases as readonly IntelligenceGrowthCoreFixtureCase[],
  eval_replay: evalReplayCases as readonly IntelligenceGrowthCoreFixtureCase[],
  tenant_personalization: tenantPersonalizationCases as readonly IntelligenceGrowthCoreFixtureCase[],
  cost_model_tool: costModelToolCases as readonly IntelligenceGrowthCoreFixtureCase[],
};

export function runIntelligenceGrowthFixtureLintEval(
  input: IntelligenceGrowthFixtureLintInput = {},
): IntelligenceGrowthFixtureLintSummary {
  const coreFixtures = {
    ...DEFAULT_CORE_FIXTURES,
    ...(input.coreFixtures ?? {}),
  };
  const tenantSignalFixture =
    input.tenantSignalFixture ?? (tenantSignalFixtureData as IntelligenceGrowthTenantSignalFixturePack);
  const decisionOutcomeFixture =
    input.decisionOutcomeFixture ?? (decisionOutcomeFixtureData as IntelligenceGrowthDecisionOutcomeFixture);
  const learningRequeueFixture =
    input.learningRequeueFixture ?? (learningRequeueFixtureData as IntelligenceGrowthLearningRequeueFixture);

  const failures: { fixtureId: string; reason: string }[] = [];
  const ids = new Map<string, string[]>();
  const tenantSignalIds = new Set<string>();
  const reviewPacketIds = new Set<string>();
  const nextLearningCandidateIds = new Set<string>();
  const learningRequeueCandidateIds = new Set<string>();

  let coreFixtureCaseCount = 0;

  for (const dimension of INTELLIGENCE_DIMENSIONS) {
    const cases = coreFixtures[dimension] ?? [];
    if (cases.length !== 8) {
      failures.push({ fixtureId: `core:${dimension}`, reason: `core_case_count:${cases.length}` });
    }

    for (const item of cases) {
      coreFixtureCaseCount += 1;
      registerId(ids, item.id, `core:${dimension}`);
      validateCoreFixtureCase(item, dimension, failures);
    }
  }

  for (const item of tenantSignalFixture.cases) {
    tenantSignalIds.add(item.id);
    registerId(ids, item.id, "tenant_signal");
    validateTenantSignalCase(item, failures);
  }

  for (const record of decisionOutcomeFixture.records) {
    reviewPacketIds.add(record.packetId);
    if (record.nextLearningCandidateId) {
      nextLearningCandidateIds.add(record.nextLearningCandidateId);
    }
    registerId(ids, record.packetId, "decision_outcome");
    validateDecisionOutcomeRecord(record, tenantSignalIds, failures);
  }

  for (const candidate of learningRequeueFixture.candidates) {
    learningRequeueCandidateIds.add(candidate.candidateId);
    registerId(ids, candidate.candidateId, "learning_requeue");
    validateLearningRequeueCandidate(candidate, reviewPacketIds, nextLearningCandidateIds, failures);
  }

  for (const candidateId of nextLearningCandidateIds) {
    if (!learningRequeueCandidateIds.has(candidateId)) {
      failures.push({ fixtureId: candidateId, reason: "missing_requeue_candidate" });
    }
  }

  for (const [id, locations] of ids.entries()) {
    if (!isNonEmptyString(id)) {
      failures.push({ fixtureId: "__all__", reason: "missing_id" });
    }
    if (locations.length > 1) {
      failures.push({ fixtureId: id, reason: `duplicate_id:${locations.join(",")}` });
    }
  }

  const uniqueFailures = deduplicateFailures(failures);

  return {
    passed: uniqueFailures.length === 0,
    coreFixtureCaseCount,
    expectedCoreFixtureCaseCount: INTELLIGENCE_DIMENSIONS.length * 8,
    coreDimensionCount: new Set(
      INTELLIGENCE_DIMENSIONS.filter((dimension) => (coreFixtures[dimension] ?? []).length > 0),
    ).size,
    tenantSignalCaseCount: tenantSignalFixture.cases.length,
    decisionOutcomeRecordCount: decisionOutcomeFixture.records.length,
    learningRequeueCandidateCount: learningRequeueFixture.candidates.length,
    duplicateIdCount: uniqueFailures.filter((failure) => failure.reason.startsWith("duplicate_id")).length,
    missingIdCount: uniqueFailures.filter((failure) => failure.reason === "missing_id").length,
    invalidDimensionCount: uniqueFailures.filter((failure) => failure.reason.startsWith("invalid_dimension")).length,
    invalidDecisionCount: uniqueFailures.filter((failure) => failure.reason.startsWith("invalid_decision")).length,
    invalidBoundaryViolationCount: uniqueFailures.filter((failure) =>
      failure.reason.startsWith("invalid_boundary_violation"),
    ).length,
    missingEvidenceCount: uniqueFailures.filter((failure) => failure.reason === "missing_evidence").length,
    missingOwnerCount: uniqueFailures.filter((failure) => failure.reason === "missing_owner").length,
    missingBoundaryNoteCount: uniqueFailures.filter((failure) => failure.reason === "missing_boundary_note").length,
    scopeMismatchCount: uniqueFailures.filter((failure) => failure.reason === "scope_mismatch").length,
    windowMismatchCount: uniqueFailures.filter((failure) => failure.reason === "window_mismatch").length,
    orphanReviewPacketReferenceCount: uniqueFailures.filter((failure) =>
      failure.reason === "orphan_review_packet_reference",
    ).length,
    orphanDecisionReferenceCount: uniqueFailures.filter((failure) =>
      failure.reason === "orphan_decision_reference",
    ).length,
    orphanRequeueReferenceCount: uniqueFailures.filter((failure) =>
      failure.reason === "orphan_requeue_reference",
    ).length,
    missingRequeueCandidateCount: uniqueFailures.filter((failure) =>
      failure.reason === "missing_requeue_candidate",
    ).length,
    unauthorizedFlagCount: uniqueFailures.filter((failure) => failure.reason === "unauthorized_flag").length,
    rawCustomerDataIncidentCount: uniqueFailures.filter((failure) =>
      failure.reason === "raw_customer_data_incident",
    ).length,
    failures: uniqueFailures,
  };
}

function validateCoreFixtureCase(
  item: IntelligenceGrowthCoreFixtureCase,
  expectedDimension: IntelligenceDimension,
  failures: { fixtureId: string; reason: string }[],
): void {
  pushFailure(failures, !isNonEmptyString(item.id), item.id || "__core__", "missing_id");
  pushFailure(
    failures,
    item.dimension !== expectedDimension || item.input.dimension !== expectedDimension,
    item.id,
    `invalid_dimension:${item.dimension}:${item.input.dimension}:${expectedDimension}`,
  );
  pushFailure(
    failures,
    !VALID_GROWTH_DECISIONS.has(item.expected.decision),
    item.id,
    `invalid_decision:${item.expected.decision}`,
  );
  const missingEvidenceIsContainedNegativeCase =
    item.isNegativeBoundary &&
    item.expected.decision === "rejected" &&
    item.input.evidenceRefs.length === 0;
  pushFailure(
    failures,
    item.input.evidenceRefs.length === 0 && !missingEvidenceIsContainedNegativeCase,
    item.id,
    "missing_evidence",
  );
  pushFailure(failures, !isNonEmptyString(item.input.evalRunId), item.id, "missing_eval_run_id");
  pushFailure(failures, !isNonEmptyString(item.input.workspaceId), item.id, "missing_workspace");

  for (const boundary of item.expected.boundaryViolations) {
    pushFailure(
      failures,
      !VALID_NO_GO_BOUNDARIES.has(boundary),
      item.id,
      `invalid_boundary_violation:${boundary}`,
    );
  }

  const nestedWorkspaceIds = [
    item.input.contextSnapshot?.workspaceId,
    item.input.objectRef?.workspaceId,
    item.input.workerRef?.workspaceId,
  ].filter((value): value is string => value !== undefined);
  for (const nestedWorkspaceId of nestedWorkspaceIds) {
    pushFailure(
      failures,
      nestedWorkspaceId !== item.input.workspaceId,
      item.id,
      "scope_mismatch",
    );
  }
}

function validateTenantSignalCase(
  item: IntelligenceGrowthTenantSignalCase,
  failures: { fixtureId: string; reason: string }[],
): void {
  pushFailure(failures, !INTELLIGENCE_DIMENSIONS.includes(item.dimension), item.id, `invalid_dimension:${item.dimension}`);
  pushFailure(failures, item.evidenceRefs.length < 2, item.id, "missing_evidence");
  pushFailure(failures, !isNonEmptyString(item.ownerAlias), item.id, "missing_owner");
  pushFailure(failures, !isNonEmptyString(item.boundaryNote), item.id, "missing_boundary_note");
  const unsafeRequestsAreContained =
    item.unsafeActionRequests.length > 0 &&
    item.expectedFinalDisposition === "review_required" &&
    item.expectedAudienceDecision === "review_first" &&
    !item.expectedOutputs.mustPushItem;
  pushFailure(
    failures,
    item.unsafeActionRequests.length > 0 && !unsafeRequestsAreContained,
    item.id,
    "unauthorized_flag",
  );
  pushFailure(
    failures,
    !item.expectedOutputs.learningCandidate,
    item.id,
    "missing_learning_candidate_output",
  );
}

function validateDecisionOutcomeRecord(
  record: IntelligenceGrowthDecisionOutcomeRecord,
  tenantSignalIds: ReadonlySet<string>,
  failures: { fixtureId: string; reason: string }[],
): void {
  const sourceCaseId = record.packetId.split(":").at(-1) ?? "";
  pushFailure(failures, !tenantSignalIds.has(sourceCaseId), record.packetId, "orphan_review_packet_reference");
  pushFailure(
    failures,
    record.tenantKey !== TENANT_KEY ||
      record.workspaceId !== WORKSPACE_ID,
    record.packetId,
    "scope_mismatch",
  );
  pushFailure(failures, record.sourceWindowKey !== SOURCE_WINDOW_KEY, record.packetId, "window_mismatch");
  pushFailure(failures, record.evidenceRefs.length < 2, record.packetId, "missing_evidence");
  pushFailure(failures, !isNonEmptyString(record.decisionOwnerAlias), record.packetId, "missing_owner");
  pushFailure(failures, !isNonEmptyString(record.boundaryNote), record.packetId, "missing_boundary_note");
  pushFailure(
    failures,
    record.productionChangeRequested ||
      record.officialWriteRequested ||
      record.autoExecutionRequested ||
      record.canonicalMemoryWriteRequested ||
      record.promptOrPolicyUpdateRequested,
    record.packetId,
    "unauthorized_flag",
  );
  pushFailure(failures, record.rawCustomerDataIncluded, record.packetId, "raw_customer_data_incident");
}

function validateLearningRequeueCandidate(
  candidate: IntelligenceGrowthLearningRequeueCandidate,
  reviewPacketIds: ReadonlySet<string>,
  nextLearningCandidateIds: ReadonlySet<string>,
  failures: { fixtureId: string; reason: string }[],
): void {
  pushFailure(
    failures,
    !reviewPacketIds.has(candidate.sourceDecisionPacketId),
    candidate.candidateId,
    "orphan_decision_reference",
  );
  pushFailure(
    failures,
    !nextLearningCandidateIds.has(candidate.candidateId),
    candidate.candidateId,
    "orphan_requeue_reference",
  );
  pushFailure(
    failures,
    candidate.tenantKey !== TENANT_KEY ||
      candidate.workspaceId !== WORKSPACE_ID,
    candidate.candidateId,
    "scope_mismatch",
  );
  pushFailure(
    failures,
    candidate.sourceWindowKey !== SOURCE_WINDOW_KEY ||
      candidate.nextWindowKey !== NEXT_WINDOW_KEY,
    candidate.candidateId,
    "window_mismatch",
  );
  pushFailure(failures, candidate.evidenceRefs.length < 2, candidate.candidateId, "missing_evidence");
  pushFailure(failures, !isNonEmptyString(candidate.decisionOwnerAlias), candidate.candidateId, "missing_owner");
  pushFailure(failures, !isNonEmptyString(candidate.boundaryNote), candidate.candidateId, "missing_boundary_note");
  pushFailure(
    failures,
    candidate.productionChangeRequested ||
      candidate.officialWriteRequested ||
      candidate.autoExecutionRequested ||
      candidate.canonicalMemoryWriteRequested ||
      candidate.promptOrPolicyUpdateRequested ||
      candidate.skillAutoPromotionRequested,
    candidate.candidateId,
    "unauthorized_flag",
  );
  pushFailure(failures, candidate.rawCustomerDataIncluded, candidate.candidateId, "raw_customer_data_incident");
}

function registerId(ids: Map<string, string[]>, id: string, location: string): void {
  ids.set(id, [...(ids.get(id) ?? []), location]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function pushFailure(
  failures: { fixtureId: string; reason: string }[],
  failed: boolean,
  fixtureId: string,
  reason: string,
): void {
  if (failed) {
    failures.push({ fixtureId, reason });
  }
}

function deduplicateFailures(
  failures: readonly { readonly fixtureId: string; readonly reason: string }[],
): readonly { readonly fixtureId: string; readonly reason: string }[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.fixtureId}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
