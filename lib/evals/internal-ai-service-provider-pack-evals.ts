import fixturePack from "@/evals/internal-ai-service-providers/ai-service-provider-pack-cases.json";

export type InternalAIProviderScoreFactors = {
  painStrength: number;
  paidPilotLikelihood: number;
  channelAmplificationPotential: number;
  dataReadiness: number;
  proofPotential: number;
};

export type InternalAIServiceProviderCandidate = {
  fixtureId: string;
  title: string;
  aliasId: string;
  providerType: string;
  profile: Record<string, unknown>;
  scoreFactors: InternalAIProviderScoreFactors;
  boundaryRiskTags: string[];
  evidenceRefs: string[];
  expectedDecisionBranch: string;
  expectedRank?: number;
  expectedActionTemplate: string;
  expectedChannelLevel: string;
  expectedChannelCandidateVisible: boolean;
  ownerAlias: string;
  reviewerAlias: string;
  outcomeRequiredWithinHours: number;
  safeSampleAvailable: boolean;
  safeSampleRecordCount: number;
  safeSampleBoundaryNote: string;
  acceptedReviewFirst: boolean;
  askedForAutoSend: boolean;
  askedForCrmWrite: boolean;
  askedForWorkflowTrigger: boolean;
  askedForAgentBuild: boolean;
  requiresReview: boolean;
  externalSideEffectAllowed: boolean;
  officialCommitmentAllowed: boolean;
  expectedNoGo: string[];
};

export type InternalAIServiceProviderOutcomeLedgerRow = {
  fixtureId: string;
  outcomeWindowHours: number;
  ownerAlias: string;
  reviewerAlias: string;
  expectedStatus: string;
  expectedResult: string;
  nextLearningCandidate: string;
  downgradeReason: string;
};

export type InternalAIServiceProviderFixturePack = {
  version: string;
  status: string;
  boundary: string;
  pack: {
    packId: string;
    packName: string;
    packVersion: string;
    targetTenantKey: string;
    ownershipBoundary: string;
    operatingMode: string;
    objectType: string;
    providerTypes: string[];
    profileFields: string[];
    rankingModel: {
      finalRanker: string;
      llmFinalRankingAllowed: boolean;
      weights: InternalAIProviderScoreFactors;
      riskPenalties: Record<string, number>;
    };
    actionTemplates: string[];
    channelGateLevels: string[];
    permissionSummary: {
      autoAllowed: string[];
      reviewRequired: string[];
      neverAllowed: string[];
    };
    degradationPolicy: string[];
  };
  targets: {
    candidateFixtureCount: number;
    dailyTop3Count: number;
    minimumNotSelectedRationaleCount: number;
    minimumPositiveFixtureCount: number;
    minimumNegativeOrDowngradedFixtureCount: number;
    expectedOutcomeLedgerCount: number;
    maximumAutoSendCount: number;
    maximumSilentCrmWriteCount: number;
    maximumDirectMustPushTruthCount: number;
    maximumExternalSideEffectAllowedCount: number;
    maximumOfficialCommitmentAllowedCount: number;
    maximumBoundaryAskSelectedCount: number;
    maximumConnectorRuntimeApiUiSchemaCapabilityCount: number;
    maximumRawPiiFieldCount: number;
    maximumCustomerIdentifiableTextFieldCount: number;
  };
  dailyReadoutExpectation: {
    sourceWindowKey: string;
    selectedFixtureIds: string[];
    notSelectedRationales: Array<{
      fixtureId: string;
      reasonCode: string;
      summary: string;
    }>;
  };
  outcomeLedger: InternalAIServiceProviderOutcomeLedgerRow[];
  candidates: InternalAIServiceProviderCandidate[];
};

export type InternalAIServiceProviderEvalFailure = {
  checkName: string;
  fixtureId?: string;
  reason: string;
};

export type InternalAIServiceProviderEvalCandidateResult = {
  fixtureId: string;
  priorityScore: number;
  riskPenalty: number;
  decisionBranch: string;
  rank?: number;
};

export type InternalAIServiceProviderEvalSummary = {
  passed: boolean;
  version: string;
  totalCandidates: number;
  dailyTop3Count: number;
  notSelectedRationaleCount: number;
  positiveFixtureCount: number;
  negativeOrDowngradedFixtureCount: number;
  outcomeLedgerCount: number;
  selectedSafeSampleCount: number;
  reviewFirstAcceptedSelectedCount: number;
  boundaryAskSelectedCount: number;
  externalSideEffectAllowedCount: number;
  officialCommitmentAllowedCount: number;
  autoSendNoGoCount: number;
  silentCrmWriteNoGoCount: number;
  directMustPushTruthNoGoCount: number;
  connectorRuntimeApiUiSchemaCapabilityCount: number;
  rawPiiFieldCount: number;
  customerIdentifiableTextFieldCount: number;
  candidateResults: InternalAIServiceProviderEvalCandidateResult[];
  failures: InternalAIServiceProviderEvalFailure[];
};

const REQUIRED_PROVIDER_TYPES = [
  "ai_service_provider",
  "ai_consulting_training",
  "agent_delivery_provider",
  "content_only_kol",
  "platform_builder_requester",
] as const;

const REQUIRED_PROFILE_FIELDS = [
  "aliasId",
  "providerType",
  "activeCustomerBand",
  "customerIndustryFocus",
  "deliveryModel",
  "recurringServiceSignal",
  "painStrength",
  "paidPilotLikelihood",
  "channelAmplificationPotential",
  "dataReadiness",
  "proofPotential",
  "boundaryRiskTags",
] as const;

const REQUIRED_ACTION_TEMPLATES = [
  "prepare_validation_call_brief_for_review",
  "prepare_pilot_scope_draft_for_review",
  "prepare_redacted_data_request_for_review",
  "run_pain_review",
  "downgrade_or_pause",
] as const;

const REQUIRED_CHANNEL_LEVELS = ["L0", "L1", "L2", "L3"] as const;

const REQUIRED_DEGRADATION_POLICIES = [
  "content_only_to_no_go",
  "too_small_to_downgrade",
  "platform_builder_requester_to_no_go",
  "no_data_to_watch_only",
  "free_poc_only_to_no_go",
  "no_outcome_streak_to_downgrade",
] as const;

const FORBIDDEN_ACTION_GRANTS = [
  "auto-send",
  "send customer message",
  "silent CRM write",
  "write CRM silently",
  "direct Must Push truth",
  "runtime_capability",
  "api_capability",
  "ui_capability",
  "schema_capability",
  "connector_capability",
  "LLM final ranking",
  "Pack DSL",
  "marketplace",
] as const;

const FORBIDDEN_FIELD_KEYS = [
  "name",
  "email",
  "phone",
  "address",
  "contact",
  "customername",
  "realcustomer",
  "rawpayload",
] as const;

const REVIEW_SAFE_ACTION_TEMPLATES = new Set<string>(REQUIRED_ACTION_TEMPLATES);
const FIXED_CANDIDATE_FIXTURE_COUNT = 8;
const FIXED_DAILY_TOP3_COUNT = 3;
const FIXED_OUTCOME_LEDGER_COUNT = 5;
const PROVIDER_TYPE_NO_GO = new Set<string>([
  "content_only_kol",
  "platform_builder_requester",
]);

const OUTCOME_DOWNGRADE_STATUSES = new Set([
  "rejected_at_review",
  "outcome_window_missed_to_downgrade",
]);

export function runInternalAIServiceProviderPackEval(
  pack: InternalAIServiceProviderFixturePack = fixturePack as InternalAIServiceProviderFixturePack,
): InternalAIServiceProviderEvalSummary {
  const failures: InternalAIServiceProviderEvalFailure[] = [];

  checkManifestContract(pack, failures);
  checkPermissionBoundary(pack, failures);

  const candidateResults = rankCandidates(pack);
  const top3Ids = candidateResults
    .filter((item) => item.decisionBranch === "selected_top3")
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .map((item) => item.fixtureId);

  checkFixedTargets(pack, failures);

  assertSummary(pack.candidates.length === FIXED_CANDIDATE_FIXTURE_COUNT, failures, {
    checkName: "candidate_fixture_count",
    reason: `Expected ${FIXED_CANDIDATE_FIXTURE_COUNT} candidates, found ${pack.candidates.length}.`,
  });
  assertSummary(top3Ids.length === FIXED_DAILY_TOP3_COUNT, failures, {
    checkName: "daily_top3_count",
    reason: `Expected ${FIXED_DAILY_TOP3_COUNT} selected candidates, found ${top3Ids.length}.`,
  });
  assertSummary(sameStringArray(top3Ids, pack.dailyReadoutExpectation.selectedFixtureIds), failures, {
    checkName: "daily_top3_selection",
    reason: `Selected fixture ids ${top3Ids.join(",")} did not match expectation ${pack.dailyReadoutExpectation.selectedFixtureIds.join(",")}.`,
  });
  assertSummary(
    pack.dailyReadoutExpectation.notSelectedRationales.length >= pack.targets.minimumNotSelectedRationaleCount,
    failures,
    {
      checkName: "not_selected_rationale_count",
      reason: `Expected at least ${pack.targets.minimumNotSelectedRationaleCount} not-selected rationales.`,
    },
  );

  checkCandidates(pack, candidateResults, failures);
  checkNotSelectedRationales(pack, failures);
  checkOutcomeLedger(pack, candidateResults, failures);

  const noGoRows = [
    pack.boundary,
    ...pack.pack.permissionSummary.neverAllowed,
    ...pack.pack.degradationPolicy,
    ...pack.candidates.flatMap((item) => item.expectedNoGo),
  ];
  const autoSendNoGoCount = countMatching(noGoRows, ["auto-send", "no_auto_send", "send customer message"]);
  const silentCrmWriteNoGoCount = countMatching(noGoRows, ["silent CRM write", "no_silent_crm_write", "write CRM silently"]);
  const directMustPushTruthNoGoCount = countMatching(noGoRows, ["direct Must Push truth", "create direct Must Push truth"]);
  const capabilityGrantRows = [
    ...pack.pack.permissionSummary.autoAllowed,
    ...pack.pack.permissionSummary.reviewRequired,
  ];
  const connectorRuntimeApiUiSchemaCapabilityCount = countMatching(capabilityGrantRows, [
    "runtime_capability",
    "api_capability",
    "ui_capability",
    "schema_capability",
    "connector_capability",
  ]);
  const piiCounts = countForbiddenFields(pack);
  const positiveFixtureCount = pack.candidates.filter((item) => item.expectedDecisionBranch === "selected_top3").length;
  const negativeOrDowngradedFixtureCount = pack.candidates.filter((item) =>
    ["no_go", "watch_only"].includes(item.expectedDecisionBranch),
  ).length;
  const selectedCandidates = pack.candidates.filter((item) => item.expectedDecisionBranch === "selected_top3");
  const selectedSafeSampleCount = selectedCandidates.filter(
    (item) => item.safeSampleAvailable && item.safeSampleRecordCount > 0,
  ).length;
  const reviewFirstAcceptedSelectedCount = selectedCandidates.filter((item) => item.acceptedReviewFirst).length;
  const boundaryAskSelectedCount = selectedCandidates.filter(hasBoundaryAsk).length;
  const externalSideEffectAllowedCount = pack.candidates.filter((item) => item.externalSideEffectAllowed).length;
  const officialCommitmentAllowedCount = pack.candidates.filter((item) => item.officialCommitmentAllowed).length;

  assertSummary(autoSendNoGoCount > pack.targets.maximumAutoSendCount, failures, {
    checkName: "auto_send_no_go_coverage",
    reason: "Expected explicit auto-send No-Go coverage.",
  });
  assertSummary(silentCrmWriteNoGoCount > pack.targets.maximumSilentCrmWriteCount, failures, {
    checkName: "silent_crm_write_no_go_coverage",
    reason: "Expected explicit silent CRM write No-Go coverage.",
  });
  assertSummary(directMustPushTruthNoGoCount > pack.targets.maximumDirectMustPushTruthCount, failures, {
    checkName: "direct_must_push_truth_no_go_coverage",
    reason: "Expected explicit direct Must Push truth No-Go coverage.",
  });
  assertSummary(
    connectorRuntimeApiUiSchemaCapabilityCount === pack.targets.maximumConnectorRuntimeApiUiSchemaCapabilityCount,
    failures,
    {
      checkName: "no_connector_runtime_api_ui_schema_capability",
      reason: `Found ${connectorRuntimeApiUiSchemaCapabilityCount} forbidden capability grants.`,
    },
  );
  assertSummary(piiCounts.rawPiiFieldCount === pack.targets.maximumRawPiiFieldCount, failures, {
    checkName: "no_raw_pii_fields",
    reason: `Found ${piiCounts.rawPiiFieldCount} raw PII-like fields.`,
  });
  assertSummary(
    piiCounts.customerIdentifiableTextFieldCount === pack.targets.maximumCustomerIdentifiableTextFieldCount,
    failures,
    {
      checkName: "no_customer_identifiable_text_fields",
      reason: `Found ${piiCounts.customerIdentifiableTextFieldCount} customer-identifiable text fields.`,
    },
  );
  assertSummary(positiveFixtureCount >= pack.targets.minimumPositiveFixtureCount, failures, {
    checkName: "positive_fixture_count",
    reason: `Expected at least ${pack.targets.minimumPositiveFixtureCount} positive fixtures.`,
  });
  assertSummary(negativeOrDowngradedFixtureCount >= pack.targets.minimumNegativeOrDowngradedFixtureCount, failures, {
    checkName: "negative_or_downgraded_fixture_count",
    reason: `Expected at least ${pack.targets.minimumNegativeOrDowngradedFixtureCount} negative or downgraded fixtures.`,
  });
  assertSummary(pack.outcomeLedger.length === FIXED_OUTCOME_LEDGER_COUNT, failures, {
    checkName: "outcome_ledger_count",
    reason: `Expected ${FIXED_OUTCOME_LEDGER_COUNT} outcome ledger rows, found ${pack.outcomeLedger.length}.`,
  });
  assertSummary(boundaryAskSelectedCount === pack.targets.maximumBoundaryAskSelectedCount, failures, {
    checkName: "selected_boundary_asks_blocked",
    reason: `Found ${boundaryAskSelectedCount} selected candidates with direct boundary asks.`,
  });
  assertSummary(externalSideEffectAllowedCount === pack.targets.maximumExternalSideEffectAllowedCount, failures, {
    checkName: "no_external_side_effect_authority",
    reason: `Found ${externalSideEffectAllowedCount} candidates allowing external side effects.`,
  });
  assertSummary(officialCommitmentAllowedCount === pack.targets.maximumOfficialCommitmentAllowedCount, failures, {
    checkName: "no_official_commitment_authority",
    reason: `Found ${officialCommitmentAllowedCount} candidates allowing official commitments.`,
  });

  return {
    passed: failures.length === 0,
    version: pack.version,
    totalCandidates: pack.candidates.length,
    dailyTop3Count: top3Ids.length,
    notSelectedRationaleCount: pack.dailyReadoutExpectation.notSelectedRationales.length,
    positiveFixtureCount,
    negativeOrDowngradedFixtureCount,
    outcomeLedgerCount: pack.outcomeLedger.length,
    selectedSafeSampleCount,
    reviewFirstAcceptedSelectedCount,
    boundaryAskSelectedCount,
    externalSideEffectAllowedCount,
    officialCommitmentAllowedCount,
    autoSendNoGoCount,
    silentCrmWriteNoGoCount,
    directMustPushTruthNoGoCount,
    connectorRuntimeApiUiSchemaCapabilityCount,
    rawPiiFieldCount: piiCounts.rawPiiFieldCount,
    customerIdentifiableTextFieldCount: piiCounts.customerIdentifiableTextFieldCount,
    candidateResults,
    failures,
  };
}

function checkFixedTargets(
  pack: InternalAIServiceProviderFixturePack,
  failures: InternalAIServiceProviderEvalFailure[],
) {
  const fixedTargets = [
    {
      name: "candidateFixtureCount",
      expected: FIXED_CANDIDATE_FIXTURE_COUNT,
      actual: pack.targets.candidateFixtureCount,
    },
    {
      name: "dailyTop3Count",
      expected: FIXED_DAILY_TOP3_COUNT,
      actual: pack.targets.dailyTop3Count,
    },
    {
      name: "expectedOutcomeLedgerCount",
      expected: FIXED_OUTCOME_LEDGER_COUNT,
      actual: pack.targets.expectedOutcomeLedgerCount,
    },
  ];

  for (const target of fixedTargets) {
    pushFailureIf(
      target.actual !== target.expected,
      failures,
      "fixed_contract_targets",
      `${target.name} must stay ${target.expected}; found ${target.actual}.`,
    );
  }
}

function checkManifestContract(
  pack: InternalAIServiceProviderFixturePack,
  failures: InternalAIServiceProviderEvalFailure[],
) {
  pushFailureIf(pack.status !== "offline_contract_only", failures, "manifest_contract", "Pack status must stay offline_contract_only.");
  pushFailureIf(pack.pack.targetTenantKey !== "helm-internal", failures, "manifest_contract", "Target tenant must stay helm-internal.");
  pushFailureIf(pack.pack.ownershipBoundary !== "candidate-only", failures, "manifest_contract", "Ownership boundary must stay candidate-only.");
  pushFailureIf(pack.pack.operatingMode !== "daily_top3_readout", failures, "manifest_contract", "Operating mode must stay daily_top3_readout.");
  pushFailureIf(pack.pack.rankingModel.finalRanker !== "deterministic_weighted_score", failures, "manifest_contract", "Final ranker must stay deterministic_weighted_score.");
  pushFailureIf(pack.pack.rankingModel.llmFinalRankingAllowed, failures, "manifest_contract", "LLM final ranking must stay disabled.");

  assertIncludesAll(pack.pack.providerTypes, REQUIRED_PROVIDER_TYPES, failures, "manifest_contract", "providerTypes");
  assertIncludesAll(pack.pack.profileFields, REQUIRED_PROFILE_FIELDS, failures, "manifest_contract", "profileFields");
  assertIncludesAll(pack.pack.actionTemplates, REQUIRED_ACTION_TEMPLATES, failures, "manifest_contract", "actionTemplates");
  assertIncludesAll(pack.pack.channelGateLevels, REQUIRED_CHANNEL_LEVELS, failures, "manifest_contract", "channelGateLevels");
  assertIncludesAll(pack.pack.degradationPolicy, REQUIRED_DEGRADATION_POLICIES, failures, "manifest_contract", "degradationPolicy");

  for (const actionTemplate of pack.pack.actionTemplates) {
    pushFailureIf(
      !isReviewSafeActionTemplate(actionTemplate),
      failures,
      "manifest_contract",
      `Action template is not review-safe: ${actionTemplate}.`,
    );
  }
}

function checkPermissionBoundary(
  pack: InternalAIServiceProviderFixturePack,
  failures: InternalAIServiceProviderEvalFailure[],
) {
  for (const grant of [...pack.pack.permissionSummary.autoAllowed, ...pack.pack.permissionSummary.reviewRequired]) {
    for (const forbidden of FORBIDDEN_ACTION_GRANTS) {
      pushFailureIf(
        normalize(grant).includes(normalize(forbidden)),
        failures,
        "permission_summary",
        `Allowed or review-required permission grants forbidden action: ${grant}.`,
      );
    }
  }
}

function checkCandidates(
  pack: InternalAIServiceProviderFixturePack,
  candidateResults: InternalAIServiceProviderEvalCandidateResult[],
  failures: InternalAIServiceProviderEvalFailure[],
) {
  const seen = new Set<string>();
  const resultById = new Map(candidateResults.map((item) => [item.fixtureId, item]));

  for (const candidate of pack.candidates) {
    pushFixtureFailureIf(seen.has(candidate.fixtureId), failures, candidate.fixtureId, "unique_fixture_id", "Duplicate candidate fixture id.");
    seen.add(candidate.fixtureId);
    pushFixtureFailureIf(!/^ai_eco_\d{3}$/.test(candidate.fixtureId), failures, candidate.fixtureId, "fixture_id_shape", "Fixture id must match ai_eco_NNN.");
    pushFixtureFailureIf(!pack.pack.providerTypes.includes(candidate.providerType), failures, candidate.fixtureId, "provider_type", `Unknown provider type: ${candidate.providerType}.`);
    pushFixtureFailureIf(candidate.evidenceRefs.length < 2, failures, candidate.fixtureId, "evidence_refs", "Candidate must include at least 2 evidence refs.");
    pushFixtureFailureIf(!pack.pack.actionTemplates.includes(candidate.expectedActionTemplate), failures, candidate.fixtureId, "action_template", `Unknown action template: ${candidate.expectedActionTemplate}.`);
    pushFixtureFailureIf(
      !isReviewSafeActionTemplate(candidate.expectedActionTemplate),
      failures,
      candidate.fixtureId,
      "action_template",
      "Action template must stay inside the review-safe whitelist.",
    );
    pushFixtureFailureIf(!pack.pack.channelGateLevels.includes(candidate.expectedChannelLevel), failures, candidate.fixtureId, "channel_level", `Unknown channel level: ${candidate.expectedChannelLevel}.`);
    pushFixtureFailureIf(candidate.expectedNoGo.length === 0, failures, candidate.fixtureId, "expected_no_go", "Candidate must include boundary No-Go rows.");
    pushFixtureFailureIf(typeof candidate.safeSampleAvailable !== "boolean", failures, candidate.fixtureId, "safe_sample", "safeSampleAvailable must be explicit.");
    pushFixtureFailureIf(!Number.isInteger(candidate.safeSampleRecordCount) || candidate.safeSampleRecordCount < 0, failures, candidate.fixtureId, "safe_sample", "safeSampleRecordCount must be a non-negative integer.");
    pushFixtureFailureIf(!candidate.safeSampleBoundaryNote, failures, candidate.fixtureId, "safe_sample", "safeSampleBoundaryNote is required.");
    pushFixtureFailureIf(typeof candidate.acceptedReviewFirst !== "boolean", failures, candidate.fixtureId, "review_first", "acceptedReviewFirst must be explicit.");
    pushFixtureFailureIf(typeof candidate.requiresReview !== "boolean", failures, candidate.fixtureId, "authority", "requiresReview must be explicit.");
    pushFixtureFailureIf(candidate.externalSideEffectAllowed, failures, candidate.fixtureId, "authority", "No candidate may allow external side effects.");
    pushFixtureFailureIf(candidate.officialCommitmentAllowed, failures, candidate.fixtureId, "authority", "No candidate may allow official commitments.");
    pushFixtureFailureIf(
      candidate.expectedDecisionBranch !== "selected_top3" && candidate.requiresReview,
      failures,
      candidate.fixtureId,
      "authority",
      "Only selected Top 3 candidates may require same-day human review.",
    );

    const result = resultById.get(candidate.fixtureId);
    pushFixtureFailureIf(!result, failures, candidate.fixtureId, "candidate_result", "Candidate is missing a computed result.");
    if (!result) {
      continue;
    }

    pushFixtureFailureIf(
      result.decisionBranch !== candidate.expectedDecisionBranch,
      failures,
      candidate.fixtureId,
      "decision_branch",
      `Expected branch ${candidate.expectedDecisionBranch}, found ${result.decisionBranch}.`,
    );
    if (candidate.expectedDecisionBranch === "selected_top3") {
      pushFixtureFailureIf(candidate.outcomeRequiredWithinHours > 72 || candidate.outcomeRequiredWithinHours <= 0, failures, candidate.fixtureId, "outcome_sla", "Selected Top 3 candidate must require outcome within 72h.");
      pushFixtureFailureIf(!candidate.ownerAlias || !candidate.reviewerAlias, failures, candidate.fixtureId, "owner_reviewer", "Selected Top 3 candidate must have owner and reviewer.");
      pushFixtureFailureIf(result.rank !== candidate.expectedRank, failures, candidate.fixtureId, "expected_rank", `Expected rank ${candidate.expectedRank}, found ${result.rank}.`);
      pushFixtureFailureIf(!candidate.safeSampleAvailable || candidate.safeSampleRecordCount <= 0, failures, candidate.fixtureId, "safe_sample", "Selected Top 3 candidate must have a safe sample path.");
      pushFixtureFailureIf(!candidate.acceptedReviewFirst, failures, candidate.fixtureId, "review_first", "Selected Top 3 candidate must explicitly accept review-first handling.");
      pushFixtureFailureIf(!candidate.requiresReview, failures, candidate.fixtureId, "authority", "Selected Top 3 candidate must require review.");
      pushFixtureFailureIf(hasBoundaryAsk(candidate), failures, candidate.fixtureId, "boundary_ask", "Candidate with auto-send / CRM write / workflow / Agent-build ask cannot be selected Top 3.");
    }

    const channelVisibleAllowed = ["L2", "L3"].includes(candidate.expectedChannelLevel);
    pushFixtureFailureIf(
      candidate.expectedChannelCandidateVisible && !channelVisibleAllowed,
      failures,
      candidate.fixtureId,
      "channel_gate",
      "Only L2/L3 channel levels may show as channel candidates.",
    );
    pushFixtureFailureIf(
      !candidate.expectedChannelCandidateVisible && channelVisibleAllowed && candidate.expectedDecisionBranch === "selected_top3",
      failures,
      candidate.fixtureId,
      "channel_gate",
      "Selected L2/L3 candidates should expose channel candidate state.",
    );
  }
}

function checkNotSelectedRationales(
  pack: InternalAIServiceProviderFixturePack,
  failures: InternalAIServiceProviderEvalFailure[],
) {
  const candidateIds = new Set(pack.candidates.map((item) => item.fixtureId));
  const top3Ids = new Set(pack.dailyReadoutExpectation.selectedFixtureIds);
  const rationaleIds = new Set(pack.dailyReadoutExpectation.notSelectedRationales.map((item) => item.fixtureId));

  for (const rationale of pack.dailyReadoutExpectation.notSelectedRationales) {
    pushFixtureFailureIf(!candidateIds.has(rationale.fixtureId), failures, rationale.fixtureId, "not_selected_rationale", "Rationale must reference a candidate fixture.");
    pushFixtureFailureIf(top3Ids.has(rationale.fixtureId), failures, rationale.fixtureId, "not_selected_rationale", "Rationale must not reference a selected Top 3 candidate.");
    pushFixtureFailureIf(!rationale.reasonCode || !rationale.summary, failures, rationale.fixtureId, "not_selected_rationale", "Rationale must include reasonCode and summary.");
  }

  for (const candidate of pack.candidates) {
    if (top3Ids.has(candidate.fixtureId)) {
      continue;
    }
    pushFixtureFailureIf(
      !rationaleIds.has(candidate.fixtureId),
      failures,
      candidate.fixtureId,
      "not_selected_rationale",
      "Every non-selected candidate must include a why-not rationale.",
    );
  }
}

function checkOutcomeLedger(
  pack: InternalAIServiceProviderFixturePack,
  candidateResults: InternalAIServiceProviderEvalCandidateResult[],
  failures: InternalAIServiceProviderEvalFailure[],
) {
  const selectedIds = new Set(candidateResults.filter((item) => item.decisionBranch === "selected_top3").map((item) => item.fixtureId));
  const resultById = new Map(candidateResults.map((item) => [item.fixtureId, item]));
  const candidateById = new Map(pack.candidates.map((item) => [item.fixtureId, item]));
  const ledgerIds = new Set<string>();

  for (const row of pack.outcomeLedger) {
    const candidate = candidateById.get(row.fixtureId);
    const result = resultById.get(row.fixtureId);
    const isDowngradeStatus = OUTCOME_DOWNGRADE_STATUSES.has(row.expectedStatus);
    pushFixtureFailureIf(!candidate, failures, row.fixtureId, "outcome_ledger", "Outcome ledger row must reference a candidate.");
    pushFixtureFailureIf(!result, failures, row.fixtureId, "outcome_ledger", "Outcome ledger row must reference a ranked candidate.");
    pushFixtureFailureIf(ledgerIds.has(row.fixtureId), failures, row.fixtureId, "outcome_ledger", "Duplicate outcome ledger row.");
    ledgerIds.add(row.fixtureId);
    pushFixtureFailureIf(
      !selectedIds.has(row.fixtureId) && !isDowngradeStatus,
      failures,
      row.fixtureId,
      "outcome_ledger",
      "Non-selected outcome ledger rows must be explicit downgrade or rejection rows.",
    );
    pushFixtureFailureIf(row.outcomeWindowHours <= 0 || row.outcomeWindowHours > 72, failures, row.fixtureId, "outcome_ledger", "Outcome ledger window must be within 72h.");
    pushFixtureFailureIf(!row.ownerAlias || !row.reviewerAlias, failures, row.fixtureId, "outcome_ledger", "Outcome ledger must include owner and reviewer aliases.");
    pushFixtureFailureIf(!row.expectedStatus || !row.expectedResult || !row.nextLearningCandidate, failures, row.fixtureId, "outcome_ledger", "Outcome ledger must include expected status, result, and next learning candidate.");
    pushFixtureFailureIf(
      !candidateById.has(row.nextLearningCandidate),
      failures,
      row.fixtureId,
      "outcome_ledger",
      "Outcome ledger nextLearningCandidate must reference a fixture id.",
    );
    pushFixtureFailureIf(
      isDowngradeStatus && !row.downgradeReason,
      failures,
      row.fixtureId,
      "outcome_ledger",
      "Downgrade or rejection outcome rows must include downgradeReason.",
    );
    pushFixtureFailureIf(
      !isDowngradeStatus && row.downgradeReason !== "",
      failures,
      row.fixtureId,
      "outcome_ledger",
      "Positive outcome rows must not include downgradeReason.",
    );
    if (candidate) {
      pushFixtureFailureIf(row.ownerAlias !== candidate.ownerAlias, failures, row.fixtureId, "outcome_ledger", "Outcome ledger owner must match selected candidate owner.");
      pushFixtureFailureIf(row.reviewerAlias !== candidate.reviewerAlias, failures, row.fixtureId, "outcome_ledger", "Outcome ledger reviewer must match selected candidate reviewer.");
    }
  }

  for (const fixtureId of selectedIds) {
    pushFixtureFailureIf(!ledgerIds.has(fixtureId), failures, fixtureId, "outcome_ledger", "Every selected Top 3 candidate must have a 72h outcome ledger row.");
  }
}

function rankCandidates(
  pack: InternalAIServiceProviderFixturePack,
): InternalAIServiceProviderEvalCandidateResult[] {
  const baseResults = pack.candidates.map((candidate) => {
    const riskPenalty = candidate.boundaryRiskTags.reduce(
      (sum, tag) => sum + (pack.pack.rankingModel.riskPenalties[tag] ?? 0),
      0,
    );
    const weightedScore =
      candidate.scoreFactors.painStrength * pack.pack.rankingModel.weights.painStrength +
      candidate.scoreFactors.paidPilotLikelihood * pack.pack.rankingModel.weights.paidPilotLikelihood +
      candidate.scoreFactors.channelAmplificationPotential *
        pack.pack.rankingModel.weights.channelAmplificationPotential +
      candidate.scoreFactors.dataReadiness * pack.pack.rankingModel.weights.dataReadiness +
      candidate.scoreFactors.proofPotential * pack.pack.rankingModel.weights.proofPotential;
    const priorityScore = roundScore(weightedScore - riskPenalty);
    return {
      fixtureId: candidate.fixtureId,
      priorityScore,
      riskPenalty,
      decisionBranch: classifyCandidate(candidate, priorityScore),
    };
  });

  const selectedIds = new Set(
    baseResults
      .filter((item) => item.decisionBranch === "eligible")
      .sort((a, b) => b.priorityScore - a.priorityScore || a.fixtureId.localeCompare(b.fixtureId))
      .slice(0, FIXED_DAILY_TOP3_COUNT)
      .map((item) => item.fixtureId),
  );

  let rank = 0;
  return baseResults
    .map((item) => {
      if (!selectedIds.has(item.fixtureId)) {
        return {
          ...item,
          decisionBranch: item.decisionBranch === "eligible" ? "watch_only" : item.decisionBranch,
        };
      }
      rank += 1;
      return {
        ...item,
        decisionBranch: "selected_top3",
        rank,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || a.fixtureId.localeCompare(b.fixtureId));
}

function classifyCandidate(
  candidate: InternalAIServiceProviderCandidate,
  priorityScore: number,
) {
  if (hasBoundaryAsk(candidate)) {
    return "no_go";
  }
  if (!candidate.acceptedReviewFirst) {
    return "no_go";
  }
  if (PROVIDER_TYPE_NO_GO.has(candidate.providerType)) {
    return "no_go";
  }
  if (
    candidate.boundaryRiskTags.includes("content_only") ||
    candidate.boundaryRiskTags.includes("platform_builder_requester") ||
    candidate.boundaryRiskTags.includes("free_poc_only")
  ) {
    return "no_go";
  }
  if (
    candidate.boundaryRiskTags.includes("zero_active_customers") ||
    candidate.boundaryRiskTags.includes("no_data_readiness") ||
    candidate.boundaryRiskTags.includes("competitor_lock_in") ||
    candidate.boundaryRiskTags.includes("no_outcome_streak") ||
    priorityScore < 55
  ) {
    return "watch_only";
  }
  return "eligible";
}

function hasBoundaryAsk(candidate: InternalAIServiceProviderCandidate) {
  return (
    candidate.askedForAutoSend ||
    candidate.askedForCrmWrite ||
    candidate.askedForWorkflowTrigger ||
    candidate.askedForAgentBuild
  );
}

function countForbiddenFields(pack: InternalAIServiceProviderFixturePack) {
  let rawPiiFieldCount = 0;
  let customerIdentifiableTextFieldCount = 0;

  for (const candidate of pack.candidates) {
    const rows: unknown[] = [
      candidate.aliasId,
      candidate.title,
      candidate.providerType,
      ...candidate.boundaryRiskTags,
      ...candidate.evidenceRefs,
      ...Object.entries(candidate.profile).flat(),
    ];
    for (const key of Object.keys(candidate.profile)) {
      if (FORBIDDEN_FIELD_KEYS.some((forbidden) => normalize(key).includes(normalize(forbidden)))) {
        customerIdentifiableTextFieldCount += 1;
      }
    }
    for (const row of rows) {
      if (typeof row !== "string") {
        continue;
      }
      if (/@/.test(row) || /\+?\d[\d\s-]{7,}\d/.test(row)) {
        rawPiiFieldCount += 1;
      }
    }
  }

  const readoutRows = [
    pack.dailyReadoutExpectation.sourceWindowKey,
    ...pack.dailyReadoutExpectation.selectedFixtureIds,
    ...pack.dailyReadoutExpectation.notSelectedRationales.flatMap((rationale) => [
      rationale.fixtureId,
      rationale.reasonCode,
      rationale.summary,
    ]),
    ...pack.outcomeLedger.flatMap((row) => [
      row.fixtureId,
      row.ownerAlias,
      row.reviewerAlias,
      row.expectedStatus,
      row.expectedResult,
      row.nextLearningCandidate,
      row.downgradeReason,
    ]),
  ];
  for (const row of readoutRows) {
    if (typeof row !== "string") {
      continue;
    }
    if (/@/.test(row) || /\+?\d[\d\s-]{7,}\d/.test(row)) {
      rawPiiFieldCount += 1;
    }
  }

  return {
    rawPiiFieldCount,
    customerIdentifiableTextFieldCount,
  };
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function isReviewSafeActionTemplate(value: string) {
  return REVIEW_SAFE_ACTION_TEMPLATES.has(value);
}

function countMatching(rows: string[], patterns: string[]) {
  return rows.filter((row) => patterns.some((pattern) => normalize(row).includes(normalize(pattern)))).length;
}

function assertSummary(
  condition: boolean,
  failures: InternalAIServiceProviderEvalFailure[],
  failure: InternalAIServiceProviderEvalFailure,
) {
  if (!condition) {
    failures.push(failure);
  }
}

function pushFailureIf(
  condition: boolean,
  failures: InternalAIServiceProviderEvalFailure[],
  checkName: string,
  reason: string,
) {
  if (condition) {
    failures.push({ checkName, reason });
  }
}

function pushFixtureFailureIf(
  condition: boolean,
  failures: InternalAIServiceProviderEvalFailure[],
  fixtureId: string,
  checkName: string,
  reason: string,
) {
  if (condition) {
    failures.push({ checkName, fixtureId, reason });
  }
}

function assertIncludesAll(
  actual: string[],
  expected: readonly string[],
  failures: InternalAIServiceProviderEvalFailure[],
  checkName: string,
  fieldName: string,
) {
  for (const item of expected) {
    pushFailureIf(!actual.includes(item), failures, checkName, `${fieldName} missing required item: ${item}.`);
  }
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
