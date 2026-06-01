import type { ExternalAgentArtifact } from "./artifact-contract";

/**
 * Local copy of the intake disposition union. Phase 1 Task 2 will own the
 * canonical type in `./intake-decision`; until then, fixture metadata can
 * be consumed without depending on a not-yet-built module. See
 * docs/product/HELM_EXTERNAL_AGENT_INTAKE_PRD.md §7.
 */
export type ExpectedIntakeDisposition =
  | "accept_as_evidence_candidate"
  | "accept_as_draft_candidate"
  | "review_required"
  | "watch_only"
  | "reject"
  | "quarantine";

export const EXTERNAL_AGENT_INTAKE_WORKSPACE_ID = "workspace_external_agent_fixture";
export const EXTERNAL_AGENT_INTAKE_REFERENCE_TIME = "2026-05-01T00:00:00.000Z";

/** Sentinel providerId used by EA-014 to exercise the unknown-provider path. */
export const EXTERNAL_AGENT_INTAKE_UNKNOWN_PROVIDER_ID = "unknown";

export interface ExternalAgentArtifactFixture {
  readonly id: string;
  readonly artifact: ExternalAgentArtifact;
  readonly expectedDisposition: ExpectedIntakeDisposition;
  readonly expectedReasonIncludes: readonly string[];
}

function baseArtifact(
  id: string,
  providerId: string,
  artifactKind: ExternalAgentArtifact["artifactKind"],
  overrides: Partial<ExternalAgentArtifact> = {},
): ExternalAgentArtifact {
  return {
    artifactId: id,
    workspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
    providerId,
    artifactKind,
    createdAt: "2026-05-01T00:00:00.000Z",
    sourceTimestamp: "2026-04-30T12:00:00.000Z",
    actorRef: "operator:fixture",
    objectRef: { type: "opportunity", id: "opp_fixture" },
    actorVisibleSummary: `${id} external agent artifact`,
    rawOutputHash: `sha256:${id.toLowerCase().replaceAll("-", "")}`,
    redactionStatus: "redacted",
    providerTraceRefs: [`trace:${id}`],
    providerOutcomeStatus: "completed",
    governanceTrace: {
      traceId: `trace:${id}`,
      source: providerId,
      actorType: "external_agent",
      workspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
      objectRef: { type: "opportunity", id: "opp_fixture" },
      inputEvidenceRefs: [`evidence:${id}`],
      proposedAction: "attach_as_candidate_evidence_for_human_review",
      outcomeStatus: "completed",
      boundaryDecision: "review_required",
      createdAt: "2026-05-01T00:00:00.000Z",
      redactionStatus: "redacted",
    },
    citationsOrEvidenceRefs: [`evidence:${id}`],
    declaredSideEffects: ["none"],
    providerConfidenceClaim: 0.72,
    contentSummary: `${id} reviewable external agent output`,
    contentShape: "text",
    ...overrides,
  };
}

export const EXTERNAL_AGENT_ARTIFACT_FIXTURES: readonly ExternalAgentArtifactFixture[] = [
  {
    id: "EA-001",
    artifact: baseArtifact("EA-001", "coze_manual", "evidence_candidate", {
      contentSummary: "Redacted meeting follow-up insight with evidence refs.",
    }),
    expectedDisposition: "review_required",
    expectedReasonIncludes: ["source_untrusted", "requires_human_review"],
  },
  {
    id: "EA-002",
    artifact: baseArtifact("EA-002", "coze_manual", "draft_candidate", {
      declaredSideEffects: ["draft_created"],
      contentSummary: "Follow-up email draft was created locally and not sent.",
    }),
    expectedDisposition: "accept_as_draft_candidate",
    expectedReasonIncludes: ["requires_human_review"],
  },
  {
    id: "EA-003",
    artifact: baseArtifact("EA-003", "coze_manual", "analysis_candidate", {
      objectRef: { type: "unknown" },
      citationsOrEvidenceRefs: [],
      contentSummary: "Generic advice without object binding or evidence.",
    }),
    expectedDisposition: "watch_only",
    expectedReasonIncludes: ["object_ref_missing", "missing_evidence"],
  },
  {
    id: "EA-004",
    artifact: baseArtifact("EA-004", "coze_manual", "workflow_trace", {
      declaredSideEffects: ["external_write_attempted"],
      contentSummary: "Provider claims CRM updated externally.",
    }),
    expectedDisposition: "quarantine",
    expectedReasonIncludes: ["authority_exceeded", "side_effect_declared"],
  },
  {
    id: "EA-005",
    artifact: baseArtifact("EA-005", "openclaw_local", "evidence_candidate", {
      redactionStatus: "alias_only",
      contentSummary: "Local skill output with object ref, hash, trace, and evidence.",
    }),
    expectedDisposition: "accept_as_evidence_candidate",
    expectedReasonIncludes: ["source_trusted"],
  },
  {
    id: "EA-006",
    artifact: baseArtifact("EA-006", "openclaw_local", "draft_candidate", {
      declaredSideEffects: ["draft_created"],
      contentSummary: "Cookbook draft output for review packet only.",
    }),
    expectedDisposition: "accept_as_draft_candidate",
    expectedReasonIncludes: ["requires_human_review"],
  },
  {
    id: "EA-007",
    artifact: baseArtifact("EA-007", "openclaw_local", "analysis_candidate", {
      providerTraceRefs: [],
      contentSummary: "Local output has no trace references.",
    }),
    expectedDisposition: "review_required",
    expectedReasonIncludes: ["provider_opaque"],
  },
  {
    id: "EA-008",
    artifact: baseArtifact("EA-008", "openclaw_local", "tool_receipt", {
      declaredSideEffects: ["unknown"],
      contentSummary: "Shell tool receipt with unknown side effect.",
    }),
    expectedDisposition: "quarantine",
    expectedReasonIncludes: ["authority_exceeded", "side_effect_declared"],
  },
  {
    id: "EA-009",
    artifact: baseArtifact("EA-009", "dify_manual", "retrieval_candidate", {
      contentSummary: "RAG result with citations from Dify workflow output.",
    }),
    expectedDisposition: "review_required",
    expectedReasonIncludes: ["source_untrusted", "requires_human_review"],
  },
  {
    id: "EA-010",
    artifact: baseArtifact("EA-010", "dify_manual", "workflow_trace", {
      providerTraceRefs: ["receipt:EA-010"],
      contentSummary: "Workflow output with partial trace for manual review.",
    }),
    expectedDisposition: "review_required",
    expectedReasonIncludes: ["source_untrusted", "requires_human_review"],
  },
  {
    id: "EA-011",
    artifact: baseArtifact("EA-011", "dify_manual", "evidence_candidate", {
      sourceTimestamp: "2026-03-01T00:00:00.000Z",
      contentSummary: "Stale output older than the intake threshold.",
    }),
    expectedDisposition: "watch_only",
    expectedReasonIncludes: ["stale"],
  },
  {
    id: "EA-012",
    artifact: baseArtifact("EA-012", "dify_manual", "analysis_candidate", {
      contentSummary: "Contradictory analysis compared with CRM source.",
    }),
    expectedDisposition: "review_required",
    expectedReasonIncludes: ["contradictory"],
  },
  {
    id: "EA-013",
    artifact: baseArtifact("EA-013", "coze_manual", "evidence_candidate", {
      workspaceId: "workspace_other_tenant",
      contentSummary: "Cross-workspace artifact.",
    }),
    expectedDisposition: "quarantine",
    expectedReasonIncludes: ["cross_tenant_risk"],
  },
  {
    id: "EA-014",
    artifact: baseArtifact("EA-014", "unknown", "evidence_candidate", {
      contentSummary: "Provider profile missing.",
    }),
    expectedDisposition: "reject",
    expectedReasonIncludes: ["provider_profile_missing"],
  },
  {
    id: "EA-015",
    artifact: baseArtifact("EA-015", "coze_manual", "draft_candidate", {
      redactionStatus: "contains_pii",
      declaredSideEffects: ["draft_created"],
      contentSummary: "Contains raw customer PII in a draft candidate.",
    }),
    expectedDisposition: "quarantine",
    expectedReasonIncludes: ["contains_pii"],
  },
  {
    id: "EA-016",
    artifact: baseArtifact("EA-016", "openclaw_local", "evidence_candidate", {
      providerOutcomeStatus: "refused",
      governanceTrace: {
        traceId: "trace:EA-016",
        source: "openclaw_local",
        actorType: "external_agent",
        workspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
        objectRef: { type: "opportunity", id: "opp_fixture" },
        inputEvidenceRefs: ["evidence:EA-016"],
        proposedAction: "record_refusal_without_retry",
        outcomeStatus: "refused",
        boundaryDecision: "watch_only",
        createdAt: "2026-05-01T00:00:00.000Z",
        redactionStatus: "redacted",
      },
      contentSummary: "Provider refused the unsafe or unsupported request.",
    }),
    expectedDisposition: "watch_only",
    expectedReasonIncludes: ["outcome_refused"],
  },
  {
    id: "EA-017",
    artifact: baseArtifact("EA-017", "openclaw_local", "workflow_trace", {
      providerOutcomeStatus: "blocked",
      governanceTrace: {
        traceId: "trace:EA-017",
        source: "openclaw_local",
        actorType: "external_agent",
        workspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
        objectRef: { type: "opportunity", id: "opp_fixture" },
        inputEvidenceRefs: ["evidence:EA-017"],
        proposedAction: "attempt_customer_visible_send",
        outcomeStatus: "blocked",
        boundaryDecision: "quarantine",
        createdAt: "2026-05-01T00:00:00.000Z",
        redactionStatus: "redacted",
      },
      contentSummary: "Boundary blocked a customer-visible send attempt.",
    }),
    expectedDisposition: "quarantine",
    expectedReasonIncludes: ["outcome_blocked", "requires_human_review"],
  },
  {
    id: "EA-018",
    artifact: baseArtifact("EA-018", "openclaw_local", "analysis_candidate", {
      providerOutcomeStatus: "unsupported",
      governanceTrace: {
        traceId: "trace:EA-018",
        source: "openclaw_local",
        actorType: "external_agent",
        workspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
        objectRef: { type: "opportunity", id: "opp_fixture" },
        inputEvidenceRefs: ["evidence:EA-018"],
        proposedAction: "observe_unsupported_agent_capability",
        outcomeStatus: "unsupported",
        boundaryDecision: "watch_only",
        createdAt: "2026-05-01T00:00:00.000Z",
        redactionStatus: "redacted",
      },
      contentSummary: "Provider reports this operation is unsupported.",
    }),
    expectedDisposition: "watch_only",
    expectedReasonIncludes: ["outcome_unsupported"],
  },
  {
    id: "EA-019",
    artifact: baseArtifact("EA-019", "openclaw_local", "error_report", {
      providerOutcomeStatus: "error",
      governanceTrace: {
        traceId: "trace:EA-019",
        source: "openclaw_local",
        actorType: "external_agent",
        workspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
        objectRef: { type: "opportunity", id: "opp_fixture" },
        inputEvidenceRefs: ["evidence:EA-019"],
        proposedAction: "reject_failed_agent_execution",
        outcomeStatus: "error",
        boundaryDecision: "reject",
        createdAt: "2026-05-01T00:00:00.000Z",
        redactionStatus: "redacted",
      },
      contentSummary: "Provider execution errored before producing a grounded artifact.",
    }),
    expectedDisposition: "reject",
    expectedReasonIncludes: ["outcome_error"],
  },
  {
    id: "EA-020",
    artifact: baseArtifact("EA-020", "openclaw_local", "evidence_candidate", {
      providerOutcomeStatus: "needs_review",
      governanceTrace: {
        traceId: "trace:EA-020",
        source: "openclaw_local",
        actorType: "external_agent",
        workspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
        objectRef: { type: "opportunity", id: "opp_fixture" },
        inputEvidenceRefs: ["evidence:EA-020"],
        proposedAction: "attach_only_after_operator_review",
        outcomeStatus: "needs_review",
        boundaryDecision: "review_required",
        createdAt: "2026-05-01T00:00:00.000Z",
        redactionStatus: "redacted",
      },
      contentSummary: "Provider output is grounded but explicitly requires human review.",
    }),
    expectedDisposition: "review_required",
    expectedReasonIncludes: ["outcome_needs_review", "requires_human_review"],
  },
  {
    id: "EA-021",
    artifact: baseArtifact("EA-021", "openclaw_local", "evidence_candidate", {
      providerOutcomeStatus: "completed",
      governanceTrace: {
        traceId: "trace:EA-021",
        source: "openclaw_local",
        actorType: "external_agent",
        workspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
        objectRef: { type: "opportunity", id: "opp_fixture" },
        inputEvidenceRefs: ["evidence:EA-021"],
        proposedAction: "detect_trace_conflict_without_promotion",
        outcomeStatus: "blocked",
        boundaryDecision: "quarantine",
        createdAt: "2026-05-01T00:00:00.000Z",
        redactionStatus: "redacted",
      },
      contentSummary: "Provider says completed but governance trace says blocked.",
    }),
    expectedDisposition: "quarantine",
    expectedReasonIncludes: ["trace_outcome_conflict", "requires_human_review"],
  },
  {
    id: "EA-022",
    artifact: baseArtifact("EA-022", "openclaw_local", "workflow_trace", {
      providerOutcomeStatus: "completed",
      governanceTrace: {
        traceId: "trace:EA-022",
        source: "salesforce",
        actorType: "connector",
        workspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
        objectRef: { type: "opportunity", id: "opp_fixture" },
        inputEvidenceRefs: ["evidence:EA-022"],
        proposedAction: "crm_stage_write_review_packet",
        outcomeStatus: "completed",
        boundaryDecision: "review_required",
        createdAt: "2026-05-01T00:00:00.000Z",
        redactionStatus: "redacted",
      },
      contentSummary: "Connector-backed CRM stage write suggestion must stay review-required.",
    }),
    expectedDisposition: "review_required",
    expectedReasonIncludes: ["connector_permission_review_required", "requires_human_review"],
  },
] as const;
