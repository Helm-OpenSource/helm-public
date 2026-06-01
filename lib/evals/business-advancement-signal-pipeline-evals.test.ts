import { describe, expect, it } from "vitest";

import {
  evaluateBusinessAdvancementPipelineCase,
  runBusinessAdvancementSignalPipelineEval,
  type BusinessAdvancementPipelineCase,
  type BusinessAdvancementPipelineFixturePack,
} from "@/lib/evals/business-advancement-signal-pipeline-evals";

const BASE_CASE: BusinessAdvancementPipelineCase = {
  id: "BA-PIPE-TEST",
  source: {
    kind: "meeting",
    ref: "meeting:test",
    redactionStatus: "synthetic",
    rawPayloadIncluded: false,
  },
  object: {
    workspaceId: "workspace_demo",
    tenantKey: "helm-internal",
    sourceWindowKey: "2026-W18",
    objectType: "commitment",
    objectId: "commitment:test",
    canonicalObjectRef: "commitment:test",
    identityStable: true,
    tenantMismatch: false,
    crossWorkspaceConflict: false,
  },
  signal: {
    signalKey: "overdue_commitment:test",
    signalType: "overdue_commitment",
    severity: "high",
    evidenceRefs: ["meeting:test", "crm:test", "owner-note:test"],
    evidenceFreshnessHours: 12,
    sourceCount: 3,
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
  safeActionRequests: ["prepare_draft", "open_review_packet", "assign_owner"],
  unsafeActionRequests: [],
  expectedValidityDisposition: "must_push_ready",
  expectedFinalDisposition: "must_push_ready",
  expectedAudienceDecision: "surface_to_human_and_worker",
  expectedOutputs: {
    mustPushItem: true,
    reviewRequiredAction: false,
    workerInstruction: true,
    learningCandidate: true,
    remediationContainment: "not_required",
  },
};

const TARGETS: BusinessAdvancementPipelineFixturePack["targets"] = {
  minimumTotalCases: 1,
  minimumSourceKindCount: 1,
  minimumMustPushItemCount: 0,
  maximumMustPushItemCount: 5,
  maximumInvalidMustPushItemCount: 0,
  maximumRawPayloadEchoCount: 0,
  maximumAutoExecutionAttemptCount: 0,
  maximumOfficialWriteAttemptCount: 0,
  maximumCanonicalMemoryWriteCount: 0,
  minimumLearningCandidateCount: 1,
  minimumReviewerEvidenceCoveragePercent: 100,
  minimumRemediationCoveragePercent: 100,
};

describe("business advancement signal pipeline eval", () => {
  it("passes the checked-in end-to-end pipeline fixture pack", () => {
    const summary = runBusinessAdvancementSignalPipelineEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(20);
    expect(summary.sourceKindCount).toBeGreaterThanOrEqual(6);
    expect(summary.mustPushItemCount).toBe(5);
    expect(summary.reviewRequiredActionCount).toBe(11);
    expect(summary.workerInstructionCount).toBe(12);
    expect(summary.learningCandidateCount).toBe(20);
    expect(summary.remediationCaseCount).toBe(3);
    expect(summary.invalidMustPushItemCount).toBe(0);
    expect(summary.rawPayloadEchoCount).toBe(0);
    expect(summary.autoExecutionAttemptCount).toBe(0);
    expect(summary.officialWriteAttemptCount).toBe(0);
    expect(summary.canonicalMemoryWriteCount).toBe(0);
    expect(summary.averageReviewerEvidenceCoveragePercent).toBe(100);
    expect(summary.averageRemediationCoveragePercent).toBe(100);
  });

  it("surfaces valid signals as Must Push plus bounded Worker instruction", () => {
    const result = evaluateBusinessAdvancementPipelineCase(BASE_CASE);

    expect(result.validity.disposition).toBe("must_push_ready");
    expect(result.finalDisposition).toBe("must_push_ready");
    expect(result.audience.decision).toBe("surface_to_human_and_worker");
    expect(result.outputs).toMatchObject({
      mustPushItem: true,
      reviewRequiredAction: false,
      workerInstruction: true,
      learningCandidate: true,
      remediationContainment: "not_required",
    });
    expect(result.audience.worker.allowedActions).toEqual([
      "prepare_draft",
      "open_review_packet",
      "assign_owner",
    ]);
  });

  it("routes contradictory evidence to review-first without Must Push output", () => {
    const result = evaluateBusinessAdvancementPipelineCase({
      ...BASE_CASE,
      signal: {
        ...BASE_CASE.signal,
        signalKey: "blocked_decision:test",
        signalType: "blocked_decision",
        contradictoryEvidenceRefs: ["email:test:conflict"],
      },
      safeActionRequests: ["open_review_packet", "collect_evidence"],
      expectedValidityDisposition: "review_required",
      expectedFinalDisposition: "review_required",
      expectedAudienceDecision: "review_first",
      expectedOutputs: {
        mustPushItem: false,
        reviewRequiredAction: true,
        workerInstruction: true,
        learningCandidate: true,
        remediationContainment: "not_required",
      },
    });

    expect(result.validity.disposition).toBe("review_required");
    expect(result.outputs.mustPushItem).toBe(false);
    expect(result.outputs.reviewRequiredAction).toBe(true);
    expect(result.outputs.workerInstruction).toBe(true);
    expect(result.audience.worker.allowedActions).toEqual(["open_review_packet", "collect_evidence"]);
  });

  it("revokes post-admission stale Must Push exposure before projection", () => {
    const result = evaluateBusinessAdvancementPipelineCase({
      ...BASE_CASE,
      id: "BA-PIPE-TEST-REVOKE",
      postAdmission: {
        currentExposures: {
          mustPushItemIds: ["must-push:test"],
          reviewPacketIds: [],
          draftIds: ["draft:test"],
          memoryCandidateIds: ["memory-candidate:test"],
          canonicalMemoryIds: [],
          skillSuggestionIds: [],
          officialWriteIds: [],
        },
        postAdmissionFindings: {
          staleEvidence: true,
          contradictoryEvidence: false,
          duplicateSignal: false,
          wrongObjectBinding: false,
          tenantMismatch: false,
          unsafeBoundary: false,
          officialWriteIntent: false,
          canonicalMemoryWrite: false,
        },
        operatorCorrection: "outdated",
        expectedContainment: "revoked",
        expectedActions: [
          "remove_must_push",
          "quarantine_draft",
          "quarantine_memory_candidate",
          "create_learning_candidate",
        ],
      },
      expectedFinalDisposition: "watch_only",
      expectedAudienceDecision: "watch_only_digest",
      expectedOutputs: {
        mustPushItem: false,
        reviewRequiredAction: false,
        workerInstruction: false,
        learningCandidate: true,
        remediationContainment: "revoked",
      },
    });

    expect(result.remediation?.containment).toBe("revoked");
    expect(result.finalDisposition).toBe("watch_only");
    expect(result.outputs.mustPushItem).toBe(false);
    expect(result.outputs.remediationContainment).toBe("revoked");
  });

  it("blocks unredacted external-agent payloads before audience projection", () => {
    const result = evaluateBusinessAdvancementPipelineCase({
      ...BASE_CASE,
      source: {
        kind: "external_agent",
        ref: "external-agent:test",
        redactionStatus: "unredacted",
        rawPayloadIncluded: true,
        provider: "openclaw_local",
      },
      expectedFinalDisposition: "rejected",
      expectedAudienceDecision: "reject_and_contain",
      expectedOutputs: {
        mustPushItem: false,
        reviewRequiredAction: true,
        workerInstruction: false,
        learningCandidate: true,
        remediationContainment: "not_required",
      },
    });

    expect(result.outputs.sourcePreflightBlocked).toBe(true);
    expect(result.finalDisposition).toBe("rejected");
    expect(result.rawPayloadEchoCount).toBe(0);
    expect(result.outputs.workerInstruction).toBe(false);
  });

  it("fails when a broken case expects Must Push despite cross-workspace identity", () => {
    const fixture = {
      version: "broken-pipeline",
      status: "offline_evaluation_fixture",
      redactionPosture: "synthetic_and_alias_only",
      boundary: "test-only",
      targets: TARGETS,
      cases: [
        {
          ...BASE_CASE,
          object: {
            ...BASE_CASE.object,
            identityStable: false,
            tenantMismatch: true,
            crossWorkspaceConflict: true,
          },
        },
      ],
    } satisfies BusinessAdvancementPipelineFixturePack;

    const summary = runBusinessAdvancementSignalPipelineEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.caseResults[0]?.validity.disposition).toBe("rejected");
    expect(summary.failures).toContainEqual({
      caseId: "BA-PIPE-TEST",
      reason: "validity_disposition_mismatch",
    });
    expect(summary.failures).toContainEqual({
      caseId: "BA-PIPE-TEST",
      reason: "must_push_output_mismatch",
    });
  });
});
