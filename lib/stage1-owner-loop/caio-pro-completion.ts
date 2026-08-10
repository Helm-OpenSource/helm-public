// CAIO Pro V1 site-deployment completion gate — pure contract layer.
//
// This module operationalizes plan §4.3 plus P4-P8 of
// docs/_planning/HELM_CAIO_PRO_IMPLEMENTATION_PLAN.md as a governed
// post-initialization TODO checklist. "现场部署完成" (site deployment
// complete) may only be claimed when EVERY item below is satisfied with
// real receipts, and the claim itself is a governance record: an accepted
// completion gate authorizes nothing. Full-function operation (全功能工作)
// is a SEPARATE owner action whose precondition — never activation — is an
// accepted completion gate.

import { canonicalJson, sha256 } from "../expert-capability/hashing";

export const CAIO_QUESTION_VALUE_RECEIPT_SCHEMA_VERSION =
  "helm.caio.question-value-receipt.v1" as const;
export const CAIO_PRO_V1_RETROSPECTIVE_RECEIPT_SCHEMA_VERSION =
  "helm.caio.pro-v1-retrospective-receipt.v1" as const;
export const CAIO_PRO_V1_EVIDENCE_ATTESTATION_SCHEMA_VERSION =
  "helm.caio.pro-v1-evidence-attestation.v1" as const;
export const CAIO_PRO_V1_COMPLETION_ASSESSMENT_SCHEMA_VERSION =
  "helm.caio.pro-v1-completion-assessment.v1" as const;
export const CAIO_PRO_V1_COMPLETION_GATE_RECEIPT_SCHEMA_VERSION =
  "helm.caio.pro-v1-completion-gate-receipt.v1" as const;
export const CAIO_PRO_V1_COMPLETION_EVALUATOR_REVISION =
  "caio-pro-v1-completion-evaluator.v1" as const;

// FROZEN boundary literal. Every completion-gate receipt carries this exact
// value: the accepted gate is the PRECONDITION for full-function operation,
// never its activation. Changing this string is a governance change.
export const CAIO_PRO_V1_FULL_FUNCTION_OPERATION_BOUNDARY =
  "not_authorized_by_this_receipt" as const;

// Closed, ordered checklist operationalizing plan §4.3 + P4-P8. Adding,
// removing, or renaming an item is an evaluator revision change.
export const CAIO_PRO_V1_COMPLETION_ITEMS = [
  "p4_asset_inventory_confirmed",
  "p4_asset_states_complete",
  "p5_g0_accepted",
  "p6_portfolio_generated",
  "p6_ceo_selection_recorded",
  "p6_implementation_plans_materialized",
  "p7_supervision_chain_closed",
  "p7_value_receipts_recorded",
  "p3_device_security_accepted",
  "p3_runtime_truth_bound",
  "p8_incident_posture_clear",
  "p8_retrospective_recorded",
  "p8_maturity_decision_recorded",
] as const;

const caioProV1CompletionEvaluatorContractBasis = {
  evaluatorRevision: CAIO_PRO_V1_COMPLETION_EVALUATOR_REVISION,
  assessmentSchemaVersion:
    CAIO_PRO_V1_COMPLETION_ASSESSMENT_SCHEMA_VERSION,
  gateReceiptSchemaVersion:
    CAIO_PRO_V1_COMPLETION_GATE_RECEIPT_SCHEMA_VERSION,
  completionItems: CAIO_PRO_V1_COMPLETION_ITEMS,
  fullFunctionOperationBoundary:
    CAIO_PRO_V1_FULL_FUNCTION_OPERATION_BOUNDARY,
} as const;

// Public consumers bind to this deterministic identity instead of copying the
// 13-item checklist. The release BOM supplies the immutable implementation SHA
// separately; a planning/charter commit is never promoted by this contract.
export const CAIO_PRO_V1_COMPLETION_EVALUATOR_CONTRACT_HASH = sha256(
  canonicalJson(caioProV1CompletionEvaluatorContractBasis),
);
export const CAIO_PRO_V1_COMPLETION_EVALUATOR_CONTRACT_REF =
  `caio-pro-v1-completion-evaluator:${CAIO_PRO_V1_COMPLETION_EVALUATOR_CONTRACT_HASH.slice(7, 23)}` as const;

export type CaioProV1CompletionItemKey =
  (typeof CAIO_PRO_V1_COMPLETION_ITEMS)[number];

// Items that cannot be derived from database state and therefore require an
// OWNER-recorded immutable attestation with a live CEO principal binding.
export const CAIO_PRO_V1_ATTESTABLE_ITEMS = [
  "p4_asset_inventory_confirmed",
  "p3_device_security_accepted",
  "p3_runtime_truth_bound",
  "p8_incident_posture_clear",
  "p8_maturity_decision_recorded",
] as const satisfies readonly CaioProV1CompletionItemKey[];

export type CaioProV1AttestableItemKey =
  (typeof CAIO_PRO_V1_ATTESTABLE_ITEMS)[number];

export const CAIO_QUESTION_VALUE_CLASSES = [
  "direct_value",
  "avoided_loss",
  "efficiency",
  "risk_reduction",
] as const;

export type CaioQuestionValueClass =
  (typeof CAIO_QUESTION_VALUE_CLASSES)[number];

export const CAIO_QUESTION_VALUE_RESULT_WINDOW_MINIMUM_DAYS = 30;

// FROZEN business-value floor (plan §12.5): 模型输出数量、token 使用量、
// 报告篇数、"接了多少系统" are NEVER business value. Any metric key or
// definition matching these shapes (zh + en) is refused fail-closed.
export const CAIO_FORBIDDEN_VALUE_BASES: ReadonlyArray<{
  code: string;
  pattern: RegExp;
}> = [
  { code: "token_usage", pattern: /(?:tokens?|令牌|词元)/iu },
  {
    code: "model_output_count",
    pattern:
      /(模型输出|模型生成数量|model\s*outputs?|outputs?\s*(count|volume|per)|generation\s*count)/iu,
  },
  {
    code: "report_count",
    pattern:
      /(报告篇数|报告数量|reports?\s*(count|generated|produced|per)|number\s*of\s*reports?)/iu,
  },
  {
    code: "system_connection_count",
    pattern:
      /(接了多少系统|连接了多少系统|接入系统数|连接系统数|系统接入数量|systems?\s*(connected|integrated|onboarded)|connected\s*systems?|number\s*of\s*systems?|integration\s*count)/iu,
  },
];

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const DAY_MS = 24 * 60 * 60 * 1_000;

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function isRfc3339(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [
    ...new Set(values.filter(isNonEmpty).map((value) => value.trim())),
  ].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export function findForbiddenValueBases(text: string): string[] {
  const codes: string[] = [];
  for (const rule of CAIO_FORBIDDEN_VALUE_BASES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(text)) {
      codes.push(rule.code);
    }
  }
  return codes;
}

export type CaioProV1Validation = {
  valid: boolean;
  errors: string[];
};

// ---------------------------------------------------------------------------
// Single-question value receipt (plan §12.5).
// ---------------------------------------------------------------------------

export type CaioTimeWindow = {
  start: string;
  end: string;
};

export type CaioQuestionValueMetricDefinition = {
  metricKey: string;
  definition: string;
  dataSourceRefs: string[];
};

export type CaioQuestionValueObservedDelta = {
  description: string;
  quantifiedValue: number | null;
  currency: string | null;
  confidence: "low" | "medium" | "high";
  evidenceRefs: string[];
};

export type CaioQuestionValueReceipt = {
  schemaVersion: typeof CAIO_QUESTION_VALUE_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  workspaceRef: string;
  selectionReceiptRef: string;
  questionId: string;
  baselineWindow: CaioTimeWindow;
  resultWindow: CaioTimeWindow;
  // Recording a shorter-than-30-day result window requires an explicit
  // shortfall reason. Such a receipt stays recordable evidence but can NEVER
  // mark p7_value_receipts_recorded satisfied — fail-closed, no shortcut.
  resultWindowShortfallReason: string | null;
  metricDefinitions: CaioQuestionValueMetricDefinition[];
  observedDelta: CaioQuestionValueObservedDelta;
  adviceRefs: string[];
  decisionRefs: string[];
  executionReceiptRefs: string[];
  acceptanceReceiptRefs: string[];
  counterfactualNotes: string;
  externalFactorNotes: string;
  valueClasses: CaioQuestionValueClass[];
  // Honesty requirement: an empty unproven-parts list is refused. A value
  // claim with nothing unproven is not credible evidence.
  unprovenParts: string[];
  nextStepRecommendation: string;
  ownerConclusion: "continue" | "adjust" | "stop" | "shadow";
  authorityEffect: "none";
  recordedAt: string;
  contentHash: string;
};

export type CaioQuestionValueReceiptInput = Omit<
  CaioQuestionValueReceipt,
  "schemaVersion" | "receiptId" | "contentHash" | "authorityEffect"
>;

function valueReceiptErrors(
  receipt: Omit<CaioQuestionValueReceipt, "receiptId" | "contentHash">,
): string[] {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !== CAIO_QUESTION_VALUE_RECEIPT_SCHEMA_VERSION
  ) {
    errors.push("value_receipt_schema_version_invalid");
  }
  if (
    !isNonEmpty(receipt.workspaceRef) ||
    !isNonEmpty(receipt.selectionReceiptRef) ||
    !isNonEmpty(receipt.questionId) ||
    !isRfc3339(receipt.recordedAt)
  ) {
    errors.push("value_receipt_required_field_invalid");
  }
  const windows = [receipt.baselineWindow, receipt.resultWindow];
  for (const window of windows) {
    if (
      !isRfc3339(window.start) ||
      !isRfc3339(window.end) ||
      Date.parse(window.start) >= Date.parse(window.end)
    ) {
      errors.push("value_receipt_window_invalid");
    }
  }
  if (
    isRfc3339(receipt.baselineWindow.end) &&
    isRfc3339(receipt.resultWindow.start) &&
    Date.parse(receipt.baselineWindow.end) >
      Date.parse(receipt.resultWindow.start)
  ) {
    errors.push("value_receipt_baseline_after_result_window");
  }
  const spanSatisfied =
    isRfc3339(receipt.resultWindow.start) &&
    isRfc3339(receipt.resultWindow.end) &&
    Date.parse(receipt.resultWindow.end) -
      Date.parse(receipt.resultWindow.start) >=
      CAIO_QUESTION_VALUE_RESULT_WINDOW_MINIMUM_DAYS * DAY_MS;
  if (!spanSatisfied && !isNonEmpty(receipt.resultWindowShortfallReason)) {
    errors.push("value_receipt_result_window_below_minimum");
  }
  if (
    receipt.resultWindowShortfallReason !== null &&
    !isNonEmpty(receipt.resultWindowShortfallReason)
  ) {
    errors.push("value_receipt_shortfall_reason_invalid");
  }
  if (receipt.metricDefinitions.length === 0) {
    errors.push("value_receipt_metric_definition_required");
  }
  for (const metric of receipt.metricDefinitions) {
    if (
      !isNonEmpty(metric.metricKey) ||
      !isNonEmpty(metric.definition) ||
      uniqueSorted(metric.dataSourceRefs).length === 0
    ) {
      errors.push("value_receipt_metric_definition_invalid");
    }
    for (const code of findForbiddenValueBases(
      `${metric.metricKey} ${metric.definition}`,
    )) {
      errors.push(`value_receipt_forbidden_value_basis:${code}`);
    }
  }
  const delta = receipt.observedDelta;
  if (
    !isNonEmpty(delta.description) ||
    !["low", "medium", "high"].includes(delta.confidence)
  ) {
    errors.push("value_receipt_observed_delta_invalid");
  }
  if (delta.quantifiedValue !== null) {
    if (!Number.isFinite(delta.quantifiedValue)) {
      errors.push("value_receipt_quantified_value_invalid");
    }
    // A quantified business-value claim must carry its unit of account and
    // resolvable evidence; unsupported numbers are refused.
    if (
      !isNonEmpty(delta.currency) ||
      uniqueSorted(delta.evidenceRefs).length === 0
    ) {
      errors.push("value_receipt_quantified_claim_unsupported");
    }
  }
  if (
    uniqueSorted(receipt.adviceRefs).length === 0 ||
    uniqueSorted(receipt.decisionRefs).length === 0
  ) {
    errors.push("value_receipt_advice_decision_refs_required");
  }
  if (
    !isNonEmpty(receipt.counterfactualNotes) ||
    !isNonEmpty(receipt.externalFactorNotes)
  ) {
    errors.push("value_receipt_counterfactual_notes_required");
  }
  const valueClasses = [...new Set(receipt.valueClasses)];
  if (
    valueClasses.length === 0 ||
    valueClasses.length !== receipt.valueClasses.length ||
    !valueClasses.every((valueClass) =>
      (CAIO_QUESTION_VALUE_CLASSES as readonly string[]).includes(valueClass),
    )
  ) {
    errors.push("value_receipt_value_classes_invalid");
  }
  if (uniqueSorted(receipt.unprovenParts).length === 0) {
    errors.push("value_receipt_unproven_parts_required");
  }
  if (!isNonEmpty(receipt.nextStepRecommendation)) {
    errors.push("value_receipt_next_step_required");
  }
  if (
    !["continue", "adjust", "stop", "shadow"].includes(
      receipt.ownerConclusion,
    )
  ) {
    errors.push("value_receipt_owner_conclusion_invalid");
  }
  if (receipt.authorityEffect !== "none") {
    errors.push("value_receipt_authority_effect_invalid");
  }
  return [...new Set(errors)];
}

function normalizedValueReceiptSeed(
  input: CaioQuestionValueReceiptInput,
): Omit<CaioQuestionValueReceipt, "receiptId" | "contentHash"> {
  return {
    schemaVersion: CAIO_QUESTION_VALUE_RECEIPT_SCHEMA_VERSION,
    workspaceRef: input.workspaceRef.trim(),
    selectionReceiptRef: input.selectionReceiptRef.trim(),
    questionId: input.questionId.trim(),
    baselineWindow: { ...input.baselineWindow },
    resultWindow: { ...input.resultWindow },
    resultWindowShortfallReason:
      input.resultWindowShortfallReason?.trim() || null,
    metricDefinitions: input.metricDefinitions.map((metric) => ({
      metricKey: metric.metricKey.trim(),
      definition: metric.definition.trim(),
      dataSourceRefs: uniqueSorted(metric.dataSourceRefs),
    })),
    observedDelta: {
      description: input.observedDelta.description.trim(),
      quantifiedValue: input.observedDelta.quantifiedValue,
      currency: input.observedDelta.currency?.trim() || null,
      confidence: input.observedDelta.confidence,
      evidenceRefs: uniqueSorted(input.observedDelta.evidenceRefs),
    },
    adviceRefs: uniqueSorted(input.adviceRefs),
    decisionRefs: uniqueSorted(input.decisionRefs),
    executionReceiptRefs: uniqueSorted(input.executionReceiptRefs),
    acceptanceReceiptRefs: uniqueSorted(input.acceptanceReceiptRefs),
    counterfactualNotes: input.counterfactualNotes.trim(),
    externalFactorNotes: input.externalFactorNotes.trim(),
    valueClasses: [...new Set(input.valueClasses)].sort(),
    unprovenParts: uniqueSorted(input.unprovenParts),
    nextStepRecommendation: input.nextStepRecommendation.trim(),
    ownerConclusion: input.ownerConclusion,
    authorityEffect: "none",
    recordedAt: input.recordedAt,
  };
}

export function createCaioQuestionValueReceipt(
  input: CaioQuestionValueReceiptInput,
): CaioQuestionValueReceipt {
  const seed = normalizedValueReceiptSeed(input);
  const errors = valueReceiptErrors(seed);
  if (errors.length > 0) {
    throw new Error(
      `caio_question_value_receipt_invalid:${errors.join(",")}`,
    );
  }
  const seedHash = sha256(canonicalJson(seed));
  const content = {
    ...seed,
    receiptId: `caio-question-value:${seedHash.slice(7, 31)}`,
  };
  return { ...content, contentHash: sha256(canonicalJson(content)) };
}

export function validateCaioQuestionValueReceipt(
  receipt: CaioQuestionValueReceipt,
): CaioProV1Validation {
  const errors = valueReceiptErrors(receipt);
  if (!isNonEmpty(receipt.receiptId)) {
    errors.push("value_receipt_id_required");
  }
  const { contentHash: _contentHash, ...content } = receipt;
  if (receipt.contentHash !== sha256(canonicalJson(content))) {
    errors.push("value_receipt_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

// True only when the receipt is valid AND its result window genuinely spans
// the 30-day minimum with NO shortfall reason. A shortfall receipt can never
// satisfy p7_value_receipts_recorded via this path.
export function caioQuestionValueReceiptWindowSatisfied(
  receipt: CaioQuestionValueReceipt,
): boolean {
  if (!validateCaioQuestionValueReceipt(receipt).valid) return false;
  if (receipt.resultWindowShortfallReason !== null) return false;
  return (
    Date.parse(receipt.resultWindow.end) -
      Date.parse(receipt.resultWindow.start) >=
    CAIO_QUESTION_VALUE_RESULT_WINDOW_MINIMUM_DAYS * DAY_MS
  );
}

// ---------------------------------------------------------------------------
// P8 retrospective receipt.
// ---------------------------------------------------------------------------

export type CaioProV1MaturityEvaluation = {
  actionCategory: string;
  recommendation: "observe" | "advise" | "supervise" | "hold";
  evidenceRefs: string[];
};

export type CaioProV1RetrospectiveReceipt = {
  schemaVersion: typeof CAIO_PRO_V1_RETROSPECTIVE_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  workspaceRef: string;
  selectionReceiptRef: string;
  reusablePackAssetRefs: string[];
  customerOverlayRefs: string[];
  maturityEvaluations: CaioProV1MaturityEvaluation[];
  overallRecommendation: "continue" | "adjust" | "stop" | "shadow";
  // FROZEN: a retrospective records recommendations ONLY. Maturity NEVER
  // auto-promotes from this receipt — per-action-category promotion is a
  // separate CEO/owner authorization outside this module.
  maturityPromotionEffect: "none";
  authorityEffect: "none";
  recordedAt: string;
  contentHash: string;
};

export type CaioProV1RetrospectiveReceiptInput = Omit<
  CaioProV1RetrospectiveReceipt,
  | "schemaVersion"
  | "receiptId"
  | "contentHash"
  | "authorityEffect"
  | "maturityPromotionEffect"
>;

function retrospectiveErrors(
  receipt: Omit<CaioProV1RetrospectiveReceipt, "receiptId" | "contentHash">,
): string[] {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !==
    CAIO_PRO_V1_RETROSPECTIVE_RECEIPT_SCHEMA_VERSION
  ) {
    errors.push("retrospective_schema_version_invalid");
  }
  if (
    !isNonEmpty(receipt.workspaceRef) ||
    !isNonEmpty(receipt.selectionReceiptRef) ||
    !isRfc3339(receipt.recordedAt)
  ) {
    errors.push("retrospective_required_field_invalid");
  }
  if (receipt.maturityEvaluations.length === 0) {
    errors.push("retrospective_maturity_evaluation_required");
  }
  const categories = new Set<string>();
  for (const evaluation of receipt.maturityEvaluations) {
    if (
      !isNonEmpty(evaluation.actionCategory) ||
      !["observe", "advise", "supervise", "hold"].includes(
        evaluation.recommendation,
      ) ||
      uniqueSorted(evaluation.evidenceRefs).length === 0
    ) {
      errors.push("retrospective_maturity_evaluation_invalid");
    }
    if (categories.has(evaluation.actionCategory.trim())) {
      errors.push("retrospective_maturity_category_duplicated");
    }
    categories.add(evaluation.actionCategory.trim());
  }
  if (
    !["continue", "adjust", "stop", "shadow"].includes(
      receipt.overallRecommendation,
    )
  ) {
    errors.push("retrospective_overall_recommendation_invalid");
  }
  if (
    receipt.maturityPromotionEffect !== "none" ||
    receipt.authorityEffect !== "none"
  ) {
    errors.push("retrospective_promotion_boundary_invalid");
  }
  return [...new Set(errors)];
}

export function createCaioProV1RetrospectiveReceipt(
  input: CaioProV1RetrospectiveReceiptInput,
): CaioProV1RetrospectiveReceipt {
  const seed: Omit<
    CaioProV1RetrospectiveReceipt,
    "receiptId" | "contentHash"
  > = {
    schemaVersion: CAIO_PRO_V1_RETROSPECTIVE_RECEIPT_SCHEMA_VERSION,
    workspaceRef: input.workspaceRef.trim(),
    selectionReceiptRef: input.selectionReceiptRef.trim(),
    reusablePackAssetRefs: uniqueSorted(input.reusablePackAssetRefs),
    customerOverlayRefs: uniqueSorted(input.customerOverlayRefs),
    maturityEvaluations: [...input.maturityEvaluations]
      .map((evaluation) => ({
        actionCategory: evaluation.actionCategory.trim(),
        recommendation: evaluation.recommendation,
        evidenceRefs: uniqueSorted(evaluation.evidenceRefs),
      }))
      .sort((left, right) =>
        left.actionCategory.localeCompare(right.actionCategory),
      ),
    overallRecommendation: input.overallRecommendation,
    maturityPromotionEffect: "none",
    authorityEffect: "none",
    recordedAt: input.recordedAt,
  };
  const errors = retrospectiveErrors(seed);
  if (errors.length > 0) {
    throw new Error(
      `caio_pro_v1_retrospective_receipt_invalid:${errors.join(",")}`,
    );
  }
  const seedHash = sha256(canonicalJson(seed));
  const content = {
    ...seed,
    receiptId: `caio-pro-v1-retrospective:${seedHash.slice(7, 31)}`,
  };
  return { ...content, contentHash: sha256(canonicalJson(content)) };
}

export function validateCaioProV1RetrospectiveReceipt(
  receipt: CaioProV1RetrospectiveReceipt,
): CaioProV1Validation {
  const errors = retrospectiveErrors(receipt);
  if (!isNonEmpty(receipt.receiptId)) {
    errors.push("retrospective_receipt_id_required");
  }
  const { contentHash: _contentHash, ...content } = receipt;
  if (receipt.contentHash !== sha256(canonicalJson(content))) {
    errors.push("retrospective_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

// ---------------------------------------------------------------------------
// Owner evidence attestation (non-derivable items only).
// ---------------------------------------------------------------------------

export type CaioProV1EvidenceAttestation = {
  schemaVersion: typeof CAIO_PRO_V1_EVIDENCE_ATTESTATION_SCHEMA_VERSION;
  attestationId: string;
  workspaceRef: string;
  itemKey: CaioProV1AttestableItemKey;
  version: number;
  statement: string;
  evidenceRefs: string[];
  ceoPrincipalBindingRef: string;
  ceoPrincipalRef: string;
  actorUserRef: string;
  // Who actually recorded the attestation: the bound CEO themself, or a
  // bound FDE (field deployment engineer) helping the CEO complete the
  // P4-P8 TODOs. The CEO seat above stays the accountable anchor either
  // way; recording is delegable, ACCEPTANCE never is.
  recordedByPrincipalKind: "ceo" | "fde";
  recordedByPrincipalRef: string;
  recordedByBindingRef: string;
  authorityEffect: "none";
  recordedAt: string;
  contentHash: string;
};

export type CaioProV1EvidenceAttestationInput = Omit<
  CaioProV1EvidenceAttestation,
  "schemaVersion" | "attestationId" | "contentHash" | "authorityEffect"
>;

function attestationErrors(
  attestation: Omit<
    CaioProV1EvidenceAttestation,
    "attestationId" | "contentHash"
  >,
): string[] {
  const errors: string[] = [];
  if (
    attestation.schemaVersion !==
    CAIO_PRO_V1_EVIDENCE_ATTESTATION_SCHEMA_VERSION
  ) {
    errors.push("attestation_schema_version_invalid");
  }
  if (
    !(CAIO_PRO_V1_ATTESTABLE_ITEMS as readonly string[]).includes(
      attestation.itemKey,
    )
  ) {
    errors.push("attestation_item_key_not_attestable");
  }
  if (
    !isNonEmpty(attestation.workspaceRef) ||
    !isNonEmpty(attestation.statement) ||
    uniqueSorted(attestation.evidenceRefs).length === 0 ||
    !isNonEmpty(attestation.ceoPrincipalBindingRef) ||
    !isNonEmpty(attestation.ceoPrincipalRef) ||
    !isNonEmpty(attestation.actorUserRef) ||
    !Number.isInteger(attestation.version) ||
    attestation.version < 1 ||
    !isRfc3339(attestation.recordedAt)
  ) {
    errors.push("attestation_required_field_invalid");
  }
  if (attestation.authorityEffect !== "none") {
    errors.push("attestation_authority_effect_invalid");
  }
  if (
    attestation.recordedByPrincipalKind !== "ceo" &&
    attestation.recordedByPrincipalKind !== "fde"
  ) {
    errors.push("attestation_recorder_kind_invalid");
  } else if (attestation.recordedByPrincipalKind === "ceo") {
    // The CEO recording for themself must reference their own seat.
    if (
      attestation.recordedByPrincipalRef !== attestation.ceoPrincipalRef ||
      attestation.recordedByBindingRef !== attestation.ceoPrincipalBindingRef
    ) {
      errors.push("attestation_recorder_seat_mismatch");
    }
  } else if (
    !isNonEmpty(attestation.recordedByPrincipalRef) ||
    !isNonEmpty(attestation.recordedByBindingRef) ||
    attestation.recordedByPrincipalRef === attestation.ceoPrincipalRef
  ) {
    // An FDE recorder is a DISTINCT seat: it can never be the CEO ref.
    errors.push("attestation_fde_recorder_invalid");
  }
  return [...new Set(errors)];
}

export function createCaioProV1EvidenceAttestation(
  input: CaioProV1EvidenceAttestationInput,
): CaioProV1EvidenceAttestation {
  const seed: Omit<
    CaioProV1EvidenceAttestation,
    "attestationId" | "contentHash"
  > = {
    schemaVersion: CAIO_PRO_V1_EVIDENCE_ATTESTATION_SCHEMA_VERSION,
    workspaceRef: input.workspaceRef.trim(),
    itemKey: input.itemKey,
    version: input.version,
    statement: input.statement.trim(),
    evidenceRefs: uniqueSorted(input.evidenceRefs),
    ceoPrincipalBindingRef: input.ceoPrincipalBindingRef.trim(),
    ceoPrincipalRef: input.ceoPrincipalRef.trim(),
    actorUserRef: input.actorUserRef.trim(),
    recordedByPrincipalKind: input.recordedByPrincipalKind,
    recordedByPrincipalRef: input.recordedByPrincipalRef.trim(),
    recordedByBindingRef: input.recordedByBindingRef.trim(),
    authorityEffect: "none",
    recordedAt: input.recordedAt,
  };
  const errors = attestationErrors(seed);
  if (errors.length > 0) {
    throw new Error(
      `caio_pro_v1_evidence_attestation_invalid:${errors.join(",")}`,
    );
  }
  const seedHash = sha256(canonicalJson(seed));
  const content = {
    ...seed,
    attestationId: `caio-pro-v1-attestation:${seedHash.slice(7, 31)}`,
  };
  return { ...content, contentHash: sha256(canonicalJson(content)) };
}

export function validateCaioProV1EvidenceAttestation(
  attestation: CaioProV1EvidenceAttestation,
): CaioProV1Validation {
  const errors = attestationErrors(attestation);
  if (!isNonEmpty(attestation.attestationId)) {
    errors.push("attestation_id_required");
  }
  const { contentHash: _contentHash, ...content } = attestation;
  if (attestation.contentHash !== sha256(canonicalJson(content))) {
    errors.push("attestation_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

// ---------------------------------------------------------------------------
// Completion assessment (deterministic, pure).
// ---------------------------------------------------------------------------

export type CaioProV1SupervisionChainEvidence = {
  questionId: string;
  decisionRecordRef: string;
  dispatchedWorkPacketRef: string | null;
  verifiedExecutionReceiptRef: string | null;
  evaluationRecordedAt: string | null;
  observedMemoryCandidateRef: string | null;
};

export type CaioProV1ImplementationPlanEvidence = {
  questionId: string;
  decisionRecordRef: string | null;
  implementationPlanRef: string | null;
};

// Raw evidence only. The caller (store) projects database state into this
// shape; it never supplies per-item satisfied flags — the evaluator judges.
export type CaioProV1CompletionAssessmentInput = {
  schemaVersion: typeof CAIO_PRO_V1_COMPLETION_ASSESSMENT_SCHEMA_VERSION;
  workspaceRef: string;
  evaluatedAt: string;
  attestations: CaioProV1EvidenceAttestation[];
  catalog: {
    assetCount: number;
    completeStateCount: number;
    evidenceRefs: string[];
  };
  g0: {
    acceptedGateReceiptRef: string | null;
    acceptedAssessmentRef: string | null;
    gateCurrentlyAccepted: boolean;
  };
  portfolio: {
    currentPortfolioRef: string | null;
    candidateCount: number | null;
    boundGateReceiptRef: string | null;
  };
  selection: {
    currentSelectionReceiptRef: string | null;
    selectedQuestionIds: string[];
    portfolioRef: string | null;
    portfolioHashBound: boolean;
  };
  implementationPlans: CaioProV1ImplementationPlanEvidence[];
  supervisionChains: CaioProV1SupervisionChainEvidence[];
  valueReceipts: CaioQuestionValueReceipt[];
  retrospective: CaioProV1RetrospectiveReceipt | null;
};

export type CaioProV1CompletionItemAssessment = {
  itemKey: CaioProV1CompletionItemKey;
  status: "satisfied" | "missing";
  reasonCodes: string[];
  evidenceRefs: string[];
};

export type CaioProV1CompletionAssessment = {
  schemaVersion: typeof CAIO_PRO_V1_COMPLETION_ASSESSMENT_SCHEMA_VERSION;
  assessmentId: string;
  workspaceRef: string;
  evaluatorRevision: typeof CAIO_PRO_V1_COMPLETION_EVALUATOR_REVISION;
  basisHash: string;
  decision: "not_ready" | "ready_for_owner_acceptance";
  items: CaioProV1CompletionItemAssessment[];
  missingItemKeys: CaioProV1CompletionItemKey[];
  ownerAcceptanceRequired: true;
  authorityEffect: "none";
  fullFunctionOperation: typeof CAIO_PRO_V1_FULL_FUNCTION_OPERATION_BOUNDARY;
  evaluatedAt: string;
  contentHash: string;
};

function normalizedAssessmentInput(
  input: CaioProV1CompletionAssessmentInput,
): Omit<CaioProV1CompletionAssessmentInput, "evaluatedAt"> {
  const byId = <T>(values: readonly T[], key: (value: T) => string): T[] =>
    [...values].sort((left, right) => key(left).localeCompare(key(right)));
  return {
    schemaVersion: input.schemaVersion,
    workspaceRef: input.workspaceRef.trim(),
    attestations: byId(
      input.attestations,
      (attestation) => `${attestation.itemKey}:${attestation.version}`,
    ),
    catalog: {
      assetCount: input.catalog.assetCount,
      completeStateCount: input.catalog.completeStateCount,
      evidenceRefs: uniqueSorted(input.catalog.evidenceRefs),
    },
    g0: { ...input.g0 },
    portfolio: { ...input.portfolio },
    selection: {
      ...input.selection,
      selectedQuestionIds: uniqueSorted(input.selection.selectedQuestionIds),
    },
    implementationPlans: byId(
      input.implementationPlans,
      (plan) => plan.questionId,
    ),
    supervisionChains: byId(
      input.supervisionChains,
      (chain) => chain.questionId,
    ),
    valueReceipts: byId(
      input.valueReceipts,
      (receipt) => `${receipt.questionId}:${receipt.receiptId}`,
    ),
    retrospective: input.retrospective,
  };
}

type ItemJudgement = {
  satisfied: boolean;
  reasonCodes: string[];
  evidenceRefs: string[];
};

// Ruling on revoked recorder bindings: an attestation is CONTENT-effective —
// it stays satisfied even if the binding that recorded it is later revoked,
// because the evidence it points at did not change. Live-actor checks
// remain enforced where they matter: acceptance and revocation always
// re-assert the ACTING user's live CEO binding at signing time.
function judgeAttestedItem(
  itemKey: CaioProV1AttestableItemKey,
  attestations: readonly CaioProV1EvidenceAttestation[],
  workspaceRef: string,
): ItemJudgement {
  const candidates = attestations
    .filter(
      (attestation) =>
        attestation.itemKey === itemKey &&
        attestation.workspaceRef === workspaceRef &&
        validateCaioProV1EvidenceAttestation(attestation).valid,
    )
    .sort((left, right) => right.version - left.version);
  const latest = candidates[0];
  if (!latest) {
    return {
      satisfied: false,
      reasonCodes: ["owner_attestation_missing"],
      evidenceRefs: [],
    };
  }
  return {
    satisfied: true,
    reasonCodes: [],
    evidenceRefs: uniqueSorted([
      latest.attestationId,
      ...latest.evidenceRefs,
    ]),
  };
}

export function computeCaioProV1CompletionAssessment(
  input: CaioProV1CompletionAssessmentInput,
): CaioProV1CompletionAssessment {
  if (
    input.schemaVersion !==
      CAIO_PRO_V1_COMPLETION_ASSESSMENT_SCHEMA_VERSION ||
    !isNonEmpty(input.workspaceRef) ||
    !isRfc3339(input.evaluatedAt)
  ) {
    throw new Error("caio_pro_v1_completion_input_invalid");
  }
  const normalized = normalizedAssessmentInput(input);
  const basisHash = sha256(canonicalJson(normalized));
  const selectedQuestionIds = normalized.selection.selectedQuestionIds;
  const selectionRecorded =
    normalized.selection.currentSelectionReceiptRef !== null &&
    isNonEmpty(normalized.selection.currentSelectionReceiptRef) &&
    selectedQuestionIds.length <= 3 &&
    normalized.selection.portfolioRef !== null &&
    normalized.selection.portfolioRef ===
      normalized.portfolio.currentPortfolioRef &&
    normalized.selection.portfolioHashBound;
  const plansByQuestion = new Map(
    normalized.implementationPlans.map((plan) => [plan.questionId, plan]),
  );
  const chainsByQuestion = new Map(
    normalized.supervisionChains.map((chain) => [chain.questionId, chain]),
  );

  const judgements = new Map<CaioProV1CompletionItemKey, ItemJudgement>();

  for (const itemKey of CAIO_PRO_V1_ATTESTABLE_ITEMS) {
    judgements.set(
      itemKey,
      judgeAttestedItem(itemKey, normalized.attestations, normalized.workspaceRef),
    );
  }

  judgements.set("p4_asset_states_complete", {
    satisfied:
      normalized.catalog.assetCount > 0 &&
      normalized.catalog.completeStateCount === normalized.catalog.assetCount,
    reasonCodes:
      normalized.catalog.assetCount === 0
        ? ["asset_catalog_empty"]
        : normalized.catalog.completeStateCount !==
            normalized.catalog.assetCount
          ? ["asset_state_incomplete"]
          : [],
    evidenceRefs: normalized.catalog.evidenceRefs,
  });

  const g0Satisfied =
    normalized.g0.acceptedGateReceiptRef !== null &&
    isNonEmpty(normalized.g0.acceptedGateReceiptRef) &&
    normalized.g0.acceptedAssessmentRef !== null &&
    normalized.g0.gateCurrentlyAccepted;
  judgements.set("p5_g0_accepted", {
    satisfied: g0Satisfied,
    reasonCodes: g0Satisfied ? [] : ["accepted_g0_gate_not_current"],
    evidenceRefs: uniqueSorted([
      normalized.g0.acceptedGateReceiptRef ?? "",
      normalized.g0.acceptedAssessmentRef ?? "",
    ]),
  });

  const portfolioSatisfied =
    normalized.portfolio.currentPortfolioRef !== null &&
    normalized.portfolio.candidateCount === 10 &&
    g0Satisfied &&
    normalized.portfolio.boundGateReceiptRef ===
      normalized.g0.acceptedGateReceiptRef;
  judgements.set("p6_portfolio_generated", {
    satisfied: portfolioSatisfied,
    reasonCodes: portfolioSatisfied
      ? []
      : normalized.portfolio.currentPortfolioRef === null
        ? ["current_portfolio_missing"]
        : ["current_portfolio_not_bound_to_accepted_g0"],
    evidenceRefs: uniqueSorted([
      normalized.portfolio.currentPortfolioRef ?? "",
    ]),
  });

  judgements.set("p6_ceo_selection_recorded", {
    satisfied: selectionRecorded && portfolioSatisfied,
    reasonCodes:
      selectionRecorded && portfolioSatisfied
        ? []
        : normalized.selection.currentSelectionReceiptRef === null
          ? ["ceo_selection_missing"]
          : ["ceo_selection_not_bound_to_current_portfolio"],
    evidenceRefs: uniqueSorted([
      normalized.selection.currentSelectionReceiptRef ?? "",
    ]),
  });

  const planGaps = selectedQuestionIds.filter((questionId) => {
    const plan = plansByQuestion.get(questionId);
    return (
      !plan ||
      !isNonEmpty(plan.decisionRecordRef ?? "") ||
      !isNonEmpty(plan.implementationPlanRef ?? "")
    );
  });
  judgements.set("p6_implementation_plans_materialized", {
    satisfied:
      selectionRecorded &&
      selectedQuestionIds.length > 0 &&
      planGaps.length === 0,
    reasonCodes: !selectionRecorded
      ? ["ceo_selection_required_first"]
      : selectedQuestionIds.length === 0
        ? ["zero_selection_requires_a_later_completed_question_round"]
        : planGaps.length > 0
          ? planGaps.map(
              (questionId) => `implementation_plan_missing:${questionId}`,
            )
          : [],
    evidenceRefs: uniqueSorted(
      selectedQuestionIds.flatMap((questionId) => {
        const plan = plansByQuestion.get(questionId);
        return plan
          ? [plan.decisionRecordRef ?? "", plan.implementationPlanRef ?? ""]
          : [];
      }),
    ),
  });

  // A ZERO-question selection is a legitimate governance receipt (the CEO
  // may defer, P1C allows 0-3), but it can never constitute site-deployment
  // completion: full-function work only starts after at least one question
  // has actually travelled the whole supervised 30-day journey. P7 items
  // therefore stay MISSING under a zero selection — a later selection round
  // must close at least one real chain before the gate can become ready.
  const closedChains = selectedQuestionIds
    .map((questionId) => chainsByQuestion.get(questionId))
    .filter(
      (chain): chain is CaioProV1SupervisionChainEvidence =>
        chain !== undefined &&
        isNonEmpty(chain.decisionRecordRef) &&
        isNonEmpty(chain.dispatchedWorkPacketRef ?? "") &&
        isNonEmpty(chain.verifiedExecutionReceiptRef ?? "") &&
        chain.evaluationRecordedAt !== null &&
        isRfc3339(chain.evaluationRecordedAt) &&
        isNonEmpty(chain.observedMemoryCandidateRef ?? ""),
    );
  const supervisionSatisfied =
    selectionRecorded &&
    selectedQuestionIds.length > 0 &&
    closedChains.length >= 1;
  judgements.set("p7_supervision_chain_closed", {
    satisfied: supervisionSatisfied,
    reasonCodes: !selectionRecorded
      ? ["ceo_selection_required_first"]
      : selectedQuestionIds.length === 0
        ? ["zero_selection_requires_a_later_completed_question_round"]
        : closedChains.length >= 1
          ? []
          : ["no_selected_question_has_closed_supervision_chain"],
    evidenceRefs: uniqueSorted(
      closedChains.flatMap((chain) => [
        chain.decisionRecordRef,
        chain.dispatchedWorkPacketRef ?? "",
        chain.verifiedExecutionReceiptRef ?? "",
        chain.observedMemoryCandidateRef ?? "",
      ]),
    ),
  });

  const valueReceiptGaps = selectedQuestionIds.filter((questionId) => {
    const receipt = normalized.valueReceipts.find(
      (candidate) =>
        candidate.questionId === questionId &&
        candidate.selectionReceiptRef ===
          normalized.selection.currentSelectionReceiptRef,
    );
    return !receipt || !caioQuestionValueReceiptWindowSatisfied(receipt);
  });
  judgements.set("p7_value_receipts_recorded", {
    satisfied:
      selectionRecorded &&
      selectedQuestionIds.length > 0 &&
      valueReceiptGaps.length === 0,
    reasonCodes: !selectionRecorded
      ? ["ceo_selection_required_first"]
      : selectedQuestionIds.length === 0
        ? ["zero_selection_requires_a_later_completed_question_round"]
        : valueReceiptGaps.map(
            (questionId) => `value_receipt_missing_or_unsatisfied:${questionId}`,
          ),
    evidenceRefs: uniqueSorted(
      normalized.valueReceipts
        .filter((receipt) =>
          selectedQuestionIds.includes(receipt.questionId),
        )
        .map((receipt) => receipt.receiptId),
    ),
  });

  const retrospective = normalized.retrospective;
  const retrospectiveSatisfied =
    selectionRecorded &&
    retrospective !== null &&
    validateCaioProV1RetrospectiveReceipt(retrospective).valid &&
    retrospective.selectionReceiptRef ===
      normalized.selection.currentSelectionReceiptRef;
  judgements.set("p8_retrospective_recorded", {
    satisfied: retrospectiveSatisfied,
    reasonCodes: retrospectiveSatisfied
      ? []
      : !selectionRecorded
        ? ["ceo_selection_required_first"]
        : retrospective === null
          ? ["retrospective_receipt_missing"]
          : ["retrospective_receipt_invalid_or_unbound"],
    evidenceRefs: retrospective ? [retrospective.receiptId] : [],
  });

  const items: CaioProV1CompletionItemAssessment[] =
    CAIO_PRO_V1_COMPLETION_ITEMS.map((itemKey) => {
      const judgement = judgements.get(itemKey);
      if (!judgement) {
        throw new Error("caio_pro_v1_completion_item_unjudged");
      }
      return {
        itemKey,
        status: judgement.satisfied ? "satisfied" : "missing",
        reasonCodes: uniqueSorted(judgement.reasonCodes),
        evidenceRefs: judgement.evidenceRefs,
      };
    });
  const missingItemKeys = items
    .filter((item) => item.status === "missing")
    .map((item) => item.itemKey);
  // NO partial pass: every item must be satisfied, or the decision stays
  // not_ready with the full missing list.
  const decision: CaioProV1CompletionAssessment["decision"] =
    missingItemKeys.length === 0 ? "ready_for_owner_acceptance" : "not_ready";

  const seed = {
    schemaVersion: CAIO_PRO_V1_COMPLETION_ASSESSMENT_SCHEMA_VERSION,
    workspaceRef: normalized.workspaceRef,
    evaluatorRevision: CAIO_PRO_V1_COMPLETION_EVALUATOR_REVISION,
    basisHash,
    decision,
    items,
    missingItemKeys,
    ownerAcceptanceRequired: true as const,
    authorityEffect: "none" as const,
    fullFunctionOperation: CAIO_PRO_V1_FULL_FUNCTION_OPERATION_BOUNDARY,
    evaluatedAt: input.evaluatedAt,
  };
  const seedHash = sha256(canonicalJson(seed));
  const content = {
    ...seed,
    assessmentId: `caio-pro-v1-completion-assessment:${seedHash.slice(7, 31)}`,
  };
  return { ...content, contentHash: sha256(canonicalJson(content)) };
}

export function validateCaioProV1CompletionAssessment(
  assessment: CaioProV1CompletionAssessment,
): CaioProV1Validation {
  const errors: string[] = [];
  if (
    assessment.schemaVersion !==
    CAIO_PRO_V1_COMPLETION_ASSESSMENT_SCHEMA_VERSION
  ) {
    errors.push("completion_assessment_schema_version_invalid");
  }
  if (
    !isNonEmpty(assessment.assessmentId) ||
    !isNonEmpty(assessment.workspaceRef) ||
    !isSha256(assessment.basisHash) ||
    !isRfc3339(assessment.evaluatedAt)
  ) {
    errors.push("completion_assessment_required_field_invalid");
  }
  if (
    assessment.evaluatorRevision !==
    CAIO_PRO_V1_COMPLETION_EVALUATOR_REVISION
  ) {
    errors.push("completion_assessment_evaluator_revision_mismatch");
  }
  if (
    assessment.ownerAcceptanceRequired !== true ||
    assessment.authorityEffect !== "none" ||
    assessment.fullFunctionOperation !==
      CAIO_PRO_V1_FULL_FUNCTION_OPERATION_BOUNDARY
  ) {
    errors.push("completion_assessment_governance_boundary_invalid");
  }
  const itemKeys = assessment.items.map((item) => item.itemKey);
  if (
    canonicalJson(itemKeys) !== canonicalJson([...CAIO_PRO_V1_COMPLETION_ITEMS])
  ) {
    errors.push("completion_assessment_item_list_invalid");
  }
  const derivedMissing = assessment.items
    .filter((item) => item.status === "missing")
    .map((item) => item.itemKey);
  if (
    canonicalJson(derivedMissing) !==
    canonicalJson(assessment.missingItemKeys)
  ) {
    errors.push("completion_assessment_missing_list_mismatch");
  }
  if (
    (assessment.missingItemKeys.length === 0) !==
    (assessment.decision === "ready_for_owner_acceptance")
  ) {
    errors.push("completion_assessment_decision_mismatch");
  }
  const { contentHash: _contentHash, ...content } = assessment;
  if (assessment.contentHash !== sha256(canonicalJson(content))) {
    errors.push("completion_assessment_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

// ---------------------------------------------------------------------------
// Completion gate receipt (append-only, hash-chained; mirrors the G0 chain).
// ---------------------------------------------------------------------------

export type CaioProV1CompletionGateReceiptAction = "accept" | "revoke";
export type CaioProV1CompletionGateReceiptStatus = "accepted" | "revoked";

// Full gate state as reported by the status projection: the two receipt
// states plus the two pre-acceptance assessment states.
export type CaioProV1CompletionGateState =
  | "not_ready"
  | "ready_for_owner_acceptance"
  | "accepted"
  | "revoked";

export type CaioProV1CompletionGateReceipt = {
  schemaVersion: typeof CAIO_PRO_V1_COMPLETION_GATE_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  workspaceRef: string;
  assessmentRef: string;
  assessmentHash: string;
  ceoPrincipalBindingRef: string;
  ceoPrincipalRef: string;
  previousReceiptRef: string | null;
  previousReceiptHash: string | null;
  sequence: number;
  idempotencyKey: string;
  action: CaioProV1CompletionGateReceiptAction;
  resultingStatus: CaioProV1CompletionGateReceiptStatus;
  actorType: "USER";
  actorUserRef: string;
  reasonCodes: string[];
  evidenceRefs: string[];
  basisHash: string;
  recordedAt: string;
  authorityEffect: "none";
  fullFunctionOperation: typeof CAIO_PRO_V1_FULL_FUNCTION_OPERATION_BOUNDARY;
  contentHash: string;
};

type PreviousCompletionReceiptBinding = {
  receiptId: string;
  contentHash: string;
  sequence: number;
  resultingStatus: CaioProV1CompletionGateReceiptStatus;
  assessmentRef: string;
  recordedAt: string;
} | null;

type CommonCompletionReceiptInput = {
  workspaceRef: string;
  assessment: CaioProV1CompletionAssessment;
  ceoPrincipalBindingRef: string;
  ceoPrincipalRef: string;
  actorUserRef: string;
  idempotencyKey: string;
  reasonCodes: readonly string[];
  evidenceRefs: readonly string[];
  previousReceipt: PreviousCompletionReceiptBinding;
  recordedAt: string;
};

function commonCompletionSeed(input: CommonCompletionReceiptInput) {
  const assessmentValidation = validateCaioProV1CompletionAssessment(
    input.assessment,
  );
  if (!assessmentValidation.valid) {
    throw new Error(
      `caio_pro_v1_completion_assessment_invalid:${assessmentValidation.errors.join(",")}`,
    );
  }
  if (
    !isNonEmpty(input.workspaceRef) ||
    input.workspaceRef !== input.assessment.workspaceRef ||
    !isNonEmpty(input.ceoPrincipalBindingRef) ||
    !isNonEmpty(input.ceoPrincipalRef) ||
    !isNonEmpty(input.actorUserRef) ||
    !isNonEmpty(input.idempotencyKey) ||
    !isRfc3339(input.recordedAt)
  ) {
    throw new Error("caio_pro_v1_completion_gate_receipt_input_invalid");
  }
  if (
    input.previousReceipt !== null &&
    (!isNonEmpty(input.previousReceipt.receiptId) ||
      !isSha256(input.previousReceipt.contentHash) ||
      !Number.isInteger(input.previousReceipt.sequence) ||
      input.previousReceipt.sequence < 1 ||
      !isNonEmpty(input.previousReceipt.assessmentRef) ||
      !isRfc3339(input.previousReceipt.recordedAt))
  ) {
    throw new Error("caio_pro_v1_completion_gate_previous_receipt_invalid");
  }
  if (
    uniqueSorted(input.reasonCodes).length === 0 ||
    uniqueSorted(input.evidenceRefs).length === 0
  ) {
    throw new Error("caio_pro_v1_completion_gate_evidence_required");
  }
  return {
    schemaVersion: CAIO_PRO_V1_COMPLETION_GATE_RECEIPT_SCHEMA_VERSION,
    workspaceRef: input.workspaceRef.trim(),
    assessmentRef: input.assessment.assessmentId,
    assessmentHash: input.assessment.contentHash,
    ceoPrincipalBindingRef: input.ceoPrincipalBindingRef.trim(),
    ceoPrincipalRef: input.ceoPrincipalRef.trim(),
    previousReceiptRef: input.previousReceipt?.receiptId ?? null,
    previousReceiptHash: input.previousReceipt?.contentHash ?? null,
    sequence: (input.previousReceipt?.sequence ?? 0) + 1,
    idempotencyKey: input.idempotencyKey.trim(),
    actorType: "USER" as const,
    actorUserRef: input.actorUserRef.trim(),
    reasonCodes: uniqueSorted(input.reasonCodes),
    evidenceRefs: uniqueSorted(input.evidenceRefs),
    basisHash: input.assessment.basisHash,
    recordedAt: input.recordedAt,
    authorityEffect: "none" as const,
    fullFunctionOperation: CAIO_PRO_V1_FULL_FUNCTION_OPERATION_BOUNDARY,
  };
}

function finalizeCompletionReceipt(
  seed: Omit<CaioProV1CompletionGateReceipt, "receiptId" | "contentHash">,
): CaioProV1CompletionGateReceipt {
  const seedHash = sha256(canonicalJson(seed));
  const content = {
    ...seed,
    receiptId: `caio-pro-v1-completion-gate:${seedHash.slice(7, 31)}`,
  };
  return { ...content, contentHash: sha256(canonicalJson(content)) };
}

export function createCaioProV1CompletionAcceptanceReceipt(
  input: CommonCompletionReceiptInput,
): CaioProV1CompletionGateReceipt {
  const common = commonCompletionSeed(input);
  // Acceptance requires a ready assessment: any missing checklist item makes
  // acceptance impossible — the gate has NO partial pass.
  if (input.assessment.decision !== "ready_for_owner_acceptance") {
    throw new Error("caio_pro_v1_completion_assessment_not_ready");
  }
  if (
    input.previousReceipt !== null &&
    input.previousReceipt.resultingStatus !== "revoked"
  ) {
    throw new Error("caio_pro_v1_completion_gate_already_accepted");
  }
  // Revoked is terminal per assessment version: re-acceptance needs a newer
  // reassessment computed after the revocation.
  if (
    input.previousReceipt?.resultingStatus === "revoked" &&
    (input.previousReceipt.assessmentRef ===
      input.assessment.assessmentId ||
      Date.parse(input.assessment.evaluatedAt) <=
        Date.parse(input.previousReceipt.recordedAt))
  ) {
    throw new Error(
      "caio_pro_v1_completion_revoked_requires_newer_reassessment",
    );
  }
  return finalizeCompletionReceipt({
    ...common,
    action: "accept",
    resultingStatus: "accepted",
  });
}

export function createCaioProV1CompletionRevocationReceipt(
  input: CommonCompletionReceiptInput,
): CaioProV1CompletionGateReceipt {
  const common = commonCompletionSeed(input);
  if (
    input.previousReceipt === null ||
    input.previousReceipt.resultingStatus !== "accepted"
  ) {
    throw new Error("caio_pro_v1_completion_gate_not_accepted");
  }
  return finalizeCompletionReceipt({
    ...common,
    action: "revoke",
    resultingStatus: "revoked",
  });
}

export function validateCaioProV1CompletionGateReceipt(
  receipt: CaioProV1CompletionGateReceipt,
): CaioProV1Validation {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !==
    CAIO_PRO_V1_COMPLETION_GATE_RECEIPT_SCHEMA_VERSION
  ) {
    errors.push("completion_gate_receipt_schema_version_invalid");
  }
  if (
    !isNonEmpty(receipt.receiptId) ||
    !isNonEmpty(receipt.workspaceRef) ||
    !isNonEmpty(receipt.assessmentRef) ||
    !isSha256(receipt.assessmentHash) ||
    !isNonEmpty(receipt.ceoPrincipalBindingRef) ||
    !isNonEmpty(receipt.ceoPrincipalRef) ||
    !isNonEmpty(receipt.actorUserRef) ||
    !isNonEmpty(receipt.idempotencyKey) ||
    !isSha256(receipt.basisHash) ||
    !isRfc3339(receipt.recordedAt)
  ) {
    errors.push("completion_gate_receipt_required_field_invalid");
  }
  if (
    !Number.isInteger(receipt.sequence) ||
    receipt.sequence < 1 ||
    (receipt.sequence === 1 &&
      (receipt.previousReceiptRef !== null ||
        receipt.previousReceiptHash !== null)) ||
    (receipt.sequence > 1 &&
      (!isNonEmpty(receipt.previousReceiptRef) ||
        !isSha256(receipt.previousReceiptHash)))
  ) {
    errors.push("completion_gate_receipt_chain_binding_invalid");
  }
  if (
    receipt.actorType !== "USER" ||
    receipt.authorityEffect !== "none" ||
    // Validated EXACTLY: the accepted completion gate is the precondition
    // for full-function operation, never its activation.
    receipt.fullFunctionOperation !==
      CAIO_PRO_V1_FULL_FUNCTION_OPERATION_BOUNDARY
  ) {
    errors.push("completion_gate_receipt_governance_boundary_invalid");
  }
  if (
    (receipt.action === "accept") !==
    (receipt.resultingStatus === "accepted")
  ) {
    errors.push("completion_gate_receipt_action_status_mismatch");
  }
  if (
    uniqueSorted(receipt.reasonCodes).length === 0 ||
    uniqueSorted(receipt.evidenceRefs).length === 0
  ) {
    errors.push("completion_gate_receipt_evidence_required");
  }
  const { contentHash: _contentHash, ...content } = receipt;
  if (receipt.contentHash !== sha256(canonicalJson(content))) {
    errors.push("completion_gate_receipt_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
