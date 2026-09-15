/**
 * Operator panel catalog: one entry per server action, with a schema-valid example template.
 * Pure data so the client bundle carries no service imports. Placeholder refs in templates must be
 * replaced by the operator with real references before submitting.
 */

export const CAIO_OPERATOR_GROUPS = [
  { key: "bindings", title: { zh: "身份绑定", en: "Principal bindings" } },
  { key: "mandate", title: { zh: "授权任命与急停", en: "Mandate and stops" } },
  { key: "catalog", title: { zh: "数据资产目录", en: "Data asset catalog" } },
  { key: "observation", title: { zh: "观察来源", en: "Observation sources" } },
  { key: "initialization", title: { zh: "G0 初始化", en: "G0 initialization" } },
] as const;

export type CaioOperatorGroupKey = (typeof CAIO_OPERATOR_GROUPS)[number]["key"];

export type CaioOperatorOperation = Readonly<{
  key: string;
  group: CaioOperatorGroupKey;
  schemaName: string;
  /** owner: workspace OWNER registers; ceo / guardian: authorized by the registered principal binding. */
  actor: "owner" | "ceo" | "guardian";
  title: { zh: string; en: string };
  template: Readonly<Record<string, unknown>>;
}>;

const NOW = "2026-01-01T00:00:00.000Z";
const LATER = "2026-01-08T00:00:00.000Z";
const stage = { assetId: "asset-id", receiptId: "receipt-id", idempotencyKey: "idempotency-key", expectedVersion: 0, evidenceRefs: ["evidence:replace-me"] };

export const CAIO_OPERATOR_OPERATIONS: readonly CaioOperatorOperation[] = [
  { key: "registerPrincipalBinding", group: "bindings", schemaName: "registerPrincipalBindingSchema", actor: "owner",
    title: { zh: "登记 CEO / guardian / FDE 身份绑定", en: "Register a CEO / guardian / FDE binding" },
    template: { userId: "user-id", principalRef: "ceo-primary", principalKind: "ceo", evidenceRef: "evidence:replace-me" } },
  { key: "revokePrincipalBinding", group: "bindings", schemaName: "revokePrincipalBindingSchema", actor: "owner",
    title: { zh: "吊销身份绑定", en: "Revoke a binding" },
    template: { bindingId: "binding-id" } },
  { key: "createMandateDraft", group: "mandate", schemaName: "createMandateDraftSchema", actor: "owner",
    title: { zh: "创建授权任命草稿", en: "Create a mandate draft" },
    template: { caioRef: "caio-primary", ceoRef: "ceo-primary", stage: "observe", stageDecisionRef: "decision:replace-me",
      objectiveRefs: ["objective:replace-me"], scopeRefs: ["scope:workspace"], grantBasisRefs: ["grant:replace-me"],
      reservedMatterRefs: [], humanResponsePolicyRef: "policy:replace-me", accountabilityAnchorRefs: ["anchor:replace-me"],
      guardianStopRefs: ["guardian-primary"], validFrom: NOW, validUntil: LATER, inFlightDisposition: "freeze", auditRefs: ["audit:replace-me"] } },
  { key: "activateMandate", group: "mandate", schemaName: "mandateTransitionSchema", actor: "ceo",
    title: { zh: "激活授权任命（CEO）", en: "Activate a mandate (CEO)" },
    template: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate-record-id" } },
  { key: "suspendMandate", group: "mandate", schemaName: "mandateTransitionSchema", actor: "ceo",
    title: { zh: "暂停授权任命（CEO）", en: "Suspend a mandate (CEO)" },
    template: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate-record-id" } },
  { key: "revokeMandate", group: "mandate", schemaName: "mandateTransitionSchema", actor: "ceo",
    title: { zh: "撤销授权任命（CEO）", en: "Revoke a mandate (CEO)" },
    template: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate-record-id" } },
  { key: "recordGuardianStop", group: "mandate", schemaName: "guardianStopSchema", actor: "guardian",
    title: { zh: "急停（guardian，只停不启）", en: "Stop (guardian; cannot resume)" },
    template: { guardianRef: "guardian-primary", mandateRecordId: "mandate-record-id", reason: "replace with the stop reason", auditRefs: ["audit:replace-me"] } },
  { key: "resumeGuardianStop", group: "mandate", schemaName: "resumeGuardianStopSchema", actor: "ceo",
    title: { zh: "恢复急停（仅 CEO）", en: "Resume a stop (CEO only)" },
    template: { actorCeoRef: "ceo-primary", stopRecordId: "stop-record-id" } },
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
];
