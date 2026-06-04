import { describe, expect, it } from "vitest";

import { mapCaseRecordToSignals, type SampleCaseRecord } from "./case/case-mapper";
import {
  buildMemoryCandidateFromSignal,
  buildReviewPacketFromSignal,
} from "./review-packet";

const baseCase: SampleCaseRecord = {
  workspaceId: "workspace-sample",
  caseId: "CASE-SAMPLE-001",
  ownerRefId: "employee-alice",
  stage: "review_required",
  ageDays: 3,
  priorityScore: 91,
  evidenceCount: 4,
  blockedReason: "boundary_attempt",
  observedDate: "2026-05-18",
};

describe("case-management-sample evidence to review packet chain", () => {
  it("keeps extracted operating signals as memory candidates only", () => {
    const [signal] = mapCaseRecordToSignals(baseCase);
    const candidate = buildMemoryCandidateFromSignal(signal);

    expect(candidate).toMatchObject({
      candidateId: "memory-candidate:case-review:CASE-SAMPLE-001",
      kind: "risk",
      subject: signal.subject,
      sourceRef: signal.sourceRef,
      observedAt: "2026-05-18T00:00:00.000Z",
      status: "candidate_only",
      officialMemoryWritePerformed: false,
      requiresHumanReview: true,
      persistence: {
        rawTranscriptPersisted: false,
        llmSummaryPersisted: false,
        connectorTokenPersisted: false,
        retainedContent: "redacted_summary_and_evidence_refs_only",
      },
    });
    expect(candidate.evidenceRefs).toEqual(["case_system:CASE-SAMPLE-001"]);
    expect(candidate.gapFields).toEqual(signal.gapFields);
  });

  it("prepares a review packet without treating recommendation as commitment", () => {
    const [signal] = mapCaseRecordToSignals(baseCase);
    const candidate = buildMemoryCandidateFromSignal(signal);
    const packet = buildReviewPacketFromSignal(signal, candidate);

    expect(packet).toMatchObject({
      packetId: "review-packet:case-review:CASE-SAMPLE-001",
      owner: {
        kind: "employee",
        refId: "employee-alice",
      },
      evidence: [
        {
          sourceRef: "case_system:CASE-SAMPLE-001",
          observedAt: "2026-05-18T00:00:00.000Z",
          subjectRef: "CASE-SAMPLE-001",
        },
      ],
      memoryCandidateIds: ["memory-candidate:case-review:CASE-SAMPLE-001"],
      boundaries: [
        "recommendation != commitment",
        "review packet != approval",
        "no auto-send",
        "no CRM writeback",
        "no official memory write",
      ],
      humanReviewerRequired: true,
      notForAutoSend: true,
      sent: false,
      approved: false,
      executed: false,
      committed: false,
      officialWritePerformed: false,
      crmWritePerformed: false,
    });
    expect(packet.recommendation).toContain("review_boundary");
    expect(packet.nextSteps).toContain("Open review packet for employee-alice");
    expect(packet.risks.join(" ")).toContain("boundary_attempt");
  });
});
