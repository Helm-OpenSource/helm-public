// Operating Signal Source Governance — public-safe source classification gates.
// Boundary: this module only classifies whether a source may enter public eval /
// improvement loops. It does not ingest production data, call models, write back,
// send externally, or promote memory.

import {
  type EvalCasePromotion,
  type ValidationResult,
  validateEvalCasePromotion,
} from "../expert-capability/validators";

export const OPERATING_SIGNAL_SOURCE_CLASSES = [
  "fleet_customer_health",
  "self_dogfood_health",
  "synthetic_public",
  "deidentified_promoted_case",
  "oss_governance",
] as const;

export type OperatingSignalSourceClass = (typeof OPERATING_SIGNAL_SOURCE_CLASSES)[number];

export const OPERATING_SIGNAL_USES = [
  "operator_triage",
  "advice_only_risk_review",
  "support_readiness",
  "dogfood_improvement",
  "public_eval",
  "heldout_eval",
  "fixture_validation",
  "oss_governance_review",
  "tenant_ingestion",
  "model_improvement",
  "training",
  "memory_promotion",
  "automatic_customer_action",
  "external_send",
  "writeback",
  "performance_evaluation",
] as const;

export type OperatingSignalUse = (typeof OPERATING_SIGNAL_USES)[number];

export type OperatingSignalPromotionState =
  | "blocked"
  | "quarantine"
  | "candidate"
  | "public_eligible"
  | "non_goal";

export type OperatingSignalAliasMode =
  | "none"
  | "reversible_operator_alias"
  | "irreversible_deidentified"
  | "synthetic_alias"
  | "public_handle";

export type OperatingSignalPersonAttributionMode =
  | "none"
  | "role_only"
  | "deidentified_cohort"
  | "person_level";

const PROMOTION_STATES: readonly OperatingSignalPromotionState[] = [
  "blocked",
  "quarantine",
  "candidate",
  "public_eligible",
  "non_goal",
];

const ALIAS_MODES: readonly OperatingSignalAliasMode[] = [
  "none",
  "reversible_operator_alias",
  "irreversible_deidentified",
  "synthetic_alias",
  "public_handle",
];

const PERSON_ATTRIBUTION_MODES: readonly OperatingSignalPersonAttributionMode[] = [
  "none",
  "role_only",
  "deidentified_cohort",
  "person_level",
];

export type OperatingSignalSourceEnvelope = {
  schemaVersion: "helm.operating-signal-source-governance.v1";
  signalId: string;
  sourceClass: OperatingSignalSourceClass;
  allowedUses: OperatingSignalUse[];
  forbiddenUses: OperatingSignalUse[];
  improvementLoopEligible: boolean;
  promotionState: OperatingSignalPromotionState;
  aliasMode: OperatingSignalAliasMode;
  personAttributionMode: OperatingSignalPersonAttributionMode;
  aliasSaltRef?: string | null;
  aliasSaltRotatesAt?: string | null;
  aliasAccessRoles?: string[];
  aliasDecodeAuditRequired?: boolean;
  customerConsentScopeRef?: string | null;
  auditRefs: string[];
  boundaryNote: string;
};

const SOURCE_CLASS_SET = new Set<string>(OPERATING_SIGNAL_SOURCE_CLASSES);
const USE_SET = new Set<string>(OPERATING_SIGNAL_USES);
const PROMOTION_STATE_SET = new Set<string>(PROMOTION_STATES);
const ALIAS_MODE_SET = new Set<string>(ALIAS_MODES);
const PERSON_ATTRIBUTION_MODE_SET = new Set<string>(PERSON_ATTRIBUTION_MODES);

const HIGH_RISK_USES: ReadonlySet<OperatingSignalUse> = new Set([
  "memory_promotion",
  "automatic_customer_action",
  "external_send",
  "writeback",
  "performance_evaluation",
]);

const IMPROVEMENT_USES: ReadonlySet<OperatingSignalUse> = new Set([
  "public_eval",
  "heldout_eval",
  "model_improvement",
  "training",
]);

const CUSTOMER_FLEET_ALLOWED_USES: ReadonlySet<OperatingSignalUse> = new Set([
  "operator_triage",
  "advice_only_risk_review",
  "support_readiness",
]);

const OSS_ALLOWED_USES: ReadonlySet<OperatingSignalUse> = new Set(["oss_governance_review"]);

const SOURCE_CLASS_ALLOWED_USES: Record<
  OperatingSignalSourceClass,
  ReadonlySet<OperatingSignalUse>
> = {
  fleet_customer_health: CUSTOMER_FLEET_ALLOWED_USES,
  self_dogfood_health: new Set(["dogfood_improvement", "public_eval", "heldout_eval"]),
  synthetic_public: new Set(["public_eval", "heldout_eval", "fixture_validation"]),
  deidentified_promoted_case: new Set(["public_eval", "heldout_eval"]),
  oss_governance: OSS_ALLOWED_USES,
};

const FORBIDDEN_KEYS = [
  "rawPayload",
  "rawPrivate",
  "rawBlocked",
  "customerName",
  "customerId",
  "customerEmail",
  "phone",
  "mobile",
  "privateDomain",
  "productionUrl",
  "internalHost",
  "credential",
  "secret",
  "apiKey",
  "token",
  "personId",
  "personName",
  "person_id",
  "person_name",
  "userId",
  "userName",
  "user_id",
  "user_name",
  "employeeId",
  "employeeName",
  "employee_id",
  "employee_name",
  "ownerId",
  "ownerName",
  "owner_id",
  "owner_name",
  "reviewerId",
  "reviewerName",
  "reviewer_id",
  "reviewer_name",
  "assigneeId",
  "assigneeName",
  "assignee_id",
  "assignee_name",
  "approverId",
  "approverName",
  "approver_id",
  "approver_name",
] as const;

const FORBIDDEN_KEY_SET = new Set<string>(FORBIDDEN_KEYS);

const PRIVATE_OR_CONTACT_PATTERNS: readonly RegExp[] = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?<![\d+])(?:\+?86[-\s]?)?1[3-9]\d{9}\b/,
  /\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\b(?:10|127)(?:\.\d{1,3}){3}\b/,
  /\b172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}\b/,
  /\b192\.168(?:\.\d{1,3}){2}\b/,
  /\b(?:internal|corp|intranet|private)\.[a-z0-9.-]+\b/i,
  /\b[a-z0-9.-]+\.internal(?:\.[a-z0-9.-]+)?\b/i,
];

function result(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function hasUse(source: OperatingSignalSourceEnvelope, use: OperatingSignalUse): boolean {
  return source.allowedUses.includes(use) || source.forbiddenUses.includes(use);
}

export function collectUnsafeInputErrors(value: unknown): string[] {
  const errors = new Set<string>();
  let sawPrivatePattern = false;

  function visit(node: unknown): void {
    if (typeof node === "string") {
      if (PRIVATE_OR_CONTACT_PATTERNS.some((pattern) => pattern.test(node))) {
        sawPrivatePattern = true;
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isRecord(node)) return;

    for (const [key, child] of Object.entries(node)) {
      if (FORBIDDEN_KEY_SET.has(key)) errors.add(`forbidden_key_present:${key}`);
      visit(child);
    }
  }

  visit(value);
  if (sawPrivatePattern) errors.add("private_or_contact_pattern_present");
  return [...errors];
}

function validateCommonShape(input: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (input.schemaVersion !== "helm.operating-signal-source-governance.v1") {
    errors.push("invalid_schema_version");
  }
  if (typeof input.signalId !== "string" || input.signalId.length === 0) {
    errors.push("missing_signal_id");
  }
  if (typeof input.sourceClass !== "string" || !SOURCE_CLASS_SET.has(input.sourceClass)) {
    errors.push("invalid_source_class");
  }
  for (const field of ["allowedUses", "forbiddenUses", "auditRefs"] as const) {
    if (!Array.isArray(input[field])) errors.push(`missing_or_invalid_${field}`);
  }
  for (const use of [...stringArray(input.allowedUses), ...stringArray(input.forbiddenUses)]) {
    if (!USE_SET.has(use)) errors.push(`invalid_use:${use}`);
  }
  if (typeof input.improvementLoopEligible !== "boolean") {
    errors.push("missing_improvement_loop_eligibility");
  }
  if (typeof input.promotionState !== "string" || !PROMOTION_STATE_SET.has(input.promotionState)) {
    errors.push("invalid_promotion_state");
  }
  if (typeof input.aliasMode !== "string" || !ALIAS_MODE_SET.has(input.aliasMode)) {
    errors.push("invalid_alias_mode");
  }
  if (
    typeof input.personAttributionMode !== "string" ||
    !PERSON_ATTRIBUTION_MODE_SET.has(input.personAttributionMode)
  ) {
    errors.push("invalid_person_attribution_mode");
  }
  if (typeof input.boundaryNote !== "string" || input.boundaryNote.length === 0) {
    errors.push("missing_boundary_note");
  }
  return errors;
}

export function validateOperatingSignalSourceEnvelope(input: unknown): ValidationResult {
  if (!isRecord(input)) return result(["invalid_source_envelope"]);

  const errors = [...collectUnsafeInputErrors(input), ...validateCommonShape(input)];
  if (errors.some((error) => error === "invalid_source_class")) return result(errors);

  const source = {
    ...input,
    allowedUses: stringArray(input.allowedUses),
    forbiddenUses: stringArray(input.forbiddenUses),
    auditRefs: stringArray(input.auditRefs),
  } as OperatingSignalSourceEnvelope;

  for (const use of source.allowedUses) {
    if (HIGH_RISK_USES.has(use)) errors.push(`high_risk_use_cannot_be_allowed:${use}`);
  }

  for (const requiredForbiddenUse of HIGH_RISK_USES) {
    if (!source.forbiddenUses.includes(requiredForbiddenUse)) {
      errors.push(`missing_forbidden_use:${requiredForbiddenUse}`);
    }
  }

  const allowedUsesForClass = SOURCE_CLASS_ALLOWED_USES[source.sourceClass];
  for (const use of source.allowedUses) {
    if (!allowedUsesForClass.has(use)) {
      errors.push(
        source.sourceClass === "oss_governance" && use === "tenant_ingestion"
          ? "oss_governance_cannot_enter_tenant_ingestion"
          : `${source.sourceClass}_invalid_allowed_use:${use}`,
      );
    }
  }

  if (
    source.sourceClass === "fleet_customer_health" ||
    source.sourceClass === "oss_governance"
  ) {
    for (const use of source.allowedUses) {
      if (IMPROVEMENT_USES.has(use)) errors.push(`forbidden_improvement_use_allowed:${use}`);
    }
  }

  if (source.sourceClass === "fleet_customer_health") {
    if (source.improvementLoopEligible) {
      errors.push("fleet_customer_health_never_improvement_eligible");
    }
    if (source.promotionState !== "blocked") {
      errors.push("fleet_customer_health_cannot_be_promotion_candidate");
    }
    if (source.aliasMode !== "reversible_operator_alias") {
      errors.push("fleet_customer_health_requires_reversible_operator_alias");
    }
    if (
      typeof source.customerConsentScopeRef !== "string" ||
      source.customerConsentScopeRef.length === 0
    ) {
      errors.push("fleet_customer_health_missing_customer_consent_scope_ref");
    }
  }

  if (source.aliasMode === "reversible_operator_alias") {
    if (!source.aliasSaltRef || !source.aliasSaltRotatesAt) {
      errors.push("reversible_alias_missing_salt_lifecycle");
    }
    if (!source.aliasAccessRoles || source.aliasAccessRoles.length === 0) {
      errors.push("reversible_alias_missing_access_roles");
    }
    if (source.aliasDecodeAuditRequired !== true) {
      errors.push("reversible_alias_missing_decode_audit");
    }
  }

  if (
    source.sourceClass === "self_dogfood_health" &&
    source.personAttributionMode === "person_level" &&
    source.promotionState !== "quarantine" &&
    source.promotionState !== "blocked"
  ) {
    errors.push("self_dogfood_person_level_attribution_not_removed");
  }

  if (source.sourceClass === "synthetic_public") {
    if (source.aliasMode !== "synthetic_alias") {
      errors.push("synthetic_public_requires_synthetic_alias");
    }
    if (source.personAttributionMode !== "none") {
      errors.push("synthetic_public_cannot_carry_person_attribution");
    }
  }

  if (source.sourceClass === "deidentified_promoted_case") {
    if (source.aliasMode !== "irreversible_deidentified") {
      errors.push("deidentified_promoted_case_requires_irreversible_alias");
    }
    if (source.personAttributionMode === "person_level") {
      errors.push("deidentified_promoted_case_cannot_carry_person_attribution");
    }
  }

  if (source.sourceClass === "oss_governance") {
    if (source.improvementLoopEligible) {
      errors.push("oss_governance_never_improvement_eligible");
    }
    if (source.promotionState !== "non_goal") {
      errors.push("oss_governance_requires_non_goal_state");
    }
  }

  if (source.improvementLoopEligible && source.promotionState === "blocked") {
    errors.push("improvement_eligible_source_cannot_be_blocked");
  }
  if (!source.improvementLoopEligible && source.promotionState === "public_eligible") {
    errors.push("public_eligible_source_must_be_improvement_eligible");
  }
  if (!hasUse(source, "memory_promotion")) {
    errors.push("memory_promotion_boundary_not_declared");
  }

  return result([...new Set(errors)]);
}

export function validateOperatingSignalImprovementGate(input: {
  readonly source: unknown;
  readonly promotion?: EvalCasePromotion | null;
}): ValidationResult {
  const errors = validateOperatingSignalSourceEnvelope(input.source).errors;
  if (!isRecord(input.source)) return result(errors);

  const source = input.source as OperatingSignalSourceEnvelope;
  if (
    source.sourceClass === "fleet_customer_health" ||
    source.sourceClass === "oss_governance"
  ) {
    errors.push(`source_class_forbidden_from_improvement_loop:${source.sourceClass}`);
    return result([...new Set(errors)]);
  }

  if (!source.improvementLoopEligible) errors.push("source_not_improvement_eligible");
  if (source.promotionState !== "public_eligible") errors.push("source_not_public_eligible");

  if (
    source.sourceClass === "self_dogfood_health" ||
    source.sourceClass === "deidentified_promoted_case"
  ) {
    if (!input.promotion) {
      errors.push("missing_eval_case_promotion");
    } else {
      errors.push(...validateEvalCasePromotion(input.promotion).errors);
      if (input.promotion.publicEligible !== true) {
        errors.push("promotion_not_public_eligible");
      }
      if (input.promotion.sourceCaseId !== source.signalId) {
        errors.push("promotion_source_case_mismatch");
      }
    }
  }

  return result([...new Set(errors)]);
}
