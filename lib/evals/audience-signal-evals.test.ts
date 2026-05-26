import { describe, expect, it } from "vitest";

import {
  evaluateAudienceSignalCase,
  runAudienceSignalEval,
  type AudienceSignalEvalCase,
  type AudienceSignalFixturePack,
} from "@/lib/evals/audience-signal-evals";

function baseCase(overrides: Partial<AudienceSignalEvalCase> = {}): AudienceSignalEvalCase {
  return {
    id: "AUD-SIG-TEST",
    expectedDecision: "surface_to_human_and_worker",
    candidate: {
      validityDisposition: "must_push_ready",
      signalType: "overdue_commitment",
      severity: "high",
      objectRef: "commitment:test",
      evidenceRefs: ["meeting:test", "crm:test", "owner-note:test"],
      contradictoryEvidenceRefs: [],
      hasOwner: true,
      hasNextAction: true,
      hasBoundaryNote: true,
      hasReviewPosture: true,
      suggestedSafeActions: ["prepare_draft", "open_review_packet", "assign_owner"],
      unsafeActionRequests: [],
      rawPayloadIncluded: false,
    },
    expectations: {
      humanMode: "compact_must_push",
      workerMode: "bounded_instruction",
      reviewRequired: false,
      learningCategory: "positive_pattern_candidate",
    },
    ...overrides,
  };
}

const TARGETS = {
  maximumHumanBulletCount: 3,
  minimumReviewerEvidenceCoveragePercent: 100,
  maximumWorkerForbiddenActionLeakCount: 0,
  maximumRawPayloadEchoCount: 0,
  maximumAutoExecutionAttemptCount: 0,
  maximumCanonicalMemoryWriteCount: 0,
};

describe("audience-aware signal eval", () => {
  it("passes the checked-in audience projection fixture pack", () => {
    const summary = runAudienceSignalEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(6);
    expect(summary.humanSurfacedCases).toBe(3);
    expect(summary.workerInstructionCases).toBe(3);
    expect(summary.reviewRequiredCases).toBe(4);
    expect(summary.learningCandidateCases).toBe(6);
    expect(summary.humanOverloadCount).toBe(0);
    expect(summary.workerForbiddenActionLeakCount).toBe(0);
    expect(summary.rawPayloadEchoCount).toBe(0);
    expect(summary.autoExecutionAttemptCount).toBe(0);
    expect(summary.canonicalMemoryWriteCount).toBe(0);
  });

  it("projects Must Push-ready signals as compact human judgement plus bounded worker instruction", () => {
    const result = evaluateAudienceSignalCase(baseCase(), { targets: TARGETS });

    expect(result.decision).toBe("surface_to_human_and_worker");
    expect(result.human).toMatchObject({
      mode: "compact_must_push",
      surfaced: true,
      bulletCount: 3,
      primaryAction: "decide",
      nonCommitmentBoundaryVisible: true,
    });
    expect(result.worker).toMatchObject({
      mode: "bounded_instruction",
      instructionAllowed: true,
      receiptRequired: true,
      autoExecutionAttempted: false,
    });
    expect(result.worker.allowedActions).toEqual([
      "prepare_draft",
      "open_review_packet",
      "assign_owner",
    ]);
    expect(result.worker.forbiddenActions).toContain("send_email");
    expect(result.worker.forbiddenActions).toContain("update_crm_stage");
    expect(result.worker.forbiddenActions).toContain("canonical_memory_write");
  });

  it("downgrades review-required signals to review packet only for workers", () => {
    const result = evaluateAudienceSignalCase(
      baseCase({
        expectedDecision: "review_first",
        candidate: {
          ...baseCase().candidate,
          validityDisposition: "review_required",
          contradictoryEvidenceRefs: ["email:test:conflict"],
          suggestedSafeActions: ["prepare_draft", "open_review_packet", "collect_evidence"],
        },
        expectations: {
          humanMode: "review_banner",
          workerMode: "review_packet_only",
          reviewRequired: true,
          learningCategory: "threshold_or_boundary_candidate",
        },
      }),
      { targets: TARGETS },
    );

    expect(result.decision).toBe("review_first");
    expect(result.worker.mode).toBe("review_packet_only");
    expect(result.worker.allowedActions).toEqual(["open_review_packet", "collect_evidence"]);
    expect(result.worker.allowedActions).not.toContain("prepare_draft");
    expect(result.review.required).toBe(true);
    expect(result.review.contradictionVisible).toBe(true);
  });

  it("downgrades incomplete Must Push-ready signals before worker projection", () => {
    const result = evaluateAudienceSignalCase(
      baseCase({
        expectedDecision: "review_first",
        candidate: {
          ...baseCase().candidate,
          hasBoundaryNote: false,
        },
        expectations: {
          humanMode: "review_banner",
          workerMode: "review_packet_only",
          reviewRequired: true,
          learningCategory: "threshold_or_boundary_candidate",
        },
      }),
      { targets: TARGETS },
    );

    expect(result.decision).toBe("review_first");
    expect(result.worker.mode).toBe("review_packet_only");
    expect(result.worker.allowedActions).toEqual(["open_review_packet", "assign_owner"]);
    expect(result.failures).toContain("human_boundary_omission");
    expect(result.failures).toContain("review_boundary_omission");
  });

  it("blocks rejected signals from worker instruction even if unsafe actions were requested", () => {
    const result = evaluateAudienceSignalCase(
      baseCase({
        expectedDecision: "reject_and_contain",
        candidate: {
          ...baseCase().candidate,
          validityDisposition: "rejected",
          unsafeActionRequests: ["send_email", "update_crm_stage"],
        },
        expectations: {
          humanMode: "suppress_and_alert_reviewer",
          workerMode: "blocked",
          reviewRequired: true,
          learningCategory: "negative_fixture_candidate",
        },
      }),
      { targets: TARGETS },
    );

    expect(result.decision).toBe("reject_and_contain");
    expect(result.worker.mode).toBe("blocked");
    expect(result.worker.instructionAllowed).toBe(false);
    expect(result.worker.allowedActions).toEqual([]);
    expect(result.workerForbiddenActionLeakCount).toBe(0);
    expect(result.learning.category).toBe("negative_fixture_candidate");
  });

  it("fails the gate when raw payload would be echoed into the projection", () => {
    const fixture = {
      version: "broken-audience-signal",
      status: "offline_evaluation_fixture",
      redactionPosture: "synthetic_and_alias_only",
      boundary: "test-only",
      targets: TARGETS,
      cases: [
        baseCase({
          candidate: {
            ...baseCase().candidate,
            rawPayloadIncluded: true,
          },
        }),
      ],
    } satisfies AudienceSignalFixturePack;

    const summary = runAudienceSignalEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.rawPayloadEchoCount).toBe(1);
    expect(summary.failures).toContainEqual({
      caseId: "AUD-SIG-TEST",
      reason: "raw_payload_echo",
    });
  });
});
