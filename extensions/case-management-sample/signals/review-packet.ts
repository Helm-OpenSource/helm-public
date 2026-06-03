import type {
  SignalCandidate,
  SignalGapField,
  SignalSourceRef,
  SignalSubject,
} from "./types";
import type { SampleCaseSignalPayload } from "./case/case-mapper";

export type PublicCoreMemoryCandidateKind =
  | "fact"
  | "commitment"
  | "blocker"
  | "risk"
  | "opportunity";

export type PublicCoreMemoryCandidate = {
  candidateId: string;
  kind: PublicCoreMemoryCandidateKind;
  subject: SignalSubject;
  sourceRef: SignalSourceRef;
  observedAt: string;
  status: "candidate_only";
  officialMemoryWritePerformed: false;
  requiresHumanReview: true;
  evidenceRefs: readonly string[];
  confidence: SignalCandidate<SampleCaseSignalPayload>["confidence"];
  gapFields: readonly SignalGapField[];
  persistence: {
    rawTranscriptPersisted: false;
    llmSummaryPersisted: false;
    connectorTokenPersisted: false;
    retainedContent: "redacted_summary_and_evidence_refs_only";
  };
};

export type PublicCoreReviewPacket = {
  packetId: string;
  owner: SignalCandidate<SampleCaseSignalPayload>["scope"]["owner"];
  evidence: ReadonlyArray<{
    sourceRef: string;
    observedAt: string;
    subjectRef: string;
  }>;
  recommendation: string;
  risks: readonly string[];
  boundaries: readonly string[];
  nextSteps: readonly string[];
  memoryCandidateIds: readonly string[];
  humanReviewerRequired: true;
  notForAutoSend: true;
  sent: false;
  approved: false;
  executed: false;
  committed: false;
  officialWritePerformed: false;
  crmWritePerformed: false;
};

export function buildMemoryCandidateFromSignal(
  signal: SignalCandidate<SampleCaseSignalPayload>,
): PublicCoreMemoryCandidate {
  return {
    candidateId: `memory-candidate:${signal.identity.signalKey}`,
    kind: classifyMemoryCandidateKind(signal),
    subject: signal.subject,
    sourceRef: signal.sourceRef,
    observedAt: signal.observedAt.toISOString(),
    status: "candidate_only",
    officialMemoryWritePerformed: false,
    requiresHumanReview: true,
    evidenceRefs: [signal.sourceRef.sourceRef],
    confidence: signal.confidence,
    gapFields: signal.gapFields,
    persistence: {
      rawTranscriptPersisted: false,
      llmSummaryPersisted: false,
      connectorTokenPersisted: false,
      retainedContent: "redacted_summary_and_evidence_refs_only",
    },
  };
}

export function buildReviewPacketFromSignal(
  signal: SignalCandidate<SampleCaseSignalPayload>,
  memoryCandidate: PublicCoreMemoryCandidate,
): PublicCoreReviewPacket {
  return {
    packetId: `review-packet:${signal.identity.signalKey}`,
    owner: signal.scope.owner,
    evidence: [
      {
        sourceRef: signal.sourceRef.sourceRef,
        observedAt: signal.observedAt.toISOString(),
        subjectRef: signal.subject.refId,
      },
    ],
    recommendation: `Prepare ${signal.payload.nextAction} review for ${signal.subject.label}; recommendation is not a commitment.`,
    risks: buildRisks(signal),
    boundaries: [
      "recommendation != commitment",
      "review packet != approval",
      "no auto-send",
      "no CRM writeback",
      "no official memory write",
    ],
    nextSteps: [
      `Open review packet for ${signal.scope.owner.refId}`,
      "Confirm evidence and missing fields before any customer-visible draft leaves Helm.",
    ],
    memoryCandidateIds: [memoryCandidate.candidateId],
    humanReviewerRequired: true,
    notForAutoSend: true,
    sent: false,
    approved: false,
    executed: false,
    committed: false,
    officialWritePerformed: false,
    crmWritePerformed: false,
  };
}

function classifyMemoryCandidateKind(
  signal: SignalCandidate<SampleCaseSignalPayload>,
): PublicCoreMemoryCandidateKind {
  if (signal.payload.blocker === "boundary_attempt") return "risk";
  if (signal.payload.blocker !== "none") return "blocker";
  if (signal.payload.nextAction === "collect_evidence") return "fact";
  if (signal.payload.reviewRequired) return "commitment";
  return "opportunity";
}

function buildRisks(signal: SignalCandidate<SampleCaseSignalPayload>): readonly string[] {
  const risks = signal.gapFields.map(
    (gap) => `${gap.field}:${gap.severity}:${gap.detail}`,
  );

  if (signal.payload.blocker !== "none") {
    risks.push(`blocker:${signal.payload.blocker}`);
  }

  return risks;
}
