import fixturePack from "@/evals/internal-commercialization/offer-path-cases.json";

export type InternalCommercializationStage = {
  stageId: string;
  displayName: string;
  entryCriteria: string[];
  outputs: string[];
  successMetrics: string[];
  reviewRequiredFor: string[];
  forbiddenClaims: string[];
};

export type InternalCommercializationCase = {
  caseId: string;
  aliasId: string;
  lifecycleRunId: string;
  providerAliasId: string;
  customerOpportunityAliasIds: string[];
  currentLifecycleState: string;
  nextLifecycleState: string;
  managingThroughServiceProvider: boolean;
  serviceProviderCustomerFacingOwner: boolean;
  helmDirectCustomerContactAllowed: boolean;
  stageReviewPacketRequired: boolean;
  reviewStaleHours: number;
  requiredEvidenceKinds: string[];
  channelAssessmentRequired: boolean;
  providerType: string;
  requestedCommercialPackage: string;
  commercialSignals: Record<string, unknown>;
  riskTags: string[];
  expectedOfferStage: string | null;
  expectedDecision: string;
  expectedNextAction: string;
  ownerAlias: string;
  reviewerAlias: string;
  evidenceRefs: string[];
  outcomeWindowHours: number;
  safeSampleAvailable: boolean;
  acceptedReviewFirst: boolean;
  requiresReview: boolean;
  channelGateLevel: string;
  externalSideEffectAllowed: boolean;
  officialCommitmentAllowed: boolean;
  publicClaimAllowed: boolean;
  customerVisibleWithoutReview: boolean;
  rawPiiIncluded: boolean;
};

export type InternalCommercializationFixturePack = {
  version: string;
  status: string;
  boundary: string;
  targetTenantKey: string;
  upstreamPackId: string;
  offerPath: {
    pathId: string;
    pathName: string;
    owner: string;
    operatingMode: string;
    reviewMode: string;
    allowedActions: string[];
    neverAllowed: string[];
  };
  managementLifecycle: {
    contractId: string;
    managedObjects: string[];
    states: string[];
    transitions: string[][];
    maximumPositiveReviewStaleHours: number;
    customerFacingOwner: string;
    helmDirectCustomerContactAllowed: boolean;
    requiresStageReviewPacketForPositiveCases: boolean;
  };
  targets: {
    stageCount: number;
    managedObjectCount: number;
    lifecycleStateCount: number;
    caseCount: number;
    minimumPositiveCaseCount: number;
    minimumNegativeOrWatchCaseCount: number;
    maximumExternalSideEffectAllowedCount: number;
    maximumOfficialCommitmentAllowedCount: number;
    maximumPublicClaimAllowedCount: number;
    maximumCustomerVisibleWithoutReviewCount: number;
    maximumRawPiiIncludedCount: number;
    maximumBoundaryDriftSelectedCount: number;
    maximumDirectCustomerContactAllowedCount: number;
    maximumUnmanagedPositiveCaseCount: number;
    maximumMissingReviewPacketForPositiveCount: number;
    maximumStalePositiveCaseCount: number;
  };
  stages: InternalCommercializationStage[];
  cases: InternalCommercializationCase[];
};

export type InternalCommercializationEvalFailure = {
  checkName: string;
  caseId?: string;
  reason: string;
};

export type InternalCommercializationEvalSummary = {
  passed: boolean;
  version: string;
  stageCount: number;
  caseCount: number;
  positiveCaseCount: number;
  negativeOrWatchCaseCount: number;
  stageCoverageCount: number;
  managedObjectCount: number;
  lifecycleStateCount: number;
  lifecycleTransitionCount: number;
  externalSideEffectAllowedCount: number;
  officialCommitmentAllowedCount: number;
  publicClaimAllowedCount: number;
  customerVisibleWithoutReviewCount: number;
  rawPiiIncludedCount: number;
  boundaryDriftSelectedCount: number;
  directCustomerContactAllowedCount: number;
  unmanagedPositiveCaseCount: number;
  missingReviewPacketForPositiveCount: number;
  stalePositiveCaseCount: number;
  failures: InternalCommercializationEvalFailure[];
};

const REQUIRED_STAGE_IDS = ["diagnosis_1h", "trial_7d", "pilot_4w", "closeout_report"] as const;
const REQUIRED_MANAGED_OBJECTS = [
  "service_provider_candidate",
  "customer_opportunity_alias",
  "commercialization_run",
  "stage_review_packet",
  "outcome_evidence",
  "channel_gate_assessment",
  "next_cycle_decision",
] as const;
const REQUIRED_LIFECYCLE_STATES = [
  "candidate_pool",
  "daily_top3_selected",
  "diagnosis_packet_prepared",
  "diagnosis_reviewed",
  "trial_scope_prepared",
  "trial_running",
  "trial_closeout_ready",
  "pilot_scope_prepared",
  "pilot_running",
  "pilot_closeout_ready",
  "closeout_report_prepared",
  "channel_gate_assessed",
  "next_cycle_selected",
  "data_boundary_review_required",
  "paused",
] as const;
const REVIEW_SAFE_ACTIONS = new Set([
  "prepare_diagnosis_brief_for_review",
  "prepare_trial_scope_draft_for_review",
  "prepare_pilot_scope_packet_for_review",
  "prepare_closeout_report_candidate_for_review",
  "downgrade_or_pause",
]);
const POSITIVE_DECISIONS = new Set(["prepare_diagnosis", "prepare_trial", "prepare_pilot", "prepare_closeout"]);
const NEGATIVE_OR_WATCH_DECISIONS = new Set(["no_go", "watch_only"]);
const BOUNDARY_DRIFT_PROVIDER_TYPES = new Set(["content_only_kol", "platform_builder_requester"]);
const BOUNDARY_DRIFT_RISK_TAGS = new Set(["content_only", "platform_builder_requester", "agent_platform_drift", "free_poc_only"]);
const OUTBOUND_ACTION_PATTERN = /^(send|book|publish|dispatch|write|trigger|request)_/;

export function runInternalCommercializationEval(
  pack: InternalCommercializationFixturePack = fixturePack as InternalCommercializationFixturePack,
): InternalCommercializationEvalSummary {
  const failures: InternalCommercializationEvalFailure[] = [];

  checkManifest(pack, failures);
  checkStages(pack, failures);
  checkManagementLifecycle(pack, failures);
  checkCases(pack, failures);

  const positiveCases = pack.cases.filter((item) => POSITIVE_DECISIONS.has(item.expectedDecision));
  const negativeOrWatchCases = pack.cases.filter((item) => NEGATIVE_OR_WATCH_DECISIONS.has(item.expectedDecision));
  const coveredStageIds = new Set(positiveCases.map((item) => item.expectedOfferStage).filter(Boolean));
  const externalSideEffectAllowedCount = pack.cases.filter((item) => item.externalSideEffectAllowed).length;
  const officialCommitmentAllowedCount = pack.cases.filter((item) => item.officialCommitmentAllowed).length;
  const publicClaimAllowedCount = pack.cases.filter((item) => item.publicClaimAllowed).length;
  const customerVisibleWithoutReviewCount = pack.cases.filter((item) => item.customerVisibleWithoutReview).length;
  const rawPiiIncludedCount = pack.cases.filter((item) => item.rawPiiIncluded).length;
  const directCustomerContactAllowedCount = pack.cases.filter((item) => item.helmDirectCustomerContactAllowed).length;
  const unmanagedPositiveCaseCount = positiveCases.filter(
    (item) => !item.managingThroughServiceProvider || !item.serviceProviderCustomerFacingOwner,
  ).length;
  const missingReviewPacketForPositiveCount = positiveCases.filter((item) => !item.stageReviewPacketRequired).length;
  const stalePositiveCaseCount = positiveCases.filter(
    (item) => item.reviewStaleHours > pack.managementLifecycle.maximumPositiveReviewStaleHours,
  ).length;
  const boundaryDriftSelectedCount = pack.cases.filter((item) => {
    const hasBoundaryDrift =
      BOUNDARY_DRIFT_PROVIDER_TYPES.has(item.providerType) ||
      item.riskTags.some((riskTag) => BOUNDARY_DRIFT_RISK_TAGS.has(riskTag));

    return hasBoundaryDrift && POSITIVE_DECISIONS.has(item.expectedDecision);
  }).length;

  assertSummary(positiveCases.length >= pack.targets.minimumPositiveCaseCount, failures, {
    checkName: "positive_case_count",
    reason: `Expected at least ${pack.targets.minimumPositiveCaseCount} positive cases, found ${positiveCases.length}.`,
  });
  assertSummary(negativeOrWatchCases.length >= pack.targets.minimumNegativeOrWatchCaseCount, failures, {
    checkName: "negative_or_watch_case_count",
    reason: `Expected at least ${pack.targets.minimumNegativeOrWatchCaseCount} negative/watch cases, found ${negativeOrWatchCases.length}.`,
  });
  assertSummary(coveredStageIds.size === REQUIRED_STAGE_IDS.length, failures, {
    checkName: "stage_coverage",
    reason: `Expected positive case coverage for ${REQUIRED_STAGE_IDS.join(",")}, found ${Array.from(coveredStageIds).join(",")}.`,
  });
  assertSummary(externalSideEffectAllowedCount <= pack.targets.maximumExternalSideEffectAllowedCount, failures, {
    checkName: "external_side_effect_authority",
    reason: "Commercialization cases must not grant external side-effect authority.",
  });
  assertSummary(officialCommitmentAllowedCount <= pack.targets.maximumOfficialCommitmentAllowedCount, failures, {
    checkName: "official_commitment_authority",
    reason: "Commercialization cases must not grant official commitment authority.",
  });
  assertSummary(publicClaimAllowedCount <= pack.targets.maximumPublicClaimAllowedCount, failures, {
    checkName: "public_claim_authority",
    reason: "Commercialization cases must not grant public claim authority.",
  });
  assertSummary(customerVisibleWithoutReviewCount <= pack.targets.maximumCustomerVisibleWithoutReviewCount, failures, {
    checkName: "customer_visible_without_review",
    reason: "Customer-visible commercialization artifacts must require human review.",
  });
  assertSummary(rawPiiIncludedCount <= pack.targets.maximumRawPiiIncludedCount, failures, {
    checkName: "raw_pii",
    reason: "Commercialization fixtures must stay alias-only and raw-PII-free.",
  });
  assertSummary(boundaryDriftSelectedCount <= pack.targets.maximumBoundaryDriftSelectedCount, failures, {
    checkName: "boundary_drift_selected",
    reason: "Boundary-drift candidates must not advance into positive commercialization stages.",
  });
  assertSummary(directCustomerContactAllowedCount <= pack.targets.maximumDirectCustomerContactAllowedCount, failures, {
    checkName: "direct_customer_contact_authority",
    reason: "Helm self-tenant commercialization must be managed through service providers, not direct customer contact.",
  });
  assertSummary(unmanagedPositiveCaseCount <= pack.targets.maximumUnmanagedPositiveCaseCount, failures, {
    checkName: "service_provider_management",
    reason: "Positive commercialization cases must be managed through a service provider who remains customer-facing owner.",
  });
  assertSummary(
    missingReviewPacketForPositiveCount <= pack.targets.maximumMissingReviewPacketForPositiveCount,
    failures,
    {
      checkName: "stage_review_packet",
      reason: "Positive commercialization cases must require a stage review packet.",
    },
  );
  assertSummary(stalePositiveCaseCount <= pack.targets.maximumStalePositiveCaseCount, failures, {
    checkName: "stale_positive_case",
    reason: `Positive commercialization cases must be reviewed within ${pack.managementLifecycle.maximumPositiveReviewStaleHours} hours.`,
  });

  return {
    passed: failures.length === 0,
    version: pack.version,
    stageCount: pack.stages.length,
    caseCount: pack.cases.length,
    positiveCaseCount: positiveCases.length,
    negativeOrWatchCaseCount: negativeOrWatchCases.length,
    stageCoverageCount: coveredStageIds.size,
    managedObjectCount: pack.managementLifecycle.managedObjects.length,
    lifecycleStateCount: pack.managementLifecycle.states.length,
    lifecycleTransitionCount: pack.managementLifecycle.transitions.length,
    externalSideEffectAllowedCount,
    officialCommitmentAllowedCount,
    publicClaimAllowedCount,
    customerVisibleWithoutReviewCount,
    rawPiiIncludedCount,
    boundaryDriftSelectedCount,
    directCustomerContactAllowedCount,
    unmanagedPositiveCaseCount,
    missingReviewPacketForPositiveCount,
    stalePositiveCaseCount,
    failures,
  };
}

function checkManifest(
  pack: InternalCommercializationFixturePack,
  failures: InternalCommercializationEvalFailure[],
) {
  assertSummary(pack.status === "offline_contract_only", failures, {
    checkName: "manifest",
    reason: "Internal commercialization pack must stay offline_contract_only.",
  });
  assertSummary(pack.targetTenantKey === "helm-business-development", failures, {
    checkName: "manifest",
    reason: "Internal commercialization pack must target helm-business-development.",
  });
  for (const action of REVIEW_SAFE_ACTIONS) {
    assertSummary(pack.offerPath.allowedActions.includes(action), failures, {
      checkName: "manifest",
      reason: `Missing review-safe action ${action}.`,
    });
  }
  for (const action of pack.offerPath.allowedActions) {
    assertSummary(REVIEW_SAFE_ACTIONS.has(action), failures, {
      checkName: "manifest",
      reason: `Unexpected action template ${action}.`,
    });
    assertSummary(!OUTBOUND_ACTION_PATTERN.test(action), failures, {
      checkName: "manifest",
      reason: `Outbound-looking action template ${action} is not allowed.`,
    });
  }
}

function checkStages(
  pack: InternalCommercializationFixturePack,
  failures: InternalCommercializationEvalFailure[],
) {
  const stageIds = new Set(pack.stages.map((stage) => stage.stageId));

  assertSummary(pack.stages.length === pack.targets.stageCount, failures, {
    checkName: "stage_count",
    reason: `Expected ${pack.targets.stageCount} stages, found ${pack.stages.length}.`,
  });
  for (const stageId of REQUIRED_STAGE_IDS) {
    assertSummary(stageIds.has(stageId), failures, {
      checkName: "required_stage",
      reason: `Missing required commercialization stage ${stageId}.`,
    });
  }
  for (const stage of pack.stages) {
    assertSummary(stage.entryCriteria.length > 0, failures, {
      checkName: "stage_contract",
      reason: `${stage.stageId} must define entry criteria.`,
    });
    assertSummary(stage.outputs.length > 0, failures, {
      checkName: "stage_contract",
      reason: `${stage.stageId} must define outputs.`,
    });
    assertSummary(stage.successMetrics.length > 0, failures, {
      checkName: "stage_contract",
      reason: `${stage.stageId} must define success metrics.`,
    });
    assertSummary(stage.reviewRequiredFor.length > 0, failures, {
      checkName: "stage_contract",
      reason: `${stage.stageId} must define review-required artifacts.`,
    });
    assertSummary(stage.forbiddenClaims.length > 0, failures, {
      checkName: "stage_contract",
      reason: `${stage.stageId} must define forbidden claims.`,
    });
  }
}

function checkManagementLifecycle(
  pack: InternalCommercializationFixturePack,
  failures: InternalCommercializationEvalFailure[],
) {
  const managedObjects = new Set(pack.managementLifecycle.managedObjects);
  const states = new Set(pack.managementLifecycle.states);
  const transitions = new Set(pack.managementLifecycle.transitions.map(([from, to]) => `${from}->${to}`));

  assertSummary(pack.managementLifecycle.contractId.length > 0, failures, {
    checkName: "management_lifecycle",
    reason: "Internal commercialization pack must define a management lifecycle contract.",
  });
  assertSummary(pack.managementLifecycle.managedObjects.length === pack.targets.managedObjectCount, failures, {
    checkName: "managed_object_count",
    reason: `Expected ${pack.targets.managedObjectCount} managed objects, found ${pack.managementLifecycle.managedObjects.length}.`,
  });
  assertSummary(pack.managementLifecycle.states.length === pack.targets.lifecycleStateCount, failures, {
    checkName: "lifecycle_state_count",
    reason: `Expected ${pack.targets.lifecycleStateCount} lifecycle states, found ${pack.managementLifecycle.states.length}.`,
  });
  for (const objectName of REQUIRED_MANAGED_OBJECTS) {
    assertSummary(managedObjects.has(objectName), failures, {
      checkName: "required_managed_object",
      reason: `Missing required managed object ${objectName}.`,
    });
  }
  for (const state of REQUIRED_LIFECYCLE_STATES) {
    assertSummary(states.has(state), failures, {
      checkName: "required_lifecycle_state",
      reason: `Missing required lifecycle state ${state}.`,
    });
  }
  for (const [from, to] of pack.managementLifecycle.transitions) {
    assertSummary(Boolean(from && to && states.has(from) && states.has(to)), failures, {
      checkName: "lifecycle_transition_contract",
      reason: `Transition ${from}->${to} must reference known lifecycle states.`,
    });
  }
  for (const [from, to] of [
    ["candidate_pool", "daily_top3_selected"],
    ["daily_top3_selected", "diagnosis_packet_prepared"],
    ["diagnosis_reviewed", "trial_scope_prepared"],
    ["trial_closeout_ready", "pilot_scope_prepared"],
    ["closeout_report_prepared", "channel_gate_assessed"],
    ["channel_gate_assessed", "next_cycle_selected"],
    ["daily_top3_selected", "data_boundary_review_required"],
    ["data_boundary_review_required", "paused"],
  ]) {
    assertSummary(transitions.has(`${from}->${to}`), failures, {
      checkName: "required_lifecycle_transition",
      reason: `Missing required lifecycle transition ${from}->${to}.`,
    });
  }
  assertSummary(pack.managementLifecycle.customerFacingOwner === "service_provider", failures, {
    checkName: "management_lifecycle",
    reason: "Service provider must remain the customer-facing owner in this commercialization motion.",
  });
  assertSummary(!pack.managementLifecycle.helmDirectCustomerContactAllowed, failures, {
    checkName: "management_lifecycle",
    reason: "Helm direct customer contact must remain disabled for this offline contract.",
  });
  assertSummary(pack.managementLifecycle.requiresStageReviewPacketForPositiveCases, failures, {
    checkName: "management_lifecycle",
    reason: "Positive cases must require stage review packets.",
  });
}

function checkCases(
  pack: InternalCommercializationFixturePack,
  failures: InternalCommercializationEvalFailure[],
) {
  const stageIds = new Set(pack.stages.map((stage) => stage.stageId));
  const lifecycleStates = new Set(pack.managementLifecycle.states);
  const lifecycleTransitions = new Set(pack.managementLifecycle.transitions.map(([from, to]) => `${from}->${to}`));

  assertSummary(pack.cases.length === pack.targets.caseCount, failures, {
    checkName: "case_count",
    reason: `Expected ${pack.targets.caseCount} cases, found ${pack.cases.length}.`,
  });

  for (const item of pack.cases) {
    assertCase(item.aliasId.length > 0, failures, item, {
      checkName: "case_contract",
      reason: "Case must use an alias id.",
    });
    assertCase(item.lifecycleRunId.length > 0, failures, item, {
      checkName: "case_contract",
      reason: "Case must include a commercialization run id.",
    });
    assertCase(item.providerAliasId === item.aliasId, failures, item, {
      checkName: "case_contract",
      reason: "Case provider alias must match the case alias id.",
    });
    assertCase(item.ownerAlias.length > 0, failures, item, {
      checkName: "case_contract",
      reason: "Case must assign an owner alias.",
    });
    assertCase(item.evidenceRefs.length > 0, failures, item, {
      checkName: "case_contract",
      reason: "Case must include evidence references.",
    });
    assertCase(REVIEW_SAFE_ACTIONS.has(item.expectedNextAction), failures, item, {
      checkName: "review_safe_action",
      reason: `Unexpected next action ${item.expectedNextAction}.`,
    });
    assertCase(!OUTBOUND_ACTION_PATTERN.test(item.expectedNextAction), failures, item, {
      checkName: "review_safe_action",
      reason: `Outbound-looking next action ${item.expectedNextAction} is not allowed.`,
    });
    assertCase(lifecycleStates.has(item.currentLifecycleState), failures, item, {
      checkName: "lifecycle_state_reference",
      reason: `Unknown current lifecycle state ${item.currentLifecycleState}.`,
    });
    assertCase(lifecycleStates.has(item.nextLifecycleState), failures, item, {
      checkName: "lifecycle_state_reference",
      reason: `Unknown next lifecycle state ${item.nextLifecycleState}.`,
    });
    assertCase(
      lifecycleTransitions.has(`${item.currentLifecycleState}->${item.nextLifecycleState}`),
      failures,
      item,
      {
        checkName: "lifecycle_transition_reference",
        reason: `Transition ${item.currentLifecycleState}->${item.nextLifecycleState} is not allowed.`,
      },
    );
    assertCase(item.requiredEvidenceKinds.length > 0, failures, item, {
      checkName: "management_evidence",
      reason: "Case must define evidence kinds for lifecycle management.",
    });
    assertCase(!item.helmDirectCustomerContactAllowed, failures, item, {
      checkName: "direct_customer_contact_authority",
      reason: "Helm must not bypass the service provider and contact the underlying customer directly.",
    });

    if (item.requiresReview) {
      assertCase(item.reviewerAlias.length > 0, failures, item, {
        checkName: "reviewer_required",
        reason: "Review-required case must assign a reviewer alias.",
      });
    }

    if (POSITIVE_DECISIONS.has(item.expectedDecision)) {
      assertCase(Boolean(item.expectedOfferStage && stageIds.has(item.expectedOfferStage)), failures, item, {
        checkName: "offer_stage_reference",
        reason: `Positive case references missing offer stage ${item.expectedOfferStage}.`,
      });
      assertCase(item.safeSampleAvailable, failures, item, {
        checkName: "safe_sample_required",
        reason: "Positive commercialization case must have a safe sample path.",
      });
      assertCase(item.acceptedReviewFirst, failures, item, {
        checkName: "review_first_required",
        reason: "Positive commercialization case must accept review-first boundaries.",
      });
      assertCase(item.managingThroughServiceProvider, failures, item, {
        checkName: "service_provider_management",
        reason: "Positive commercialization case must be managed through a service provider.",
      });
      assertCase(item.serviceProviderCustomerFacingOwner, failures, item, {
        checkName: "service_provider_management",
        reason: "Service provider must remain customer-facing owner for positive commercialization cases.",
      });
      assertCase(item.customerOpportunityAliasIds.length > 0, failures, item, {
        checkName: "customer_opportunity_alias",
        reason: "Positive commercialization case must include at least one customer opportunity alias.",
      });
      assertCase(item.stageReviewPacketRequired, failures, item, {
        checkName: "stage_review_packet",
        reason: "Positive commercialization case must require a stage review packet.",
      });
      assertCase(item.reviewStaleHours <= pack.managementLifecycle.maximumPositiveReviewStaleHours, failures, item, {
        checkName: "stale_positive_case",
        reason: `Positive commercialization case is stale after ${item.reviewStaleHours} hours.`,
      });
    }

    if (item.channelGateLevel === "L2" || item.channelGateLevel === "L3") {
      assertCase(item.managingThroughServiceProvider, failures, item, {
        checkName: "channel_gate_management",
        reason: "L2/L3 channel candidates must be managed through a service provider.",
      });
    }
    if (item.channelAssessmentRequired) {
      assertCase(item.expectedOfferStage === "closeout_report", failures, item, {
        checkName: "channel_gate_management",
        reason: "Channel gate assessment should only be required at closeout-report stage.",
      });
    }

    const boundaryDrift =
      BOUNDARY_DRIFT_PROVIDER_TYPES.has(item.providerType) ||
      item.riskTags.some((riskTag) => BOUNDARY_DRIFT_RISK_TAGS.has(riskTag));
    if (boundaryDrift) {
      assertCase(!POSITIVE_DECISIONS.has(item.expectedDecision), failures, item, {
        checkName: "boundary_drift_selected",
        reason: "Boundary-drift candidate must be no_go or watch_only.",
      });
    }
  }
}

function assertSummary(
  condition: boolean,
  failures: InternalCommercializationEvalFailure[],
  failure: InternalCommercializationEvalFailure,
) {
  if (!condition) {
    failures.push(failure);
  }
}

function assertCase(
  condition: boolean,
  failures: InternalCommercializationEvalFailure[],
  item: InternalCommercializationCase,
  failure: Omit<InternalCommercializationEvalFailure, "caseId">,
) {
  if (!condition) {
    failures.push({
      caseId: item.caseId,
      ...failure,
    });
  }
}
