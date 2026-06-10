import { describe, expect, it } from "vitest";

import {
  isClosedStage,
  mapCaseRecordToSignals,
  normalizeSampleCaseStage,
  type SampleCaseRecord,
} from "./case-mapper";

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

  it("treats raw closed statuses from a real backend as closed (no signals)", () => {
    // Real debt-collection backends use lowercase finish/close, not the
    // sample's literal "closed" — the old `stage === "closed"` check mis-read
    // these as open.
    for (const raw of ["finish", "close", "CLOSED", " Done "]) {
      expect(
        mapCaseRecordToSignals({ ...baseCase, stage: raw as SampleCaseRecord["stage"] }),
      ).toEqual([]);
    }
  });
});

describe("normalizeSampleCaseStage (ingestion boundary)", () => {
  it("maps the real debt-collection vocabulary safely", () => {
    expect(normalizeSampleCaseStage("finish")).toBe("closed");
    expect(normalizeSampleCaseStage("close")).toBe("closed");
    expect(normalizeSampleCaseStage("create")).toBe("active_followup");
    expect(normalizeSampleCaseStage("dealing")).toBe("active_followup");
    // handed-off / unknown-disposition statuses are surfaced for review, not
    // silently treated as routine-active or silently dropped as closed.
    expect(normalizeSampleCaseStage("transfer")).toBe("review_required");
    expect(normalizeSampleCaseStage("processed")).toBe("review_required");
    expect(normalizeSampleCaseStage("replied")).toBe("review_required");
    expect(normalizeSampleCaseStage("totally-unknown")).toBe("review_required");
    expect(normalizeSampleCaseStage(null)).toBe("review_required");
  });

  it("lets adopters declare their own backend vocabulary via overrides", () => {
    const overrides = { processed: "closed", replied: "active_followup" } as const;
    expect(normalizeSampleCaseStage("processed", overrides)).toBe("closed");
    expect(normalizeSampleCaseStage("replied", overrides)).toBe("active_followup");
    // overrides do not weaken the safe default for truly-unknown statuses
    expect(normalizeSampleCaseStage("mystery", overrides)).toBe("review_required");
  });

  it("isClosedStage recognizes drifted closed tokens case-insensitively", () => {
    expect(isClosedStage("finish")).toBe(true);
    expect(isClosedStage("CLOSE")).toBe(true);
    expect(isClosedStage("dealing")).toBe(false);
    expect(isClosedStage(null)).toBe(false);
  });
});
