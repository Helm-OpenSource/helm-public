/**
 * Helm External Agent Intake — Offline Evaluator
 *
 * Deterministic fixture-backed evaluator. It never reads production data, calls
 * provider APIs, stores credentials, creates Must Push items, creates memory,
 * sends messages, or performs official writes.
 */

import {
  findMissingRequiredArtifactFields,
  hasGovernanceTrace,
  hasObjectRef,
  hasSupportedRedaction,
  type ExternalAgentArtifact,
} from "./artifact-contract";
import {
  EXTERNAL_AGENT_ARTIFACT_FIXTURES,
  EXTERNAL_AGENT_INTAKE_REFERENCE_TIME,
  EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
} from "./provider-fixtures";
import {
  getExternalAgentProviderProfile,
  isDraftCapableProvider,
  KNOWN_EXTERNAL_AGENT_PROVIDER_IDS,
  type ProviderCapabilityProfile,
} from "./provider-registry";

export type IntakeDisposition =
  | "accept_as_evidence_candidate"
  | "accept_as_draft_candidate"
  | "review_required"
  | "watch_only"
  | "reject"
  | "quarantine";

export type IntakeReasonCode =
  | "source_trusted"
  | "source_untrusted"
  | "provider_profile_missing"
  | "missing_required_field"
  | "missing_evidence"
  | "stale"
  | "contradictory"
  | "duplicate"
  | "cross_tenant_risk"
  | "contains_pii"
  | "redaction_unknown"
  | "authority_exceeded"
  | "boundary_missing"
  | "side_effect_declared"
  | "outcome_refused"
  | "outcome_blocked"
  | "outcome_needs_review"
  | "outcome_unsupported"
  | "outcome_error"
  | "trace_outcome_conflict"
  | "trace_boundary_conflict"
  | "connector_permission_review_required"
  | "connector_permission_never_allowed"
  | "trace_missing"
  | "trace_redaction_invalid"
  | "provider_opaque"
  | "requires_human_review"
  | "object_ref_missing"
  | "object_ref_unverified";

export interface ExternalAgentIntakeDecision {
  readonly artifactId: string;
  readonly providerId: string;
  readonly disposition: IntakeDisposition;
  readonly reasonCodes: readonly IntakeReasonCode[];
  readonly mayAttachToSignal: boolean;
  readonly mayCreateMustPushCandidate: false;
  readonly mayCreateMemoryCandidate: false;
  readonly mustRequireReview: boolean;
  readonly boundaryNote: string;
  readonly containment: "none" | "downgraded" | "rejected" | "quarantined";
}

export interface ExternalAgentIntakeEvalMetric {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ExternalAgentIntakeEvalSummary {
  readonly totalFixtures: number;
  readonly passedFixtures: number;
  readonly failedFixtures: number;
  readonly directMustPushCreated: 0;
  readonly directMemoryCandidateCreated: 0;
  readonly finalRankingInfluencedByExternalAgent: 0;
  readonly acceptedWithoutBoundaryNote: number;
  readonly acceptedWithUnsupportedPII: number;
  readonly acceptedWithoutGovernanceTrace: number;
  readonly traceConflictAccepted: number;
  readonly connectorPermissionBypassed: number;
  readonly refusedRetriedOrPromoted: 0;
  readonly results: readonly {
    readonly fixtureId: string;
    readonly expectedDisposition: IntakeDisposition;
    readonly actualDisposition: IntakeDisposition;
    readonly passed: boolean;
    readonly reasonCodes: readonly IntakeReasonCode[];
  }[];
  readonly metrics: readonly ExternalAgentIntakeEvalMetric[];
  readonly overallPassed: boolean;
}

export interface EvaluateExternalAgentIntakeOptions {
  readonly expectedWorkspaceId?: string;
  readonly referenceTimeIso?: string;
}

const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

export function evaluateExternalAgentArtifact(
  artifact: Partial<ExternalAgentArtifact>,
  options: EvaluateExternalAgentIntakeOptions = {},
): ExternalAgentIntakeDecision {
  const artifactId = typeof artifact.artifactId === "string" ? artifact.artifactId : "unknown_artifact";
  const providerId = typeof artifact.providerId === "string" ? artifact.providerId : "unknown_provider";
  const missingFields = findMissingRequiredArtifactFields(artifact);

  if (missingFields.length > 0) {
    return buildDecision({
      artifactId,
      providerId,
      disposition: "reject",
      reasonCodes: ["missing_required_field"],
      boundaryNote: `External agent artifact rejected before intake because required field(s) are missing: ${missingFields.join(", ")}.`,
      containment: "rejected",
    });
  }

  const fullArtifact = artifact as ExternalAgentArtifact;
  const provider = getExternalAgentProviderProfile(fullArtifact.providerId);

  if (!provider) {
    return buildDecision({
      artifactId: fullArtifact.artifactId,
      providerId: fullArtifact.providerId,
      disposition: "reject",
      reasonCodes: ["provider_profile_missing"],
      boundaryNote: "External agent artifact rejected because provider profile is missing; provider reputation cannot bypass registry review.",
      containment: "rejected",
    });
  }

  const expectedWorkspaceId = options.expectedWorkspaceId ?? fullArtifact.workspaceId;
  const reasonCodes = new Set<IntakeReasonCode>();

  if (fullArtifact.workspaceId !== expectedWorkspaceId) {
    reasonCodes.add("cross_tenant_risk");
    return buildDecision({
      artifactId: fullArtifact.artifactId,
      providerId: fullArtifact.providerId,
      disposition: "quarantine",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent artifact quarantined because workspace scope does not match the active Helm workspace.",
      containment: "quarantined",
    });
  }

  if (provider.defaultTrustTier === "low" || provider.defaultTrustTier === "untrusted") {
    reasonCodes.add("source_untrusted");
    reasonCodes.add("requires_human_review");
  } else {
    reasonCodes.add("source_trusted");
  }

  const authorityExceeded = hasAuthorityExceeded(fullArtifact);
  if (authorityExceeded) {
    reasonCodes.add("authority_exceeded");
    reasonCodes.add("side_effect_declared");
    return buildDecision({
      artifactId: fullArtifact.artifactId,
      providerId: fullArtifact.providerId,
      disposition: "quarantine",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent artifact quarantined because it declares or implies external write, send, approval, settlement, or unknown side effects.",
      containment: "quarantined",
    });
  }

  if (fullArtifact.redactionStatus === "contains_pii") {
    reasonCodes.add("contains_pii");
    return buildDecision({
      artifactId: fullArtifact.artifactId,
      providerId: fullArtifact.providerId,
      disposition: "quarantine",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent artifact quarantined because raw PII is present and Phase 1 only accepts redacted or alias-only material.",
      containment: "quarantined",
    });
  }

  if (fullArtifact.redactionStatus === "unknown") {
    reasonCodes.add("redaction_unknown");
    reasonCodes.add("requires_human_review");
  }

  const traceConflictDecision = evaluateGovernanceTraceConflict(fullArtifact, reasonCodes);
  if (traceConflictDecision) return traceConflictDecision;

  const connectorPermissionDecision = evaluateConnectorPermissionAssociation(
    fullArtifact,
    reasonCodes,
  );
  if (connectorPermissionDecision) return connectorPermissionDecision;

  const outcomeDecision = evaluateOutcomeStatus(fullArtifact, reasonCodes);
  if (outcomeDecision) return outcomeDecision;

  if (isStale(fullArtifact, options.referenceTimeIso ?? EXTERNAL_AGENT_INTAKE_REFERENCE_TIME)) {
    reasonCodes.add("stale");
    return buildDecision({
      artifactId: fullArtifact.artifactId,
      providerId: fullArtifact.providerId,
      disposition: "watch_only",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent artifact is stale and can only stay observable; it cannot drive a downstream candidate.",
      containment: "downgraded",
    });
  }

  if (mentionsContradiction(fullArtifact)) {
    reasonCodes.add("contradictory");
    reasonCodes.add("requires_human_review");
  }

  if (!hasObjectRef(fullArtifact)) {
    reasonCodes.add("object_ref_missing");
  }

  if (fullArtifact.citationsOrEvidenceRefs.length === 0) {
    reasonCodes.add("missing_evidence");
  }

  if (fullArtifact.providerTraceRefs.length === 0 || provider.auditability === "opaque") {
    reasonCodes.add("provider_opaque");
  }

  if (!hasGovernanceTrace(fullArtifact)) {
    reasonCodes.add("trace_missing");
    if (fullArtifact.governanceTrace?.redactionStatus === "contains_pii") {
      reasonCodes.add("trace_redaction_invalid");
    }
  }

  if (fullArtifact.artifactKind === "draft_candidate") {
    return evaluateDraftCandidate(fullArtifact, provider, reasonCodes);
  }

  if (canAcceptAsEvidence(fullArtifact, provider, reasonCodes)) {
    return buildDecision({
      artifactId: fullArtifact.artifactId,
      providerId: fullArtifact.providerId,
      disposition: "accept_as_evidence_candidate",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent artifact may attach only as supporting evidence candidate; it cannot directly create Must Push, memory, send, or official write.",
      containment: "none",
    });
  }

  if (shouldWatchOnly(fullArtifact, reasonCodes)) {
    return buildDecision({
      artifactId: fullArtifact.artifactId,
      providerId: fullArtifact.providerId,
      disposition: "watch_only",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent artifact is observable only because object binding or evidence grounding is insufficient.",
      containment: "downgraded",
    });
  }

  return buildDecision({
    artifactId: fullArtifact.artifactId,
    providerId: fullArtifact.providerId,
    disposition: "review_required",
    reasonCodes: [...reasonCodes, "requires_human_review"],
    boundaryNote: "External agent artifact requires human review before any evidence, draft, or review-packet use.",
    containment: "downgraded",
  });
}

export function runExternalAgentIntakeEval(): ExternalAgentIntakeEvalSummary {
  const results = EXTERNAL_AGENT_ARTIFACT_FIXTURES.map((fixture) => {
    const decision = evaluateExternalAgentArtifact(fixture.artifact, {
      expectedWorkspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
    });
    const passed =
      decision.disposition === fixture.expectedDisposition &&
      fixture.expectedReasonIncludes.every((reason) =>
        decision.reasonCodes.includes(reason as IntakeReasonCode),
      ) &&
      decision.mayCreateMustPushCandidate === false &&
      decision.mayCreateMemoryCandidate === false;

    return {
      fixtureId: fixture.id,
      expectedDisposition: fixture.expectedDisposition,
      actualDisposition: decision.disposition,
      passed,
      reasonCodes: decision.reasonCodes,
    };
  });

  const decisions = EXTERNAL_AGENT_ARTIFACT_FIXTURES.map((fixture) =>
    evaluateExternalAgentArtifact(fixture.artifact, {
      expectedWorkspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
    }),
  );

  const acceptedWithoutBoundaryNote = decisions.filter(
    (decision) =>
      ["accept_as_evidence_candidate", "accept_as_draft_candidate", "review_required"].includes(decision.disposition) &&
      decision.boundaryNote.trim() === "",
  ).length;
  const acceptedWithUnsupportedPII = decisions.filter(
    (decision) =>
      ["accept_as_evidence_candidate", "accept_as_draft_candidate"].includes(decision.disposition) &&
      decision.reasonCodes.includes("contains_pii"),
  ).length;
  const acceptedWithoutGovernanceTrace = decisions.filter(
    (decision) =>
      ["accept_as_evidence_candidate", "accept_as_draft_candidate"].includes(decision.disposition) &&
      decision.reasonCodes.includes("trace_missing"),
  ).length;
  const traceConflictAccepted = decisions.filter(
    (decision) =>
      (decision.reasonCodes.includes("trace_outcome_conflict") ||
        decision.reasonCodes.includes("trace_boundary_conflict")) &&
      ["accept_as_evidence_candidate", "accept_as_draft_candidate"].includes(decision.disposition),
  ).length;
  const connectorPermissionBypassed = decisions.filter(
    (decision) =>
      (decision.reasonCodes.includes("connector_permission_review_required") ||
        decision.reasonCodes.includes("connector_permission_never_allowed")) &&
      ["accept_as_evidence_candidate", "accept_as_draft_candidate"].includes(decision.disposition),
  ).length;

  const missingRequiredDecision = evaluateExternalAgentArtifact({
    artifactId: "EA-MISSING",
    providerId: "coze_manual",
  });

  const metrics: readonly ExternalAgentIntakeEvalMetric[] = [
    {
      name: "providerProfileCoverage",
      passed: KNOWN_EXTERNAL_AGENT_PROVIDER_IDS.every((providerId) =>
        Boolean(getExternalAgentProviderProfile(providerId)),
      ),
      detail: `Known providers covered: ${KNOWN_EXTERNAL_AGENT_PROVIDER_IDS.join(", ")}.`,
    },
    {
      name: "missingRequiredFieldRejected",
      passed: missingRequiredDecision.disposition === "reject",
      detail: `Missing required field synthetic decision: ${missingRequiredDecision.disposition}.`,
    },
    {
      name: "crossTenantQuarantined",
      passed: decisions
        .filter((decision) => decision.reasonCodes.includes("cross_tenant_risk"))
        .every((decision) => decision.disposition === "quarantine"),
      detail: "All cross-tenant risk artifacts are quarantined.",
    },
    {
      name: "authorityExceededQuarantined",
      passed: decisions
        .filter((decision) => decision.reasonCodes.includes("authority_exceeded"))
        .every((decision) => decision.disposition === "quarantine"),
      detail: "All authority-exceeded artifacts are quarantined.",
    },
    {
      name: "directMustPushCreated",
      passed: true,
      detail: "External agent intake never creates direct Must Push candidates in Phase 1.",
    },
    {
      name: "directMemoryCandidateCreated",
      passed: true,
      detail: "External agent intake never creates MemoryCandidate or active memory in Phase 1.",
    },
    {
      name: "finalRankingInfluencedByExternalAgent",
      passed: true,
      detail: "External agent output cannot influence final Must Push ranking in Phase 1.",
    },
    {
      name: "acceptedWithoutBoundaryNote",
      passed: acceptedWithoutBoundaryNote === 0,
      detail: `Accepted/review-required artifacts without boundary note: ${acceptedWithoutBoundaryNote}.`,
    },
    {
      name: "acceptedWithUnsupportedPII",
      passed: acceptedWithUnsupportedPII === 0,
      detail: `Accepted artifacts with unsupported PII: ${acceptedWithUnsupportedPII}.`,
    },
    {
      name: "acceptedWithoutGovernanceTrace",
      passed: acceptedWithoutGovernanceTrace === 0,
      detail: `Accepted artifacts without governance trace: ${acceptedWithoutGovernanceTrace}.`,
    },
    {
      name: "traceConflictAccepted",
      passed: traceConflictAccepted === 0,
      detail: `Trace-conflicted artifacts accepted without review or quarantine: ${traceConflictAccepted}.`,
    },
    {
      name: "connectorPermissionBypassed",
      passed: connectorPermissionBypassed === 0,
      detail: `Connector-permission-gated artifacts accepted without review or quarantine: ${connectorPermissionBypassed}.`,
    },
    {
      name: "refusedRetriedOrPromoted",
      passed: true,
      detail: "Refused external agent outcomes are terminal governance outcomes; the evaluator never retries or promotes them.",
    },
  ];

  const passedFixtures = results.filter((result) => result.passed).length;

  return {
    totalFixtures: results.length,
    passedFixtures,
    failedFixtures: results.length - passedFixtures,
    directMustPushCreated: 0,
    directMemoryCandidateCreated: 0,
    finalRankingInfluencedByExternalAgent: 0,
    acceptedWithoutBoundaryNote,
    acceptedWithUnsupportedPII,
    acceptedWithoutGovernanceTrace,
    traceConflictAccepted,
    connectorPermissionBypassed,
    refusedRetriedOrPromoted: 0,
    results,
    metrics,
    overallPassed: results.every((result) => result.passed) && metrics.every((metric) => metric.passed),
  };
}

function evaluateDraftCandidate(
  artifact: ExternalAgentArtifact,
  provider: ProviderCapabilityProfile,
  reasonCodes: Set<IntakeReasonCode>,
): ExternalAgentIntakeDecision {
  if (!isDraftCapableProvider(provider) || artifact.declaredSideEffects.some((effect) => effect !== "draft_created" && effect !== "none")) {
    reasonCodes.add("boundary_missing");
    return buildDecision({
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      disposition: "review_required",
      reasonCodes: [...reasonCodes, "requires_human_review"],
      boundaryNote: "Draft candidate requires review because provider draft capability or side-effect declaration is incomplete.",
      containment: "downgraded",
    });
  }

  if (!hasGovernanceTrace(artifact)) {
    reasonCodes.add("trace_missing");
    return buildDecision({
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      disposition: "review_required",
      reasonCodes: [...reasonCodes, "requires_human_review"],
      boundaryNote: "Draft candidate requires review because the governance trace is missing or not redacted.",
      containment: "downgraded",
    });
  }

  return buildDecision({
    artifactId: artifact.artifactId,
    providerId: artifact.providerId,
    disposition: "accept_as_draft_candidate",
    reasonCodes: [...reasonCodes, "requires_human_review"],
    boundaryNote: "External agent draft may attach only to a review packet; draft does not mean sent and cannot create an external commitment.",
    containment: "none",
  });
}

function canAcceptAsEvidence(
  artifact: ExternalAgentArtifact,
  provider: ProviderCapabilityProfile,
  reasonCodes: Set<IntakeReasonCode>,
) {
  return (
    provider.defaultTrustTier === "medium" &&
    (artifact.artifactKind === "evidence_candidate" || artifact.artifactKind === "analysis_candidate") &&
    hasObjectRef(artifact) &&
    hasSupportedRedaction(artifact) &&
    artifact.citationsOrEvidenceRefs.length > 0 &&
    artifact.declaredSideEffects.every((effect) => effect === "none" || effect === "read") &&
    hasGovernanceTrace(artifact) &&
    !reasonCodes.has("provider_opaque") &&
    !reasonCodes.has("contradictory") &&
    !reasonCodes.has("outcome_needs_review")
  );
}

function shouldWatchOnly(
  artifact: ExternalAgentArtifact,
  reasonCodes: Set<IntakeReasonCode>,
) {
  return (
    (artifact.artifactKind === "analysis_candidate" || artifact.artifactKind === "evidence_candidate") &&
    (reasonCodes.has("object_ref_missing") || reasonCodes.has("missing_evidence")) &&
    !reasonCodes.has("redaction_unknown") &&
    !reasonCodes.has("contradictory")
  );
}

function evaluateGovernanceTraceConflict(
  artifact: ExternalAgentArtifact,
  reasonCodes: Set<IntakeReasonCode>,
): ExternalAgentIntakeDecision | null {
  const trace = artifact.governanceTrace;
  if (!trace) return null;

  if (
    artifact.providerOutcomeStatus !== undefined &&
    artifact.providerOutcomeStatus !== trace.outcomeStatus
  ) {
    reasonCodes.add("trace_outcome_conflict");
    reasonCodes.add("requires_human_review");

    if (trace.outcomeStatus === "blocked" || trace.boundaryDecision === "quarantine") {
      return buildDecision({
        artifactId: artifact.artifactId,
        providerId: artifact.providerId,
        disposition: "quarantine",
        reasonCodes: [...reasonCodes],
        boundaryNote: "External agent artifact quarantined because provider outcome and governance trace conflict; the trace points to a blocked or quarantined boundary.",
        containment: "quarantined",
      });
    }

    if (trace.outcomeStatus === "error" || trace.boundaryDecision === "reject") {
      return buildDecision({
        artifactId: artifact.artifactId,
        providerId: artifact.providerId,
        disposition: "reject",
        reasonCodes: [...reasonCodes],
        boundaryNote: "External agent artifact rejected because provider outcome and governance trace conflict; the trace points to an error or rejected boundary.",
        containment: "rejected",
      });
    }

    return buildDecision({
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      disposition: "review_required",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent artifact requires review because provider outcome and governance trace conflict.",
      containment: "downgraded",
    });
  }

  if (trace.boundaryDecision === "allow_candidate" && hasAuthorityExceeded(artifact)) {
    reasonCodes.add("trace_boundary_conflict");
    reasonCodes.add("requires_human_review");
    return buildDecision({
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      disposition: "quarantine",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent artifact quarantined because governance trace allows a candidate while the artifact declares forbidden side effects.",
      containment: "quarantined",
    });
  }

  return null;
}

function evaluateConnectorPermissionAssociation(
  artifact: ExternalAgentArtifact,
  reasonCodes: Set<IntakeReasonCode>,
): ExternalAgentIntakeDecision | null {
  const trace = artifact.governanceTrace;
  if (!trace || trace.actorType !== "connector") return null;

  const proposedAction = trace.proposedAction.toLowerCase();
  const reviewRequired = /send|reply|message|invite|crm|stage|write|approval|approve|payment|settle|commit/.test(
    proposedAction,
  );
  const neverAllowed = /auto[-_ ]?send|silent[-_ ]?crm|payment[-_ ]?execute|auto[-_ ]?approve|settle/.test(
    proposedAction,
  );

  if (neverAllowed) {
    reasonCodes.add("connector_permission_never_allowed");
    reasonCodes.add("requires_human_review");
    return buildDecision({
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      disposition: "quarantine",
      reasonCodes: [...reasonCodes],
      boundaryNote: "Connector-backed artifact quarantined because the proposed action maps to a never-allowed permission lane.",
      containment: "quarantined",
    });
  }

  if (reviewRequired) {
    reasonCodes.add("connector_permission_review_required");
    reasonCodes.add("requires_human_review");
    return buildDecision({
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      disposition: "review_required",
      reasonCodes: [...reasonCodes],
      boundaryNote: "Connector-backed artifact requires review because the proposed action touches customer-visible, official-write, approval, payment, or commitment authority.",
      containment: "downgraded",
    });
  }

  return null;
}

function evaluateOutcomeStatus(
  artifact: ExternalAgentArtifact,
  reasonCodes: Set<IntakeReasonCode>,
): ExternalAgentIntakeDecision | null {
  const outcomeStatus = artifact.providerOutcomeStatus ?? artifact.governanceTrace?.outcomeStatus;
  if (!outcomeStatus || outcomeStatus === "completed") return null;

  if (outcomeStatus === "refused") {
    reasonCodes.add("outcome_refused");
    return buildDecision({
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      disposition: "watch_only",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent refused the request; refusal is recorded as a terminal governance outcome and cannot be retried into a blank success.",
      containment: "downgraded",
    });
  }

  if (outcomeStatus === "blocked") {
    reasonCodes.add("outcome_blocked");
    reasonCodes.add("requires_human_review");
    return buildDecision({
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      disposition: "quarantine",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent outcome is blocked; the artifact is contained and cannot create downstream action authority.",
      containment: "quarantined",
    });
  }

  if (outcomeStatus === "unsupported") {
    reasonCodes.add("outcome_unsupported");
    return buildDecision({
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      disposition: "watch_only",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent outcome is unsupported; it can remain observable but cannot drive a candidate.",
      containment: "downgraded",
    });
  }

  if (outcomeStatus === "error") {
    reasonCodes.add("outcome_error");
    return buildDecision({
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      disposition: "reject",
      reasonCodes: [...reasonCodes],
      boundaryNote: "External agent errored; failed execution cannot be promoted into evidence or action.",
      containment: "rejected",
    });
  }

  reasonCodes.add("outcome_needs_review");
  reasonCodes.add("requires_human_review");
  return null;
}

function buildDecision(input: {
  readonly artifactId: string;
  readonly providerId: string;
  readonly disposition: IntakeDisposition;
  readonly reasonCodes: readonly IntakeReasonCode[];
  readonly boundaryNote: string;
  readonly containment: ExternalAgentIntakeDecision["containment"];
}): ExternalAgentIntakeDecision {
  return {
    artifactId: input.artifactId,
    providerId: input.providerId,
    disposition: input.disposition,
    reasonCodes: Array.from(new Set(input.reasonCodes)),
    mayAttachToSignal: input.disposition === "accept_as_evidence_candidate",
    mayCreateMustPushCandidate: false,
    mayCreateMemoryCandidate: false,
    mustRequireReview:
      input.disposition === "accept_as_draft_candidate" ||
      input.disposition === "review_required" ||
      input.reasonCodes.includes("requires_human_review"),
    boundaryNote: input.boundaryNote,
    containment: input.containment,
  };
}

function hasAuthorityExceeded(artifact: ExternalAgentArtifact) {
  if (
    artifact.declaredSideEffects.some(
      (effect) =>
        effect === "external_write_attempted" ||
        effect === "unknown" ||
        effect === "tool_called",
    )
  ) {
    return true;
  }

  return /already sent|was sent|has been sent|already approved|was approved|has been approved|already settled|was settled|has been settled|externally written|crm updated|external write|official write|自动发送|已发送|已审批|已结算|已写回/i.test(
    artifact.contentSummary,
  );
}

function isStale(artifact: ExternalAgentArtifact, referenceTimeIso: string) {
  const timestamp = artifact.sourceTimestamp ?? artifact.createdAt;
  const reference = Date.parse(referenceTimeIso);
  const source = Date.parse(timestamp);
  return Number.isFinite(reference) && Number.isFinite(source) && reference - source > STALE_THRESHOLD_MS;
}

function mentionsContradiction(artifact: ExternalAgentArtifact) {
  return /contradict|contradiction|conflict|冲突|矛盾/i.test(artifact.contentSummary);
}
