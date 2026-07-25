// CAIO Pro P1E: Context Agent consent / revocation / deletion contracts.
//
// Pure, deterministic review-first artifacts for employee-consented context
// collection. Public core only RECORDS these receipts; no collection runtime,
// no deletion executor, and no permission grant lives here. Hard boundaries:
// - Default not-participating: nothing here implies any employee consented.
// - Self-consent only: the consenting actor must be the invited employee.
// - Scope is structured; widening any dimension requires a fresh consent
//   bound to the new scope hash. Narrowing never requires re-consent.
// - Participation state must never feed performance input.
// - Receipts carry evidence refs and digest hashes only, never raw content;
//   error paths emit stable codes and never echo candidate content.
import { canonicalJson, sha256 } from "../expert-capability/hashing";

export const CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION =
  "helm.caio.context-agent.v1" as const;

// Frozen boundary literal (invariant: participation state never feeds
// performance input). Receipts must carry exactly `true`; any other value —
// including absence — is invalid.
export const CONTEXT_AGENT_PERFORMANCE_INPUT_PROHIBITED = true as const;

export const CONTEXT_AGENT_PURPOSES = [
  "company_memory_candidates",
  "operating_context_evidence",
  "knowledge_indexing",
] as const;
export type ContextAgentPurpose = (typeof CONTEXT_AGENT_PURPOSES)[number];

export const CONTEXT_AGENT_COLLECTION_KINDS = [
  "local_snapshot",
  "local_index_delta",
] as const;
export type ContextAgentCollectionKind =
  (typeof CONTEXT_AGENT_COLLECTION_KINDS)[number];

export const CONTEXT_AGENT_DELETION_OUTCOMES = [
  "success",
  "failure",
  "partial",
  "unknown",
] as const;
export type ContextAgentDeletionOutcome =
  (typeof CONTEXT_AGENT_DELETION_OUTCOMES)[number];

export const CONTEXT_AGENT_PARTICIPATION_STATUSES = [
  "active",
  "paused",
  "revoked",
  "superseded",
] as const;
export type ContextAgentParticipationStatus =
  (typeof CONTEXT_AGENT_PARTICIPATION_STATUSES)[number];

export type ContextAgentPauseAction = "pause" | "resume";

export type ContextAgentScope = {
  deviceRefs: string[];
  directoryRefs: string[];
  enterpriseAppRefs: string[];
  purposes: ContextAgentPurpose[];
};

export type ContextAgentScopeChange =
  | "unchanged"
  | "narrowing"
  | "expansion";

export type ContextAgentDeletionCounts = {
  indicesDeleted: number;
  cachesDeleted: number;
  derivedVectorsDeleted: number;
  memoryCandidatesDeleted: number;
  observedFactsDeleted: number;
  observedFactsEvidenceInvalidated: number;
  multiSourceRecomputed: number;
};

export type ContextAgentInvitation = {
  schemaVersion: typeof CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION;
  artifactType: "context_agent_invitation";
  invitationId: string;
  workspaceRef: string;
  memberUserRef: string;
  invitedByUserRef: string;
  scope: ContextAgentScope;
  scopeHash: string;
  evidenceRefs: string[];
  idempotencyKey: string;
  recordedAt: string;
  authorityEffect: "none";
  contentHash: string;
};

export type ContextAgentConsentReceipt = {
  schemaVersion: typeof CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION;
  artifactType: "context_agent_consent_receipt";
  receiptId: string;
  workspaceRef: string;
  invitationRef: string;
  memberUserRef: string;
  actorUserRef: string;
  consentVersion: number;
  previousConsentRef: string | null;
  scope: ContextAgentScope;
  scopeHash: string;
  performanceInputProhibited: true;
  evidenceRefs: string[];
  idempotencyKey: string;
  recordedAt: string;
  authorityEffect: "none";
  contentHash: string;
};

export type ContextAgentScopeRevision = {
  schemaVersion: typeof CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION;
  artifactType: "context_agent_scope_revision";
  revisionId: string;
  workspaceRef: string;
  consentRef: string;
  memberUserRef: string;
  actorUserRef: string;
  sequence: number;
  revisionKind: "narrowing";
  previousScope: ContextAgentScope;
  previousScopeHash: string;
  newScope: ContextAgentScope;
  newScopeHash: string;
  idempotencyKey: string;
  recordedAt: string;
  authorityEffect: "none";
  contentHash: string;
};

export type ContextAgentCollectionReceipt = {
  schemaVersion: typeof CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION;
  artifactType: "context_agent_collection_receipt";
  receiptId: string;
  workspaceRef: string;
  consentRef: string;
  memberUserRef: string;
  collectionKind: ContextAgentCollectionKind;
  consentScopeHash: string;
  itemCount: number;
  digestHashes: string[];
  evidenceRefs: string[];
  performanceInputProhibited: true;
  idempotencyKey: string;
  collectedAt: string;
  recordedAt: string;
  authorityEffect: "none";
  contentHash: string;
};

export type ContextAgentPauseReceipt = {
  schemaVersion: typeof CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION;
  artifactType: "context_agent_pause_receipt";
  receiptId: string;
  workspaceRef: string;
  consentRef: string;
  memberUserRef: string;
  actorUserRef: string;
  action: ContextAgentPauseAction;
  resultingStatus: "paused" | "active";
  sequence: number;
  reasonCodes: string[];
  idempotencyKey: string;
  recordedAt: string;
  authorityEffect: "none";
  contentHash: string;
};

export type ContextAgentRevocationReceipt = {
  schemaVersion: typeof CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION;
  artifactType: "context_agent_revocation_receipt";
  receiptId: string;
  workspaceRef: string;
  consentRef: string;
  memberUserRef: string;
  actorUserRef: string;
  consentScopeHash: string;
  deletionWorkItemRef: string;
  reasonCodes: string[];
  evidenceRefs: string[];
  idempotencyKey: string;
  recordedAt: string;
  authorityEffect: "none";
  contentHash: string;
};

export type ContextAgentDeletionReceipt = {
  schemaVersion: typeof CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION;
  artifactType: "context_agent_deletion_receipt";
  receiptId: string;
  workspaceRef: string;
  revocationRef: string;
  consentRef: string;
  memberUserRef: string;
  actorUserRef: string;
  deletionWorkItemRef: string;
  attempt: number;
  outcome: ContextAgentDeletionOutcome;
  counts: ContextAgentDeletionCounts;
  failureCodes: string[];
  evidenceRefs: string[];
  idempotencyKey: string;
  recordedAt: string;
  authorityEffect: "none";
  contentHash: string;
};

export type ContextAgentContractValidation = {
  valid: boolean;
  errors: string[];
};

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
// Refs are opaque identifiers, never raw content: bounded length, no
// whitespace. Anything that could smuggle candidate content is refused.
const REFERENCE_PATTERN = /^\S{1,300}$/;

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function isReference(value: unknown): value is string {
  return typeof value === "string" && REFERENCE_PATTERN.test(value);
}

function isIsoInstant(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  // Code-point order, NOT localeCompare: the scope hash is recomputed on
  // every read, so the sort must be identical on every machine regardless
  // of process locale (localeCompare reorders under e.g. cs_CZ and would
  // fail-close every stored consent after a locale change).
  return [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ].sort();
}

function allReferences(values: readonly string[]): boolean {
  return values.every((value) => isReference(value));
}

export function normalizeContextAgentScope(
  scope: ContextAgentScope,
): ContextAgentScope {
  return {
    deviceRefs: uniqueSorted(scope.deviceRefs),
    directoryRefs: uniqueSorted(scope.directoryRefs),
    enterpriseAppRefs: uniqueSorted(scope.enterpriseAppRefs),
    purposes: uniqueSorted(scope.purposes) as ContextAgentPurpose[],
  };
}

export function validateContextAgentScope(
  scope: ContextAgentScope,
): ContextAgentContractValidation {
  const errors: string[] = [];
  const normalized = normalizeContextAgentScope(scope);
  if (
    !allReferences(normalized.deviceRefs) ||
    !allReferences(normalized.directoryRefs) ||
    !allReferences(normalized.enterpriseAppRefs)
  ) {
    errors.push("context_agent_scope_ref_invalid");
  }
  if (normalized.deviceRefs.length === 0) {
    errors.push("context_agent_scope_device_required");
  }
  if (
    normalized.purposes.length === 0 ||
    !normalized.purposes.every((purpose) =>
      (CONTEXT_AGENT_PURPOSES as readonly string[]).includes(purpose),
    )
  ) {
    errors.push("context_agent_scope_purpose_invalid");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function computeContextAgentScopeHash(
  scope: ContextAgentScope,
): string {
  const validation = validateContextAgentScope(scope);
  if (!validation.valid) {
    throw new Error(
      `context_agent_scope_invalid:${validation.errors.join(",")}`,
    );
  }
  return sha256(canonicalJson(normalizeContextAgentScope(scope)));
}

// Any addition to any dimension is an expansion, even when other dimensions
// shrink at the same time: a widened dimension always requires fresh consent.
export function classifyContextAgentScopeChange(
  previous: ContextAgentScope,
  next: ContextAgentScope,
): ContextAgentScopeChange {
  const before = normalizeContextAgentScope(previous);
  const after = normalizeContextAgentScope(next);
  const dimensions: Array<[readonly string[], readonly string[]]> = [
    [before.deviceRefs, after.deviceRefs],
    [before.directoryRefs, after.directoryRefs],
    [before.enterpriseAppRefs, after.enterpriseAppRefs],
    [before.purposes, after.purposes],
  ];
  let removed = false;
  for (const [left, right] of dimensions) {
    const leftSet = new Set(left);
    if (right.some((value) => !leftSet.has(value))) {
      return "expansion";
    }
    const rightSet = new Set(right);
    if (left.some((value) => !rightSet.has(value))) {
      removed = true;
    }
  }
  return removed ? "narrowing" : "unchanged";
}

function finalizeArtifact<
  T extends Record<string, unknown>,
  K extends string,
>(seed: T, idField: K, idPrefix: string): T & Record<K, string> & {
  contentHash: string;
} {
  const seedHash = sha256(canonicalJson(seed));
  const content = {
    ...seed,
    [idField]: `${idPrefix}:${seedHash.slice(7, 31)}`,
  } as T & Record<K, string>;
  return {
    ...content,
    contentHash: sha256(canonicalJson(content)),
  };
}

function verifyContentHash(
  artifact: Record<string, unknown> & { contentHash: string },
): boolean {
  const { contentHash: _contentHash, ...content } = artifact;
  return artifact.contentHash === sha256(canonicalJson(content));
}

export function createContextAgentInvitation(input: {
  workspaceRef: string;
  memberUserRef: string;
  invitedByUserRef: string;
  scope: ContextAgentScope;
  evidenceRefs: readonly string[];
  idempotencyKey: string;
  recordedAt: string;
}): ContextAgentInvitation {
  if (
    !isNonEmpty(input.workspaceRef) ||
    !isNonEmpty(input.memberUserRef) ||
    !isNonEmpty(input.invitedByUserRef) ||
    !isNonEmpty(input.idempotencyKey) ||
    !isIsoInstant(input.recordedAt)
  ) {
    throw new Error("context_agent_invitation_input_invalid");
  }
  const scope = normalizeContextAgentScope(input.scope);
  const scopeHash = computeContextAgentScopeHash(scope);
  const evidenceRefs = uniqueSorted(input.evidenceRefs);
  if (!allReferences(evidenceRefs)) {
    throw new Error("context_agent_invitation_evidence_ref_invalid");
  }
  return finalizeArtifact(
    {
      schemaVersion: CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION,
      artifactType: "context_agent_invitation" as const,
      workspaceRef: input.workspaceRef.trim(),
      memberUserRef: input.memberUserRef.trim(),
      invitedByUserRef: input.invitedByUserRef.trim(),
      scope,
      scopeHash,
      evidenceRefs,
      idempotencyKey: input.idempotencyKey.trim(),
      recordedAt: input.recordedAt,
      authorityEffect: "none" as const,
    },
    "invitationId",
    "context-agent-invitation",
  );
}

export function validateContextAgentInvitation(
  invitation: ContextAgentInvitation,
): ContextAgentContractValidation {
  const errors: string[] = [];
  if (
    invitation.schemaVersion !== CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION ||
    invitation.artifactType !== "context_agent_invitation"
  ) {
    errors.push("context_agent_invitation_schema_invalid");
  }
  if (
    !isNonEmpty(invitation.invitationId) ||
    !isNonEmpty(invitation.workspaceRef) ||
    !isNonEmpty(invitation.memberUserRef) ||
    !isNonEmpty(invitation.invitedByUserRef) ||
    !isNonEmpty(invitation.idempotencyKey) ||
    !isIsoInstant(invitation.recordedAt)
  ) {
    errors.push("context_agent_invitation_required_field_invalid");
  }
  const scopeValidation = validateContextAgentScope(invitation.scope);
  if (!scopeValidation.valid) {
    errors.push(...scopeValidation.errors);
  } else if (
    invitation.scopeHash !==
    computeContextAgentScopeHash(invitation.scope)
  ) {
    errors.push("context_agent_invitation_scope_hash_mismatch");
  }
  if (!allReferences(invitation.evidenceRefs)) {
    errors.push("context_agent_invitation_evidence_ref_invalid");
  }
  if (invitation.authorityEffect !== "none") {
    errors.push("context_agent_invitation_boundary_invalid");
  }
  if (!verifyContentHash(invitation)) {
    errors.push("context_agent_invitation_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function createContextAgentConsentReceipt(input: {
  workspaceRef: string;
  invitationRef: string;
  memberUserRef: string;
  actorUserRef: string;
  consentVersion: number;
  previousConsentRef: string | null;
  scope: ContextAgentScope;
  evidenceRefs: readonly string[];
  idempotencyKey: string;
  recordedAt: string;
}): ContextAgentConsentReceipt {
  if (
    !isNonEmpty(input.workspaceRef) ||
    !isNonEmpty(input.invitationRef) ||
    !isNonEmpty(input.memberUserRef) ||
    !isNonEmpty(input.actorUserRef) ||
    !isNonEmpty(input.idempotencyKey) ||
    !isIsoInstant(input.recordedAt)
  ) {
    throw new Error("context_agent_consent_input_invalid");
  }
  // Self-consent only: the consenting user must be the invited employee
  // themself. Admin/OWNER proxy consent is refused at the contract layer.
  if (input.actorUserRef.trim() !== input.memberUserRef.trim()) {
    throw new Error("context_agent_self_consent_required");
  }
  if (
    !Number.isInteger(input.consentVersion) ||
    input.consentVersion < 1 ||
    (input.consentVersion === 1 && input.previousConsentRef !== null) ||
    (input.consentVersion > 1 && !isNonEmpty(input.previousConsentRef))
  ) {
    throw new Error("context_agent_consent_version_invalid");
  }
  const scope = normalizeContextAgentScope(input.scope);
  const scopeHash = computeContextAgentScopeHash(scope);
  const evidenceRefs = uniqueSorted(input.evidenceRefs);
  if (evidenceRefs.length === 0 || !allReferences(evidenceRefs)) {
    throw new Error("context_agent_consent_evidence_required");
  }
  return finalizeArtifact(
    {
      schemaVersion: CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION,
      artifactType: "context_agent_consent_receipt" as const,
      workspaceRef: input.workspaceRef.trim(),
      invitationRef: input.invitationRef.trim(),
      memberUserRef: input.memberUserRef.trim(),
      actorUserRef: input.actorUserRef.trim(),
      consentVersion: input.consentVersion,
      previousConsentRef: input.previousConsentRef,
      scope,
      scopeHash,
      performanceInputProhibited:
        CONTEXT_AGENT_PERFORMANCE_INPUT_PROHIBITED,
      evidenceRefs,
      idempotencyKey: input.idempotencyKey.trim(),
      recordedAt: input.recordedAt,
      authorityEffect: "none" as const,
    },
    "receiptId",
    "context-agent-consent",
  );
}

export function validateContextAgentConsentReceipt(
  receipt: ContextAgentConsentReceipt,
): ContextAgentContractValidation {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !== CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION ||
    receipt.artifactType !== "context_agent_consent_receipt"
  ) {
    errors.push("context_agent_consent_schema_invalid");
  }
  if (
    !isNonEmpty(receipt.receiptId) ||
    !isNonEmpty(receipt.workspaceRef) ||
    !isNonEmpty(receipt.invitationRef) ||
    !isNonEmpty(receipt.memberUserRef) ||
    !isNonEmpty(receipt.actorUserRef) ||
    !isNonEmpty(receipt.idempotencyKey) ||
    !isIsoInstant(receipt.recordedAt)
  ) {
    errors.push("context_agent_consent_required_field_invalid");
  }
  if (receipt.actorUserRef !== receipt.memberUserRef) {
    errors.push("context_agent_self_consent_required");
  }
  if (
    !Number.isInteger(receipt.consentVersion) ||
    receipt.consentVersion < 1 ||
    (receipt.consentVersion === 1 && receipt.previousConsentRef !== null) ||
    (receipt.consentVersion > 1 && !isNonEmpty(receipt.previousConsentRef))
  ) {
    errors.push("context_agent_consent_version_invalid");
  }
  const scopeValidation = validateContextAgentScope(receipt.scope);
  if (!scopeValidation.valid) {
    errors.push(...scopeValidation.errors);
  } else if (
    receipt.scopeHash !== computeContextAgentScopeHash(receipt.scope)
  ) {
    errors.push("context_agent_consent_scope_hash_mismatch");
  }
  // Frozen boundary literal: exactly-true, nothing else.
  if (receipt.performanceInputProhibited !== true) {
    errors.push("context_agent_performance_input_boundary_invalid");
  }
  if (
    uniqueSorted(receipt.evidenceRefs).length === 0 ||
    !allReferences(receipt.evidenceRefs)
  ) {
    errors.push("context_agent_consent_evidence_required");
  }
  if (receipt.authorityEffect !== "none") {
    errors.push("context_agent_consent_boundary_invalid");
  }
  if (!verifyContentHash(receipt)) {
    errors.push("context_agent_consent_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function createContextAgentScopeRevision(input: {
  workspaceRef: string;
  consentRef: string;
  memberUserRef: string;
  actorUserRef: string;
  sequence: number;
  previousScope: ContextAgentScope;
  newScope: ContextAgentScope;
  idempotencyKey: string;
  recordedAt: string;
}): ContextAgentScopeRevision {
  if (
    !isNonEmpty(input.workspaceRef) ||
    !isNonEmpty(input.consentRef) ||
    !isNonEmpty(input.memberUserRef) ||
    !isNonEmpty(input.actorUserRef) ||
    !isNonEmpty(input.idempotencyKey) ||
    !isIsoInstant(input.recordedAt) ||
    !Number.isInteger(input.sequence) ||
    input.sequence < 1
  ) {
    throw new Error("context_agent_scope_revision_input_invalid");
  }
  // Scope changes are the employee's own choice.
  if (input.actorUserRef.trim() !== input.memberUserRef.trim()) {
    throw new Error("context_agent_self_scope_revision_required");
  }
  const previousScope = normalizeContextAgentScope(input.previousScope);
  const newScope = normalizeContextAgentScope(input.newScope);
  const previousScopeHash = computeContextAgentScopeHash(previousScope);
  const newScopeHash = computeContextAgentScopeHash(newScope);
  const change = classifyContextAgentScopeChange(previousScope, newScope);
  // A revision that widens any dimension without a fresh consent is refused;
  // expansions must go through a new invitation + consent receipt.
  if (change === "expansion") {
    throw new Error("context_agent_scope_expansion_requires_new_consent");
  }
  if (change !== "narrowing") {
    throw new Error("context_agent_scope_revision_requires_narrowing");
  }
  return finalizeArtifact(
    {
      schemaVersion: CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION,
      artifactType: "context_agent_scope_revision" as const,
      workspaceRef: input.workspaceRef.trim(),
      consentRef: input.consentRef.trim(),
      memberUserRef: input.memberUserRef.trim(),
      actorUserRef: input.actorUserRef.trim(),
      sequence: input.sequence,
      revisionKind: "narrowing" as const,
      previousScope,
      previousScopeHash,
      newScope,
      newScopeHash,
      idempotencyKey: input.idempotencyKey.trim(),
      recordedAt: input.recordedAt,
      authorityEffect: "none" as const,
    },
    "revisionId",
    "context-agent-scope-revision",
  );
}

export function validateContextAgentScopeRevision(
  revision: ContextAgentScopeRevision,
): ContextAgentContractValidation {
  const errors: string[] = [];
  if (
    revision.schemaVersion !== CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION ||
    revision.artifactType !== "context_agent_scope_revision" ||
    revision.revisionKind !== "narrowing"
  ) {
    errors.push("context_agent_scope_revision_schema_invalid");
  }
  if (
    !isNonEmpty(revision.revisionId) ||
    !isNonEmpty(revision.workspaceRef) ||
    !isNonEmpty(revision.consentRef) ||
    !isNonEmpty(revision.memberUserRef) ||
    !isNonEmpty(revision.actorUserRef) ||
    !isNonEmpty(revision.idempotencyKey) ||
    !isIsoInstant(revision.recordedAt) ||
    !Number.isInteger(revision.sequence) ||
    revision.sequence < 1
  ) {
    errors.push("context_agent_scope_revision_required_field_invalid");
  }
  if (revision.actorUserRef !== revision.memberUserRef) {
    errors.push("context_agent_self_scope_revision_required");
  }
  const previousValidation = validateContextAgentScope(
    revision.previousScope,
  );
  const newValidation = validateContextAgentScope(revision.newScope);
  if (!previousValidation.valid || !newValidation.valid) {
    errors.push(...previousValidation.errors, ...newValidation.errors);
  } else {
    if (
      revision.previousScopeHash !==
        computeContextAgentScopeHash(revision.previousScope) ||
      revision.newScopeHash !==
        computeContextAgentScopeHash(revision.newScope)
    ) {
      errors.push("context_agent_scope_revision_hash_mismatch");
    }
    if (
      classifyContextAgentScopeChange(
        revision.previousScope,
        revision.newScope,
      ) !== "narrowing"
    ) {
      errors.push("context_agent_scope_revision_not_narrowing");
    }
  }
  if (revision.authorityEffect !== "none") {
    errors.push("context_agent_scope_revision_boundary_invalid");
  }
  if (!verifyContentHash(revision)) {
    errors.push("context_agent_scope_revision_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function createContextAgentCollectionReceipt(input: {
  workspaceRef: string;
  consentRef: string;
  memberUserRef: string;
  collectionKind: ContextAgentCollectionKind;
  consentScopeHash: string;
  itemCount: number;
  digestHashes: readonly string[];
  evidenceRefs: readonly string[];
  idempotencyKey: string;
  collectedAt: string;
  recordedAt: string;
}): ContextAgentCollectionReceipt {
  if (
    !isNonEmpty(input.workspaceRef) ||
    !isNonEmpty(input.consentRef) ||
    !isNonEmpty(input.memberUserRef) ||
    !isNonEmpty(input.idempotencyKey) ||
    !isIsoInstant(input.collectedAt) ||
    !isIsoInstant(input.recordedAt)
  ) {
    throw new Error("context_agent_collection_input_invalid");
  }
  if (
    !(CONTEXT_AGENT_COLLECTION_KINDS as readonly string[]).includes(
      input.collectionKind,
    )
  ) {
    throw new Error("context_agent_collection_kind_invalid");
  }
  if (!isSha256(input.consentScopeHash)) {
    throw new Error("context_agent_collection_scope_hash_invalid");
  }
  if (!Number.isInteger(input.itemCount) || input.itemCount < 1) {
    throw new Error("context_agent_collection_item_count_invalid");
  }
  // Digest hashes and evidence refs only — never raw content.
  const digestHashes = uniqueSorted(input.digestHashes);
  if (
    digestHashes.length === 0 ||
    !digestHashes.every((digest) => isSha256(digest))
  ) {
    throw new Error("context_agent_collection_digest_invalid");
  }
  const evidenceRefs = uniqueSorted(input.evidenceRefs);
  if (evidenceRefs.length === 0 || !allReferences(evidenceRefs)) {
    throw new Error("context_agent_collection_evidence_ref_invalid");
  }
  return finalizeArtifact(
    {
      schemaVersion: CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION,
      artifactType: "context_agent_collection_receipt" as const,
      workspaceRef: input.workspaceRef.trim(),
      consentRef: input.consentRef.trim(),
      memberUserRef: input.memberUserRef.trim(),
      collectionKind: input.collectionKind,
      consentScopeHash: input.consentScopeHash,
      itemCount: input.itemCount,
      digestHashes,
      evidenceRefs,
      performanceInputProhibited:
        CONTEXT_AGENT_PERFORMANCE_INPUT_PROHIBITED,
      idempotencyKey: input.idempotencyKey.trim(),
      collectedAt: input.collectedAt,
      recordedAt: input.recordedAt,
      authorityEffect: "none" as const,
    },
    "receiptId",
    "context-agent-collection",
  );
}

export function validateContextAgentCollectionReceipt(
  receipt: ContextAgentCollectionReceipt,
): ContextAgentContractValidation {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !== CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION ||
    receipt.artifactType !== "context_agent_collection_receipt"
  ) {
    errors.push("context_agent_collection_schema_invalid");
  }
  if (
    !isNonEmpty(receipt.receiptId) ||
    !isNonEmpty(receipt.workspaceRef) ||
    !isNonEmpty(receipt.consentRef) ||
    !isNonEmpty(receipt.memberUserRef) ||
    !isNonEmpty(receipt.idempotencyKey) ||
    !isIsoInstant(receipt.collectedAt) ||
    !isIsoInstant(receipt.recordedAt)
  ) {
    errors.push("context_agent_collection_required_field_invalid");
  }
  if (
    !(CONTEXT_AGENT_COLLECTION_KINDS as readonly string[]).includes(
      receipt.collectionKind,
    )
  ) {
    errors.push("context_agent_collection_kind_invalid");
  }
  if (!isSha256(receipt.consentScopeHash)) {
    errors.push("context_agent_collection_scope_hash_invalid");
  }
  if (!Number.isInteger(receipt.itemCount) || receipt.itemCount < 1) {
    errors.push("context_agent_collection_item_count_invalid");
  }
  if (
    receipt.digestHashes.length === 0 ||
    !receipt.digestHashes.every((digest) => isSha256(digest))
  ) {
    errors.push("context_agent_collection_digest_invalid");
  }
  if (
    receipt.evidenceRefs.length === 0 ||
    !allReferences(receipt.evidenceRefs)
  ) {
    errors.push("context_agent_collection_evidence_ref_invalid");
  }
  if (receipt.performanceInputProhibited !== true) {
    errors.push("context_agent_performance_input_boundary_invalid");
  }
  if (receipt.authorityEffect !== "none") {
    errors.push("context_agent_collection_boundary_invalid");
  }
  if (!verifyContentHash(receipt)) {
    errors.push("context_agent_collection_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function createContextAgentPauseReceipt(input: {
  workspaceRef: string;
  consentRef: string;
  memberUserRef: string;
  actorUserRef: string;
  action: ContextAgentPauseAction;
  sequence: number;
  reasonCodes: readonly string[];
  idempotencyKey: string;
  recordedAt: string;
}): ContextAgentPauseReceipt {
  if (
    !isNonEmpty(input.workspaceRef) ||
    !isNonEmpty(input.consentRef) ||
    !isNonEmpty(input.memberUserRef) ||
    !isNonEmpty(input.actorUserRef) ||
    !isNonEmpty(input.idempotencyKey) ||
    !isIsoInstant(input.recordedAt) ||
    !Number.isInteger(input.sequence) ||
    input.sequence < 1
  ) {
    throw new Error("context_agent_pause_input_invalid");
  }
  if (input.action !== "pause" && input.action !== "resume") {
    throw new Error("context_agent_pause_action_invalid");
  }
  // Resume requires the employee themself; pause may also come from a
  // workspace policy admin as a protective action.
  if (
    input.action === "resume" &&
    input.actorUserRef.trim() !== input.memberUserRef.trim()
  ) {
    throw new Error("context_agent_self_resume_required");
  }
  const reasonCodes = uniqueSorted(input.reasonCodes);
  if (reasonCodes.length === 0 || !allReferences(reasonCodes)) {
    throw new Error("context_agent_pause_reason_required");
  }
  return finalizeArtifact(
    {
      schemaVersion: CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION,
      artifactType: "context_agent_pause_receipt" as const,
      workspaceRef: input.workspaceRef.trim(),
      consentRef: input.consentRef.trim(),
      memberUserRef: input.memberUserRef.trim(),
      actorUserRef: input.actorUserRef.trim(),
      action: input.action,
      resultingStatus:
        input.action === "pause" ? ("paused" as const) : ("active" as const),
      sequence: input.sequence,
      reasonCodes,
      idempotencyKey: input.idempotencyKey.trim(),
      recordedAt: input.recordedAt,
      authorityEffect: "none" as const,
    },
    "receiptId",
    "context-agent-pause",
  );
}

export function validateContextAgentPauseReceipt(
  receipt: ContextAgentPauseReceipt,
): ContextAgentContractValidation {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !== CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION ||
    receipt.artifactType !== "context_agent_pause_receipt"
  ) {
    errors.push("context_agent_pause_schema_invalid");
  }
  if (
    !isNonEmpty(receipt.receiptId) ||
    !isNonEmpty(receipt.workspaceRef) ||
    !isNonEmpty(receipt.consentRef) ||
    !isNonEmpty(receipt.memberUserRef) ||
    !isNonEmpty(receipt.actorUserRef) ||
    !isNonEmpty(receipt.idempotencyKey) ||
    !isIsoInstant(receipt.recordedAt) ||
    !Number.isInteger(receipt.sequence) ||
    receipt.sequence < 1
  ) {
    errors.push("context_agent_pause_required_field_invalid");
  }
  if (
    !(
      (receipt.action === "pause" &&
        receipt.resultingStatus === "paused") ||
      (receipt.action === "resume" &&
        receipt.resultingStatus === "active")
    )
  ) {
    errors.push("context_agent_pause_shape_invalid");
  }
  if (
    receipt.action === "resume" &&
    receipt.actorUserRef !== receipt.memberUserRef
  ) {
    errors.push("context_agent_self_resume_required");
  }
  if (uniqueSorted(receipt.reasonCodes).length === 0) {
    errors.push("context_agent_pause_reason_required");
  }
  if (receipt.authorityEffect !== "none") {
    errors.push("context_agent_pause_boundary_invalid");
  }
  if (!verifyContentHash(receipt)) {
    errors.push("context_agent_pause_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function createContextAgentRevocationReceipt(input: {
  workspaceRef: string;
  consentRef: string;
  memberUserRef: string;
  actorUserRef: string;
  consentScopeHash: string;
  reasonCodes: readonly string[];
  evidenceRefs: readonly string[];
  idempotencyKey: string;
  recordedAt: string;
}): ContextAgentRevocationReceipt {
  if (
    !isNonEmpty(input.workspaceRef) ||
    !isNonEmpty(input.consentRef) ||
    !isNonEmpty(input.memberUserRef) ||
    !isNonEmpty(input.actorUserRef) ||
    !isNonEmpty(input.idempotencyKey) ||
    !isIsoInstant(input.recordedAt)
  ) {
    throw new Error("context_agent_revocation_input_invalid");
  }
  if (!isSha256(input.consentScopeHash)) {
    throw new Error("context_agent_revocation_scope_hash_invalid");
  }
  const reasonCodes = uniqueSorted(input.reasonCodes);
  if (reasonCodes.length === 0 || !allReferences(reasonCodes)) {
    throw new Error("context_agent_revocation_reason_required");
  }
  const evidenceRefs = uniqueSorted(input.evidenceRefs);
  if (!allReferences(evidenceRefs)) {
    throw new Error("context_agent_revocation_evidence_ref_invalid");
  }
  const seed = {
    schemaVersion: CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION,
    artifactType: "context_agent_revocation_receipt" as const,
    workspaceRef: input.workspaceRef.trim(),
    consentRef: input.consentRef.trim(),
    memberUserRef: input.memberUserRef.trim(),
    actorUserRef: input.actorUserRef.trim(),
    consentScopeHash: input.consentScopeHash,
    reasonCodes,
    evidenceRefs,
    idempotencyKey: input.idempotencyKey.trim(),
    recordedAt: input.recordedAt,
    authorityEffect: "none" as const,
  };
  // Revocation is terminal for the consent version and creates exactly one
  // deletion work item; the work item ref is derived so it cannot fork.
  const seedHash = sha256(canonicalJson(seed));
  return finalizeArtifact(
    {
      ...seed,
      deletionWorkItemRef: `context-agent-deletion-work:${seedHash.slice(
        7,
        31,
      )}`,
    },
    "receiptId",
    "context-agent-revocation",
  );
}

export function validateContextAgentRevocationReceipt(
  receipt: ContextAgentRevocationReceipt,
): ContextAgentContractValidation {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !== CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION ||
    receipt.artifactType !== "context_agent_revocation_receipt"
  ) {
    errors.push("context_agent_revocation_schema_invalid");
  }
  if (
    !isNonEmpty(receipt.receiptId) ||
    !isNonEmpty(receipt.workspaceRef) ||
    !isNonEmpty(receipt.consentRef) ||
    !isNonEmpty(receipt.memberUserRef) ||
    !isNonEmpty(receipt.actorUserRef) ||
    !isNonEmpty(receipt.deletionWorkItemRef) ||
    !isNonEmpty(receipt.idempotencyKey) ||
    !isIsoInstant(receipt.recordedAt)
  ) {
    errors.push("context_agent_revocation_required_field_invalid");
  }
  if (!isSha256(receipt.consentScopeHash)) {
    errors.push("context_agent_revocation_scope_hash_invalid");
  }
  if (uniqueSorted(receipt.reasonCodes).length === 0) {
    errors.push("context_agent_revocation_reason_required");
  }
  if (receipt.authorityEffect !== "none") {
    errors.push("context_agent_revocation_boundary_invalid");
  }
  if (!verifyContentHash(receipt)) {
    errors.push("context_agent_revocation_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateContextAgentDeletionCounts(
  counts: ContextAgentDeletionCounts,
): ContextAgentContractValidation {
  const errors: string[] = [];
  const values = [
    counts.indicesDeleted,
    counts.cachesDeleted,
    counts.derivedVectorsDeleted,
    counts.memoryCandidatesDeleted,
    counts.observedFactsDeleted,
    counts.observedFactsEvidenceInvalidated,
    counts.multiSourceRecomputed,
  ];
  if (!values.every((value) => isNonNegativeInteger(value))) {
    errors.push("context_agent_deletion_count_invalid");
  }
  return { valid: errors.length === 0, errors };
}

export function createContextAgentDeletionReceipt(input: {
  workspaceRef: string;
  revocationRef: string;
  consentRef: string;
  memberUserRef: string;
  actorUserRef: string;
  deletionWorkItemRef: string;
  attempt: number;
  outcome: ContextAgentDeletionOutcome;
  counts: ContextAgentDeletionCounts;
  failureCodes: readonly string[];
  evidenceRefs: readonly string[];
  idempotencyKey: string;
  recordedAt: string;
}): ContextAgentDeletionReceipt {
  if (
    !isNonEmpty(input.workspaceRef) ||
    !isNonEmpty(input.revocationRef) ||
    !isNonEmpty(input.consentRef) ||
    !isNonEmpty(input.memberUserRef) ||
    !isNonEmpty(input.actorUserRef) ||
    !isNonEmpty(input.deletionWorkItemRef) ||
    !isNonEmpty(input.idempotencyKey) ||
    !isIsoInstant(input.recordedAt) ||
    !Number.isInteger(input.attempt) ||
    input.attempt < 1
  ) {
    throw new Error("context_agent_deletion_input_invalid");
  }
  if (
    !(CONTEXT_AGENT_DELETION_OUTCOMES as readonly string[]).includes(
      input.outcome,
    )
  ) {
    throw new Error("context_agent_deletion_outcome_invalid");
  }
  const countsValidation = validateContextAgentDeletionCounts(input.counts);
  if (!countsValidation.valid) {
    throw new Error(countsValidation.errors[0]);
  }
  const failureCodes = uniqueSorted(input.failureCodes);
  if (!allReferences(failureCodes)) {
    throw new Error("context_agent_deletion_failure_code_invalid");
  }
  if (input.outcome === "success" && failureCodes.length > 0) {
    throw new Error("context_agent_deletion_success_with_failures");
  }
  if (
    (input.outcome === "failure" || input.outcome === "partial") &&
    failureCodes.length === 0
  ) {
    throw new Error("context_agent_deletion_failure_code_required");
  }
  const evidenceRefs = uniqueSorted(input.evidenceRefs);
  if (evidenceRefs.length === 0 || !allReferences(evidenceRefs)) {
    throw new Error("context_agent_deletion_evidence_required");
  }
  return finalizeArtifact(
    {
      schemaVersion: CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION,
      artifactType: "context_agent_deletion_receipt" as const,
      workspaceRef: input.workspaceRef.trim(),
      revocationRef: input.revocationRef.trim(),
      consentRef: input.consentRef.trim(),
      memberUserRef: input.memberUserRef.trim(),
      actorUserRef: input.actorUserRef.trim(),
      deletionWorkItemRef: input.deletionWorkItemRef.trim(),
      attempt: input.attempt,
      outcome: input.outcome,
      counts: { ...input.counts },
      failureCodes,
      evidenceRefs,
      idempotencyKey: input.idempotencyKey.trim(),
      recordedAt: input.recordedAt,
      authorityEffect: "none" as const,
    },
    "receiptId",
    "context-agent-deletion",
  );
}

export function validateContextAgentDeletionReceipt(
  receipt: ContextAgentDeletionReceipt,
): ContextAgentContractValidation {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !== CONTEXT_AGENT_CONTRACT_SCHEMA_VERSION ||
    receipt.artifactType !== "context_agent_deletion_receipt"
  ) {
    errors.push("context_agent_deletion_schema_invalid");
  }
  if (
    !isNonEmpty(receipt.receiptId) ||
    !isNonEmpty(receipt.workspaceRef) ||
    !isNonEmpty(receipt.revocationRef) ||
    !isNonEmpty(receipt.consentRef) ||
    !isNonEmpty(receipt.memberUserRef) ||
    !isNonEmpty(receipt.actorUserRef) ||
    !isNonEmpty(receipt.deletionWorkItemRef) ||
    !isNonEmpty(receipt.idempotencyKey) ||
    !isIsoInstant(receipt.recordedAt) ||
    !Number.isInteger(receipt.attempt) ||
    receipt.attempt < 1
  ) {
    errors.push("context_agent_deletion_required_field_invalid");
  }
  if (
    !(CONTEXT_AGENT_DELETION_OUTCOMES as readonly string[]).includes(
      receipt.outcome,
    )
  ) {
    errors.push("context_agent_deletion_outcome_invalid");
  }
  const countsValidation = validateContextAgentDeletionCounts(receipt.counts);
  if (!countsValidation.valid) {
    errors.push(...countsValidation.errors);
  }
  if (
    receipt.outcome === "success" &&
    receipt.failureCodes.length > 0
  ) {
    errors.push("context_agent_deletion_success_with_failures");
  }
  if (
    (receipt.outcome === "failure" || receipt.outcome === "partial") &&
    receipt.failureCodes.length === 0
  ) {
    errors.push("context_agent_deletion_failure_code_required");
  }
  if (
    receipt.evidenceRefs.length === 0 ||
    !allReferences(receipt.evidenceRefs)
  ) {
    errors.push("context_agent_deletion_evidence_required");
  }
  if (receipt.authorityEffect !== "none") {
    errors.push("context_agent_deletion_boundary_invalid");
  }
  if (!verifyContentHash(receipt)) {
    errors.push("context_agent_deletion_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
