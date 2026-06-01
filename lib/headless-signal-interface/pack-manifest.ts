/**
 * Helm — Headless Signal Interface (HSI) Pack Manifest contract.
 *
 * Phase 1 OFFLINE planning artifact. No runtime, no schema, no API.
 * These types only declare the shape every delivery pack must encode
 * before its fixtures and eval cases land. They are consumed by the
 * `eval:headless-signal-interface` offline gate.
 *
 * Source of truth: docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md
 * Section HSI-01 (Delivery Pack Contract).
 */

/**
 * The six source-agnostic operating-signal families a Phase 1 HSI
 * pack must classify against. Locked by HSI-01 — extending the set
 * requires a documented requirements change first.
 */
export type HsiSignalFamily =
  | "commitment_missing"
  | "stage_or_status_stale"
  | "approval_blocked"
  | "owner_mismatch"
  | "duplicate_or_conflict"
  | "boundary_attempt";

export const HSI_SIGNAL_FAMILIES: readonly HsiSignalFamily[] = [
  "commitment_missing",
  "stage_or_status_stale",
  "approval_blocked",
  "owner_mismatch",
  "duplicate_or_conflict",
  "boundary_attempt",
];

/**
 * The source-kind tags a pack may declare. Salesforce is *one* CRM
 * entry and never the default — see `nonSalesforceSourceKinds` for
 * the Phase 1 minimum coverage rule.
 */
export type HsiSourceKind =
  | "case_system"
  | "crm"
  | "salesforce"
  | "im"
  | "meeting"
  | "email"
  | "spreadsheet"
  | "external_agent_output"
  | "vertical_system";

export const HSI_SOURCE_KINDS: readonly HsiSourceKind[] = [
  "case_system",
  "crm",
  "salesforce",
  "im",
  "meeting",
  "email",
  "spreadsheet",
  "external_agent_output",
  "vertical_system",
];

export const NON_SALESFORCE_SOURCE_KINDS: ReadonlySet<HsiSourceKind> = new Set([
  "case_system",
  "crm",
  "im",
  "meeting",
  "email",
  "spreadsheet",
  "external_agent_output",
  "vertical_system",
]);

/**
 * The review-surface tags a pack may project signals into. None of
 * these are execution surfaces — see `forbidden-facades` for the
 * boundary on what HSI is explicitly NOT allowed to do.
 */
export type HsiReviewSurface =
  | "operating_signal_flow_map"
  | "review_packet"
  | "approval_inbox"
  | "memory_review_queue"
  | "boundary_ledger";

/**
 * Data posture declared at the pack / payload-sample level. Every
 * fixture and payload example must carry one of these tags and the
 * eval rejects packs that mix postures silently.
 */
export type HsiDataPosture = "synthetic" | "redacted" | "alias_only";

/**
 * Who runs the redaction step that produces the sample data shipped
 * with the pack. HSI-05 forbids "Helm-side" as the default; it is
 * permitted only with an explicit Data Protection review attached.
 */
export type HsiRedactionOwner =
  | "customer_side"
  | "delivery_engineer_side"
  | "helm_side_with_dp_review";

/**
 * Owner role expected to triage signals and review packets from this
 * pack. Aligned with the four contributor triage roles in HSI-09
 * (Phase 4 runtime adoption Required Reviewer is a different set).
 */
export type HsiOwnerRole =
  | "product"
  | "delivery_engineering"
  | "data_protection"
  | "security";

/**
 * Pack manifest required fields, per HSI-01 Phase 1.
 *
 * `nonProductionOnly: true` is the Phase 1 default — any pack that
 * flips it must come with an HSI-04 / HSI-05 / HSI-06 review packet
 * referenced in `dataProtectionReviewRef`.
 */
export interface HsiPackManifest {
  readonly packId: string;
  readonly displayName: string;
  readonly verticalKind: string;
  readonly sourceKinds: readonly HsiSourceKind[];
  readonly signalFamilies: readonly HsiSignalFamily[];
  readonly reviewSurfaces: readonly HsiReviewSurface[];
  readonly ownerRole: HsiOwnerRole;
  readonly dataPosture: HsiDataPosture;
  readonly redactionOwner: HsiRedactionOwner;
  readonly nonProductionOnly: boolean;
  /**
   * `true` marks a pack whose canonical vertical requirements are
   * not yet on disk in this branch — e.g. D002 美业 pending owner
   * truth. Such a pack must NOT block Phase 1 coverage metrics; it
   * is included only as a forward-compat placeholder.
   */
  readonly pendingOwnerTruth?: boolean;
  /**
   * Optional reference to the implementation checklist artifact
   * (HSI-01 line item). Phase 1 accepts a docs path; runtime loader
   * verification is out of scope.
   */
  readonly implementationChecklistRef?: string;
  /**
   * Required when `redactionOwner === "helm_side_with_dp_review"`.
   * A docs path to the Data Protection review packet. The evaluator
   * enforces presence; content review is human.
   */
  readonly dataProtectionReviewRef?: string;
}

/**
 * The eight forbidden facades enumerated in HSI-03. Every HSI pack
 * and every facade-shape proposal must declare it does NOT expose
 * any of these. The evaluator counts violations as
 * `packetAsExecutionCount` incidents.
 */
export const HSI_FORBIDDEN_FACADES: readonly string[] = [
  "execute_action",
  "send_message",
  "approve",
  "write_crm_stage",
  "create_contract",
  "settle_payment",
  "auto_assign_owner",
  "promote_to_memory",
];

/**
 * The five allowed facade shapes from HSI-03 — all read-only or
 * preparation-only. They are types, not implementations; Phase 1
 * is OFFLINE and explicitly does not run any of them as runtime.
 */
export const HSI_ALLOWED_FACADES: readonly string[] = [
  "search_signal_capabilities",
  "get_signal_payload_example",
  "project_operating_signal_snapshot",
  "prepare_review_packet",
  "explain_signal_boundary",
];

/**
 * Verifies the manifest is internally consistent. Used by the
 * evaluator; exposed so future loaders can reuse the rules.
 *
 * Returns an array of human-readable violation strings; empty
 * array means "well-formed pack manifest".
 */
export function validateHsiPackManifest(
  manifest: HsiPackManifest,
): readonly string[] {
  const violations: string[] = [];

  if (manifest.sourceKinds.length === 0) {
    violations.push("manifest_missing_source_kinds");
  }
  if (manifest.signalFamilies.length === 0) {
    violations.push("manifest_missing_signal_families");
  }
  if (manifest.reviewSurfaces.length === 0) {
    violations.push("manifest_missing_review_surfaces");
  }

  for (const family of manifest.signalFamilies) {
    if (!HSI_SIGNAL_FAMILIES.includes(family)) {
      violations.push(`manifest_unknown_signal_family:${family}`);
    }
  }

  for (const source of manifest.sourceKinds) {
    if (!HSI_SOURCE_KINDS.includes(source)) {
      violations.push(`manifest_unknown_source_kind:${source}`);
    }
  }

  if (
    manifest.redactionOwner === "helm_side_with_dp_review" &&
    !manifest.dataProtectionReviewRef
  ) {
    violations.push("manifest_helm_side_redaction_missing_dp_review_ref");
  }

  if (manifest.nonProductionOnly === false && !manifest.dataProtectionReviewRef) {
    // A pack flipping nonProductionOnly off without a DP review
    // attached is a Phase 1 boundary breach.
    violations.push("manifest_production_flagged_without_dp_review_ref");
  }

  return violations;
}
