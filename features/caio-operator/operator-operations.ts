/**
 * Operator panel catalog: one entry per server action, with a schema-valid example template.
 * Governance records (bindings, mandate, stops) are not web operations; see the governance CLI.
 * Pure data so the client bundle carries no service imports. Placeholder refs in templates must be
 * replaced by the operator with real references before submitting.
 */

export const CAIO_OPERATOR_GROUPS = [
  { key: "catalog", title: { zh: "数据资产目录", en: "Data asset catalog" } },
  { key: "observation", title: { zh: "观察来源", en: "Observation sources" } },
  { key: "initialization", title: { zh: "G0 初始化", en: "G0 initialization" } },
  { key: "selection", title: { zh: "经营问题选题（CEO）", en: "Operating question selection (CEO)" } },
] as const;

export type CaioOperatorGroupKey = (typeof CAIO_OPERATOR_GROUPS)[number]["key"];

export type CaioOperatorOperation = Readonly<{
  key: string;
  group: CaioOperatorGroupKey;
  schemaName: string;
  /** owner: workspace OWNER registers; ceo: authorized by the registered principal binding. */
  actor: "owner" | "ceo";
  title: { zh: string; en: string };
  template: Readonly<Record<string, unknown>>;
}>;

const NOW = "2026-01-01T00:00:00.000Z";
const LATER = "2026-01-08T00:00:00.000Z";
const stage = { assetId: "asset-id", receiptId: "receipt-id", idempotencyKey: "idempotency-key", expectedVersion: 0, evidenceRefs: ["evidence:replace-me"] };

export const CAIO_OPERATOR_OPERATIONS: readonly CaioOperatorOperation[] = [
  { key: "createCatalogEntry", group: "catalog", schemaName: "createCatalogEntrySchema", actor: "owner",
    title: { zh: "登记数据资产", en: "Register a data asset" },
    template: { assetKey: "asset-key", sourceSystemRef: "system:replace-me", displayName: "Replace with a display name",
      sourceKind: "relational_database", businessDomain: "operations", businessOwnerRef: "owner:replace-me",
      purpose: "Replace with the observation purpose", scopeRefs: ["scope:workspace"], recommendedAccessMode: "read_only_replica",
      retentionDays: 90, freshnessSlaMinutes: 10, residencyRequirements: ["domestic"], blindSpots: [], blockerCodes: [],
      riskOwnerRef: null, nextReviewAt: null, evidenceRefs: ["evidence:replace-me"] } },
  { key: "recordCatalogClassification", group: "catalog", schemaName: "catalogClassificationSchema", actor: "owner",
    title: { zh: "分级回执", en: "Classification receipt" },
    template: { ...stage, dataShape: "structured", sensitivity: "confidential", processingDisposition: "local_only", technicalFeasibility: "feasible" } },
  { key: "recordCatalogAuthorization", group: "catalog", schemaName: "catalogAuthorizationSchema", actor: "owner",
    title: { zh: "授权回执", en: "Authorization receipt" },
    template: { ...stage, authorizationStatus: "authorized", authorizationRef: "authorization:replace-me", scopeRefs: ["scope:workspace"],
      consentRefs: [], validFrom: NOW, validUntil: LATER, reasonCodes: ["owner_approved"] } },
  { key: "recordCatalogConnection", group: "catalog", schemaName: "catalogConnectionSchema", actor: "owner",
    title: { zh: "连接回执", en: "Connection receipt" },
    template: { ...stage, connectionStatus: "connected", accessMode: "read_only_replica", connectorRef: "connector:replace-me",
      secretRef: null, authorizationReceiptRef: "receipt:replace-me", observationSourceRef: null, reasonCodes: [] } },
  { key: "recordCatalogInitialization", group: "catalog", schemaName: "catalogInitializationSchema", actor: "owner",
    title: { zh: "初始化回执", en: "Initialization receipt" },
    template: { ...stage, initializationStatus: "initialized", connectionReceiptRef: "receipt:replace-me", observationRunRefs: ["run:replace-me"],
      schemaMappingRefs: [], companyMemoryRefs: [], temporalContextSnapshotRef: null, reasonCodes: [] } },
  { key: "createObservationProgram", group: "observation", schemaName: "createObservationProgramSchema", actor: "owner",
    title: { zh: "创建观察程序", en: "Create an observation program" },
    template: { purpose: "Replace with the program purpose", scopeRefs: ["scope:workspace"], dataCategories: ["operations_aggregate"],
      startsAt: NOW, expiresAt: LATER, retentionDays: 90, authorizationRef: "authorization:replace-me" } },
  { key: "registerObservationSource", group: "observation", schemaName: "registerObservationSourceSchema", actor: "owner",
    title: { zh: "登记观察来源", en: "Register an observation source" },
    template: { programId: "program-id", catalogEntryId: "asset-id", sourceKey: "source-key", sourceKind: "relational_database",
      accessMode: "read_only_replica", ownerRef: "owner:replace-me", freshnessSlaMinutes: 10, sensitivity: "confidential",
      authorizationRef: "authorization:replace-me", secretRef: "managed-ref:replace-me", retentionDays: 90 } },
  { key: "recordInitializationAssessment", group: "initialization", schemaName: "recordInitializationAssessmentSchema", actor: "owner",
    title: { zh: "记录 G0 评估", en: "Record a G0 assessment" },
    template: { mandateRecordId: "mandate-record-id", evaluationKey: "g0-evaluation-key" } },
  { key: "acceptInitializationGate", group: "initialization", schemaName: "acceptInitializationGateSchema", actor: "ceo",
    title: { zh: "受理 G0 验收门（CEO）", en: "Accept the G0 gate (CEO)" },
    template: { assessmentId: "assessment-id", ceoPrincipalRef: "ceo-primary", idempotencyKey: "idempotency-key",
      inventoryConfirmationRef: "inventory:replace-me", customerAcceptanceRef: "acceptance:replace-me",
      acceptedExceptionRefs: [], reasonCodes: ["ready"], evidenceRefs: ["evidence:replace-me"] } },
  { key: "revokeInitializationGate", group: "initialization", schemaName: "revokeInitializationGateSchema", actor: "ceo",
    title: { zh: "撤销 G0 验收门（CEO）", en: "Revoke the G0 gate (CEO)" },
    template: { ceoPrincipalRef: "ceo-primary", idempotencyKey: "idempotency-key", reasonCodes: ["replace-me"], evidenceRefs: ["evidence:replace-me"] } },
  { key: "selectOperatingQuestions", group: "selection", schemaName: "selectOperatingQuestionsSchema", actor: "ceo",
    title: { zh: "选择经营问题（0–3 题，需已受理 G0）", en: "Select operating questions (0-3, accepted G0 required)" },
    template: { expectedPortfolioId: "portfolio-id", ceoPrincipalRef: "ceo-primary", idempotencyKey: "idempotency-key",
      selections: [{ questionId: "question-id", questionOverride: null, goal: "Replace with the goal", successMetrics: [{ metricKey: "metric-key", target: "Replace with the target" }],
        priority: 1, implementationScopeRefs: ["scope:replace-me"], ownerRef: null, reviewerRef: null, startsAt: null, endsAt: null,
        prohibitedActions: ["external_side_effect"] }],
      reasonCodes: ["replace-me"], evidenceRefs: ["evidence:replace-me"] } },
  { key: "bindQuestionSelection", group: "selection", schemaName: "bindQuestionSelectionSchema", actor: "ceo",
    title: { zh: "把当前选题绑定到决策记录", en: "Bind the current selection to decision records" },
    template: { expectedSelectionReceiptId: "selection-receipt-id", ceoPrincipalRef: "ceo-primary" } },
];
