/**
 * Helm External Agent Intake — Manual Import Loader / Validator (Phase 1)
 *
 * Pure offline loader for fixture-like JSON files describing
 * `ExternalAgentArtifact` records produced by Coze / OpenClaw / Dify or
 * similar external agent surfaces. This module:
 *
 *   - reads a local file path only;
 *   - parses either an array of artifacts or `{ "artifacts": [...] }`;
 *   - validates artifact shape against the Phase 1 contract;
 *   - returns structured success / error results, never throws raw
 *     parser errors or filesystem errors to callers;
 *   - performs no network call, DB query, provider API call, credential
 *     read, schema migration, runtime adapter, UI render, or write.
 *
 * Downstream evaluation is delegated to `evaluateExternalAgentArtifact`
 * in `./intake-decision`. This module only loads and validates.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  REQUIRED_EXTERNAL_AGENT_ARTIFACT_FIELDS,
  type AgenticActorType,
  type ArtifactKind,
  type DeclaredSideEffect,
  type ExternalAgentBoundaryDecision,
  type ExternalAgentArtifact,
  type ExternalAgentOutcomeStatus,
  type ExternalAgentObjectType,
  type RedactionStatus,
} from "./artifact-contract";
import type { IntakeDisposition } from "./intake-decision";

const ARTIFACT_KINDS: readonly ArtifactKind[] = [
  "evidence_candidate",
  "draft_candidate",
  "analysis_candidate",
  "retrieval_candidate",
  "tool_receipt",
  "workflow_trace",
  "error_report",
];

const REDACTION_STATUSES: readonly RedactionStatus[] = [
  "redacted",
  "alias_only",
  "contains_pii",
  "unknown",
];

const DECLARED_SIDE_EFFECTS: readonly DeclaredSideEffect[] = [
  "none",
  "read",
  "draft_created",
  "tool_called",
  "external_write_attempted",
  "unknown",
];

const OBJECT_TYPES: readonly ExternalAgentObjectType[] = [
  "meeting",
  "opportunity",
  "company",
  "contact",
  "commitment",
  "resource",
  "memory",
  "unknown",
];

const CONTENT_SHAPES: readonly ExternalAgentArtifact["contentShape"][] = [
  "text",
  "json",
  "markdown",
  "file_ref",
  "unknown",
];

const OUTCOME_STATUSES: readonly ExternalAgentOutcomeStatus[] = [
  "completed",
  "refused",
  "blocked",
  "needs_review",
  "unsupported",
  "error",
];

const BOUNDARY_DECISIONS: readonly ExternalAgentBoundaryDecision[] = [
  "allow_candidate",
  "review_required",
  "watch_only",
  "reject",
  "quarantine",
];

const AGENTIC_ACTOR_TYPES: readonly AgenticActorType[] = [
  "external_agent",
  "connector",
  "operator",
  "system",
  "unknown",
];

const INTAKE_DISPOSITIONS: readonly IntakeDisposition[] = [
  "accept_as_evidence_candidate",
  "accept_as_draft_candidate",
  "review_required",
  "watch_only",
  "reject",
  "quarantine",
];

export interface ManualImportMetadata {
  readonly workspaceId?: string;
  readonly referenceTimeIso?: string;
  readonly description?: string;
}

export interface ManualImportLoadedArtifact {
  readonly artifact: ExternalAgentArtifact;
  readonly expectedDisposition?: IntakeDisposition;
  readonly demoNotes?: string;
}

export type ManualImportLoadResult =
  | {
      readonly ok: true;
      readonly filePath: string;
      readonly metadata: ManualImportMetadata;
      readonly artifacts: readonly ManualImportLoadedArtifact[];
    }
  | {
      readonly ok: false;
      readonly filePath: string;
      readonly errors: readonly string[];
    };

export function loadManualImportFile(
  filePath: string,
): ManualImportLoadResult {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return {
      ok: false,
      filePath: String(filePath ?? ""),
      errors: ["Manual import path must be a non-empty string."],
    };
  }

  const resolvedPath = path.resolve(filePath);

  let raw: string;
  try {
    raw = readFileSync(resolvedPath, "utf-8");
  } catch (error) {
    return {
      ok: false,
      filePath: resolvedPath,
      errors: [
        `Manual import file could not be read: ${describeFileSystemError(error)}.`,
      ],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      filePath: resolvedPath,
      errors: [
        "Manual import file is not valid JSON; refusing to evaluate further.",
      ],
    };
  }

  const { metadata, rawArtifacts, structureErrors } = unwrapPayload(parsed);
  if (structureErrors.length > 0) {
    return { ok: false, filePath: resolvedPath, errors: structureErrors };
  }

  const errors: string[] = [];
  const artifacts: ManualImportLoadedArtifact[] = [];

  rawArtifacts.forEach((entry, index) => {
    const label = `artifacts[${index}]`;
    if (!isPlainObject(entry)) {
      errors.push(`${label}: must be a JSON object describing an ExternalAgentArtifact.`);
      return;
    }

    const validation = validateArtifact(entry, label);
    if (!validation.ok) {
      errors.push(...validation.errors);
      return;
    }

    const artifactWithMeta = entry as Record<string, unknown>;
    const expectedDisposition = readOptionalDisposition(
      artifactWithMeta.expectedDisposition,
      label,
      errors,
    );
    const demoNotes =
      typeof artifactWithMeta.demoNotes === "string"
        ? artifactWithMeta.demoNotes
        : undefined;

    artifacts.push({
      artifact: validation.artifact,
      expectedDisposition,
      demoNotes,
    });
  });

  if (errors.length > 0) {
    return { ok: false, filePath: resolvedPath, errors };
  }

  return {
    ok: true,
    filePath: resolvedPath,
    metadata,
    artifacts,
  };
}

interface ArtifactValidationOk {
  readonly ok: true;
  readonly artifact: ExternalAgentArtifact;
}

interface ArtifactValidationErr {
  readonly ok: false;
  readonly errors: readonly string[];
}

function validateArtifact(
  raw: Record<string, unknown>,
  label: string,
): ArtifactValidationOk | ArtifactValidationErr {
  const errors: string[] = [];

  for (const field of REQUIRED_EXTERNAL_AGENT_ARTIFACT_FIELDS) {
    const value = raw[field];
    const missing =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (missing) {
      errors.push(`${label}: missing required field "${field}".`);
    }
  }

  if (!isString(raw.artifactId)) errors.push(`${label}: artifactId must be a string.`);
  if (!isString(raw.workspaceId)) errors.push(`${label}: workspaceId must be a string.`);
  if (!isString(raw.providerId)) errors.push(`${label}: providerId must be a string.`);
  if (!isIsoDateString(raw.createdAt)) {
    errors.push(`${label}: createdAt must be a valid ISO string.`);
  }
  if (!isString(raw.actorVisibleSummary))
    errors.push(`${label}: actorVisibleSummary must be a string.`);
  if (!isString(raw.rawOutputHash)) errors.push(`${label}: rawOutputHash must be a string.`);
  if (!isString(raw.contentSummary)) errors.push(`${label}: contentSummary must be a string.`);

  if (!isArtifactKind(raw.artifactKind))
    errors.push(`${label}: artifactKind must be one of ${ARTIFACT_KINDS.join("|")}.`);
  if (!isRedactionStatus(raw.redactionStatus))
    errors.push(
      `${label}: redactionStatus must be one of ${REDACTION_STATUSES.join("|")}.`,
    );
  if (!isContentShape(raw.contentShape))
    errors.push(`${label}: contentShape must be one of ${CONTENT_SHAPES.join("|")}.`);

  if (!Array.isArray(raw.declaredSideEffects)) {
    errors.push(`${label}: declaredSideEffects must be an array.`);
  } else if (!raw.declaredSideEffects.every(isDeclaredSideEffect)) {
    errors.push(
      `${label}: declaredSideEffects entries must be one of ${DECLARED_SIDE_EFFECTS.join("|")}.`,
    );
  }

  if (raw.providerTraceRefs !== undefined && !isStringArray(raw.providerTraceRefs)) {
    errors.push(`${label}: providerTraceRefs must be a string array when present.`);
  }
  if (
    raw.citationsOrEvidenceRefs !== undefined &&
    !isStringArray(raw.citationsOrEvidenceRefs)
  ) {
    errors.push(
      `${label}: citationsOrEvidenceRefs must be a string array when present.`,
    );
  }

  if (raw.objectRef !== undefined) {
    if (!isPlainObject(raw.objectRef)) {
      errors.push(`${label}: objectRef must be an object when present.`);
    } else {
      const objectRef = raw.objectRef as Record<string, unknown>;
      if (!isObjectType(objectRef.type)) {
        errors.push(
          `${label}: objectRef.type must be one of ${OBJECT_TYPES.join("|")}.`,
        );
      }
      if (objectRef.id !== undefined && typeof objectRef.id !== "string") {
        errors.push(`${label}: objectRef.id must be a string when present.`);
      }
    }
  }

  if (
    raw.providerConfidenceClaim !== undefined &&
    typeof raw.providerConfidenceClaim !== "number"
  ) {
    errors.push(`${label}: providerConfidenceClaim must be a number when present.`);
  }
  if (raw.sourceTimestamp !== undefined && !isIsoDateString(raw.sourceTimestamp)) {
    errors.push(`${label}: sourceTimestamp must be a valid ISO string when present.`);
  }
  if (raw.actorRef !== undefined && typeof raw.actorRef !== "string") {
    errors.push(`${label}: actorRef must be a string when present.`);
  }
  if (
    raw.providerArtifactRef !== undefined &&
    typeof raw.providerArtifactRef !== "string"
  ) {
    errors.push(`${label}: providerArtifactRef must be a string when present.`);
  }
  if (
    raw.providerOutcomeStatus !== undefined &&
    !isOutcomeStatus(raw.providerOutcomeStatus)
  ) {
    errors.push(
      `${label}: providerOutcomeStatus must be one of ${OUTCOME_STATUSES.join("|")} when present.`,
    );
  }
  if (raw.governanceTrace !== undefined) {
    validateGovernanceTrace(raw.governanceTrace, `${label}.governanceTrace`, errors);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const artifact: ExternalAgentArtifact = {
    artifactId: raw.artifactId as string,
    workspaceId: raw.workspaceId as string,
    providerId: raw.providerId as string,
    providerArtifactRef:
      typeof raw.providerArtifactRef === "string" ? raw.providerArtifactRef : undefined,
    artifactKind: raw.artifactKind as ArtifactKind,
    createdAt: raw.createdAt as string,
    sourceTimestamp:
      typeof raw.sourceTimestamp === "string" ? raw.sourceTimestamp : undefined,
    actorRef: typeof raw.actorRef === "string" ? raw.actorRef : undefined,
    objectRef: isPlainObject(raw.objectRef)
      ? {
          type: (raw.objectRef as { type: ExternalAgentObjectType }).type,
          id:
            typeof (raw.objectRef as { id?: unknown }).id === "string"
              ? ((raw.objectRef as { id: string }).id)
              : undefined,
        }
      : undefined,
    actorVisibleSummary: raw.actorVisibleSummary as string,
    rawOutputHash: raw.rawOutputHash as string,
    redactionStatus: raw.redactionStatus as RedactionStatus,
    providerTraceRefs: Array.isArray(raw.providerTraceRefs)
      ? (raw.providerTraceRefs as string[])
      : [],
    governanceTrace: isPlainObject(raw.governanceTrace)
      ? {
          traceId: raw.governanceTrace.traceId as string,
          source: raw.governanceTrace.source as string,
          actorType: raw.governanceTrace.actorType as AgenticActorType,
          workspaceId: raw.governanceTrace.workspaceId as string,
          objectRef: isPlainObject(raw.governanceTrace.objectRef)
            ? {
                type: (raw.governanceTrace.objectRef as { type: ExternalAgentObjectType }).type,
                id:
                  typeof (raw.governanceTrace.objectRef as { id?: unknown }).id === "string"
                    ? ((raw.governanceTrace.objectRef as { id: string }).id)
                    : undefined,
              }
            : undefined,
          inputEvidenceRefs: raw.governanceTrace.inputEvidenceRefs as readonly string[],
          proposedAction: raw.governanceTrace.proposedAction as string,
          outcomeStatus: raw.governanceTrace.outcomeStatus as ExternalAgentOutcomeStatus,
          boundaryDecision: raw.governanceTrace.boundaryDecision as ExternalAgentBoundaryDecision,
          createdAt: raw.governanceTrace.createdAt as string,
          redactionStatus: raw.governanceTrace.redactionStatus as RedactionStatus,
        }
      : undefined,
    providerOutcomeStatus: isOutcomeStatus(raw.providerOutcomeStatus)
      ? raw.providerOutcomeStatus
      : undefined,
    citationsOrEvidenceRefs: Array.isArray(raw.citationsOrEvidenceRefs)
      ? (raw.citationsOrEvidenceRefs as string[])
      : [],
    declaredSideEffects: raw.declaredSideEffects as readonly DeclaredSideEffect[],
    providerConfidenceClaim:
      typeof raw.providerConfidenceClaim === "number"
        ? raw.providerConfidenceClaim
        : undefined,
    contentSummary: raw.contentSummary as string,
    contentShape: raw.contentShape as ExternalAgentArtifact["contentShape"],
  };

  return { ok: true, artifact };
}

interface UnwrappedPayload {
  readonly metadata: ManualImportMetadata;
  readonly rawArtifacts: readonly unknown[];
  readonly structureErrors: readonly string[];
}

function unwrapPayload(parsed: unknown): UnwrappedPayload {
  if (Array.isArray(parsed)) {
    return { metadata: {}, rawArtifacts: parsed, structureErrors: [] };
  }
  if (!isPlainObject(parsed)) {
    return {
      metadata: {},
      rawArtifacts: [],
      structureErrors: [
        "Manual import payload must be either an array of artifacts or an object with an `artifacts` array.",
      ],
    };
  }

  const obj = parsed as Record<string, unknown>;
  const list = obj.artifacts;
  if (!Array.isArray(list)) {
    return {
      metadata: {},
      rawArtifacts: [],
      structureErrors: [
        "Manual import object must contain an `artifacts` array.",
      ],
    };
  }

  const metadataInput = isPlainObject(obj.metadata)
    ? (obj.metadata as Record<string, unknown>)
    : {};

  const metadata: ManualImportMetadata = {
    workspaceId:
      typeof metadataInput.workspaceId === "string"
        ? metadataInput.workspaceId
        : undefined,
    referenceTimeIso:
      typeof metadataInput.referenceTimeIso === "string"
        ? metadataInput.referenceTimeIso
        : undefined,
    description:
      typeof metadataInput.description === "string"
        ? metadataInput.description
        : undefined,
  };

  return { metadata, rawArtifacts: list, structureErrors: [] };
}

function readOptionalDisposition(
  value: unknown,
  label: string,
  errors: string[],
): IntakeDisposition | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !isIntakeDisposition(value)) {
    errors.push(
      `${label}: expectedDisposition must be one of ${INTAKE_DISPOSITIONS.join("|")}.`,
    );
    return undefined;
  }
  return value;
}

function describeFileSystemError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "ENOENT") return "file not found";
    if (code === "EACCES") return "permission denied";
    if (code === "EISDIR") return "path is a directory, not a file";
  }
  return "unreadable file";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isArtifactKind(value: unknown): value is ArtifactKind {
  return typeof value === "string" && ARTIFACT_KINDS.includes(value as ArtifactKind);
}

function isRedactionStatus(value: unknown): value is RedactionStatus {
  return (
    typeof value === "string" && REDACTION_STATUSES.includes(value as RedactionStatus)
  );
}

function isContentShape(
  value: unknown,
): value is ExternalAgentArtifact["contentShape"] {
  return (
    typeof value === "string" &&
    CONTENT_SHAPES.includes(value as ExternalAgentArtifact["contentShape"])
  );
}

function isDeclaredSideEffect(value: unknown): value is DeclaredSideEffect {
  return (
    typeof value === "string" &&
    DECLARED_SIDE_EFFECTS.includes(value as DeclaredSideEffect)
  );
}

function isObjectType(value: unknown): value is ExternalAgentObjectType {
  return (
    typeof value === "string" &&
    OBJECT_TYPES.includes(value as ExternalAgentObjectType)
  );
}

function isIntakeDisposition(value: string): value is IntakeDisposition {
  return INTAKE_DISPOSITIONS.includes(value as IntakeDisposition);
}

function validateGovernanceTrace(
  value: unknown,
  label: string,
  errors: string[],
): void {
  if (!isPlainObject(value)) {
    errors.push(`${label}: must be an object when present.`);
    return;
  }

  if (!isString(value.traceId)) errors.push(`${label}.traceId must be a string.`);
  if (!isString(value.source)) errors.push(`${label}.source must be a string.`);
  if (!isAgenticActorType(value.actorType)) {
    errors.push(`${label}.actorType must be one of ${AGENTIC_ACTOR_TYPES.join("|")}.`);
  }
  if (!isString(value.workspaceId)) errors.push(`${label}.workspaceId must be a string.`);
  if (!isStringArray(value.inputEvidenceRefs)) {
    errors.push(`${label}.inputEvidenceRefs must be a string array.`);
  }
  if (!isString(value.proposedAction)) {
    errors.push(`${label}.proposedAction must be a string.`);
  }
  if (!isOutcomeStatus(value.outcomeStatus)) {
    errors.push(`${label}.outcomeStatus must be one of ${OUTCOME_STATUSES.join("|")}.`);
  }
  if (!isBoundaryDecision(value.boundaryDecision)) {
    errors.push(
      `${label}.boundaryDecision must be one of ${BOUNDARY_DECISIONS.join("|")}.`,
    );
  }
  if (!isIsoDateString(value.createdAt)) {
    errors.push(`${label}.createdAt must be a valid ISO string.`);
  }
  if (!isRedactionStatus(value.redactionStatus)) {
    errors.push(`${label}.redactionStatus must be one of ${REDACTION_STATUSES.join("|")}.`);
  }

  if (value.objectRef !== undefined) {
    if (!isPlainObject(value.objectRef)) {
      errors.push(`${label}.objectRef must be an object when present.`);
      return;
    }
    if (!isObjectType(value.objectRef.type)) {
      errors.push(`${label}.objectRef.type must be one of ${OBJECT_TYPES.join("|")}.`);
    }
    if (value.objectRef.id !== undefined && typeof value.objectRef.id !== "string") {
      errors.push(`${label}.objectRef.id must be a string when present.`);
    }
  }
}

function isOutcomeStatus(value: unknown): value is ExternalAgentOutcomeStatus {
  return typeof value === "string" && OUTCOME_STATUSES.includes(value as ExternalAgentOutcomeStatus);
}

function isBoundaryDecision(value: unknown): value is ExternalAgentBoundaryDecision {
  return typeof value === "string" && BOUNDARY_DECISIONS.includes(value as ExternalAgentBoundaryDecision);
}

function isAgenticActorType(value: unknown): value is AgenticActorType {
  return typeof value === "string" && AGENTIC_ACTOR_TYPES.includes(value as AgenticActorType);
}
