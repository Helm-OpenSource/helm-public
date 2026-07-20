import type {
  ExternalAgentArtifact,
  ExternalAgentObjectRef,
} from "@/features/external-agent-intake/artifact-contract";
import type { QoderWorkMcpToolName } from "./mcp-contract";

type ProposalToolName = Extract<
  QoderWorkMcpToolName,
  | "propose_evidence_manifest"
  | "propose_draft_artifact"
  | "propose_receipt_candidate"
>;

type GovernedProposal = {
  readonly correlationRef: string;
  readonly idempotencyKey: string;
  readonly objectRef: ExternalAgentObjectRef;
  readonly summary: string;
  readonly evidenceRefs: readonly string[];
  readonly contentHash: string;
  readonly redactionStatus: "redacted" | "alias_only" | "unknown";
  readonly observedAt?: string;
  readonly sourceRef?: string;
  readonly workPacketRef?: string;
};

export function buildQoderWorkExternalAgentArtifact(input: {
  readonly identity: {
    readonly workspaceId: string;
    readonly userId: string;
    readonly connectionId: string;
    readonly deviceRef: string;
  };
  readonly toolName: ProposalToolName;
  readonly receivedAt: string;
  readonly proposal: GovernedProposal;
}): ExternalAgentArtifact {
  const kind =
    input.toolName === "propose_evidence_manifest"
      ? "evidence_candidate"
      : input.toolName === "propose_draft_artifact"
        ? "draft_candidate"
        : "tool_receipt";
  const artifactId = `qoderwork:${input.identity.connectionId}:${input.proposal.idempotencyKey}`;
  const declaredSideEffects =
    input.toolName === "propose_draft_artifact"
      ? (["draft_created"] as const)
      : (["none"] as const);
  const evidenceRefs = [...input.proposal.evidenceRefs];

  return {
    artifactId,
    workspaceId: input.identity.workspaceId,
    providerId: "qoderwork_cn",
    providerArtifactRef: input.proposal.sourceRef ?? input.proposal.workPacketRef,
    artifactKind: kind,
    createdAt: input.receivedAt,
    sourceTimestamp: input.proposal.observedAt ?? input.receivedAt,
    actorRef: `external-agent-connection:${input.identity.connectionId}`,
    objectRef: input.proposal.objectRef,
    actorVisibleSummary: input.proposal.summary,
    rawOutputHash: input.proposal.contentHash,
    redactionStatus: input.proposal.redactionStatus,
    providerTraceRefs: [
      `qoderwork-correlation:${input.proposal.correlationRef}`,
      `qoderwork-device:${input.identity.deviceRef}`,
    ],
    governanceTrace: {
      traceId: `qoderwork-correlation:${input.proposal.correlationRef}`,
      source: "qoderwork_cn",
      actorType: "external_agent",
      workspaceId: input.identity.workspaceId,
      objectRef: input.proposal.objectRef,
      inputEvidenceRefs: evidenceRefs,
      proposedAction:
        input.toolName === "propose_evidence_manifest"
          ? "attach_as_external_evidence_candidate_for_helm_review"
          : input.toolName === "propose_draft_artifact"
            ? "attach_draft_to_confirmed_work_packet_for_human_review"
            : "attach_unverified_receipt_candidate_for_independent_verification",
      outcomeStatus: "needs_review",
      boundaryDecision: "review_required",
      createdAt: input.receivedAt,
      redactionStatus: input.proposal.redactionStatus,
    },
    providerOutcomeStatus: "needs_review",
    citationsOrEvidenceRefs: evidenceRefs,
    declaredSideEffects,
    contentSummary: input.proposal.summary,
    contentShape: "text",
  };
}
