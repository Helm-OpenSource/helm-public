/**
 * Case Management Sample · signal core types.
 *
 * Public reference vertical adapted from a tenant-private vertical pack.
 * Sanitization rules: `docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md`
 *
 * Boundary invariants preserved:
 *   - tenantKey is a literal — multi-tenant cross-tenant projection is forbidden
 *   - `commitment` defaults to `suggestion_only`; promotion requires an explicit
 *     graduation record (no inline promotion)
 *   - SignalIdentity is deterministic; no UUID / no ms-precision timestamp
 *
 * This file ships in the public Apache-2.0 mirror. It MUST NOT import from
 * tenant-private paths and MUST NOT reference tenant-private slugs.
 */

export type SignalSeverity = "info" | "warning" | "breach" | "critical";

/**
 * Signal source taxonomy. Public sample stays generic:
 *   - "external_case_backend": case data ingested from a downstream system
 *     via a connector (specific backend stays connector-private)
 *   - "helm-internal": signals derived inside Helm itself
 *   - "mixed": composite signals drawing on multiple sources
 *
 * Connector-specific source labels (e.g. tenant-private backends) are intentionally
 * not enumerated here — the sample stays connector-agnostic.
 */
export type SignalSource = "external_case_backend" | "helm-internal" | "mixed";
export type SignalSourceKind = "case_system" | "crm" | "meeting" | "email" | "im";

export type SignalFreshness = "fresh" | "aging" | "stale";
export type SignalConfidence = "trusted" | "upstream" | "degraded";
export type SignalCommitment = "suggestion_only" | "promotable";

export type ManagementChainConfigId = string;

export type SignalIdentity = {
  /** UNIQUE KEY column 1; required */
  workspaceId: string;
  /** UNIQUE KEY column 2; tenant slug pinned to the sample vertical */
  tenantKey: "case-management-sample";
  /** UNIQUE KEY column 3; deterministic resource+window fingerprint; no UUID/random/ms */
  sourceWindowKey: string;
  /** UNIQUE KEY column 4; deterministic business signal key */
  signalKey: string;
  /** UNIQUE KEY column 5 */
  severity: SignalSeverity;
};

export type SignalScope = {
  owner: { kind: "employee" | "manager" | "team" | "system"; refId: string };
  managementScope: {
    workspaceId: string;
    visibleToOwners: boolean;
    visibleToAdmins: boolean;
    visibleToManagerChain: ManagementChainConfigId | null;
    employeePersonalDetailVisibility:
      | "owner_only"
      | "owner_and_manager_chain"
      | "admins_only";
  };
};

export type SignalTrace = {
  connectorTraceId: string;
  upstreamTraceId?: string;
};

export type SignalSourceRef = {
  sourceKind: SignalSourceKind;
  sourceId: string;
  sourceRef: string;
};

export type SignalSubject = {
  kind: "case" | "customer_account" | "commitment" | "approval" | "risk";
  refId: string;
  label: string;
};

export type SignalGapField = {
  field:
    | "evidence"
    | "owner"
    | "boundary_review"
    | "followup"
    | "status_alignment";
  severity: SignalSeverity;
  detail: string;
};

/**
 * Mapper output shape. Mappers MUST return SignalCandidate<T>[] and MUST NOT
 * call any IO (no fetch, no DB INSERT, no time other than the injected
 * observedAt). A signal-engine consumes candidates and emits ExternalSignal.
 *
 * The sample skeleton does not ship a runtime signal-engine — engine
 * implementation belongs to a downstream fork's runtime layer.
 */
export type SignalCandidate<T> = {
  identity: SignalIdentity;
  scope: SignalScope;
  source: SignalSource;
  sourceRef: SignalSourceRef;
  subject: SignalSubject;
  resourceId: string;
  payload: T;
  observedAt: Date;
  confidence: SignalConfidence;
  gapFields: readonly SignalGapField[];
  trace: SignalTrace;
};

/**
 * The canonical signal atom consumed by feature surfaces and scoreboard
 * layers.
 *
 * Construction is restricted to a signal-engine factory; the type is
 * Readonly to prevent ad-hoc mutation. `commitment` cannot be promoted at
 * the call site; promotion only happens via a graduation record (see
 * CommitmentGraduation below).
 */
export type ExternalSignal<T> = Readonly<{
  identity: SignalIdentity;
  scope: SignalScope;
  source: SignalSource;
  resourceId: string;
  payload: T;
  observedAt: Date;
  freshness: SignalFreshness;
  confidence: SignalConfidence;
  commitment: SignalCommitment;
  trace: SignalTrace;
  observationCount: number;
  firstObservedAt: Date;
  lastObservedAt: Date;
}>;

/**
 * Graduation record. Only a graduation worker may write this; the signal
 * engine reads it on every ingest to decide whether commitment should be
 * elevated to "promotable" for a given signalKey. Sample skeleton does not
 * ship a graduation worker — promotion stays No-Op until a downstream
 * fork's runtime implements it.
 */
export type CommitmentGraduation = {
  signalKey: string;
  promotedFrom: "suggestion_only";
  promotedTo: "promotable";
  promotedAt: Date;
  promotedByEmpId: string;
  evidence: { stableObservationDays: number; manualConfirmedAt: Date };
};

/** Helper to build a SignalIdentity with the sample tenant pinned. */
export function buildSignalIdentity(input: {
  workspaceId: string;
  sourceWindowKey: string;
  signalKey: string;
  severity: SignalSeverity;
}): SignalIdentity {
  if (!input.workspaceId) throw new Error("workspaceId required");
  if (!input.sourceWindowKey) throw new Error("sourceWindowKey required");
  if (!input.signalKey) throw new Error("signalKey required");
  // Hard guard against UUID / random / ms timestamp leaking into sourceWindowKey
  // — these break the deterministic key invariant from the parent contract.
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(input.sourceWindowKey)) {
    throw new Error("sourceWindowKey must not contain UUID");
  }
  if (/\b\d{13,}\b/.test(input.sourceWindowKey)) {
    throw new Error("sourceWindowKey must not contain ms-precision timestamp");
  }
  return {
    workspaceId: input.workspaceId,
    tenantKey: "case-management-sample",
    sourceWindowKey: input.sourceWindowKey,
    signalKey: input.signalKey,
    severity: input.severity,
  };
}
