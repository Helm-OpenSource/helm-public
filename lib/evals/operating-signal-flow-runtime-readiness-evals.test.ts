import { describe, expect, it } from "vitest";

import {
  evaluateOperatingSignalFlowRuntimeReadinessCase,
  evaluateOperatingSignalFlowRuntimeReadinessJson,
  OPERATING_SIGNAL_FLOW_REQUIRED_REVIEWER_MINIMUM_ROLE_COUNT,
  OPERATING_SIGNAL_FLOW_REQUIRED_REVIEWER_ROLES,
  runOperatingSignalFlowRuntimeReadinessEval,
  scoreOperatingSignalFlowRuntimeReadinessBundle,
} from "@/lib/evals/operating-signal-flow-runtime-readiness-evals";
import type {
  OperatingSignalFlowRuntimeReadinessCase,
  OperatingSignalFlowRuntimeReadinessFixturePack,
} from "@/lib/evals/operating-signal-flow-runtime-readiness-evals";

describe("operating signal flow runtime readiness eval", () => {
  it("passes the checked-in Phase 2.2 readiness review bundle cases", () => {
    const summary = runOperatingSignalFlowRuntimeReadinessEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(8);
    expect(summary.goDecisionCount).toBe(1);
    expect(summary.deferDecisionCount).toBe(2);
    expect(summary.noGoDecisionCount).toBe(5);
    expect(summary.rawPayloadEchoCount).toBe(3);
    expect(summary.runtimeImplementationBypassCount).toBe(5);
    expect(summary.crossWorkspaceProjectionCount).toBe(3);
    expect(summary.llmFinalRankingCount).toBe(1);
    expect(summary.authorityLeakCount).toBe(10);
  });

  it("is deterministic for the same review bundle input", () => {
    const first = runOperatingSignalFlowRuntimeReadinessEval();
    const second = runOperatingSignalFlowRuntimeReadinessEval();

    expect(second).toEqual(first);
    expect(first.inputDigest).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("defers when a required approval is missing but no hard boundary is crossed", () => {
    const result = evaluateOperatingSignalFlowRuntimeReadinessCase({
      ...BASE_GO_CASE,
      expectedDecision: "defer",
      expectedFailureCodes: ["executive_sponsor_approval_missing"],
      reviewBundle: {
        ...BASE_GO_CASE.reviewBundle,
        reviews: {
          ...BASE_GO_CASE.reviewBundle.reviews,
          executiveSponsorApproval: {
            ...BASE_GO_CASE.reviewBundle.reviews.executiveSponsorApproval,
            status: "missing",
            approvedAt: null,
          },
        },
      },
    });

    expect(result.decision).toBe("defer");
    expect(result.reviewFailures.map((item) => item.code)).toContain("executive_sponsor_approval_missing");
    expect(result.assertionFailures).toEqual([]);
  });

  it("rejects runtime implementation bypass before review bundle approval", () => {
    const result = evaluateOperatingSignalFlowRuntimeReadinessCase({
      ...BASE_GO_CASE,
      expectedDecision: "no_go",
      expectedFailureCodes: [
        "runtime_implementation_present",
        "schema_change_proposed",
        "api_route_proposed",
        "runtime_query_implemented",
      ],
      reviewBundle: {
        ...BASE_GO_CASE.reviewBundle,
        adoptionMode: "runtime_implementation",
        productionQueryRolloutPlan: {
          ...BASE_GO_CASE.reviewBundle.productionQueryRolloutPlan,
          status: "implemented",
          schemaChangeProposed: true,
          apiRouteProposed: true,
          runtimeQueryImplemented: true,
        },
      },
    });

    expect(result.decision).toBe("no_go");
    expect(result.runtimeImplementationBypassCount).toBe(5);
    expect(result.reviewFailures.map((item) => item.code)).toContain("runtime_implementation_present");
    expect(result.assertionFailures).toEqual([]);
  });

  it("detects bearer tokens and provider API keys in redacted snapshot samples", () => {
    const result = evaluateOperatingSignalFlowRuntimeReadinessCase({
      ...BASE_GO_CASE,
      expectedDecision: "no_go",
      expectedFailureCodes: ["raw_bearer_token_pattern", "raw_api_key_pattern"],
      reviewBundle: {
        ...BASE_GO_CASE.reviewBundle,
        redactedSnapshotProjection: {
          ...BASE_GO_CASE.reviewBundle.redactedSnapshotProjection,
          fieldSamples: {
            ...BASE_GO_CASE.reviewBundle.redactedSnapshotProjection.fieldSamples,
            tokenAlias: "Bearer abcdefghijklmnopqrstuvwxyz",
            keyAlias: "sk-abcdefghijklmnopqrstuvwx",
          },
        },
      },
    });

    expect(result.decision).toBe("no_go");
    expect(result.rawPayloadEchoCount).toBe(2);
    expect(result.reviewFailures.map((item) => item.code)).toEqual(
      expect.arrayContaining(["raw_bearer_token_pattern", "raw_api_key_pattern"]),
    );
    expect(result.assertionFailures).toEqual([]);
  });

  it("scores a standalone review bundle without expected-decision assertions", () => {
    const result = scoreOperatingSignalFlowRuntimeReadinessBundle(
      BASE_GO_CASE.reviewBundle,
      "2026-05-17T16:00:00+08:00",
      "OSF-RRG-STANDALONE",
    );

    expect(result.caseId).toBe("OSF-RRG-STANDALONE");
    expect(result.expectedDecision).toBe(result.decision);
    expect(result.assertionFailures).toEqual([]);
  });

  it("defers when the runtime adoption bundle does not carry all five Required Reviewer roles", () => {
    const result = evaluateOperatingSignalFlowRuntimeReadinessCase({
      ...BASE_GO_CASE,
      expectedDecision: "defer",
      expectedFailureCodes: [
        "required_reviewer_minimum_role_count_too_low",
        "required_reviewer_canonical_roles_missing",
      ],
      reviewBundle: {
        ...BASE_GO_CASE.reviewBundle,
        reviews: {
          ...BASE_GO_CASE.reviewBundle.reviews,
          requiredReviewerApproval: {
            ...BASE_GO_CASE.reviewBundle.reviews.requiredReviewerApproval,
            reviewerRoles: ["engineering_reviewer", "product_owner"],
            minimumRoleCount: 2,
          },
        },
      },
    });

    expect(result.decision).toBe("defer");
    expect(result.reviewFailures.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "required_reviewer_minimum_role_count_too_low",
        "required_reviewer_canonical_roles_missing",
      ]),
    );
    expect(result.assertionFailures).toEqual([]);
  });

  it("rejects malformed timestamps and unknown rollout stages as typed failures", () => {
    const result = evaluateOperatingSignalFlowRuntimeReadinessCase({
      ...BASE_GO_CASE,
      expectedDecision: "no_go",
      expectedFailureCodes: ["invalid_timestamp", "production_query_rollout_unknown_stage:auto_execute"],
      reviewBundle: {
        ...BASE_GO_CASE.reviewBundle,
        redactedCalibrationSample: {
          ...BASE_GO_CASE.reviewBundle.redactedCalibrationSample,
          createdAt: "not-a-date",
        },
        productionQueryRolloutPlan: {
          ...BASE_GO_CASE.reviewBundle.productionQueryRolloutPlan,
          rolloutStages: ["shadow", "canary", "general_review", "auto_execute" as never],
        },
      },
    });

    expect(result.decision).toBe("no_go");
    expect(result.reviewFailures.map((item) => item.code)).toContain("invalid_timestamp");
    expect(result.reviewFailures.map((item) => item.code)).toContain(
      "production_query_rollout_unknown_stage:auto_execute",
    );
    expect(result.assertionFailures).toEqual([]);
  });

  it("fails if an expected boundary failure is not detected", () => {
    const brokenPack: OperatingSignalFlowRuntimeReadinessFixturePack = {
      version: "broken",
      status: "offline_review_gate_only",
      boundary: "test",
      evaluatedAt: "2026-05-17T16:00:00+08:00",
      targets: {
        minimumTotalCases: 1,
        minimumGoDecisionCount: 1,
        minimumDeferDecisionCount: 0,
        minimumNoGoDecisionCount: 0,
        maximumGoCaseFailureCount: 0,
        maximumGoCaseHardFailureCount: 0,
      },
      cases: [
        {
          ...BASE_GO_CASE,
          expectedFailureCodes: ["raw_payload_included"],
        },
      ],
    };

    const summary = runOperatingSignalFlowRuntimeReadinessEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.assertionFailures).toContainEqual({
      caseId: "OSF-RRG-GO-001",
      reason: "expected_failure_not_detected:raw_payload_included",
      path: "$.expectedFailureCodes",
    });
  });

  it("returns typed failures for malformed JSON and invalid fixture shapes", () => {
    const malformed = evaluateOperatingSignalFlowRuntimeReadinessJson("{");
    const invalidShape = runOperatingSignalFlowRuntimeReadinessEval({ version: "bad" });

    expect(malformed.passed).toBe(false);
    expect(malformed.failures[0]?.code).toBe("invalid_json");
    expect(invalidShape.passed).toBe(false);
    expect(invalidShape.failures[0]?.code).toBe("invalid_fixture_shape");
  });
});

const BASE_GO_CASE: OperatingSignalFlowRuntimeReadinessCase = {
  id: "OSF-RRG-GO-001",
  description: "A complete readiness review bundle may proceed to the next review but not ship runtime.",
  expectedDecision: "go",
  expectedFailureCodes: [],
  reviewBundle: {
    adoptionMode: "review_bundle",
    issuedAt: "2026-05-17T14:00:00+08:00",
    expiresAt: "2026-06-16T14:00:00+08:00",
    revokedBy: null,
    revokedReason: null,
    redactedCalibrationSample: {
      present: true,
      createdAt: "2026-05-17T13:00:00+08:00",
      sampleWindow: "24h",
      windowStart: "2026-05-16T13:00:00+08:00",
      windowEnd: "2026-05-17T13:00:00+08:00",
      workspaceScope: "single_workspace",
      redactionStatus: "redacted",
      evidenceRefCount: 4,
      rawPayloadIncluded: false,
      calibrationDeltaDocumented: true,
      fixtureParityChecked: true,
    },
    redactedSnapshotProjection: {
      present: true,
      generatedAt: "2026-05-17T12:30:00+08:00",
      workspaceIds: ["workspace_alias_primary"],
      shapeChecked: true,
      fieldSamples: {
        workspaceId: "workspace_alias_primary",
        accountRef: "account_alias_17",
        signalKey: "signal_alias_commitment_42",
        sourceRef: "source_alias_crm_3",
      },
    },
    reviews: {
      dataProtectionReview: {
        status: "approved",
        reviewedAt: "2026-05-17T13:20:00+08:00",
        reviewerRole: "data_protection",
      },
      requiredReviewerApproval: {
        status: "approved",
        approvedAt: "2026-05-17T13:40:00+08:00",
        reviewerRoles: [...OPERATING_SIGNAL_FLOW_REQUIRED_REVIEWER_ROLES],
        minimumRoleCount: OPERATING_SIGNAL_FLOW_REQUIRED_REVIEWER_MINIMUM_ROLE_COUNT,
      },
      executiveSponsorApproval: {
        status: "approved",
        approvedAt: "2026-05-17T13:55:00+08:00",
        sponsorRole: "executive_sponsor",
      },
    },
    productionQueryRolloutPlan: {
      present: true,
      status: "planned",
      queryName: "operating_signal_flow_snapshot_candidate",
      sourceTableRefs: ["existing_signal_read_model", "existing_review_packet_read_model"],
      volumeEstimateRowsPerHour: 120,
      indexPlan: "Reuse existing workspaceId and occurredAt indexes; no new schema in this gate.",
      performanceBudgetMs: 300,
      observabilityPlan: "Shadow metrics for rows, latency, rejected raw patterns and boundary-stopped count.",
      rolloutStages: ["shadow", "canary", "general_review"],
      usesExistingSourcesOnly: true,
      singleWorkspaceSnapshotProjection: true,
      schemaChangeProposed: false,
      apiRouteProposed: false,
      runtimeQueryImplemented: false,
      rollbackPlanPresent: true,
      blastRadius: "single_workspace",
    },
    llmPosture: {
      explanationOnly: true,
      finalRanking: "disabled",
      stateTransitionByLlm: false,
    },
    authority: {
      officialWriteAllowed: false,
      autoSendAllowed: false,
      autoApproveAllowed: false,
      silentWriteAllowed: false,
      autoExecuteAllowed: false,
    },
    artifacts: {
      docsUpdated: true,
      evalUpdated: true,
      boundaryGuardUpdated: true,
    },
    evidenceRefs: [
      "calibration:osf-redacted-sample-001",
      "data-protection:review-001",
      "required-reviewer:approval-001",
      "executive-sponsor:approval-001",
    ],
  },
};
