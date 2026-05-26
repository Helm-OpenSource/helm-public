import fixturePack from "@/evals/industry-pack-b2b/b2b-sales-advancement-pack-cases.json";

export type IndustryPackB2BInputObject = {
  objectType: string;
  aliasId: string;
  fields: Record<string, unknown>;
};

export type IndustryPackB2BRoute = {
  routeId: string;
  signalOrDefault: string;
  rubricOrEvaluator: string;
  branch: string;
  proofPolicy: string;
  actionTemplate: string;
  fixtureIds: string[];
};

export type IndustryPackB2BCoreRoute = {
  routeId: string;
  coreGate: string;
  decision: string;
  fixtureIds: string[];
};

export type IndustryPackB2BFixture = {
  fixtureId: string;
  title: string;
  inputObjects: IndustryPackB2BInputObject[];
  expectedSignals: string[];
  expectedRubricBranch: string;
  expectedProofPolicy: string;
  expectedActionTemplate: string;
  expectedNoGo: string[];
};

export type IndustryPackB2BCoreCompatFixture = {
  fixtureId: string;
  title: string;
  inputObjects: IndustryPackB2BInputObject[];
  expectedPackSignals: string[];
  expectedCoreGate: string;
  expectedCoreDecision: string;
  expectedNoGo: string[];
};

export type IndustryPackB2BFixturePack = {
  version: string;
  status: string;
  boundary: string;
  pack: {
    packId: string;
    packName: string;
    packVersion: string;
    helmCoreCompat: string;
    industryArchetype: string;
    ownershipBoundary: string;
    coreObjects: string[];
    criticalFields: string[];
    signals: string[];
    signalEvaluationOrder: string[];
    signalConflictResolution: string;
    judgementRubrics: string[];
    proofPolicies: string[];
    actionTemplates: string[];
    workerSkillBindings: string[];
    degradationPolicy: string[];
    confidenceSourceEnum: string[];
    relationshipToPackA: {
      mode: string;
      supersedeGranularity: string;
      coreDedupRequired: boolean;
      silentOverlapAllowed: boolean;
      supersedesOnlyAfter: string[];
    };
    permissionSummary: {
      autoAllowed: string[];
      reviewRequired: string[];
      neverAllowed: string[];
    };
    tenantOverlayRules: {
      overlayRelation: string;
      canNarrow: string[];
      cannotBroaden: string[];
    };
  };
  targets: {
    packFixtureCount: number;
    coreCompatFixtureCount: number;
    routingRouteCount: number;
    coreRouteCount: number;
    maximumDirectMustPushTruthCount: number;
    maximumAutoSendCount: number;
    maximumSilentCrmWriteCount: number;
    maximumConnectorRuntimeApiUiSchemaCapabilityCount: number;
    maximumRawPiiFieldCount: number;
    maximumCustomerIdentifiableTextFieldCount: number;
  };
  routingMatrix: IndustryPackB2BRoute[];
  coreCompatibilityMatrix: IndustryPackB2BCoreRoute[];
  packFixtures: IndustryPackB2BFixture[];
  coreCompatFixtures: IndustryPackB2BCoreCompatFixture[];
};

export type IndustryPackB2BEvalFailure = {
  checkName: string;
  fixtureId?: string;
  reason: string;
};

export type IndustryPackB2BEvalSummary = {
  passed: boolean;
  version: string;
  totalPackFixtures: number;
  totalCoreCompatFixtures: number;
  routeCount: number;
  coreRouteCount: number;
  directMustPushTruthNoGoCount: number;
  autoSendNoGoCount: number;
  silentCrmWriteNoGoCount: number;
  connectorRuntimeApiUiSchemaCapabilityCount: number;
  rawPiiFieldCount: number;
  customerIdentifiableTextFieldCount: number;
  failures: IndustryPackB2BEvalFailure[];
};

const FORBIDDEN_ACTION_GRANTS = [
  "direct_must_push_truth",
  "auto_send",
  "silent_crm_write",
  "commit_pricing",
  "approve_legal_terms",
  "settle_commercial_exception",
  "connector_capability",
  "runtime_capability",
  "api_capability",
  "ui_capability",
  "schema_capability",
] as const;

const FORBIDDEN_FIELD_KEYS = [
  "subject",
  "body",
  "name",
  "email",
  "customername",
  "realcustomer",
  "phone",
  "address",
  "rawpayload",
] as const;

const REQUIRED_PACK_A_SUPERSEDE_CONDITIONS = [
  "manifest_review_passed",
  "offline_eval_passed",
  "no_go_gate_passed",
  "owner_acceptance",
] as const;

const REQUIRED_CORE_OBJECTS = [
  "account",
  "opportunity",
  "contact",
  "meeting",
  "email_thread",
  "draft",
] as const;

const REQUIRED_CRITICAL_FIELDS = [
  "stage",
  "amountBand",
  "ownerAlias",
  "nextStepAt",
  "lastInteractionAt",
  "lastCustomerReplyAt",
  "relationshipStrength",
  "customerAskedFor",
] as const;

const REQUIRED_SIGNALS = [
  "stalled_opportunity",
  "missed_follow_through",
  "customer_visible_draft_needed",
  "high_value_owner_gap",
  "mapping_gap_blocks_advancement",
] as const;

const REQUIRED_RUBRICS = [
  "b2b_advancement_priority",
  "customer_visible_risk",
  "mapping_gap_degradation",
  "healthy_snapshot_default",
] as const;

const REQUIRED_PROOF_POLICIES = [
  "absence_of_interaction_review",
  "source_snapshot_timestamp",
  "customer_visible_draft_review",
  "denied_internal_record",
] as const;

const REQUIRED_ACTION_TEMPLATES = [
  "prepare_owner_handoff",
  "mark_watch_only",
  "prepare_customer_followup_draft",
  "request_mapping_gap_review",
  "mark_internal_denied",
] as const;

const REQUIRED_WORKER_SKILL_BINDINGS = [
  "b2b_advancement_signal_reader",
  "b2b_owner_handoff_packet_builder",
  "b2b_mapping_gap_reviewer",
  "b2b_customer_followup_draft_preparer",
] as const;

const REQUIRED_DEGRADATION_POLICIES = [
  "missing_mapping_to_no_judgement",
  "stale_evidence_to_watch_only",
  "customer_visible_commitment_to_deny",
  "worker_provenance_gap_to_deny",
] as const;

const REQUIRED_CONFIDENCE_SOURCES = [
  "deterministic_high",
  "deterministic_medium",
  "deterministic_low",
  "manual_review_required",
  "no_judgement",
] as const;

const SAFE_ALIAS_FIELD_VALUE_PATTERN = /^(?:[a-z][a-z0-9_]*|T[+-]\d+d)$/;

export function runIndustryPackB2BEval(
  pack: IndustryPackB2BFixturePack = fixturePack as IndustryPackB2BFixturePack,
): IndustryPackB2BEvalSummary {
  const failures: IndustryPackB2BEvalFailure[] = [];
  const routeByFixture = buildRouteByFixture(pack.routingMatrix, failures);
  const coreRouteByFixture = buildCoreRouteByFixture(pack.coreCompatibilityMatrix, failures);

  assertSummary(pack.packFixtures.length === pack.targets.packFixtureCount, failures, {
    checkName: "pack_fixture_count",
    reason: `Expected ${pack.targets.packFixtureCount} pack fixtures, found ${pack.packFixtures.length}.`,
  });
  assertSummary(pack.coreCompatFixtures.length === pack.targets.coreCompatFixtureCount, failures, {
    checkName: "core_compat_fixture_count",
    reason: `Expected ${pack.targets.coreCompatFixtureCount} core compat fixtures, found ${pack.coreCompatFixtures.length}.`,
  });
  assertSummary(pack.routingMatrix.length === pack.targets.routingRouteCount, failures, {
    checkName: "routing_route_count",
    reason: `Expected ${pack.targets.routingRouteCount} routing routes, found ${pack.routingMatrix.length}.`,
  });
  assertSummary(pack.coreCompatibilityMatrix.length === pack.targets.coreRouteCount, failures, {
    checkName: "core_route_count",
    reason: `Expected ${pack.targets.coreRouteCount} core routes, found ${pack.coreCompatibilityMatrix.length}.`,
  });

  checkManifestContract(pack, failures);
  checkPackRelationship(pack, failures);
  checkPermissionBoundary(pack, failures);
  checkTenantOverlayBoundary(pack, failures);
  checkPackFixtures(pack.packFixtures, routeByFixture, failures);
  checkCoreCompatFixtures(pack.coreCompatFixtures, coreRouteByFixture, routeByFixture, failures);

  const noGoRows = [
    ...pack.packFixtures.flatMap((item) => item.expectedNoGo),
    ...pack.coreCompatFixtures.flatMap((item) => item.expectedNoGo),
    ...pack.pack.permissionSummary.neverAllowed,
    pack.boundary,
  ];
  const directMustPushTruthNoGoCount = countMatching(noGoRows, ["direct Must Push truth", "direct_must_push_truth", "create direct Must Push truth"]);
  const autoSendNoGoCount = countMatching(noGoRows, ["auto-send", "no_auto_send", "send customer message"]);
  const silentCrmWriteNoGoCount = countMatching(noGoRows, ["silent CRM write", "no_silent_crm_write", "write CRM silently"]);
  const connectorRuntimeApiUiSchemaCapabilityCount = countMatching(noGoRows, [
    "connector_capability",
    "runtime_capability",
    "api_capability",
    "ui_capability",
    "schema_capability",
  ]);
  const piiCounts = countForbiddenFields([...pack.packFixtures, ...pack.coreCompatFixtures]);

  assertSummary(directMustPushTruthNoGoCount > pack.targets.maximumDirectMustPushTruthCount, failures, {
    checkName: "direct_must_push_truth_no_go_coverage",
    reason: "Expected at least one explicit direct Must Push truth No-Go reference.",
  });
  assertSummary(autoSendNoGoCount > pack.targets.maximumAutoSendCount, failures, {
    checkName: "auto_send_no_go_coverage",
    reason: "Expected at least one explicit auto-send No-Go reference.",
  });
  assertSummary(silentCrmWriteNoGoCount > pack.targets.maximumSilentCrmWriteCount, failures, {
    checkName: "silent_crm_write_no_go_coverage",
    reason: "Expected at least one explicit silent CRM write No-Go reference.",
  });
  assertSummary(connectorRuntimeApiUiSchemaCapabilityCount === pack.targets.maximumConnectorRuntimeApiUiSchemaCapabilityCount, failures, {
    checkName: "no_connector_runtime_api_ui_schema_capability",
    reason: `Found ${connectorRuntimeApiUiSchemaCapabilityCount} forbidden capability grants.`,
  });
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

  return {
    passed: failures.length === 0,
    version: pack.version,
    totalPackFixtures: pack.packFixtures.length,
    totalCoreCompatFixtures: pack.coreCompatFixtures.length,
    routeCount: pack.routingMatrix.length,
    coreRouteCount: pack.coreCompatibilityMatrix.length,
    directMustPushTruthNoGoCount,
    autoSendNoGoCount,
    silentCrmWriteNoGoCount,
    connectorRuntimeApiUiSchemaCapabilityCount,
    rawPiiFieldCount: piiCounts.rawPiiFieldCount,
    customerIdentifiableTextFieldCount: piiCounts.customerIdentifiableTextFieldCount,
    failures,
  };
}

function checkManifestContract(
  pack: IndustryPackB2BFixturePack,
  failures: IndustryPackB2BEvalFailure[],
) {
  pushFailureIf(pack.status !== "offline_contract_only", failures, "manifest_contract", "Pack status must stay offline_contract_only.");
  pushFailureIf(pack.pack.industryArchetype !== "b2b_sales", failures, "manifest_contract", "Industry archetype must stay b2b_sales.");
  pushFailureIf(
    pack.pack.signalConflictResolution !== "deny_over_review_over_watch_over_no_signal",
    failures,
    "manifest_contract",
    "Signal conflict resolution must keep deny/review/watch/no-signal ordering.",
  );

  assertIncludesAll(pack.pack.coreObjects, REQUIRED_CORE_OBJECTS, failures, "manifest_contract", "coreObjects");
  assertIncludesAll(pack.pack.criticalFields, REQUIRED_CRITICAL_FIELDS, failures, "manifest_contract", "criticalFields");
  assertIncludesAll(pack.pack.signals, REQUIRED_SIGNALS, failures, "manifest_contract", "signals");
  assertIncludesAll(pack.pack.signalEvaluationOrder, REQUIRED_SIGNALS, failures, "manifest_contract", "signalEvaluationOrder");
  assertIncludesAll(pack.pack.judgementRubrics, REQUIRED_RUBRICS, failures, "manifest_contract", "judgementRubrics");
  assertIncludesAll(pack.pack.proofPolicies, REQUIRED_PROOF_POLICIES, failures, "manifest_contract", "proofPolicies");
  assertIncludesAll(pack.pack.actionTemplates, REQUIRED_ACTION_TEMPLATES, failures, "manifest_contract", "actionTemplates");
  assertIncludesAll(pack.pack.workerSkillBindings, REQUIRED_WORKER_SKILL_BINDINGS, failures, "manifest_contract", "workerSkillBindings");
  assertIncludesAll(pack.pack.degradationPolicy, REQUIRED_DEGRADATION_POLICIES, failures, "manifest_contract", "degradationPolicy");
  assertIncludesAll(pack.pack.confidenceSourceEnum, REQUIRED_CONFIDENCE_SOURCES, failures, "manifest_contract", "confidenceSourceEnum");
}

function checkPackRelationship(
  pack: IndustryPackB2BFixturePack,
  failures: IndustryPackB2BEvalFailure[],
) {
  const relation = pack.pack.relationshipToPackA;
  pushFailureIf(relation.mode !== "coexist_then_upgrade", failures, "pack_a_relationship", "Pack A mode must stay coexist_then_upgrade.");
  pushFailureIf(relation.supersedeGranularity !== "per_signal", failures, "pack_a_relationship", "Pack A supersede granularity must stay per_signal.");
  pushFailureIf(!relation.coreDedupRequired, failures, "pack_a_relationship", "Core dedupe must be required.");
  pushFailureIf(relation.silentOverlapAllowed, failures, "pack_a_relationship", "Silent overlap must be disallowed.");

  for (const item of REQUIRED_PACK_A_SUPERSEDE_CONDITIONS) {
    pushFailureIf(
      !relation.supersedesOnlyAfter.includes(item),
      failures,
      "pack_a_relationship",
      `Missing Pack A supersede condition: ${item}.`,
    );
  }
}

function checkPermissionBoundary(
  pack: IndustryPackB2BFixturePack,
  failures: IndustryPackB2BEvalFailure[],
) {
  pushFailureIf(pack.pack.ownershipBoundary !== "candidate-only", failures, "ownership_boundary", "Pack ownership must stay candidate-only.");

  const allAllowed = [
    ...pack.pack.permissionSummary.autoAllowed,
    ...pack.pack.permissionSummary.reviewRequired,
  ];
  for (const grant of allAllowed) {
    for (const forbidden of FORBIDDEN_ACTION_GRANTS) {
      pushFailureIf(
        normalize(grant).includes(normalize(forbidden)),
        failures,
        "permission_summary",
        `Permission summary grants forbidden action: ${grant}.`,
      );
    }
  }
}

function checkTenantOverlayBoundary(
  pack: IndustryPackB2BFixturePack,
  failures: IndustryPackB2BEvalFailure[],
) {
  pushFailureIf(
    pack.pack.tenantOverlayRules.overlayRelation !== "overlay_subset_of_pack_subset_of_core",
    failures,
    "tenant_overlay_boundary",
    "Tenant overlay relation must stay overlay_subset_of_pack_subset_of_core.",
  );

  const requiredCannotBroaden = [
    "autoAllowed",
    "customerVisibleActions",
    "outboundActions",
    "writePermissions",
    "coreNeverAllow",
  ];
  for (const field of requiredCannotBroaden) {
    pushFailureIf(
      !pack.pack.tenantOverlayRules.cannotBroaden.includes(field),
      failures,
      "tenant_overlay_boundary",
      `Tenant overlay cannotBroaden missing: ${field}.`,
    );
  }
}

function checkPackFixtures(
  fixtures: IndustryPackB2BFixture[],
  routeByFixture: Map<string, IndustryPackB2BRoute>,
  failures: IndustryPackB2BEvalFailure[],
) {
  const seen = new Set<string>();
  for (const item of fixtures) {
    pushFixtureFailureIf(seen.has(item.fixtureId), failures, item.fixtureId, "unique_fixture_id", "Duplicate pack fixture id.");
    seen.add(item.fixtureId);
    pushFixtureFailureIf(!/^b2b_advancement_\d{3}$/.test(item.fixtureId), failures, item.fixtureId, "fixture_id_shape", "Pack fixture id must match b2b_advancement_NNN.");
    pushFixtureFailureIf(item.expectedNoGo.length === 0, failures, item.fixtureId, "expected_no_go", "Pack fixture must have non-empty expectedNoGo.");
    pushFixtureFailureIf(item.inputObjects.length === 0, failures, item.fixtureId, "input_objects", "Pack fixture must include inputObjects.");

    const route = routeByFixture.get(item.fixtureId);
    pushFixtureFailureIf(!route, failures, item.fixtureId, "routing_matrix", "Pack fixture must be covered by exactly one routing route.");
    if (route) {
      const expectedSignals = route.signalOrDefault === "no_signal_healthy_snapshot" ? [] : [route.signalOrDefault];
      pushFixtureFailureIf(!sameStringArray(item.expectedSignals, expectedSignals), failures, item.fixtureId, "routing_matrix", `Expected signals must match ${route.routeId}.`);
      pushFixtureFailureIf(item.expectedRubricBranch !== route.branch, failures, item.fixtureId, "routing_matrix", `Expected branch must match ${route.routeId}.`);
      pushFixtureFailureIf(item.expectedProofPolicy !== route.proofPolicy, failures, item.fixtureId, "routing_matrix", `Expected proof policy must match ${route.routeId}.`);
      pushFixtureFailureIf(item.expectedActionTemplate !== route.actionTemplate, failures, item.fixtureId, "routing_matrix", `Expected action template must match ${route.routeId}.`);
    }

    if (item.expectedActionTemplate === "prepare_customer_followup_draft") {
      pushFixtureFailureIf(item.expectedProofPolicy !== "customer_visible_draft_review", failures, item.fixtureId, "customer_visible_review", "Customer-visible draft must use customer_visible_draft_review.");
      pushFixtureFailureIf(!item.expectedNoGo.includes("no_auto_send"), failures, item.fixtureId, "customer_visible_review", "Customer-visible draft must include no_auto_send.");
    }

    if (item.expectedRubricBranch === "deny") {
      pushFixtureFailureIf(item.expectedProofPolicy !== "denied_internal_record", failures, item.fixtureId, "deny_proof_policy", "Deny branch must use denied_internal_record.");
      pushFixtureFailureIf(item.expectedActionTemplate !== "mark_internal_denied", failures, item.fixtureId, "deny_action_template", "Deny branch must use mark_internal_denied.");
    }
  }
}

function checkCoreCompatFixtures(
  fixtures: IndustryPackB2BCoreCompatFixture[],
  coreRouteByFixture: Map<string, IndustryPackB2BCoreRoute>,
  packRouteByFixture: Map<string, IndustryPackB2BRoute>,
  failures: IndustryPackB2BEvalFailure[],
) {
  const seen = new Set<string>();
  for (const item of fixtures) {
    pushFixtureFailureIf(seen.has(item.fixtureId), failures, item.fixtureId, "unique_core_fixture_id", "Duplicate core compat fixture id.");
    seen.add(item.fixtureId);
    pushFixtureFailureIf(!/^core_compat_\d{3}$/.test(item.fixtureId), failures, item.fixtureId, "core_fixture_id_shape", "Core fixture id must match core_compat_NNN.");
    pushFixtureFailureIf(packRouteByFixture.has(item.fixtureId), failures, item.fixtureId, "core_pack_isolation", "Core compat fixture must not be covered by Pack routing matrix.");
    pushFixtureFailureIf(item.expectedNoGo.length === 0, failures, item.fixtureId, "expected_no_go", "Core compat fixture must have non-empty expectedNoGo.");

    const route = coreRouteByFixture.get(item.fixtureId);
    pushFixtureFailureIf(!route, failures, item.fixtureId, "core_routing_matrix", "Core compat fixture must be covered by one Core route.");
    if (route) {
      pushFixtureFailureIf(item.expectedCoreGate !== route.coreGate, failures, item.fixtureId, "core_routing_matrix", `Expected Core gate must match ${route.routeId}.`);
      pushFixtureFailureIf(item.expectedCoreDecision !== route.decision, failures, item.fixtureId, "core_routing_matrix", `Expected Core decision must match ${route.routeId}.`);
    }

    if (item.expectedCoreGate === "tenant_overlay_narrowing_validator") {
      pushFixtureFailureIf(item.expectedPackSignals.length !== 0, failures, item.fixtureId, "overlay_not_pack_signal", "Overlay broadening must not emit Pack signals.");
    }
  }
}

function buildRouteByFixture(
  routes: IndustryPackB2BRoute[],
  failures: IndustryPackB2BEvalFailure[],
) {
  const result = new Map<string, IndustryPackB2BRoute>();
  for (const route of routes) {
    for (const fixtureId of route.fixtureIds) {
      if (result.has(fixtureId)) {
        failures.push({
          checkName: "unique_route_coverage",
          fixtureId,
          reason: `Fixture is covered by more than one Pack route (${result.get(fixtureId)?.routeId}, ${route.routeId}).`,
        });
      }
      result.set(fixtureId, route);
    }
  }
  return result;
}

function buildCoreRouteByFixture(
  routes: IndustryPackB2BCoreRoute[],
  failures: IndustryPackB2BEvalFailure[],
) {
  const result = new Map<string, IndustryPackB2BCoreRoute>();
  for (const route of routes) {
    for (const fixtureId of route.fixtureIds) {
      if (result.has(fixtureId)) {
        failures.push({
          checkName: "unique_core_route_coverage",
          fixtureId,
          reason: `Fixture is covered by more than one Core route (${result.get(fixtureId)?.routeId}, ${route.routeId}).`,
        });
      }
      result.set(fixtureId, route);
    }
  }
  return result;
}

function countForbiddenFields(
  fixtures: Array<IndustryPackB2BFixture | IndustryPackB2BCoreCompatFixture>,
) {
  let rawPiiFieldCount = 0;
  let customerIdentifiableTextFieldCount = 0;

  for (const fixture of fixtures) {
    for (const object of fixture.inputObjects) {
      if (!/^[a-z]+[a-z0-9_]*_[a-z0-9_]+$/.test(object.aliasId)) {
        rawPiiFieldCount += 1;
      }

      for (const [key, value] of Object.entries(flattenFields(object.fields))) {
        const normalizedKey = normalize(key);
        if (FORBIDDEN_FIELD_KEYS.some((forbidden) => normalizedKey.includes(forbidden))) {
          customerIdentifiableTextFieldCount += 1;
        }
        if (typeof value === "string" && !isSafeAliasFieldValue(value)) {
          rawPiiFieldCount += 1;
        }
      }
    }
  }

  return { rawPiiFieldCount, customerIdentifiableTextFieldCount };
}

function isSafeAliasFieldValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed !== value) {
    return false;
  }
  if (trimmed.includes("@") || /^[a-z]+:\/\//i.test(trimmed)) {
    return false;
  }
  if (/\+?\d[\d\s().-]{6,}\d/.test(trimmed)) {
    return false;
  }
  return SAFE_ALIAS_FIELD_VALUE_PATTERN.test(trimmed);
}

function flattenFields(value: unknown, prefix = ""): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? { [prefix]: value } : {};
  }

  return Object.entries(value).reduce<Record<string, unknown>>((result, [key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      Object.assign(result, flattenFields(nested, nextPrefix));
    } else {
      result[nextPrefix] = nested;
    }
    return result;
  }, {});
}

function countMatching(values: string[], patterns: string[]) {
  return values.filter((value) =>
    patterns.some((pattern) => normalize(value).includes(normalize(pattern))),
  ).length;
}

function pushFailureIf(
  condition: boolean,
  failures: IndustryPackB2BEvalFailure[],
  checkName: string,
  reason: string,
) {
  if (condition) {
    failures.push({ checkName, reason });
  }
}

function pushFixtureFailureIf(
  condition: unknown,
  failures: IndustryPackB2BEvalFailure[],
  fixtureId: string,
  checkName: string,
  reason: string,
) {
  if (condition) {
    failures.push({ checkName, fixtureId, reason });
  }
}

function assertSummary(
  condition: unknown,
  failures: IndustryPackB2BEvalFailure[],
  failure: IndustryPackB2BEvalFailure,
) {
  if (!condition) {
    failures.push(failure);
  }
}

function assertIncludesAll(
  actual: readonly string[] | undefined,
  expected: readonly string[],
  failures: IndustryPackB2BEvalFailure[],
  checkName: string,
  fieldName: string,
) {
  const actualSet = new Set(actual ?? []);
  for (const expectedItem of expected) {
    pushFailureIf(
      !actualSet.has(expectedItem),
      failures,
      checkName,
      `Manifest ${fieldName} missing required value: ${expectedItem}.`,
    );
  }
}

function sameStringArray(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
