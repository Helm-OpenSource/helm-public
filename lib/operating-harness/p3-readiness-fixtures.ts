import {
  HARNESS_P3_READINESS_EVIDENCE_SCHEMA_VERSION,
  computeHarnessP3ReadinessEvidenceContentHash,
  type HarnessP3ReadinessEvidence,
} from "./p3-readiness";

export function syntheticCurrentP3ReadinessEvidence(): HarnessP3ReadinessEvidence {
  const content = {
    schemaVersion: HARNESS_P3_READINESS_EVIDENCE_SCHEMA_VERSION,
    evidenceId: "p3-readiness:current-public-synthetic",
    attestationMode: "synthetic_contract_test" as const,
    operationalAttestation: {
      ownerReviewReceiptRef: null,
      registrySnapshotHash: null,
      signedAt: null,
    },
    asOf: "2026-07-12T08:00:00.000Z",
    prerequisites: [
      {
        phase: "P0" as const,
        mergedToMain: false,
        gateRef: "pr:operating-harness-p0",
        gateHash: `sha256:${"1".repeat(64)}`,
      },
      {
        phase: "P1" as const,
        mergedToMain: false,
        gateRef: "pr:operating-harness-p1",
        gateHash: `sha256:${"2".repeat(64)}`,
      },
      {
        phase: "P2" as const,
        mergedToMain: false,
        gateRef: "pr:operating-harness-p2",
        gateHash: `sha256:${"3".repeat(64)}`,
      },
    ],
    evaluationWindow: {
      windowStart: "2026-07-12T00:00:00.000Z",
      windowEnd: "2026-07-12T08:00:00.000Z",
      complete: true,
      windowReceiptRef: "window:public-synthetic-p2",
      totalCandidateRunCount: 1,
      runs: [
        {
          runId: "run:public-synthetic-p2",
          candidateRevisionId: "oh-expert-v2",
          heldoutSetRef: "heldout:public-synthetic-b2",
          heldoutSetHash: `sha256:${"4".repeat(64)}`,
          completedAt: "2026-07-12T07:00:00.000Z",
          sourceClasses: ["synthetic_public" as const],
          businessObjectKinds: ["object:organization-health"],
          evidenceMode: "synthetic_fixture" as const,
          heldoutLift: 0.1,
          expectedCalibrationError: 0.08,
          calibrationSampleCount: 2,
          evidenceCoverage: 1,
          reviewerCompleteness: 1,
          boundaryIncidentCount: 0,
          decision: "owner_review_candidate" as const,
          freshHeldoutConfirmed: true,
          weaknessEvidenceReproduced: true,
          ownerReviewReceiptRef: null,
        },
      ],
    },
    feedbackSummary: {
      eligibleEditRejectCount: 2,
      promotedEvalCaseCount: 0,
      receiptRefs: ["feedback-window:public-synthetic"],
    },
    deidentifiedPromotions: [],
    rollbackDrills: [],
    protectedComponentMutationCount: 0,
    productionAuthorityGrantCount: 0,
  };
  return {
    ...content,
    contentHash: computeHarnessP3ReadinessEvidenceContentHash(content),
  };
}
