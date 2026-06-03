import { describe, expect, it } from "vitest";

import { mapCaseRecordToSignals, type SampleCaseRecord } from "./case-mapper";

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

describe("case-management-sample case mapper", () => {
  it("maps a boundary-attempt case to a critical review-first signal", () => {
    const [signal] = mapCaseRecordToSignals(baseCase);

    expect(signal).toMatchObject({
      identity: {
        workspaceId: "workspace-sample",
        tenantKey: "case-management-sample",
        sourceWindowKey: "CASE-SAMPLE-001:2026-05-18",
        signalKey: "case-review:CASE-SAMPLE-001",
        severity: "critical",
      },
      resourceId: "CASE-SAMPLE-001",
      sourceRef: {
        sourceKind: "case_system",
        sourceId: "CASE-SAMPLE-001",
        sourceRef: "case_system:CASE-SAMPLE-001",
      },
      subject: {
        kind: "case",
        refId: "CASE-SAMPLE-001",
        label: "CASE-SAMPLE-001",
      },
      payload: {
        blocker: "boundary_attempt",
        reviewRequired: true,
        nextAction: "review_boundary",
      },
      confidence: "trusted",
    });
    expect(signal.observedAt.toISOString()).toBe("2026-05-18T00:00:00.000Z");
    expect(signal.gapFields).toEqual([
      {
        field: "boundary_review",
        severity: "critical",
        detail: "boundary_attempt requires a human review packet before any customer-visible action",
      },
    ]);
  });

  it("does not emit signals for closed cases", () => {
    expect(mapCaseRecordToSignals({ ...baseCase, stage: "closed" })).toEqual([]);
  });

  it("downgrades confidence when evidence is missing", () => {
    const [signal] = mapCaseRecordToSignals({
      ...baseCase,
      stage: "evidence_gap",
      evidenceCount: 0,
      blockedReason: "missing_evidence",
    });

    expect(signal.identity.severity).toBe("breach");
    expect(signal.confidence).toBe("degraded");
    expect(signal.payload.nextAction).toBe("collect_evidence");
    expect(signal.gapFields).toEqual([
      {
        field: "evidence",
        severity: "breach",
        detail: "case has no reviewable evidence attached",
      },
    ]);
  });
});
