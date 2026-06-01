/**
 * Helm External Agent Intake — P0-REQ-07 Strict Boundary Classifier
 *
 * Per P0-REQ-07 acceptance: "Cross-tenant, unredacted, no-trace, or stale
 * external artifacts are quarantined." This is a stricter posture than the
 * default intake-decision evaluator (which routes no-trace to review_required
 * and stale to watch_only) and is intended for offline boundary verification
 * of external_agent_evidence_candidate intake.
 *
 * Required metadata per P0-REQ-07: provider, source, timestamp, actor,
 * workspace, raw output hash, redaction status, trace id.
 *
 * NOT a runtime gate, NOT an API. Planning-only offline classifier.
 */

import type { ExternalAgentArtifact } from "./artifact-contract";

export type P0Req07Disposition = "quarantine" | "passes_strict_boundary";

export type P0Req07ReasonCode =
  | "cross_tenant"
  | "unredacted"
  | "no_trace"
  | "stale"
  | "missing_required_metadata";

export type P0Req07RequiredMetadataField =
  | "provider"
  | "source"
  | "timestamp"
  | "actor"
  | "workspace"
  | "raw_output_hash"
  | "redaction_status"
  | "trace_id";

export interface P0Req07ClassificationOptions {
  readonly expectedWorkspaceId: string;
  readonly referenceTimeIso: string;
  /** Maximum age in milliseconds before an artifact is considered stale. */
  readonly staleThresholdMs?: number;
}

export interface P0Req07ClassificationResult {
  readonly artifactId: string;
  readonly disposition: P0Req07Disposition;
  readonly reasonCodes: readonly P0Req07ReasonCode[];
  readonly missingMetadata: readonly P0Req07RequiredMetadataField[];
  readonly boundaryNote: string;
}

const DEFAULT_STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Strictly classify an external agent artifact against the P0-REQ-07 boundary.
 * Only `passes_strict_boundary` artifacts may proceed downstream as
 * external_agent_evidence_candidate; everything else is quarantined.
 *
 * The base intake-decision evaluator may still grant softer dispositions for
 * its own purposes — this classifier is the canonical boundary contract.
 */
export function classifyP0Req07Boundary(
  artifact: Partial<ExternalAgentArtifact>,
  options: P0Req07ClassificationOptions,
): P0Req07ClassificationResult {
  const artifactId =
    typeof artifact.artifactId === "string" && artifact.artifactId.trim()
      ? artifact.artifactId
      : "unknown_artifact";
  const reasonCodes = new Set<P0Req07ReasonCode>();
  const missingMetadata = collectMissingRequiredMetadata(artifact);
  if (missingMetadata.length > 0) {
    reasonCodes.add("missing_required_metadata");
  }

  if (
    typeof artifact.workspaceId === "string" &&
    artifact.workspaceId !== options.expectedWorkspaceId
  ) {
    reasonCodes.add("cross_tenant");
  }

  if (
    artifact.redactionStatus === "contains_pii" ||
    artifact.redactionStatus === "unknown"
  ) {
    reasonCodes.add("unredacted");
  }

  if (!hasUsableTraceId(artifact)) {
    reasonCodes.add("no_trace");
  }

  if (isStaleByThreshold(artifact, options)) {
    reasonCodes.add("stale");
  }

  const reasons = [...reasonCodes];
  const disposition: P0Req07Disposition =
    reasons.length === 0 ? "passes_strict_boundary" : "quarantine";

  const boundaryNote =
    disposition === "quarantine"
      ? buildQuarantineNote(reasons, missingMetadata)
      : "External agent artifact passes the P0-REQ-07 strict boundary; downstream still requires review before any commitment.";

  return {
    artifactId,
    disposition,
    reasonCodes: reasons,
    missingMetadata,
    boundaryNote,
  };
}

function collectMissingRequiredMetadata(
  artifact: Partial<ExternalAgentArtifact>,
): readonly P0Req07RequiredMetadataField[] {
  const missing: P0Req07RequiredMetadataField[] = [];
  if (!nonEmpty(artifact.providerId)) missing.push("provider");
  if (!hasUsableSource(artifact)) missing.push("source");
  if (!nonEmpty(artifact.createdAt)) missing.push("timestamp");
  if (!hasUsableActor(artifact)) missing.push("actor");
  if (!nonEmpty(artifact.workspaceId)) missing.push("workspace");
  if (!nonEmpty(artifact.rawOutputHash)) missing.push("raw_output_hash");
  if (!artifact.redactionStatus) missing.push("redaction_status");
  if (!hasUsableTraceId(artifact)) missing.push("trace_id");
  return missing;
}

function hasUsableSource(artifact: Partial<ExternalAgentArtifact>): boolean {
  if (nonEmpty(artifact.providerArtifactRef)) return true;
  const traceSource = artifact.governanceTrace?.source;
  return nonEmpty(traceSource);
}

function hasUsableActor(artifact: Partial<ExternalAgentArtifact>): boolean {
  if (nonEmpty(artifact.actorRef)) return true;
  const traceActorType = artifact.governanceTrace?.actorType;
  return Boolean(traceActorType && traceActorType !== "unknown");
}

function hasUsableTraceId(artifact: Partial<ExternalAgentArtifact>): boolean {
  const traceId = artifact.governanceTrace?.traceId;
  if (nonEmpty(traceId)) return true;
  const providerTraceRefs = artifact.providerTraceRefs;
  return Array.isArray(providerTraceRefs) && providerTraceRefs.length > 0;
}

function isStaleByThreshold(
  artifact: Partial<ExternalAgentArtifact>,
  options: P0Req07ClassificationOptions,
): boolean {
  const referenceTimeMs = Date.parse(options.referenceTimeIso);
  if (!Number.isFinite(referenceTimeMs)) {
    return false;
  }
  const candidateIso =
    typeof artifact.sourceTimestamp === "string" && artifact.sourceTimestamp
      ? artifact.sourceTimestamp
      : artifact.createdAt;
  if (typeof candidateIso !== "string" || !candidateIso) {
    return false;
  }
  const candidateMs = Date.parse(candidateIso);
  if (!Number.isFinite(candidateMs)) {
    return false;
  }
  const threshold = options.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;
  return referenceTimeMs - candidateMs > threshold;
}

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function buildQuarantineNote(
  reasons: readonly P0Req07ReasonCode[],
  missingMetadata: readonly P0Req07RequiredMetadataField[],
): string {
  const parts: string[] = [];
  if (reasons.includes("cross_tenant")) {
    parts.push("workspace mismatch");
  }
  if (reasons.includes("unredacted")) {
    parts.push("redaction missing or contains PII");
  }
  if (reasons.includes("no_trace")) {
    parts.push("no trace id");
  }
  if (reasons.includes("stale")) {
    parts.push("stale beyond threshold");
  }
  if (reasons.includes("missing_required_metadata")) {
    parts.push(`missing metadata: ${missingMetadata.join(", ")}`);
  }
  return `External agent artifact quarantined per P0-REQ-07: ${parts.join("; ")}. It cannot become Must Push, memory active asset, official write, or commitment.`;
}

/**
 * Helper that re-affirms what an external agent artifact may NEVER do, for
 * downstream consumers that want to assert the planning-only contract.
 */
export const P0_REQ_07_FORBIDDEN_PROMOTIONS = [
  "must_push",
  "memory_active_asset",
  "official_write",
  "commitment",
] as const;

export function externalAgentMayPromoteTo(
  result: P0Req07ClassificationResult,
  target: (typeof P0_REQ_07_FORBIDDEN_PROMOTIONS)[number],
): false {
  void result;
  void target;
  return false;
}

/**
 * Confirm that a fixture has been routed to the strict boundary classifier and
 * either passed or quarantined — never silently bypassed. Useful for offline
 * audit harnesses.
 */
export function assertP0Req07ClassificationOutcome(
  result: P0Req07ClassificationResult,
): asserts result is P0Req07ClassificationResult {
  if (
    result.disposition !== "quarantine" &&
    result.disposition !== "passes_strict_boundary"
  ) {
    throw new Error(
      `P0-REQ-07 classification produced unsupported disposition: ${String(result.disposition)}`,
    );
  }
}
