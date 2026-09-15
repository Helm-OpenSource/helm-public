import { describe, expect, it } from "vitest";

import {
  acceptInitializationGateSchema,
  catalogAuthorizationSchema,
  catalogClassificationSchema,
  catalogConnectionSchema,
  catalogInitializationSchema,
  createCatalogEntrySchema,
  createObservationProgramSchema,
  recordInitializationAssessmentSchema,
  registerObservationSourceSchema,
  revokeInitializationGateSchema,
  bindQuestionSelectionSchema,
  selectOperatingQuestionsSchema,
} from "./schemas";

const ISO = "2026-09-15T08:00:00.000Z";
const selectionItem = {
  questionId: "question-1", questionOverride: null, goal: "Validate one evidence-bound operating priority",
  successMetrics: [{ metricKey: "metric-1", target: "Improve the governed baseline" }], priority: 1,
  implementationScopeRefs: ["scope:review-only"], ownerRef: null, reviewerRef: null, startsAt: null, endsAt: null,
  prohibitedActions: ["external_side_effect"],
};
const LATER = "2026-09-22T08:00:00.000Z";

const stageBase = {
  assetId: "asset_1",
  receiptId: "receipt_1",
  idempotencyKey: "idem_1",
  expectedVersion: 1,
  evidenceRefs: ["evidence:inventory-1"],
};

const validInputs = {
  createCatalogEntry: [createCatalogEntrySchema, {
    assetKey: "collection-activity", sourceSystemRef: "system:core-db", displayName: "Collection activity",
    sourceKind: "relational_database", businessDomain: "collections", businessOwnerRef: "owner:operations",
    purpose: "Observe collection activity aggregates", scopeRefs: ["scope:workspace"], recommendedAccessMode: "read_only_replica",
    retentionDays: 90, freshnessSlaMinutes: 10, residencyRequirements: ["domestic"], blindSpots: [], blockerCodes: [],
    riskOwnerRef: null, nextReviewAt: null, evidenceRefs: ["evidence:inventory-1"],
  }],
  catalogClassification: [catalogClassificationSchema, {
    ...stageBase, dataShape: "structured", sensitivity: "confidential", processingDisposition: "local_only", technicalFeasibility: "feasible",
  }],
  catalogAuthorization: [catalogAuthorizationSchema, {
    ...stageBase, authorizationStatus: "authorized", authorizationRef: "authorization:1", scopeRefs: ["scope:workspace"],
    consentRefs: [], validFrom: ISO, validUntil: LATER, reasonCodes: ["owner_approved"],
  }],
  catalogConnection: [catalogConnectionSchema, {
    ...stageBase, connectionStatus: "connected", accessMode: "read_only_replica", connectorRef: "connector:1",
    secretRef: null, authorizationReceiptRef: "receipt:auth-1", observationSourceRef: null, reasonCodes: [],
  }],
  catalogInitialization: [catalogInitializationSchema, {
    ...stageBase, initializationStatus: "initialized", connectionReceiptRef: "receipt:conn-1", observationRunRefs: ["run:1"],
    schemaMappingRefs: [], companyMemoryRefs: [], temporalContextSnapshotRef: null, reasonCodes: [],
  }],
  createObservationProgram: [createObservationProgramSchema, {
    purpose: "Observe operations", scopeRefs: ["scope:workspace"], dataCategories: ["operations_aggregate"],
    startsAt: ISO, expiresAt: LATER, retentionDays: 90, authorizationRef: "authorization:1",
  }],
  registerObservationSource: [registerObservationSourceSchema, {
    programId: "program_1", catalogEntryId: "asset_1", sourceKey: "collection-activity", sourceKind: "relational_database",
    accessMode: "read_only_replica", ownerRef: "owner:operations", freshnessSlaMinutes: 10, sensitivity: "confidential",
    authorizationRef: "authorization:1", secretRef: "managed-ref:collection-activity", retentionDays: 90,
  }],
  recordInitializationAssessment: [recordInitializationAssessmentSchema, { mandateRecordId: "mandate_1", evaluationKey: "g0-2026-09-15" }],
  acceptInitializationGate: [acceptInitializationGateSchema, {
    assessmentId: "assessment_1", ceoPrincipalRef: "ceo-primary", idempotencyKey: "accept_1",
    inventoryConfirmationRef: "inventory:confirmed-1", customerAcceptanceRef: "acceptance:1",
    acceptedExceptionRefs: [], reasonCodes: ["ready"], evidenceRefs: ["evidence:g0-1"],
  }],
  revokeInitializationGate: [revokeInitializationGateSchema, {
    ceoPrincipalRef: "ceo-primary", idempotencyKey: "revoke_1", reasonCodes: ["data_source_withdrawn"], evidenceRefs: ["evidence:revoke-1"],
  }],
  selectOperatingQuestions: [selectOperatingQuestionsSchema, {
    expectedPortfolioId: "portfolio_1", ceoPrincipalRef: "ceo-primary", idempotencyKey: "select_1",
    selections: [selectionItem], reasonCodes: ["highest_leverage"], evidenceRefs: ["evidence:portfolio-1"],
  }],
  bindQuestionSelection: [bindQuestionSelectionSchema, { expectedSelectionReceiptId: "selection_receipt_1", ceoPrincipalRef: "ceo-primary" }],
} as const;

describe("CAIO operator schemas", () => {
  it.each(Object.entries(validInputs))("accepts a valid %s input", (_name, [schema, input]) => {
    expect(schema.safeParse(input).success).toBe(true);
  });

  it.each(Object.entries(validInputs))("rejects unknown keys for %s", (_name, [schema, input]) => {
    expect(schema.safeParse({ ...input, injected: "x" }).success).toBe(false);
  });

  it.each(Object.entries(validInputs))("rejects an empty object for %s", (_name, [schema]) => {
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("rejects colon-bearing CEO principal refs on the G0 fields", () => {
    expect(acceptInitializationGateSchema.safeParse({ ...validInputs.acceptInitializationGate[1], ceoPrincipalRef: "c:1" }).success).toBe(false);
    expect(revokeInitializationGateSchema.safeParse({ ...validInputs.revokeInitializationGate[1], ceoPrincipalRef: "c:1" }).success).toBe(false);
  });

  it("bounds the CEO question selection the same way as the governed selection command", () => {
    const valid = validInputs.selectOperatingQuestions[1];
    expect(selectOperatingQuestionsSchema.safeParse({ ...valid, selections: [] }).success).toBe(true);
    expect(selectOperatingQuestionsSchema.safeParse({ ...valid, selections: Array(4).fill(selectionItem) }).success).toBe(false);
    expect(selectOperatingQuestionsSchema.safeParse({ ...valid, evidenceRefs: [] }).success).toBe(false);
    expect(selectOperatingQuestionsSchema.safeParse({ ...valid, selections: [{ ...selectionItem, injected: true }] }).success).toBe(false);
    expect(selectOperatingQuestionsSchema.safeParse({ ...valid, ceoPrincipalRef: "c:1" }).success).toBe(false);
    expect(bindQuestionSelectionSchema.safeParse({ ...validInputs.bindQuestionSelection[1], ceoPrincipalRef: "c:1" }).success).toBe(false);
  });

  it("rejects out-of-set enums and empty array elements", () => {
    expect(catalogConnectionSchema.safeParse({ ...validInputs.catalogConnection[1], connectionStatus: "not_started" }).success).toBe(false);
    expect(catalogAuthorizationSchema.safeParse({ ...validInputs.catalogAuthorization[1], authorizationStatus: "not_requested" }).success).toBe(false);
    expect(catalogInitializationSchema.safeParse({ ...validInputs.catalogInitialization[1], initializationStatus: "not_started" }).success).toBe(false);
    expect(catalogClassificationSchema.safeParse({ ...validInputs.catalogClassification[1], technicalFeasibility: "unassessed" }).success).toBe(false);
    expect(acceptInitializationGateSchema.safeParse({ ...validInputs.acceptInitializationGate[1], evidenceRefs: [""] }).success).toBe(false);
  });

  it("rejects malformed instants and non-positive counters", () => {
    expect(createObservationProgramSchema.safeParse({ ...validInputs.createObservationProgram[1], startsAt: "yesterday" }).success).toBe(false);
    expect(createObservationProgramSchema.safeParse({ ...validInputs.createObservationProgram[1], retentionDays: 0 }).success).toBe(false);
    expect(catalogClassificationSchema.safeParse({ ...validInputs.catalogClassification[1], expectedVersion: -1 }).success).toBe(false);
  });

  it("converts service Date fields", () => {
    const program = createObservationProgramSchema.parse(validInputs.createObservationProgram[1]);
    expect(program.startsAt).toBeInstanceOf(Date);
    const entry = createCatalogEntrySchema.parse({ ...validInputs.createCatalogEntry[1], nextReviewAt: LATER });
    expect(entry.nextReviewAt).toBeInstanceOf(Date);
    const authorization = catalogAuthorizationSchema.parse(validInputs.catalogAuthorization[1]);
    expect(authorization.validFrom).toBeInstanceOf(Date);
  });
});
