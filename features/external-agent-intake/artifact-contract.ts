/**
 * Helm External Agent Intake — Artifact Contract
 *
 * Pure TypeScript contract for offline fixture evaluation. This is not a
 * runtime adapter, API route, schema, provider client, credential store, or UI.
 */

export type ArtifactKind =
  | "evidence_candidate"
  | "draft_candidate"
  | "analysis_candidate"
  | "retrieval_candidate"
  | "tool_receipt"
  | "workflow_trace"
  | "error_report";

export type RedactionStatus =
  | "redacted"
  | "alias_only"
  | "contains_pii"
  | "unknown";

export type DeclaredSideEffect =
  | "none"
  | "read"
  | "draft_created"
  | "tool_called"
  | "external_write_attempted"
  | "unknown";

export type ExternalAgentOutcomeStatus =
  | "completed"
  | "refused"
  | "blocked"
  | "needs_review"
  | "unsupported"
  | "error";

export type ExternalAgentBoundaryDecision =
  | "allow_candidate"
  | "review_required"
  | "watch_only"
  | "reject"
  | "quarantine";

export type AgenticActorType =
  | "external_agent"
  | "connector"
  | "operator"
  | "system"
  | "unknown";

export type ExternalAgentObjectType =
  | "meeting"
  | "opportunity"
  | "company"
  | "contact"
  | "commitment"
  | "resource"
  | "memory"
  | "unknown";

export interface ExternalAgentObjectRef {
  readonly type: ExternalAgentObjectType;
  readonly id?: string;
}

export interface ExternalAgentGovernanceTrace {
  readonly traceId: string;
  readonly source: string;
  readonly actorType: AgenticActorType;
  readonly workspaceId: string;
  readonly objectRef?: ExternalAgentObjectRef;
  readonly inputEvidenceRefs: readonly string[];
  readonly proposedAction: string;
  readonly outcomeStatus: ExternalAgentOutcomeStatus;
  readonly boundaryDecision: ExternalAgentBoundaryDecision;
  readonly createdAt: string;
  readonly redactionStatus: RedactionStatus;
}

export interface ExternalAgentArtifact {
  readonly artifactId: string;
  readonly workspaceId: string;
  readonly providerId: string;
  readonly providerArtifactRef?: string;
  readonly artifactKind: ArtifactKind;
  readonly createdAt: string;
  readonly sourceTimestamp?: string;
  readonly actorRef?: string;
  readonly objectRef?: ExternalAgentObjectRef;
  readonly actorVisibleSummary: string;
  readonly rawOutputHash: string;
  readonly redactionStatus: RedactionStatus;
  readonly providerTraceRefs: readonly string[];
  readonly governanceTrace?: ExternalAgentGovernanceTrace;
  readonly providerOutcomeStatus?: ExternalAgentOutcomeStatus;
  readonly citationsOrEvidenceRefs: readonly string[];
  readonly declaredSideEffects: readonly DeclaredSideEffect[];
  readonly providerConfidenceClaim?: number;
  readonly contentSummary: string;
  readonly contentShape: "text" | "json" | "markdown" | "file_ref" | "unknown";
}

export const REQUIRED_EXTERNAL_AGENT_ARTIFACT_FIELDS = [
  "artifactId",
  "workspaceId",
  "providerId",
  "artifactKind",
  "createdAt",
  "actorVisibleSummary",
  "rawOutputHash",
  "redactionStatus",
  "declaredSideEffects",
  "contentSummary",
] as const satisfies readonly (keyof ExternalAgentArtifact)[];

export function findMissingRequiredArtifactFields(
  artifact: Partial<ExternalAgentArtifact>,
): readonly string[] {
  return REQUIRED_EXTERNAL_AGENT_ARTIFACT_FIELDS.filter((field) => {
    const value = artifact[field];
    return (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    );
  });
}

export function hasSupportedRedaction(artifact: ExternalAgentArtifact) {
  return artifact.redactionStatus === "redacted" || artifact.redactionStatus === "alias_only";
}

export function hasObjectRef(artifact: ExternalAgentArtifact) {
  return Boolean(artifact.objectRef?.type && artifact.objectRef.type !== "unknown" && artifact.objectRef.id);
}

export function hasGovernanceTrace(artifact: ExternalAgentArtifact) {
  const trace = artifact.governanceTrace;
  return Boolean(
    trace?.traceId &&
      trace.source &&
      trace.actorType &&
      trace.workspaceId === artifact.workspaceId &&
      trace.inputEvidenceRefs.length > 0 &&
      trace.proposedAction &&
      trace.outcomeStatus &&
      trace.boundaryDecision &&
      Number.isFinite(Date.parse(trace.createdAt)) &&
      (trace.redactionStatus === "redacted" || trace.redactionStatus === "alias_only"),
  );
}
