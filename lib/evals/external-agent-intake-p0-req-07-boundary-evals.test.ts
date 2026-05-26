import { describe, expect, it } from "vitest";
import {
  runExternalAgentIntakeP0Req07BoundaryEval,
  type StrictBoundaryFixturePack,
} from "./external-agent-intake-p0-req-07-boundary-evals";

describe("external agent intake P0-REQ-07 strict boundary eval", () => {
  it("passes the default fixture pack with expected dispositions and reason codes", () => {
    const summary = runExternalAgentIntakeP0Req07BoundaryEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(8);
    expect(summary.passesStrictBoundaryCount).toBe(1);
    expect(summary.quarantineCount).toBe(7);
    expect(summary.failures).toEqual([]);

    const passCase = summary.caseResults.find((c) => c.caseId === "P0R7-PASS-001");
    expect(passCase?.actualDisposition).toBe("passes_strict_boundary");
    expect(passCase?.actualReasonCodes).toEqual([]);

    const multiViolation = summary.caseResults.find(
      (c) => c.caseId === "P0R7-MULTI-VIOLATION-001",
    );
    expect(multiViolation?.actualDisposition).toBe("quarantine");
    expect(multiViolation?.actualReasonCodes).toEqual(
      expect.arrayContaining([
        "cross_tenant",
        "unredacted",
        "no_trace",
        "stale",
        "missing_required_metadata",
      ]),
    );
  });

  it("fails when an expected reason code is not produced by the classifier", () => {
    const pack: StrictBoundaryFixturePack = {
      metadata: {
        version: "test-missing-reason",
        status: "offline_evaluation_fixture",
        redactionPosture: "synthetic_and_alias_only",
        boundary: "planning_only",
        expectedWorkspaceId: "ws-test",
        referenceTimeIso: "2026-05-05T00:00:00.000Z",
        description: "synthetic test fixture",
      },
      cases: [
        {
          id: "MISSING-REASON-CASE",
          expectedDisposition: "quarantine",
          expectedReasonCodes: ["cross_tenant"],
          artifact: {
            artifactId: "TEST-MISSING-REASON",
            workspaceId: "ws-test",
            providerId: "coze_manual",
            providerArtifactRef: "ref",
            artifactKind: "evidence_candidate",
            createdAt: "2026-05-04T00:00:00.000Z",
            sourceTimestamp: "2026-05-04T00:00:00.000Z",
            actorRef: "operator:demo",
            objectRef: { type: "opportunity", id: "opp-x" },
            actorVisibleSummary: "redacted",
            rawOutputHash: "sha256:abc",
            redactionStatus: "redacted",
            providerTraceRefs: ["coze:trace/x"],
            providerOutcomeStatus: "completed",
            citationsOrEvidenceRefs: [],
            declaredSideEffects: [],
            providerConfidenceClaim: 0.5,
            contentSummary: "redacted",
            contentShape: "text",
          },
        },
      ],
    };

    const summary = runExternalAgentIntakeP0Req07BoundaryEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) =>
        f.reason.startsWith("missing_expected_reason_codes:cross_tenant"),
      ),
    ).toBe(true);
    expect(
      summary.failures.some((f) => f.reason.startsWith("disposition_mismatch")),
    ).toBe(true);
  });
});
