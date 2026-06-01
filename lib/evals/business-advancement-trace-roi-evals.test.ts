import { describe, expect, it } from "vitest";
import {
  runBusinessAdvancementTraceRoiEval,
  type TraceRoiCase,
  type TraceRoiFixturePack,
} from "./business-advancement-trace-roi-evals";

describe("business advancement trace + ROI eval (P0-REQ-05)", () => {
  it("passes the default fixture pack with full trace coverage", () => {
    const summary = runBusinessAdvancementTraceRoiEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBeGreaterThanOrEqual(15);
    expect(summary.scorecard.auditTraceCoveragePercent).toBe(100);
    expect(summary.scorecard.wrongCommitmentIncidentCount).toBe(0);
    expect(summary.scorecard.preventedWrongCommitmentCount).toBeGreaterThanOrEqual(1);
    expect(summary.scorecard.dealsRescuedCount).toBeGreaterThanOrEqual(1);
    expect(summary.scorecard.draftAdoptionPercent).toBeGreaterThanOrEqual(50);
    expect(summary.scorecard.followUp48hCompletionPercent).toBeGreaterThanOrEqual(60);

    for (const result of summary.caseResults) {
      expect(result.traceCoverageMissing).toEqual([]);
      expect(result.wrongCommitmentIncident).toBe(false);
    }
  });

  it("flags any case where official write happened without reviewer approval", () => {
    const baseCase: TraceRoiCase = {
      id: "TRACE-WRONG-COMMIT",
      scenario: "synthetic: official write performed without reviewer approval",
      trace: {
        meetingExtraction: {
          source: "meeting:alias-x",
          extractedAtIso: "2026-04-30T08:00:00.000Z",
        },
        mustPushCreation: {
          mustPushItemId: "must-push:alias-x",
          createdAtIso: "2026-04-30T08:05:00.000Z",
          ownerSuggestionRole: "客户负责人",
        },
        reviewDecision: {
          reviewer: "manager:demo",
          decidedAtIso: "2026-04-30T08:10:00.000Z",
          decision: "accept",
          boundaryNote: "draft != send",
          finalPosture: "review_required",
        },
        draftPreparation: {
          draftId: "draft:alias-x",
          preparedAtIso: "2026-04-30T08:15:00.000Z",
          adopted: true,
        },
        crmWriteBack: {
          writeBackId: "crm:alias-x",
          previewedAtIso: "2026-04-30T08:20:00.000Z",
          officialWritePerformed: true,
          approvedByReviewer: false,
        },
      },
      roiOutcome: {
        followUpCompletedWithin48h: true,
        dealRescued: false,
        managerReviewTimeSavedMinutes: 0,
        draftAdopted: true,
        preventedWrongCommitment: false,
      },
    };

    const pack: TraceRoiFixturePack = {
      version: "trace-roi-test",
      status: "offline_evaluation_fixture",
      redactionPosture: "synthetic_and_alias_only",
      boundary: "planning_only",
      targets: {
        minimumTraceCoveragePercent: 100,
        minimumFollowUp48hCompletionPercent: 60,
        maximumWrongCommitmentIncidentCount: 0,
        minimumPreventedWrongCommitmentCount: 0,
        minimumDraftAdoptionPercent: 0,
        minimumDealsRescuedCount: 0,
        minimumManagerReviewTimeSavedMinutes: 0,
      },
      cases: [baseCase],
    };

    const summary = runBusinessAdvancementTraceRoiEval(pack);

    expect(summary.passed).toBe(false);
    expect(summary.scorecard.wrongCommitmentIncidentCount).toBe(1);
    expect(
      summary.failures.some((f) => f.reason === "wrong_commitment_incident"),
    ).toBe(true);
    expect(
      summary.failures.some((f) => f.reason.startsWith("wrong_commitment_incident_count")),
    ).toBe(true);
  });

  it("flags trace coverage gaps when reviewer or boundary is missing", () => {
    const blankCase: TraceRoiCase = {
      id: "TRACE-COVERAGE-GAP",
      scenario: "synthetic: reviewer + boundary blank",
      trace: {
        meetingExtraction: {
          source: "meeting:alias-y",
          extractedAtIso: "2026-04-30T08:00:00.000Z",
        },
        mustPushCreation: {
          mustPushItemId: "must-push:alias-y",
          createdAtIso: "2026-04-30T08:05:00.000Z",
          ownerSuggestionRole: "客户负责人",
        },
        reviewDecision: {
          reviewer: "",
          decidedAtIso: "2026-04-30T08:10:00.000Z",
          decision: "accept",
          boundaryNote: "",
          finalPosture: "review_required",
        },
        draftPreparation: null,
        crmWriteBack: null,
      },
      roiOutcome: {
        followUpCompletedWithin48h: true,
        dealRescued: false,
        managerReviewTimeSavedMinutes: 0,
        draftAdopted: false,
        preventedWrongCommitment: false,
      },
    };

    const pack: TraceRoiFixturePack = {
      version: "trace-roi-test",
      status: "offline_evaluation_fixture",
      redactionPosture: "synthetic_and_alias_only",
      boundary: "planning_only",
      targets: {
        minimumTraceCoveragePercent: 100,
        minimumFollowUp48hCompletionPercent: 0,
        maximumWrongCommitmentIncidentCount: 0,
        minimumPreventedWrongCommitmentCount: 0,
        minimumDraftAdoptionPercent: 0,
        minimumDealsRescuedCount: 0,
        minimumManagerReviewTimeSavedMinutes: 0,
      },
      cases: [blankCase],
    };

    const summary = runBusinessAdvancementTraceRoiEval(pack);
    const result = summary.caseResults[0];

    expect(result.traceCoverageMissing).toEqual(
      expect.arrayContaining(["reviewer", "boundary"]),
    );
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) => f.reason.startsWith("trace_missing")),
    ).toBe(true);
  });
});
