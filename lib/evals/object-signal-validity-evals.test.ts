import { describe, expect, it } from "vitest";
import {
  runObjectSignalRemediationEval,
  runObjectSignalValidityEval,
  type ObjectSignalRemediationFixturePack,
  type ObjectSignalValidityFixturePack,
} from "@/lib/evals/object-signal-validity-evals";

describe("object signal validity eval", () => {
  it("passes the checked-in object/signal validity fixture pack", () => {
    const summary = runObjectSignalValidityEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(10);
    expect(summary.mustPushReadyCases).toBe(1);
    expect(summary.reviewRequiredCases).toBe(3);
    expect(summary.watchOnlyCases).toBe(2);
    expect(summary.rejectedCases).toBe(4);
    expect(summary.invalidMustPushCount).toBe(0);

    const unsafe = summary.caseResults.find((item) => item.caseId === "OBJ-SIG-UNSAFE-AUTHORITY-001");
    expect(unsafe?.disposition).toBe("rejected");
    expect(unsafe?.reasons).toContain("llm_final_ranking_forbidden");
    expect(unsafe?.reasons).toContain("official_write_intent_forbidden");
    expect(unsafe?.reasons).toContain("auto_promotion_forbidden");

    const permission = summary.caseResults.find(
      (item) => item.caseId === "OBJ-SIG-INSUFFICIENT-PERMISSION-001",
    );
    expect(permission?.disposition).toBe("rejected");
    expect(permission?.reasons).toContain("permission_insufficient");
    expect(permission?.boundaryIncidentCount).toBeGreaterThan(0);

    const hallucinated = summary.caseResults.find(
      (item) => item.caseId === "OBJ-SIG-HALLUCINATED-EVIDENCE-001",
    );
    expect(hallucinated?.disposition).toBe("rejected");
    expect(hallucinated?.reasons).toContain("hallucinated_evidence");
    expect(hallucinated?.boundaryIncidentCount).toBeGreaterThan(0);
  });

  it("blocks a case that expects Must Push readiness with stale and weak evidence", () => {
    const fixture = {
      version: "broken",
      status: "offline_evaluation_fixture",
      redactionPosture: "synthetic",
      boundary: "test-only",
      targets: {
        minimumReadyScore: 85,
        minimumEvidenceRefCount: 2,
        maximumFreshnessHours: 168,
        maximumInvalidMustPushCount: 0,
        maximumMustPushBoundaryIncidentCount: 0,
      },
      cases: [
        {
          id: "BROKEN-MUST-PUSH",
          expectedDisposition: "must_push_ready",
          object: {
            workspaceId: "workspace_demo",
            tenantKey: "helm-internal",
            sourceWindowKey: "2026-W18",
            objectType: "opportunity",
            objectId: "opportunity:broken",
            canonicalObjectRef: "opportunity:broken",
            identityStable: true,
            tenantMismatch: false,
            crossWorkspaceConflict: false,
          },
          signal: {
            signalKey: "stalled_opportunity:broken",
            signalType: "stalled_opportunity",
            severity: "high",
            evidenceRefs: ["crm:broken:old"],
            evidenceFreshnessHours: 240,
            sourceCount: 1,
            hasOwner: true,
            hasNextAction: true,
            hasBoundaryNote: true,
            hasReviewPosture: true,
            hasOutcomeMetric: true,
            contradictoryEvidenceRefs: [],
            duplicateSignal: false,
            unsafeBoundary: false,
            llmFinalRanking: false,
            autoPromotion: false,
            officialWriteIntent: false,
          },
        },
      ],
    } satisfies ObjectSignalValidityFixturePack;

    const summary = runObjectSignalValidityEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.invalidMustPushCount).toBe(1);
    expect(summary.failures).toContainEqual({
      caseId: "BROKEN-MUST-PUSH",
      reason: "disposition_expectation_mismatch",
    });
    expect(summary.caseResults[0]?.reasons).toContain("evidence_stale");
    expect(summary.caseResults[0]?.reasons).toContain("evidence_ref_count_below_target:1");
  });
});

describe("object signal post-admission remediation eval", () => {
  it("passes the checked-in remediation fixture pack", () => {
    const summary = runObjectSignalRemediationEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(4);
    expect(summary.revokedCases).toBe(1);
    expect(summary.downgradedCases).toBe(1);
    expect(summary.quarantinedCases).toBe(2);
    expect(summary.uncontainedCount).toBe(0);
    expect(summary.canonicalMemoryWriteCount).toBe(0);
    expect(summary.officialWriteCount).toBe(0);
    expect(summary.learningCandidateCount).toBe(4);
    expect(summary.averageBlastRadiusCoveragePercent).toBe(100);

    const crossWorkspace = summary.caseResults.find((item) => item.caseId === "OBJ-SIG-REJECT-CROSS-WORKSPACE-001");
    expect(crossWorkspace?.finalDisposition).toBe("rejected");
    expect(crossWorkspace?.actions).toContain("tombstone_canonical_memory");
    expect(crossWorkspace?.memoryContaminationContained).toBe(true);
  });

  it("fails if a contaminated canonical memory write is not tombstoned", () => {
    const fixture = {
      version: "broken-remediation",
      status: "offline_evaluation_fixture",
      redactionPosture: "synthetic",
      boundary: "test-only",
      targets: {
        maximumUncontainedCount: 0,
        maximumCanonicalMemoryWrites: 0,
        maximumOfficialWrites: 0,
        minimumBlastRadiusCoveragePercent: 100,
        minimumLearningCandidateCount: 1,
      },
      cases: [
        {
          id: "BROKEN-CANONICAL-MEMORY",
          initialDisposition: "must_push_ready",
          expectedFinalDisposition: "rejected",
          expectedContainment: "quarantined",
          currentExposures: {
            mustPushItemIds: ["must-push:broken"],
            reviewPacketIds: [],
            draftIds: [],
            memoryCandidateIds: [],
            canonicalMemoryIds: ["memory:broken"],
            skillSuggestionIds: [],
            officialWriteIds: [],
          },
          postAdmissionFindings: {
            staleEvidence: false,
            contradictoryEvidence: false,
            duplicateSignal: false,
            wrongObjectBinding: true,
            tenantMismatch: true,
            unsafeBoundary: false,
            officialWriteIntent: false,
            canonicalMemoryWrite: true,
          },
          operatorCorrection: "wrong_object",
          expectedActions: ["remove_must_push"],
        },
      ],
    } satisfies ObjectSignalRemediationFixturePack;

    const summary = runObjectSignalRemediationEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.uncontainedCount).toBe(1);
    expect(summary.canonicalMemoryWriteCount).toBe(1);
    expect(summary.caseResults[0]?.memoryContaminationContained).toBe(false);
    expect(summary.failures).toContainEqual({
      caseId: "BROKEN-CANONICAL-MEMORY",
      reason: "canonical_memory_not_tombstoned",
    });
  });
});
